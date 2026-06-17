CREATE TABLE IF NOT EXISTS housekeeping_items (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  category ENUM('material', 'herramienta', 'combustible', 'insumo', 'otro') NOT NULL DEFAULT 'material',
  unit VARCHAR(50) NOT NULL DEFAULT 'unidad',
  stock_quantity DECIMAL(12,2) NOT NULL DEFAULT 0,
  minimum_stock DECIMAL(12,2) NOT NULL DEFAULT 0,
  is_returnable BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_housekeeping_items_name (name),
  INDEX idx_housekeeping_items_category (category)
);

CREATE TABLE IF NOT EXISTS housekeeping_movements (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  movement_date DATE NOT NULL,
  item_id BIGINT NOT NULL,
  movement_type ENUM('entrada', 'salida', 'prestamo', 'consumo') NOT NULL,
  quantity DECIMAL(12,2) NOT NULL,
  destination_person VARCHAR(255) NULL,
  destination_sector VARCHAR(255) NULL,
  delivery_signature_name VARCHAR(255) NULL,
  delivery_signed_on_paper BOOLEAN NOT NULL DEFAULT FALSE,
  requires_return BOOLEAN NOT NULL DEFAULT FALSE,
  expected_return_date DATE NULL,
  returned_quantity DECIMAL(12,2) NOT NULL DEFAULT 0,
  return_date DATE NULL,
  return_signature_name VARCHAR(255) NULL,
  return_signed_on_paper BOOLEAN NOT NULL DEFAULT FALSE,
  status ENUM('registrado', 'pendiente_devolucion', 'devuelto', 'parcial', 'cancelado') NOT NULL DEFAULT 'registrado',
  notes TEXT NULL,
  created_by BIGINT NULL,
  updated_by BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_housekeeping_movements_item
    FOREIGN KEY (item_id) REFERENCES housekeeping_items(id),
  CONSTRAINT fk_housekeeping_movements_created_by
    FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_housekeeping_movements_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(id),
  INDEX idx_housekeeping_movements_date (movement_date),
  INDEX idx_housekeeping_movements_status (status),
  INDEX idx_housekeeping_movements_type (movement_type),
  INDEX idx_housekeeping_movements_item (item_id)
);

INSERT INTO roles (name, description)
SELECT 'mayo', 'Mayordomia'
WHERE NOT EXISTS (
  SELECT 1 FROM roles WHERE name = 'mayo'
);

INSERT INTO permissions (permission_key, module_name, description)
VALUES
  ('housekeeping.view', 'Mayordomia', 'Ver movimientos de mayordomia'),
  ('housekeeping.manage', 'Mayordomia', 'Administrar movimientos de mayordomia')
ON DUPLICATE KEY UPDATE
  module_name = VALUES(module_name),
  description = VALUES(description);

INSERT INTO role_permissions (role_id, permission_id, allowed)
SELECT r.id, p.id, TRUE
FROM roles r
INNER JOIN permissions p
  ON p.permission_key IN ('housekeeping.view', 'housekeeping.manage')
WHERE r.name IN ('admin', 'mayo')
ON DUPLICATE KEY UPDATE allowed = VALUES(allowed);

INSERT INTO role_permissions (role_id, permission_id, allowed)
SELECT r.id, p.id, TRUE
FROM roles r
INNER JOIN permissions p
  ON p.permission_key = 'housekeeping.view'
WHERE r.name = 'dir'
ON DUPLICATE KEY UPDATE allowed = VALUES(allowed);
