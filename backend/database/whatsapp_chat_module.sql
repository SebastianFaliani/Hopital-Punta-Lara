CREATE TABLE IF NOT EXISTS whatsapp_chat_messages (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  phone VARCHAR(80) NOT NULL,
  direction ENUM('incoming','outgoing') NOT NULL,
  message TEXT NOT NULL,
  source VARCHAR(40) NOT NULL DEFAULT 'manual',
  source_log_id BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_whatsapp_chat_phone_created (phone, created_at),
  INDEX idx_whatsapp_chat_created (created_at),
  INDEX idx_whatsapp_chat_source_log (source_log_id)
);

INSERT INTO whatsapp_chat_messages (
  phone,
  direction,
  message,
  source,
  source_log_id,
  created_at
)
SELECT
  phone,
  'incoming',
  incoming_message,
  'bot',
  id,
  created_at
FROM whatsapp_message_logs l
WHERE phone IS NOT NULL
  AND incoming_message IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM whatsapp_chat_messages c
    WHERE c.source_log_id = l.id
      AND c.direction = 'incoming'
  );

INSERT INTO whatsapp_chat_messages (
  phone,
  direction,
  message,
  source,
  source_log_id,
  created_at
)
SELECT
  phone,
  'outgoing',
  response_message,
  'bot',
  id,
  DATE_ADD(created_at, INTERVAL 1 SECOND)
FROM whatsapp_message_logs l
WHERE phone IS NOT NULL
  AND response_message IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM whatsapp_chat_messages c
    WHERE c.source_log_id = l.id
      AND c.direction = 'outgoing'
  );
