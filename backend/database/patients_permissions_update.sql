INSERT INTO permissions (
  permission_key,
  module_name,
  description,
  sort_order
)
VALUES
  ('patients.view', 'Pacientes', 'Ver pacientes e historial', 45),
  ('patients.manage', 'Pacientes', 'Crear y modificar pacientes', 46)
ON DUPLICATE KEY UPDATE
  module_name = VALUES(module_name),
  description = VALUES(description),
  sort_order = VALUES(sort_order);

INSERT INTO role_permissions (role_id, permission_id, allowed)
SELECT r.id, p.id, TRUE
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('admin', 'dir', 'lab')
  AND p.permission_key IN ('patients.view', 'patients.manage')
ON DUPLICATE KEY UPDATE allowed = VALUES(allowed);
