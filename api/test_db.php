<?php
/**
 * Endpoint de Diagnóstico y Salud de la Base de Datos
 * Método: GET
 */

require_once __DIR__ . '/config.php';

try {
    $pdo = getDbConnection();

    // Obtener versión de MariaDB
    $versionStmt = $pdo->query("SELECT VERSION() as version");
    $version = $versionStmt->fetch()['version'] ?? 'Desconocida';

    // Verificar existencia de la tabla enmi_inscripciones y total de registros
    $countStmt = $pdo->query("SELECT COUNT(*) as total FROM `enmi_inscripciones`");
    $totalInscripciones = (int)$countStmt->fetch()['total'];

    // Listar las últimas 5 inscripciones para verificación
    $latestStmt = $pdo->query("
        SELECT id, nombre, apellidos, estado, ip_registro, fecha_creacion 
        FROM `enmi_inscripciones` 
        ORDER BY id DESC 
        LIMIT 5
    ");
    $ultimasInscripciones = $latestStmt->fetchAll();

    sendJsonResponse([
        'status'               => 'ok',
        'database'             => 'conectada',
        'mariadb_version'      => $version,
        'tabla'                => 'enmi_inscripciones',
        'total_inscripciones'  => $totalInscripciones,
        'ultimos_registros'    => $ultimasInscripciones,
        'timestamp'            => date('Y-m-d H:i:s')
    ], 200);

} catch (Exception $e) {
    sendJsonResponse([
        'status'   => 'error',
        'database' => 'desconectada',
        'message'  => $e->getMessage()
    ], 500);
}
