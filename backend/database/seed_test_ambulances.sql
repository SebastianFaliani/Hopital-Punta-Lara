INSERT INTO ambulances (
  internal_code,
  plate,
  brand,
  model,
  ambulance_type_id,
  type,
  status,
  is_active
)
VALUES
  ('AMB-01', 'AA111AA', 'MERCEDES BENZ', 'SPRINTER', (SELECT id FROM ambulance_types WHERE name = 'UTIM'), 'UTIM', 'disponible', TRUE),
  ('AMB-02', 'AB222BB', 'IVECO', 'DAILY', (SELECT id FROM ambulance_types WHERE name = 'TRASLADO'), 'TRASLADO', 'mantenimiento', TRUE),
  ('PED-01', 'AC333CC', 'RENAULT', 'MASTER', (SELECT id FROM ambulance_types WHERE name = 'PEDIATRICA'), 'PEDIATRICA', 'disponible', TRUE)
ON DUPLICATE KEY UPDATE
  plate = VALUES(plate),
  brand = VALUES(brand),
  model = VALUES(model),
  ambulance_type_id = VALUES(ambulance_type_id),
  type = VALUES(type),
  status = VALUES(status),
  is_active = VALUES(is_active);
