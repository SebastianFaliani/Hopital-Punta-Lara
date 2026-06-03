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
  getAttendanceCodes,
  getDepartments,
  getEmployees,
  getEmployeeDirectiveSummary,
  getAttendanceSummary,
  getEmployeeLeaveSummary,
  getLeaveBalanceAdjustments,
  getLeaveRequests,
  getVacationBalances,
  getVacationRules,
  saveAttendanceMonth,
  toggleEmployee,
  updateAttendanceCode,
  completeLeaveReturn,
  updateEmployee,
  updateLeaveRequest,
  updateLeaveRequestStatus,
  updateVacationBalance,
  updateVacationRule
} from './personnel.service';

export async function handleGetDepartments(
  req: Request,
  res: Response
) {

  try {
    return res.json({
      success: true,
      data: await getDepartments()
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export async function handleCreateDepartment(
  req: Request,
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
      await createDepartment(req.body);

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
  req: Request,
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
          departmentId
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
      req.user?.id
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

export async function handleGetAttendanceSummary(
  req: Request,
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
          departmentId
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
  req: Request,
  res: Response
) {

  try {
    return res.json({
      success: true,
      data: await getLeaveRequests()
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export async function handleGetEmployeeLeaveSummary(
  req: Request,
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
          month
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
  req: Request,
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
          month
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
        req.user?.id
      );

    await logAudit({
      user: req.user,
      module: 'personal',
      action: 'crear_licencia',
      entityType: 'leave_request',
      entityId: id,
      description:
        `Creo licencia clave ${req.body.code} para empleado ${req.body.employee_id}`,
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
      req.user?.id
    );

    await logAudit({
      user: req.user,
      module: 'personal',
      action: 'editar_licencia',
      entityType: 'leave_request',
      entityId: Number(req.params.id),
      description:
        `Edito licencia clave ${req.body.code} del empleado ${req.body.employee_id}`,
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
      req.body.rejected_reason
    );

    await logAudit({
      user: req.user,
      module: 'personal',
      action: `licencia_${req.body.status}`,
      entityType: 'leave_request',
      entityId: Number(req.params.id),
      description:
        `Cambio estado de licencia a ${req.body.status}`,
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
      req.body
    );

    await logAudit({
      user: req.user,
      module: 'personal',
      action: 'completar_regreso_43',
      entityType: 'leave_request',
      entityId: Number(req.params.id),
      description:
        'Completo regreso de permiso de salida clave 43',
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
      Number(req.body.allowed_days)
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
  req: Request,
  res: Response
) {

  try {
    const result =
      await getEmployees(req.query);

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
  req: Request,
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
      await createEmployee(req.body);

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
  req: Request,
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
