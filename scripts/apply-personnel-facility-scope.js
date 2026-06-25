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

async function columnExists(
  connection,
  tableName,
  columnName
) {
  const [rows] = await connection.query(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
    `,
    [
      tableName,
      columnName
    ]
  );

  return Number(rows[0].total || 0) > 0;
}

async function indexExists(
  connection,
  tableName,
  indexName
) {
  const [rows] = await connection.query(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND INDEX_NAME = ?
    `,
    [
      tableName,
      indexName
    ]
  );

  return Number(rows[0].total || 0) > 0;
}

async function foreignKeyExists(
  connection,
  constraintName
) {
  const [rows] = await connection.query(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = DATABASE()
        AND CONSTRAINT_NAME = ?
        AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    `,
    [constraintName]
  );

  return Number(rows[0].total || 0) > 0;
}

async function main() {
  const connection =
    await mysql.createConnection(getConnectionConfig());

  await connection.query(
    `
      CREATE TABLE IF NOT EXISTS health_facilities (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(180) NOT NULL,
        facility_type ENUM(
          'secretaria',
          'hospital',
          'unidad_sanitaria',
          'otro'
        ) NOT NULL DEFAULT 'unidad_sanitaria',
        address TEXT NULL,
        phone VARCHAR(80) NULL,
        notes TEXT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_health_facilities_name (name)
      )
    `
  );

  await connection.query(
    `
      INSERT INTO health_facilities (name, facility_type, notes)
      VALUES
        ('Secretaria de Salud', 'secretaria', 'Gestion central'),
        ('Hospital Municipal de Punta Lara', 'hospital', 'Hospital principal')
      ON DUPLICATE KEY UPDATE
        facility_type = VALUES(facility_type),
        notes = VALUES(notes),
        is_active = TRUE
    `
  );

  if (!(await columnExists(connection, 'employees', 'facility_id'))) {
    await connection.query(
      `
        ALTER TABLE employees
        ADD COLUMN facility_id BIGINT NULL AFTER id
      `
    );
    console.log('Agregado: employees.facility_id');
  } else {
    console.log('OK: employees.facility_id ya existe');
  }

  await connection.query(
    `
      UPDATE employees e
      INNER JOIN health_facilities hf
        ON hf.name = 'Hospital Municipal de Punta Lara'
      SET e.facility_id = hf.id
      WHERE e.facility_id IS NULL
    `
  );

  if (!(await indexExists(connection, 'employees', 'idx_employees_facility'))) {
    await connection.query(
      `
        ALTER TABLE employees
        ADD INDEX idx_employees_facility (facility_id)
      `
    );
    console.log('Agregado: indice idx_employees_facility');
  } else {
    console.log('OK: indice idx_employees_facility ya existe');
  }

  if (!(await foreignKeyExists(connection, 'fk_employees_facility'))) {
    await connection.query(
      `
        ALTER TABLE employees
        ADD CONSTRAINT fk_employees_facility
          FOREIGN KEY (facility_id)
          REFERENCES health_facilities(id)
          ON DELETE SET NULL
      `
    );
    console.log('Agregada: relacion fk_employees_facility');
  } else {
    console.log('OK: relacion fk_employees_facility ya existe');
  }

  if (!(await columnExists(connection, 'employee_departments', 'facility_id'))) {
    await connection.query(
      `
        ALTER TABLE employee_departments
        ADD COLUMN facility_id BIGINT NULL AFTER id
      `
    );
    console.log('Agregado: employee_departments.facility_id');
  } else {
    console.log('OK: employee_departments.facility_id ya existe');
  }

  await connection.query(
    `
      UPDATE employee_departments d
      INNER JOIN health_facilities hf
        ON hf.name = 'Hospital Municipal de Punta Lara'
      SET d.facility_id = hf.id
      WHERE d.facility_id IS NULL
    `
  );

  if (!(await indexExists(connection, 'employee_departments', 'idx_employee_departments_facility'))) {
    await connection.query(
      `
        ALTER TABLE employee_departments
        ADD INDEX idx_employee_departments_facility (facility_id)
      `
    );
    console.log('Agregado: indice idx_employee_departments_facility');
  } else {
    console.log('OK: indice idx_employee_departments_facility ya existe');
  }

  if (await indexExists(connection, 'employee_departments', 'uk_employee_departments_name')) {
    await connection.query(
      `
        ALTER TABLE employee_departments
        DROP INDEX uk_employee_departments_name
      `
    );
    console.log('Eliminado: indice unico global uk_employee_departments_name');
  }

  if (!(await indexExists(connection, 'employee_departments', 'uq_employee_departments_facility_name'))) {
    await connection.query(
      `
        ALTER TABLE employee_departments
        ADD UNIQUE KEY uq_employee_departments_facility_name (
          facility_id,
          name
        )
      `
    );
    console.log('Agregado: indice unico uq_employee_departments_facility_name');
  } else {
    console.log('OK: indice unico uq_employee_departments_facility_name ya existe');
  }

  if (!(await foreignKeyExists(connection, 'fk_employee_departments_facility'))) {
    await connection.query(
      `
        ALTER TABLE employee_departments
        ADD CONSTRAINT fk_employee_departments_facility
          FOREIGN KEY (facility_id)
          REFERENCES health_facilities(id)
          ON DELETE SET NULL
      `
    );
    console.log('Agregada: relacion fk_employee_departments_facility');
  } else {
    console.log('OK: relacion fk_employee_departments_facility ya existe');
  }

  await connection.end();
  console.log('Personal por dependencia listo.');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
