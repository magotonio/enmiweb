-- =====================================================================
-- MIGRACIÓN 014: Creación de la tabla de compras (enmi_compras)
-- Registra las compras realizadas, importes, modalidades y estado
-- Motor: MariaDB / MySQL
-- =====================================================================

CREATE TABLE IF NOT EXISTS `enmi_compras` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `inscripcion_id` INT UNSIGNED DEFAULT NULL COMMENT 'ID de la inscripción vinculada si la compra corresponde a una inscripción',
  `referencia` VARCHAR(50) DEFAULT NULL COMMENT 'Código de referencia o localizador único de la compra',
  `concepto` VARCHAR(255) DEFAULT NULL COMMENT 'Concepto o descripción del artículo/servicio comprado',
  `cantidad_pagada` DECIMAL(10, 2) NOT NULL DEFAULT 0.00 COMMENT 'Cantidad o importe pagado en euros',
  `modalidad_pago` VARCHAR(50) DEFAULT NULL COMMENT 'Modalidad de pago: redsys, bizum, transferencia, otras',
  `estado` VARCHAR(30) NOT NULL DEFAULT 'pendiente' COMMENT 'Estado: iniciada, pendiente, pagada, cancelada, reembolsada',
  `fecha_compra` DATETIME DEFAULT NULL COMMENT 'Fecha y hora en que se completó efectivamente la compra (NULL si no se ha completado)',
  `notas` TEXT DEFAULT NULL COMMENT 'Notas, observaciones o detalles adicionales de la compra',
  `datos_transaccion` JSON DEFAULT NULL COMMENT 'Detalles o respuesta técnica de la pasarela o método de pago',
  `fecha_creacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación de la orden de compra',
  `fecha_actualizacion` DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de última modificación',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_enmi_compras_referencia` (`referencia`),
  INDEX `idx_enmi_compras_inscripcion` (`inscripcion_id`),
  INDEX `idx_enmi_compras_estado` (`estado`),
  INDEX `idx_enmi_compras_modalidad` (`modalidad_pago`),
  INDEX `idx_enmi_compras_fecha_compra` (`fecha_compra`),
  INDEX `idx_enmi_compras_fecha_creacion` (`fecha_creacion`),
  CONSTRAINT `fk_enmi_compras_inscripcion` 
    FOREIGN KEY (`inscripcion_id`) 
    REFERENCES `enmi_inscripciones` (`id`) 
    ON DELETE SET NULL 
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
