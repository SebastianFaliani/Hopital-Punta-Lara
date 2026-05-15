import { Router }
  from 'express';

import {
  authenticateToken,
  authorizeRoles
} from '../auth/auth.middleware';

import {
  create,
  getDriverShifts,
  update
} from './driver-shifts.controller';

const router = Router();

router.get(
  '/',
  authenticateToken,
  authorizeRoles('admin', 'user'),
  getDriverShifts
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

export default router;
