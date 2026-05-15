import { Router }
  from 'express';

import {
  authenticateToken,
  authorizeRoles
} from '../auth/auth.middleware';

import {
  updateTrip
} from '../transfers/transfers.controller';

const router = Router();

router.put(
  '/:id',
  authenticateToken,
  authorizeRoles('admin', 'user'),
  updateTrip
);

export default router;
