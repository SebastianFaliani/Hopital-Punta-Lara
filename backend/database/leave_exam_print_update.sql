ALTER TABLE leave_requests
  ADD COLUMN exam_type VARCHAR(120) NULL AFTER shift_label;
