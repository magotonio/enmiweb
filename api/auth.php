<?php

function startApiSession(): void {
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    session_name('ENMISESSID');

    $https = strtolower((string)parse_url(getAppUrl(), PHP_URL_SCHEME)) === 'https'
        || (!empty($_SERVER['HTTPS']) && strtolower((string)$_SERVER['HTTPS']) !== 'off')
        || (($_SERVER['REQUEST_SCHEME'] ?? '') === 'https');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => $https,
        'httponly' => true,
        'samesite' => 'Lax'
    ]);
    session_start();

    $now = time();
    if (isset($_SESSION['last_activity']) && $now - (int)$_SESSION['last_activity'] > 1800) {
        $_SESSION = [];
        session_regenerate_id(true);
    }
    if (isset($_SESSION['created_at']) && $now - (int)$_SESSION['created_at'] > 28800) {
        $_SESSION = [];
        session_regenerate_id(true);
    }

    $_SESSION['last_activity'] = $now;
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
}

function getApiSessionUser(PDO $pdo): ?array {
    startApiSession();
    $userId = (int)($_SESSION['user_id'] ?? 0);
    if ($userId <= 0) {
        return null;
    }

    $stmt = $pdo->prepare(
        "SELECT id, login, email, rol, bloqueado, password_hash FROM `enmi_usuarios` WHERE id = :id LIMIT 1"
    );
    $stmt->execute([':id' => $userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        $_SESSION = [];
        session_regenerate_id(true);
        $_SESSION['last_activity'] = time();
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        return null;
    }

    $blocked = (int)$user['bloqueado'] === 1;
    $passwordChanged = empty($_SESSION['auth_version'])
        || !hash_equals((string)$_SESSION['auth_version'], hash('sha256', (string)$user['password_hash']));
    if ($blocked || $passwordChanged) {
        $_SESSION = [];
        session_regenerate_id(true);
        $_SESSION['last_activity'] = time();
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        if ($blocked) {
            $_SESSION['invalid_reason'] = 'blocked';
        }
        return null;
    }

    unset($user['password_hash']);
    return $user;
}

function requireApiUser(PDO $pdo, array $allowedRoles = []): array {
    $user = getApiSessionUser($pdo);
    if (!$user) {
        sendJsonResponse(['success' => false, 'message' => 'Autenticación requerida.'], 401);
    }

    if ($allowedRoles && !in_array((string)$user['rol'], $allowedRoles, true)) {
        sendJsonResponse(['success' => false, 'message' => 'No tienes permisos suficientes.'], 403);
    }

    $method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    if (in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
        requireApiCsrfToken();
    }

    return $user;
}

function bindApiSessionEnrollment(int $enrollmentId): void {
    startApiSession();
    session_regenerate_id(true);
    $_SESSION['enrollment_id'] = $enrollmentId;
    $_SESSION['last_activity'] = time();
}

function requireApiEnrollmentAccess(PDO $pdo, int $enrollmentId): ?array {
    $user = getApiSessionUser($pdo);
    if ($user) {
        if (in_array((string)$user['rol'], ['superadministrador', 'supervisor'], true)) {
            return $user;
        }

        $stmt = $pdo->prepare(
            "SELECT id FROM `enmi_inscripciones` WHERE id = :id AND LOWER(TRIM(email)) = LOWER(TRIM(:email)) LIMIT 1"
        );
        $stmt->execute([':id' => $enrollmentId, ':email' => $user['email']]);
        if ($stmt->fetch(PDO::FETCH_ASSOC)) {
            return $user;
        }
    }

    startApiSession();
    if ((int)($_SESSION['enrollment_id'] ?? 0) === $enrollmentId) {
        if ($user) {
            return $user;
        }
        return ['id' => null, 'login' => 'participante', 'email' => null, 'rol' => 'invitado'];
    }

    sendJsonResponse(['success' => false, 'message' => 'No tienes acceso a esta inscripción.'], 403);
}

function isLocalApiEnvironment(): bool {
    $environment = strtolower((string)(getAppConfig()['APP_ENV'] ?? getenv('APP_ENV') ?: ''));
    if ($environment !== '') {
        return in_array($environment, ['local', 'development', 'test'], true);
    }

    $host = strtolower((string)parse_url(getAppUrl(), PHP_URL_HOST));
    return in_array($host, ['localhost', '127.0.0.1', '::1'], true);
}

function requireApiCsrfToken(): void {
    startApiSession();
    $expected = (string)($_SESSION['csrf_token'] ?? '');
    $provided = (string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');

    if ($expected === '' || $provided === '' || !hash_equals($expected, $provided)) {
        sendJsonResponse(['success' => false, 'message' => 'Token de seguridad inválido o ausente.'], 403);
    }
}

function clearApiSession(): void {
    if (session_status() !== PHP_SESSION_ACTIVE) {
        startApiSession();
    }

    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', [
            'expires' => time() - 42000,
            'path' => $params['path'],
            'domain' => $params['domain'],
            'secure' => $params['secure'],
            'httponly' => $params['httponly'],
            'samesite' => $params['samesite'] ?? 'Lax'
        ]);
    }
    session_destroy();
}