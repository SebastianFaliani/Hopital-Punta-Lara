import { Router } from 'express';
import { 
    getUsers,
    create,
    update,
    changePassword,
    resetPasswordByAdmin,
    toggleUserStatus,
    remove
 } from './users.controller';
import {
  authenticateToken,
  authorizeRoles
} from '../auth/auth.middleware';

const router = Router();

router.get(
  '/',
  authenticateToken,  
  authorizeRoles('admin'),  
  getUsers
);

router.post(
  '/',
  authenticateToken,
  authorizeRoles('admin'),
  create
);

router.put(
  '/:id',
  authenticateToken,
  authorizeRoles('admin'),
  update
);

router.patch(
  '/me/password',
  authenticateToken,
  changePassword
);

router.patch(
  '/:id/password',
  authenticateToken,
  authorizeRoles('admin'),
  resetPasswordByAdmin
);

router.patch(
  '/:id/status',
  authenticateToken,
  authorizeRoles('admin'),
  toggleUserStatus
);

router.delete(
  '/:id',
  authenticateToken,
  authorizeRoles('admin'),
  remove
);

export default router;
