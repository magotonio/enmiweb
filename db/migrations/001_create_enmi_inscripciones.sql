-- =====================================================================
-- MIGRACIÓN 001: Creación inicial de tabla de inscripciones
-- Fecha: 2026-08-17
-- Ejecutar en: phpMyAdmin / Consola MariaDB de Dinahosting
-- =====================================================================

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
