import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { pool } from '../../config/database';

import {
  RegisterDTO,
  LoginDTO,
  ForgotPasswordDTO,
  ResetPasswordDTO
} from './auth.types';

import {
  generateAccessToken,
  generateRefreshToken
} from '../../utils/jwt';

import {
  sendResetPasswordEmail
} from '../../utils/mailer';

export async function registerUser(
  data: RegisterDTO
) {

  const {
    first_name,
    last_name,
    email,
    username,
    password
  } = data;

  const cleanUsername =
    username?.trim();

  if (!cleanUsername) {

    throw new Error(
      'El usuario es obligatorio'
    );
  }

  // verificar usuario existente
  const [existingUsers] = await pool.query(
    'SELECT id FROM users WHERE email = ? OR username = ?',
    [
      email,
      cleanUsername
    ]
  );

  if ((existingUsers as any[]).length > 0) {

    throw new Error(
      'El email ya está registrado'
    );
  }

  // hash password
  const saltRounds = Number(
    process.env.BCRYPT_ROUNDS
  );

  const passwordHash =
    await bcrypt.hash(
      password,
      saltRounds
    );

  // role user
  const roleId = 2;

  // insertar usuario
  const [result]: any =
    await pool.query(
      `
        INSERT INTO users (
          role_id,
          first_name,
          last_name,
          email,
          username,
          password_hash
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        roleId,
        first_name,
        last_name,
        email,
        cleanUsername,
        passwordHash
      ]
    );

  // access token
  const accessToken =
    generateAccessToken({
      userId: result.insertId,
      email,
      username: cleanUsername,
      role: 'user'
    });

  // refresh token
  const refreshToken =
    generateRefreshToken({
      userId: result.insertId
    });

  // guardar sesión
  await pool.query(
    `
      INSERT INTO user_sessions (
        user_id,
        refresh_token,
        expires_at
      )
      VALUES (
        ?,
        ?,
        DATE_ADD(NOW(), INTERVAL 7 DAY)
      )
    `,
    [
      result.insertId,
      refreshToken
    ]
  );

  return {
    accessToken,
    refreshToken
  };
}

export async function loginUser(
  data: LoginDTO
) {

  const {
    username,
    password
  } = data;

  const cleanUsername =
    username?.trim();

  if (!cleanUsername) {

    throw new Error(
      'Ingresá tu usuario'
    );
  }

  // buscar usuario
  const [rows]: any =
    await pool.query(
      `
        SELECT
          u.id,
          u.first_name,
          u.last_name,
          u.email,
          u.username,
          u.password_hash,
          u.is_active,
          r.name AS role
        FROM users u
        INNER JOIN roles r
          ON r.id = u.role_id
        WHERE u.username = ?
        LIMIT 1
      `,
      [cleanUsername]
    );

  if (rows.length === 0) {

    throw new Error(
      'Credenciales inválidas'
    );
  }

  const user = rows[0];

  // validar activo
  if (!user.is_active) {

    throw new Error(
      'Usuario desactivado'
    );
  }

  // comparar password
  const validPassword =
    await bcrypt.compare(
      password,
      user.password_hash
    );

  if (!validPassword) {

    throw new Error(
      'Credenciales inválidas'
    );
  }

  // actualizar último login
  await pool.query(
    `
      UPDATE users
      SET last_login = NOW()
      WHERE id = ?
    `,
    [user.id]
  );

  // access token
  const accessToken =
    generateAccessToken({
      userId: user.id,
      email: user.email,
      username: user.username,
      role: user.role
    });

  // refresh token
  const refreshToken =
    generateRefreshToken({
      userId: user.id
    });

  // guardar sesión
  await pool.query(
    `
      INSERT INTO user_sessions (
        user_id,
        refresh_token,
        expires_at
      )
      VALUES (
        ?,
        ?,
        DATE_ADD(NOW(), INTERVAL 7 DAY)
      )
    `,
    [
      user.id,
      refreshToken
    ]
  );

  return {

    accessToken,

    refreshToken,

    user: {
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      username: user.username,
      role: user.role
    }
  };
}

export async function logoutUser(
  refreshToken: string
) {

  await pool.query(
    `
      UPDATE user_sessions
      SET revoked = TRUE
      WHERE refresh_token = ?
    `,
    [refreshToken]
  );

  return true;
}

export async function forgotPassword(
  data: ForgotPasswordDTO
) {

  const { email } = data;

  // buscar usuario
  const [rows]: any =
    await pool.query(
      `
        SELECT id, email
        FROM users
        WHERE email = ?
        LIMIT 1
      `,
      [email]
    );

  // por seguridad
  if (rows.length === 0) {

    return {
      success: true
    };
  }

  const user = rows[0];

  // generar token
  const resetToken =
    crypto.randomBytes(32)
      .toString('hex');

  // expiración 1 hora
  await pool.query(
    `
      INSERT INTO password_resets (
        user_id,
        token,
        expires_at
      )
      VALUES (
        ?,
        ?,
        DATE_ADD(NOW(), INTERVAL 1 HOUR)
      )
    `,
    [
      user.id,
      resetToken
    ]
  );

  // enviar email
  await sendResetPasswordEmail(
    user.email,
    resetToken
  );

  return {
    success: true
  };
}

export async function resetPassword(
  data: ResetPasswordDTO
) {

  const {
    token,
    password
  } = data;

  // buscar token válido
  const [rows]: any =
    await pool.query(
      `
        SELECT *
        FROM password_resets
        WHERE token = ?
        AND used = FALSE
        AND expires_at > NOW()
        LIMIT 1
      `,
      [token]
    );

  if (rows.length === 0) {

    throw new Error(
      'Token inválido o expirado'
    );
  }

  const resetData = rows[0];

  // hash password
  const saltRounds =
    Number(
      process.env.BCRYPT_ROUNDS
    );

  const passwordHash =
    await bcrypt.hash(
      password,
      saltRounds
    );

  // actualizar password
  await pool.query(
    `
      UPDATE users
      SET password_hash = ?
      WHERE id = ?
    `,
    [
      passwordHash,
      resetData.user_id
    ]
  );

  // invalidar token
  await pool.query(
    `
      UPDATE password_resets
      SET used = TRUE
      WHERE id = ?
    `,
    [resetData.id]
  );

  // revocar sesiones anteriores
  await pool.query(
    `
      UPDATE user_sessions
      SET revoked = TRUE
      WHERE user_id = ?
    `,
    [resetData.user_id]
  );

  return {
    success: true
  };
}
