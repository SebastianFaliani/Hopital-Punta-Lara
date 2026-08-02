import { Router }
  from 'express';

import {
  authenticateToken,
  authorizeRoles
} from '../auth/auth.middleware';

import {
  create,
  createMaintenanceRecord,
  createType,
  getAmbulances,
  getMaintenanceAlerts,
  getMaintenanceRecords,
  getTypes,
  toggleStatus,
  toggleTypeStatus,
  updateMaintenanceRecord,
  updateType,
  update
} from './ambulances.controller';

const router = Router();

router.get(
  '/types',
  authenticateToken,
  authorizeRoles('admin', 'user', 'dir'),
  getTypes
);

router.post(
  '/types',
  authenticateToken,
  authorizeRoles('admin', 'user'),
  createType
);

router.put(
  '/types/:id',
  authenticateToken,
  authorizeRoles('admin', 'user'),
  updateType
);

router.patch(
  '/types/:id/status',
  authenticateToken,
  authorizeRoles('admin', 'user'),
  toggleTypeStatus
);

router.get(
  '/',
  authenticateToken,
  authorizeRoles('admin', 'user', 'dir'),
  getAmbulances
);

router.get(
  '/maintenance-alerts',
  authenticateToken,
  authorizeRoles('admin', 'user', 'dir'),
  getMaintenanceAlerts
);

router.post(
  '/',
  authenticateToken,
  authorizeRoles('admin', 'user'),
  create
);

router.put(
  '/:id',
  authenticateToken,
  authorizeRoles('admin', 'user'),
  update
);

router.patch(
  '/:id/status',
  authenticateToken,
  authorizeRoles('admin', 'user'),
  toggleStatus
);

router.get(
  '/:id/maintenance',
  authenticateToken,
  authorizeRoles('admin', 'user', 'dir'),
  getMaintenanceRecords
);

router.post(
  '/:id/maintenance',
  authenticateToken,
  authorizeRoles('admin', 'user'),
  createMaintenanceRecord
);

router.put(
  '/:id/maintenance/:recordId',
  authenticateToken,
  authorizeRoles('admin', 'user'),
  updateMaintenanceRecord
);

export default router;
