import {
  Request,
  Response
} from 'express';

import {
  createRole,
  getRoleAccessConfiguration,
  getRoles,
  updateRole,
  updateRolePermissions
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

export async function getRoleAccess(
  req: AuthRequest,
  res: Response
) {
  try {
    return res.json({
      success: true,
      data:
        await getRoleAccessConfiguration(
          Number(req.params.id)
        )
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message:
        error.message || 'Error obteniendo permisos del rol'
    });
  }
}

export async function updateExistingRole(
  req: AuthRequest,
  res: Response
) {
  try {
    const role =
      await updateRole(
        Number(req.params.id),
        req.body
      );

    await logAudit({
      user: req.user,
      module: 'usuarios',
      action: 'editar_rol',
      entityType: 'role',
      entityId: role.id,
      description: `Edito rol ${role.name}`,
      newData: req.body,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json({
      success: true,
      data: role
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message:
        error.message || 'Error editando rol'
    });
  }
}

export async function updateExistingRolePermissions(
  req: AuthRequest,
  res: Response
) {
  try {
    await updateRolePermissions(
      Number(req.params.id),
      req.body.permission_keys || []
    );

    await logAudit({
      user: req.user,
      module: 'usuarios',
      action: 'editar_permisos_rol',
      entityType: 'role',
      entityId: Number(req.params.id),
      description:
        `Edito permisos del rol ${req.params.id}`,
      newData: req.body,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json({
      success: true
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message:
        error.message || 'Error editando permisos del rol'
    });
  }
}
