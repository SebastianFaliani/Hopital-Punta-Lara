import { Router }
  from 'express';

import {
  authenticateToken,
  authorizeRoles
} from '../auth/auth.middleware';

import {
  create,
  getTransfers,
  updateStatus
} from './transfers.controller';

const router = Router();

router.get(
  '/',
  authenticateToken,
  authorizeRoles('admin', 'user', 'dir'),
  getTransfers
);

router.post(
  '/',
  authenticateToken,
  authorizeRoles('admin', 'user'),
  create
);

router.patch(
  '/:id/status',
  authenticateToken,
  authorizeRoles('admin', 'user'),
  updateStatus
);

export default router;
