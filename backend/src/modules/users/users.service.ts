import { pool } from '../../config/database';
import bcrypt from 'bcryptjs';
export {
  getUserAccessConfiguration,
  resetUserAccessConfiguration,
  updateUserAccessConfiguration
} from '../access-control/access-control.service';

export async function getAllUsers() {

  const [rows]: any = await pool.query(
    `
      SELECT
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.username,

        u.role_id,
        u.facility_id,
        u.access_all_facilities,
        hf.name AS facility_name,

        u.is_active,
        u.created_at,

        r.name AS role

      FROM users u

      INNER JOIN roles r
        ON r.id = u.role_id
      LEFT JOIN health_facilities hf
        ON hf.id = u.facility_id

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
    role_id,
    facility_id
  } = data;

  const cleanUsername =
    username?.trim();

  if (!cleanUsername) {
    throw new Error('El usuario es obligatorio');
  }

  const [existing]: any = await pool.query(
    'SELECT id FROM users WHERE email = ? OR username = ?',
    [
      email,
      cleanUsername
    ]
  );

  if (existing.length > 0) {
    throw new Error('El email o usuario ya existe');
  }

  const hash = await bcrypt.hash(password, 10);

  const [result]: any = await pool.query(
    `
      INSERT INTO users (
        role_id,
        facility_id,
        first_name,
        last_name,
        email,
        username,
        password_hash
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      role_id,
      facility_id || null,
      first_name,
      last_name,
      email,
      cleanUsername,
      hash
    ]
  );

  return {
    id: result.insertId
  };
}

export async function updateUser(
  id: number,
  data: any
) {

  const {
    first_name,
    last_name,
    email,
    username,
    role_id,
    facility_id
  } = data;

  const cleanUsername =
    username?.trim();

  if (!cleanUsername) {
    throw new Error('El usuario es obligatorio');
  }

  const [existing]: any = await pool.query(
    `
      SELECT id
      FROM users
      WHERE (email = ? OR username = ?)
        AND id <> ?
      LIMIT 1
    `,
    [
      email,
      cleanUsername,
      id
    ]
  );

  if (existing.length > 0) {
    throw new Error('El email o usuario ya existe');
  }

  await pool.query(
    `
      UPDATE users
      SET
        first_name = ?,
        last_name = ?,
        email = ?,
        username = ?,
        role_id = ?,
        facility_id = ?
      WHERE id = ?
    `,
    [
      first_name,
      last_name,
      email,
      cleanUsername,
      role_id,
      facility_id || null,
      id
    ]
  );

  return true;
}

export async function changeOwnPassword(
  userId: number,
  data: any
) {
  const {
    current_password,
    new_password
  } = data;

  if (!current_password || !new_password) {
    throw new Error('La contrasena actual y la nueva son obligatorias');
  }

  if (new_password.length < 6) {
    throw new Error('La nueva contrasena debe tener minimo 6 caracteres');
  }

  const [rows]: any =
    await pool.query(
      `
        SELECT password_hash
        FROM users
        WHERE id = ?
          AND is_active = TRUE
        LIMIT 1
      `,
      [userId]
    );

  if (rows.length === 0) {
    throw new Error('Usuario no encontrado');
  }

  const validPassword =
    await bcrypt.compare(
      current_password,
      rows[0].password_hash
    );

  if (!validPassword) {
    throw new Error('La contrasena actual no es correcta');
  }

  const hash =
    await bcrypt.hash(
      new_password,
      Number(process.env.BCRYPT_ROUNDS || 10)
    );

  await pool.query(
    `
      UPDATE users
      SET password_hash = ?
      WHERE id = ?
    `,
    [
      hash,
      userId
    ]
  );

  return true;
}

export async function adminResetUserPassword(
  userId: number,
  data: any
) {
  const {
    new_password
  } = data;

  if (!new_password) {
    throw new Error('La nueva contrasena es obligatoria');
  }

  if (new_password.length < 6) {
    throw new Error('La nueva contrasena debe tener minimo 6 caracteres');
  }

  const [rows]: any =
    await pool.query(
      `
        SELECT id
        FROM users
        WHERE id = ?
        LIMIT 1
      `,
      [userId]
    );

  if (rows.length === 0) {
    throw new Error('Usuario no encontrado');
  }

  const hash =
    await bcrypt.hash(
      new_password,
      Number(process.env.BCRYPT_ROUNDS || 10)
    );

  await pool.query(
    `
      UPDATE users
      SET password_hash = ?
      WHERE id = ?
    `,
    [
      hash,
      userId
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
