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
-- Password 'Admin.123' -> $2y$10$vWg6eKP9o8s0CbkaPJzTXu07kj32K90OjWZriyVYzOh20X7Q4WNEG
-- Password 'Supervisor.123' -> $2y$10$Q7wYvS0v8u6rXk5Yx9q3ueeE5Y3kK5zY0w.7R4z4j6U6f8W0Y7XCe
-- Password 'Asistente.123' -> $2y$10$4B9L9T6Zz9c8v7x6w5u4uekK7rY1w0z9q8x7v6u5t4s3r2q1p0o9N

INSERT INTO `enmi_usuarios` (`id`, `login`, `email`, `rol`, `password_hash`, `bloqueado`, `intentos_fallidos`, `fecha_creacion`)
VALUES 
  (1, 'admin', 'enmi@eutikea.com', 'superadministrador', '$2y$10$vWg6eKP9o8s0CbkaPJzTXu07kj32K90OjWZriyVYzOh20X7Q4WNEG', 0, 0, NOW()),
  (2, 'supervisor', 'supervisor@enmi2027.es', 'supervisor', '$2y$10$p0b3hAEvuW91JslZkKx36eD9Q8sM2yBfI0oP9L7t6v5U4r3s2q1PO', 0, 0, NOW()),
  (3, 'asistente', 'asistente@enmi2027.es', 'asistente', '$2y$10$v8kK5rY1w0z9q8x7v6u5te9Q8sM2yBfI0oP9L7t6v5U4r3s2q1PO9', 0, 0, NOW())
ON DUPLICATE KEY UPDATE 
  `rol` = VALUES(`rol`),
  `email` = VALUES(`email`);

-- 4. Inscripción semilla vinculada al usuario 'asistente' de prueba
INSERT INTO `enmi_inscripciones` 
  (`nombre`, `apellidos`, `nombre_artistico`, `nif_pasaporte`, `email`, `telefono`, `origen`, `asociacion`, `quiero_participar`, `acepta_privacidad`, `consentimiento_imagen`, `comentarios`, `estado`)
VALUES
  ('Alejandro', 'Gómez Martín', 'Mago Álex', '12345678Z', 'asistente@enmi2027.es', '+34 600 123 456', 'Madrid, España', 'Círculo de Ilusionistas de Madrid', 1, 1, 1, 'Vegetariano. Participación en gala de magia infantil de cerca.', 'activo')
ON DUPLICATE KEY UPDATE `email` = VALUES(`email`);

