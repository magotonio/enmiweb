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
        SELECT id, login, email, rol, password_hash, bloqueado, intentos_fallidos, ultimo_login 
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

    // Comprobar si la cuenta ya está bloqueada
    if ((int)$user['bloqueado'] === 1) {
        logAuth('login_bloqueado', "Intento de acceso con cuenta bloqueada: {$user['login']}", ['login' => $user['login']], false, (int)$user['id']);
        sendJsonResponse([
            'success'   => false,
            'bloqueado' => true,
            'message'   => 'Su usuario está bloqueado. Por favor, contacte con el administrador.'
        ], 403);
    }

    // Verificar la contraseña con el hash almacenado
    if (!password_verify($password, $user['password_hash'])) {
        $nuevosIntentos = (int)($user['intentos_fallidos'] ?? 0) + 1;

        if ($nuevosIntentos >= 3) {
            // Bloquear automáticamente la cuenta al tercer intento fallido
            $updateStmt = $pdo->prepare("
                UPDATE `enmi_usuarios`
                SET `bloqueado` = 1,
                    `intentos_fallidos` = :intentos
                WHERE `id` = :id
            ");
            $updateStmt->execute([
                ':intentos' => $nuevosIntentos,
                ':id'       => $user['id']
            ]);

            logAuth('usuario_bloqueado_intentos', "Usuario bloqueado automáticamente tras 3 intentos fallidos de login: {$user['login']}", [
                'login'             => $user['login'],
                'intentos_fallidos' => $nuevosIntentos
            ], false, (int)$user['id']);

            sendJsonResponse([
                'success'   => false,
                'bloqueado' => true,
                'message'   => 'Su usuario está bloqueado. Por favor, contacte con el administrador.'
            ], 403);
        } else {
            // Incrementar contador de intentos erróneos
            $updateStmt = $pdo->prepare("
                UPDATE `enmi_usuarios`
                SET `intentos_fallidos` = :intentos
                WHERE `id` = :id
            ");
            $updateStmt->execute([
                ':intentos' => $nuevosIntentos,
                ':id'       => $user['id']
            ]);

            logAuth('login_password_invalido', "Contraseña incorrecta para usuario: {$user['login']} (Intento {$nuevosIntentos}/3)", [
                'login'             => $user['login'],
                'intentos_fallidos' => $nuevosIntentos
            ], false, (int)$user['id']);

            sendJsonResponse([
                'success' => false,
                'message' => 'Usuario o contraseña incorrectos.'
            ], 401);
        }
    }

    // Login exitoso: actualizar último login y resetear contador de intentos fallidos a 0
    $updateStmt = $pdo->prepare("
        UPDATE `enmi_usuarios` 
        SET `ultimo_login` = NOW(),
            `intentos_fallidos` = 0 
        WHERE `id` = :id
    ");
    $updateStmt->execute([':id' => $user['id']]);

    // Registrar log de acceso exitoso
    logAuth('login_exitoso', "Inicio de sesión exitoso para usuario: {$user['login']} (Rol: " . ($user['rol'] ?? 'asistente') . ")", ['login' => $user['login'], 'rol' => $user['rol'] ?? 'asistente'], true, (int)$user['id']);

    // Generar token de sesión (32 bytes aleatorios en hexadecimal)
    $sessionToken = bin2hex(random_bytes(32));

    sendJsonResponse([
        'success' => true,
        'message' => 'Inicio de sesión exitoso.',
        'user'    => [
            'id'                => (int)$user['id'],
            'login'             => $user['login'],
            'email'             => $user['email'],
            'rol'               => $user['rol'] ?? 'asistente',
            'bloqueado'         => 0,
            'intentos_fallidos' => 0
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

