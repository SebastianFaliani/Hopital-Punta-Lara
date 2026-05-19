ALTER TABLE transfer_requests
  ADD COLUMN request_type ENUM(
    'programado',
    'recurrente',
    'oficio_urgente'
  ) NOT NULL DEFAULT 'programado' AFTER id,
  ADD COLUMN patient_document VARCHAR(30) NULL AFTER patient_name,
  ADD COLUMN patient_phone VARCHAR(50) NULL AFTER patient_document,
  ADD COLUMN appointment_datetime DATETIME NULL AFTER transfer_date,
  ADD COLUMN service_name VARCHAR(150) NULL AFTER appointment_datetime,
  ADD COLUMN mobility_type ENUM(
    'propios_medios',
    'asistencia',
    'silla_ruedas',
    'camilla',
    'otro'
  ) NOT NULL DEFAULT 'propios_medios' AFTER service_name,
  ADD COLUMN mobility_notes TEXT NULL AFTER mobility_type,
  ADD COLUMN justification TEXT NULL AFTER mobility_notes,
  ADD COLUMN requester_name VARCHAR(255) NULL AFTER justification,
  ADD COLUMN requester_role VARCHAR(150) NULL AFTER requester_name,
  ADD COLUMN requester_phone VARCHAR(50) NULL AFTER requester_role,
  ADD COLUMN is_advance_exception BOOLEAN NOT NULL DEFAULT FALSE AFTER requester_phone,
  ADD COLUMN exception_reason TEXT NULL AFTER is_advance_exception,
  ADD COLUMN exception_authorized_by BIGINT NULL AFTER exception_reason,
  ADD COLUMN confirmed_by BIGINT NULL AFTER exception_authorized_by,
  ADD COLUMN confirmed_at DATETIME NULL AFTER confirmed_by,
  ADD COLUMN rejected_reason TEXT NULL AFTER confirmed_at,
  ADD COLUMN recurring_template_id BIGINT NULL AFTER rejected_reason;

ALTER TABLE transfer_requests
  MODIFY COLUMN status ENUM(
    'pendiente',
    'pendiente_confirmacion',
    'programado',
    'confirmado',
    'rechazado',
    'en_proceso',
    'finalizado',
    'cancelado'
  ) NOT NULL DEFAULT 'pendiente_confirmacion';

ALTER TABLE transfer_requests
  ADD INDEX idx_transfer_requests_type (request_type),
  ADD INDEX idx_transfer_requests_recurring (recurring_template_id),
  ADD CONSTRAINT fk_transfer_requests_exception_user
    FOREIGN KEY (exception_authorized_by) REFERENCES users(id)
    ON DELETE SET NULL,
  ADD CONSTRAINT fk_transfer_requests_confirmed_user
    FOREIGN KEY (confirmed_by) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE transfer_trips
  ADD COLUMN scheduled_end_datetime DATETIME NULL AFTER scheduled_datetime,
  ADD COLUMN estimated_duration_minutes INT NOT NULL DEFAULT 60 AFTER scheduled_end_datetime,
  ADD COLUMN capacity_exception BOOLEAN NOT NULL DEFAULT FALSE AFTER estimated_duration_minutes,
  ADD COLUMN capacity_exception_reason TEXT NULL AFTER capacity_exception,
  ADD COLUMN capacity_exception_authorized_by BIGINT NULL AFTER capacity_exception_reason,
  ADD INDEX idx_transfer_trips_schedule_range (
    scheduled_datetime,
    scheduled_end_datetime
  ),
  ADD CONSTRAINT fk_transfer_trips_capacity_user
    FOREIGN KEY (capacity_exception_authorized_by) REFERENCES users(id)
    ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS transfer_capacity_rules (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  day_type ENUM(
    'lunes_viernes',
    'sabado',
    'domingo',
    'feriado'
  ) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  max_simultaneous INT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_transfer_capacity_rule (
    day_type,
    start_time,
    end_time
  )
);

INSERT IGNORE INTO transfer_capacity_rules (
  day_type,
  start_time,
  end_time,
  max_simultaneous
)
VALUES
  ('lunes_viernes', '08:00:00', '15:00:00', 2),
  ('lunes_viernes', '15:00:00', '21:00:00', 1),
  ('sabado', '08:00:00', '15:00:00', 1),
  ('sabado', '15:00:00', '22:00:00', 1),
  ('domingo', '08:00:00', '15:00:00', 1),
  ('domingo', '15:00:00', '22:00:00', 1),
  ('feriado', '08:00:00', '15:00:00', 1),
  ('feriado', '15:00:00', '22:00:00', 1);

CREATE TABLE IF NOT EXISTS transfer_holidays (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  holiday_date DATE NOT NULL,
  name VARCHAR(150) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_transfer_holiday_date (holiday_date)
);

CREATE TABLE IF NOT EXISTS recurring_transfer_templates (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  patient_id BIGINT NULL,
  patient_name VARCHAR(255) NOT NULL,
  patient_document VARCHAR(30) NULL,
  patient_phone VARCHAR(50) NULL,
  origin_address TEXT NOT NULL,
  destination_address TEXT NOT NULL,
  destination_type ENUM(
    'hospital',
    'clinica',
    'domicilio',
    'kinesiologia',
    'dialisis',
    'consultorio',
    'otro'
  ) NOT NULL,
  service_name VARCHAR(150) NULL,
  mobility_type ENUM(
    'propios_medios',
    'asistencia',
    'silla_ruedas',
    'camilla',
    'otro'
  ) NOT NULL DEFAULT 'propios_medios',
  mobility_notes TEXT NULL,
  justification TEXT NULL,
  requester_name VARCHAR(255) NULL,
  requester_role VARCHAR(150) NULL,
  requester_phone VARCHAR(50) NULL,
  weekdays VARCHAR(30) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NULL,
  outbound_time TIME NOT NULL,
  outbound_duration_minutes INT NOT NULL DEFAULT 60,
  requires_return BOOLEAN NOT NULL DEFAULT FALSE,
  return_time TIME NULL,
  return_duration_minutes INT NOT NULL DEFAULT 60,
  notes TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_recurring_transfer_active_dates (
    is_active,
    start_date,
    end_date
  ),
  CONSTRAINT fk_recurring_transfer_user
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL
);

ALTER TABLE transfer_requests
  ADD CONSTRAINT fk_transfer_requests_recurring
    FOREIGN KEY (recurring_template_id)
    REFERENCES recurring_transfer_templates(id)
    ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS transfer_route_print_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  route_date DATE NOT NULL,
  shift_name VARCHAR(50) NULL,
  ambulance_id BIGINT NULL,
  driver_id BIGINT NULL,
  printed_by BIGINT NULL,
  printed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_transfer_route_print_date (route_date),
  CONSTRAINT fk_transfer_route_print_ambulance
    FOREIGN KEY (ambulance_id) REFERENCES ambulances(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_transfer_route_print_driver
    FOREIGN KEY (driver_id) REFERENCES drivers(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_transfer_route_print_user
    FOREIGN KEY (printed_by) REFERENCES users(id)
    ON DELETE SET NULL
);
