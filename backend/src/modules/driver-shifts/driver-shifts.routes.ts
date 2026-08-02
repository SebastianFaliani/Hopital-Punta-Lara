import { Router }
  from 'express';

import {
  authenticateToken,
  authorizeRoles
} from '../auth/auth.middleware';

import {
  create,
  createBulk,
  getDriverShifts,
  remove,
  update
} from './driver-shifts.controller';

const router = Router();

router.get(
  '/',
  authenticateToken,
  authorizeRoles('admin', 'user', 'dir'),
  getDriverShifts
);

router.post(
  '/bulk',
  authenticateToken,
  authorizeRoles('admin', 'user'),
  createBulk
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

router.delete(
  '/:id',
  authenticateToken,
  authorizeRoles('admin', 'user'),
  remove
);

export default router;
