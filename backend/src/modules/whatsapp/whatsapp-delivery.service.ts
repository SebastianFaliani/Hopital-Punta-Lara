import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../../config/database';
import { sendWhatsappDocumentMessage, sendWhatsappTextMessage } from './whatsapp-web.service';

export type WhatsappOutboxJob = {
  id: number;
  phone: string;
  message: string;
  attempts: number;
  max_attempts: number;
  attachments_json?: string | null;
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
    `).then(async () => {
      const [columns]: any = await pool.query(`
        SELECT COLUMN_NAME FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'whatsapp_outbox'
      `);
      const existing = new Set(columns.map((row: any) => row.COLUMN_NAME));
      const additions = [
        ['attachments_json', 'JSON NULL'],
        ['reference_type', 'VARCHAR(80) NULL'],
        ['reference_id', 'BIGINT NULL'],
        ['requested_by', 'BIGINT NULL']
      ];
      for (const [name, definition] of additions) {
        if (!existing.has(name)) await pool.query(`ALTER TABLE whatsapp_outbox ADD COLUMN ${name} ${definition}`);
      }
    }).then(() => pool.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_agent_status (
        agent_id VARCHAR(120) NOT NULL,
        is_ready BOOLEAN NOT NULL DEFAULT FALSE,
        status VARCHAR(40) NOT NULL DEFAULT 'disconnected',
        phone VARCHAR(40) NULL,
        last_event VARCHAR(500) NULL,
        qr_data_url MEDIUMTEXT NULL,
        qr_updated_at DATETIME NULL,
        last_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (agent_id),
        INDEX idx_whatsapp_agent_seen (last_seen)
      )
    `)).then(async () => {
      const [columns]: any = await pool.query(`
        SELECT COLUMN_NAME FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'whatsapp_agent_status'
      `);
      const existing = new Set(columns.map((row: any) => row.COLUMN_NAME));
      if (!existing.has('qr_data_url')) {
        await pool.query('ALTER TABLE whatsapp_agent_status ADD COLUMN qr_data_url MEDIUMTEXT NULL');
      }
      if (!existing.has('qr_updated_at')) {
        await pool.query('ALTER TABLE whatsapp_agent_status ADD COLUMN qr_updated_at DATETIME NULL');
      }
    }).then(() => undefined).catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }

  return schemaPromise;
}

export async function updateWhatsappAgentStatus(
  agentId: string,
  agentStatus: {
    isReady?: boolean;
    status?: string;
    phone?: string | null;
    lastEvent?: string | null;
    qrDataUrl?: string | null;
  }
) {
  await ensureWhatsappOutboxSchema();
  const suppliedQr = String(agentStatus.qrDataUrl || '');
  const qrDataUrl = !agentStatus.isReady && suppliedQr.startsWith('data:image/png;base64,') && suppliedQr.length <= 100000
    ? suppliedQr
    : null;
  await pool.execute(
    `INSERT INTO whatsapp_agent_status
       (agent_id, is_ready, status, phone, last_event, qr_data_url, qr_updated_at, last_seen)
     VALUES (?, ?, ?, ?, ?, ?, IF(? IS NULL, NULL, NOW()), NOW())
     ON DUPLICATE KEY UPDATE is_ready = VALUES(is_ready), status = VALUES(status),
       phone = VALUES(phone), last_event = VALUES(last_event), qr_data_url = VALUES(qr_data_url),
       qr_updated_at = VALUES(qr_updated_at), last_seen = NOW()`,
    [agentId, Boolean(agentStatus.isReady), String(agentStatus.status || 'disconnected').slice(0, 40),
      agentStatus.phone || null, String(agentStatus.lastEvent || '').slice(0, 500) || null,
      qrDataUrl, qrDataUrl]
  );
}

export async function getWhatsappDeliveryStatus() {
  if ((process.env.WHATSAPP_DELIVERY_MODE || 'direct').toLowerCase() !== 'queue') return null;
  await ensureWhatsappOutboxSchema();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT agent_id, is_ready, status, phone, last_event, qr_data_url, qr_updated_at, last_seen,
       last_seen >= DATE_SUB(NOW(), INTERVAL 45 SECOND) AS is_online
     FROM whatsapp_agent_status ORDER BY last_seen DESC LIMIT 1`
  );
  const agent = rows[0];
  const online = Boolean(agent?.is_online);
  return {
    status: online ? String(agent.status) : 'disconnected',
    qr: null,
    qrDataUrl: online && !Boolean(agent?.is_ready) && agent?.status === 'qr' &&
      agent?.qr_updated_at && new Date(agent.qr_updated_at).getTime() >= Date.now() - 120000
      ? agent.qr_data_url || null
      : null,
    phone: agent?.phone || null,
    lastEvent: online ? agent?.last_event || 'Agente local conectado' : 'Agente local sin conexion',
    lastEventAt: agent?.last_seen || null,
    isReady: online && Boolean(agent?.is_ready),
    hasClient: online,
    initializing: online && !Boolean(agent?.is_ready),
    agentId: agent?.agent_id || null,
    deliveryMode: 'queue'
  };
}

export async function queueWhatsappTextMessage(
  phone: string,
  message: string,
  source = 'application',
  options?: { attachments?: Array<{ id: number; name: string }>; referenceType?: string; referenceId?: number; requestedBy?: number }
) {
  await ensureWhatsappOutboxSchema();
  const maxAttempts = Math.max(1, Number(process.env.WHATSAPP_QUEUE_MAX_ATTEMPTS || 5));

  if (options?.referenceType && options.referenceId) {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO whatsapp_outbox
         (phone, message, source, max_attempts, attachments_json,
          reference_type, reference_id, requested_by)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?
       FROM DUAL
       WHERE NOT EXISTS (
         SELECT 1
         FROM whatsapp_outbox
         WHERE reference_type = ?
           AND reference_id = ?
           AND TRIM(phone) = TRIM(?)
           AND status IN ('pending', 'processing')
       )`,
      [
        phone,
        message,
        source,
        maxAttempts,
        options.attachments?.length
          ? JSON.stringify(options.attachments)
          : null,
        options.referenceType,
        options.referenceId,
        options.requestedBy || null,
        options.referenceType,
        options.referenceId,
        phone
      ]
    );

    if (result.insertId) {
      return result.insertId;
    }

    const [existing] =
      await pool.query<RowDataPacket[]>(
        `SELECT id
         FROM whatsapp_outbox
         WHERE reference_type = ?
           AND reference_id = ?
           AND TRIM(phone) = TRIM(?)
           AND status IN ('pending', 'processing')
         ORDER BY id DESC
         LIMIT 1`,
        [
          options.referenceType,
          options.referenceId,
          phone
        ]
      );

    return Number(existing[0]?.id || 0);
  }

  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO whatsapp_outbox
       (phone, message, source, max_attempts, attachments_json, reference_type, reference_id, requested_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [phone, message, source, maxAttempts,
      options?.attachments?.length ? JSON.stringify(options.attachments) : null,
      options?.referenceType || null, options?.referenceId || null, options?.requestedBy || null]
  );
  return result.insertId;
}

export async function deliverWhatsappTextMessage(
  phone: string,
  message: string,
  source = 'application',
  options?: { attachments?: Array<{ id: number; name: string }>; referenceType?: string; referenceId?: number; requestedBy?: number }
) {
  if ((process.env.WHATSAPP_DELIVERY_MODE || 'direct').toLowerCase() === 'queue') {
    return { queued: true, id: await queueWhatsappTextMessage(phone, message, source, options) };
  }
  await sendWhatsappTextMessage(phone, message);
  if (options?.attachments?.length && options.referenceId) {
    const { getLaboratoryPdf } = await import('../laboratory/laboratory-pdf.service');
    for (const attachment of options.attachments) {
      const pdf = await getLaboratoryPdf(options.referenceId, attachment.id);
      await sendWhatsappDocumentMessage(phone, pdf.buffer, attachment.name);
    }
  }
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
      `SELECT id, phone, message, attempts, max_attempts, attachments_json
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
  if (!success && result.affectedRows) {
    const [failedJobs] = await pool.query<RowDataPacket[]>(
      `SELECT phone, reference_id, last_error, status
       FROM whatsapp_outbox
       WHERE id = ? AND reference_type = 'laboratory_record'
       LIMIT 1`,
      [id]
    );
    const failedJob = failedJobs[0];
    if (failedJob?.status === 'failed' && failedJob.reference_id) {
      const { markLaboratoryWhatsappFailed } =
        await import('../laboratory/laboratory.service');
      await markLaboratoryWhatsappFailed(
        Number(failedJob.reference_id),
        String(failedJob.phone || ''),
        String(failedJob.last_error || errorMessage || 'No se pudo entregar por WhatsApp')
      );
    }
  }
  if (success && result.affectedRows) {
    const { ensureLaboratoryWhatsappFailureSchema } =
      await import('../laboratory/laboratory.service');
    await ensureLaboratoryWhatsappFailureSchema();
    await pool.execute(
      `UPDATE laboratory_records lr
       INNER JOIN whatsapp_outbox wo ON wo.reference_type = 'laboratory_record' AND wo.reference_id = lr.id
       SET lr.whatsapp_notified_at = NOW(), lr.whatsapp_notified_by = wo.requested_by,
         lr.workflow_reopened_at = NULL, lr.workflow_reopened_by = NULL,
         lr.workflow_reopen_reason = NULL,
         lr.whatsapp_failed_at = NULL, lr.whatsapp_failed_phone = NULL,
         lr.whatsapp_failure_reason = NULL
       WHERE wo.id = ?`,
      [id]
    );
  }
  return result.affectedRows > 0;
}

export async function getWhatsappJobAttachment(jobId: number, pdfId: number) {
  await ensureWhatsappOutboxSchema();
  const [rows]: any = await pool.query(
    `SELECT attachments_json FROM whatsapp_outbox WHERE id = ? AND status = 'processing'`,
    [jobId]
  );
  const attachments = typeof rows[0]?.attachments_json === 'string'
    ? JSON.parse(rows[0].attachments_json) : rows[0]?.attachments_json;
  if (!Array.isArray(attachments) || !attachments.some((item: any) => Number(item.id) === pdfId)) {
    throw new Error('Adjunto no autorizado para este trabajo');
  }
  const { getLaboratoryPdf } = await import('../laboratory/laboratory-pdf.service');
  const [reference]: any = await pool.query('SELECT reference_id FROM whatsapp_outbox WHERE id = ?', [jobId]);
  return getLaboratoryPdf(Number(reference[0].reference_id), pdfId);
}
