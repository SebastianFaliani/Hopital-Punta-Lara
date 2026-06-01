import { Router } from 'express';

import {
  handleCreateLaboratoryRecord,
  handleGetLaboratoryRecords,
  handleGetLaboratoryStats,
  handleRegisterLaboratoryPickup,
  handleUpdateLaboratoryCompletion,
  handleUpdateLaboratoryRecord
} from './laboratory.controller';

import {
  authenticateToken,
  authorizeRoles
} from '../auth/auth.middleware';

const router = Router();

const laboratoryReadRoles = [
  'admin',
  'user',
  'dir',
  'lab'
];

const laboratoryWriteRoles = [
  'admin',
  'lab'
];

const laboratoryPickupRoles = [
  'admin',
  'lab',
  'user'
];

const laboratoryCompletionRoles = [
  'admin',
  'lab'
];

router.get(
  '/',
  authenticateToken,
  authorizeRoles(...laboratoryReadRoles),
  handleGetLaboratoryRecords
);

router.get(
  '/stats',
  authenticateToken,
  authorizeRoles(...laboratoryReadRoles),
  handleGetLaboratoryStats
);

router.post(
  '/',
  authenticateToken,
  authorizeRoles(...laboratoryWriteRoles),
  handleCreateLaboratoryRecord
);

router.put(
  '/:id',
  authenticateToken,
  authorizeRoles(...laboratoryWriteRoles),
  handleUpdateLaboratoryRecord
);

router.patch(
  '/:id/completion',
  authenticateToken,
  authorizeRoles(...laboratoryCompletionRoles),
  handleUpdateLaboratoryCompletion
);

router.patch(
  '/:id/pickup',
  authenticateToken,
  authorizeRoles(...laboratoryPickupRoles),
  handleRegisterLaboratoryPickup
);

export default router;
