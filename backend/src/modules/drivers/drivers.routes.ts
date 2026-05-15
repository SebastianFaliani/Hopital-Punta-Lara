import { Router }
  from 'express';

import {
  authenticateToken,
  authorizeRoles
} from '../auth/auth.middleware';

import {
  create,
  getDrivers,
  toggleStatus,
  update
} from './drivers.controller';

const router = Router();

router.get(
  '/',
  authenticateToken,
  authorizeRoles('admin', 'user'),
  getDrivers
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

export default router;
