import { Router } from 'express';

import {
  authenticateToken,
  authorizeRoles
} from '../auth/auth.middleware';

import {
  handleCancelHousekeepingMovement,
  handleCreateHousekeepingItem,
  handleCreateHousekeepingMovement,
  handleGetHousekeepingItems,
  handleGetHousekeepingMovements,
  handleGetHousekeepingStats,
  handleRegisterHousekeepingReturn,
  handleToggleHousekeepingItem,
  handleUpdateHousekeepingItem
} from './housekeeping.controller';

const router = Router();

const readRoles = [
  'admin',
  'mayo',
  'dir'
];

const writeRoles = [
  'admin',
  'mayo'
];

router.get(
  '/items',
  authenticateToken,
  authorizeRoles(...readRoles),
  handleGetHousekeepingItems
);

router.post(
  '/items',
  authenticateToken,
  authorizeRoles(...writeRoles),
  handleCreateHousekeepingItem
);

router.put(
  '/items/:id',
  authenticateToken,
  authorizeRoles(...writeRoles),
  handleUpdateHousekeepingItem
);

router.patch(
  '/items/:id/toggle',
  authenticateToken,
  authorizeRoles(...writeRoles),
  handleToggleHousekeepingItem
);

router.get(
  '/movements',
  authenticateToken,
  authorizeRoles(...readRoles),
  handleGetHousekeepingMovements
);

router.get(
  '/stats',
  authenticateToken,
  authorizeRoles(...readRoles),
  handleGetHousekeepingStats
);

router.post(
  '/movements',
  authenticateToken,
  authorizeRoles(...writeRoles),
  handleCreateHousekeepingMovement
);

router.patch(
  '/movements/:id/return',
  authenticateToken,
  authorizeRoles(...writeRoles),
  handleRegisterHousekeepingReturn
);

router.patch(
  '/movements/:id/cancel',
  authenticateToken,
  authorizeRoles(...writeRoles),
  handleCancelHousekeepingMovement
);

export default router;
