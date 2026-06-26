const mysql = require('../backend/node_modules/mysql2/promise');
const path = require('path');

require('../backend/node_modules/dotenv').config({
  path: path.join(__dirname, '..', 'backend', '.env')
});

function getConnectionConfig() {
  const publicUrl = process.env.MYSQL_PUBLIC_URL;
  const publicDatabase = publicUrl
    ? new URL(publicUrl)
    : null;

  return {
    host:
      publicDatabase?.hostname ||
      process.env.DB_HOST ||
      process.env.MYSQLHOST,
    port:
      Number(
        publicDatabase?.port ||
        process.env.DB_PORT ||
        process.env.MYSQLPORT ||
        3306
      ),
    user:
      publicDatabase
        ? decodeURIComponent(publicDatabase.username)
        : process.env.DB_USER ||
          process.env.MYSQLUSER,
    password:
      publicDatabase
        ? decodeURIComponent(publicDatabase.password)
        : process.env.DB_PASSWORD ||
          process.env.MYSQLPASSWORD,
    database:
      publicDatabase
        ? publicDatabase.pathname.replace(/^\//, '')
        : process.env.DB_NAME ||
          process.env.MYSQLDATABASE ||
          process.env.MYSQL_DATABASE
  };
}

const permissions = [
  [
    'personnel.employees.manage',
    'Personal',
    'Administrar empleados',
    12
  ],
  [
    'personnel.attendance.manage',
    'Personal',
    'Cargar presentismo y francos',
    13
  ],
  [
    'personnel.leaves.manage',
    'Personal',
    'Cargar y editar licencias',
    14
  ],
  [
    'personnel.leaves.approve',
    'Personal',
    'Aprobar, rechazar y cancelar licencias',
    15
  ],
  [
    'personnel.balances.manage',
    'Personal',
    'Administrar saldos y ajustes',
    16
  ],
  [
    'personnel.settings.manage',
    'Personal',
    'Administrar sectores, claves y reglas',
    17
  ]
];

async function grantRolePermissions(
  connection,
  roleName,
  permissionKeys
) {
  await connection.query(
    `
      INSERT INTO role_permissions (
        role_id,
        permission_id,
        allowed
      )
      SELECT r.id, p.id, TRUE
      FROM roles r
      INNER JOIN permissions p
        ON p.permission_key IN (${permissionKeys
          .map(() => '?')
          .join(', ')})
      WHERE r.name = ?
      ON DUPLICATE KEY UPDATE
        allowed = VALUES(allowed)
    `,
    [
      ...permissionKeys,
      roleName
    ]
  );
}

async function main() {
  const connection =
    await mysql.createConnection(getConnectionConfig());

  try {
    await connection.beginTransaction();

    for (const permission of permissions) {
      await connection.query(
        `
          INSERT INTO permissions (
            permission_key,
            module_name,
            description,
            sort_order
          )
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            module_name = VALUES(module_name),
            description = VALUES(description),
            sort_order = VALUES(sort_order)
        `,
        permission
      );
    }

    const allPersonnelPermissions = [
      'personnel.view',
      'personnel.manage',
      ...permissions.map((permission) =>
        permission[0]
      )
    ];

    await grantRolePermissions(
      connection,
      'admin',
      allPersonnelPermissions
    );

    await grantRolePermissions(
      connection,
      'dir',
      [
        'personnel.view',
        'personnel.employees.manage',
        'personnel.attendance.manage',
        'personnel.leaves.manage',
        'personnel.leaves.approve',
        'personnel.balances.manage',
        'personnel.settings.manage'
      ]
    );

    await grantRolePermissions(
      connection,
      'user',
      [
        'personnel.view',
        'personnel.employees.manage',
        'personnel.attendance.manage',
        'personnel.leaves.manage'
      ]
    );

    await connection.query(
      `
        UPDATE role_permissions rp
        INNER JOIN roles r
          ON r.id = rp.role_id
        INNER JOIN permissions p
          ON p.id = rp.permission_id
        SET rp.allowed = FALSE
        WHERE r.name IN ('user', 'dir')
          AND p.permission_key = 'personnel.manage'
      `
    );

    await connection.query(
      `
        INSERT INTO user_permissions (
          user_id,
          permission_id,
          allowed
        )
        SELECT up.user_id, p_new.id, TRUE
        FROM user_permissions up
        INNER JOIN permissions p_old
          ON p_old.id = up.permission_id
          AND p_old.permission_key = 'personnel.manage'
        CROSS JOIN permissions p_new
        WHERE up.allowed = TRUE
          AND p_new.permission_key IN (${permissions
            .map(() => '?')
            .join(', ')})
        ON DUPLICATE KEY UPDATE
          allowed = VALUES(allowed)
      `,
      permissions.map((permission) =>
        permission[0]
      )
    );

    await connection.query(
      `
        UPDATE user_permissions up
        INNER JOIN permissions p
          ON p.id = up.permission_id
        INNER JOIN users u
          ON u.id = up.user_id
        INNER JOIN roles r
          ON r.id = u.role_id
        SET up.allowed = FALSE
        WHERE p.permission_key = 'personnel.manage'
          AND r.name <> 'admin'
      `
    );

    await connection.query(
      `
        UPDATE user_permissions up
        INNER JOIN permissions p
          ON p.id = up.permission_id
        INNER JOIN users u
          ON u.id = up.user_id
        INNER JOIN roles r
          ON r.id = u.role_id
        SET up.allowed = FALSE
        WHERE r.name = 'user'
          AND p.permission_key IN (
            'personnel.leaves.approve',
            'personnel.balances.manage',
            'personnel.settings.manage'
          )
      `
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }

  console.log('Permisos finos de Personal listos.');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
