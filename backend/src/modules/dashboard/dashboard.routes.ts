import { Router }
  from 'express';

import {
  authenticateToken,
  authorizeRoles
} from '../auth/auth.middleware';

import {
  getDashboard
} from './dashboard.controller';

const router = Router();

router.get(
  '/',
  authenticateToken,
  authorizeRoles(
    'admin',
    'user',
    'farmacia'
  ),
  getDashboard
);

export default router;
