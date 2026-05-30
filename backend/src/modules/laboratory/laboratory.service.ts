import { pool } from '../../config/database';

type LaboratoryFilters = {
  search?: string;
  date_from?: string;
  date_to?: string;
  sample_type?: string;
  pickup_status?: string;
};

function buildWhereClause(
  filters: LaboratoryFilters
) {
  const where: string[] = [];
  const values: any[] = [];

  if (filters.search) {
    const search =
      `%${filters.search}%`;

    where.push(
      `(
        patient_last_name LIKE ?
        OR patient_first_name LIKE ?
        OR patient_document LIKE ?
        OR picked_up_by LIKE ?
      )`
    );

    values.push(
      search,
      search,
      search,
      search
    );
  }

  if (filters.date_from) {
    where.push(
      'study_date >= ?'
    );
    values.push(filters.date_from);
  }

  if (filters.date_to) {
    where.push(
      'study_date <= ?'
    );
    values.push(filters.date_to);
  }

  if (filters.sample_type === 'sangre') {
    where.push(
      'has_blood_extraction = TRUE AND has_urine_sample = FALSE'
    );
  }

  if (filters.sample_type === 'orina') {
    where.push(
      'has_urine_sample = TRUE AND has_blood_extraction = FALSE'
    );
  }

  if (filters.sample_type === 'ambas') {
    where.push(
      'has_blood_extraction = TRUE AND has_urine_sample = TRUE'
    );
  }

  if (filters.pickup_status === 'retirado') {
    where.push(
      'pickup_date IS NOT NULL'
    );
  }

  if (filters.pickup_status === 'pendiente') {
    where.push(
      'pickup_date IS NULL'
    );
  }

  return {
    sql:
      where.length > 0
        ? `WHERE ${where.join(' AND ')}`
        : '',
    values
  };
}

export async function getLaboratoryRecords(
  filters: LaboratoryFilters
) {
  const where =
    buildWhereClause(filters);

  const [rows]: any =
    await pool.query(
      `
        SELECT
          lr.id,
          lr.study_date,
          lr.patient_last_name,
          lr.patient_first_name,
          lr.patient_document,
          lr.has_blood_extraction,
          lr.has_urine_sample,
          lr.pickup_date,
          lr.picked_up_by,
          lr.pickup_document,
          lr.notes,
          lr.created_at,
          lr.updated_at,
          cu.username AS created_by_username,
          uu.username AS updated_by_username
        FROM laboratory_records lr
        LEFT JOIN users cu
          ON cu.id = lr.created_by
        LEFT JOIN users uu
          ON uu.id = lr.updated_by
        ${where.sql}
        ORDER BY lr.study_date DESC, lr.id DESC
      `,
      where.values
    );

  return rows;
}

export async function getLaboratoryStats(
  filters: LaboratoryFilters
) {
  const where =
    buildWhereClause(filters);

  const [rows]: any =
    await pool.query(
      `
        SELECT
          COUNT(*) AS total_records,
          SUM(CASE WHEN has_blood_extraction = TRUE THEN 1 ELSE 0 END) AS blood_extractions,
          SUM(CASE WHEN has_urine_sample = TRUE THEN 1 ELSE 0 END) AS urine_samples,
          SUM(CASE WHEN has_blood_extraction = TRUE AND has_urine_sample = TRUE THEN 1 ELSE 0 END) AS both_samples,
          SUM(CASE WHEN pickup_date IS NULL THEN 1 ELSE 0 END) AS pending_pickups,
          SUM(CASE WHEN pickup_date IS NOT NULL THEN 1 ELSE 0 END) AS delivered_results
        FROM laboratory_records
        ${where.sql}
      `,
      where.values
    );

  return rows[0];
}

export async function getLaboratoryRecordById(
  id: number
) {
  const [rows]: any =
    await pool.query(
      `
        SELECT *
        FROM laboratory_records
        WHERE id = ?
      `,
      [id]
    );

  return rows[0];
}

export async function createLaboratoryRecord(
  data: any,
  userId?: number
) {
  const [result]: any =
    await pool.query(
      `
        INSERT INTO laboratory_records (
          study_date,
          patient_last_name,
          patient_first_name,
          patient_document,
          has_blood_extraction,
          has_urine_sample,
          pickup_date,
          picked_up_by,
          pickup_document,
          notes,
          created_by,
          updated_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        data.study_date,
        data.patient_last_name,
        data.patient_first_name,
        data.patient_document || null,
        Boolean(data.has_blood_extraction),
        Boolean(data.has_urine_sample),
        data.pickup_date || null,
        data.picked_up_by || null,
        data.pickup_document || null,
        data.notes || null,
        userId || null,
        userId || null
      ]
    );

  return result.insertId;
}

export async function updateLaboratoryRecord(
  id: number,
  data: any,
  userId?: number
) {
  await pool.query(
    `
      UPDATE laboratory_records
      SET
        study_date = ?,
        patient_last_name = ?,
        patient_first_name = ?,
        patient_document = ?,
        has_blood_extraction = ?,
        has_urine_sample = ?,
        pickup_date = ?,
        picked_up_by = ?,
        pickup_document = ?,
        notes = ?,
        updated_by = ?
      WHERE id = ?
    `,
    [
      data.study_date,
      data.patient_last_name,
      data.patient_first_name,
      data.patient_document || null,
      Boolean(data.has_blood_extraction),
      Boolean(data.has_urine_sample),
      data.pickup_date || null,
      data.picked_up_by || null,
      data.pickup_document || null,
      data.notes || null,
      userId || null,
      id
    ]
  );

  return true;
}

