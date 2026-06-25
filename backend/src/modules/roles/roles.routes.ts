import { Router }
  from 'express';

import {
  authenticateToken,
  authorizeRoles
} from '../auth/auth.middleware';

import {
  createNewRole,
  getAllRoles,
  getRoleAccess,
  updateExistingRole,
  updateExistingRolePermissions
} from './roles.controller';

const router = Router();

router.get(
  '/',
  authenticateToken,
  authorizeRoles('admin', 'dir'),
  getAllRoles
);

router.post(
  '/',
  authenticateToken,
  authorizeRoles('admin'),
  createNewRole
);

router.get(
  '/:id/access',
  authenticateToken,
  authorizeRoles('admin'),
  getRoleAccess
);

router.put(
  '/:id',
  authenticateToken,
  authorizeRoles('admin'),
  updateExistingRole
);

router.put(
  '/:id/permissions',
  authenticateToken,
  authorizeRoles('admin'),
  updateExistingRolePermissions
);

export default router;
