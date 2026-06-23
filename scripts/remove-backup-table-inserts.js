const fs = require('fs');
const path = require('path');

function splitSqlStatements(sql) {
  const statements = [];
  let current = '';
  let inString = false;
  let quote = '';
  let escaped = false;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const next = sql[index + 1];

    if (!inString && char === '-' && next === '-') {
      while (index < sql.length && sql[index] !== '\n') {
        current += sql[index];
        index += 1;
      }
      if (index < sql.length) {
        current += sql[index];
      }
      continue;
    }

    current += char;

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
      statements.push(current);
      current = '';
    }
  }

  if (current.trim()) {
    statements.push(current);
  }

  return statements;
}

function main() {
  const inputFile = process.argv[2];
  const tableName = process.argv[3];

  if (!inputFile || !tableName) {
    throw new Error(
      'Uso: node scripts/remove-backup-table-inserts.js archivo.sql tabla'
    );
  }

  const inputPath = path.resolve(process.cwd(), inputFile);

  if (!fs.existsSync(inputPath)) {
    throw new Error(`No existe el archivo: ${inputPath}`);
  }

  const parsed = path.parse(inputPath);
  const outputPath = path.join(
    parsed.dir,
    `${parsed.name}-sin-${tableName}${parsed.ext}`
  );

  const sql = fs.readFileSync(inputPath, 'utf8');
  const statements = splitSqlStatements(sql);
  const insertPrefix = `INSERT INTO \`${tableName}\``;

  const filtered = statements.filter((statement) =>
    !statement.trimStart().startsWith(insertPrefix)
  );

  fs.writeFileSync(outputPath, filtered.join('\n'), 'utf8');

  console.log(`Archivo creado: ${outputPath}`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
