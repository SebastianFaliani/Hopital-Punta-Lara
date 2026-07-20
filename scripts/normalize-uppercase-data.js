const path = require('path');
const mysql = require('../backend/node_modules/mysql2/promise');
require('../backend/node_modules/dotenv').config({
  path: path.join(__dirname, '..', 'backend', '.env')
});

const targets = [
  ['users', ['first_name', 'last_name']],
  ['drivers', ['first_name', 'last_name']],
  ['nutrition_patients', ['first_name', 'last_name']],
  ['laboratory_records', ['patient_last_name', 'patient_first_name']],
  ['employees', ['full_name']],
  ['chronic_patients', ['full_name']],
  ['medications', ['name', 'generic_name', 'presentation', 'concentration', 'unit']],
  ['vaccines', ['name', 'target_disease', 'presentation', 'dose_unit']],
  ['health_facilities', ['name']],
  ['medication_batches', ['batch_number']],
  ['vaccine_batches', ['batch_number']],
  ['medication_deliveries', ['patient_name']],
  ['vaccine_deliveries', ['patient_name']],
  ['medication_transfers', []],
  ['vaccine_transfers', []],
  ['whatsapp_appointment_doctors', ['doctor_name', 'specialty']],
  ['whatsapp_appointment_requests', ['patient_name']],
  ['transfer_requests', ['patient_name', 'service_name', 'requester_name']],
  ['recurring_transfer_templates', ['patient_name', 'service_name', 'requester_name']],
  ['housekeeping_items', ['name', 'unit']],
  ['housekeeping_movements', ['delivery_signature_name', 'return_signature_name']],
  ['inventory_movements', ['donor_name']],
  ['laboratory_test_catalog', ['name']],
  ['employee_departments', ['name']]
];

function getArg(name, fallback = undefined) {
  const prefix =
    `--${name}=`;

  const match =
    process.argv.find((arg) =>
      arg.startsWith(prefix)
    );

  return match
    ? match.slice(prefix.length)
    : fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function identifier(value) {
  return `\`${String(value).replace(/`/g, '``')}\``;
}

function getConnectionConfig() {
  const url =
    getArg('url') ||
    process.env.DB_URL ||
    process.env.MYSQL_URL ||
    process.env.MYSQL_PUBLIC_URL;

  if (url) {
    const parsed =
      new URL(url);

    return {
      host: parsed.hostname,
      port: Number(parsed.port || 3306),
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: parsed.pathname.replace(/^\//, ''),
      ssl:
        getArg('ssl', process.env.DB_SSL || 'false') === 'true'
          ? { rejectUnauthorized: false }
          : undefined
    };
  }

  return {
    host:
      getArg('host') ||
      process.env.DB_HOST ||
      process.env.MYSQLHOST,
    port:
      Number(
        getArg('port') ||
        process.env.DB_PORT ||
        process.env.MYSQLPORT ||
        3306
      ),
    user:
      getArg('user') ||
      process.env.DB_USER ||
      process.env.MYSQLUSER,
    password:
      getArg('password') ||
      process.env.DB_PASSWORD ||
      process.env.MYSQLPASSWORD ||
      '',
    database:
      getArg('database') ||
      process.env.DB_NAME ||
      process.env.MYSQLDATABASE ||
      process.env.MYSQL_DATABASE,
    ssl:
      getArg('ssl', process.env.DB_SSL || 'false') === 'true'
        ? { rejectUnauthorized: false }
        : undefined
  };
}

async function getExistingColumns(
  connection,
  database
) {
  const [rows] =
    await connection.query(
      `
        SELECT
          table_name,
          column_name
        FROM information_schema.columns
        WHERE table_schema = ?
      `,
      [database]
    );

  const map =
    new Map();

  rows.forEach((row) => {
    const tableName =
      row.TABLE_NAME || row.table_name;

    const columnName =
      row.COLUMN_NAME || row.column_name;

    if (!map.has(tableName)) {
      map.set(tableName, new Set());
    }

    map.get(tableName).add(columnName);
  });

  return map;
}

function buildWhereSql(
  column
) {
  const quoted =
    identifier(column);

  return `${quoted} IS NOT NULL AND ${quoted} <> UPPER(TRIM(${quoted}))`;
}

async function countPending(
  connection,
  table,
  column
) {
  const [rows] =
    await connection.query(
      `
        SELECT COUNT(*) AS total
        FROM ${identifier(table)}
        WHERE ${buildWhereSql(column)}
      `
    );

  return Number(rows[0]?.total || 0);
}

async function updateColumn(
  connection,
  table,
  column
) {
  const quoted =
    identifier(column);

  const [result] =
    await connection.query(
      `
        UPDATE ${identifier(table)}
        SET ${quoted} = UPPER(TRIM(${quoted}))
        WHERE ${buildWhereSql(column)}
      `
    );

  return Number(result.affectedRows || 0);
}

function validateConfig(
  config
) {
  const missing =
    ['host', 'user', 'database'].filter((key) =>
      !config[key]
    );

  if (missing.length > 0) {
    throw new Error(
      `Faltan datos de conexion: ${missing.join(', ')}`
    );
  }
}

async function main() {
  const apply =
    hasFlag('apply');

  const config =
    getConnectionConfig();

  validateConfig(config);

  const connection =
    await mysql.createConnection(config);

  try {
    const existingColumns =
      await getExistingColumns(
        connection,
        config.database
      );

    const operations = [];

    targets.forEach(([table, columns]) => {
      const existing =
        existingColumns.get(table);

      if (!existing) {
        return;
      }

      columns.forEach((column) => {
        if (existing.has(column)) {
          operations.push({
            table,
            column
          });
        }
      });
    });

    if (!apply) {
      console.log('Modo simulacion. No se modifica la base.');
    } else {
      console.log('Modo aplicacion. Se modificara la base.');
      await connection.beginTransaction();
    }

    let total =
      0;

    for (const operation of operations) {
      const pending =
        await countPending(
          connection,
          operation.table,
          operation.column
        );

      if (pending === 0) {
        continue;
      }

      total += pending;

      if (apply) {
        const updated =
          await updateColumn(
            connection,
            operation.table,
            operation.column
          );

        console.log(
          `${operation.table}.${operation.column}: ${updated} actualizados`
        );
      } else {
        console.log(
          `${operation.table}.${operation.column}: ${pending} cambiarian`
        );
      }
    }

    if (apply) {
      await connection.commit();
      console.log(`Listo. Total actualizado: ${total}`);
    } else {
      console.log(`Total que cambiaria: ${total}`);
      console.log('Para aplicar: node scripts/normalize-uppercase-data.js --apply');
    }
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      // Sin transaccion activa en modo simulacion.
    }

    throw error;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
