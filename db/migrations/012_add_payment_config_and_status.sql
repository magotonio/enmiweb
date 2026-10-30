-- =====================================================================
-- MIGRACIÓN 012: Actualización de estados de inscripción y configuración de pagos
-- Estados de inscripción: iniciada, pendiente, pagada, cancelada
-- Parámetros clave-valor para modalidades: Redsys, Bizum, Transferencia, Otras
-- =====================================================================

-- 1. Modificar valor por defecto del campo 'estado' en 'enmi_inscripciones' a 'iniciada'
ALTER TABLE `enmi_inscripciones` 
  MODIFY COLUMN `estado` VARCHAR(20) NOT NULL DEFAULT 'iniciada' COMMENT 'iniciada, pendiente, pagada, cancelada';

-- 2. Migrar registros previos con estado 'activo' a 'iniciada' si no han completado el pago
UPDATE `enmi_inscripciones` 
  SET `estado` = 'iniciada' 
  WHERE `estado` = 'activo';

-- 3. Insertar parámetros de configuración para modalidades de pago
INSERT INTO `enmi_configuracion` (`clave`, `valor`, `descripcion`, `fecha_creacion`)
VALUES
  ('pago_importe', '250.00', 'Importe de la cuota de inscripción en euros (ej. 250.00)', NOW()),
  ('pago_bizum_telefono', '+34 600 000 000', 'Número de teléfono móvil habilitado para recibir pagos por Bizum', NOW()),
  ('pago_bizum_beneficiario', 'Encuentro Nacional de Magos Infantiles (ENMI)', 'Titular o beneficiario a mostrar para pagos con Bizum', NOW()),
  ('pago_transferencia_iban', 'ES00 0000 0000 0000 0000 0000', 'Código IBAN de la cuenta bancaria para transferencias', NOW()),
  ('pago_transferencia_titular', 'Asociación ENMI 2027 / Eutikea', 'Titular de la cuenta bancaria para transferencias', NOW()),
  ('pago_transferencia_banco', 'Banco Santander', 'Nombre de la entidad bancaria para transferencias', NOW()),
  ('pago_transferencia_concepto', 'ENMI-2027-{ID}-{APELLIDOS}', 'Plantilla del concepto bancario ({ID} y {APELLIDOS} se sustituyen dinámicamente)', NOW()),
  ('pago_otras_modalidades_texto', 'Para otra forma de pago, nos pondremos en contacto contigo personalmente a través de tu teléfono o email.', 'Texto informativo para la opción de otras modalidades de pago', NOW()),
  ('pago_redsys_entorno', 'sandbox', 'Entorno de la pasarela Redsys: sandbox (pruebas) o produccion', NOW()),
  ('pago_redsys_fuc', '999008881', 'Código de comercio FUC proporcionado por Redsys / Banco', NOW()),
  ('pago_redsys_terminal', '1', 'Número de terminal asignado por Redsys', NOW()),
  ('pago_redsys_clave_secreta', 'sq7HjrUOBfKmC576ILgskD5srU870gJ7', 'Clave secreta HMAC SHA-256 de Redsys (sandbox oficial)', NOW()),
  ('pago_redsys_moneda', '978', 'Código ISO de moneda (978 = Euro)', NOW()),
  ('pago_redsys_url_sandbox', 'https://sis-t.redsys.es:25443/sis/realizarPago', 'URL del TPV Virtual de Redsys en entorno de pruebas', NOW()),
  ('pago_redsys_url_produccion', 'https://sis.redsys.es/sis/realizarPago', 'URL del TPV Virtual de Redsys en producción', NOW())
ON DUPLICATE KEY UPDATE
  `descripcion` = VALUES(`descripcion`);
