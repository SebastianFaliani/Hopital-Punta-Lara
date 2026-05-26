ALTER TABLE leave_requests
  ADD COLUMN permission_kind ENUM('salida','entrada') NOT NULL DEFAULT 'salida' AFTER total_hours;
