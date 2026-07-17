ALTER TABLE leave_balance_adjustments
  ADD COLUMN allowed_days_adjustment DECIMAL(6,2) DEFAULT 0
  AFTER month;
