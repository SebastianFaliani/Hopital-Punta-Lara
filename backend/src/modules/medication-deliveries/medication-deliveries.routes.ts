import { Router }
  from 'express';

import {
  authenticateToken,
  authorizeRoles
} from '../auth/auth.middleware';

import {
  handleCancelMedicationDelivery,
  handleCreateMedicationDelivery,
  handleGetMedicationDeliveries,
  handleGetMedicationDeliveryById
} from './medication-deliveries.controller';

const router = Router();

router.get(
  '/',
  authenticateToken,
  authorizeRoles(
    'admin',
    'farmacia',
    'dir'
  ),
  handleGetMedicationDeliveries
);

router.get(
  '/:id',
  authenticateToken,
  authorizeRoles(
    'admin',
    'farmacia',
    'dir'
  ),
  handleGetMedicationDeliveryById
);

router.post(
  '/',
  authenticateToken,
  authorizeRoles(
    'admin',
    'farmacia'
  ),
  handleCreateMedicationDelivery
);

router.patch(
  '/:id/cancel',
  authenticateToken,
  authorizeRoles(
    'admin',
    'farmacia'
  ),
  handleCancelMedicationDelivery
);

export default router;
