import { Router }
  from 'express';

import {
  authenticateToken,
  authorizeRoles
} from '../auth/auth.middleware';

import {
  handleCreateDepartment,
  handleCreateAttendanceCode,
  handleCreateEmployee,
  handleCreateLeaveBalanceAdjustment,
  handleCreateLeaveRequest,
  handleCreateVacationRule,
  handleDeleteLeaveBalanceAdjustment,
  handleGetAttendanceCodes,
  handleGetAttendanceMonth,
  handleGetAttendanceSummary,
  handleGetEmployeeDirectiveSummary,
  handleGetDepartments,
  handleGetEmployeeLeaveSummary,
  handleGetEmployees,
  handleGetLeaveBalanceAdjustments,
  handleGetLeaveRequests,
  handleGetVacationBalances,
  handleGetVacationRules,
  handleSaveAttendanceMonth,
  handleToggleEmployee,
  handleUpdateAttendanceCode,
  handleCompleteLeaveReturn,
  handleUpdateEmployee,
  handleUpdateLeaveRequestStatus,
  handleUpdateVacationBalance,
  handleUpdateVacationRule
} from './personnel.controller';

const router = Router();

router.use(
  authenticateToken,
  authorizeRoles('admin', 'user', 'dir')
);

router.get(
  '/departments',
  handleGetDepartments
);

router.post(
  '/departments',
  handleCreateDepartment
);

router.get(
  '/attendance-codes',
  handleGetAttendanceCodes
);

router.post(
  '/attendance-codes',
  handleCreateAttendanceCode
);

router.put(
  '/attendance-codes/:id',
  handleUpdateAttendanceCode
);

router.get(
  '/attendance',
  handleGetAttendanceMonth
);

router.put(
  '/attendance',
  handleSaveAttendanceMonth
);

router.get(
  '/attendance/summary',
  handleGetAttendanceSummary
);

router.get(
  '/leave-requests',
  handleGetLeaveRequests
);

router.get(
  '/employees/:employeeId/leave-summary',
  handleGetEmployeeLeaveSummary
);

router.get(
  '/employees/:employeeId/directive-summary',
  handleGetEmployeeDirectiveSummary
);

router.post(
  '/leave-requests',
  handleCreateLeaveRequest
);

router.patch(
  '/leave-requests/:id/status',
  handleUpdateLeaveRequestStatus
);

router.patch(
  '/leave-requests/:id/return',
  handleCompleteLeaveReturn
);

router.get(
  '/vacation-rules',
  handleGetVacationRules
);

router.post(
  '/vacation-rules',
  handleCreateVacationRule
);

router.put(
  '/vacation-rules/:id',
  handleUpdateVacationRule
);

router.get(
  '/vacation-balances',
  handleGetVacationBalances
);

router.put(
  '/vacation-balances/:id',
  handleUpdateVacationBalance
);

router.get(
  '/leave-balance-adjustments',
  handleGetLeaveBalanceAdjustments
);

router.post(
  '/leave-balance-adjustments',
  handleCreateLeaveBalanceAdjustment
);

router.delete(
  '/leave-balance-adjustments/:id',
  handleDeleteLeaveBalanceAdjustment
);

router.get(
  '/employees',
  handleGetEmployees
);

router.post(
  '/employees',
  handleCreateEmployee
);

router.put(
  '/employees/:id',
  handleUpdateEmployee
);

router.patch(
  '/employees/:id/status',
  handleToggleEmployee
);

export default router;
