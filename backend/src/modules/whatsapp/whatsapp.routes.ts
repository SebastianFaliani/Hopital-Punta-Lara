import { Router }
  from 'express';

import {
  authenticateToken,
  authorizeRoles
} from '../auth/auth.middleware';

import {
  cleanupWhatsappLogs,
  confirmAppointmentRequest,
  createAppointmentDoctor,
  createReply,
  exportWhatsappLogs,
  getAppointmentDoctors,
  getAppointmentRequests,
  getChatConversations,
  getChatMessages,
  getChatProfilePicture,
  getWhatsappConnectionStatus,
  getWhatsappLogs,
  getReplies,
  logoutWhatsappConnection,
  rejectAppointmentRequest,
  receiveIncomingMessage,
  sendChatMessage,
  simulateMessage,
  startWhatsappConnection,
  stopWhatsappConnection,
  toggleReply,
  updateAppointmentDoctor,
  updateAppointmentDoctorBooking,
  updateAppointmentDoctorSchedules,
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
  '/logs/export',
  authenticateToken,
  authorizeRoles('admin', 'user'),
  exportWhatsappLogs
);

router.delete(
  '/logs/cleanup',
  authenticateToken,
  authorizeRoles('admin', 'user'),
  cleanupWhatsappLogs
);

router.get(
  '/chat/conversations',
  authenticateToken,
  authorizeRoles('admin', 'user'),
  getChatConversations
);

router.get(
  '/chat/:phone/profile-picture',
  authenticateToken,
  authorizeRoles('admin', 'user'),
  getChatProfilePicture
);

router.get(
  '/chat/:phone/messages',
  authenticateToken,
  authorizeRoles('admin', 'user'),
  getChatMessages
);

router.post(
  '/chat/:phone/send',
  authenticateToken,
  authorizeRoles('admin', 'user'),
  sendChatMessage
);

router.get(
  '/appointments/doctors',
  authenticateToken,
  authorizeRoles('admin', 'user'),
  getAppointmentDoctors
);

router.post(
  '/appointments/doctors',
  authenticateToken,
  authorizeRoles('admin', 'user'),
  createAppointmentDoctor
);

router.put(
  '/appointments/doctors/:id',
  authenticateToken,
  authorizeRoles('admin', 'user'),
  updateAppointmentDoctor
);

router.patch(
  '/appointments/doctors/:id/booking',
  authenticateToken,
  authorizeRoles('admin', 'user'),
  updateAppointmentDoctorBooking
);

router.put(
  '/appointments/doctors/:id/schedules',
  authenticateToken,
  authorizeRoles('admin', 'user'),
  updateAppointmentDoctorSchedules
);

router.get(
  '/appointments/requests',
  authenticateToken,
  authorizeRoles('admin', 'user'),
  getAppointmentRequests
);

router.patch(
  '/appointments/requests/:id/confirm',
  authenticateToken,
  authorizeRoles('admin', 'user'),
  confirmAppointmentRequest
);

router.patch(
  '/appointments/requests/:id/no-availability',
  authenticateToken,
  authorizeRoles('admin', 'user'),
  rejectAppointmentRequest
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
