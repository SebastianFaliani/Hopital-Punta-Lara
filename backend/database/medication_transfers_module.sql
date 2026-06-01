CREATE TABLE IF NOT EXISTS medication_transfers (
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
  INDEX idx_medication_transfers_status (status),
  INDEX idx_medication_transfers_source (source_facility_id),
  INDEX idx_medication_transfers_destination (destination_facility_id),
  CONSTRAINT fk_medication_transfers_source
    FOREIGN KEY (source_facility_id)
    REFERENCES health_facilities(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_medication_transfers_destination
    FOREIGN KEY (destination_facility_id)
    REFERENCES health_facilities(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_medication_transfers_created_by
    FOREIGN KEY (created_by)
    REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_medication_transfers_received_by
    FOREIGN KEY (received_by)
    REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_medication_transfers_cancelled_by
    FOREIGN KEY (cancelled_by)
    REFERENCES users(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS medication_transfer_items (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  medication_transfer_id BIGINT NOT NULL,
  medication_batch_id BIGINT NOT NULL,
  quantity DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_medication_transfer_items_transfer (medication_transfer_id),
  INDEX idx_medication_transfer_items_batch (medication_batch_id),
  CONSTRAINT fk_medication_transfer_items_transfer
    FOREIGN KEY (medication_transfer_id)
    REFERENCES medication_transfers(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_medication_transfer_items_batch
    FOREIGN KEY (medication_batch_id)
    REFERENCES medication_batches(id)
    ON DELETE RESTRICT
);

ALTER TABLE inventory_movements
  MODIFY movement_type ENUM(
    'compra',
    'donacion',
    'ajuste',
    'perdida',
    'devolucion',
    'traslado_envio',
    'traslado_recepcion',
    'traslado_cancelacion'
  ) NOT NULL;
