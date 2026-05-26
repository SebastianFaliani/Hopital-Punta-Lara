import { pool }
  from '../../config/database';

function toDateOnly(
  value: string | Date
) {

  return new Date(value)
    .toISOString()
    .slice(0, 10);
}

function addDays(
  date: Date,
  days: number
) {

  const copy =
    new Date(date);

  copy.setDate(
    copy.getDate() + days
  );

  return copy;
}

function dateDiffDays(
  from: Date,
  to: Date
) {

  const start =
    new Date(
      from.getFullYear(),
      from.getMonth(),
      from.getDate()
    );

  const end =
    new Date(
      to.getFullYear(),
      to.getMonth(),
      to.getDate()
    );

  return Math.ceil(
    (end.getTime() - start.getTime()) /
      86400000
  );
}

function countInclusiveDays(
  startDate: string,
  endDate: string
) {

  return dateDiffDays(
    new Date(startDate),
    new Date(endDate)
  ) + 1;
}

function countBusinessDays(
  startDate: string,
  endDate: string
) {

  let current =
    new Date(startDate);

  const end =
    new Date(endDate);

  let total = 0;

  while (current <= end) {
    const day =
      current.getDay();

    if (day !== 0 && day !== 6) {
      total += 1;
    }

    current =
      addDays(
        current,
        1
      );
  }

  return total;
}

function getSeniorityYears(
  hireDate: string | null
) {

  if (!hireDate) {
    return 0;
  }

  return Math.max(
    0,
    dateDiffDays(
      new Date(hireDate),
      new Date()
    ) / 365.25
  );
}

function getSeniorityAtYearStart(
  hireDate: string | null,
  year: number
) {

  if (!hireDate) {
    return 0;
  }

  const startOfYear =
    new Date(year, 0, 1);

  const hire =
    new Date(hireDate);

  if (hire > startOfYear) {
    return 0;
  }

  return Math.floor(
    Math.max(
      0,
      dateDiffDays(
        hire,
        startOfYear
      ) / 365.25
    )
  );
}

function getCode29Allowance(
  employee: any,
  year: number
) {

  if (employee.is_professional) {
    return 12;
  }

  const seniority =
    getSeniorityAtYearStart(
      employee.hire_date,
      year
    );

  return seniority > 5
    ? 9
    : 6;
}

function getWeekBounds(
  value: string
) {

  const date =
    new Date(`${value}T00:00:00`);

  const day =
    date.getDay();

  const diffToMonday =
    day === 0
      ? -6
      : 1 - day;

  const start =
    addDays(
      date,
      diffToMonday
    );

  const end =
    addDays(
      start,
      6
    );

  return {
    start: toDateOnly(start),
    end: toDateOnly(end)
  };
}

export async function getDepartments() {

  const [rows]: any =
    await pool.query(
      `
        SELECT
          id,
          name,
          description,
          is_active
        FROM employee_departments
        ORDER BY name ASC
      `
    );

  return rows;
}

export async function createDepartment(
  data: any
) {

  const [result]: any =
    await pool.query(
      `
        INSERT INTO employee_departments (
          name,
          description
        )
        VALUES (?, ?)
      `,
      [
        data.name,
        data.description || null
      ]
    );

  return result.insertId;
}

export async function getAttendanceCodes() {

  const [rows]: any =
    await pool.query(
      `
        SELECT
          id,
          code,
          description,
          category,
          counts_as_present,
          requires_approval,
          requires_documentation,
          affects_salary,
          annual_limit_days,
          advance_notice_days,
          is_active
        FROM attendance_codes
        ORDER BY code ASC
      `
    );

  return rows;
}

export async function updateAttendanceCode(
  id: number,
  data: any
) {

  await pool.query(
    `
      UPDATE attendance_codes
      SET
        code = ?,
        description = ?,
        category = ?,
        counts_as_present = ?,
        requires_approval = ?,
        requires_documentation = ?,
        affects_salary = ?,
        annual_limit_days = ?,
        advance_notice_days = ?,
        is_active = ?
      WHERE id = ?
    `,
    [
      data.code,
      data.description,
      data.category,
      Boolean(data.counts_as_present),
      Boolean(data.requires_approval),
      Boolean(data.requires_documentation),
      Boolean(data.affects_salary),
      data.annual_limit_days || null,
      data.advance_notice_days || null,
      data.is_active ?? true,
      id
    ]
  );

  return true;
}

export async function createAttendanceCode(
  data: any
) {

  const cleanCode =
    String(data.code || '')
      .trim()
      .toUpperCase();

  if (!cleanCode || !data.description) {
    throw new Error(
      'Codigo y descripcion son obligatorios'
    );
  }

  const [result]: any =
    await pool.query(
      `
        INSERT INTO attendance_codes (
          code,
          description,
          category,
          counts_as_present,
          requires_approval,
          requires_documentation,
          affects_salary,
          annual_limit_days,
          advance_notice_days,
          is_active
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        cleanCode,
        data.description,
        data.category || 'otro',
        Boolean(data.counts_as_present),
        Boolean(data.requires_approval),
        Boolean(data.requires_documentation),
        Boolean(data.affects_salary),
        data.annual_limit_days || null,
        data.advance_notice_days || null,
        data.is_active ?? true
      ]
    );

  return result.insertId;
}

function getPeriodName(
  year: number,
  month: number
) {

  const date =
    new Date(year, month - 1, 1);

  return new Intl.DateTimeFormat(
    'es-AR',
    {
      month: 'long',
      year: 'numeric'
    }
  ).format(date);
}

function getDaysInMonth(
  year: number,
  month: number
) {

  return new Date(year, month, 0)
    .getDate();
}

function getDateKey(
  year: number,
  month: number,
  day: number
) {

  return [
    year,
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0')
  ].join('-');
}

export async function getOrCreateAttendancePeriod(
  year: number,
  month: number
) {

  const name =
    getPeriodName(year, month);

  await pool.query(
    `
      INSERT INTO attendance_periods (
        year,
        month,
        name
      )
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name)
    `,
    [
      year,
      month,
      name
    ]
  );

  const [rows]: any =
    await pool.query(
      `
        SELECT
          id,
          year,
          month,
          name,
          status
        FROM attendance_periods
        WHERE year = ?
          AND month = ?
        LIMIT 1
      `,
      [
        year,
        month
      ]
    );

  return rows[0];
}

export async function getAttendanceMonth(
  year: number,
  month: number,
  departmentId: number | null
) {

  const period =
    await getOrCreateAttendancePeriod(
      year,
      month
    );

  const params: any[] = [];

  let departmentFilter = '';

  if (departmentId) {
    departmentFilter =
      'AND e.department_id = ?';
    params.push(departmentId);
  }

  const [employees]: any =
    await pool.query(
      `
        SELECT
          e.id,
          e.full_name,
          e.dni,
          e.file_number,
          e.department_id,
          d.name AS department_name
        FROM employees e
        LEFT JOIN employee_departments d
          ON d.id = e.department_id
        WHERE e.is_active = TRUE
          ${departmentFilter}
        ORDER BY
          d.name ASC,
          e.full_name ASC
      `,
      params
    );

  const [records]: any =
    await pool.query(
      `
        SELECT
          ar.employee_id,
          DAY(ar.attendance_date) AS day,
          ac.code,
          ac.description
        FROM attendance_records ar
        LEFT JOIN attendance_codes ac
          ON ac.id = ar.attendance_code_id
        WHERE ar.attendance_period_id = ?
        ORDER BY
          ar.employee_id ASC,
          ar.attendance_date ASC
      `,
      [period.id]
    );

  const recordMap =
    new Map<string, any>();

  for (const record of records) {
    recordMap.set(
      `${record.employee_id}-${record.day}`,
      {
        code: record.code || '',
        description: record.description || ''
      }
    );
  }

  const days =
    getDaysInMonth(
      year,
      month
    );

  const rows =
    employees.map((employee: any) => {

      const attendance: Record<string, any> = {};

      for (let day = 1; day <= days; day += 1) {
        attendance[day] =
          recordMap.get(
            `${employee.id}-${day}`
          ) || {
            code: '',
            description: ''
          };
      }

      return {
        ...employee,
        attendance
      };
    });

  return {
    period,
    days,
    employees: rows
  };
}

export async function saveAttendanceMonth(
  year: number,
  month: number,
  records: any[],
  userId?: number
) {

  const period =
    await getOrCreateAttendancePeriod(
      year,
      month
    );

  const days =
    getDaysInMonth(
      year,
      month
    );

  const connection =
    await pool.getConnection();

  try {

    await connection.beginTransaction();

    for (const record of records) {

      const employeeId =
        Number(record.employee_id);

      const day =
        Number(record.day);

      const code =
        String(record.code || '')
          .trim()
          .toUpperCase();

      if (!employeeId || !day || day < 1 || day > days) {
        continue;
      }

      const attendanceDate =
        getDateKey(
          year,
          month,
          day
        );

      if (!code) {
        await connection.query(
          `
            DELETE FROM attendance_records
            WHERE employee_id = ?
              AND attendance_date = ?
          `,
          [
            employeeId,
            attendanceDate
          ]
        );

        continue;
      }

      const [codeRows]: any =
        await connection.query(
          `
            SELECT id
            FROM attendance_codes
            WHERE code = ?
              AND is_active = TRUE
            LIMIT 1
          `,
          [code]
        );

      if (!codeRows.length) {
        throw new Error(
          `La clave ${code} no existe o esta inactiva`
        );
      }

      await connection.query(
        `
          INSERT INTO attendance_records (
            employee_id,
            attendance_period_id,
            attendance_code_id,
            attendance_date,
            raw_code,
            source,
            created_by
          )
          VALUES (?, ?, ?, ?, ?, 'manual', ?)
          ON DUPLICATE KEY UPDATE
            attendance_period_id = VALUES(attendance_period_id),
            attendance_code_id = VALUES(attendance_code_id),
            raw_code = VALUES(raw_code),
            source = 'manual',
            updated_at = CURRENT_TIMESTAMP
        `,
        [
          employeeId,
          period.id,
          codeRows[0].id,
          attendanceDate,
          code,
          userId || null
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

export async function getAttendanceSummary(
  year: number,
  month: number,
  departmentId: number | null
) {

  const period =
    await getOrCreateAttendancePeriod(
      year,
      month
    );

  const params: any[] =
    [period.id];

  let departmentFilter = '';

  if (departmentId) {
    departmentFilter =
      'AND e.department_id = ?';
    params.push(departmentId);
  }

  const [rows]: any =
    await pool.query(
      `
        SELECT
          e.id AS employee_id,
          e.full_name,
          d.name AS department_name,
          ac.category,
          COUNT(ar.id) AS total
        FROM employees e
        LEFT JOIN employee_departments d
          ON d.id = e.department_id
        LEFT JOIN attendance_records ar
          ON ar.employee_id = e.id
          AND ar.attendance_period_id = ?
        LEFT JOIN attendance_codes ac
          ON ac.id = ar.attendance_code_id
        WHERE e.is_active = TRUE
          ${departmentFilter}
        GROUP BY
          e.id,
          e.full_name,
          d.name,
          ac.category
        ORDER BY
          d.name ASC,
          e.full_name ASC
      `,
      params
    );

  const summary =
    new Map<number, any>();

  for (const row of rows) {
    if (!summary.has(row.employee_id)) {
      summary.set(
        row.employee_id,
        {
          employee_id: row.employee_id,
          full_name: row.full_name,
          department_name: row.department_name,
          presente: 0,
          franco: 0,
          licencia: 0,
          vacaciones: 0,
          maternidad: 0,
          gremial: 0,
          ausencia: 0,
          otro: 0,
          sin_cargar: 0
        }
      );
    }

    const item =
      summary.get(row.employee_id);

    const category =
      row.category || 'sin_cargar';

    item[category] =
      Number(row.total);
  }

  return Array.from(summary.values());
}

async function getEmployeeForLeave(
  employeeId: number
) {

  const [rows]: any =
    await pool.query(
      `
        SELECT
          id,
          full_name,
          hire_date,
          is_professional
        FROM employees
        WHERE id = ?
        LIMIT 1
      `,
      [employeeId]
    );

  if (!rows.length) {
    throw new Error(
      'El empleado no existe'
    );
  }

  return rows[0];
}

export async function getVacationRules() {

  const [rows]: any =
    await pool.query(
      `
        SELECT
          id,
          min_years,
          max_years,
          allowed_days,
          is_active
        FROM vacation_seniority_rules
        ORDER BY min_years ASC
      `
    );

  return rows;
}

export async function createVacationRule(
  data: any
) {

  const [result]: any =
    await pool.query(
      `
        INSERT INTO vacation_seniority_rules (
          min_years,
          max_years,
          allowed_days,
          is_active
        )
        VALUES (?, ?, ?, ?)
      `,
      [
        Number(data.min_years || 0),
        data.max_years === '' ||
          data.max_years === undefined ||
          data.max_years === null
          ? null
          : Number(data.max_years),
        Number(data.allowed_days || 0),
        data.is_active ?? true
      ]
    );

  return result.insertId;
}

export async function updateVacationRule(
  id: number,
  data: any
) {

  await pool.query(
    `
      UPDATE vacation_seniority_rules
      SET
        min_years = ?,
        max_years = ?,
        allowed_days = ?,
        is_active = ?
      WHERE id = ?
    `,
    [
      Number(data.min_years || 0),
      data.max_years === '' ||
        data.max_years === undefined ||
        data.max_years === null
        ? null
        : Number(data.max_years),
      Number(data.allowed_days || 0),
      data.is_active ?? true,
      id
    ]
  );

  return true;
}

async function getVacationCodeId() {

  const code =
    await getCodeForLeave('8');

  return code.id;
}

async function calculateVacationAllowance(
  employee: any,
  year: number
) {

  const seniority =
    getSeniorityAtYearStart(
      employee.hire_date,
      year
    );

  const [rows]: any =
    await pool.query(
      `
        SELECT allowed_days
        FROM vacation_seniority_rules
        WHERE is_active = TRUE
          AND min_years <= ?
          AND (
            max_years IS NULL
            OR ? < max_years
          )
        ORDER BY min_years DESC
        LIMIT 1
      `,
      [
        seniority,
        seniority
      ]
    );

  return Number(
    rows[0]?.allowed_days || 14
  );
}

async function getVacationUsage(
  employeeId: number,
  year: number
) {

  const [rows]: any =
    await pool.query(
      `
        SELECT
          COALESCE(SUM(CASE WHEN lr.status = 'aprobado' THEN lr.total_days ELSE 0 END), 0) AS approved_days,
          COALESCE(SUM(CASE WHEN lr.status = 'pendiente' THEN lr.total_days ELSE 0 END), 0) AS pending_days
        FROM leave_requests lr
        INNER JOIN attendance_codes ac
          ON ac.id = lr.attendance_code_id
        WHERE lr.employee_id = ?
          AND ac.code = '8'
          AND YEAR(lr.start_date) = ?
      `,
      [
        employeeId,
        year
      ]
    );

  const [adjustments]: any =
    await pool.query(
      `
        SELECT
          COALESCE(SUM(lba.used_days), 0) AS days
        FROM leave_balance_adjustments lba
        INNER JOIN attendance_codes ac
          ON ac.id = lba.attendance_code_id
        WHERE lba.employee_id = ?
          AND ac.code = '8'
          AND lba.year = ?
      `,
      [
        employeeId,
        year
      ]
    );

  return {
    approvedDays:
      Number(rows[0].approved_days || 0) +
      Number(adjustments[0].days || 0),
    pendingDays:
      Number(rows[0].pending_days || 0)
  };
}

async function ensureVacationBalance(
  employeeId: number,
  year: number
) {

  const employee =
    await getEmployeeForLeave(employeeId);

  const codeId =
    await getVacationCodeId();

  const allowance =
    await calculateVacationAllowance(
      employee,
      year
    );

  const usage =
    await getVacationUsage(
      employeeId,
      year
    );

  await pool.query(
    `
      INSERT INTO employee_leave_balances (
        employee_id,
        attendance_code_id,
        year,
        allowed_days,
        used_days,
        remaining_days
      )
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        used_days = VALUES(used_days),
        remaining_days = allowed_days - VALUES(used_days)
    `,
    [
      employeeId,
      codeId,
      year,
      allowance,
      usage.approvedDays,
      allowance - usage.approvedDays
    ]
  );

  const [rows]: any =
    await pool.query(
      `
        SELECT
          id,
          employee_id,
          year,
          allowed_days,
          used_days,
          remaining_days
        FROM employee_leave_balances
        WHERE employee_id = ?
          AND attendance_code_id = ?
          AND year = ?
        LIMIT 1
      `,
      [
        employeeId,
        codeId,
        year
      ]
    );

  return {
    ...rows[0],
    pending_days: usage.pendingDays,
    available_days:
      Number(rows[0].allowed_days) -
      Number(rows[0].used_days) -
      usage.pendingDays
  };
}

export async function getVacationBalances(
  year: number
) {

  const [employees]: any =
    await pool.query(
      `
        SELECT
          e.id,
          e.full_name,
          e.dni,
          e.file_number,
          e.hire_date,
          e.is_professional,
          d.name AS department_name
        FROM employees e
        LEFT JOIN employee_departments d
          ON d.id = e.department_id
        WHERE e.is_active = TRUE
        ORDER BY
          d.name ASC,
          e.full_name ASC
      `
    );

  const rows = [];

  for (const employee of employees) {
    const balance =
      await ensureVacationBalance(
        employee.id,
        year
      );

    rows.push({
      ...employee,
      balance_id: balance.id,
      year,
      seniority_years:
        getSeniorityAtYearStart(
          employee.hire_date,
          year
        ),
      allowed_days:
        Number(balance.allowed_days),
      used_days:
        Number(balance.used_days),
      pending_days:
        Number(balance.pending_days),
      remaining_days:
        Number(balance.remaining_days),
      available_days:
        Number(balance.available_days)
    });
  }

  return rows;
}

export async function updateVacationBalance(
  id: number,
  allowedDays: number
) {

  await pool.query(
    `
      UPDATE employee_leave_balances
      SET
        allowed_days = ?,
        remaining_days = ? - used_days
      WHERE id = ?
    `,
    [
      allowedDays,
      allowedDays,
      id
    ]
  );

  return true;
}

export async function getLeaveBalanceAdjustments() {

  const [rows]: any =
    await pool.query(
      `
        SELECT
          lba.id,
          lba.employee_id,
          e.full_name,
          e.file_number,
          d.name AS department_name,
          ac.code,
          ac.description,
          lba.adjustment_date,
          lba.year,
          lba.month,
          lba.used_days,
          lba.used_hours,
          lba.notes,
          lba.created_at
        FROM leave_balance_adjustments lba
        INNER JOIN employees e
          ON e.id = lba.employee_id
        LEFT JOIN employee_departments d
          ON d.id = e.department_id
        INNER JOIN attendance_codes ac
          ON ac.id = lba.attendance_code_id
        ORDER BY lba.created_at DESC
      `
    );

  return rows;
}

export async function createLeaveBalanceAdjustment(
  data: any,
  userId?: number
) {

  const code =
    await getCodeForLeave(
      String(data.code || '')
    );

  const employeeId =
    Number(data.employee_id);

  if (!employeeId) {
    throw new Error(
      'El empleado es obligatorio'
    );
  }

  const adjustmentDate =
    data.adjustment_date ||
    (
      data.year && data.month
        ? `${data.year}-${String(data.month).padStart(2, '0')}-01`
        : null
    );

  const year =
    Number(
      data.year ||
      (
        adjustmentDate
          ? new Date(adjustmentDate).getFullYear()
          : new Date().getFullYear()
      )
    );

  const month =
    data.month
      ? Number(data.month)
      : adjustmentDate
        ? new Date(adjustmentDate).getMonth() + 1
        : null;

  const usedDays =
    Number(data.used_days || 0);

  const usedHours =
    Number(data.used_hours || 0);

  if (usedDays <= 0 && usedHours <= 0) {
    throw new Error(
      'Debe cargar dias u horas usadas'
    );
  }

  const [result]: any =
    await pool.query(
      `
        INSERT INTO leave_balance_adjustments (
          employee_id,
          attendance_code_id,
          adjustment_date,
          year,
          month,
          used_days,
          used_hours,
          notes,
          created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        employeeId,
        code.id,
        adjustmentDate,
        year,
        month,
        usedDays,
        usedHours,
        data.notes || null,
        userId || null
      ]
    );

  return result.insertId;
}

export async function deleteLeaveBalanceAdjustment(
  id: number
) {

  await pool.query(
    `
      DELETE FROM leave_balance_adjustments
      WHERE id = ?
    `,
    [id]
  );

  return true;
}

async function getCodeForLeave(
  code: string
) {

  const [rows]: any =
    await pool.query(
      `
        SELECT
          id,
          code,
          description
        FROM attendance_codes
        WHERE code = ?
          AND is_active = TRUE
        LIMIT 1
      `,
      [code.toUpperCase()]
    );

  if (!rows.length) {
    throw new Error(
      `La clave ${code} no existe`
    );
  }

  return rows[0];
}

async function getApprovedUsage(
  employeeId: number,
  code: string,
  year: number
) {

  const [rows]: any =
    await pool.query(
      `
        SELECT
          COALESCE(SUM(lr.total_days), 0) AS days,
          COALESCE(SUM(lr.total_hours), 0) AS hours,
          COUNT(*) AS requests
        FROM leave_requests lr
        INNER JOIN attendance_codes ac
          ON ac.id = lr.attendance_code_id
        WHERE lr.employee_id = ?
          AND ac.code = ?
          AND lr.status IN ('pendiente', 'aprobado')
          AND YEAR(lr.start_date) = ?
      `,
      [
        employeeId,
        code,
        year
      ]
    );

  const [adjustments]: any =
    await pool.query(
      `
        SELECT
          COALESCE(SUM(lba.used_days), 0) AS days,
          COALESCE(SUM(lba.used_hours), 0) AS hours
        FROM leave_balance_adjustments lba
        INNER JOIN attendance_codes ac
          ON ac.id = lba.attendance_code_id
        WHERE lba.employee_id = ?
          AND ac.code = ?
          AND lba.year = ?
      `,
      [
        employeeId,
        code,
        year
      ]
    );

  return {
    days:
      Number(rows[0].days || 0) +
      Number(adjustments[0].days || 0),
    hours:
      Number(rows[0].hours || 0) +
      Number(adjustments[0].hours || 0),
    requests: Number(rows[0].requests || 0)
  };
}

async function getMonthlyUsage(
  employeeId: number,
  codes: string[],
  year: number,
  month: number
) {

  const [rows]: any =
    await pool.query(
      `
        SELECT
          COALESCE(SUM(lr.total_days), 0) AS days,
          COALESCE(SUM(lr.total_hours), 0) AS hours,
          COUNT(*) AS requests
        FROM leave_requests lr
        INNER JOIN attendance_codes ac
          ON ac.id = lr.attendance_code_id
        WHERE lr.employee_id = ?
          AND ac.code IN (?)
          AND lr.status IN ('pendiente', 'aprobado')
          AND YEAR(lr.start_date) = ?
          AND MONTH(lr.start_date) = ?
      `,
      [
        employeeId,
        codes,
        year,
        month
      ]
    );

  const [adjustments]: any =
    await pool.query(
      `
        SELECT
          COALESCE(SUM(lba.used_days), 0) AS days,
          COALESCE(SUM(lba.used_hours), 0) AS hours
        FROM leave_balance_adjustments lba
        INNER JOIN attendance_codes ac
          ON ac.id = lba.attendance_code_id
        WHERE lba.employee_id = ?
          AND ac.code IN (?)
          AND lba.year = ?
          AND lba.month = ?
      `,
      [
        employeeId,
        codes,
        year,
        month
      ]
    );

  return {
    days:
      Number(rows[0].days || 0) +
      Number(adjustments[0].days || 0),
    hours:
      Number(rows[0].hours || 0) +
      Number(adjustments[0].hours || 0),
    requests: Number(rows[0].requests || 0)
  };
}

async function getDateRangeUsage(
  employeeId: number,
  codes: string[],
  startDate: string,
  endDate: string
) {

  const [rows]: any =
    await pool.query(
      `
        SELECT
          COALESCE(SUM(lr.total_days), 0) AS days,
          COALESCE(SUM(lr.total_hours), 0) AS hours,
          COUNT(*) AS requests
        FROM leave_requests lr
        INNER JOIN attendance_codes ac
          ON ac.id = lr.attendance_code_id
        WHERE lr.employee_id = ?
          AND ac.code IN (?)
          AND lr.status IN ('pendiente', 'aprobado')
          AND lr.start_date <= ?
          AND lr.end_date >= ?
      `,
      [
        employeeId,
        codes,
        endDate,
        startDate
      ]
    );

  const [adjustments]: any =
    await pool.query(
      `
        SELECT
          COALESCE(SUM(lba.used_days), 0) AS days,
          COALESCE(SUM(lba.used_hours), 0) AS hours
        FROM leave_balance_adjustments lba
        INNER JOIN attendance_codes ac
          ON ac.id = lba.attendance_code_id
        WHERE lba.employee_id = ?
          AND ac.code IN (?)
          AND lba.adjustment_date BETWEEN ? AND ?
      `,
      [
        employeeId,
        codes,
        startDate,
        endDate
      ]
    );

  return {
    days:
      Number(rows[0].days || 0) +
      Number(adjustments[0].days || 0),
    hours:
      Number(rows[0].hours || 0) +
      Number(adjustments[0].hours || 0),
    requests: Number(rows[0].requests || 0)
  };
}

async function getUsageByCodes(
  employeeId: number,
  codes: string[],
  year: number,
  month?: number
) {

  const params: any[] =
    [
      employeeId,
      codes,
      year
    ];

  let monthFilter = '';

  if (month) {
    monthFilter =
      'AND MONTH(lr.start_date) = ?';
    params.push(month);
  }

  const [rows]: any =
    await pool.query(
      `
        SELECT
          COALESCE(SUM(CASE WHEN lr.status = 'aprobado' THEN lr.total_days ELSE 0 END), 0) AS approved_days,
          COALESCE(SUM(CASE WHEN lr.status = 'pendiente' THEN lr.total_days ELSE 0 END), 0) AS pending_days,
          COALESCE(SUM(CASE WHEN lr.status = 'aprobado' THEN lr.total_hours ELSE 0 END), 0) AS approved_hours,
          COALESCE(SUM(CASE WHEN lr.status = 'pendiente' THEN lr.total_hours ELSE 0 END), 0) AS pending_hours
        FROM leave_requests lr
        INNER JOIN attendance_codes ac
          ON ac.id = lr.attendance_code_id
        WHERE lr.employee_id = ?
          AND ac.code IN (?)
          AND YEAR(lr.start_date) = ?
          ${monthFilter}
      `,
      params
    );

  const adjustmentParams: any[] =
    [
      employeeId,
      codes,
      year
    ];

  let adjustmentMonthFilter = '';

  if (month) {
    adjustmentMonthFilter =
      'AND lba.month = ?';
    adjustmentParams.push(month);
  }

  const [adjustments]: any =
    await pool.query(
      `
        SELECT
          COALESCE(SUM(lba.used_days), 0) AS days,
          COALESCE(SUM(lba.used_hours), 0) AS hours
        FROM leave_balance_adjustments lba
        INNER JOIN attendance_codes ac
          ON ac.id = lba.attendance_code_id
        WHERE lba.employee_id = ?
          AND ac.code IN (?)
          AND lba.year = ?
          ${adjustmentMonthFilter}
      `,
      adjustmentParams
    );

  return {
    approvedDays:
      Number(rows[0].approved_days || 0) +
      Number(adjustments[0].days || 0),
    pendingDays:
      Number(rows[0].pending_days || 0),
    approvedHours:
      Number(rows[0].approved_hours || 0) +
      Number(adjustments[0].hours || 0),
    pendingHours:
      Number(rows[0].pending_hours || 0)
  };
}

async function getCompensatoryBalance(
  employeeId: number,
  year: number
) {

  const [creditRows]: any =
    await pool.query(
      `
        SELECT COUNT(*) AS total
        FROM attendance_records ar
        INNER JOIN attendance_codes ac
          ON ac.id = ar.attendance_code_id
        WHERE ar.employee_id = ?
          AND ac.code = 'C'
          AND YEAR(ar.attendance_date) = ?
      `,
      [
        employeeId,
        year
      ]
    );

  const [usedRows]: any =
    await pool.query(
      `
        SELECT COUNT(*) AS total
        FROM attendance_records ar
        INNER JOIN attendance_codes ac
          ON ac.id = ar.attendance_code_id
        WHERE ar.employee_id = ?
          AND ac.code = '34'
          AND YEAR(ar.attendance_date) = ?
      `,
      [
        employeeId,
        year
      ]
    );

  const [pendingRows]: any =
    await pool.query(
      `
        SELECT COALESCE(SUM(lr.total_days), 0) AS total
        FROM leave_requests lr
        INNER JOIN attendance_codes ac
          ON ac.id = lr.attendance_code_id
        WHERE lr.employee_id = ?
          AND ac.code = '34'
          AND lr.status = 'pendiente'
          AND YEAR(lr.start_date) = ?
      `,
      [
        employeeId,
        year
      ]
    );

  const [creditAdjustments]: any =
    await pool.query(
      `
        SELECT COALESCE(SUM(lba.used_days), 0) AS total
        FROM leave_balance_adjustments lba
        INNER JOIN attendance_codes ac
          ON ac.id = lba.attendance_code_id
        WHERE lba.employee_id = ?
          AND ac.code = 'C'
          AND lba.year = ?
      `,
      [
        employeeId,
        year
      ]
    );

  const [usedAdjustments]: any =
    await pool.query(
      `
        SELECT COALESCE(SUM(lba.used_days), 0) AS total
        FROM leave_balance_adjustments lba
        INNER JOIN attendance_codes ac
          ON ac.id = lba.attendance_code_id
        WHERE lba.employee_id = ?
          AND ac.code = '34'
          AND lba.year = ?
      `,
      [
        employeeId,
        year
      ]
    );

  const earnedDays =
    Number(creditRows[0].total || 0) +
    Number(creditAdjustments[0].total || 0);

  const usedDays =
    Number(usedRows[0].total || 0) +
    Number(usedAdjustments[0].total || 0);

  const pendingDays =
    Number(pendingRows[0].total || 0);

  return {
    earnedDays,
    usedDays,
    pendingDays,
    remainingDays:
      Math.max(
        0,
        earnedDays -
          usedDays -
          pendingDays
      )
  };
}

async function assertAnnualDayLimit(
  employeeId: number,
  code: string,
  year: number,
  requestedDays: number,
  limitDays: number,
  message: string,
  isException: boolean
) {

  if (isException) {
    return;
  }

  const usage =
    await getApprovedUsage(
      employeeId,
      code,
      year
    );

  if (usage.days + requestedDays > limitDays) {
    throw new Error(message);
  }
}

export async function getEmployeeLeaveSummary(
  employeeId: number,
  year: number,
  month: number
) {

  const employee =
    await getEmployeeForLeave(employeeId);

  const vacation =
    await ensureVacationBalance(
      employeeId,
      year
    );

  const code26Year =
    await getUsageByCodes(
      employeeId,
      ['26'],
      year
    );

  const code26Month =
    await getUsageByCodes(
      employeeId,
      ['26'],
      year,
      month
    );

  const hoursYear =
    await getUsageByCodes(
      employeeId,
      ['24', '43'],
      year
    );

  const hoursMonth =
    await getUsageByCodes(
      employeeId,
      ['24', '43'],
      year,
      month
    );

  const code29 =
    await getUsageByCodes(
      employeeId,
      ['29'],
      year
    );

  const code29Allowance =
    getCode29Allowance(
      employee,
      year
    );

  const compensatory =
    await getCompensatoryBalance(
      employeeId,
      year
    );

  return {
    employee: {
      id: employee.id,
      full_name: employee.full_name,
      hire_date: employee.hire_date,
      seniority_years:
        getSeniorityAtYearStart(
          employee.hire_date,
          year
        )
    },
    vacation: {
      allowed_days:
        Number(vacation.allowed_days),
      used_days:
        Number(vacation.used_days),
      pending_days:
        Number(vacation.pending_days),
      remaining_days:
        Number(vacation.remaining_days),
      available_days:
        Number(vacation.available_days)
    },
    code26: {
      annual_limit_days: 6,
      used_days:
        code26Year.approvedDays,
      pending_days:
        code26Year.pendingDays,
      remaining_days:
        Math.max(
          0,
          6 -
            code26Year.approvedDays -
            code26Year.pendingDays
        ),
      used_this_month:
        code26Month.approvedDays +
        code26Month.pendingDays,
      remaining_this_month:
        Math.max(
          0,
          1 -
            code26Month.approvedDays -
            code26Month.pendingDays
        )
    },
    hours24_43: {
      annual_limit_hours: 30,
      monthly_limit_hours: 5,
      used_hours_year:
        hoursYear.approvedHours,
      pending_hours_year:
        hoursYear.pendingHours,
      remaining_hours_year:
        Math.max(
          0,
          30 -
            hoursYear.approvedHours -
            hoursYear.pendingHours
        ),
      used_hours_month:
        hoursMonth.approvedHours,
      pending_hours_month:
        hoursMonth.pendingHours,
      remaining_hours_month:
        Math.max(
          0,
          5 -
            hoursMonth.approvedHours -
            hoursMonth.pendingHours
        )
    },
    code29: {
      allowed_days:
        code29Allowance,
      used_days:
        code29.approvedDays,
      pending_days:
        code29.pendingDays,
      remaining_days:
        Math.max(
          0,
          code29Allowance -
            code29.approvedDays -
            code29.pendingDays
        )
    },
    compensatory: {
      earned_days:
        compensatory.earnedDays,
      used_days:
        compensatory.usedDays,
      pending_days:
        compensatory.pendingDays,
      remaining_days:
        compensatory.remainingDays
    }
  };
}

export async function getEmployeeDirectiveSummary(
  employeeId: number,
  year: number,
  month: number
) {

  const [employeeRows]: any =
    await pool.query(
      `
        SELECT
          e.id,
          e.department_id,
          e.full_name,
          e.dni,
          e.cuil,
          e.birth_date,
          e.hire_date,
          e.file_number,
          e.address,
          e.phone,
          e.email,
          e.license_number,
          e.employment_type,
          e.is_professional,
          e.notes,
          e.is_active,
          d.name AS department_name
        FROM employees e
        LEFT JOIN employee_departments d
          ON d.id = e.department_id
        WHERE e.id = ?
        LIMIT 1
      `,
      [employeeId]
    );

  if (employeeRows.length === 0) {
    throw new Error('Empleado no encontrado');
  }

  const employee =
    employeeRows[0];

  const period =
    await getOrCreateAttendancePeriod(
      year,
      month
    );

  const [attendanceRows]: any =
    await pool.query(
      `
        SELECT
          ac.code,
          ac.description,
          ac.category,
          COUNT(*) AS total
        FROM attendance_records ar
        INNER JOIN attendance_codes ac
          ON ac.id = ar.attendance_code_id
        WHERE ar.employee_id = ?
          AND ar.attendance_period_id = ?
        GROUP BY
          ac.code,
          ac.description,
          ac.category
        ORDER BY total DESC
      `,
      [
        employeeId,
        period.id
      ]
    );

  const attendanceTotals =
    attendanceRows.reduce(
      (totals: any, row: any) => {
        const category =
          row.category || 'otro';

        totals[category] =
          (totals[category] || 0) +
          Number(row.total || 0);

        totals.totalLoaded +=
          Number(row.total || 0);

        return totals;
      },
      {
        presente: 0,
        ausencia: 0,
        franco: 0,
        licencia: 0,
        vacaciones: 0,
        maternidad: 0,
        gremial: 0,
        otro: 0,
        totalLoaded: 0
      }
    );

  const leaveSummary =
    await getEmployeeLeaveSummary(
      employeeId,
      year,
      month
    );

  const [recentLeaves]: any =
    await pool.query(
      `
        SELECT
          lr.id,
          ac.code,
          ac.description,
          lr.start_date,
          lr.end_date,
          lr.total_days,
          lr.total_hours,
          lr.status,
          lr.requested_at,
          lr.notes
        FROM leave_requests lr
        INNER JOIN attendance_codes ac
          ON ac.id = lr.attendance_code_id
        WHERE lr.employee_id = ?
        ORDER BY
          lr.start_date DESC,
          lr.id DESC
        LIMIT 10
      `,
      [employeeId]
    );

  const [recentAttendance]: any =
    await pool.query(
      `
        SELECT
          ar.attendance_date,
          ac.code,
          ac.description,
          ac.category
        FROM attendance_records ar
        INNER JOIN attendance_codes ac
          ON ac.id = ar.attendance_code_id
        WHERE ar.employee_id = ?
          AND ac.code <> 'P'
        ORDER BY ar.attendance_date DESC
        LIMIT 10
      `,
      [employeeId]
    );

  return {
    employee: {
      ...employee,
      seniority_years:
        getSeniorityAtYearStart(
          employee.hire_date,
          year
        )
    },
    period: {
      year,
      month
    },
    attendance: {
      totals: attendanceTotals,
      byCode: attendanceRows
    },
    balances: {
      vacation: leaveSummary.vacation,
      code26: leaveSummary.code26,
      hours24_43: leaveSummary.hours24_43,
      code29: leaveSummary.code29,
      compensatory: leaveSummary.compensatory
    },
    recentLeaves,
    recentAttendance
  };
}

async function validateLeaveRequest(
  data: any
) {

  const employee =
    await getEmployeeForLeave(
      Number(data.employee_id)
    );

  const code =
    await getCodeForLeave(
      String(data.code || '')
    );

  const startDate =
    toDateOnly(data.start_date);

  const endDate =
    toDateOnly(data.end_date || data.start_date);

  if (new Date(endDate) < new Date(startDate)) {
    throw new Error(
      'La fecha hasta no puede ser anterior a la fecha desde'
    );
  }

  const totalDays =
    ['24', '43', '35', '46'].includes(code.code)
      ? 0
      : countInclusiveDays(
        startDate,
        endDate
      );

  const totalHours =
    ['24', '43', '35', '46'].includes(code.code)
      ? Number(data.total_hours || 0)
      : 0;

  const isException =
    Boolean(data.is_exception);

  const today =
    new Date();

  const start =
    new Date(startDate);

  const startYear =
    start.getFullYear();

  const startMonth =
    start.getMonth() + 1;

  const advanceDays =
    dateDiffDays(
      today,
      start
    );

  if (code.code === '8') {
    if (today.getDate() > 15 && !isException) {
      throw new Error(
        'La licencia anual clave 8 debe pedirse del 1 al 15 de cada mes'
      );
    }

    if (advanceDays < 15 && !isException) {
      throw new Error(
        'La licencia anual clave 8 requiere 15 dias de anticipacion'
      );
    }

    if (startMonth > 8) {
      throw new Error(
        'La clave 8 puede pedirse hasta agosto. Desde agosto corresponde evaluar clave 29'
      );
    }

    const balance =
      await ensureVacationBalance(
        employee.id,
        startYear
      );

    if (totalDays > Number(balance.available_days) && !isException) {
      throw new Error(
        `La clave 8 supera el saldo disponible. Disponible: ${Number(balance.available_days)} dias`
      );
    }
  }

  if (code.code === '29' && startMonth < 8) {
    throw new Error(
      'La clave 29 solo puede pedirse desde agosto en adelante'
    );
  }

  if (code.code === '29') {
    const allowance =
      getCode29Allowance(
        employee,
        startYear
      );

    const usage =
      await getApprovedUsage(
        employee.id,
        '29',
        startYear
      );

    if (usage.days + totalDays > allowance && !isException) {
      throw new Error(
        `La clave 29 supera el saldo disponible. Disponible: ${Math.max(0, allowance - usage.days)} dias`
      );
    }
  }

  if (code.code === '34') {
    const compensatory =
      await getCompensatoryBalance(
        employee.id,
        startYear
      );

    if (totalDays > compensatory.remainingDays && !isException) {
      throw new Error(
        `La clave 34 requiere compensatorios disponibles. Disponibles: ${compensatory.remainingDays} dias`
      );
    }
  }

  if (code.code === '5') {
    await assertAnnualDayLimit(
      employee.id,
      '5',
      startYear,
      totalDays,
      20,
      'La clave 5 tiene un maximo de 20 dias por año',
      isException
    );
  }

  if (code.code === '6' && totalDays > 90 && !isException) {
    throw new Error(
      'La clave 6 maternidad permite hasta 90 dias'
    );
  }

  if (code.code === '14' && totalDays > 3 && !isException) {
    throw new Error(
      'La clave 14 permite hasta 3 dias corridos'
    );
  }

  if (code.code === '15' && totalDays > 1 && !isException) {
    throw new Error(
      'La clave 15 permite 1 dia'
    );
  }

  if (code.code === '16' && totalDays > 10 && !isException) {
    throw new Error(
      'La clave 16 matrimonio permite hasta 10 dias corridos'
    );
  }

  if (code.code === '17' && totalDays > 2 && !isException) {
    throw new Error(
      'La clave 17 pre examen permite hasta 2 dias por materia'
    );
  }

  if (code.code === '18' && totalDays > 1 && !isException) {
    throw new Error(
      'La clave 18 examen permite 1 dia por examen'
    );
  }

  if (code.code === '31' && totalDays > 3 && !isException) {
    throw new Error(
      'La clave 31 nacimiento de hijo permite hasta 3 dias'
    );
  }

  if (code.code === '33' && totalDays > 1 && !isException) {
    throw new Error(
      'La clave 33 donacion de sangre permite 1 dia'
    );
  }

  if (code.code === '35') {
    if (totalHours <= 0) {
      throw new Error(
        'La clave 35 requiere cargar horas'
      );
    }

    if (totalHours > 2 && !isException) {
      throw new Error(
        'La clave 35 permite hasta 2 horas diarias'
      );
    }
  }

  if (code.code === '42' && totalDays > 90 && !isException) {
    throw new Error(
      'La clave 42 adopcion permite hasta 90 dias'
    );
  }

  if (code.code === '46') {
    if (totalHours <= 0) {
      throw new Error(
        'La clave 46 requiere cargar horas'
      );
    }

    if (totalHours > 5 && !isException) {
      throw new Error(
        'La clave 46 permiso gremial permite hasta 5 horas semanales'
      );
    }

    const week =
      getWeekBounds(startDate);

    const weekly =
      await getDateRangeUsage(
        employee.id,
        ['46'],
        week.start,
        week.end
      );

    if (weekly.hours + totalHours > 5 && !isException) {
      throw new Error(
        `La clave 46 supera las 5 horas semanales. Ya hay ${weekly.hours} hs cargadas esa semana; puede cargar como maximo ${Math.max(0, 5 - weekly.hours)} hs`
      );
    }
  }

  if (code.code === '26') {
    if (advanceDays < 2 && !isException) {
      throw new Error(
        'La clave 26 requiere 48 hs de anticipacion'
      );
    }

    const yearly =
      await getApprovedUsage(
        employee.id,
        '26',
        startYear
      );

    if (yearly.days + totalDays > 6 && !isException) {
      throw new Error(
        'La clave 26 tiene un maximo de 6 dias anuales'
      );
    }

    const monthly =
      await getMonthlyUsage(
        employee.id,
        ['26'],
        startYear,
        startMonth
      );

    if (monthly.requests > 0 && !isException) {
      throw new Error(
        'La clave 26 solo puede tomarse una vez por mes'
      );
    }
  }

  if (['24', '43'].includes(code.code)) {
    if (totalHours <= 0) {
      throw new Error(
        'Las claves 24 y 43 requieren cargar horas'
      );
    }

    if (totalHours > 2 && !isException) {
      throw new Error(
        'Las claves 24 y 43 permiten hasta 2 horas por dia'
      );
    }

    const yearly24 =
      await getApprovedUsage(
        employee.id,
        '24',
        startYear
      );

    const yearly43 =
      await getApprovedUsage(
        employee.id,
        '43',
        startYear
      );

    if (
      yearly24.hours +
      yearly43.hours +
      totalHours > 30 &&
      !isException
    ) {
      throw new Error(
        'Las claves 24 y 43 tienen un maximo acumulado de 30 horas anuales'
      );
    }

    const monthly =
      await getMonthlyUsage(
        employee.id,
        ['24', '43'],
        startYear,
        startMonth
      );

    if (monthly.hours + totalHours > 5 && !isException) {
      throw new Error(
        'Las claves 24 y 43 no pueden superar 5 horas por mes'
      );
    }
  }

  return {
    employee,
    code,
    startDate,
    endDate,
    totalDays,
    totalHours
  };
}

async function applyLeaveToAttendance(
  connection: any,
  leaveRequestId: number,
  userId?: number
) {

  const [rows]: any =
    await connection.query(
      `
        SELECT
          lr.employee_id,
          lr.start_date,
          lr.end_date,
          ac.id AS code_id,
          ac.code
        FROM leave_requests lr
        INNER JOIN attendance_codes ac
          ON ac.id = lr.attendance_code_id
        WHERE lr.id = ?
      `,
      [leaveRequestId]
    );

  if (!rows.length) {
    return;
  }

  const request =
    rows[0];

  if (['24', '43'].includes(request.code)) {
    return;
  }

  let current =
    new Date(request.start_date);

  const end =
    new Date(request.end_date);

  while (current <= end) {
    const year =
      current.getFullYear();

    const month =
      current.getMonth() + 1;

    const periodName =
      getPeriodName(
        year,
        month
      );

    await connection.query(
      `
        INSERT INTO attendance_periods (
          year,
          month,
          name
        )
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name)
      `,
      [
        year,
        month,
        periodName
      ]
    );

    const [periodRows]: any =
      await connection.query(
        `
          SELECT id
          FROM attendance_periods
          WHERE year = ?
            AND month = ?
          LIMIT 1
        `,
        [
          year,
          month
        ]
      );

    const attendanceDate =
      toDateOnly(current);

    await connection.query(
      `
        INSERT INTO attendance_records (
          employee_id,
          attendance_period_id,
          attendance_code_id,
          attendance_date,
          raw_code,
          source,
          created_by
        )
        VALUES (?, ?, ?, ?, ?, 'manual', ?)
        ON DUPLICATE KEY UPDATE
          attendance_period_id = VALUES(attendance_period_id),
          attendance_code_id = VALUES(attendance_code_id),
          raw_code = VALUES(raw_code),
          updated_at = CURRENT_TIMESTAMP
      `,
      [
        request.employee_id,
        periodRows[0].id,
        request.code_id,
        attendanceDate,
        request.code,
        userId || null
      ]
    );

    current =
      addDays(
        current,
        1
      );
  }
}

async function removeLeaveFromAttendance(
  connection: any,
  leaveRequestId: number
) {

  const [rows]: any =
    await connection.query(
      `
        SELECT
          lr.employee_id,
          lr.start_date,
          lr.end_date,
          ac.id AS code_id,
          ac.code
        FROM leave_requests lr
        INNER JOIN attendance_codes ac
          ON ac.id = lr.attendance_code_id
        WHERE lr.id = ?
      `,
      [leaveRequestId]
    );

  if (!rows.length) {
    return;
  }

  const request =
    rows[0];

  if (['24', '43'].includes(request.code)) {
    return;
  }

  await connection.query(
    `
      DELETE FROM attendance_records
      WHERE employee_id = ?
        AND attendance_code_id = ?
        AND attendance_date BETWEEN ? AND ?
    `,
    [
      request.employee_id,
      request.code_id,
      toDateOnly(request.start_date),
      toDateOnly(request.end_date)
    ]
  );
}

async function adjustVacationBalanceForRequest(
  connection: any,
  leaveRequestId: number,
  direction: 1 | -1
) {

  const [rows]: any =
    await connection.query(
      `
        SELECT
          lr.employee_id,
          lr.start_date,
          lr.total_days,
          lr.attendance_code_id,
          ac.code
        FROM leave_requests lr
        INNER JOIN attendance_codes ac
          ON ac.id = lr.attendance_code_id
        WHERE lr.id = ?
      `,
      [leaveRequestId]
    );

  if (!rows.length || rows[0].code !== '8') {
    return;
  }

  const request =
    rows[0];

  const year =
    new Date(request.start_date)
      .getFullYear();

  const [employeeRows]: any =
    await connection.query(
      `
        SELECT
          id,
          full_name,
          hire_date,
          is_professional
        FROM employees
        WHERE id = ?
        LIMIT 1
      `,
      [request.employee_id]
    );

  if (!employeeRows.length) {
    throw new Error(
      'El empleado no existe'
    );
  }

  const employee =
    employeeRows[0];

  const allowance =
    await calculateVacationAllowance(
      employee,
      year
    );

  await connection.query(
    `
      INSERT IGNORE INTO employee_leave_balances (
        employee_id,
        attendance_code_id,
        year,
        allowed_days,
        used_days,
        remaining_days
      )
      VALUES (?, ?, ?, ?, 0, ?)
    `,
    [
      request.employee_id,
      request.attendance_code_id,
      year,
      allowance,
      allowance
    ]
  );

  await connection.query(
    `
      UPDATE employee_leave_balances
      SET
        used_days = GREATEST(0, used_days + ?),
        remaining_days = allowed_days - GREATEST(0, used_days + ?)
      WHERE employee_id = ?
        AND attendance_code_id = ?
        AND year = ?
    `,
    [
      Number(request.total_days) * direction,
      Number(request.total_days) * direction,
      request.employee_id,
      request.attendance_code_id,
      year
    ]
  );
}

export async function getLeaveRequests() {

  const [rows]: any =
    await pool.query(
      `
        SELECT
          lr.id,
          lr.employee_id,
          e.full_name,
          e.file_number,
          d.name AS department_name,
          ac.code,
          ac.description,
          lr.start_date,
          lr.end_date,
          lr.total_days,
          lr.total_hours,
          lr.is_exception,
          lr.exception_reason,
          lr.status,
          lr.requested_at,
          lr.notes
        FROM leave_requests lr
        INNER JOIN employees e
          ON e.id = lr.employee_id
        LEFT JOIN employee_departments d
          ON d.id = e.department_id
        INNER JOIN attendance_codes ac
          ON ac.id = lr.attendance_code_id
        ORDER BY
          lr.requested_at DESC,
          lr.id DESC
      `
    );

  return rows;
}

export async function createLeaveRequest(
  data: any,
  userId?: number
) {

  const validated =
    await validateLeaveRequest(data);

  const [result]: any =
    await pool.query(
      `
        INSERT INTO leave_requests (
          employee_id,
          attendance_code_id,
          start_date,
          end_date,
          total_days,
          total_hours,
          is_exception,
          exception_reason,
          requested_by,
          notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        validated.employee.id,
        validated.code.id,
        validated.startDate,
        validated.endDate,
        validated.totalDays,
        validated.totalHours,
        Boolean(data.is_exception),
        data.exception_reason || null,
        userId || null,
        data.notes || null
      ]
    );

  return result.insertId;
}

export async function updateLeaveRequestStatus(
  id: number,
  status: string,
  userId?: number,
  rejectedReason?: string
) {

  const allowed =
    [
      'pendiente',
      'aprobado',
      'rechazado',
      'cancelado'
    ];

  if (!allowed.includes(status)) {
    throw new Error(
      'Estado invalido'
    );
  }

  const connection =
    await pool.getConnection();

  try {

    await connection.beginTransaction();

    const [existingRows]: any =
      await connection.query(
        `
          SELECT status
          FROM leave_requests
          WHERE id = ?
          LIMIT 1
        `,
        [id]
      );

    if (!existingRows.length) {
      throw new Error(
        'La solicitud no existe'
      );
    }

    const previousStatus =
      existingRows[0].status;

    await connection.query(
      `
        UPDATE leave_requests
        SET
          status = ?,
          approved_by = CASE WHEN ? = 'aprobado' THEN ? ELSE approved_by END,
          approved_at = CASE WHEN ? = 'aprobado' THEN CURRENT_TIMESTAMP ELSE approved_at END,
          rejected_reason = CASE WHEN ? = 'rechazado' THEN ? ELSE rejected_reason END
        WHERE id = ?
      `,
      [
        status,
        status,
        userId || null,
        status,
        status,
        rejectedReason || null,
        id
      ]
    );

    if (
      status === 'aprobado' &&
      previousStatus !== 'aprobado'
    ) {
      await adjustVacationBalanceForRequest(
        connection,
        id,
        1
      );

      await applyLeaveToAttendance(
        connection,
        id,
        userId
      );
    }

    if (
      previousStatus === 'aprobado' &&
      status !== 'aprobado'
    ) {
      await adjustVacationBalanceForRequest(
        connection,
        id,
        -1
      );

      await removeLeaveFromAttendance(
        connection,
        id
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

export async function getEmployees() {

  const [rows]: any =
    await pool.query(
      `
        SELECT
          e.id,
          e.department_id,
          e.full_name,
          e.dni,
          e.cuil,
          e.birth_date,
          e.hire_date,
          e.file_number,
          e.address,
          e.phone,
          e.email,
          e.license_number,
          e.employment_type,
          e.is_professional,
          e.notes,
          e.is_active,
          d.name AS department_name
        FROM employees e
        LEFT JOIN employee_departments d
          ON d.id = e.department_id
        ORDER BY e.full_name ASC
      `
    );

  return rows;
}

export async function createEmployee(
  data: any
) {

  const [result]: any =
    await pool.query(
      `
        INSERT INTO employees (
          department_id,
          full_name,
          dni,
          cuil,
          birth_date,
          hire_date,
          file_number,
          address,
          phone,
          email,
          license_number,
          employment_type,
          is_professional,
          notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        data.department_id || null,
        data.full_name,
        data.dni || null,
        data.cuil || null,
        data.birth_date || null,
        data.hire_date || null,
        data.file_number || null,
        data.address || null,
        data.phone || null,
        data.email || null,
        data.license_number || null,
        data.employment_type || null,
        Boolean(data.is_professional),
        data.notes || null
      ]
    );

  return result.insertId;
}

export async function updateEmployee(
  id: number,
  data: any
) {

  await pool.query(
    `
      UPDATE employees
      SET
        department_id = ?,
        full_name = ?,
        dni = ?,
        cuil = ?,
        birth_date = ?,
        hire_date = ?,
        file_number = ?,
        address = ?,
        phone = ?,
        email = ?,
        license_number = ?,
        employment_type = ?,
        is_professional = ?,
        notes = ?
      WHERE id = ?
    `,
    [
      data.department_id || null,
      data.full_name,
      data.dni || null,
      data.cuil || null,
      data.birth_date || null,
      data.hire_date || null,
      data.file_number || null,
      data.address || null,
      data.phone || null,
      data.email || null,
      data.license_number || null,
      data.employment_type || null,
      Boolean(data.is_professional),
      data.notes || null,
      id
    ]
  );

  return true;
}

export async function toggleEmployee(
  id: number
) {

  await pool.query(
    `
      UPDATE employees
      SET is_active = NOT is_active
      WHERE id = ?
    `,
    [id]
  );

  return true;
}
