const fs = require('fs');
const path = require('path');
const readline = require('readline');
const mysql = require('../backend/node_modules/mysql2/promise');

function getArg(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function parseEnv(file) {
  if (!fs.existsSync(file)) {
    return {};
  }

  return fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .reduce((acc, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        return acc;
      }

      const index = trimmed.indexOf('=');
      if (index === -1) {
        return acc;
      }

      const key = trimmed.slice(0, index).trim();
      let value = trimmed.slice(index + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      acc[key] = value;
      return acc;
    }, {});
}

function askHidden(question) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    const rl = readline.createInterface({ input: stdin, output: stdout });

    stdout.write(question);
    stdin.setRawMode?.(true);

    let value = '';

    function onData(buffer) {
      const char = buffer.toString('utf8');

      if (char === '\r' || char === '\n') {
        stdout.write('\n');
        stdin.setRawMode?.(false);
        stdin.off('data', onData);
        rl.close();
        resolve(value);
        return;
      }

      if (char === '\u0003') {
        process.exit(1);
      }

      if (char === '\b' || char === '\u007f') {
        value = value.slice(0, -1);
        return;
      }

      value += char;
    }

    stdin.on('data', onData);
  });
}

function identifier(name) {
  return `\`${String(name).replace(/`/g, '``')}\``;
}

function sqlString(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function escapeValue(connection, value) {
  if (
    value !== null &&
    typeof value === 'object' &&
    !(value instanceof Date) &&
    !Buffer.isBuffer(value)
  ) {
    return connection.escape(JSON.stringify(value));
  }

  return connection.escape(value);
}

function buildConnectionConfig(prefix, env = {}) {
  const url =
    getArg(`${prefix}-url`, env[`${prefix.toUpperCase()}_URL`]);

  if (url) {
    const parsed = new URL(url);

    return {
      host: parsed.hostname,
      port: Number(parsed.port || 3306),
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: parsed.pathname.replace(/^\//, ''),
      ssl: getArg(`${prefix}-ssl`, env[`${prefix.toUpperCase()}_SSL`] || 'false') === 'true'
        ? { rejectUnauthorized: false }
        : undefined
    };
  }

  const host = getArg(`${prefix}-host`, env[`${prefix.toUpperCase()}_HOST`]);
  const port = Number(getArg(`${prefix}-port`, env[`${prefix.toUpperCase()}_PORT`] || 3306));
  const user = getArg(`${prefix}-user`, env[`${prefix.toUpperCase()}_USER`]);
  const database = getArg(`${prefix}-database`, env[`${prefix.toUpperCase()}_DATABASE`]);
  const ssl = getArg(`${prefix}-ssl`, env[`${prefix.toUpperCase()}_SSL`] || 'false') === 'true';

  return {
    host,
    port,
    user,
    database,
    ssl: ssl ? { rejectUnauthorized: false } : undefined
  };
}

function localConfigFromEnv(env) {
  return {
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USER,
    password: env.DB_PASSWORD || '',
    database: env.DB_NAME,
    ssl: env.DB_SSL === 'true'
      ? {
          rejectUnauthorized: env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'
        }
      : undefined
  };
}

function validateConfig(config, label) {
  const missing = ['host', 'user', 'database'].filter((key) => !config[key]);
  if (missing.length) {
    throw new Error(`Faltan datos de ${label}: ${missing.join(', ')}`);
  }
}

async function getTables(connection, database) {
  const [rows] = await connection.query(
    `
      SELECT TABLE_NAME AS name, TABLE_TYPE AS type
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ?
      ORDER BY TABLE_TYPE, TABLE_NAME
    `,
    [database]
  );

  return rows;
}

async function dumpDatabase(connection, database) {
  const tables = await getTables(connection, database);
  const baseTables = tables.filter((table) => table.type === 'BASE TABLE');
  const views = tables.filter((table) => table.type === 'VIEW');
  const lines = [
    `-- Backup generated at ${new Date().toISOString()}`,
    `-- Source database: ${database}`,
    'SET FOREIGN_KEY_CHECKS = 0;',
    ''
  ];

  for (const table of baseTables) {
    const tableName = table.name;
    const [[createRow]] = await connection.query(`SHOW CREATE TABLE ${identifier(tableName)}`);
    const createSql = createRow['Create Table'];

    lines.push(`DROP TABLE IF EXISTS ${identifier(tableName)};`);
    lines.push(`${createSql};`);
    lines.push('');

    const [rows] = await connection.query(`SELECT * FROM ${identifier(tableName)}`);
    if (!rows.length) {
      continue;
    }

    const columns = Object.keys(rows[0]);
    const columnList = columns.map(identifier).join(', ');
    const chunkSize = 200;

    for (let index = 0; index < rows.length; index += chunkSize) {
      const chunk = rows.slice(index, index + chunkSize);
      const values = chunk.map((row) => {
        const rowValues = columns.map((column) => escapeValue(connection, row[column]));
        return `(${rowValues.join(', ')})`;
      });

      lines.push(`INSERT INTO ${identifier(tableName)} (${columnList}) VALUES`);
      lines.push(`${values.join(',\n')};`);
      lines.push('');
    }
  }

  for (const view of views) {
    const viewName = view.name;
    const [[createRow]] = await connection.query(`SHOW CREATE VIEW ${identifier(viewName)}`);
    const createSql = createRow['Create View'];

    lines.push(`DROP VIEW IF EXISTS ${identifier(viewName)};`);
    lines.push(`${createSql};`);
    lines.push('');
  }

  lines.push('SET FOREIGN_KEY_CHECKS = 1;');
  lines.push('');

  return lines.join('\n');
}

async function restoreDatabase(connection, sql) {
  const statements = splitSqlStatements(normalizeSqlForLocal(sql));

  await connection.query('SET FOREIGN_KEY_CHECKS = 0');

  for (const statement of statements) {
    if (statement.trim()) {
      await connection.query(statement);
    }
  }

  await connection.query('SET FOREIGN_KEY_CHECKS = 1');
}

function normalizeSqlForLocal(sql) {
  return sql
    .replace(/\butf8mb4_0900_ai_ci\b/g, 'utf8mb4_unicode_ci')
    .replace(/\butf8mb4_0900_as_ci\b/g, 'utf8mb4_unicode_ci')
    .replace(/\butf8mb4_0900_bin\b/g, 'utf8mb4_bin');
}

function splitSqlStatements(sql) {
  const statements = [];
  let current = '';
  let quote = null;
  let escaped = false;
  let inLineComment = false;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const next = sql[index + 1];

    if (inLineComment) {
      current += char;

      if (char === '\n') {
        inLineComment = false;
      }

      continue;
    }

    if (!quote && char === '-' && next === '-') {
      inLineComment = true;
      current += char;
      continue;
    }

    if (quote) {
      current += char;

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if (char === quote) {
        quote = null;
      }

      continue;
    }

    if (char === '\'' || char === '"' || char === '`') {
      quote = char;
      current += char;
      continue;
    }

    if (char === ';') {
      statements.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    statements.push(current);
  }

  return statements;
}

async function main() {
  const envPath = path.resolve(getArg('local-env', 'backend/.env'));
  const sourceEnvPath = getArg('source-env');
  const sourceEnv = sourceEnvPath
    ? parseEnv(path.resolve(sourceEnvPath))
    : process.env;
  const localEnv = parseEnv(envPath);
  const localConfig = localConfigFromEnv(localEnv);
  const sourceConfig = buildConnectionConfig('source', sourceEnv);
  const backupDir = path.resolve(getArg('backup-dir', 'backups'));
  const restore = hasFlag('restore');
  const yes = hasFlag('yes');
  const checkLocal = hasFlag('check-local');

  validateConfig(localConfig, `local (${envPath})`);

  if (checkLocal) {
    const local = await mysql.createConnection(localConfig);

    try {
      const [[row]] = await local.query('SELECT DATABASE() AS db');
      console.log(`Conexion local OK: ${row.db}`);
      return;
    } finally {
      await local.end();
    }
  }

  validateConfig(sourceConfig, 'produccion');

  sourceConfig.password =
    sourceConfig.password ||
    getArg('source-password') ||
    sourceEnv.SOURCE_PASSWORD ||
    await askHidden('Password de MySQL produccion: ');

  console.log(`Conectando a produccion ${sourceConfig.host}:${sourceConfig.port}/${sourceConfig.database}...`);
  const source = await mysql.createConnection(sourceConfig);

  try {
    const sql = await dumpDatabase(source, sourceConfig.database);
    fs.mkdirSync(backupDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `${sourceConfig.database}-${timestamp}.sql`);
    fs.writeFileSync(backupPath, sql, 'utf8');

    console.log(`Backup creado: ${backupPath}`);

    if (!restore) {
      console.log('Restauracion local omitida. Agrega --restore --yes para restaurar tambien.');
      return;
    }

    if (!yes) {
      throw new Error('Para restaurar en local agrega --yes. Esto puede reemplazar tablas locales.');
    }

    console.log(`Restaurando en local ${localConfig.host}:${localConfig.port}/${localConfig.database}...`);
    const target = await mysql.createConnection({
      ...localConfig,
      multipleStatements: true
    });

    try {
      await restoreDatabase(target, sql);
      console.log('Restauracion local finalizada correctamente.');
    } finally {
      await target.end();
    }
  } finally {
    await source.end();
  }
}

main().catch((error) => {
  console.error('No se pudo sincronizar la base.');
  console.error(error.message);
  process.exit(1);
});
