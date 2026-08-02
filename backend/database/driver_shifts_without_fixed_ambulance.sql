SET @column_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'driver_shifts'
    AND COLUMN_NAME = 'shift_date'
);

SET @sql := IF(
  @column_exists = 0,
  "ALTER TABLE driver_shifts ADD COLUMN shift_date DATE NULL AFTER driver_id",
  "SELECT 1"
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'driver_shifts'
    AND COLUMN_NAME = 'shift_type'
);

SET @sql := IF(
  @column_exists = 0,
  "ALTER TABLE driver_shifts ADD COLUMN shift_type ENUM('manana', 'tarde') NULL AFTER shift_date",
  "SELECT 1"
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'driver_shifts'
    AND COLUMN_NAME = 'notes'
);

SET @sql := IF(
  @column_exists = 0,
  "ALTER TABLE driver_shifts ADD COLUMN notes VARCHAR(255) NULL AFTER status",
  "SELECT 1"
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE driver_shifts
SET
  shift_date = DATE(start_datetime),
  shift_type =
    CASE
      WHEN TIME(start_datetime) < '12:00:00' THEN 'manana'
      ELSE 'tarde'
    END
WHERE shift_date IS NULL
  OR shift_type IS NULL;

ALTER TABLE driver_shifts
  MODIFY ambulance_id BIGINT NULL;

SET @index_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'driver_shifts'
    AND INDEX_NAME = 'idx_driver_shifts_shift_date'
);

SET @sql := IF(
  @index_exists = 0,
  "ALTER TABLE driver_shifts ADD INDEX idx_driver_shifts_shift_date (shift_date, shift_type)",
  "SELECT 1"
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
