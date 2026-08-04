import { Router } from 'express';
import multer from 'multer';
import {
  handleGetLaboratoryPdf,
  handleGetLaboratoryPdfMetadata,
  handleUploadLaboratoryPdf,
  handleDeleteLaboratoryPdf
} from './laboratory-pdf.controller';

import {
  handleCloseLaboratoryCorrection,
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
  authorizePermission
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
  authorizePermission('laboratory.view', ...laboratoryReadRoles),
  handleGetLaboratoryRecords
);

router.get(
  '/stats',
  authenticateToken,
  authorizePermission('laboratory.view', ...laboratoryReadRoles),
  handleGetLaboratoryStats
);

router.get(
  '/catalog',
  authenticateToken,
  authorizePermission('laboratory.view', ...laboratoryReadRoles),
  handleGetLaboratoryTestCatalog
);

router.get(
  '/patients/:document',
  authenticateToken,
  authorizePermission('laboratory.view', ...laboratoryReadRoles),
  handleGetLaboratoryPatient
);

router.post(
  '/expire-old',
  authenticateToken,
  authorizePermission('laboratory.records.delete', 'admin', 'dir'),
  handleExpireOldLaboratoryRecords
);

router.post(
  '/',
  authenticateToken,
  authorizePermission('laboratory.manage', ...laboratoryWriteRoles),
  handleCreateLaboratoryRecord
);

router.put(
  '/:id',
  authenticateToken,
  authorizePermission('laboratory.manage', ...laboratoryWriteRoles),
  handleUpdateLaboratoryRecord
);

router.delete(
  '/:id',
  authenticateToken,
  authorizePermission('laboratory.records.delete', 'admin', 'dir'),
  handleDeleteLaboratoryRecord
);

router.patch(
  '/:id/completion',
  authenticateToken,
  authorizePermission('laboratory.manage', ...laboratoryCompletionRoles),
  handleUpdateLaboratoryCompletion
);

router.post(
  '/notify-whatsapp/pending',
  authenticateToken,
  authorizePermission('laboratory.whatsapp.send', ...laboratoryCompletionRoles),
  handleSendPendingLaboratoryWhatsappNotifications
);

router.patch(
  '/:id/reopen',
  authenticateToken,
  authorizePermission('laboratory.reopen', 'admin', 'dir'),
  handleReopenLaboratoryWorkflow
);

router.patch(
  '/:id/close-correction',
  authenticateToken,
  authorizePermission('laboratory.reopen', 'admin', 'dir'),
  handleCloseLaboratoryCorrection
);

router.get('/:id/pdf/metadata', authenticateToken, authorizePermission('laboratory.view', ...laboratoryReadRoles), handleGetLaboratoryPdfMetadata);
router.get('/:id/pdf/:pdfId', authenticateToken, authorizePermission('laboratory.view', ...laboratoryReadRoles), handleGetLaboratoryPdf);
router.delete('/:id/pdf/:pdfId', authenticateToken, authorizePermission('laboratory.pdf.manage', ...laboratoryPdfRoles), handleDeleteLaboratoryPdf);
router.post(
  '/:id/pdf',
  authenticateToken,
  authorizePermission('laboratory.pdf.manage', ...laboratoryPdfRoles),
  pdfUpload.single('pdf'),
  handleUploadLaboratoryPdf
);

router.post(
  '/:id/notify-whatsapp',
  authenticateToken,
  authorizePermission('laboratory.whatsapp.send', ...laboratoryCompletionRoles),
  handleSendLaboratoryWhatsappNotification
);

router.patch(
  '/:id/pickup/revert',
  authenticateToken,
  authorizePermission('laboratory.pickup.revert', 'admin', 'dir'),
  handleRevertLaboratoryPickup
);

router.patch(
  '/:id/pickup',
  authenticateToken,
  authorizePermission('laboratory.pickup', ...laboratoryPickupRoles),
  handleRegisterLaboratoryPickup
);

export default router;
