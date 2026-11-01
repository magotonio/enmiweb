<?php
/**
 * Endpoint de Gestión de Usuarios y Roles (Panel de Administración)
 * Nivel de Seguridad: Exclusivo para Superadministrador
 * Métodos: GET (Listar), POST (Crear, Actualizar Rol, Bloquear/Desbloquear, Restablecer Contraseña)
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/mailer.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

$pdo = getDbConnection();
requireApiUser($pdo, ['superadministrador']);

// ---------------------------------------------------------------------
// 1. GET: Listar usuarios
// ---------------------------------------------------------------------
if ($method === 'GET') {
    try {
        $stmt = $pdo->query("
            SELECT 
                id, 
                login, 
                email, 
                rol, 
                bloqueado, 
                intentos_fallidos, 
                ultimo_login, 
                fecha_creacion, 
                fecha_actualizacion 
            FROM `enmi_usuarios` 
            ORDER BY id ASC
        ");
        $users = $stmt->fetchAll();

        $formatted = array_map(function ($u) {
            return [
                'id'                  => (int)$u['id'],
                'login'               => $u['login'],
                'email'               => $u['email'],
                'rol'                 => $u['rol'] ?? 'asistente',
                'bloqueado'           => (int)$u['bloqueado'] === 1,
                'intentos_fallidos'   => (int)($u['intentos_fallidos'] ?? 0),
                'ultimo_login'        => $u['ultimo_login'],
                'fecha_creacion'      => $u['fecha_creacion'],
                'fecha_actualizacion' => $u['fecha_actualizacion']
            ];
        }, $users);

        sendJsonResponse([
            'success' => true,
            'count'   => count($formatted),
            'data'    => $formatted
        ], 200);

    } catch (PDOException $e) {
        logError('usuarios', 'error_list_usuarios', $e->getMessage());
        sendJsonResponse([
            'success' => false,
            'message' => 'Error al recuperar el listado de usuarios: ' . $e->getMessage()
        ], 500);
    }
}

// ---------------------------------------------------------------------
// 2. POST: Acciones de gestión (Crear, Cambiar Rol, Bloquear, Resetear)
// ---------------------------------------------------------------------
if ($method === 'POST') {
    $inputRaw = file_get_contents('php://input');
    $data = json_decode($inputRaw, true);

    if (!is_array($data)) {
        sendJsonResponse([
            'success' => false,
            'message' => 'Cuerpo de la petición inválido. Formato JSON requerido.'
        ], 400);
    }

    $action = isset($data['action']) ? trim((string)$data['action']) : 'create';
    // A) CREAR NUEVO USUARIO
    if ($action === 'create') {
        $login    = isset($data['login']) ? trim((string)$data['login']) : '';
        $email    = isset($data['email']) ? trim((string)$data['email']) : '';
        $rol      = isset($data['rol']) ? trim((string)$data['rol']) : 'asistente';
        $password = isset($data['password']) ? (string)$data['password'] : '';

        $allowedRoles = ['superadministrador', 'supervisor', 'asistente'];
        if (!in_array($rol, $allowedRoles, true)) {
            $rol = 'asistente';
        }

        $errors = [];
        if (empty($login) || strlen($login) < 3) {
            $errors['login'] = 'El nombre de usuario debe tener al menos 3 caracteres.';
        }
        if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $errors['email'] = 'Debe indicar un correo electrónico válido.';
        }

        if (!empty($errors)) {
            sendJsonResponse([
                'success' => false,
                'message' => 'Datos del nuevo usuario incompletos o incorrectos.',
                'errors'  => $errors
            ], 400);
        }

        try {
            // Comprobar unicidad de login y email
            $checkStmt = $pdo->prepare("SELECT id, login, email FROM `enmi_usuarios` WHERE login = :login OR email = :email LIMIT 1");
            $checkStmt->execute([':login' => $login, ':email' => $email]);
            $existing = $checkStmt->fetch();

            if ($existing) {
                $campo = ($existing['login'] === $login) ? 'nombre de usuario' : 'correo electrónico';
                sendJsonResponse([
                    'success' => false,
                    'message' => "El {$campo} ya se encuentra registrado por otra cuenta."
                ], 409);
            }

            // Si el superadmin no proporciona contraseña, se genera una aleatoria inicial y se emite token de 24h
            if (empty($password)) {
                $password = bin2hex(random_bytes(16));
            }
            $passwordHash = password_hash($password, PASSWORD_BCRYPT);

            $insertStmt = $pdo->prepare("
                INSERT INTO `enmi_usuarios` (`login`, `email`, `rol`, `password_hash`, `bloqueado`, `intentos_fallidos`, `fecha_creacion`)
                VALUES (:login, :email, :rol, :hash, 0, 0, NOW())
            ");
            $insertStmt->execute([
                ':login' => $login,
                ':email' => $email,
                ':rol'   => $rol,
                ':hash'  => $passwordHash
            ]);

            $newId = (int)$pdo->lastInsertId();

            // Generar token de 24h para que el nuevo usuario defina su contraseña
            $expHoursRaw = getConfigValue('token_resetpwd_expiracion_horas', '24', $pdo);
            $expHours = max(1, (int)$expHoursRaw);
            $token = generateSecureTokenBase62(32);

            $tokenStmt = $pdo->prepare("
                INSERT INTO `enmi_tokens` (
                    `token`, `tipo`, `valor`, `fecha_caducidad`, `descripcion`, `utilizado`, `fecha_creacion`
                ) VALUES (
                    :token, 'resetpwd', :valor, DATE_ADD(NOW(), INTERVAL :horas HOUR), :descripcion, 0, NOW()
                )
            ");
            $tokenStmt->execute([
                ':token'       => $token,
                ':valor'       => (string)$newId,
                ':horas'       => $expHours,
                ':descripcion' => "Activación de cuenta y asignación de contraseña para: {$login} ({$email})"
            ]);

            // Enviar correo de bienvenida / restablecimiento
            sendAdminPasswordResetEmail($email, $login, $token, $expHours);

            logAuth('usuario_creado', "Nuevo usuario creado: {$login} con rol '{$rol}'. Token de 24h enviado a {$email}", [
                'id'        => $newId,
                'login'     => $login,
                'email'     => $email,
                'rol'       => $rol,
                'exp_horas' => $expHours
            ], true, $newId);

            sendJsonResponse([
                'success' => true,
                'message' => "Usuario '{$login}' creado exitosamente. Se ha enviado un enlace seguro al correo '{$email}' para que defina su contraseña.",
                'user'    => [
                    'id'                => $newId,
                    'login'             => $login,
                    'email'             => $email,
                    'rol'               => $rol,
                    'bloqueado'         => false,
                    'intentos_fallidos' => 0,
                    'fecha_creacion'    => date('Y-m-d H:i:s')
                ]
            ], 201);

        } catch (PDOException $e) {
            logError('usuarios', 'error_create_usuario', $e->getMessage(), ['login' => $login, 'email' => $email]);
            sendJsonResponse([
                'success' => false,
                'message' => 'Error en base de datos al crear usuario: ' . $e->getMessage()
            ], 500);
        }
    }

    // B) ACTUALIZAR ROL DE USUARIO
    if ($action === 'update_role') {
        $targetId = isset($data['id']) ? (int)$data['id'] : 0;
        $newRol   = isset($data['rol']) ? trim((string)$data['rol']) : '';

        $allowedRoles = ['superadministrador', 'supervisor', 'asistente'];
        if (!in_array($newRol, $allowedRoles, true)) {
            sendJsonResponse([
                'success' => false,
                'message' => 'Perfil de rol no válido.'
            ], 400);
        }

        if ($targetId <= 0) {
            sendJsonResponse([
                'success' => false,
                'message' => 'Identificador de usuario objetivo no especificado.'
            ], 400);
        }

        try {
            $stmt = $pdo->prepare("UPDATE `enmi_usuarios` SET `rol` = :rol WHERE `id` = :id");
            $stmt->execute([':rol' => $newRol, ':id' => $targetId]);

            logAuth('rol_actualizado', "Rol de usuario ID {$targetId} actualizado a '{$newRol}'", [
                'target_id' => $targetId,
                'new_rol'   => $newRol
            ], true, $targetId);

            sendJsonResponse([
                'success' => true,
                'message' => "Perfil de usuario actualizado a '{$newRol}' correctamente."
            ], 200);

        } catch (PDOException $e) {
            logError('usuarios', 'error_update_rol', $e->getMessage(), ['target_id' => $targetId, 'rol' => $newRol]);
            sendJsonResponse([
                'success' => false,
                'message' => 'Error al modificar el perfil de usuario: ' . $e->getMessage()
            ], 500);
        }
    }

    // C) ALTERNAR BLOQUEO / DESBLOQUEAR USUARIO
    if ($action === 'toggle_block') {
        $targetId  = isset($data['id']) ? (int)$data['id'] : 0;
        $bloqueado = !empty($data['bloqueado']) ? 1 : 0;

        if ($targetId <= 0) {
            sendJsonResponse([
                'success' => false,
                'message' => 'Identificador de usuario no válido.'
            ], 400);
        }

        try {
            $stmt = $pdo->prepare("
                UPDATE `enmi_usuarios` 
                SET `bloqueado` = :bloqueado, 
                    `intentos_fallidos` = :intentos 
                WHERE `id` = :id
            ");
            // Si se desbloquea, resetear los intentos fallidos a 0
            $intentos = ($bloqueado === 0) ? 0 : 3;
            $stmt->execute([
                ':bloqueado' => $bloqueado,
                ':intentos'  => $intentos,
                ':id'        => $targetId
            ]);

            $estadoTexto = ($bloqueado === 1) ? 'bloqueado' : 'desbloqueado y activo';
            logAuth('bloqueo_modificado', "Estado de cuenta usuario ID {$targetId} cambiado a {$estadoTexto}", [
                'target_id' => $targetId,
                'bloqueado' => $bloqueado
            ], true, $targetId);

            sendJsonResponse([
                'success'   => true,
                'message'   => "El usuario ahora se encuentra {$estadoTexto}.",
                'bloqueado' => ($bloqueado === 1)
            ], 200);

        } catch (PDOException $e) {
            logError('usuarios', 'error_toggle_bloqueo', $e->getMessage(), ['target_id' => $targetId]);
            sendJsonResponse([
                'success' => false,
                'message' => 'Error al cambiar estado de bloqueo: ' . $e->getMessage()
            ], 500);
        }
    }

    // D) RESTABLECER CONTRASEÑA (Emisión de token de 24h y envío de correo)
    if ($action === 'reset_password') {
        $targetId = isset($data['id']) ? (int)$data['id'] : 0;

        if ($targetId <= 0) {
            sendJsonResponse([
                'success' => false,
                'message' => 'Identificador de usuario no válido.'
            ], 400);
        }

        try {
            $userStmt = $pdo->prepare("SELECT id, login, email FROM `enmi_usuarios` WHERE id = :id LIMIT 1");
            $userStmt->execute([':id' => $targetId]);
            $targetUser = $userStmt->fetch();

            if (!$targetUser) {
                sendJsonResponse([
                    'success' => false,
                    'message' => 'El usuario especificado no existe.'
                ], 404);
            }

            $userLogin = (string)$targetUser['login'];
            $userEmail = (string)$targetUser['email'];

            // Obtener tiempo de expiración (24 horas)
            $expHoursRaw = getConfigValue('token_resetpwd_expiracion_horas', '24', $pdo);
            $expHours = max(1, (int)$expHoursRaw);

            // Invalidar inmediatamente la contraseña anterior asignando un hash aleatorio de alta entropía
            $randomTemporaryPass = bin2hex(random_bytes(24));
            $randomHash = password_hash($randomTemporaryPass, PASSWORD_BCRYPT);

            $updatePassStmt = $pdo->prepare("
                UPDATE `enmi_usuarios`
                SET `password_hash` = :hash,
                    `fecha_actualizacion` = NOW()
                WHERE `id` = :id
            ");
            $updatePassStmt->execute([
                ':hash' => $randomHash,
                ':id'   => $targetId
            ]);

            // Generar token criptográficamente seguro de 24 horas
            $token = generateSecureTokenBase62(32);

            $tokenStmt = $pdo->prepare("
                INSERT INTO `enmi_tokens` (
                    `token`, `tipo`, `valor`, `fecha_caducidad`, `descripcion`, `utilizado`, `fecha_creacion`
                ) VALUES (
                    :token, 'resetpwd', :valor, DATE_ADD(NOW(), INTERVAL :horas HOUR), :descripcion, 0, NOW()
                )
            ");
            $tokenStmt->execute([
                ':token'       => $token,
                ':valor'       => (string)$targetId,
                ':horas'       => $expHours,
                ':descripcion' => "Restablecimiento administrativo solicitado por Superadmin para: {$userLogin} ({$userEmail})"
            ]);

            // Enviar email de notificación administrativa
            $mailResult = sendAdminPasswordResetEmail($userEmail, $userLogin, $token, $expHours);

            logAuth('password_reset_admin_solicitado', "Superadmin invalidó la contraseña anterior de '{$userLogin}' ({$userEmail}) y emitió token de restablecimiento de {$expHours}h", [
                'target_id'    => $targetId,
                'email'        => $userEmail,
                'exp_horas'    => $expHours,
                'email_status' => $mailResult['success'] ? 'enviado' : 'fallido'
            ], true, $targetId);

            sendJsonResponse([
                'success' => true,
                'message' => "La contraseña anterior ha sido invalidada inmediatamente y se ha enviado un enlace seguro de {$expHours} horas al correo '{$userEmail}'."
            ], 200);

        } catch (Exception $e) {
            logError('usuarios', 'error_admin_reset_password', $e->getMessage(), ['target_id' => $targetId]);
            sendJsonResponse([
                'success' => false,
                'message' => 'Error al generar el restablecimiento de contraseña: ' . $e->getMessage()
            ], 500);
        }
    }

    sendJsonResponse([
        'success' => false,
        'message' => 'Acción solicitada no reconocida.'
    ], 400);
}
