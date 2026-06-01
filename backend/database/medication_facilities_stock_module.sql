CREATE TABLE IF NOT EXISTS health_facilities (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(180) NOT NULL,
  facility_type ENUM(
    'secretaria',
    'hospital',
    'unidad_sanitaria',
    'otro'
  ) NOT NULL DEFAULT 'unidad_sanitaria',
  address TEXT NULL,
  phone VARCHAR(80) NULL,
  notes TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_health_facilities_name (name)
);

INSERT INTO health_facilities (name, facility_type, notes)
VALUES
  ('Secretaria de Salud', 'secretaria', 'Punto central de ingreso y distribucion'),
  ('Hospital Municipal de Punta Lara', 'hospital', 'Hospital principal')
ON DUPLICATE KEY UPDATE
  facility_type = VALUES(facility_type),
  notes = VALUES(notes),
  is_active = TRUE;

CREATE TABLE IF NOT EXISTS medication_batch_stocks (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  medication_batch_id BIGINT NOT NULL,
  facility_id BIGINT NOT NULL,
  current_stock DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_medication_batch_facility (
    medication_batch_id,
    facility_id
  ),
  INDEX idx_medication_batch_stocks_facility (facility_id),
  CONSTRAINT fk_medication_batch_stocks_batch
    FOREIGN KEY (medication_batch_id)
    REFERENCES medication_batches(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_medication_batch_stocks_facility
    FOREIGN KEY (facility_id)
    REFERENCES health_facilities(id)
    ON DELETE RESTRICT
);

INSERT INTO medication_batch_stocks (
  medication_batch_id,
  facility_id,
  current_stock
)
SELECT
  mb.id,
  hf.id,
  mb.current_stock
FROM medication_batches mb
JOIN health_facilities hf
  ON hf.name = 'Hospital Municipal de Punta Lara'
WHERE mb.current_stock > 0
ON DUPLICATE KEY UPDATE
  current_stock = medication_batch_stocks.current_stock;

ALTER TABLE inventory_movements
  MODIFY movement_type ENUM(
    'compra',
    'donacion',
    'ajuste',
    'perdida',
    'devolucion'
  ) NOT NULL,
  ADD COLUMN facility_id BIGINT NULL AFTER medication_batch_id,
  ADD COLUMN donor_name VARCHAR(180) NULL AFTER reference_id,
  ADD INDEX idx_inventory_movements_facility (facility_id),
  ADD CONSTRAINT fk_inventory_movements_facility
    FOREIGN KEY (facility_id)
    REFERENCES health_facilities(id)
    ON DELETE SET NULL;
