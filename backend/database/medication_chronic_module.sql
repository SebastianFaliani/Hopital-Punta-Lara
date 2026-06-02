CREATE TABLE IF NOT EXISTS chronic_patients (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  full_name VARCHAR(180) NOT NULL,
  document_number VARCHAR(30) NULL,
  phone VARCHAR(80) NULL,
  address TEXT NULL,
  default_facility_id BIGINT NULL,
  notes TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_chronic_patients_name (full_name),
  INDEX idx_chronic_patients_document (document_number),
  INDEX idx_chronic_patients_active (is_active),
  CONSTRAINT fk_chronic_patients_default_facility
    FOREIGN KEY (default_facility_id)
    REFERENCES health_facilities(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS chronic_medication_plan_items (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  chronic_patient_id BIGINT NOT NULL,
  medication_id BIGINT NOT NULL,
  monthly_quantity DECIMAL(12,2) NOT NULL,
  instructions TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_chronic_plan_patient (chronic_patient_id),
  INDEX idx_chronic_plan_medication (medication_id),
  CONSTRAINT fk_chronic_plan_patient
    FOREIGN KEY (chronic_patient_id)
    REFERENCES chronic_patients(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_chronic_plan_medication
    FOREIGN KEY (medication_id)
    REFERENCES medications(id)
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS chronic_medication_packages (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  chronic_patient_id BIGINT NOT NULL,
  facility_id BIGINT NOT NULL,
  package_year INT NOT NULL,
  package_month INT NOT NULL,
  status ENUM(
    'preparado',
    'enviado',
    'recibido',
    'parcial',
    'retirado',
    'no_retirado',
    'devuelto',
    'cancelado'
  ) NOT NULL DEFAULT 'preparado',
  prepared_by BIGINT NULL,
  delivered_by BIGINT NULL,
  delivered_at DATETIME NULL,
  not_picked_up_at DATETIME NULL,
  notes TEXT NULL,
  medication_transfer_id BIGINT NULL,
  medication_delivery_id BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_chronic_package_patient_month (
    chronic_patient_id,
    package_year,
    package_month
  ),
  INDEX idx_chronic_package_facility (facility_id),
  INDEX idx_chronic_package_status (status),
  CONSTRAINT fk_chronic_package_patient
    FOREIGN KEY (chronic_patient_id)
    REFERENCES chronic_patients(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_chronic_package_facility
    FOREIGN KEY (facility_id)
    REFERENCES health_facilities(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_chronic_package_prepared_by
    FOREIGN KEY (prepared_by)
    REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_chronic_package_delivered_by
    FOREIGN KEY (delivered_by)
    REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_chronic_package_transfer
    FOREIGN KEY (medication_transfer_id)
    REFERENCES medication_transfers(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_chronic_package_delivery
    FOREIGN KEY (medication_delivery_id)
    REFERENCES medication_deliveries(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS chronic_medication_package_items (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  chronic_medication_package_id BIGINT NOT NULL,
  medication_id BIGINT NOT NULL,
  medication_batch_id BIGINT NULL,
  planned_quantity DECIMAL(12,2) NOT NULL,
  delivered_quantity DECIMAL(12,2) NULL,
  item_status ENUM(
    'pendiente',
    'enviado',
    'retirado'
  ) NOT NULL DEFAULT 'pendiente',
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_chronic_package_items_package (chronic_medication_package_id),
  INDEX idx_chronic_package_items_medication (medication_id),
  CONSTRAINT fk_chronic_package_items_package
    FOREIGN KEY (chronic_medication_package_id)
    REFERENCES chronic_medication_packages(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_chronic_package_items_medication
    FOREIGN KEY (medication_id)
    REFERENCES medications(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_chronic_package_items_batch
    FOREIGN KEY (medication_batch_id)
    REFERENCES medication_batches(id)
    ON DELETE SET NULL
);
