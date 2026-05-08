import { Request, Response } from 'express';
import { logAudit } from '../audit/audit.service';
import { 
  getAllUsers, 
  createUser, 
  updateUser,
  changeOwnPassword,
  adminResetUserPassword,
  toggleUserStatusService,
  deleteUser
} from './users.service';
import { AuthRequest } from '../auth/auth.middleware';

export async function getUsers(req: Request, res: Response) {

  try {

    const users = await getAllUsers();

    return res.json({
      success: true,
      data: users
    });

  } catch (error: any) {

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export async function create(req: AuthRequest, res: Response) {

  try {

    const user = await createUser(req.body);

    await logAudit({
      user: req.user,
      module: 'usuarios',
      action: 'crear_usuario',
      entityType: 'user',
      entityId: user.id,
      description: `Creo usuario ${req.body.username || req.body.email}`,
      newData: {
        username: req.body.username,
        email: req.body.email,
        role_id: req.body.role_id
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.status(201).json({
      success: true,
      data: user
    });

  } catch (error: any) {

    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function update(req: AuthRequest, res: Response) {

  try {

    const { id } = req.params;

    await updateUser(Number(id), req.body);

    await logAudit({
      user: req.user,
      module: 'usuarios',
      action: 'editar_usuario',
      entityType: 'user',
      entityId: Number(id),
      description: `Edito usuario ${id}`,
      newData: {
        username: req.body.username,
        email: req.body.email,
        role_id: req.body.role_id
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json({
      success: true,
      message: 'Usuario actualizado'
    });

  } catch (error: any) {

    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function changePassword(
  req: AuthRequest,
  res: Response
) {

  try {

    await changeOwnPassword(
      Number(req.user?.userId),
      req.body
    );

    await logAudit({
      user: req.user,
      module: 'usuarios',
      action: 'cambiar_contrasena_propia',
      entityType: 'user',
      entityId: Number(req.user?.userId),
      description: 'Cambio su propia contrasena',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json({
      success: true,
      message: 'Contrasena actualizada'
    });

  } catch (error: any) {

    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function resetPasswordByAdmin(
  req: AuthRequest,
  res: Response
) {

  try {

    const { id } = req.params;

    await adminResetUserPassword(
      Number(id),
      req.body
    );

    await logAudit({
      user: req.user,
      module: 'usuarios',
      action: 'resetear_contrasena',
      entityType: 'user',
      entityId: Number(id),
      description: `Reseteo contrasena del usuario ${id}`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json({
      success: true,
      message: 'Contrasena actualizada'
    });

  } catch (error: any) {

    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function toggleUserStatus(
  req: AuthRequest,
  res: Response
) {

  try {

    const userId =
      Number(req.params.id);

    const result =
      await toggleUserStatusService(
        userId
      );

    await logAudit({
      user: req.user,
      module: 'usuarios',
      action: 'activar_desactivar_usuario',
      entityType: 'user',
      entityId: userId,
      description: `Cambio estado del usuario ${userId}`,
      newData: result,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.status(200).json({
      success: true,
      data: result
    });

  } catch (error: any) {

    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function remove(req: AuthRequest, res: Response) {

  try {

    const { id } = req.params;

    await deleteUser(Number(id));

    await logAudit({
      user: req.user,
      module: 'usuarios',
      action: 'desactivar_usuario',
      entityType: 'user',
      entityId: Number(id),
      description: `Desactivo usuario ${id}`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json({
      success: true,
      message: 'Usuario desactivado'
    });

  } catch (error: any) {

    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}
