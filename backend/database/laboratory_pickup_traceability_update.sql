ALTER TABLE laboratory_records
  ADD COLUMN pickup_registered_by BIGINT NULL AFTER pickup_document;

ALTER TABLE laboratory_records
  ADD COLUMN pickup_registered_at DATETIME NULL AFTER pickup_registered_by;

ALTER TABLE laboratory_records
  ADD CONSTRAINT fk_laboratory_records_pickup_registered_by
    FOREIGN KEY (pickup_registered_by)
    REFERENCES users(id)
    ON DELETE SET NULL;
