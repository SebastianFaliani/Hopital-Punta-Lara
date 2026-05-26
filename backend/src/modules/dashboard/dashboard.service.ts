import { pool }
  from '../../config/database';

async function getSingleValue(
  sql: string
) {

  const [rows]: any =
    await pool.query(sql);

  return Number(
    Object.values(rows[0] || {})[0] || 0
  );
}

export async function getDashboardStats() {

  const [
    totalUsers,
    activeUsers,
    inactiveUsers,
    totalMedications,
    activeMedications,
    totalBatches,
    lowStockMedications,
    expiringBatches,
    expiredBatches,
    totalTransfers,
    pendingTransfers,
    todayTransfers,
    activeAmbulances,
    activeDrivers,
    activeShifts,
    totalVaccines,
    activeVaccines,
    totalVaccineBatches,
    lowStockVaccines,
    expiringVaccineBatches,
    expiredVaccineBatches,
    activeEmployees,
    absentToday,
    pendingLeaveRequests
  ] = await Promise.all([
    getSingleValue(
      'SELECT COUNT(*) AS value FROM users'
    ),
    getSingleValue(
      'SELECT COUNT(*) AS value FROM users WHERE is_active = TRUE'
    ),
    getSingleValue(
      'SELECT COUNT(*) AS value FROM users WHERE is_active = FALSE'
    ),
    getSingleValue(
      'SELECT COUNT(*) AS value FROM medications'
    ),
    getSingleValue(
      'SELECT COUNT(*) AS value FROM medications WHERE is_active = TRUE'
    ),
    getSingleValue(
      'SELECT COUNT(*) AS value FROM medication_batches'
    ),
    getSingleValue(
      `
        SELECT COUNT(*) AS value
        FROM (
          SELECT
            m.id,
            m.minimum_stock,
            COALESCE(
              SUM(
                CASE
                  WHEN mb.is_active = TRUE
                    THEN mb.current_stock
                  ELSE 0
                END
              ),
              0
            ) AS total_stock
          FROM medications m
          LEFT JOIN medication_batches mb
            ON mb.medication_id = m.id
          WHERE m.is_active = TRUE
          GROUP BY m.id, m.minimum_stock
          HAVING total_stock <= m.minimum_stock
        ) low_stock
      `
    ),
    getSingleValue(
      `
        SELECT COUNT(*) AS value
        FROM medication_batches
        WHERE is_active = TRUE
        AND expiration_date BETWEEN CURDATE()
          AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
      `
    ),
    getSingleValue(
      `
        SELECT COUNT(*) AS value
        FROM medication_batches
        WHERE is_active = TRUE
        AND expiration_date < CURDATE()
      `
    ),
    getSingleValue(
      'SELECT COUNT(*) AS value FROM transfer_requests'
    ),
    getSingleValue(
      `
        SELECT COUNT(*) AS value
        FROM transfer_requests
        WHERE status IN ('pendiente', 'programado', 'en_proceso')
      `
    ),
    getSingleValue(
      `
        SELECT COUNT(*) AS value
        FROM transfer_requests
        WHERE transfer_date = CURDATE()
      `
    ),
    getSingleValue(
      'SELECT COUNT(*) AS value FROM ambulances WHERE is_active = TRUE'
    ),
    getSingleValue(
      'SELECT COUNT(*) AS value FROM drivers WHERE is_active = TRUE'
    ),
    getSingleValue(
      `
        SELECT COUNT(*) AS value
        FROM driver_shifts
        WHERE status = 'activa'
      `
    ),
    getSingleValue(
      'SELECT COUNT(*) AS value FROM vaccines'
    ),
    getSingleValue(
      'SELECT COUNT(*) AS value FROM vaccines WHERE is_active = TRUE'
    ),
    getSingleValue(
      'SELECT COUNT(*) AS value FROM vaccine_batches'
    ),
    getSingleValue(
      `
        SELECT COUNT(*) AS value
        FROM (
          SELECT
            v.id,
            v.minimum_stock,
            COALESCE(
              SUM(
                CASE
                  WHEN vb.is_active = TRUE
                    THEN vb.current_stock
                  ELSE 0
                END
              ),
              0
            ) AS total_stock
          FROM vaccines v
          LEFT JOIN vaccine_batches vb
            ON vb.vaccine_id = v.id
          WHERE v.is_active = TRUE
          GROUP BY v.id, v.minimum_stock
          HAVING total_stock <= v.minimum_stock
        ) low_stock
      `
    ),
    getSingleValue(
      `
        SELECT COUNT(*) AS value
        FROM vaccine_batches
        WHERE is_active = TRUE
        AND expiration_date BETWEEN CURDATE()
          AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
      `
    ),
    getSingleValue(
      `
        SELECT COUNT(*) AS value
        FROM vaccine_batches
        WHERE is_active = TRUE
        AND expiration_date < CURDATE()
      `
    ),
    getSingleValue(
      'SELECT COUNT(*) AS value FROM employees WHERE is_active = TRUE'
    ),
    getSingleValue(
      `
        SELECT COUNT(*) AS value
        FROM attendance_records ar
        INNER JOIN attendance_codes ac
          ON ac.id = ar.attendance_code_id
        WHERE ar.attendance_date = CURDATE()
          AND ac.code <> 'P'
      `
    ),
    getSingleValue(
      `
        SELECT COUNT(*) AS value
        FROM leave_requests
        WHERE status = 'pendiente'
      `
    )
  ]);

  const [upcomingTransfers]: any =
    await pool.query(
      `
        SELECT
          tr.id,
          tr.patient_name,
          tr.destination_type,
          tr.destination_address,
          tt.trip_type,
          tt.scheduled_datetime,
          tt.status,
          a.internal_code AS ambulance_code,
          CONCAT(d.first_name, ' ', d.last_name)
            AS driver_name
        FROM transfer_trips tt
        INNER JOIN transfer_requests tr
          ON tr.id = tt.transfer_request_id
        LEFT JOIN ambulances a
          ON a.id = tt.ambulance_id
        LEFT JOIN drivers d
          ON d.id = tt.driver_id
        WHERE tt.status IN ('pendiente', 'asignado', 'en_camino')
        ORDER BY tt.scheduled_datetime ASC
        LIMIT 6
      `
    );

  const [criticalMedications]: any =
    await pool.query(
      `
        SELECT
          m.id,
          m.name,
          m.minimum_stock,
          COALESCE(
            SUM(
              CASE
                WHEN mb.is_active = TRUE
                  THEN mb.current_stock
                ELSE 0
              END
            ),
            0
          ) AS total_stock
        FROM medications m
        LEFT JOIN medication_batches mb
          ON mb.medication_id = m.id
        WHERE m.is_active = TRUE
        GROUP BY m.id, m.name, m.minimum_stock
        HAVING total_stock <= m.minimum_stock
        ORDER BY total_stock ASC, m.name ASC
        LIMIT 6
      `
    );

  const [criticalVaccines]: any =
    await pool.query(
      `
        SELECT
          v.id,
          v.name,
          v.minimum_stock,
          COALESCE(
            SUM(
              CASE
                WHEN vb.is_active = TRUE
                  THEN vb.current_stock
                ELSE 0
              END
            ),
            0
          ) AS total_stock
        FROM vaccines v
        LEFT JOIN vaccine_batches vb
          ON vb.vaccine_id = v.id
        WHERE v.is_active = TRUE
        GROUP BY v.id, v.name, v.minimum_stock
        HAVING total_stock <= v.minimum_stock
        ORDER BY total_stock ASC, v.name ASC
        LIMIT 6
      `
    );

  const [expiringMedicationBatchesList]: any =
    await pool.query(
      `
        SELECT
          m.name,
          mb.batch_number,
          mb.expiration_date,
          mb.current_stock
        FROM medication_batches mb
        INNER JOIN medications m
          ON m.id = mb.medication_id
        WHERE mb.is_active = TRUE
          AND mb.expiration_date BETWEEN CURDATE()
          AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
        ORDER BY mb.expiration_date ASC
        LIMIT 6
      `
    );

  const [expiringVaccineBatchesList]: any =
    await pool.query(
      `
        SELECT
          v.name,
          vb.batch_number,
          vb.expiration_date,
          vb.current_stock
        FROM vaccine_batches vb
        INNER JOIN vaccines v
          ON v.id = vb.vaccine_id
        WHERE vb.is_active = TRUE
          AND vb.expiration_date BETWEEN CURDATE()
          AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
        ORDER BY vb.expiration_date ASC
        LIMIT 6
      `
    );

  return {
    users: {
      total: totalUsers,
      active: activeUsers,
      inactive: inactiveUsers
    },
    pharmacy: {
      medications: totalMedications,
      activeMedications,
      batches: totalBatches,
      lowStock: lowStockMedications,
      expiringBatches,
      expiredBatches
    },
    transfers: {
      total: totalTransfers,
      pending: pendingTransfers,
      today: todayTransfers,
      activeAmbulances,
      activeDrivers,
      activeShifts
    },
    vaccines: {
      total: totalVaccines,
      active: activeVaccines,
      batches: totalVaccineBatches,
      lowStock: lowStockVaccines,
      expiringBatches: expiringVaccineBatches,
      expiredBatches: expiredVaccineBatches
    },
    personnel: {
      activeEmployees,
      absentToday,
      pendingLeaveRequests
    },
    upcomingTransfers,
    criticalMedications,
    criticalVaccines,
    expiringMedicationBatches: expiringMedicationBatchesList,
    expiringVaccineBatches: expiringVaccineBatchesList
  };
}
