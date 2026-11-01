<?php
/**
 * Endpoint para consultar la sesión asociada a la cookie del servidor.
 */

require_once __DIR__ . '/config.php';
$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
if ($method !== 'GET') {
    sendJsonResponse(['success' => false, 'message' => 'Método no permitido. Utilice GET.'], 405);
}

$pdo = getDbConnection();
startApiSession();

try {
    $user = getApiSessionUser($pdo);
    if (session_status() !== PHP_SESSION_ACTIVE) {
        startApiSession();
    }

    $blocked = (($_SESSION['invalid_reason'] ?? '') === 'blocked');
    unset($_SESSION['invalid_reason']);
    $response = [
        'success' => $user !== null,
        'bloqueado' => $blocked,
        'csrf_token' => $_SESSION['csrf_token']
    ];
    if ($user) {
        $response['user'] = [
            'id'                => (int)$user['id'],
            'login'             => $user['login'],
            'email'             => $user['email'],
            'rol'               => $user['rol'] ?? 'asistente',
            'bloqueado'         => 0,
            'intentos_fallidos' => 0
        ];
    }
    sendJsonResponse($response, 200);

} catch (Throwable $e) {
    logError('auth', 'error_check_session', $e->getMessage());
    sendJsonResponse([
        'success' => false,
        'message' => 'Error en el servidor al verificar la sesión.'
    ], 500);
}
