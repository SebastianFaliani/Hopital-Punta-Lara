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
  'user'
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
  authorizeRoles(...vaccineRoles),
  handleCreateVaccineMovement
);

router.put(
  '/:id',
  authenticateToken,
  authorizeRoles(...vaccineRoles),
  handleUpdateVaccineBatch
);

router.patch(
  '/:id/toggle',
  authenticateToken,
  authorizeRoles(...vaccineRoles),
  handleToggleVaccineBatch
);

export default router;
