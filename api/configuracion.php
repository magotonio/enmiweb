<?php
/**
 * Endpoint de Configuración de la Web (Modo Mantenimiento y Parámetros del Sistema)
 * Métodos:
 *  - GET: Consulta pública del estado de mantenimiento (y listado completo para administradores)
 *  - POST: Actualización de parámetros de configuración (Exclusivo Superadmin y Supervisor)
 */

require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$pdo = getDbConnection();

/**
 * Verifica si el usuario operador posee permisos de administración (Supervisor o Superadministrador).
 */
function verifyConfigOperatorPermission(PDO $pdo, ?int $operatorId, ?string $operatorLogin): ?array {
    if (!$operatorId && empty($operatorLogin)) {
        return null;
    }

    try {
        if ($operatorId) {
            $stmt = $pdo->prepare("SELECT id, login, email, rol, bloqueado FROM `enmi_usuarios` WHERE id = :id LIMIT 1");
            $stmt->execute([':id' => $operatorId]);
        } else {
            $stmt = $pdo->prepare("SELECT id, login, email, rol, bloqueado FROM `enmi_usuarios` WHERE login = :login LIMIT 1");
            $stmt->execute([':login' => $operatorLogin]);
        }

        $user = $stmt->fetch();
        if (!$user) return null;
        if ((int)$user['bloqueado'] === 1) return null;

        $rol = $user['rol'] ?? 'asistente';
        if (in_array($rol, ['superadministrador', 'supervisor'], true)) {
            return $user;
        }
        return null;
    } catch (PDOException $e) {
        return null;
    }
}

// ---------------------------------------------------------------------
// 1. GET: Consulta de estado de mantenimiento / configuración
// ---------------------------------------------------------------------
if ($method === 'GET') {
    try {
        $mantenimientoActivo = isMaintenanceMode($pdo);
        $mantenimientoValor  = (string)getConfigValue('mantenimiento', '0', $pdo);

        $operatorId    = isset($_GET['operator_id']) ? (int)$_GET['operator_id'] : null;
        $operatorLogin = isset($_GET['operator_login']) ? trim((string)$_GET['operator_login']) : null;
        $includeAll    = !empty($_GET['include_all']);

        $response = [
            'success'             => true,
            'mantenimiento'       => $mantenimientoActivo,
            'mantenimiento_valor' => $mantenimientoValor
        ];

        // Si se solicita el listado completo y es un operador autorizado
        if ($includeAll) {
            $operator = verifyConfigOperatorPermission($pdo, $operatorId, $operatorLogin);
            if ($operator) {
                $stmt = $pdo->query("SELECT id, clave, valor, descripcion, fecha_actualizacion FROM `enmi_configuracion` ORDER BY clave ASC");
                $configList = $stmt->fetchAll(PDO::FETCH_ASSOC);

                // Ocultar contraseñas sensibles en la salida por seguridad
                $safeList = array_map(function ($item) {
                    if ($item['clave'] === 'smtp_pass' && !empty($item['valor'])) {
                        $item['valor'] = '••••••••';
                    }
                    return $item;
                }, $configList);

                $response['configuracion'] = $safeList;
            }
        }

        sendJsonResponse($response, 200);

    } catch (PDOException $e) {
        logError('config', 'error_get_config', $e->getMessage());
        sendJsonResponse([
            'success'             => false,
            'mantenimiento'       => false,
            'mantenimiento_valor' => '0',
            'message'             => 'Error al consultar la configuración: ' . $e->getMessage()
        ], 500);
    }
}

// ---------------------------------------------------------------------
// 2. POST: Actualizar configuración (Superadmin / Supervisor)
// ---------------------------------------------------------------------
if ($method === 'POST') {
    $inputRaw = file_get_contents('php://input');
    $data = json_decode($inputRaw, true);

    if (!is_array($data)) {
        sendJsonResponse([
            'success' => false,
            'message' => 'Cuerpo de la petición inválido. Se espera formato JSON.'
        ], 400);
    }

    $operatorId    = isset($data['operator_id']) ? (int)$data['operator_id'] : null;
    $operatorLogin = isset($data['operator_login']) ? trim((string)$data['operator_login']) : null;

    $operator = verifyConfigOperatorPermission($pdo, $operatorId, $operatorLogin);
    if (!$operator) {
        logAuth('config_acceso_denegado', 'Intento de modificar configuración sin permisos suficientes', [
            'operator_id'    => $operatorId,
            'operator_login' => $operatorLogin
        ], false, $operatorId);

        sendJsonResponse([
            'success' => false,
            'message' => 'No tienes permisos suficientes para modificar la configuración de la web.'
        ], 403);
    }

    // Permitir actualización por clave específica o por parámetro directo 'mantenimiento'
    $clave = isset($data['clave']) ? trim((string)$data['clave']) : '';
    $valor = isset($data['valor']) ? (string)$data['valor'] : null;

    if (empty($clave) && isset($data['mantenimiento'])) {
        $clave = 'mantenimiento';
        $valor = in_array((string)$data['mantenimiento'], ['1', 'true', 'on', 'si'], true) ? '1' : '0';
    }

    if (empty($clave) || $valor === null) {
        sendJsonResponse([
            'success' => false,
            'message' => 'Se requiere el nombre del parámetro (clave) y el nuevo valor.'
        ], 400);
    }

    // Normalizar valor para mantenimiento
    if ($clave === 'mantenimiento') {
        $valor = in_array(strtolower(trim($valor)), ['1', 'true', 'on', 'si'], true) ? '1' : '0';
    }

    try {
        $stmt = $pdo->prepare("
            INSERT INTO `enmi_configuracion` (`clave`, `valor`, `fecha_actualizacion`, `fecha_creacion`)
            VALUES (:clave, :valor, NOW(), NOW())
            ON DUPLICATE KEY UPDATE
                `valor` = VALUES(`valor`),
                `fecha_actualizacion` = NOW()
        ");

        $stmt->execute([
            ':clave' => $clave,
            ':valor' => $valor
        ]);

        $logDesc = "Configuración actualizada: [{$clave}] = '{$valor}' por el usuario {$operator['login']} (Rol: {$operator['rol']})";
        logInfo('config', 'config_actualizada', $logDesc, [
            'clave'          => $clave,
            'valor'          => ($clave === 'smtp_pass') ? '••••••••' : $valor,
            'operator_id'    => $operator['id'],
            'operator_login' => $operator['login']
        ], (int)$operator['id']);

        // Recargar el estado actualizado
        $mantenimientoActivo = ($clave === 'mantenimiento') ? ($valor === '1') : isMaintenanceMode($pdo);

        sendJsonResponse([
            'success'             => true,
            'message'             => "Parámetro '{$clave}' actualizado correctamente.",
            'clave'               => $clave,
            'valor'               => $valor,
            'mantenimiento'       => $mantenimientoActivo,
            'mantenimiento_valor' => ($clave === 'mantenimiento' ? $valor : (string)getConfigValue('mantenimiento', '0', $pdo))
        ], 200);

    } catch (PDOException $e) {
        logError('config', 'error_update_config', $e->getMessage(), ['clave' => $clave]);
        sendJsonResponse([
            'success' => false,
            'message' => 'Error en la base de datos al guardar la configuración: ' . $e->getMessage()
        ], 500);
    }
}

sendJsonResponse([
    'success' => false,
    'message' => 'Método no permitido.'
], 405);
