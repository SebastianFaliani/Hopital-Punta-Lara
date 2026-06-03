import { Router }
  from 'express';

import {
  authenticateToken,
  authorizeRoles
} from '../auth/auth.middleware';

import {
  create,
  getAmbulances,
  toggleStatus,
  update
} from './ambulances.controller';

const router = Router();

router.get(
  '/',
  authenticateToken,
  authorizeRoles('admin', 'user', 'dir'),
  getAmbulances
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
