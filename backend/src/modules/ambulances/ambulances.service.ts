import { pool }
  from '../../config/database';

function nullableText(value: any) {
  const normalized =
    String(value || '')
      .trim();

  return normalized || null;
}

async function syncAmbulanceMaintenanceStatus(
  ambulanceId: number
) {
  await pool.query(
    `
      UPDATE ambulances
      SET status = 'mantenimiento'
      WHERE id = ?
        AND status <> 'mantenimiento'
    `,
    [ambulanceId]
  );
}

async function getAmbulanceType(
  id: number
) {
  const [rows]: any =
    await pool.query(
      `
        SELECT id, name, is_active
        FROM ambulance_types
        WHERE id = ?
        LIMIT 1
      `,
      [id]
    );

  return rows[0] || null;
}

export async function getAllAmbulanceTypes() {
  const [rows]: any =
    await pool.query(
      `
        SELECT
          id,
          name,
          is_active,
          created_at,
          updated_at
        FROM ambulance_types
        ORDER BY is_active DESC, name ASC
      `
    );

  return rows;
}

export async function createAmbulanceType(
  data: any
) {
  const [result]: any =
    await pool.query(
      `
        INSERT INTO ambulance_types (name)
        VALUES (?)
      `,
      [
        String(data.name || '')
          .trim()
      ]
    );

  return result.insertId;
}

export async function updateAmbulanceType(
  id: number,
  data: any
) {
  await pool.query(
    `
      UPDATE ambulance_types
      SET name = ?
      WHERE id = ?
    `,
    [
      String(data.name || '')
        .trim(),
      id
    ]
  );

  await pool.query(
    `
      UPDATE ambulances a
      INNER JOIN ambulance_types at
        ON at.id = a.ambulance_type_id
      SET a.type = at.name
      WHERE a.ambulance_type_id = ?
    `,
    [id]
  );

  return true;
}

export async function toggleAmbulanceType(
  id: number
) {
  await pool.query(
    `
      UPDATE ambulance_types
      SET is_active = NOT is_active
      WHERE id = ?
    `,
    [id]
  );

  return true;
}

export async function getAllAmbulances() {

  const [rows]: any =
    await pool.query(
      `
        SELECT
          a.id,
          a.internal_code,
          a.plate,
          a.brand,
          a.model,
          a.ambulance_type_id,
          COALESCE(at.name, a.type) AS type,
          COALESCE(at.name, a.type) AS type_name,
          a.status,
          a.is_active,
          COALESCE(ma.alert_count, 0) AS maintenance_alert_count,
          DATE_FORMAT(ma.next_alert_date, '%Y-%m-%d') AS next_maintenance_date,
          (
            SELECT m.maintenance_type
            FROM ambulance_maintenance_records m
            WHERE m.ambulance_id = a.id
              AND (
                (
                  m.status = 'programado'
                  AND m.start_date <= DATE_ADD(CURDATE(), INTERVAL 15 DAY)
                )
                OR (
                  m.status <> 'cancelado'
                  AND m.next_service_date IS NOT NULL
                  AND m.next_service_date <= DATE_ADD(CURDATE(), INTERVAL 15 DAY)
                )
              )
            ORDER BY
              LEAST(
                COALESCE(m.start_date, '9999-12-31'),
                COALESCE(m.next_service_date, '9999-12-31')
              ) ASC,
              m.id ASC
            LIMIT 1
          ) AS next_maintenance_type,
          a.created_at,
          a.updated_at
        FROM ambulances a
        LEFT JOIN ambulance_types at
          ON at.id = a.ambulance_type_id
        LEFT JOIN (
          SELECT
            alerts.ambulance_id,
            COUNT(*) AS alert_count,
            MIN(alerts.alert_date) AS next_alert_date
          FROM (
            SELECT
              ambulance_id,
              start_date AS alert_date
            FROM ambulance_maintenance_records
            WHERE status = 'programado'
              AND start_date <= DATE_ADD(CURDATE(), INTERVAL 15 DAY)

            UNION ALL

            SELECT
              ambulance_id,
              next_service_date AS alert_date
            FROM ambulance_maintenance_records
            WHERE status <> 'cancelado'
              AND next_service_date IS NOT NULL
              AND next_service_date <= DATE_ADD(CURDATE(), INTERVAL 15 DAY)
          ) alerts
          GROUP BY alerts.ambulance_id
        ) ma
          ON ma.ambulance_id = a.id
        ORDER BY a.internal_code ASC, a.plate ASC
      `
    );

  return rows;
}

export async function getMaintenanceAlertsSummary() {
  const [rows]: any =
    await pool.query(
      `
        SELECT
          COUNT(*) AS alert_count,
          SUM(
            CASE
              WHEN alerts.alert_date < CURDATE() THEN 1
              ELSE 0
            END
          ) AS overdue_count
        FROM (
          SELECT
            ambulance_id,
            start_date AS alert_date
          FROM ambulance_maintenance_records
          WHERE status = 'programado'
            AND start_date <= DATE_ADD(CURDATE(), INTERVAL 15 DAY)

          UNION ALL

          SELECT
            ambulance_id,
            next_service_date AS alert_date
          FROM ambulance_maintenance_records
          WHERE status <> 'cancelado'
            AND next_service_date IS NOT NULL
            AND next_service_date <= DATE_ADD(CURDATE(), INTERVAL 15 DAY)
        ) alerts
      `
    );

  return {
    alert_count:
      Number(rows[0]?.alert_count || 0),
    overdue_count:
      Number(rows[0]?.overdue_count || 0)
  };
}

export async function createAmbulance(
  data: any
) {
  const type =
    await getAmbulanceType(
      Number(data.ambulance_type_id)
    );

  if (!type || !type.is_active) {
    throw new Error(
      'El tipo de ambulancia no es valido'
    );
  }

  const [result]: any =
    await pool.query(
      `
        INSERT INTO ambulances (
          internal_code,
          plate,
          brand,
          model,
          ambulance_type_id,
          type,
          status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        data.internal_code,
        data.plate,
        nullableText(data.brand),
        nullableText(data.model),
        type.id,
        type.name,
        data.status ?? 'disponible'
      ]
    );

  return result.insertId;
}

export async function updateAmbulance(
  id: number,
  data: any
) {
  const type =
    await getAmbulanceType(
      Number(data.ambulance_type_id)
    );

  if (!type || !type.is_active) {
    throw new Error(
      'El tipo de ambulancia no es valido'
    );
  }

  await pool.query(
    `
      UPDATE ambulances
      SET
        internal_code = ?,
        plate = ?,
        brand = ?,
        model = ?,
        ambulance_type_id = ?,
        type = ?,
        status = ?
      WHERE id = ?
    `,
    [
      data.internal_code,
      data.plate,
      nullableText(data.brand),
      nullableText(data.model),
      type.id,
      type.name,
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

export async function getAmbulanceMaintenanceRecords(
  ambulanceId: number
) {
  const [rows]: any =
    await pool.query(
      `
        SELECT
          amr.*,
          DATE_FORMAT(amr.start_date, '%Y-%m-%d') AS start_date,
          DATE_FORMAT(amr.end_date, '%Y-%m-%d') AS end_date,
          DATE_FORMAT(amr.next_service_date, '%Y-%m-%d') AS next_service_date,
          CONCAT(u.first_name, ' ', u.last_name) AS created_by_name
        FROM ambulance_maintenance_records amr
        LEFT JOIN users u
          ON u.id = amr.created_by
        WHERE amr.ambulance_id = ?
        ORDER BY amr.start_date DESC, amr.id DESC
      `,
      [ambulanceId]
    );

  return rows;
}

export async function createAmbulanceMaintenanceRecord(
  ambulanceId: number,
  data: any,
  userId: number | null
) {
  const [result]: any =
    await pool.query(
      `
        INSERT INTO ambulance_maintenance_records (
          ambulance_id,
          maintenance_type,
          start_date,
          end_date,
          odometer_km,
          workshop_name,
          description,
          next_service_date,
          next_service_km,
          status,
          notes,
          created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        ambulanceId,
        data.maintenance_type,
        data.start_date,
        data.end_date || null,
        data.odometer_km || null,
        nullableText(data.workshop_name),
        nullableText(data.description),
        data.next_service_date || null,
        data.next_service_km || null,
        data.status || 'programado',
        nullableText(data.notes),
        userId
      ]
    );

  if (data.status === 'en_reparacion') {
    await syncAmbulanceMaintenanceStatus(
      ambulanceId
    );
  }

  return result.insertId;
}

export async function updateAmbulanceMaintenanceRecord(
  id: number,
  data: any
) {
  await pool.query(
    `
      UPDATE ambulance_maintenance_records
      SET
        maintenance_type = ?,
        start_date = ?,
        end_date = ?,
        odometer_km = ?,
        workshop_name = ?,
        description = ?,
        next_service_date = ?,
        next_service_km = ?,
        status = ?,
        notes = ?
      WHERE id = ?
    `,
    [
      data.maintenance_type,
      data.start_date,
      data.end_date || null,
      data.odometer_km || null,
      nullableText(data.workshop_name),
      nullableText(data.description),
      data.next_service_date || null,
      data.next_service_km || null,
      data.status || 'programado',
      nullableText(data.notes),
      id
    ]
  );

  if (data.status === 'en_reparacion') {
    await pool.query(
      `
        UPDATE ambulances a
        INNER JOIN ambulance_maintenance_records amr
          ON amr.ambulance_id = a.id
        SET a.status = 'mantenimiento'
        WHERE amr.id = ?
          AND a.status <> 'mantenimiento'
      `,
      [id]
    );
  }

  return true;
}
