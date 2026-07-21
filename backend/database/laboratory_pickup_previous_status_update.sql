ALTER TABLE laboratory_records
  ADD COLUMN pickup_previous_status ENUM('enviado','parcial','completo','expirado') NULL AFTER status;
