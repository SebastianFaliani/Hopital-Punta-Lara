CREATE TABLE IF NOT EXISTS nutrition_patients (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  first_name VARCHAR(120) NOT NULL,
  last_name VARCHAR(120) NOT NULL,
  document VARCHAR(30) NULL,
  birth_date DATE NULL,
  phone VARCHAR(50) NULL,
  target_weight_kg DECIMAL(6,2) NULL,
  nutritional_diagnosis TEXT NULL,
  meal_plan TEXT NULL,
  physical_activity TEXT NULL,
  has_diabetes BOOLEAN NOT NULL DEFAULT FALSE,
  has_hypertension BOOLEAN NOT NULL DEFAULT FALSE,
  has_high_cholesterol BOOLEAN NOT NULL DEFAULT FALSE,
  medical_history TEXT NULL,
  notes TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by BIGINT NULL,
  updated_by BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_nutrition_patients_name (last_name, first_name),
  INDEX idx_nutrition_patients_document (document),
  CONSTRAINT fk_nutrition_patients_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_nutrition_patients_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(id)
    ON DELETE SET NULL
);

SET @nutrition_target_weight_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'nutrition_patients'
    AND column_name = 'target_weight_kg'
);

SET @nutrition_target_weight_sql = IF(
  @nutrition_target_weight_exists = 0,
  'ALTER TABLE nutrition_patients ADD COLUMN target_weight_kg DECIMAL(6,2) NULL AFTER phone',
  'SELECT 1'
);

PREPARE nutrition_target_weight_statement
  FROM @nutrition_target_weight_sql;
EXECUTE nutrition_target_weight_statement;
DEALLOCATE PREPARE nutrition_target_weight_statement;

SET @nutrition_diagnosis_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'nutrition_patients'
    AND column_name = 'nutritional_diagnosis'
);

SET @nutrition_diagnosis_sql = IF(
  @nutrition_diagnosis_exists = 0,
  'ALTER TABLE nutrition_patients ADD COLUMN nutritional_diagnosis TEXT NULL AFTER target_weight_kg',
  'SELECT 1'
);

PREPARE nutrition_diagnosis_statement
  FROM @nutrition_diagnosis_sql;
EXECUTE nutrition_diagnosis_statement;
DEALLOCATE PREPARE nutrition_diagnosis_statement;

SET @nutrition_meal_plan_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'nutrition_patients'
    AND column_name = 'meal_plan'
);

SET @nutrition_meal_plan_sql = IF(
  @nutrition_meal_plan_exists = 0,
  'ALTER TABLE nutrition_patients ADD COLUMN meal_plan TEXT NULL AFTER nutritional_diagnosis',
  'SELECT 1'
);

PREPARE nutrition_meal_plan_statement
  FROM @nutrition_meal_plan_sql;
EXECUTE nutrition_meal_plan_statement;
DEALLOCATE PREPARE nutrition_meal_plan_statement;

SET @nutrition_physical_activity_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'nutrition_patients'
    AND column_name = 'physical_activity'
);

SET @nutrition_physical_activity_sql = IF(
  @nutrition_physical_activity_exists = 0,
  'ALTER TABLE nutrition_patients ADD COLUMN physical_activity TEXT NULL AFTER meal_plan',
  'SELECT 1'
);

PREPARE nutrition_physical_activity_statement
  FROM @nutrition_physical_activity_sql;
EXECUTE nutrition_physical_activity_statement;
DEALLOCATE PREPARE nutrition_physical_activity_statement;

SET @nutrition_diabetes_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'nutrition_patients'
    AND column_name = 'has_diabetes'
);

SET @nutrition_diabetes_sql = IF(
  @nutrition_diabetes_exists = 0,
  'ALTER TABLE nutrition_patients ADD COLUMN has_diabetes BOOLEAN NOT NULL DEFAULT FALSE AFTER physical_activity',
  'SELECT 1'
);

PREPARE nutrition_diabetes_statement
  FROM @nutrition_diabetes_sql;
EXECUTE nutrition_diabetes_statement;
DEALLOCATE PREPARE nutrition_diabetes_statement;

SET @nutrition_hypertension_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'nutrition_patients'
    AND column_name = 'has_hypertension'
);

SET @nutrition_hypertension_sql = IF(
  @nutrition_hypertension_exists = 0,
  'ALTER TABLE nutrition_patients ADD COLUMN has_hypertension BOOLEAN NOT NULL DEFAULT FALSE AFTER has_diabetes',
  'SELECT 1'
);

PREPARE nutrition_hypertension_statement
  FROM @nutrition_hypertension_sql;
EXECUTE nutrition_hypertension_statement;
DEALLOCATE PREPARE nutrition_hypertension_statement;

SET @nutrition_cholesterol_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'nutrition_patients'
    AND column_name = 'has_high_cholesterol'
);

SET @nutrition_cholesterol_sql = IF(
  @nutrition_cholesterol_exists = 0,
  'ALTER TABLE nutrition_patients ADD COLUMN has_high_cholesterol BOOLEAN NOT NULL DEFAULT FALSE AFTER has_hypertension',
  'SELECT 1'
);

PREPARE nutrition_cholesterol_statement
  FROM @nutrition_cholesterol_sql;
EXECUTE nutrition_cholesterol_statement;
DEALLOCATE PREPARE nutrition_cholesterol_statement;

SET @nutrition_history_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'nutrition_patients'
    AND column_name = 'medical_history'
);

SET @nutrition_history_sql = IF(
  @nutrition_history_exists = 0,
  'ALTER TABLE nutrition_patients ADD COLUMN medical_history TEXT NULL AFTER has_high_cholesterol',
  'SELECT 1'
);

PREPARE nutrition_history_statement
  FROM @nutrition_history_sql;
EXECUTE nutrition_history_statement;
DEALLOCATE PREPARE nutrition_history_statement;

CREATE TABLE IF NOT EXISTS nutrition_controls (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  patient_id BIGINT NOT NULL,
  control_date DATE NOT NULL,
  weight_kg DECIMAL(6,2) NOT NULL,
  height_m DECIMAL(4,2) NOT NULL,
  bmi DECIMAL(5,2) NOT NULL,
  waist_circumference_cm DECIMAL(6,2) NULL,
  notes TEXT NULL,
  created_by BIGINT NULL,
  updated_by BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_nutrition_controls_patient_date (patient_id, control_date),
  INDEX idx_nutrition_controls_date (control_date),
  CONSTRAINT fk_nutrition_controls_patient
    FOREIGN KEY (patient_id) REFERENCES nutrition_patients(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_nutrition_controls_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_nutrition_controls_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(id)
    ON DELETE SET NULL
);

INSERT INTO permissions (
  permission_key,
  module_name,
  description,
  sort_order
)
VALUES
  ('nutrition.view', 'Nutricion', 'Ver pacientes y controles nutricionales', 55),
  ('nutrition.manage', 'Nutricion', 'Administrar pacientes y controles nutricionales', 56)
ON DUPLICATE KEY UPDATE
  module_name = VALUES(module_name),
  description = VALUES(description),
  sort_order = VALUES(sort_order);

INSERT INTO role_permissions (role_id, permission_id, allowed)
SELECT r.id, p.id, TRUE
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'admin'
ON DUPLICATE KEY UPDATE allowed = VALUES(allowed);

INSERT INTO role_permissions (role_id, permission_id, allowed)
SELECT r.id, p.id, TRUE
FROM roles r
INNER JOIN permissions p
  ON p.permission_key IN (
    'nutrition.view',
    'nutrition.manage'
  )
WHERE r.name = 'user'
ON DUPLICATE KEY UPDATE allowed = VALUES(allowed);

INSERT INTO role_permissions (role_id, permission_id, allowed)
SELECT r.id, p.id, TRUE
FROM roles r
INNER JOIN permissions p
  ON p.permission_key = 'nutrition.view'
WHERE r.name = 'dir'
ON DUPLICATE KEY UPDATE allowed = VALUES(allowed);
