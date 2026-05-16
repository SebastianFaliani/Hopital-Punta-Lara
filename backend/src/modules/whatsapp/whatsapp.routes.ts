import { Router }
  from 'express';

import {
  authenticateToken,
  authorizeRoles
} from '../auth/auth.middleware';

import {
  createReply,
  getReplies,
  receiveIncomingMessage,
  simulateMessage,
  toggleReply,
  updateReply
} from './whatsapp.controller';

const router = Router();

router.post(
  '/incoming',
  receiveIncomingMessage
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
