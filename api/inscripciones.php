<?php
/**
 * Endpoint de Consulta de Inscripciones (Panel de Administración)
 * Método: GET
 * Parámetros opcionales:
 *  - q: Búsqueda textual por nombre o apellidos
 *  - estado: Filtrar por estado ('activo', etc.)
 *  - sort: Campo de ordenación ('fecha_creacion', 'nombre', 'apellidos', 'id')
 *  - order: Dirección de ordenación ('ASC' | 'DESC')
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

try {
    // Parámetros de consulta sanitizados
    $search = isset($_GET['q']) ? trim((string)$_GET['q']) : '';
    $estado = isset($_GET['estado']) ? trim((string)$_GET['estado']) : '';
    $sortParam = isset($_GET['sort']) ? trim((string)$_GET['sort']) : 'fecha_creacion';
    $orderParam = isset($_GET['order']) ? strtoupper(trim((string)$_GET['order'])) : 'DESC';

    // Lista blanca para evitar inyecciones en ORDER BY
    $allowedSortFields = [
        'id'             => 'id',
        'nombre'         => 'nombre',
        'apellidos'      => 'apellidos',
        'estado'         => 'estado',
        'fecha_creacion' => 'fecha_creacion'
    ];

    $sortColumn = $allowedSortFields[$sortParam] ?? 'fecha_creacion';
    $sortOrder = ($orderParam === 'ASC') ? 'ASC' : 'DESC';

    // Construcción dinámica de la consulta con parámetros preparados
    $whereClauses = [];
    $params = [];

    if ($search !== '') {
        $whereClauses[] = '(nombre LIKE :search1 OR apellidos LIKE :search2 OR id = :searchId)';
        $params[':search1'] = '%' . $search . '%';
        $params[':search2'] = '%' . $search . '%';
        $params[':searchId'] = is_numeric($search) ? (int)$search : 0;
    }

    if ($estado !== '' && $estado !== 'todos') {
        $whereClauses[] = 'estado = :estado';
        $params[':estado'] = $estado;
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
            'id'                  => (int)$item['id'],
            'nombre'              => $item['nombre'],
            'apellidos'           => $item['apellidos'],
            'estado'              => $item['estado'] ?? 'activo',
            'ip_registro'         => $item['ip_registro'] ?? null,
            'fecha_creacion'      => $item['fecha_creacion'],
            'fecha_actualizacion' => $item['fecha_actualizacion']
        ];
    }, $inscripciones);

    // Métricas y estadísticas rápidas para el panel de administración
    $statsStmt = $pdo->query("
        SELECT 
            COUNT(*) AS total,
            SUM(CASE WHEN DATE(fecha_creacion) = CURDATE() THEN 1 ELSE 0 END) AS hoy,
            SUM(CASE WHEN estado = 'activo' THEN 1 ELSE 0 END) AS activos
        FROM `enmi_inscripciones`
    ");
    $statsData = $statsStmt->fetch() ?: [];

    $stats = [
        'total'   => (int)($statsData['total'] ?? count($formattedInscripciones)),
        'hoy'     => (int)($statsData['hoy'] ?? 0),
        'activos' => (int)($statsData['activos'] ?? count($formattedInscripciones))
    ];

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
