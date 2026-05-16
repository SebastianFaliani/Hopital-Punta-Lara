CREATE TABLE IF NOT EXISTS whatsapp_auto_replies (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(50) NOT NULL,
  title VARCHAR(100) NOT NULL,
  keywords TEXT,
  response TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_whatsapp_auto_replies_code (code)
);

CREATE TABLE IF NOT EXISTS whatsapp_message_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  phone VARCHAR(50),
  incoming_message TEXT NOT NULL,
  response_message TEXT NOT NULL,
  matched_reply_id BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_whatsapp_message_logs_phone (phone),
  INDEX idx_whatsapp_message_logs_created_at (created_at),
  CONSTRAINT fk_whatsapp_logs_reply
    FOREIGN KEY (matched_reply_id)
    REFERENCES whatsapp_auto_replies(id)
    ON DELETE SET NULL
);

INSERT INTO whatsapp_auto_replies (
  code,
  title,
  keywords,
  response,
  sort_order
) VALUES
(
  'menu',
  'Menu principal',
  'hola,buen dia,buenas,menu,opciones,informacion,info',
  'Hospital Punta Lara\n\nHola. Gracias por comunicarte con el hospital.\n\nResponde con el numero de la opcion:\n\n1. Turnos\n2. Especialidades medicas\n3. Laboratorio\n4. Kinesiologia\n5. Guardia\n6. Traslados / Ambulancia\n7. Horarios y contacto\n8. Hablar con administracion',
  0
),
(
  '1',
  'Turnos',
  'turno,turnos,sacar turno,consulta,consultas',
  'Turnos\n\nLos turnos se otorgan de lunes a viernes de 08:00 a 12:00 hs.\n\nPara solicitar un turno envia:\n- Nombre y apellido\n- DNI\n- Especialidad solicitada\n\nAlgunos servicios requieren derivacion u orden medica.',
  1
),
(
  '2',
  'Especialidades medicas',
  'especialidad,especialidades,medico,medica,cardiologia,traumatologia,pediatria,ginecologia,clinica',
  'Especialidades medicas\n\nActualmente podes consultar por:\n- Clinica medica\n- Pediatria\n- Ginecologia\n- Traumatologia\n- Cardiologia\n- Psicologia\n- Nutricion\n- Kinesiologia\n\nPara turnos escribi: TURNO + especialidad.\nEjemplo: TURNO TRAUMATOLOGIA',
  2
),
(
  '3',
  'Laboratorio',
  'laboratorio,analisis,sangre,extraccion,estudio',
  'Laboratorio\n\nAtencion con turno previo.\n\nRecorda traer:\n- Orden medica\n- DNI\n\nAlgunos estudios requieren ayuno.\n\nHorario habitual: lunes a viernes de 07:00 a 10:00 hs.',
  3
),
(
  '4',
  'Kinesiologia',
  'kinesiologia,kinesio,rehabilitacion,fisioterapia,sesiones',
  'Kinesiologia\n\nAtencion con derivacion medica.\n\nPara solicitar turno envia:\n- Nombre y apellido\n- DNI\n- Diagnostico o motivo\n\nTraer estudios previos si posee.\n\nHorario habitual: lunes a viernes de 08:00 a 18:00 hs.',
  4
),
(
  '5',
  'Guardia',
  'guardia,urgencia,emergencia,emergencias,24 horas',
  'Guardia\n\nLa guardia funciona las 24 hs.\n\nLa atencion se organiza por prioridad medica.\n\nAnte una emergencia concurrir a guardia o llamar al numero local de emergencias correspondiente.',
  5
),
(
  '6',
  'Traslados / Ambulancia',
  'traslado,ambulancia,llevar,paciente,direccion,destino',
  'Traslados / Ambulancia\n\nLos traslados programados se coordinan previamente.\n\nPara consultar disponibilidad envia:\n- Nombre del paciente\n- Direccion de origen\n- Destino\n- Dia y horario del turno\n\nSujeto a disponibilidad.',
  6
),
(
  '7',
  'Horarios y contacto',
  'horario,horarios,direccion,ubicacion,telefono,contacto,donde queda',
  'Horarios y contacto\n\nPara informacion general, indica que servicio necesitas consultar.\n\nTambien podes responder:\n1 Turnos\n2 Especialidades\n3 Laboratorio\n4 Kinesiologia\n5 Guardia',
  7
),
(
  '8',
  'Administracion',
  'administracion,secretaria,persona,humano,hablar,reclamo',
  'Administracion\n\nDejanos tu consulta con:\n- Nombre y apellido\n- DNI\n- Motivo del mensaje\n\nUn administrativo respondera cuando este disponible.',
  8
)
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  keywords = VALUES(keywords),
  response = VALUES(response),
  sort_order = VALUES(sort_order);
