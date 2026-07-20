import { Router } from 'express';

import {
  authenticateToken,
  authorizeRoles
} from '../auth/auth.middleware';

import {
  handleCancelVaccineTransfer,
  handleCreateVaccineTransfer,
  handleGetVaccineFacilityBatchStocks,
  handleGetVaccineTransferById,
  handleGetVaccineTransfers,
  handleReactivateVaccineTransfer,
  handleReceiveVaccineTransfer,
  handleUpdateVaccineTransfer
} from './vaccine-transfers.controller';

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
  '/facility-stocks',
  authenticateToken,
  authorizeRoles(...vaccineRoles),
  handleGetVaccineFacilityBatchStocks
);

router.get(
  '/',
  authenticateToken,
  authorizeRoles(...vaccineRoles),
  handleGetVaccineTransfers
);

router.post(
  '/',
  authenticateToken,
  authorizeRoles(...vaccineWriteRoles),
  handleCreateVaccineTransfer
);

router.get(
  '/:id',
  authenticateToken,
  authorizeRoles(...vaccineRoles),
  handleGetVaccineTransferById
);

router.put(
  '/:id',
  authenticateToken,
  authorizeRoles(...vaccineWriteRoles),
  handleUpdateVaccineTransfer
);

router.patch(
  '/:id/receive',
  authenticateToken,
  authorizeRoles(...vaccineWriteRoles),
  handleReceiveVaccineTransfer
);

router.patch(
  '/:id/cancel',
  authenticateToken,
  authorizeRoles(...vaccineWriteRoles),
  handleCancelVaccineTransfer
);

router.patch(
  '/:id/reactivate',
  authenticateToken,
  authorizeRoles('admin'),
  handleReactivateVaccineTransfer
);

export default router;
