ALTER TABLE leave_requests
  ADD COLUMN municipal_vacation_days_1 DECIMAL(6,2) NULL AFTER exam_type,
  ADD COLUMN municipal_vacation_year_1 SMALLINT NULL AFTER municipal_vacation_days_1,
  ADD COLUMN municipal_vacation_days_2 DECIMAL(6,2) NULL AFTER municipal_vacation_year_1,
  ADD COLUMN municipal_vacation_year_2 SMALLINT NULL AFTER municipal_vacation_days_2,
  ADD COLUMN work_return_date DATE NULL AFTER municipal_vacation_year_2,
  ADD COLUMN work_return_time TIME NULL AFTER work_return_date;
