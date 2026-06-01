CREATE TABLE IF NOT EXISTS medication_deliveries (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  facility_id BIGINT NOT NULL,
  delivery_date DATE NOT NULL,
  patient_id BIGINT NULL,
  patient_name VARCHAR(180) NOT NULL,
  patient_document VARCHAR(30) NULL,
  patient_phone VARCHAR(80) NULL,
  delivery_reason ENUM(
    'tratamiento',
    'cronico',
    'guardia',
    'otro'
  ) NOT NULL DEFAULT 'tratamiento',
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
  INDEX idx_medication_deliveries_facility (facility_id),
  INDEX idx_medication_deliveries_date (delivery_date),
  INDEX idx_medication_deliveries_patient (patient_name, patient_document),
  INDEX idx_medication_deliveries_status (status),
  CONSTRAINT fk_medication_deliveries_facility
    FOREIGN KEY (facility_id)
    REFERENCES health_facilities(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_medication_deliveries_created_by
    FOREIGN KEY (created_by)
    REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_medication_deliveries_cancelled_by
    FOREIGN KEY (cancelled_by)
    REFERENCES users(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS medication_delivery_items (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  medication_delivery_id BIGINT NOT NULL,
  medication_batch_id BIGINT NOT NULL,
  quantity DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_medication_delivery_items_delivery (medication_delivery_id),
  INDEX idx_medication_delivery_items_batch (medication_batch_id),
  CONSTRAINT fk_medication_delivery_items_delivery
    FOREIGN KEY (medication_delivery_id)
    REFERENCES medication_deliveries(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_medication_delivery_items_batch
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
    'traslado_cancelacion',
    'entrega_paciente',
    'cancelacion_entrega_paciente'
  ) NOT NULL;
