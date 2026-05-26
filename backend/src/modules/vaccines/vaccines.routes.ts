import { Router } from 'express';

import {
  handleCreateVaccine,
  handleGetAllVaccines,
  handleGetVaccineById,
  handleToggleVaccine,
  handleUpdateVaccine
} from './vaccines.controller';

import {
  handleCreateVaccineBatch,
  handleGetBatchesByVaccine
} from '../vaccine-batches/vaccine-batches.controller';

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
  '/',
  authenticateToken,
  authorizeRoles(...vaccineRoles),
  handleGetAllVaccines
);

router.get(
  '/:id/batches',
  authenticateToken,
  authorizeRoles(...vaccineRoles),
  handleGetBatchesByVaccine
);

router.post(
  '/:id/batches',
  authenticateToken,
  authorizeRoles(...vaccineWriteRoles),
  handleCreateVaccineBatch
);

router.get(
  '/:id',
  authenticateToken,
  authorizeRoles(...vaccineRoles),
  handleGetVaccineById
);

router.post(
  '/',
  authenticateToken,
  authorizeRoles(...vaccineWriteRoles),
  handleCreateVaccine
);

router.put(
  '/:id',
  authenticateToken,
  authorizeRoles(...vaccineWriteRoles),
  handleUpdateVaccine
);

router.patch(
  '/:id/toggle',
  authenticateToken,
  authorizeRoles(...vaccineWriteRoles),
  handleToggleVaccine
);

export default router;
