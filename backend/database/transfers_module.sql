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

CREATE TABLE IF NOT EXISTS transfer_holidays (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  holiday_date DATE NOT NULL,
  name VARCHAR(150) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_transfer_holiday_date (holiday_date)
);

