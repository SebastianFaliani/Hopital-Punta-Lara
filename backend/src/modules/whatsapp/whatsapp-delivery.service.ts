import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../../config/database';
import { sendWhatsappTextMessage } from './whatsapp-web.service';

export type WhatsappOutboxJob = {
  id: number;
  phone: string;
  message: string;
  attempts: number;
  max_attempts: number;
};

let schemaPromise: Promise<void> | null = null;

export function ensureWhatsappOutboxSchema() {
  if (!schemaPromise) {
    schemaPromise = pool.query(`
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
      )
    `).then(() => undefined).catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }

  return schemaPromise;
}

export async function queueWhatsappTextMessage(
  phone: string,
  message: string,
  source = 'application'
) {
  await ensureWhatsappOutboxSchema();
  const maxAttempts = Math.max(1, Number(process.env.WHATSAPP_QUEUE_MAX_ATTEMPTS || 5));
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO whatsapp_outbox (phone, message, source, max_attempts)
     VALUES (?, ?, ?, ?)`,
    [phone, message, source, maxAttempts]
  );
  return result.insertId;
}

export async function deliverWhatsappTextMessage(
  phone: string,
  message: string,
  source = 'application'
) {
  if ((process.env.WHATSAPP_DELIVERY_MODE || 'direct').toLowerCase() === 'queue') {
    return { queued: true, id: await queueWhatsappTextMessage(phone, message, source) };
  }
  await sendWhatsappTextMessage(phone, message);
  return { queued: false };
}

export async function claimWhatsappOutboxJobs(agentId: string, limit: number) {
  await ensureWhatsappOutboxSchema();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const staleMinutes = Math.max(1, Number(process.env.WHATSAPP_QUEUE_LOCK_MINUTES || 5));
    await connection.execute(
      `UPDATE whatsapp_outbox
       SET status = 'pending', locked_by = NULL, locked_at = NULL,
           last_error = COALESCE(last_error, 'Bloqueo vencido; reintentando')
       WHERE status = 'processing'
         AND locked_at < DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
      [staleMinutes]
    );
    const [rows] = await connection.query<(RowDataPacket & WhatsappOutboxJob)[]>(
      `SELECT id, phone, message, attempts, max_attempts
       FROM whatsapp_outbox
       WHERE status = 'pending' AND next_attempt_at <= NOW()
       ORDER BY id
       LIMIT ? FOR UPDATE`,
      [Math.min(Math.max(limit, 1), 20)]
    );
    if (rows.length) {
      const ids = rows.map((row) => Number(row.id));
      await connection.query(
        `UPDATE whatsapp_outbox
         SET status = 'processing', locked_by = ?, locked_at = NOW(), attempts = attempts + 1
         WHERE id IN (?)`,
        [agentId, ids]
      );
      rows.forEach((row) => { row.attempts = Number(row.attempts) + 1; });
    }
    await connection.commit();
    return rows;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function completeWhatsappOutboxJob(
  id: number,
  agentId: string,
  success: boolean,
  errorMessage?: string
) {
  await ensureWhatsappOutboxSchema();
  const retrySeconds = Math.max(5, Number(process.env.WHATSAPP_QUEUE_RETRY_SECONDS || 30));
  const [result] = await pool.execute<ResultSetHeader>(
    success
      ? `UPDATE whatsapp_outbox SET status = 'sent', sent_at = NOW(), last_error = NULL,
           locked_by = NULL, locked_at = NULL WHERE id = ? AND status = 'processing' AND locked_by = ?`
      : `UPDATE whatsapp_outbox SET
           status = IF(attempts >= max_attempts, 'failed', 'pending'),
           next_attempt_at = DATE_ADD(NOW(), INTERVAL (? * POW(2, GREATEST(attempts - 1, 0))) SECOND),
           last_error = ?, locked_by = NULL, locked_at = NULL
         WHERE id = ? AND status = 'processing' AND locked_by = ?`,
    success
      ? [id, agentId]
      : [retrySeconds, String(errorMessage || 'Error de envio').slice(0, 2000), id, agentId]
  );
  return result.affectedRows > 0;
}
