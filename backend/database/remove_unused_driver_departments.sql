DELETE d
FROM employee_departments d
LEFT JOIN employees e
  ON e.department_id = d.id
WHERE UPPER(TRIM(d.name)) = 'CHOFERES'
  AND d.description = 'Choferes habilitados para el modulo de traslados'
  AND e.id IS NULL;
