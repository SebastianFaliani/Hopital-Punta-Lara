import { Router }
  from 'express';

import {
  authenticateToken,
  authorizeRoles
} from '../auth/auth.middleware';

import {
  getAvailableDrivers,
  updateTrip
} from '../transfers/transfers.controller';

const router = Router();

router.put(
  '/:id',
  authenticateToken,
  authorizeRoles('admin', 'user'),
  updateTrip
);

router.get(
  '/:id/available-drivers',
  authenticateToken,
  authorizeRoles('admin', 'user', 'dir'),
  getAvailableDrivers
);

export default router;
