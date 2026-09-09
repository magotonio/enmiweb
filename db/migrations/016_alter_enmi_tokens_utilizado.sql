-- =====================================================================
-- MIGRACIÓN 016: Modificación de la columna utilizado en enmi_tokens
-- Permite que la columna utilizado almacene el número de usos disponibles
-- y pueda decrementar hasta 0 sin restricciones de rango TINYINT(1).
-- Motor: MariaDB / MySQL
-- =====================================================================

ALTER TABLE `enmi_tokens` MODIFY `utilizado` INT NOT NULL DEFAULT 0 COMMENT 'Número de usos disponibles restantes (se resta 1 por cada canje)';
