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
 * Carga el array de configuración del archivo de entorno correspondiente (PRO > LOCAL).
 * 
 * @return array
 */
function getAppConfig(): array {
    static $config = null;
    if ($config !== null) {
        return $config;
    }

    $config = [];
    if (file_exists(__DIR__ . '/config.env.php')) {
        $loaded = require __DIR__ . '/config.env.php';
        if (is_array($loaded)) {
            $config = $loaded;
        }
    } elseif (file_exists(__DIR__ . '/config.env.local.php')) {
        $loaded = require __DIR__ . '/config.env.local.php';
        if (is_array($loaded)) {
            $config = $loaded;
        }
    }

    return $config;
}

/**
 * Obtiene la URL base de la aplicación web según el entorno (PRO o LOCAL).
 * Prioridad de configuración:
 *  1. Archivo de producción: api/config.env.php (PRO)
 *  2. Archivo de entorno local: api/config.env.local.php (LOCAL)
 *  3. Variables de entorno: getenv('APP_URL')
 *  4. Valor por defecto de producción
 * 
 * @return string
 */
function getAppUrl(): string {
    $customConfig = getAppConfig();
    return (string)($customConfig['APP_URL'] ?? getenv('APP_URL') ?: 'https://enmi.eutikea.com');
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
    $customConfig = getAppConfig();

    // Resolver parámetros con cascada de prioridad
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
 * Obtiene los parámetros de configuración para el envío de correos electrónicos vía SMTP.
 * Prioridad de configuración:
 *  1. Archivo de producción: api/config.env.php (PRO)
 *  2. Archivo de entorno local: api/config.env.local.php (LOCAL)
 *  3. Variables de entorno: getenv()
 *  4. Valores predeterminados estándar de Dinahosting
 * 
 * @return array
 */
function getSmtpConfig(): array {
    $customConfig = getAppConfig();

    return [
        'host'                => (string)($customConfig['SMTP_HOST'] ?? getenv('SMTP_HOST') ?: 'eutikea-com.correoseguro.dinaserver.com'),
        'port'                => (int)($customConfig['SMTP_PORT'] ?? getenv('SMTP_PORT') ?: 465),
        'secure'              => (string)($customConfig['SMTP_SECURE'] ?? getenv('SMTP_SECURE') ?: 'ssl'),
        'auth'                => (bool)($customConfig['SMTP_AUTH'] ?? (getenv('SMTP_AUTH') !== false ? filter_var(getenv('SMTP_AUTH'), FILTER_VALIDATE_BOOLEAN) : true)),
        'user'                => (string)($customConfig['SMTP_USER'] ?? getenv('SMTP_USER') ?: 'enmi@eutikea'),
        'pass'                => (string)($customConfig['SMTP_PASS'] ?? (getenv('SMTP_PASS') !== false ? getenv('SMTP_PASS') : 'enmI.2702$Tk')),
        'from_email'          => (string)($customConfig['SMTP_FROM_EMAIL'] ?? getenv('SMTP_FROM_EMAIL') ?: 'enmi@eutikea'),
        'from_name'           => (string)($customConfig['SMTP_FROM_NAME'] ?? getenv('SMTP_FROM_NAME') ?: 'Eutikea - ENMI'),
        'notification_emails' => getNotificationEmails(),
    ];
}

/**
 * Obtiene el listado de direcciones de correo electrónico para notificaciones.
 * Prioridad de configuración:
 *  1. Archivo de producción: api/config.env.php (PRO)
 *  2. Archivo de entorno local: api/config.env.local.php (LOCAL)
 *  3. Variables de entorno: getenv('NOTIFICATION_EMAILS') (array o string separado por comas)
 *  4. Valores por defecto
 * 
 * @return array
 */
function getNotificationEmails(): array {
    $customConfig = getAppConfig();

    if (isset($customConfig['NOTIFICATION_EMAILS'])) {
        $emails = $customConfig['NOTIFICATION_EMAILS'];
        if (is_array($emails)) {
            return array_values(array_filter(array_map('trim', $emails)));
        }
        if (is_string($emails)) {
            return array_values(array_filter(array_map('trim', explode(',', $emails))));
        }
    }

    $envEmails = getenv('NOTIFICATION_EMAILS');
    if ($envEmails !== false && trim($envEmails) !== '') {
        return array_values(array_filter(array_map('trim', explode(',', $envEmails))));
    }

    return [
        'enmi@eutikea.com'
    ];
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

/**
 * Obtiene el nivel mínimo de severidad para el registro de logs (ej: DEBUG, INFO, WARNING, ERROR).
 * Prioridad:
 *  1. Variable de entorno del sistema / Docker: getenv('LOG_LEVEL')
 *  2. Archivo de configuración: config.env.php / config.env.local.php
 *  3. 'INFO' por defecto
 *
 * @return string
 */
function getLogLevel(): string {
    $envLevel = getenv('LOG_LEVEL');
    if ($envLevel !== false && trim($envLevel) !== '') {
        return strtoupper(trim($envLevel));
    }
    $customConfig = getAppConfig();
    return strtoupper((string)($customConfig['LOG_LEVEL'] ?? 'INFO'));
}

/**
 * Determina si el entorno permite mostrar detalles técnicos del error al cliente en la respuesta JSON.
 * Activo en desarrollo (LOCAL), desactivado en producción (PRO).
 * Prioridad:
 *  1. Variable de entorno del sistema / Docker: getenv('SHOW_ERROR_DETAILS')
 *  2. Archivo de configuración: config.env.php / config.env.local.php
 *  3. false por defecto
 *
 * @return bool
 */
function shouldShowErrorDetails(): bool {
    $envVal = getenv('SHOW_ERROR_DETAILS');
    if ($envVal !== false && trim((string)$envVal) !== '') {
        return filter_var($envVal, FILTER_VALIDATE_BOOLEAN);
    }
    $customConfig = getAppConfig();
    if (isset($customConfig['SHOW_ERROR_DETAILS'])) {
        return (bool)$customConfig['SHOW_ERROR_DETAILS'];
    }
    return false;
}

// Cargar servicio centralizado de logs y auditoría
require_once __DIR__ . '/logger.php';

/**
 * Manejador global de excepciones no capturadas.
 * Registra automáticamente el error en la tabla enmi_logs y devuelve una respuesta JSON limpia (500).
 */
function globalExceptionHandler(Throwable $exception): void {
    $mensaje = $exception->getMessage();
    $archivo = $exception->getFile();
    $linea = $exception->getLine();
    $traza = $exception->getTraceAsString();

    $contexto = [
        'exception_class' => get_class($exception),
        'file'            => $archivo,
        'line'            => $linea,
        'trace'           => $traza,
        'method'          => $_SERVER['REQUEST_METHOD'] ?? 'UNKNOWN',
        'uri'             => $_SERVER['REQUEST_URI'] ?? '',
        'query'           => $_GET ?? []
    ];

    if (function_exists('logError')) {
        logError('api_error', 'unhandled_exception', "Excepción no capturada: {$mensaje}", $contexto);
    }

    $response = [
        'success' => false,
        'message' => 'Error interno en el servidor.'
    ];

    if (shouldShowErrorDetails()) {
        $response['debug'] = [
            'error'     => $mensaje,
            'exception' => get_class($exception),
            'file'      => $archivo,
            'line'      => $linea
        ];
    }

    sendJsonResponse($response, 500);
}

/**
 * Manejador global de errores estándar de PHP (E_WARNING, E_NOTICE, etc.).
 */
function globalErrorHandler(int $errno, string $errstr, string $errfile, int $errline): bool {
    if (!(error_reporting() & $errno)) {
        return false;
    }

    $nivel = match ($errno) {
        E_USER_ERROR, E_RECOVERABLE_ERROR => 'ERROR',
        E_WARNING, E_USER_WARNING         => 'WARNING',
        E_NOTICE, E_USER_NOTICE           => 'NOTICE',
        E_DEPRECATED, E_USER_DEPRECATED   => 'DEBUG',
        default                           => 'WARNING'
    };

    if (function_exists('logEvent')) {
        logEvent($nivel, 'php_runtime', 'runtime_warning', "PHP [{$errno}]: {$errstr}", [
            'errno' => $errno,
            'file'  => $errfile,
            'line'  => $errline,
            'uri'   => $_SERVER['REQUEST_URI'] ?? ''
        ]);
    }

    if ($errno === E_USER_ERROR || $errno === E_RECOVERABLE_ERROR) {
        $response = [
            'success' => false,
            'message' => 'Error de ejecución en el servidor.'
        ];
        if (shouldShowErrorDetails()) {
            $response['debug'] = [
                'error' => $errstr,
                'file'  => $errfile,
                'line'  => $errline
            ];
        }
        sendJsonResponse($response, 500);
    }

    return false;
}

/**
 * Manejador de apagado (shutdown) para capturar errores fatales de PHP (ej: E_ERROR, E_PARSE).
 */
function globalShutdownHandler(): void {
    $error = error_get_last();
    if ($error !== null && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        if (function_exists('logError')) {
            logError('php_fatal', 'fatal_error', "Error fatal de PHP: {$error['message']}", [
                'type' => $error['type'],
                'file' => $error['file'],
                'line' => $error['line'],
                'uri'  => $_SERVER['REQUEST_URI'] ?? ''
            ]);
        }

        if (!headers_sent()) {
            http_response_code(500);
            header('Content-Type: application/json; charset=UTF-8');
            $response = [
                'success' => false,
                'message' => 'Error fatal del servidor.'
            ];
            if (shouldShowErrorDetails()) {
                $response['debug'] = [
                    'error' => $error['message'],
                    'file'  => $error['file'],
                    'line'  => $error['line']
                ];
            }
            echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }
    }
}

// Registrar manejadores globales para control integral de errores en la API
set_exception_handler('globalExceptionHandler');
set_error_handler('globalErrorHandler');
register_shutdown_function('globalShutdownHandler');


