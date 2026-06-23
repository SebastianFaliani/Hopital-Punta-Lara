SET @column_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'employees'
    AND COLUMN_NAME = 'work_shift'
);

SET @sql := IF(
  @column_exists = 0,
  "ALTER TABLE employees ADD COLUMN work_shift ENUM('manana','tarde','vespertino','noche') NULL AFTER employment_type",
  "SELECT 1"
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'employees'
    AND COLUMN_NAME = 'shift_start_time'
);

SET @sql := IF(
  @column_exists = 0,
  "ALTER TABLE employees ADD COLUMN shift_start_time TIME NULL AFTER work_shift",
  "SELECT 1"
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'employees'
    AND COLUMN_NAME = 'shift_end_time'
);

SET @sql := IF(
  @column_exists = 0,
  "ALTER TABLE employees ADD COLUMN shift_end_time TIME NULL AFTER shift_start_time",
  "SELECT 1"
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
