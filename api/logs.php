<?php
/**
 * Endpoint de Consulta de Logs y Auditoría del Sistema
 * Nivel de Seguridad: Exclusivo para Superadministrador
 * Método: GET (Consultar), POST (Limpiar logs antiguos - Superadmin)
 */

require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$pdo = getDbConnection();

/**
 * Verifica si el usuario operador posee permisos de Superadministrador para consultar o depurar logs.
 */
function verifyLogsSuperAdminPermission(PDO $pdo, ?int $operatorId, ?string $operatorLogin): ?array {
    if (!$operatorId && empty($operatorLogin)) {
        if (isset($_SERVER['HTTP_X_USER_ID'])) {
            $operatorId = (int)$_SERVER['HTTP_X_USER_ID'];
        }
        if (isset($_SERVER['HTTP_X_USER_LOGIN'])) {
            $operatorLogin = trim((string)$_SERVER['HTTP_X_USER_LOGIN']);
        }
    }

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
        if ($rol === 'superadministrador') {
            return $user;
        }
        return null;
    } catch (PDOException $e) {
        return null;
    }
}

// ---------------------------------------------------------------------
// 1. GET: Consultar logs con filtros y estadísticas
// ---------------------------------------------------------------------
if ($method === 'GET') {
    $operatorId    = isset($_GET['operator_id']) ? (int)$_GET['operator_id'] : null;
    $operatorLogin = isset($_GET['operator_login']) ? trim((string)$_GET['operator_login']) : null;

    $operator = verifyLogsSuperAdminPermission($pdo, $operatorId, $operatorLogin);
    if (!$operator) {
        logAuth('logs_acceso_denegado', 'Intento no autorizado de consultar logs del sistema', [
            'operator_id'    => $operatorId,
            'operator_login' => $operatorLogin
        ], false, $operatorId);

        sendJsonResponse([
            'success' => false,
            'message' => 'Acceso denegado. La auditoría de logs es exclusiva para Superadministradores.'
        ], 403);
    }
    try {
        $search    = isset($_GET['q']) ? trim((string)$_GET['q']) : '';
        $nivel     = isset($_GET['nivel']) ? strtoupper(trim((string)$_GET['nivel'])) : '';
        $categoria = isset($_GET['categoria']) ? strtolower(trim((string)$_GET['categoria'])) : '';
        $limit     = isset($_GET['limit']) ? min(200, max(1, (int)$_GET['limit'])) : 50;
        $offset    = isset($_GET['offset']) ? max(0, (int)$_GET['offset']) : 0;

        $whereClauses = [];
        $params = [];

        if ($search !== '') {
            $whereClauses[] = '(l.mensaje LIKE :s1 OR l.accion LIKE :s2 OR l.ip LIKE :s3 OR l.origen LIKE :s4 OR u.login LIKE :s5)';
            $searchWild = '%' . $search . '%';
            $params[':s1'] = $searchWild;
            $params[':s2'] = $searchWild;
            $params[':s3'] = $searchWild;
            $params[':s4'] = $searchWild;
            $params[':s5'] = $searchWild;
        }

        if ($nivel !== '' && $nivel !== 'TODOS') {
            $whereClauses[] = 'l.nivel = :nivel';
            $params[':nivel'] = $nivel;
        }

        if ($categoria !== '' && $categoria !== 'todas') {
            $whereClauses[] = 'l.categoria = :categoria';
            $params[':categoria'] = $categoria;
        }

        $whereSql = !empty($whereClauses) ? 'WHERE ' . implode(' AND ', $whereClauses) : '';

        // Contar total con filtros
        $countSql = "
            SELECT COUNT(*) as total 
            FROM `enmi_logs` l 
            LEFT JOIN `enmi_usuarios` u ON l.usuario_id = u.id 
            {$whereSql}
        ";
        $countStmt = $pdo->prepare($countSql);
        $countStmt->execute($params);
        $totalCount = (int)$countStmt->fetch()['total'];

        // Consulta de registros paginados
        $sql = "
            SELECT 
                l.id, 
                l.nivel, 
                l.categoria, 
                l.accion, 
                l.mensaje, 
                l.contexto, 
                l.usuario_id, 
                u.login as usuario_login,
                u.rol as usuario_rol,
                l.ip, 
                l.user_agent, 
                l.origen, 
                l.fecha_creacion 
            FROM `enmi_logs` l 
            LEFT JOIN `enmi_usuarios` u ON l.usuario_id = u.id 
            {$whereSql} 
            ORDER BY l.id DESC 
            LIMIT {$limit} OFFSET {$offset}
        ";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        $formatted = array_map(function ($r) {
            $contextoDecoded = null;
            if (!empty($r['contexto'])) {
                $contextoDecoded = json_decode($r['contexto'], true);
            }

            return [
                'id'             => (int)$r['id'],
                'nivel'          => $r['nivel'],
                'categoria'      => $r['categoria'],
                'accion'         => $r['accion'],
                'mensaje'        => $r['mensaje'],
                'contexto'       => $contextoDecoded,
                'usuario_id'     => $r['usuario_id'] ? (int)$r['usuario_id'] : null,
                'usuario_login'  => $r['usuario_login'] ?? null,
                'usuario_rol'    => $r['usuario_rol'] ?? null,
                'ip'             => $r['ip'],
                'user_agent'     => $r['user_agent'],
                'origen'         => $r['origen'],
                'fecha_creacion' => $r['fecha_creacion']
            ];
        }, $rows);

        // Estadísticas agregadas rápidas
        $statsStmt = $pdo->query("
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN nivel IN ('ERROR', 'CRITICAL', 'ALERT', 'EMERGENCY') THEN 1 ELSE 0 END) as errores,
                SUM(CASE WHEN nivel = 'WARNING' THEN 1 ELSE 0 END) as warnings,
                SUM(CASE WHEN nivel = 'INFO' THEN 1 ELSE 0 END) as infos,
                SUM(CASE WHEN categoria = 'auth' THEN 1 ELSE 0 END) as auth_events
            FROM `enmi_logs`
        ");
        $statsData = $statsStmt->fetch() ?: [];

        sendJsonResponse([
            'success'    => true,
            'total'      => $totalCount,
            'limit'      => $limit,
            'offset'     => $offset,
            'stats'      => [
                'total'       => (int)($statsData['total'] ?? 0),
                'errores'     => (int)($statsData['errores'] ?? 0),
                'warnings'    => (int)($statsData['warnings'] ?? 0),
                'infos'       => (int)($statsData['infos'] ?? 0),
                'auth_events' => (int)($statsData['auth_events'] ?? 0)
            ],
            'data'       => $formatted
        ], 200);

    } catch (PDOException $e) {
        sendJsonResponse([
            'success' => false,
            'message' => 'Error al consultar el registro de logs: ' . $e->getMessage()
        ], 500);
    }
}

// ---------------------------------------------------------------------
// 2. POST: Limpiar logs antiguos (superadmin)
// ---------------------------------------------------------------------
if ($method === 'POST') {
    $inputRaw = file_get_contents('php://input');
    $data = json_decode($inputRaw, true);
    $action = $data['action'] ?? '';
    $operatorId    = isset($data['operator_id']) ? (int)$data['operator_id'] : null;
    $operatorLogin = isset($data['operator_login']) ? trim((string)$data['operator_login']) : null;

    $operator = verifyLogsSuperAdminPermission($pdo, $operatorId, $operatorLogin);
    if (!$operator) {
        sendJsonResponse([
            'success' => false,
            'message' => 'Acceso denegado. La depuración de logs es exclusiva para Superadministradores.'
        ], 403);
    }

    if ($action === 'clear_old') {
        try {
            // Eliminar logs de más de 60 días
            $stmt = $pdo->prepare("DELETE FROM `enmi_logs` WHERE fecha_creacion < DATE_SUB(NOW(), INTERVAL 60 DAY)");
            $stmt->execute();
            $deletedCount = $stmt->rowCount();

            logEvent('INFO', 'sistema', 'logs_purgados', "Se han purgado {$deletedCount} logs antiguos de más de 60 días.");

            sendJsonResponse([
                'success' => true,
                'message' => "Se eliminaron {$deletedCount} registros antiguos de auditoría."
            ], 200);
        } catch (PDOException $e) {
            sendJsonResponse([
                'success' => false,
                'message' => 'Error al depurar logs antiguos: ' . $e->getMessage()
            ], 500);
        }
    }

    sendJsonResponse([
        'success' => false,
        'message' => 'Acción no permitida.'
    ], 400);
}
