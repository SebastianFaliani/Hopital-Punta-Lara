ALTER TABLE chronic_medication_packages
MODIFY status ENUM(
  'preparado',
  'enviado',
  'recibido',
  'parcial',
  'retirado',
  'no_retirado',
  'devuelto',
  'cancelado'
) NOT NULL DEFAULT 'preparado';
