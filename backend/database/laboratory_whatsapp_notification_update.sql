ALTER TABLE laboratory_records
  ADD COLUMN whatsapp_notified_at DATETIME NULL AFTER pickup_registered_at;

ALTER TABLE laboratory_records
  ADD COLUMN whatsapp_notified_by BIGINT NULL AFTER whatsapp_notified_at;

ALTER TABLE laboratory_records
  ADD CONSTRAINT fk_laboratory_records_whatsapp_notified_by
    FOREIGN KEY (whatsapp_notified_by)
    REFERENCES users(id)
    ON DELETE SET NULL;
