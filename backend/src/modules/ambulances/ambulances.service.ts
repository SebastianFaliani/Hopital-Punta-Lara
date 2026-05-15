import { pool }
  from '../../config/database';

export async function getAllAmbulances() {

  const [rows]: any =
    await pool.query(
      `
        SELECT
          id,
          internal_code,
          plate,
          brand,
          model,
          type,
          status,
          is_active,
          created_at,
          updated_at
        FROM ambulances
        ORDER BY internal_code ASC, plate ASC
      `
    );

  return rows;
}

export async function createAmbulance(
  data: any
) {

  const [result]: any =
    await pool.query(
      `
        INSERT INTO ambulances (
          internal_code,
          plate,
          brand,
          model,
          type,
          status
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        data.internal_code,
        data.plate,
        data.brand,
        data.model,
        data.type,
        data.status ?? 'disponible'
      ]
    );

  return result.insertId;
}

export async function updateAmbulance(
  id: number,
  data: any
) {

  await pool.query(
    `
      UPDATE ambulances
      SET
        internal_code = ?,
        plate = ?,
        brand = ?,
        model = ?,
        type = ?,
        status = ?
      WHERE id = ?
    `,
    [
      data.internal_code,
      data.plate,
      data.brand,
      data.model,
      data.type,
      data.status,
      id
    ]
  );

  return true;
}

export async function toggleAmbulance(
  id: number
) {

  await pool.query(
    `
      UPDATE ambulances
      SET is_active = NOT is_active
      WHERE id = ?
    `,
    [id]
  );

  return true;
}
