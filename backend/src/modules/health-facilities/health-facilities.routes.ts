import { Router }
  from 'express';

import {
  authenticateToken,
  authorizeRoles
} from '../auth/auth.middleware';

import {
  handleCreateFacility,
  handleGetFacilities,
  handleToggleFacility,
  handleUpdateFacility
} from './health-facilities.controller';

const router = Router();

router.get(
  '/',
  authenticateToken,
  authorizeRoles(
    'admin',
    'user',
    'farmacia',
    'vacu',
    'dir'
  ),
  handleGetFacilities
);

router.post(
  '/',
  authenticateToken,
  authorizeRoles(
    'admin'
  ),
  handleCreateFacility
);

router.put(
  '/:id',
  authenticateToken,
  authorizeRoles(
    'admin'
  ),
  handleUpdateFacility
);

router.patch(
  '/:id/toggle',
  authenticateToken,
  authorizeRoles(
    'admin'
  ),
  handleToggleFacility
);

export default router;
