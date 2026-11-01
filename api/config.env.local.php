<?php
/**
 * Plantilla de configuración de entorno para Base de Datos MariaDB / MySQL.
 *
 * INSTRUCCIONES:
 * 1. Copia este archivo como 'config.env.php' en esta misma carpeta (api/).
 * 2. Rellena los valores según el entorno (LOCAL o PRO).
 * 3. 'config.env.php' está en .gitignore y NUNCA se subirá al repositorio.
 */

return [
    // URL Base de la Aplicación Web (Desarrollo)
    'APP_URL' => 'http://localhost:4200',
    'APP_ENV' => 'local',

    // Base de Datos MariaDB / MySQL
    'DB_HOST' => 'db',              // Nombre del servicio MariaDB en Docker Compose
    'DB_PORT' => '3306',            // Puerto estándar de MariaDB/MySQL
    'DB_NAME' => 'enmi_db',          // Nombre de la base de datos
    'DB_USER' => 'enmi_user',        // Usuario de base de datos
    'DB_PASS' => 'enmi_password',    // Contraseña de base de datos

    // NOTA: La configuración de envío de correos (SMTP) y el modo de mantenimiento
    // se gestionan centralizadamente desde la tabla `enmi_configuracion` en la base de datos MariaDB.

    // Configuración de Logs y Auditoría
    // Niveles: DEBUG (100), INFO (200), NOTICE (250), WARNING (300), ERROR (400), CRITICAL (500)
    'LOG_LEVEL'          => 'DEBUG', // En local registramos todos los niveles desde DEBUG
    'SHOW_ERROR_DETAILS' => true,    // En local se muestran trazas de error en respuestas JSON para depuración
];
