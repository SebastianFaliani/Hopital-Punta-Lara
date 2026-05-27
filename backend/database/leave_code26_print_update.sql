ALTER TABLE leave_requests
  ADD COLUMN shift_label VARCHAR(100) NULL AFTER return_time;
