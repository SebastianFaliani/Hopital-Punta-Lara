import { Router } from 'express';
import { register } from './auth.controller';
import { login } from './auth.controller';
import { authenticateToken } from './auth.middleware';
import { me } from './auth.controller';



const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticateToken, me);

export default router;