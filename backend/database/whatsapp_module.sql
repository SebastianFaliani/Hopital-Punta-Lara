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
  'Hospital Punta Lara\n\nHola. Gracias por comunicarte con el hospital.\n\nResponde con el numero de la opcion:\n\n1. Especialidades medicas / turnos\n2. Resultados de laboratorio\n3. Hablar con administracion\n4. Horarios y contacto\n5. Preguntas frecuentes',
  0
),
(
  '1',
  'Especialidades medicas / turnos',
  'turno,turnos,sacar turno,consulta,consultas',
  'Especialidades medicas\n\nPara consultar dias y horarios, responde 1 y elegi la especialidad.\n\nSi la agenda esta abierta, el sistema te va a pedir tus datos para solicitar el turno.',
  1
),
(
  '2',
  'Resultados de laboratorio',
  'resultado,resultados,laboratorio,analisis,estudio,retirar,retiro,buscar',
  'Resultados de laboratorio\n\nPara consultar si tus resultados estan disponibles, responde con DNI o apellido.\n\nSolo se consultan estudios de los ultimos 6 meses.',
  2
),
(
  '3',
  'Administracion',
  'administracion,secretaria,persona,humano,hablar,reclamo',
  'Administracion\n\nDejanos tu consulta con:\n- Nombre y apellido\n- DNI\n- Motivo del mensaje\n\nUn administrativo respondera cuando este disponible.',
  3
),
(
  '4',
  'Horarios y contacto',
  'horario,horarios,direccion,ubicacion,telefono,contacto,donde queda',
  'Horarios y contacto\n\nGuardia:\n- Atencion las 24 hs.\n\nConsultorios:\n- La atencion depende de los dias y horarios de cada especialista.\n- Responde 1 para consultar especialidades medicas y turnos.\n\nContacto:\n- Telefono: completar telefono del hospital.\n- Email: completar email del hospital.\n- Direccion: completar direccion del hospital.',
  4
),
(
  '5',
  'Preguntas frecuentes',
  'preguntas frecuentes,frecuentes,faq,orden,ayuno,ecografia,historia clinica',
  'Preguntas frecuentes\n\nLaboratorio:\n- Traer orden medica.\n- Traer DNI.\n- Venir en ayunas si el estudio lo requiere.\n\nEcografias:\n- Para ecografias que requieren preparacion, consultar indicacion previa.\n- Si corresponde, concurrir con agua tomada y sin orinar segun indicacion medica.\n\nHistoria clinica:\n- Para solicitar copia de historia clinica, realizar el pedido por escrito en administracion.\n- Presentar DNI del paciente.\n\nTurnos:\n- Los turnos dependen de la agenda de cada especialidad.\n- Responde 1 para consultar especialidades medicas.',
  5
)
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  keywords = VALUES(keywords),
  response = VALUES(response),
  sort_order = VALUES(sort_order);
