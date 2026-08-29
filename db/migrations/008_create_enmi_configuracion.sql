-- =====================================================================
-- MIGRACIÓN 008: Creación de la tabla de configuración de la web (enmi_configuracion)
-- Almacena parámetros clave-valor de texto para configuración dinámica
-- =====================================================================

CREATE TABLE IF NOT EXISTS `enmi_configuracion` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `clave` VARCHAR(100) NOT NULL COMMENT 'Identificador único del parámetro de configuración',
  `valor` TEXT DEFAULT NULL COMMENT 'Valor del parámetro almacenado como texto',
  `descripcion` VARCHAR(255) DEFAULT NULL COMMENT 'Descripción explicativa del propósito del parámetro',
  `fecha_creacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha de creación del registro',
  `fecha_actualizacion` DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha de última modificación',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_enmi_configuracion_clave` (`clave`),
  INDEX `idx_enmi_configuracion_clave` (`clave`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Inserción de valores de configuración iniciales
-- ---------------------------------------------------------------------
INSERT INTO `enmi_configuracion` (`clave`, `valor`, `descripcion`, `fecha_creacion`)
VALUES
  ('mantenimiento', '1', 'Modo mantenimiento de la web (1: activado / formulario cerrado, 0: desactivado / abierto)', NOW()),
  ('smtp_host', 'eutikea-com.correoseguro.dinaserver.com', 'Servidor de correo saliente SMTP', NOW()),
  ('smtp_port', '465', 'Puerto del servidor SMTP (465 SSL / 587 TLS)', NOW()),
  ('smtp_secure', 'ssl', 'Protocolo de seguridad de transporte SMTP (ssl / tls)', NOW()),
  ('smtp_auth', '1', 'Requiere autenticación SMTP (1: sí, 0: no)', NOW()),
  ('smtp_user', 'enmi@eutikea.com', 'Usuario / buzón de la cuenta de correo SMTP', NOW()),
  ('smtp_pass', 'enmI.2702$Tk', 'Contraseña de la cuenta de correo SMTP', NOW()),
  ('smtp_from_email', 'enmi@eutikea.com', 'Dirección de correo remitente predeterminada', NOW()),
  ('smtp_from_name', 'Eutikea - ENMI', 'Nombre legible mostrado del remitente', NOW()),
  ('notification_emails', 'enmi@eutikea.com', 'Direcciones de correo para notificaciones de inscripción (separadas por comas)', NOW())
ON DUPLICATE KEY UPDATE
  `valor` = VALUES(`valor`),
  `descripcion` = VALUES(`descripcion`);
