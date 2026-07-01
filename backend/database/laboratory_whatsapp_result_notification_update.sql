ALTER TABLE laboratory_records
  ADD COLUMN result_notified_at DATETIME NULL AFTER completed_by;

ALTER TABLE laboratory_records
  ADD COLUMN result_notification_message TEXT NULL AFTER result_notified_at;

ALTER TABLE laboratory_records
  ADD COLUMN result_notified_by BIGINT NULL AFTER result_notification_message;

ALTER TABLE laboratory_records
  ADD INDEX idx_laboratory_records_result_notified_at (result_notified_at);

CREATE TABLE IF NOT EXISTS laboratory_settings (
  setting_key VARCHAR(120) PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_by BIGINT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO laboratory_settings (
  setting_key,
  setting_value
)
VALUES (
  'result_notification_template',
  'Hospital Municipal de Punta Lara\n\nHola {nombre}. Te avisamos que los resultados de laboratorio ya se encuentran disponibles para retirar.\n\nPodes pasar de lunes a viernes de 08:00 a 12:00 hs por el hospital.\n\nRecorda traer DNI.'
)
ON DUPLICATE KEY UPDATE
  setting_value = setting_value;
