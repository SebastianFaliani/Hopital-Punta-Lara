import { Router }
  from 'express';

import {
  authenticateToken,
  authorizeRoles
} from '../auth/auth.middleware';

import {
  create,
  createRecurring,
  getOverview,
  getRecurring,
  getTransfers,
  registerRoutePrint,
  toggleRecurring,
  updateRecurring,
  updateRequest,
  updateStatus
} from './transfers.controller';

const router = Router();

router.get(
  '/overview',
  authenticateToken,
  authorizeRoles('admin', 'user', 'dir'),
  getOverview
);

router.get(
  '/recurring',
  authenticateToken,
  authorizeRoles('admin', 'user', 'dir'),
  getRecurring
);

router.post(
  '/recurring',
  authenticateToken,
  authorizeRoles('admin', 'user'),
  createRecurring
);

router.put(
  '/recurring/:id',
  authenticateToken,
  authorizeRoles('admin', 'user'),
  updateRecurring
);

router.patch(
  '/recurring/:id/status',
  authenticateToken,
  authorizeRoles('admin', 'user'),
  toggleRecurring
);

router.post(
  '/route-prints',
  authenticateToken,
  authorizeRoles('admin', 'user'),
  registerRoutePrint
);

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

router.put(
  '/:id',
  authenticateToken,
  authorizeRoles('admin', 'user'),
  updateRequest
);

router.patch(
  '/:id/status',
  authenticateToken,
  authorizeRoles('admin', 'user'),
  updateStatus
);

export default router;
