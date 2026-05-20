SET @roles_description_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'roles'
    AND column_name = 'description'
);

SET @roles_description_sql = IF(
  @roles_description_exists = 0,
  'ALTER TABLE roles ADD COLUMN description VARCHAR(100) NULL AFTER name',
  'SELECT 1'
);

PREPARE roles_description_statement
  FROM @roles_description_sql;
EXECUTE roles_description_statement;
DEALLOCATE PREPARE roles_description_statement;

UPDATE roles
SET description = CASE name
  WHEN 'admin' THEN 'Administrador'
  WHEN 'user' THEN 'Usuario'
  WHEN 'dir' THEN 'Directivo'
  WHEN 'vacu' THEN 'Vacunacion'
  WHEN 'lab' THEN 'Laboratorio'
  WHEN 'farmacia' THEN 'Farmacia'
  ELSE COALESCE(description, name)
END
WHERE description IS NULL
   OR description = '';

INSERT INTO roles (
  name,
  description
)
SELECT
  'nutri',
  'Nutricion'
WHERE NOT EXISTS (
  SELECT 1
  FROM roles
  WHERE name = 'nutri'
);

UPDATE roles
SET description = 'Nutricion'
WHERE name = 'nutri';

INSERT INTO permissions (
  permission_key,
  module_name,
  description,
  sort_order
)
VALUES
  ('nutrition.view', 'Nutricion', 'Ver pacientes y controles nutricionales', 55),
  ('nutrition.manage', 'Nutricion', 'Administrar pacientes y controles nutricionales', 56)
ON DUPLICATE KEY UPDATE
  module_name = VALUES(module_name),
  description = VALUES(description),
  sort_order = VALUES(sort_order);

INSERT INTO role_permissions (
  role_id,
  permission_id,
  allowed
)
SELECT
  r.id,
  p.id,
  TRUE
FROM roles r
INNER JOIN permissions p
  ON p.permission_key IN (
    'nutrition.view',
    'nutrition.manage'
  )
WHERE r.name = 'nutri'
ON DUPLICATE KEY UPDATE
  allowed = VALUES(allowed);
