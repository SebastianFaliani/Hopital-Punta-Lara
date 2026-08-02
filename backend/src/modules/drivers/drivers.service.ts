import { pool }
  from '../../config/database';

function splitFullName(
  fullName: string
) {
  const parts =
    String(fullName || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  if (parts.length <= 1) {
    return {
      first_name: parts[0] || '',
      last_name: ''
    };
  }

  return {
    first_name:
      parts.slice(0, -1).join(' '),
    last_name:
      parts.slice(-1).join(' ')
  };
}

async function getEmployee(
  employeeId: number
) {
  const [rows]: any =
    await pool.query(
      `
        SELECT
          id,
          full_name,
          phone,
          license_number,
          license_expiration_date,
          is_active
        FROM employees
        WHERE id = ?
        LIMIT 1
      `,
      [employeeId]
    );

  return rows[0] || null;
}

async function ensureDriverDepartment(
  employeeId: number
) {
  const [employeeRows]: any =
    await pool.query(
      `
        SELECT facility_id
        FROM employees
        WHERE id = ?
        LIMIT 1
      `,
      [employeeId]
    );

  const facilityId =
    Number(employeeRows[0]?.facility_id || 0);

  if (!facilityId) {
    return;
  }

  await pool.query(
    `
      INSERT INTO employee_departments (
        facility_id,
        name,
        description,
        is_active
      )
      SELECT ?, 'CHOFERES', 'Choferes habilitados para el modulo de traslados', TRUE
      WHERE NOT EXISTS (
        SELECT 1
        FROM employee_departments
        WHERE facility_id = ?
          AND UPPER(TRIM(name)) = 'CHOFERES'
      )
    `,
    [
      facilityId,
      facilityId
    ]
  );

  await pool.query(
    `
      UPDATE employees e
      INNER JOIN employee_departments d
        ON d.facility_id = e.facility_id
        AND UPPER(TRIM(d.name)) = 'CHOFERES'
      SET e.department_id = d.id
      WHERE e.id = ?
    `,
    [employeeId]
  );
}

export async function getAllDrivers() {

  const [rows]: any =
    await pool.query(
      `
        SELECT
          d.id,
          e.id AS employee_id,
          e.full_name,
          SUBSTRING_INDEX(e.full_name, ' ', 1) AS first_name,
          TRIM(
            SUBSTRING(
              e.full_name,
              LENGTH(SUBSTRING_INDEX(e.full_name, ' ', 1)) + 1
            )
          ) AS last_name,
          e.phone,
          e.license_number,
          DATE_FORMAT(
            e.license_expiration_date,
            '%Y-%m-%d'
          ) AS license_expiration_date,
          CASE
            WHEN e.license_expiration_date IS NULL THEN 0
            WHEN e.license_expiration_date < CURDATE() THEN 2
            WHEN e.license_expiration_date <= DATE_ADD(CURDATE(), INTERVAL 15 DAY) THEN 1
            ELSE 0
          END AS license_alert_level,
          COALESCE(d.is_active, FALSE) AS is_active,
          d.created_at,
          d.updated_at
        FROM employees e
        INNER JOIN employee_departments dept
          ON dept.id = e.department_id
          AND UPPER(TRIM(dept.name)) = 'CHOFERES'
        LEFT JOIN drivers d
          ON d.employee_id = e.id
        WHERE e.is_active = TRUE
        ORDER BY
          e.full_name ASC
      `
    );

  return rows;
}

export async function createDriver(
  data: any
) {
  const employeeId =
    Number(data.employee_id);

  const employee =
    await getEmployee(employeeId);

  if (!employee) {
    throw new Error('El empleado seleccionado no existe');
  }

  const [existingRows]: any =
    await pool.query(
      `
        SELECT id
        FROM drivers
        WHERE employee_id = ?
        LIMIT 1
      `,
      [employee.id]
    );

  if (existingRows.length > 0) {
    throw new Error('El empleado ya esta habilitado como chofer');
  }

  const name =
    splitFullName(employee.full_name);

  const [result]: any =
    await pool.query(
      `
        INSERT INTO drivers (
          employee_id,
          first_name,
          last_name,
          phone,
          license_number,
          license_expiration_date
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        employee.id,
        name.first_name,
        name.last_name,
        employee.phone || null,
        data.license_number || null,
        data.license_expiration_date || null
      ]
    );

  await pool.query(
    `
      UPDATE employees
      SET
        license_number = ?,
        license_expiration_date = ?
      WHERE id = ?
    `,
    [
      data.license_number || employee.license_number || null,
      data.license_expiration_date || null,
      employee.id
    ]
  );

  await ensureDriverDepartment(
    employee.id
  );

  return result.insertId;
}

export async function updateDriver(
  id: number,
  data: any
) {
  const employeeId =
    Number(data.employee_id);

  const employee =
    await getEmployee(employeeId);

  if (!employee) {
    throw new Error('El empleado seleccionado no existe');
  }

  const [existingRows]: any =
    await pool.query(
      `
        SELECT id
        FROM drivers
        WHERE employee_id = ?
          AND id <> ?
        LIMIT 1
      `,
      [
        employee.id,
        id
      ]
    );

  if (existingRows.length > 0) {
    throw new Error('El empleado ya esta habilitado como chofer');
  }

  const name =
    splitFullName(employee.full_name);

  await pool.query(
    `
      UPDATE drivers
      SET
        employee_id = ?,
        first_name = ?,
        last_name = ?,
        phone = ?,
        license_number = ?,
        license_expiration_date = ?
      WHERE id = ?
    `,
    [
      employee.id,
      name.first_name,
      name.last_name,
      employee.phone || null,
      data.license_number || null,
      data.license_expiration_date || null,
      id
    ]
  );

  await pool.query(
    `
      UPDATE employees
      SET
        license_number = ?,
        license_expiration_date = ?
      WHERE id = ?
    `,
    [
      data.license_number || null,
      data.license_expiration_date || null,
      employee.id
    ]
  );

  await ensureDriverDepartment(
    employee.id
  );

  return true;
}

export async function getDriverLicenseAlertsSummary() {
  const [rows]: any =
    await pool.query(
      `
        SELECT
          COUNT(*) AS alert_count,
          SUM(
            CASE
              WHEN e.license_expiration_date < CURDATE() THEN 1
              ELSE 0
            END
          ) AS overdue_count
        FROM employees e
        INNER JOIN employee_departments dept
          ON dept.id = e.department_id
          AND UPPER(TRIM(dept.name)) = 'CHOFERES'
        WHERE e.is_active = TRUE
          AND e.license_expiration_date IS NOT NULL
          AND e.license_expiration_date <= DATE_ADD(CURDATE(), INTERVAL 15 DAY)
      `
    );

  return {
    alert_count:
      Number(rows[0]?.alert_count || 0),
    overdue_count:
      Number(rows[0]?.overdue_count || 0)
  };
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
