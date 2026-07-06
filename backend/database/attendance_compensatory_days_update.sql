ALTER TABLE attendance_records
  ADD COLUMN compensatory_days DECIMAL(4,2) NULL AFTER notes;
