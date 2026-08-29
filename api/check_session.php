<?php
/**
 * Endpoint de Verificación de Estado de Sesión y Bloqueo de Usuario
 * Método: GET o POST
 * Parámetros aceptados:
 *  - id: ID del usuario numérico
 *  - login: Login o email del usuario
 */

require_once __DIR__ . '/config.php';

$userId = null;
$userLogin = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $inputRaw = file_get_contents('php://input');
    $data = json_decode($inputRaw, true);
    if (is_array($data)) {
        $userId = isset($data['id']) ? (int)$data['id'] : null;
        $userLogin = isset($data['login']) ? trim((string)$data['login']) : null;
    }
} else {
    $userId = isset($_GET['id']) ? (int)$_GET['id'] : null;
    $userLogin = isset($_GET['login']) ? trim((string)$_GET['login']) : null;
}

if (!$userId && empty($userLogin)) {
    sendJsonResponse([
        'success' => false,
        'message' => 'Se requiere el identificador o nombre de usuario para verificar la sesión.'
    ], 400);
}

$pdo = getDbConnection();

try {
    if ($userId) {
        $stmt = $pdo->prepare("
            SELECT id, login, email, rol, bloqueado, ultimo_login
            FROM `enmi_usuarios`
            WHERE id = :id
            LIMIT 1
        ");
        $stmt->execute([':id' => $userId]);
    } else {
        $stmt = $pdo->prepare("
            SELECT id, login, email, rol, bloqueado, ultimo_login
            FROM `enmi_usuarios`
            WHERE login = :login OR email = :email
            LIMIT 1
        ");
        $stmt->execute([
            ':login' => $userLogin,
            ':email' => $userLogin
        ]);
    }

    $user = $stmt->fetch();

    if (!$user) {
        sendJsonResponse([
            'success' => false,
            'message' => 'Usuario no encontrado en el sistema.'
        ], 404);
    }

    // Comprobar si el usuario se encuentra bloqueado
    $isBlocked = ((int)$user['bloqueado'] === 1);

    if ($isBlocked) {
        logAuth('sesion_bloqueada', "Verificación de sesión: usuario bloqueado ({$user['login']})", ['login' => $user['login']], false, (int)$user['id']);
        sendJsonResponse([
            'success'   => false,
            'bloqueado' => true,
            'message'   => 'Su usuario está bloqueado. Por favor, contacte con el administrador.'
        ], 403);
    }

    sendJsonResponse([
        'success'   => true,
        'bloqueado' => false,
        'user'      => [
            'id'                => (int)$user['id'],
            'login'             => $user['login'],
            'email'             => $user['email'],
            'rol'               => $user['rol'] ?? 'asistente',
            'bloqueado'         => 0,
            'intentos_fallidos' => 0
        ]
    ], 200);

} catch (PDOException $e) {
    logError('auth', 'error_check_session', $e->getMessage(), ['user_id' => $userId, 'login' => $userLogin]);
    sendJsonResponse([
        'success' => false,
        'message' => 'Error en el servidor al verificar el estado de la sesión: ' . $e->getMessage()
    ], 500);
}
