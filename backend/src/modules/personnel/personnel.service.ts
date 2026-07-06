import { pool }
  from '../../config/database';

import {
  assertFacilityAccess,
  canAccessAllFacilities,
  getScopedFacilityId
} from '../health-facilities/facility-access';

const attendanceCodesOnlyFromLeaves =
  new Set([
    '1',
    '4',
    '5',
    '6',
    '7',
    '8',
    '14',
    '15',
    '16',
    '17',
    '18',
    '26',
    '29',
    '31',
    '33',
    '34',
    '35',
    '40',
    '42',
    '46',
    '51',
    '24',
    '43'
  ]);

function getPersonnelFacilityFilter(
  user: any,
  requestedFacilityId?: number | null,
  tableAlias = 'e'
) {
  if (canAccessAllFacilities(user)) {
    if (requestedFacilityId) {
      return {
        sql: `AND ${tableAlias}.facility_id = ?`,
        params: [Number(requestedFacilityId)]
      };
    }

    return {
      sql: '',
      params: []
    };
  }

  const allowedFacilityIds =
    Array.isArray(user?.facility_ids) &&
    user.facility_ids.length > 0
      ? user.facility_ids.map(Number)
      : user?.facility_id
        ? [Number(user.facility_id)]
        : [];

  if (requestedFacilityId) {
    assertFacilityAccess(
      user,
      Number(requestedFacilityId)
    );

    return {
      sql: `AND ${tableAlias}.facility_id = ?`,
      params: [Number(requestedFacilityId)]
    };
  }

  if (allowedFacilityIds.length === 0) {
    return {
      sql: 'AND 1 = 0',
      params: []
    };
  }

  return {
    sql:
      `AND ${tableAlias}.facility_id IN (${allowedFacilityIds
        .map(() => '?')
        .join(', ')})`,
    params: allowedFacilityIds
  };
}

async function assertEmployeeAccess(
  employeeId: number,
  user: any
) {
  if (canAccessAllFacilities(user)) {
    return;
  }

  const [rows]: any =
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
    rows[0]?.facility_id;

  if (
    !facilityId ||
    !Array.isArray(user?.facility_ids) ||
    !user.facility_ids
      .map(Number)
      .includes(Number(facilityId))
  ) {
    throw new Error(
      'No tenes permiso para operar sobre este empleado'
    );
  }
}

async function assertLeaveRequestAccess(
  leaveRequestId: number,
  user: any
) {
  if (canAccessAllFacilities(user)) {
    return;
  }

  const [rows]: any =
    await pool.query(
      `
        SELECT e.facility_id
        FROM leave_requests lr
        INNER JOIN employees e
          ON e.id = lr.employee_id
        WHERE lr.id = ?
        LIMIT 1
      `,
      [leaveRequestId]
    );

  const facilityId =
    rows[0]?.facility_id;

  if (
    !facilityId ||
    !Array.isArray(user?.facility_ids) ||
    !user.facility_ids
      .map(Number)
      .includes(Number(facilityId))
  ) {
    throw new Error(
      'No tenes permiso para operar sobre esta licencia'
    );
  }
}

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

export async function getDepartments(
  user?: any,
  facilityId?: number | null
) {

  const facilityFilter =
    getPersonnelFacilityFilter(
      user,
      facilityId,
      'd'
    );

  const [rows]: any =
    await pool.query(
      `
        SELECT
          d.id,
          d.facility_id,
          hf.name AS facility_name,
          hf.facility_type,
          d.name,
          d.description,
          d.is_active
        FROM employee_departments d
        LEFT JOIN health_facilities hf
          ON hf.id = d.facility_id
        WHERE 1 = 1
          ${facilityFilter.sql}
        ORDER BY
          hf.name ASC,
          d.name ASC
      `,
      facilityFilter.params
    );

  return rows;
}

export async function createDepartment(
  data: any,
  user?: any
) {
  const facilityId =
    Number(
      data.facility_id ||
        getScopedFacilityId(user, null)
    );

  if (!facilityId) {
    throw new Error(
      'La dependencia del sector es obligatoria'
    );
  }

  assertFacilityAccess(
    user,
    facilityId
  );

  const [result]: any =
    await pool.query(
      `
        INSERT INTO employee_departments (
          facility_id,
          name,
          description
        )
        VALUES (?, ?, ?)
      `,
      [
        facilityId,
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

export async function getLeaveRules() {

  const [rows]: any =
    await pool.query(
      `
        SELECT
          lr.id,
          lr.attendance_code_id,
          ac.code,
          ac.description,
          lr.name,
          lr.min_advance_days,
          lr.max_days_per_request,
          lr.max_days_per_year,
          lr.max_hours_per_day,
          lr.max_hours_per_week,
          lr.max_hours_per_month,
          lr.max_hours_per_year,
          lr.requires_documentation,
          lr.requires_medical_order,
          lr.gender_condition,
          lr.seniority_min_years,
          lr.seniority_max_years,
          lr.rule_notes,
          lr.is_active
        FROM leave_rules lr
        INNER JOIN attendance_codes ac
          ON ac.id = lr.attendance_code_id
        ORDER BY
          CAST(ac.code AS UNSIGNED),
          ac.code,
          lr.name
      `
    );

  return rows;
}

export async function updateLeaveRule(
  id: number,
  data: any
) {

  await pool.query(
    `
      UPDATE leave_rules
      SET
        name = ?,
        min_advance_days = ?,
        max_days_per_request = ?,
        max_days_per_year = ?,
        max_hours_per_day = ?,
        max_hours_per_week = ?,
        max_hours_per_month = ?,
        max_hours_per_year = ?,
        requires_documentation = ?,
        requires_medical_order = ?,
        gender_condition = ?,
        seniority_min_years = ?,
        seniority_max_years = ?,
        rule_notes = ?,
        is_active = ?
      WHERE id = ?
    `,
    [
      data.name,
      data.min_advance_days || null,
      data.max_days_per_request || null,
      data.max_days_per_year || null,
      data.max_hours_per_day || null,
      data.max_hours_per_week || null,
      data.max_hours_per_month || null,
      data.max_hours_per_year || null,
      Boolean(data.requires_documentation),
      Boolean(data.requires_medical_order),
      data.gender_condition || 'cualquiera',
      data.seniority_min_years || null,
      data.seniority_max_years || null,
      data.rule_notes || null,
      data.is_active ?? true,
      id
    ]
  );

  return true;
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
  departmentId: number | null,
  user?: any,
  facilityId?: number | null,
  employeeId?: number | null
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

  if (employeeId) {
    departmentFilter +=
      ' AND e.id = ?';
    params.push(employeeId);
  }

  const facilityFilter =
    getPersonnelFacilityFilter(
      user,
      facilityId,
      'e'
    );

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
          ${facilityFilter.sql}
        ORDER BY
          d.name ASC,
          e.full_name ASC
      `,
      [
        ...params,
        ...facilityFilter.params
      ]
    );

  const [records]: any =
    await pool.query(
      `
        SELECT
          ar.employee_id,
          DAY(ar.attendance_date) AS day,
          ac.code,
          ac.description,
          ar.compensatory_days
        FROM attendance_records ar
        LEFT JOIN attendance_codes ac
          ON ac.id = ar.attendance_code_id
        WHERE ar.attendance_period_id = ?
          ${employeeId ? 'AND ar.employee_id = ?' : ''}
        ORDER BY
          ar.employee_id ASC,
          ar.attendance_date ASC
      `,
      employeeId
        ? [period.id, employeeId]
        : [period.id]
    );

  const [permissionRows]: any =
    await pool.query(
      `
        SELECT
          lr.employee_id,
          DAY(lr.start_date) AS day,
          ac.code,
          ac.description,
          lr.status,
          lr.permission_kind,
          lr.total_hours
        FROM leave_requests lr
        INNER JOIN attendance_codes ac
          ON ac.id = lr.attendance_code_id
        WHERE ac.code IN ('24', '43')
          AND lr.status IN ('pendiente', 'aprobado')
          AND lr.start_date BETWEEN ? AND ?
          ${employeeId ? 'AND lr.employee_id = ?' : ''}
        ORDER BY
          lr.employee_id ASC,
          lr.start_date ASC
      `,
      employeeId
        ? [
          getDateKey(year, month, 1),
          getDateKey(year, month, getDaysInMonth(year, month)),
          employeeId
        ]
        : [
          getDateKey(year, month, 1),
          getDateKey(year, month, getDaysInMonth(year, month))
        ]
    );

  const [plannedOffRows]: any =
    await pool.query(
      `
        SELECT
          id,
          employee_id,
          DAY(off_date) AS day,
          notes
        FROM employee_planned_days_off
        WHERE off_date BETWEEN ? AND ?
          ${employeeId ? 'AND employee_id = ?' : ''}
        ORDER BY
          employee_id ASC,
          off_date ASC
      `,
      employeeId
        ? [
          getDateKey(year, month, 1),
          getDateKey(year, month, getDaysInMonth(year, month)),
          employeeId
        ]
        : [
          getDateKey(year, month, 1),
          getDateKey(year, month, getDaysInMonth(year, month))
        ]
    );

  const recordMap =
    new Map<string, any>();

  const permissionMap =
    new Map<string, any[]>();

  const plannedOffMap =
    new Map<string, any>();

  for (const record of records) {
    recordMap.set(
      `${record.employee_id}-${record.day}`,
      {
        code: record.code || '',
        description: record.description || '',
        compensatory_days:
          record.compensatory_days !== null &&
          record.compensatory_days !== undefined
            ? Number(record.compensatory_days)
            : null
      }
    );
  }

  for (const permission of permissionRows) {
    const key =
      `${permission.employee_id}-${permission.day}`;

    const current =
      permissionMap.get(key) || [];

    current.push({
      code: permission.code,
      description: permission.description,
      status: permission.status,
      permission_kind: permission.permission_kind,
      total_hours: Number(permission.total_hours || 0)
    });

    permissionMap.set(key, current);
  }

  for (const plannedOff of plannedOffRows) {
    plannedOffMap.set(
      `${plannedOff.employee_id}-${plannedOff.day}`,
      {
        id: plannedOff.id,
        notes: plannedOff.notes || null
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
        const key =
          `${employee.id}-${day}`;

        const baseRecord =
          recordMap.get(key) || {
            code: '',
            description: ''
          };

        attendance[day] =
          {
            ...baseRecord,
            planned_off:
              plannedOffMap.get(key) || null,
            permissions:
              permissionMap.get(key) || []
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

export async function getAttendanceEmployeeYear(
  year: number,
  employeeId: number,
  user?: any,
  facilityId?: number | null
) {

  const months = [];
  let employee = null;

  for (let month = 1; month <= 12; month += 1) {
    const monthData =
      await getAttendanceMonth(
        year,
        month,
        null,
        user,
        facilityId,
        employeeId
      );

    const employeeRow =
      monthData.employees[0] || null;

    if (employeeRow && !employee) {
      const {
        attendance,
        ...employeeInfo
      } = employeeRow;

      employee = employeeInfo;
    }

    months.push({
      month,
      days: monthData.days,
      attendance:
        employeeRow?.attendance || {}
    });
  }

  if (!employee) {
    throw new Error(
      'No se encontro el empleado o no tenes permiso para verlo'
    );
  }

  return {
    year,
    employee,
    months
  };
}

export async function getPlannedDaysOffMonth(
  year: number,
  month: number,
  departmentId: number | null,
  user?: any,
  facilityId?: number | null
) {

  const params: any[] = [];

  let departmentFilter = '';

  if (departmentId) {
    departmentFilter =
      'AND e.department_id = ?';
    params.push(departmentId);
  }

  const facilityFilter =
    getPersonnelFacilityFilter(
      user,
      facilityId,
      'e'
    );

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
          ${facilityFilter.sql}
        ORDER BY
          d.name ASC,
          e.full_name ASC
      `,
      [
        ...params,
        ...facilityFilter.params
      ]
    );

  const [plannedRows]: any =
    await pool.query(
      `
        SELECT
          id,
          employee_id,
          DAY(off_date) AS day,
          notes
        FROM employee_planned_days_off
        WHERE off_date BETWEEN ? AND ?
        ORDER BY
          employee_id ASC,
          off_date ASC
      `,
      [
        getDateKey(year, month, 1),
        getDateKey(year, month, getDaysInMonth(year, month))
      ]
    );

  const plannedMap =
    new Map<string, any>();

  for (const planned of plannedRows) {
    plannedMap.set(
      `${planned.employee_id}-${planned.day}`,
      {
        id: planned.id,
        notes: planned.notes || null
      }
    );
  }

  const days =
    getDaysInMonth(
      year,
      month
    );

  return {
    days,
    employees:
      employees.map((employee: any) => {
        const planned_days: Record<string, any> = {};

        for (let day = 1; day <= days; day += 1) {
          planned_days[day] =
            plannedMap.get(`${employee.id}-${day}`) || null;
        }

        return {
          ...employee,
          planned_days
        };
      })
  };
}

export async function savePlannedDaysOffMonth(
  year: number,
  month: number,
  records: any[],
  userId?: number,
  user?: any
) {

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

      if (!employeeId || !day || day < 1 || day > days) {
        continue;
      }

      await assertEmployeeAccess(
        employeeId,
        user
      );

      const offDate =
        getDateKey(
          year,
          month,
          day
        );

      if (record.is_planned) {
        await connection.query(
          `
            INSERT INTO employee_planned_days_off (
              employee_id,
              off_date,
              notes,
              created_by
            )
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              notes = VALUES(notes),
              updated_at = CURRENT_TIMESTAMP
          `,
          [
            employeeId,
            offDate,
            record.notes || null,
            userId || null
          ]
        );
      } else {
        await connection.query(
          `
            DELETE FROM employee_planned_days_off
            WHERE employee_id = ?
              AND off_date = ?
          `,
          [
            employeeId,
            offDate
          ]
        );
      }
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function saveAttendanceMonth(
  year: number,
  month: number,
  records: any[],
  userId?: number,
  user?: any
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

      const compensatoryDays =
        record.compensatory_days === 1 ||
        record.compensatory_days === 2
          ? Number(record.compensatory_days)
          : null;

      if (!employeeId || !day || day < 1 || day > days) {
        continue;
      }

      await assertEmployeeAccess(
        employeeId,
        user
      );

      const attendanceDate =
        getDateKey(
          year,
          month,
          day
        );

      const [existingRows]: any =
        await connection.query(
          `
            SELECT
              ac.code,
              ac.description
            FROM attendance_records ar
            INNER JOIN attendance_codes ac
              ON ac.id = ar.attendance_code_id
            WHERE ar.employee_id = ?
              AND ar.attendance_date = ?
            LIMIT 1
          `,
          [
            employeeId,
            attendanceDate
          ]
        );

      if (
        existingRows.length > 0 &&
        attendanceCodesOnlyFromLeaves.has(
          String(existingRows[0].code || '')
            .toUpperCase()
        )
      ) {
        throw new Error(
          `No se puede modificar el dia ${attendanceDate} desde Presentismo porque tiene la clave ${existingRows[0].code} - ${existingRows[0].description} cargada desde Licencias`
        );
      }

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

      if (attendanceCodesOnlyFromLeaves.has(code)) {
        throw new Error(
          `La clave ${code} debe cargarse desde Licencias, no desde Presentismo`
        );
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
            compensatory_days,
            source,
            created_by
          )
          VALUES (?, ?, ?, ?, ?, ?, 'manual', ?)
          ON DUPLICATE KEY UPDATE
            attendance_period_id = VALUES(attendance_period_id),
            attendance_code_id = VALUES(attendance_code_id),
            raw_code = VALUES(raw_code),
            compensatory_days = VALUES(compensatory_days),
            source = 'manual',
            updated_at = CURRENT_TIMESTAMP
        `,
        [
          employeeId,
          period.id,
          codeRows[0].id,
          attendanceDate,
          code,
          code === 'P'
            ? compensatoryDays
            : null,
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

export async function fillPresentAttendanceDay(
  year: number,
  month: number,
  day: number,
  departmentId: number | null,
  userId?: number,
  user?: any,
  facilityId?: number | null
) {

  const days =
    getDaysInMonth(
      year,
      month
    );

  if (!day || day < 1 || day > days) {
    throw new Error(
      'Dia invalido para el mes seleccionado'
    );
  }

  const period =
    await getOrCreateAttendancePeriod(
      year,
      month
    );

  const attendanceDate =
    getDateKey(
      year,
      month,
      day
    );

  const [codeRows]: any =
    await pool.query(
      `
        SELECT id
        FROM attendance_codes
        WHERE code = 'P'
          AND is_active = TRUE
        LIMIT 1
      `
    );

  if (!codeRows.length) {
    throw new Error(
      'La clave P de Presente no existe o esta inactiva'
    );
  }

  const params: any[] = [
    period.id,
    codeRows[0].id,
    attendanceDate,
    'P',
    userId || null,
    attendanceDate
  ];

  let departmentFilter = '';

  if (departmentId) {
    departmentFilter =
      'AND e.department_id = ?';
    params.push(departmentId);
  }

  const facilityFilter =
    getPersonnelFacilityFilter(
      user,
      facilityId,
      'e'
    );

  const [result]: any =
    await pool.query(
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
        SELECT
          e.id,
          ?,
          ?,
          ?,
          ?,
          'auto_present',
          ?
        FROM employees e
        WHERE e.is_active = TRUE
          AND NOT EXISTS (
            SELECT 1
            FROM attendance_records ar
            WHERE ar.employee_id = e.id
              AND ar.attendance_date = ?
          )
          ${departmentFilter}
          ${facilityFilter.sql}
      `,
      [
        ...params,
        ...facilityFilter.params
      ]
    );

  return {
    date: attendanceDate,
    completed:
      Number(result.affectedRows || 0)
  };
}

export async function getAttendanceSummary(
  year: number,
  month: number,
  departmentId: number | null,
  user?: any,
  facilityId?: number | null
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

  const facilityFilter =
    getPersonnelFacilityFilter(
      user,
      facilityId,
      'e'
    );

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
          ${facilityFilter.sql}
        GROUP BY
          e.id,
          e.full_name,
          d.name,
          ac.category
        ORDER BY
          d.name ASC,
          e.full_name ASC
      `,
      [
        ...params,
        ...facilityFilter.params
      ]
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

  const allowedDays =
    Number(
    rows[0]?.allowed_days || 14
  );

  if (employee.is_professional) {
    return Math.max(
      allowedDays,
      30
    );
  }

  return allowedDays;
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

async function getVacationRequestCount(
  employeeId: number,
  year: number,
  excludeLeaveRequestId?: number
) {
  const params: any[] = [
    employeeId,
    year
  ];

  let excludeFilter = '';

  if (excludeLeaveRequestId) {
    excludeFilter = 'AND lr.id <> ?';
    params.push(excludeLeaveRequestId);
  }

  const [rows]: any =
    await pool.query(
      `
        SELECT COUNT(*) AS total
        FROM leave_requests lr
        INNER JOIN attendance_codes ac
          ON ac.id = lr.attendance_code_id
        WHERE lr.employee_id = ?
          AND ac.code = '8'
          AND lr.status IN ('pendiente', 'aprobado')
          AND YEAR(lr.start_date) = ?
          ${excludeFilter}
      `,
      params
    );

  return Number(rows[0]?.total || 0);
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
        allowed_days = GREATEST(allowed_days, VALUES(allowed_days)),
        used_days = VALUES(used_days),
        remaining_days = GREATEST(allowed_days, VALUES(allowed_days)) - VALUES(used_days)
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
  allowedDays: number,
  usedDays?: number
) {
  const normalizedAllowedDays =
    Math.max(0, Number(allowedDays || 0));

  const shouldUpdateUsedDays =
    usedDays !== undefined &&
    usedDays !== null &&
    !Number.isNaN(Number(usedDays));

  const normalizedUsedDays =
    shouldUpdateUsedDays
      ? Math.max(0, Number(usedDays))
      : null;

  await pool.query(
    `
      UPDATE employee_leave_balances
      SET
        allowed_days = ?,
        used_days = CASE
          WHEN ? IS NULL THEN used_days
          ELSE ?
        END,
        remaining_days = ? - CASE
          WHEN ? IS NULL THEN used_days
          ELSE ?
        END
      WHERE id = ?
    `,
    [
      normalizedAllowedDays,
      normalizedUsedDays,
      normalizedUsedDays,
      normalizedAllowedDays,
      normalizedUsedDays,
      normalizedUsedDays,
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

  if (usedDays === 0 && usedHours === 0) {
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

const configurableDayRuleCodes =
  new Set([
    '5',
    '6',
    '14',
    '15',
    '16',
    '17',
    '18',
    '31',
    '33',
    '42'
  ]);

const configurableHourRuleCodes =
  new Set([
    '35',
    '46'
  ]);

async function getActiveLeaveRuleForCode(
  code: string
) {

  try {
    const [rows]: any =
      await pool.query(
        `
          SELECT
            lr.id,
            lr.name,
            lr.min_advance_days,
            lr.max_days_per_request,
            lr.max_days_per_year,
            lr.max_hours_per_day,
            lr.max_hours_per_week,
            lr.max_hours_per_month,
            lr.max_hours_per_year,
            lr.rule_notes
          FROM leave_rules lr
          INNER JOIN attendance_codes ac
            ON ac.id = lr.attendance_code_id
          WHERE ac.code = ?
            AND lr.is_active = TRUE
          ORDER BY lr.id ASC
          LIMIT 1
        `,
        [code]
      );

    return rows[0] || null;
  } catch (error: any) {
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return null;
    }

    throw error;
  }
}

async function validateConfigurableDayRule(
  employeeId: number,
  code: string,
  startYear: number,
  totalDays: number,
  advanceDays: number,
  isException: boolean,
  excludeLeaveRequestId?: number
) {

  if (
    isException ||
    !configurableDayRuleCodes.has(code)
  ) {
    return false;
  }

  const rule =
    await getActiveLeaveRuleForCode(code);

  if (!rule) {
    return false;
  }

  const ruleName =
    rule.name || `clave ${code}`;

  if (
    rule.min_advance_days !== null &&
    advanceDays < Number(rule.min_advance_days)
  ) {
    throw new Error(
      `La clave ${code} - ${ruleName} requiere ${rule.min_advance_days} dias de anticipacion`
    );
  }

  if (
    rule.max_days_per_request !== null &&
    totalDays > Number(rule.max_days_per_request)
  ) {
    throw new Error(
      `La clave ${code} - ${ruleName} permite hasta ${rule.max_days_per_request} dias por solicitud`
    );
  }

  if (rule.max_days_per_year !== null) {
    const usage =
      await getApprovedUsage(
        employeeId,
        code,
        startYear,
        excludeLeaveRequestId
      );

    if (
      usage.days + totalDays >
      Number(rule.max_days_per_year)
    ) {
      throw new Error(
        `La clave ${code} - ${ruleName} tiene un maximo de ${rule.max_days_per_year} dias anuales`
      );
    }
  }

  return true;
}

async function validateConfigurableHourRule(
  employeeId: number,
  code: string,
  startDate: string,
  startYear: number,
  startMonth: number,
  totalHours: number,
  isException: boolean,
  excludeLeaveRequestId?: number
) {

  if (
    isException ||
    !configurableHourRuleCodes.has(code)
  ) {
    return false;
  }

  const rule =
    await getActiveLeaveRuleForCode(code);

  if (!rule) {
    return false;
  }

  const ruleName =
    rule.name || `clave ${code}`;

  if (totalHours <= 0) {
    throw new Error(
      `La clave ${code} - ${ruleName} requiere cargar horas`
    );
  }

  if (
    rule.max_hours_per_day !== null &&
    totalHours > Number(rule.max_hours_per_day)
  ) {
    throw new Error(
      `La clave ${code} - ${ruleName} permite hasta ${rule.max_hours_per_day} horas por dia`
    );
  }

  if (rule.max_hours_per_week !== null) {
    const week =
      getWeekBounds(startDate);

    const weekly =
      await getDateRangeUsage(
        employeeId,
        [code],
        week.start,
        week.end,
        excludeLeaveRequestId
      );

    if (
      weekly.hours + totalHours >
      Number(rule.max_hours_per_week)
    ) {
      throw new Error(
        `La clave ${code} - ${ruleName} supera ${rule.max_hours_per_week} horas semanales. Ya hay ${weekly.hours} hs cargadas esa semana; puede cargar como maximo ${Math.max(0, Number(rule.max_hours_per_week) - weekly.hours)} hs`
      );
    }
  }

  if (rule.max_hours_per_month !== null) {
    const monthly =
      await getMonthlyUsage(
        employeeId,
        [code],
        startYear,
        startMonth,
        excludeLeaveRequestId
      );

    if (
      monthly.hours + totalHours >
      Number(rule.max_hours_per_month)
    ) {
      throw new Error(
        `La clave ${code} - ${ruleName} supera ${rule.max_hours_per_month} horas mensuales`
      );
    }
  }

  if (rule.max_hours_per_year !== null) {
    const yearly =
      await getApprovedUsage(
        employeeId,
        code,
        startYear,
        excludeLeaveRequestId
      );

    if (
      yearly.hours + totalHours >
      Number(rule.max_hours_per_year)
    ) {
      throw new Error(
        `La clave ${code} - ${ruleName} supera ${rule.max_hours_per_year} horas anuales`
      );
    }
  }

  return true;
}

async function getApprovedUsage(
  employeeId: number,
  code: string,
  year: number,
  excludeLeaveRequestId?: number
) {
  const params: any[] = [
    employeeId,
    code,
    year
  ];

  let excludeFilter = '';

  if (excludeLeaveRequestId) {
    excludeFilter = 'AND lr.id <> ?';
    params.push(excludeLeaveRequestId);
  }

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
          ${excludeFilter}
      `,
      params
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
  month: number,
  excludeLeaveRequestId?: number
) {
  const params: any[] = [
    employeeId,
    codes,
    year,
    month
  ];

  let excludeFilter = '';

  if (excludeLeaveRequestId) {
    excludeFilter = 'AND lr.id <> ?';
    params.push(excludeLeaveRequestId);
  }

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
          ${excludeFilter}
      `,
      params
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
  endDate: string,
  excludeLeaveRequestId?: number
) {
  const params: any[] = [
    employeeId,
    codes,
    endDate,
    startDate
  ];

  let excludeFilter = '';

  if (excludeLeaveRequestId) {
    excludeFilter = 'AND lr.id <> ?';
    params.push(excludeLeaveRequestId);
  }

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
          ${excludeFilter}
      `,
      params
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
  year: number,
  excludeLeaveRequestId?: number
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

  const pendingParams: any[] = [
    employeeId,
    year
  ];

  let pendingExcludeFilter = '';

  if (excludeLeaveRequestId) {
    pendingExcludeFilter = 'AND lr.id <> ?';
    pendingParams.push(excludeLeaveRequestId);
  }

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
          ${pendingExcludeFilter}
      `,
      pendingParams
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

  const [workedPlannedOffRows]: any =
    await pool.query(
      `
        SELECT
          COALESCE(
            SUM(
              CASE
                WHEN ar.compensatory_days IS NULL THEN 2
                ELSE ar.compensatory_days
              END
            ),
            0
          ) AS total
        FROM employee_planned_days_off epdo
        INNER JOIN attendance_records ar
          ON ar.employee_id = epdo.employee_id
          AND ar.attendance_date = epdo.off_date
        INNER JOIN attendance_codes ac
          ON ac.id = ar.attendance_code_id
        WHERE epdo.employee_id = ?
          AND ac.code = 'P'
          AND YEAR(epdo.off_date) = ?
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
    Number(creditAdjustments[0].total || 0) +
    Number(workedPlannedOffRows[0].total || 0);

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
  isException: boolean,
  excludeLeaveRequestId?: number
) {

  if (isException) {
    return;
  }

  const usage =
    await getApprovedUsage(
      employeeId,
      code,
      year,
      excludeLeaveRequestId
    );

  if (usage.days + requestedDays > limitDays) {
    throw new Error(message);
  }
}

export async function getEmployeeLeaveSummary(
  employeeId: number,
  year: number,
  month: number,
  user?: any
) {

  await assertEmployeeAccess(
    employeeId,
    user
  );

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
      id:
        Number(vacation.id),
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
  month: number,
  user?: any
) {

  await assertEmployeeAccess(
    employeeId,
    user
  );

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
          e.work_shift,
          TIME_FORMAT(e.shift_start_time, '%H:%i') AS shift_start_time,
          TIME_FORMAT(e.shift_end_time, '%H:%i') AS shift_end_time,
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
          AND YEAR(ar.attendance_date) = ?
        GROUP BY
          ac.code,
          ac.description,
          ac.category
        ORDER BY total DESC
      `,
      [
        employeeId,
        year
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
          lr.employee_id,
          ac.code,
          ac.description,
          lr.start_date,
          lr.end_date,
          lr.total_days,
          lr.total_hours,
          lr.status,
          lr.requested_at,
          lr.requested_by,
          COALESCE(
            NULLIF(
              TRIM(CONCAT_WS(' ', requester.first_name, requester.last_name)),
              ''
            ),
            requester.username,
            requester.email,
            '-'
          ) AS requested_by_name,
          lr.edited_by,
          lr.edited_at,
          COALESCE(
            NULLIF(
              TRIM(CONCAT_WS(' ', editor.first_name, editor.last_name)),
              ''
            ),
            editor.username,
            editor.email,
            NULL
          ) AS edited_by_name,
          lr.approved_by,
          lr.approved_at,
          COALESCE(
            NULLIF(
              TRIM(CONCAT_WS(' ', approver.first_name, approver.last_name)),
              ''
            ),
            approver.username,
            approver.email,
            NULL
          ) AS approved_by_name,
          lr.rejected_reason,
          lr.notes
        FROM leave_requests lr
        INNER JOIN attendance_codes ac
          ON ac.id = lr.attendance_code_id
        LEFT JOIN users requester
          ON requester.id = lr.requested_by
        LEFT JOIN users editor
          ON editor.id = lr.edited_by
        LEFT JOIN users approver
          ON approver.id = lr.approved_by
        WHERE lr.employee_id = ?
        ORDER BY
          lr.start_date DESC,
          lr.id DESC
      `,
      [employeeId]
    );

  const [recentAttendance]: any =
    await pool.query(
      `
        SELECT
          ar.id,
          ar.attendance_date,
          ac.code,
          ac.description,
          ac.category,
          ar.source,
          ar.created_at,
          COALESCE(
            NULLIF(
              TRIM(CONCAT_WS(' ', creator.first_name, creator.last_name)),
              ''
            ),
            creator.username,
            creator.email,
            '-'
          ) AS created_by_name
        FROM attendance_records ar
        INNER JOIN attendance_codes ac
          ON ac.id = ar.attendance_code_id
        LEFT JOIN users creator
          ON creator.id = ar.created_by
        WHERE ar.employee_id = ?
          AND YEAR(ar.attendance_date) = ?
          AND ac.code <> 'P'
        ORDER BY
          ar.attendance_date DESC,
          ar.id DESC
      `,
      [
        employeeId,
        year
      ]
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
  data: any,
  excludeLeaveRequestId?: number
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

  const overlapValues: any[] = [
    employee.id,
    endDate,
    startDate
  ];

  let overlapExcludeSql = '';

  if (excludeLeaveRequestId) {
    overlapExcludeSql =
      'AND lr.id <> ?';
    overlapValues.push(excludeLeaveRequestId);
  }

  const [overlapRows]: any =
    await pool.query(
      `
        SELECT
          lr.id,
          ac.code,
          ac.description,
          lr.start_date,
          lr.end_date,
          lr.status
        FROM leave_requests lr
        INNER JOIN attendance_codes ac
          ON ac.id = lr.attendance_code_id
        WHERE lr.employee_id = ?
          AND lr.status IN ('pendiente', 'aprobado')
          AND DATE(lr.start_date) <= DATE(?)
          AND DATE(lr.end_date) >= DATE(?)
          ${overlapExcludeSql}
        ORDER BY lr.start_date ASC, lr.id ASC
      `,
      overlapValues
    );

  if (overlapRows.length > 0) {
    const canShareDayWithHourPermission =
      ['24', '43'].includes(code.code) &&
      overlapRows.every((row: any) =>
        ['24', '43'].includes(String(row.code))
      );

    if (!canShareDayWithHourPermission) {
      const existing =
        overlapRows[0];

      throw new Error(
        `No se puede cargar esta licencia porque ya existe la clave ${existing.code} - ${existing.description} entre ${toDateOnly(existing.start_date)} y ${toDateOnly(existing.end_date)} para este empleado`
      );
    }
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

    let currentRequestVacationDays = 0;

    if (excludeLeaveRequestId) {
      const [currentRows]: any =
        await pool.query(
          `
            SELECT COALESCE(lr.total_days, 0) AS total_days
            FROM leave_requests lr
            INNER JOIN attendance_codes ac
              ON ac.id = lr.attendance_code_id
            WHERE lr.id = ?
              AND lr.employee_id = ?
              AND ac.code = '8'
              AND lr.status IN ('pendiente', 'aprobado')
              AND YEAR(lr.start_date) = ?
            LIMIT 1
          `,
          [
            excludeLeaveRequestId,
            employee.id,
            startYear
          ]
        );

      currentRequestVacationDays =
        Number(currentRows[0]?.total_days || 0);
    }

    const availableDays =
      Number(balance.available_days);

    const availableDaysForEdit =
      availableDays + currentRequestVacationDays;

    const alreadyRequestedParts =
      await getVacationRequestCount(
        employee.id,
        startYear,
        excludeLeaveRequestId
      );

    if (alreadyRequestedParts >= 2 && !isException) {
      throw new Error(
        'La licencia anual clave 8 solo puede fraccionarse hasta 2 veces por año'
      );
    }

    if (totalDays > availableDaysForEdit && !isException) {
      throw new Error(
        `La clave 8 supera el saldo disponible. Disponible: ${availableDaysForEdit} dias`
      );
    }

    const alreadyUsedVacation =
      Number(balance.used_days || 0) +
        Number(balance.pending_days || 0) -
        currentRequestVacationDays >
      0;

    if (
      alreadyUsedVacation &&
      totalDays !== availableDaysForEdit &&
      !isException
    ) {
      throw new Error(
        `La segunda parte de la licencia anual debe tomarse completa. Dias disponibles: ${availableDaysForEdit}`
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
        startYear,
        excludeLeaveRequestId
      );

    const availableDays =
      Math.max(
        0,
        allowance - usage.days
      );

    if (usage.days + totalDays > allowance && !isException) {
      throw new Error(
        `La clave 29 supera el saldo disponible. Disponible: ${availableDays} dias`
      );
    }

    if (totalDays !== availableDays && !isException) {
      throw new Error(
        `La clave 29 debe tomarse completa de una sola vez. Dias disponibles: ${availableDays}`
      );
    }
  }

  if (code.code === '34') {
    const compensatory =
      await getCompensatoryBalance(
        employee.id,
        startYear,
        excludeLeaveRequestId
      );

    if (totalDays > compensatory.remainingDays && !isException) {
      throw new Error(
        `La clave 34 requiere compensatorios disponibles. Disponibles: ${compensatory.remainingDays} dias`
      );
    }
  }

  const configurableDayRuleHandled =
    await validateConfigurableDayRule(
      employee.id,
      code.code,
      startYear,
      totalDays,
      advanceDays,
      isException,
      excludeLeaveRequestId
    );

  if (!configurableDayRuleHandled && code.code === '5') {
    await assertAnnualDayLimit(
      employee.id,
      '5',
      startYear,
      totalDays,
      20,
      'La clave 5 tiene un maximo de 20 dias por año',
      isException,
      excludeLeaveRequestId
    );
  }

  if (
    !configurableDayRuleHandled &&
    code.code === '6' &&
    totalDays > 90 &&
    !isException
  ) {
    throw new Error(
      'La clave 6 maternidad permite hasta 90 dias'
    );
  }

  if (
    !configurableDayRuleHandled &&
    code.code === '14' &&
    totalDays > 3 &&
    !isException
  ) {
    throw new Error(
      'La clave 14 permite hasta 3 dias corridos'
    );
  }

  if (
    !configurableDayRuleHandled &&
    code.code === '15' &&
    totalDays > 1 &&
    !isException
  ) {
    throw new Error(
      'La clave 15 permite 1 dia'
    );
  }

  if (
    !configurableDayRuleHandled &&
    code.code === '16' &&
    totalDays > 10 &&
    !isException
  ) {
    throw new Error(
      'La clave 16 matrimonio permite hasta 10 dias corridos'
    );
  }

  if (
    !configurableDayRuleHandled &&
    code.code === '17' &&
    totalDays > 2 &&
    !isException
  ) {
    throw new Error(
      'La clave 17 pre examen permite hasta 2 dias por materia'
    );
  }

  if (
    !configurableDayRuleHandled &&
    code.code === '18' &&
    totalDays > 1 &&
    !isException
  ) {
    throw new Error(
      'La clave 18 examen permite 1 dia por examen'
    );
  }

  if (
    !configurableDayRuleHandled &&
    code.code === '31' &&
    totalDays > 3 &&
    !isException
  ) {
    throw new Error(
      'La clave 31 nacimiento de hijo permite hasta 3 dias'
    );
  }

  if (
    !configurableDayRuleHandled &&
    code.code === '33' &&
    totalDays > 1 &&
    !isException
  ) {
    throw new Error(
      'La clave 33 donacion de sangre permite 1 dia'
    );
  }

  const configurableHourRuleHandled =
    await validateConfigurableHourRule(
      employee.id,
      code.code,
      startDate,
      startYear,
      startMonth,
      totalHours,
      isException,
      excludeLeaveRequestId
    );

  if (!configurableHourRuleHandled && code.code === '35') {
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

  if (
    !configurableDayRuleHandled &&
    code.code === '42' &&
    totalDays > 90 &&
    !isException
  ) {
    throw new Error(
      'La clave 42 adopcion permite hasta 90 dias'
    );
  }

  if (!configurableHourRuleHandled && code.code === '46') {
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
        week.end,
        excludeLeaveRequestId
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
        startYear,
        excludeLeaveRequestId
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
        startMonth,
        excludeLeaveRequestId
      );

    if (monthly.requests > 0 && !isException) {
      throw new Error(
        'La clave 26 solo puede tomarse una vez por mes'
      );
    }
  }

  if (['24', '43'].includes(code.code)) {
    const isOpenReturn43 =
      code.code === '43' &&
      !Boolean(data.no_return) &&
      totalHours <= 0;

    if (totalHours <= 0 && !isOpenReturn43) {
      throw new Error(
        'Las claves 24 y 43 requieren cargar horas'
      );
    }

    if (totalHours > 2 && !isException) {
      throw new Error(
        'Las claves 24 y 43 permiten hasta 2 horas por dia'
      );
    }

    const [dailyRows]: any =
      await pool.query(
        `
          SELECT COALESCE(SUM(lr.total_hours), 0) AS hours
          FROM leave_requests lr
          INNER JOIN attendance_codes ac
            ON ac.id = lr.attendance_code_id
          WHERE lr.employee_id = ?
            AND ac.code IN ('24', '43')
            AND lr.status IN ('pendiente', 'aprobado')
            AND DATE(lr.start_date) <= DATE(?)
            AND DATE(lr.end_date) >= DATE(?)
            ${overlapExcludeSql}
        `,
        [
          employee.id,
          startDate,
          startDate,
          ...(excludeLeaveRequestId ? [excludeLeaveRequestId] : [])
        ]
      );

    const dailyHours =
      Number(dailyRows[0]?.hours || 0);

    if (
      dailyHours + totalHours > 2 &&
      !isException
    ) {
      throw new Error(
        `Las claves 24 y 43 no pueden superar 2 horas por dia. Ese dia ya tiene ${dailyHours} hs cargadas; puede cargar como maximo ${Math.max(0, 2 - dailyHours)} hs`
      );
    }

    if (isOpenReturn43) {
      return {
        employee,
        code,
        startDate,
        endDate,
        totalDays,
        totalHours
      };
    }

    const yearly24 =
      await getApprovedUsage(
        employee.id,
        '24',
        startYear,
        excludeLeaveRequestId
      );

    const yearly43 =
      await getApprovedUsage(
        employee.id,
        '43',
        startYear,
        excludeLeaveRequestId
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
        startMonth,
        excludeLeaveRequestId
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

export async function getLeaveRequests(
  user?: any,
  facilityId?: number | null
) {

  const facilityFilter =
    getPersonnelFacilityFilter(
      user,
      facilityId,
      'e'
    );

  const [rows]: any =
    await pool.query(
      `
        SELECT
          lr.id,
          lr.employee_id,
          e.full_name,
          e.dni,
          e.file_number,
          e.hire_date,
          e.employment_type,
          d.name AS department_name,
          (
            SELECT MAX(lr8.start_date)
            FROM leave_requests lr8
            INNER JOIN attendance_codes ac8
              ON ac8.id = lr8.attendance_code_id
            WHERE lr8.employee_id = lr.employee_id
              AND ac8.code = '8'
              AND lr8.status IN ('pendiente', 'aprobado')
              AND lr8.start_date < lr.start_date
          ) AS last_annual_leave_date,
          ac.code,
          ac.description,
          lr.start_date,
          lr.end_date,
          lr.total_days,
          lr.total_hours,
          COALESCE(elb.allowed_days, 0) AS balance_allowed_days,
          CASE
            WHEN lr.status = 'aprobado' THEN
              GREATEST(
                0,
                COALESCE(elb.remaining_days, 0) +
                lr.total_days -
                COALESCE((
                  SELECT SUM(lr2.total_days)
                  FROM leave_requests lr2
                  WHERE lr2.employee_id = lr.employee_id
                    AND lr2.attendance_code_id = lr.attendance_code_id
                    AND lr2.status = 'pendiente'
                    AND YEAR(lr2.start_date) = YEAR(lr.start_date)
                    AND lr2.id <> lr.id
                ), 0)
              )
            ELSE
              GREATEST(
                0,
                COALESCE(elb.allowed_days, 0) -
                COALESCE(elb.used_days, 0) -
                COALESCE((
                  SELECT SUM(lr2.total_days)
                  FROM leave_requests lr2
                  WHERE lr2.employee_id = lr.employee_id
                    AND lr2.attendance_code_id = lr.attendance_code_id
                    AND lr2.status = 'pendiente'
                    AND YEAR(lr2.start_date) = YEAR(lr.start_date)
                    AND lr2.id <> lr.id
                ), 0)
              )
          END AS balance_available_before_request,
          CASE
            WHEN lr.status = 'aprobado' THEN
              GREATEST(
                0,
                COALESCE(elb.remaining_days, 0) -
                COALESCE((
                  SELECT SUM(lr2.total_days)
                  FROM leave_requests lr2
                  WHERE lr2.employee_id = lr.employee_id
                    AND lr2.attendance_code_id = lr.attendance_code_id
                    AND lr2.status = 'pendiente'
                    AND YEAR(lr2.start_date) = YEAR(lr.start_date)
                    AND lr2.id <> lr.id
                ), 0)
              )
            WHEN lr.status = 'pendiente' THEN
              GREATEST(
                0,
                COALESCE(elb.allowed_days, 0) -
                COALESCE(elb.used_days, 0) -
                COALESCE((
                  SELECT SUM(lr2.total_days)
                  FROM leave_requests lr2
                  WHERE lr2.employee_id = lr.employee_id
                    AND lr2.attendance_code_id = lr.attendance_code_id
                    AND lr2.status = 'pendiente'
                    AND YEAR(lr2.start_date) = YEAR(lr.start_date)
                    AND lr2.id <> lr.id
                ), 0) -
                lr.total_days
              )
            ELSE
              GREATEST(
                0,
                COALESCE(elb.allowed_days, 0) -
                COALESCE(elb.used_days, 0)
              )
          END AS balance_pending_after_request,
          lr.permission_kind,
          lr.exit_reason,
          lr.exit_time,
          lr.return_time,
          lr.no_return,
          lr.shift_label,
          lr.exam_type,
          lr.is_exception,
          lr.exception_reason,
          lr.status,
          lr.requested_at,
          lr.requested_by,
          COALESCE(
            NULLIF(
              TRIM(CONCAT_WS(' ', u.first_name, u.last_name)),
              ''
            ),
            u.username,
            u.email,
            '-'
          ) AS requested_by_name,
          lr.edited_by,
          lr.edited_at,
          COALESCE(
            NULLIF(
              TRIM(CONCAT_WS(' ', editor.first_name, editor.last_name)),
              ''
            ),
            editor.username,
            editor.email,
            NULL
          ) AS edited_by_name,
          lr.approved_by,
          lr.approved_at,
          COALESCE(
            NULLIF(
              TRIM(CONCAT_WS(' ', approver.first_name, approver.last_name)),
              ''
            ),
            approver.username,
            approver.email,
            NULL
          ) AS approved_by_name,
          lr.notes
        FROM leave_requests lr
        INNER JOIN employees e
          ON e.id = lr.employee_id
        LEFT JOIN users u
          ON u.id = lr.requested_by
        LEFT JOIN users editor
          ON editor.id = lr.edited_by
        LEFT JOIN users approver
          ON approver.id = lr.approved_by
        LEFT JOIN employee_departments d
          ON d.id = e.department_id
        INNER JOIN attendance_codes ac
          ON ac.id = lr.attendance_code_id
        LEFT JOIN employee_leave_balances elb
          ON elb.employee_id = lr.employee_id
          AND elb.attendance_code_id = lr.attendance_code_id
          AND elb.year = YEAR(lr.start_date)
        WHERE 1 = 1
          ${facilityFilter.sql}
        ORDER BY
          lr.requested_at DESC,
          lr.id DESC
      `,
      facilityFilter.params
    );

  return rows;
}

export async function getLeaveRequestAuditDetail(
  id: number
) {

  const [rows]: any =
    await pool.query(
      `
        SELECT
          lr.id,
          e.full_name,
          e.dni,
          e.file_number,
          ac.code,
          ac.description,
          lr.start_date,
          lr.end_date,
          lr.total_days,
          lr.total_hours,
          lr.status
        FROM leave_requests lr
        INNER JOIN employees e
          ON e.id = lr.employee_id
        INNER JOIN attendance_codes ac
          ON ac.id = lr.attendance_code_id
        WHERE lr.id = ?
        LIMIT 1
      `,
      [id]
    );

  if (!rows.length) {
    return null;
  }

  return rows[0];
}

export function formatLeaveAuditDetail(
  detail: any
) {

  if (!detail) {
    return 'licencia sin detalle disponible';
  }

  const dateRange =
    detail.start_date === detail.end_date
      ? `fecha ${toDateOnly(detail.start_date)}`
      : `desde ${toDateOnly(detail.start_date)} hasta ${toDateOnly(detail.end_date)}`;

  const legajo =
    detail.file_number
      ? `, legajo ${detail.file_number}`
      : '';

  const dni =
    detail.dni
      ? `, DNI ${detail.dni}`
      : '';

  const amount =
    Number(detail.total_hours || 0) > 0
      ? `${detail.total_hours} hora(s)`
      : `${detail.total_days} dia(s)`;

  return `clave ${detail.code} - ${detail.description}, empleado ${detail.full_name}${dni}${legajo}, ${dateRange}, ${amount}`;
}

export async function createLeaveRequest(
  data: any,
  userId?: number,
  user?: any
) {

  const validated =
    await validateLeaveRequest(data);

  await assertEmployeeAccess(
    Number(validated.employee.id),
    user
  );

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
          permission_kind,
          exit_reason,
          exit_time,
          return_time,
          no_return,
          shift_label,
          exam_type,
          is_exception,
          exception_reason,
          requested_by,
          notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        validated.employee.id,
        validated.code.id,
        validated.startDate,
        validated.endDate,
        validated.totalDays,
        validated.totalHours,
        validated.code.code === '24'
          ? 'entrada'
          : 'salida',
        ['24', '43'].includes(validated.code.code)
          ? data.exit_reason || null
          : null,
        ['24', '43'].includes(validated.code.code)
          ? data.exit_time || null
          : null,
        validated.code.code === '43'
          ? data.return_time || null
          : null,
        validated.code.code === '43'
          ? Boolean(data.no_return)
          : false,
        validated.code.code === '26'
          ? data.shift_label || null
          : null,
        ['17', '18'].includes(validated.code.code)
          ? data.exam_type || null
          : null,
        Boolean(data.is_exception),
        data.exception_reason || null,
        userId || null,
        data.notes || null
      ]
    );

  return result.insertId;
}

export async function updateLeaveRequest(
  id: number,
  data: any,
  userId?: number,
  user?: any
) {

  const validated =
    await validateLeaveRequest(
      data,
      id
    );

  await assertEmployeeAccess(
    Number(validated.employee.id),
    user
  );

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

    if (['cancelado', 'rechazado'].includes(previousStatus)) {
      throw new Error(
        'No se puede editar una licencia cancelada o rechazada'
      );
    }

    if (
      previousStatus === 'aprobado' &&
      !['admin', 'dir'].includes(user?.role)
    ) {
      throw new Error(
        'No se puede editar una licencia aprobada. Solo admin o dir pueden modificarla'
      );
    }

    if (previousStatus === 'aprobado') {
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

    await connection.query(
      `
        UPDATE leave_requests
        SET
          employee_id = ?,
          attendance_code_id = ?,
          start_date = ?,
          end_date = ?,
          total_days = ?,
          total_hours = ?,
          permission_kind = ?,
          exit_reason = ?,
          exit_time = ?,
          return_time = ?,
          no_return = ?,
          shift_label = ?,
          exam_type = ?,
          is_exception = ?,
          exception_reason = ?,
          notes = ?,
          edited_by = ?,
          edited_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [
        validated.employee.id,
        validated.code.id,
        validated.startDate,
        validated.endDate,
        validated.totalDays,
        validated.totalHours,
        validated.code.code === '24'
          ? 'entrada'
          : 'salida',
        ['24', '43'].includes(validated.code.code)
          ? data.exit_reason || null
          : null,
        ['24', '43'].includes(validated.code.code)
          ? data.exit_time || null
          : null,
        validated.code.code === '43'
          ? data.return_time || null
          : null,
        validated.code.code === '43'
          ? Boolean(data.no_return)
          : false,
        validated.code.code === '26'
          ? data.shift_label || null
          : null,
        ['17', '18'].includes(validated.code.code)
          ? data.exam_type || null
          : null,
        Boolean(data.is_exception),
        data.exception_reason || null,
        data.notes || null,
        userId || null,
        id
      ]
    );

    if (previousStatus === 'aprobado') {
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

    await connection.commit();

  } catch (error) {

    await connection.rollback();
    throw error;

  } finally {

    connection.release();
  }

  return true;
}

export async function updateLeaveRequestStatus(
  id: number,
  status: string,
  userId?: number,
  rejectedReason?: string,
  user?: any
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

  await assertLeaveRequestAccess(
    id,
    user
  );

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

    if (
      previousStatus === 'cancelado' &&
      status !== 'cancelado' &&
      user?.role !== 'admin'
    ) {
      throw new Error(
        'Solo un administrador puede revertir una licencia cancelada'
      );
    }

    await connection.query(
      `
        UPDATE leave_requests
        SET
          status = ?,
          approved_by = CASE WHEN ? IN ('aprobado', 'rechazado', 'cancelado') THEN ? ELSE approved_by END,
          approved_at = CASE WHEN ? IN ('aprobado', 'rechazado', 'cancelado') THEN CURRENT_TIMESTAMP ELSE approved_at END,
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

export async function completeLeaveReturn(
  id: number,
  data: any,
  user?: any
) {

  await assertLeaveRequestAccess(
    id,
    user
  );

  const totalHours =
    Number(data.total_hours || 0);

  if (!data.return_time) {
    throw new Error(
      'Debe cargar la hora de regreso'
    );
  }

  if (totalHours <= 0) {
    throw new Error(
      'Debe cargar las horas a descontar'
    );
  }

  if (totalHours > 2) {
    throw new Error(
      'La clave 43 permite hasta 2 horas por dia'
    );
  }

  const [rows]: any =
    await pool.query(
      `
        SELECT
          lr.id,
          lr.employee_id,
          lr.start_date,
          ac.code
        FROM leave_requests lr
        INNER JOIN attendance_codes ac
          ON ac.id = lr.attendance_code_id
        WHERE lr.id = ?
        LIMIT 1
      `,
      [id]
    );

  if (!rows.length) {
    throw new Error(
      'Licencia no encontrada'
    );
  }

  const request =
    rows[0];

  if (request.code !== '43') {
    throw new Error(
      'Solo se puede completar regreso para clave 43'
    );
  }

  const start =
    new Date(request.start_date);

  const year =
    start.getFullYear();

  const month =
    start.getMonth() + 1;

  const [yearRows]: any =
    await pool.query(
      `
        SELECT COALESCE(SUM(lr.total_hours), 0) AS hours
        FROM leave_requests lr
        INNER JOIN attendance_codes ac
          ON ac.id = lr.attendance_code_id
        WHERE lr.employee_id = ?
          AND ac.code IN ('24', '43')
          AND lr.status IN ('pendiente', 'aprobado')
          AND YEAR(lr.start_date) = ?
          AND lr.id <> ?
      `,
      [
        request.employee_id,
        year,
        id
      ]
    );

  if (Number(yearRows[0].hours || 0) + totalHours > 30) {
    throw new Error(
      'Las claves 24 y 43 tienen un maximo acumulado de 30 horas anuales'
    );
  }

  const [monthRows]: any =
    await pool.query(
      `
        SELECT COALESCE(SUM(lr.total_hours), 0) AS hours
        FROM leave_requests lr
        INNER JOIN attendance_codes ac
          ON ac.id = lr.attendance_code_id
        WHERE lr.employee_id = ?
          AND ac.code IN ('24', '43')
          AND lr.status IN ('pendiente', 'aprobado')
          AND YEAR(lr.start_date) = ?
          AND MONTH(lr.start_date) = ?
          AND lr.id <> ?
      `,
      [
        request.employee_id,
        year,
        month,
        id
      ]
    );

  if (Number(monthRows[0].hours || 0) + totalHours > 5) {
    throw new Error(
      'Las claves 24 y 43 no pueden superar 5 horas por mes'
    );
  }

  await pool.query(
    `
      UPDATE leave_requests
      SET
        return_time = ?,
        total_hours = ?,
        no_return = FALSE
      WHERE id = ?
    `,
    [
      data.return_time,
      totalHours,
      id
    ]
  );
}

export async function getEmployees(
  filters: any = {},
  user?: any
) {
  const where: string[] = [];
  const params: any[] = [];

  if (filters.search) {
    const search =
      `%${String(filters.search).trim()}%`;

    where.push(
      `(
        e.full_name LIKE ?
        OR e.dni LIKE ?
        OR e.cuil LIKE ?
        OR e.file_number LIKE ?
        OR d.name LIKE ?
        OR hf.name LIKE ?
      )`
    );

    params.push(
      search,
      search,
      search,
      search,
      search,
      search
    );
  }

  if (
    filters.department &&
    filters.department !== 'todos'
  ) {
    where.push('e.department_id = ?');
    params.push(Number(filters.department));
  }

  if (
    filters.facility_id &&
    filters.facility_id !== 'todos'
  ) {
    const scopedFacilityId =
      getScopedFacilityId(
        user,
        Number(filters.facility_id)
      );

    if (scopedFacilityId) {
      where.push('e.facility_id = ?');
      params.push(scopedFacilityId);
    }
  } else if (!canAccessAllFacilities(user)) {
    const allowedFacilityIds =
      Array.isArray(user?.facility_ids) &&
      user.facility_ids.length > 0
        ? user.facility_ids.map(Number)
        : user?.facility_id
          ? [Number(user.facility_id)]
          : [];

    if (allowedFacilityIds.length === 0) {
      where.push('1 = 0');
    } else {
      where.push(
        `e.facility_id IN (${allowedFacilityIds
          .map(() => '?')
          .join(', ')})`
      );
      params.push(...allowedFacilityIds);
    }
  }

  if (filters.status === 'activo') {
    where.push('e.is_active = TRUE');
  }

  if (filters.status === 'inactivo') {
    where.push('e.is_active = FALSE');
  }

  const whereSql =
    where.length
      ? `WHERE ${where.join(' AND ')}`
      : '';

  const shouldPaginate =
    filters.page || filters.per_page;

  const page =
    Math.max(
      1,
      Number(filters.page || 1)
    );

  const perPage =
    Math.min(
      100,
      Math.max(
        10,
        Number(filters.per_page || 25)
      )
    );

  const offset =
    (page - 1) * perPage;

  const [countRows]: any =
    shouldPaginate
      ? await pool.query(
        `
          SELECT COUNT(*) AS total
          FROM employees e
          LEFT JOIN employee_departments d
            ON d.id = e.department_id
          LEFT JOIN health_facilities hf
            ON hf.id = e.facility_id
          ${whereSql}
        `,
        params
      )
      : [[{ total: 0 }]];

  const [rows]: any =
    await pool.query(
      `
        SELECT
          e.id,
          e.facility_id,
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
          e.work_shift,
          TIME_FORMAT(e.shift_start_time, '%H:%i') AS shift_start_time,
          TIME_FORMAT(e.shift_end_time, '%H:%i') AS shift_end_time,
          e.is_professional,
          e.notes,
          e.is_active,
          hf.name AS facility_name,
          hf.facility_type,
          d.name AS department_name
        FROM employees e
        LEFT JOIN employee_departments d
          ON d.id = e.department_id
        LEFT JOIN health_facilities hf
          ON hf.id = e.facility_id
        ${whereSql}
        ORDER BY
          hf.name ASC,
          e.full_name ASC
        ${shouldPaginate ? 'LIMIT ? OFFSET ?' : ''}
      `,
      shouldPaginate
        ? [
            ...params,
            perPage,
            offset
          ]
        : params
    );

  if (shouldPaginate) {
    const total =
      Number(countRows[0]?.total || 0);

    return {
      employees: rows,
      pagination: {
        page,
        per_page: perPage,
        total,
        total_pages:
          Math.max(
            1,
            Math.ceil(total / perPage)
          )
      }
    };
  }

  return rows;
}

export async function createEmployee(
  data: any,
  user?: any
) {
  const facilityId =
    Number(
      data.facility_id ||
        getScopedFacilityId(user, null)
    );

  if (!facilityId) {
    throw new Error(
      'La dependencia del empleado es obligatoria'
    );
  }

  assertFacilityAccess(
    user,
    facilityId
  );

  const [result]: any =
    await pool.query(
      `
        INSERT INTO employees (
          facility_id,
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
          work_shift,
          shift_start_time,
          shift_end_time,
          is_professional,
          notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        facilityId,
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
        data.work_shift || null,
        data.shift_start_time || null,
        data.shift_end_time || null,
        Boolean(data.is_professional),
        data.notes || null
      ]
    );

  return result.insertId;
}

export async function updateEmployee(
  id: number,
  data: any,
  user?: any
) {
  await assertEmployeeAccess(
    id,
    user
  );

  const facilityId =
    Number(
      data.facility_id ||
        getScopedFacilityId(user, null)
    );

  if (!facilityId) {
    throw new Error(
      'La dependencia del empleado es obligatoria'
    );
  }

  assertFacilityAccess(
    user,
    facilityId
  );

  await pool.query(
    `
      UPDATE employees
      SET
        facility_id = ?,
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
        work_shift = ?,
        shift_start_time = ?,
        shift_end_time = ?,
        is_professional = ?,
        notes = ?
      WHERE id = ?
    `,
    [
      facilityId,
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
      data.work_shift || null,
      data.shift_start_time || null,
      data.shift_end_time || null,
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
