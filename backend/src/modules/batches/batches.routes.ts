import { Router }
  from 'express';

import {
  handleToggleBatch,
  handleUpdateBatch
} from './batches.controller';

import {
  handleCreateStockMovement,
  handleGetMovementsByBatch
} from '../inventory-movements/inventory-movements.controller';

import {
  authenticateToken,
  authorizeRoles
} from '../auth/auth.middleware';

const router = Router();

router.get(
  '/:id/movements',
  authenticateToken,
  authorizeRoles(
    'admin',
    'farmacia'
  ),
  handleGetMovementsByBatch
);

router.post(
  '/:id/movements',
  authenticateToken,
  authorizeRoles(
    'admin',
    'farmacia'
  ),
  handleCreateStockMovement
);

router.put(
  '/:id',
  authenticateToken,
  authorizeRoles(
    'admin',
    'farmacia'
  ),
  handleUpdateBatch
);

router.patch(
  '/:id/toggle',
  authenticateToken,
  authorizeRoles(
    'admin',
    'farmacia'
  ),
  handleToggleBatch
);

export default router;
