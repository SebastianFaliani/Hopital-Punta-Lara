CREATE TABLE IF NOT EXISTS leave_rules (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  attendance_code_id BIGINT NOT NULL,
  name VARCHAR(150) NOT NULL,
  min_advance_days INT NULL,
  max_days_per_request DECIMAL(6,2) NULL,
  max_days_per_year DECIMAL(6,2) NULL,
  max_hours_per_day DECIMAL(6,2) NULL,
  max_hours_per_week DECIMAL(6,2) NULL,
  max_hours_per_month DECIMAL(6,2) NULL,
  max_hours_per_year DECIMAL(6,2) NULL,
  requires_documentation BOOLEAN DEFAULT FALSE,
  requires_medical_order BOOLEAN DEFAULT FALSE,
  gender_condition ENUM(
    'cualquiera',
    'femenino',
    'masculino'
  ) DEFAULT 'cualquiera',
  seniority_min_years DECIMAL(5,2) NULL,
  seniority_max_years DECIMAL(5,2) NULL,
  rule_notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_leave_rules_code_name (attendance_code_id, name),
  INDEX idx_leave_rules_code (attendance_code_id),
  CONSTRAINT fk_leave_rules_code
    FOREIGN KEY (attendance_code_id)
    REFERENCES attendance_codes(id)
);

INSERT INTO leave_rules (
  attendance_code_id,
  name,
  min_advance_days,
  max_days_per_request,
  max_days_per_year,
  max_hours_per_day,
  max_hours_per_week,
  max_hours_per_month,
  max_hours_per_year,
  rule_notes,
  is_active
)
SELECT
  ac.id,
  seed.name,
  seed.min_advance_days,
  seed.max_days_per_request,
  seed.max_days_per_year,
  seed.max_hours_per_day,
  seed.max_hours_per_week,
  seed.max_hours_per_month,
  seed.max_hours_per_year,
  seed.rule_notes,
  TRUE
FROM attendance_codes ac
INNER JOIN (
  SELECT '8' AS code, 'Licencia anual' AS name, 15 AS min_advance_days, NULL AS max_days_per_request, NULL AS max_days_per_year, NULL AS max_hours_per_day, NULL AS max_hours_per_week, NULL AS max_hours_per_month, NULL AS max_hours_per_year, 'Del 1 al 15, hasta agosto, descuenta saldo anual y puede fraccionarse hasta 2 veces.' AS rule_notes
  UNION ALL SELECT '29', 'Licencia anual complementaria', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Solo desde agosto y debe tomarse completa de una sola vez.'
  UNION ALL SELECT '26', 'Asuntos particulares', 2, 1, 6, NULL, NULL, NULL, NULL, 'Requiere 48 hs de anticipacion, maximo 6 dias anuales y una solicitud por mes.'
  UNION ALL SELECT '24', 'Llegada tarde', NULL, NULL, NULL, 2, NULL, 5, 30, 'Maximo 2 horas por dia. Comparte limite mensual de 5 horas y anual de 30 horas con clave 43.'
  UNION ALL SELECT '43', 'Permiso de salida', NULL, NULL, NULL, 2, NULL, 5, 30, 'Maximo 2 horas por dia. Puede quedar con regreso pendiente. Comparte limite mensual de 5 horas y anual de 30 horas con clave 24.'
  UNION ALL SELECT '46', 'Permiso gremial', NULL, NULL, NULL, NULL, 5, NULL, NULL, 'Maximo 5 horas semanales.'
  UNION ALL SELECT '34', 'Franco compensatorio', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Requiere saldo compensatorio disponible.'
  UNION ALL SELECT '5', 'Atencion familiar enfermo', NULL, NULL, 20, NULL, NULL, NULL, NULL, 'Maximo 20 dias por anio.'
  UNION ALL SELECT '6', 'Maternidad', NULL, 90, NULL, NULL, NULL, NULL, NULL, 'Maximo 90 dias.'
  UNION ALL SELECT '42', 'Adopcion', NULL, 90, NULL, NULL, NULL, NULL, NULL, 'Maximo 90 dias.'
  UNION ALL SELECT '14', 'Duelo familiar directo', NULL, 3, NULL, NULL, NULL, NULL, NULL, 'Maximo 3 dias corridos.'
  UNION ALL SELECT '15', 'Duelo familiar indirecto', NULL, 1, NULL, NULL, NULL, NULL, NULL, 'Permite 1 dia.'
  UNION ALL SELECT '16', 'Matrimonio', NULL, 10, NULL, NULL, NULL, NULL, NULL, 'Maximo 10 dias corridos.'
  UNION ALL SELECT '17', 'Pre examen', NULL, 2, NULL, NULL, NULL, NULL, NULL, 'Maximo 2 dias por materia.'
  UNION ALL SELECT '18', 'Examen', NULL, 1, NULL, NULL, NULL, NULL, NULL, 'Permite 1 dia por examen.'
  UNION ALL SELECT '31', 'Nacimiento de hijo', NULL, 3, NULL, NULL, NULL, NULL, NULL, 'Maximo 3 dias.'
  UNION ALL SELECT '33', 'Donacion de sangre', NULL, 1, NULL, NULL, NULL, NULL, NULL, 'Permite 1 dia.'
  UNION ALL SELECT '35', 'Alimentacion y cuidado de hijo', NULL, NULL, NULL, 2, NULL, NULL, NULL, 'Permite hasta 2 horas diarias.'
) seed
  ON seed.code = ac.code
WHERE NOT EXISTS (
  SELECT 1
  FROM leave_rules lr
  WHERE lr.attendance_code_id = ac.id
    AND lr.name = seed.name
);

UPDATE leave_rules lr
INNER JOIN attendance_codes ac
  ON ac.id = lr.attendance_code_id
INNER JOIN (
  SELECT '8' AS code, 'Licencia anual' AS name, 15 AS min_advance_days, NULL AS max_days_per_request, NULL AS max_days_per_year, NULL AS max_hours_per_day, NULL AS max_hours_per_week, NULL AS max_hours_per_month, NULL AS max_hours_per_year, 'Del 1 al 15, hasta agosto, descuenta saldo anual y puede fraccionarse hasta 2 veces.' AS rule_notes
  UNION ALL SELECT '29', 'Licencia anual complementaria', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Solo desde agosto y debe tomarse completa de una sola vez.'
  UNION ALL SELECT '26', 'Asuntos particulares', 2, 1, 6, NULL, NULL, NULL, NULL, 'Requiere 48 hs de anticipacion, maximo 6 dias anuales y una solicitud por mes.'
  UNION ALL SELECT '24', 'Llegada tarde', NULL, NULL, NULL, 2, NULL, 5, 30, 'Maximo 2 horas por dia. Comparte limite mensual de 5 horas y anual de 30 horas con clave 43.'
  UNION ALL SELECT '43', 'Permiso de salida', NULL, NULL, NULL, 2, NULL, 5, 30, 'Maximo 2 horas por dia. Puede quedar con regreso pendiente. Comparte limite mensual de 5 horas y anual de 30 horas con clave 24.'
  UNION ALL SELECT '46', 'Permiso gremial', NULL, NULL, NULL, NULL, 5, NULL, NULL, 'Maximo 5 horas semanales.'
  UNION ALL SELECT '34', 'Franco compensatorio', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Requiere saldo compensatorio disponible.'
  UNION ALL SELECT '5', 'Atencion familiar enfermo', NULL, NULL, 20, NULL, NULL, NULL, NULL, 'Maximo 20 dias por anio.'
  UNION ALL SELECT '6', 'Maternidad', NULL, 90, NULL, NULL, NULL, NULL, NULL, 'Maximo 90 dias.'
  UNION ALL SELECT '42', 'Adopcion', NULL, 90, NULL, NULL, NULL, NULL, NULL, 'Maximo 90 dias.'
  UNION ALL SELECT '14', 'Duelo familiar directo', NULL, 3, NULL, NULL, NULL, NULL, NULL, 'Maximo 3 dias corridos.'
  UNION ALL SELECT '15', 'Duelo familiar indirecto', NULL, 1, NULL, NULL, NULL, NULL, NULL, 'Permite 1 dia.'
  UNION ALL SELECT '16', 'Matrimonio', NULL, 10, NULL, NULL, NULL, NULL, NULL, 'Maximo 10 dias corridos.'
  UNION ALL SELECT '17', 'Pre examen', NULL, 2, NULL, NULL, NULL, NULL, NULL, 'Maximo 2 dias por materia.'
  UNION ALL SELECT '18', 'Examen', NULL, 1, NULL, NULL, NULL, NULL, NULL, 'Permite 1 dia por examen.'
  UNION ALL SELECT '31', 'Nacimiento de hijo', NULL, 3, NULL, NULL, NULL, NULL, NULL, 'Maximo 3 dias.'
  UNION ALL SELECT '33', 'Donacion de sangre', NULL, 1, NULL, NULL, NULL, NULL, NULL, 'Permite 1 dia.'
  UNION ALL SELECT '35', 'Alimentacion y cuidado de hijo', NULL, NULL, NULL, 2, NULL, NULL, NULL, 'Permite hasta 2 horas diarias.'
) seed
  ON seed.code = ac.code
  AND seed.name = lr.name
SET
  lr.min_advance_days = seed.min_advance_days,
  lr.max_days_per_request = seed.max_days_per_request,
  lr.max_days_per_year = seed.max_days_per_year,
  lr.max_hours_per_day = seed.max_hours_per_day,
  lr.max_hours_per_week = seed.max_hours_per_week,
  lr.max_hours_per_month = seed.max_hours_per_month,
  lr.max_hours_per_year = seed.max_hours_per_year,
  lr.rule_notes = seed.rule_notes,
  lr.is_active = TRUE;
