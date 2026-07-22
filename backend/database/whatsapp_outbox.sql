CREATE TABLE IF NOT EXISTS whatsapp_outbox (
  id BIGINT NOT NULL AUTO_INCREMENT,
  phone VARCHAR(40) NOT NULL,
  message TEXT NOT NULL,
  source VARCHAR(80) NOT NULL DEFAULT 'application',
  status ENUM('pending', 'processing', 'sent', 'failed') NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  next_attempt_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  locked_by VARCHAR(120) NULL,
  locked_at DATETIME NULL,
  sent_at DATETIME NULL,
  last_error TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_whatsapp_outbox_claim (status, next_attempt_at, id),
  INDEX idx_whatsapp_outbox_lock (status, locked_at)
);

CREATE TABLE IF NOT EXISTS whatsapp_agent_status (
  agent_id VARCHAR(120) NOT NULL,
  is_ready BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(40) NOT NULL DEFAULT 'disconnected',
  phone VARCHAR(40) NULL,
  last_event VARCHAR(500) NULL,
  last_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (agent_id),
  INDEX idx_whatsapp_agent_seen (last_seen)
);
