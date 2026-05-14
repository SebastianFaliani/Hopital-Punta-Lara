import { pool }
  from '../../config/database';

export async function getRoles() {

  const [rows] =
    await pool.query(
      `
        SELECT
          id,
          name
        FROM roles
        ORDER BY name ASC
      `
    );

  return rows;
}