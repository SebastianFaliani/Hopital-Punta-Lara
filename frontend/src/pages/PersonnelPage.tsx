import {
  useEffect,
  useRef,
  useState
} from 'react';
import { useLocation }
  from 'react-router-dom';

import { apiFetch }
  from '../api/api';
import { useAuth } from '../auth/useAuth';
import { hasPermission } from '../auth/permissions';
import { IconButton } from '../components/IconButton';
import PageTitle from '../components/PageTitle';
import {
  formatDisplayDate
} from '../utils/dateFormat';

type Department = {
  id: number;
  facility_id: number | null;
  facility_name: string | null;
  facility_type: string | null;
  name: string;
  description: string | null;
  is_active: boolean;
};

type Facility = {
  id: number;
  name: string;
  facility_type: string;
  is_active: boolean;
};

type Employee = {
  id: number;
  facility_id: number | null;
  facility_name: string | null;
  facility_type: string | null;
  department_id: number | null;
  department_name: string | null;
  full_name: string;
  dni: string | null;
  cuil: string | null;
  birth_date: string | null;
  hire_date: string | null;
  file_number: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  license_number: string | null;
  employment_type: string | null;
  work_shift: string | null;
  shift_start_time: string | null;
  shift_end_time: string | null;
  is_professional: boolean;
  notes: string | null;
  is_active: boolean;
};

type AttendanceCode = {
  id: number;
  code: string;
  description: string;
  category: string;
  counts_as_present: boolean;
  requires_approval: boolean;
  requires_documentation: boolean;
  affects_salary: boolean;
  annual_limit_days: number | null;
  advance_notice_days: number | null;
  is_active: boolean;
};

type AttendanceEmployee = {
  id: number;
  full_name: string;
  dni: string | null;
  file_number: string | null;
  department_id: number | null;
  department_name: string | null;
  attendance: Record<
    string,
    {
      code: string;
      description: string;
      compensatory_days: number | null;
      permissions?: Array<{
        code: string;
        description: string;
        status: string;
        permission_kind: string | null;
        total_hours: number;
      }>;
      planned_off?: {
        id: number;
        notes: string | null;
      } | null;
    }
  >;
};

type AnnualAttendanceMonth = {
  month: number;
  days: number;
  attendance: AttendanceEmployee['attendance'];
};

type PlannedDaysOffEmployee = {
  id: number;
  full_name: string;
  dni: string | null;
  file_number: string | null;
  department_id: number | null;
  department_name: string | null;
  planned_days: Record<
    string,
    {
      id: number;
      notes: string | null;
    } | null
  >;
};

type LeaveRequest = {
  id: number;
  employee_id: number;
  full_name: string;
  dni: string | null;
  file_number: string | null;
  hire_date: string | null;
  employment_type: string | null;
  department_name: string | null;
  last_annual_leave_date: string | null;
  code: string;
  description: string;
  start_date: string;
  end_date: string;
  total_days: number;
  total_hours: number;
  balance_allowed_days: number;
  balance_available_before_request: number;
  balance_pending_after_request: number;
  permission_kind: string | null;
  exit_reason: string | null;
  exit_time: string | null;
  return_time: string | null;
  no_return: boolean;
  shift_label: string | null;
  exam_type: string | null;
  is_exception: boolean;
  exception_reason: string | null;
  status: string;
  requested_at: string;
  requested_by: number | null;
  requested_by_name: string | null;
  edited_by?: number | null;
  edited_by_name?: string | null;
  edited_at?: string | null;
  approved_by?: number | null;
  approved_by_name?: string | null;
  approved_at?: string | null;
  rejected_reason?: string | null;
  notes: string | null;
};

type VacationRule = {
  id: number;
  min_years: number;
  max_years: number | null;
  allowed_days: number;
  is_active: boolean;
};

type LeaveRule = {
  id: number;
  attendance_code_id: number;
  code: string;
  description: string;
  name: string;
  min_advance_days: number | null;
  max_days_per_request: number | null;
  max_days_per_year: number | null;
  max_hours_per_day: number | null;
  max_hours_per_week: number | null;
  max_hours_per_month: number | null;
  max_hours_per_year: number | null;
  requires_documentation: boolean;
  requires_medical_order: boolean;
  gender_condition: string;
  seniority_min_years: number | null;
  seniority_max_years: number | null;
  rule_notes: string | null;
  is_active: boolean;
};

type LeaveBalanceAdjustment = {
  id: number;
  employee_id: number;
  full_name: string;
  file_number: string | null;
  department_name: string | null;
  code: string;
  description: string;
  adjustment_date: string | null;
  year: number;
  month: number | null;
  used_days: number;
  used_hours: number;
  notes: string | null;
};

function normalizeSearchText(
  value?: string | null
) {
  return (value || '')
    .toLowerCase()
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesNameSearch(
  fullName: string,
  search: string
) {
  const normalizedName =
    normalizeSearchText(fullName);

  const normalizedSearch =
    normalizeSearchText(search);

  if (!normalizedSearch) {
    return true;
  }

  const invertedName =
    normalizedName
      .split(' ')
      .filter(Boolean)
      .reverse()
      .join(' ');

  return (
    normalizedName.includes(normalizedSearch) ||
    invertedName.includes(normalizedSearch)
  );
}

function showSystemAlert(
  message: string,
  title = 'Aviso del sistema',
  variant: 'error' | 'success' | 'info' = 'error'
) {
  window.dispatchEvent(
    new CustomEvent(
      'hospital-system-alert',
      {
        detail: {
          title,
          message,
          variant
        }
      }
    )
  );
}

type DirectiveSummary = {
  employee: Employee & {
    seniority_years: number;
  };
  period: {
    year: number;
    month: number;
  };
  attendance: {
    totals: Record<string, number>;
    byCode: Array<{
      code: string;
      description: string;
      category: string;
      total: number;
    }>;
  };
  balances: any;
  recentLeaves: LeaveRequest[];
  recentAttendance: AttendanceRecordSummary[];
};

type LeaveRequestGroup = {
  code: string;
  description: string;
  leaves: LeaveRequest[];
};

type AttendanceRecordSummary = {
  id: number;
  attendance_date: string;
  code: string;
  description: string;
  category: string;
  source?: string | null;
  created_at?: string | null;
  created_by_name?: string | null;
};

type AttendanceRecordGroup = {
  code: string;
  description: string;
  category: string;
  records: AttendanceRecordSummary[];
};

type DirectiveKeyCardData = {
  title: string;
  value: string | number;
  detail: string;
  mode: DirectivePrintMode;
};

type DirectivePrintMode =
  | 'all'
  | 'seniority'
  | 'absences'
  | 'leaves'
  | 'vacation'
  | 'code26'
  | 'hours'
  | 'code29'
  | 'compensatory'
  | 'attendance'
  | `attendance:${string}`
  | `leave:${string}`;

type LeaveSummary = {
  vacation: {
    id: number;
    allowed_days: number;
    used_days: number;
    pending_days: number;
    remaining_days: number;
    available_days: number;
  };
  code26: {
    annual_limit_days: number;
    used_days: number;
    pending_days: number;
    remaining_days: number;
    used_this_month: number;
    remaining_this_month: number;
  };
  hours24_43: {
    annual_limit_hours: number;
    monthly_limit_hours: number;
    used_hours_year: number;
    pending_hours_year: number;
    remaining_hours_year: number;
    used_hours_month: number;
    pending_hours_month: number;
    remaining_hours_month: number;
  };
  code29: {
    allowed_days: number;
    used_days: number;
    pending_days: number;
    remaining_days: number;
  };
  compensatory: {
    earned_days: number;
    used_days: number;
    pending_days: number;
    remaining_days: number;
  };
};

const workShiftLabels: Record<string, string> = {
  manana: 'Mañana',
  tarde: 'Tarde',
  vespertino: 'Vespertino',
  noche: 'Noche'
};

const workShiftOptions = [
  'manana',
  'tarde',
  'vespertino',
  'noche'
];

function formatEmployeeShift(
  employee: Pick<Employee, 'work_shift' | 'shift_start_time' | 'shift_end_time'>
) {
  const shift =
    employee.work_shift
      ? workShiftLabels[employee.work_shift] || employee.work_shift
      : '';

  const hours =
    employee.shift_start_time && employee.shift_end_time
      ? `${employee.shift_start_time} a ${employee.shift_end_time}`
      : employee.shift_start_time
        ? `Entrada ${employee.shift_start_time}`
        : employee.shift_end_time
          ? `Salida ${employee.shift_end_time}`
          : '';

  return [shift, hours]
    .filter(Boolean)
    .join(' - ') || '-';
}

function formatEmployeeLeaveSchedule(
  employee?: Pick<Employee, 'work_shift' | 'shift_start_time' | 'shift_end_time'> | null
) {
  if (!employee) {
    return 'Seleccione un empleado para ver su turno y horario.';
  }

  return [
    `Turno: ${
      employee.work_shift
        ? workShiftLabels[employee.work_shift] || employee.work_shift
        : 'Sin cargar'
    }`,
    `Entrada: ${employee.shift_start_time || 'Sin cargar'}`,
    `Salida: ${employee.shift_end_time || 'Sin cargar'}`
  ].join(' | ');
}

function getEmployeeWorkShiftLabel(
  employee?: Pick<Employee, 'work_shift'> | null
) {
  return employee?.work_shift
    ? workShiftLabels[employee.work_shift] || ''
    : '';
}

function timeToMinutes(
  value?: string | null
) {
  if (!value) {
    return null;
  }

  const [
    hours,
    minutes
  ] =
    value.split(':').map(Number);

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes)
  ) {
    return null;
  }

  return hours * 60 + minutes;
}

function roundClockMinutes(
  totalMinutes: number
) {
  const hours =
    Math.floor(totalMinutes / 60);

  const minutes =
    totalMinutes % 60;

  if (minutes <= 15) {
    return hours * 60;
  }

  if (minutes <= 45) {
    return hours * 60 + 30;
  }

  return (hours + 1) * 60;
}

function formatAutoHours(
  hours: number
) {
  return Number.isInteger(hours)
    ? String(hours)
    : String(hours);
}

function calculateLateArrivalHours(
  scheduledStart?: string | null,
  arrivalTime?: string | null
) {
  const start =
    timeToMinutes(scheduledStart);

  const arrival =
    timeToMinutes(arrivalTime);

  if (start === null || arrival === null) {
    return '';
  }

  const normalizedArrival =
    arrival < start && start >= 12 * 60
      ? arrival + 24 * 60
      : arrival;

  return formatAutoHours(
    Math.max(
      0,
      (roundClockMinutes(normalizedArrival) - start) / 60
    )
  );
}

function calculateEarlyExitHours(
  scheduledStart?: string | null,
  scheduledEnd?: string | null,
  exitTime?: string | null
) {
  const start =
    timeToMinutes(scheduledStart);

  const end =
    timeToMinutes(scheduledEnd);

  const exit =
    timeToMinutes(exitTime);

  if (start === null || end === null || exit === null) {
    return '';
  }

  const shiftEnd =
    end <= start
      ? end + 24 * 60
      : end;

  const shiftExit =
    end <= start && exit < start
      ? exit + 24 * 60
      : exit;

  return formatAutoHours(
    Math.max(
      0,
      (shiftEnd - roundClockMinutes(shiftExit)) / 60
    )
  );
}

function calculateReturnPermissionHours(
  exitTime?: string | null,
  returnTime?: string | null
) {
  const exit =
    timeToMinutes(exitTime);

  const returnMinutes =
    timeToMinutes(returnTime);

  if (exit === null || returnMinutes === null) {
    return '';
  }

  const roundedExit =
    roundClockMinutes(exit);

  const roundedReturn =
    roundClockMinutes(returnMinutes);

  const normalizedReturn =
    roundedReturn < roundedExit
      ? roundedReturn + 24 * 60
      : roundedReturn;

  return formatAutoHours(
    Math.max(
      0,
      (normalizedReturn - roundedExit) / 60
    )
  );
}

const emptyEmployee = {
  facility_id: '',
  department_id: '',
  full_name: '',
  dni: '',
  cuil: '',
  birth_date: '',
  hire_date: '',
  file_number: '',
  address: '',
  phone: '',
  email: '',
  license_number: '',
  employment_type: '',
  work_shift: '',
  shift_start_time: '',
  shift_end_time: '',
  is_professional: false,
  notes: ''
};

const emptyLeaveForm = {
  employee_id: '',
  code: '8',
  start_date: '',
  end_date: '',
  total_hours: '',
  permission_kind: 'salida',
  exit_reason: 'particular',
  exit_time: '',
  return_time: '',
  no_return: false,
  shift_label: '',
  exam_type: '',
  is_exception: false,
  exception_reason: '',
  notes: ''
};

const emptyVacationRuleForm = {
  min_years: '',
  max_years: '',
  allowed_days: '',
  is_active: true
};

const emptyBalanceAdjustmentForm = {
  employee_id: '',
  code: '8',
  adjustment_date: '',
  year: String(new Date().getFullYear()),
  month: '',
  allowed_days: '',
  used_days: '',
  used_hours: '',
  notes: ''
};

const balanceManagedCodes = [
  '8',
  '29',
  '26',
  '24',
  '43',
  '34',
  'C'
];

const emptyCodeForm = {
  code: '',
  description: '',
  category: 'otro',
  counts_as_present: false,
  requires_approval: false,
  requires_documentation: false,
  affects_salary: false,
  annual_limit_days: '',
  advance_notice_days: '',
  is_active: true
};

const codeCategories = [
  'presente',
  'ausencia',
  'franco',
  'licencia',
  'vacaciones',
  'maternidad',
  'gremial',
  'otro'
];

const leaveCodeOptions = [
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
];

const attendanceCodesOnlyFromLeaves =
  new Set(leaveCodeOptions);

const leaveRuleSummaryCards = [
  {
    title: 'Reglas duras',
    text: 'Se validan en el servidor antes de guardar. Si una regla falla, la licencia no se registra.'
  },
  {
    title: 'Presentismo',
    text: 'Las claves de licencia no se cargan manualmente en presentismo. Deben salir desde Licencias.'
  },
  {
    title: 'Excepciones',
    text: 'Algunas claves permiten excepcion, pero queda registrada la marca y el motivo.'
  }
];

const singleDayLeaveCodes =
  new Set([
    '24',
    '26',
    '33',
    '35',
    '43',
    '46'
  ]);

function isSingleDayLeaveCode(
  code: string
) {
  return singleDayLeaveCodes.has(
    String(code || '')
      .trim()
      .toUpperCase()
  );
}

function toDateInput(
  value: string | null
) {

  if (!value) {
    return '';
  }

  return String(value)
    .slice(0, 10);
}

function getSeniority(
  hireDate: string | null
) {

  if (!hireDate) {
    return 'Sin fecha';
  }

  const start =
    new Date(hireDate);

  const now =
    new Date();

  let years =
    now.getFullYear() -
    start.getFullYear();

  let months =
    now.getMonth() -
    start.getMonth();

  if (now.getDate() < start.getDate()) {
    months -= 1;
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  if (years <= 0 && months <= 0) {
    return 'Menos de 1 mes';
  }

  return `${years} años, ${months} meses`;
}


function formatLocalDate(
  date: Date
) {

  const year =
    date.getFullYear();

  const month =
    String(date.getMonth() + 1)
      .padStart(2, '0');

  const day =
    String(date.getDate())
      .padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function addCalendarDays(
  value: string,
  days: number
) {

  const date =
    new Date(`${value}T00:00:00`);

  date.setDate(
    date.getDate() + days
  );

  return formatLocalDate(date);
}

function addBusinessDays(
  value: string,
  businessDays: number
) {

  const date =
    new Date(`${value}T00:00:00`);

  let counted = 1;

  while (counted < businessDays) {
    date.setDate(
      date.getDate() + 1
    );

    const day =
      date.getDay();

    if (day !== 0 && day !== 6) {
      counted += 1;
    }
  }

  return formatLocalDate(date);
}

const printableLeaveCodes =
  ['24', '43', '26', '8', '29', '14', '15', '16', '17', '18'];

const ministryLeaveCodes =
  ['8', '29', '14', '15', '16', '17', '18'];

const examLicenseOptions = [
  'Universitario, post grado o terciario',
  'Curso preparatorio',
  'Secundario',
  'Primario',
  'Practicas obligatorias',
  'Ultima materia de nivel universitario, terciario o tesis profesional'
];

function isPrintableLeaveCode(
  code: string
) {

  return printableLeaveCodes.includes(code);
}

function isMinistryLeaveCode(
  code: string
) {

  return ministryLeaveCodes.includes(code);
}

function getAutomaticEndDate(
  code: string,
  startDate: string
) {

  if (!startDate) {
    return '';
  }

  const rules: Record<
    string,
    {
      days: number;
      business: boolean;
    }
  > = {
    '14': {
      days: 5,
      business: false
    },
    '15': {
      days: 1,
      business: false
    },
    '16': {
      days: 10,
      business: false
    },
    '17': {
      days: 2,
      business: false
    },
    '18': {
      days: 1,
      business: false
    },
    '31': {
      days: 3,
      business: false
    },
    '33': {
      days: 1,
      business: false
    }
  };

  const rule =
    rules[code];

  if (!rule) {
    return '';
  }

  return rule.business
    ? addBusinessDays(
      startDate,
      rule.days
    )
    : addCalendarDays(
      startDate,
      rule.days - 1
    );
}

export default function PersonnelPage() {

  const { user } = useAuth();
  const location = useLocation();

  const isPersonnelSettingsPage =
    location.pathname.startsWith('/personnel/settings');

  const canManageEmployees =
    hasPermission(
      user,
      'personnel.employees.manage',
      ['admin', 'user', 'dir']
    );

  const canManageAttendance =
    hasPermission(
      user,
      'personnel.attendance.manage',
      ['admin', 'user', 'dir']
    );

  const canManageLeaves =
    hasPermission(
      user,
      'personnel.leaves.manage',
      ['admin', 'user', 'dir']
    );

  const canApproveLeaves =
    hasPermission(
      user,
      'personnel.leaves.approve',
      ['admin', 'dir']
    );

  const canEditApprovedLeaves =
    user?.role === 'admin' ||
    user?.role === 'dir';

  const canRevertCancelledLeaves =
    user?.role === 'admin';

  function canEditLeaveRequest(
    request: LeaveRequest
  ) {
    if (!canManageLeaves) {
      return false;
    }

    if (
      request.status === 'cancelado' ||
      request.status === 'rechazado'
    ) {
      return false;
    }

    if (request.status === 'aprobado') {
      return canEditApprovedLeaves;
    }

    return true;
  }

  const canManageBalances =
    hasPermission(
      user,
      'personnel.balances.manage',
      ['admin', 'dir']
    );

  const canManageSettings =
    hasPermission(
      user,
      'personnel.settings.manage',
      ['admin', 'dir']
    );

  const hasAnyPersonnelManagePermission =
    canManageEmployees ||
    canManageAttendance ||
    canManageLeaves ||
    canApproveLeaves ||
    canManageBalances ||
    canManageSettings;

  const attendanceReadOnly =
    !canManageAttendance;

  const readOnly =
    !hasAnyPersonnelManagePermission;

  const canSelectFacility =
    user?.role === 'admin' ||
    Boolean(user?.access_all_facilities) ||
    user?.facility_type === 'secretaria' ||
    Number(user?.facility_ids?.length || 0) > 1 ||
    !user?.facility_id;

  const defaultFacilityId =
    user?.facility_id
      ? String(user.facility_id)
      : '';

  function departmentsForFacility(
    facilityId: string
  ) {
    if (!facilityId || facilityId === 'todos') {
      return departments;
    }

    return departments.filter((department) =>
      String(department.facility_id || '') === facilityId
    );
  }

  const [activeTab, setActiveTab] =
    useState(() =>
      isPersonnelSettingsPage
        ? (
          canManageSettings
            ? 'departments'
            : canManageBalances
              ? 'balance-adjustments'
              : 'no-access'
        )
        : 'employees'
    );

  const [employees, setEmployees] =
    useState<Employee[]>([]);

  const [employeeList, setEmployeeList] =
    useState<Employee[]>([]);

  const [facilities, setFacilities] =
    useState<Facility[]>([]);

  const [employeePagination, setEmployeePagination] =
    useState({
      page: 1,
      per_page: 25,
      total: 0,
      total_pages: 1
    });

  const [departments, setDepartments] =
    useState<Department[]>([]);

  const [codes, setCodes] =
    useState<AttendanceCode[]>([]);

  const [attendanceRows, setAttendanceRows] =
    useState<AttendanceEmployee[]>([]);

  const [attendanceDays, setAttendanceDays] =
    useState(0);

  const [attendanceViewMode, setAttendanceViewMode] =
    useState<'month' | 'employee'>('month');

  const attendanceGridRef =
    useRef<HTMLDivElement | null>(null);

  const [attendanceFilters, setAttendanceFilters] =
    useState(() => {

      const now =
        new Date();
      const yesterday =
        new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() - 1
        );

      return {
        year: String(now.getFullYear()),
        month: String(now.getMonth() + 1),
        day: String(
          now.getDate() === 1
            ? 1
            : yesterday.getDate()
        ),
        department: 'todos',
        facility_id: defaultFacilityId || 'todos',
        departmentSearch: '',
        search: ''
      };
    });

  const [attendanceEdits, setAttendanceEdits] =
    useState<Record<string, string>>({});

  const [attendanceCompensatoryEdits, setAttendanceCompensatoryEdits] =
    useState<Record<string, number>>({});

  const [annualAttendanceEmployeeId, setAnnualAttendanceEmployeeId] =
    useState('');

  const [annualAttendanceEmployeeSearch, setAnnualAttendanceEmployeeSearch] =
    useState('');

  const [annualAttendanceEmployee, setAnnualAttendanceEmployee] =
    useState<AttendanceEmployee | null>(null);

  const [annualAttendanceMonths, setAnnualAttendanceMonths] =
    useState<AnnualAttendanceMonth[]>([]);

  const [annualAttendanceEdits, setAnnualAttendanceEdits] =
    useState<Record<string, string>>({});

  const [annualAttendanceCompensatoryEdits, setAnnualAttendanceCompensatoryEdits] =
    useState<Record<string, number>>({});

  const [compensatoryPrompt, setCompensatoryPrompt] =
    useState<{
      mode: 'month' | 'annual';
      key: string;
      employeeName: string;
      dayLabel: string;
    } | null>(null);

  const [loadingAnnualAttendance, setLoadingAnnualAttendance] =
    useState(false);

  const [plannedOffRows, setPlannedOffRows] =
    useState<PlannedDaysOffEmployee[]>([]);

  const [plannedOffDays, setPlannedOffDays] =
    useState(0);

  const [plannedOffEdits, setPlannedOffEdits] =
    useState<Record<string, boolean>>({});

  const [savingPlannedOff, setSavingPlannedOff] =
    useState(false);

  const [savingAttendance, setSavingAttendance] =
    useState(false);

  const [leaveRequests, setLeaveRequests] =
    useState<LeaveRequest[]>([]);

  const [printLeaveRequest, setPrintLeaveRequest] =
    useState<LeaveRequest | null>(null);

  const [printLeaveSummary, setPrintLeaveSummary] =
    useState(false);

  const [directivePrintMode, setDirectivePrintMode] =
    useState<DirectivePrintMode | null>(null);

  const [printDirectiveLeaves, setPrintDirectiveLeaves] =
    useState(false);

  const [printDirectiveAttendance, setPrintDirectiveAttendance] =
    useState(false);

  const [returnLeaveRequest, setReturnLeaveRequest] =
    useState<LeaveRequest | null>(null);

  const [returnForm, setReturnForm] =
    useState({
      return_time: '',
      total_hours: ''
    });

  const [leaveForm, setLeaveForm] =
    useState(emptyLeaveForm);

  const [editingLeaveRequest, setEditingLeaveRequest] =
    useState<LeaveRequest | null>(null);

  const [vacationRules, setVacationRules] =
    useState<VacationRule[]>([]);

  const [leaveRules, setLeaveRules] =
    useState<LeaveRule[]>([]);

  const [editingLeaveRuleId, setEditingLeaveRuleId] =
    useState<number | null>(null);

  const [vacationYear] =
    useState(String(new Date().getFullYear()));

  const [vacationRuleForm, setVacationRuleForm] =
    useState(emptyVacationRuleForm);

  const [selectedLeaveEmployee, setSelectedLeaveEmployee] =
    useState<Employee | null>(null);

  const [leaveEmployeeSearch, setLeaveEmployeeSearch] =
    useState('');

  const [leaveRequestYearFilter, setLeaveRequestYearFilter] =
    useState('todos');

  const [leaveEmployeePage, setLeaveEmployeePage] =
    useState(0);

  const [leaveSummary, setLeaveSummary] =
    useState<LeaveSummary | null>(null);

  const [leaveRequestFilters, setLeaveRequestFilters] =
    useState({
      search: '',
      status: 'pendiente',
      code: 'todos'
    });

  const [balanceAdjustments, setBalanceAdjustments] =
    useState<LeaveBalanceAdjustment[]>([]);

  const [balanceAdjustmentForm, setBalanceAdjustmentForm] =
    useState(emptyBalanceAdjustmentForm);

  const [selectedBalanceEmployee, setSelectedBalanceEmployee] =
    useState<Employee | null>(null);

  const [balanceEmployeeSearch, setBalanceEmployeeSearch] =
    useState('');

  const [balanceSummary, setBalanceSummary] =
    useState<LeaveSummary | null>(null);

  const [codeForm, setCodeForm] =
    useState(emptyCodeForm);

  const [employeeForm, setEmployeeForm] =
    useState(emptyEmployee);

  const [editingEmployee, setEditingEmployee] =
    useState<Employee | null>(null);

  const [showEmployeeFormModal, setShowEmployeeFormModal] =
    useState(false);

  const [showLeaveFormModal, setShowLeaveFormModal] =
    useState(false);

  const [departmentForm, setDepartmentForm] =
    useState({
      facility_id: defaultFacilityId,
      name: '',
      description: ''
    });

  const [filters, setFilters] =
    useState({
      search: '',
      facility_id: defaultFacilityId || 'todos',
      department: 'todos',
      status: 'todos',
      page: 1,
      per_page: 25
    });

  const [error, setError] =
    useState('');

  const [directiveSummary, setDirectiveSummary] =
    useState<DirectiveSummary | null>(null);

  const [loadingDirectiveSummary, setLoadingDirectiveSummary] =
    useState(false);

  useEffect(() => {
    const settingsTabs = [
      'departments',
      'codes',
      'leave-rules',
      'vacation-rules',
      'balance-adjustments'
    ];

    const dailyTabs = [
      'employees',
      'attendance',
      'planned-days-off',
      'leaves',
      'leave-requests'
    ];

    if (
      isPersonnelSettingsPage &&
      !settingsTabs.includes(activeTab)
    ) {
      setActiveTab(
        canManageSettings
          ? 'departments'
          : canManageBalances
            ? 'balance-adjustments'
            : 'no-access'
      );
      return;
    }

    if (
      !isPersonnelSettingsPage &&
      !dailyTabs.includes(activeTab)
    ) {
      setActiveTab('employees');
    }
  }, [
    activeTab,
    canManageBalances,
    canManageSettings,
    isPersonnelSettingsPage
  ]);

  async function loadData() {

    try {

      const [
        employeesRes,
        departmentsRes,
        codesRes,
        facilitiesRes,
        leaveRulesRes
      ] = await Promise.all([
        apiFetch('/personnel/employees'),
        apiFetch('/personnel/departments'),
        apiFetch('/personnel/attendance-codes'),
        apiFetch('/health-facilities'),
        apiFetch('/personnel/leave-rules')
          .catch(() => ({
            data: []
          }))
      ]);

      setEmployees(employeesRes.data);
      setDepartments(departmentsRes.data);
      setCodes(codesRes.data);
      setFacilities(facilitiesRes.data);
      setLeaveRules(leaveRulesRes.data);

    } catch (error: any) {

      setError(error.message);
      showSystemAlert(error.message);
    }
  }

  async function loadEmployeeList() {

    try {
      const params =
        new URLSearchParams();

      Object.entries(filters).forEach(([key, value]) => {
        if (
          value !== '' &&
          value !== null &&
          value !== undefined &&
          value !== 'todos'
        ) {
          params.set(key, String(value));
        }
      });

      const res =
        await apiFetch(
          `/personnel/employees?${params.toString()}`
        );

      setEmployeeList(res.data);
      setEmployeePagination(
        res.pagination || {
          page: 1,
          per_page: filters.per_page,
          total: res.data.length,
          total_pages: 1
        }
      );
    } catch (error: any) {
      setError(error.message);
    }
  }

  async function loadAttendance() {

    try {

      const params =
        new URLSearchParams({
          year: attendanceFilters.year,
          month: attendanceFilters.month
        });

      if (attendanceFilters.department !== 'todos') {
        params.set(
          'department_id',
          attendanceFilters.department
        );
      }

      if (attendanceFilters.facility_id !== 'todos') {
        params.set(
          'facility_id',
          attendanceFilters.facility_id
        );
      }

      const attendanceRes =
        await apiFetch(
          `/personnel/attendance?${params.toString()}`
        );

      setAttendanceRows(
        attendanceRes.data.employees
      );
      setAttendanceDays(
        attendanceRes.data.days
      );
      setAttendanceEdits({});

    } catch (error: any) {

      setError(error.message);
    }
  }

  async function loadAnnualAttendance(
    employeeId = annualAttendanceEmployeeId
  ) {

    if (!employeeId) {
      setAnnualAttendanceEmployee(null);
      setAnnualAttendanceMonths([]);
      setAnnualAttendanceEdits({});
      return;
    }

    setLoadingAnnualAttendance(true);
    setError('');

    try {
      const params =
        new URLSearchParams({
          year: attendanceFilters.year,
          employee_id: employeeId
        });

      if (attendanceFilters.facility_id !== 'todos') {
        params.set(
          'facility_id',
          attendanceFilters.facility_id
        );
      }

      const attendanceRes =
        await apiFetch(
          `/personnel/attendance/employee-year?${params.toString()}`
        );

      setAnnualAttendanceEmployee(
        attendanceRes.data.employee
      );
      setAnnualAttendanceMonths(
        attendanceRes.data.months
      );
      setAnnualAttendanceEdits({});

    } catch (error: any) {
      setError(error.message);
      showSystemAlert(error.message);
    } finally {
      setLoadingAnnualAttendance(false);
    }
  }

  function openEmployeeAttendance(
    employee: Pick<Employee, 'id' | 'full_name'>
  ) {
    if (!confirmDiscardAttendanceChanges()) {
      return;
    }

    const employeeId =
      String(employee.id);

    setActiveTab('attendance');
    setAttendanceViewMode('employee');
    setAnnualAttendanceEmployeeId(employeeId);
    setAnnualAttendanceEmployeeSearch(employee.full_name);
    setAnnualAttendanceEdits({});
    loadAnnualAttendance(employeeId);
  }

  async function loadPlannedDaysOff() {

    try {
      const params =
        new URLSearchParams({
          year: attendanceFilters.year,
          month: attendanceFilters.month
        });

      if (attendanceFilters.department !== 'todos') {
        params.set(
          'department_id',
          attendanceFilters.department
        );
      }

      if (attendanceFilters.facility_id !== 'todos') {
        params.set(
          'facility_id',
          attendanceFilters.facility_id
        );
      }

      const res =
        await apiFetch(
          `/personnel/planned-days-off?${params.toString()}`
        );

      setPlannedOffRows(res.data.employees);
      setPlannedOffDays(res.data.days);
      setPlannedOffEdits({});
    } catch (error: any) {
      setError(error.message);
      showSystemAlert(error.message);
    }
  }

  async function loadDirectiveSummary(
    employee: Employee
  ) {

    try {

      setLoadingDirectiveSummary(true);
      setError('');

      const now =
        new Date();

      const res =
        await apiFetch(
          `/personnel/employees/${employee.id}/directive-summary?year=${now.getFullYear()}&month=${now.getMonth() + 1}`
        );

      setDirectiveSummary(res.data);

    } catch (error: any) {

      setError(error.message);

    } finally {

      setLoadingDirectiveSummary(false);
    }
  }

  function handleEmployeeChange(
    e: React.ChangeEvent<
      HTMLInputElement |
      HTMLSelectElement |
      HTMLTextAreaElement
    >
  ) {

    const target =
      e.target as HTMLInputElement;

    if (target.name === 'facility_id') {
      setEmployeeForm({
        ...employeeForm,
        facility_id: target.value,
        department_id: ''
      });
      return;
    }

    setEmployeeForm({
      ...employeeForm,
      [target.name]:
        target.type === 'checkbox'
          ? target.checked
          : target.value
    });
  }

  function resetEmployeeForm() {

    setEditingEmployee(null);
    setEmployeeForm(emptyEmployee);
    setShowEmployeeFormModal(false);
  }

  function startEditEmployee(
    employee: Employee
  ) {

    setEditingEmployee(employee);
    setEmployeeForm({
      facility_id:
        employee.facility_id
          ? String(employee.facility_id)
          : defaultFacilityId,
      department_id:
        employee.department_id
          ? String(employee.department_id)
          : '',
      full_name: employee.full_name,
      dni: employee.dni || '',
      cuil: employee.cuil || '',
      birth_date:
        toDateInput(employee.birth_date),
      hire_date:
        toDateInput(employee.hire_date),
      file_number:
        employee.file_number || '',
      address:
        employee.address || '',
      phone:
        employee.phone || '',
      email:
        employee.email || '',
      license_number:
        employee.license_number || '',
      employment_type:
        employee.employment_type || '',
      work_shift:
        employee.work_shift || '',
      shift_start_time:
        employee.shift_start_time || '',
      shift_end_time:
        employee.shift_end_time || '',
      is_professional:
        employee.is_professional,
      notes:
        employee.notes || ''
    });
    setShowEmployeeFormModal(true);
  }

  async function handleEmployeeSubmit(
    e: React.FormEvent
  ) {

    e.preventDefault();
    setError('');

    try {

      await apiFetch(
        editingEmployee
          ? `/personnel/employees/${editingEmployee.id}`
          : '/personnel/employees',
        {
          method:
            editingEmployee
              ? 'PUT'
              : 'POST',
          body:
            JSON.stringify({
              ...employeeForm,
              facility_id:
                employeeForm.facility_id
                  ? Number(employeeForm.facility_id)
                  : defaultFacilityId
                    ? Number(defaultFacilityId)
                    : null,
              department_id:
                employeeForm.department_id
                  ? Number(employeeForm.department_id)
                  : null
            })
        }
      );

      resetEmployeeForm();
      await Promise.all([
        loadData(),
        loadEmployeeList()
      ]);

    } catch (error: any) {

      setError(error.message);
    }
  }

  async function handleToggleEmployee(
    id: number
  ) {

    await apiFetch(
      `/personnel/employees/${id}/status`,
      {
        method: 'PATCH'
      }
    );

    await Promise.all([
      loadData(),
      loadEmployeeList()
    ]);
  }

  async function handleDepartmentSubmit(
    e: React.FormEvent
  ) {

    e.preventDefault();
    setError('');

    try {

      await apiFetch(
        '/personnel/departments',
        {
          method: 'POST',
          body:
            JSON.stringify({
              ...departmentForm,
              facility_id:
                departmentForm.facility_id
                  ? Number(departmentForm.facility_id)
                  : defaultFacilityId
                    ? Number(defaultFacilityId)
                    : null
            })
        }
      );

      setDepartmentForm({
        facility_id:
          departmentForm.facility_id ||
          defaultFacilityId,
        name: '',
        description: ''
      });

      loadData();

    } catch (error: any) {

      setError(error.message);
    }
  }

  function handleCodeFormChange(
    e: React.ChangeEvent<
      HTMLInputElement |
      HTMLSelectElement
    >
  ) {

    const target =
      e.target as HTMLInputElement;

    setCodeForm({
      ...codeForm,
      [target.name]:
        target.type === 'checkbox'
          ? target.checked
          : target.value
    });
  }

  async function handleCodeSubmit(
    e: React.FormEvent
  ) {

    e.preventDefault();
    setError('');

    try {

      await apiFetch(
        '/personnel/attendance-codes',
        {
          method: 'POST',
          body:
            JSON.stringify({
              ...codeForm,
              annual_limit_days:
                codeForm.annual_limit_days
                  ? Number(codeForm.annual_limit_days)
                  : null,
              advance_notice_days:
                codeForm.advance_notice_days
                  ? Number(codeForm.advance_notice_days)
                  : null
            })
        }
      );

      setCodeForm(emptyCodeForm);
      loadData();

    } catch (error: any) {

      setError(error.message);
    }
  }

  async function updateCode(
    code: AttendanceCode,
    data: Partial<AttendanceCode>
  ) {

    setError('');

    try {

      await apiFetch(
        `/personnel/attendance-codes/${code.id}`,
        {
          method: 'PUT',
          body:
            JSON.stringify({
              ...code,
              ...data
            })
        }
      );

      loadData();

    } catch (error: any) {

      setError(error.message);
    }
  }

  async function loadLeaveRequests() {

    try {
      const params =
        new URLSearchParams();

      if (filters.facility_id !== 'todos') {
        params.set(
          'facility_id',
          filters.facility_id
        );
      }

      const res =
        await apiFetch(
          `/personnel/leave-requests?${params.toString()}`
        );

      setLeaveRequests(res.data);

    } catch (error: any) {

      setError(error.message);
    }
  }

  async function loadVacationData() {

    try {

      const rulesRes =
        await apiFetch(
          '/personnel/vacation-rules'
        );

      setVacationRules(rulesRes.data);

    } catch (error: any) {

      setError(error.message);
    }
  }

  async function loadBalanceAdjustments() {

    try {

      const res =
        await apiFetch(
          '/personnel/leave-balance-adjustments'
        );

      setBalanceAdjustments(res.data);

    } catch (error: any) {

      setError(error.message);
    }
  }

  async function loadLeaveSummary(
    employeeId: number
  ) {

    try {

      const now =
        new Date();

      const res =
        await apiFetch(
          `/personnel/employees/${employeeId}/leave-summary?year=${vacationYear}&month=${now.getMonth() + 1}`
        );

      setLeaveSummary(res.data);

    } catch (error: any) {

      setError(error.message);
    }
  }

  async function loadBalanceSummary(
    employeeId: number,
    year = balanceAdjustmentForm.year
  ) {

    try {
      const currentMonth =
        String(new Date().getMonth() + 1);

      const params =
        new URLSearchParams({
          year:
            year || String(new Date().getFullYear()),
          month: currentMonth
        });

      const res =
        await apiFetch(
          `/personnel/employees/${employeeId}/leave-summary?${params.toString()}`
        );

      setBalanceSummary(res.data);

    } catch (error: any) {

      setError(error.message);
    }
  }

  function selectBalanceEmployee(
    employee: Employee
  ) {

    setSelectedBalanceEmployee(employee);
      setBalanceAdjustmentForm((current) => ({
        ...current,
        employee_id: String(employee.id),
        allowed_days: '',
        used_days: '',
        used_hours: '',
        notes: ''
      }));
    loadBalanceSummary(employee.id);
  }

  function selectLeaveEmployee(
    employee: Employee
  ) {

    const nextForm: any = {
      ...leaveForm,
      employee_id: String(employee.id),
      shift_label:
        leaveForm.code === '26'
          ? getEmployeeWorkShiftLabel(employee)
          : leaveForm.shift_label
    };

    if (leaveForm.code === '24') {
      nextForm.total_hours =
        calculateLateArrivalHours(
          employee.shift_start_time,
          leaveForm.exit_time
        );
    }

    if (
      leaveForm.code === '43' &&
      leaveForm.no_return
    ) {
      nextForm.total_hours =
        calculateEarlyExitHours(
          employee.shift_start_time,
          employee.shift_end_time,
          leaveForm.exit_time
        );
    }

    setSelectedLeaveEmployee(employee);
    setEditingLeaveRequest(null);
    setLeaveForm(nextForm);
    loadLeaveSummary(employee.id);
  }

  function clearSelectedLeaveEmployee() {
    setSelectedLeaveEmployee(null);
    setLeaveSummary(null);
    setEditingLeaveRequest(null);
    setLeaveRequestYearFilter('todos');
    setLeaveForm(emptyLeaveForm);
  }

  function resetLeaveForm() {

    setEditingLeaveRequest(null);
    setShowLeaveFormModal(false);

    setLeaveForm({
      ...emptyLeaveForm,
      employee_id:
        selectedLeaveEmployee
          ? String(selectedLeaveEmployee.id)
          : ''
    });
  }

  function startEditLeaveRequest(
    request: LeaveRequest
  ) {

    const employee =
      employees.find((item) =>
        item.id === request.employee_id
      );

    if (employee) {
      setSelectedLeaveEmployee(employee);
      loadLeaveSummary(employee.id);
    } else {
      setSelectedLeaveEmployee({
        id: request.employee_id,
        facility_id: null,
        facility_name: null,
        facility_type: null,
        department_id: null,
        department_name: request.department_name,
        full_name: request.full_name,
        dni: request.dni,
        cuil: null,
        birth_date: null,
        hire_date: request.hire_date,
        file_number: request.file_number,
        address: null,
        phone: null,
        email: null,
        license_number: null,
        employment_type: request.employment_type,
        work_shift: null,
        shift_start_time: null,
        shift_end_time: null,
        is_professional: false,
        notes: null,
        is_active: true
      });
      loadLeaveSummary(request.employee_id);
    }

    setEditingLeaveRequest(request);
    setShowLeaveFormModal(true);
    setActiveTab('leaves');
    setLeaveForm({
      employee_id: String(request.employee_id),
      code: request.code,
      start_date: toDateInput(request.start_date),
      end_date: toDateInput(request.end_date),
      total_hours:
        request.total_hours
          ? String(request.total_hours)
          : '',
      permission_kind:
        request.permission_kind || 'salida',
      exit_reason:
        request.exit_reason || 'particular',
      exit_time:
        request.exit_time || '',
      return_time:
        request.return_time || '',
      no_return:
        Boolean(request.no_return),
      shift_label:
        request.shift_label ||
        (
          request.code === '26'
            ? getEmployeeWorkShiftLabel(employee)
            : ''
        ),
      exam_type:
        request.exam_type || '',
      is_exception:
        Boolean(request.is_exception),
      exception_reason:
        request.exception_reason || '',
      notes:
        request.notes || ''
    });
  }

  function handleLeaveChange(
    e: React.ChangeEvent<
      HTMLInputElement |
      HTMLSelectElement |
      HTMLTextAreaElement
    >
  ) {

    const target =
      e.target as HTMLInputElement;

    const nextForm: any = {
      ...leaveForm,
      [target.name]:
        target.type === 'checkbox'
          ? target.checked
          : target.value
    };

    const nextCode =
      target.name === 'code'
        ? target.value
        : nextForm.code;

    if (
      target.name === 'code' &&
      target.value === '26'
    ) {
      nextForm.shift_label =
        getEmployeeWorkShiftLabel(selectedLeaveEmployee);
    }

    if (
      target.name === 'code' &&
      target.value !== '26'
    ) {
      nextForm.shift_label = '';
    }

    if (
      nextCode === '24' &&
      (
        target.name === 'code' ||
        target.name === 'exit_time'
      )
    ) {
      nextForm.total_hours =
        calculateLateArrivalHours(
          selectedLeaveEmployee?.shift_start_time,
          nextForm.exit_time
        );
    }

    if (
      nextCode === '43' &&
      nextForm.no_return &&
      (
        target.name === 'code' ||
        target.name === 'exit_time' ||
        target.name === 'no_return'
      )
    ) {
      nextForm.total_hours =
        calculateEarlyExitHours(
          selectedLeaveEmployee?.shift_start_time,
          selectedLeaveEmployee?.shift_end_time,
          nextForm.exit_time
        );
    }

    if (
      nextCode === '43' &&
      !nextForm.no_return &&
      target.name === 'no_return'
    ) {
      nextForm.total_hours = '';
    }

    const nextStartDate =
      target.name === 'start_date'
        ? target.value
        : nextForm.start_date;

    if (
      isSingleDayLeaveCode(nextCode)
    ) {
      nextForm.end_date =
        nextStartDate || '';
    }

    const automaticEndDate =
      getAutomaticEndDate(
        nextCode,
        nextStartDate
      );

    if (
      automaticEndDate &&
      !isSingleDayLeaveCode(nextCode) &&
      (
        target.name === 'code' ||
        target.name === 'start_date'
      )
    ) {
      nextForm.end_date =
        automaticEndDate;
    }

    if (
      !automaticEndDate &&
      !isSingleDayLeaveCode(nextCode) &&
      nextStartDate &&
      !nextForm.end_date &&
      (
        target.name === 'code' ||
        target.name === 'start_date'
      )
    ) {
      nextForm.end_date =
        nextStartDate;
    }

    const hasVacationPart =
      Number(leaveSummary?.vacation.used_days || 0) > 0 ||
      Number(leaveSummary?.vacation.pending_days || 0) > 0;

    const availableVacationDays =
      Math.trunc(
        Number(leaveSummary?.vacation.available_days || 0)
      );

    if (
      nextCode === '8' &&
      nextStartDate &&
      hasVacationPart &&
      availableVacationDays > 0
    ) {
      nextForm.end_date =
        addCalendarDays(
          nextStartDate,
          availableVacationDays - 1
        );
    }

    const availableCode29Days =
      Math.trunc(
        Number(leaveSummary?.code29.remaining_days || 0)
      );

    if (
      nextCode === '29' &&
      nextStartDate &&
      availableCode29Days > 0
    ) {
      nextForm.end_date =
        addCalendarDays(
          nextStartDate,
          availableCode29Days - 1
        );
    }

    setLeaveForm({
      ...nextForm
    });
  }

  async function handleLeaveSubmit(
    e: React.FormEvent
  ) {

    e.preventDefault();
    setError('');

    try {
      const payload = {
        ...leaveForm,
        end_date:
          isSingleDayLeaveCode(leaveForm.code)
            ? leaveForm.start_date
            : leaveForm.end_date,
        return_time:
          leaveForm.code === '24'
            ? ''
            : leaveForm.return_time,
        employee_id:
          selectedLeaveEmployee?.id ||
          Number(leaveForm.employee_id),
        total_hours:
          leaveForm.total_hours
            ? Number(leaveForm.total_hours)
            : 0
      };

      const res =
        await apiFetch(
        editingLeaveRequest
          ? `/personnel/leave-requests/${editingLeaveRequest.id}`
          : '/personnel/leave-requests',
        {
          method:
            editingLeaveRequest
              ? 'PUT'
              : 'POST',
          body:
            JSON.stringify(payload)
        }
      );

      const createdId =
        res.data?.id;

      const wasEditing =
        Boolean(editingLeaveRequest);

      setEditingLeaveRequest(null);
      setShowLeaveFormModal(false);
      setLeaveForm(emptyLeaveForm);
      if (selectedLeaveEmployee) {
        setLeaveForm({
          ...emptyLeaveForm,
          employee_id:
            String(selectedLeaveEmployee.id)
        });
        loadLeaveSummary(selectedLeaveEmployee.id);
      }
      const requestsRes =
        await apiFetch(
          `/personnel/leave-requests${
            filters.facility_id !== 'todos'
              ? `?facility_id=${filters.facility_id}`
              : ''
          }`
        );

      setLeaveRequests(requestsRes.data);

      const createdRequest =
        requestsRes.data.find(
          (request: LeaveRequest) =>
            request.id === createdId
        );

      if (
        !wasEditing &&
        createdRequest &&
        isPrintableLeaveCode(createdRequest.code)
      ) {
        setPrintLeaveRequest(createdRequest);
      }

    } catch (error: any) {

      setError(error.message);
    }
  }

  async function handleVacationRuleSubmit(
    e: React.FormEvent
  ) {

    e.preventDefault();
    setError('');

    try {

      await apiFetch(
        '/personnel/vacation-rules',
        {
          method: 'POST',
          body:
            JSON.stringify({
              ...vacationRuleForm,
              min_years:
                Number(vacationRuleForm.min_years),
              max_years:
                vacationRuleForm.max_years
                  ? Number(vacationRuleForm.max_years)
                  : null,
              allowed_days:
                Number(vacationRuleForm.allowed_days)
            })
        }
      );

      setVacationRuleForm(emptyVacationRuleForm);
      loadVacationData();

    } catch (error: any) {

      setError(error.message);
    }
  }

  async function updateVacationRule(
    rule: VacationRule,
    data: Partial<VacationRule>
  ) {

    setError('');

    try {

      await apiFetch(
        `/personnel/vacation-rules/${rule.id}`,
        {
          method: 'PUT',
          body:
            JSON.stringify({
              ...rule,
              ...data
            })
        }
      );

      loadVacationData();

    } catch (error: any) {

      setError(error.message);
    }
  }

  function updateLeaveRuleDraft(
    id: number,
    data: Partial<LeaveRule>
  ) {

    setLeaveRules((current) =>
      current.map((rule) =>
        rule.id === id
          ? {
            ...rule,
            ...data
          }
          : rule
      )
    );
  }

  async function saveLeaveRule(
    rule: LeaveRule
  ) {

    setError('');

    try {
      await apiFetch(
        `/personnel/leave-rules/${rule.id}`,
        {
          method: 'PUT',
          body:
            JSON.stringify(rule)
        }
      );

      setEditingLeaveRuleId(null);
      await loadData();
    } catch (error: any) {
      setError(error.message);
      showSystemAlert(error.message);
    }
  }

  function handleBalanceAdjustmentChange(
    e: React.ChangeEvent<
      HTMLInputElement |
      HTMLSelectElement |
      HTMLTextAreaElement
    >
  ) {

    const currentInfo =
      getBalanceInfo(
        e.target.name === 'code'
          ? e.target.value
          : balanceAdjustmentForm.code
      );

    const nextForm = {
      ...balanceAdjustmentForm,
      [e.target.name]: e.target.value,
      ...(e.target.name === 'code'
        ? {
          allowed_days:
            currentInfo
              ? String(currentInfo.allowed)
              : '',
          used_days:
            currentInfo?.unit === 'days'
              ? String(currentInfo.current)
              : '',
          used_hours:
            currentInfo?.unit === 'hours'
              ? String(currentInfo.current)
              : '',
          notes: ''
        }
        : {})
    };

    setBalanceAdjustmentForm(nextForm);

    if (
      selectedBalanceEmployee &&
      e.target.name === 'year'
    ) {
      loadBalanceSummary(
        selectedBalanceEmployee.id,
        nextForm.year
      );
    }
  }

  function getBalanceInfo(
    code = balanceAdjustmentForm.code
  ) {
    if (!balanceSummary) {
      return null;
    }

    if (code === '8') {
      return {
        unit: 'days',
        balanceId: balanceSummary.vacation.id,
        canEditAllowed: true,
        title: '8 - Licencia anual',
        allowedLabel: 'Dias que tiene',
        allowed: Number(balanceSummary.vacation.allowed_days || 0),
        currentLabel: 'Dias tomados',
        current: Number(balanceSummary.vacation.used_days || 0),
        pending: Number(balanceSummary.vacation.pending_days || 0),
        remaining: Number(balanceSummary.vacation.available_days || 0)
      };
    }

    if (code === '29') {
      return {
        unit: 'days',
        title: '29 - Licencia anual complementaria',
        allowedLabel: 'Dias que tiene',
        allowed: Number(balanceSummary.code29.allowed_days || 0),
        currentLabel: 'Dias tomados',
        current: Number(balanceSummary.code29.used_days || 0),
        pending: Number(balanceSummary.code29.pending_days || 0),
        remaining: Number(balanceSummary.code29.remaining_days || 0)
      };
    }

    if (code === '26') {
      return {
        unit: 'days',
        title: '26 - Articulo anual',
        allowedLabel: 'Dias anuales',
        allowed: Number(balanceSummary.code26.annual_limit_days || 0),
        currentLabel: 'Dias tomados',
        current: Number(balanceSummary.code26.used_days || 0),
        pending: Number(balanceSummary.code26.pending_days || 0),
        remaining: Number(balanceSummary.code26.remaining_days || 0),
        monthInfo:
          `Este mes: usados ${balanceSummary.code26.used_this_month || 0}, quedan ${balanceSummary.code26.remaining_this_month || 0}`
      };
    }

    if (['24', '43'].includes(code)) {
      return {
        unit: 'hours',
        title: `${code} - Permisos por horas`,
        allowedLabel: 'Horas anuales',
        allowed: Number(balanceSummary.hours24_43.annual_limit_hours || 0),
        currentLabel: 'Horas usadas',
        current: Number(balanceSummary.hours24_43.used_hours_year || 0),
        pending: Number(balanceSummary.hours24_43.pending_hours_year || 0),
        remaining: Number(balanceSummary.hours24_43.remaining_hours_year || 0),
        monthInfo:
          `Este mes: usadas ${balanceSummary.hours24_43.used_hours_month || 0}, quedan ${balanceSummary.hours24_43.remaining_hours_month || 0}`
      };
    }

    if (code === 'C') {
      return {
        unit: 'days',
        title: 'C - Compensatorio ganado',
        allowedLabel: 'Dias ganados',
        allowed: Number(balanceSummary.compensatory.earned_days || 0),
        currentLabel: 'Dias ganados',
        current: Number(balanceSummary.compensatory.earned_days || 0),
        pending: 0,
        remaining: Number(balanceSummary.compensatory.remaining_days || 0)
      };
    }

    if (code === '34') {
      return {
        unit: 'days',
        title: '34 / FC - Franco compensatorio',
        allowedLabel: 'Dias disponibles',
        allowed: Number(balanceSummary.compensatory.earned_days || 0),
        currentLabel: 'Dias tomados',
        current: Number(balanceSummary.compensatory.used_days || 0),
        pending: Number(balanceSummary.compensatory.pending_days || 0),
        remaining: Number(balanceSummary.compensatory.remaining_days || 0)
      };
    }

    return null;
  }

  async function handleBalanceAdjustmentSubmit(
    e: React.FormEvent
  ) {

    e.preventDefault();
    setError('');

    try {
      const balanceInfo =
        getBalanceInfo();

      if (!selectedBalanceEmployee || !balanceInfo) {
        showSystemAlert(
          'Selecciona un empleado y una licencia para corregir el saldo.'
        );
        return;
      }

      if (balanceAdjustmentForm.code === '8') {
        const allowedDays =
          Number(balanceAdjustmentForm.allowed_days || 0);

        const usedDays =
          Number(balanceAdjustmentForm.used_days || 0);

        const usedDifference =
          Number(
            (usedDays - balanceInfo.current)
              .toFixed(2)
          );

        await apiFetch(
          `/personnel/vacation-balances/${balanceInfo.balanceId}`,
          {
            method: 'PUT',
            body:
              JSON.stringify({
                allowed_days: allowedDays,
                used_days: usedDays
              })
          }
        );

        if (usedDifference !== 0) {
          await apiFetch(
            '/personnel/leave-balance-adjustments',
            {
              method: 'POST',
              body:
                JSON.stringify({
                  employee_id:
                    Number(balanceAdjustmentForm.employee_id),
                  code: '8',
                  year:
                    Number(balanceAdjustmentForm.year),
                  month: null,
                  used_days: usedDifference,
                  used_hours: 0,
                  notes:
                    [
                      'Correccion manual de licencia anual.',
                      `Dias tomados antes: ${balanceInfo.current}. Nuevo: ${usedDays}.`,
                      balanceAdjustmentForm.notes
                    ]
                      .filter(Boolean)
                      .join(' ')
                })
            }
          );
        }

        await loadBalanceSummary(selectedBalanceEmployee.id);
        await loadBalanceAdjustments();
        if (selectedLeaveEmployee) {
          await loadLeaveSummary(selectedLeaveEmployee.id);
        }
        showSystemAlert(
          'Saldo de licencia anual actualizado.',
          'Aviso del sistema',
          'success'
        );
        return;
      }

      const targetValue =
        balanceInfo.unit === 'hours'
          ? Number(balanceAdjustmentForm.used_hours || 0)
          : Number(balanceAdjustmentForm.used_days || 0);

      const difference =
        Number(
          (targetValue - balanceInfo.current)
            .toFixed(2)
        );

      if (difference === 0) {
        showSystemAlert(
          'El valor cargado es igual al saldo actual. No hay nada para corregir.',
          'Aviso del sistema',
          'info'
        );
        return;
      }

      await apiFetch(
        '/personnel/leave-balance-adjustments',
        {
          method: 'POST',
          body:
            JSON.stringify({
              ...balanceAdjustmentForm,
              employee_id:
                Number(balanceAdjustmentForm.employee_id),
              year:
                Number(balanceAdjustmentForm.year),
              month:
                balanceAdjustmentForm.month
                  ? Number(balanceAdjustmentForm.month)
                  : null,
              used_days:
                balanceInfo.unit === 'days'
                  ? difference
                  : 0,
              used_hours:
                balanceInfo.unit === 'hours'
                  ? difference
                  : 0,
              notes:
                [
                  `Correccion manual de ${balanceInfo.title}.`,
                  `Antes: ${balanceInfo.current}. Nuevo: ${targetValue}.`,
                  balanceAdjustmentForm.notes
                ]
                  .filter(Boolean)
                  .join(' ')
            })
        }
      );

      setBalanceAdjustmentForm((current) => ({
        ...current,
        used_days: '',
        used_hours: '',
        notes: ''
      }));
      await loadBalanceAdjustments();
      await loadBalanceSummary(selectedBalanceEmployee.id);
      if (selectedLeaveEmployee) {
        loadLeaveSummary(selectedLeaveEmployee.id);
      }

    } catch (error: any) {

      setError(error.message);
    }
  }

  async function deleteBalanceAdjustment(
    id: number
  ) {

    setError('');

    try {

      await apiFetch(
        `/personnel/leave-balance-adjustments/${id}`,
        {
          method: 'DELETE'
        }
      );

      loadBalanceAdjustments();
      if (selectedBalanceEmployee) {
        loadBalanceSummary(selectedBalanceEmployee.id);
      }
      if (selectedLeaveEmployee) {
        loadLeaveSummary(selectedLeaveEmployee.id);
      }

    } catch (error: any) {

      setError(error.message);
    }
  }

  async function updateLeaveStatus(
    id: number,
    status: string
  ) {

    setError('');

    try {

      await apiFetch(
        `/personnel/leave-requests/${id}/status`,
        {
          method: 'PATCH',
          body:
            JSON.stringify({
              status
            })
        }
      );

      loadLeaveRequests();
      loadVacationData();
      if (selectedLeaveEmployee) {
        loadLeaveSummary(selectedLeaveEmployee.id);
      }

      if (status === 'aprobado') {
        loadAttendance();
      }

    } catch (error: any) {

      setError(error.message);
    }
  }

  async function completeReturnTime(
    e: React.FormEvent
  ) {

    e.preventDefault();

    if (!returnLeaveRequest) {
      return;
    }

    setError('');

    try {

      await apiFetch(
        `/personnel/leave-requests/${returnLeaveRequest.id}/return`,
        {
          method: 'PATCH',
          body:
            JSON.stringify({
              return_time: returnForm.return_time,
              total_hours:
                returnForm.total_hours
                  ? Number(returnForm.total_hours)
                  : 0
            })
        }
      );

      setReturnLeaveRequest(null);
      setReturnForm({
        return_time: '',
        total_hours: ''
      });

      loadLeaveRequests();
      if (selectedLeaveEmployee) {
        loadLeaveSummary(selectedLeaveEmployee.id);
      }

    } catch (error: any) {

      setError(error.message);
    }
  }

  function getAttendanceValue(
    employee: AttendanceEmployee,
    day: number
  ) {

    const key =
      `${employee.id}-${day}`;

    if (key in attendanceEdits) {
      return attendanceEdits[key];
    }

    return employee.attendance[String(day)]?.code || '';
  }

  function getAnnualAttendanceEditKey(
    employeeId: number,
    month: number,
    day: number
  ) {
    return `${employeeId}-${month}-${day}`;
  }

  function getAnnualAttendanceValue(
    monthRow: AnnualAttendanceMonth,
    day: number
  ) {

    if (!annualAttendanceEmployee) {
      return '';
    }

    const key =
      getAnnualAttendanceEditKey(
        annualAttendanceEmployee.id,
        monthRow.month,
        day
      );

    if (key in annualAttendanceEdits) {
      return annualAttendanceEdits[key];
    }

    return monthRow.attendance[String(day)]?.code || '';
  }

  function getAttendanceCodeDescription(
    employee: AttendanceEmployee,
    day: number
  ) {

    const value =
      getAttendanceValue(
        employee,
        day
      )
        .trim()
        .toUpperCase();

    if (!value) {
      return 'Sin cargar';
    }

    const editedCode =
      codes.find((code) =>
        code.code.toUpperCase() === value
      );

    const savedDescription =
      employee.attendance[String(day)]
        ?.description;

    const baseDescription =
      editedCode
        ? `${value} - ${editedCode.description}`
        : savedDescription
          ? `${value} - ${savedDescription}`
          : value;

    const permissions =
      employee.attendance[String(day)]
        ?.permissions || [];

    const plannedOff =
      employee.attendance[String(day)]
        ?.planned_off;

    const plannedOffText =
      plannedOff
        ? hasWorkedPlannedDayOff(employee, day)
          ? `Franco programado trabajado: suma ${getAttendanceCompensatoryDays(employee, day) || 2} compensatorio(s)`
          : 'Franco programado'
        : '';

    if (permissions.length === 0) {
      return plannedOffText
        ? `${baseDescription} | ${plannedOffText}`
        : baseDescription;
    }

    const permissionText =
      permissions
        .map((permission) =>
          `Permiso ${permission.code} - ${permission.description} (${permission.status})`
        )
        .join(' | ');

    return [
      baseDescription,
      plannedOffText,
      permissionText
    ]
      .filter(Boolean)
      .join(' | ');
  }

  function getAnnualAttendanceCodeDescription(
    monthRow: AnnualAttendanceMonth,
    day: number
  ) {

    const value =
      getAnnualAttendanceValue(
        monthRow,
        day
      )
        .trim()
        .toUpperCase();

    if (!value) {
      return 'Sin cargar';
    }

    const editedCode =
      codes.find((code) =>
        code.code.toUpperCase() === value
      );

    const savedDescription =
      monthRow.attendance[String(day)]
        ?.description;

    const baseDescription =
      editedCode
        ? `${value} - ${editedCode.description}`
        : savedDescription
          ? `${value} - ${savedDescription}`
          : value;

    const permissions =
      monthRow.attendance[String(day)]
        ?.permissions || [];

    const plannedOff =
      monthRow.attendance[String(day)]
        ?.planned_off;

    const plannedOffText =
      plannedOff
        ? getAnnualAttendanceValue(monthRow, day)
          .trim()
          .toUpperCase() === 'P'
          ? `Franco programado trabajado: suma ${getAnnualAttendanceCompensatoryDays(monthRow, day) || 2} compensatorio(s)`
          : 'Franco programado'
        : '';

    if (permissions.length === 0) {
      return plannedOffText
        ? `${baseDescription} | ${plannedOffText}`
        : baseDescription;
    }

    const permissionText =
      permissions
        .map((permission) =>
          `Permiso ${permission.code} - ${permission.description} (${permission.status})`
        )
        .join(' | ');

    return [
      baseDescription,
      plannedOffText,
      permissionText
    ]
      .filter(Boolean)
      .join(' | ');
  }

  function hasAttendancePermissionMarker(
    employee: AttendanceEmployee,
    day: number
  ) {

    const value =
      getAttendanceValue(
        employee,
        day
      )
        .trim()
        .toUpperCase();

    return value === 'P' &&
      (
        employee.attendance[String(day)]
          ?.permissions?.length || 0
      ) > 0;
  }

  function hasPlannedDayOff(
    employee: AttendanceEmployee,
    day: number
  ) {
    return Boolean(
      employee.attendance[String(day)]
        ?.planned_off
    );
  }

  function hasWorkedPlannedDayOff(
    employee: AttendanceEmployee,
    day: number
  ) {
    return hasPlannedDayOff(employee, day) &&
      getAttendanceValue(employee, day)
        .trim()
        .toUpperCase() === 'P';
  }

  function getAttendanceCompensatoryDays(
    employee: AttendanceEmployee,
    day: number
  ) {
    const key =
      `${employee.id}-${day}`;

    if (key in attendanceCompensatoryEdits) {
      return attendanceCompensatoryEdits[key];
    }

    return employee.attendance[String(day)]
      ?.compensatory_days || null;
  }

  function getAnnualAttendanceCompensatoryDays(
    monthRow: AnnualAttendanceMonth,
    day: number
  ) {
    if (!annualAttendanceEmployee) {
      return null;
    }

    const key =
      getAnnualAttendanceEditKey(
        annualAttendanceEmployee.id,
        monthRow.month,
        day
      );

    if (key in annualAttendanceCompensatoryEdits) {
      return annualAttendanceCompensatoryEdits[key];
    }

    return monthRow.attendance[String(day)]
      ?.compensatory_days || null;
  }

  function isAttendanceCellLocked(
    employee: AttendanceEmployee,
    day: number
  ) {

    const savedCode =
      employee.attendance[String(day)]?.code
        ?.trim()
        .toUpperCase();

    return Boolean(
      savedCode &&
      attendanceCodesOnlyFromLeaves.has(savedCode)
    );
  }

  function isAnnualAttendanceCellLocked(
    monthRow: AnnualAttendanceMonth,
    day: number
  ) {

    const savedCode =
      monthRow.attendance[String(day)]?.code
        ?.trim()
        .toUpperCase();

    return Boolean(
      savedCode &&
      attendanceCodesOnlyFromLeaves.has(savedCode)
    );
  }

  function getAttendanceInputClass(
    employee: AttendanceEmployee,
    day: number
  ) {

    const value =
      getAttendanceValue(
        employee,
        day
      );

    const classes =
      ['attendance-code-input'];

    if (isAttendanceCellLocked(employee, day)) {
      classes.push('attendance-code-locked');
    }

    if (isNonPresentCode(value)) {
      classes.push('attendance-code-danger');
    }

    if (
      hasAttendancePermissionMarker(
        employee,
        day
      )
    ) {
      classes.push('attendance-code-permission');
    }

    if (
      hasPlannedDayOff(
        employee,
        day
      )
    ) {
      classes.push('attendance-code-planned-off');
    }

    return classes.join(' ');
  }

  function getAnnualAttendanceInputClass(
    monthRow: AnnualAttendanceMonth,
    day: number
  ) {

    const value =
      getAnnualAttendanceValue(
        monthRow,
        day
      );

    const classes =
      ['attendance-code-input'];

    if (isAnnualAttendanceCellLocked(monthRow, day)) {
      classes.push('attendance-code-locked');
    }

    if (isNonPresentCode(value)) {
      classes.push('attendance-code-danger');
    }

    if (
      value.trim().toUpperCase() === 'P' &&
      (
        monthRow.attendance[String(day)]
          ?.permissions?.length || 0
      ) > 0
    ) {
      classes.push('attendance-code-permission');
    }

    if (
      monthRow.attendance[String(day)]
        ?.planned_off
    ) {
      classes.push('attendance-code-planned-off');
    }

    return classes.join(' ');
  }

  function getPlannedOffValue(
    employee: PlannedDaysOffEmployee,
    day: number
  ) {
    const key =
      `${employee.id}-${day}`;

    if (key in plannedOffEdits) {
      return plannedOffEdits[key];
    }

    return Boolean(
      employee.planned_days[String(day)]
    );
  }

  function updatePlannedOffCell(
    employeeId: number,
    day: number,
    checked: boolean
  ) {
    setPlannedOffEdits({
      ...plannedOffEdits,
      [`${employeeId}-${day}`]: checked
    });
  }

  function updateAttendanceCell(
    employee: AttendanceEmployee,
    day: number,
    value: string
  ) {
    const normalizedValue =
      value.toUpperCase();

    const key =
      `${employee.id}-${day}`;

    setAttendanceEdits({
      ...attendanceEdits,
      [key]:
      normalizedValue
    });

    if (
      normalizedValue.trim() === 'P' &&
      hasPlannedDayOff(employee, day)
    ) {
      setCompensatoryPrompt({
        mode: 'month',
        key,
        employeeName: employee.full_name,
        dayLabel:
          `${String(day).padStart(2, '0')}/${String(attendanceFilters.month).padStart(2, '0')}/${attendanceFilters.year}`
      });
      return;
    }

    if (key in attendanceCompensatoryEdits) {
      const {
        [key]: _removed,
        ...rest
      } = attendanceCompensatoryEdits;

      setAttendanceCompensatoryEdits(rest);
    }
  }

  function updateAnnualAttendanceCell(
    monthRow: AnnualAttendanceMonth,
    month: number,
    day: number,
    value: string
  ) {

    if (!annualAttendanceEmployee) {
      return;
    }

    const normalizedValue =
      value.toUpperCase();

    const key =
      getAnnualAttendanceEditKey(
        annualAttendanceEmployee.id,
        month,
        day
      );

    setAnnualAttendanceEdits({
      ...annualAttendanceEdits,
      [key]:
        normalizedValue
    });

    if (
      normalizedValue.trim() === 'P' &&
      monthRow.attendance[String(day)]
        ?.planned_off
    ) {
      setCompensatoryPrompt({
        mode: 'annual',
        key,
        employeeName: annualAttendanceEmployee.full_name,
        dayLabel:
          `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${attendanceFilters.year}`
      });
      return;
    }

    if (key in annualAttendanceCompensatoryEdits) {
      const {
        [key]: _removed,
        ...rest
      } = annualAttendanceCompensatoryEdits;

      setAnnualAttendanceCompensatoryEdits(rest);
    }
  }

  function confirmCompensatoryDays(
    days: number
  ) {
    if (!compensatoryPrompt) {
      return;
    }

    if (compensatoryPrompt.mode === 'month') {
      setAttendanceCompensatoryEdits({
        ...attendanceCompensatoryEdits,
        [compensatoryPrompt.key]: days
      });
    } else {
      setAnnualAttendanceCompensatoryEdits({
        ...annualAttendanceCompensatoryEdits,
        [compensatoryPrompt.key]: days
      });
    }

    setCompensatoryPrompt(null);
  }

  function validateAttendanceCellOnBlur(
    employeeId: number,
    day: number
  ) {
    const key =
      `${employeeId}-${day}`;

    const value =
      (attendanceEdits[key] || '')
        .trim()
        .toUpperCase();

    if (
      !value ||
      !attendanceCodesOnlyFromLeaves.has(value)
    ) {
      return;
    }

    const description =
      codes.find((item) =>
        item.code.toUpperCase() === value
      )?.description;

    const message =
      `La clave ${description ? `${value} - ${description}` : value} debe cargarse desde Licencias, no desde Presentismo.`;

    setAttendanceEdits((current) => {
      const next =
        { ...current };

      delete next[key];

      return next;
    });

    setError(message);
    showSystemAlert(message);
  }

  function validateAnnualAttendanceCellOnBlur(
    month: number,
    day: number
  ) {

    if (!annualAttendanceEmployee) {
      return;
    }

    const key =
      getAnnualAttendanceEditKey(
        annualAttendanceEmployee.id,
        month,
        day
      );

    const value =
      (annualAttendanceEdits[key] || '')
        .trim()
        .toUpperCase();

    if (
      !value ||
      !attendanceCodesOnlyFromLeaves.has(value)
    ) {
      return;
    }

    const description =
      codes.find((item) =>
        item.code.toUpperCase() === value
      )?.description;

    const message =
      `La clave ${description ? `${value} - ${description}` : value} debe cargarse desde Licencias, no desde Presentismo.`;

    setAnnualAttendanceEdits((current) => {
      const next =
        { ...current };

      delete next[key];

      return next;
    });

    setError(message);
    showSystemAlert(message);
  }

  function hasPendingAttendanceChanges() {

    return (
      Object.keys(attendanceEdits).length > 0 ||
      Object.keys(annualAttendanceEdits).length > 0
    );
  }

  function confirmDiscardAttendanceChanges() {

    if (!hasPendingAttendanceChanges()) {
      return true;
    }

    return window.confirm(
      'Tenes cambios de presentismo sin guardar. Si continuas, vas a perder esos cambios.'
    );
  }

  function changeTab(
    tab: string
  ) {

    if (
      activeTab === 'attendance' &&
      tab !== 'attendance' &&
      !confirmDiscardAttendanceChanges()
    ) {
      return;
    }

    if (
      activeTab === 'attendance' &&
      tab !== 'attendance'
    ) {
      setAttendanceEdits({});
      setAnnualAttendanceEdits({});
    }

    setActiveTab(tab);
  }

  function updateAttendanceFilters(
    data: Partial<typeof attendanceFilters>,
    shouldDiscardEdits = false
  ) {

    if (
      shouldDiscardEdits &&
      !confirmDiscardAttendanceChanges()
    ) {
      return;
    }

    if (shouldDiscardEdits) {
      setAttendanceEdits({});
      setAnnualAttendanceEdits({});
    }

    setAttendanceFilters({
      ...attendanceFilters,
      ...data
    });
  }

  function focusNextEditableAttendanceInput(
    rowIndex: number,
    day: number,
    rowStep: number,
    dayStep: number
  ) {

    let nextRow =
      rowIndex + rowStep;

    let nextDay =
      day + dayStep;

    const maxAttempts =
      Math.max(
        1,
        filteredAttendanceRows.length * attendanceDays
      );

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const input =
        document.querySelector<HTMLInputElement>(
          `[data-attendance-row="${nextRow}"][data-attendance-day="${nextDay}"]:not(:disabled)`
        );

      if (input) {
        input.focus();
        input.select();
        return;
      }

      nextRow += rowStep;
      nextDay += dayStep;
    }
  }

  function handleAttendanceKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    day: number
  ) {

    if (e.key === 'Enter') {
      e.preventDefault();
      focusNextEditableAttendanceInput(
        rowIndex,
        day,
        1,
        0
      );
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusNextEditableAttendanceInput(
        rowIndex,
        day,
        1,
        0
      );
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusNextEditableAttendanceInput(
        rowIndex,
        day,
        -1,
        0
      );
    }

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusNextEditableAttendanceInput(
        rowIndex,
        day,
        0,
        1
      );
    }

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusNextEditableAttendanceInput(
        rowIndex,
        day,
        0,
        -1
      );
    }
  }

  function focusNextEditableAnnualAttendanceInput(
    rowIndex: number,
    day: number,
    rowStep: number,
    dayStep: number
  ) {

    let nextRow =
      rowIndex + rowStep;

    let nextDay =
      day + dayStep;

    const maxAttempts =
      Math.max(
        1,
        annualAttendanceMonths.length * 31
      );

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const input =
        document.querySelector<HTMLInputElement>(
          `[data-annual-attendance-row="${nextRow}"][data-annual-attendance-day="${nextDay}"]:not(:disabled)`
        );

      if (input) {
        input.focus();
        input.select();
        return;
      }

      nextRow += rowStep;
      nextDay += dayStep;
    }
  }

  function handleAnnualAttendanceKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    day: number
  ) {

    if (e.key === 'Enter') {
      e.preventDefault();
      focusNextEditableAnnualAttendanceInput(
        rowIndex,
        day,
        1,
        0
      );
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusNextEditableAnnualAttendanceInput(
        rowIndex,
        day,
        1,
        0
      );
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusNextEditableAnnualAttendanceInput(
        rowIndex,
        day,
        -1,
        0
      );
    }

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusNextEditableAnnualAttendanceInput(
        rowIndex,
        day,
        0,
        1
      );
    }

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusNextEditableAnnualAttendanceInput(
        rowIndex,
        day,
        0,
        -1
      );
    }
  }

  async function saveAttendance() {

    setSavingAttendance(true);
    setError('');

    try {

      const activeCodes =
        new Set(
          codes
            .filter((code) => code.is_active)
            .map((code) => code.code.toUpperCase())
        );

      const invalidCodes =
        Array.from(
          new Set(
            Object.values(attendanceEdits)
              .map((code) => code.trim().toUpperCase())
              .filter((code) => code && !activeCodes.has(code))
          )
        );

      if (invalidCodes.length > 0) {
        setError(
          `La clave ${invalidCodes.join(', ')} no existe. Claves disponibles: ${Array.from(activeCodes).sort().join(', ')}`
        );
        return;
      }

      const leaveOnlyCodes =
        Array.from(
          new Set(
            Object.values(attendanceEdits)
              .map((code) => code.trim().toUpperCase())
              .filter((code) =>
                code &&
                attendanceCodesOnlyFromLeaves.has(code)
              )
          )
        );

      if (leaveOnlyCodes.length > 0) {
        const detail =
          leaveOnlyCodes
            .map((code) => {
              const description =
                codes.find((item) =>
                  item.code.toUpperCase() === code
                )?.description;

              return description
                ? `${code} - ${description}`
                : code;
            })
            .join(', ');

        const message =
          `La clave ${detail} debe cargarse desde Licencias, no desde Presentismo.`;

        setError(message);
        showSystemAlert(message);
        return;
      }

      const missingCompensatoryChoice =
        Object.entries(attendanceEdits)
          .find(([key, code]) => {
            if (code.trim().toUpperCase() !== 'P') {
              return false;
            }

            if (attendanceCompensatoryEdits[key]) {
              return false;
            }

            const [
              employeeId,
              day
            ] = key.split('-');

            const employee =
              attendanceRows.find((item) =>
                item.id === Number(employeeId)
              );

            return Boolean(
              employee &&
              hasPlannedDayOff(
                employee,
                Number(day)
              )
            );
          });

      if (missingCompensatoryChoice) {
        const [
          employeeId,
          day
        ] = missingCompensatoryChoice[0].split('-');

        const employee =
          attendanceRows.find((item) =>
            item.id === Number(employeeId)
          );

        setCompensatoryPrompt({
          mode: 'month',
          key: missingCompensatoryChoice[0],
          employeeName:
            employee?.full_name || 'Empleado',
          dayLabel:
            `${String(day).padStart(2, '0')}/${String(attendanceFilters.month).padStart(2, '0')}/${attendanceFilters.year}`
        });
        return;
      }

      const records =
        Object.entries(attendanceEdits)
          .map(([key, code]) => {

            const [
              employeeId,
              day
            ] = key.split('-');

            return {
              employee_id: Number(employeeId),
              day: Number(day),
              code,
              compensatory_days:
                attendanceCompensatoryEdits[key] || null
            };
          });

      await apiFetch(
        '/personnel/attendance',
        {
          method: 'PUT',
          body:
            JSON.stringify({
              year: Number(attendanceFilters.year),
              month: Number(attendanceFilters.month),
              records
            })
        }
      );

      await loadAttendance();
      setAttendanceEdits({});
      setAttendanceCompensatoryEdits({});
      if (selectedLeaveEmployee) {
        await loadLeaveSummary(
          selectedLeaveEmployee.id
        );
      }

    } catch (error: any) {

      setError(error.message);
      showSystemAlert(error.message);

    } finally {

      setSavingAttendance(false);
    }
  }

  async function saveAnnualAttendance() {

    if (!annualAttendanceEmployee) {
      return;
    }

    setSavingAttendance(true);
    setError('');

    try {
      const activeCodes =
        new Set(
          codes
            .filter((code) => code.is_active)
            .map((code) => code.code.toUpperCase())
        );

      const invalidCodes =
        Array.from(
          new Set(
            Object.values(annualAttendanceEdits)
              .map((code) => code.trim().toUpperCase())
              .filter((code) => code && !activeCodes.has(code))
          )
        );

      if (invalidCodes.length > 0) {
        const message =
          `La clave ${invalidCodes.join(', ')} no existe. Claves disponibles: ${Array.from(activeCodes).sort().join(', ')}`;

        setError(message);
        showSystemAlert(message);
        return;
      }

      const leaveOnlyCodes =
        Array.from(
          new Set(
            Object.values(annualAttendanceEdits)
              .map((code) => code.trim().toUpperCase())
              .filter((code) =>
                code &&
                attendanceCodesOnlyFromLeaves.has(code)
              )
          )
        );

      if (leaveOnlyCodes.length > 0) {
        const detail =
          leaveOnlyCodes
            .map((code) => {
              const description =
                codes.find((item) =>
                  item.code.toUpperCase() === code
                )?.description;

              return description
                ? `${code} - ${description}`
                : code;
            })
            .join(', ');

        const message =
          `La clave ${detail} debe cargarse desde Licencias, no desde Presentismo.`;

        setError(message);
        showSystemAlert(message);
        return;
      }

      const missingAnnualCompensatoryChoice =
        Object.entries(annualAttendanceEdits)
          .find(([key, code]) => {
            if (code.trim().toUpperCase() !== 'P') {
              return false;
            }

            if (annualAttendanceCompensatoryEdits[key]) {
              return false;
            }

            const [
              ,
              month,
              day
            ] = key.split('-');

            const monthRow =
              annualAttendanceMonths.find((item) =>
                item.month === Number(month)
              );

            return Boolean(
              monthRow?.attendance[String(day)]
                ?.planned_off
            );
          });

      if (missingAnnualCompensatoryChoice) {
        const [
          ,
          month,
          day
        ] = missingAnnualCompensatoryChoice[0].split('-');

        setCompensatoryPrompt({
          mode: 'annual',
          key: missingAnnualCompensatoryChoice[0],
          employeeName:
            annualAttendanceEmployee.full_name,
          dayLabel:
            `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${attendanceFilters.year}`
        });
        return;
      }

      const recordsByMonth =
        new Map<number, Array<{
          employee_id: number;
          day: number;
          code: string;
          compensatory_days: number | null;
        }>>();

      Object.entries(annualAttendanceEdits)
        .forEach(([key, code]) => {
          const [
            employeeId,
            month,
            day
          ] = key.split('-');

          const monthNumber =
            Number(month);

          const records =
            recordsByMonth.get(monthNumber) || [];

          records.push({
            employee_id: Number(employeeId),
            day: Number(day),
            code,
            compensatory_days:
              annualAttendanceCompensatoryEdits[key] || null
          });

          recordsByMonth.set(
            monthNumber,
            records
          );
        });

      for (const [month, records] of recordsByMonth) {
        await apiFetch(
          '/personnel/attendance',
          {
            method: 'PUT',
            body:
              JSON.stringify({
                year: Number(attendanceFilters.year),
                month,
                records
              })
          }
        );
      }

      await loadAnnualAttendance();
      await loadAttendance();
      setAnnualAttendanceEdits({});
      setAnnualAttendanceCompensatoryEdits({});

      if (selectedLeaveEmployee) {
        await loadLeaveSummary(
          selectedLeaveEmployee.id
        );
      }

      showSystemAlert(
        'Presentismo del empleado guardado correctamente.',
        'Listo',
        'success'
      );
    } catch (error: any) {
      setError(error.message);
      showSystemAlert(error.message);
    } finally {
      setSavingAttendance(false);
    }
  }

  async function savePlannedDaysOff() {

    setSavingPlannedOff(true);
    setError('');

    try {
      const records =
        Object.entries(plannedOffEdits)
          .map(([key, isPlanned]) => {
            const [
              employeeId,
              day
            ] = key.split('-');

            return {
              employee_id: Number(employeeId),
              day: Number(day),
              is_planned: isPlanned
            };
          });

      await apiFetch(
        '/personnel/planned-days-off',
        {
          method: 'PUT',
          body:
            JSON.stringify({
              year: Number(attendanceFilters.year),
              month: Number(attendanceFilters.month),
              records
            })
        }
      );

      await Promise.all([
        loadPlannedDaysOff(),
        loadAttendance()
      ]);

      if (selectedLeaveEmployee) {
        await loadLeaveSummary(
          selectedLeaveEmployee.id
        );
      }

      showSystemAlert(
        'Francos programados guardados correctamente.',
        'Listo',
        'success'
      );
    } catch (error: any) {
      setError(error.message);
      showSystemAlert(error.message);
    } finally {
      setSavingPlannedOff(false);
    }
  }

  useEffect(() => {

    loadData();

  }, []);

  useEffect(() => {

    const hasChanges =
      hasPendingAttendanceChanges();

    function handleBeforeUnload(
      event: BeforeUnloadEvent
    ) {

      if (!hasChanges) {
        return;
      }

      event.preventDefault();
      event.returnValue = '';
    }

    function handleDocumentClick(
      event: MouseEvent
    ) {

      if (!hasChanges || activeTab !== 'attendance') {
        return;
      }

      const link =
        (event.target as HTMLElement)
          .closest('a');

      if (!link) {
        return;
      }

      const href =
        link.getAttribute('href');

      if (!href || href.startsWith('#')) {
        return;
      }

      if (
        !window.confirm(
          'Tenes cambios de presentismo sin guardar. Si continuas, vas a perder esos cambios.'
        )
      ) {
        event.preventDefault();
      }
    }

    window.addEventListener(
      'beforeunload',
      handleBeforeUnload
    );

    document.addEventListener(
      'click',
      handleDocumentClick,
      true
    );

    return () => {
      window.removeEventListener(
        'beforeunload',
        handleBeforeUnload
      );
      document.removeEventListener(
        'click',
        handleDocumentClick,
        true
      );
    };

  }, [attendanceEdits, annualAttendanceEdits, activeTab]);

  useEffect(() => {

    if (activeTab === 'attendance') {
      loadAttendance();
    }

    if (activeTab === 'planned-days-off') {
      loadPlannedDaysOff();
    }

    if (
      activeTab === 'leaves' ||
      activeTab === 'leave-requests'
    ) {
      loadLeaveRequests();
      loadVacationData();
      if (selectedLeaveEmployee) {
        loadLeaveSummary(selectedLeaveEmployee.id);
      }
    }

    if (activeTab === 'balance-adjustments') {
      loadBalanceAdjustments();
    }

    if (activeTab === 'vacation-rules') {
      loadVacationData();
    }

  }, [
    activeTab,
    attendanceFilters.year,
    attendanceFilters.month,
    attendanceFilters.department,
    attendanceFilters.facility_id,
    filters.facility_id,
    vacationYear
  ]);

  useEffect(() => {

    if (
      activeTab === 'attendance' &&
      attendanceViewMode === 'employee' &&
      annualAttendanceEmployeeId
    ) {
      loadAnnualAttendance();
    }

  }, [
    activeTab,
    attendanceViewMode,
    annualAttendanceEmployeeId,
    attendanceFilters.year,
    attendanceFilters.facility_id
  ]);

  useEffect(() => {
    if (activeTab === 'employees') {
      loadEmployeeList();
    }
  }, [
    activeTab,
    filters.search,
    filters.facility_id,
    filters.department,
    filters.status,
    filters.page,
    filters.per_page
  ]);

  useEffect(() => {
    const balanceInfo =
      getBalanceInfo();

    if (!balanceInfo) {
      return;
    }

    setBalanceAdjustmentForm((current) => ({
      ...current,
      allowed_days: String(balanceInfo.allowed),
      used_days:
        balanceInfo.unit === 'days'
          ? String(balanceInfo.current)
          : '',
      used_hours:
        balanceInfo.unit === 'hours'
          ? String(balanceInfo.current)
          : ''
    }));
  }, [
    balanceSummary,
    balanceAdjustmentForm.code
  ]);

  const filteredEmployees =
    employeeList;

  const canSeeLeaveCreator =
    user?.role === 'admin' ||
    user?.role === 'dir';

  const dayNumbers =
    Array.from(
      { length: attendanceDays },
      (_, index) => index + 1
    );

  const annualDayNumbers =
    Array.from(
      { length: 31 },
      (_, index) => index + 1
    );

  const monthNames =
    [
      'Enero',
      'Febrero',
      'Marzo',
      'Abril',
      'Mayo',
      'Junio',
      'Julio',
      'Agosto',
      'Septiembre',
      'Octubre',
      'Noviembre',
      'Diciembre'
    ];

  const filteredAttendanceRows =
    attendanceRows.filter((employee) => {

      const search =
        attendanceFilters.search
          .toLowerCase()
          .trim();

      if (!search) {
        return !attendanceFilters.departmentSearch ||
          (employee.department_name || '')
            .toLowerCase()
            .includes(
              attendanceFilters.departmentSearch
                .toLowerCase()
                .trim()
            );
      }

      const matchesDepartment =
        !attendanceFilters.departmentSearch ||
        (employee.department_name || '')
          .toLowerCase()
          .includes(
            attendanceFilters.departmentSearch
              .toLowerCase()
              .trim()
          );

      return (
        matchesDepartment &&
          (
          matchesNameSearch(employee.full_name, search) ||
          (employee.dni || '')
            .toLowerCase()
            .includes(search) ||
          (employee.file_number || '')
            .toLowerCase()
            .includes(search)
        )
      );
    });

  const annualAttendanceEmployeeOptions =
    attendanceRows.filter((employee) => {
      const search =
        annualAttendanceEmployeeSearch
          .toLowerCase()
          .trim();

      if (!search) {
        return true;
      }

      return (
        matchesNameSearch(employee.full_name, search) ||
        (employee.dni || '')
          .toLowerCase()
          .includes(search) ||
        (employee.file_number || '')
          .toLowerCase()
          .includes(search) ||
        (employee.department_name || '')
          .toLowerCase()
          .includes(search)
      );
    });

  const plannedOffDayNumbers =
    Array.from(
      { length: plannedOffDays },
      (_, index) => index + 1
    );

  const filteredPlannedOffRows =
    plannedOffRows.filter((employee) => {
      const search =
        attendanceFilters.search
          .toLowerCase()
          .trim();

      const matchesDepartment =
        !attendanceFilters.departmentSearch ||
        (employee.department_name || '')
          .toLowerCase()
          .includes(
            attendanceFilters.departmentSearch
              .toLowerCase()
              .trim()
          );

      if (!search) {
        return matchesDepartment;
      }

      return (
        matchesDepartment &&
        (
          matchesNameSearch(employee.full_name, search) ||
          (employee.dni || '')
            .toLowerCase()
            .includes(search) ||
          (employee.file_number || '')
            .toLowerCase()
            .includes(search)
        )
      );
    });

  const attendanceMonthValue =
    `${attendanceFilters.year}-${attendanceFilters.month.padStart(2, '0')}`;

  const filteredLeaveEmployees =
    employees
      .filter((employee) => employee.is_active)
      .filter((employee) =>
        filters.facility_id === 'todos' ||
        String(employee.facility_id || '') === filters.facility_id
      )
      .filter((employee) => {

        const search =
          leaveEmployeeSearch
            .toLowerCase()
            .trim();

        if (!search) {
          return true;
        }

        return (
          matchesNameSearch(employee.full_name, search) ||
          (employee.dni || '')
            .toLowerCase()
            .includes(search) ||
          (employee.file_number || '')
            .toLowerCase()
            .includes(search) ||
          (employee.department_name || '')
            .toLowerCase()
            .includes(search) ||
          (employee.facility_name || '')
            .toLowerCase()
            .includes(search)
        );
      });

  const selectedEmployeeLeaveYears =
    Array.from(
      new Set(
        leaveRequests
          .filter((request) =>
            selectedLeaveEmployee &&
            request.employee_id === selectedLeaveEmployee.id
          )
          .map((request) =>
            toDateInput(request.start_date).slice(0, 4)
          )
          .filter(Boolean)
      )
    )
      .sort((a, b) =>
        Number(b) - Number(a)
      );

  const selectedEmployeeLeaveRequests =
    selectedLeaveEmployee
      ? leaveRequests
        .filter((request) =>
          request.employee_id === selectedLeaveEmployee.id
        )
        .filter((request) =>
          leaveRequestYearFilter === 'todos' ||
          toDateInput(request.start_date).slice(0, 4) === leaveRequestYearFilter
        )
        .sort((a, b) => {
          const dateDiff =
            new Date(toDateInput(b.start_date)).getTime() -
            new Date(toDateInput(a.start_date)).getTime();

          return dateDiff || b.id - a.id;
        })
      : [];

  const filteredLeaveRequests =
    leaveRequests.filter((request) => {

      const search =
        leaveRequestFilters.search
          .toLowerCase()
          .trim();

      const matchesSearch =
        !search ||
        matchesNameSearch(request.full_name, search) ||
        (request.file_number || '')
          .toLowerCase()
          .includes(search) ||
        (request.department_name || '')
          .toLowerCase()
          .includes(search) ||
        request.code
          .toLowerCase()
          .includes(search);

      const matchesStatus =
        leaveRequestFilters.status === 'todos' ||
        request.status === leaveRequestFilters.status;

      const matchesCode =
        leaveRequestFilters.code === 'todos' ||
        request.code === leaveRequestFilters.code;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesCode
      );
    });

  const leaveEmployeePageSize = 4;

  const leaveEmployeePageCount =
    Math.max(
      1,
      Math.ceil(
        filteredLeaveEmployees.length /
          leaveEmployeePageSize
      )
    );

  const paginatedLeaveEmployees =
    filteredLeaveEmployees.slice(
      leaveEmployeePage * leaveEmployeePageSize,
      leaveEmployeePage * leaveEmployeePageSize +
        leaveEmployeePageSize
    );

  const filteredBalanceEmployees =
    employees
      .filter((employee) => employee.is_active)
      .filter((employee) => {

        const search =
          balanceEmployeeSearch
            .toLowerCase()
            .trim();

        if (!search) {
          return true;
        }

        return (
          matchesNameSearch(employee.full_name, search) ||
          (employee.dni || '')
            .toLowerCase()
            .includes(search) ||
          (employee.file_number || '')
            .toLowerCase()
            .includes(search) ||
          (employee.department_name || '')
            .toLowerCase()
            .includes(search)
        );
      })
      .slice(0, 8);

  const selectedBalanceInfo =
    getBalanceInfo();

  const balanceAllowedInput =
    Number(
      balanceAdjustmentForm.allowed_days ||
      selectedBalanceInfo?.allowed ||
      0
    );

  const balanceUsedInput =
    Number(
      selectedBalanceInfo?.unit === 'hours'
        ? balanceAdjustmentForm.used_hours ||
          selectedBalanceInfo?.current ||
          0
        : balanceAdjustmentForm.used_days ||
          selectedBalanceInfo?.current ||
          0
    );

  const balanceAvailablePreview =
    selectedBalanceInfo
      ? Number(
        (
          balanceAllowedInput -
          balanceUsedInput -
          Number(selectedBalanceInfo.pending || 0)
        ).toFixed(2)
      )
      : 0;

  const selectedBalanceAdjustments =
    selectedBalanceEmployee
      ? balanceAdjustments.filter((adjustment) =>
        adjustment.employee_id === selectedBalanceEmployee.id &&
        adjustment.code === balanceAdjustmentForm.code
      )
      : [];

  function isSunday(
    day: number
  ) {

    return new Date(
      Number(attendanceFilters.year),
      Number(attendanceFilters.month) - 1,
      day
    ).getDay() === 0;
  }

  function isSundayForDate(
    month: number,
    day: number
  ) {

    return new Date(
      Number(attendanceFilters.year),
      month - 1,
      day
    ).getDay() === 0;
  }

  function isNonPresentCode(
    code: string
  ) {

    const normalized =
      code.trim().toUpperCase();

    return normalized !== '' &&
      normalized !== 'P';
  }

  return (

    <div>

      <div className="page-header">
        <div>
          <PageTitle
            icon={
              isPersonnelSettingsPage
                ? 'configuracion-personal'
                : 'personal'
            }
          >
            {
              isPersonnelSettingsPage
                ? 'Configuracion Personal'
                : 'Personal'
            }
          </PageTitle>
          <p className="page-subtitle">
            {
              isPersonnelSettingsPage
                ? 'Sectores, claves, reglas y saldos sensibles.'
                : 'Empleados, presentismo, francos y licencias.'
            }
          </p>
        </div>
      </div>

      {compensatoryPrompt && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="modal-title">
              Franco trabajado
            </h2>
            <p className="modal-subtitle">
              {compensatoryPrompt.employeeName} figura con franco programado el {compensatoryPrompt.dayLabel}. Indica cuantos dias compensatorios corresponde acreditar.
            </p>
            <div className="modal-actions">
              <button
                className="btn-secondary"
                type="button"
                onClick={() =>
                  confirmCompensatoryDays(1)
                }
              >
                1 dia
              </button>
              <button
                className="btn-primary"
                type="button"
                onClick={() =>
                  confirmCompensatoryDays(2)
                }
              >
                2 dias
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="module-tabs">
        {!isPersonnelSettingsPage && (
          <button
            className={
              activeTab === 'employees'
                ? 'module-tab module-tab-active'
                : 'module-tab'
            }
            onClick={() =>
              changeTab('employees')
            }
          >
            Empleados
          </button>
        )}

        {isPersonnelSettingsPage && canManageSettings && (
          <button
            className={
              activeTab === 'departments'
                ? 'module-tab module-tab-active'
                : 'module-tab'
            }
            onClick={() =>
              changeTab('departments')
            }
          >
            Sectores
          </button>
        )}

        {isPersonnelSettingsPage && canManageSettings && (
          <button
            className={
              activeTab === 'codes'
                ? 'module-tab module-tab-active'
                : 'module-tab'
            }
            onClick={() =>
              changeTab('codes')
            }
          >
            Claves
          </button>
        )}

        {!isPersonnelSettingsPage && (
          <button
            className={
              activeTab === 'attendance'
                ? 'module-tab module-tab-active'
                : 'module-tab'
            }
            onClick={() =>
              changeTab('attendance')
            }
          >
            Presentismo
          </button>
        )}

        {!isPersonnelSettingsPage && canManageAttendance && (
          <button
            className={
              activeTab === 'planned-days-off'
                ? 'module-tab module-tab-active'
                : 'module-tab'
            }
            onClick={() =>
              changeTab('planned-days-off')
            }
          >
            Francos
          </button>
        )}

        {!isPersonnelSettingsPage && (
          <button
            className={
              activeTab === 'leaves'
                ? 'module-tab module-tab-active'
                : 'module-tab'
            }
            onClick={() =>
              changeTab('leaves')
            }
          >
            Licencias
          </button>
        )}

        {!isPersonnelSettingsPage && (
          <button
            className={
              activeTab === 'leave-requests'
                ? 'module-tab module-tab-active'
                : 'module-tab'
            }
            onClick={() =>
              changeTab('leave-requests')
            }
          >
            Licencias pendientes
          </button>
        )}

        {isPersonnelSettingsPage && canManageSettings && (
          <button
            className={
              activeTab === 'leave-rules'
                ? 'module-tab module-tab-active'
                : 'module-tab'
            }
            onClick={() =>
              changeTab('leave-rules')
            }
          >
            Reglas licencias
          </button>
        )}

        {isPersonnelSettingsPage && canManageSettings && (
          <button
            className={
              activeTab === 'vacation-rules'
                ? 'module-tab module-tab-active'
                : 'module-tab'
            }
            onClick={() =>
              changeTab('vacation-rules')
            }
          >
            Reglas vacaciones
          </button>
        )}

        {isPersonnelSettingsPage && canManageBalances && (
          <button
            className={
              activeTab === 'balance-adjustments'
                ? 'module-tab module-tab-active'
                : 'module-tab'
            }
            onClick={() =>
              changeTab('balance-adjustments')
            }
          >
            Saldos de licencias
          </button>
        )}
      </div>

      {
        error && (
          <p className="auth-error">
            {error}
          </p>
        )
      }

      {
        isPersonnelSettingsPage &&
        !canManageSettings &&
        !canManageBalances && (
          <div className="empty-state">
            No tenes permisos para administrar la configuracion de Personal.
          </div>
        )
      }

      {
        !isPersonnelSettingsPage &&
        activeTab === 'employees' && (
          <>
            {canManageEmployees && (
              <div className="management-actions page-actions">
                <button
                  className="btn-primary"
                  type="button"
                  onClick={() => {
                    setEditingEmployee(null);
                    setEmployeeForm({
                      ...emptyEmployee,
                      facility_id: defaultFacilityId
                    });
                    setShowEmployeeFormModal(true);
                  }}
                >
                  + Nuevo empleado
                </button>
              </div>
            )}

            {canManageEmployees && showEmployeeFormModal && (
            <div className="modal-overlay">
              <div className="modal-content modal-content-wide">
                <button
                  className="modal-close-button"
                  type="button"
                  onClick={resetEmployeeForm}
                >
                  x
                </button>
                <h2 className="modal-title">
                  {editingEmployee ? 'Editar empleado' : 'Nuevo empleado'}
                </h2>
                <form
                  className="personnel-form"
                  onSubmit={handleEmployeeSubmit}
                >
              <input
                className="form-input"
                name="full_name"
                placeholder="Apellido y nombre"
                value={employeeForm.full_name}
                onChange={handleEmployeeChange}
              />

              <input
                className="form-input"
                name="dni"
                placeholder="DNI"
                value={employeeForm.dni}
                onChange={handleEmployeeChange}
              />

              <input
                className="form-input"
                name="cuil"
                placeholder="CUIL"
                value={employeeForm.cuil}
                onChange={handleEmployeeChange}
              />

              <label className="form-field">
                <span>Fecha de nacimiento</span>
                <input
                  className="form-input"
                  type="date"
                  name="birth_date"
                  value={employeeForm.birth_date}
                  onChange={handleEmployeeChange}
                />
              </label>

              <label className="form-field">
                <span>Fecha de ingreso</span>
                <input
                  className="form-input"
                  type="date"
                  name="hire_date"
                  value={employeeForm.hire_date}
                  onChange={handleEmployeeChange}
                />
              </label>

              <input
                className="form-input"
                name="file_number"
                placeholder="Legajo"
                value={employeeForm.file_number}
                onChange={handleEmployeeChange}
              />

              <select
                className="form-input"
                name="facility_id"
                value={employeeForm.facility_id}
                onChange={handleEmployeeChange}
                disabled={!canSelectFacility}
              >
                <option value="">
                  Dependencia
                </option>
                {facilities.map((facility) => (
                  <option
                    key={facility.id}
                    value={facility.id}
                  >
                    {facility.name}
                  </option>
                ))}
              </select>

              <select
                className="form-input"
                name="department_id"
                value={employeeForm.department_id}
                onChange={handleEmployeeChange}
              >
                <option value="">
                  Sector
                </option>
                {departmentsForFacility(
                  employeeForm.facility_id || defaultFacilityId
                ).map((department) => (
                  <option
                    key={department.id}
                    value={department.id}
                  >
                    {department.name}
                  </option>
                ))}
              </select>

              <input
                className="form-input"
                name="employment_type"
                placeholder="Tipo de vinculacion"
                value={employeeForm.employment_type}
                onChange={handleEmployeeChange}
              />

              <select
                className="form-input"
                name="work_shift"
                value={employeeForm.work_shift}
                onChange={handleEmployeeChange}
              >
                <option value="">Turno</option>
                {workShiftOptions.map((shift) => (
                  <option
                    key={shift}
                    value={shift}
                  >
                    {workShiftLabels[shift]}
                  </option>
                ))}
              </select>

              <label className="form-field">
                <span>Hora de entrada</span>
                <input
                  className="form-input"
                  type="time"
                  name="shift_start_time"
                  value={employeeForm.shift_start_time}
                  onChange={handleEmployeeChange}
                />
              </label>

              <label className="form-field">
                <span>Hora de salida</span>
                <input
                  className="form-input"
                  type="time"
                  name="shift_end_time"
                  value={employeeForm.shift_end_time}
                  onChange={handleEmployeeChange}
                />
              </label>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  name="is_professional"
                  checked={employeeForm.is_professional}
                  onChange={handleEmployeeChange}
                />
                Profesional
              </label>

              <input
                className="form-input"
                name="phone"
                placeholder="Telefono"
                value={employeeForm.phone}
                onChange={handleEmployeeChange}
              />

              <input
                className="form-input"
                name="email"
                placeholder="Email"
                value={employeeForm.email}
                onChange={handleEmployeeChange}
              />

              <input
                className="form-input"
                name="license_number"
                placeholder="Matricula"
                value={employeeForm.license_number}
                onChange={handleEmployeeChange}
              />

              <input
                className="form-input"
                name="address"
                placeholder="Direccion"
                value={employeeForm.address}
                onChange={handleEmployeeChange}
              />

              <textarea
                className="form-input personnel-notes"
                name="notes"
                placeholder="Notas"
                rows={3}
                value={employeeForm.notes}
                onChange={handleEmployeeChange}
              />

              <div className="management-actions">
                <button
                  className="btn-success"
                  type="submit"
                >
                  {
                    editingEmployee
                      ? 'Guardar empleado'
                      : 'Crear empleado'
                  }
                </button>

                {
                  editingEmployee && (
                    <button
                      className="btn-secondary"
                      type="button"
                      onClick={resetEmployeeForm}
                    >
                      Cancelar
                    </button>
                  )
                }
              </div>
            </form>
              </div>
            </div>
            )}

            <div className="filter-bar">
              <input
                className="form-input"
                placeholder="Buscar por nombre, DNI, CUIL o legajo"
                value={filters.search}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    search: e.target.value,
                    page: 1
                  })
                }
              />

              <select
                className="form-input"
                value={filters.facility_id}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    facility_id: e.target.value,
                    department: 'todos',
                    page: 1
                  })
                }
                disabled={!canSelectFacility}
              >
                {canSelectFacility && (
                  <option value="todos">
                    Todas las dependencias
                  </option>
                )}
                {facilities.map((facility) => (
                  <option
                    key={facility.id}
                    value={facility.id}
                  >
                    {facility.name}
                  </option>
                ))}
              </select>

              <select
                className="form-input"
                value={filters.department}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    department: e.target.value,
                    page: 1
                  })
                }
              >
                <option value="todos">
                  Todos los sectores
                </option>
                {departmentsForFacility(
                  filters.facility_id
                ).map((department) => (
                  <option
                    key={department.id}
                    value={department.id}
                  >
                    {department.name}
                  </option>
                ))}
              </select>

              <select
                className="form-input"
                value={filters.status}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    status: e.target.value,
                    page: 1
                  })
                }
              >
                <option value="todos">
                  Todos los estados
                </option>
                <option value="activo">
                  Activos
                </option>
                <option value="inactivo">
                  Inactivos
                </option>
              </select>
            </div>

            <p className="results-summary">
              Mostrando {filteredEmployees.length} de {employeePagination.total} empleados
            </p>

            <div className="pagination-bar">
              <span>
                Pagina {employeePagination.page} de {employeePagination.total_pages}
              </span>

              <div className="table-actions">
                <select
                  className="form-input"
                  value={filters.per_page}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      per_page: Number(e.target.value),
                      page: 1
                    })
                  }
                >
                  <option value={25}>25 por pagina</option>
                  <option value={50}>50 por pagina</option>
                  <option value={100}>100 por pagina</option>
                </select>

                <button
                  className="btn-secondary"
                  disabled={employeePagination.page <= 1}
                  onClick={() =>
                    setFilters({
                      ...filters,
                      page:
                        Math.max(
                          1,
                          employeePagination.page - 1
                        )
                    })
                  }
                >
                  Anterior
                </button>

                <button
                  className="btn-secondary"
                  disabled={
                    employeePagination.page >=
                    employeePagination.total_pages
                  }
                  onClick={() =>
                    setFilters({
                      ...filters,
                      page:
                        Math.min(
                          employeePagination.total_pages,
                          employeePagination.page + 1
                        )
                    })
                  }
                >
                  Siguiente
                </button>
              </div>
            </div>

            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>DNI</th>
                    <th>Dependencia</th>
                    <th>Sector</th>
                    <th>Turno</th>
                    <th>Ingreso</th>
                    <th>Antiguedad</th>
                    <th>Estado</th>
                      {(readOnly || user?.role === 'admin') && (
                        <th>Resumen</th>
                      )}
                      {canManageEmployees && (
                        <th>Acciones</th>
                      )}
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((employee) => (
                    <tr key={employee.id}>
                      <td>
                        <button
                          className="text-link-button"
                          type="button"
                          onClick={() =>
                            openEmployeeAttendance(employee)
                          }
                          title="Ver presentismo del empleado"
                        >
                          {employee.full_name}
                        </button>
                      </td>
                      <td>{employee.dni || '-'}</td>
                      <td>{employee.facility_name || '-'}</td>
                      <td>{employee.department_name || '-'}</td>
                      <td>{formatEmployeeShift(employee)}</td>
                      <td>{formatDisplayDate(employee.hire_date)}</td>
                      <td>{getSeniority(employee.hire_date)}</td>
                      <td>
                        <span
                          className={
                            employee.is_active
                              ? 'badge badge-success'
                              : 'badge badge-danger'
                          }
                        >
                          {
                            employee.is_active
                              ? 'Activo'
                              : 'Inactivo'
                          }
                        </span>
                      </td>
                      {(readOnly || user?.role === 'admin') && (
                        <td>
                          <IconButton
                            icon="eye"
                            label="Ver resumen"
                            type="button"
                            onClick={() =>
                              loadDirectiveSummary(employee)
                            }
                            variant="secondary"
                          />
                        </td>
                      )}
                      {canManageEmployees && (
                        <td>
                          <div className="table-actions">
                            <IconButton
                              icon="edit"
                              label="Editar empleado"
                              onClick={() =>
                                startEditEmployee(employee)
                              }
                              variant="primary"
                            />

                            <IconButton
                              icon={employee.is_active ? 'lock' : 'unlock'}
                              label={employee.is_active ? 'Desactivar empleado' : 'Activar empleado'}
                              onClick={() =>
                                handleToggleEmployee(employee.id)
                              }
                              variant={
                                employee.is_active
                                  ? 'danger'
                                  : 'success'
                              }
                            />
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}

                  {
                    filteredEmployees.length === 0 && (
                      <tr>
                        <td
                          colSpan={
                            8 +
                            (
                              readOnly || user?.role === 'admin'
                                ? 1
                                : 0
                            ) +
                            (!readOnly ? 1 : 0)
                          }
                        >
                          No hay empleados para esos filtros.
                        </td>
                      </tr>
                    )
                  }
                </tbody>
              </table>
            </div>
          </>
        )
      }

      {
        directiveSummary && (
          <div className="modal-overlay">
            <div className="modal-content modal-content-wide directive-summary-modal">
              <div className="page-header">
                <div>
                  <h2 className="modal-title">
                    Resumen de {directiveSummary.employee.full_name}
                  </h2>
                  <p className="page-subtitle">
                    {directiveSummary.employee.department_name || 'Sin sector'} - Legajo {directiveSummary.employee.file_number || '-'}
                  </p>
                </div>
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() =>
                    setDirectiveSummary(null)
                  }
                >
                  Cerrar
                </button>
              </div>

              {loadingDirectiveSummary ? (
                <p>Cargando resumen...</p>
              ) : (
                <>
                  <div className="management-actions page-actions">
                    <button
                      className="btn-primary"
                      type="button"
                      onClick={() =>
                        setDirectivePrintMode('all')
                      }
                    >
                      Imprimir todo
                    </button>
                  </div>

                  <div className="dashboard-grid directive-key-grid">
                    {buildDirectiveKeyCards(directiveSummary).map((card) => (
                      <DirectiveKeyCard
                        key={card.mode}
                        card={card}
                        onPrint={() =>
                          setDirectivePrintMode(card.mode)
                        }
                      />
                    ))}
                  </div>

                  <div className="dashboard-grid legacy-summary-grid">
                    <div className="dashboard-card directive-hidden-card">
                      <h3 title="Antiguedad">Antiguedad</h3>
                      <p>{directiveSummary.employee.seniority_years}</p>
                      <span>Ingreso {formatDisplayDate(directiveSummary.employee.hire_date)}</span>
                      <button
                        className="card-print-button"
                        type="button"
                        onClick={() =>
                          setDirectivePrintMode('seniority')
                        }
                      >
                        Imprimir
                      </button>
                    </div>

                    <div className="dashboard-card">
                      <h3 title="Ausencias del año">Ausencias del año</h3>
                      <p>{directiveSummary.attendance.totals.ausencia || 0}</p>
                      <span>{directiveSummary.period.year}</span>
                      <button
                        className="card-print-button"
                        type="button"
                        onClick={() =>
                          setDirectivePrintMode('absences')
                        }
                      >
                        Imprimir
                      </button>
                    </div>

                    <div className="dashboard-card">
                      <h3 title="Licencias del año">Licencias del año</h3>
                      <p>{directiveSummary.attendance.totals.licencia || 0}</p>
                      <button
                        className="card-print-button"
                        type="button"
                        onClick={() =>
                          setDirectivePrintMode('leaves')
                        }
                      >
                        Imprimir
                      </button>
                      <span>Incluye articulos y permisos del año</span>
                    </div>

                    <div className="dashboard-card directive-hidden-card">
                      <h3 title="Vacaciones disponibles">Vacaciones disponibles</h3>
                      <p>{directiveSummary.balances.vacation.available_days}</p>
                      <span>Asignadas {directiveSummary.balances.vacation.allowed_days}</span>
                      <button
                        className="card-print-button"
                        type="button"
                        onClick={() =>
                          setDirectivePrintMode('vacation')
                        }
                      >
                        Imprimir
                      </button>
                    </div>

                    <div className="dashboard-card">
                      <h3 title="Clave 26">Clave 26</h3>
                      <p>{directiveSummary.balances.code26.remaining_days}</p>
                      <button
                        className="card-print-button"
                        type="button"
                        onClick={() =>
                          setDirectivePrintMode('code26')
                        }
                      >
                        Imprimir
                      </button>
                      <span>Restantes en el año</span>
                    </div>

                    <div className="dashboard-card">
                      <h3 title="Horas 24/43">Horas 24/43</h3>
                      <p>{directiveSummary.balances.hours24_43.remaining_hours_year}</p>
                      <span>Este mes quedan {directiveSummary.balances.hours24_43.remaining_hours_month} hs</span>
                      <button
                        className="card-print-button"
                        type="button"
                        onClick={() =>
                          setDirectivePrintMode('hours')
                        }
                      >
                        Imprimir
                      </button>
                    </div>

                    <div className="dashboard-card">
                      <h3 title="Clave 29">Clave 29</h3>
                      <p>{directiveSummary.balances.code29.remaining_days}</p>
                      <span>Dias restantes</span>
                      <button
                        className="card-print-button"
                        type="button"
                        onClick={() =>
                          setDirectivePrintMode('code29')
                        }
                      >
                        Imprimir
                      </button>
                    </div>

                    <div className="dashboard-card">
                      <h3 title="Compensatorios">Compensatorios</h3>
                      <p>{directiveSummary.balances.compensatory.remaining_days}</p>
                      <span>Ganados {directiveSummary.balances.compensatory.earned_days}</span>
                      <button
                        className="card-print-button"
                        type="button"
                        onClick={() =>
                          setDirectivePrintMode('compensatory')
                        }
                      >
                        Imprimir
                      </button>
                    </div>

                    <div className="dashboard-card directive-attendance-total-card">
                      <h3 title="Presentismo por clave">Presentismo por clave</h3>
                      <p>{directiveSummary.attendance.byCode.length}</p>
                      <span>Resumen anual completo</span>
                      <button
                        className="card-print-button"
                        type="button"
                        onClick={() =>
                          setDirectivePrintMode('attendance')
                        }
                      >
                        Imprimir
                      </button>
                    </div>

                    {buildDirectiveKeyCards(directiveSummary).map((card) => (
                      <DirectiveKeyCard
                        key={card.mode}
                        card={card}
                        onPrint={() =>
                          setDirectivePrintMode(card.mode)
                        }
                      />
                    ))}
                  </div>

                  <div className="dashboard-sections directive-detail-sections">
                    <section className="dashboard-panel">
                      <h2>Resumen anual por clave</h2>
                      <div className="dashboard-list">
                        {directiveSummary.attendance.byCode.map((item) => (
                          <div
                            className="dashboard-list-item"
                            key={item.code}
                          >
                            <strong>{item.code} - {item.description}</strong>
                            <span>{item.total} dias</span>
                            <span>{item.category}</span>
                          </div>
                        ))}
                        {directiveSummary.attendance.byCode.length === 0 && (
                          <p className="page-subtitle">
                            No hay presentismo cargado para este año.
                          </p>
                        )}
                      </div>
                    </section>

                    <section className="dashboard-panel dashboard-panel-wide">
                      <div className="panel-title-row">
                        <h2>Ultimas licencias</h2>
                        <button
                          className="btn-secondary"
                          type="button"
                          disabled={directiveSummary.recentLeaves.length === 0}
                          onClick={() =>
                            setPrintDirectiveLeaves(true)
                          }
                        >
                          Imprimir
                        </button>
                      </div>

                      {directiveSummary.recentLeaves.length === 0 ? (
                        <p className="page-subtitle">
                          No hay licencias recientes.
                        </p>
                      ) : (
                        <GroupedLeavesHistory
                          groups={groupLeaveRequestsByCode(
                            directiveSummary.recentLeaves
                          )}
                        />
                      )}
                    </section>

                    <section className="dashboard-panel dashboard-panel-wide">
                      <div className="panel-title-row">
                        <h2>Novedades de presentismo</h2>
                        <button
                          className="btn-secondary"
                          type="button"
                          disabled={directiveSummary.recentAttendance.length === 0}
                          onClick={() =>
                            setPrintDirectiveAttendance(true)
                          }
                        >
                          Imprimir
                        </button>
                      </div>

                      {directiveSummary.recentAttendance.length === 0 ? (
                        <p className="page-subtitle">
                          No hay novedades de presentismo para este año.
                        </p>
                      ) : (
                        <GroupedAttendanceHistory
                          groups={groupAttendanceRecordsByCode(
                            directiveSummary.recentAttendance
                          )}
                        />
                      )}
                    </section>
                  </div>
                </>
              )}
            </div>
          </div>
        )
      }

      {
        directivePrintMode &&
        directiveSummary && (
          <DirectiveSummaryPrintModal
            mode={directivePrintMode}
            summary={directiveSummary}
            user={user}
            onClose={() =>
              setDirectivePrintMode(null)
            }
          />
        )
      }

      {
        printDirectiveLeaves &&
        directiveSummary && (
          <EmployeeLeavesHistoryPrintModal
            summary={directiveSummary}
            user={user}
            onClose={() =>
              setPrintDirectiveLeaves(false)
            }
          />
        )
      }

      {
        printDirectiveAttendance &&
        directiveSummary && (
          <EmployeeAttendanceHistoryPrintModal
            summary={directiveSummary}
            user={user}
            onClose={() =>
              setPrintDirectiveAttendance(false)
            }
          />
        )
      }

      {
        printLeaveRequest && (
          <PermissionPrintModal
            request={printLeaveRequest}
            onClose={() =>
              setPrintLeaveRequest(null)
            }
          />
        )
      }

      {
        printLeaveSummary &&
        selectedLeaveEmployee &&
        leaveSummary && (
          <LeaveSummaryPrintModal
            employee={selectedLeaveEmployee}
            summary={leaveSummary}
            user={user}
            onClose={() =>
              setPrintLeaveSummary(false)
            }
          />
        )
      }

      {
        returnLeaveRequest && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h2 className="modal-title">
                Completar regreso
              </h2>
              <p className="modal-subtitle">
                {returnLeaveRequest.full_name}
              </p>
              <form onSubmit={completeReturnTime}>
                <input
                  className="form-input"
                  type="time"
                  value={returnForm.return_time}
                  onChange={(e) => {
                    const returnTime =
                      e.target.value;

                    setReturnForm({
                      ...returnForm,
                      return_time: returnTime,
                      total_hours:
                        calculateReturnPermissionHours(
                          returnLeaveRequest.exit_time,
                          returnTime
                        )
                    });
                  }}
                />
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="Horas a descontar"
                  value={returnForm.total_hours}
                  onChange={(e) =>
                    setReturnForm({
                      ...returnForm,
                      total_hours: e.target.value
                    })
                  }
                />
                <div className="modal-actions">
                  <button
                    className="btn-secondary"
                    type="button"
                    onClick={() =>
                      setReturnLeaveRequest(null)
                    }
                  >
                    Cancelar
                  </button>
                  <button
                    className="btn-primary"
                    type="submit"
                  >
                    Guardar regreso
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {
        isPersonnelSettingsPage &&
        canManageSettings &&
        activeTab === 'departments' && (
          <>
            <form
              className="management-form"
              onSubmit={handleDepartmentSubmit}
            >
              <select
                className="form-input"
                value={departmentForm.facility_id}
                onChange={(e) =>
                  setDepartmentForm({
                    ...departmentForm,
                    facility_id: e.target.value
                  })
                }
                disabled={!canSelectFacility}
              >
                <option value="">
                  Dependencia
                </option>
                {facilities.map((facility) => (
                  <option
                    key={facility.id}
                    value={facility.id}
                  >
                    {facility.name}
                  </option>
                ))}
              </select>

              <input
                className="form-input"
                placeholder="Nombre del sector"
                value={departmentForm.name}
                onChange={(e) =>
                  setDepartmentForm({
                    ...departmentForm,
                    name: e.target.value
                  })
                }
              />

              <input
                className="form-input"
                placeholder="Descripcion"
                value={departmentForm.description}
                onChange={(e) =>
                  setDepartmentForm({
                    ...departmentForm,
                    description: e.target.value
                  })
                }
              />

              <button
                className="btn-success"
                type="submit"
              >
                Crear sector
              </button>
            </form>

            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Dependencia</th>
                    <th>Sector</th>
                    <th>Descripcion</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {departments.map((department) => (
                    <tr key={department.id}>
                      <td>{department.facility_name || '-'}</td>
                      <td>{department.name}</td>
                      <td>{department.description || '-'}</td>
                      <td>
                        {
                          department.is_active
                            ? 'Activo'
                            : 'Inactivo'
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )
      }

      {
        isPersonnelSettingsPage &&
        canManageSettings &&
        activeTab === 'codes' && (
          <>
            <form
              className="personnel-form"
              onSubmit={handleCodeSubmit}
            >
              <input
                className="form-input"
                name="code"
                placeholder="Clave"
                value={codeForm.code}
                onChange={handleCodeFormChange}
              />

              <input
                className="form-input"
                name="description"
                placeholder="Descripcion"
                value={codeForm.description}
                onChange={handleCodeFormChange}
              />

              <select
                className="form-input"
                name="category"
                value={codeForm.category}
                onChange={handleCodeFormChange}
              >
                {codeCategories.map((category) => (
                  <option
                    key={category}
                    value={category}
                  >
                    {category}
                  </option>
                ))}
              </select>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  name="counts_as_present"
                  checked={codeForm.counts_as_present}
                  onChange={handleCodeFormChange}
                />
                Cuenta como presente
              </label>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  name="requires_approval"
                  checked={codeForm.requires_approval}
                  onChange={handleCodeFormChange}
                />
                Requiere aprobacion
              </label>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  name="requires_documentation"
                  checked={codeForm.requires_documentation}
                  onChange={handleCodeFormChange}
                />
                Documentacion
              </label>

              <button
                className="btn-success"
                type="submit"
              >
                Crear clave
              </button>
            </form>

            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Clave</th>
                    <th>Descripcion</th>
                    <th>Categoria</th>
                    <th>Presente</th>
                    <th>Aprueba</th>
                    <th>Documentacion</th>
                    <th>Sueldo</th>
                    <th>Limite anual</th>
                    <th>Anticipacion</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {codes.map((code) => (
                    <tr key={code.id}>
                      <td>
                        <input
                          className="attendance-code-input"
                          defaultValue={code.code}
                          onBlur={(e) =>
                            updateCode(
                              code,
                              {
                                code:
                                  e.target.value
                                    .trim()
                                    .toUpperCase()
                              }
                            )
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="form-input"
                          defaultValue={code.description}
                          onBlur={(e) =>
                            updateCode(
                              code,
                              {
                                description:
                                  e.target.value
                              }
                            )
                          }
                        />
                      </td>
                      <td>
                        <select
                          className="form-input"
                          defaultValue={code.category}
                          onChange={(e) =>
                            updateCode(
                              code,
                              {
                                category:
                                  e.target.value
                              }
                            )
                          }
                        >
                          {codeCategories.map((category) => (
                            <option
                              key={category}
                              value={category}
                            >
                              {category}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          defaultChecked={code.counts_as_present}
                          onChange={(e) =>
                            updateCode(
                              code,
                              {
                                counts_as_present:
                                  e.target.checked
                              }
                            )
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          defaultChecked={code.requires_approval}
                          onChange={(e) =>
                            updateCode(
                              code,
                              {
                                requires_approval:
                                  e.target.checked
                              }
                            )
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          defaultChecked={code.requires_documentation}
                          onChange={(e) =>
                            updateCode(
                              code,
                              {
                                requires_documentation:
                                  e.target.checked
                              }
                            )
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          defaultChecked={code.affects_salary}
                          onChange={(e) =>
                            updateCode(
                              code,
                              {
                                affects_salary:
                                  e.target.checked
                              }
                            )
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="attendance-code-input"
                          type="number"
                          defaultValue={
                            code.annual_limit_days || ''
                          }
                          onBlur={(e) =>
                            updateCode(
                              code,
                              {
                                annual_limit_days:
                                  e.target.value
                                    ? Number(e.target.value)
                                    : null
                              }
                            )
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="attendance-code-input"
                          type="number"
                          defaultValue={
                            code.advance_notice_days || ''
                          }
                          onBlur={(e) =>
                            updateCode(
                              code,
                              {
                                advance_notice_days:
                                  e.target.value
                                    ? Number(e.target.value)
                                    : null
                              }
                            )
                          }
                        />
                      </td>
                      <td>
                        <select
                          className="form-input"
                          defaultValue={
                            code.is_active
                              ? 'true'
                              : 'false'
                          }
                          onChange={(e) =>
                            updateCode(
                              code,
                              {
                                is_active:
                                  e.target.value === 'true'
                              }
                            )
                          }
                        >
                          <option value="true">Activa</option>
                          <option value="false">Inactiva</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )
      }

      {
        !isPersonnelSettingsPage &&
        activeTab === 'planned-days-off' && (
          <>
            <div className="attendance-toolbar">
              <input
                className="form-input attendance-filter-small"
                type="month"
                value={attendanceMonthValue}
                onChange={(e) => {
                  if (!e.target.value) {
                    return;
                  }

                  const [
                    year,
                    month
                  ] = e.target.value.split('-');

                  updateAttendanceFilters({
                    year,
                    month
                  });
                }}
              />

              <select
                className="form-input attendance-filter-wide"
                value={attendanceFilters.facility_id}
                onChange={(e) =>
                  updateAttendanceFilters({
                    facility_id: e.target.value,
                    department: 'todos'
                  })
                }
                disabled={!canSelectFacility}
              >
                {canSelectFacility && (
                  <option value="todos">
                    Todas las dependencias
                  </option>
                )}
                {facilities.map((facility) => (
                  <option
                    key={facility.id}
                    value={facility.id}
                  >
                    {facility.name}
                  </option>
                ))}
              </select>

              <select
                className="form-input attendance-filter-wide"
                value={attendanceFilters.department}
                onChange={(e) =>
                  updateAttendanceFilters({
                    department: e.target.value
                  })
                }
              >
                <option value="todos">Todos los sectores</option>
                {departmentsForFacility(
                  attendanceFilters.facility_id
                ).map((department) => (
                  <option
                    key={department.id}
                    value={department.id}
                  >
                    {department.name}
                  </option>
                ))}
              </select>

              <input
                className="form-input attendance-filter-wide"
                placeholder="Filtrar sector"
                value={attendanceFilters.departmentSearch}
                onChange={(e) =>
                  updateAttendanceFilters({
                    departmentSearch: e.target.value
                  })
                }
              />

              <input
                className="form-input attendance-filter-search"
                placeholder="Buscar nombre, DNI o legajo"
                value={attendanceFilters.search}
                onChange={(e) =>
                  updateAttendanceFilters({
                    search: e.target.value
                  })
                }
              />

              <button
                className="btn-success"
                type="button"
                disabled={
                  savingPlannedOff ||
                  Object.keys(plannedOffEdits).length === 0
                }
                onClick={savePlannedDaysOff}
              >
                {
                  savingPlannedOff
                    ? 'Guardando...'
                    : 'Guardar francos'
                }
              </button>
            </div>

            <p className="results-summary">
              {filteredPlannedOffRows.length} de {plannedOffRows.length} empleados activos. Cambios pendientes: {Object.keys(plannedOffEdits).length}
            </p>

            <div className="attendance-grid-wrap">
              <table className="data-table attendance-grid planned-off-grid">
                <colgroup>
                  <col className="attendance-employee-col" />
                  {plannedOffDayNumbers.map((day) => (
                    <col
                      key={day}
                      className="attendance-day-col"
                    />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    <th className="attendance-employee-cell">
                      Empleado
                    </th>
                    {plannedOffDayNumbers.map((day) => (
                      <th
                        key={day}
                        className={
                          isSunday(day)
                            ? 'attendance-sunday'
                            : ''
                        }
                      >
                        {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredPlannedOffRows.map((employee) => (
                    <tr key={employee.id}>
                      <td className="attendance-employee-cell">
                        <button
                          className="text-link-button"
                          type="button"
                          onClick={() =>
                            openEmployeeAttendance(employee)
                          }
                          title="Ver presentismo del empleado"
                        >
                          {employee.full_name}
                        </button>
                        <span>
                          {employee.department_name || 'Sin sector'}
                        </span>
                      </td>
                      {plannedOffDayNumbers.map((day) => (
                        <td
                          key={day}
                          className={
                            isSunday(day)
                              ? 'attendance-sunday-cell'
                              : ''
                          }
                        >
                          <label
                            className="planned-off-cell"
                            title="Franco programado"
                          >
                            <input
                              type="checkbox"
                              checked={getPlannedOffValue(
                                employee,
                                day
                              )}
                              onChange={(e) =>
                                updatePlannedOffCell(
                                  employee.id,
                                  day,
                                  e.target.checked
                                )
                              }
                            />
                          </label>
                        </td>
                      ))}
                    </tr>
                  ))}

                  {filteredPlannedOffRows.length === 0 && (
                    <tr>
                      <td colSpan={plannedOffDays + 1}>
                        No hay empleados activos para esos filtros.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )
      }

      {
        !isPersonnelSettingsPage &&
        activeTab === 'attendance' && (
          <>
            <div className="attendance-view-toggle">
              <span className="attendance-view-toggle-label">
                Vista
              </span>
              <button
                className={
                  attendanceViewMode === 'month'
                    ? 'attendance-view-toggle-button attendance-view-toggle-button-active'
                    : 'attendance-view-toggle-button'
                }
                type="button"
                onClick={() => {
                  if (!confirmDiscardAttendanceChanges()) {
                    return;
                  }
                  setAttendanceEdits({});
                  setAnnualAttendanceEdits({});
                  setAttendanceViewMode('month');
                }}
              >
                Por mes
              </button>

              <button
                className={
                  attendanceViewMode === 'employee'
                    ? 'attendance-view-toggle-button attendance-view-toggle-button-active'
                    : 'attendance-view-toggle-button'
                }
                type="button"
                onClick={() => {
                  if (!confirmDiscardAttendanceChanges()) {
                    return;
                  }
                  setAttendanceEdits({});
                  setAnnualAttendanceEdits({});
                  setAttendanceViewMode('employee');
                }}
              >
                Por empleado
              </button>
            </div>

            <div className="attendance-toolbar">
              <input
                className="form-input attendance-filter-small"
                type={
                  attendanceViewMode === 'month'
                    ? 'month'
                    : 'number'
                }
                value={
                  attendanceViewMode === 'month'
                    ? attendanceMonthValue
                    : attendanceFilters.year
                }
                onChange={(e) => {
                  if (attendanceViewMode === 'employee') {
                    updateAttendanceFilters({
                      year: e.target.value
                    }, true);
                    return;
                  }

                  const [
                    year,
                    month
                  ] = e.target.value.split('-');

                  if (!year || !month) {
                    return;
                  }

                  updateAttendanceFilters({
                    year,
                    month: String(Number(month)),
                    day: String(
                      Math.min(
                        Number(attendanceFilters.day || 1),
                        new Date(
                          Number(year),
                          Number(month),
                          0
                        ).getDate()
                      )
                    ),
                    department: 'todos'
                  }, true);
                }}
              />

              <select
                className="form-input attendance-filter-wide"
                value={attendanceFilters.facility_id}
                onChange={(e) =>
                  updateAttendanceFilters({
                    facility_id: e.target.value,
                    department: 'todos'
                  })
                }
                disabled={!canSelectFacility}
              >
                {canSelectFacility && (
                  <option value="todos">
                    Todas las dependencias
                  </option>
                )}
                {facilities.map((facility) => (
                  <option
                    key={facility.id}
                    value={facility.id}
                  >
                    {facility.name}
                  </option>
                ))}
              </select>

              {
                attendanceViewMode === 'month' && (
                  <>
                    <input
                      className="form-input attendance-filter-wide"
                      placeholder="Filtrar sector"
                      value={attendanceFilters.departmentSearch}
                      onChange={(e) =>
                        updateAttendanceFilters({
                          departmentSearch: e.target.value,
                          department: 'todos'
                        })
                      }
                    />

                    <input
                      className="form-input attendance-filter-search"
                      placeholder="Buscar nombre, DNI o legajo"
                      value={attendanceFilters.search}
                      onChange={(e) =>
                        updateAttendanceFilters({
                          search: e.target.value
                        })
                      }
                    />
                  </>
                )
              }

              {
                attendanceViewMode === 'employee' && (
                  <>
                    <input
                      className="form-input attendance-filter-search"
                      placeholder="Buscar empleado"
                      value={annualAttendanceEmployeeSearch}
                      onChange={(e) =>
                        setAnnualAttendanceEmployeeSearch(
                          e.target.value
                        )
                      }
                    />

                    <select
                      className="form-input attendance-filter-wide"
                      value={annualAttendanceEmployeeId}
                      onChange={(e) => {
                        if (!confirmDiscardAttendanceChanges()) {
                          return;
                        }

                        setAnnualAttendanceEmployeeId(
                          e.target.value
                        );
                        setAnnualAttendanceEdits({});

                        if (e.target.value) {
                          loadAnnualAttendance(
                            e.target.value
                          );
                        } else {
                          setAnnualAttendanceEmployee(null);
                          setAnnualAttendanceMonths([]);
                        }
                      }}
                    >
                      <option value="">
                        Seleccionar empleado
                      </option>
                      {annualAttendanceEmployeeOptions.map((employee) => (
                        <option
                          key={employee.id}
                          value={employee.id}
                        >
                          {employee.full_name}
                        </option>
                      ))}
                    </select>
                  </>
                )
              }

              <button
                className="btn-primary"
                type="button"
                onClick={() => {
                  if (!confirmDiscardAttendanceChanges()) {
                    return;
                  }
                  setAttendanceEdits({});
                  setAnnualAttendanceEdits({});
                  loadAttendance();
                  if (attendanceViewMode === 'employee') {
                    loadAnnualAttendance();
                  }
                }}
              >
                Actualizar
              </button>

              <button
                className="btn-success"
                type="button"
                disabled={
                  savingAttendance ||
                  (
                    attendanceViewMode === 'month'
                      ? Object.keys(attendanceEdits).length === 0
                      : Object.keys(annualAttendanceEdits).length === 0
                  ) ||
                  attendanceReadOnly
                }
                onClick={
                  attendanceViewMode === 'month'
                    ? saveAttendance
                    : saveAnnualAttendance
                }
              >
                {
                  savingAttendance
                    ? 'Guardando...'
                    : 'Guardar cambios'
                }
              </button>
            </div>

            {
              attendanceViewMode === 'month' && (
                <p className="results-summary">
                  {filteredAttendanceRows.length} de {attendanceRows.length} empleados activos. Cambios pendientes: {Object.keys(attendanceEdits).length}
                </p>
              )
            }

            {
              attendanceViewMode === 'employee' && (
                <p className="results-summary">
                  {
                    annualAttendanceEmployee
                      ? `${annualAttendanceEmployee.full_name} - ${annualAttendanceEmployee.department_name || 'Sin sector'}`
                      : 'Selecciona un empleado para ver el presentismo anual.'
                  } Cambios pendientes: {Object.keys(annualAttendanceEdits).length}
                </p>
              )
            }

            {
              attendanceViewMode === 'month' && (
                <div className="attendance-layout">
                  <div
                    className="attendance-grid-wrap"
                    ref={attendanceGridRef}
                  >
                    <table className="data-table attendance-grid">
                      <colgroup>
                        <col className="attendance-employee-col" />
                        {dayNumbers.map((day) => (
                          <col
                            key={day}
                            className="attendance-day-col"
                          />
                        ))}
                      </colgroup>
                      <thead>
                        <tr>
                          <th className="attendance-employee-cell">
                            Empleado
                          </th>
                          {dayNumbers.map((day) => (
                            <th
                              key={day}
                              className={
                                isSunday(day)
                                  ? 'attendance-sunday'
                                  : ''
                              }
                            >
                              {day}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAttendanceRows.map((employee, rowIndex) => (
                          <tr key={employee.id}>
                            <td className="attendance-employee-cell">
                              <strong>{employee.full_name}</strong>
                              <span>
                                {employee.department_name || 'Sin sector'}
                              </span>
                            </td>
                            {dayNumbers.map((day) => {
                              const lockedCell =
                                isAttendanceCellLocked(
                                  employee,
                                  day
                                );

                              return (
                                <td
                                  key={day}
                                  className={
                                    isSunday(day)
                                      ? 'attendance-sunday-cell'
                                      : ''
                                  }
                                >
                                  <input
                                    data-attendance-row={rowIndex}
                                    data-attendance-day={day}
                                    className={getAttendanceInputClass(
                                      employee,
                                      day
                                    )}
                                    value={getAttendanceValue(
                                      employee,
                                      day
                                    )}
                                    placeholder={
                                      hasPlannedDayOff(employee, day)
                                        ? 'F'
                                        : ''
                                    }
                                    title={getAttendanceCodeDescription(
                                      employee,
                                      day
                                    )}
                                    onChange={(e) =>
                                      !attendanceReadOnly &&
                                      !lockedCell &&
                                      updateAttendanceCell(
                                        employee,
                                        day,
                                        e.target.value
                                      )
                                    }
                                    onBlur={() =>
                                      !attendanceReadOnly &&
                                      !lockedCell &&
                                      validateAttendanceCellOnBlur(
                                        employee.id,
                                        day
                                      )
                                    }
                                    disabled={lockedCell}
                                    readOnly={attendanceReadOnly}
                                    onKeyDown={(e) =>
                                      handleAttendanceKeyDown(
                                        e,
                                        rowIndex,
                                        day
                                      )
                                    }
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        ))}

                        {
                          filteredAttendanceRows.length === 0 && (
                            <tr>
                              <td colSpan={attendanceDays + 1}>
                                No hay empleados activos para esos filtros.
                              </td>
                            </tr>
                          )
                        }
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            }

            {
              attendanceViewMode === 'employee' && (
                <div className="attendance-layout">
                  <div className="attendance-grid-wrap attendance-year-grid-wrap">
                    <table className="data-table attendance-grid attendance-year-grid">
                      <colgroup>
                        <col className="attendance-employee-col" />
                        {annualDayNumbers.map((day) => (
                          <col
                            key={day}
                            className="attendance-day-col"
                          />
                        ))}
                      </colgroup>
                      <thead>
                        <tr>
                          <th className="attendance-employee-cell">
                            Mes
                          </th>
                          {annualDayNumbers.map((day) => (
                            <th key={day}>
                              {day}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {
                          loadingAnnualAttendance && (
                            <tr>
                              <td colSpan={32}>
                                Cargando presentismo anual...
                              </td>
                            </tr>
                          )
                        }

                        {
                          !loadingAnnualAttendance &&
                          !annualAttendanceEmployee && (
                            <tr>
                              <td colSpan={32}>
                                Selecciona un empleado para ver el anio completo.
                              </td>
                            </tr>
                          )
                        }

                        {
                          !loadingAnnualAttendance &&
                          annualAttendanceMonths.map((monthRow, rowIndex) => (
                            <tr key={monthRow.month}>
                              <td className="attendance-employee-cell">
                                <strong>
                                  {monthNames[monthRow.month - 1]}
                                </strong>
                                <span>
                                  {attendanceFilters.year}
                                </span>
                              </td>
                              {annualDayNumbers.map((day) => {
                                const dayExists =
                                  day <= monthRow.days;

                                const lockedCell =
                                  dayExists &&
                                  isAnnualAttendanceCellLocked(
                                    monthRow,
                                    day
                                  );

                                return (
                                  <td
                                    key={day}
                                    className={
                                      dayExists &&
                                      isSundayForDate(
                                        monthRow.month,
                                        day
                                      )
                                        ? 'attendance-sunday-cell'
                                        : ''
                                    }
                                  >
                                    <input
                                      data-annual-attendance-row={rowIndex}
                                      data-annual-attendance-day={day}
                                      className={
                                        dayExists
                                          ? getAnnualAttendanceInputClass(
                                            monthRow,
                                            day
                                          )
                                          : 'attendance-code-input attendance-code-empty'
                                      }
                                      value={
                                        dayExists
                                          ? getAnnualAttendanceValue(
                                            monthRow,
                                            day
                                          )
                                          : ''
                                      }
                                      placeholder={
                                        dayExists &&
                                        monthRow.attendance[String(day)]
                                          ?.planned_off
                                          ? 'F'
                                          : ''
                                      }
                                      title={
                                        dayExists
                                          ? getAnnualAttendanceCodeDescription(
                                            monthRow,
                                            day
                                          )
                                          : ''
                                      }
                                      onChange={(e) =>
                                        dayExists &&
                                        !attendanceReadOnly &&
                                        !lockedCell &&
                                        updateAnnualAttendanceCell(
                                          monthRow,
                                          monthRow.month,
                                          day,
                                          e.target.value
                                        )
                                      }
                                      onBlur={() =>
                                        dayExists &&
                                        !attendanceReadOnly &&
                                        !lockedCell &&
                                        validateAnnualAttendanceCellOnBlur(
                                          monthRow.month,
                                          day
                                        )
                                      }
                                      disabled={!dayExists || lockedCell}
                                      readOnly={attendanceReadOnly}
                                      onKeyDown={(e) =>
                                        handleAnnualAttendanceKeyDown(
                                          e,
                                          rowIndex,
                                          day
                                        )
                                      }
                                    />
                                  </td>
                                );
                              })}
                            </tr>
                          ))
                        }
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            }
          </>
        )
      }

      {
        !isPersonnelSettingsPage &&
        activeTab === 'leaves' && (
          <>
            


              <div className="filter-bar">
                <input
                  className="form-input"
                  placeholder="Buscar por empleado, DNI, legajo, sector o dependencia"
                  value={leaveEmployeeSearch}
                  onChange={(e) => {
                    setLeaveEmployeePage(0);
                    setLeaveEmployeeSearch(e.target.value);
                    clearSelectedLeaveEmployee();
                  }}
                />

                <select
                  className="form-input"
                  value={filters.facility_id}
                  onChange={(e) => {
                    setLeaveEmployeePage(0);
                    clearSelectedLeaveEmployee();
                    setFilters({
                      ...filters,
                      facility_id: e.target.value,
                      page: 1
                    });
                  }}
                  disabled={!canSelectFacility}
                >
                  {canSelectFacility && (
                    <option value="todos">
                      Todas las dependencias
                    </option>
                  )}
                  {facilities.map((facility) => (
                    <option
                      key={facility.id}
                      value={facility.id}
                    >
                      {facility.name}
                    </option>
                  ))}
                </select>
              </div>

              <p className="results-summary">
                Mostrando {paginatedLeaveEmployees.length} de {filteredLeaveEmployees.length} empleados
              </p>

              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Empleado</th>
                      <th>DNI</th>
                      <th>Legajo</th>
                      <th>Dependencia</th>
                      <th>Sector</th>
                      <th>Ingreso</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedLeaveEmployees.map((employee) => (
                      <tr
                        key={employee.id}
                        className={
                          selectedLeaveEmployee?.id === employee.id
                            ? 'selected-row'
                            : ''
                        }
                      >
                        <td>
                          <button
                            className="text-link-button"
                            type="button"
                            onClick={() =>
                              openEmployeeAttendance(employee)
                            }
                            title="Ver presentismo del empleado"
                          >
                            {employee.full_name}
                          </button>
                        </td>
                        <td>{employee.dni || '-'}</td>
                        <td>{employee.file_number || '-'}</td>
                        <td>{employee.facility_name || '-'}</td>
                        <td>{employee.department_name || '-'}</td>
                        <td>{formatDisplayDate(employee.hire_date)}</td>
                        <td>
                          <button
                            className="btn-primary"
                            type="button"
                            onClick={() =>
                              selectLeaveEmployee(employee)
                            }
                          >
                            Seleccionar
                          </button>
                        </td>
                      </tr>
                    ))}

                    {
                      paginatedLeaveEmployees.length === 0 && (
                        <tr>
                          <td colSpan={6}>
                            No hay empleados para ese filtro.
                          </td>
                        </tr>
                      )
                    }
                  </tbody>
                </table>
              </div>

              <div className="pagination-bar">
                <span />
                <div className="table-actions">
                  <button
                    className="btn-secondary"
                    type="button"
                    disabled={leaveEmployeePage === 0}
                    onClick={() =>
                      setLeaveEmployeePage(
                        Math.max(
                          0,
                          leaveEmployeePage - 1
                        )
                      )
                    }
                  >
                    Anterior
                  </button>
                  <span>
                    {leaveEmployeePage + 1} / {leaveEmployeePageCount}
                  </span>
                  <button
                    className="btn-secondary"
                    type="button"
                    disabled={
                      leaveEmployeePage + 1 >=
                      leaveEmployeePageCount
                    }
                    onClick={() =>
                      setLeaveEmployeePage(
                        Math.min(
                          leaveEmployeePageCount - 1,
                          leaveEmployeePage + 1
                        )
                      )
                    }
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            

            {
              selectedLeaveEmployee && leaveSummary && (
                <>
                <div className="management-actions page-actions">
                  <button
                    className="btn-secondary"
                    type="button"
                    onClick={() =>
                      setPrintLeaveSummary(true)
                    }
                  >
                    Imprimir resumen
                  </button>
                </div>
                <div className="dashboard-grid">
                  <div className="dashboard-card">
                    <h3>Vacaciones clave 8</h3>
                    <p>{leaveSummary.vacation.available_days}</p>
                    <span>
                      Asignadas {leaveSummary.vacation.allowed_days}, usadas {leaveSummary.vacation.used_days}, pendientes {leaveSummary.vacation.pending_days}
                    </span>
                  </div>
                  <div className="dashboard-card">
                    <h3>Clave 26</h3>
                    <p>{leaveSummary.code26.remaining_days}</p>
                    <span>
                      Usados {leaveSummary.code26.used_days}, pendientes {leaveSummary.code26.pending_days}. Este mes quedan {leaveSummary.code26.remaining_this_month}
                    </span>
                  </div>
                  <div className="dashboard-card">
                    <h3>Horas 24 / 43</h3>
                    <p>{leaveSummary.hours24_43.remaining_hours_year}</p>
                    <span>
                      Este mes quedan {leaveSummary.hours24_43.remaining_hours_month} hs. Usadas año {leaveSummary.hours24_43.used_hours_year} hs
                    </span>
                  </div>
                  <div className="dashboard-card">
                    <h3>Clave 29</h3>
                    <p>{leaveSummary.code29.remaining_days}</p>
                    <span>
                      Asignados {leaveSummary.code29.allowed_days}, usados {leaveSummary.code29.used_days}, pendientes {leaveSummary.code29.pending_days}
                    </span>
                  </div>
                  <div className="dashboard-card">
                    <h3>Compensatorios</h3>
                    <p>{leaveSummary.compensatory.remaining_days}</p>
                    <span>
                      Ganados {leaveSummary.compensatory.earned_days}, usados {leaveSummary.compensatory.used_days}, pendientes {leaveSummary.compensatory.pending_days}
                    </span>
                  </div>
                </div>
                </>
              )
            }

            {canManageLeaves && (
              <div className="management-actions page-actions">
                <button
                  className="btn-primary"
                  type="button"
                  disabled={!selectedLeaveEmployee}
                  onClick={() => {
                    setEditingLeaveRequest(null);
                    setLeaveForm({
                      ...emptyLeaveForm,
                      employee_id:
                        selectedLeaveEmployee
                          ? String(selectedLeaveEmployee.id)
                          : '',
                      shift_label: ''
                    });
                    setShowLeaveFormModal(true);
                  }}
                >
                  + Nueva solicitud de licencia
                </button>
              </div>
            )}

            {canManageLeaves && showLeaveFormModal && (
            <div className="modal-overlay">
              <div className="modal-content modal-content-wide">
                <button
                  className="modal-close-button"
                  type="button"
                  onClick={resetLeaveForm}
                >
                  x
                </button>
                <h2 className="modal-title">
                  {
                    editingLeaveRequest
                      ? 'Editar solicitud de licencia'
                      : 'Nueva solicitud de licencia'
                  }
                </h2>
                <form
                  className="personnel-form"
                  onSubmit={handleLeaveSubmit}
                >
              {editingLeaveRequest && (
                <div className="form-note">
                  Editando licencia #{editingLeaveRequest.id}. Al guardar se recalculan los dias y el presentismo si corresponde.
                </div>
              )}

              <input
                className="form-input"
                value={
                  selectedLeaveEmployee
                    ? selectedLeaveEmployee.full_name
                    : 'Seleccione un empleado'
                }
                disabled
              />

              <div className="form-info-line">
                {formatEmployeeLeaveSchedule(selectedLeaveEmployee)}
              </div>

              <select
                className="form-input"
                name="code"
                value={leaveForm.code}
                onChange={handleLeaveChange}
              >
                {codes
                  .filter((code) =>
                    leaveCodeOptions.includes(code.code)
                  )
                  .map((code) => (
                    <option
                      key={code.id}
                      value={code.code}
                    >
                      {code.code} - {code.description}
                    </option>
                  ))}
              </select>

              {isSingleDayLeaveCode(leaveForm.code) ? (
                <input
                  className="form-input"
                  type="date"
                  name="start_date"
                  aria-label="Fecha"
                  value={leaveForm.start_date}
                  onChange={handleLeaveChange}
                />
              ) : (
                <>
                  <input
                    className="form-input"
                    type="date"
                    name="start_date"
                    aria-label="Fecha desde"
                    value={leaveForm.start_date}
                    onChange={handleLeaveChange}
                  />

                  <input
                    className="form-input"
                    type="date"
                    name="end_date"
                    aria-label="Fecha hasta"
                    value={leaveForm.end_date}
                    onChange={handleLeaveChange}
                  />
                </>
              )}

              {['24', '35', '46'].includes(leaveForm.code) && (
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  step="0.5"
                  name="total_hours"
                  placeholder="Horas a descontar"
                  value={leaveForm.total_hours}
                  onChange={handleLeaveChange}
                />
              )}

              {['24', '43'].includes(leaveForm.code) && (
                <>
                  <select
                    className="form-input"
                    name="exit_reason"
                    value={leaveForm.exit_reason}
                    onChange={handleLeaveChange}
                  >
                    <option value="particular">
                      Motivo particular
                    </option>
                    <option value="tramite_oficial">
                      Tramite oficial
                    </option>
                  </select>

                  <input
                    className="form-input"
                    type="time"
                    name="exit_time"
                    aria-label={
                      leaveForm.code === '24'
                        ? 'Hora entrada'
                        : 'Hora salida'
                    }
                    value={leaveForm.exit_time}
                    onChange={handleLeaveChange}
                  />

                  {leaveForm.code === '43' && (
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        name="no_return"
                        checked={leaveForm.no_return}
                        onChange={handleLeaveChange}
                      />
                      Sin retorno
                    </label>
                  )}

                  {leaveForm.code === '43' &&
                    leaveForm.no_return && (
                    <input
                      className="form-input"
                      type="number"
                      min="0"
                      step="0.5"
                      name="total_hours"
                      placeholder="Horas a descontar"
                      value={leaveForm.total_hours}
                      onChange={handleLeaveChange}
                    />
                  )}

                </>
              )}

              {leaveForm.code === '26' && (
                <select
                  className="form-input"
                  name="shift_label"
                  value={leaveForm.shift_label}
                  onChange={handleLeaveChange}
                >
                  <option value="">
                    Seleccione turno
                  </option>
                  {workShiftOptions.map((shift) => (
                    <option
                      key={shift}
                      value={workShiftLabels[shift]}
                    >
                      {workShiftLabels[shift]}
                    </option>
                  ))}
                </select>
              )}

              {['17', '18'].includes(leaveForm.code) && (
                <select
                  className="form-input"
                  name="exam_type"
                  value={leaveForm.exam_type}
                  onChange={handleLeaveChange}
                >
                  <option value="">
                    Seleccione tipo de examen
                  </option>
                  {examLicenseOptions.map((option) => (
                    <option
                      key={option}
                      value={option}
                    >
                      {option}
                    </option>
                  ))}
                </select>
              )}

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  name="is_exception"
                  checked={leaveForm.is_exception}
                  onChange={handleLeaveChange}
                />
                Excepcion autorizada
              </label>

              <input
                className="form-input"
                name="exception_reason"
                placeholder="Motivo de excepcion"
                value={leaveForm.exception_reason}
                onChange={handleLeaveChange}
              />

              <textarea
                className="form-input personnel-notes"
                name="notes"
                placeholder="Notas"
                rows={3}
                value={leaveForm.notes}
                onChange={handleLeaveChange}
              />

              <button
                className={
                  editingLeaveRequest
                    ? 'btn-primary'
                    : 'btn-success'
                }
                type="submit"
                disabled={!selectedLeaveEmployee}
              >
                {
                  editingLeaveRequest
                    ? 'Guardar cambios'
                    : 'Crear solicitud'
                }
              </button>

              {editingLeaveRequest && (
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={resetLeaveForm}
                >
                  Cancelar edicion
                </button>
              )}
            </form>
              </div>
            </div>
            )}

            <div className="filter-bar">
              <select
                className="form-input"
                value={leaveRequestYearFilter}
                onChange={(e) =>
                  setLeaveRequestYearFilter(e.target.value)
                }
                disabled={!selectedLeaveEmployee}
              >
                <option value="todos">
                  Todos los anos
                </option>
                {selectedEmployeeLeaveYears.map((year) => (
                  <option
                    key={year}
                    value={year}
                  >
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Empleado</th>
                    <th>Clave</th>
                    <th>Desde</th>
                    <th>Hasta</th>
                    <th>Dias</th>
                    <th>Horas</th>
                    <th>Estado</th>
                    {canSeeLeaveCreator && (
                      <>
                        <th>Cargada por</th>
                        <th>Editada por</th>
                        <th>Resuelta por</th>
                      </>
                    )}
                    {canManageLeaves && (
                      <th>Acciones</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {selectedEmployeeLeaveRequests.map((request) => (
                    <tr key={request.id}>
                      <td>
                        <button
                          className="text-link-button"
                          type="button"
                          onClick={() =>
                            openEmployeeAttendance({
                              id: request.employee_id,
                              full_name: request.full_name
                            })
                          }
                          title="Ver presentismo del empleado"
                        >
                          {request.full_name}
                        </button>
                        <br />
                        <span>{request.department_name || '-'}</span>
                      </td>
                      <td>
                        {request.code} - {request.description}
                      </td>
                      <td>{formatDisplayDate(request.start_date)}</td>
                      <td>
                        {isSingleDayLeaveCode(request.code)
                          ? '-'
                          : formatDisplayDate(request.end_date)}
                      </td>
                      <td>{request.total_days || '-'}</td>
                      <td>{request.total_hours || '-'}</td>
                      <td>
                        <span
                          className={
                            request.status === 'aprobado'
                              ? 'badge badge-success'
                              : request.status === 'rechazado'
                                ? 'badge badge-danger'
                                : 'badge'
                          }
                        >
                          {request.status}
                        </span>
                      </td>
                      {canSeeLeaveCreator && (
                        <td>
                          <PersonDateCell
                            name={request.requested_by_name}
                            date={request.requested_at}
                          />
                        </td>
                      )}
                      {canSeeLeaveCreator && (
                        <td>
                          <PersonDateCell
                            name={request.edited_by_name}
                            date={request.edited_at}
                          />
                        </td>
                      )}
                      {canSeeLeaveCreator && (
                        <td>
                          <PersonDateCell
                            name={request.approved_by_name}
                            date={request.approved_at}
                            empty={
                              request.status === 'pendiente'
                                ? 'Pendiente'
                                : '-'
                            }
                          />
                        </td>
                      )}
                      {canManageLeaves && (
                        <td>
                        <div className="table-actions">
                          {canEditLeaveRequest(request) && (
                            <IconButton
                              icon="edit"
                              label="Editar licencia"
                              onClick={() =>
                                startEditLeaveRequest(request)
                              }
                              variant="primary"
                            />
                          )}

                          {isPrintableLeaveCode(request.code) &&
                            !isCancelledLeaveRequest(request) && (
                            <IconButton
                              icon="print"
                              label="Imprimir comprobante"
                              onClick={() =>
                                setPrintLeaveRequest(request)
                              }
                              variant="secondary"
                            />
                          )}

                          {canManageLeaves &&
                            request.code === '43' &&
                            !request.no_return &&
                            (!request.return_time || !Number(request.total_hours || 0)) && (
                              <IconButton
                                icon="check"
                                label="Completar regreso"
                                onClick={() => {
                                  const returnTime =
                                    request.return_time || '';

                                  setReturnLeaveRequest(request);
                                  setReturnForm({
                                    return_time: returnTime,
                                    total_hours: request.total_hours
                                      ? String(request.total_hours)
                                      : calculateReturnPermissionHours(
                                        request.exit_time,
                                        returnTime
                                      )
                                  });
                                }}
                                variant="primary"
                              />
                            )}

                          {
                            canApproveLeaves &&
                            request.status === 'pendiente' && (
                              <>
                                <IconButton
                                  icon="check"
                                  label="Aprobar licencia"
                                  onClick={() =>
                                    updateLeaveStatus(
                                      request.id,
                                      'aprobado'
                                    )
                                  }
                                  variant="success"
                                />
                                <IconButton
                                  icon="close"
                                  label="Rechazar licencia"
                                  onClick={() =>
                                    updateLeaveStatus(
                                      request.id,
                                      'rechazado'
                                    )
                                  }
                                  variant="danger"
                                />
                              </>
                            )
                          }
                          {
                            canApproveLeaves &&
                            request.status !== 'cancelado' && (
                              <IconButton
                                icon="close"
                                label="Cancelar licencia"
                                onClick={() =>
                                  updateLeaveStatus(
                                    request.id,
                                    'cancelado'
                                  )
                                }
                                variant="secondary"
                              />
                            )
                          }
                          {
                            canRevertCancelledLeaves &&
                            request.status === 'cancelado' && (
                              <IconButton
                                icon="unlock"
                                label="Revertir a pendiente"
                                onClick={() =>
                                  updateLeaveStatus(
                                    request.id,
                                    'pendiente'
                                  )
                                }
                                variant="success"
                              />
                            )
                          }
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}

                  {
                    selectedEmployeeLeaveRequests.length === 0 && (
                      <tr>
                        <td
                          colSpan={
                            7 +
                            (canSeeLeaveCreator ? 3 : 0) +
                            ((canManageLeaves || canApproveLeaves) ? 1 : 0)
                          }
                        >
                          {
                            selectedLeaveEmployee
                              ? 'Este empleado todavia no tiene solicitudes cargadas.'
                              : 'Seleccione un empleado para ver sus solicitudes.'
                          }
                        </td>
                      </tr>
                    )
                  }
                </tbody>
              </table>
            </div>
          </>
        )
      }

      {
        isPersonnelSettingsPage &&
        canManageSettings &&
        activeTab === 'leave-rules' && (
          <>
            <div className="dashboard-grid">
              {leaveRuleSummaryCards.map((card) => (
                <div
                  className="dashboard-card"
                  key={card.title}
                >
                  <h3>{card.title}</h3>
                  <span>{card.text}</span>
                </div>
              ))}
            </div>

            <div className="dashboard-panel">
              <h2>Mapa actual de validaciones</h2>
              <p className="panel-description">
                Esta pantalla documenta las reglas que hoy aplica el sistema. No modifica el comportamiento, sirve para revisar antes de cambiar validaciones.
              </p>

              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Clave</th>
                      <th>Regla</th>
                      <th>Anticipacion</th>
                      <th>Max. solicitud</th>
                      <th>Max. anual</th>
                      <th>Hs/dia</th>
                      <th>Hs/sem</th>
                      <th>Hs/mes</th>
                      <th>Hs/anio</th>
                      <th>Detalle</th>
                      <th>Estado</th>
                      {canManageSettings && (
                        <th>Acciones</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {leaveRules.map((rule) => {
                      const isEditing =
                        editingLeaveRuleId === rule.id;

                      return (
                        <tr key={rule.id}>
                          <td>
                            {rule.code} - {rule.description}
                          </td>
                          <td>
                            {isEditing ? (
                              <input
                                className="attendance-code-input"
                                value={rule.name}
                                onChange={(e) =>
                                  updateLeaveRuleDraft(
                                    rule.id,
                                    {
                                      name: e.target.value
                                    }
                                  )
                                }
                              />
                            ) : (
                              rule.name
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <input
                                className="attendance-code-input"
                                type="number"
                                min="0"
                                step="1"
                                value={rule.min_advance_days ?? ''}
                                onChange={(e) =>
                                  updateLeaveRuleDraft(
                                    rule.id,
                                    {
                                      min_advance_days:
                                        e.target.value
                                          ? Number(e.target.value)
                                          : null
                                    }
                                  )
                                }
                              />
                            ) : (
                              rule.min_advance_days ?? '-'
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <input
                                className="attendance-code-input"
                                type="number"
                                min="0"
                                step="1"
                                value={rule.max_days_per_request ?? ''}
                                onChange={(e) =>
                                  updateLeaveRuleDraft(
                                    rule.id,
                                    {
                                      max_days_per_request:
                                        e.target.value
                                          ? Number(e.target.value)
                                          : null
                                    }
                                  )
                                }
                              />
                            ) : (
                              rule.max_days_per_request ?? '-'
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <input
                                className="attendance-code-input"
                                type="number"
                                min="0"
                                step="1"
                                value={rule.max_days_per_year ?? ''}
                                onChange={(e) =>
                                  updateLeaveRuleDraft(
                                    rule.id,
                                    {
                                      max_days_per_year:
                                        e.target.value
                                          ? Number(e.target.value)
                                          : null
                                    }
                                  )
                                }
                              />
                            ) : (
                              rule.max_days_per_year ?? '-'
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <input
                                className="attendance-code-input"
                                type="number"
                                min="0"
                                step="0.5"
                                value={rule.max_hours_per_day ?? ''}
                                onChange={(e) =>
                                  updateLeaveRuleDraft(
                                    rule.id,
                                    {
                                      max_hours_per_day:
                                        e.target.value
                                          ? Number(e.target.value)
                                          : null
                                    }
                                  )
                                }
                              />
                            ) : (
                              rule.max_hours_per_day ?? '-'
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <input
                                className="attendance-code-input"
                                type="number"
                                min="0"
                                step="0.5"
                                value={rule.max_hours_per_week ?? ''}
                                onChange={(e) =>
                                  updateLeaveRuleDraft(
                                    rule.id,
                                    {
                                      max_hours_per_week:
                                        e.target.value
                                          ? Number(e.target.value)
                                          : null
                                    }
                                  )
                                }
                              />
                            ) : (
                              rule.max_hours_per_week ?? '-'
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <input
                                className="attendance-code-input"
                                type="number"
                                min="0"
                                step="0.5"
                                value={rule.max_hours_per_month ?? ''}
                                onChange={(e) =>
                                  updateLeaveRuleDraft(
                                    rule.id,
                                    {
                                      max_hours_per_month:
                                        e.target.value
                                          ? Number(e.target.value)
                                          : null
                                    }
                                  )
                                }
                              />
                            ) : (
                              rule.max_hours_per_month ?? '-'
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <input
                                className="attendance-code-input"
                                type="number"
                                min="0"
                                step="0.5"
                                value={rule.max_hours_per_year ?? ''}
                                onChange={(e) =>
                                  updateLeaveRuleDraft(
                                    rule.id,
                                    {
                                      max_hours_per_year:
                                        e.target.value
                                          ? Number(e.target.value)
                                          : null
                                    }
                                  )
                                }
                              />
                            ) : (
                              rule.max_hours_per_year ?? '-'
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <textarea
                                className="form-input"
                                value={rule.rule_notes || ''}
                                onChange={(e) =>
                                  updateLeaveRuleDraft(
                                    rule.id,
                                    {
                                      rule_notes: e.target.value
                                    }
                                  )
                                }
                              />
                            ) : (
                              rule.rule_notes || '-'
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <label className="checkbox-row">
                                <input
                                  type="checkbox"
                                  checked={rule.is_active}
                                  onChange={(e) =>
                                    updateLeaveRuleDraft(
                                      rule.id,
                                      {
                                        is_active: e.target.checked
                                      }
                                    )
                                  }
                                />
                                Activa
                              </label>
                            ) : (
                              rule.is_active
                                ? 'Activa'
                                : 'Inactiva'
                            )}
                          </td>
                          {canManageSettings && (
                            <td>
                              {isEditing ? (
                                <div className="action-buttons">
                                  <button
                                    className="btn-success"
                                    type="button"
                                    onClick={() =>
                                      saveLeaveRule(rule)
                                    }
                                  >
                                    Guardar
                                  </button>
                                  <button
                                    className="btn-secondary"
                                    type="button"
                                    onClick={() => {
                                      setEditingLeaveRuleId(null);
                                      loadData();
                                    }}
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              ) : (
                                <button
                                  className="btn-secondary"
                                  type="button"
                                  onClick={() =>
                                    setEditingLeaveRuleId(rule.id)
                                  }
                                >
                                  Editar
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                    {leaveRules.length === 0 && (
                      <tr>
                        <td colSpan={canManageSettings ? 12 : 11}>
                          No hay reglas cargadas. Aplique el script de reglas de licencias para inicializarlas.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )
      }

      {
        isPersonnelSettingsPage &&
        canManageSettings &&
        activeTab === 'vacation-rules' && (
          <>
            <div className="dashboard-grid">
              <div className="dashboard-card">
                <h3>Clave 8</h3>
                <span>Del 1 al 15, 15 dias de anticipacion, hasta agosto y descuenta saldo anual.</span>
              </div>
              <div className="dashboard-card">
                <h3>Clave 29</h3>
                <span>Desde agosto. Se carga por rango y se toma en dias corridos.</span>
              </div>
              <div className="dashboard-card">
                <h3>Antiguedad</h3>
                <span>Se calcula al 1 de enero. Sin fecha de ingreso cuenta como menos de 5 años.</span>
              </div>
            </div>

            <div className="dashboard-panel">
              <h2>Reglas de vacaciones por antiguedad</h2>
              <form
                className="management-form"
                onSubmit={handleVacationRuleSubmit}
              >
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="Desde años"
                  value={vacationRuleForm.min_years}
                  onChange={(e) =>
                    setVacationRuleForm({
                      ...vacationRuleForm,
                      min_years: e.target.value
                    })
                  }
                />
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="Hasta años"
                  value={vacationRuleForm.max_years}
                  onChange={(e) =>
                    setVacationRuleForm({
                      ...vacationRuleForm,
                      max_years: e.target.value
                    })
                  }
                />
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Dias"
                  value={vacationRuleForm.allowed_days}
                  onChange={(e) =>
                    setVacationRuleForm({
                      ...vacationRuleForm,
                      allowed_days: e.target.value
                    })
                  }
                />
                <button
                  className="btn-success"
                  type="submit"
                >
                  Agregar regla
                </button>
              </form>

              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Desde</th>
                      <th>Hasta</th>
                      <th>Dias</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vacationRules.map((rule) => (
                      <tr key={rule.id}>
                        <td>
                          <input
                            className="attendance-code-input"
                            type="number"
                            defaultValue={Math.trunc(Number(rule.min_years))}
                            onBlur={(e) =>
                              updateVacationRule(
                                rule,
                                {
                                  min_years:
                                    Number(e.target.value)
                                }
                              )
                            }
                          />
                        </td>
                        <td>
                          <input
                            className="attendance-code-input"
                            type="number"
                            placeholder="Sin limite"
                            defaultValue={
                              rule.max_years === null
                                ? ''
                                : Math.trunc(Number(rule.max_years))
                            }
                            onBlur={(e) =>
                              updateVacationRule(
                                rule,
                                {
                                  max_years:
                                    e.target.value
                                      ? Number(e.target.value)
                                      : null
                                }
                              )
                            }
                          />
                        </td>
                        <td>
                          <input
                            className="attendance-code-input"
                            type="number"
                            defaultValue={Math.trunc(Number(rule.allowed_days))}
                            onBlur={(e) =>
                              updateVacationRule(
                                rule,
                                {
                                  allowed_days:
                                    Number(e.target.value)
                                }
                              )
                            }
                          />
                        </td>
                        <td>
                          <select
                            className="form-input"
                            value={
                              rule.is_active
                                ? 'true'
                                : 'false'
                            }
                            onChange={(e) =>
                              updateVacationRule(
                                rule,
                                {
                                  is_active:
                                    e.target.value === 'true'
                                }
                              )
                            }
                          >
                            <option value="true">Activa</option>
                            <option value="false">Inactiva</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )
      }

      {
        !isPersonnelSettingsPage &&
        activeTab === 'leave-requests' && (
          <>
            <div className="filter-bar">
              <input
                className="form-input"
                placeholder="Buscar por empleado, legajo, sector o clave"
                value={leaveRequestFilters.search}
                onChange={(e) =>
                  setLeaveRequestFilters({
                    ...leaveRequestFilters,
                    search: e.target.value
                  })
                }
              />

              <select
                className="form-input"
                value={leaveRequestFilters.status}
                onChange={(e) =>
                  setLeaveRequestFilters({
                    ...leaveRequestFilters,
                    status: e.target.value
                  })
                }
              >
                <option value="pendiente">Pendientes</option>
                <option value="aprobado">Aprobadas</option>
                <option value="rechazado">Rechazadas</option>
                <option value="cancelado">Canceladas</option>
                <option value="todos">Todas</option>
              </select>

              <select
                className="form-input"
                value={leaveRequestFilters.code}
                onChange={(e) =>
                  setLeaveRequestFilters({
                    ...leaveRequestFilters,
                    code: e.target.value
                  })
                }
              >
                <option value="todos">Todas las claves</option>
                {codes
                  .filter((code) =>
                    leaveCodeOptions.includes(code.code)
                  )
                  .map((code) => (
                    <option
                      key={code.id}
                      value={code.code}
                    >
                      {code.code} - {code.description}
                    </option>
                  ))}
              </select>
            </div>

            <p className="results-summary">
              Mostrando {filteredLeaveRequests.length} solicitudes
            </p>

            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Empleado</th>
                    <th>Clave</th>
                    <th>Desde</th>
                    <th>Hasta</th>
                    <th>Dias</th>
                    <th>Horas</th>
                    <th>Estado</th>
                    {canSeeLeaveCreator && (
                      <th>Cargada por</th>
                    )}
                    {(canManageLeaves || canApproveLeaves) && (
                      <th>Acciones</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredLeaveRequests.map((request) => (
                    <tr key={request.id}>
                      <td>
                        <button
                          className="text-link-button"
                          type="button"
                          onClick={() =>
                            openEmployeeAttendance({
                              id: request.employee_id,
                              full_name: request.full_name
                            })
                          }
                          title="Ver presentismo del empleado"
                        >
                          {request.full_name}
                        </button>
                        <br />
                        <span>{request.department_name || '-'}</span>
                      </td>
                      <td>
                        {request.code} - {request.description}
                      </td>
                      <td>{formatDisplayDate(request.start_date)}</td>
                      <td>{formatDisplayDate(request.end_date)}</td>
                      <td>{request.total_days || '-'}</td>
                      <td>{request.total_hours || '-'}</td>
                      <td>
                        <span
                          className={
                            request.status === 'aprobado'
                              ? 'badge badge-success'
                              : request.status === 'rechazado'
                                ? 'badge badge-danger'
                                : 'badge'
                          }
                        >
                          {request.status}
                        </span>
                      </td>
                      {canSeeLeaveCreator && (
                        <td>
                          <PersonDateCell
                            name={request.requested_by_name}
                            date={request.requested_at}
                          />
                        </td>
                      )}
                      {(canManageLeaves || canApproveLeaves) && (
                        <td>
                        <div className="table-actions">
                          {canEditLeaveRequest(request) && (
                            <IconButton
                              icon="edit"
                              label="Editar licencia"
                              onClick={() =>
                                startEditLeaveRequest(request)
                              }
                              variant="primary"
                            />
                          )}

                          {isPrintableLeaveCode(request.code) &&
                            !isCancelledLeaveRequest(request) && (
                            <IconButton
                              icon="print"
                              label="Imprimir comprobante"
                              onClick={() =>
                                setPrintLeaveRequest(request)
                              }
                              variant="secondary"
                            />
                          )}

                          {canManageLeaves &&
                            request.code === '43' &&
                            !request.no_return &&
                            (!request.return_time || !Number(request.total_hours || 0)) && (
                              <IconButton
                                icon="check"
                                label="Completar regreso"
                                onClick={() => {
                                  const returnTime =
                                    request.return_time || '';

                                  setReturnLeaveRequest(request);
                                  setReturnForm({
                                    return_time: returnTime,
                                    total_hours: request.total_hours
                                      ? String(request.total_hours)
                                      : calculateReturnPermissionHours(
                                        request.exit_time,
                                        returnTime
                                      )
                                  });
                                }}
                                variant="primary"
                              />
                            )}

                          {
                            canApproveLeaves &&
                            request.status === 'pendiente' && (
                              <>
                                <IconButton
                                  icon="check"
                                  label="Aprobar licencia"
                                  onClick={() =>
                                    updateLeaveStatus(
                                      request.id,
                                      'aprobado'
                                    )
                                  }
                                  variant="success"
                                />
                                <IconButton
                                  icon="close"
                                  label="Rechazar licencia"
                                  onClick={() =>
                                    updateLeaveStatus(
                                      request.id,
                                      'rechazado'
                                    )
                                  }
                                  variant="danger"
                                />
                              </>
                            )
                          }
                          {
                            canApproveLeaves &&
                            request.status !== 'cancelado' && (
                              <IconButton
                                icon="close"
                                label="Cancelar licencia"
                                onClick={() =>
                                  updateLeaveStatus(
                                    request.id,
                                    'cancelado'
                                  )
                                }
                                variant="secondary"
                              />
                            )
                          }
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}

                  {
                    filteredLeaveRequests.length === 0 && (
                      <tr>
                        <td
                          colSpan={
                            7 +
                            (canSeeLeaveCreator ? 1 : 0) +
                            ((canManageLeaves || canApproveLeaves) ? 1 : 0)
                          }
                        >
                          No hay solicitudes para esos filtros.
                        </td>
                      </tr>
                    )
                  }
                </tbody>
              </table>
            </div>
          </>
        )
      }

      {
        isPersonnelSettingsPage &&
        canManageBalances &&
        activeTab === 'balance-adjustments' && (
          <>
            <div className="nutrition-layout">
              <div className="table-container nutrition-patient-list">
                <h2>Empleados</h2>
                <input
                  className="form-input"
                  placeholder="Buscar por nombre, DNI o legajo"
                  value={balanceEmployeeSearch}
                  onChange={(event) =>
                    setBalanceEmployeeSearch(event.target.value)
                  }
                />

                <table className="data-table">
                  <tbody>
                    {filteredBalanceEmployees.map((employee) => (
                      <tr
                        key={employee.id}
                        className={
                          selectedBalanceEmployee?.id === employee.id
                            ? 'selected-row'
                            : ''
                        }
                      >
                        <td>
                          <strong>{employee.full_name}</strong>
                          <br />
                          <span>
                            DNI {employee.dni || '-'} · Legajo {employee.file_number || '-'}
                          </span>
                          <br />
                          <span>{employee.department_name || '-'}</span>
                        </td>
                        <td>
                          <button
                            className="btn-secondary"
                            type="button"
                            onClick={() =>
                              selectBalanceEmployee(employee)
                            }
                          >
                            Seleccionar
                          </button>
                        </td>
                      </tr>
                    ))}

                    {filteredBalanceEmployees.length === 0 && (
                      <tr>
                        <td colSpan={2}>
                          No hay empleados con ese filtro.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <section className="nutrition-detail-panel">
                {!selectedBalanceEmployee ? (
                  <div className="empty-state">
                    Selecciona un empleado para modificar sus saldos.
                  </div>
                ) : (
                  <>
                    <div className="nutrition-detail-header">
                      <div>
                        <h2>{selectedBalanceEmployee.full_name}</h2>
                        <p>
                          DNI {selectedBalanceEmployee.dni || '-'} · Legajo {selectedBalanceEmployee.file_number || '-'}
                        </p>
                      </div>
                    </div>

                    <form
                      className="personnel-form"
                      onSubmit={handleBalanceAdjustmentSubmit}
                    >
                      <select
                        className="form-input"
                        name="code"
                        value={balanceAdjustmentForm.code}
                        onChange={handleBalanceAdjustmentChange}
                      >
                        {codes
                          .filter((code) =>
                            balanceManagedCodes.includes(code.code)
                          )
                          .map((code) => (
                            <option
                              key={code.id}
                              value={code.code}
                            >
                              {code.code} - {code.description}
                            </option>
                          ))}
                      </select>

                      <input
                        className="form-input"
                        type="number"
                        name="year"
                        placeholder="Año"
                        value={balanceAdjustmentForm.year}
                        onChange={handleBalanceAdjustmentChange}
                      />

                    </form>

                    {selectedBalanceInfo && (
                      <>
                        <div className="dashboard-grid">
                          <div className="dashboard-card">
                            <h3>{selectedBalanceInfo.allowedLabel}</h3>
                            <p>{selectedBalanceInfo.allowed}</p>
                            <span>{selectedBalanceInfo.title}</span>
                          </div>

                          <div className="dashboard-card">
                            <h3>{selectedBalanceInfo.currentLabel}</h3>
                            <p>{selectedBalanceInfo.current}</p>
                            <span>Registrado actualmente</span>
                          </div>

                          <div className="dashboard-card">
                            <h3>Pendiente</h3>
                            <p>{selectedBalanceInfo.pending}</p>
                            <span>Solicitado sin cerrar</span>
                          </div>

                          <div className="dashboard-card">
                            <h3>Disponible</h3>
                            <p>{balanceAvailablePreview}</p>
                            <span>
                              Calculado con los valores cargados
                            </span>
                          </div>
                        </div>

                        <form
                          className="personnel-form"
                          onSubmit={handleBalanceAdjustmentSubmit}
                        >
                          {selectedBalanceInfo.canEditAllowed && (
                            <input
                              className="form-input"
                              type="number"
                              step="1"
                              min="0"
                              name="allowed_days"
                              placeholder="Dias que tiene"
                              value={balanceAdjustmentForm.allowed_days}
                              onChange={handleBalanceAdjustmentChange}
                            />
                          )}

                          {selectedBalanceInfo.unit === 'hours' ? (
                            <input
                              className="form-input"
                              type="number"
                              step="0.5"
                              name="used_hours"
                              placeholder="Nuevo total de horas usadas"
                              value={balanceAdjustmentForm.used_hours}
                              onChange={handleBalanceAdjustmentChange}
                            />
                          ) : (
                            <input
                              className="form-input"
                              type="number"
                              step="1"
                              min="0"
                              name="used_days"
                              placeholder={
                                balanceAdjustmentForm.code === 'C'
                                  ? 'Nuevo total de dias ganados'
                                  : 'Nuevo total de dias tomados'
                              }
                              value={balanceAdjustmentForm.used_days}
                              onChange={handleBalanceAdjustmentChange}
                            />
                          )}

                          <textarea
                            className="form-input personnel-notes"
                            name="notes"
                            placeholder="Motivo de la correccion"
                            rows={3}
                            value={balanceAdjustmentForm.notes}
                            onChange={handleBalanceAdjustmentChange}
                          />

                          <button
                            className="btn-success"
                            type="submit"
                          >
                            Guardar correccion
                          </button>
                        </form>
                      </>
                    )}

                    <p className="results-summary">
                      Las correcciones manuales ajustan el saldo sin modificar presentismo ni licencias ya cargadas.
                    </p>

                    <div className="table-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Clave</th>
                            <th>Año</th>
                            <th>Dias</th>
                            <th>Horas</th>
                            <th>Notas</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedBalanceAdjustments.map((adjustment) => (
                            <tr key={adjustment.id}>
                              <td>
                                {adjustment.code} - {adjustment.description}
                              </td>
                              <td>{adjustment.year}</td>
                              <td>{Number(adjustment.used_days || 0) || '-'}</td>
                              <td>{Number(adjustment.used_hours || 0) || '-'}</td>
                              <td>{adjustment.notes || '-'}</td>
                              <td>
                                <button
                                  className="btn-danger"
                                  type="button"
                                  onClick={() =>
                                    deleteBalanceAdjustment(adjustment.id)
                                  }
                                >
                                  Eliminar
                                </button>
                              </td>
                            </tr>
                          ))}

                          {selectedBalanceAdjustments.length === 0 && (
                            <tr>
                              <td colSpan={6}>
                                Todavia no hay correcciones para esta licencia.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </section>
            </div>
          </>
        )
      }

    </div>
  );
}

function formatPrintTime(
  value: string | null
) {
  if (!value) {
    return '';
  }

  return String(value).slice(0, 5);
}

function formatPrintDateTime(
  value: Date
) {
  return value.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

function formatDisplayDateTime(
  value?: string | null
) {
  if (!value) {
    return '-';
  }

  const date =
    new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

function PersonDateCell({
  name,
  date,
  empty = '-'
}: {
  name?: string | null;
  date?: string | null;
  empty?: string;
}) {
  if (!name && !date) {
    return <>{empty}</>;
  }

  return (
    <>
      <strong>{name || '-'}</strong>
      <br />
      <span className="muted">
        {formatDisplayDateTime(date)}
      </span>
    </>
  );
}

function groupLeaveRequestsByCode(
  leaves: LeaveRequest[]
): LeaveRequestGroup[] {
  const sortedLeaves =
    leaves
      .filter((leave) =>
        !isCancelledLeaveRequest(leave)
      )
      .sort((a, b) => {
      const dateDiff =
        new Date(b.start_date).getTime() -
        new Date(a.start_date).getTime();

      if (dateDiff !== 0) {
        return dateDiff;
      }

      return b.id - a.id;
      });

  const groups =
    new Map<string, LeaveRequestGroup>();

  sortedLeaves.forEach((leave) => {
    const groupKey =
      `${leave.code}-${leave.description}`;

    if (!groups.has(groupKey)) {
      groups.set(
        groupKey,
        {
          code: leave.code,
          description: leave.description,
          leaves: []
        }
      );
    }

    groups.get(groupKey)?.leaves.push(leave);
  });

  return Array.from(groups.values());
}

function formatLeavePeriod(
  leave: LeaveRequest
) {
  const startDate =
    formatDisplayDate(leave.start_date);
  const endDate =
    formatDisplayDate(leave.end_date);

  if (
    !leave.end_date ||
    startDate === endDate
  ) {
    return startDate;
  }

  return `${startDate} al ${endDate}`;
}

function formatLeaveQuantity(
  leave: LeaveRequest
) {
  if (Number(leave.total_hours || 0) > 0) {
    return `${leave.total_hours} hs`;
  }

  return `${leave.total_days || 0} dia(s)`;
}

function formatLeaveStatus(
  status: string
) {
  const labels: Record<string, string> = {
    pendiente: 'Pendiente',
    aprobado: 'Aprobada',
    rechazado: 'Rechazada',
    cancelado: 'Cancelada'
  };

  return labels[status] || status;
}

function getLeaveStatusBadgeClass(
  status: string
) {
  if (status === 'aprobado') {
    return 'badge badge-success';
  }

  if (
    status === 'rechazado' ||
    status === 'cancelado'
  ) {
    return 'badge badge-danger';
  }

  return 'badge';
}

function formatLeaveResolvedBy(
  leave: LeaveRequest
) {
  if (leave.status === 'pendiente') {
    return 'Pendiente';
  }

  return leave.approved_by_name || '-';
}

function isCancelledLeaveRequest(
  leave: LeaveRequest
) {
  return leave.status === 'cancelado';
}

function GroupedLeavesHistory({
  groups
}: {
  groups: LeaveRequestGroup[];
}) {
  return (
    <div className="leave-history-groups">
      {groups.map((group) => (
        <section
          className="leave-history-group"
          key={`${group.code}-${group.description}`}
        >
          <h3>
            Clave {group.code} - {group.description}
          </h3>
          <div className="table-responsive">
            <table className="data-table leave-history-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Cantidad</th>
                  <th>Estado</th>
                  <th>Cargada</th>
                  <th>Editada</th>
                  <th>Resuelta</th>
                </tr>
              </thead>
              <tbody>
                {group.leaves.map((leave) => (
                  <tr key={leave.id}>
                    <td>{formatLeavePeriod(leave)}</td>
                    <td>{formatLeaveQuantity(leave)}</td>
                    <td>
                      <span className={getLeaveStatusBadgeClass(leave.status)}>
                        {formatLeaveStatus(leave.status)}
                      </span>
                    </td>
                    <td>
                      <PersonDateCell
                        name={leave.requested_by_name}
                        date={leave.requested_at}
                      />
                    </td>
                    <td>
                      <PersonDateCell
                        name={leave.edited_by_name}
                        date={leave.edited_at}
                      />
                    </td>
                    <td>
                      <PersonDateCell
                        name={
                          leave.status === 'pendiente'
                            ? null
                            : formatLeaveResolvedBy(leave)
                        }
                        date={leave.approved_at}
                        empty={
                          leave.status === 'pendiente'
                            ? 'Pendiente'
                            : '-'
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

function groupAttendanceRecordsByCode(
  records: AttendanceRecordSummary[]
): AttendanceRecordGroup[] {
  const sortedRecords =
    [...records].sort((a, b) => {
      const dateDiff =
        new Date(b.attendance_date).getTime() -
        new Date(a.attendance_date).getTime();

      if (dateDiff !== 0) {
        return dateDiff;
      }

      return b.id - a.id;
    });

  const groups =
    new Map<string, AttendanceRecordGroup>();

  sortedRecords.forEach((record) => {
    const groupKey =
      `${record.code}-${record.description}`;

    if (!groups.has(groupKey)) {
      groups.set(
        groupKey,
        {
          code: record.code,
          description: record.description,
          category: record.category,
          records: []
        }
      );
    }

    groups.get(groupKey)?.records.push(record);
  });

  return Array.from(groups.values());
}

function formatAttendanceSource(
  source?: string | null
) {
  if (source === 'manual') {
    return 'Manual';
  }

  if (source === 'excel_import') {
    return 'Importado';
  }

  return source || '-';
}

function GroupedAttendanceHistory({
  groups
}: {
  groups: AttendanceRecordGroup[];
}) {
  return (
    <div className="leave-history-groups">
      {groups.map((group) => (
        <section
          className="leave-history-group"
          key={`${group.code}-${group.description}`}
        >
          <h3>
            Clave {group.code} - {group.description}
          </h3>
          <div className="table-responsive">
            <table className="data-table leave-history-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Categoria</th>
                  <th>Origen</th>
                  <th>Cargo</th>
                </tr>
              </thead>
              <tbody>
                {group.records.map((record) => (
                  <tr key={record.id}>
                    <td>{formatDisplayDate(record.attendance_date)}</td>
                    <td>{record.category || '-'}</td>
                    <td>{formatAttendanceSource(record.source)}</td>
                    <td>{record.created_by_name || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

function buildDirectiveKeyCards(
  summary: DirectiveSummary
): DirectiveKeyCardData[] {
  const coveredCodes =
    new Set([
      '8',
      '23',
      '24',
      '26',
      '29',
      '34',
      '43',
      'C',
      'FC',
      'P'
    ]);

  const cards: DirectiveKeyCardData[] = [];
  const addedCodes =
    new Set<string>();

  summary.recentLeaves
    .filter((leave) =>
      !isCancelledLeaveRequest(leave)
    )
    .forEach((leave) => {
    const normalizedCode =
      String(leave.code).toUpperCase();

    if (
      coveredCodes.has(normalizedCode) ||
      addedCodes.has(normalizedCode)
    ) {
      return;
    }

    const sameCodeLeaves =
      summary.recentLeaves.filter((item) =>
        !isCancelledLeaveRequest(item) &&
        String(item.code).toUpperCase() === normalizedCode
      );

    const totalQuantity =
      sameCodeLeaves.reduce(
        (total, item) =>
          total +
          Number(
            Number(item.total_hours || 0) > 0
              ? item.total_hours
              : item.total_days || 0
          ),
        0
      );

    cards.push({
      title: `Clave ${leave.code} - ${leave.description}`,
      value: totalQuantity,
      detail: `${sameCodeLeaves.length} movimiento(s)`,
      mode: `leave:${leave.code}`
    });

    addedCodes.add(normalizedCode);
    });

  summary.attendance.byCode.forEach((item) => {
    const normalizedCode =
      String(item.code).toUpperCase();

    if (
      coveredCodes.has(normalizedCode) ||
      addedCodes.has(normalizedCode)
    ) {
      return;
    }

    cards.push({
      title: `Clave ${item.code} - ${item.description}`,
      value: item.total,
      detail: `${item.category}`,
      mode: `attendance:${item.code}`
    });

    addedCodes.add(normalizedCode);
  });

  return cards;
}

function DirectiveKeyCard({
  card,
  onPrint
}: {
  card: DirectiveKeyCardData;
  onPrint: () => void;
}) {
  return (
    <div className="dashboard-card directive-key-card">
      <div className="directive-key-card-header">
        <h3 title={card.title}>{card.title}</h3>
        <button
          aria-label={`Imprimir ${card.title}`}
          className="card-print-icon-button"
          title="Imprimir"
          type="button"
          onClick={onPrint}
        >
          ⎙
        </button>
      </div>
      <p>{card.value}</p>
      <span>{card.detail}</span>
    </div>
  );
}

function getDirectivePrintTitle(
  mode: DirectivePrintMode
) {
  if (mode === 'all') {
    return 'Resumen completo de personal';
  }

  if (mode === 'vacation') {
    return 'Clave 8 - LICENCIA ANUAL';
  }

  if (mode === 'code26') {
    return 'Clave 26 - PERMISO ASUNTOS PARTICULARES';
  }

  if (mode === 'hours') {
    return 'Claves 24/43 - HORAS';
  }

  if (mode === 'code29') {
    return 'Clave 29 - LICENCIA COMPLEMENTARIA';
  }

  if (mode === 'compensatory') {
    return 'Compensatorios';
  }

  if (mode === 'attendance') {
    return 'Presentismo por clave';
  }

  if (mode.startsWith('attendance:')) {
    return `Clave ${mode.replace('attendance:', '')}`;
  }

  if (mode.startsWith('leave:')) {
    return `Clave ${mode.replace('leave:', '')}`;
  }

  return 'Resumen de personal';
}

function getDirectiveLeavesForPrint(
  summary: DirectiveSummary,
  mode: DirectivePrintMode
) {
  const leaves =
    summary.recentLeaves.filter((leave) =>
      !isCancelledLeaveRequest(leave)
    );

  if (
    mode === 'all' ||
    mode === 'leaves'
  ) {
    return leaves;
  }

  if (mode.startsWith('leave:')) {
    const code =
      mode.replace('leave:', '').toUpperCase();

    return leaves.filter((leave) =>
      String(leave.code).toUpperCase() === code
    );
  }

  const codeMap: Partial<Record<DirectivePrintMode, string[]>> = {
    vacation: ['8'],
    code26: ['26'],
    hours: ['23', '24', '43'],
    code29: ['29'],
    compensatory: ['34', 'FC']
  };

  const codes =
    codeMap[mode] || [];

  return leaves.filter((leave) =>
    codes.includes(String(leave.code).toUpperCase())
  );
}

function getDirectiveAttendanceForPrint(
  summary: DirectiveSummary,
  mode: DirectivePrintMode
) {
  const records =
    summary.recentAttendance;

  if (mode === 'all') {
    const leaveCodes =
      new Set(
        summary.recentLeaves.map((leave) =>
          isCancelledLeaveRequest(leave)
            ? ''
            : String(leave.code).toUpperCase()
        )
      );

    return records.filter((record) =>
      !leaveCodes.has(String(record.code).toUpperCase()) &&
      record.category !== 'franco'
    );
  }

  if (mode === 'attendance') {
    return records;
  }

  if (mode.startsWith('attendance:')) {
    const code =
      mode.replace('attendance:', '').toUpperCase();

    return records.filter((record) =>
      String(record.code).toUpperCase() === code
    );
  }

  if (mode === 'absences') {
    return records.filter((record) =>
      record.category === 'ausencia'
    );
  }

  if (mode === 'compensatory') {
    return records.filter((record) =>
      String(record.code).toUpperCase() === 'C'
    );
  }

  return [];
}

function DirectiveSummaryPrintModal({
  mode,
  summary,
  user,
  onClose
}: {
  mode: DirectivePrintMode;
  summary: DirectiveSummary;
  user: any;
  onClose: () => void;
}) {
  const printedAt =
    new Date();

  const printedBy =
    [
      user?.first_name,
      user?.last_name
    ]
      .filter(Boolean)
      .join(' ') ||
    user?.username ||
    '-';

  const leaves =
    getDirectiveLeavesForPrint(
      summary,
      mode
    );

  const attendance =
    getDirectiveAttendanceForPrint(
      summary,
      mode
    );

  const totalFrancos =
    mode === 'all'
      ? summary.recentAttendance.filter((record) =>
        record.category === 'franco'
      ).length
      : 0;

  const showBalances =
    mode === 'all' ||
    mode === 'seniority';

  function handlePrint() {
    window.print();
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content modal-content-wide">
        <div className="permission-print-actions">
          <button
            className="btn-secondary"
            type="button"
            onClick={onClose}
          >
            Cerrar
          </button>
          <button
            className="btn-primary"
            type="button"
            onClick={handlePrint}
          >
            Imprimir
          </button>
        </div>

        <section className="employee-leaves-print-area">
          <div className="employee-leaves-print-page">
            <header className="leave-summary-print-header">
              <h2>{getDirectivePrintTitle(mode)}</h2>
              <p>Hospital Municipal de Punta Lara - {summary.period.year}</p>
            </header>

            <section className="leave-summary-print-section">
              <h3>Datos del empleado</h3>
              <div className="leave-summary-print-grid">
                <LeaveSummaryTextField
                  label="Empleado"
                  value={summary.employee.full_name}
                />
                <LeaveSummaryTextField
                  label="DNI"
                  value={summary.employee.dni}
                />
                <LeaveSummaryTextField
                  label="Legajo"
                  value={summary.employee.file_number}
                />
                <LeaveSummaryTextField
                  label="Dependencia"
                  value={summary.employee.facility_name}
                />
                <LeaveSummaryTextField
                  label="Sector"
                  value={summary.employee.department_name}
                />
                <LeaveSummaryTextField
                  label="Ingreso"
                  value={formatDisplayDate(summary.employee.hire_date)}
                />
                <LeaveSummaryTextField
                  label="Turno"
                  value={formatEmployeeShift(summary.employee)}
                />
                <LeaveSummaryTextField
                  label="Tipo"
                  value={summary.employee.employment_type}
                />
                <LeaveSummaryTextField
                  label="Profesional"
                  value={
                    summary.employee.is_professional
                      ? 'Si.'
                      : 'No.'
                  }
                />
              </div>
            </section>

            {showBalances && (
              <section className="leave-summary-print-section">
                <h3>Detalle de saldos</h3>
                <div className="leave-summary-print-cards">
                  <LeaveSummaryPrintCard
                    title="Vacaciones clave 8"
                    value={summary.balances.vacation.available_days}
                    detail={`Asignadas ${summary.balances.vacation.allowed_days}, usadas ${summary.balances.vacation.used_days}, pendientes ${summary.balances.vacation.pending_days}`}
                  />
                  <LeaveSummaryPrintCard
                    title="Clave 26"
                    value={summary.balances.code26.remaining_days}
                    detail={`Usados ${summary.balances.code26.used_days}, pendientes ${summary.balances.code26.pending_days}. Este mes quedan ${summary.balances.code26.remaining_this_month}`}
                  />
                  <LeaveSummaryPrintCard
                    title="Horas 24 / 43"
                    value={summary.balances.hours24_43.remaining_hours_year}
                    detail={`Este mes quedan ${summary.balances.hours24_43.remaining_hours_month} hs. Usadas anio ${summary.balances.hours24_43.used_hours_year} hs`}
                  />
                  <LeaveSummaryPrintCard
                    title="Clave 29"
                    value={summary.balances.code29.remaining_days}
                    detail={`Asignados ${summary.balances.code29.allowed_days}, usados ${summary.balances.code29.used_days}, pendientes ${summary.balances.code29.pending_days}`}
                  />
                  <LeaveSummaryPrintCard
                    title="Compensatorios"
                    value={summary.balances.compensatory.remaining_days}
                    detail={`Ganados ${summary.balances.compensatory.earned_days}, usados ${summary.balances.compensatory.used_days}, pendientes ${summary.balances.compensatory.pending_days}`}
                  />
                  {mode === 'all' && (
                    <LeaveSummaryPrintCard
                      title="Francos"
                      value={totalFrancos}
                      detail="Total de francos del periodo"
                    />
                  )}
                </div>
              </section>
            )}

            {leaves.length > 0 && (
              <section className="leave-summary-print-section">
                <h3>Licencias</h3>
                <GroupedLeavesHistory
                  groups={groupLeaveRequestsByCode(leaves)}
                />
              </section>
            )}

            {attendance.length > 0 && (
              <section className="leave-summary-print-section">
                <h3>Presentismo</h3>
                <GroupedAttendanceHistory
                  groups={groupAttendanceRecordsByCode(attendance)}
                />
              </section>
            )}

            {leaves.length === 0 &&
              attendance.length === 0 &&
              !showBalances && (
                <p className="page-subtitle">
                  No hay movimientos para imprimir en esta opcion.
                </p>
              )}

            <footer className="leave-summary-print-footer">
              <span>
                Impreso por: <strong>{printedBy}</strong>
              </span>
              <span>
                Fecha y hora: <strong>{formatPrintDateTime(printedAt)}</strong>
              </span>
            </footer>
          </div>
        </section>
      </div>
    </div>
  );
}

function EmployeeAttendanceHistoryPrintModal({
  summary,
  user,
  onClose
}: {
  summary: DirectiveSummary;
  user: any;
  onClose: () => void;
}) {
  const printedAt =
    new Date();

  const printedBy =
    [
      user?.first_name,
      user?.last_name
    ]
      .filter(Boolean)
      .join(' ') ||
    user?.username ||
    '-';

  function handlePrint() {
    window.print();
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content modal-content-wide">
        <div className="permission-print-actions">
          <button
            className="btn-secondary"
            type="button"
            onClick={onClose}
          >
            Cerrar
          </button>
          <button
            className="btn-primary"
            type="button"
            onClick={handlePrint}
          >
            Imprimir
          </button>
        </div>

        <section className="employee-leaves-print-area">
          <div className="employee-leaves-print-page">
            <header className="leave-summary-print-header">
              <h2>Historial de presentismo</h2>
              <p>Hospital Municipal de Punta Lara - {summary.period.year}</p>
            </header>

            <section className="leave-summary-print-section">
              <h3>Datos del empleado</h3>
              <div className="leave-summary-print-grid">
                <LeaveSummaryTextField
                  label="Empleado"
                  value={summary.employee.full_name}
                />
                <LeaveSummaryTextField
                  label="DNI"
                  value={summary.employee.dni}
                />
                <LeaveSummaryTextField
                  label="Legajo"
                  value={summary.employee.file_number}
                />
                <LeaveSummaryTextField
                  label="Dependencia"
                  value={summary.employee.facility_name}
                />
                <LeaveSummaryTextField
                  label="Sector"
                  value={summary.employee.department_name}
                />
                <LeaveSummaryTextField
                  label="Ingreso"
                  value={formatDisplayDate(summary.employee.hire_date)}
                />
              </div>
            </section>

            <section className="leave-summary-print-section">
              <h3>Novedades por clave</h3>
              <GroupedAttendanceHistory
                groups={groupAttendanceRecordsByCode(summary.recentAttendance)}
              />
            </section>

            <footer className="leave-summary-print-footer">
              <span>
                Impreso por: <strong>{printedBy}</strong>
              </span>
              <span>
                Fecha y hora: <strong>{formatPrintDateTime(printedAt)}</strong>
              </span>
            </footer>
          </div>
        </section>
      </div>
    </div>
  );
}

function EmployeeLeavesHistoryPrintModal({
  summary,
  user,
  onClose
}: {
  summary: DirectiveSummary;
  user: any;
  onClose: () => void;
}) {
  const printedAt =
    new Date();

  const printedBy =
    [
      user?.first_name,
      user?.last_name
    ]
      .filter(Boolean)
      .join(' ') ||
    user?.username ||
    '-';

  function handlePrint() {
    window.print();
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content modal-content-wide">
        <div className="permission-print-actions">
          <button
            className="btn-secondary"
            type="button"
            onClick={onClose}
          >
            Cerrar
          </button>
          <button
            className="btn-primary"
            type="button"
            onClick={handlePrint}
          >
            Imprimir
          </button>
        </div>

        <section className="employee-leaves-print-area">
          <div className="employee-leaves-print-page">
            <header className="leave-summary-print-header">
              <h2>Historial de licencias</h2>
              <p>Hospital Municipal de Punta Lara</p>
            </header>

            <section className="leave-summary-print-section">
              <h3>Datos del empleado</h3>
              <div className="leave-summary-print-grid">
                <LeaveSummaryTextField
                  label="Empleado"
                  value={summary.employee.full_name}
                />
                <LeaveSummaryTextField
                  label="DNI"
                  value={summary.employee.dni}
                />
                <LeaveSummaryTextField
                  label="Legajo"
                  value={summary.employee.file_number}
                />
                <LeaveSummaryTextField
                  label="Dependencia"
                  value={summary.employee.facility_name}
                />
                <LeaveSummaryTextField
                  label="Sector"
                  value={summary.employee.department_name}
                />
                <LeaveSummaryTextField
                  label="Ingreso"
                  value={formatDisplayDate(summary.employee.hire_date)}
                />
              </div>
            </section>

            <section className="leave-summary-print-section">
              <h3>Licencias por clave</h3>
              <GroupedLeavesHistory
                groups={groupLeaveRequestsByCode(summary.recentLeaves)}
              />
            </section>

            <footer className="leave-summary-print-footer">
              <span>
                Impreso por: <strong>{printedBy}</strong>
              </span>
              <span>
                Fecha y hora: <strong>{formatPrintDateTime(printedAt)}</strong>
              </span>
            </footer>
          </div>
        </section>
      </div>
    </div>
  );
}

function LeaveSummaryPrintModal({
  employee,
  summary,
  user,
  onClose
}: {
  employee: Employee;
  summary: LeaveSummary;
  user: any;
  onClose: () => void;
}) {
  const printedAt =
    new Date();

  const printedBy =
    [
      user?.first_name,
      user?.last_name
    ]
      .filter(Boolean)
      .join(' ') ||
    user?.username ||
    '-';

  function handlePrint() {
    window.print();
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content modal-content-wide">
        <div className="permission-print-actions">
          <button
            className="btn-secondary"
            type="button"
            onClick={onClose}
          >
            Cerrar
          </button>
          <button
            className="btn-primary"
            type="button"
            onClick={handlePrint}
          >
            Imprimir
          </button>
        </div>

        <section className="leave-summary-print-area">
          <div className="leave-summary-print-page">
            <header className="leave-summary-print-header">
              <div>
                <h2>Resumen de licencias</h2>
                <p>Hospital Municipal de Punta Lara</p>
              </div>
            </header>

            <section className="leave-summary-print-section">
              <h3>Datos del empleado</h3>
              <div className="leave-summary-print-grid">
                <LeaveSummaryTextField
                  label="Empleado"
                  value={employee.full_name}
                />
                <LeaveSummaryTextField
                  label="DNI"
                  value={employee.dni}
                />
                <LeaveSummaryTextField
                  label="Legajo"
                  value={employee.file_number}
                />
                <LeaveSummaryTextField
                  label="Dependencia"
                  value={employee.facility_name}
                />
                <LeaveSummaryTextField
                  label="Sector"
                  value={employee.department_name}
                />
                <LeaveSummaryTextField
                  label="Ingreso"
                  value={formatDisplayDate(employee.hire_date)}
                />
                <LeaveSummaryTextField
                  label="Turno"
                  value={formatEmployeeShift(employee)}
                />
                <LeaveSummaryTextField
                  label="Tipo"
                  value={employee.employment_type}
                />
                <LeaveSummaryTextField
                  label="Profesional"
                  value={
                    employee.is_professional
                      ? 'Si.'
                      : 'No.'
                  }
                />
              </div>
            </section>

            <section className="leave-summary-print-section">
              <h3>Detalle de saldos</h3>
              <div className="leave-summary-print-cards">
                <LeaveSummaryPrintCard
                  title="Vacaciones clave 8"
                  value={summary.vacation.available_days}
                  detail={`Asignadas ${summary.vacation.allowed_days}, usadas ${summary.vacation.used_days}, pendientes ${summary.vacation.pending_days}`}
                />
                <LeaveSummaryPrintCard
                  title="Clave 26"
                  value={summary.code26.remaining_days}
                  detail={`Usados ${summary.code26.used_days}, pendientes ${summary.code26.pending_days}. Este mes quedan ${summary.code26.remaining_this_month}`}
                />
                <LeaveSummaryPrintCard
                  title="Horas 24 / 43"
                  value={summary.hours24_43.remaining_hours_year}
                  detail={`Este mes quedan ${summary.hours24_43.remaining_hours_month} hs. Usadas anio ${summary.hours24_43.used_hours_year} hs`}
                />
                <LeaveSummaryPrintCard
                  title="Clave 29"
                  value={summary.code29.remaining_days}
                  detail={`Asignados ${summary.code29.allowed_days}, usados ${summary.code29.used_days}, pendientes ${summary.code29.pending_days}`}
                />
                <LeaveSummaryPrintCard
                  title="Compensatorios"
                  value={summary.compensatory.remaining_days}
                  detail={`Ganados ${summary.compensatory.earned_days}, usados ${summary.compensatory.used_days}, pendientes ${summary.compensatory.pending_days}`}
                />
              </div>
            </section>

            <footer className="leave-summary-print-footer">
              <span>
                Impreso por: <strong>{printedBy}</strong>
              </span>
              <span>
                Fecha y hora: <strong>{formatPrintDateTime(printedAt)}</strong>
              </span>
            </footer>
          </div>
        </section>
      </div>
    </div>
  );
}

function LeaveSummaryPrintCard({
  title,
  value,
  detail
}: {
  title: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="leave-summary-print-card">
      <h4>{title}</h4>
      <strong>{value}</strong>
      <p>{detail}</p>
    </div>
  );
}

function LeaveSummaryTextField({
  label,
  value
}: {
  label: string;
  value?: string | number | null;
}) {
  return (
    <div className="leave-summary-text-field">
      <strong>{label}</strong>
      <span>{value || '-'}</span>
    </div>
  );
}

function PermissionPrintModal({
  request,
  onClose
}: {
  request: LeaveRequest;
  onClose: () => void;
}) {

  function handlePrint() {
    window.print();
  }

  const isOfficial =
    request.exit_reason === 'tramite_oficial';

  return (

    <div className="modal-overlay">

      <div className="modal-content modal-content-wide">

        <div className="permission-print-actions">
          <button
            className="btn-secondary"
            type="button"
            onClick={onClose}
          >
            Cerrar
          </button>

          <button
            className="btn-success"
            type="button"
            onClick={handlePrint}
          >
            Imprimir
          </button>
        </div>

        <div className="permission-print-area">
          {request.code === '26'
            ? (
              <Code26PrintArea
                request={request}
              />
            )
            : isMinistryLeaveCode(request.code)
              ? (
                <MinistryLicensePrint
                  request={request}
                />
              )
            : (
              <PermissionPrintCopy
                request={request}
                isOfficial={isOfficial}
              />
            )}
        </div>

      </div>

    </div>
  );
}

function MinistryLicensePrint({
  request
}: {
  request: LeaveRequest;
}) {

  const details =
    getMinistryLicenseDetails(request);

  return (
    <section className="ministry-license-print">
      <div className="ministry-license-header">
        <div>
          <h2>Solicitud de licencia</h2>
          <p>Hospital Municipal de Punta Lara</p>
        </div>
        <div>
          <span>Region sanitaria</span>
          <strong>11</strong>
        </div>
      </div>

      <div className="ministry-box">
        <h3>Datos del agente</h3>
        <div className="ministry-grid ministry-grid-2">
          <PrintField
            label="Apellido y nombre"
            value={request.full_name}
          />
          <PrintField
            label="DNI"
            value={request.dni}
          />
          <PrintField
            label="Legajo"
            value={request.file_number}
          />
          <PrintField
            label="Servicio / sector"
            value={request.department_name}
          />
          <PrintField
            label="Fecha de ingreso"
          value={formatDisplayDate(request.hire_date)}
          />
          <PrintField
            label="Cargo / regimen"
            value={request.employment_type}
          />
        </div>
      </div>

      <div className="ministry-box">
        <h3>Licencia solicitada</h3>
        <div className="ministry-license-options">
          <MinistryLicenseBlock
            title="Anual"
            checked={request.code === '8'}
            request={request}
            showBalance={request.code === '8'}
          />
          <MinistryLicenseBlock
            title="Anual complementaria"
            checked={request.code === '29'}
            request={request}
            showLastAnnualLeave={request.code === '29'}
          />
          <MinistryLicenseBlock
            title="Duelo"
            checked={['14', '15'].includes(request.code)}
            request={request}
            extraLabel="Vinculo"
          />
          <MinistryLicenseBlock
            title="Matrimonio"
            checked={request.code === '16'}
            request={request}
          />
          <MinistryLicenseBlock
            title="Pre examen / examen"
            checked={['17', '18'].includes(request.code)}
            request={request}
            showExamOptions={['17', '18'].includes(request.code)}
          />
        </div>
      </div>

      <div className="ministry-box ministry-selected-detail">
        <h3>Detalle</h3>
        <div className="ministry-grid ministry-grid-3">
          <PrintField
            label="Clave"
            value={`${request.code} - ${request.description}`}
          />
          <PrintField
            label="Tipo"
            value={details}
          />
          <PrintField
            label="Dias"
            value={formatPrintNumber(request.total_days)}
          />
        </div>
        <PrintField
          label="Observaciones"
          value={request.notes}
        />
      </div>

      <div className="ministry-signatures">
        <SignatureBox title="Agente" />
        <SignatureBox title="Jefe inmediato" />
        <SignatureBox title="Jefe de personal" />
        <SignatureBox title="Direccion" />
      </div>
    </section>
  );
}

function MinistryLicenseBlock({
  title,
  checked,
  request,
  extraLabel,
  showBalance = false,
  showLastAnnualLeave = false,
  showExamOptions = false
}: {
  title: string;
  checked: boolean;
  request: LeaveRequest;
  extraLabel?: string;
  showBalance?: boolean;
  showLastAnnualLeave?: boolean;
  showExamOptions?: boolean;
}) {

  return (
    <div className={checked ? 'ministry-license-block active' : 'ministry-license-block'}>
      <div className="ministry-license-block-title">
        <span className="ministry-check">
          {checked ? 'X' : ''}
        </span>
        <strong>{title}</strong>
      </div>
      {showBalance
        ? (
          <>
            <div className="ministry-annual-line">
              <PrintField
                label="Cantidad de dias"
                value={checked ? formatPrintNumber(request.total_days) : ''}
              />
              <PrintField
                label="Del total de"
                value={
                  checked
                    ? formatPrintNumber(request.balance_available_before_request)
                    : ''
                }
              />
              <PrintField
                label="Dias pendientes"
                value={
                  checked
                    ? formatPrintNumber(request.balance_pending_after_request)
                    : ''
                }
              />
            </div>
            <div className="ministry-grid ministry-grid-2 ministry-date-range">
              <PrintField
                label="Desde"
                value={checked ? formatDisplayDate(request.start_date) : ''}
              />
              <PrintField
                label="Hasta"
                value={checked ? formatDisplayDate(request.end_date) : ''}
              />
            </div>
          </>
        )
        : showExamOptions
          ? (
            <ExamLicenseBlock
              request={request}
              checked={checked}
            />
          )
        : (
          <>
            {showLastAnnualLeave && (
              <div className="ministry-complementary-line">
                <PrintField
                  label="Cantidad de dias"
                  value={checked ? formatPrintNumber(request.total_days) : ''}
                />
                <PrintField
                  label="Ultima licencia anual"
                  value={
                    checked
                      ? formatDisplayDate(request.last_annual_leave_date)
                      : ''
                  }
                />
              </div>
            )}
            <div className="ministry-grid ministry-grid-3">
              <PrintField
                label="Desde"
                value={checked ? formatDisplayDate(request.start_date) : ''}
              />
              <PrintField
                label="Hasta"
                value={checked ? formatDisplayDate(request.end_date) : ''}
              />
              {!showLastAnnualLeave && (
                <PrintField
                  label="Dias"
                  value={checked ? formatPrintNumber(request.total_days) : ''}
                />
              )}
            </div>
          </>
        )}
      {extraLabel && (
        <PrintField
          label={extraLabel}
          value=""
        />
      )}
    </div>
  );
}

function PrintField({
  label,
  value
}: {
  label: string;
  value?: string | number | null;
}) {

  return (
    <div className="print-field">
      <span>{label}</span>
      <strong>{value || ''}</strong>
    </div>
  );
}

function ExamLicenseBlock({
  request,
  checked
}: {
  request: LeaveRequest;
  checked: boolean;
}) {

  return (
    <>
      <div className="ministry-exam-options">
        {examLicenseOptions.map((option) => {

          const isSelected =
            checked &&
            request.exam_type === option;

          return (
            <div
              className={isSelected ? 'ministry-exam-option active' : 'ministry-exam-option'}
              key={option}
            >
              <span className="ministry-check">
                {isSelected ? 'X' : ''}
              </span>
              <strong>{option}</strong>
              <em>
                {isSelected
                  ? formatPrintNumber(request.total_days)
                  : ''}
              </em>
              <small>dias</small>
            </div>
          );
        })}
      </div>

      <div className="ministry-grid ministry-grid-2 ministry-date-range">
        <PrintField
          label="Desde"
          value={checked ? formatDisplayDate(request.start_date) : ''}
        />
        <PrintField
          label="Hasta"
          value={checked ? formatDisplayDate(request.end_date) : ''}
        />
      </div>
    </>
  );
}

function formatPrintNumber(
  value?: string | number | null
) {

  if (value === null || value === undefined || value === '') {
    return '';
  }

  const numeric =
    Number(value);

  if (!Number.isNaN(numeric)) {
    return String(Math.trunc(numeric));
  }

  return String(value);
}

function SignatureBox({
  title
}: {
  title: string;
}) {

  return (
    <div className="ministry-signature-box">
      <span />
      <p>{title}</p>
    </div>
  );
}

function getMinistryLicenseDetails(
  request: LeaveRequest
) {

  if (request.code === '8') {
    return 'Licencia anual';
  }

  if (request.code === '29') {
    return 'Licencia anual complementaria';
  }

  if (['14', '15'].includes(request.code)) {
    return 'Duelo';
  }

  if (request.code === '16') {
    return 'Matrimonio';
  }

  if (['17', '18'].includes(request.code)) {
    return 'Pre examen / examen';
  }

  return request.description;
}

function Code26PrintArea({
  request
}: {
  request: LeaveRequest;
}) {

  return (
    <div className="code26-print-area">
      <Code26PrintCopy
        request={request}
      />
    </div>
  );
}

function Code26PrintCopy({
  request
}: {
  request: LeaveRequest;
}) {

  return (
    <section className="code26-print-copy">
      <h2>HOSPITAL MUNICIPAL DE PUNTA LARA</h2>
      <h3>CLAVE 26</h3>

      <div className="code26-print-row">
        <span>Apellido y Nombre:</span>
        <strong>{request.full_name}</strong>
      </div>

      <div className="code26-print-row">
        <span>Servicio:</span>
        <strong>{request.department_name || '-'}</strong>
      </div>

      <div className="code26-print-grid">
        <div className="code26-print-row">
          <span>Fecha:</span>
          <strong>{formatDisplayDate(request.start_date)}</strong>
        </div>
        <div className="code26-print-row">
          <span>Turno:</span>
          <strong>{request.shift_label || '-'}</strong>
        </div>
      </div>

      <div className="code26-print-signatures">
        <div>
          <span />
          <p>Firma del empleado</p>
        </div>
        <div>
          <span />
          <p>Firma Jefe inmediato</p>
        </div>
      </div>
    </section>
  );
}

function PermissionPrintCopy({
  request,
  isOfficial
}: {
  request: LeaveRequest;
  isOfficial: boolean;
}) {

  const isEntry =
    request.permission_kind === 'entrada';

  const permissionTitle =
    isEntry
      ? 'PERMISO DE ENTRADA'
      : 'PERMISO DE SALIDA';

  const firstTimeLabel =
    isEntry
      ? 'Hora entrada:'
      : 'Hora salida:';

  const secondTimeLabel =
    isEntry
      ? 'Hora salida:'
      : request.no_return
        ? 'Sin retorno:'
        : 'Hora regreso:';

  return (

    <section className="permission-print-copy">
      <h2>HOSPITAL MUNICIPAL DE PUNTA LARA</h2>
      <h3>{permissionTitle}</h3>

      <div className="permission-print-row">
        <span>Apellido y Nombre:</span>
        <strong>{request.full_name}</strong>
      </div>

      <div className="permission-print-row">
        <span>Departamento:</span>
        <strong>{request.department_name || '-'}</strong>
      </div>

      <div className="permission-print-row permission-print-motive">
        <span>Motivo:</span>
        <label>
          <span className="permission-print-box">
            {!isOfficial ? 'X' : ''}
          </span>
          Particular
        </label>
        <label>
          <span className="permission-print-box">
            {isOfficial ? 'X' : ''}
          </span>
          Tramite Oficial
        </label>
      </div>

      <div className="permission-print-row">
        <span>Fecha:</span>
        <strong>{formatDisplayDate(request.start_date)}</strong>
      </div>

      <div className="permission-print-row permission-print-hours">
        <div>
          <span>{firstTimeLabel}</span>
          <strong>{formatPrintTime(request.exit_time)}</strong>
        </div>
        <div>
          <span>{secondTimeLabel}</span>
          <strong>
            {request.no_return
              ? 'SI'
              : formatPrintTime(request.return_time)}
          </strong>
        </div>
      </div>

      <div className="permission-print-notes">
        <span>Clave:</span>
        <strong>{request.code} - {request.description}</strong>
        {request.notes && (
          <p>{request.notes}</p>
        )}
      </div>

      <div className="permission-print-signatures">
        <div>
          <span />
          <p>Firma del Empleado</p>
        </div>
        <div>
          <span />
          <p>Firma del Jefe de Departamento</p>
        </div>
        <div>
          <span />
          <p>Firma del Director</p>
        </div>
      </div>
    </section>
  );
}
