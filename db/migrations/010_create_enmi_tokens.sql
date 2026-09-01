-- =====================================================================
-- MIGRACIÓN 010: Creación de tabla de tokens genéricos
-- Tabla: enmi_tokens
-- Motor: MariaDB / MySQL
-- =====================================================================

CREATE TABLE IF NOT EXISTS `enmi_tokens` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `token` VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL COMMENT 'Token alfanumérico corto (Base62: mayúsculas, minúsculas y números)',
  `tipo` VARCHAR(50) NOT NULL COMMENT 'Tipo de token (ej. resetpwd, link, descuento, verificacion, etc.)',
  `valor` TEXT DEFAULT NULL COMMENT 'Dato o payload asociado (ID de usuario, URL de destino, código de descuento, etc.)',
  `fecha_caducidad` DATETIME NOT NULL COMMENT 'Fecha y hora exacta en la que expira el token',
  `descripcion` VARCHAR(255) DEFAULT NULL COMMENT 'Descripción o contexto del propósito del token',
  `utilizado` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '0: Pendiente / Válido, 1: Ya utilizado / Canjeado',
  `fecha_creacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha de generación del token',
  `fecha_uso` DATETIME DEFAULT NULL COMMENT 'Fecha y hora en la que fue consumido el token',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_enmi_tokens_token` (`token`),
  INDEX `idx_enmi_tokens_tipo` (`tipo`),
  INDEX `idx_enmi_tokens_caducidad` (`fecha_caducidad`),
  INDEX `idx_enmi_tokens_busqueda_valido` (`token`, `tipo`, `utilizado`, `fecha_caducidad`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tabla de tokens temporales de un solo uso o enlaces';
