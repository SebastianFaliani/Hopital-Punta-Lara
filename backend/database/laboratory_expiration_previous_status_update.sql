ALTER TABLE laboratory_records
  ADD COLUMN expired_previous_status ENUM('enviado','parcial','completo') NULL AFTER status;

UPDATE laboratory_records
SET expired_previous_status =
  CASE
    WHEN is_complete = TRUE THEN 'completo'
    WHEN missing_details IS NOT NULL
      AND missing_details NOT IN (
        'Resultados pendientes',
        'Sin practicas cargadas'
      ) THEN 'parcial'
    ELSE 'enviado'
  END
WHERE status = 'expirado'
  AND expired_previous_status IS NULL;
