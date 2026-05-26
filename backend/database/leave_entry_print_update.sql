ALTER TABLE leave_requests
  ADD COLUMN IF NOT EXISTS permission_kind ENUM('salida','entrada') NOT NULL DEFAULT 'salida' AFTER total_hours;
