import { Router }
  from 'express';

import {
  handleGetAllMedications,
  handleGetMedicationById,
  handleCreateMedication,
  handleUpdateMedication,
  handleToggleMedication
} from './medications.controller';
import { authenticateToken, authorizeRoles } from '../auth/auth.middleware';
import {
  handleCreateBatch,
  handleGetBatchesByMedication
} from '../batches/batches.controller';





const router = Router();



// ======================================
// OBTENER TODOS
// ======================================

router.get(
  '/',
  authenticateToken,
  authorizeRoles(
    'admin',
    'farmacia'
  ),
  handleGetAllMedications
);



// ======================================
// OBTENER POR ID
// ======================================

router.get(
  '/:id/batches',
  authenticateToken,
  authorizeRoles(
    'admin',
    'farmacia'
  ),
  handleGetBatchesByMedication
);

router.post(
  '/:id/batches',
  authenticateToken,
  authorizeRoles(
    'admin',
    'farmacia'
  ),
  handleCreateBatch
);



// ======================================
// OBTENER POR ID
// ======================================

router.get(
  '/:id',
  authenticateToken,
  authorizeRoles(
    'admin',
    'farmacia'
  ),
  handleGetMedicationById
);



// ======================================
// CREAR
// ======================================

router.post(
  '/',
  authenticateToken,
  authorizeRoles(
    'admin',
    'farmacia'
  ),
  handleCreateMedication
);



// ======================================
// ACTUALIZAR
// ======================================

router.put(
  '/:id',
  authenticateToken,
  authorizeRoles(
    'admin',
    'farmacia'
  ),
  handleUpdateMedication
);



// ======================================
// ACTIVAR / DESACTIVAR
// ======================================

router.patch(
  '/:id/toggle',
  authenticateToken,
  authorizeRoles(
    'admin',
    'farmacia'
  ),
  handleToggleMedication
);



export default router;
