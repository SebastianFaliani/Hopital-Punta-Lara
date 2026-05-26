import { Router } from 'express';

import {
  handleCreateVaccineMovement,
  handleGetVaccineMovements,
  handleToggleVaccineBatch,
  handleUpdateVaccineBatch
} from './vaccine-batches.controller';

import {
  authenticateToken,
  authorizeRoles
} from '../auth/auth.middleware';

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
  '/:id/movements',
  authenticateToken,
  authorizeRoles(...vaccineRoles),
  handleGetVaccineMovements
);

router.post(
  '/:id/movements',
  authenticateToken,
  authorizeRoles(...vaccineWriteRoles),
  handleCreateVaccineMovement
);

router.put(
  '/:id',
  authenticateToken,
  authorizeRoles(...vaccineWriteRoles),
  handleUpdateVaccineBatch
);

router.patch(
  '/:id/toggle',
  authenticateToken,
  authorizeRoles(...vaccineWriteRoles),
  handleToggleVaccineBatch
);

export default router;
