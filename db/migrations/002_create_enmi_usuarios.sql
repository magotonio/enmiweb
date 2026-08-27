-- =====================================================================
-- MIGRACIÓN 002: Creación de la tabla de usuarios (enmi_usuarios)
-- Motor: MariaDB / MySQL
-- =====================================================================

CREATE TABLE IF NOT EXISTS `enmi_usuarios` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `login` VARCHAR(50) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL COMMENT 'Hash de contraseña encriptada (ej. BCRYPT/Argon2)',
  `ultimo_login` DATETIME DEFAULT NULL COMMENT 'Fecha y hora del último acceso exitoso',
  `bloqueado` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '0: Activo / No bloqueado, 1: Bloqueado',
  `fecha_creacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_actualizacion` DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_enmi_usuarios_login` (`login`),
  UNIQUE KEY `uq_enmi_usuarios_email` (`email`),
  INDEX `idx_enmi_usuarios_bloqueado` (`bloqueado`),
  INDEX `idx_enmi_usuarios_ultimo_login` (`ultimo_login`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
