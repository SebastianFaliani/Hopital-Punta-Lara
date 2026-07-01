const fs = require('fs');
const path = require('path');
const mysql = require('../backend/node_modules/mysql2/promise');

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
    [tableName, columnName]
  );

  return Number(rows[0]?.total || 0) > 0;
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
    [tableName, indexName]
  );

  return Number(rows[0]?.total || 0) > 0;
}

async function constraintExists(
  connection,
  constraintName
) {
  const [rows] = await connection.query(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.TABLE_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND CONSTRAINT_NAME = ?
    `,
    [constraintName]
  );

  return Number(rows[0]?.total || 0) > 0;
}

async function addColumnIfMissing(
  connection,
  tableName,
  columnName,
  definition
) {
  if (
    await columnExists(
      connection,
      tableName,
      columnName
    )
  ) {
    console.log(`OK: ${tableName}.${columnName} ya existe`);
    return;
  }

  await connection.query(
    `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`
  );

  console.log(`Agregado: ${tableName}.${columnName}`);
}

async function addIndexIfMissing(
  connection,
  tableName,
  indexName,
  definition
) {
  if (
    await indexExists(
      connection,
      tableName,
      indexName
    )
  ) {
    console.log(`OK: indice ${indexName} ya existe`);
    return;
  }

  await connection.query(
    `ALTER TABLE ${tableName} ADD ${definition}`
  );

  console.log(`Agregado: indice ${indexName}`);
}

function extractCatalogInsertSql() {
  const sqlPath = path.join(
    __dirname,
    '..',
    'backend',
    'database',
    'laboratory_route_sheet_update.sql'
  );

  const sql =
    fs.readFileSync(sqlPath, 'utf8');

  const start =
    sql.indexOf('INSERT INTO laboratory_test_catalog');

  const end =
    sql.indexOf('UPDATE laboratory_records', start);

  if (start === -1 || end === -1) {
    throw new Error(
      'No se pudo encontrar el catalogo de practicas en el SQL'
    );
  }

  return sql.slice(start, end).trim();
}

async function main() {
  const connection =
    await mysql.createConnection(getConnectionConfig());

  try {
    await addColumnIfMissing(
      connection,
      'laboratory_records',
      'is_complete',
      'BOOLEAN NOT NULL DEFAULT TRUE AFTER has_urine_sample'
    );

    await addColumnIfMissing(
      connection,
      'laboratory_records',
      'missing_details',
      'TEXT NULL AFTER is_complete'
    );

    await addColumnIfMissing(
      connection,
      'laboratory_records',
      'completed_at',
      'DATETIME NULL AFTER missing_details'
    );

    await addColumnIfMissing(
      connection,
      'laboratory_records',
      'completed_by',
      'BIGINT NULL AFTER completed_at'
    );

    await addColumnIfMissing(
      connection,
      'laboratory_records',
      'protocol_number',
      'VARCHAR(80) NULL AFTER id'
    );

    await addColumnIfMissing(
      connection,
      'laboratory_records',
      'patient_birth_date',
      'DATE NULL AFTER patient_document'
    );

    await addColumnIfMissing(
      connection,
      'laboratory_records',
      'patient_phone',
      'VARCHAR(80) NULL AFTER patient_birth_date'
    );

    await addColumnIfMissing(
      connection,
      'laboratory_records',
      'status',
      "ENUM('enviado','parcial','completo','retirado') NOT NULL DEFAULT 'enviado' AFTER is_complete"
    );

    await addIndexIfMissing(
      connection,
      'laboratory_records',
      'idx_laboratory_records_complete',
      'INDEX idx_laboratory_records_complete (is_complete)'
    );

    if (
      !(await constraintExists(
        connection,
        'fk_laboratory_records_completed_by'
      ))
    ) {
      await connection.query(
        `
          ALTER TABLE laboratory_records
          ADD CONSTRAINT fk_laboratory_records_completed_by
            FOREIGN KEY (completed_by)
            REFERENCES users(id)
            ON DELETE SET NULL
        `
      );
      console.log('Agregada: fk_laboratory_records_completed_by');
    } else {
      console.log('OK: fk_laboratory_records_completed_by ya existe');
    }

    await connection.query(
      `
        CREATE TABLE IF NOT EXISTS laboratory_test_catalog (
          id BIGINT PRIMARY KEY AUTO_INCREMENT,
          category VARCHAR(100) NOT NULL,
          code VARCHAR(80) NOT NULL,
          name VARCHAR(150) NOT NULL,
          display_order INT NOT NULL DEFAULT 0,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_laboratory_test_catalog_code (code),
          INDEX idx_laboratory_test_catalog_category (category),
          INDEX idx_laboratory_test_catalog_active (is_active)
        )
      `
    );

    await connection.query(
      `
        CREATE TABLE IF NOT EXISTS laboratory_record_tests (
          id BIGINT PRIMARY KEY AUTO_INCREMENT,
          laboratory_record_id BIGINT NOT NULL,
          test_id BIGINT NOT NULL,
          requested BOOLEAN NOT NULL DEFAULT TRUE,
          received BOOLEAN NOT NULL DEFAULT FALSE,
          received_at DATETIME NULL,
          received_by BIGINT NULL,
          notes TEXT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uq_laboratory_record_test (laboratory_record_id, test_id),
          INDEX idx_laboratory_record_tests_record (laboratory_record_id),
          INDEX idx_laboratory_record_tests_test (test_id),
          INDEX idx_laboratory_record_tests_received (received),
          CONSTRAINT fk_laboratory_record_tests_record
            FOREIGN KEY (laboratory_record_id)
            REFERENCES laboratory_records(id)
            ON DELETE CASCADE,
          CONSTRAINT fk_laboratory_record_tests_test
            FOREIGN KEY (test_id)
            REFERENCES laboratory_test_catalog(id),
          CONSTRAINT fk_laboratory_record_tests_received_by
            FOREIGN KEY (received_by)
            REFERENCES users(id)
            ON DELETE SET NULL
        )
      `
    );

    await connection.query(extractCatalogInsertSql());
    console.log('OK: catalogo de practicas actualizado');

    await connection.query(
      `
        UPDATE laboratory_records
        SET status =
          CASE
            WHEN pickup_date IS NOT NULL THEN 'retirado'
            WHEN is_complete = TRUE THEN 'completo'
            ELSE 'enviado'
          END
      `
    );
    console.log('OK: estados historicos actualizados');

    await connection.query(
      `
        INSERT INTO permissions (
          permission_key,
          module_name,
          description,
          sort_order
        )
        VALUES (
          'laboratory.pickup',
          'Laboratorio',
          'Entregar resultados de laboratorio',
          52
        )
        ON DUPLICATE KEY UPDATE
          module_name = VALUES(module_name),
          description = VALUES(description),
          sort_order = VALUES(sort_order)
      `
    );

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
          ON p.permission_key = 'laboratory.pickup'
        WHERE r.name IN ('admin', 'lab', 'user')
        ON DUPLICATE KEY UPDATE
          allowed = VALUES(allowed)
      `
    );

    console.log('Migracion de laboratorio lista.');
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
