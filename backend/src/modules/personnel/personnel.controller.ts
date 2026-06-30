import {
  Request,
  Response
} from 'express';

import {
  AuthRequest
} from '../auth/auth.middleware';

import {
  logAudit
} from '../audit/audit.service';

import {
  createAttendanceCode,
  createDepartment,
  createEmployee,
  createLeaveBalanceAdjustment,
  createLeaveRequest,
  createVacationRule,
  deleteLeaveBalanceAdjustment,
  getAttendanceMonth,
  getAttendanceEmployeeYear,
  getAttendanceCodes,
  getDepartments,
  getEmployees,
  getEmployeeDirectiveSummary,
  getAttendanceSummary,
  getEmployeeLeaveSummary,
  getLeaveRequestAuditDetail,
  getLeaveRules,
  getPlannedDaysOffMonth,
  formatLeaveAuditDetail,
  fillPresentAttendanceDay,
  getLeaveBalanceAdjustments,
  getLeaveRequests,
  getVacationBalances,
  getVacationRules,
  savePlannedDaysOffMonth,
  saveAttendanceMonth,
  toggleEmployee,
  updateAttendanceCode,
  completeLeaveReturn,
  updateEmployee,
  updateLeaveRequest,
  updateLeaveRequestStatus,
  updateLeaveRule,
  updateVacationBalance,
  updateVacationRule
} from './personnel.service';

export async function handleGetDepartments(
  req: AuthRequest,
  res: Response
) {

  try {
    return res.json({
      success: true,
      data:
        await getDepartments(
          req.user,
          req.query.facility_id
            ? Number(req.query.facility_id)
            : null
        )
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export async function handleCreateDepartment(
  req: AuthRequest,
  res: Response
) {

  try {

    if (!req.body.name) {
      return res.status(400).json({
        success: false,
        message: 'El sector es obligatorio'
      });
    }

    const id =
      await createDepartment(
        req.body,
        req.user
      );

    return res.status(201).json({
      success: true,
      data: { id }
    });

  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function handleGetAttendanceCodes(
  req: Request,
  res: Response
) {

  try {
    return res.json({
      success: true,
      data: await getAttendanceCodes()
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export async function handleCreateAttendanceCode(
  req: Request,
  res: Response
) {

  try {

    const id =
      await createAttendanceCode(req.body);

    return res.status(201).json({
      success: true,
      data: { id }
    });

  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function handleUpdateAttendanceCode(
  req: Request,
  res: Response
) {

  try {

    if (!req.body.code || !req.body.description) {
      return res.status(400).json({
        success: false,
        message:
          'Codigo y descripcion son obligatorios'
      });
    }

    await updateAttendanceCode(
      Number(req.params.id),
      req.body
    );

    return res.json({
      success: true
    });

  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function handleGetLeaveRules(
  req: Request,
  res: Response
) {

  try {
    return res.json({
      success: true,
      data: await getLeaveRules()
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export async function handleUpdateLeaveRule(
  req: AuthRequest,
  res: Response
) {

  try {
    const id =
      Number(req.params.id);

    if (!id || !req.body.name) {
      return res.status(400).json({
        success: false,
        message:
          'Regla y nombre son obligatorios'
      });
    }

    await updateLeaveRule(
      id,
      req.body
    );

    await logAudit({
      user: req.user,
      module: 'personal',
      action: 'editar_regla_licencia',
      entityType: 'leave_rule',
      entityId: id,
      description:
        `Edito regla de licencia ${req.body.name}`,
      newData: req.body,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json({
      success: true
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

function readMonthParams(
  req: Request
) {

  const now =
    new Date();

  const year =
    Number(req.query.year || now.getFullYear());

  const month =
    Number(req.query.month || now.getMonth() + 1);

  const departmentId =
    req.query.department_id
      ? Number(req.query.department_id)
      : null;

  if (
    !year ||
    !month ||
    month < 1 ||
    month > 12
  ) {
    throw new Error(
      'Mes o anio invalido'
    );
  }

  return {
    year,
    month,
    departmentId
  };
}

export async function handleGetAttendanceMonth(
  req: AuthRequest,
  res: Response
) {

  try {

    const {
      year,
      month,
      departmentId
    } = readMonthParams(req);

    return res.json({
      success: true,
      data:
        await getAttendanceMonth(
          year,
          month,
          departmentId,
          req.user,
          req.query.facility_id
            ? Number(req.query.facility_id)
            : null
        )
    });

  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function handleGetAttendanceEmployeeYear(
  req: AuthRequest,
  res: Response
) {

  try {
    const year =
      Number(req.query.year);

    const employeeId =
      Number(req.query.employee_id);

    if (!year || !employeeId) {
      return res.status(400).json({
        success: false,
        message:
          'Anio y empleado son obligatorios'
      });
    }

    return res.json({
      success: true,
      data:
        await getAttendanceEmployeeYear(
          year,
          employeeId,
          req.user,
          req.query.facility_id
            ? Number(req.query.facility_id)
            : null
        )
    });

  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function handleSaveAttendanceMonth(
  req: AuthRequest,
  res: Response
) {

  try {

    const year =
      Number(req.body.year);

    const month =
      Number(req.body.month);

    if (
      !year ||
      !month ||
      month < 1 ||
      month > 12 ||
      !Array.isArray(req.body.records)
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Mes, anio y registros son obligatorios'
      });
    }

    await saveAttendanceMonth(
      year,
      month,
      req.body.records,
      req.user?.id,
      req.user
    );

    return res.json({
      success: true
    });

  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function handleFillPresentAttendanceDay(
  req: AuthRequest,
  res: Response
) {

  try {

    const year =
      Number(req.body.year);

    const month =
      Number(req.body.month);

    const day =
      Number(req.body.day);

    const departmentId =
      req.body.department_id
        ? Number(req.body.department_id)
        : null;

    if (
      !year ||
      !month ||
      !day ||
      month < 1 ||
      month > 12
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Anio, mes y dia son obligatorios'
      });
    }

    const result =
      await fillPresentAttendanceDay(
        year,
        month,
        day,
        departmentId,
        req.user?.id,
        req.user,
        req.body.facility_id
          ? Number(req.body.facility_id)
          : null
      );

    await logAudit({
      user: req.user,
      module: 'personal',
      action: 'completar_presentes',
      entityType: 'attendance_record',
      description:
        `Completo presentes del dia ${result.date}`,
      newData: {
        ...req.body,
        completed: result.completed
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json({
      success: true,
      data: result,
      message:
        `Se completaron ${result.completed} presente(s)`
    });

  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function handleGetPlannedDaysOffMonth(
  req: AuthRequest,
  res: Response
) {

  try {

    const {
      year,
      month,
      departmentId
    } = readMonthParams(req);

    return res.json({
      success: true,
      data:
        await getPlannedDaysOffMonth(
          year,
          month,
          departmentId,
          req.user,
          req.query.facility_id
            ? Number(req.query.facility_id)
            : null
        )
    });

  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function handleSavePlannedDaysOffMonth(
  req: AuthRequest,
  res: Response
) {

  try {
    const year =
      Number(req.body.year);

    const month =
      Number(req.body.month);

    if (
      !year ||
      !month ||
      month < 1 ||
      month > 12 ||
      !Array.isArray(req.body.records)
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Mes, anio y registros son obligatorios'
      });
    }

    await savePlannedDaysOffMonth(
      year,
      month,
      req.body.records,
      req.user?.id,
      req.user
    );

    await logAudit({
      user: req.user,
      module: 'personal',
      action: 'guardar_francos_programados',
      entityType: 'employee_planned_days_off',
      description:
        `Guardo francos programados ${month}/${year}`,
      newData: req.body,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json({
      success: true
    });

  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function handleGetAttendanceSummary(
  req: AuthRequest,
  res: Response
) {

  try {

    const {
      year,
      month,
      departmentId
    } = readMonthParams(req);

    return res.json({
      success: true,
      data:
        await getAttendanceSummary(
          year,
          month,
          departmentId,
          req.user,
          req.query.facility_id
            ? Number(req.query.facility_id)
            : null
        )
    });

  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function handleGetLeaveRequests(
  req: AuthRequest,
  res: Response
) {

  try {
    return res.json({
      success: true,
      data:
        await getLeaveRequests(
          req.user,
          req.query.facility_id
            ? Number(req.query.facility_id)
            : null
        )
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export async function handleGetEmployeeLeaveSummary(
  req: AuthRequest,
  res: Response
) {

  try {

    const year =
      Number(
        req.query.year ||
          new Date().getFullYear()
      );

    const month =
      Number(
        req.query.month ||
          new Date().getMonth() + 1
      );

    return res.json({
      success: true,
      data:
        await getEmployeeLeaveSummary(
          Number(req.params.employeeId),
          year,
          month,
          req.user
        )
    });

  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function handleGetEmployeeDirectiveSummary(
  req: AuthRequest,
  res: Response
) {

  try {

    const now =
      new Date();

    const year =
      Number(
        req.query.year ||
          now.getFullYear()
      );

    const month =
      Number(
        req.query.month ||
          now.getMonth() + 1
      );

    return res.json({
      success: true,
      data:
        await getEmployeeDirectiveSummary(
          Number(req.params.employeeId),
          year,
          month,
          req.user
        )
    });

  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function handleCreateLeaveRequest(
  req: AuthRequest,
  res: Response
) {

  try {

    if (
      !req.body.employee_id ||
      !req.body.code ||
      !req.body.start_date
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Empleado, clave y fecha desde son obligatorios'
      });
    }

    const id =
      await createLeaveRequest(
        req.body,
        req.user?.id,
        req.user
      );

    const detail =
      await getLeaveRequestAuditDetail(id);

    await logAudit({
      user: req.user,
      module: 'personal',
      action: 'crear_licencia',
      entityType: 'leave_request',
      entityId: id,
      description:
        `Creo licencia ${formatLeaveAuditDetail(detail)}`,
      newData: req.body,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.status(201).json({
      success: true,
      data: { id }
    });

  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function handleUpdateLeaveRequest(
  req: AuthRequest,
  res: Response
) {

  try {

    if (
      !req.body.employee_id ||
      !req.body.code ||
      !req.body.start_date
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Empleado, clave y fecha desde son obligatorios'
      });
    }

    await updateLeaveRequest(
      Number(req.params.id),
      req.body,
      req.user?.id,
      req.user
    );

    const detail =
      await getLeaveRequestAuditDetail(
        Number(req.params.id)
      );

    await logAudit({
      user: req.user,
      module: 'personal',
      action: 'editar_licencia',
      entityType: 'leave_request',
      entityId: Number(req.params.id),
      description:
        `Edito licencia ${formatLeaveAuditDetail(detail)}`,
      newData: req.body,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json({
      success: true
    });

  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function handleUpdateLeaveRequestStatus(
  req: AuthRequest,
  res: Response
) {

  try {

    await updateLeaveRequestStatus(
      Number(req.params.id),
      req.body.status,
      req.user?.id,
      req.body.rejected_reason,
      req.user
    );

    const detail =
      await getLeaveRequestAuditDetail(
        Number(req.params.id)
      );

    await logAudit({
      user: req.user,
      module: 'personal',
      action: `licencia_${req.body.status}`,
      entityType: 'leave_request',
      entityId: Number(req.params.id),
      description:
        `Cambio estado de licencia a ${req.body.status}: ${formatLeaveAuditDetail(detail)}`,
      newData: req.body,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json({
      success: true
    });

  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function handleCompleteLeaveReturn(
  req: AuthRequest,
  res: Response
) {

  try {

    await completeLeaveReturn(
      Number(req.params.id),
      req.body,
      req.user
    );

    const detail =
      await getLeaveRequestAuditDetail(
        Number(req.params.id)
      );

    await logAudit({
      user: req.user,
      module: 'personal',
      action: 'completar_regreso_43',
      entityType: 'leave_request',
      entityId: Number(req.params.id),
      description:
        `Completo regreso de permiso de salida: ${formatLeaveAuditDetail(detail)}`,
      newData: req.body,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json({
      success: true
    });

  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function handleGetVacationRules(
  req: Request,
  res: Response
) {

  try {
    return res.json({
      success: true,
      data: await getVacationRules()
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export async function handleCreateVacationRule(
  req: Request,
  res: Response
) {

  try {
    const id =
      await createVacationRule(req.body);

    return res.status(201).json({
      success: true,
      data: { id }
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function handleUpdateVacationRule(
  req: Request,
  res: Response
) {

  try {
    await updateVacationRule(
      Number(req.params.id),
      req.body
    );

    return res.json({
      success: true
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function handleGetVacationBalances(
  req: Request,
  res: Response
) {

  try {
    const year =
      Number(
        req.query.year ||
          new Date().getFullYear()
      );

    return res.json({
      success: true,
      data:
        await getVacationBalances(year)
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function handleUpdateVacationBalance(
  req: Request,
  res: Response
) {

  try {
    await updateVacationBalance(
      Number(req.params.id),
      Number(req.body.allowed_days),
      Number(req.body.used_days)
    );

    return res.json({
      success: true
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function handleGetLeaveBalanceAdjustments(
  req: Request,
  res: Response
) {

  try {
    return res.json({
      success: true,
      data: await getLeaveBalanceAdjustments()
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export async function handleCreateLeaveBalanceAdjustment(
  req: AuthRequest,
  res: Response
) {

  try {
    const id =
      await createLeaveBalanceAdjustment(
        req.body,
        req.user?.id
      );

    return res.status(201).json({
      success: true,
      data: { id }
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function handleDeleteLeaveBalanceAdjustment(
  req: Request,
  res: Response
) {

  try {
    await deleteLeaveBalanceAdjustment(
      Number(req.params.id)
    );

    return res.json({
      success: true
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function handleGetEmployees(
  req: AuthRequest,
  res: Response
) {

  try {
    const result =
      await getEmployees(
        req.query,
        req.user
      );

    if (!Array.isArray(result)) {
      return res.json({
        success: true,
        data: result.employees,
        pagination: result.pagination
      });
    }

    return res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export async function handleCreateEmployee(
  req: AuthRequest,
  res: Response
) {

  try {

    if (!req.body.full_name) {
      return res.status(400).json({
        success: false,
        message:
          'El nombre y apellido son obligatorios'
      });
    }

    const id =
      await createEmployee(
        req.body,
        req.user
      );

    return res.status(201).json({
      success: true,
      data: { id }
    });

  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function handleUpdateEmployee(
  req: AuthRequest,
  res: Response
) {

  try {

    if (!req.body.full_name) {
      return res.status(400).json({
        success: false,
        message:
          'El nombre y apellido son obligatorios'
      });
    }

    await updateEmployee(
      Number(req.params.id),
      req.body,
      req.user
    );

    return res.json({
      success: true
    });

  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function handleToggleEmployee(
  req: Request,
  res: Response
) {

  try {
    await toggleEmployee(
      Number(req.params.id)
    );

    return res.json({
      success: true
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}
