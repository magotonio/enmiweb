-- =====================================================================
-- MIGRACIÓN 004: Creación de la tabla de logs y auditoría (enmi_logs)
-- Motor: MariaDB / MySQL
-- Prefijo de tablas: enmi_
-- =====================================================================

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
