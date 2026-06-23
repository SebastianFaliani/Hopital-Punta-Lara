CREATE TABLE IF NOT EXISTS employee_planned_days_off (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  employee_id BIGINT NOT NULL,
  off_date DATE NOT NULL,
  notes TEXT,
  created_by BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_employee_planned_days_off_employee_date (
    employee_id,
    off_date
  ),
  INDEX idx_employee_planned_days_off_date (off_date),
  CONSTRAINT fk_employee_planned_days_off_employee
    FOREIGN KEY (employee_id)
    REFERENCES employees(id),
  CONSTRAINT fk_employee_planned_days_off_user
    FOREIGN KEY (created_by)
    REFERENCES users(id)
    ON DELETE SET NULL
);
