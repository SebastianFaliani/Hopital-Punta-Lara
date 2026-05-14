import {
  Request,
  Response
} from 'express';

import {
  getRoles
} from './roles.service';

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