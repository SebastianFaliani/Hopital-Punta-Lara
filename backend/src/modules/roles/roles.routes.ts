import { Router }
  from 'express';

import {
  authenticateToken,
  authorizeRoles
} from '../auth/auth.middleware';

import {
  createNewRole,
  getAllRoles
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

export default router;
