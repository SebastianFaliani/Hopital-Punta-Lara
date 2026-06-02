import { Router }
  from 'express';

import {
  authenticateToken,
  authorizeRoles
} from '../auth/auth.middleware';

import {
  handleAddChronicPlanItem,
  handleCreateChronicPackage,
  handleCreateChronicPatient,
  handleDeliverChronicPackage,
  handleGetChronicPackageById,
  handleGetChronicPatientById,
  handleGetChronicPatients,
  handleMarkPackageNotPickedUp,
  handleReceiveChronicPackageTransfer,
  handleRelocateChronicPackage,
  handleReopenChronicPackage,
  handleReturnChronicPackage,
  handleSendChronicPackage,
  handleToggleChronicPatient,
  handleToggleChronicPlanItem,
  handleUpdateChronicPatient
} from './chronic-medications.controller';

const router = Router();

router.get(
  '/',
  authenticateToken,
  authorizeRoles('admin', 'farmacia', 'dir'),
  handleGetChronicPatients
);

router.get(
  '/packages/:id',
  authenticateToken,
  authorizeRoles('admin', 'farmacia', 'dir'),
  handleGetChronicPackageById
);

router.get(
  '/:id',
  authenticateToken,
  authorizeRoles('admin', 'farmacia', 'dir'),
  handleGetChronicPatientById
);

router.post(
  '/',
  authenticateToken,
  authorizeRoles('admin', 'farmacia'),
  handleCreateChronicPatient
);

router.put(
  '/:id',
  authenticateToken,
  authorizeRoles('admin', 'farmacia'),
  handleUpdateChronicPatient
);

router.patch(
  '/:id/toggle',
  authenticateToken,
  authorizeRoles('admin', 'farmacia'),
  handleToggleChronicPatient
);

router.post(
  '/:id/plan-items',
  authenticateToken,
  authorizeRoles('admin', 'farmacia'),
  handleAddChronicPlanItem
);

router.patch(
  '/plan-items/:itemId/toggle',
  authenticateToken,
  authorizeRoles('admin', 'farmacia'),
  handleToggleChronicPlanItem
);

router.post(
  '/packages',
  authenticateToken,
  authorizeRoles('admin', 'farmacia'),
  handleCreateChronicPackage
);

router.patch(
  '/packages/:id/not-picked-up',
  authenticateToken,
  authorizeRoles('admin', 'farmacia'),
  handleMarkPackageNotPickedUp
);

router.patch(
  '/packages/:id/send',
  authenticateToken,
  authorizeRoles('admin', 'farmacia'),
  handleSendChronicPackage
);

router.patch(
  '/packages/:id/reopen',
  authenticateToken,
  authorizeRoles('admin', 'farmacia'),
  handleReopenChronicPackage
);

router.patch(
  '/packages/:id/return',
  authenticateToken,
  authorizeRoles('admin', 'farmacia'),
  handleReturnChronicPackage
);

router.patch(
  '/packages/:id/relocate',
  authenticateToken,
  authorizeRoles('admin', 'farmacia'),
  handleRelocateChronicPackage
);

router.patch(
  '/packages/:id/receive-transfer',
  authenticateToken,
  authorizeRoles('admin', 'farmacia'),
  handleReceiveChronicPackageTransfer
);

router.patch(
  '/packages/:id/deliver',
  authenticateToken,
  authorizeRoles('admin', 'farmacia'),
  handleDeliverChronicPackage
);

export default router;
