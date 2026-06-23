const fs = require('fs');
const path = require('path');
const mysql = require('../backend/node_modules/mysql2');

function splitTuples(valuesSql) {
  const tuples = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < valuesSql.length; index += 1) {
    const char = valuesSql[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if (char === '\'') {
        inString = false;
      }

      continue;
    }

    if (char === '\'') {
      inString = true;
      continue;
    }

    if (char === '(') {
      if (depth === 0) {
        start = index + 1;
      }
      depth += 1;
      continue;
    }

    if (char === ')') {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        tuples.push(valuesSql.slice(start, index));
        start = -1;
      }
    }
  }

  return tuples;
}

function splitSqlStatements(sql) {
  const statements = [];
  let current = '';
  let inString = false;
  let escaped = false;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];

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

      if (char === '\'') {
        inString = false;
      }

      continue;
    }

    if (char === '\'') {
      inString = true;
      continue;
    }

    if (char === ';') {
      statements.push(current.trim());
      current = '';
    }
  }

  if (current.trim()) {
    statements.push(current.trim());
  }

  return statements;
}

function splitFields(tuple) {
  const fields = [];
  let current = '';
  let inString = false;
  let escaped = false;

  for (let index = 0; index < tuple.length; index += 1) {
    const char = tuple[index];

    if (inString) {
      current += char;

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if (char === '\'') {
        inString = false;
      }

      continue;
    }

    if (char === '\'') {
      inString = true;
      current += char;
      continue;
    }

    if (char === ',') {
      fields.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    fields.push(current.trim());
  }

  return fields;
}

function parseSqlValue(value) {
  const trimmed = value.trim();

  if (/^NULL$/i.test(trimmed)) {
    return null;
  }

  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }

  if (
    trimmed.startsWith('\'') &&
    trimmed.endsWith('\'')
  ) {
    return trimmed
      .slice(1, -1)
      .replace(/\\'/g, '\'')
      .replace(/\\\\/g, '\\');
  }

  return trimmed;
}

function main() {
  const inputFile = process.argv[2];

  if (!inputFile) {
    throw new Error(
      'Uso: node scripts/extract-audit-logs-salvage.js backups/archivo.sql'
    );
  }

  const inputPath = path.resolve(process.cwd(), inputFile);

  if (!fs.existsSync(inputPath)) {
    throw new Error(`No existe el archivo: ${inputPath}`);
  }

  const sql = fs.readFileSync(inputPath, 'utf8');
  const statements = splitSqlStatements(sql);
  const auditStatements = statements.filter((statement) =>
    statement.startsWith('INSERT INTO `audit_logs`')
  );

  if (auditStatements.length === 0) {
    throw new Error('No se encontro INSERT de audit_logs en el backup');
  }

  const tuples = auditStatements.flatMap((statement) => {
    const valuesIndex = statement.indexOf(' VALUES\n');

    if (valuesIndex < 0) {
      return [];
    }

    return splitTuples(statement.slice(valuesIndex + 8));
  });
  const rows = [];

  for (const tuple of tuples) {
    const fields = splitFields(tuple);

    if (fields.length < 14) {
      continue;
    }

    const firstFields = fields.slice(0, 9);
    const lastFields = fields.slice(-3);

    rows.push([
      ...firstFields.map(parseSqlValue),
      null,
      null,
      ...lastFields.map(parseSqlValue)
    ]);
  }

  const outputPath = path.join(
    path.dirname(inputPath),
    `${path.parse(inputPath).name}-solo-audit_logs-recuperado.sql`
  );

  const columns = [
    'id',
    'user_id',
    'username',
    'user_role',
    'module',
    'action',
    'entity_type',
    'entity_id',
    'description',
    'old_data',
    'new_data',
    'ip_address',
    'user_agent',
    'created_at'
  ];

  const lines = [
    'SET FOREIGN_KEY_CHECKS=0;',
    'DELETE FROM `audit_logs`;'
  ];

  if (rows.length > 0) {
    const values = rows
      .map((row) =>
        `(${row.map((value) => mysql.escape(value)).join(', ')})`
      )
      .join(',\n');

    lines.push(
      `INSERT INTO \`audit_logs\` (${columns.map((column) => `\`${column}\``).join(', ')}) VALUES\n${values};`
    );
  }

  lines.push('SET FOREIGN_KEY_CHECKS=1;');

  fs.writeFileSync(outputPath, `${lines.join('\n\n')}\n`, 'utf8');

  console.log(`Registros recuperados: ${rows.length}`);
  console.log(`Archivo creado: ${outputPath}`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
