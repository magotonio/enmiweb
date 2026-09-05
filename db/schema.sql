-- =====================================================================
-- ESQUEMA COMPLETO: PROYECTO ENMI
-- Motor: MariaDB (Dinahosting)
-- Juego de caracteres: utf8mb4 / Collate: utf8mb4_unicode_ci
-- Prefijo de tablas: enmi_
-- Última actualización: Versión 1.4.0 (Tabla de logs y auditoría)
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tabla 1: enmi_inscripciones
-- Registra los participantes inscritos mediante el formulario.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `enmi_inscripciones` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(100) NOT NULL,
  `apellidos` VARCHAR(150) NOT NULL,
  `nombre_artistico` VARCHAR(100) DEFAULT NULL,
  `nif_pasaporte` VARCHAR(30) NOT NULL DEFAULT '',
  `email` VARCHAR(255) NOT NULL DEFAULT '',
  `telefono` VARCHAR(30) NOT NULL DEFAULT '',
  `origen` VARCHAR(150) NOT NULL DEFAULT '',
  `asociacion` VARCHAR(150) DEFAULT NULL,
  `quiero_participar` TINYINT(1) NOT NULL DEFAULT 0,
  `acepta_privacidad` TINYINT(1) NOT NULL DEFAULT 0,
  `consentimiento_imagen` TINYINT(1) NOT NULL DEFAULT 0,
  `comentarios` TEXT DEFAULT NULL,
  `estado` VARCHAR(20) NOT NULL DEFAULT 'iniciada' COMMENT 'iniciada, pendiente, pagada, cancelada',
  `ip_registro` VARCHAR(45) DEFAULT NULL,
  `fecha_creacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_actualizacion` DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_enmi_inscripciones_fecha` (`fecha_creacion`),
  INDEX `idx_enmi_inscripciones_apellidos` (`apellidos`),
  INDEX `idx_enmi_inscripciones_email` (`email`),
  INDEX `idx_enmi_inscripciones_nif` (`nif_pasaporte`),
  INDEX `idx_enmi_inscripciones_telefono` (`telefono`),
  INDEX `idx_enmi_inscripciones_participar` (`quiero_participar`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Tabla 2: enmi_usuarios
-- Registra los usuarios del sistema para autenticación y control de acceso.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `enmi_usuarios` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `login` VARCHAR(50) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `rol` VARCHAR(30) NOT NULL DEFAULT 'asistente' COMMENT 'Perfil de seguridad: superadministrador, supervisor, asistente',
  `password_hash` VARCHAR(255) NOT NULL COMMENT 'Hash de contraseña encriptada (ej. BCRYPT/Argon2)',
  `ultimo_login` DATETIME DEFAULT NULL COMMENT 'Fecha y hora del último acceso exitoso',
  `bloqueado` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '0: Activo / No bloqueado, 1: Bloqueado',
  `intentos_fallidos` TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Contador de intentos fallidos consecutivos de login',
  `fecha_creacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_actualizacion` DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_enmi_usuarios_login` (`login`),
  UNIQUE KEY `uq_enmi_usuarios_email` (`email`),
  INDEX `idx_enmi_usuarios_rol` (`rol`),
  INDEX `idx_enmi_usuarios_bloqueado` (`bloqueado`),
  INDEX `idx_enmi_usuarios_ultimo_login` (`ultimo_login`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Tabla 3: enmi_recuperacion_passwords
-- Gestiona los tokens seguros temporales para la recuperación de contraseñas.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `enmi_recuperacion_passwords` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `usuario_id` INT UNSIGNED NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `token_hash` VARCHAR(64) NOT NULL COMMENT 'Hash SHA-256 del token seguro enviado por email',
  `expira_en` DATETIME NOT NULL COMMENT 'Fecha y hora de expiración del enlace (ej. 30 o 60 min)',
  `utilizado` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '0: Pendiente / No utilizado, 1: Ya utilizado',
  `ip_solicitud` VARCHAR(45) DEFAULT NULL COMMENT 'Dirección IP desde la que se solicitó el restablecimiento',
  `fecha_creacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_utilizacion` DATETIME DEFAULT NULL COMMENT 'Fecha y hora en que se canjeó el token',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_enmi_recuperacion_token` (`token_hash`),
  INDEX `idx_enmi_recuperacion_usuario` (`usuario_id`),
  INDEX `idx_enmi_recuperacion_email` (`email`),
  INDEX `idx_enmi_recuperacion_expira` (`expira_en`),
  CONSTRAINT `fk_enmi_recuperacion_usuario` 
    FOREIGN KEY (`usuario_id`) 
    REFERENCES `enmi_usuarios` (`id`) 
    ON DELETE CASCADE 
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Tabla 4: enmi_logs
-- Registra eventos, errores, notificaciones y auditoría del sistema.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `enmi_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nivel` VARCHAR(20) NOT NULL DEFAULT 'INFO' COMMENT 'Nivel de severidad: DEBUG, INFO, NOTICE, WARNING, ERROR, CRITICAL, ALERT, EMERGENCY',
  `categoria` VARCHAR(50) NOT NULL DEFAULT 'general' COMMENT 'Módulo o categoría: auth, inscripciones, email, api, bd, seguridad, sistema',
  `accion` VARCHAR(100) NOT NULL COMMENT 'Identificador de la acción (ej: login_exitoso, login_fallido, registro_creado, email_enviado, error_sql)',
  `mensaje` TEXT NOT NULL COMMENT 'Descripción legible o detalle del evento',
  `contexto` JSON DEFAULT NULL COMMENT 'Datos complementarios, payload o stack trace en formato JSON',
  `usuario_id` INT UNSIGNED DEFAULT NULL COMMENT 'ID del usuario autenticado si aplica',
  `ip` VARCHAR(45) DEFAULT NULL COMMENT 'Dirección IP del cliente (IPv4 o IPv6)',
  `user_agent` VARCHAR(255) DEFAULT NULL COMMENT 'Navegador o cliente HTTP que originó la petición',
  `origen` VARCHAR(100) DEFAULT NULL COMMENT 'Fichero o endpoint de origen (ej: inscribir.php, mailer.php)',
  `fecha_creacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora exacta del registro',
  PRIMARY KEY (`id`),
  INDEX `idx_enmi_logs_nivel` (`nivel`),
  INDEX `idx_enmi_logs_categoria` (`categoria`),
  INDEX `idx_enmi_logs_accion` (`accion`),
  INDEX `idx_enmi_logs_usuario` (`usuario_id`),
  INDEX `idx_enmi_logs_fecha` (`fecha_creacion`),
  INDEX `idx_enmi_logs_cat_fecha` (`categoria`, `fecha_creacion`),
  CONSTRAINT `fk_enmi_logs_usuario` 
    FOREIGN KEY (`usuario_id`) 
    REFERENCES `enmi_usuarios` (`id`) 
    ON DELETE SET NULL 
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Tabla 5: enmi_configuracion
-- Registra parámetros clave-valor de texto para configuración dinámica de la web.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `enmi_configuracion` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `clave` VARCHAR(100) NOT NULL COMMENT 'Identificador único del parámetro de configuración',
  `valor` TEXT DEFAULT NULL COMMENT 'Valor del parámetro almacenado como texto',
  `descripcion` VARCHAR(255) DEFAULT NULL COMMENT 'Descripción explicativa del propósito del parámetro',
  `fecha_creacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha de creación del registro',
  `fecha_actualizacion` DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha de última modificación',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_enmi_configuracion_clave` (`clave`),
  INDEX `idx_enmi_configuracion_clave` (`clave`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Tabla 6: enmi_tokens
-- Almacena tokens temporales alfanuméricos cortos para enlaces, reset de password, etc.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `enmi_tokens` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `token` VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL COMMENT 'Token alfanumérico corto (Base62: mayúsculas, minúsculas y números)',
  `tipo` VARCHAR(50) NOT NULL COMMENT 'Tipo de token (ej. resetpwd, link, descuento, verificacion, etc.)',
  `valor` TEXT DEFAULT NULL COMMENT 'Dato o payload asociado (ID de usuario, URL de destino, código de descuento, etc.)',
  `fecha_caducidad` DATETIME NOT NULL COMMENT 'Fecha y hora exacta en la que expira el token',
  `descripcion` VARCHAR(255) DEFAULT NULL COMMENT 'Descripción o contexto del propósito del token',
  `utilizado` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '0: Pendiente / Válido, 1: Ya utilizado / Canjeado',
  `fecha_creacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha de generación del token',
  `fecha_uso` DATETIME DEFAULT NULL COMMENT 'Fecha y hora en la que fue consumido el token',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_enmi_tokens_token` (`token`),
  INDEX `idx_enmi_tokens_tipo` (`tipo`),
  INDEX `idx_enmi_tokens_caducidad` (`fecha_caducidad`),
  INDEX `idx_enmi_tokens_busqueda_valido` (`token`, `tipo`, `utilizado`, `fecha_caducidad`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Datos Iniciales / Semilla Base
-- Usuarios con los 3 perfiles de seguridad:
-- 1. Superadministrador: login 'admin' | pass 'Admin.123' | email 'enmi@eutikea.com'
-- 2. Supervisor: login 'supervisor' | pass 'Supervisor.123' | email 'supervisor@enmi2027.es'
-- 3. Asistente: login 'asistente' | pass 'Asistente.123' | email 'asistente@enmi2027.es'
-- ---------------------------------------------------------------------
INSERT INTO `enmi_usuarios` (`id`, `login`, `email`, `rol`, `password_hash`, `bloqueado`, `intentos_fallidos`, `fecha_creacion`)
VALUES 
  (1, 'admin', 'enmi@eutikea.com', 'superadministrador', '$2y$10$vWg6eKP9o8s0CbkaPJzTXu07kj32K90OjWZriyVYzOh20X7Q4WNEG', 0, 0, NOW()),
  (2, 'supervisor', 'supervisor@enmi2027.es', 'supervisor', '$2y$10$p0b3hAEvuW91JslZkKx36eD9Q8sM2yBfI0oP9L7t6v5U4r3s2q1PO', 0, 0, NOW()),
  (3, 'asistente', 'asistente@enmi2027.es', 'asistente', '$2y$10$v8kK5rY1w0z9q8x7v6u5te9Q8sM2yBfI0oP9L7t6v5U4r3s2q1PO9', 0, 0, NOW())
ON DUPLICATE KEY UPDATE 
  `email` = VALUES(`email`),
  `rol` = VALUES(`rol`),
  `password_hash` = VALUES(`password_hash`);

-- Inscripción semilla vinculada al usuario 'asistente' de prueba
INSERT INTO `enmi_inscripciones` 
  (`nombre`, `apellidos`, `nombre_artistico`, `nif_pasaporte`, `email`, `telefono`, `origen`, `asociacion`, `quiero_participar`, `acepta_privacidad`, `consentimiento_imagen`, `comentarios`, `estado`)
VALUES
  ('Alejandro', 'Gómez Martín', 'Mago Álex', '12345678Z', 'asistente@enmi2027.es', '+34 600 123 456', 'Madrid, España', 'Círculo de Ilusionistas de Madrid', 1, 1, 1, 'Vegetariano. Participación en gala de magia infantil de cerca.', 'activo')
ON DUPLICATE KEY UPDATE `email` = VALUES(`email`);

-- Parámetros de configuración iniciales (mantenimiento, servicio SMTP y pagos)
INSERT INTO `enmi_configuracion` (`clave`, `valor`, `descripcion`, `fecha_creacion`)
VALUES
  ('mantenimiento', '1', 'Modo mantenimiento de la web (1: activado / formulario cerrado, 0: desactivado / abierto)', NOW()),
  ('smtp_host', 'eutikea-com.correoseguro.dinaserver.com', 'Servidor de correo saliente SMTP', NOW()),
  ('smtp_port', '465', 'Puerto del servidor SMTP (465 SSL / 587 TLS)', NOW()),
  ('smtp_secure', 'ssl', 'Protocolo de seguridad de transporte SMTP (ssl / tls)', NOW()),
  ('smtp_auth', '1', 'Requiere autenticación SMTP (1: sí, 0: no)', NOW()),
  ('smtp_user', 'enmi@eutikea.com', 'Usuario / buzón de la cuenta de correo SMTP', NOW()),
  ('smtp_pass', 'enmI.2702$Tk', 'Contraseña de la cuenta de correo SMTP', NOW()),
  ('smtp_from_email', 'enmi@eutikea.com', 'Dirección de correo remitente predeterminada', NOW()),
  ('smtp_from_name', 'Eutikea - ENMI', 'Nombre legible mostrado del remitente', NOW()),
  ('notification_emails', 'enmi@eutikea.com', 'Direcciones de correo para notificaciones de inscripción (separadas por comas)', NOW()),
  ('token_resetpwd_expiracion_horas', '24', 'Horas de validez predeterminadas para los tokens de restablecimiento de contraseña (resetpwd)', NOW()),
  ('pago_importe', '120.00', 'Importe de la cuota de inscripción en euros (ej. 120.00)', NOW()),
  ('pago_bizum_telefono', '+34 600 000 000', 'Número de teléfono móvil habilitado para recibir pagos por Bizum', NOW()),
  ('pago_bizum_beneficiario', 'Encuentro Nacional de Magos Infantiles (ENMI)', 'Titular o beneficiario a mostrar para pagos con Bizum', NOW()),
  ('pago_transferencia_iban', 'ES00 0000 0000 0000 0000 0000', 'Código IBAN de la cuenta bancaria para transferencias', NOW()),
  ('pago_transferencia_titular', 'Asociación ENMI 2027 / Eutikea', 'Titular de la cuenta bancaria para transferencias', NOW()),
  ('pago_transferencia_banco', 'Banco Santander', 'Nombre de la entidad bancaria para transferencias', NOW()),
  ('pago_transferencia_concepto', 'ENMI-2027-{ID}-{APELLIDOS}', 'Plantilla del concepto bancario ({ID} y {APELLIDOS} se sustituyen dinámicamente)', NOW()),
  ('pago_otras_modalidades_texto', 'Si necesitas otra forma de pago (efectivo durante la acreditación, pago fraccionado, etc.), nos pondremos en contacto contigo personalmente a través de tu teléfono o email para acordarlo.', 'Texto informativo para la opción de otras modalidades de pago', NOW()),
  ('pago_redsys_entorno', 'sandbox', 'Entorno de la pasarela Redsys: sandbox (pruebas) o produccion', NOW()),
  ('pago_redsys_fuc', '999008881', 'Código de comercio FUC proporcionado por Redsys / Banco', NOW()),
  ('pago_redsys_terminal', '1', 'Número de terminal asignado por Redsys', NOW()),
  ('pago_redsys_clave_secreta', 'sq7HjrUqKpOuHaSYNdTe73cbVQRwRN92', 'Clave secreta HMAC SHA-256 de Redsys (sandbox oficial)', NOW()),
  ('pago_redsys_moneda', '978', 'Código ISO de moneda (978 = Euro)', NOW()),
  ('pago_redsys_url_sandbox', 'https://sis-t.redsys.es:25443/sis/realizarPago', 'URL del TPV Virtual de Redsys en entorno de pruebas', NOW()),
  ('pago_redsys_url_produccion', 'https://sis.redsys.es/sis/realizarPago', 'URL del TPV Virtual de Redsys en producción', NOW())
ON DUPLICATE KEY UPDATE
  `valor` = VALUES(`valor`),
  `descripcion` = VALUES(`descripcion`);


