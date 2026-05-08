import { Router } from 'express';
import {
  authenticateToken,
  authorizeRoles
} from '../auth/auth.middleware';
import { handleGetAuditLogs } from './audit.controller';

const router = Router();

router.use(
  authenticateToken,
  authorizeRoles('admin', 'dir')
);

router.get(
  '/',
  handleGetAuditLogs
);

export default router;
