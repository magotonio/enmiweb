-- =====================================================================
-- MIGRACIÓN 003: Creación de tabla para recuperación de contraseñas
-- Tabla: enmi_recuperacion_passwords
-- Motor: MariaDB / MySQL
-- =====================================================================

CREATE TABLE IF NOT EXISTS `enmi_recuperacion_passwords` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `usuario_id` INT UNSIGNED NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `token_hash` VARCHAR(64) NOT NULL COMMENT 'Hash SHA-256 del token seguro enviado por email',
  `expira_en` DATETIME NOT NULL COMMENT 'Fecha y hora de expiración del enlace (ej. 30 o 60 min)',
  `utilizado` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '0: Pendiente / No utilizado, 1: Ya utilizado',
  `ip_solicitud` VARCHAR(45) DEFAULT NULL COMMENT 'Dirección IP desde la que se solicitó el restablecimiento',
  `fecha_creacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_utilizacion` DATETIME DEFAULT NULL COMMENT 'Fecha y hora en que se canjeó el token',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_enmi_recuperacion_token` (`token_hash`),
  INDEX `idx_enmi_recuperacion_usuario` (`usuario_id`),
  INDEX `idx_enmi_recuperacion_email` (`email`),
  INDEX `idx_enmi_recuperacion_expira` (`expira_en`),
  CONSTRAINT `fk_enmi_recuperacion_usuario` 
    FOREIGN KEY (`usuario_id`) 
    REFERENCES `enmi_usuarios` (`id`) 
    ON DELETE CASCADE 
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
