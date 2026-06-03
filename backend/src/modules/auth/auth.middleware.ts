import {
  Request,
  Response,
  NextFunction
} from 'express';

import jwt from 'jsonwebtoken';
import { pool } from '../../config/database';

export interface AuthRequest extends Request {
  user?: any;
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
          u.facility_id,
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
      .then(([rows]: any) => {
        if (rows.length === 0) {
          return res.status(401).json({
            success: false,
            message: 'Usuario invalido'
          });
        }

        const user = rows[0];

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
          facility_type: user.facility_type
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

    // verificar rol
    if (!allowedRoles.includes(user.role)) {

      return res.status(403).json({
        success: false,
        message: 'Permisos insuficientes'
      });
    }

    next();
  };
}
