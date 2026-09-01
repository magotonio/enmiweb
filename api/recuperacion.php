<?php
/**
 * Endpoint de Recuperación y Restablecimiento de Contraseñas (Tokens)
 * Métodos: POST
 * Acciones:
 *  - 'solicitar': Usuario solicita enlace de recuperación desde el Login
 *  - 'verificar': Comprueba si un token de reseteo es válido y no ha caducado
 *  - 'resetear': Establece una nueva contraseña utilizando el token
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/mailer.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJsonResponse([
        'success' => false,
        'message' => 'Método no permitido. Utilice POST.'
    ], 405);
}

$inputRaw = file_get_contents('php://input');
$data = json_decode($inputRaw, true);

if (!is_array($data)) {
    sendJsonResponse([
        'success' => false,
        'message' => 'Cuerpo de la petición inválido. Formato JSON requerido.'
    ], 400);
}

$action = isset($data['action']) ? trim((string)$data['action']) : 'solicitar';
$pdo = getDbConnection();

// ---------------------------------------------------------------------
// 1. ACCIÓN: SOLICITAR RECUPERACIÓN (Público desde Login)
// ---------------------------------------------------------------------
if ($action === 'solicitar') {
    $emailInput = isset($data['email']) ? trim((string)$data['email']) : '';

    if (empty($emailInput)) {
        sendJsonResponse([
            'success' => false,
            'message' => 'Debe introducir su correo electrónico o usuario.'
        ], 400);
    }

    // Respuesta genérica estándar para prevenir enumeración de usuarios
    $genericResponse = [
        'success' => true,
        'message' => 'Si los datos introducidos corresponden a una cuenta registrada, se ha enviado un enlace seguro para restablecer su contraseña.'
    ];

    try {
        // Buscar usuario por email o login
        $stmt = $pdo->prepare("
            SELECT id, login, email, bloqueado 
            FROM `enmi_usuarios` 
            WHERE email = :email_direct OR login = :login_direct 
            LIMIT 1
        ");
        $stmt->execute([
            ':email_direct' => $emailInput,
            ':login_direct' => $emailInput
        ]);
        $user = $stmt->fetch();

        if (!$user) {
            logAuth('reset_solicitud_desconocida', "Solicitud de restablecimiento para usuario no existente", ['input' => $emailInput], false);
            // Responder éxito aparente por seguridad
            sendJsonResponse($genericResponse, 200);
        }

        // Obtener tiempo de expiración desde enmi_configuracion (predeterminado: 24 horas)
        $expHoursRaw = getConfigValue('token_resetpwd_expiracion_horas', '24', $pdo);
        $expHours = max(1, (int)$expHoursRaw);

        // Generar token criptográficamente seguro Base62 (32 caracteres)
        $token = generateSecureTokenBase62(32);
        $userId = (int)$user['id'];
        $userEmail = (string)$user['email'];
        $userLogin = (string)$user['login'];

        // Guardar token en tabla enmi_tokens
        $insertStmt = $pdo->prepare("
            INSERT INTO `enmi_tokens` (
                `token`, 
                `tipo`, 
                `valor`, 
                `fecha_caducidad`, 
                `descripcion`, 
                `utilizado`, 
                `fecha_creacion`
            ) VALUES (
                :token, 
                'resetpwd', 
                :valor, 
                DATE_ADD(NOW(), INTERVAL :horas HOUR), 
                :descripcion, 
                0, 
                NOW()
            )
        ");

        $insertStmt->execute([
            ':token'       => $token,
            ':valor'       => (string)$userId,
            ':horas'       => $expHours,
            ':descripcion' => "Recuperación de contraseña solicitada por usuario: {$userLogin} ({$userEmail})"
        ]);

        // Enviar email al usuario
        $mailResult = sendPasswordResetEmail($userEmail, $userLogin, $token, $expHours);

        logAuth('reset_solicitud_exitosa', "Token de recuperación generado y enviado para {$userLogin}", [
            'user_id'      => $userId,
            'email'        => $userEmail,
            'exp_horas'    => $expHours,
            'email_status' => $mailResult['success'] ? 'enviado' : 'fallido'
        ], true, $userId);

        sendJsonResponse($genericResponse, 200);

    } catch (Exception $e) {
        logError('recuperacion', 'error_solicitar_reset', $e->getMessage(), ['input' => $emailInput]);
        sendJsonResponse([
            'success' => false,
            'message' => 'Error al procesar la solicitud de recuperación: ' . $e->getMessage()
        ], 500);
    }
}

// ---------------------------------------------------------------------
// 2. ACCIÓN: VERIFICAR TOKEN
// ---------------------------------------------------------------------
if ($action === 'verificar') {
    $token = isset($data['token']) ? trim((string)$data['token']) : '';

    if (empty($token)) {
        sendJsonResponse([
            'success' => false,
            'valido'  => false,
            'message' => 'Token de seguridad no proporcionado.'
        ], 400);
    }

    try {
        $stmt = $pdo->prepare("
            SELECT 
                t.id, 
                t.token, 
                t.tipo, 
                t.valor, 
                t.fecha_caducidad, 
                t.utilizado,
                (t.fecha_caducidad < NOW()) AS expirado,
                u.login, 
                u.email,
                u.rol
            FROM `enmi_tokens` t
            LEFT JOIN `enmi_usuarios` u ON u.id = CAST(t.valor AS UNSIGNED)
            WHERE t.token = :token AND t.tipo = 'resetpwd'
            LIMIT 1
        ");
        $stmt->execute([':token' => $token]);
        $row = $stmt->fetch();

        if (!$row) {
            sendJsonResponse([
                'success' => false,
                'valido'  => false,
                'message' => 'El enlace de restablecimiento no es válido o no existe.'
            ], 200);
        }

        if ((int)$row['utilizado'] === 1) {
            sendJsonResponse([
                'success' => false,
                'valido'  => false,
                'message' => 'Este enlace de restablecimiento ya ha sido utilizado anteriormente.'
            ], 200);
        }

        if ((int)$row['expirado'] === 1) {
            sendJsonResponse([
                'success' => false,
                'valido'  => false,
                'message' => 'El enlace de restablecimiento ha caducado (su validez máxima es de 24 horas). Por favor, solicita uno nuevo.'
            ], 200);
        }

        sendJsonResponse([
            'success' => true,
            'valido'  => true,
            'login'   => $row['login'] ?? '',
            'email'   => $row['email'] ?? '',
            'message' => 'Token válido y activo.'
        ], 200);

    } catch (PDOException $e) {
        logError('recuperacion', 'error_verificar_token', $e->getMessage(), ['token' => $token]);
        sendJsonResponse([
            'success' => false,
            'valido'  => false,
            'message' => 'Error al validar el token de seguridad.'
        ], 500);
    }
}

// ---------------------------------------------------------------------
// 3. ACCIÓN: RESETEAR CONTRASEÑA
// ---------------------------------------------------------------------
if ($action === 'resetear') {
    $token       = isset($data['token']) ? trim((string)$data['token']) : '';
    $newPassword = isset($data['password']) ? (string)$data['password'] : '';

    if (empty($token)) {
        sendJsonResponse([
            'success' => false,
            'message' => 'Token de restablecimiento no especificado.'
        ], 400);
    }

    if (empty($newPassword) || strlen($newPassword) < 6) {
        sendJsonResponse([
            'success' => false,
            'message' => 'La nueva contraseña debe tener al menos 6 caracteres.'
        ], 400);
    }

    try {
        // Verificar token y obtener usuario
        $stmt = $pdo->prepare("
            SELECT 
                t.id AS token_id, 
                t.valor AS user_id, 
                t.utilizado,
                (t.fecha_caducidad < NOW()) AS expirado,
                u.id AS usuario_valido_id,
                u.login,
                u.email
            FROM `enmi_tokens` t
            INNER JOIN `enmi_usuarios` u ON u.id = CAST(t.valor AS UNSIGNED)
            WHERE t.token = :token AND t.tipo = 'resetpwd'
            LIMIT 1
        ");
        $stmt->execute([':token' => $token]);
        $row = $stmt->fetch();

        if (!$row) {
            sendJsonResponse([
                'success' => false,
                'message' => 'El token no es válido o el usuario asociado no existe.'
            ], 400);
        }

        if ((int)$row['utilizado'] === 1) {
            sendJsonResponse([
                'success' => false,
                'message' => 'Este enlace ya fue utilizado. Por favor, solicita uno nuevo.'
            ], 400);
        }

        if ((int)$row['expirado'] === 1) {
            sendJsonResponse([
                'success' => false,
                'message' => 'El enlace ha caducado. Por favor, solicita un nuevo enlace de recuperación.'
            ], 400);
        }

        $userId = (int)$row['usuario_valido_id'];
        $tokenId = (int)$row['token_id'];
        $newHash = password_hash($newPassword, PASSWORD_BCRYPT);

        // Transacción para actualizar contraseña y marcar token
        $pdo->beginTransaction();

        // 1. Actualizar contraseña de usuario y desbloquear cuenta
        $updateUserStmt = $pdo->prepare("
            UPDATE `enmi_usuarios`
            SET `password_hash` = :hash,
                `bloqueado` = 0,
                `intentos_fallidos` = 0,
                `fecha_actualizacion` = NOW()
            WHERE `id` = :id
        ");
        $updateUserStmt->execute([
            ':hash' => $newHash,
            ':id'   => $userId
        ]);

        // 2. Marcar token actual como utilizado
        $updateTokenStmt = $pdo->prepare("
            UPDATE `enmi_tokens`
            SET `utilizado` = 1,
                `fecha_uso` = NOW()
            WHERE `id` = :id
        ");
        $updateTokenStmt->execute([':id' => $tokenId]);

        // 3. Invalidar cualquier otro token de reseteo previo de este usuario
        $invalidateOthers = $pdo->prepare("
            UPDATE `enmi_tokens`
            SET `utilizado` = 1
            WHERE `tipo` = 'resetpwd' 
              AND `valor` = :valor_str 
              AND `id` != :current_id
              AND `utilizado` = 0
        ");
        $invalidateOthers->execute([
            ':valor_str'   => (string)$userId,
            ':current_id'  => $tokenId
        ]);

        $pdo->commit();

        logAuth('password_cambiado_por_token', "Contraseña restablecida exitosamente mediante token para '{$row['login']}'", [
            'user_id'  => $userId,
            'token_id' => $tokenId
        ], true, $userId);

        sendJsonResponse([
            'success' => true,
            'message' => 'Tu contraseña ha sido restablecida exitosamente. Ya puedes iniciar sesión con tu nueva clave.'
        ], 200);

    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        logError('recuperacion', 'error_ejecutar_reset', $e->getMessage(), ['token' => $token]);
        sendJsonResponse([
            'success' => false,
            'message' => 'Error al actualizar la contraseña: ' . $e->getMessage()
        ], 500);
    }
}

sendJsonResponse([
    'success' => false,
    'message' => 'Acción no reconocida en el servicio de recuperación.'
], 400);
