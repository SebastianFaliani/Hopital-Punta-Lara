INSERT INTO employee_departments (
  facility_id,
  name,
  description,
  is_active
)
SELECT
  hf.id,
  'CHOFERES',
  'Choferes habilitados para el modulo de traslados',
  TRUE
FROM health_facilities hf
WHERE NOT EXISTS (
  SELECT 1
  FROM employee_departments d
  WHERE d.facility_id = hf.id
    AND UPPER(TRIM(d.name)) = 'CHOFERES'
);

UPDATE employees e
INNER JOIN drivers d
  ON d.employee_id = e.id
INNER JOIN employee_departments dept
  ON dept.facility_id = e.facility_id
  AND UPPER(TRIM(dept.name)) = 'CHOFERES'
SET e.department_id = dept.id
WHERE d.employee_id IS NOT NULL;
