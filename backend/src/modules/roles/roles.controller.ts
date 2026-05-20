import {
  Request,
  Response
} from 'express';

import {
  createRole,
  getRoles
} from './roles.service';

import { logAudit }
  from '../audit/audit.service';

import { AuthRequest }
  from '../auth/auth.middleware';

export async function getAllRoles(
  req: Request,
  res: Response
) {

  try {

    const roles =
      await getRoles();

    return res.status(200).json({
      success: true,
      data: roles
    });

  } catch (error) {

    return res.status(500).json({
      success: false,
      message:
        'Error obteniendo roles'
    });
  }
}

export async function createNewRole(
  req: AuthRequest,
  res: Response
) {

  try {

    const role =
      await createRole(req.body);

    await logAudit({
      user: req.user,
      module: 'usuarios',
      action: 'crear_rol',
      entityType: 'role',
      entityId: role.id,
      description: `Creo rol ${role.name}`,
      newData: role,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.status(201).json({
      success: true,
      data: role
    });

  } catch (error: any) {

    return res.status(400).json({
      success: false,
      message:
        error.message || 'Error creando rol'
    });
  }
}
