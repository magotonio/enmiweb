-- =====================================================================
-- Migración 006: Añadir contador de intentos fallidos de login
-- Añade la columna intentos_fallidos a la tabla enmi_usuarios
-- =====================================================================

ALTER TABLE `enmi_usuarios`
  ADD COLUMN `intentos_fallidos` TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Contador de intentos fallidos consecutivos de login' AFTER `bloqueado`;
