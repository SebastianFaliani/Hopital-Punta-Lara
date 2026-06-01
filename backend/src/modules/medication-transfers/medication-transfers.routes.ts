import { Router }
  from 'express';

import {
  authenticateToken,
  authorizeRoles
} from '../auth/auth.middleware';

import {
  handleCancelMedicationTransfer,
  handleCreateMedicationTransfer,
  handleGetFacilityBatchStocks,
  handleGetMedicationTransferById,
  handleGetMedicationTransfers,
  handleReceiveMedicationTransfer
} from './medication-transfers.controller';

const router = Router();

router.get(
  '/facility-stocks',
  authenticateToken,
  authorizeRoles(
    'admin',
    'farmacia',
    'dir'
  ),
  handleGetFacilityBatchStocks
);

router.get(
  '/',
  authenticateToken,
  authorizeRoles(
    'admin',
    'farmacia',
    'dir'
  ),
  handleGetMedicationTransfers
);

router.get(
  '/:id',
  authenticateToken,
  authorizeRoles(
    'admin',
    'farmacia',
    'dir'
  ),
  handleGetMedicationTransferById
);

router.post(
  '/',
  authenticateToken,
  authorizeRoles(
    'admin',
    'farmacia'
  ),
  handleCreateMedicationTransfer
);

router.patch(
  '/:id/receive',
  authenticateToken,
  authorizeRoles(
    'admin',
    'farmacia'
  ),
  handleReceiveMedicationTransfer
);

router.patch(
  '/:id/cancel',
  authenticateToken,
  authorizeRoles(
    'admin',
    'farmacia'
  ),
  handleCancelMedicationTransfer
);

export default router;
