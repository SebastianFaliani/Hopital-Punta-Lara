INSERT INTO whatsapp_appointment_doctors (
  doctor_name,
  specialty,
  is_active,
  is_booking_open,
  next_open_at,
  closed_message
)
SELECT 'Dra. Laura Fernandez', 'Clinica medica', TRUE, TRUE, NULL, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM whatsapp_appointment_doctors WHERE doctor_name = 'Dra. Laura Fernandez'
);

INSERT INTO whatsapp_appointment_doctors (
  doctor_name,
  specialty,
  is_active,
  is_booking_open,
  next_open_at,
  closed_message
)
SELECT 'Dr. Martin Rivas', 'Clinica medica', TRUE, FALSE, '2026-06-24 07:00:00', NULL
WHERE NOT EXISTS (
  SELECT 1 FROM whatsapp_appointment_doctors WHERE doctor_name = 'Dr. Martin Rivas'
);

INSERT INTO whatsapp_appointment_doctors (
  doctor_name,
  specialty,
  is_active,
  is_booking_open,
  next_open_at,
  closed_message
)
SELECT 'Laboratorio Hospital Punta Lara', 'Laboratorio', TRUE, TRUE, NULL, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM whatsapp_appointment_doctors WHERE doctor_name = 'Laboratorio Hospital Punta Lara'
);

INSERT INTO whatsapp_appointment_doctors (
  doctor_name,
  specialty,
  is_active,
  is_booking_open,
  next_open_at,
  closed_message
)
SELECT 'Dra. Valeria Soto', 'Ecografias', TRUE, FALSE, '2026-06-30 07:00:00', 'Por el momento no quedan turnos disponibles para Ecografias. La turnera vuelve a abrir el 30/06 a las 07:00 hs.'
WHERE NOT EXISTS (
  SELECT 1 FROM whatsapp_appointment_doctors WHERE doctor_name = 'Dra. Valeria Soto'
);

INSERT INTO whatsapp_appointment_doctors (
  doctor_name,
  specialty,
  is_active,
  is_booking_open,
  next_open_at,
  closed_message
)
SELECT 'Dr. Pablo Iglesias', 'Traumatologia', TRUE, TRUE, NULL, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM whatsapp_appointment_doctors WHERE doctor_name = 'Dr. Pablo Iglesias'
);

INSERT INTO whatsapp_appointment_doctors (
  doctor_name,
  specialty,
  is_active,
  is_booking_open,
  next_open_at,
  closed_message
)
SELECT 'Dra. Natalia Mendez', 'Dermatologia', TRUE, FALSE, '2026-06-23 07:00:00', NULL
WHERE NOT EXISTS (
  SELECT 1 FROM whatsapp_appointment_doctors WHERE doctor_name = 'Dra. Natalia Mendez'
);

INSERT INTO whatsapp_appointment_doctors (
  doctor_name,
  specialty,
  is_active,
  is_booking_open,
  next_open_at,
  closed_message
)
SELECT 'Lic. Carla Benitez', 'Nutricion', TRUE, TRUE, NULL, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM whatsapp_appointment_doctors WHERE doctor_name = 'Lic. Carla Benitez'
);

INSERT INTO whatsapp_appointment_doctors (
  doctor_name,
  specialty,
  is_active,
  is_booking_open,
  next_open_at,
  closed_message
)
SELECT 'Dra. Sofia Molina', 'Pediatria', TRUE, TRUE, NULL, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM whatsapp_appointment_doctors WHERE doctor_name = 'Dra. Sofia Molina'
);

INSERT INTO whatsapp_appointment_doctors (
  doctor_name,
  specialty,
  is_active,
  is_booking_open,
  next_open_at,
  closed_message
)
SELECT 'Dra. Romina Acosta', 'Ginecologia', TRUE, FALSE, '2026-06-25 07:00:00', NULL
WHERE NOT EXISTS (
  SELECT 1 FROM whatsapp_appointment_doctors WHERE doctor_name = 'Dra. Romina Acosta'
);

SET @clinica_fernandez = (
  SELECT id FROM whatsapp_appointment_doctors
  WHERE doctor_name = 'Dra. Laura Fernandez'
  LIMIT 1
);

SET @clinica_rivas = (
  SELECT id FROM whatsapp_appointment_doctors
  WHERE doctor_name = 'Dr. Martin Rivas'
  LIMIT 1
);

SET @laboratorio = (
  SELECT id FROM whatsapp_appointment_doctors
  WHERE doctor_name = 'Laboratorio Hospital Punta Lara'
  LIMIT 1
);

SET @ecografias = (
  SELECT id FROM whatsapp_appointment_doctors
  WHERE doctor_name = 'Dra. Valeria Soto'
  LIMIT 1
);

SET @traumatologia = (
  SELECT id FROM whatsapp_appointment_doctors
  WHERE doctor_name = 'Dr. Pablo Iglesias'
  LIMIT 1
);

SET @dermatologia = (
  SELECT id FROM whatsapp_appointment_doctors
  WHERE doctor_name = 'Dra. Natalia Mendez'
  LIMIT 1
);

SET @nutricion = (
  SELECT id FROM whatsapp_appointment_doctors
  WHERE doctor_name = 'Lic. Carla Benitez'
  LIMIT 1
);

SET @pediatria = (
  SELECT id FROM whatsapp_appointment_doctors
  WHERE doctor_name = 'Dra. Sofia Molina'
  LIMIT 1
);

SET @ginecologia = (
  SELECT id FROM whatsapp_appointment_doctors
  WHERE doctor_name = 'Dra. Romina Acosta'
  LIMIT 1
);

DELETE FROM whatsapp_appointment_schedules
WHERE doctor_id IN (
  @clinica_fernandez,
  @clinica_rivas,
  @laboratorio,
  @ecografias,
  @traumatologia,
  @dermatologia,
  @nutricion,
  @pediatria,
  @ginecologia
);

INSERT INTO whatsapp_appointment_schedules (
  doctor_id,
  weekday,
  start_time,
  end_time,
  is_active
)
VALUES
  (@clinica_fernandez, 1, '08:00:00', '12:00:00', TRUE),
  (@clinica_fernandez, 4, '08:00:00', '12:00:00', TRUE),
  (@clinica_rivas, 3, '09:00:00', '13:00:00', TRUE),
  (@laboratorio, 1, '07:00:00', '10:00:00', TRUE),
  (@laboratorio, 3, '07:00:00', '10:00:00', TRUE),
  (@ecografias, 2, '08:00:00', '11:00:00', TRUE),
  (@traumatologia, 2, '10:00:00', '14:00:00', TRUE),
  (@traumatologia, 5, '08:00:00', '12:00:00', TRUE),
  (@dermatologia, 4, '09:00:00', '12:00:00', TRUE),
  (@nutricion, 1, '13:00:00', '16:00:00', TRUE),
  (@nutricion, 5, '09:00:00', '12:00:00', TRUE),
  (@pediatria, 2, '08:00:00', '12:00:00', TRUE),
  (@pediatria, 4, '13:00:00', '17:00:00', TRUE),
  (@ginecologia, 3, '08:00:00', '12:00:00', TRUE);
