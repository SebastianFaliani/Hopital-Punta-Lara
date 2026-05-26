CREATE TABLE IF NOT EXISTS vaccines (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  target_disease VARCHAR(255) NULL,
  presentation VARCHAR(100) NULL,
  dose_unit VARCHAR(50) NULL,
  description TEXT NULL,
  minimum_stock DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vaccine_batches (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  vaccine_id BIGINT NOT NULL,
  batch_number VARCHAR(100) NOT NULL,
  expiration_date DATE NOT NULL,
  current_stock DECIMAL(10,2) NOT NULL DEFAULT 0,
  purchase_price DECIMAL(10,2) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_vaccine_batches_vaccine
    FOREIGN KEY (vaccine_id)
    REFERENCES vaccines(id)
    ON DELETE RESTRICT,
  UNIQUE KEY uk_vaccine_batch_number (vaccine_id, batch_number)
);

CREATE TABLE IF NOT EXISTS vaccine_movements (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  vaccine_batch_id BIGINT NOT NULL,
  movement_type ENUM('ingreso','ajuste','perdida','devolucion') NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  reference_type VARCHAR(50) NULL,
  notes TEXT NULL,
  created_by BIGINT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_vaccine_movements_batch
    FOREIGN KEY (vaccine_batch_id)
    REFERENCES vaccine_batches(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_vaccine_movements_user
    FOREIGN KEY (created_by)
    REFERENCES users(id)
    ON DELETE SET NULL
);
