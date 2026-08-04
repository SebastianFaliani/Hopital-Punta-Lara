ALTER TABLE laboratory_records
  ADD COLUMN whatsapp_failed_at DATETIME NULL AFTER whatsapp_notified_by,
  ADD COLUMN whatsapp_failed_phone VARCHAR(40) NULL AFTER whatsapp_failed_at,
  ADD COLUMN whatsapp_failure_reason TEXT NULL AFTER whatsapp_failed_phone;
