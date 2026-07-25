import { pool } from '../../config/database';

let laboratoryPermissionsPromise: Promise<void> | null = null;

async function ensureLaboratoryPermissions() {
  if (!laboratoryPermissionsPromise) {
    laboratoryPermissionsPromise = (async () => {
      await pool.query(`
        INSERT INTO permissions (permission_key, module_name, description, sort_order)
        VALUES
          ('laboratory.view', 'Laboratorio', 'Consultar estudios y abrir PDF', 50),
          ('laboratory.manage', 'Laboratorio', 'Completar y modificar resultados', 51),
          ('laboratory.pdf.manage', 'Laboratorio', 'Cargar o quitar PDF', 52),
          ('laboratory.whatsapp.send', 'Laboratorio', 'Avisar resultados por WhatsApp', 53),
          ('laboratory.pickup', 'Laboratorio', 'Registrar retiro presencial', 54),
          ('laboratory.records.delete', 'Laboratorio', 'Eliminar o archivar laboratorios', 55),
          ('laboratory.reopen', 'Laboratorio', 'Reabrir laboratorios por correccion', 56),
          ('laboratory.pickup.revert', 'Laboratorio', 'Deshacer retiros presenciales', 57)
        ON DUPLICATE KEY UPDATE
          module_name = VALUES(module_name),
          description = VALUES(description),
          sort_order = VALUES(sort_order)
      `);

      const roleDefaults: Array<[string, string[]]> = [
        ['admin', [
          'laboratory.view', 'laboratory.manage', 'laboratory.pdf.manage',
          'laboratory.whatsapp.send', 'laboratory.pickup',
          'laboratory.records.delete', 'laboratory.reopen',
          'laboratory.pickup.revert'
        ]],
        ['dir', [
          'laboratory.view', 'laboratory.manage', 'laboratory.pdf.manage',
          'laboratory.whatsapp.send', 'laboratory.pickup',
          'laboratory.records.delete', 'laboratory.reopen',
          'laboratory.pickup.revert'
        ]],
        ['lab', [
          'laboratory.view', 'laboratory.manage',
          'laboratory.whatsapp.send', 'laboratory.pickup'
        ]],
        ['user', ['laboratory.view', 'laboratory.pickup']]
      ];

      for (const [roleName, permissionKeys] of roleDefaults) {
        await pool.query(
          `INSERT IGNORE INTO role_permissions (role_id, permission_id, allowed)
           SELECT r.id, p.id, TRUE
           FROM roles r
           INNER JOIN permissions p ON p.permission_key IN (?)
           WHERE r.name = ?`,
          [permissionKeys, roleName]
        );
      }
    })().catch((error) => {
      laboratoryPermissionsPromise = null;
      throw error;
    });
  }

  await laboratoryPermissionsPromise;
}

export async function getEffectivePermissionKeys(
  userId: number,
  roleId: number
) {
  await ensureLaboratoryPermissions();

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
  await ensureLaboratoryPermissions();

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
