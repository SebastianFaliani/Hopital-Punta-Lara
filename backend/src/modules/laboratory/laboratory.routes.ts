import { Router } from 'express';

import {
  handleCreateLaboratoryRecord,
  handleGetLaboratoryTestCatalog,
  handleGetLaboratoryRecords,
  handleGetLaboratoryStats,
  handleGetLaboratoryNotificationTemplate,
  handleNotifyLaboratoryResult,
  handleRegisterLaboratoryPickup,
  handleUpdateLaboratoryNotificationTemplate,
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
  '/notification-template',
  authenticateToken,
  authorizeRoles(...laboratoryCompletionRoles),
  handleGetLaboratoryNotificationTemplate
);

router.put(
  '/notification-template',
  authenticateToken,
  authorizeRoles(...laboratoryCompletionRoles),
  handleUpdateLaboratoryNotificationTemplate
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

router.post(
  '/:id/notify-result',
  authenticateToken,
  authorizeRoles(...laboratoryCompletionRoles),
  handleNotifyLaboratoryResult
);

router.patch(
  '/:id/pickup',
  authenticateToken,
  authorizeRoles(...laboratoryPickupRoles),
  handleRegisterLaboratoryPickup
);

export default router;
