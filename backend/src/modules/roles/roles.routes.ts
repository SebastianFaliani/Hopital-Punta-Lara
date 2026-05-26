import { Router }
  from 'express';

import {
  authenticateToken,
  authorizeRoles
} from '../auth/auth.middleware';

import {
  getAllRoles
} from './roles.controller';

const router = Router();

router.get(
  '/',
  authenticateToken,
  authorizeRoles('admin', 'dir'),
  getAllRoles
);

export default router;
