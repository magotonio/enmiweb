<?php
/**
 * Endpoint de Autenticación de Usuarios (Login)
 * Método: POST
 * Payload esperado: JSON { "login": "...", "password": "..." }
 */

require_once __DIR__ . '/config.php';

// Verificar que el método sea POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJsonResponse([
        'success' => false,
        'message' => 'Método no permitido. Utilice POST.'
    ], 405);
}

// Leer cuerpo de la petición (JSON)
$inputRaw = file_get_contents('php://input');
$data = json_decode($inputRaw, true);

if (!is_array($data)) {
    sendJsonResponse([
        'success' => false,
        'message' => 'Cuerpo de la petición inválido. Se espera formato JSON.'
    ], 400);
}

// Extraer y sanitizar campos
$loginInput = isset($data['login']) ? trim((string)$data['login']) : '';
$password   = isset($data['password']) ? (string)$data['password'] : '';

// Validaciones iniciales
$errors = [];

if (empty($loginInput)) {
    $errors['login'] = 'Debe indicar su usuario o correo electrónico.';
}

if (empty($password)) {
    $errors['password'] = 'Debe indicar su contraseña.';
}

if (!empty($errors)) {
    sendJsonResponse([
        'success' => false,
        'message' => 'Faltan datos requeridos.',
        'errors'  => $errors
    ], 400);
}

$pdo = getDbConnection();

try {
    // Buscar usuario por login o por email
    $stmt = $pdo->prepare("
        SELECT id, login, email, password_hash, bloqueado, ultimo_login 
        FROM `enmi_usuarios` 
        WHERE login = :login OR email = :email 
        LIMIT 1
    ");

    $stmt->execute([
        ':login' => $loginInput,
        ':email' => $loginInput
    ]);

    $user = $stmt->fetch();

    // Comprobar si el usuario existe
    if (!$user) {
        logAuth('login_fallido', "Intento de inicio de sesión fallido: usuario no encontrado", ['login' => $loginInput], false);
        sendJsonResponse([
            'success' => false,
            'message' => 'Usuario o contraseña incorrectos.'
        ], 401);
    }

    // Comprobar si la cuenta está bloqueada
    if ((int)$user['bloqueado'] === 1) {
        logAuth('login_bloqueado', "Intento de acceso con cuenta bloqueada: {$user['login']}", ['login' => $user['login']], false, (int)$user['id']);
        sendJsonResponse([
            'success' => false,
            'message' => 'La cuenta de usuario está bloqueada. Contacte con el administrador.'
        ], 403);
    }

    // Verificar la contraseña con el hash almacenado
    if (!password_verify($password, $user['password_hash'])) {
        logAuth('login_password_invalido', "Contraseña incorrecta para usuario: {$user['login']}", ['login' => $user['login']], false, (int)$user['id']);
        sendJsonResponse([
            'success' => false,
            'message' => 'Usuario o contraseña incorrectos.'
        ], 401);
    }

    // Actualizar fecha de último login
    $updateStmt = $pdo->prepare("
        UPDATE `enmi_usuarios` 
        SET `ultimo_login` = NOW() 
        WHERE `id` = :id
    ");
    $updateStmt->execute([':id' => $user['id']]);

    // Registrar log de acceso exitoso
    logAuth('login_exitoso', "Inicio de sesión exitoso para usuario: {$user['login']}", ['login' => $user['login']], true, (int)$user['id']);

    // Generar token de sesión (32 bytes aleatorios en hexadecimal)
    $sessionToken = bin2hex(random_bytes(32));

    sendJsonResponse([
        'success' => true,
        'message' => 'Inicio de sesión exitoso.',
        'user'    => [
            'id'    => (int)$user['id'],
            'login' => $user['login'],
            'email' => $user['email']
        ],
        'token'   => $sessionToken
    ], 200);

} catch (PDOException $e) {
    logError('auth', 'error_bd_login', $e->getMessage(), ['login' => $loginInput]);
    sendJsonResponse([
        'success' => false,
        'message' => 'Error en el servidor al autenticar el usuario: ' . $e->getMessage()
    ], 500);
}

