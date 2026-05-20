import { Router } from 'express';

import {
  authenticateToken,
  authorizeRoles
} from '../auth/auth.middleware';

import {
  handleCreateNutritionControl,
  handleCreateNutritionPatient,
  handleGetNutritionControls,
  handleGetNutritionPatients,
  handleUpdateNutritionControl,
  handleUpdateNutritionPatient
} from './nutrition.controller';

const router = Router();

const readRoles = [
  'admin',
  'user',
  'dir',
  'nutri'
];

const writeRoles = [
  'admin',
  'user',
  'nutri'
];

router.get(
  '/',
  authenticateToken,
  authorizeRoles(...readRoles),
  handleGetNutritionPatients
);

router.post(
  '/',
  authenticateToken,
  authorizeRoles(...writeRoles),
  handleCreateNutritionPatient
);

router.put(
  '/:id',
  authenticateToken,
  authorizeRoles(...writeRoles),
  handleUpdateNutritionPatient
);

router.get(
  '/:patientId/controls',
  authenticateToken,
  authorizeRoles(...readRoles),
  handleGetNutritionControls
);

router.post(
  '/:patientId/controls',
  authenticateToken,
  authorizeRoles(...writeRoles),
  handleCreateNutritionControl
);

router.put(
  '/:patientId/controls/:controlId',
  authenticateToken,
  authorizeRoles(...writeRoles),
  handleUpdateNutritionControl
);

export default router;
