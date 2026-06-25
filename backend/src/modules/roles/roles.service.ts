import { pool }
  from '../../config/database';

export async function getRoles() {

  const [rows] =
    await pool.query(
      `
        SELECT
          id,
          name,
          COALESCE(description, name) AS description
        FROM roles
        ORDER BY name ASC
      `
    );

  return rows;
}

const systemRoleNames =
  new Set([
    'admin',
    'user',
    'dir',
    'farmacia',
    'vacu',
    'lab',
    'nutri',
    'mayo'
  ]);

function normalizeRoleName(
  name: string
) {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

export async function createRole(
  data: any
) {
  const name =
    normalizeRoleName(data.name || '');

  const description =
    String(data.description || '').trim();

  if (!name) {
    throw new Error('El nombre del rol es obligatorio');
  }

  if (!/^[a-z0-9_]+$/.test(name)) {
    throw new Error(
      'El nombre del rol solo puede tener letras, numeros y guion bajo'
    );
  }

  const [existing]: any =
    await pool.query(
      'SELECT id FROM roles WHERE name = ? LIMIT 1',
      [name]
    );

  if (existing.length > 0) {
    throw new Error('Ya existe un rol con ese nombre');
  }

  const [result]: any =
    await pool.query(
      `
        INSERT INTO roles (
          name,
          description
        )
        VALUES (?, ?)
      `,
      [
        name,
        description || name
      ]
    );

  return {
    id: result.insertId,
    name,
    description: description || name
  };
}

export async function getRoleAccessConfiguration(
  roleId: number
) {
  const [roleRows]: any =
    await pool.query(
      `
        SELECT
          id,
          name,
          COALESCE(description, name) AS description
        FROM roles
        WHERE id = ?
        LIMIT 1
      `,
      [roleId]
    );

  if (!roleRows.length) {
    throw new Error('Rol no encontrado');
  }

  const [permissionRows]: any =
    await pool.query(
      `
        SELECT
          p.id,
          p.permission_key,
          p.module_name,
          p.description,
          COALESCE(rp.allowed, FALSE) AS allowed
        FROM permissions p
        LEFT JOIN role_permissions rp
          ON rp.permission_id = p.id
          AND rp.role_id = ?
        ORDER BY p.sort_order, p.permission_key
      `,
      [roleId]
    );

  return {
    role: {
      ...roleRows[0],
      is_system:
        systemRoleNames.has(roleRows[0].name)
    },
    permissions:
      permissionRows.map((row: any) => ({
        ...row,
        allowed: Boolean(row.allowed)
      }))
  };
}

export async function updateRole(
  roleId: number,
  data: any
) {
  const [roleRows]: any =
    await pool.query(
      'SELECT id, name FROM roles WHERE id = ? LIMIT 1',
      [roleId]
    );

  if (!roleRows.length) {
    throw new Error('Rol no encontrado');
  }

  const currentRole =
    roleRows[0];

  const requestedName =
    normalizeRoleName(
      data.name || currentRole.name
    );

  const description =
    String(data.description || '').trim();

  if (!requestedName) {
    throw new Error('El nombre del rol es obligatorio');
  }

  if (!/^[a-z0-9_]+$/.test(requestedName)) {
    throw new Error(
      'El nombre interno solo puede tener letras, numeros y guion bajo'
    );
  }

  if (
    systemRoleNames.has(currentRole.name) &&
    requestedName !== currentRole.name
  ) {
    throw new Error(
      'Los roles del sistema no permiten cambiar el nombre interno. Cambia la descripcion visible.'
    );
  }

  const [existing]: any =
    await pool.query(
      `
        SELECT id
        FROM roles
        WHERE name = ?
          AND id <> ?
        LIMIT 1
      `,
      [
        requestedName,
        roleId
      ]
    );

  if (existing.length > 0) {
    throw new Error('Ya existe un rol con ese nombre');
  }

  await pool.query(
    `
      UPDATE roles
      SET
        name = ?,
        description = ?
      WHERE id = ?
    `,
    [
      requestedName,
      description || requestedName,
      roleId
    ]
  );

  return {
    id: roleId,
    name: requestedName,
    description: description || requestedName
  };
}

export async function updateRolePermissions(
  roleId: number,
  permissionKeys: string[]
) {
  const [roleRows]: any =
    await pool.query(
      'SELECT id FROM roles WHERE id = ? LIMIT 1',
      [roleId]
    );

  if (!roleRows.length) {
    throw new Error('Rol no encontrado');
  }

  const selectedKeys =
    Array.isArray(permissionKeys)
      ? permissionKeys.map(String)
      : [];

  const connection =
    await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [permissions]: any =
      await connection.query(
        'SELECT id, permission_key FROM permissions'
      );

    await connection.query(
      'DELETE FROM role_permissions WHERE role_id = ?',
      [roleId]
    );

    for (const permission of permissions) {
      await connection.query(
        `
          INSERT INTO role_permissions (
            role_id,
            permission_id,
            allowed
          )
          VALUES (?, ?, ?)
        `,
        [
          roleId,
          permission.id,
          selectedKeys.includes(permission.permission_key)
        ]
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
