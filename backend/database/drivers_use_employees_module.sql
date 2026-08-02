ALTER TABLE employees
  ADD COLUMN license_expiration_date DATE NULL AFTER license_number,
  ADD INDEX idx_employees_license_expiration (license_expiration_date);

ALTER TABLE drivers
  ADD COLUMN employee_id BIGINT NULL AFTER id,
  ADD INDEX idx_drivers_employee (employee_id);

INSERT INTO employees (
  facility_id,
  full_name,
  phone,
  license_number,
  license_expiration_date,
  is_active
)
SELECT
  COALESCE(
    (
      SELECT hf.id
      FROM health_facilities hf
      WHERE hf.is_active = TRUE
      ORDER BY hf.id ASC
      LIMIT 1
    ),
    (
      SELECT hf.id
      FROM health_facilities hf
      ORDER BY hf.id ASC
      LIMIT 1
    )
  ) AS facility_id,
  TRIM(CONCAT_WS(' ', d.first_name, d.last_name)) AS full_name,
  NULLIF(d.phone, '') AS phone,
  NULLIF(d.license_number, '') AS license_number,
  d.license_expiration_date,
  d.is_active
FROM drivers d
WHERE d.employee_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM employees e
    WHERE
      (
        d.license_number IS NOT NULL
        AND d.license_number <> ''
        AND e.license_number = d.license_number
      )
      OR (
        UPPER(TRIM(e.full_name)) =
          UPPER(TRIM(CONCAT_WS(' ', d.first_name, d.last_name)))
      )
  );

UPDATE drivers d
INNER JOIN employees e
  ON (
    d.license_number IS NOT NULL
    AND d.license_number <> ''
    AND e.license_number = d.license_number
  )
  OR (
    UPPER(TRIM(e.full_name)) =
      UPPER(TRIM(CONCAT_WS(' ', d.first_name, d.last_name)))
  )
SET d.employee_id = e.id
WHERE d.employee_id IS NULL;

UPDATE employees e
INNER JOIN drivers d
  ON d.employee_id = e.id
SET
  e.phone = COALESCE(NULLIF(e.phone, ''), NULLIF(d.phone, '')),
  e.license_number = COALESCE(NULLIF(e.license_number, ''), NULLIF(d.license_number, '')),
  e.license_expiration_date = COALESCE(e.license_expiration_date, d.license_expiration_date);
