import { Router } from 'express';

import {
  register,
  login,
  me,
  adminPanel,
  refresh,
  logout,
  forgotPasswordController,
  resetPasswordController
} from './auth.controller';

import {
  authenticateToken,
  authorizeRoles
} from './auth.middleware';

const router = Router();

router.post(
  '/register',
  register
);

router.post(
  '/login',
  login
);

router.post(
  '/refresh',
  refresh
);

router.post(
  '/logout',
  logout
);

router.post(
  '/forgot-password',
  forgotPasswordController
);

router.post(
  '/reset-password',
  resetPasswordController
);

router.get(
  '/me',
  authenticateToken,
  me
);

router.get(
  '/admin',
  authenticateToken,
  authorizeRoles('admin'),
  adminPanel
);

export default router;