<?php
/**
 * Endpoint de Gestión y Pasarela de Pagos (ENMI 2027)
 * Soporta:
 *  - GET  ?accion=info: Consulta pública de datos de pago (Bizum, Transferencia, Redsys sandbox, Otras)
 *  - POST accion: 'iniciar_redsys': Generación de parámetros y firma oficial HMAC-SHA256 para TPV Redsys
 *  - POST accion: 'confirmar_modalidad': Elección de Bizum, Transferencia u Otras (estado -> 'pendiente')
 *  - POST accion: 'simular_redsys': Simulador local de Redsys (resultado: 'ok' -> 'pagada', 'ko' -> 'pendiente')
 *  - POST / GET ?accion=redsys_retorno: Notificación y retorno oficial de Redsys
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/mailer.php';
require_once __DIR__ . '/pago-registro.php';

$pdo = getDbConnection();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

/**
 * Función auxiliar para calcular la firma HMAC-SHA256 oficial de Redsys
 * Aplica diversificación de clave 3DES-CBC con relleno nulo (Zero-Padding) según el estándar oficial de Redsys
 */
function redsysComputeSignature(string $merchantParameters, string $order, string $secretKeyB64): string {
    $secretKey = base64_decode($secretKeyB64);
    $l = (int)ceil(strlen($order) / 8) * 8;
    $paddedOrder = $order . str_repeat("\0", $l - strlen($order));
    $iv = "\0\0\0\0\0\0\0\0";
    $keyOrder = substr(openssl_encrypt($paddedOrder, 'des-ede3-cbc', $secretKey, OPENSSL_RAW_DATA, $iv), 0, $l);
    $res = hash_hmac('sha256', $merchantParameters, $keyOrder, true);
    return base64_encode($res);
}

/**
 * Registra o actualiza una entrada en la tabla `enmi_pagos` para auditoría y control de pagos.
 *
 * @param PDO $pdo Conexión PDO
 * @param int $inscripcionId ID de la inscripción
 * @param string $modalidad 'redsys', 'bizum', 'transferencia', 'otras'
 * @param string $estado 'pagado' o 'no-pagado'
 * @param float|null $importe Cantidad pagada (en euros)
 * @param string|null $referencia Código único de referencia / pedido
 * @param string|null $concepto Descripción del pago
 * @param string|null $notas Información adicional relevante
 * @param array|null $datosTransaccion Datos técnicos y parámetros adicionales
 * @return int ID del registro en enmi_pagos
 */
function registrarPago(
    PDO $pdo,
    int $inscripcionId,
    string $modalidad,
    string $estado,
    ?float $importe = null,
    ?string $referencia = null,
    ?string $concepto = null,
    ?string $notas = null,
    ?array $datosTransaccion = null
): int {
    if ($importe === null || $importe <= 0) {
        $importe = getPagoImporteConfig($pdo);
    }

    if (empty($concepto)) {
        try {
            $stmtIns = $pdo->prepare("SELECT nombre, apellidos FROM `enmi_inscripciones` WHERE id = :id LIMIT 1");
            $stmtIns->execute([':id' => $inscripcionId]);
            $insData = $stmtIns->fetch(PDO::FETCH_ASSOC);
            $nombreComp = $insData ? trim(($insData['nombre'] ?? '') . ' ' . ($insData['apellidos'] ?? '')) : 'Participante #' . $inscripcionId;
            $concepto = 'Inscripción ENMI 2027 #' . $inscripcionId . ' - ' . $nombreComp;
        } catch (Throwable $e) {
            $concepto = 'Inscripción ENMI 2027 #' . $inscripcionId;
        }
    }

    if (empty($referencia)) {
        $prefix = strtoupper(substr($modalidad, 0, 3));
        $referencia = sprintf('ENMI-%s-%d-%s', $prefix, $inscripcionId, strtoupper(substr(uniqid(), -6)));
    }

    $fechaCompra = ($estado === 'pagado') ? date('Y-m-d H:i:s') : null;
    $datosJson = !empty($datosTransaccion) ? json_encode($datosTransaccion, JSON_UNESCAPED_UNICODE) : null;

    // Comprobar si ya existe un registro con esta referencia para actualizarlo, o insertar uno nuevo
    $stmtCheck = $pdo->prepare("SELECT id FROM `enmi_pagos` WHERE referencia = :ref LIMIT 1");
    $stmtCheck->execute([':ref' => $referencia]);
    $existente = $stmtCheck->fetch(PDO::FETCH_ASSOC);

    if ($existente) {
        $pagoId = (int)$existente['id'];
        $stmtUp = $pdo->prepare("
            UPDATE `enmi_pagos` 
            SET `estado` = :estado,
                `cantidad_pagada` = :cantidad,
                `modalidad_pago` = :modalidad,
                `fecha_compra` = :fecha_compra,
                `notas` = :notas,
                `datos_transaccion` = :datos,
                `fecha_actualizacion` = NOW()
            WHERE id = :id
        ");
        $stmtUp->execute([
            ':estado'       => $estado,
            ':cantidad'     => $importe,
            ':modalidad'    => $modalidad,
            ':fecha_compra' => $fechaCompra,
            ':notas'        => $notas,
            ':datos'        => $datosJson,
            ':id'           => $pagoId
        ]);
        return $pagoId;
    }

    $stmtInsert = $pdo->prepare("
        INSERT INTO `enmi_pagos` (
            `inscripcion_id`,
            `referencia`,
            `concepto`,
            `cantidad_pagada`,
            `modalidad_pago`,
            `estado`,
            `fecha_compra`,
            `notas`,
            `datos_transaccion`,
            `fecha_creacion`
        ) VALUES (
            :inscripcion_id,
            :referencia,
            :concepto,
            :cantidad_pagada,
            :modalidad_pago,
            :estado,
            :fecha_compra,
            :notas,
            :datos_transaccion,
            NOW()
        )
    ");

    $stmtInsert->execute([
        ':inscripcion_id'   => $inscripcionId,
        ':referencia'       => $referencia,
        ':concepto'         => $concepto,
        ':cantidad_pagada'  => $importe,
        ':modalidad_pago'   => $modalidad,
        ':estado'           => $estado,
        ':fecha_compra'     => $fechaCompra,
        ':notas'            => $notas,
        ':datos_transaccion'=> $datosJson
    ]);

    return (int)$pdo->lastInsertId();
}

/**
 * Alias de compatibilidad
 */
function registrarCompraPago(
    PDO $pdo,
    int $inscripcionId,
    string $modalidad,
    string $estado,
    ?float $importe = null,
    ?string $referencia = null,
    ?string $concepto = null,
    ?string $notas = null,
    ?array $datosTransaccion = null
): int {
    return registrarPago($pdo, $inscripcionId, $modalidad, $estado, $importe, $referencia, $concepto, $notas, $datosTransaccion);
}

/**
 * Valida un código de descuento en la tabla enmi_tokens sin descontar usos.
 * Comprueba:
 *  - Que exista con tipo adecuado ('descuento', 'codigo_descuento', 'código de descuento', 'codigo de descuento')
 *  - Que fecha_caducidad >= NOW()
 *  - Que utilizado > 0 (la columna utilizado almacena los usos restantes)
 * Calcula el descuento a partir de la columna 'valor' (en euros o porcentaje)
 */
function validarTokenDescuento(PDO $pdo, string $codigo, float $precioBase): array {
    $codigo = trim($codigo);
    if (empty($codigo)) {
        return ['valido' => false, 'mensaje' => 'Debes introducir un código de descuento.'];
    }

    try {
        $stmt = $pdo->prepare("
            SELECT id, token, tipo, valor, descripcion, fecha_caducidad, utilizado
            FROM `enmi_tokens`
            WHERE UPPER(TRIM(token)) = UPPER(:token)
              AND tipo IN ('descuento', 'codigo_descuento', 'código de descuento', 'codigo de descuento')
            LIMIT 1
        ");
        $stmt->execute([':token' => $codigo]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            return ['valido' => false, 'mensaje' => 'El código de descuento no está disponible o no existe.'];
        }

        // Comprobar fecha de caducidad
        $now = new DateTime();
        $caducidad = new DateTime($row['fecha_caducidad']);
        if ($caducidad < $now) {
            return ['valido' => false, 'mensaje' => 'El código de descuento no está disponible (ha caducado).'];
        }

        // Comprobar usos disponibles (utilizado = número de usos restantes)
        $usosRestantes = (int)$row['utilizado'];
        if ($usosRestantes <= 0) {
            return ['valido' => false, 'mensaje' => 'El código de descuento no está disponible (usos agotados).'];
        }

        // Calcular el descuento a partir de la columna valor
        $valorRaw = trim((string)$row['valor']);
        $descuento = 0.0;

        if (strpos($valorRaw, '%') !== false) {
            $porcentaje = floatval(preg_replace('/[^0-9\.]/', '', str_replace(',', '.', $valorRaw)));
            $descuento = round(($precioBase * $porcentaje) / 100, 2);
        } else {
            $descuento = floatval(preg_replace('/[^0-9\.]/', '', str_replace(',', '.', $valorRaw)));
        }

        if ($descuento <= 0) {
            return ['valido' => false, 'mensaje' => 'El código no tiene un valor de descuento aplicable.'];
        }

        if ($descuento > $precioBase) {
            $descuento = $precioBase;
        }

        $nuevoTotal = round($precioBase - $descuento, 2);
        if ($nuevoTotal < 0) {
            $nuevoTotal = 0.0;
        }

        return [
            'valido'          => true,
            'token_id'        => (int)$row['id'],
            'token'           => (string)$row['token'],
            'descuento'       => $descuento,
            'descuento_str'   => number_format($descuento, 2, '.', ''),
            'precio_original' => $precioBase,
            'nuevo_total'     => $nuevoTotal,
            'nuevo_total_str' => number_format($nuevoTotal, 2, '.', ''),
            'usos_restantes'  => $usosRestantes,
            'descripcion'     => (string)($row['descripcion'] ?? ''),
            'mensaje'         => '¡Código de descuento aplicado correctamente!'
        ];
    } catch (Throwable $e) {
        return ['valido' => false, 'mensaje' => 'Error al validar el código: ' . $e->getMessage()];
    }
}

/**
 * Valida y descuenta 1 uso en la columna 'utilizado' de enmi_tokens.
 * Reutiliza el descuento ya consumido por un pago pendiente de la misma inscripción.
 */
function consumirTokenDescuento(PDO $pdo, string $codigo, float $precioBase, int $inscripcionId): array {
    $codigo = trim($codigo);
    if (empty($codigo)) {
        return ['exito' => false, 'mensaje' => 'Código no proporcionado.'];
    }

    try {
        $stmtPrevio = $pdo->prepare("
            SELECT datos_transaccion
            FROM `enmi_pagos`
            WHERE inscripcion_id = :inscripcion_id AND estado = 'no-pagado'
            ORDER BY id DESC
        ");
        $stmtPrevio->execute([':inscripcion_id' => $inscripcionId]);
        while ($pagoPrevio = $stmtPrevio->fetch(PDO::FETCH_ASSOC)) {
            if (empty($pagoPrevio['datos_transaccion'])) {
                continue;
            }
            $datos = json_decode($pagoPrevio['datos_transaccion'], true, 512, JSON_THROW_ON_ERROR);
            if (!is_array($datos) || strcasecmp(trim((string)($datos['codigo_descuento'] ?? '')), $codigo) !== 0) {
                continue;
            }
            if (!isset($datos['descuento_importe']) || !is_numeric($datos['descuento_importe']) || (float)$datos['descuento_importe'] < 0) {
                throw new RuntimeException('El pago anterior no contiene un importe de descuento válido.');
            }

            $descuento = min((float)$datos['descuento_importe'], $precioBase);
            $nuevoTotal = round($precioBase - $descuento, 2);
            return [
                'exito' => true,
                'token' => (string)$datos['codigo_descuento'],
                'descuento' => $descuento,
                'descuento_str' => number_format($descuento, 2, '.', ''),
                'precio_original' => $precioBase,
                'nuevo_total' => $nuevoTotal,
                'nuevo_total_str' => number_format($nuevoTotal, 2, '.', '')
            ];
        }

        $stmt = $pdo->prepare("
            SELECT id, token, tipo, valor, descripcion, fecha_caducidad, utilizado
            FROM `enmi_tokens`
            WHERE UPPER(TRIM(token)) = UPPER(:token)
              AND tipo IN ('descuento', 'codigo_descuento', 'código de descuento', 'codigo de descuento')
            FOR UPDATE
        ");
        $stmt->execute([':token' => $codigo]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            return ['exito' => false, 'mensaje' => 'El código de descuento no está disponible o no existe.'];
        }

        $now = new DateTime();
        $caducidad = new DateTime($row['fecha_caducidad']);
        if ($caducidad < $now) {
            return ['exito' => false, 'mensaje' => 'El código de descuento no está disponible (ha caducado).'];
        }

        $usosRestantes = (int)$row['utilizado'];
        if ($usosRestantes <= 0) {
            return ['exito' => false, 'mensaje' => 'El código de descuento ya no está disponible (usos agotados).'];
        }

        // Decrementar en 1 la columna utilizado
        $tokenId = (int)$row['id'];
        $stmtUp = $pdo->prepare("
            UPDATE `enmi_tokens`
            SET `utilizado` = `utilizado` - 1,
                `fecha_uso` = NOW()
            WHERE `id` = :id AND `utilizado` > 0
        ");
        $stmtUp->execute([':id' => $tokenId]);

        if ($stmtUp->rowCount() === 0) {
            return ['exito' => false, 'mensaje' => 'El código de descuento ya no está disponible (usos agotados).'];
        }

        // Calcular el descuento final
        $valorRaw = trim((string)$row['valor']);
        $descuento = 0.0;

        if (strpos($valorRaw, '%') !== false) {
            $porcentaje = floatval(preg_replace('/[^0-9\.]/', '', str_replace(',', '.', $valorRaw)));
            $descuento = round(($precioBase * $porcentaje) / 100, 2);
        } else {
            $descuento = floatval(preg_replace('/[^0-9\.]/', '', str_replace(',', '.', $valorRaw)));
        }

        if ($descuento > $precioBase) {
            $descuento = $precioBase;
        }

        $nuevoTotal = round($precioBase - $descuento, 2);
        if ($nuevoTotal < 0) {
            $nuevoTotal = 0.0;
        }

        logInfo('tokens', 'descuento_aplicado', "Código '{$row['token']}' aplicado (-{$descuento} €). Usos restantes: " . ($usosRestantes - 1), [
            'token_id'        => $tokenId,
            'codigo'          => $row['token'],
            'descuento'       => $descuento,
            'usos_anteriores' => $usosRestantes,
            'usos_restantes'  => $usosRestantes - 1
        ]);

        return [
            'exito'           => true,
            'token_id'        => $tokenId,
            'token'           => (string)$row['token'],
            'descuento'       => $descuento,
            'descuento_str'   => number_format($descuento, 2, '.', ''),
            'precio_original' => $precioBase,
            'nuevo_total'     => $nuevoTotal,
            'nuevo_total_str' => number_format($nuevoTotal, 2, '.', ''),
            'usos_restantes'  => $usosRestantes - 1,
            'descripcion'     => (string)($row['descripcion'] ?? '')
        ];
    } catch (Throwable $e) {
        logError('pagos', 'error_consumir_descuento', $e->getMessage());
        return ['exito' => false, 'mensaje' => 'Error al procesar el código de descuento: ' . $e->getMessage()];
    }
}

// =====================================================================
// 1. GET: Consulta de información pública de pago o retorno Redsys
// =====================================================================
if ($method === 'GET') {
    $accion = isset($_GET['accion']) ? trim((string)$_GET['accion']) : 'info';

    if ($accion === 'info') {
        try {
            $importe           = getPagoImporteConfigString($pdo);
            $bizumTelefono     = (string)getConfigValue('pago_bizum_telefono', '+34 600 000 000', $pdo);
            $bizumBeneficiario = (string)getConfigValue('pago_bizum_beneficiario', 'Encuentro Nacional de Magos Infantiles (ENMI)', $pdo);
            $transfIban        = (string)getConfigValue('pago_transferencia_iban', 'ES00 0000 0000 0000 0000 0000', $pdo);
            $transfTitular     = (string)getConfigValue('pago_transferencia_titular', 'Asociación ENMI 2027 / Eutikea', $pdo);
            $transfBanco       = (string)getConfigValue('pago_transferencia_banco', 'Banco Santander', $pdo);
            $transfConcepto    = (string)getConfigValue('pago_transferencia_concepto', 'ENMI-2027-{ID}-{APELLIDOS}', $pdo);
            $otrasTexto        = (string)getConfigValue('pago_otras_modalidades_texto', 'Para otra forma de pago, nos pondremos en contacto contigo personalmente a través de tu teléfono o email.', $pdo);
            $redsysEntorno     = (string)getConfigValue('pago_redsys_entorno', 'sandbox', $pdo);
            $redsysUrlSandbox  = (string)getConfigValue('pago_redsys_url_sandbox', 'https://sis-t.redsys.es:25443/sis/realizarPago', $pdo);
            $redsysUrlProd     = (string)getConfigValue('pago_redsys_url_produccion', 'https://sis.redsys.es/sis/realizarPago', $pdo);

            $tpvUrl = ($redsysEntorno === 'produccion') ? $redsysUrlProd : $redsysUrlSandbox;

            sendJsonResponse([
                'success'       => true,
                'importe'       => $importe,
                'bizum'         => [
                    'telefono'     => $bizumTelefono,
                    'beneficiario' => $bizumBeneficiario
                ],
                'transferencia' => [
                    'iban'              => $transfIban,
                    'titular'           => $transfTitular,
                    'banco'             => $transfBanco,
                    'concepto_template' => $transfConcepto
                ],
                'otras'         => [
                    'texto' => $otrasTexto
                ],
                'redsys'        => [
                    'entorno' => $redsysEntorno,
                    'sandbox' => ($redsysEntorno !== 'produccion'),
                    'tpv_url' => $tpvUrl
                ],
                'demo_pago'     => isPagoDemoMode($pdo)
            ], 200);

        } catch (Throwable $e) {
            logError('pagos', 'error_get_pago_info', $e->getMessage());
            sendJsonResponse([
                'success' => false,
                'message' => 'Error al obtener la configuración de pago: ' . $e->getMessage()
            ], 500);
        }
    }

    // Validar código de descuento (GET)
    if ($accion === 'validar_descuento') {
        $codigo = isset($_GET['codigo']) ? trim((string)$_GET['codigo']) : '';
        $precioBase = getPagoImporteConfig($pdo);
        $res = validarTokenDescuento($pdo, $codigo, $precioBase);
        if ($res['valido']) {
            sendJsonResponse([
                'success'   => true,
                'descuento' => $res
            ], 200);
        } else {
            sendJsonResponse([
                'success' => false,
                'message' => $res['mensaje']
            ], 400);
        }
    }

    // Listar pagos relacionados con una inscripción concreta
    if ($accion === 'por_inscripcion' || $accion === 'listar_por_inscripcion') {
        $inscripcionId = isset($_GET['inscripcion_id']) ? (int)$_GET['inscripcion_id'] : 0;
        if ($inscripcionId <= 0) {
            sendJsonResponse(['success' => false, 'message' => 'Identificador de inscripción inválido.'], 400);
        }

        try {
            requireApiEnrollmentAccess($pdo, $inscripcionId);

            $stmt = $pdo->prepare("
                SELECT 
                    id, 
                    inscripcion_id, 
                    referencia, 
                    concepto, 
                    cantidad_pagada, 
                    modalidad_pago, 
                    estado, 
                    fecha_compra, 
                    notas, 
                    datos_transaccion, 
                    fecha_creacion, 
                    fecha_actualizacion 
                FROM `enmi_pagos` 
                WHERE inscripcion_id = :inscripcion_id 
                ORDER BY id DESC
            ");
            $stmt->execute([':inscripcion_id' => $inscripcionId]);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $pagos = array_map(function ($p) {
                $datosTrx = null;
                if (!empty($p['datos_transaccion'])) {
                    if (is_array($p['datos_transaccion'])) {
                        $datosTrx = $p['datos_transaccion'];
                    } else {
                        $decoded = json_decode((string)$p['datos_transaccion'], true);
                        $datosTrx = (json_last_error() === JSON_ERROR_NONE) ? $decoded : $p['datos_transaccion'];
                    }
                }

                return array_merge([
                    'id'                  => (int)$p['id'],
                    'inscripcion_id'      => (int)$p['inscripcion_id'],
                    'referencia'          => $p['referencia'] ?? '',
                    'concepto'            => $p['concepto'] ?? '',
                    'cantidad_pagada'     => (float)$p['cantidad_pagada'],
                    'modalidad_pago'      => $p['modalidad_pago'] ?? '',
                    'estado'              => $p['estado'] ?? '',
                    'fecha_compra'        => $p['fecha_compra'] ?? null,
                    'notas'               => $p['notas'] ?? null,
                    'datos_transaccion'   => $datosTrx,
                    'fecha_creacion'      => $p['fecha_creacion'],
                    'fecha_actualizacion' => $p['fecha_actualizacion'] ?? null
                ], clasificarRegistroPago($p));
            }, $rows);

            sendJsonResponse([
                'success'        => true,
                'inscripcion_id' => $inscripcionId,
                'total'          => count($pagos),
                'pagos'          => $pagos
            ], 200);

        } catch (Throwable $e) {
            logError('pagos', 'error_listar_pagos_inscripcion', $e->getMessage());
            sendJsonResponse(['success' => false, 'message' => 'Error al consultar pagos: ' . $e->getMessage()], 500);
        }
    }
}

// =====================================================================
// 2. POST: Acciones de pago
// =====================================================================
if ($method === 'POST') {
    $inputRaw = file_get_contents('php://input');
    $data = json_decode($inputRaw, true);

    // Puede ser JSON o POST tradicional (retorno Redsys)
    if (!is_array($data)) {
        $data = $_POST;
    }

    $accion = isset($data['accion']) ? trim((string)$data['accion']) : '';

    // Validar código de descuento (POST)
    if ($accion === 'validar_descuento') {
        $codigo = isset($data['codigo']) ? trim((string)$data['codigo']) : '';
        $precioBase = getPagoImporteConfig($pdo);
        $res = validarTokenDescuento($pdo, $codigo, $precioBase);
        if ($res['valido']) {
            sendJsonResponse([
                'success'   => true,
                'descuento' => $res
            ], 200);
        } else {
            sendJsonResponse([
                'success' => false,
                'message' => $res['mensaje']
            ], 400);
        }
    }

    // A) INICIAR REDSYS (Generar firma y formulario)
    if ($accion === 'iniciar_redsys') {
        $inscripcionId = isset($data['inscripcion_id']) ? (int)$data['inscripcion_id'] : 0;
        if ($inscripcionId <= 0) {
            sendJsonResponse(['success' => false, 'message' => 'Identificador de inscripción inválido.'], 400);
        }
        requireApiCsrfToken();
        requireApiEnrollmentAccess($pdo, $inscripcionId);

        try {
            $stmt = $pdo->prepare("SELECT * FROM `enmi_inscripciones` WHERE id = :id LIMIT 1");
            $stmt->execute([':id' => $inscripcionId]);
            $inscripcion = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$inscripcion) {
                sendJsonResponse(['success' => false, 'message' => 'No se encontró la inscripción solicitada.'], 404);
            }

            $importeNum = getPagoImporteConfig($pdo);
            $codigoDescuento = isset($data['codigo_descuento']) ? trim((string)$data['codigo_descuento']) : '';
            $descuentoInfo = null;

            if (!empty($codigoDescuento)) {
                $descuentoInfo = consumirTokenDescuento($pdo, $codigoDescuento, $importeNum, $inscripcionId);
                if (!$descuentoInfo['exito']) {
                    sendJsonResponse(['success' => false, 'message' => $descuentoInfo['mensaje']], 400);
                }
                $importeNum = $descuentoInfo['nuevo_total'];
            }

            $amountInCents = (int)round($importeNum * 100);

            $fuc             = (string)getConfigValue('pago_redsys_fuc', '999008881', $pdo);
            $terminal        = (string)getConfigValue('pago_redsys_terminal', '1', $pdo);
            $secretKeyB64    = (string)getConfigValue('pago_redsys_clave_secreta', 'sq7HjrUOBfKmC576ILgskD5srU870gJ7', $pdo);
            $moneda          = (string)getConfigValue('pago_redsys_moneda', '978', $pdo);
            $entorno         = (string)getConfigValue('pago_redsys_entorno', 'sandbox', $pdo);
            $urlSandbox      = (string)getConfigValue('pago_redsys_url_sandbox', 'https://sis-t.redsys.es:25443/sis/realizarPago', $pdo);
            $urlProd         = (string)getConfigValue('pago_redsys_url_produccion', 'https://sis.redsys.es/sis/realizarPago', $pdo);
            $tpvUrl          = ($entorno === 'produccion') ? $urlProd : $urlSandbox;

            // Formato de orden Redsys: 12 caracteres (primeros 4 numéricos, ej. fecha + ID)
            $order = date('ymd') . sprintf('%06d', random_int(0, 999999));

            // URLs de retorno: Redirigen de vuelta al frontend Angular
            $appUrl = rtrim(getAppUrl(), '/');
            $urlOk = $appUrl . '/pago?pago=ok&id=' . $inscripcionId;
            $urlKo = $appUrl . '/pago?pago=ko&id=' . $inscripcionId;

            // Notificación servidor a servidor (debe ser accesible desde internet si es público)
            $urlNotify = (strpos($appUrl, 'localhost') === false)
                ? $appUrl . '/api/pago.php?accion=redsys_retorno'
                : 'https://enmi.eutikea.com/api/pago.php?accion=redsys_retorno';

            $merchantParamsArray = [
                'DS_MERCHANT_AMOUNT'             => (string)$amountInCents,
                'DS_MERCHANT_ORDER'              => $order,
                'DS_MERCHANT_MERCHANTCODE'       => $fuc,
                'DS_MERCHANT_CURRENCY'           => $moneda,
                'DS_MERCHANT_TRANSACTIONTYPE'    => '0',
                'DS_MERCHANT_TERMINAL'           => str_pad($terminal, 3, '0', STR_PAD_LEFT),
                'DS_MERCHANT_MERCHANTURL'        => $urlNotify,
                'DS_MERCHANT_URLOK'              => $urlOk,
                'DS_MERCHANT_URLKO'              => $urlKo,
                'DS_MERCHANT_PRODUCTDESCRIPTION' => 'Inscripcion ENMI 2027 #' . $inscripcionId
            ];

            $merchantParameters = base64_encode(json_encode($merchantParamsArray));
            $signature = redsysComputeSignature($merchantParameters, $order, $secretKeyB64);

            logInfo('pagos', 'redsys_iniciado', "Sesión de pago Redsys iniciada para inscripción #{$inscripcionId}", [
                'order'   => $order,
                'importe' => $importeNum,
                'entorno' => $entorno,
                'descuento' => $descuentoInfo ? $descuentoInfo['token'] : null
            ]);

            // Registrar orden previa en la tabla enmi_pagos (marcado como no-pagado)
            $nombreParticipante = trim($inscripcion['nombre'] . ' ' . $inscripcion['apellidos']);
            $conceptoCompra = 'Inscripción ENMI 2027 #' . $inscripcionId . ' - ' . $nombreParticipante;
            $notasInicio = "Sesión de pago Redsys ({$entorno}) iniciada para pedido #{$order}";
            if ($descuentoInfo) {
                $notasInicio .= " | Descuento aplicado: {$descuentoInfo['token']} (-{$descuentoInfo['descuento_str']} €)";
            }

            $pagoId = registrarPago(
                $pdo,
                $inscripcionId,
                'redsys',
                'no-pagado',
                $importeNum,
                $order,
                $conceptoCompra,
                $notasInicio,
                [
                    'order'             => $order,
                    'fuc'               => $fuc,
                    'terminal'          => $terminal,
                    'entorno'           => $entorno,
                    'ip'                => $_SERVER['REMOTE_ADDR'] ?? null,
                    'user_agent'        => $_SERVER['HTTP_USER_AGENT'] ?? null,
                    'codigo_descuento'  => $descuentoInfo ? $descuentoInfo['token'] : null,
                    'descuento_importe' => $descuentoInfo ? $descuentoInfo['descuento'] : null,
                    'importe_original'  => $descuentoInfo ? $descuentoInfo['precio_original'] : null
                ]
            );

            sendJsonResponse([
                'success'                => true,
                'inscripcion_id'         => $inscripcionId,
                'pago_id'                => $pagoId,
                'compra_id'              => $pagoId,
                'tpv_url'                => $tpvUrl,
                'Ds_SignatureVersion'    => 'HMAC_SHA256_V1',
                'Ds_MerchantParameters'  => $merchantParameters,
                'Ds_Signature'           => $signature,
                'order'                  => $order,
                'importe'                => number_format($importeNum, 2, '.', ''),
                'sandbox'                => ($entorno !== 'produccion'),
                'descuento_aplicado'     => $descuentoInfo
            ], 200);

        } catch (Throwable $e) {
            logError('pagos', 'error_iniciar_redsys', $e->getMessage());
            sendJsonResponse(['success' => false, 'message' => 'Error al preparar la pasarela de pago: ' . $e->getMessage()], 500);
        }
    }

    // B) CONFIRMAR MODALIDAD (Bizum, Transferencia, Otras)
    if ($accion === 'confirmar_modalidad') {
        $inscripcionId = isset($data['inscripcion_id']) ? (int)$data['inscripcion_id'] : 0;
        $modalidad     = isset($data['modalidad']) ? trim((string)$data['modalidad']) : '';

        if ($inscripcionId <= 0 || !in_array($modalidad, ['bizum', 'transferencia', 'otras'], true)) {
            sendJsonResponse(['success' => false, 'message' => 'Datos de modalidad o inscripción inválidos.'], 400);
        }
        requireApiCsrfToken();
        requireApiEnrollmentAccess($pdo, $inscripcionId);

        try {
            $stmt = $pdo->prepare("SELECT * FROM `enmi_inscripciones` WHERE id = :id LIMIT 1");
            $stmt->execute([':id' => $inscripcionId]);
            $inscripcion = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$inscripcion) {
                sendJsonResponse(['success' => false, 'message' => 'Inscripción no encontrada.'], 404);
            }

            // Para Bizum, Transferencia u Otras, el estado de la inscripción pasa a 'pendiente'
            $nuevoEstado = 'pendiente';
            $stmtUp = $pdo->prepare("UPDATE `enmi_inscripciones` SET `estado` = :estado WHERE id = :id");
            $stmtUp->execute([':estado' => $nuevoEstado, ':id' => $inscripcionId]);

            // Registrar en la tabla enmi_pagos como 'no-pagado'
            $importeNum = getPagoImporteConfig($pdo);
            $codigoDescuento = isset($data['codigo_descuento']) ? trim((string)$data['codigo_descuento']) : '';
            $descuentoInfo = null;

            if (!empty($codigoDescuento)) {
                $descuentoInfo = consumirTokenDescuento($pdo, $codigoDescuento, $importeNum, $inscripcionId);
                if (!$descuentoInfo['exito']) {
                    sendJsonResponse(['success' => false, 'message' => $descuentoInfo['mensaje']], 400);
                }
                $importeNum = $descuentoInfo['nuevo_total'];
            }

            $nombreParticipante = trim($inscripcion['nombre'] . ' ' . $inscripcion['apellidos']);
            $conceptoCompra = 'Inscripción ENMI 2027 #' . $inscripcionId . ' - ' . $nombreParticipante;
            $notasModalidad = "Intención de pago del participante: " . strtoupper($modalidad) . ". No acredita un cobro.";
            if ($descuentoInfo) {
                $notasModalidad .= " | Descuento aplicado: {$descuentoInfo['token']} (-{$descuentoInfo['descuento_str']} €)";
            }
            if ($modalidad === 'bizum') {
                $telBizum = (string)getConfigValue('pago_bizum_telefono', '+34 600 000 000', $pdo);
                $notasModalidad .= " Destino Bizum: {$telBizum}.";
            } elseif ($modalidad === 'transferencia') {
                $iban = (string)getConfigValue('pago_transferencia_iban', '', $pdo);
                $notasModalidad .= " Cuenta IBAN: {$iban}.";
            }

            $pagoId = registrarPago(
                $pdo,
                $inscripcionId,
                $modalidad,
                'no-pagado',
                $importeNum,
                null,
                $conceptoCompra,
                $notasModalidad,
                [
                    'modalidad'         => $modalidad,
                    'inscripcion_id'    => $inscripcionId,
                    'ip'                => $_SERVER['REMOTE_ADDR'] ?? null,
                    'user_agent'        => $_SERVER['HTTP_USER_AGENT'] ?? null,
                    'origen'            => 'confirmar_modalidad',
                    'tipo_registro'     => 'promesa',
                    'codigo_descuento'  => $descuentoInfo ? $descuentoInfo['token'] : null,
                    'descuento_importe' => $descuentoInfo ? $descuentoInfo['descuento'] : null,
                    'importe_original'  => $descuentoInfo ? $descuentoInfo['precio_original'] : null
                ]
            );

            // Registrar log de auditoría
            logInfo('pagos', 'modalidad_seleccionada', "Modalidad '{$modalidad}' seleccionada para inscripción #{$inscripcionId}. Estado inscripción: {$nuevoEstado}. Registro pago #{$pagoId} (no-pagado)", [
                'inscripcion_id' => $inscripcionId,
                'modalidad'      => $modalidad,
                'nuevo_estado'   => $nuevoEstado,
                'pago_id'        => $pagoId,
                'descuento'      => $descuentoInfo ? $descuentoInfo['token'] : null
            ]);

            // Enviar correo de confirmación de inscripción al participante indicando modalidad
            $emailPayload = [
                'id'                    => $inscripcionId,
                'nombre'                => $inscripcion['nombre'],
                'apellidos'             => $inscripcion['apellidos'],
                'nombre_artistico'      => $inscripcion['nombre_artistico'] ?? null,
                'nif_pasaporte'         => $inscripcion['nif_pasaporte'],
                'email'                 => $inscripcion['email'],
                'telefono'              => $inscripcion['telefono'],
                'origen'                => $inscripcion['origen'],
                'asociacion'            => $inscripcion['asociacion'] ?? null,
                'quiero_participar'     => (bool)$inscripcion['quiero_participar'],
                'consentimiento_imagen' => (bool)$inscripcion['consentimiento_imagen'],
                'comentarios'           => $inscripcion['comentarios'] ?? null,
                'estado'                => $nuevoEstado,
                'modalidad_pago'        => $modalidad,
                'ip_registro'           => $inscripcion['ip_registro'] ?? null,
                'fecha'                 => date('d/m/Y H:i:s')
            ];

            $participantEmailResult = sendParticipantRegistrationEmail($emailPayload);
            logNotification(
                'confirmacion_inscripcion_participante',
                $participantEmailResult['message'] ?? 'Envío de correo al participante con modalidad de pago',
                ['inscripcion_id' => $inscripcionId, 'modalidad' => $modalidad, 'resultado' => $participantEmailResult],
                $participantEmailResult['success'] ?? false
            );

            sendJsonResponse([
                'success'            => true,
                'inscripcion_id'     => $inscripcionId,
                'estado'             => $nuevoEstado,
                'modalidad'          => $modalidad,
                'estado_pago'        => 'no-pagado',
                'estado_compra'      => 'no-pagado',
                'tipo_registro'      => 'promesa',
                'pago_confirmado'    => false,
                'importe'            => number_format($importeNum, 2, '.', ''),
                'pago_id'            => $pagoId,
                'compra_id'          => $pagoId,
                'descuento_aplicado' => $descuentoInfo,
                'message'            => 'Intención de pago registrada. El pago queda pendiente de recepción y validación.'
            ], 200);

        } catch (Throwable $e) {
            logError('pagos', 'error_confirmar_modalidad', $e->getMessage());
            sendJsonResponse(['success' => false, 'message' => 'Error al guardar la modalidad: ' . $e->getMessage()], 500);
        }
    }

    // C) SIMULADOR DE REDSYS (Pruebas sandbox / locales)
    if ($accion === 'simular_redsys') {
        if (!isLocalApiEnvironment() || !isPagoDemoMode($pdo)) {
            sendJsonResponse([
                'success' => false,
                'message' => 'El simulador de pagos solo está disponible en desarrollo local.'
            ], 403);
        }

        $inscripcionId = isset($data['inscripcion_id']) ? (int)$data['inscripcion_id'] : 0;
        $resultado     = isset($data['resultado']) ? strtolower(trim((string)$data['resultado'])) : 'ok';

        if ($inscripcionId <= 0) {
            sendJsonResponse(['success' => false, 'message' => 'Identificador de inscripción inválido.'], 400);
        }
        requireApiCsrfToken();
        requireApiEnrollmentAccess($pdo, $inscripcionId);

        try {
            $stmt = $pdo->prepare("SELECT * FROM `enmi_inscripciones` WHERE id = :id LIMIT 1");
            $stmt->execute([':id' => $inscripcionId]);
            $inscripcion = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$inscripcion) {
                sendJsonResponse(['success' => false, 'message' => 'Inscripción no encontrada.'], 404);
            }

            // Si es OK -> 'pagada'; si no -> 'pendiente'
            $nuevoEstado = ($resultado === 'ok') ? 'pagada' : 'pendiente';
            $estadoCompra = ($resultado === 'ok') ? 'pagado' : 'no-pagado';
            $importeNum = getPagoImporteConfig($pdo);
            $codigoDescuento = isset($data['codigo_descuento']) ? trim((string)$data['codigo_descuento']) : '';
            $descuentoInfo = null;

            if (!empty($codigoDescuento) && $resultado === 'ok') {
                $descuentoInfo = consumirTokenDescuento($pdo, $codigoDescuento, $importeNum, $inscripcionId);
                if (!$descuentoInfo['exito']) {
                    sendJsonResponse(['success' => false, 'message' => $descuentoInfo['mensaje']], 400);
                }
                $importeNum = $descuentoInfo['nuevo_total'];
            }

            $nombreParticipante = trim($inscripcion['nombre'] . ' ' . $inscripcion['apellidos']);
            $conceptoCompra = 'Inscripción ENMI 2027 #' . $inscripcionId . ' - ' . $nombreParticipante;
            $orderSim = 'SIM-' . date('ymd') . sprintf('%06d', $inscripcionId % 1000000) . '-' . strtoupper(substr(uniqid(), -4));

            $notasSim = ($resultado === 'ok')
                ? 'Simulador Redsys (Demo/Sandbox): Pago autorizado y verificado con éxito.'
                : 'Simulador Redsys (Demo/Sandbox): Transacción denegada o cancelada por el usuario.';
            if ($descuentoInfo) {
                $notasSim .= " | Descuento aplicado: {$descuentoInfo['token']} (-{$descuentoInfo['descuento_str']} €)";
            }

            $pagoId = registrarPago(
                $pdo,
                $inscripcionId,
                'redsys',
                $estadoCompra,
                $importeNum,
                $orderSim,
                $conceptoCompra,
                $notasSim,
                [
                    'modalidad'         => 'redsys',
                    'resultado'         => $resultado,
                    'inscripcion_id'    => $inscripcionId,
                    'simulador'         => true,
                    'ip'                => $_SERVER['REMOTE_ADDR'] ?? null,
                    'user_agent'        => $_SERVER['HTTP_USER_AGENT'] ?? null,
                    'codigo_descuento'  => $descuentoInfo ? $descuentoInfo['token'] : null,
                    'descuento_importe' => $descuentoInfo ? $descuentoInfo['descuento'] : null,
                    'importe_original'  => $descuentoInfo ? $descuentoInfo['precio_original'] : null
                ]
            );

            $stmtUp = $pdo->prepare("UPDATE `enmi_inscripciones` SET `estado` = :estado WHERE id = :id");
            $stmtUp->execute([':estado' => $nuevoEstado, ':id' => $inscripcionId]);

            $logAction = ($resultado === 'ok') ? 'pago_redsys_exito_simulado' : 'pago_redsys_fallido_simulado';
            logInfo('pagos', $logAction, "Simulación Redsys ({$resultado}): inscripción #{$inscripcionId} -> {$nuevoEstado}. Registro pago #{$pagoId} ({$estadoCompra})", [
                'inscripcion_id' => $inscripcionId,
                'resultado'      => $resultado,
                'estado'         => $nuevoEstado,
                'pago_id'        => $pagoId,
                'compra_id'      => $pagoId,
                'estado_pago'    => $estadoCompra,
                'estado_compra'  => $estadoCompra,
                'descuento'      => $descuentoInfo ? $descuentoInfo['token'] : null
            ]);

            // Si ha sido pagada, enviamos correo con estado 'pagada'
            $emailPayload = [
                'id'                    => $inscripcionId,
                'nombre'                => $inscripcion['nombre'],
                'apellidos'             => $inscripcion['apellidos'],
                'nombre_artistico'      => $inscripcion['nombre_artistico'] ?? null,
                'nif_pasaporte'         => $inscripcion['nif_pasaporte'],
                'email'                 => $inscripcion['email'],
                'telefono'              => $inscripcion['telefono'],
                'origen'                => $inscripcion['origen'],
                'asociacion'            => $inscripcion['asociacion'] ?? null,
                'quiero_participar'     => (bool)$inscripcion['quiero_participar'],
                'consentimiento_imagen' => (bool)$inscripcion['consentimiento_imagen'],
                'comentarios'           => $inscripcion['comentarios'] ?? null,
                'estado'                => $nuevoEstado,
                'modalidad_pago'        => 'redsys',
                'pago_confirmado'       => ($nuevoEstado === 'pagada'),
                'ip_registro'           => $inscripcion['ip_registro'] ?? null,
                'fecha'                 => date('d/m/Y H:i:s')
            ];

            $emailRes = sendParticipantRegistrationEmail($emailPayload);
            logNotification(
                'confirmacion_inscripcion_participante',
                "Envío de confirmación tras pago Redsys simulado ({$nuevoEstado})",
                ['inscripcion_id' => $inscripcionId, 'estado' => $nuevoEstado, 'detalle' => $emailRes],
                $emailRes['success'] ?? false
            );

            sendJsonResponse([
                'success'            => true,
                'inscripcion_id'     => $inscripcionId,
                'estado'             => $nuevoEstado,
                'estado_pago'        => $estadoCompra,
                'estado_compra'      => $estadoCompra,
                'pago_id'            => $pagoId,
                'compra_id'          => $pagoId,
                'resultado'          => $resultado,
                'importe'            => number_format($importeNum, 2, '.', ''),
                'descuento_aplicado' => $descuentoInfo,
                'message'            => ($resultado === 'ok')
                    ? '¡Pago completado con éxito! Tu inscripción ha sido pagada y confirmada.'
                    : 'El pago ha sido denegado o cancelado. Tu inscripción queda en estado pendiente.'
            ], 200);

        } catch (Throwable $e) {
            logError('pagos', 'error_simular_redsys', $e->getMessage());
            sendJsonResponse(['success' => false, 'message' => 'Error en simulador de Redsys: ' . $e->getMessage()], 500);
        }
    }

    // D) RETORNO DE REDSYS OFICIAL (Callback webhook o browser post)
    if ($accion === 'redsys_retorno' || isset($data['Ds_MerchantParameters'])) {
        $merchantParamsB64 = $data['Ds_MerchantParameters'] ?? '';
        $signatureRecibida = $data['Ds_Signature'] ?? '';

        if (empty($merchantParamsB64) || empty($signatureRecibida)) {
            sendJsonResponse(['success' => false, 'message' => 'Parámetros Redsys ausentes.'], 400);
        }

        try {
            $paramsJson = base64_decode(strtr($merchantParamsB64, '-_', '+/'), true);
            $params = json_decode($paramsJson, true);
            if (!is_array($params)) {
                sendJsonResponse(['success' => false, 'message' => 'Respuesta Redsys inválida.'], 400);
            }

            $order = (string)($params['Ds_Order'] ?? ($params['DS_ORDER'] ?? ''));
            $responseCode = (int)($params['Ds_Response'] ?? ($params['DS_RESPONSE'] ?? 9999));
            $amountCents = (int)($params['Ds_Amount'] ?? ($params['DS_AMOUNT'] ?? 0));
            $merchantCode = (string)($params['Ds_MerchantCode'] ?? ($params['DS_MERCHANTCODE'] ?? ''));
            $currency = (string)($params['Ds_Currency'] ?? ($params['DS_CURRENCY'] ?? ''));
            $secretKeyB64 = (string)getConfigValue('pago_redsys_clave_secreta', 'sq7HjrUOBfKmC576ILgskD5srU870gJ7', $pdo);

            if ($order === '') {
                sendJsonResponse(['success' => false, 'message' => 'Pedido Redsys ausente.'], 400);
            }
            $expectedSignature = redsysComputeSignature($merchantParamsB64, $order, $secretKeyB64);
            $signaturesMatch = hash_equals(
                strtr($expectedSignature, '+/', '-_'),
                strtr($signatureRecibida, '+/', '-_')
            );
            if (!$signaturesMatch) {
                sendJsonResponse(['success' => false, 'message' => 'Firma Redsys inválida.'], 403);
            }

            $stmtPago = $pdo->prepare(
                "SELECT id, inscripcion_id, cantidad_pagada, estado, datos_transaccion FROM `enmi_pagos` WHERE referencia = :order AND modalidad_pago = 'redsys' LIMIT 1"
            );
            $stmtPago->execute([':order' => $order]);
            $pago = $stmtPago->fetch(PDO::FETCH_ASSOC);
            if (!$pago || (int)$pago['inscripcion_id'] <= 0) {
                sendJsonResponse(['success' => false, 'message' => 'Pedido de pago no reconocido.'], 404);
            }

            $expectedMerchant = (string)getConfigValue('pago_redsys_fuc', '999008881', $pdo);
            $expectedCurrency = (string)getConfigValue('pago_redsys_moneda', '978', $pdo);
            $expectedAmount = (int)round((float)$pago['cantidad_pagada'] * 100);
            if ($amountCents !== $expectedAmount || $merchantCode !== $expectedMerchant || $currency !== $expectedCurrency) {
                sendJsonResponse(['success' => false, 'message' => 'Los datos del pago no coinciden con el pedido.'], 403);
            }

            $inscripcionId = (int)$pago['inscripcion_id'];
            $isPagoOk = $responseCode >= 0 && $responseCode <= 99;
            $nuevoEstado = $isPagoOk ? 'pagada' : 'pendiente';
            $estadoCompra = $isPagoOk ? 'pagado' : 'no-pagado';
            $notasRetorno = $isPagoOk
                ? "Retorno Redsys: Pago aprobado exitosamente (código {$responseCode})."
                : "Retorno Redsys: Pago denegado o no autorizado (código {$responseCode}).";

            if ((string)$pago['estado'] === 'pagado') {
                sendJsonResponse([
                    'success' => true,
                    'inscripcion_id' => $inscripcionId,
                    'estado' => 'pagada',
                    'estado_pago' => 'pagado',
                    'pago_id' => (int)$pago['id'],
                    'pago_ok' => true
                ], 200);
            }

            // Conservar el descuento consumido al iniciar el pedido para futuros reintentos.
            $datosInicio = empty($pago['datos_transaccion'])
                ? []
                : json_decode($pago['datos_transaccion'], true, 512, JSON_THROW_ON_ERROR);
            $datosRetorno = array_merge($datosInicio, $params);

            $pdo->beginTransaction();
            $stmtPagoUp = $pdo->prepare(
                "UPDATE `enmi_pagos` SET `estado` = :estado, `fecha_compra` = :fecha_compra, `notas` = :notas, `datos_transaccion` = :datos, `fecha_actualizacion` = NOW() WHERE `id` = :id AND `estado` <> 'pagado'"
            );
            $stmtPagoUp->execute([
                ':estado' => $estadoCompra,
                ':fecha_compra' => $isPagoOk ? date('Y-m-d H:i:s') : null,
                ':notas' => $notasRetorno,
                ':datos' => json_encode($datosRetorno, JSON_UNESCAPED_UNICODE),
                ':id' => (int)$pago['id']
            ]);
            if ($isPagoOk) {
                $stmtUp = $pdo->prepare("UPDATE `enmi_inscripciones` SET `estado` = 'pagada', `fecha_actualizacion` = NOW() WHERE id = :id");
                $stmtUp->execute([':id' => $inscripcionId]);
            } else {
                $stmtUp = $pdo->prepare("UPDATE `enmi_inscripciones` SET `estado` = 'pendiente', `fecha_actualizacion` = NOW() WHERE id = :id AND `estado` <> 'pagada'");
                $stmtUp->execute([':id' => $inscripcionId]);
            }
            $pdo->commit();

            $pagoId = (int)$pago['id'];
            logInfo('pagos', 'redsys_callback', "Retorno Redsys recibido para inscripción #{$inscripcionId}. Código: {$responseCode}. Estado inscripción: {$nuevoEstado}. Estado pago: {$estadoCompra}", [
                'order' => $order,
                'responseCode' => $responseCode,
                'nuevo_estado' => $nuevoEstado,
                'estado_pago' => $estadoCompra,
                'pago_id' => $pagoId
            ]);

            sendJsonResponse([
                'success'        => true,
                'inscripcion_id' => $inscripcionId,
                'estado'         => $nuevoEstado,
                'estado_pago'    => $estadoCompra,
                'estado_compra'  => $estadoCompra,
                'pago_id'        => $pagoId,
                'compra_id'      => $pagoId,
                'pago_ok'        => $isPagoOk
            ], 200);

        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            logError('pagos', 'error_redsys_retorno', $e->getMessage());
            sendJsonResponse(['success' => false, 'message' => 'Error al procesar retorno Redsys.'], 500);
        }
    }

    // E) SINCRONIZAR RETORNO REDSYS (Llamado cuando el frontend detecta retorno con queryParam pago=ok o ko)
    if ($accion === 'sincronizar_retorno_redsys') {
        sendJsonResponse([
            'success' => false,
            'message' => 'El resultado del pago solo se confirma mediante la notificación firmada de Redsys.'
        ], 410);
    }

    // F) REGISTRAR PAGO MANUAL (Solo Supervisor y Superadministrador)
    if ($accion === 'registrar_pago_manual') {
        $authUser = requireApiUser($pdo, ['superadministrador', 'supervisor']);

        $inscripcionId = isset($data['inscripcion_id']) ? (int)$data['inscripcion_id'] : 0;
        $modalidadRaw = isset($data['modalidad']) ? strtolower(trim((string)$data['modalidad'])) : 'transferencia';
        $cantidad = isset($data['cantidad']) ? (float)$data['cantidad'] : 0.0;
        $notasSupervisor = isset($data['notas']) ? trim((string)$data['notas']) : '';
        $enviarEmail = !empty($data['enviar_email']);
        $marcarComoPagado = !empty($data['marcar_como_pagado']);

        if ($inscripcionId <= 0) {
            sendJsonResponse(['success' => false, 'message' => 'Identificador de inscripción inválido.'], 400);
        }

        // Mapear y normalizar modalidad
        $modalidadesPermitidas = ['bizum', 'transferencia', 'efectivo', 'otras', 'redsys'];
        $modalidad = in_array($modalidadRaw, $modalidadesPermitidas, true) ? $modalidadRaw : 'otras';

        if ($notasSupervisor === '') {
            sendJsonResponse([
                'success' => false,
                'message' => 'El campo "Notas y Justificante de Cobro" es obligatorio.'
            ], 400);
        }

        if ($cantidad <= 0) {
            $cantidad = getPagoImporteConfig($pdo);
        }

        try {
            // Verificar existencia de la inscripción
            $stmt = $pdo->prepare("SELECT * FROM `enmi_inscripciones` WHERE id = :id LIMIT 1");
            $stmt->execute([':id' => $inscripcionId]);
            $inscripcion = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$inscripcion) {
                sendJsonResponse(['success' => false, 'message' => 'Inscripción no encontrada.'], 404);
            }

            $nombreParticipante = trim($inscripcion['nombre'] . ' ' . $inscripcion['apellidos']);
            $conceptoPago = 'Inscripción ENMI 2027 #' . $inscripcionId . ' - ' . $nombreParticipante;

            // Generar referencia única de cobro manual
            $prefijo = strtoupper(substr($modalidad, 0, 3));
            $referencia = sprintf('ENMI-MAN-%s-%d-%s', $prefijo, $inscripcionId, strtoupper(substr(uniqid(), -6)));

            // Formatear nota de auditoría
            $adminInfo = ($authUser['login'] ?? 'admin') . ' (' . ($authUser['rol'] ?? 'supervisor') . ')';
            $notaFinal = "Validado y registrado manualmente por: {$adminInfo}";
            if (!empty($notasSupervisor)) {
                $notaFinal .= " | Observaciones: {$notasSupervisor}";
            }

            $datosAuditoria = [
                'tipo_registro'   => 'manual_administracion',
                'admin_id'        => (int)($authUser['id'] ?? 0),
                'admin_login'     => $authUser['login'] ?? '',
                'admin_rol'       => $authUser['rol'] ?? '',
                'fecha_registro'  => date('c'),
                'ip_admin'        => $_SERVER['REMOTE_ADDR'] ?? null,
                'notas_admin'     => $notasSupervisor
            ];

            $nuevoEstado = $inscripcion['estado'];
            if ($marcarComoPagado) {
                $nuevoEstado = 'pagada';
                $stmtUpIns = $pdo->prepare("UPDATE `enmi_inscripciones` SET `estado` = 'pagada', `fecha_actualizacion` = NOW() WHERE id = :id");
                $stmtUpIns->execute([':id' => $inscripcionId]);
            }

            // 1. Registrar el nuevo pago en 'enmi_pagos' con estado 'pagado'
            $pagoId = registrarPago(
                $pdo,
                $inscripcionId,
                $modalidad,
                'pagado',
                $cantidad,
                $referencia,
                $conceptoPago,
                $notaFinal,
                $datosAuditoria
            );

            logInfo('pagos', 'registro_pago_manual', "Pago manual registrado por {$adminInfo} para inscripción #{$inscripcionId}. Importe: {$cantidad}€. Modalidad: {$modalidad}.", [
                'inscripcion_id' => $inscripcionId,
                'pago_id'        => $pagoId,
                'referencia'     => $referencia,
                'cantidad'       => $cantidad,
                'modalidad'      => $modalidad,
                'admin'          => $adminInfo,
                'marcar_pagado'  => $marcarComoPagado
            ]);

            // 3. Envío opcional de email de confirmación de pago al participante
            $emailEnviado = false;
            $emailMensaje = null;
            if ($enviarEmail && !empty($inscripcion['email'])) {
                $emailPayload = [
                    'id'                    => $inscripcion['id'],
                    'nombre'                => $inscripcion['nombre'],
                    'apellidos'             => $inscripcion['apellidos'],
                    'nombre_artistico'      => $inscripcion['nombre_artistico'] ?? null,
                    'nif_pasaporte'         => $inscripcion['nif_pasaporte'] ?? null,
                    'email'                 => $inscripcion['email'],
                    'telefono'              => $inscripcion['telefono'] ?? null,
                    'origen'                => $inscripcion['origen'],
                    'asociacion'            => $inscripcion['asociacion'] ?? null,
                    'quiero_participar'     => (bool)$inscripcion['quiero_participar'],
                    'consentimiento_imagen' => (bool)$inscripcion['consentimiento_imagen'],
                    'comentarios'           => $inscripcion['comentarios'] ?? null,
                    'estado'                => $nuevoEstado,
                    'modalidad_pago'        => $modalidad,
                    'pago_confirmado'       => true,
                    'ip_registro'           => $inscripcion['ip_registro'] ?? null,
                    'fecha'                 => date('d/m/Y H:i:s')
                ];

                $emailRes = sendParticipantRegistrationEmail($emailPayload);
                $emailEnviado = $emailRes['success'] ?? false;
                $emailMensaje = $emailRes['message'] ?? '';

                logNotification(
                    'confirmacion_pago_manual_participante',
                    "Envío de confirmación de pago manual para inscripción #{$inscripcionId}",
                    ['inscripcion_id' => $inscripcionId, 'resultado' => $emailRes],
                    $emailEnviado
                );
            }

            // Obtener el registro completo del nuevo pago para el frontend
            $stmtNuevo = $pdo->prepare("SELECT * FROM `enmi_pagos` WHERE id = :id LIMIT 1");
            $stmtNuevo->execute([':id' => $pagoId]);
            $pagoRow = $stmtNuevo->fetch(PDO::FETCH_ASSOC);

            sendJsonResponse([
                'success'        => true,
                'message'        => 'Pago registrado con éxito.',
                'inscripcion_id' => $inscripcionId,
                'nuevo_estado'   => $nuevoEstado,
                'pago_id'        => $pagoId,
                'pago'           => [
                    'id'                  => (int)$pagoId,
                    'inscripcion_id'      => $inscripcionId,
                    'referencia'          => $referencia,
                    'concepto'            => $conceptoPago,
                    'cantidad_pagada'     => $cantidad,
                    'modalidad_pago'      => $modalidad,
                    'estado'              => 'pagado',
                    'tipo_registro'       => 'manual_administracion',
                    'pago_confirmado'     => true,
                    'fecha_compra'        => date('Y-m-d H:i:s'),
                    'notas'               => $notaFinal,
                    'datos_transaccion'   => $datosAuditoria,
                    'fecha_creacion'      => date('Y-m-d H:i:s'),
                    'fecha_actualizacion' => date('Y-m-d H:i:s')
                ],
                'email_enviado'  => $emailEnviado,
                'email_mensaje'  => $emailMensaje
            ], 200);

        } catch (Throwable $e) {
            logError('pagos', 'error_registrar_pago_manual', $e->getMessage());
            sendJsonResponse(['success' => false, 'message' => 'Error al registrar el pago manual: ' . $e->getMessage()], 500);
        }
    }

    // G) CAMBIAR ESTADO DE INSCRIPCIÓN DIRECTAMENTE (Solo Supervisor y Superadministrador)
    if ($accion === 'cambiar_estado' || $accion === 'marcar_pagada') {
        $authUser = requireApiUser($pdo, ['superadministrador', 'supervisor']);

        $inscripcionId = isset($data['inscripcion_id']) ? (int)$data['inscripcion_id'] : (isset($data['id']) ? (int)$data['id'] : 0);
        $nuevoEstado = isset($data['estado']) ? strtolower(trim((string)$data['estado'])) : 'pagada';

        $estadosValidos = ['iniciada', 'pendiente', 'pagada', 'cancelada', 'activo'];
        if ($inscripcionId <= 0 || !in_array($nuevoEstado, $estadosValidos, true)) {
            sendJsonResponse([
                'success' => false,
                'message' => 'Identificador de inscripción o estado inválido.'
            ], 400);
        }

        try {
            $stmt = $pdo->prepare("SELECT * FROM `enmi_inscripciones` WHERE id = :id LIMIT 1");
            $stmt->execute([':id' => $inscripcionId]);
            $inscripcion = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$inscripcion) {
                sendJsonResponse(['success' => false, 'message' => 'Inscripción no encontrada.'], 404);
            }

            $stmtUp = $pdo->prepare("UPDATE `enmi_inscripciones` SET `estado` = :estado, `fecha_actualizacion` = NOW() WHERE id = :id");
            $stmtUp->execute([':estado' => $nuevoEstado, ':id' => $inscripcionId]);

            $adminInfo = ($authUser['login'] ?? 'admin') . ' (' . ($authUser['rol'] ?? 'supervisor') . ')';
            logInfo('pagos', 'cambio_estado_inscripcion', "Estado de inscripción #{$inscripcionId} cambiado a '{$nuevoEstado}' por {$adminInfo}.", [
                'inscripcion_id'  => $inscripcionId,
                'estado_anterior' => $inscripcion['estado'],
                'nuevo_estado'    => $nuevoEstado,
                'admin'           => $adminInfo
            ]);

            sendJsonResponse([
                'success'        => true,
                'message'        => "Estado de la inscripción actualizado a '{$nuevoEstado}' con éxito.",
                'inscripcion_id' => $inscripcionId,
                'nuevo_estado'   => $nuevoEstado,
                'estado'         => $nuevoEstado
            ], 200);

        } catch (Throwable $e) {
            logError('pagos', 'error_cambio_estado', $e->getMessage());
            sendJsonResponse(['success' => false, 'message' => 'Error al actualizar el estado: ' . $e->getMessage()], 500);
        }
    }
}

// Si la petición no coincide con ningún endpoint anterior
sendJsonResponse(['success' => false, 'message' => 'Acción no reconocida.'], 400);
