SET @column_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'driver_shifts'
    AND COLUMN_NAME = 'covered_by_driver_id'
);

SET @sql := IF(
  @column_exists = 0,
  "ALTER TABLE driver_shifts ADD COLUMN covered_by_driver_id BIGINT NULL AFTER driver_id",
  "SELECT 1"
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'driver_shifts'
    AND INDEX_NAME = 'idx_driver_shifts_covered_by_driver'
);

SET @sql := IF(
  @index_exists = 0,
  "ALTER TABLE driver_shifts ADD INDEX idx_driver_shifts_covered_by_driver (covered_by_driver_id)",
  "SELECT 1"
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'driver_shifts'
    AND CONSTRAINT_NAME = 'fk_driver_shifts_covered_by_driver'
);

SET @sql := IF(
  @fk_exists = 0,
  "ALTER TABLE driver_shifts ADD CONSTRAINT fk_driver_shifts_covered_by_driver FOREIGN KEY (covered_by_driver_id) REFERENCES drivers(id) ON DELETE SET NULL",
  "SELECT 1"
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS driver_shift_changes (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  shift_id BIGINT NOT NULL,
  original_driver_id BIGINT NOT NULL,
  previous_covering_driver_id BIGINT NULL,
  covering_driver_id BIGINT NULL,
  reason VARCHAR(120) NULL,
  notes VARCHAR(255) NULL,
  changed_by BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_driver_shift_changes_shift (shift_id),
  INDEX idx_driver_shift_changes_original (original_driver_id),
  INDEX idx_driver_shift_changes_covering (covering_driver_id),
  INDEX idx_driver_shift_changes_created (created_at),
  CONSTRAINT fk_driver_shift_changes_shift
    FOREIGN KEY (shift_id) REFERENCES driver_shifts(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_driver_shift_changes_original
    FOREIGN KEY (original_driver_id) REFERENCES drivers(id),
  CONSTRAINT fk_driver_shift_changes_previous_covering
    FOREIGN KEY (previous_covering_driver_id) REFERENCES drivers(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_driver_shift_changes_covering
    FOREIGN KEY (covering_driver_id) REFERENCES drivers(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_driver_shift_changes_user
    FOREIGN KEY (changed_by) REFERENCES users(id)
    ON DELETE SET NULL
);
