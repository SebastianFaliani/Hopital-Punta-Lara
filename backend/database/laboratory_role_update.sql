INSERT INTO roles (name)
SELECT 'lab'
WHERE NOT EXISTS (
  SELECT 1 FROM roles WHERE name = 'lab'
);
