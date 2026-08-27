<?php
/**
 * Configuración y conexión a Base de Datos (MariaDB / MySQL)
 * Compatible con Docker en local y Hosting Privado (Dinahosting)
 */

// Configuración de cabeceras CORS y JSON
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

// Responder inmediatamente a peticiones preflight OPTIONS
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit();
}

/**
 * Obtiene la conexión PDO a la base de datos MariaDB.
 * Prioridad de configuración:
 *  1. Archivo de producción no versionado: api/config.env.php (PRO)
 *  2. Archivo de entorno local: api/config.env.local.php (LOCAL)
 *  3. Variables de entorno del sistema / Docker: getenv()
 *  4. Valores por defecto para desarrollo
 * 
 * @return PDO
 */
function getDbConnection(): PDO {
    // 1. Cargar archivo de configuración según entorno (PRO > LOCAL)
    $customConfig = [];
    if (file_exists(__DIR__ . '/config.env.php')) {
        $loaded = require __DIR__ . '/config.env.php';
        if (is_array($loaded)) {
            $customConfig = $loaded;
        }
    } elseif (file_exists(__DIR__ . '/config.env.local.php')) {
        $loaded = require __DIR__ . '/config.env.local.php';
        if (is_array($loaded)) {
            $customConfig = $loaded;
        }
    }

    // 2. Resolver parámetros con cascada de prioridad
    $host = $customConfig['DB_HOST'] ?? getenv('DB_HOST') ?: '127.0.0.1';
    $port = $customConfig['DB_PORT'] ?? getenv('DB_PORT') ?: '3306';
    $db   = $customConfig['DB_NAME'] ?? getenv('DB_NAME') ?: 'enmi_db';
    $user = $customConfig['DB_USER'] ?? getenv('DB_USER') ?: 'enmi_user';
    $pass = $customConfig['DB_PASS'] ?? (getenv('DB_PASS') !== false ? getenv('DB_PASS') : 'enmi_password');

    $dsn = "mysql:host={$host};port={$port};dbname={$db};charset=utf8mb4";

    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
        PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci"
    ];

    try {
        return new PDO($dsn, $user, $pass, $options);
    } catch (PDOException $e) {
        sendJsonResponse([
            'success' => false,
            'message' => 'Error de conexión con la base de datos: ' . $e->getMessage()
        ], 500);
        exit();
    }
}

/**
 * Devuelve una respuesta JSON estandarizada y finaliza la ejecución.
 * 
 * @param array $data Datos a serializar en JSON
 * @param int $statusCode Código de estado HTTP (200, 201, 400, 500, etc.)
 */
function sendJsonResponse(array $data, int $statusCode = 200): void {
    http_response_code($statusCode);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit();
}

/**
 * Obtiene la dirección IP real del cliente.
 * 
 * @return string|null
 */
function getClientIp(): ?string {
    if (!empty($_SERVER['HTTP_CLIENT_IP'])) {
        return $_SERVER['HTTP_CLIENT_IP'];
    } elseif (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        // En caso de múltiples IPs detrás de proxies, tomar la primera
        $ips = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
        return trim($ips[0]);
    }
    return $_SERVER['REMOTE_ADDR'] ?? null;
}
