import {
  NextFunction,
  Response,
  Router
} from 'express';
import {
  AuthRequest,
  authenticateToken,
  authorizeRoles
} from '../auth/auth.middleware';
import {
  handleApplyPatientImport,
  handleCreatePatient,
  handleGetPatientByDocument,
  handleGetPatient,
  handleGetPatients,
  handlePreviewPatientImport,
  handleUpdatePatient
} from './patients.controller';

const router =
  Router();

function authorizeImportRoles(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  if (
    req.user?.role === 'admin' ||
    req.user?.role === 'dir'
  ) {
    next();
    return;
  }

  return res.status(403).json({
    success: false,
    message: 'Permisos insuficientes'
  });
}

router.get(
  '/',
  authenticateToken,
  authorizeRoles('admin', 'dir', 'lab', 'user'),
  handleGetPatients
);

router.post(
  '/import/preview',
  authenticateToken,
  authorizeImportRoles,
  handlePreviewPatientImport
);

router.post(
  '/import/apply',
  authenticateToken,
  authorizeImportRoles,
  handleApplyPatientImport
);

router.get(
  '/by-document/:document',
  authenticateToken,
  authorizeRoles('admin', 'dir', 'lab', 'user', 'nutri'),
  handleGetPatientByDocument
);

router.get(
  '/:id',
  authenticateToken,
  authorizeRoles('admin', 'dir', 'lab', 'user'),
  handleGetPatient
);

router.post(
  '/',
  authenticateToken,
  authorizeRoles('admin', 'dir', 'lab'),
  handleCreatePatient
);

router.put(
  '/:id',
  authenticateToken,
  authorizeRoles('admin', 'dir', 'lab'),
  handleUpdatePatient
);

export default router;
