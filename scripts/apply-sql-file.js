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

  const connection = await mysql.createConnection({
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
  });

  await connection.query(sql);
  await connection.end();

  console.log(`Aplicado: ${filePath}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
