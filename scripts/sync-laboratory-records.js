const fs = require('fs');
const path = require('path');
const mysql = require('../backend/node_modules/mysql2');
const mysqlPromise = require('../backend/node_modules/mysql2/promise');
require('../backend/node_modules/dotenv').config({
  path: path.join(__dirname, '..', 'backend', '.env')
});

const tables = [
  'laboratory_test_catalog',
  'laboratory_records',
  'laboratory_record_tests'
];

function readArg(name) {
  const prefix =
    `${name}=`;

  const match =
    process.argv.find((arg) => arg.startsWith(prefix));

  return match
    ? match.slice(prefix.length)
    : null;
}

function buildConfigFromUrl(urlValue) {
  if (!urlValue) {
    return null;
  }

  const parsed =
    new URL(urlValue);

  return {
    host: parsed.hostname,
    port: Number(parsed.port || 3306),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, ''),
    multipleStatements: true
  };
}

function buildSourceConfig() {
  const sourceUrl =
    readArg('--source') ||
    process.env.SOURCE_MYSQL_PUBLIC_URL ||
    process.env.SOURCE_DATABASE_URL ||
    null;

  const fromUrl =
    buildConfigFromUrl(sourceUrl);

  if (fromUrl) {
    return fromUrl;
  }

  return {
    host:
      process.env.DB_HOST ||
      process.env.MYSQLHOST ||
      'localhost',
    port:
      Number(
        process.env.DB_PORT ||
        process.env.MYSQLPORT ||
        3306
      ),
    user:
      process.env.DB_USER ||
      process.env.MYSQLUSER ||
      'root',
    password:
      process.env.DB_PASSWORD ||
      process.env.MYSQLPASSWORD ||
      '',
    database:
      process.env.DB_NAME ||
      process.env.MYSQLDATABASE ||
      process.env.MYSQL_DATABASE,
    multipleStatements: true
  };
}

function buildTargetConfig() {
  const targetUrl =
    readArg('--target') ||
    process.env.TARGET_MYSQL_PUBLIC_URL ||
    process.env.TARGET_DATABASE_URL ||
    null;

  const fromUrl =
    buildConfigFromUrl(targetUrl);

  if (!fromUrl) {
    throw new Error(
      'Falta la conexion de destino. Usa --target=mysql://... o TARGET_MYSQL_PUBLIC_URL=mysql://...'
    );
  }

  return fromUrl;
}

function assertConfig(config, label) {
  if (!config.host || !config.user || !config.database) {
    throw new Error(
      `Faltan datos de conexion para ${label}. Verifica host, usuario y base.`
    );
  }
}

function quoteIdentifier(value) {
  return `\`${String(value).replace(/`/g, '``')}\``;
}

function normalizeDateTime(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    const pad =
      (item) => String(item).padStart(2, '0');

    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
  }

  return value;
}

function escapeSqlValue(value) {
  if (
    value &&
    typeof value === 'object' &&
    !(value instanceof Date) &&
    !Buffer.isBuffer(value)
  ) {
    return mysql.escape(JSON.stringify(value));
  }

  if (value instanceof Date) {
    return mysql.escape(normalizeDateTime(value));
  }

  return mysql.escape(value);
}

function timestamp() {
  const now =
    new Date();

  const pad =
    (value) => String(value).padStart(2, '0');

  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate())
  ].join('-') + '-' + [
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds())
  ].join('');
}

async function getColumns(connection, tableName) {
  const [rows] =
    await connection.query(
      `
        SELECT COLUMN_NAME AS column_name
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION
      `,
      [tableName]
    );

  return rows.map((row) => row.column_name || row.COLUMN_NAME);
}

async function getCount(connection, tableName) {
  const [rows] =
    await connection.query(
      `SELECT COUNT(*) AS total FROM ${quoteIdentifier(tableName)}`
    );

  return Number(rows[0]?.total || 0);
}

async function backupTargetLaboratory(connection) {
  const outputDir =
    path.resolve(process.cwd(), 'backups');

  fs.mkdirSync(outputDir, {
    recursive: true
  });

  const outputPath =
    path.join(
      outputDir,
      `laboratory-target-backup-${timestamp()}.sql`
    );

  const lines = [
    '-- Backup laboratorio antes de sincronizar',
    `-- Fecha: ${new Date().toISOString()}`,
    'SET FOREIGN_KEY_CHECKS=0;',
    ''
  ];

  for (const tableName of tables) {
    const columns =
      await getColumns(connection, tableName);

    if (!columns.length) {
      continue;
    }

    const [rows] =
      await connection.query(
        `SELECT * FROM ${quoteIdentifier(tableName)} ORDER BY id`
      );

    if (!rows.length) {
      continue;
    }

    lines.push(
      `INSERT INTO ${quoteIdentifier(tableName)} (${columns.map(quoteIdentifier).join(', ')}) VALUES`
    );

    lines.push(
      rows
        .map((row) =>
          `(${columns.map((column) => escapeSqlValue(row[column])).join(', ')})`
        )
        .join(',\n') + ';'
    );

    lines.push('');
  }

  lines.push('SET FOREIGN_KEY_CHECKS=1;');

  fs.writeFileSync(
    outputPath,
    `${lines.join('\n')}\n`,
    'utf8'
  );

  return outputPath;
}

function intersectColumns(sourceColumns, targetColumns, preferredColumns) {
  const sourceSet =
    new Set(sourceColumns);

  const targetSet =
    new Set(targetColumns);

  return preferredColumns.filter(
    (column) => sourceSet.has(column) && targetSet.has(column)
  );
}

async function syncCatalog(source, target) {
  const sourceColumns =
    await getColumns(source, 'laboratory_test_catalog');

  const targetColumns =
    await getColumns(target, 'laboratory_test_catalog');

  const columns =
    intersectColumns(
      sourceColumns,
      targetColumns,
      [
        'id',
        'category',
        'code',
        'name',
        'display_order',
        'is_active',
        'created_at'
      ]
    );

  const [rows] =
    await source.query(
      'SELECT * FROM laboratory_test_catalog ORDER BY id'
    );

  await target.query(
    'DELETE FROM laboratory_test_catalog'
  );

  if (!rows.length) {
    return;
  }

  const values =
    rows.map((row) =>
      columns.map((column) => row[column])
    );

  await target.query(
    `
      INSERT INTO laboratory_test_catalog (
        ${columns.map(quoteIdentifier).join(', ')}
      )
      VALUES ?
    `,
    [values]
  );
}

async function syncRecords(source, target) {
  const sourceColumns =
    await getColumns(source, 'laboratory_records');

  const targetColumns =
    await getColumns(target, 'laboratory_records');

  const columns =
    intersectColumns(
      sourceColumns,
      targetColumns,
      [
        'id',
        'protocol_number',
        'study_date',
        'patient_last_name',
        'patient_first_name',
        'patient_document',
        'patient_birth_date',
        'patient_phone',
        'has_blood_extraction',
        'has_urine_sample',
        'is_complete',
        'status',
        'missing_details',
        'completed_at',
        'completed_by',
        'pickup_date',
        'picked_up_by',
        'pickup_document',
        'notes',
        'created_by',
        'updated_by',
        'created_at',
        'updated_at'
      ]
    );

  const [rows] =
    await source.query(
      'SELECT * FROM laboratory_records ORDER BY id'
    );

  await target.query(
    'DELETE FROM laboratory_records'
  );

  if (!rows.length) {
    return;
  }

  const values =
    rows.map((row) =>
      columns.map((column) => row[column])
    );

  await target.query(
    `
      INSERT INTO laboratory_records (
        ${columns.map(quoteIdentifier).join(', ')}
      )
      VALUES ?
    `,
    [values]
  );
}

async function syncRecordTests(source, target) {
  const sourceColumns =
    await getColumns(source, 'laboratory_record_tests');

  const targetColumns =
    await getColumns(target, 'laboratory_record_tests');

  const columns =
    intersectColumns(
      sourceColumns,
      targetColumns,
      [
        'id',
        'laboratory_record_id',
        'test_id',
        'requested',
        'received',
        'received_at',
        'received_by',
        'notes',
        'created_at',
        'updated_at'
      ]
    );

  const [rows] =
    await source.query(
      'SELECT * FROM laboratory_record_tests ORDER BY id'
    );

  await target.query(
    'DELETE FROM laboratory_record_tests'
  );

  if (!rows.length) {
    return;
  }

  const values =
    rows.map((row) =>
      columns.map((column) => row[column])
    );

  const chunkSize =
    500;

  for (let index = 0; index < values.length; index += chunkSize) {
    await target.query(
      `
        INSERT INTO laboratory_record_tests (
          ${columns.map(quoteIdentifier).join(', ')}
        )
        VALUES ?
      `,
      [values.slice(index, index + chunkSize)]
    );
  }
}

async function main() {
  const dryRun =
    process.argv.includes('--dry-run');

  const sourceConfig =
    buildSourceConfig();

  const targetConfig =
    buildTargetConfig();

  assertConfig(sourceConfig, 'origen');
  assertConfig(targetConfig, 'destino');

  const source =
    await mysqlPromise.createConnection(sourceConfig);

  const target =
    await mysqlPromise.createConnection(targetConfig);

  try {
    const sourceCounts = {};
    const targetCounts = {};

    for (const tableName of tables) {
      sourceCounts[tableName] =
        await getCount(source, tableName);

      targetCounts[tableName] =
        await getCount(target, tableName);
    }

    console.log('Origen:');
    console.table(sourceCounts);
    console.log('Destino actual:');
    console.table(targetCounts);

    if (dryRun) {
      console.log(
        'Modo prueba: no se modifico la base de destino.'
      );
      return;
    }

    const backupPath =
      await backupTargetLaboratory(target);

    console.log(
      `Backup previo de laboratorio en destino: ${backupPath}`
    );

    await target.query('SET FOREIGN_KEY_CHECKS=0');
    await target.beginTransaction();

    await target.query('DELETE FROM laboratory_record_tests');
    await target.query('DELETE FROM laboratory_records');
    await target.query('DELETE FROM laboratory_test_catalog');

    await syncCatalog(source, target);
    await syncRecords(source, target);
    await syncRecordTests(source, target);

    await target.commit();
    await target.query('SET FOREIGN_KEY_CHECKS=1');

    const finalRecords =
      await getCount(target, 'laboratory_records');

    console.log(
      `Sincronizacion lista. Destino quedo con ${finalRecords} estudio(s) de laboratorio.`
    );
  } catch (error) {
    try {
      await target.rollback();
      await target.query('SET FOREIGN_KEY_CHECKS=1');
    } catch (_) {
      // No action needed.
    }

    throw error;
  } finally {
    await source.end();
    await target.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
