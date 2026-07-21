import { Router } from 'express';

import {
  handleCreateLaboratoryRecord,
  handleDeleteLaboratoryRecord,
  handleExpireOldLaboratoryRecords,
  handleGetLaboratoryTestCatalog,
  handleGetLaboratoryPatient,
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

router.get(
  '/catalog',
  authenticateToken,
  authorizeRoles(...laboratoryReadRoles),
  handleGetLaboratoryTestCatalog
);

router.get(
  '/patients/:document',
  authenticateToken,
  authorizeRoles(...laboratoryReadRoles),
  handleGetLaboratoryPatient
);

router.post(
  '/expire-old',
  authenticateToken,
  authorizeRoles(...laboratoryCompletionRoles),
  handleExpireOldLaboratoryRecords
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

router.delete(
  '/:id',
  authenticateToken,
  authorizeRoles(...laboratoryWriteRoles),
  handleDeleteLaboratoryRecord
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
