const fs = require('fs');
const path = require('path');
const readline = require('readline');
const mysql = require('../backend/node_modules/mysql2/promise');

function getArg(name) {
  const prefix = `--${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : undefined;
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

async function main() {
  const host = getArg('host');
  const port = Number(getArg('port') || 3306);
  const user = getArg('user');
  const database = getArg('database');
  const file = getArg('file');

  if (!host || !user || !database || !file) {
    console.error(
      'Uso: node scripts/import-railway-mysql.js --host=HOST --port=PUERTO --user=USUARIO --database=BASE --file=ARCHIVO.sql'
    );
    process.exit(1);
  }

  const sqlPath = path.resolve(file);

  if (!fs.existsSync(sqlPath)) {
    console.error(`No se encontro el archivo SQL: ${sqlPath}`);
    process.exit(1);
  }

  const password = await askHidden('Password de MySQL Railway: ');
  const sql = fs
    .readFileSync(sqlPath, 'utf8')
    .replace(/^CREATE DATABASE\b.*?;\s*$/gim, '')
    .replace(/^USE\s+`?[\w-]+`?\s*;\s*$/gim, '');

  const connection = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    multipleStatements: true
  });

  try {
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    await connection.query(sql);
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('Importacion finalizada correctamente.');
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error('No se pudo importar el SQL.');
  console.error(error.message);
  process.exit(1);
});
