-- =====================================================================
-- ESQUEMA COMPLETO: PROYECTO ENMI
-- Motor: MariaDB (Dinahosting)
-- Juego de caracteres: utf8mb4 / Collate: utf8mb4_unicode_ci
-- Prefijo de tablas: enmi_
-- Última actualización: Versión 1.4.0 (Tabla de logs y auditoría)
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tabla 1: enmi_inscripciones
-- Registra los participantes inscritos mediante el formulario.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `enmi_inscripciones` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(100) NOT NULL,
  `apellidos` VARCHAR(150) NOT NULL,
  `estado` VARCHAR(20) NOT NULL DEFAULT 'activo',
  `ip_registro` VARCHAR(45) DEFAULT NULL,
  `fecha_creacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_actualizacion` DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_enmi_inscripciones_fecha` (`fecha_creacion`),
  INDEX `idx_enmi_inscripciones_apellidos` (`apellidos`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Tabla 2: enmi_usuarios
-- Registra los usuarios del sistema para autenticación y control de acceso.
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- Tabla 3: enmi_recuperacion_passwords
-- Gestiona los tokens seguros temporales para la recuperación de contraseñas.
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- Tabla 4: enmi_logs
-- Registra eventos, errores, notificaciones y auditoría del sistema.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `enmi_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nivel` VARCHAR(20) NOT NULL DEFAULT 'INFO' COMMENT 'Nivel de severidad: DEBUG, INFO, NOTICE, WARNING, ERROR, CRITICAL, ALERT, EMERGENCY',
  `categoria` VARCHAR(50) NOT NULL DEFAULT 'general' COMMENT 'Módulo o categoría: auth, inscripciones, email, api, bd, seguridad, sistema',
  `accion` VARCHAR(100) NOT NULL COMMENT 'Identificador de la acción (ej: login_exitoso, login_fallido, registro_creado, email_enviado, error_sql)',
  `mensaje` TEXT NOT NULL COMMENT 'Descripción legible o detalle del evento',
  `contexto` JSON DEFAULT NULL COMMENT 'Datos complementarios, payload o stack trace en formato JSON',
  `usuario_id` INT UNSIGNED DEFAULT NULL COMMENT 'ID del usuario autenticado si aplica',
  `ip` VARCHAR(45) DEFAULT NULL COMMENT 'Dirección IP del cliente (IPv4 o IPv6)',
  `user_agent` VARCHAR(255) DEFAULT NULL COMMENT 'Navegador o cliente HTTP que originó la petición',
  `origen` VARCHAR(100) DEFAULT NULL COMMENT 'Fichero o endpoint de origen (ej: inscribir.php, mailer.php)',
  `fecha_creacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora exacta del registro',
  PRIMARY KEY (`id`),
  INDEX `idx_enmi_logs_nivel` (`nivel`),
  INDEX `idx_enmi_logs_categoria` (`categoria`),
  INDEX `idx_enmi_logs_accion` (`accion`),
  INDEX `idx_enmi_logs_usuario` (`usuario_id`),
  INDEX `idx_enmi_logs_fecha` (`fecha_creacion`),
  INDEX `idx_enmi_logs_cat_fecha` (`categoria`, `fecha_creacion`),
  CONSTRAINT `fk_enmi_logs_usuario` 
    FOREIGN KEY (`usuario_id`) 
    REFERENCES `enmi_usuarios` (`id`) 
    ON DELETE SET NULL 
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Datos Iniciales / Semilla Base
-- Usuario Administrador por Defecto
-- Login: admin | Password: Admin.123 | Email: admin@enmi2027.es
-- ---------------------------------------------------------------------
INSERT INTO `enmi_usuarios` (`id`, `login`, `email`, `password_hash`, `bloqueado`, `fecha_creacion`)
VALUES (1, 'admin', 'admin@enmi2027.es', '$2y$10$vWg6eKP9o8s0CbkaPJzTXu07kj32K90OjWZriyVYzOh20X7Q4WNEG', 0, NOW())
ON DUPLICATE KEY UPDATE 
  `email` = VALUES(`email`),
  `password_hash` = VALUES(`password_hash`);
