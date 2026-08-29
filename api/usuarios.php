<?php
/**
 * Endpoint de Gestión de Usuarios y Roles (Panel de Administración)
 * Nivel de Seguridad: Exclusivo para Superadministrador
 * Métodos: GET (Listar), POST (Crear, Actualizar Rol, Bloquear/Desbloquear, Restablecer Contraseña)
 */

require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

$pdo = getDbConnection();

// Función auxiliar para verificar si el usuario que ejecuta la acción es superadministrador
function verifySuperAdminPermission(PDO $pdo, ?int $operatorId, ?string $operatorLogin): bool {
    if (!$operatorId && empty($operatorLogin)) {
        return false;
    }

    try {
        if ($operatorId) {
            $stmt = $pdo->prepare("SELECT rol, bloqueado FROM `enmi_usuarios` WHERE id = :id LIMIT 1");
            $stmt->execute([':id' => $operatorId]);
        } else {
            $stmt = $pdo->prepare("SELECT rol, bloqueado FROM `enmi_usuarios` WHERE login = :login LIMIT 1");
            $stmt->execute([':login' => $operatorLogin]);
        }

        $user = $stmt->fetch();
        if (!$user) return false;
        if ((int)$user['bloqueado'] === 1) return false;
        return ($user['rol'] === 'superadministrador');
    } catch (PDOException $e) {
        return false;
    }
}

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
    $operatorId = isset($data['operator_id']) ? (int)$data['operator_id'] : null;
    $operatorLogin = isset($data['operator_login']) ? trim((string)$data['operator_login']) : null;

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
        if (empty($password) || strlen($password) < 6) {
            $errors['password'] = 'La contraseña debe tener al menos 6 caracteres.';
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

            logAuth('usuario_creado', "Nuevo usuario creado: {$login} con rol '{$rol}'", [
                'id'    => $newId,
                'login' => $login,
                'email' => $email,
                'rol'   => $rol
            ], true, $newId);

            sendJsonResponse([
                'success' => true,
                'message' => "Usuario '{$login}' creado exitosamente con perfil '{$rol}'.",
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

    // D) RESTABLECER CONTRASEÑA
    if ($action === 'reset_password') {
        $targetId    = isset($data['id']) ? (int)$data['id'] : 0;
        $newPassword = isset($data['new_password']) ? (string)$data['new_password'] : '';

        if ($targetId <= 0 || strlen($newPassword) < 6) {
            sendJsonResponse([
                'success' => false,
                'message' => 'La nueva contraseña debe tener al menos 6 caracteres.'
            ], 400);
        }

        try {
            $newHash = password_hash($newPassword, PASSWORD_BCRYPT);
            $stmt = $pdo->prepare("
                UPDATE `enmi_usuarios` 
                SET `password_hash` = :hash,
                    `bloqueado` = 0,
                    `intentos_fallidos` = 0
                WHERE `id` = :id
            ");
            $stmt->execute([':hash' => $newHash, ':id' => $targetId]);

            logAuth('password_restablecido', "Contraseña restablecida para usuario ID {$targetId}", [
                'target_id' => $targetId
            ], true, $targetId);

            sendJsonResponse([
                'success' => true,
                'message' => 'Contraseña del usuario restablecida exitosamente.'
            ], 200);

        } catch (PDOException $e) {
            logError('usuarios', 'error_reset_password', $e->getMessage(), ['target_id' => $targetId]);
            sendJsonResponse([
                'success' => false,
                'message' => 'Error al restablecer la contraseña: ' . $e->getMessage()
            ], 500);
        }
    }

    sendJsonResponse([
        'success' => false,
        'message' => 'Acción solicitada no reconocida.'
    ], 400);
}
