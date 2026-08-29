-- =====================================================================
-- Migración 007: Añadir columna rol a la tabla enmi_usuarios y usuarios semilla
-- Permite el control de acceso multinivel: superadministrador, supervisor, asistente
-- =====================================================================

-- 1. Añadir columna rol a enmi_usuarios
ALTER TABLE `enmi_usuarios`
  ADD COLUMN `rol` VARCHAR(30) NOT NULL DEFAULT 'asistente' COMMENT 'Perfil de seguridad: superadministrador, supervisor, asistente' AFTER `email`,
  ADD INDEX `idx_enmi_usuarios_rol` (`rol`);

-- 2. Asegurar que el usuario administrador predeterminado tenga rol de superadministrador
UPDATE `enmi_usuarios`
SET `rol` = 'superadministrador'
WHERE `login` = 'admin';

-- 3. Crear o actualizar usuarios semilla para los 3 perfiles

INSERT INTO `enmi_usuarios` (`id`, `login`, `email`, `rol`, `password_hash`, `bloqueado`, `intentos_fallidos`, `fecha_creacion`)
VALUES 
  (1, 'admin', 'enmi@eutikea.com', 'superadministrador', '$2y$10$YZROVCeDCMoxzC64B5J4V.T6WksOyDPgDvMa3Dd4gA7Ibvx0Qb4.y', 0, 0, NOW()),
  (2, 'supervisor', 'supervisor@enmi2027.es', 'supervisor', '$2y$10$fxRBjBjaE8ctiRi2TDAF3u0bZ9hHjNZcXmy9p0XmPNo1SBejferii', 0, 0, NOW()),
  (3, 'asistente', 'asistente@enmi2027.es', 'asistente', '$2y$10$fzTCbMykb3a3Z.OlwbIAHuB8CR3O6nrlOimTtbz87/LDo9WCOkUDO', 0, 0, NOW())
ON DUPLICATE KEY UPDATE 
  `rol` = VALUES(`rol`),
  `email` = VALUES(`email`);

-- 4. Inscripción semilla vinculada al usuario 'asistente' de prueba
INSERT INTO `enmi_inscripciones` 
  (`nombre`, `apellidos`, `nombre_artistico`, `nif_pasaporte`, `email`, `telefono`, `origen`, `asociacion`, `quiero_participar`, `acepta_privacidad`, `consentimiento_imagen`, `comentarios`, `estado`)
VALUES
  ('Alejandro', 'Gómez Martín', 'Mago Álex', '12345678Z', 'asistente@enmi2027.es', '+34 600 123 456', 'Madrid, España', 'Círculo de Ilusionistas de Madrid', 1, 1, 1, 'Vegetariano. Participación en gala de magia infantil de cerca.', 'activo')
ON DUPLICATE KEY UPDATE `email` = VALUES(`email`);

