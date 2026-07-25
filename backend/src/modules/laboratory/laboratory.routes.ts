import { Router } from 'express';
import multer from 'multer';
import {
  handleGetLaboratoryPdf,
  handleGetLaboratoryPdfMetadata,
  handleUploadLaboratoryPdf,
  handleDeleteLaboratoryPdf
} from './laboratory-pdf.controller';

import {
  handleCreateLaboratoryRecord,
  handleDeleteLaboratoryRecord,
  handleExpireOldLaboratoryRecords,
  handleGetLaboratoryTestCatalog,
  handleGetLaboratoryPatient,
  handleGetLaboratoryRecords,
  handleGetLaboratoryStats,
  handleRegisterLaboratoryPickup,
  handleReopenLaboratoryWorkflow,
  handleRevertLaboratoryPickup,
  handleSendLaboratoryWhatsappNotification,
  handleSendPendingLaboratoryWhatsappNotifications,
  handleUpdateLaboratoryCompletion,
  handleUpdateLaboratoryRecord
} from './laboratory.controller';

import {
  authenticateToken,
  authorizeRoles
} from '../auth/auth.middleware';

const router = Router();
const pdfUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: 1 } });

const laboratoryReadRoles = [
  'admin',
  'user',
  'dir',
  'lab'
];

const laboratoryWriteRoles = [
  'admin',
  'dir',
  'lab'
];

const laboratoryPickupRoles = [
  'admin',
  'lab',
  'user'
];

const laboratoryCompletionRoles = [
  'admin',
  'dir',
  'lab'
];

const laboratoryPdfRoles = [
  'admin',
  'dir'
];

router.get(
  '/',
  authenticateToken,
  authorizeRoles(...laboratoryReadRoles),
  handleGetLaboratoryRecords
);

router.get(
  '/stats',
  authenticateToken,
  authorizeRoles(...laboratoryReadRoles),
  handleGetLaboratoryStats
);

router.get(
  '/catalog',
  authenticateToken,
  authorizeRoles(...laboratoryReadRoles),
  handleGetLaboratoryTestCatalog
);

router.get(
  '/patients/:document',
  authenticateToken,
  authorizeRoles(...laboratoryReadRoles),
  handleGetLaboratoryPatient
);

router.post(
  '/expire-old',
  authenticateToken,
  authorizeRoles('admin', 'dir'),
  handleExpireOldLaboratoryRecords
);

router.post(
  '/',
  authenticateToken,
  authorizeRoles(...laboratoryWriteRoles),
  handleCreateLaboratoryRecord
);

router.put(
  '/:id',
  authenticateToken,
  authorizeRoles(...laboratoryWriteRoles),
  handleUpdateLaboratoryRecord
);

router.delete(
  '/:id',
  authenticateToken,
  authorizeRoles('admin', 'dir'),
  handleDeleteLaboratoryRecord
);

router.patch(
  '/:id/completion',
  authenticateToken,
  authorizeRoles(...laboratoryCompletionRoles),
  handleUpdateLaboratoryCompletion
);

router.post(
  '/notify-whatsapp/pending',
  authenticateToken,
  authorizeRoles(...laboratoryCompletionRoles),
  handleSendPendingLaboratoryWhatsappNotifications
);

router.patch(
  '/:id/reopen',
  authenticateToken,
  authorizeRoles('admin', 'dir'),
  handleReopenLaboratoryWorkflow
);

router.get('/:id/pdf/metadata', authenticateToken, authorizeRoles(...laboratoryReadRoles), handleGetLaboratoryPdfMetadata);
router.get('/:id/pdf/:pdfId', authenticateToken, authorizeRoles(...laboratoryReadRoles), handleGetLaboratoryPdf);
router.delete('/:id/pdf/:pdfId', authenticateToken, authorizeRoles(...laboratoryPdfRoles), handleDeleteLaboratoryPdf);
router.post(
  '/:id/pdf',
  authenticateToken,
  authorizeRoles(...laboratoryPdfRoles),
  pdfUpload.single('pdf'),
  handleUploadLaboratoryPdf
);

router.post(
  '/:id/notify-whatsapp',
  authenticateToken,
  authorizeRoles(...laboratoryCompletionRoles),
  handleSendLaboratoryWhatsappNotification
);

router.patch(
  '/:id/pickup/revert',
  authenticateToken,
  authorizeRoles('admin', 'dir'),
  handleRevertLaboratoryPickup
);

router.patch(
  '/:id/pickup',
  authenticateToken,
  authorizeRoles(...laboratoryPickupRoles),
  handleRegisterLaboratoryPickup
);

export default router;
