import { pool } from '../../config/database';
import bcrypt from 'bcryptjs';

export async function getAllUsers() {

  const [rows]: any = await pool.query(
    `
      SELECT
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.username,
        u.is_active,
        u.created_at,
        r.name AS role
      FROM users u
      INNER JOIN roles r ON r.id = u.role_id
      ORDER BY u.created_at DESC
    `
  );

  return rows;
}

export async function createUser(data: any) {

  const {
    first_name,
    last_name,
    email,
    username,
    password,
    role_id
  } = data;

  const [existing]: any = await pool.query(
    'SELECT id FROM users WHERE email = ?',
    [email]
  );

  if (existing.length > 0) {
    throw new Error('El email ya existe');
  }

  const hash = await bcrypt.hash(password, 10);

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
      role_id,
      first_name,
      last_name,
      email,
      username,
      hash
    ]
  );

  return {
    id: result.insertId
  };
}

export async function updateUser(id: number, data: any) {

  const {
    first_name,
    last_name,
    email,
    username,
    role_id,
    is_active
  } = data;

  await pool.query(
    `
      UPDATE users
      SET
        first_name = ?,
        last_name = ?,
        email = ?,
        username = ?,
        role_id = ?,
        is_active = ?
      WHERE id = ?
    `,
    [
      first_name,
      last_name,
      email,
      username,
      role_id,
      is_active,
      id
    ]
  );

  return true;
}

export async function toggleUserStatusService(
  userId: number
) {

  // buscar usuario
  const [rows]: any =
    await pool.query(
      `
        SELECT
          id,
          is_active
        FROM users
        WHERE id = ?
        LIMIT 1
      `,
      [userId]
    );

  if (rows.length === 0) {

    throw new Error(
      'Usuario no encontrado'
    );
  }

  const user = rows[0];

  const newStatus =
    !user.is_active;

  await pool.query(
    `
      UPDATE users
      SET is_active = ?
      WHERE id = ?
    `,
    [
      newStatus,
      userId
    ]
  );

  return {
    id: userId,
    is_active: newStatus
  };
}

export async function deleteUser(id: number) {

  await pool.query(
    `
      UPDATE users
      SET is_active = FALSE
      WHERE id = ?
    `,
    [id]
  );

  return true;
}