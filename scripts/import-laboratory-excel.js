const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
const { execFileSync } = require('child_process');
const mysql = require('../backend/node_modules/mysql2/promise');
require('../backend/node_modules/dotenv').config({
  path: path.join(__dirname, '..', 'backend', '.env')
});

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const clear = args.has('--clear');
const confirmProduction =
  args.has('--confirm-production');
const confirmClear =
  args.has('--confirm-clear');

function getArg(name) {
  const prefix =
    `--${name}=`;

  const value =
    process.argv.find((arg) =>
      arg.startsWith(prefix)
    );

  return value
    ? value.slice(prefix.length)
    : undefined;
}

function askHidden(question) {
  return new Promise((resolve) => {
    const stdin =
      process.stdin;

    const stdout =
      process.stdout;

    const rl =
      readline.createInterface({
        input: stdin,
        output: stdout
      });

    stdout.write(question);
    stdin.setRawMode?.(true);

    let value = '';

    function onData(buffer) {
      const char =
        buffer.toString('utf8');

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
        value =
          value.slice(0, -1);
        return;
      }

      value += char;
    }

    stdin.on('data', onData);
  });
}

const excelArgIndex = process.argv.indexOf('--excel');
const excelPath =
  excelArgIndex >= 0
    ? process.argv[excelArgIndex + 1]
    : (
        getArg('excel') ||
        process.env.LABORATORY_EXCEL_PATH ||
        'C:\\Users\\Sebastian\\Downloads\\LABORATORIO 2025.xlsx'
      );

const dbConfig = {
  host:
    getArg('host') ||
    process.env.DB_HOST,
  port:
    Number(
      getArg('port') ||
      process.env.DB_PORT ||
      3306
    ),
  user:
    getArg('user') ||
    process.env.DB_USER,
  password:
    getArg('password') ||
    process.env.DB_PASSWORD,
  database:
    getArg('database') ||
    process.env.DB_NAME
};

const monthByName = {
  ENERO: 1,
  FEBRERO: 2,
  MARZO: 3,
  ABRIL: 4,
  MAYO: 5,
  JUNIO: 6,
  JULIO: 7,
  AGOSTO: 8,
  SEPTIEMBRE: 9,
  OCTUBRE: 10,
  NOVIEMBRE: 11,
  DICIEMBRE: 12
};

function decodeXml(text) {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function getAttrs(tag) {
  return Object.fromEntries(
    [...tag.matchAll(/([\w:]+)="([^"]*)"/g)]
      .map((match) => [
        match[1],
        match[2]
      ])
  );
}

function normalizeText(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeName(value) {
  return normalizeText(value)
    .toUpperCase();
}

function excelSerialToDate(value) {
  const serial =
    Number(value);

  if (!Number.isFinite(serial) || serial < 30000) {
    return null;
  }

  const date =
    new Date(Date.UTC(1899, 11, 30) + serial * 86400000);

  return date.toISOString().slice(0, 10);
}

function sheetYear(sheetName) {
  const match =
    sheetName.match(/20\d{2}/);

  return match
    ? Number(match[0])
    : 2025;
}

function sheetMonth(sheetName) {
  const upper =
    normalizeText(sheetName)
      .toUpperCase();

  for (const [name, month] of Object.entries(monthByName)) {
    if (upper.includes(name)) {
      return month;
    }
  }

  return null;
}

function parseTextDate(
  value,
  fallbackYear
) {
  const text =
    normalizeText(value);

  const match =
    text.match(/\b(\d{1,2})\s*\/+\s*(\d{1,2})(?:\s*\/+\s*(\d{2,4}))?/);

  if (!match) {
    return null;
  }

  const day =
    Number(match[1]);

  const month =
    Number(match[2]);

  let year =
    match[3]
      ? Number(match[3])
      : fallbackYear;

  if (year < 100) {
    year += 2000;
  }

  if (
    day < 1 ||
    day > 31 ||
    month < 1 ||
    month > 12
  ) {
    return null;
  }

  const date =
    new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function parseStudyDate(
  value,
  sheetName
) {
  const year =
    sheetYear(sheetName);

  const textDate =
    parseTextDate(value, year);

  const parsedDate =
    textDate || excelSerialToDate(value);

  if (!parsedDate) {
    return null;
  }

  const expectedYear =
    sheetYear(sheetName);

  const expectedMonth =
    sheetMonth(sheetName);

  const parsedYear =
    Number(parsedDate.slice(0, 4));

  const parsedMonth =
    Number(parsedDate.slice(5, 7));

  if (
    parsedYear !== expectedYear ||
    (
      expectedMonth &&
      parsedMonth !== expectedMonth
    )
  ) {
    return null;
  }

  return parsedDate;
}

function parsePickupDate(
  value,
  studyDate
) {
  const year =
    studyDate
      ? Number(studyDate.slice(0, 4))
      : 2025;

  return parseTextDate(value, year);
}

function looksLikeHeader(row) {
  const text =
    Object.values(row)
      .join(' ')
      .toLowerCase();

  return (
    text.includes('apellido') ||
    text.includes('nombre') ||
    text.includes('estudio') ||
    text.includes('retira')
  );
}

function isDocument(value) {
  const text =
    normalizeText(value)
      .replace(/[^\d]/g, '');

  return text.length >= 7;
}

function normalizeDocument(value) {
  const text =
    normalizeText(value);

  if (!text) {
    return null;
  }

  if (/e\+/i.test(text)) {
    const number =
      Number(text);

    return Number.isFinite(number)
      ? String(Math.round(number))
      : null;
  }

  const digits =
    text.replace(/[^\d]/g, '');

  return digits || null;
}

function parseSampleFlags(text) {
  const upper =
    normalizeText(text)
      .toUpperCase();

  return {
    hasBlood:
      /EXTR|EXTA|SANGRE/.test(upper),
    hasUrine:
      /ORINA|URO/.test(upper)
  };
}

function containsPickupInfo(text) {
  return /RETIR|RETIRO|RETIRA|ENTREG|ENTREGA/i.test(text || '');
}

function splitRow(row) {
  const b =
    normalizeText(row.B);

  const c =
    normalizeText(row.C);

  if (
    b.includes(' ') &&
    isDocument(c)
  ) {
    const parts =
      b.split(' ');

    return {
      lastName: parts[0],
      firstName: parts.slice(1).join(' '),
      document: normalizeDocument(c),
      sampleText: [row.D, row.E].filter(Boolean).join(' '),
      pickupText: [row.D, row.E].filter(containsPickupInfo).join(' ')
    };
  }

  return {
    lastName: b,
    firstName: c,
    document:
      isDocument(row.D)
        ? normalizeDocument(row.D)
        : null,
    sampleText:
      [
        isDocument(row.D) ? '' : row.D,
        row.E
      ].filter(Boolean).join(' '),
    pickupText:
      [row.D, row.E].filter(containsPickupInfo).join(' ')
  };
}

function parseRecord(
  sheetName,
  row
) {
  if (looksLikeHeader(row)) {
    return null;
  }

  const studyDate =
    parseStudyDate(row.A, sheetName);

  if (!studyDate) {
    return null;
  }

  const parts =
    splitRow(row);

  if (!parts.lastName || !parts.firstName) {
    return null;
  }

  const sample =
    parseSampleFlags(parts.sampleText);

  const sampleWasInferred =
    !sample.hasBlood &&
    !sample.hasUrine;

  if (sampleWasInferred) {
    sample.hasBlood = true;
  }

  const pickupDate =
    parsePickupDate(parts.pickupText, studyDate);

  const delivered =
    containsPickupInfo(parts.pickupText);

  return {
    source_sheet: sheetName,
    source_row: row.n,
    study_date: studyDate,
    patient_last_name: normalizeName(parts.lastName),
    patient_first_name: normalizeName(parts.firstName),
    patient_document: parts.document,
    has_blood_extraction: sample.hasBlood,
    has_urine_sample: sample.hasUrine,
    pickup_date:
      pickupDate ||
      (delivered ? studyDate : null),
    picked_up_by:
      delivered
        ? 'Titular'
        : null,
    pickup_document:
      delivered
        ? normalizeDocument(parts.pickupText)
        : null,
    notes:
      [
        parts.pickupText,
        sampleWasInferred
          ? 'Tipo de muestra no identificado en Excel; importado como extraccion por defecto'
          : '',
        `Importado desde Excel: ${sheetName}, fila ${row.n}`
      ].filter(Boolean).join(' | ')
  };
}

function readWorkbookRows() {
  if (!fs.existsSync(excelPath)) {
    throw new Error(`No se encontro el archivo: ${excelPath}`);
  }

  const tmpDir =
    fs.mkdtempSync(
      path.join(os.tmpdir(), 'hospital-lab-')
    );

  execFileSync(
    'tar',
    [
      '-xf',
      excelPath,
      '-C',
      tmpDir
    ]
  );

  const base =
    path.join(tmpDir, 'xl');

  const sharedXml =
    fs.readFileSync(
      path.join(base, 'sharedStrings.xml'),
      'utf8'
    );

  const sharedStrings =
    [...sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)]
      .map((match) =>
        decodeXml(match[1]).trim()
      );

  const workbookXml =
    fs.readFileSync(
      path.join(base, 'workbook.xml'),
      'utf8'
    );

  const relsXml =
    fs.readFileSync(
      path.join(base, '_rels', 'workbook.xml.rels'),
      'utf8'
    );

  const sheets =
    [...workbookXml.matchAll(/<sheet\s+([^>]+?)\/>/g)]
      .map((match) =>
        getAttrs(match[0])
      );

  const rels =
    Object.fromEntries(
      [...relsXml.matchAll(/<Relationship\s+([^>]+?)\/>/g)]
        .map((match) =>
          getAttrs(match[0])
        )
        .filter((attrs) =>
          attrs.Type.includes('/worksheet')
        )
        .map((attrs) => [
          attrs.Id,
          attrs.Target
        ])
    );

  function cellValue(
    attrs,
    body
  ) {
    const valueMatch =
      body.match(/<v>([\s\S]*?)<\/v>/);

    const inlineMatch =
      body.match(/<t[^>]*>([\s\S]*?)<\/t>/);

    if (
      attrs.includes('t="s"') &&
      valueMatch
    ) {
      return sharedStrings[Number(valueMatch[1])] || '';
    }

    if (inlineMatch) {
      return decodeXml(inlineMatch[1]);
    }

    return valueMatch
      ? valueMatch[1]
      : '';
  }

  const rows = [];

  for (const sheet of sheets) {
    const target =
      rels[sheet['r:id']];

    if (!target) {
      continue;
    }

    const worksheetXml =
      fs.readFileSync(
        path.join(base, target),
        'utf8'
      );

    for (const rowMatch of worksheetXml.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
      const row = {
        n: Number(rowMatch[1])
      };

      for (const cellMatch of rowMatch[2].matchAll(/<c[^>]*r="([A-Z]+)(\d+)"([^>]*)>([\s\S]*?)<\/c>/g)) {
        const value =
          normalizeText(
            cellValue(
              cellMatch[3],
              cellMatch[4]
            )
          );

        if (value) {
          row[cellMatch[1]] = value;
        }
      }

      if (Object.keys(row).length > 1) {
        rows.push({
          sheet: sheet.name,
          row
        });
      }
    }
  }

  return rows;
}

async function importRecords(records) {
  if (
    !dbConfig.host ||
    !dbConfig.user ||
    !dbConfig.database
  ) {
    throw new Error(
      'Faltan datos de conexion a MySQL. Usar --host, --user y --database o configurar backend/.env.'
    );
  }

  const isProductionLike =
    dbConfig.host !== 'localhost' &&
    dbConfig.host !== '127.0.0.1';

  if (
    isProductionLike &&
    !confirmProduction
  ) {
    throw new Error(
      'Para importar fuera de local agrega --confirm-production.'
    );
  }

  if (
    clear &&
    !confirmClear
  ) {
    throw new Error(
      'Para limpiar la tabla antes de importar agrega --confirm-clear.'
    );
  }

  if (!dbConfig.password) {
    dbConfig.password =
      await askHidden('Password de MySQL: ');
  }

  const connection =
    await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      database: dbConfig.database
    });

  try {
    if (clear) {
      const [countRows] =
        await connection.query(
          'SELECT COUNT(*) AS total FROM laboratory_records'
        );

      console.log(
        `Se limpiaran ${countRows[0]?.total || 0} estudios existentes.`
      );

      await connection.query(
        'DELETE FROM laboratory_records'
      );
    }

    for (const record of records) {
      await connection.query(
        `
          INSERT INTO laboratory_records (
            study_date,
            patient_last_name,
            patient_first_name,
            patient_document,
            has_blood_extraction,
            has_urine_sample,
            pickup_date,
            picked_up_by,
            pickup_document,
            notes
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          record.study_date,
          record.patient_last_name,
          record.patient_first_name,
          record.patient_document,
          record.has_blood_extraction,
          record.has_urine_sample,
          record.pickup_date,
          record.picked_up_by,
          record.pickup_document,
          record.notes
        ]
      );
    }
  } finally {
    await connection.end();
  }
}

async function main() {
  const rawRows =
    readWorkbookRows();

  const records =
    rawRows
      .map(({ sheet, row }) =>
        parseRecord(sheet, row)
      )
      .filter(Boolean);

  const bySheet =
    records.reduce(
      (acc, record) => {
        acc[record.source_sheet] =
          (acc[record.source_sheet] || 0) + 1;

        return acc;
      },
      {}
    );

  const summary = {
    archivo: excelPath,
    modo: apply ? 'IMPORTACION' : 'VISTA PREVIA',
    destino: apply
      ? `${dbConfig.user || '?'}@${dbConfig.host || '?'}:${dbConfig.port}/${dbConfig.database || '?'}`
      : 'sin conexion a base',
    limpia_tabla: apply && clear,
    filas_excel: rawRows.length,
    estudios_detectados: records.length,
    filas_no_importadas: rawRows.length - records.length,
    por_hoja: bySheet
  };

  console.log(JSON.stringify(summary, null, 2));

  if (!apply) {
    console.log(
      '\nVista previa solamente. Para importar local: node scripts/import-laboratory-excel.js --apply --clear --confirm-clear'
    );
    console.log(
      'Para Railway: node scripts/import-laboratory-excel.js --apply --confirm-production --host=HOST --port=PUERTO --user=USUARIO --database=BASE --excel=\"RUTA.xlsx\"'
    );
    return;
  }

  await importRecords(records);

  console.log(
    `\nImportacion finalizada: ${records.length} estudios cargados.`
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
