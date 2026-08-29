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
 *  - user_id / user_login / user_email: Identificación del usuario para control de acceso
 */

require_once __DIR__ . '/config.php';

// Verificar que el método sea GET
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendJsonResponse([
        'success' => false,
        'message' => 'Método no permitido. Utilice GET.'
    ], 405);
}

$pdo = getDbConnection();

/**
 * Obtiene el usuario autenticado para aplicar las restricciones de seguridad por rol.
 */
function getAuthenticatedUser(PDO $pdo): ?array {
    $userId = isset($_GET['user_id']) ? (int)$_GET['user_id'] : null;
    $userLogin = isset($_GET['user_login']) ? trim((string)$_GET['user_login']) : null;
    $userEmail = isset($_GET['user_email']) ? trim((string)$_GET['user_email']) : null;

    if (!$userId && isset($_SERVER['HTTP_X_USER_ID'])) {
        $userId = (int)$_SERVER['HTTP_X_USER_ID'];
    }
    if (!$userLogin && isset($_SERVER['HTTP_X_USER_LOGIN'])) {
        $userLogin = trim((string)$_SERVER['HTTP_X_USER_LOGIN']);
    }

    if (!$userId && empty($userLogin) && empty($userEmail)) {
        return null;
    }

    try {
        if ($userId) {
            $stmt = $pdo->prepare("SELECT id, login, email, rol, bloqueado FROM `enmi_usuarios` WHERE id = :id LIMIT 1");
            $stmt->execute([':id' => $userId]);
        } elseif (!empty($userLogin)) {
            $stmt = $pdo->prepare("SELECT id, login, email, rol, bloqueado FROM `enmi_usuarios` WHERE login = :login LIMIT 1");
            $stmt->execute([':login' => $userLogin]);
        } else {
            $stmt = $pdo->prepare("SELECT id, login, email, rol, bloqueado FROM `enmi_usuarios` WHERE email = :email LIMIT 1");
            $stmt->execute([':email' => $userEmail]);
        }

        $user = $stmt->fetch();
        if (!$user || (int)$user['bloqueado'] === 1) {
            return null;
        }
        return $user;
    } catch (PDOException $e) {
        return null;
    }
}

try {
    $authUser = getAuthenticatedUser($pdo);
    $userRole = $authUser['rol'] ?? 'asistente';
    $userEmail = $authUser['email'] ?? (isset($_GET['user_email']) ? trim((string)$_GET['user_email']) : '');

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
            'quieren_participar' => (count($formattedInscripciones) > 0 && $formattedInscripciones[0]['quiero_participar']) ? 1 : 0
        ];
    } else {
        $statsStmt = $pdo->query("
            SELECT 
                COUNT(*) AS total,
                SUM(CASE WHEN DATE(fecha_creacion) = CURDATE() THEN 1 ELSE 0 END) AS hoy,
                SUM(CASE WHEN estado = 'activo' THEN 1 ELSE 0 END) AS activos,
                SUM(CASE WHEN quiero_participar = 1 THEN 1 ELSE 0 END) AS quieren_participar
            FROM `enmi_inscripciones`
        ");
        $statsData = $statsStmt->fetch() ?: [];

        $stats = [
            'total'              => (int)($statsData['total'] ?? count($formattedInscripciones)),
            'hoy'                => (int)($statsData['hoy'] ?? 0),
            'activos'            => (int)($statsData['activos'] ?? count($formattedInscripciones)),
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
