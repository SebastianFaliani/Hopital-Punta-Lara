import {
  Request,
  Response,
  NextFunction
} from 'express';

import jwt from 'jsonwebtoken';

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
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    );

    // guardar usuario en request
    req.user = decoded;

    next();

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