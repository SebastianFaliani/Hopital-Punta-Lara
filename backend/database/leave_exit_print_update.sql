ALTER TABLE leave_requests
  ADD COLUMN exit_reason ENUM('particular','tramite_oficial') NULL AFTER total_hours,
  ADD COLUMN exit_time TIME NULL AFTER exit_reason,
  ADD COLUMN return_time TIME NULL AFTER exit_time;
