import { pool } from '../../config/database';
import { normalizePatientPhone } from './patients-import.service';

export type PatientInput = {
  document_number: string;
  document_type?: string | null;
  last_name: string;
  first_name: string;
  phone?: string | null;
  email?: string | null;
  health_insurance?: string | null;
  affiliate_number?: string | null;
  birth_date?: string | null;
  address?: string | null;
};

export async function getPatients(q: any) {
  const search =
    String(q.search || '').trim();

  const page =
    Math.max(1, Number(q.page || 1));

  const perPage =
    Math.min(100, Math.max(10, Number(q.per_page || 25)));

  const offset =
    (page - 1) * perPage;

  const where =
    search
      ? `
        WHERE p.document_number LIKE ?
          OR p.last_name LIKE ?
          OR p.first_name LIKE ?
          OR CONCAT(p.last_name, ' ', p.first_name) LIKE ?
          OR p.email LIKE ?
          OR p.phone LIKE ?
      `
      : '';

  const params =
    search
      ? Array(6).fill(`%${search}%`)
      : [];

  const [counts]: any =
    await pool.query(
      `SELECT COUNT(*) total FROM people p ${where}`,
      params
    );

  const [data]: any =
    await pool.query(
      `
        SELECT
          p.id,
          p.document_type,
          p.document_number,
          p.last_name,
          p.first_name,
          p.phone,
          p.email,
          p.health_insurance,
          p.affiliate_number,
          p.birth_date,
          p.address,
          p.created_at,
          p.updated_at,
          COUNT(lr.id) laboratory_count,
          SUM(lr.status = 'enviado') sent_count,
          SUM(lr.status = 'parcial') partial_count,
          SUM(lr.status = 'completo') complete_count,
          SUM(lr.status = 'retirado') picked_up_count
        FROM people p
        LEFT JOIN laboratory_records lr
          ON lr.patient_id = p.id
        ${where}
        GROUP BY p.id
        ORDER BY p.last_name, p.first_name
        LIMIT ? OFFSET ?
      `,
      [
        ...params,
        perPage,
        offset
      ]
    );

  const total =
    Number(counts[0]?.total || 0);

  return {
    data,
    pagination: {
      page,
      per_page: perPage,
      total,
      total_pages:
        Math.max(1, Math.ceil(total / perPage))
    }
  };
}

export async function getPatientDetail(id: number) {
  const [rows]: any =
    await pool.query(
      `
        SELECT
          p.id,
          p.document_type,
          p.document_number,
          p.last_name,
          p.first_name,
          p.phone,
          p.email,
          p.health_insurance,
          p.affiliate_number,
          p.birth_date,
          p.address,
          p.created_at,
          p.updated_at,
          COUNT(lr.id) laboratory_count,
          SUM(lr.status = 'enviado') sent_count,
          SUM(lr.status = 'parcial') partial_count,
          SUM(lr.status = 'completo') complete_count,
          SUM(lr.status = 'retirado') picked_up_count,
          SUM(lr.status = 'expirado') expired_count
        FROM people p
        LEFT JOIN laboratory_records lr
          ON lr.patient_id = p.id
        WHERE p.id = ?
        GROUP BY p.id
      `,
      [id]
    );

  if (!rows[0]) {
    return null;
  }

  const [laboratories]: any =
    await pool.query(
      `
        SELECT
          id,
          study_date,
          status,
          has_blood_extraction,
          has_urine_sample,
          is_complete,
          missing_details,
          completed_at,
          pickup_date,
          notes
        FROM laboratory_records
        WHERE patient_id = ?
        ORDER BY study_date DESC, id DESC
      `,
      [id]
    );

  return {
    patient: rows[0],
    laboratories
  };
}

export function cleanPatientInput(body: any): PatientInput {
  return {
    document_number:
      String(body.document_number || '').replace(/\D/g, ''),
    document_type:
      body.document_type
        ? String(body.document_type).trim().toLocaleUpperCase('es-AR')
        : null,
    last_name:
      String(body.last_name || '').trim().toLocaleUpperCase('es-AR'),
    first_name:
      String(body.first_name || '').trim().toLocaleUpperCase('es-AR'),
    phone:
      normalizePatientPhone(body.phone),
    email:
      body.email
        ? String(body.email).trim().toLocaleLowerCase('es-AR')
        : null,
    health_insurance:
      body.health_insurance
        ? String(body.health_insurance).trim().toLocaleUpperCase('es-AR')
        : null,
    affiliate_number:
      body.affiliate_number
        ? String(body.affiliate_number).trim().toLocaleUpperCase('es-AR')
        : null,
    birth_date:
      body.birth_date || null,
    address:
      body.address
        ? String(body.address).trim().toLocaleUpperCase('es-AR')
        : null
  };
}

export async function createPatient(d: PatientInput) {
  const [result]: any =
    await pool.query(
      `
        INSERT INTO people (
          document_number,
          document_type,
          last_name,
          first_name,
          phone,
          email,
          health_insurance,
          affiliate_number,
          birth_date,
          address
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        d.document_number,
        d.document_type || null,
        d.last_name,
        d.first_name,
        d.phone || null,
        d.email || null,
        d.health_insurance || null,
        d.affiliate_number || null,
        d.birth_date || null,
        d.address || null
      ]
    );

  return result.insertId;
}

export async function updatePatient(
  id: number,
  d: PatientInput
) {
  await pool.query(
    `
      UPDATE people
      SET
        document_number = ?,
        document_type = ?,
        last_name = ?,
        first_name = ?,
        phone = ?,
        email = ?,
        health_insurance = ?,
        affiliate_number = ?,
        birth_date = ?,
        address = ?
      WHERE id = ?
    `,
    [
      d.document_number,
      d.document_type || null,
      d.last_name,
      d.first_name,
      d.phone || null,
      d.email || null,
      d.health_insurance || null,
      d.affiliate_number || null,
      d.birth_date || null,
      d.address || null,
      id
    ]
  );
}
