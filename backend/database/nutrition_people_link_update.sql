SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE nutrition_patients ADD COLUMN patient_id BIGINT NULL AFTER id',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'nutrition_patients'
    AND COLUMN_NAME = 'patient_id'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE nutrition_patients ADD INDEX idx_nutrition_patients_patient_id (patient_id)',
    'SELECT 1'
  )
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'nutrition_patients'
    AND INDEX_NAME = 'idx_nutrition_patients_patient_id'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

INSERT INTO people (
  document_number,
  document_type,
  last_name,
  first_name,
  phone,
  birth_date
)
SELECT
  NULLIF(REGEXP_REPLACE(np.document, '[^0-9]', ''), ''),
  CASE
    WHEN NULLIF(REGEXP_REPLACE(np.document, '[^0-9]', ''), '') IS NULL THEN NULL
    ELSE 'DNI'
  END,
  UPPER(TRIM(np.last_name)),
  UPPER(TRIM(np.first_name)),
  NULLIF(TRIM(np.phone), ''),
  np.birth_date
FROM nutrition_patients np
WHERE np.patient_id IS NULL
  AND NULLIF(TRIM(np.last_name), '') IS NOT NULL
  AND NULLIF(TRIM(np.first_name), '') IS NOT NULL
  AND NULLIF(REGEXP_REPLACE(np.document, '[^0-9]', ''), '') IS NOT NULL
ON DUPLICATE KEY UPDATE
  document_type = COALESCE(NULLIF(people.document_type, ''), VALUES(document_type)),
  last_name = COALESCE(NULLIF(people.last_name, ''), VALUES(last_name)),
  first_name = COALESCE(NULLIF(people.first_name, ''), VALUES(first_name)),
  phone = COALESCE(NULLIF(people.phone, ''), VALUES(phone)),
  birth_date = COALESCE(people.birth_date, VALUES(birth_date));

UPDATE nutrition_patients np
INNER JOIN people p
  ON p.document_number COLLATE utf8mb4_general_ci =
    REGEXP_REPLACE(np.document, '[^0-9]', '') COLLATE utf8mb4_general_ci
SET np.patient_id = p.id
WHERE np.patient_id IS NULL
  AND NULLIF(REGEXP_REPLACE(np.document, '[^0-9]', ''), '') IS NOT NULL;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE nutrition_patients ADD CONSTRAINT fk_nutrition_patients_people FOREIGN KEY (patient_id) REFERENCES people(id) ON DELETE SET NULL',
    'SELECT 1'
  )
  FROM information_schema.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'nutrition_patients'
    AND CONSTRAINT_NAME = 'fk_nutrition_patients_people'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
