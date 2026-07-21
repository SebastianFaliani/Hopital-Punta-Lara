CREATE TABLE IF NOT EXISTS people (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  document_number VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  last_name VARCHAR(150) NOT NULL,
  first_name VARCHAR(150) NOT NULL,
  phone VARCHAR(80) NULL,
  birth_date DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_people_document_number (document_number),
  INDEX idx_people_name (last_name, first_name)
);

ALTER TABLE laboratory_records
  ADD COLUMN patient_id BIGINT NULL AFTER protocol_number;

ALTER TABLE laboratory_records
  ADD INDEX idx_laboratory_records_patient_id (patient_id);

ALTER TABLE laboratory_records
  ADD CONSTRAINT fk_laboratory_records_patient
    FOREIGN KEY (patient_id)
    REFERENCES people(id)
    ON DELETE SET NULL;

ALTER TABLE laboratory_records
  MODIFY status ENUM('enviado','parcial','completo','retirado','expirado') NOT NULL DEFAULT 'enviado';

INSERT INTO people (
  document_number,
  last_name,
  first_name,
  phone,
  birth_date
)
SELECT
  patient_document,
  MAX(patient_last_name),
  MAX(patient_first_name),
  MAX(patient_phone),
  MAX(patient_birth_date)
FROM laboratory_records
WHERE patient_document IS NOT NULL
  AND TRIM(patient_document) <> ''
GROUP BY patient_document
ON DUPLICATE KEY UPDATE
  last_name = VALUES(last_name),
  first_name = VALUES(first_name),
  phone = COALESCE(VALUES(phone), people.phone),
  birth_date = COALESCE(VALUES(birth_date), people.birth_date);

UPDATE laboratory_records lr
INNER JOIN people p
  ON p.document_number COLLATE utf8mb4_general_ci =
    lr.patient_document COLLATE utf8mb4_general_ci
SET lr.patient_id = p.id
WHERE lr.patient_id IS NULL
  AND lr.patient_document IS NOT NULL
  AND TRIM(lr.patient_document) <> '';
