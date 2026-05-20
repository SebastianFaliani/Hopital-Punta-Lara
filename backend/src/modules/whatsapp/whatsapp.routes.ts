import { Router }
  from 'express';

import {
  authenticateToken,
  authorizeRoles
} from '../auth/auth.middleware';

import {
  createReply,
  getWhatsappConnectionStatus,
  getWhatsappLogs,
  getReplies,
  logoutWhatsappConnection,
  receiveIncomingMessage,
  simulateMessage,
  startWhatsappConnection,
  stopWhatsappConnection,
  toggleReply,
  updateReply
} from './whatsapp.controller';

const router = Router();

router.post(
  '/incoming',
  receiveIncomingMessage
);

router.get(
  '/web/status',
  authenticateToken,
  authorizeRoles('admin', 'user'),
  getWhatsappConnectionStatus
);

router.post(
  '/web/start',
  authenticateToken,
  authorizeRoles('admin', 'user'),
  startWhatsappConnection
);

router.post(
  '/web/stop',
  authenticateToken,
  authorizeRoles('admin', 'user'),
  stopWhatsappConnection
);

router.post(
  '/web/logout',
  authenticateToken,
  authorizeRoles('admin', 'user'),
  logoutWhatsappConnection
);

router.get(
  '/logs',
  authenticateToken,
  authorizeRoles('admin', 'user'),
  getWhatsappLogs
);

router.get(
  '/replies',
  authenticateToken,
  authorizeRoles('admin', 'user'),
  getReplies
);

router.post(
  '/replies',
  authenticateToken,
  authorizeRoles('admin', 'user'),
  createReply
);

router.put(
  '/replies/:id',
  authenticateToken,
  authorizeRoles('admin', 'user'),
  updateReply
);

router.patch(
  '/replies/:id/toggle',
  authenticateToken,
  authorizeRoles('admin', 'user'),
  toggleReply
);

router.post(
  '/simulate',
  authenticateToken,
  authorizeRoles('admin', 'user'),
  simulateMessage
);

export default router;
