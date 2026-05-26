INSERT INTO roles (name)
SELECT 'vacu'
WHERE NOT EXISTS (
  SELECT 1 FROM roles WHERE name = 'vacu'
);

INSERT INTO roles (name)
SELECT 'dir'
WHERE NOT EXISTS (
  SELECT 1 FROM roles WHERE name = 'dir'
);
