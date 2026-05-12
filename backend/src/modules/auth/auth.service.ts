import bcrypt from 'bcryptjs';
import { pool } from '../../config/database';
import { RegisterDTO } from './auth.types';
import { LoginDTO } from './auth.types';
import { generateAccessToken } from '../../utils/jwt';

export async function registerUser(data: RegisterDTO) {

  const {
    first_name,
    last_name,
    email,
    username,
    password
  } = data;

  // verificar usuario existente
  const [existingUsers] = await pool.query(
    'SELECT id FROM users WHERE email = ?',
    [email]
  );

  if ((existingUsers as any[]).length > 0) {
    throw new Error('El email ya está registrado');
  }

  // hash password
  const saltRounds = Number(process.env.BCRYPT_ROUNDS);

  const passwordHash = await bcrypt.hash(
    password,
    saltRounds
  );

  // role user
  const roleId = 2;

  // insertar usuario
  const [result]: any = await pool.query(
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
      username,
      passwordHash
    ]
  );

  // generar token
  const token = generateAccessToken({
    userId: result.insertId,
    email
  });

  return {
    token
  };
}

export async function loginUser(data: LoginDTO) {

  const { email, password } = data;

  // buscar usuario
  const [rows]: any = await pool.query(
    `
      SELECT
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.password_hash,
        u.is_active,
        r.name AS role
      FROM users u
      INNER JOIN roles r
        ON r.id = u.role_id
      WHERE u.email = ?
      LIMIT 1
    `,
    [email]
  );

  if (rows.length === 0) {
    throw new Error('Credenciales inválidas');
  }

  const user = rows[0];

  // validar activo
  if (!user.is_active) {
    throw new Error('Usuario desactivado');
  }

  // comparar password
  const validPassword = await bcrypt.compare(
    password,
    user.password_hash
  );

  if (!validPassword) {
    throw new Error('Credenciales inválidas');
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

  // generar token
  const token = generateAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role
  });

  return {
    token,
    user: {
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      role: user.role
    }
  };
}