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
    'DB_HOST' => 'mysql-8001.dinaserver.com',              // Nombre del host de MariaDB
    'DB_PORT' => '3306',                                    // Puerto estándar de MariaDB/MySQL
    'DB_NAME' => 'eutikea',                                 // Nombre de la base de datos
    'DB_USER' => 'tkadmdb',                                 // Usuario de base de datos
    'DB_PASS' => 'dB.euTik3a$5202',                         // Contraseña de base de datos

    // Envío de Correos Electrónicos (SMTP - Dinahosting)
    'SMTP_HOST'       => 'eutikea-com.correoseguro.dinaserver.com', // Servidor de correo saliente
    'SMTP_PORT'       => 465,                                      // Puerto estándar SSL/SMTPS para hosting PHP (465) o TLS (587)
    'SMTP_SECURE'     => 'ssl',                                    // Protocolo de seguridad: 'ssl' (puerto 465) o 'tls' (puerto 587)
    'SMTP_AUTH'       => true,                                     // Requiere autenticación SMTP
    'SMTP_USER'       => 'enmi@eutikea',                          // Usuario / Buzón de correo
    'SMTP_PASS'       => 'enmI.2702$Tk',                          // Contraseña del buzón de correo
    'SMTP_FROM_EMAIL' => 'enmi@eutikea',                          // Remitente predeterminado
    'SMTP_FROM_NAME'  => 'ENMI Web',                               // Nombre mostrado del remitente
];
