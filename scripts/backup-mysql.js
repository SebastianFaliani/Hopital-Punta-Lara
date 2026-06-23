const fs = require('fs');
const path = require('path');
const mysql = require('../backend/node_modules/mysql2');
const mysqlPromise = require('../backend/node_modules/mysql2/promise');
require('../backend/node_modules/dotenv').config({
  path: path.join(__dirname, '..', 'backend', '.env')
});

function getConnectionConfig() {
  const publicUrl =
    process.env.MYSQL_PUBLIC_URL;

  const publicDatabase =
    publicUrl
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

function quoteIdentifier(value) {
  return `\`${String(value).replace(/`/g, '``')}\``;
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

function writeLine(stream, line = '') {
  stream.write(`${line}\n`);
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

  return mysql.escape(value);
}

async function main() {
  const config =
    getConnectionConfig();

  if (!config.host || !config.user || !config.database) {
    throw new Error(
      'Faltan datos de conexion. Define MYSQL_PUBLIC_URL o DB_HOST/DB_USER/DB_PASSWORD/DB_NAME.'
    );
  }

  const outputDir =
    path.resolve(process.cwd(), 'backups');

  fs.mkdirSync(outputDir, {
    recursive: true
  });

  const outputPath =
    path.join(
      outputDir,
      `backup-${config.database}-${timestamp()}.sql`
    );

  const connection =
    await mysqlPromise.createConnection(config);

  const stream =
    fs.createWriteStream(outputPath, {
      encoding: 'utf8'
    });

  try {
    writeLine(stream, '-- Backup Hospital Punta Lara');
    writeLine(stream, `-- Base: ${config.database}`);
    writeLine(stream, `-- Fecha: ${new Date().toISOString()}`);
    writeLine(stream);
    writeLine(stream, 'SET FOREIGN_KEY_CHECKS=0;');
    writeLine(stream, 'SET SQL_MODE="NO_AUTO_VALUE_ON_ZERO";');
    writeLine(stream);

    const [tableRows] =
      await connection.query(
        `
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = ?
            AND table_type = 'BASE TABLE'
          ORDER BY table_name
        `,
        [config.database]
      );

    for (const row of tableRows) {
      const tableName =
        row.TABLE_NAME || row.table_name;

      const quotedTable =
        quoteIdentifier(tableName);

      const [createRows] =
        await connection.query(
          `SHOW CREATE TABLE ${quotedTable}`
        );

      const createSql =
        createRows[0]['Create Table'];

      writeLine(stream, `DROP TABLE IF EXISTS ${quotedTable};`);
      writeLine(stream, `${createSql};`);
      writeLine(stream);
    }

    for (const row of tableRows) {
      const tableName =
        row.TABLE_NAME || row.table_name;

      const quotedTable =
        quoteIdentifier(tableName);

      const [rows] =
        await connection.query(
          `SELECT * FROM ${quotedTable}`
        );

      if (rows.length === 0) {
        continue;
      }

      const columns =
        Object.keys(rows[0]);

      const columnSql =
        columns
          .map(quoteIdentifier)
          .join(', ');

      const chunkSize =
        200;

      for (let index = 0; index < rows.length; index += chunkSize) {
        const chunk =
          rows.slice(index, index + chunkSize);

        const valuesSql =
          chunk
            .map((dataRow) =>
              `(${columns.map((column) => escapeSqlValue(dataRow[column])).join(', ')})`
            )
            .join(',\n');

        writeLine(
          stream,
          `INSERT INTO ${quotedTable} (${columnSql}) VALUES\n${valuesSql};`
        );
        writeLine(stream);
      }
    }

    writeLine(stream, 'SET FOREIGN_KEY_CHECKS=1;');
  } finally {
    await connection.end();
    await new Promise((resolve) => stream.end(resolve));
  }

  console.log(`Backup creado: ${outputPath}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
