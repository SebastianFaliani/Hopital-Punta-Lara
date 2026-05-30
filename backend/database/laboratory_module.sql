CREATE TABLE IF NOT EXISTS laboratory_records (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  study_date DATE NOT NULL,
  patient_last_name VARCHAR(150) NOT NULL,
  patient_first_name VARCHAR(150) NOT NULL,
  patient_document VARCHAR(50) NULL,
  has_blood_extraction BOOLEAN NOT NULL DEFAULT FALSE,
  has_urine_sample BOOLEAN NOT NULL DEFAULT FALSE,
  pickup_date DATE NULL,
  picked_up_by VARCHAR(255) NULL,
  pickup_document VARCHAR(50) NULL,
  notes TEXT NULL,
  created_by BIGINT NULL,
  updated_by BIGINT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_laboratory_records_created_by
    FOREIGN KEY (created_by)
    REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_laboratory_records_updated_by
    FOREIGN KEY (updated_by)
    REFERENCES users(id)
    ON DELETE SET NULL,
  INDEX idx_laboratory_records_study_date (study_date),
  INDEX idx_laboratory_records_pickup_date (pickup_date),
  INDEX idx_laboratory_records_patient (patient_last_name, patient_first_name),
  INDEX idx_laboratory_records_document (patient_document)
);
