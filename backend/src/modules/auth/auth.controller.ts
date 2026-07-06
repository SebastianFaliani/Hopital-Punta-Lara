import {
  Request,
  Response
} from 'express';

import jwt from 'jsonwebtoken';

import {
  registerUser,
  loginUser,
  logoutUser,
  forgotPassword,
  resetPassword
} from './auth.service';

import { pool } from '../../config/database';

import {
  generateAccessToken
} from '../../utils/jwt';

import {
  AuthRequest
} from './auth.middleware';

export async function register(
  req: Request,
  res: Response
) {

  try {

    const result =
      await registerUser(req.body);

    return res.status(201).json({
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

export async function login(
  req: Request,
  res: Response
) {

  try {

    const result =
      await loginUser(req.body);

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

export async function refresh(
  req: Request,
  res: Response
) {

  try {

    const { refreshToken } = req.body;

    if (!refreshToken) {

      return res.status(401).json({
        success: false,
        message:
          'Refresh token requerido'
      });
    }

    // validar token
    const decoded: any =
      jwt.verify(
        refreshToken,
        process.env
          .JWT_REFRESH_SECRET as string
      );

    // verificar sesión
    const [rows]: any =
      await pool.query(
        `
          SELECT *
          FROM user_sessions
          WHERE refresh_token = ?
          AND user_id = ?
          AND revoked = FALSE
          AND expires_at > NOW()
          LIMIT 1
        `,
        [
          refreshToken,
          decoded.userId
        ]
      );

    if (rows.length === 0) {

      return res.status(401).json({
        success: false,
        message: 'Sesión inválida'
      });
    }

    const [userRows]: any =
      await pool.query(
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
        [decoded.userId]
      );

    if (userRows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Usuario invalido'
      });
    }

    const user =
      userRows[0];

    await pool.query(
      `
        UPDATE user_sessions
        SET expires_at = DATE_ADD(NOW(), INTERVAL 15 MINUTE)
        WHERE id = ?
      `,
      [rows[0].id]
    );

    // generar nuevo access token
    const accessToken =
      generateAccessToken({
        userId: user.id,
        sessionId: rows[0].id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        username: user.username,
        role: user.role,
        role_description: user.role_description,
        facility_id: user.facility_id,
        facility_name: user.facility_name,
        facility_type: user.facility_type
      });

    return res.status(200).json({
      success: true,
      accessToken
    });

  } catch (error) {

    return res.status(401).json({
      success: false,
      message:
        'Refresh token inválido'
    });
  }
}

export async function logout(
  req: Request,
  res: Response
) {

  try {

    const { refreshToken } =
      req.body;

    if (!refreshToken) {

      return res.status(400).json({
        success: false,
        message:
          'Refresh token requerido'
      });
    }

    await logoutUser(
      refreshToken
    );

    return res.status(200).json({
      success: true,
      message:
        'Logout exitoso'
    });

  } catch (error) {

    return res.status(500).json({
      success: false,
      message:
        'Error cerrando sesión'
    });
  }
}

export async function forgotPasswordController(
  req: Request,
  res: Response
) {

  try {

    const result =
      await forgotPassword(
        req.body
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

export async function resetPasswordController(
  req: Request,
  res: Response
) {

  try {

    const result =
      await resetPassword(
        req.body
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

export async function me(
  req: AuthRequest,
  res: Response
) {

  return res.status(200).json({
    success: true,
    user: req.user
  });
}

export async function adminPanel(
  req: AuthRequest,
  res: Response
) {

  return res.status(200).json({
    success: true,
    message:
      'Bienvenido administrador'
  });
}

