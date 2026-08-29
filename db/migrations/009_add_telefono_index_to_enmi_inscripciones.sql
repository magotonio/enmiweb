-- =====================================================================
-- Migración 009: Añadir índice de teléfono a enmi_inscripciones
-- Optimiza la verificación de duplicados por número de teléfono móvil
-- =====================================================================

ALTER TABLE `enmi_inscripciones`
  ADD INDEX `idx_enmi_inscripciones_telefono` (`telefono`);
