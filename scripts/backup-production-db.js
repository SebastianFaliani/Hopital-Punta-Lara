const fs = require('fs');
const path = require('path');
const mysql = require('../backend/node_modules/mysql2');
const mysqlPromise = require('../backend/node_modules/mysql2/promise');
require('../backend/node_modules/dotenv').config({
  path: path.join(__dirname, '..', 'backend', '.env')
});

function getPublicDatabaseConfig() {
  const publicUrl =
    process.env.MYSQL_PUBLIC_URL;

  if (!publicUrl) {
    throw new Error(
      'Falta MYSQL_PUBLIC_URL. Usa la URL publica de MySQL de produccion.'
    );
  }

  const parsed =
    new URL(publicUrl);

  return {
    host: parsed.hostname,
    port: Number(parsed.port || 3306),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, ''),
    multipleStatements: true
  };
}

function quoteIdentifier(value) {
  return `\`${String(value).replace(/`/g, '``')}\``;
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function timestamp() {
  const now =
    new Date();

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

function resolveBackupDir() {
  return path.resolve(
    process.env.PRODUCTION_BACKUP_DIR ||
      path.join(
        'C:',
        'Backups',
        'HospitalPuntaLara',
        'produccion-db'
      )
  );
}

function pruneOldBackups(outputDir) {
  const retentionDays =
    Number(process.env.PRODUCTION_BACKUP_RETENTION_DAYS || 30);

  if (!Number.isFinite(retentionDays) || retentionDays <= 0) {
    return;
  }

  const cutoff =
    Date.now() - retentionDays * 24 * 60 * 60 * 1000;

  for (const item of fs.readdirSync(outputDir)) {
    if (!item.endsWith('.sql')) {
      continue;
    }

    const itemPath =
      path.join(outputDir, item);

    const stats =
      fs.statSync(itemPath);

    if (stats.mtimeMs < cutoff) {
      fs.rmSync(itemPath, {
        force: true
      });
    }
  }
}

async function main() {
  const config =
    getPublicDatabaseConfig();

  const outputDir =
    resolveBackupDir();

  fs.mkdirSync(outputDir, {
    recursive: true
  });

  const outputPath =
    path.join(
      outputDir,
      `backup-produccion-${config.database}-${timestamp()}.sql`
    );

  const connection =
    await mysqlPromise.createConnection(config);

  const stream =
    fs.createWriteStream(outputPath, {
      encoding: 'utf8'
    });

  try {
    writeLine(stream, '-- Backup produccion Hospital Punta Lara');
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

      writeLine(stream, `DROP TABLE IF EXISTS ${quotedTable};`);
      writeLine(stream, `${createRows[0]['Create Table']};`);
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

      if (!rows.length) {
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

  pruneOldBackups(outputDir);

  console.log(`Backup creado: ${outputPath}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
