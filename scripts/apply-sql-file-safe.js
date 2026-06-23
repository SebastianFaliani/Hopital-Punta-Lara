const fs = require('fs');
const path = require('path');
const mysql = require('../backend/node_modules/mysql2/promise');
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
          process.env.MYSQL_DATABASE
  };
}

function splitSqlStatements(sql) {
  const statements = [];
  let current = '';
  let inString = false;
  let quote = '';
  let escaped = false;
  let line = 1;
  let startLine = 1;

  for (let index = 0; index < sql.length; index += 1) {
    const char =
      sql[index];

    const next =
      sql[index + 1];

    if (!inString && char === '-' && next === '-') {
      while (index < sql.length && sql[index] !== '\n') {
        index += 1;
      }
      line += 1;
      continue;
    }

    if (!inString && char === '#') {
      while (index < sql.length && sql[index] !== '\n') {
        index += 1;
      }
      line += 1;
      continue;
    }

    current += char;

    if (char === '\n') {
      line += 1;
    }

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if (char === quote) {
        inString = false;
        quote = '';
      }

      continue;
    }

    if (char === '\'' || char === '"') {
      inString = true;
      quote = char;
      continue;
    }

    if (char === ';') {
      const statement =
        current.trim();

      if (statement) {
        statements.push({
          sql: statement,
          line: startLine
        });
      }

      current = '';
      startLine = line;
    }
  }

  const statement =
    current.trim();

  if (statement) {
    statements.push({
      sql: statement,
      line: startLine
    });
  }

  return statements;
}

function summarizeStatement(statement) {
  const compact =
    statement
      .replace(/\s+/g, ' ')
      .trim();

  return compact.slice(0, 240);
}

async function main() {
  const filePath =
    process.argv[2];

  if (!filePath) {
    throw new Error('Debe indicar el archivo SQL a ejecutar');
  }

  const absolutePath =
    path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`No existe el archivo: ${absolutePath}`);
  }

  const sql =
    fs.readFileSync(absolutePath, 'utf8');

  const statements =
    splitSqlStatements(sql);

  const connection =
    await mysql.createConnection(getConnectionConfig());

  try {
    for (let index = 0; index < statements.length; index += 1) {
      const statement =
        statements[index];

      try {
        await connection.query(statement.sql);
      } catch (error) {
        console.error(`Fallo en sentencia ${index + 1}/${statements.length}, linea aproximada ${statement.line}`);
        console.error(summarizeStatement(statement.sql));
        throw error;
      }
    }
  } finally {
    await connection.end();
  }

  console.log(`Aplicado: ${filePath}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
