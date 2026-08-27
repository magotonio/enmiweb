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
    // Base de Datos MariaDB / MySQL
    'DB_HOST' => 'db',              // Nombre del servicio MariaDB en Docker Compose
    'DB_PORT' => '3306',            // Puerto estándar de MariaDB/MySQL
    'DB_NAME' => 'enmi_db',          // Nombre de la base de datos
    'DB_USER' => 'enmi_user',        // Usuario de base de datos
    'DB_PASS' => 'enmi_password',    // Contraseña de base de datos

    // Envío de Correos Electrónicos (SMTP - Local / Pruebas)
    'SMTP_HOST'       => 'localhost',
    'SMTP_PORT'       => 1025,                              // Puerto típico para simuladores locales (ej. Mailpit / Mailhog) o 465/587
    'SMTP_SECURE'     => '',                                // '', 'ssl' o 'tls'
    'SMTP_AUTH'       => false,
    'SMTP_USER'       => '',
    'SMTP_PASS'       => '',
    'SMTP_FROM_EMAIL' => 'no-reply@enmi.local',
    'SMTP_FROM_NAME'  => 'ENMI (Local)',
];
