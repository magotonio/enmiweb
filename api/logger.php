<?php
/**
 * Servicio Centralizado de Logs y Auditoría del Sistema ENMI
 * Registra eventos, errores, notificaciones, accesos y operaciones críticas en la tabla `enmi_logs`.
 * Soporta filtrado por niveles de severidad según la configuración (LOG_LEVEL).
 */

require_once __DIR__ . '/config.php';

/**
 * Mapa estándar de niveles de severidad y sus pesos numéricos (RFC 5424 / PSR-3).
 */
const LOG_SEVERITY_LEVELS = [
    'DEBUG'     => 100,
    'INFO'      => 200,
    'NOTICE'    => 250,
    'WARNING'   => 300,
    'ERROR'     => 400,
    'CRITICAL'  => 500,
    'ALERT'     => 550,
    'EMERGENCY' => 600,
];

/**
 * Comprueba si un evento con el nivel indicado debe ser registrado según el umbral mínimo configurado.
 *
 * @param string $nivel Nivel del evento a evaluar (ej: DEBUG, INFO, WARNING, ERROR)
 * @return bool True si debe registrarse, False si se descarta por nivel bajo
 */
function shouldLog(string $nivel): bool {
    $minLevel = getLogLevel();
    $minWeight = LOG_SEVERITY_LEVELS[$minLevel] ?? LOG_SEVERITY_LEVELS['INFO'];
    $eventWeight = LOG_SEVERITY_LEVELS[strtoupper(trim($nivel))] ?? LOG_SEVERITY_LEVELS['INFO'];

    return $eventWeight >= $minWeight;
}

/**
 * Registra un evento de log en la base de datos `enmi_logs`.
 * Si el nivel está por debajo del umbral de configuración, se descarta silenciosamente.
 * No arroja excepciones fatales para no interrumpir el flujo principal si la BD fallara.
 *
 * @param string      $nivel      Nivel de severidad (DEBUG, INFO, NOTICE, WARNING, ERROR, CRITICAL, ALERT, EMERGENCY)
 * @param string      $categoria  Categoría (auth, inscripciones, email, api, bd, seguridad, sistema, general)
 * @param string      $accion     Identificador de la acción (ej: login_ok, login_fail, email_enviado, error_sql)
 * @param string      $mensaje    Descripción detallada del evento o error
 * @param array|null  $contexto   Datos complementarios, payloads, stack traces o metadata
 * @param int|null    $usuarioId  ID del usuario autenticado relacionado (opcional)
 * @param string|null $origen     Fichero o endpoint de origen (opcional, se auto-detecta si es null)
 * @return bool True si se procesó (o filtró) correctamente, False en caso de error de guardado
 */
function logEvent(
    string $nivel,
    string $categoria,
    string $accion,
    string $mensaje,
    ?array $contexto = null,
    ?int $usuarioId = null,
    ?string $origen = null
): bool {
    $nivel = strtoupper(trim($nivel));

    // Descartar si está por debajo del nivel mínimo configurado
    if (!shouldLog($nivel)) {
        return true;
    }

    $categoria = strtolower(trim($categoria));
    $accion = strtolower(trim($accion));
    $ip = getClientIp();
    $userAgent = !empty($_SERVER['HTTP_USER_AGENT']) ? substr((string)$_SERVER['HTTP_USER_AGENT'], 0, 255) : null;

    if ($origen === null) {
        $origen = !empty($_SERVER['SCRIPT_NAME']) ? basename((string)$_SERVER['SCRIPT_NAME']) : null;
    }

    $contextoJson = null;
    if ($contexto !== null && !empty($contexto)) {
        $contextoJson = json_encode($contexto, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    try {
        $pdo = getDbConnection();
        $stmt = $pdo->prepare("
            INSERT INTO `enmi_logs` 
                (`nivel`, `categoria`, `accion`, `mensaje`, `contexto`, `usuario_id`, `ip`, `user_agent`, `origen`, `fecha_creacion`) 
            VALUES 
                (:nivel, :categoria, :accion, :mensaje, :contexto, :usuario_id, :ip, :user_agent, :origen, NOW())
        ");

        return $stmt->execute([
            ':nivel'      => $nivel,
            ':categoria'  => $categoria,
            ':accion'     => $accion,
            ':mensaje'    => $mensaje,
            ':contexto'   => $contextoJson,
            ':usuario_id' => $usuarioId,
            ':ip'         => $ip,
            ':user_agent' => $userAgent,
            ':origen'     => $origen
        ]);
    } catch (Throwable $e) {
        // Fallback a log estándar de PHP si la base de datos o tabla no estuviesen disponibles
        error_log(sprintf(
            "[ENMI_LOG_FALLBACK] [%s] [%s:%s] %s | Context: %s | Error: %s",
            $nivel,
            $categoria,
            $accion,
            $mensaje,
            $contextoJson ?? '{}',
            $e->getMessage()
        ));
        return false;
    }
}

/**
 * Registra un log de nivel DEBUG.
 */
function logDebug(string $categoria, string $accion, string $mensaje, ?array $contexto = null, ?int $usuarioId = null, ?string $origen = null): bool {
    return logEvent('DEBUG', $categoria, $accion, $mensaje, $contexto, $usuarioId, $origen);
}

/**
 * Registra un log de nivel INFO.
 */
function logInfo(string $categoria, string $accion, string $mensaje, ?array $contexto = null, ?int $usuarioId = null, ?string $origen = null): bool {
    return logEvent('INFO', $categoria, $accion, $mensaje, $contexto, $usuarioId, $origen);
}

/**
 * Registra un log de nivel NOTICE.
 */
function logNotice(string $categoria, string $accion, string $mensaje, ?array $contexto = null, ?int $usuarioId = null, ?string $origen = null): bool {
    return logEvent('NOTICE', $categoria, $accion, $mensaje, $contexto, $usuarioId, $origen);
}

/**
 * Registra un log de nivel WARNING.
 */
function logWarning(string $categoria, string $accion, string $mensaje, ?array $contexto = null, ?int $usuarioId = null, ?string $origen = null): bool {
    return logEvent('WARNING', $categoria, $accion, $mensaje, $contexto, $usuarioId, $origen);
}

/**
 * Registra un log de nivel ERROR.
 */
function logError(string $categoria, string $accion, string $mensaje, ?array $contexto = null, ?int $usuarioId = null, ?string $origen = null): bool {
    return logEvent('ERROR', $categoria, $accion, $mensaje, $contexto, $usuarioId, $origen);
}

/**
 * Registra un log de nivel CRITICAL.
 */
function logCritical(string $categoria, string $accion, string $mensaje, ?array $contexto = null, ?int $usuarioId = null, ?string $origen = null): bool {
    return logEvent('CRITICAL', $categoria, $accion, $mensaje, $contexto, $usuarioId, $origen);
}

/**
 * Registra un log específico de Notificaciones / Correos (nivel INFO o ERROR).
 */
function logNotification(string $accion, string $mensaje, ?array $contexto = null, bool $exito = true, ?int $usuarioId = null): bool {
    $nivel = $exito ? 'INFO' : 'ERROR';
    return logEvent($nivel, 'email', $accion, $mensaje, $contexto, $usuarioId);
}

/**
 * Registra un log específico de Autenticación y Seguridad.
 */
function logAuth(string $accion, string $mensaje, ?array $contexto = null, bool $exito = true, ?int $usuarioId = null): bool {
    $nivel = $exito ? 'INFO' : 'WARNING';
    return logEvent($nivel, 'auth', $accion, $mensaje, $contexto, $usuarioId);
}
