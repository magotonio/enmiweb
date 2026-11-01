-- Activacion independiente de Redsys. Conserva el valor si ya existe.
INSERT INTO `enmi_configuracion` (`clave`, `valor`, `descripcion`, `fecha_creacion`)
VALUES (
  'pago_redsys_activo',
  '1',
  'Activa (1) o desactiva (0) los nuevos pagos y el simulador de Redsys, sin afectar a otras modalidades ni a pagos ya iniciados',
  NOW()
)
ON DUPLICATE KEY UPDATE `descripcion` = VALUES(`descripcion`);
