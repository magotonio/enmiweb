-- =====================================================================
-- MIGRACIÓN 017: Actualizar texto de otras modalidades de pago
-- Tabla: enmi_configuracion
-- Motor: MariaDB / MySQL
-- =====================================================================

SET NAMES utf8mb4;

INSERT INTO `enmi_configuracion` (`clave`, `valor`, `descripcion`, `fecha_creacion`)
VALUES (
  'pago_otras_modalidades_texto',
  'Para otra forma de pago, nos pondremos en contacto contigo personalmente a través de tu teléfono o email.',
  'Texto informativo para la opción de otras modalidades de pago',
  NOW()
)
ON DUPLICATE KEY UPDATE
  `valor` = VALUES(`valor`);
