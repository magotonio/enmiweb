<?php
/**
 * Endpoint de Diagnóstico y Salud de la Base de Datos
 * Método: GET
 */

require_once __DIR__ . '/config.php';

$pdo = getDbConnection();
requireApiUser($pdo, ['superadministrador']);

try {
    // Obtener versión de MariaDB
    $versionStmt = $pdo->query("SELECT VERSION() as version");
    $version = $versionStmt->fetch()['version'] ?? 'Desconocida';

    // Verificar existencia de la tabla enmi_inscripciones y total de registros
    $countInscripciones = 0;
    try {
        $countStmt = $pdo->query("SELECT COUNT(*) as total FROM `enmi_inscripciones`");
        $countInscripciones = (int)$countStmt->fetch()['total'];
    } catch (Exception $e) {
        $countInscripciones = -1;
    }

    // Verificar existencia de la tabla enmi_usuarios
    $countUsuarios = 0;
    try {
        $countUsersStmt = $pdo->query("SELECT COUNT(*) as total FROM `enmi_usuarios`");
        $countUsuarios = (int)$countUsersStmt->fetch()['total'];
    } catch (Exception $e) {
        $countUsuarios = -1;
    }

    // Verificar existencia de la tabla enmi_logs
    $countLogs = 0;
    try {
        $countLogsStmt = $pdo->query("SELECT COUNT(*) as total FROM `enmi_logs`");
        $countLogs = (int)$countLogsStmt->fetch()['total'];
    } catch (Exception $e) {
        $countLogs = -1;
    }

    // Verificar existencia de la tabla enmi_pagos
    $countPagos = 0;
    try {
        $countPagosStmt = $pdo->query("SELECT COUNT(*) as total FROM `enmi_pagos`");
        $countPagos = (int)$countPagosStmt->fetch()['total'];
    } catch (Exception $e) {
        $countPagos = -1;
    }

    // Listar las últimas 5 inscripciones para verificación
    $ultimasInscripciones = [];
    try {
        $latestStmt = $pdo->query("
            SELECT id, nombre, apellidos, estado, ip_registro, fecha_creacion 
            FROM `enmi_inscripciones` 
            ORDER BY id DESC 
            LIMIT 5
        ");
        $ultimasInscripciones = $latestStmt->fetchAll();
    } catch (Exception $e) {
        $ultimasInscripciones = [];
    }

    sendJsonResponse([
        'status'               => 'ok',
        'database'             => 'conectada',
        'mariadb_version'      => $version,
        'tablas'               => [
            'enmi_inscripciones' => $countInscripciones >= 0 ? ['estado' => 'ok', 'total' => $countInscripciones] : ['estado' => 'no_creada'],
            'enmi_usuarios'      => $countUsuarios >= 0 ? ['estado' => 'ok', 'total' => $countUsuarios] : ['estado' => 'no_creada'],
            'enmi_logs'          => $countLogs >= 0 ? ['estado' => 'ok', 'total' => $countLogs] : ['estado' => 'no_creada'],
            'enmi_pagos'         => $countPagos >= 0 ? ['estado' => 'ok', 'total' => $countPagos] : ['estado' => 'no_creada'],
        ],
        'configuracion'        => [
            'log_level'          => getLogLevel(),
            'show_error_details' => shouldShowErrorDetails()
        ],
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
