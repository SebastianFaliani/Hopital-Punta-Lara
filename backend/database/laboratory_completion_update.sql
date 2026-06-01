ALTER TABLE laboratory_records
  ADD COLUMN is_complete BOOLEAN NOT NULL DEFAULT TRUE AFTER has_urine_sample;

ALTER TABLE laboratory_records
  ADD COLUMN missing_details TEXT NULL AFTER is_complete;

ALTER TABLE laboratory_records
  ADD COLUMN completed_at DATETIME NULL AFTER missing_details;

ALTER TABLE laboratory_records
  ADD COLUMN completed_by BIGINT NULL AFTER completed_at;

ALTER TABLE laboratory_records
  ADD INDEX idx_laboratory_records_complete (is_complete);

ALTER TABLE laboratory_records
  ADD CONSTRAINT fk_laboratory_records_completed_by
    FOREIGN KEY (completed_by)
    REFERENCES users(id)
    ON DELETE SET NULL;
