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

ALTER TABLE ambulances
  MODIFY COLUMN type VARCHAR(100) NOT NULL DEFAULT 'TRASLADO';

ALTER TABLE ambulances
  ADD COLUMN ambulance_type_id BIGINT NULL AFTER model,
  ADD INDEX idx_ambulances_type_id (ambulance_type_id);

UPDATE ambulances a
INNER JOIN ambulance_types at
  ON at.name =
    CASE
      WHEN LOWER(a.type) = 'utim' THEN 'UTIM'
      WHEN LOWER(a.type) = 'pediatrica' THEN 'PEDIATRICA'
      ELSE 'TRASLADO'
    END
SET a.ambulance_type_id = at.id
WHERE a.ambulance_type_id IS NULL;

UPDATE ambulances a
INNER JOIN ambulance_types at
  ON at.id = a.ambulance_type_id
SET a.type = at.name;

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
