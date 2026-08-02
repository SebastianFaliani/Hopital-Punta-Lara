import { pool }
  from '../../config/database';

const shiftTimes: Record<string, {
  start: string;
  end: string;
}> = {
  manana: {
    start: '08:00',
    end: '15:00'
  },
  tarde: {
    start: '15:00',
    end: '21:00'
  }
};

function resolveShiftTime(
  shiftType: string,
  field: 'start' | 'end',
  fallback?: string
) {
  return (
    fallback ||
    shiftTimes[shiftType]?.[field] ||
    shiftTimes.manana[field]
  );
}

export async function getAllDriverShifts() {

  const [rows]: any =
    await pool.query(
      `
        SELECT
          ds.id,
          ds.driver_id,
          ds.covered_by_driver_id,
          ds.ambulance_id,
          DATE_FORMAT(ds.shift_date, '%Y-%m-%d')
            AS shift_date,
          ds.shift_type,
          DATE_FORMAT(
            ds.start_datetime,
            '%Y-%m-%dT%H:%i:%s'
          ) AS start_datetime,
          DATE_FORMAT(
            ds.end_datetime,
            '%Y-%m-%dT%H:%i:%s'
          ) AS end_datetime,
          ds.status,
          ds.notes,
          ds.created_at,
          ds.updated_at,
          COALESCE(
            e.full_name,
            CONCAT(d.first_name, ' ', d.last_name)
          ) AS driver_name,
          COALESCE(
            covering_employee.full_name,
            CONCAT(covering_driver.first_name, ' ', covering_driver.last_name)
          ) AS covered_by_driver_name,
          a.internal_code
            AS ambulance_code,
          a.plate
            AS ambulance_plate
        FROM driver_shifts ds
        INNER JOIN drivers d
          ON d.id = ds.driver_id
        LEFT JOIN employees e
          ON e.id = d.employee_id
        LEFT JOIN drivers covering_driver
          ON covering_driver.id = ds.covered_by_driver_id
        LEFT JOIN employees covering_employee
          ON covering_employee.id = covering_driver.employee_id
        LEFT JOIN ambulances a
          ON a.id = ds.ambulance_id
        ORDER BY ds.start_datetime DESC, driver_name ASC
      `
    );

  return rows;
}

export async function createDriverShift(
  data: any
) {
  const shiftDate =
    data.shift_date ||
    String(data.start_datetime).slice(0, 10);

  const shiftType =
    data.shift_type || 'manana';

  const startTime =
    resolveShiftTime(
      shiftType,
      'start',
      data.start_time
    );

  const endTime =
    resolveShiftTime(
      shiftType,
      'end',
      data.end_time
    );

  const [busyRows]: any =
    await pool.query(
      `
        SELECT id
        FROM driver_shifts
        WHERE shift_date = ?
          AND shift_type = ?
          AND (
            driver_id = ?
            OR covered_by_driver_id = ?
          )
        LIMIT 1
      `,
      [
        shiftDate,
        shiftType,
        data.driver_id,
        data.driver_id
      ]
    );

  if (busyRows.length > 0) {
    throw new Error(
      'El chofer seleccionado ya tiene una guardia en ese dia y turno'
    );
  }

  const [result]: any =
    await pool.query(
      `
        INSERT INTO driver_shifts (
          driver_id,
          covered_by_driver_id,
          shift_date,
          shift_type,
          ambulance_id,
          start_datetime,
          end_datetime,
          status,
          notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        data.driver_id,
        data.covered_by_driver_id || null,
        shiftDate,
        shiftType,
        data.ambulance_id || null,
        data.start_datetime || `${shiftDate} ${startTime}:00`,
        data.end_datetime || `${shiftDate} ${endTime}:00`,
        data.status ?? 'programada',
        data.notes || null
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
        shift_type: 'manana',
        days: data.morning_days || [],
        start_time:
          data.morning_start_time || '08:00',
        end_time:
          data.morning_end_time || '15:00'
      },
      {
        shift_type: 'tarde',
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
              AND DATE_FORMAT(start_datetime, '%Y-%m') = ?
              AND TIME_FORMAT(start_datetime, '%H:%i') IN (?, ?)
          `,
          [
            data.driver_id,
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
          group.shift_type === 'tarde' &&
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
                AND shift_date = ?
                AND shift_type = ?
              LIMIT 1
            `,
            [
              data.driver_id,
              date,
              group.shift_type
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
              shift_date,
              shift_type,
              ambulance_id,
              start_datetime,
              end_datetime,
              status
            )
            VALUES (?, ?, ?, NULL, ?, ?, 'programada')
          `,
          [
            data.driver_id,
            date,
            group.shift_type,
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
  data: any,
  changedBy?: number | null
) {
  const shiftDate =
    data.shift_date ||
    String(data.start_datetime).slice(0, 10);

  const shiftType =
    data.shift_type || 'manana';

  const startTime =
    resolveShiftTime(
      shiftType,
      'start',
      data.start_time
    );

  const endTime =
    resolveShiftTime(
      shiftType,
      'end',
      data.end_time
    );

  const connection =
    await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [currentRows]: any =
      await connection.query(
        `
          SELECT
            driver_id,
            covered_by_driver_id
          FROM driver_shifts
          WHERE id = ?
          LIMIT 1
        `,
        [id]
      );

    if (currentRows.length === 0) {
      throw new Error('La guardia no existe');
    }

    const current =
      currentRows[0];

    const originalDriverId =
      Number(data.driver_id);

    const coveredByDriverId =
      data.covered_by_driver_id &&
      Number(data.covered_by_driver_id) !==
        originalDriverId
        ? Number(data.covered_by_driver_id)
        : null;

    if (coveredByDriverId) {
      const [busyRows]: any =
        await connection.query(
          `
            SELECT id
            FROM driver_shifts
            WHERE id <> ?
              AND shift_date = ?
              AND shift_type = ?
              AND (
                driver_id = ?
                OR covered_by_driver_id = ?
              )
            LIMIT 1
          `,
          [
            id,
            shiftDate,
            shiftType,
            coveredByDriverId,
            coveredByDriverId
          ]
        );

      if (busyRows.length > 0) {
        throw new Error(
          'El chofer seleccionado ya tiene una guardia en ese dia y turno'
        );
      }
    }

    await connection.query(
    `
      UPDATE driver_shifts
      SET
        driver_id = ?,
        covered_by_driver_id = ?,
        shift_date = ?,
        shift_type = ?,
        ambulance_id = ?,
        start_datetime = ?,
        end_datetime = ?,
        status = ?,
        notes = ?
      WHERE id = ?
    `,
    [
      data.driver_id,
      coveredByDriverId,
      shiftDate,
      shiftType,
      data.ambulance_id || null,
      data.start_datetime || `${shiftDate} ${startTime}:00`,
      data.end_datetime || `${shiftDate} ${endTime}:00`,
      data.status || 'programada',
      data.notes || null,
      id
    ]
    );

    const previousCoveringDriverId =
      current.covered_by_driver_id
        ? Number(current.covered_by_driver_id)
        : null;

    if (
      Number(current.driver_id) !==
        originalDriverId ||
      previousCoveringDriverId !==
        coveredByDriverId
    ) {
      await connection.query(
        `
          INSERT INTO driver_shift_changes (
            shift_id,
            original_driver_id,
            previous_covering_driver_id,
            covering_driver_id,
            reason,
            notes,
            changed_by
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          id,
          originalDriverId,
          previousCoveringDriverId,
          coveredByDriverId,
          data.change_reason || 'cambio_guardia',
          data.notes || null,
          changedBy || null
        ]
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return true;
}

export async function deleteDriverShift(
  id: number
) {
  await pool.query(
    `
      DELETE FROM driver_shifts
      WHERE id = ?
    `,
    [id]
  );

  return true;
}

function buildChangeFilters(
  filters: any
) {
  const where = [
    '1 = 1'
  ];

  const values: any[] = [];

  if (filters.date_from) {
    where.push('ds.shift_date >= ?');
    values.push(filters.date_from);
  }

  if (filters.date_to) {
    where.push('ds.shift_date <= ?');
    values.push(filters.date_to);
  }

  if (filters.driver_id) {
    where.push(`
      (
        dsc.original_driver_id = ?
        OR dsc.covering_driver_id = ?
      )
    `);
    values.push(
      filters.driver_id,
      filters.driver_id
    );
  }

  return {
    where: where.join(' AND '),
    values
  };
}

export async function getDriverShiftChangeReport(
  filters: any
) {
  const filter =
    buildChangeFilters(filters);

  const [historyRows]: any =
    await pool.query(
      `
        SELECT
          dsc.id,
          dsc.shift_id,
          DATE_FORMAT(ds.shift_date, '%Y-%m-%d')
            AS shift_date,
          ds.shift_type,
          dsc.original_driver_id,
          COALESCE(
            original_employee.full_name,
            CONCAT(original_driver.first_name, ' ', original_driver.last_name)
          ) AS original_driver_name,
          dsc.previous_covering_driver_id,
          COALESCE(
            previous_employee.full_name,
            CONCAT(previous_driver.first_name, ' ', previous_driver.last_name)
          ) AS previous_covering_driver_name,
          dsc.covering_driver_id,
          COALESCE(
            covering_employee.full_name,
            CONCAT(covering_driver.first_name, ' ', covering_driver.last_name)
          ) AS covering_driver_name,
          dsc.reason,
          dsc.notes,
          dsc.changed_by,
          u.username AS changed_by_username,
          DATE_FORMAT(dsc.created_at, '%Y-%m-%dT%H:%i:%s')
            AS created_at
        FROM driver_shift_changes dsc
        INNER JOIN driver_shifts ds
          ON ds.id = dsc.shift_id
        INNER JOIN drivers original_driver
          ON original_driver.id = dsc.original_driver_id
        LEFT JOIN employees original_employee
          ON original_employee.id = original_driver.employee_id
        LEFT JOIN drivers previous_driver
          ON previous_driver.id = dsc.previous_covering_driver_id
        LEFT JOIN employees previous_employee
          ON previous_employee.id = previous_driver.employee_id
        LEFT JOIN drivers covering_driver
          ON covering_driver.id = dsc.covering_driver_id
        LEFT JOIN employees covering_employee
          ON covering_employee.id = covering_driver.employee_id
        LEFT JOIN users u
          ON u.id = dsc.changed_by
        WHERE ${filter.where}
        ORDER BY dsc.created_at DESC
      `,
      filter.values
    );

  const [requestedRows]: any =
    await pool.query(
      `
        SELECT
          dsc.original_driver_id AS driver_id,
          COALESCE(
            e.full_name,
            CONCAT(d.first_name, ' ', d.last_name)
          ) AS driver_name,
          COUNT(*) AS total
        FROM driver_shift_changes dsc
        INNER JOIN driver_shifts ds
          ON ds.id = dsc.shift_id
        INNER JOIN drivers d
          ON d.id = dsc.original_driver_id
        LEFT JOIN employees e
          ON e.id = d.employee_id
        WHERE ${filter.where}
          AND dsc.covering_driver_id IS NOT NULL
        GROUP BY dsc.original_driver_id, driver_name
        ORDER BY total DESC, driver_name ASC
      `,
      filter.values
    );

  const [coveredRows]: any =
    await pool.query(
      `
        SELECT
          dsc.covering_driver_id AS driver_id,
          COALESCE(
            e.full_name,
            CONCAT(d.first_name, ' ', d.last_name)
          ) AS driver_name,
          COUNT(*) AS total
        FROM driver_shift_changes dsc
        INNER JOIN driver_shifts ds
          ON ds.id = dsc.shift_id
        INNER JOIN drivers d
          ON d.id = dsc.covering_driver_id
        LEFT JOIN employees e
          ON e.id = d.employee_id
        WHERE ${filter.where}
          AND dsc.covering_driver_id IS NOT NULL
        GROUP BY dsc.covering_driver_id, driver_name
        ORDER BY total DESC, driver_name ASC
      `,
      filter.values
    );

  const [pairRows]: any =
    await pool.query(
      `
        SELECT
          dsc.original_driver_id,
          COALESCE(
            original_employee.full_name,
            CONCAT(original_driver.first_name, ' ', original_driver.last_name)
          ) AS original_driver_name,
          dsc.covering_driver_id,
          COALESCE(
            covering_employee.full_name,
            CONCAT(covering_driver.first_name, ' ', covering_driver.last_name)
          ) AS covering_driver_name,
          COUNT(*) AS total
        FROM driver_shift_changes dsc
        INNER JOIN driver_shifts ds
          ON ds.id = dsc.shift_id
        INNER JOIN drivers original_driver
          ON original_driver.id = dsc.original_driver_id
        LEFT JOIN employees original_employee
          ON original_employee.id = original_driver.employee_id
        INNER JOIN drivers covering_driver
          ON covering_driver.id = dsc.covering_driver_id
        LEFT JOIN employees covering_employee
          ON covering_employee.id = covering_driver.employee_id
        WHERE ${filter.where}
          AND dsc.covering_driver_id IS NOT NULL
        GROUP BY
          dsc.original_driver_id,
          original_driver_name,
          dsc.covering_driver_id,
          covering_driver_name
        ORDER BY total DESC, original_driver_name ASC
      `,
      filter.values
    );

  return {
    history: historyRows,
    requested_by_driver: requestedRows.map((row: any) => ({
      ...row,
      total: Number(row.total || 0)
    })),
    covered_by_driver: coveredRows.map((row: any) => ({
      ...row,
      total: Number(row.total || 0)
    })),
    pairs: pairRows.map((row: any) => ({
      ...row,
      total: Number(row.total || 0)
    }))
  };
}
