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
          DATE_FORMAT(
            ds.start_datetime,
            '%Y-%m-%dT%H:%i:%s'
          ) AS start_datetime,
          DATE_FORMAT(
            ds.end_datetime,
            '%Y-%m-%dT%H:%i:%s'
          ) AS end_datetime,
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

export async function createBulkDriverShifts(
  data: any
) {
  const connection =
    await pool.getConnection();

  try {
    await connection.beginTransaction();

    const groups = [
      {
        days: data.morning_days || [],
        start_time:
          data.morning_start_time || '08:00',
        end_time:
          data.morning_end_time || '15:00'
      },
      {
        days: data.afternoon_days || [],
        start_time:
          data.afternoon_start_time || '15:00',
        end_time:
          data.afternoon_end_time || '21:00'
      }
    ];

    let created = 0;
    let skipped = 0;
    let deleted = 0;

    if (data.sync_existing) {
      const [deleteResult]: any =
        await connection.query(
          `
            DELETE FROM driver_shifts
            WHERE driver_id = ?
              AND ambulance_id = ?
              AND DATE_FORMAT(start_datetime, '%Y-%m') = ?
              AND TIME_FORMAT(start_datetime, '%H:%i') IN (?, ?)
          `,
          [
            data.driver_id,
            data.ambulance_id,
            data.month,
            data.morning_start_time || '08:00',
            data.afternoon_start_time || '15:00'
          ]
        );

      deleted =
        Number(deleteResult.affectedRows || 0);
    }

    for (const group of groups) {
      for (const rawDay of group.days) {
        const day =
          String(Number(rawDay))
            .padStart(2, '0');

        const start =
          `${data.month}-${day} ${group.start_time}:00`;

        const [year, monthNumber] =
          String(data.month)
            .split('-')
            .map(Number);

        const weekday =
          new Date(
            year,
            monthNumber - 1,
            Number(rawDay)
          ).getDay();

        const date =
          `${data.month}-${day}`;

        const [holidayRows]: any =
          await connection.query(
            `
              SELECT id
              FROM transfer_holidays
              WHERE holiday_date = ?
              LIMIT 1
            `,
            [date]
          );

        const isWeekendOrHoliday =
          weekday === 0 ||
          weekday === 6 ||
          holidayRows.length > 0;

        const endTime =
          group.start_time ===
            data.afternoon_start_time &&
          isWeekendOrHoliday
            ? '22:00'
            : group.end_time;

        const end =
          `${data.month}-${day} ${endTime}:00`;

        const [duplicates]: any =
          await connection.query(
            `
              SELECT id
              FROM driver_shifts
              WHERE driver_id = ?
                AND ambulance_id = ?
                AND start_datetime = ?
                AND end_datetime = ?
              LIMIT 1
            `,
            [
              data.driver_id,
              data.ambulance_id,
              start,
              end
            ]
          );

        if (duplicates.length > 0) {
          skipped += 1;
          continue;
        }

        await connection.query(
          `
            INSERT INTO driver_shifts (
              driver_id,
              ambulance_id,
              start_datetime,
              end_datetime,
              status
            )
            VALUES (?, ?, ?, ?, 'programada')
          `,
          [
            data.driver_id,
            data.ambulance_id,
            start,
            end
          ]
        );

        created += 1;
      }
    }

    await connection.commit();

    return {
      created,
      skipped,
      deleted
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
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
