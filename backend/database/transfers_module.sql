CREATE TABLE IF NOT EXISTS ambulances (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  internal_code VARCHAR(50) NOT NULL,
  plate VARCHAR(20) NOT NULL,
  brand VARCHAR(100),
  model VARCHAR(100),
  type ENUM('traslado', 'utim', 'pediatrica') NOT NULL DEFAULT 'traslado',
  status ENUM('disponible', 'en_viaje', 'mantenimiento') NOT NULL DEFAULT 'disponible',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_ambulances_internal_code (internal_code),
  UNIQUE KEY uk_ambulances_plate (plate)
);

CREATE TABLE IF NOT EXISTS drivers (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(50),
  license_number VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
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

CREATE TABLE IF NOT EXISTS transfer_requests (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  patient_id BIGINT NULL,
  patient_name VARCHAR(255) NOT NULL,
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
  transfer_date DATE NOT NULL,
  notes TEXT,
  requires_return BOOLEAN DEFAULT FALSE,
  status ENUM(
    'pendiente',
    'programado',
    'en_proceso',
    'finalizado',
    'cancelado'
  ) DEFAULT 'pendiente',
  created_by BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_transfer_requests_date (transfer_date),
  INDEX idx_transfer_requests_status (status),
  CONSTRAINT fk_transfer_requests_user
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS transfer_trips (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  transfer_request_id BIGINT NOT NULL,
  trip_type ENUM('ida', 'vuelta') NOT NULL,
  ambulance_id BIGINT NULL,
  driver_id BIGINT NULL,
  scheduled_datetime DATETIME NULL,
  departure_datetime DATETIME NULL,
  arrival_datetime DATETIME NULL,
  status ENUM(
    'pendiente',
    'asignado',
    'en_camino',
    'completado',
    'cancelado'
  ) DEFAULT 'pendiente',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_transfer_trips_request (transfer_request_id),
  INDEX idx_transfer_trips_schedule (scheduled_datetime),
  CONSTRAINT fk_transfer_trips_request
    FOREIGN KEY (transfer_request_id) REFERENCES transfer_requests(id),
  CONSTRAINT fk_transfer_trips_ambulance
    FOREIGN KEY (ambulance_id) REFERENCES ambulances(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_transfer_trips_driver
    FOREIGN KEY (driver_id) REFERENCES drivers(id)
    ON DELETE SET NULL
);
