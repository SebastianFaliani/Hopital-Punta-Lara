import { Request, Response } from 'express';
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

export async function create(req: Request, res: Response) {

  try {

    const user = await createUser(req.body);

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

export async function update(req: Request, res: Response) {

  try {

    const { id } = req.params;

    await updateUser(Number(id), req.body);

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
  req: Request,
  res: Response
) {

  try {

    const { id } = req.params;

    await adminResetUserPassword(
      Number(id),
      req.body
    );

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
  req: Request,
  res: Response
) {

  try {

    const userId =
      Number(req.params.id);

    const result =
      await toggleUserStatusService(
        userId
      );

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

export async function remove(req: Request, res: Response) {

  try {

    const { id } = req.params;

    await deleteUser(Number(id));

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
