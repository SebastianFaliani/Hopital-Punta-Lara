import { pool }
  from '../../config/database';

export async function getAllDrivers() {

  const [rows]: any =
    await pool.query(
      `
        SELECT
          id,
          first_name,
          last_name,
          phone,
          license_number,
          is_active,
          created_at,
          updated_at
        FROM drivers
        ORDER BY last_name ASC, first_name ASC
      `
    );

  return rows;
}

export async function createDriver(
  data: any
) {

  const [result]: any =
    await pool.query(
      `
        INSERT INTO drivers (
          first_name,
          last_name,
          phone,
          license_number
        )
        VALUES (?, ?, ?, ?)
      `,
      [
        data.first_name,
        data.last_name,
        data.phone,
        data.license_number
      ]
    );

  return result.insertId;
}

export async function updateDriver(
  id: number,
  data: any
) {

  await pool.query(
    `
      UPDATE drivers
      SET
        first_name = ?,
        last_name = ?,
        phone = ?,
        license_number = ?
      WHERE id = ?
    `,
    [
      data.first_name,
      data.last_name,
      data.phone,
      data.license_number,
      id
    ]
  );

  return true;
}

export async function toggleDriver(
  id: number
) {

  await pool.query(
    `
      UPDATE drivers
      SET is_active = NOT is_active
      WHERE id = ?
    `,
    [id]
  );

  return true;
}
