import { Router } from 'express';
import {
  register,
  login,
  me,
  adminPanel
} from './auth.controller';
import { 
    authenticateToken,
    authorizeRoles
} from './auth.middleware';


const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticateToken, me);
router.get('/admin', authenticateToken, authorizeRoles('admin'), adminPanel);

export default router;