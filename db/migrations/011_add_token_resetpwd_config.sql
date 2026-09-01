-- =====================================================================
-- MIGRACIÓN 011: Añadir parámetro de tiempo de expiración para tokens de resetpwd
-- Tabla: enmi_configuracion
-- Motor: MariaDB / MySQL
-- =====================================================================

INSERT INTO `enmi_configuracion` (`clave`, `valor`, `descripcion`, `fecha_creacion`)
VALUES (
  'token_resetpwd_expiracion_horas', 
  '24', 
  'Horas de validez predeterminadas para los tokens de restablecimiento de contraseña (resetpwd)', 
  NOW()
)
ON DUPLICATE KEY UPDATE 
  `descripcion` = VALUES(`descripcion`);
