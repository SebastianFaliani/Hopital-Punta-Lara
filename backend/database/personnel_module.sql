CREATE TABLE IF NOT EXISTS employee_departments (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_employee_departments_name (name)
);

CREATE TABLE IF NOT EXISTS employees (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  department_id BIGINT NULL,
  full_name VARCHAR(255) NOT NULL,
  dni VARCHAR(20),
  cuil VARCHAR(20),
  birth_date DATE NULL,
  hire_date DATE NULL,
  file_number VARCHAR(80),
  address TEXT,
  phone VARCHAR(80),
  email VARCHAR(150),
  license_number VARCHAR(100),
  employment_type VARCHAR(100),
  work_shift ENUM(
    'manana',
    'tarde',
    'vespertino',
    'noche'
  ) NULL,
  shift_start_time TIME NULL,
  shift_end_time TIME NULL,
  is_professional BOOLEAN DEFAULT FALSE,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_employees_dni (dni),
  INDEX idx_employees_full_name (full_name),
  INDEX idx_employees_department (department_id),
  INDEX idx_employees_hire_date (hire_date),
  CONSTRAINT fk_employees_department
    FOREIGN KEY (department_id)
    REFERENCES employee_departments(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS attendance_codes (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(20) NOT NULL,
  description VARCHAR(255) NOT NULL,
  category ENUM(
    'presente',
    'ausencia',
    'franco',
    'licencia',
    'vacaciones',
    'maternidad',
    'gremial',
    'otro'
  ) DEFAULT 'otro',
  counts_as_present BOOLEAN DEFAULT FALSE,
  requires_approval BOOLEAN DEFAULT FALSE,
  requires_documentation BOOLEAN DEFAULT FALSE,
  affects_salary BOOLEAN DEFAULT FALSE,
  annual_limit_days DECIMAL(6,2) NULL,
  advance_notice_days INT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_attendance_codes_code (code)
);

CREATE TABLE IF NOT EXISTS attendance_periods (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  year INT NOT NULL,
  month INT NOT NULL,
  name VARCHAR(80) NOT NULL,
  status ENUM(
    'abierto',
    'cerrado'
  ) DEFAULT 'abierto',
  source_sheet_name VARCHAR(120),
  imported_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_attendance_periods_year_month (year, month)
);

CREATE TABLE IF NOT EXISTS attendance_records (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  employee_id BIGINT NOT NULL,
  attendance_period_id BIGINT NULL,
  attendance_code_id BIGINT NULL,
  attendance_date DATE NOT NULL,
  raw_code VARCHAR(30),
  notes TEXT,
  source ENUM(
    'manual',
    'excel_import'
  ) DEFAULT 'manual',
  created_by BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_attendance_employee_date (employee_id, attendance_date),
  INDEX idx_attendance_records_period (attendance_period_id),
  INDEX idx_attendance_records_code (attendance_code_id),
  INDEX idx_attendance_records_date (attendance_date),
  CONSTRAINT fk_attendance_records_employee
    FOREIGN KEY (employee_id)
    REFERENCES employees(id),
  CONSTRAINT fk_attendance_records_period
    FOREIGN KEY (attendance_period_id)
    REFERENCES attendance_periods(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_attendance_records_code
    FOREIGN KEY (attendance_code_id)
    REFERENCES attendance_codes(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_attendance_records_user
    FOREIGN KEY (created_by)
    REFERENCES users(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS employee_planned_days_off (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  employee_id BIGINT NOT NULL,
  off_date DATE NOT NULL,
  notes TEXT,
  created_by BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_employee_planned_days_off_employee_date (
    employee_id,
    off_date
  ),
  INDEX idx_employee_planned_days_off_date (off_date),
  CONSTRAINT fk_employee_planned_days_off_employee
    FOREIGN KEY (employee_id)
    REFERENCES employees(id),
  CONSTRAINT fk_employee_planned_days_off_user
    FOREIGN KEY (created_by)
    REFERENCES users(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS leave_rules (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  attendance_code_id BIGINT NOT NULL,
  name VARCHAR(150) NOT NULL,
  min_advance_days INT NULL,
  max_days_per_request DECIMAL(6,2) NULL,
  max_days_per_year DECIMAL(6,2) NULL,
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
  INDEX idx_leave_rules_code (attendance_code_id),
  CONSTRAINT fk_leave_rules_code
    FOREIGN KEY (attendance_code_id)
    REFERENCES attendance_codes(id)
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  employee_id BIGINT NOT NULL,
  attendance_code_id BIGINT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days DECIMAL(6,2) NOT NULL,
  total_hours DECIMAL(6,2) DEFAULT 0,
  is_exception BOOLEAN DEFAULT FALSE,
  exception_reason TEXT,
  status ENUM(
    'pendiente',
    'aprobado',
    'rechazado',
    'cancelado'
  ) DEFAULT 'pendiente',
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  requested_by BIGINT NULL,
  edited_by BIGINT NULL,
  edited_at DATETIME NULL,
  approved_by BIGINT NULL,
  approved_at DATETIME NULL,
  rejected_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_leave_requests_employee (employee_id),
  INDEX idx_leave_requests_code (attendance_code_id),
  INDEX idx_leave_requests_dates (start_date, end_date),
  INDEX idx_leave_requests_status (status),
  CONSTRAINT fk_leave_requests_employee
    FOREIGN KEY (employee_id)
    REFERENCES employees(id),
  CONSTRAINT fk_leave_requests_code
    FOREIGN KEY (attendance_code_id)
    REFERENCES attendance_codes(id),
  CONSTRAINT fk_leave_requests_requested_by
    FOREIGN KEY (requested_by)
    REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_leave_requests_edited_by
    FOREIGN KEY (edited_by)
    REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_leave_requests_approved_by
    FOREIGN KEY (approved_by)
    REFERENCES users(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS employee_leave_balances (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  employee_id BIGINT NOT NULL,
  attendance_code_id BIGINT NOT NULL,
  year INT NOT NULL,
  allowed_days DECIMAL(6,2) DEFAULT 0,
  used_days DECIMAL(6,2) DEFAULT 0,
  remaining_days DECIMAL(6,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_employee_leave_balance (
    employee_id,
    attendance_code_id,
    year
  ),
  CONSTRAINT fk_employee_leave_balances_employee
    FOREIGN KEY (employee_id)
    REFERENCES employees(id),
  CONSTRAINT fk_employee_leave_balances_code
    FOREIGN KEY (attendance_code_id)
    REFERENCES attendance_codes(id)
);

CREATE TABLE IF NOT EXISTS leave_balance_adjustments (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  employee_id BIGINT NOT NULL,
  attendance_code_id BIGINT NOT NULL,
  adjustment_date DATE NULL,
  year INT NOT NULL,
  month INT NULL,
  used_days DECIMAL(6,2) DEFAULT 0,
  used_hours DECIMAL(6,2) DEFAULT 0,
  notes TEXT,
  created_by BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_leave_balance_adjustments_employee (employee_id),
  INDEX idx_leave_balance_adjustments_code (attendance_code_id),
  INDEX idx_leave_balance_adjustments_date (adjustment_date),
  CONSTRAINT fk_leave_balance_adjustments_employee
    FOREIGN KEY (employee_id)
    REFERENCES employees(id),
  CONSTRAINT fk_leave_balance_adjustments_code
    FOREIGN KEY (attendance_code_id)
    REFERENCES attendance_codes(id),
  CONSTRAINT fk_leave_balance_adjustments_user
    FOREIGN KEY (created_by)
    REFERENCES users(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS vacation_seniority_rules (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  min_years DECIMAL(5,2) NOT NULL DEFAULT 0,
  max_years DECIMAL(5,2) NULL,
  allowed_days DECIMAL(6,2) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_vacation_seniority_rules_range (min_years, max_years)
);

INSERT INTO vacation_seniority_rules (
  min_years,
  max_years,
  allowed_days
) VALUES
(0, 5, 14),
(5, 10, 21),
(10, 20, 28),
(20, NULL, 35)
ON DUPLICATE KEY UPDATE
  allowed_days = VALUES(allowed_days);

INSERT INTO attendance_codes (
  code,
  description,
  category,
  counts_as_present,
  requires_approval,
  requires_documentation
) VALUES
('P', 'Presente', 'presente', TRUE, FALSE, FALSE),
('F', 'Franco', 'franco', FALSE, FALSE, FALSE),
('1', 'LICENCIA POR ENFERMEDAD', 'licencia', FALSE, TRUE, TRUE),
('4', 'LICENCIA POR ACCIDENTE DE TRABAJO', 'licencia', FALSE, TRUE, TRUE),
('5', 'LICENCIA POR ATENCION DE FAMILIAR ENFERMO', 'licencia', FALSE, TRUE, TRUE),
('6', 'LICENCIA POR MATERNIDAD', 'maternidad', FALSE, TRUE, TRUE),
('7', 'LICENCIA POR ENFERMEDAD PROFESIONAL', 'licencia', FALSE, TRUE, TRUE),
('8', 'LICENCIA ANUAL', 'vacaciones', FALSE, TRUE, FALSE),
('9', 'INCORPORACION A LAS FUERZAS ARMADAS', 'licencia', FALSE, TRUE, TRUE),
('11', 'LICENCIA POR DEFUNCION FETAL', 'maternidad', FALSE, TRUE, TRUE),
('12', 'PERMISOS POR ESTUDIOS/ACTIVIDAD CULTURAL SIN SUELDO', 'otro', FALSE, TRUE, TRUE),
('14', 'LICENCIA POR DUELO DE FAMILIAR DIRECTO', 'licencia', FALSE, TRUE, TRUE),
('15', 'LICENCIA POR DUELO FAMILIAR INDIRECTO', 'licencia', FALSE, TRUE, TRUE),
('16', 'LICENCIA POR MATRIMONIO', 'licencia', FALSE, TRUE, TRUE),
('17', 'LICENCIA POR PRE EXAMEN', 'licencia', FALSE, TRUE, TRUE),
('18', 'LICENCIA POR EXAMEN', 'licencia', FALSE, TRUE, TRUE),
('20', 'PERMISO ESPECIAL SIN SUELDO', 'otro', FALSE, TRUE, TRUE),
('21', 'LICENCIA POR ACTIVIDADES GREMIALES P/C SUELDO', 'gremial', FALSE, TRUE, TRUE),
('22', 'LICENCIA POR ACTIVIDADES GREMIALES', 'gremial', FALSE, TRUE, TRUE),
('23', 'ABANDONO DE CARGO', 'ausencia', FALSE, TRUE, TRUE),
('24', 'LLEGADA TARDE', 'ausencia', FALSE, FALSE, FALSE),
('26', 'PERMISO ASUNTOS PARTICULARES P/C SUELDO', 'otro', FALSE, TRUE, TRUE),
('28', 'INASISTENCIA SIN JUSTIFICAR', 'ausencia', FALSE, FALSE, FALSE),
('29', 'LICENCIA COMPLEMENTARIA', 'licencia', FALSE, TRUE, TRUE),
('2S', 'PERMISO ESPECIAL SIN SUELDO', 'otro', FALSE, TRUE, TRUE),
('30', 'COMISION DE SERVICIO', 'otro', TRUE, TRUE, TRUE),
('31', 'LICENCIA POR NACIMIENTO DE HIJO', 'licencia', FALSE, TRUE, TRUE),
('32', 'PASE EN COMISION', 'otro', TRUE, TRUE, TRUE),
('33', 'LICENCIA POR DONACION DE SANGRE', 'licencia', FALSE, TRUE, TRUE),
('34', 'FRANCO COMPENSATORIO', 'franco', FALSE, TRUE, FALSE),
('35', 'LICENCIA POR ALIMENTACION Y CUIDADO DE HIJO', 'maternidad', FALSE, TRUE, TRUE),
('37', 'PERMISO ACTIVIDAD DEPORTIVA/ARTISTICA SIN SUELDO', 'otro', FALSE, TRUE, TRUE),
('38', 'PERMISO ACTIVIDAD DEPORTIVA/ARTISTICA CON SUELDO', 'otro', FALSE, TRUE, TRUE),
('40', 'LICENCIA DECENAL SIN SUELDO', 'licencia', FALSE, TRUE, TRUE),
('41', 'LICENCIA POR DONACION DE ORGANO Y/O PIEL', 'licencia', FALSE, TRUE, TRUE),
('42', 'LICENCIA POR ADOPCION', 'maternidad', FALSE, TRUE, TRUE),
('43', 'PERMISOS HORAS DE SALIDA', 'otro', FALSE, TRUE, TRUE),
('44', 'PERMISOS CITACIONES ORGANISMOS OFICIALES', 'otro', FALSE, TRUE, TRUE),
('46', 'PERMISO GREMIAL (5 HORAS SEMANALES)', 'gremial', FALSE, TRUE, TRUE),
('51', 'LICENCIA SIN SUELDO', 'licencia', FALSE, TRUE, TRUE),
('52', 'LICENCIA CON SUELDO', 'licencia', FALSE, TRUE, TRUE),
('81', 'LICENCIA ANTERIOR DENEGADA', 'licencia', FALSE, TRUE, TRUE),
('93', 'LICENCIA COMPLEMENTARIA ANTERIOR DENEGADA', 'licencia', FALSE, TRUE, TRUE),
('A1', 'AUSENTE INSPECCION', 'ausencia', FALSE, FALSE, FALSE),
('AS', 'ASUETO', 'franco', FALSE, FALSE, FALSE),
('C', 'COMPENSATORIO', 'franco', TRUE, FALSE, FALSE),
('E', 'LICENCIA POR ENFERMEDAD/ACCIDENTE DE TRABAJO(PENDIENTE ENCUADRE)', 'licencia', FALSE, TRUE, TRUE),
('G1', 'GUARDIA NORMAL 12 HS', 'presente', TRUE, FALSE, FALSE),
('G2', 'GUARDIA NORMAL 24 HS', 'presente', TRUE, FALSE, FALSE),
('JM', 'JUNTA MEDICA', 'licencia', FALSE, TRUE, TRUE),
('PRO', 'PARO', 'ausencia', FALSE, FALSE, FALSE),
('S', 'SUSPENSION', 'ausencia', FALSE, TRUE, TRUE),
('SP', 'SUSPENSION PREVENTIVA', 'ausencia', FALSE, TRUE, TRUE),
('LC', 'LICENCIA POR CANDIDATURA', 'licencia', FALSE, TRUE, TRUE),
('DR', 'DISPONIBILIDAD RELATIVA', 'otro', FALSE, TRUE, TRUE),
('RC', 'RESERVA DE CARGO', 'otro', FALSE, TRUE, TRUE)
ON DUPLICATE KEY UPDATE
  description = VALUES(description),
  category = VALUES(category),
  counts_as_present = VALUES(counts_as_present),
  requires_approval = VALUES(requires_approval),
  requires_documentation = VALUES(requires_documentation);
