SET @access_all_facilities_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'users'
    AND column_name = 'access_all_facilities'
);

SET @access_all_facilities_sql = IF(
  @access_all_facilities_exists = 0,
  'ALTER TABLE users ADD COLUMN access_all_facilities BOOLEAN NOT NULL DEFAULT FALSE AFTER facility_id',
  'SELECT 1'
);

PREPARE access_all_facilities_statement
  FROM @access_all_facilities_sql;
EXECUTE access_all_facilities_statement;
DEALLOCATE PREPARE access_all_facilities_statement;

CREATE TABLE IF NOT EXISTS permissions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  permission_key VARCHAR(100) NOT NULL UNIQUE,
  module_name VARCHAR(100) NOT NULL,
  description VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INT NOT NULL,
  permission_id BIGINT NOT NULL,
  allowed BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_role_permissions_role
    FOREIGN KEY (role_id) REFERENCES roles(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_role_permissions_permission
    FOREIGN KEY (permission_id) REFERENCES permissions(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_permissions (
  user_id BIGINT NOT NULL,
  permission_id BIGINT NOT NULL,
  allowed BOOLEAN NOT NULL,
  PRIMARY KEY (user_id, permission_id),
  CONSTRAINT fk_user_permissions_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_user_permissions_permission
    FOREIGN KEY (permission_id) REFERENCES permissions(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_facilities (
  user_id BIGINT NOT NULL,
  facility_id BIGINT NOT NULL,
  PRIMARY KEY (user_id, facility_id),
  CONSTRAINT fk_user_facilities_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_user_facilities_facility
    FOREIGN KEY (facility_id) REFERENCES health_facilities(id)
    ON DELETE CASCADE
);

INSERT INTO permissions (
  permission_key,
  module_name,
  description,
  sort_order
)
VALUES
  ('personnel.view', 'Personal', 'Ver personal y licencias', 10),
  ('personnel.manage', 'Personal', 'Administrar personal y licencias', 11),
  ('transfers.view', 'Traslados', 'Ver traslados', 20),
  ('transfers.manage', 'Traslados', 'Administrar traslados', 21),
  ('medications.view', 'Medicamentos', 'Ver medicamentos y stock', 30),
  ('medications.manage', 'Medicamentos', 'Administrar medicamentos y stock', 31),
  ('vaccines.view', 'Vacunas', 'Ver vacunas y stock', 40),
  ('vaccines.manage', 'Vacunas', 'Administrar vacunas y stock', 41),
  ('laboratory.view', 'Laboratorio', 'Ver estudios de laboratorio', 50),
  ('laboratory.manage', 'Laboratorio', 'Administrar estudios de laboratorio', 51),
  ('audit.view', 'Auditoria', 'Ver auditoria', 60),
  ('whatsapp.manage', 'WhatsApp', 'Administrar WhatsApp', 70),
  ('users.manage', 'Administracion', 'Administrar usuarios y accesos', 80),
  ('facilities.manage', 'Administracion', 'Administrar dependencias', 81)
ON DUPLICATE KEY UPDATE
  module_name = VALUES(module_name),
  description = VALUES(description),
  sort_order = VALUES(sort_order);

INSERT INTO role_permissions (role_id, permission_id, allowed)
SELECT r.id, p.id, TRUE
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'admin'
ON DUPLICATE KEY UPDATE allowed = VALUES(allowed);

INSERT INTO role_permissions (role_id, permission_id, allowed)
SELECT r.id, p.id, TRUE
FROM roles r
INNER JOIN permissions p
  ON p.permission_key IN (
    'personnel.view',
    'personnel.manage',
    'transfers.view',
    'transfers.manage',
    'laboratory.view'
  )
WHERE r.name = 'user'
ON DUPLICATE KEY UPDATE allowed = VALUES(allowed);

INSERT INTO role_permissions (role_id, permission_id, allowed)
SELECT r.id, p.id, TRUE
FROM roles r
INNER JOIN permissions p
  ON p.permission_key IN (
    'medications.view',
    'medications.manage'
  )
WHERE r.name = 'farmacia'
ON DUPLICATE KEY UPDATE allowed = VALUES(allowed);

INSERT INTO role_permissions (role_id, permission_id, allowed)
SELECT r.id, p.id, TRUE
FROM roles r
INNER JOIN permissions p
  ON p.permission_key IN (
    'vaccines.view',
    'vaccines.manage'
  )
WHERE r.name = 'vacu'
ON DUPLICATE KEY UPDATE allowed = VALUES(allowed);

INSERT INTO role_permissions (role_id, permission_id, allowed)
SELECT r.id, p.id, TRUE
FROM roles r
INNER JOIN permissions p
  ON p.permission_key IN (
    'laboratory.view',
    'laboratory.manage'
  )
WHERE r.name = 'lab'
ON DUPLICATE KEY UPDATE allowed = VALUES(allowed);

INSERT INTO role_permissions (role_id, permission_id, allowed)
SELECT r.id, p.id, TRUE
FROM roles r
INNER JOIN permissions p
  ON p.permission_key IN (
    'personnel.view',
    'transfers.view',
    'medications.view',
    'vaccines.view',
    'laboratory.view',
    'audit.view'
  )
WHERE r.name = 'dir'
ON DUPLICATE KEY UPDATE allowed = VALUES(allowed);
