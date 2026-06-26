import {
  Request,
  Response,
  NextFunction
} from 'express';

import jwt from 'jsonwebtoken';
import { pool } from '../../config/database';
import {
  getEffectivePermissionKeys,
  getUserFacilityIds
} from '../access-control/access-control.service';

export interface AuthRequest extends Request {
  user?: any;
}

function getRequestPermission(
  req: AuthRequest
) {
  const isRead =
    req.method === 'GET';

  if (req.baseUrl === '/personnel') {
    if (isRead) {
      return 'personnel.view';
    }

    if (
      req.path.startsWith('/departments') ||
      req.path.startsWith('/attendance-codes') ||
      req.path.startsWith('/leave-rules') ||
      req.path.startsWith('/vacation-rules')
    ) {
      return 'personnel.settings.manage';
    }

    if (
      req.path.startsWith('/vacation-balances') ||
      req.path.startsWith('/leave-balance-adjustments')
    ) {
      return 'personnel.balances.manage';
    }

    if (
      req.path.startsWith('/attendance') ||
      req.path.startsWith('/planned-days-off')
    ) {
      return 'personnel.attendance.manage';
    }

    if (
      req.path.startsWith('/leave-requests') &&
      req.path.endsWith('/status')
    ) {
      return 'personnel.leaves.approve';
    }

    if (req.path.startsWith('/leave-requests')) {
      return 'personnel.leaves.manage';
    }

    if (req.path.startsWith('/employees')) {
      return 'personnel.employees.manage';
    }

    return 'personnel.manage';
  }

  const modulePermissions: Array<{
    paths: string[];
    view: string;
    manage: string;
  }> = [
    {
      paths: ['/dashboard'],
      view: 'dashboard.view',
      manage: 'dashboard.view'
    },
    {
      paths: [
        '/medications',
        '/batches',
        '/inventory-movements',
        '/medication-transfers',
        '/medication-deliveries',
        '/chronic-medications'
      ],
      view: 'medications.view',
      manage: 'medications.manage'
    },
    {
      paths: [
        '/vaccines',
        '/vaccine-batches',
        '/vaccine-transfers',
        '/vaccine-deliveries'
      ],
      view: 'vaccines.view',
      manage: 'vaccines.manage'
    },
    {
      paths: [
        '/transfers',
        '/transfer-trips',
        '/ambulances',
        '/drivers',
        '/driver-shifts'
      ],
      view: 'transfers.view',
      manage: 'transfers.manage'
    },
    {
      paths: ['/nutrition'],
      view: 'nutrition.view',
      manage: 'nutrition.manage'
    },
    {
      paths: ['/laboratory'],
      view: 'laboratory.view',
      manage:
        req.path.endsWith('/pickup')
          ? 'laboratory.pickup'
          : 'laboratory.manage'
    },
    {
      paths: ['/housekeeping'],
      view: 'housekeeping.view',
      manage: 'housekeeping.manage'
    }
  ];

  const modulePermission =
    modulePermissions.find((item) =>
      item.paths.includes(req.baseUrl)
    );

  if (!modulePermission) {
    return null;
  }

  return isRead
    ? modulePermission.view
    : modulePermission.manage;
}

function hasEffectivePermission(
  user: any,
  permission: string
) {
  if (
    permission === 'personnel.view' &&
    user.permissions?.some((item: string) =>
      item.startsWith('personnel.') &&
      item.endsWith('.manage')
    )
  ) {
    return true;
  }

  if (
    user.role === 'dir' &&
    permission.endsWith('.manage') &&
    !permission.startsWith('personnel.') &&
    user.permissions?.includes(
      permission.replace('.manage', '.view')
    )
  ) {
    return true;
  }

  return (
    user.permissions?.includes(permission) ||
    (
      permission.endsWith('.view') &&
      user.permissions?.includes(
        permission.replace('.view', '.manage')
      )
    )
  );
}

export function authenticateToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {

  const authHeader = req.headers.authorization;

  // verificar header
  if (!authHeader) {

    return res.status(401).json({
      success: false,
      message: 'Token requerido'
    });
  }

  // formato: Bearer TOKEN
  const token = authHeader.split(' ')[1];

  if (!token) {

    return res.status(401).json({
      success: false,
      message: 'Token inválido'
    });
  }

  try {

    // validar token
    const decoded: any = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    );

    const userId =
      decoded.userId || decoded.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Token invalido'
      });
    }

    pool.query(
      `
        SELECT
          u.id,
          u.first_name,
          u.last_name,
          u.email,
          u.username,
          u.role_id,
          u.facility_id,
          u.access_all_facilities,
          hf.name AS facility_name,
          hf.facility_type,
          r.name AS role,
          COALESCE(r.description, r.name) AS role_description
        FROM users u
        INNER JOIN roles r
          ON r.id = u.role_id
        LEFT JOIN health_facilities hf
          ON hf.id = u.facility_id
        WHERE u.id = ?
          AND u.is_active = TRUE
        LIMIT 1
      `,
      [userId]
    )
      .then(async ([rows]: any) => {
        if (rows.length === 0) {
          return res.status(401).json({
            success: false,
            message: 'Usuario invalido'
          });
        }

        const user = rows[0];

        let permissions: string[] = [];
        let facilityIds: number[] =
          user.facility_id
            ? [Number(user.facility_id)]
            : [];
        let permissionsConfigured = false;

        try {
          permissions =
            await getEffectivePermissionKeys(
              user.id,
              user.role_id
            );

          facilityIds =
            await getUserFacilityIds(
              user.id,
              user.facility_id
            );

          permissionsConfigured = true;
        } catch (error: any) {
          if (
            error?.code !== 'ER_NO_SUCH_TABLE' &&
            error?.code !== 'ER_BAD_FIELD_ERROR'
          ) {
            throw error;
          }
        }

        req.user = {
          ...decoded,
          userId: user.id,
          id: user.id,
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
          username: user.username,
          role: user.role,
          role_description: user.role_description,
          facility_id: user.facility_id,
          facility_name: user.facility_name,
          facility_type: user.facility_type,
          access_all_facilities:
            Boolean(user.access_all_facilities),
          facility_ids: facilityIds,
          permissions,
          permissions_configured:
            permissionsConfigured
        };

        next();
      })
      .catch(() =>
        res.status(401).json({
          success: false,
          message: 'Token invalido'
        })
      );

  } catch (error) {

    return res.status(401).json({
      success: false,
      message: 'Token inválido o expirado'
    });
  }
}

export function authorizePermission(
  permission: string,
  ...fallbackRoles: string[]
) {
  return (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'No autorizado'
      });
    }

    if (
      user.role === 'admin' ||
      (
        user.permissions_configured &&
        hasEffectivePermission(user, permission)
      ) ||
      (
        !user.permissions_configured &&
        fallbackRoles.includes(user.role)
      )
    ) {
      next();
      return;
    }

    return res.status(403).json({
      success: false,
      message: 'Permisos insuficientes'
    });
  };
}

export function authorizeRoles(
  ...allowedRoles: string[]
) {

  return (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {

    const user = req.user;

    if (!user) {

      return res.status(401).json({
        success: false,
        message: 'No autorizado'
      });
    }

    const requestPermission =
      getRequestPermission(req);

    const canReadFacilityCatalog =
      req.method === 'GET' &&
      req.baseUrl === '/health-facilities' &&
      (
        hasEffectivePermission(user, 'medications.view') ||
        hasEffectivePermission(user, 'vaccines.view') ||
        hasEffectivePermission(user, 'transfers.view') ||
        hasEffectivePermission(user, 'personnel.view')
      );

    const authorized =
      user.role === 'admin' ||
      canReadFacilityCatalog ||
      (
        user.permissions_configured &&
        requestPermission
          ? hasEffectivePermission(
            user,
            requestPermission
          )
          : allowedRoles.includes(user.role)
      );

    if (!authorized) {

      return res.status(403).json({
        success: false,
        message: 'Permisos insuficientes'
      });
    }

    next();
  };
}
