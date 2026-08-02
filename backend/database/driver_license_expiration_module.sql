ALTER TABLE drivers
  ADD COLUMN license_expiration_date DATE NULL AFTER license_number,
  ADD INDEX idx_drivers_license_expiration (license_expiration_date);
