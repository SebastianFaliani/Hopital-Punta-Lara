import { pool } from '../../config/database';

export async function getEffectivePermissionKeys(
  userId: number,
  roleId: number
) {
  const [rows]: any =
    await pool.query(
      `
        SELECT p.permission_key
        FROM permissions p
        LEFT JOIN role_permissions rp
          ON rp.permission_id = p.id
          AND rp.role_id = ?
        LEFT JOIN user_permissions up
          ON up.permission_id = p.id
          AND up.user_id = ?
        WHERE COALESCE(up.allowed, rp.allowed, FALSE) = TRUE
        ORDER BY p.sort_order, p.permission_key
      `,
      [roleId, userId]
    );

  return rows.map((row: any) =>
    String(row.permission_key)
  );
}

export async function getUserFacilityIds(
  userId: number,
  primaryFacilityId?: number | null
) {
  const [rows]: any =
    await pool.query(
      `
        SELECT facility_id
        FROM user_facilities
        WHERE user_id = ?
      `,
      [userId]
    );

  return Array.from(
    new Set(
      [
        primaryFacilityId
          ? Number(primaryFacilityId)
          : null,
        ...rows.map((row: any) =>
          Number(row.facility_id)
        )
      ].filter(Boolean)
    )
  );
}

export async function getUserAccessConfiguration(
  userId: number
) {
  const [userRows]: any =
    await pool.query(
      `
        SELECT
          u.id,
          u.role_id,
          u.facility_id,
          u.access_all_facilities
        FROM users u
        WHERE u.id = ?
        LIMIT 1
      `,
      [userId]
    );

  if (!userRows.length) {
    throw new Error('Usuario no encontrado');
  }

  const user = userRows[0];

  const [permissionRows]: any =
    await pool.query(
      `
        SELECT
          p.id,
          p.permission_key,
          p.module_name,
          p.description,
          COALESCE(up.allowed, rp.allowed, FALSE) AS allowed,
          CASE WHEN up.user_id IS NULL THEN 'rol' ELSE 'personalizado' END AS source
        FROM permissions p
        LEFT JOIN role_permissions rp
          ON rp.permission_id = p.id
          AND rp.role_id = ?
        LEFT JOIN user_permissions up
          ON up.permission_id = p.id
          AND up.user_id = ?
        ORDER BY p.sort_order, p.permission_key
      `,
      [user.role_id, userId]
    );

  const facilityIds =
    await getUserFacilityIds(
      userId,
      user.facility_id
    );

  return {
    access_all_facilities:
      Boolean(user.access_all_facilities),
    facility_ids: facilityIds,
    permissions: permissionRows.map((row: any) => ({
      ...row,
      allowed: Boolean(row.allowed)
    }))
  };
}

export async function updateUserAccessConfiguration(
  userId: number,
  data: any
) {
  const permissionKeys =
    Array.isArray(data.permission_keys)
      ? data.permission_keys.map(String)
      : [];

  const facilityIds =
    Array.isArray(data.facility_ids)
      ? data.facility_ids
        .map(Number)
        .filter((id: number) => id > 0)
      : [];

  const connection =
    await pool.getConnection();

  try {
    await connection.beginTransaction();

    await connection.query(
      `
        UPDATE users
        SET access_all_facilities = ?
        WHERE id = ?
      `,
      [
        Boolean(data.access_all_facilities),
        userId
      ]
    );

    await connection.query(
      'DELETE FROM user_facilities WHERE user_id = ?',
      [userId]
    );

    for (const facilityId of new Set(facilityIds)) {
      await connection.query(
        `
          INSERT INTO user_facilities (
            user_id,
            facility_id
          )
          VALUES (?, ?)
        `,
        [userId, facilityId]
      );
    }

    const [permissions]: any =
      await connection.query(
        'SELECT id, permission_key FROM permissions'
      );

    await connection.query(
      'DELETE FROM user_permissions WHERE user_id = ?',
      [userId]
    );

    for (const permission of permissions) {
      await connection.query(
        `
          INSERT INTO user_permissions (
            user_id,
            permission_id,
            allowed
          )
          VALUES (?, ?, ?)
        `,
        [
          userId,
          permission.id,
          permissionKeys.includes(permission.permission_key)
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

export async function resetUserAccessConfiguration(
  userId: number
) {
  await pool.query(
    'DELETE FROM user_permissions WHERE user_id = ?',
    [userId]
  );
}
