import { Router } from 'express';

import {
  authenticateToken,
  authorizeRoles
} from '../auth/auth.middleware';

import {
  handleCancelVaccineDelivery,
  handleCreateVaccineDelivery,
  handleGetVaccineDeliveries,
  handleGetVaccineDeliveryById
} from './vaccine-deliveries.controller';

const router = Router();

const vaccineRoles = [
  'admin',
  'vacu',
  'dir'
];

const vaccineWriteRoles = [
  'admin',
  'vacu'
];

router.get(
  '/',
  authenticateToken,
  authorizeRoles(...vaccineRoles),
  handleGetVaccineDeliveries
);

router.post(
  '/',
  authenticateToken,
  authorizeRoles(...vaccineWriteRoles),
  handleCreateVaccineDelivery
);

router.get(
  '/:id',
  authenticateToken,
  authorizeRoles(...vaccineRoles),
  handleGetVaccineDeliveryById
);

router.patch(
  '/:id/cancel',
  authenticateToken,
  authorizeRoles(...vaccineWriteRoles),
  handleCancelVaccineDelivery
);

export default router;
