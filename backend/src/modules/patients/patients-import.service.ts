import { Buffer } from 'buffer';
import { pool } from '../../config/database';

const ENDOFCHAIN = 0xfffffffe;
const FREESECT = 0xffffffff;
const HEADER_ALIASES: Record<string, string> = {
  'apellidos paciente': 'last_name',
  'nombres paciente': 'first_name',
  'tipo documento': 'document_type',
  'nro documento': 'document_number',
  telefono: 'phone',
  'teléfono': 'phone',
  mail: 'email',
  'obra social/prepaga': 'health_insurance',
  'nro de afiliado': 'affiliate_number',
  'fecha de nacimiento': 'birth_date',
  domicilio: 'address'
};

type CellValue = string | number | Date | null;

type ImportPatient = {
  row: number;
  document_type: string | null;
  document_number: string;
  last_name: string;
  first_name: string;
  phone: string | null;
  email: string | null;
  health_insurance: string | null;
  affiliate_number: string | null;
  birth_date: string | null;
  address: string | null;
};

type ExistingPatient = {
  id: number;
  document_type: string | null;
  document_number: string;
  last_name: string;
  first_name: string;
  phone: string | null;
  email: string | null;
  health_insurance: string | null;
  affiliate_number: string | null;
  birth_date: string | null;
  address: string | null;
};

type PreviewRow = ImportPatient & {
  action: 'crear' | 'actualizar' | 'sin_cambios' | 'omitir';
  patient_id: number | null;
  completed_fields: string[];
  reason?: string;
};

function sectorOffset(sector: number, sectorSize: number) {
  return 512 + sector * sectorSize;
}

function readUInt32(buffer: Buffer, offset: number) {
  return buffer.readUInt32LE(offset);
}

function readDirectoryName(entry: Buffer) {
  const length = entry.readUInt16LE(64);
  if (length <= 2) {
    return '';
  }

  return entry
    .subarray(0, length - 2)
    .toString('utf16le');
}

function buildChain(start: number, fat: number[]) {
  const sectors: number[] = [];
  let current = start;
  const seen = new Set<number>();

  while (
    current !== ENDOFCHAIN &&
    current !== FREESECT &&
    current >= 0 &&
    current < fat.length &&
    !seen.has(current)
  ) {
    seen.add(current);
    sectors.push(current);
    current = fat[current];
  }

  return sectors;
}

function readSectorChain(
  file: Buffer,
  start: number,
  size: number,
  fat: number[],
  sectorSize: number
) {
  const chunks =
    buildChain(start, fat).map((sector) =>
      file.subarray(
        sectorOffset(sector, sectorSize),
        sectorOffset(sector, sectorSize) + sectorSize
      )
    );

  return Buffer.concat(chunks).subarray(0, size);
}

function extractWorkbookStream(file: Buffer) {
  if (
    file.length < 512 ||
    file.readUInt32LE(0) !== 0xe011cfd0
  ) {
    throw new Error('El archivo no parece ser un XLS valido');
  }

  const sectorSize =
    1 << file.readUInt16LE(30);

  const miniSectorSize =
    1 << file.readUInt16LE(32);

  const firstDirSector =
    file.readInt32LE(48);

  const miniCutoff =
    file.readUInt32LE(56);

  const firstMiniFatSector =
    file.readInt32LE(60);

  const difat: number[] = [];

  for (let offset = 76; offset < 512; offset += 4) {
    const sector = readUInt32(file, offset);
    if (sector !== FREESECT) {
      difat.push(sector);
    }
  }

  const fat: number[] = [];

  for (const fatSector of difat) {
    const offset =
      sectorOffset(fatSector, sectorSize);

    for (let index = 0; index < sectorSize; index += 4) {
      fat.push(readUInt32(file, offset + index));
    }
  }

  const dirStream =
    readSectorChain(
      file,
      firstDirSector,
      Number.MAX_SAFE_INTEGER,
      fat,
      sectorSize
    );

  const entries: Array<{
    name: string;
    type: number;
    start: number;
    size: number;
  }> = [];

  for (let offset = 0; offset + 128 <= dirStream.length; offset += 128) {
    const entry =
      dirStream.subarray(offset, offset + 128);

    const name =
      readDirectoryName(entry);

    if (!name) {
      continue;
    }

    entries.push({
      name,
      type: entry.readUInt8(66),
      start: entry.readInt32LE(116),
      size: Number(entry.readBigUInt64LE(120))
    });
  }

  const workbook =
    entries.find((entry) =>
      ['Workbook', 'Book'].includes(entry.name)
    );

  if (!workbook) {
    throw new Error('No se encontro la hoja de calculo dentro del XLS');
  }

  if (workbook.size >= miniCutoff) {
    return readSectorChain(
      file,
      workbook.start,
      workbook.size,
      fat,
      sectorSize
    );
  }

  const root =
    entries.find((entry) => entry.type === 5);

  if (!root) {
    throw new Error('No se encontro el almacenamiento raiz del XLS');
  }

  const miniStream =
    readSectorChain(
      file,
      root.start,
      root.size,
      fat,
      sectorSize
    );

  const miniFatStream =
    readSectorChain(
      file,
      firstMiniFatSector,
      Number.MAX_SAFE_INTEGER,
      fat,
      sectorSize
    );

  const miniFat: number[] = [];

  for (let offset = 0; offset + 4 <= miniFatStream.length; offset += 4) {
    miniFat.push(readUInt32(miniFatStream, offset));
  }

  const chunks =
    buildChain(workbook.start, miniFat).map((sector) =>
      miniStream.subarray(
        sector * miniSectorSize,
        sector * miniSectorSize + miniSectorSize
      )
    );

  return Buffer.concat(chunks).subarray(0, workbook.size);
}

function decodeString(buffer: Buffer, offset: number) {
  const length =
    buffer.readUInt16LE(offset);

  const flags =
    buffer.readUInt8(offset + 2);

  let cursor = offset + 3;
  const hasRichText =
    Boolean(flags & 0x08);
  const hasAsian =
    Boolean(flags & 0x04);
  const isUtf16 =
    Boolean(flags & 0x01);

  if (hasRichText) {
    cursor += 2;
  }

  if (hasAsian) {
    cursor += 4;
  }

  const byteLength =
    length * (isUtf16 ? 2 : 1);

  const text =
    isUtf16
      ? buffer
        .subarray(cursor, cursor + byteLength)
        .toString('utf16le')
      : buffer
        .subarray(cursor, cursor + byteLength)
        .toString('latin1');

  return {
    text,
    nextOffset: cursor + byteLength
  };
}

class SstReader {
  private chunkIndex = 0;
  private offset = 0;

  constructor(
    private readonly chunks: Buffer[]
  ) {}

  private current() {
    return this.chunks[this.chunkIndex];
  }

  private moveToNextChunk() {
    this.chunkIndex += 1;
    this.offset = 0;
  }

  private ensureAvailable() {
    while (
      this.current() &&
      this.offset >= this.current().length
    ) {
      this.moveToNextChunk();
    }

    if (!this.current()) {
      throw new Error('SST incompleto');
    }
  }

  readUInt8() {
    this.ensureAvailable();
    const value =
      this.current().readUInt8(this.offset);

    this.offset += 1;
    return value;
  }

  readUInt16LE() {
    const low =
      this.readUInt8();

    const high =
      this.readUInt8();

    return low | (high << 8);
  }

  readUInt32LE() {
    const b0 =
      this.readUInt8();

    const b1 =
      this.readUInt8();

    const b2 =
      this.readUInt8();

    const b3 =
      this.readUInt8();

    return b0 |
      (b1 << 8) |
      (b2 << 16) |
      (b3 << 24);
  }

  skip(bytes: number) {
    for (let index = 0; index < bytes; index += 1) {
      this.readUInt8();
    }
  }

  readStringChars(
    length: number,
    isUtf16: boolean
  ) {
    let unicode =
      isUtf16;

    let text = '';

    for (let index = 0; index < length; index += 1) {
      if (
        this.current() &&
        this.offset >= this.current().length
      ) {
        this.moveToNextChunk();
        const flags =
          this.readUInt8();
        unicode = Boolean(flags & 0x01);
      }

      if (unicode) {
        const code =
          this.readUInt16LE();

        text += String.fromCharCode(code);
      } else {
        text += String.fromCharCode(
          this.readUInt8()
        );
      }
    }

    return text;
  }
}

function parseSstChunks(chunks: Buffer[]) {
  const strings: string[] = [];

  if (!chunks.length) {
    return strings;
  }

  const reader =
    new SstReader(chunks);

  reader.readUInt32LE();

  const count =
    reader.readUInt32LE();

  for (let index = 0; index < count; index += 1) {
    const length =
      reader.readUInt16LE();

    const flags =
      reader.readUInt8();

    const hasRichText =
      Boolean(flags & 0x08);

    const hasAsian =
      Boolean(flags & 0x04);

    const isUtf16 =
      Boolean(flags & 0x01);

    const richTextRuns =
      hasRichText
        ? reader.readUInt16LE()
        : 0;

    const asianSize =
      hasAsian
        ? reader.readUInt32LE()
        : 0;

    strings.push(
      reader.readStringChars(
        length,
        isUtf16
      )
    );

    if (hasRichText) {
      reader.skip(richTextRuns * 4);
    }

    if (hasAsian) {
      reader.skip(asianSize);
    }
  }

  return strings;
}

function decodeRk(value: number) {
  const isMultiplied =
    Boolean(value & 0x01);

  const isInteger =
    Boolean(value & 0x02);

  let numberValue: number;

  if (isInteger) {
    numberValue = value >> 2;
  } else {
    const buffer = Buffer.alloc(8);
    buffer.writeUInt32LE(value & 0xfffffffc, 4);
    numberValue = buffer.readDoubleLE(0);
  }

  return isMultiplied
    ? numberValue / 100
    : numberValue;
}

function excelDateToIso(value: number) {
  if (!Number.isFinite(value) || value < 1) {
    return null;
  }

  const epoch =
    Date.UTC(1899, 11, 30);

  const date =
    new Date(epoch + Math.round(value) * 86400000);

  return date.toISOString().slice(0, 10);
}

function parseWorkbookRows(workbook: Buffer) {
  const rows = new Map<number, Map<number, CellValue>>();
  const formats = new Map<number, string>();
  const xfFormats: number[] = [];
  let sharedStrings: string[] = [];

  function setCell(row: number, col: number, value: CellValue) {
    if (!rows.has(row)) {
      rows.set(row, new Map());
    }

    rows.get(row)?.set(col, value);
  }

  function isDateFormat(xf: number) {
    const formatIndex =
      xfFormats[xf];

    if (
      [
        14,
        15,
        16,
        17,
        22,
        45,
        46,
        47
      ].includes(formatIndex)
    ) {
      return true;
    }

    return /[dmy]/i.test(
      formats.get(formatIndex) || ''
    );
  }

  let offset = 0;

  while (offset + 4 <= workbook.length) {
    const type =
      workbook.readUInt16LE(offset);

    const length =
      workbook.readUInt16LE(offset + 2);

    const dataStart =
      offset + 4;

    const dataEnd =
      dataStart + length;

    if (dataEnd > workbook.length) {
      break;
    }

    let data =
      workbook.subarray(dataStart, dataEnd);

    if (type === 0x00fc) {
      let next =
        dataEnd;

      const chunks = [data];

      while (
        next + 4 <= workbook.length &&
        workbook.readUInt16LE(next) === 0x003c
      ) {
        const continueLength =
          workbook.readUInt16LE(next + 2);

        chunks.push(
          workbook.subarray(
            next + 4,
            next + 4 + continueLength
          )
        );

        next += 4 + continueLength;
      }

      sharedStrings =
        parseSstChunks(chunks);

      offset = next;
      continue;
    }

    if (type === 0x041e && data.length >= 3) {
      const formatIndex =
        data.readUInt16LE(0);

      const parsed =
        decodeString(data, 2);

      formats.set(
        formatIndex,
        parsed.text
      );
    }

    if (type === 0x00e0 && data.length >= 4) {
      xfFormats.push(
        data.readUInt16LE(2)
      );
    }

    if (type === 0x00fd && data.length >= 10) {
      const row =
        data.readUInt16LE(0);

      const col =
        data.readUInt16LE(2);

      const index =
        data.readUInt32LE(6);

      setCell(
        row,
        col,
        sharedStrings[index] || ''
      );
    }

    if (type === 0x0204 && data.length >= 8) {
      const row =
        data.readUInt16LE(0);

      const col =
        data.readUInt16LE(2);

      const parsed =
        decodeString(data, 6);

      setCell(row, col, parsed.text);
    }

    if (type === 0x0203 && data.length >= 14) {
      const row =
        data.readUInt16LE(0);

      const col =
        data.readUInt16LE(2);

      const xf =
        data.readUInt16LE(4);

      const value =
        data.readDoubleLE(6);

      setCell(
        row,
        col,
        isDateFormat(xf)
          ? excelDateToIso(value)
          : value
      );
    }

    if (type === 0x027e && data.length >= 10) {
      const row =
        data.readUInt16LE(0);

      const col =
        data.readUInt16LE(2);

      const xf =
        data.readUInt16LE(4);

      const value =
        decodeRk(data.readUInt32LE(6));

      setCell(
        row,
        col,
        isDateFormat(xf)
          ? excelDateToIso(value)
          : value
      );
    }

    if (type === 0x00bd && data.length >= 6) {
      const row =
        data.readUInt16LE(0);

      let col =
        data.readUInt16LE(2);

      const lastCol =
        data.readUInt16LE(data.length - 2);

      let cursor = 4;

      while (
        col <= lastCol &&
        cursor + 6 <= data.length - 2
      ) {
        const xf =
          data.readUInt16LE(cursor);

        const value =
          decodeRk(data.readUInt32LE(cursor + 2));

        setCell(
          row,
          col,
          isDateFormat(xf)
            ? excelDateToIso(value)
            : value
        );

        cursor += 6;
        col += 1;
      }
    }

    offset = dataEnd;
  }

  return rows;
}

function normalizeHeader(value: CellValue) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('es-AR')
    .replace(/\s+/g, ' ');
}

function normalizeDocument(value: CellValue) {
  return String(value || '')
    .replace(/\D/g, '');
}

function normalizeText(value: CellValue) {
  const text =
    String(value || '')
      .trim()
      .replace(/\s+/g, ' ');

  return text
    ? text.toLocaleUpperCase('es-AR')
    : null;
}

function normalizeEmail(value: CellValue) {
  const text =
    String(value || '')
      .trim()
      .toLocaleLowerCase('es-AR');

  return text && text.includes('@')
    ? text
    : null;
}

export function normalizePatientPhone(value: CellValue) {
  let digits =
    String(value || '')
      .replace(/\D/g, '');

  if (!digits) {
    return null;
  }

  if (digits.startsWith('549')) {
    digits = digits.slice(3);
  } else if (digits.startsWith('54')) {
    digits = digits.slice(2);
  }

  digits = digits.replace(/^0+/, '');

  if (digits.length > 10 && digits.slice(3, 5) === '15') {
    digits = `${digits.slice(0, 3)}${digits.slice(5)}`;
  }

  if (digits.length > 10 && digits.slice(2, 4) === '15') {
    digits = `${digits.slice(0, 2)}${digits.slice(4)}`;
  }

  return digits || null;
}

function normalizeDate(value: CellValue) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === 'number') {
    return excelDateToIso(value);
  }

  const text =
    String(value).trim();

  const iso =
    text.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (iso) {
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }

  const latin =
    text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);

  if (!latin) {
    return null;
  }

  const year =
    latin[3].length === 2
      ? `20${latin[3]}`
      : latin[3];

  return `${year}-${latin[2].padStart(2, '0')}-${latin[1].padStart(2, '0')}`;
}

export function parseNominalTurnsPatients(file: Buffer) {
  const workbook =
    extractWorkbookStream(file);

  const rows =
    parseWorkbookRows(workbook);

  let headerRow: number | null = null;
  const headerMap = new Map<number, string>();

  for (const [rowIndex, row] of rows) {
    const mapped = new Map<number, string>();

    for (const [col, value] of row) {
      const key =
        HEADER_ALIASES[normalizeHeader(value)];

      if (key) {
        mapped.set(col, key);
      }
    }

    if (
      mapped.size >= 6 &&
      [...mapped.values()].includes('document_number') &&
      [...mapped.values()].includes('last_name') &&
      [...mapped.values()].includes('first_name')
    ) {
      headerRow = rowIndex;
      mapped.forEach((value, key) =>
        headerMap.set(key, value)
      );
      break;
    }
  }

  if (headerRow === null) {
    throw new Error('No se encontraron las columnas esperadas en el XLS');
  }

  const patients: ImportPatient[] = [];
  const invalidRows: PreviewRow[] = [];
  const seenDocuments = new Set<string>();

  for (const [rowIndex, row] of [...rows.entries()].sort((a, b) => a[0] - b[0])) {
    if (rowIndex <= headerRow) {
      continue;
    }

    const data: Record<string, CellValue> = {};

    for (const [col, key] of headerMap) {
      data[key] = row.get(col) ?? null;
    }

    const documentNumber =
      normalizeDocument(data.document_number);

    const patient: ImportPatient = {
      row: rowIndex + 1,
      document_type:
        normalizeText(data.document_type),
      document_number:
        documentNumber,
      last_name:
        normalizeText(data.last_name) || '',
      first_name:
        normalizeText(data.first_name) || '',
      phone:
        normalizePatientPhone(data.phone),
      email:
        normalizeEmail(data.email),
      health_insurance:
        normalizeText(data.health_insurance),
      affiliate_number:
        normalizeText(data.affiliate_number),
      birth_date:
        normalizeDate(data.birth_date),
      address:
        normalizeText(data.address)
    };

    const hasAnyValue =
      [
        patient.document_type,
        patient.document_number,
        patient.last_name,
        patient.first_name,
        patient.phone,
        patient.email,
        patient.health_insurance,
        patient.affiliate_number,
        patient.birth_date,
        patient.address
      ].some((value) =>
        value !== null &&
        value !== ''
      );

    if (!hasAnyValue) {
      continue;
    }

    if (!patient.document_number) {
      invalidRows.push({
        ...patient,
        action: 'omitir',
        patient_id: null,
        completed_fields: [],
        reason: 'Sin DNI'
      });
      continue;
    }

    if (!patient.last_name || !patient.first_name) {
      invalidRows.push({
        ...patient,
        action: 'omitir',
        patient_id: null,
        completed_fields: [],
        reason: 'Sin apellido o nombre'
      });
      continue;
    }

    if (seenDocuments.has(patient.document_number)) {
      continue;
    }

    seenDocuments.add(patient.document_number);
    patients.push(patient);
  }

  return {
    patients,
    invalidRows
  };
}

function isMissing(value: unknown) {
  return value === null ||
    value === undefined ||
    String(value).trim() === '';
}

function normalizedComparable(value: unknown) {
  return String(value || '')
    .trim()
    .toLocaleUpperCase('es-AR');
}

function shouldReplaceFromImport(
  existing: ExistingPatient,
  incoming: ImportPatient,
  field: 'health_insurance' | 'affiliate_number'
) {
  return !isMissing(incoming[field]) &&
    normalizedComparable(existing[field]) !==
      normalizedComparable(incoming[field]);
}

function getChangedFields(
  existing: ExistingPatient,
  incoming: ImportPatient
) {
  const fields: Array<
    keyof Pick<
      ImportPatient,
      | 'document_type'
      | 'phone'
      | 'email'
      | 'health_insurance'
      | 'affiliate_number'
      | 'birth_date'
      | 'address'
    >
  > = [
    'document_type',
    'phone',
    'email',
    'birth_date',
    'address'
  ];

  const completedFields =
    fields.filter((field) =>
    isMissing(existing[field]) &&
    !isMissing(incoming[field])
  );

  const replaceableFields: Array<
    'health_insurance' | 'affiliate_number'
  > = [
    'health_insurance',
    'affiliate_number'
  ];

  return [
    ...completedFields,
    ...replaceableFields.filter((field) =>
      shouldReplaceFromImport(
        existing,
        incoming,
        field
      )
    )
  ];
}

async function getExistingPatients(
  documents: string[]
) {
  if (!documents.length) {
    return new Map<string, ExistingPatient>();
  }

  const [rows]: any =
    await pool.query(
      `
        SELECT
          id,
          document_type,
          document_number,
          last_name,
          first_name,
          phone,
          email,
          health_insurance,
          affiliate_number,
          birth_date,
          address
        FROM people
        WHERE document_number IN (${documents.map(() => '?').join(',')})
      `,
      documents
    );

  const existing =
    new Map<string, ExistingPatient>();

  for (const row of rows as ExistingPatient[]) {
    existing.set(
      row.document_number,
      row
    );
  }

  return existing;
}

export async function previewPatientImport(
  fileBase64: string
) {
  const file =
    Buffer.from(fileBase64, 'base64');

  const parsed =
    parseNominalTurnsPatients(file);

  const existingByDocument =
    await getExistingPatients(
      parsed.patients.map((patient) =>
        patient.document_number
      )
    );

  const rows: PreviewRow[] =
    parsed.patients.map((patient) => {
      const existing =
        existingByDocument.get(patient.document_number);

      if (!existing) {
        return {
          ...patient,
          action: 'crear',
          patient_id: null,
          completed_fields: []
        };
      }

      const completedFields =
        getChangedFields(existing, patient);

      return {
        ...patient,
        action: completedFields.length
          ? 'actualizar'
          : 'sin_cambios',
        patient_id: existing.id,
        completed_fields: completedFields
      };
    });

  const allRows =
    [...rows, ...parsed.invalidRows];

  return {
    rows: allRows,
    summary: {
      total_rows: allRows.length,
      valid_rows: rows.length,
      created: rows.filter((row) => row.action === 'crear').length,
      updated: rows.filter((row) => row.action === 'actualizar').length,
      unchanged: rows.filter((row) => row.action === 'sin_cambios').length,
      skipped: parsed.invalidRows.length
    }
  };
}

export async function applyPatientImport(
  fileBase64: string
) {
  const preview =
    await previewPatientImport(fileBase64);

  const file =
    Buffer.from(fileBase64, 'base64');

  const parsed =
    parseNominalTurnsPatients(file);

  const connection =
    await pool.getConnection();

  try {
    await connection.beginTransaction();

    const existingByDocument =
      await getExistingPatients(
        parsed.patients.map((patient) =>
          patient.document_number
        )
      );

    let created = 0;
    let updated = 0;

    for (const patient of parsed.patients) {
      const existing =
        existingByDocument.get(patient.document_number);

      if (!existing) {
        const [result]: any =
          await connection.query(
          `
            INSERT INTO people (
              document_number,
              document_type,
              last_name,
              first_name,
              phone,
              email,
              health_insurance,
              affiliate_number,
              birth_date,
              address
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              document_type = COALESCE(NULLIF(document_type, ''), VALUES(document_type)),
              phone = COALESCE(NULLIF(phone, ''), VALUES(phone)),
              email = COALESCE(NULLIF(email, ''), VALUES(email)),
              health_insurance = COALESCE(VALUES(health_insurance), health_insurance),
              affiliate_number = COALESCE(VALUES(affiliate_number), affiliate_number),
              birth_date = COALESCE(birth_date, VALUES(birth_date)),
              address = COALESCE(NULLIF(address, ''), VALUES(address))
          `,
          [
            patient.document_number,
            patient.document_type,
            patient.last_name,
            patient.first_name,
            patient.phone,
            patient.email,
            patient.health_insurance,
            patient.affiliate_number,
            patient.birth_date,
            patient.address
          ]
        );

        if (result.affectedRows === 1) {
          created += 1;
        } else if (result.changedRows > 0) {
          updated += 1;
        }

        continue;
      }

      const completedFields =
        getChangedFields(existing, patient);

      if (!completedFields.length) {
        continue;
      }

      await connection.query(
        `
          UPDATE people
          SET
            document_type = COALESCE(NULLIF(document_type, ''), ?),
            phone = COALESCE(NULLIF(phone, ''), ?),
            email = COALESCE(NULLIF(email, ''), ?),
            health_insurance = COALESCE(?, health_insurance),
            affiliate_number = COALESCE(?, affiliate_number),
            birth_date = COALESCE(birth_date, ?),
            address = COALESCE(NULLIF(address, ''), ?)
          WHERE id = ?
        `,
        [
          patient.document_type,
          patient.phone,
          patient.email,
          patient.health_insurance,
          patient.affiliate_number,
          patient.birth_date,
          patient.address,
          existing.id
        ]
      );

      updated += 1;
    }

    await connection.commit();

    return {
      ...preview,
      summary: {
        ...preview.summary,
        created,
        updated
      }
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
