CREATE TABLE IF NOT EXISTS whatsapp_appointment_doctors (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  doctor_name VARCHAR(150) NOT NULL,
  specialty VARCHAR(150) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_booking_open BOOLEAN NOT NULL DEFAULT FALSE,
  next_open_at DATETIME NULL,
  closed_message TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_whatsapp_doctors_specialty (specialty),
  INDEX idx_whatsapp_doctors_active (is_active),
  INDEX idx_whatsapp_doctors_booking (is_booking_open)
);

CREATE TABLE IF NOT EXISTS whatsapp_appointment_schedules (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  doctor_id BIGINT NOT NULL,
  weekday TINYINT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_whatsapp_schedule_doctor
    FOREIGN KEY (doctor_id)
    REFERENCES whatsapp_appointment_doctors(id)
    ON DELETE CASCADE,
  INDEX idx_whatsapp_schedule_doctor (doctor_id),
  INDEX idx_whatsapp_schedule_weekday (weekday)
);

CREATE TABLE IF NOT EXISTS whatsapp_appointment_requests (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  phone VARCHAR(80) NOT NULL,
  doctor_id BIGINT NOT NULL,
  schedule_id BIGINT NULL,
  patient_name VARCHAR(180) NOT NULL,
  patient_document VARCHAR(30) NOT NULL,
  requested_weekday TINYINT NULL,
  requested_day_label VARCHAR(40) NULL,
  status ENUM('pendiente','confirmado','sin_lugar','cancelado') NOT NULL DEFAULT 'pendiente',
  assigned_date DATE NULL,
  assigned_time TIME NULL,
  admin_notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_whatsapp_request_doctor
    FOREIGN KEY (doctor_id)
    REFERENCES whatsapp_appointment_doctors(id),
  CONSTRAINT fk_whatsapp_request_schedule
    FOREIGN KEY (schedule_id)
    REFERENCES whatsapp_appointment_schedules(id)
    ON DELETE SET NULL,
  INDEX idx_whatsapp_request_phone (phone),
  INDEX idx_whatsapp_request_doctor (doctor_id),
  INDEX idx_whatsapp_request_status (status),
  INDEX idx_whatsapp_request_created (created_at)
);

CREATE TABLE IF NOT EXISTS whatsapp_conversation_states (
  phone VARCHAR(80) PRIMARY KEY,
  state VARCHAR(80) NOT NULL,
  payload LONGTEXT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

ALTER TABLE whatsapp_conversation_states
  MODIFY COLUMN payload LONGTEXT NULL;
