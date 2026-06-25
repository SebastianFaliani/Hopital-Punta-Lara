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
          process.env.MYSQL_DATABASE,
    multipleStatements: true
  };
}

async function columnExists(connection, tableName, columnName) {
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

async function addColumnIfMissing(connection, columnName) {
  if (await columnExists(connection, 'leave_rules', columnName)) {
    console.log(`OK: leave_rules.${columnName} ya existe`);
    return;
  }

  await connection.query(
    `
      ALTER TABLE leave_rules
      ADD COLUMN ${columnName} DECIMAL(6,2) NULL
    `
  );

  console.log(`Agregado: leave_rules.${columnName}`);
}

async function main() {
  const connection =
    await mysql.createConnection(getConnectionConfig());

  await connection.query(
    `
      CREATE TABLE IF NOT EXISTS leave_rules (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        attendance_code_id BIGINT NOT NULL,
        name VARCHAR(150) NOT NULL,
        min_advance_days INT NULL,
        max_days_per_request DECIMAL(6,2) NULL,
        max_days_per_year DECIMAL(6,2) NULL,
        requires_documentation BOOLEAN DEFAULT FALSE,
        requires_medical_order BOOLEAN DEFAULT FALSE,
        gender_condition ENUM(
          'cualquiera',
          'femenino',
          'masculino'
        ) DEFAULT 'cualquiera',
        seniority_min_years DECIMAL(5,2) NULL,
        seniority_max_years DECIMAL(5,2) NULL,
        rule_notes TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_leave_rules_code (attendance_code_id),
        CONSTRAINT fk_leave_rules_code
          FOREIGN KEY (attendance_code_id)
          REFERENCES attendance_codes(id)
      )
    `
  );

  await addColumnIfMissing(connection, 'max_hours_per_day');
  await addColumnIfMissing(connection, 'max_hours_per_week');
  await addColumnIfMissing(connection, 'max_hours_per_month');
  await addColumnIfMissing(connection, 'max_hours_per_year');

  await connection.query(
    `
      UPDATE leave_rules lr
      INNER JOIN attendance_codes ac
        ON ac.id = lr.attendance_code_id
      SET
        lr.max_hours_per_day = CASE
          WHEN ac.code IN ('24', '43', '35') THEN 2
          ELSE lr.max_hours_per_day
        END,
        lr.max_hours_per_week = CASE
          WHEN ac.code = '46' THEN 5
          ELSE lr.max_hours_per_week
        END,
        lr.max_hours_per_month = CASE
          WHEN ac.code IN ('24', '43') THEN 5
          ELSE lr.max_hours_per_month
        END,
        lr.max_hours_per_year = CASE
          WHEN ac.code IN ('24', '43') THEN 30
          ELSE lr.max_hours_per_year
        END
      WHERE ac.code IN ('24', '43', '35', '46')
    `
  );

  await connection.end();
  console.log('Reglas de horas de licencias listas.');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
