import { Readable } from 'stream';
import { google } from 'googleapis';
import { pool } from '../../config/database';

let schemaReady: Promise<void> | null = null;

export function ensureLaboratoryPdfSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      const additions = [
        ['result_pdf_drive_id', 'VARCHAR(255) NULL'],
        ['result_pdf_name', 'VARCHAR(255) NULL'],
        ['result_pdf_uploaded_at', 'DATETIME NULL'],
        ['result_pdf_uploaded_by', 'BIGINT NULL'],
        ['workflow_reopened_at', 'DATETIME NULL'],
        ['workflow_reopened_by', 'BIGINT NULL'],
        ['workflow_reopen_reason', 'VARCHAR(500) NULL'],
      ];
      const [columns]: any = await pool.query(`
        SELECT COLUMN_NAME FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'laboratory_records'
      `);
      const existing = new Set(columns.map((row: any) => row.COLUMN_NAME));
      for (const [name, definition] of additions) {
        if (!existing.has(name)) {
          await pool.query(`ALTER TABLE laboratory_records ADD COLUMN ${name} ${definition}`);
        }
      }
      await pool.query(`
        CREATE TABLE IF NOT EXISTS laboratory_result_pdfs (
          id BIGINT NOT NULL AUTO_INCREMENT,
          laboratory_record_id BIGINT NOT NULL,
          drive_file_id VARCHAR(255) NOT NULL,
          file_name VARCHAR(255) NOT NULL,
          uploaded_by BIGINT NULL,
          uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uq_laboratory_pdf_drive (drive_file_id),
          INDEX idx_laboratory_pdf_record (laboratory_record_id, uploaded_at)
        )
      `);
      await pool.query(`
        INSERT IGNORE INTO laboratory_result_pdfs
          (laboratory_record_id, drive_file_id, file_name, uploaded_by, uploaded_at)
        SELECT id, result_pdf_drive_id, COALESCE(result_pdf_name, CONCAT('laboratorio-', id, '.pdf')),
          result_pdf_uploaded_by, COALESCE(result_pdf_uploaded_at, NOW())
        FROM laboratory_records WHERE result_pdf_drive_id IS NOT NULL
      `);
      await pool.query(`
        UPDATE laboratory_records
        SET result_pdf_drive_id = NULL, result_pdf_name = NULL,
          result_pdf_uploaded_at = NULL, result_pdf_uploaded_by = NULL
        WHERE result_pdf_drive_id IS NOT NULL
      `);
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

function driveClient() {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Google Drive no esta configurado');
  }
  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });
  return google.drive({ version: 'v3', auth });
}

export async function uploadLaboratoryPdf(
  recordId: number,
  file: { buffer: Buffer; originalname: string },
  userId?: number,
) {
  await ensureLaboratoryPdfSchema();
  const [rows]: any = await pool.query(
    `SELECT id, status, pickup_date, whatsapp_notified_at, workflow_reopened_at
     FROM laboratory_records WHERE id = ?`,
    [recordId],
  );
  if (!rows[0]) throw new Error('Estudio de laboratorio no encontrado');
  if ((rows[0].pickup_date || rows[0].whatsapp_notified_at) && !rows[0].workflow_reopened_at) {
    throw new Error('No se pueden agregar PDF porque el laboratorio ya fue entregado');
  }

  const folderId = process.env.GOOGLE_DRIVE_LAB_FOLDER_ID;
  if (!folderId) throw new Error('Falta GOOGLE_DRIVE_LAB_FOLDER_ID');
  const drive = driveClient();
  const safeName = file.originalname.replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(0, 220);
  const result = await drive.files.create({
    requestBody: { name: safeName, parents: [folderId] },
    media: { mimeType: 'application/pdf', body: Readable.from(file.buffer) },
    fields: 'id,name',
  });
  if (!result.data.id) throw new Error('Google Drive no devolvio el identificador del PDF');

  const [insert]: any = await pool.execute(
    `INSERT INTO laboratory_result_pdfs
       (laboratory_record_id, drive_file_id, file_name, uploaded_by)
     VALUES (?, ?, ?, ?)`,
    [recordId, result.data.id, result.data.name || safeName, userId || null],
  );
  return { id: insert.insertId, driveId: result.data.id, name: result.data.name || safeName };
}

export async function getLaboratoryPdf(recordId: number, pdfId: number) {
  await ensureLaboratoryPdfSchema();
  const [rows]: any = await pool.query(
    `SELECT drive_file_id, file_name FROM laboratory_result_pdfs
     WHERE id = ? AND laboratory_record_id = ?`,
    [pdfId, recordId],
  );
  if (!rows[0]) throw new Error('Estudio de laboratorio no encontrado');
  if (!rows[0]) throw new Error('PDF no encontrado');
  const response = await driveClient().files.get(
    { fileId: rows[0].drive_file_id, alt: 'media' },
    { responseType: 'arraybuffer' },
  );
  return {
    buffer: Buffer.from(response.data as ArrayBuffer),
    name: rows[0].file_name || `laboratorio-${recordId}.pdf`,
  };
}

export async function getLaboratoryPdfMetadata(recordId: number) {
  await ensureLaboratoryPdfSchema();
  const [rows]: any = await pool.query(
    `SELECT p.id, p.file_name, p.uploaded_at, p.uploaded_by,
       COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), u.username) uploaded_by_name
     FROM laboratory_result_pdfs p LEFT JOIN users u ON u.id = p.uploaded_by
     WHERE p.laboratory_record_id = ? ORDER BY p.uploaded_at DESC, p.id DESC`,
    [recordId],
  );
  return rows;
}

export async function deleteLaboratoryPdf(recordId: number, pdfId: number) {
  await ensureLaboratoryPdfSchema();
  const [rows]: any = await pool.query(
    `SELECT p.drive_file_id, p.file_name, lr.pickup_date, lr.whatsapp_notified_at,
       lr.workflow_reopened_at
     FROM laboratory_result_pdfs p
     INNER JOIN laboratory_records lr ON lr.id = p.laboratory_record_id
     WHERE p.id = ? AND p.laboratory_record_id = ?`, [pdfId, recordId],
  );
  if (!rows[0]) throw new Error('PDF no encontrado');
  if ((rows[0].pickup_date || rows[0].whatsapp_notified_at) && !rows[0].workflow_reopened_at) {
    throw new Error('No se pueden quitar PDF porque el laboratorio ya fue entregado');
  }
  await driveClient().files.delete({ fileId: rows[0].drive_file_id }).catch((error: any) => {
    if (Number(error?.code || error?.response?.status) !== 404) throw error;
  });
  await pool.execute('DELETE FROM laboratory_result_pdfs WHERE id = ? AND laboratory_record_id = ?', [pdfId, recordId]);
  return { id: pdfId, name: rows[0].file_name };
}
