ALTER TABLE leave_requests
  ADD COLUMN no_return BOOLEAN DEFAULT FALSE AFTER return_time;
