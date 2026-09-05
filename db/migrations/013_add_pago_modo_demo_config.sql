-- =====================================================================
-- MIGRACIÓN 013: Parámetro de configuración para el simulador de pagos (Demo Pago)
-- Habilita o deshabilita los botones de prueba en el formulario de pago
-- =====================================================================

INSERT INTO `enmi_configuracion` (`clave`, `valor`, `descripcion`, `fecha_creacion`)
VALUES
  ('pago_modo_demo', '1', 'Habilita o deshabilita la visualización del simulador de pruebas de pago (Demo Pago) en el formulario de pago', NOW())
ON DUPLICATE KEY UPDATE
  `descripcion` = VALUES(`descripcion`);
