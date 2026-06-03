import { pool } from '../../config/database';

export async function getAllVaccines(
  facilityId?: number | null
) {

  const stockJoinCondition =
    facilityId
      ? 'vbs.vaccine_batch_id = vb.id AND vbs.facility_id = ?'
      : 'vbs.vaccine_batch_id = vb.id';

  const params =
    facilityId
      ? [facilityId]
      : [];

  const scopedHaving =
    facilityId
      ? 'HAVING COUNT(vbs.vaccine_batch_id) > 0'
      : '';

  const [rows]: any =
    await pool.query(
      `
        SELECT
          v.id,
          v.name,
          v.target_disease,
          v.presentation,
          v.dose_unit,
          v.description,
          v.minimum_stock,
          COALESCE(
            SUM(
              CASE
                WHEN vb.is_active = TRUE
                  THEN vbs.current_stock
                ELSE 0
              END
            ),
            0
          ) AS total_stock,
          v.is_active,
          v.created_at
        FROM vaccines v
        LEFT JOIN vaccine_batches vb
          ON vb.vaccine_id = v.id
        LEFT JOIN vaccine_batch_stocks vbs
          ON ${stockJoinCondition}
        GROUP BY
          v.id,
          v.name,
          v.target_disease,
          v.presentation,
          v.dose_unit,
          v.description,
          v.minimum_stock,
          v.is_active,
          v.created_at
        ${scopedHaving}
        ORDER BY v.name ASC
      `,
      params
    );

  return rows;
}

export async function getVaccineById(
  id: number
) {
  const [rows]: any =
    await pool.query(
      `
        SELECT
          id,
          name,
          target_disease,
          presentation,
          dose_unit,
          description,
          minimum_stock,
          is_active,
          created_at
        FROM vaccines
        WHERE id = ?
      `,
      [id]
    );

  return rows[0];
}

export async function createVaccine(
  data: any
) {
  const [result]: any =
    await pool.query(
      `
        INSERT INTO vaccines (
          name,
          target_disease,
          presentation,
          dose_unit,
          description,
          minimum_stock
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        data.name,
        data.target_disease || null,
        data.presentation || null,
        data.dose_unit || null,
        data.description || null,
        Number(data.minimum_stock || 0)
      ]
    );

  return result.insertId;
}

export async function updateVaccine(
  id: number,
  data: any
) {
  await pool.query(
    `
      UPDATE vaccines
      SET
        name = ?,
        target_disease = ?,
        presentation = ?,
        dose_unit = ?,
        description = ?,
        minimum_stock = ?
      WHERE id = ?
    `,
    [
      data.name,
      data.target_disease || null,
      data.presentation || null,
      data.dose_unit || null,
      data.description || null,
      Number(data.minimum_stock || 0),
      id
    ]
  );

  return true;
}

export async function toggleVaccine(
  id: number
) {
  await pool.query(
    `
      UPDATE vaccines
      SET is_active = NOT is_active
      WHERE id = ?
    `,
    [id]
  );

  return true;
}
