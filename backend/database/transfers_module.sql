CREATE TABLE IF NOT EXISTS ambulance_types (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ambulance_types_name (name)
);

INSERT IGNORE INTO ambulance_types (name, is_active)
VALUES
  ('TRASLADO', TRUE),
  ('UTIM', TRUE),
  ('PEDIATRICA', TRUE);

CREATE TABLE IF NOT EXISTS ambulances (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  internal_code VARCHAR(50) NOT NULL,
  plate VARCHAR(20) NOT NULL,
  brand VARCHAR(100),
  model VARCHAR(100),
  ambulance_type_id BIGINT NULL,
  type VARCHAR(100) NOT NULL DEFAULT 'TRASLADO',
  status ENUM('disponible', 'en_viaje', 'mantenimiento') NOT NULL DEFAULT 'disponible',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_ambulances_internal_code (internal_code),
  UNIQUE KEY uk_ambulances_plate (plate),
  INDEX idx_ambulances_type_id (ambulance_type_id),
  CONSTRAINT fk_ambulances_type
    FOREIGN KEY (ambulance_type_id) REFERENCES ambulance_types(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS drivers (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  employee_id BIGINT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(50),
  license_number VARCHAR(100),
  license_expiration_date DATE NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_drivers_employee (employee_id),
  INDEX idx_drivers_employee (employee_id),
  CONSTRAINT fk_drivers_employee
    FOREIGN KEY (employee_id) REFERENCES employees(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS driver_shifts (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  driver_id BIGINT NOT NULL,
  ambulance_id BIGINT NOT NULL,
  start_datetime DATETIME NOT NULL,
  end_datetime DATETIME NOT NULL,
  status ENUM('programada', 'activa', 'finalizada') DEFAULT 'programada',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_driver_shifts_driver (driver_id),
  INDEX idx_driver_shifts_ambulance (ambulance_id),
  INDEX idx_driver_shifts_dates (start_datetime, end_datetime),
  CONSTRAINT fk_driver_shifts_driver
    FOREIGN KEY (driver_id) REFERENCES drivers(id),
  CONSTRAINT fk_driver_shifts_ambulance
    FOREIGN KEY (ambulance_id) REFERENCES ambulances(id)
);

CREATE TABLE IF NOT EXISTS transfer_holidays (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  holiday_date DATE NOT NULL,
  name VARCHAR(150) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_transfer_holiday_date (holiday_date)
);

CREATE TABLE IF NOT EXISTS ambulance_maintenance_records (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  ambulance_id BIGINT NOT NULL,
  maintenance_type ENUM(
    'service',
    'mecanica',
    'cubiertas',
    'aceite',
    'frenos',
    'electricidad',
    'limpieza',
    'verificacion',
    'otro'
  ) NOT NULL DEFAULT 'service',
  start_date DATE NOT NULL,
  end_date DATE NULL,
  odometer_km INT NULL,
  workshop_name VARCHAR(150) NULL,
  description TEXT NULL,
  next_service_date DATE NULL,
  next_service_km INT NULL,
  status ENUM('programado', 'en_reparacion', 'finalizado', 'cancelado')
    NOT NULL DEFAULT 'programado',
  notes TEXT NULL,
  created_by BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_ambulance_maintenance_ambulance (ambulance_id),
  INDEX idx_ambulance_maintenance_dates (start_date, end_date),
  INDEX idx_ambulance_maintenance_status (status),
  CONSTRAINT fk_ambulance_maintenance_ambulance
    FOREIGN KEY (ambulance_id) REFERENCES ambulances(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_ambulance_maintenance_user
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL
);

