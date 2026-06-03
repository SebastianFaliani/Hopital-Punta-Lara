const path = require('path');
const mysql = require('../backend/node_modules/mysql2/promise');
require('../backend/node_modules/dotenv').config({
  path: path.join(__dirname, '..', 'backend', '.env')
});

const movementTypes = [
  'compra',
  'donacion',
  'ajuste',
  'perdida',
  'devolucion',
  'traslado_envio',
  'traslado_recepcion',
  'traslado_cancelacion',
  'entrega_paciente',
  'cancelacion_entrega_paciente'
];

function getConnectionConfig() {
  const url =
    process.env.DATABASE_URL ||
    process.env.MYSQL_URL ||
    process.env.MYSQL_PUBLIC_URL;

  if (url) {
    return {
      uri: url,
      multipleStatements: true
    };
  }

  return {
    host:
      process.env.DB_HOST ||
      process.env.MYSQLHOST,
    port:
      Number(
        process.env.DB_PORT ||
        process.env.MYSQLPORT ||
        3306
      ),
    user:
      process.env.DB_USER ||
      process.env.MYSQLUSER,
    password:
      process.env.DB_PASSWORD ||
      process.env.MYSQLPASSWORD,
    database:
      process.env.DB_NAME ||
      process.env.MYSQLDATABASE ||
      process.env.MYSQL_DATABASE,
    multipleStatements: true
  };
}

async function tableExists(connection, tableName) {
  const [rows] = await connection.query(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = ?
    `,
    [tableName]
  );

  return Number(rows[0].total) > 0;
}

async function columnExists(connection, tableName, columnName) {
  const [rows] = await connection.query(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND column_name = ?
    `,
    [tableName, columnName]
  );

  return Number(rows[0].total) > 0;
}

async function indexExists(connection, tableName, indexName) {
  const [rows] = await connection.query(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND index_name = ?
    `,
    [tableName, indexName]
  );

  return Number(rows[0].total) > 0;
}

async function constraintExists(connection, constraintName) {
  const [rows] = await connection.query(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.table_constraints
      WHERE table_schema = DATABASE()
        AND constraint_name = ?
    `,
    [constraintName]
  );

  return Number(rows[0].total) > 0;
}

async function query(connection, sql, params = []) {
  await connection.query(sql, params);
}

async function addColumnIfMissing(
  connection,
  tableName,
  columnName,
  definition
) {
  if (await columnExists(connection, tableName, columnName)) {
    console.log(`OK: ${tableName}.${columnName} ya existe`);
    return;
  }

  await query(
    connection,
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
  if (await indexExists(connection, tableName, indexName)) {
    console.log(`OK: indice ${indexName} ya existe`);
    return;
  }

  await query(
    connection,
    `ALTER TABLE ${tableName} ADD INDEX ${indexName} ${definition}`
  );

  console.log(`Agregado: indice ${indexName}`);
}

async function addForeignKeyIfMissing(
  connection,
  tableName,
  constraintName,
  definition
) {
  if (await constraintExists(connection, constraintName)) {
    console.log(`OK: relacion ${constraintName} ya existe`);
    return;
  }

  await query(
    connection,
    `ALTER TABLE ${tableName} ADD CONSTRAINT ${constraintName} ${definition}`
  );

  console.log(`Agregada: relacion ${constraintName}`);
}

async function ensureMovementTypes(connection) {
  await query(
    connection,
    `
      ALTER TABLE inventory_movements
      MODIFY movement_type ENUM(${movementTypes
        .map((type) => `'${type}'`)
        .join(',')}) NOT NULL
    `
  );

  console.log('OK: tipos de movimientos actualizados');
}

async function main() {
  const connection = await mysql.createConnection(
    getConnectionConfig()
  );

  try {
    await query(
      connection,
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

    await query(
      connection,
      `
        INSERT INTO health_facilities (name, facility_type, notes)
        VALUES
          ('Secretaria de Salud', 'secretaria', 'Punto central de ingreso y distribucion'),
          ('Hospital Municipal de Punta Lara', 'hospital', 'Hospital principal')
        ON DUPLICATE KEY UPDATE
          facility_type = VALUES(facility_type),
          notes = VALUES(notes),
          is_active = TRUE
      `
    );

    await query(
      connection,
      `
        CREATE TABLE IF NOT EXISTS medication_batch_stocks (
          id BIGINT PRIMARY KEY AUTO_INCREMENT,
          medication_batch_id BIGINT NOT NULL,
          facility_id BIGINT NOT NULL,
          current_stock DECIMAL(12,2) NOT NULL DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uq_medication_batch_facility (
            medication_batch_id,
            facility_id
          ),
          INDEX idx_medication_batch_stocks_facility (facility_id),
          CONSTRAINT fk_medication_batch_stocks_batch
            FOREIGN KEY (medication_batch_id)
            REFERENCES medication_batches(id)
            ON DELETE CASCADE,
          CONSTRAINT fk_medication_batch_stocks_facility
            FOREIGN KEY (facility_id)
            REFERENCES health_facilities(id)
            ON DELETE RESTRICT
        )
      `
    );

    await query(
      connection,
      `
        INSERT INTO medication_batch_stocks (
          medication_batch_id,
          facility_id,
          current_stock
        )
        SELECT
          mb.id,
          hf.id,
          mb.current_stock
        FROM medication_batches mb
        JOIN health_facilities hf
          ON hf.name = 'Hospital Municipal de Punta Lara'
        WHERE mb.current_stock > 0
        ON DUPLICATE KEY UPDATE
          current_stock = medication_batch_stocks.current_stock
      `
    );

    await ensureMovementTypes(connection);

    await addColumnIfMissing(
      connection,
      'inventory_movements',
      'facility_id',
      'BIGINT NULL AFTER medication_batch_id'
    );

    await addColumnIfMissing(
      connection,
      'inventory_movements',
      'donor_name',
      'VARCHAR(180) NULL AFTER reference_id'
    );

    await addIndexIfMissing(
      connection,
      'inventory_movements',
      'idx_inventory_movements_facility',
      '(facility_id)'
    );

    await addForeignKeyIfMissing(
      connection,
      'inventory_movements',
      'fk_inventory_movements_facility',
      'FOREIGN KEY (facility_id) REFERENCES health_facilities(id) ON DELETE SET NULL'
    );

    await addColumnIfMissing(
      connection,
      'users',
      'facility_id',
      'BIGINT NULL AFTER role_id'
    );

    await addIndexIfMissing(
      connection,
      'users',
      'idx_users_facility',
      '(facility_id)'
    );

    await addForeignKeyIfMissing(
      connection,
      'users',
      'fk_users_facility',
      'FOREIGN KEY (facility_id) REFERENCES health_facilities(id) ON DELETE SET NULL'
    );

    const files = [
      'backend/database/medication_transfers_module.sql',
      'backend/database/medication_deliveries_module.sql',
      'backend/database/medication_chronic_module.sql',
      'backend/database/chronic_package_received_status_update.sql'
    ];

    for (const file of files) {
      const sql = require('fs').readFileSync(
        path.join(__dirname, '..', file),
        'utf8'
      );
      await query(connection, sql);
      console.log(`Aplicado: ${file}`);
    }

    console.log('Migracion de medicamentos lista.');
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
