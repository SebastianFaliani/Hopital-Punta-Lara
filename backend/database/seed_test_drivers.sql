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
  seed.full_name,
  seed.phone,
  seed.license_number,
  seed.license_expiration_date,
  TRUE
FROM (
  SELECT 'MARTIN PEREZ' AS full_name, '2215001001' AS phone, 'LIC-TEST-001' AS license_number, DATE_SUB(CURDATE(), INTERVAL 3 DAY) AS license_expiration_date
  UNION ALL
  SELECT 'CARLOS GOMEZ', '2215001002', 'LIC-TEST-002', DATE_ADD(CURDATE(), INTERVAL 5 DAY)
  UNION ALL
  SELECT 'DIEGO FERNANDEZ', '2215001003', 'LIC-TEST-003', DATE_ADD(CURDATE(), INTERVAL 14 DAY)
  UNION ALL
  SELECT 'PABLO MARTINEZ', '2215001004', 'LIC-TEST-004', DATE_ADD(CURDATE(), INTERVAL 45 DAY)
  UNION ALL
  SELECT 'JORGE RODRIGUEZ', '2215001005', 'LIC-TEST-005', DATE_ADD(CURDATE(), INTERVAL 90 DAY)
  UNION ALL
  SELECT 'SERGIO LOPEZ', '2215001006', 'LIC-TEST-006', DATE_SUB(CURDATE(), INTERVAL 20 DAY)
  UNION ALL
  SELECT 'RAUL SOSA', '2215001007', 'LIC-TEST-007', DATE_ADD(CURDATE(), INTERVAL 180 DAY)
  UNION ALL
  SELECT 'MIGUEL ACOSTA', '2215001008', 'LIC-TEST-008', DATE_ADD(CURDATE(), INTERVAL 10 DAY)
) seed
WHERE NOT EXISTS (
  SELECT 1
  FROM employees e
  WHERE e.license_number = seed.license_number
);

INSERT INTO drivers (
  employee_id,
  first_name,
  last_name,
  phone,
  license_number,
  license_expiration_date,
  is_active
)
SELECT
  e.id,
  SUBSTRING_INDEX(e.full_name, ' ', 1),
  TRIM(SUBSTRING(e.full_name, LENGTH(SUBSTRING_INDEX(e.full_name, ' ', 1)) + 1)),
  e.phone,
  e.license_number,
  e.license_expiration_date,
  TRUE
FROM employees e
WHERE e.license_number LIKE 'LIC-TEST-%'
  AND NOT EXISTS (
    SELECT 1
    FROM drivers d
    WHERE d.employee_id = e.id
      OR d.license_number = e.license_number
  );
