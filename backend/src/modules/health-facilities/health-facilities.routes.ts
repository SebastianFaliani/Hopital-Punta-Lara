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
    'farmacia',
    'dir'
  ),
  handleGetFacilities
);

router.post(
  '/',
  authenticateToken,
  authorizeRoles(
    'admin',
    'farmacia'
  ),
  handleCreateFacility
);

router.put(
  '/:id',
  authenticateToken,
  authorizeRoles(
    'admin',
    'farmacia'
  ),
  handleUpdateFacility
);

router.patch(
  '/:id/toggle',
  authenticateToken,
  authorizeRoles(
    'admin',
    'farmacia'
  ),
  handleToggleFacility
);

export default router;
