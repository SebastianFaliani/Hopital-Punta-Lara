CREATE TABLE IF NOT EXISTS vaccine_batch_stocks (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  vaccine_batch_id BIGINT NOT NULL,
  facility_id BIGINT NOT NULL,
  current_stock DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_vaccine_batch_facility (
    vaccine_batch_id,
    facility_id
  ),
  INDEX idx_vaccine_batch_stocks_facility (facility_id),
  CONSTRAINT fk_vaccine_batch_stocks_batch
    FOREIGN KEY (vaccine_batch_id)
    REFERENCES vaccine_batches(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_vaccine_batch_stocks_facility
    FOREIGN KEY (facility_id)
    REFERENCES health_facilities(id)
    ON DELETE RESTRICT
);

INSERT INTO vaccine_batch_stocks (
  vaccine_batch_id,
  facility_id,
  current_stock
)
SELECT
  vb.id,
  hf.id,
  vb.current_stock
FROM vaccine_batches vb
JOIN health_facilities hf
  ON hf.name = 'Hospital Municipal de Punta Lara'
WHERE vb.current_stock > 0
ON DUPLICATE KEY UPDATE
  current_stock = vaccine_batch_stocks.current_stock;

ALTER TABLE vaccine_movements
  ADD COLUMN facility_id BIGINT NULL AFTER vaccine_batch_id;

ALTER TABLE vaccine_movements
  ADD INDEX idx_vaccine_movements_facility (facility_id);

ALTER TABLE vaccine_movements
  ADD CONSTRAINT fk_vaccine_movements_facility
    FOREIGN KEY (facility_id)
    REFERENCES health_facilities(id)
    ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS vaccine_transfers (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  source_facility_id BIGINT NOT NULL,
  destination_facility_id BIGINT NOT NULL,
  transfer_date DATE NOT NULL,
  status ENUM(
    'enviado',
    'recibido',
    'cancelado'
  ) NOT NULL DEFAULT 'enviado',
  notes TEXT NULL,
  created_by BIGINT NULL,
  received_by BIGINT NULL,
  received_at DATETIME NULL,
  cancelled_by BIGINT NULL,
  cancelled_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_vaccine_transfers_status (status),
  INDEX idx_vaccine_transfers_source (source_facility_id),
  INDEX idx_vaccine_transfers_destination (destination_facility_id),
  CONSTRAINT fk_vaccine_transfers_source
    FOREIGN KEY (source_facility_id)
    REFERENCES health_facilities(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_vaccine_transfers_destination
    FOREIGN KEY (destination_facility_id)
    REFERENCES health_facilities(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_vaccine_transfers_created_by
    FOREIGN KEY (created_by)
    REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_vaccine_transfers_received_by
    FOREIGN KEY (received_by)
    REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_vaccine_transfers_cancelled_by
    FOREIGN KEY (cancelled_by)
    REFERENCES users(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS vaccine_transfer_items (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  vaccine_transfer_id BIGINT NOT NULL,
  vaccine_batch_id BIGINT NOT NULL,
  quantity DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_vaccine_transfer_items_transfer (vaccine_transfer_id),
  INDEX idx_vaccine_transfer_items_batch (vaccine_batch_id),
  CONSTRAINT fk_vaccine_transfer_items_transfer
    FOREIGN KEY (vaccine_transfer_id)
    REFERENCES vaccine_transfers(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_vaccine_transfer_items_batch
    FOREIGN KEY (vaccine_batch_id)
    REFERENCES vaccine_batches(id)
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS vaccine_deliveries (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  facility_id BIGINT NOT NULL,
  delivery_date DATE NOT NULL,
  patient_id BIGINT NULL,
  patient_name VARCHAR(180) NOT NULL,
  patient_document VARCHAR(30) NULL,
  patient_phone VARCHAR(80) NULL,
  delivery_reason ENUM(
    'aplicacion',
    'campania',
    'refuerzo',
    'otro'
  ) NOT NULL DEFAULT 'aplicacion',
  status ENUM(
    'entregado',
    'cancelado'
  ) NOT NULL DEFAULT 'entregado',
  notes TEXT NULL,
  created_by BIGINT NULL,
  cancelled_by BIGINT NULL,
  cancelled_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_vaccine_deliveries_facility (facility_id),
  INDEX idx_vaccine_deliveries_date (delivery_date),
  INDEX idx_vaccine_deliveries_patient (patient_name, patient_document),
  INDEX idx_vaccine_deliveries_status (status),
  CONSTRAINT fk_vaccine_deliveries_facility
    FOREIGN KEY (facility_id)
    REFERENCES health_facilities(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_vaccine_deliveries_created_by
    FOREIGN KEY (created_by)
    REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_vaccine_deliveries_cancelled_by
    FOREIGN KEY (cancelled_by)
    REFERENCES users(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS vaccine_delivery_items (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  vaccine_delivery_id BIGINT NOT NULL,
  vaccine_batch_id BIGINT NOT NULL,
  quantity DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_vaccine_delivery_items_delivery (vaccine_delivery_id),
  INDEX idx_vaccine_delivery_items_batch (vaccine_batch_id),
  CONSTRAINT fk_vaccine_delivery_items_delivery
    FOREIGN KEY (vaccine_delivery_id)
    REFERENCES vaccine_deliveries(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_vaccine_delivery_items_batch
    FOREIGN KEY (vaccine_batch_id)
    REFERENCES vaccine_batches(id)
    ON DELETE RESTRICT
);
