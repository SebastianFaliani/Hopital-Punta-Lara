const fs = require('fs');
const path = require('path');
const mysql = require('../backend/node_modules/mysql2/promise');
require('../backend/node_modules/dotenv').config({
  path: path.join(__dirname, '..', 'backend', '.env')
});

async function main() {
  const filePath = process.argv[2];

  if (!filePath) {
    throw new Error('Debe indicar el archivo SQL a ejecutar');
  }

  const absolutePath = path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`No existe el archivo: ${absolutePath}`);
  }

  const sql = fs.readFileSync(absolutePath, 'utf8');

  const publicUrl =
    process.env.MYSQL_PUBLIC_URL;

  const publicDatabase =
    publicUrl
      ? new URL(publicUrl)
      : null;

  const connection = await mysql.createConnection({
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
  });

  await connection.query(sql);
  await connection.end();

  console.log(`Aplicado: ${filePath}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
