import {
  useEffect,
  useState
} from 'react';

import { apiFetch }
  from '../api/api';
import { useAuth } from '../auth/useAuth';

type Department = {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
};

type Employee = {
  id: number;
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
    }
  >;
};

type AttendanceSummary = {
  employee_id: number;
  full_name: string;
  department_name: string | null;
  presente: number;
  franco: number;
  licencia: number;
  vacaciones: number;
  maternidad: number;
  gremial: number;
  ausencia: number;
  otro: number;
  sin_cargar: number;
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
  notes: string | null;
};

type VacationRule = {
  id: number;
  min_years: number;
  max_years: number | null;
  allowed_days: number;
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
  recentAttendance: Array<{
    attendance_date: string;
    code: string;
    description: string;
    category: string;
  }>;
};

type LeaveSummary = {
  vacation: {
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

const emptyEmployee = {
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
  used_days: '',
  used_hours: '',
  notes: ''
};

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
      days: 3,
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

  const readOnly =
    user?.role === 'dir';

  const [activeTab, setActiveTab] =
    useState('employees');

  const [employees, setEmployees] =
    useState<Employee[]>([]);

  const [departments, setDepartments] =
    useState<Department[]>([]);

  const [codes, setCodes] =
    useState<AttendanceCode[]>([]);

  const [attendanceRows, setAttendanceRows] =
    useState<AttendanceEmployee[]>([]);

  const [attendanceDays, setAttendanceDays] =
    useState(0);

  const [attendanceSummary, setAttendanceSummary] =
    useState<AttendanceSummary[]>([]);

  const [attendanceFilters, setAttendanceFilters] =
    useState(() => {

      const now =
        new Date();

      return {
        year: String(now.getFullYear()),
        month: String(now.getMonth() + 1),
        department: 'todos',
        departmentSearch: '',
        search: ''
      };
    });

  const [attendanceEdits, setAttendanceEdits] =
    useState<Record<string, string>>({});

  const [savingAttendance, setSavingAttendance] =
    useState(false);

  const [leaveRequests, setLeaveRequests] =
    useState<LeaveRequest[]>([]);

  const [printLeaveRequest, setPrintLeaveRequest] =
    useState<LeaveRequest | null>(null);

  const [returnLeaveRequest, setReturnLeaveRequest] =
    useState<LeaveRequest | null>(null);

  const [returnForm, setReturnForm] =
    useState({
      return_time: '',
      total_hours: ''
    });

  const [leaveForm, setLeaveForm] =
    useState(emptyLeaveForm);

  const [vacationRules, setVacationRules] =
    useState<VacationRule[]>([]);

  const [vacationYear] =
    useState(String(new Date().getFullYear()));

  const [vacationRuleForm, setVacationRuleForm] =
    useState(emptyVacationRuleForm);

  const [selectedLeaveEmployee, setSelectedLeaveEmployee] =
    useState<Employee | null>(null);

  const [leaveEmployeeSearch, setLeaveEmployeeSearch] =
    useState('');

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

  const [codeForm, setCodeForm] =
    useState(emptyCodeForm);

  const [employeeForm, setEmployeeForm] =
    useState(emptyEmployee);

  const [editingEmployee, setEditingEmployee] =
    useState<Employee | null>(null);

  const [departmentForm, setDepartmentForm] =
    useState({
      name: '',
      description: ''
    });

  const [filters, setFilters] =
    useState({
      search: '',
      department: 'todos',
      status: 'todos'
    });

  const [error, setError] =
    useState('');

  const [directiveSummary, setDirectiveSummary] =
    useState<DirectiveSummary | null>(null);

  const [loadingDirectiveSummary, setLoadingDirectiveSummary] =
    useState(false);

  async function loadData() {

    try {

      const [
        employeesRes,
        departmentsRes,
        codesRes
      ] = await Promise.all([
        apiFetch('/personnel/employees'),
        apiFetch('/personnel/departments'),
        apiFetch('/personnel/attendance-codes')
      ]);

      setEmployees(employeesRes.data);
      setDepartments(departmentsRes.data);
      setCodes(codesRes.data);

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

      const [
        attendanceRes,
        summaryRes
      ] = await Promise.all([
        apiFetch(
          `/personnel/attendance?${params.toString()}`
        ),
        apiFetch(
          `/personnel/attendance/summary?${params.toString()}`
        )
      ]);

      setAttendanceRows(
        attendanceRes.data.employees
      );
      setAttendanceDays(
        attendanceRes.data.days
      );
      setAttendanceSummary(
        summaryRes.data
      );
      setAttendanceEdits({});

    } catch (error: any) {

      setError(error.message);
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
  }

  function startEditEmployee(
    employee: Employee
  ) {

    setEditingEmployee(employee);
    setEmployeeForm({
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
      is_professional:
        employee.is_professional,
      notes:
        employee.notes || ''
    });
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
              department_id:
                employeeForm.department_id
                  ? Number(employeeForm.department_id)
                  : null
            })
        }
      );

      resetEmployeeForm();
      loadData();

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

    loadData();
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
            JSON.stringify(departmentForm)
        }
      );

      setDepartmentForm({
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

      const res =
        await apiFetch(
          '/personnel/leave-requests'
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

  function selectLeaveEmployee(
    employee: Employee
  ) {

    setSelectedLeaveEmployee(employee);
    setLeaveForm({
      ...leaveForm,
      employee_id: String(employee.id)
    });
    loadLeaveSummary(employee.id);
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

    const nextStartDate =
      target.name === 'start_date'
        ? target.value
        : nextForm.start_date;

    const automaticEndDate =
      getAutomaticEndDate(
        nextCode,
        nextStartDate
      );

    if (automaticEndDate) {
      nextForm.end_date =
        automaticEndDate;
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

      const res =
        await apiFetch(
        '/personnel/leave-requests',
        {
          method: 'POST',
          body:
            JSON.stringify({
              ...leaveForm,
              employee_id:
                selectedLeaveEmployee?.id ||
                Number(leaveForm.employee_id),
              total_hours:
                leaveForm.total_hours
                  ? Number(leaveForm.total_hours)
                  : 0
            })
        }
      );

      const createdId =
        res.data?.id;

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
        await apiFetch('/personnel/leave-requests');

      setLeaveRequests(requestsRes.data);

      const createdRequest =
        requestsRes.data.find(
          (request: LeaveRequest) =>
            request.id === createdId
        );

      if (
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

  function handleBalanceAdjustmentChange(
    e: React.ChangeEvent<
      HTMLInputElement |
      HTMLSelectElement |
      HTMLTextAreaElement
    >
  ) {

    setBalanceAdjustmentForm({
      ...balanceAdjustmentForm,
      [e.target.name]: e.target.value
    });
  }

  async function handleBalanceAdjustmentSubmit(
    e: React.FormEvent
  ) {

    e.preventDefault();
    setError('');

    try {

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
                balanceAdjustmentForm.used_days
                  ? Number(balanceAdjustmentForm.used_days)
                  : 0,
              used_hours:
                balanceAdjustmentForm.used_hours
                  ? Number(balanceAdjustmentForm.used_hours)
                  : 0
            })
        }
      );

      setBalanceAdjustmentForm(emptyBalanceAdjustmentForm);
      loadBalanceAdjustments();
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

  function updateAttendanceCell(
    employeeId: number,
    day: number,
    value: string
  ) {

    setAttendanceEdits({
      ...attendanceEdits,
      [`${employeeId}-${day}`]:
        value.toUpperCase()
    });
  }

  function hasPendingAttendanceChanges() {

    return Object.keys(attendanceEdits).length > 0;
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
    }

    setAttendanceFilters({
      ...attendanceFilters,
      ...data
    });
  }

  function focusAttendanceInput(
    rowIndex: number,
    day: number
  ) {

    const input =
      document.querySelector<HTMLInputElement>(
        `[data-attendance-row="${rowIndex}"][data-attendance-day="${day}"]`
      );

    input?.focus();
    input?.select();
  }

  function handleAttendanceKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    day: number
  ) {

    if (e.key === 'Enter') {
      e.preventDefault();
      focusAttendanceInput(
        rowIndex + 1,
        day
      );
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusAttendanceInput(
        rowIndex + 1,
        day
      );
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusAttendanceInput(
        rowIndex - 1,
        day
      );
    }

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusAttendanceInput(
        rowIndex,
        day + 1
      );
    }

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusAttendanceInput(
        rowIndex,
        day - 1
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
              code
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

    } catch (error: any) {

      setError(error.message);

    } finally {

      setSavingAttendance(false);
    }
  }

  useEffect(() => {

    loadData();

  }, []);

  useEffect(() => {

    const hasChanges =
      Object.keys(attendanceEdits).length > 0;

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

  }, [attendanceEdits, activeTab]);

  useEffect(() => {

    if (activeTab === 'attendance') {
      loadAttendance();
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
    vacationYear
  ]);

  const filteredEmployees =
    employees.filter((employee) => {

      const search =
        filters.search.toLowerCase();

      const matchesSearch =
        employee.full_name
          .toLowerCase()
          .includes(search) ||
        (employee.dni || '')
          .toLowerCase()
          .includes(search) ||
        (employee.cuil || '')
          .toLowerCase()
          .includes(search) ||
        (employee.file_number || '')
          .toLowerCase()
          .includes(search);

      const matchesDepartment =
        filters.department === 'todos' ||
        String(employee.department_id || '') ===
          filters.department;

      const matchesStatus =
        filters.status === 'todos' ||
        (
          filters.status === 'activo' &&
          employee.is_active
        ) ||
        (
          filters.status === 'inactivo' &&
          !employee.is_active
        );

      return (
        matchesSearch &&
        matchesDepartment &&
        matchesStatus
      );
    });

  const dayNumbers =
    Array.from(
      { length: attendanceDays },
      (_, index) => index + 1
    );

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
          employee.full_name
            .toLowerCase()
            .includes(search) ||
          (employee.dni || '')
            .toLowerCase()
            .includes(search) ||
          (employee.file_number || '')
            .toLowerCase()
            .includes(search)
        )
      );
    });

  const filteredAttendanceIds =
    new Set(
      filteredAttendanceRows.map((employee) => employee.id)
    );

  const filteredAttendanceSummary =
    attendanceSummary.filter((item) =>
      filteredAttendanceIds.has(item.employee_id)
    );

  const attendanceMonthValue =
    `${attendanceFilters.year}-${attendanceFilters.month.padStart(2, '0')}`;

  const filteredLeaveEmployees =
    employees
      .filter((employee) => employee.is_active)
      .filter((employee) => {

        const search =
          leaveEmployeeSearch
            .toLowerCase()
            .trim();

        if (!search) {
          return true;
        }

        return (
          employee.full_name
            .toLowerCase()
            .includes(search) ||
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

  const selectedEmployeeLeaveRequests =
    selectedLeaveEmployee
      ? leaveRequests.filter((request) =>
        request.employee_id === selectedLeaveEmployee.id
      )
      : [];

  const filteredLeaveRequests =
    leaveRequests.filter((request) => {

      const search =
        leaveRequestFilters.search
          .toLowerCase()
          .trim();

      const matchesSearch =
        !search ||
        request.full_name
          .toLowerCase()
          .includes(search) ||
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

  function isSunday(
    day: number
  ) {

    return new Date(
      Number(attendanceFilters.year),
      Number(attendanceFilters.month) - 1,
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
          <h1 className="page-title">
            Personal
          </h1>
          <p className="page-subtitle">
            Empleados, sectores y claves de presentismo.
          </p>
        </div>
      </div>

      <div className="module-tabs">
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

        {!readOnly && (
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

        {!readOnly && (
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

        {!readOnly && (
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

        {!readOnly && (
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
            Saldos iniciales
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
        activeTab === 'employees' && (
          <>
            {!readOnly && (
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
                name="department_id"
                value={employeeForm.department_id}
                onChange={handleEmployeeChange}
              >
                <option value="">
                  Sector
                </option>
                {departments.map((department) => (
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
            )}

            <div className="filter-bar">
              <input
                className="form-input"
                placeholder="Buscar por nombre, DNI, CUIL o legajo"
                value={filters.search}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    search: e.target.value
                  })
                }
              />

              <select
                className="form-input"
                value={filters.department}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    department: e.target.value
                  })
                }
              >
                <option value="todos">
                  Todos los sectores
                </option>
                {departments.map((department) => (
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
                    status: e.target.value
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
              Mostrando {filteredEmployees.length} de {employees.length} empleados
            </p>

            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>DNI</th>
                    <th>Sector</th>
                    <th>Ingreso</th>
                    <th>Antiguedad</th>
                    <th>Estado</th>
                      {(readOnly || user?.role === 'admin') && (
                        <th>Resumen</th>
                      )}
                      {!readOnly && (
                        <th>Acciones</th>
                      )}
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((employee) => (
                    <tr key={employee.id}>
                      <td>{employee.full_name}</td>
                      <td>{employee.dni || '-'}</td>
                      <td>{employee.department_name || '-'}</td>
                      <td>{toDateInput(employee.hire_date) || '-'}</td>
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
                          <button
                            className="btn-secondary"
                            type="button"
                            onClick={() =>
                              loadDirectiveSummary(employee)
                            }
                          >
                            Ver resumen
                          </button>
                        </td>
                      )}
                      {!readOnly && (
                        <td>
                          <div className="table-actions">
                            <button
                              className="btn-primary"
                              onClick={() =>
                                startEditEmployee(employee)
                              }
                            >
                              Editar
                            </button>

                            <button
                              className={
                                employee.is_active
                                  ? 'btn-danger'
                                  : 'btn-success'
                              }
                              onClick={() =>
                                handleToggleEmployee(employee.id)
                              }
                            >
                              {
                                employee.is_active
                                  ? 'Desactivar'
                                  : 'Activar'
                              }
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}

                  {
                    filteredEmployees.length === 0 && (
                      <tr>
                        <td colSpan={readOnly ? 7 : user?.role === 'admin' ? 8 : 7}>
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
            <div className="modal-content modal-content-wide">
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
                  <div className="dashboard-grid">
                    <div className="dashboard-card">
                      <h3>Antiguedad</h3>
                      <p>{directiveSummary.employee.seniority_years}</p>
                      <span>Ingreso {toDateInput(directiveSummary.employee.hire_date) || '-'}</span>
                    </div>

                    <div className="dashboard-card">
                      <h3>Ausencias del mes</h3>
                      <p>{directiveSummary.attendance.totals.ausencia || 0}</p>
                      <span>{directiveSummary.period.month}/{directiveSummary.period.year}</span>
                    </div>

                    <div className="dashboard-card">
                      <h3>Licencias del mes</h3>
                      <p>{directiveSummary.attendance.totals.licencia || 0}</p>
                      <span>Incluye articulos y permisos</span>
                    </div>

                    <div className="dashboard-card">
                      <h3>Vacaciones disponibles</h3>
                      <p>{directiveSummary.balances.vacation.available_days}</p>
                      <span>Asignadas {directiveSummary.balances.vacation.allowed_days}</span>
                    </div>

                    <div className="dashboard-card">
                      <h3>Articulo 26</h3>
                      <p>{directiveSummary.balances.code26.remaining_days}</p>
                      <span>Restantes en el año</span>
                    </div>

                    <div className="dashboard-card">
                      <h3>Horas 24/43</h3>
                      <p>{directiveSummary.balances.hours24_43.remaining_hours_year}</p>
                      <span>Este mes quedan {directiveSummary.balances.hours24_43.remaining_hours_month} hs</span>
                    </div>

                    <div className="dashboard-card">
                      <h3>Clave 29</h3>
                      <p>{directiveSummary.balances.code29.remaining_days}</p>
                      <span>Dias restantes</span>
                    </div>

                    <div className="dashboard-card">
                      <h3>Compensatorios</h3>
                      <p>{directiveSummary.balances.compensatory.remaining_days}</p>
                      <span>Ganados {directiveSummary.balances.compensatory.earned_days}</span>
                    </div>
                  </div>

                  <div className="dashboard-sections">
                    <section className="dashboard-panel">
                      <h2>Presentismo por clave</h2>
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
                            No hay presentismo cargado para este mes.
                          </p>
                        )}
                      </div>
                    </section>

                    <section className="dashboard-panel">
                      <h2>Ultimas licencias</h2>
                      <div className="dashboard-list">
                        {directiveSummary.recentLeaves.map((item) => (
                          <div
                            className="dashboard-list-item"
                            key={item.id}
                          >
                            <strong>{item.code} - {item.description}</strong>
                            <span>{toDateInput(item.start_date)} al {toDateInput(item.end_date)}</span>
                            <span>{item.status}</span>
                          </div>
                        ))}
                        {directiveSummary.recentLeaves.length === 0 && (
                          <p className="page-subtitle">
                            No hay licencias recientes.
                          </p>
                        )}
                      </div>
                    </section>

                    <section className="dashboard-panel">
                      <h2>Ultimas novedades de presentismo</h2>
                      <div className="dashboard-list">
                        {directiveSummary.recentAttendance.map((item) => (
                          <div
                            className="dashboard-list-item"
                            key={`${item.attendance_date}-${item.code}`}
                          >
                            <strong>{item.code} - {item.description}</strong>
                            <span>{toDateInput(item.attendance_date)}</span>
                            <span>{item.category}</span>
                          </div>
                        ))}
                        {directiveSummary.recentAttendance.length === 0 && (
                          <p className="page-subtitle">
                            No hay novedades recientes.
                          </p>
                        )}
                      </div>
                    </section>
                  </div>
                </>
              )}
            </div>
          </div>
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
                  onChange={(e) =>
                    setReturnForm({
                      ...returnForm,
                      return_time: e.target.value
                    })
                  }
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
        activeTab === 'departments' && (
          <>
            <form
              className="management-form"
              onSubmit={handleDepartmentSubmit}
            >
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
                    <th>Sector</th>
                    <th>Descripcion</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {departments.map((department) => (
                    <tr key={department.id}>
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
        activeTab === 'attendance' && (
          <>
            <div className="attendance-toolbar">
              <input
                className="form-input attendance-filter-small"
                type="month"
                value={attendanceMonthValue}
                onChange={(e) => {
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
                    department: 'todos'
                  }, true);
                }}
              />

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

              <button
                className="btn-primary"
                type="button"
                onClick={() => {
                  if (!confirmDiscardAttendanceChanges()) {
                    return;
                  }
                  setAttendanceEdits({});
                  loadAttendance();
                }}
              >
                Actualizar
              </button>

              <button
                className="btn-success"
                type="button"
                disabled={
                  savingAttendance ||
                  Object.keys(attendanceEdits).length === 0 ||
                  readOnly
                }
                onClick={saveAttendance}
              >
                {
                  savingAttendance
                    ? 'Guardando...'
                    : 'Guardar cambios'
                }
              </button>
            </div>

            <p className="results-summary">
              {filteredAttendanceRows.length} de {attendanceRows.length} empleados activos. Cambios pendientes: {Object.keys(attendanceEdits).length}
            </p>

            <div className="attendance-layout">
              <div className="attendance-grid-wrap">
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
                        {dayNumbers.map((day) => (
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
                              className={
                                isNonPresentCode(
                                  getAttendanceValue(
                                    employee,
                                    day
                                  )
                                )
                                  ? 'attendance-code-input attendance-code-danger'
                                  : 'attendance-code-input'
                              }
                              value={getAttendanceValue(
                                employee,
                                day
                              )}
                              onChange={(e) =>
                                !readOnly &&
                                updateAttendanceCell(
                                  employee.id,
                                  day,
                                  e.target.value
                                )
                              }
                              readOnly={readOnly}
                              onKeyDown={(e) =>
                                handleAttendanceKeyDown(
                                  e,
                                  rowIndex,
                                  day
                                )
                              }
                            />
                          </td>
                        ))}
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

              <div className="table-container leave-employee-picker">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Empleado</th>
                      <th>Pres.</th>
                      <th>Francos</th>
                      <th>Lic.</th>
                      <th>Vac.</th>
                      <th>Aus.</th>
                      <th>Otros</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAttendanceSummary.map((item) => (
                      <tr key={item.employee_id}>
                        <td>{item.full_name}</td>
                        <td>{item.presente}</td>
                        <td>{item.franco}</td>
                        <td>
                          {
                            item.licencia +
                            item.maternidad +
                            item.gremial
                          }
                        </td>
                        <td>{item.vacaciones}</td>
                        <td>{item.ausencia}</td>
                        <td>{item.otro}</td>
                      </tr>
                    ))}

                    {
                      filteredAttendanceSummary.length === 0 && (
                        <tr>
                          <td colSpan={7}>
                            Todavia no hay resumen para mostrar.
                          </td>
                        </tr>
                      )
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )
      }

      {
        activeTab === 'leaves' && (
          <>
            


              <div className="filter-bar">
                <input
                  className="form-input"
                  placeholder="Buscar por empleado, DNI, legajo o sector"
                  value={leaveEmployeeSearch}
                  onChange={(e) => {
                    setLeaveEmployeePage(0);
                    setLeaveEmployeeSearch(e.target.value)
                  }}
                />
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
                        <td>{employee.full_name}</td>
                        <td>{employee.dni || '-'}</td>
                        <td>{employee.file_number || '-'}</td>
                        <td>{employee.department_name || '-'}</td>
                        <td>{toDateInput(employee.hire_date) || '-'}</td>
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
                <div className="dashboard-grid">
                  <div className="dashboard-card">
                    <h3>Vacaciones clave 8</h3>
                    <p>{leaveSummary.vacation.available_days}</p>
                    <span>
                      Asignadas {leaveSummary.vacation.allowed_days}, usadas {leaveSummary.vacation.used_days}, pendientes {leaveSummary.vacation.pending_days}
                    </span>
                  </div>
                  <div className="dashboard-card">
                    <h3>Articulo 26</h3>
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
              )
            }

            {!readOnly && (
            <form
              className="personnel-form"
              onSubmit={handleLeaveSubmit}
            >
              <input
                className="form-input"
                value={
                  selectedLeaveEmployee
                    ? selectedLeaveEmployee.full_name
                    : 'Seleccione un empleado'
                }
                disabled
              />

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

              <input
                className="form-input"
                type="date"
                name="start_date"
                value={leaveForm.start_date}
                onChange={handleLeaveChange}
              />

              <input
                className="form-input"
                type="date"
                name="end_date"
                value={leaveForm.end_date}
                onChange={handleLeaveChange}
              />

              {(
                ['24', '35', '46'].includes(leaveForm.code) ||
                (
                  leaveForm.code === '43' &&
                  leaveForm.no_return
                )
              ) && (
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

                  {(leaveForm.code === '24') && (
                    <input
                      className="form-input"
                      type="time"
                      name="return_time"
                      aria-label="Hora salida"
                      value={leaveForm.return_time}
                      onChange={handleLeaveChange}
                    />
                  )}
                </>
              )}

              {leaveForm.code === '26' && (
                <input
                  className="form-input"
                  name="shift_label"
                  placeholder="Turno"
                  value={leaveForm.shift_label}
                  onChange={handleLeaveChange}
                />
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
                className="btn-success"
                type="submit"
                disabled={!selectedLeaveEmployee}
              >
                Crear solicitud
              </button>
            </form>
            )}

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
                    {!readOnly && (
                      <th>Acciones</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {selectedEmployeeLeaveRequests.map((request) => (
                    <tr key={request.id}>
                      <td>
                        <strong>{request.full_name}</strong>
                        <br />
                        <span>{request.department_name || '-'}</span>
                      </td>
                      <td>
                        {request.code} - {request.description}
                      </td>
                      <td>{toDateInput(request.start_date)}</td>
                      <td>{toDateInput(request.end_date)}</td>
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
                      {!readOnly && (
                        <td>
                        <div className="table-actions">
                          {isPrintableLeaveCode(request.code) && (
                            <button
                              className="btn-secondary"
                              type="button"
                              onClick={() =>
                                setPrintLeaveRequest(request)
                              }
                            >
                              Comprobante
                            </button>
                          )}

                          {request.code === '43' &&
                            !request.no_return &&
                            (!request.return_time || !Number(request.total_hours || 0)) && (
                              <button
                                className="btn-primary"
                                type="button"
                                onClick={() => {
                                  setReturnLeaveRequest(request);
                                  setReturnForm({
                                    return_time: request.return_time || '',
                                    total_hours: request.total_hours
                                      ? String(request.total_hours)
                                      : ''
                                  });
                                }}
                              >
                                Completar regreso
                              </button>
                            )}

                          {
                            request.status === 'pendiente' && (
                              <>
                                <button
                                  className="btn-success"
                                  type="button"
                                  onClick={() =>
                                    updateLeaveStatus(
                                      request.id,
                                      'aprobado'
                                    )
                                  }
                                >
                                  Aprobar
                                </button>
                                <button
                                  className="btn-danger"
                                  type="button"
                                  onClick={() =>
                                    updateLeaveStatus(
                                      request.id,
                                      'rechazado'
                                    )
                                  }
                                >
                                  Rechazar
                                </button>
                              </>
                            )
                          }
                          {
                            request.status !== 'cancelado' && (
                              <button
                                className="btn-secondary"
                                type="button"
                                onClick={() =>
                                  updateLeaveStatus(
                                    request.id,
                                    'cancelado'
                                  )
                                }
                              >
                                Cancelar
                              </button>
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
                        <td colSpan={readOnly ? 7 : 8}>
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
                    {!readOnly && (
                      <th>Acciones</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredLeaveRequests.map((request) => (
                    <tr key={request.id}>
                      <td>
                        <strong>{request.full_name}</strong>
                        <br />
                        <span>{request.department_name || '-'}</span>
                      </td>
                      <td>
                        {request.code} - {request.description}
                      </td>
                      <td>{toDateInput(request.start_date)}</td>
                      <td>{toDateInput(request.end_date)}</td>
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
                      {!readOnly && (
                        <td>
                        <div className="table-actions">
                          {isPrintableLeaveCode(request.code) && (
                            <button
                              className="btn-secondary"
                              type="button"
                              onClick={() =>
                                setPrintLeaveRequest(request)
                              }
                            >
                              Comprobante
                            </button>
                          )}

                          {request.code === '43' &&
                            !request.no_return &&
                            (!request.return_time || !Number(request.total_hours || 0)) && (
                              <button
                                className="btn-primary"
                                type="button"
                                onClick={() => {
                                  setReturnLeaveRequest(request);
                                  setReturnForm({
                                    return_time: request.return_time || '',
                                    total_hours: request.total_hours
                                      ? String(request.total_hours)
                                      : ''
                                  });
                                }}
                              >
                                Completar regreso
                              </button>
                            )}

                          {
                            request.status === 'pendiente' && (
                              <>
                                <button
                                  className="btn-success"
                                  type="button"
                                  onClick={() =>
                                    updateLeaveStatus(
                                      request.id,
                                      'aprobado'
                                    )
                                  }
                                >
                                  Aprobar
                                </button>
                                <button
                                  className="btn-danger"
                                  type="button"
                                  onClick={() =>
                                    updateLeaveStatus(
                                      request.id,
                                      'rechazado'
                                    )
                                  }
                                >
                                  Rechazar
                                </button>
                              </>
                            )
                          }
                          {
                            request.status !== 'cancelado' && (
                              <button
                                className="btn-secondary"
                                type="button"
                                onClick={() =>
                                  updateLeaveStatus(
                                    request.id,
                                    'cancelado'
                                  )
                                }
                              >
                                Cancelar
                              </button>
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
                        <td colSpan={readOnly ? 7 : 8}>
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
        activeTab === 'balance-adjustments' && (
          <>
            <form
              className="personnel-form"
              onSubmit={handleBalanceAdjustmentSubmit}
            >
              <select
                className="form-input"
                name="employee_id"
                value={balanceAdjustmentForm.employee_id}
                onChange={handleBalanceAdjustmentChange}
              >
                <option value="">Empleado</option>
                {employees
                  .filter((employee) => employee.is_active)
                  .map((employee) => (
                    <option
                      key={employee.id}
                      value={employee.id}
                    >
                      {employee.full_name}
                    </option>
                  ))}
              </select>

              <select
                className="form-input"
                name="code"
                value={balanceAdjustmentForm.code}
                onChange={handleBalanceAdjustmentChange}
              >
                {codes
                  .filter((code) =>
                    [
                      '8',
                      '29',
                      '34',
                      'C',
                      '26',
                      '24',
                      '43',
                      '46'
                    ].includes(code.code)
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
                type="date"
                name="adjustment_date"
                value={balanceAdjustmentForm.adjustment_date}
                onChange={handleBalanceAdjustmentChange}
              />

              <input
                className="form-input"
                type="number"
                name="year"
                placeholder="Año"
                value={balanceAdjustmentForm.year}
                onChange={handleBalanceAdjustmentChange}
              />

              <input
                className="form-input"
                type="number"
                min="1"
                max="12"
                name="month"
                placeholder="Mes"
                value={balanceAdjustmentForm.month}
                onChange={handleBalanceAdjustmentChange}
              />

              <input
                className="form-input"
                type="number"
                min="0"
                step="1"
                name="used_days"
                placeholder="Dias ya usados"
                value={balanceAdjustmentForm.used_days}
                onChange={handleBalanceAdjustmentChange}
              />

              <input
                className="form-input"
                type="number"
                min="0"
                step="0.5"
                name="used_hours"
                placeholder="Horas ya usadas"
                value={balanceAdjustmentForm.used_hours}
                onChange={handleBalanceAdjustmentChange}
              />

              <textarea
                className="form-input personnel-notes"
                name="notes"
                placeholder="Notas"
                rows={3}
                value={balanceAdjustmentForm.notes}
                onChange={handleBalanceAdjustmentChange}
              />

              <button
                className="btn-success"
                type="submit"
              >
                Cargar saldo inicial
              </button>
            </form>

            <p className="results-summary">
              Estos ajustes representan consumos previos al uso del sistema y no cargan presentismo.
            </p>

            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Empleado</th>
                    <th>Clave</th>
                    <th>Fecha</th>
                    <th>Año</th>
                    <th>Mes</th>
                    <th>Dias</th>
                    <th>Horas</th>
                    <th>Notas</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {balanceAdjustments.map((adjustment) => (
                    <tr key={adjustment.id}>
                      <td>
                        <strong>{adjustment.full_name}</strong>
                        <br />
                        <span>{adjustment.department_name || '-'}</span>
                      </td>
                      <td>
                        {adjustment.code} - {adjustment.description}
                      </td>
                      <td>
                        {toDateInput(adjustment.adjustment_date) || '-'}
                      </td>
                      <td>{adjustment.year}</td>
                      <td>{adjustment.month || '-'}</td>
                      <td>{Math.trunc(Number(adjustment.used_days || 0)) || '-'}</td>
                      <td>{adjustment.used_hours || '-'}</td>
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

                  {
                    balanceAdjustments.length === 0 && (
                      <tr>
                        <td colSpan={9}>
                          Todavia no hay saldos iniciales cargados.
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
            value={toDateInput(request.hire_date)}
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
                value={checked ? toDateInput(request.start_date) : ''}
              />
              <PrintField
                label="Hasta"
                value={checked ? toDateInput(request.end_date) : ''}
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
                      ? toDateInput(request.last_annual_leave_date)
                      : ''
                  }
                />
              </div>
            )}
            <div className="ministry-grid ministry-grid-3">
              <PrintField
                label="Desde"
                value={checked ? toDateInput(request.start_date) : ''}
              />
              <PrintField
                label="Hasta"
                value={checked ? toDateInput(request.end_date) : ''}
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
          value={checked ? toDateInput(request.start_date) : ''}
        />
        <PrintField
          label="Hasta"
          value={checked ? toDateInput(request.end_date) : ''}
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
          <strong>{toDateInput(request.start_date)}</strong>
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
        <strong>{toDateInput(request.start_date)}</strong>
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
