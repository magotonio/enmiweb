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

$pdo = getDbConnection();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

/**
 * Función auxiliar para calcular la firma HMAC-SHA256 oficial de Redsys
 */
function redsysComputeSignature(string $merchantParameters, string $order, string $secretKeyB64): string {
    $secretKey = base64_decode($secretKeyB64);
    // Diversificación de clave con 3DES (DES-EDE3-CBC) usando vector de inicialización nulo de 8 bytes
    $iv = "\0\0\0\0\0\0\0\0";
    $keyOrder = openssl_encrypt($order, 'des-ede3-cbc', $secretKey, OPENSSL_RAW_DATA, $iv);
    // HMAC-SHA256 de los parámetros con la clave diversificada
    $res = hash_hmac('sha256', $merchantParameters, $keyOrder, true);
    // Codificación Base64 estándar Redsys
    return base64_encode($res);
}

// =====================================================================
// 1. GET: Consulta de información pública de pago o retorno Redsys
// =====================================================================
if ($method === 'GET') {
    $accion = isset($_GET['accion']) ? trim((string)$_GET['accion']) : 'info';

    if ($accion === 'info') {
        try {
            $importe           = (string)getConfigValue('pago_importe', '120.00', $pdo);
            $bizumTelefono     = (string)getConfigValue('pago_bizum_telefono', '+34 600 000 000', $pdo);
            $bizumBeneficiario = (string)getConfigValue('pago_bizum_beneficiario', 'Encuentro Nacional de Magos Infantiles (ENMI)', $pdo);
            $transfIban        = (string)getConfigValue('pago_transferencia_iban', 'ES00 0000 0000 0000 0000 0000', $pdo);
            $transfTitular     = (string)getConfigValue('pago_transferencia_titular', 'Asociación ENMI 2027 / Eutikea', $pdo);
            $transfBanco       = (string)getConfigValue('pago_transferencia_banco', 'Banco Santander', $pdo);
            $transfConcepto    = (string)getConfigValue('pago_transferencia_concepto', 'ENMI-2027-{ID}-{APELLIDOS}', $pdo);
            $otrasTexto        = (string)getConfigValue('pago_otras_modalidades_texto', 'Si necesitas otra forma de pago, nos pondremos en contacto contigo por teléfono o email para coordinarlo.', $pdo);
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
                ]
            ], 200);

        } catch (Throwable $e) {
            logError('pagos', 'error_get_pago_info', $e->getMessage());
            sendJsonResponse([
                'success' => false,
                'message' => 'Error al obtener la configuración de pago: ' . $e->getMessage()
            ], 500);
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

    // A) INICIAR REDSYS (Generar firma y formulario)
    if ($accion === 'iniciar_redsys') {
        $inscripcionId = isset($data['inscripcion_id']) ? (int)$data['inscripcion_id'] : 0;
        if ($inscripcionId <= 0) {
            sendJsonResponse(['success' => false, 'message' => 'Identificador de inscripción inválido.'], 400);
        }

        try {
            $stmt = $pdo->prepare("SELECT * FROM `enmi_inscripciones` WHERE id = :id LIMIT 1");
            $stmt->execute([':id' => $inscripcionId]);
            $inscripcion = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$inscripcion) {
                sendJsonResponse(['success' => false, 'message' => 'No se encontró la inscripción solicitada.'], 404);
            }

            $importeNum = (float)getConfigValue('pago_importe', '120.00', $pdo);
            $amountInCents = (int)round($importeNum * 100);

            $fuc             = (string)getConfigValue('pago_redsys_fuc', '999008881', $pdo);
            $terminal        = (string)getConfigValue('pago_redsys_terminal', '1', $pdo);
            $secretKeyB64    = (string)getConfigValue('pago_redsys_clave_secreta', 'sq7HjrUqKpOuHaSYNdTe73cbVQRwRN92', $pdo);
            $moneda          = (string)getConfigValue('pago_redsys_moneda', '978', $pdo);
            $entorno         = (string)getConfigValue('pago_redsys_entorno', 'sandbox', $pdo);
            $urlSandbox      = (string)getConfigValue('pago_redsys_url_sandbox', 'https://sis-t.redsys.es:25443/sis/realizarPago', $pdo);
            $urlProd         = (string)getConfigValue('pago_redsys_url_produccion', 'https://sis.redsys.es/sis/realizarPago', $pdo);
            $tpvUrl          = ($entorno === 'produccion') ? $urlProd : $urlSandbox;

            // Formato de orden Redsys: 12 caracteres (primeros 4 numéricos, ej. fecha + ID)
            $order = date('ymd') . sprintf('%06d', $inscripcionId % 1000000);

            // URLs de retorno
            $host = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost');
            $urlOk = $host . '/registro?pago=ok&id=' . $inscripcionId;
            $urlKo = $host . '/registro?pago=ko&id=' . $inscripcionId;
            $urlNotify = $host . '/api/pago.php?accion=redsys_retorno';

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
                'entorno' => $entorno
            ]);

            sendJsonResponse([
                'success'                => true,
                'inscripcion_id'         => $inscripcionId,
                'tpv_url'                => $tpvUrl,
                'Ds_SignatureVersion'    => 'HMAC_SHA256_V1',
                'Ds_MerchantParameters'  => $merchantParameters,
                'Ds_Signature'           => $signature,
                'order'                  => $order,
                'importe'                => number_format($importeNum, 2, '.', ''),
                'sandbox'                => ($entorno !== 'produccion')
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

        if ($inscripcionId <= 0 || !in_array($modalidad, ['bizum', 'transferencia', 'otras', 'redsys'], true)) {
            sendJsonResponse(['success' => false, 'message' => 'Datos de modalidad o inscripción inválidos.'], 400);
        }

        try {
            $stmt = $pdo->prepare("SELECT * FROM `enmi_inscripciones` WHERE id = :id LIMIT 1");
            $stmt->execute([':id' => $inscripcionId]);
            $inscripcion = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$inscripcion) {
                sendJsonResponse(['success' => false, 'message' => 'Inscripción no encontrada.'], 404);
            }

            // Para Bizum, Transferencia u Otras, el estado pasa a 'pendiente'
            $nuevoEstado = 'pendiente';
            $stmtUp = $pdo->prepare("UPDATE `enmi_inscripciones` SET `estado` = :estado WHERE id = :id");
            $stmtUp->execute([':estado' => $nuevoEstado, ':id' => $inscripcionId]);

            // Registrar log de auditoría
            logInfo('pagos', 'modalidad_seleccionada', "Modalidad '{$modalidad}' seleccionada para inscripción #{$inscripcionId}. Estado: {$nuevoEstado}", [
                'inscripcion_id' => $inscripcionId,
                'modalidad'      => $modalidad,
                'nuevo_estado'   => $nuevoEstado
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
                'success'        => true,
                'inscripcion_id' => $inscripcionId,
                'estado'         => $nuevoEstado,
                'modalidad'      => $modalidad,
                'message'        => 'Modalidad de pago registrada correctamente.'
            ], 200);

        } catch (Throwable $e) {
            logError('pagos', 'error_confirmar_modalidad', $e->getMessage());
            sendJsonResponse(['success' => false, 'message' => 'Error al guardar la modalidad: ' . $e->getMessage()], 500);
        }
    }

    // C) SIMULADOR DE REDSYS (Pruebas sandbox / locales)
    if ($accion === 'simular_redsys') {
        $inscripcionId = isset($data['inscripcion_id']) ? (int)$data['inscripcion_id'] : 0;
        $resultado     = isset($data['resultado']) ? strtolower(trim((string)$data['resultado'])) : 'ok';

        if ($inscripcionId <= 0) {
            sendJsonResponse(['success' => false, 'message' => 'Identificador de inscripción inválido.'], 400);
        }

        try {
            $stmt = $pdo->prepare("SELECT * FROM `enmi_inscripciones` WHERE id = :id LIMIT 1");
            $stmt->execute([':id' => $inscripcionId]);
            $inscripcion = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$inscripcion) {
                sendJsonResponse(['success' => false, 'message' => 'Inscripción no encontrada.'], 404);
            }

            // Si es OK -> 'pagada'; si no -> 'pendiente'
            $nuevoEstado = ($resultado === 'ok') ? 'pagada' : 'pendiente';

            $stmtUp = $pdo->prepare("UPDATE `enmi_inscripciones` SET `estado` = :estado WHERE id = :id");
            $stmtUp->execute([':estado' => $nuevoEstado, ':id' => $inscripcionId]);

            $logAction = ($resultado === 'ok') ? 'pago_redsys_exito_simulado' : 'pago_redsys_fallido_simulado';
            logInfo('pagos', $logAction, "Simulación Redsys ({$resultado}): inscripción #{$inscripcionId} -> {$nuevoEstado}", [
                'inscripcion_id' => $inscripcionId,
                'resultado'      => $resultado,
                'estado'         => $nuevoEstado
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
                'success'        => true,
                'inscripcion_id' => $inscripcionId,
                'estado'         => $nuevoEstado,
                'resultado'      => $resultado,
                'message'        => ($resultado === 'ok')
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
            $paramsJson = base64_decode(strtr($merchantParamsB64, '-_', '+/'));
            $params = json_decode($paramsJson, true);

            $order        = $params['Ds_Order'] ?? ($params['DS_ORDER'] ?? '');
            $responseCode = (int)($params['Ds_Response'] ?? ($params['DS_RESPONSE'] ?? 9999));
            $secretKeyB64 = (string)getConfigValue('pago_redsys_clave_secreta', 'sq7HjrUqKpOuHaSYNdTe73cbVQRwRN92', $pdo);

            // Validar firma
            $expectedSignature = redsysComputeSignature($merchantParamsB64, $order, $secretKeyB64);
            $signaturesMatch = hash_equals(
                strtr($expectedSignature, '+/', '-_'),
                strtr($signatureRecibida, '+/', '-_')
            );

            // Extraer ID de la orden (los últimos 6 dígitos corresponden al ID)
            $inscripcionId = (int)substr($order, -6);

            $isPagoOk = $signaturesMatch && ($responseCode >= 0 && $responseCode <= 99);
            $nuevoEstado = $isPagoOk ? 'pagada' : 'pendiente';

            if ($inscripcionId > 0) {
                $stmtUp = $pdo->prepare("UPDATE `enmi_inscripciones` SET `estado` = :estado WHERE id = :id");
                $stmtUp->execute([':estado' => $nuevoEstado, ':id' => $inscripcionId]);

                logInfo('pagos', 'redsys_callback', "Retorno Redsys recibido para inscripción #{$inscripcionId}. Código: {$responseCode}. Estado: {$nuevoEstado}", [
                    'order'            => $order,
                    'responseCode'     => $responseCode,
                    'signaturesMatch'  => $signaturesMatch,
                    'nuevo_estado'     => $nuevoEstado
                ]);
            }

            sendJsonResponse([
                'success'        => true,
                'inscripcion_id' => $inscripcionId,
                'estado'         => $nuevoEstado,
                'pago_ok'        => $isPagoOk
            ], 200);

        } catch (Throwable $e) {
            logError('pagos', 'error_redsys_retorno', $e->getMessage());
            sendJsonResponse(['success' => false, 'message' => 'Error al procesar retorno Redsys.'], 500);
        }
    }
}

// Si la petición no coincide con ningún endpoint anterior
sendJsonResponse(['success' => false, 'message' => 'Acción no reconocida.'], 400);
