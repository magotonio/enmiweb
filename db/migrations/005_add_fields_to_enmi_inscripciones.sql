-- =====================================================================
-- Migración 005: Ampliación de campos en enmi_inscripciones
-- Añade: nombre_artistico, nif_pasaporte, email, telefono, origen,
--        asociacion, quiero_participar, acepta_privacidad,
--        consentimiento_imagen, comentarios
-- =====================================================================

ALTER TABLE `enmi_inscripciones`
  ADD COLUMN `nombre_artistico` VARCHAR(100) DEFAULT NULL AFTER `apellidos`,
  ADD COLUMN `nif_pasaporte` VARCHAR(30) NOT NULL DEFAULT '' AFTER `nombre_artistico`,
  ADD COLUMN `email` VARCHAR(255) NOT NULL DEFAULT '' AFTER `nif_pasaporte`,
  ADD COLUMN `telefono` VARCHAR(30) NOT NULL DEFAULT '' AFTER `email`,
  ADD COLUMN `origen` VARCHAR(150) NOT NULL DEFAULT '' AFTER `telefono`,
  ADD COLUMN `asociacion` VARCHAR(150) DEFAULT NULL AFTER `origen`,
  ADD COLUMN `quiero_participar` TINYINT(1) NOT NULL DEFAULT 0 AFTER `asociacion`,
  ADD COLUMN `acepta_privacidad` TINYINT(1) NOT NULL DEFAULT 0 AFTER `quiero_participar`,
  ADD COLUMN `consentimiento_imagen` TINYINT(1) NOT NULL DEFAULT 0 AFTER `acepta_privacidad`,
  ADD COLUMN `comentarios` TEXT DEFAULT NULL AFTER `consentimiento_imagen`,
  ADD INDEX `idx_enmi_inscripciones_email` (`email`),
  ADD INDEX `idx_enmi_inscripciones_nif` (`nif_pasaporte`),
  ADD INDEX `idx_enmi_inscripciones_participar` (`quiero_participar`);
