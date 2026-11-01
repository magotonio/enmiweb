<?php
/**
 * Endpoint de Consulta de Inscripciones (Panel de Administración y Área de Asistente)
 * Método: GET
 * Control de Privacidad y Roles:
 *  - 'superadministrador' / 'supervisor': Acceso al listado completo de todos los participantes.
 *  - 'asistente': Acceso EXCLUSIVO y restringido únicamente a su propia inscripción personal.
 * 
 * Parámetros opcionales:
 *  - q: Búsqueda textual por nombre o apellidos (solo para administradores/supervisores)
 *  - estado: Filtrar por estado ('activo', etc.)
 *  - sort: Campo de ordenación ('fecha_creacion', 'nombre', 'apellidos', 'id')
 *  - order: Dirección de ordenación ('ASC' | 'DESC')
 */

require_once __DIR__ . '/config.php';

$pdo = getDbConnection();
$requestMethod = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$authUser = $requestMethod === 'GET'
    ? requireApiUser($pdo)
    : requireApiUser($pdo, ['superadministrador', 'supervisor']);

// ---------------------------------------------------------------------
// 1. ACTUALIZAR ESTADO DE INSCRIPCIÓN (POST / PATCH / PUT)
// ---------------------------------------------------------------------
if ($requestMethod === 'POST' || $requestMethod === 'PATCH' || $requestMethod === 'PUT') {
    $inputRaw = file_get_contents('php://input');
    $data = json_decode($inputRaw, true);
    if (!is_array($data)) {
        $data = $_POST;
    }

    $userRole = $authUser['rol'] ?? null;

    if (!$authUser || !in_array($userRole, ['superadministrador', 'supervisor'], true)) {
        sendJsonResponse([
            'success' => false,
            'message' => 'Acceso denegado. Se requieren permisos de supervisor o superadministrador.'
        ], 403);
    }

    $inscripcionId = isset($data['id']) ? (int)$data['id'] : (isset($data['inscripcion_id']) ? (int)$data['inscripcion_id'] : 0);
    $nuevoEstado = isset($data['estado']) ? strtolower(trim((string)$data['estado'])) : '';

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
        logInfo('inscripciones', 'actualizar_estado', "Estado de inscripción #{$inscripcionId} actualizado a '{$nuevoEstado}' por {$adminInfo}.", [
            'inscripcion_id'  => $inscripcionId,
            'estado_anterior' => $inscripcion['estado'],
            'nuevo_estado'    => $nuevoEstado,
            'admin'           => $adminInfo
        ]);

        sendJsonResponse([
            'success'        => true,
            'message'        => "Estado de la inscripción actualizado a '{$nuevoEstado}' correctamente.",
            'inscripcion_id' => $inscripcionId,
            'nuevo_estado'   => $nuevoEstado
        ], 200);

    } catch (Throwable $e) {
        logError('inscripciones', 'error_actualizar_estado', $e->getMessage());
        sendJsonResponse([
            'success' => false,
            'message' => 'Error al actualizar el estado de la inscripción: ' . $e->getMessage()
        ], 500);
    }
}

// Verificar que el método para consultas sea GET
if ($requestMethod !== 'GET') {
    sendJsonResponse([
        'success' => false,
        'message' => 'Método no permitido. Utilice GET para consultas o POST/PATCH para actualizar.'
    ], 405);
}

try {
    $userRole = $authUser['rol'] ?? 'asistente';
    $userEmail = (string)($authUser['email'] ?? '');

    // Parámetros de consulta sanitizados
    $search = isset($_GET['q']) ? trim((string)$_GET['q']) : '';
    $estado = isset($_GET['estado']) ? trim((string)$_GET['estado']) : '';
    $sortParam = isset($_GET['sort']) ? trim((string)$_GET['sort']) : 'fecha_creacion';
    $orderParam = isset($_GET['order']) ? strtoupper(trim((string)$_GET['order'])) : 'DESC';

    // Lista blanca para evitar inyecciones en ORDER BY
    $allowedSortFields = [
        'id'                => 'id',
        'nombre'            => 'nombre',
        'apellidos'         => 'apellidos',
        'nombre_artistico'  => 'nombre_artistico',
        'email'             => 'email',
        'nif_pasaporte'     => 'nif_pasaporte',
        'origen'            => 'origen',
        'quiero_participar' => 'quiero_participar',
        'estado'            => 'estado',
        'fecha_creacion'    => 'fecha_creacion'
    ];

    $sortColumn = $allowedSortFields[$sortParam] ?? 'fecha_creacion';
    $sortOrder = ($orderParam === 'ASC') ? 'ASC' : 'DESC';

    // Construcción dinámica de la consulta con parámetros preparados
    $whereClauses = [];
    $params = [];

    // AISLAMIENTO DE DATOS PARA EL ROL ASISTENTE:
    // Un asistente NUNCA puede ver la información de otros participantes.
    if ($userRole === 'asistente') {
        $emailToMatch = trim($userEmail);
        if (empty($emailToMatch)) {
            sendJsonResponse([
                'success' => true,
                'count'   => 0,
                'stats'   => ['total' => 0, 'hoy' => 0, 'activos' => 0, 'quieren_participar' => 0],
                'data'    => []
            ], 200);
        }

        $whereClauses[] = 'LOWER(TRIM(email)) = LOWER(TRIM(:asistenteEmail))';
        $params[':asistenteEmail'] = $emailToMatch;
    } else {
        // Para Superadministrador y Supervisor: permitir búsqueda y filtros globales
        if ($search !== '') {
            $whereClauses[] = '(nombre LIKE :search1 OR apellidos LIKE :search2 OR nombre_artistico LIKE :search3 OR email LIKE :search4 OR nif_pasaporte LIKE :search5 OR telefono LIKE :search6 OR origen LIKE :search7 OR asociacion LIKE :search8 OR id = :searchId OR ip_registro LIKE :searchIp)';
            $searchWild = '%' . $search . '%';
            $params[':search1'] = $searchWild;
            $params[':search2'] = $searchWild;
            $params[':search3'] = $searchWild;
            $params[':search4'] = $searchWild;
            $params[':search5'] = $searchWild;
            $params[':search6'] = $searchWild;
            $params[':search7'] = $searchWild;
            $params[':search8'] = $searchWild;
            $params[':searchIp'] = $searchWild;
            $params[':searchId'] = is_numeric($search) ? (int)$search : 0;
        }

        if ($estado !== '' && $estado !== 'todos') {
            if ($estado === 'participa') {
                $whereClauses[] = 'quiero_participar = 1';
            } else {
                $whereClauses[] = 'estado = :estado';
                $params[':estado'] = $estado;
            }
        }
    }

    $whereSql = '';
    if (!empty($whereClauses)) {
        $whereSql = 'WHERE ' . implode(' AND ', $whereClauses);
    }

    // Consulta principal de inscripciones
    $sql = "
        SELECT 
            id, 
            nombre, 
            apellidos, 
            nombre_artistico,
            nif_pasaporte,
            email,
            telefono,
            origen,
            asociacion,
            quiero_participar,
            acepta_privacidad,
            consentimiento_imagen,
            comentarios,
            estado, 
            ip_registro, 
            fecha_creacion, 
            fecha_actualizacion 
        FROM `enmi_inscripciones` 
        {$whereSql} 
        ORDER BY `{$sortColumn}` {$sortOrder}
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $inscripciones = $stmt->fetchAll();

    // Formatear tipos de datos devueltos
    $formattedInscripciones = array_map(function ($item) {
        return [
            'id'                    => (int)$item['id'],
            'nombre'                => $item['nombre'],
            'apellidos'             => $item['apellidos'],
            'nombre_artistico'      => $item['nombre_artistico'] ?? null,
            'nif_pasaporte'         => $item['nif_pasaporte'] ?? '',
            'email'                 => $item['email'] ?? '',
            'telefono'              => $item['telefono'] ?? '',
            'origen'                => $item['origen'] ?? '',
            'asociacion'            => $item['asociacion'] ?? null,
            'quiero_participar'     => !empty($item['quiero_participar']),
            'acepta_privacidad'     => !empty($item['acepta_privacidad']),
            'consentimiento_imagen' => !empty($item['consentimiento_imagen']),
            'comentarios'           => $item['comentarios'] ?? null,
            'estado'                => $item['estado'] ?? 'activo',
            'ip_registro'           => $item['ip_registro'] ?? null,
            'fecha_creacion'        => $item['fecha_creacion'],
            'fecha_actualizacion'   => $item['fecha_actualizacion']
        ];
    }, $inscripciones);

    // Métricas y estadísticas
    if ($userRole === 'asistente') {
        $stats = [
            'total'              => count($formattedInscripciones),
            'hoy'                => 0,
            'activos'            => count($formattedInscripciones),
            'pagadas'            => count(array_filter($formattedInscripciones, fn($i) => in_array($i['estado'], ['pagada', 'pagado']))),
            'pendientes'         => count(array_filter($formattedInscripciones, fn($i) => $i['estado'] === 'pendiente')),
            'iniciadas'          => count(array_filter($formattedInscripciones, fn($i) => $i['estado'] === 'iniciada')),
            'canceladas'         => count(array_filter($formattedInscripciones, fn($i) => in_array($i['estado'], ['cancelada', 'cancelado']))),
            'quieren_participar' => (count($formattedInscripciones) > 0 && $formattedInscripciones[0]['quiero_participar']) ? 1 : 0
        ];
    } else {
        $statsStmt = $pdo->query("
            SELECT 
                COUNT(*) AS total,
                SUM(CASE WHEN DATE(fecha_creacion) = CURDATE() THEN 1 ELSE 0 END) AS hoy,
                SUM(CASE WHEN estado IN ('activo', 'pagada', 'pagado') THEN 1 ELSE 0 END) AS activos,
                SUM(CASE WHEN estado IN ('pagada', 'pagado') THEN 1 ELSE 0 END) AS pagadas,
                SUM(CASE WHEN estado = 'pendiente' THEN 1 ELSE 0 END) AS pendientes,
                SUM(CASE WHEN estado = 'iniciada' THEN 1 ELSE 0 END) AS iniciadas,
                SUM(CASE WHEN estado IN ('cancelada', 'cancelado') THEN 1 ELSE 0 END) AS canceladas,
                SUM(CASE WHEN quiero_participar = 1 THEN 1 ELSE 0 END) AS quieren_participar
            FROM `enmi_inscripciones`
        ");
        $statsData = $statsStmt->fetch() ?: [];

        $stats = [
            'total'              => (int)($statsData['total'] ?? count($formattedInscripciones)),
            'hoy'                => (int)($statsData['hoy'] ?? 0),
            'activos'            => (int)($statsData['activos'] ?? count($formattedInscripciones)),
            'pagadas'            => (int)($statsData['pagadas'] ?? 0),
            'pendientes'         => (int)($statsData['pendientes'] ?? 0),
            'iniciadas'          => (int)($statsData['iniciadas'] ?? 0),
            'canceladas'         => (int)($statsData['canceladas'] ?? 0),
            'quieren_participar' => (int)($statsData['quieren_participar'] ?? 0)
        ];
    }

    sendJsonResponse([
        'success' => true,
        'count'   => count($formattedInscripciones),
        'stats'   => $stats,
        'data'    => $formattedInscripciones
    ], 200);

} catch (PDOException $e) {
    sendJsonResponse([
        'success' => false,
        'message' => 'Error al consultar las inscripciones en la base de datos: ' . $e->getMessage()
    ], 500);
}
