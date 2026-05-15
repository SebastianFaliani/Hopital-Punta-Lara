import { pool }
  from '../../config/database';

export async function getAllDriverShifts() {

  const [rows]: any =
    await pool.query(
      `
        SELECT
          ds.id,
          ds.driver_id,
          ds.ambulance_id,
          ds.start_datetime,
          ds.end_datetime,
          ds.status,
          ds.created_at,
          ds.updated_at,
          CONCAT(d.first_name, ' ', d.last_name)
            AS driver_name,
          a.internal_code
            AS ambulance_code,
          a.plate
            AS ambulance_plate
        FROM driver_shifts ds
        INNER JOIN drivers d
          ON d.id = ds.driver_id
        INNER JOIN ambulances a
          ON a.id = ds.ambulance_id
        ORDER BY ds.start_datetime DESC
      `
    );

  return rows;
}

export async function createDriverShift(
  data: any
) {

  const [result]: any =
    await pool.query(
      `
        INSERT INTO driver_shifts (
          driver_id,
          ambulance_id,
          start_datetime,
          end_datetime,
          status
        )
        VALUES (?, ?, ?, ?, ?)
      `,
      [
        data.driver_id,
        data.ambulance_id,
        data.start_datetime,
        data.end_datetime,
        data.status ?? 'programada'
      ]
    );

  return result.insertId;
}

export async function updateDriverShift(
  id: number,
  data: any
) {

  await pool.query(
    `
      UPDATE driver_shifts
      SET
        driver_id = ?,
        ambulance_id = ?,
        start_datetime = ?,
        end_datetime = ?,
        status = ?
      WHERE id = ?
    `,
    [
      data.driver_id,
      data.ambulance_id,
      data.start_datetime,
      data.end_datetime,
      data.status,
      id
    ]
  );

  return true;
}
