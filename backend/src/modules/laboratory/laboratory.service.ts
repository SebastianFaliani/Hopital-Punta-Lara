import { pool } from '../../config/database';
import {
  saveWhatsappChatMessage
} from '../whatsapp/whatsapp.service';
import {
  sendWhatsappTextMessage
} from '../whatsapp/whatsapp-web.service';

type LaboratoryFilters = {
  search?: string;
  date_from?: string;
  date_to?: string;
  sample_type?: string;
  pickup_status?: string;
  completion_status?: string;
  test_status?: string;
  page?: string | number;
  per_page?: string | number;
};

const defaultResultNotificationTemplate =
  [
    'Hospital Municipal de Punta Lara',
    '',
    'Hola {nombre}. Te avisamos que los resultados de laboratorio ya se encuentran disponibles para retirar.',
    '',
    'Podes pasar de lunes a viernes de 08:00 a 12:00 hs por el hospital.',
    '',
    'Recorda traer DNI.'
  ].join('\n');

type LaboratoryColumnCacheEntry = {
  exists: boolean;
  checkedAt: number;
};

const laboratoryColumnCache =
  new Map<string, LaboratoryColumnCacheEntry>();

const laboratoryColumnCacheTtlMs =
  60_000;

async function hasLaboratoryColumn(
  columnName: string
) {
  const cached =
    laboratoryColumnCache.get(columnName);

  if (
    cached &&
    Date.now() - cached.checkedAt < laboratoryColumnCacheTtlMs
  ) {
    return cached.exists;
  }

  const [rows]: any =
    await pool.query(
      `
        SELECT COUNT(*) AS total
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'laboratory_records'
          AND COLUMN_NAME = ?
      `
      ,
      [columnName]
    );

  const exists =
    Number(rows[0]?.total || 0) > 0;

  laboratoryColumnCache.set(
    columnName,
    {
      exists,
      checkedAt: Date.now()
    }
  );

  return exists;
}

async function getLaboratoryOptionalColumns() {
  const [
    hasPhoneColumn,
    hasNotificationAtColumn,
    hasNotificationMessageColumn,
    hasNotificationByColumn
  ] =
    await Promise.all([
      hasLaboratoryColumn('patient_phone'),
      hasLaboratoryColumn('result_notified_at'),
      hasLaboratoryColumn('result_notification_message'),
      hasLaboratoryColumn('result_notified_by')
    ]);

  return {
    hasPhoneColumn,
    hasNotificationAtColumn,
    hasNotificationMessageColumn,
    hasNotificationByColumn
  };
}

export async function getLaboratoryResultNotificationTemplate() {
  try {
    await pool.query(
      `
        CREATE TABLE IF NOT EXISTS laboratory_settings (
          setting_key VARCHAR(120) PRIMARY KEY,
          setting_value TEXT NOT NULL,
          updated_by BIGINT NULL,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `
    );

    const [rows]: any =
      await pool.query(
        `
          SELECT setting_value
          FROM laboratory_settings
          WHERE setting_key = 'result_notification_template'
          LIMIT 1
        `
      );

    return rows[0]?.setting_value ||
      defaultResultNotificationTemplate;
  } catch (error) {
    return defaultResultNotificationTemplate;
  }
}

export async function updateLaboratoryResultNotificationTemplate(
  template: string,
  userId?: number
) {
  const cleanTemplate =
    String(template || '').trim();

  if (!cleanTemplate) {
    throw new Error(
      'El mensaje predeterminado no puede estar vacio'
    );
  }

  await pool.query(
    `
      CREATE TABLE IF NOT EXISTS laboratory_settings (
        setting_key VARCHAR(120) PRIMARY KEY,
        setting_value TEXT NOT NULL,
        updated_by BIGINT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `
  );

  await pool.query(
    `
      INSERT INTO laboratory_settings (
        setting_key,
        setting_value,
        updated_by
      )
      VALUES ('result_notification_template', ?, ?)
      ON DUPLICATE KEY UPDATE
        setting_value = VALUES(setting_value),
        updated_by = VALUES(updated_by),
        updated_at = CURRENT_TIMESTAMP
    `,
    [
      cleanTemplate,
      userId || null
    ]
  );

  return cleanTemplate;
}

function getPagination(
  filters: LaboratoryFilters
) {
  const page =
    Math.max(
      1,
      Number(filters.page || 1)
    );

  const perPage =
    Math.min(
      100,
      Math.max(
        10,
        Number(filters.per_page || 25)
      )
    );

  return {
    page,
    perPage,
    offset:
      (page - 1) * perPage
  };
}

function buildWhereClause(
  filters: LaboratoryFilters,
  hasPhoneColumn = false
) {
  const where: string[] = [];
  const values: any[] = [];

  if (filters.search) {
    const search =
      `%${filters.search.trim()}%`;

    where.push(
      `(
        laboratory_records.patient_last_name LIKE ?
        OR laboratory_records.patient_first_name LIKE ?
        OR CONCAT(laboratory_records.patient_last_name, ' ', laboratory_records.patient_first_name) LIKE ?
        OR CONCAT(laboratory_records.patient_first_name, ' ', laboratory_records.patient_last_name) LIKE ?
        OR laboratory_records.patient_document LIKE ?
        ${hasPhoneColumn ? 'OR laboratory_records.patient_phone LIKE ?' : ''}
        OR laboratory_records.protocol_number LIKE ?
        OR laboratory_records.picked_up_by LIKE ?
      )`
    );

    values.push(
      search,
      search,
      search,
      search,
      search,
      search,
      search
    );

    if (hasPhoneColumn) {
      values.splice(5, 0, search);
    }
  }

  if (filters.date_from) {
    where.push(
      'laboratory_records.study_date >= ?'
    );
    values.push(filters.date_from);
  }

  if (filters.date_to) {
    where.push(
      'laboratory_records.study_date <= ?'
    );
    values.push(filters.date_to);
  }

  if (filters.sample_type === 'sangre') {
    where.push(
      'laboratory_records.has_blood_extraction = TRUE AND laboratory_records.has_urine_sample = FALSE'
    );
  }

  if (filters.sample_type === 'orina') {
    where.push(
      'laboratory_records.has_urine_sample = TRUE AND laboratory_records.has_blood_extraction = FALSE'
    );
  }

  if (filters.sample_type === 'ambas') {
    where.push(
      'laboratory_records.has_blood_extraction = TRUE AND laboratory_records.has_urine_sample = TRUE'
    );
  }

  if (filters.pickup_status === 'retirado') {
    where.push(
      'laboratory_records.pickup_date IS NOT NULL'
    );
  }

  if (filters.pickup_status === 'pendiente') {
    where.push(
      'laboratory_records.pickup_date IS NULL'
    );
  }

  if (filters.completion_status === 'completo') {
    where.push(
      'laboratory_records.is_complete = TRUE'
    );
  }

  if (filters.completion_status === 'incompleto') {
    where.push(
      'laboratory_records.is_complete = FALSE'
    );
  }

  if (filters.test_status === 'parcial') {
    where.push(
      `EXISTS (
        SELECT 1
        FROM laboratory_record_tests lrt_filter
        WHERE lrt_filter.laboratory_record_id = laboratory_records.id
          AND lrt_filter.requested = TRUE
          AND lrt_filter.received = FALSE
      )`
    );
  }

  return {
    sql:
      where.length > 0
        ? `WHERE ${where.join(' AND ')}`
        : '',
    values
  };
}

async function attachTestsToRecords(
  records: any[]
) {
  if (records.length === 0) {
    return records;
  }

  const ids =
    records.map((record) => record.id);

  const [testRows]: any =
    await pool.query(
      `
        SELECT
          lrt.id,
          lrt.laboratory_record_id,
          lrt.test_id,
          lrt.requested,
          lrt.received,
          lrt.received_at,
          lrt.notes,
          ltc.category,
          ltc.code,
          ltc.name,
          ltc.display_order
        FROM laboratory_record_tests lrt
        INNER JOIN laboratory_test_catalog ltc
          ON ltc.id = lrt.test_id
        WHERE lrt.laboratory_record_id IN (${ids
          .map(() => '?')
          .join(', ')})
        ORDER BY
          ltc.category,
          ltc.display_order,
          ltc.name
      `,
      ids
    );

  const grouped =
    new Map<number, any[]>();

  testRows.forEach((row: any) => {
    const recordId =
      Number(row.laboratory_record_id);

    grouped.set(
      recordId,
      [
        ...(grouped.get(recordId) || []),
        {
          ...row,
          requested: Boolean(row.requested),
          received: Boolean(row.received)
        }
      ]
    );
  });

  return records.map((record) => {
    const tests =
      grouped.get(Number(record.id)) || [];

    const requestedCount =
      tests.filter((test) => test.requested).length;

    const receivedCount =
      tests.filter((test) =>
        test.requested && test.received
      ).length;

    return {
      ...record,
      tests,
      requested_tests_count: requestedCount,
      received_tests_count: receivedCount
    };
  });
}

async function syncLaboratoryRecordStatus(
  connection: any,
  recordId: number,
  userId?: number
) {
  const [rows]: any =
    await connection.query(
      `
        SELECT
          lr.pickup_date,
          COUNT(lrt.id) AS requested_count,
          SUM(CASE WHEN lrt.received = TRUE THEN 1 ELSE 0 END) AS received_count
        FROM laboratory_records lr
        LEFT JOIN laboratory_record_tests lrt
          ON lrt.laboratory_record_id = lr.id
          AND lrt.requested = TRUE
        WHERE lr.id = ?
        GROUP BY lr.id, lr.pickup_date
      `,
      [recordId]
    );

  const row =
    rows[0] || {};

  const requestedCount =
    Number(row.requested_count || 0);

  const receivedCount =
    Number(row.received_count || 0);

  const isComplete =
    requestedCount > 0 &&
    requestedCount === receivedCount;

  const status =
    row.pickup_date
      ? 'retirado'
      : isComplete
        ? 'completo'
        : receivedCount > 0
          ? 'parcial'
          : 'enviado';

  await connection.query(
    `
      UPDATE laboratory_records
      SET
        is_complete = ?,
        status = ?,
        missing_details = ?,
        completed_at = ?,
        completed_by = ?,
        updated_by = ?
      WHERE id = ?
    `,
    [
      isComplete,
      status,
      isComplete
        ? null
        : requestedCount > 0
          ? 'Resultados pendientes'
          : 'Sin practicas cargadas',
      isComplete
        ? new Date()
        : null,
      isComplete
        ? userId || null
        : null,
      userId || null,
      recordId
    ]
  );
}

async function replaceRequestedTests(
  connection: any,
  recordId: number,
  testIds: number[]
) {
  await connection.query(
    'DELETE FROM laboratory_record_tests WHERE laboratory_record_id = ?',
    [recordId]
  );

  for (const testId of new Set(testIds)) {
    await connection.query(
      `
        INSERT INTO laboratory_record_tests (
          laboratory_record_id,
          test_id,
          requested,
          received
        )
        VALUES (?, ?, TRUE, FALSE)
      `,
      [recordId, testId]
    );
  }
}

async function getSampleFlagsFromTests(
  connection: any,
  testIds: number[]
) {
  if (testIds.length === 0) {
    return {
      hasBlood: false,
      hasUrine: false
    };
  }

  const [rows]: any =
    await connection.query(
      `
        SELECT category
        FROM laboratory_test_catalog
        WHERE id IN (${testIds
          .map(() => '?')
          .join(', ')})
      `,
      testIds
    );

  const hasUrine =
    rows.some((row: any) =>
      String(row.category).startsWith('Orina')
    );

  const hasBlood =
    rows.some((row: any) =>
      !String(row.category).startsWith('Orina')
    );

  return {
    hasBlood,
    hasUrine
  };
}

export async function getLaboratoryRecords(
  filters: LaboratoryFilters
) {
  const optionalColumns =
    await getLaboratoryOptionalColumns();

  const where =
    buildWhereClause(
      filters,
      optionalColumns.hasPhoneColumn
    );

  const pagination =
    getPagination(filters);

  const [countRows]: any =
    await pool.query(
      `
        SELECT COUNT(*) AS total
        FROM laboratory_records
        ${where.sql}
      `,
      where.values
    );

  const [rows]: any =
    await pool.query(
      `
        SELECT
          laboratory_records.id,
          laboratory_records.protocol_number,
          laboratory_records.study_date,
          laboratory_records.patient_last_name,
          laboratory_records.patient_first_name,
          laboratory_records.patient_document,
          laboratory_records.patient_birth_date,
          ${
            optionalColumns.hasPhoneColumn
              ? 'laboratory_records.patient_phone'
              : 'NULL'
          } AS patient_phone,
          ${
            optionalColumns.hasNotificationAtColumn
              ? 'laboratory_records.result_notified_at'
              : 'NULL'
          } AS result_notified_at,
          ${
            optionalColumns.hasNotificationMessageColumn
              ? 'laboratory_records.result_notification_message'
              : 'NULL'
          } AS result_notification_message,
          laboratory_records.has_blood_extraction,
          laboratory_records.has_urine_sample,
          laboratory_records.is_complete,
          laboratory_records.status,
          laboratory_records.missing_details,
          laboratory_records.completed_at,
          laboratory_records.pickup_date,
          laboratory_records.picked_up_by,
          laboratory_records.pickup_document,
          laboratory_records.notes,
          laboratory_records.created_at,
          laboratory_records.updated_at,
          cu.username AS created_by_username,
          uu.username AS updated_by_username
        FROM laboratory_records
        LEFT JOIN users cu
          ON cu.id = laboratory_records.created_by
        LEFT JOIN users uu
          ON uu.id = laboratory_records.updated_by
        ${where.sql}
        ORDER BY laboratory_records.study_date DESC, laboratory_records.id DESC
        LIMIT ? OFFSET ?
      `,
      [
        ...where.values,
        pagination.perPage,
        pagination.offset
      ]
    );

  const total =
    Number(countRows[0]?.total || 0);

  return {
    records:
      await attachTestsToRecords(rows),
    pagination: {
      page: pagination.page,
      per_page: pagination.perPage,
      total,
      total_pages:
        Math.max(
          1,
          Math.ceil(total / pagination.perPage)
        )
    }
  };
}

export async function getLaboratoryStats(
  filters: LaboratoryFilters
) {
  const optionalColumns =
    await getLaboratoryOptionalColumns();

  const where =
    buildWhereClause(
      filters,
      optionalColumns.hasPhoneColumn
    );

  const [rows]: any =
    await pool.query(
      `
        SELECT
          COUNT(*) AS total_records,
          SUM(CASE WHEN has_blood_extraction = TRUE THEN 1 ELSE 0 END) AS blood_extractions,
          SUM(CASE WHEN has_urine_sample = TRUE THEN 1 ELSE 0 END) AS urine_samples,
          SUM(CASE WHEN has_blood_extraction = TRUE AND has_urine_sample = TRUE THEN 1 ELSE 0 END) AS both_samples,
          SUM(CASE WHEN pickup_date IS NULL AND is_complete = TRUE THEN 1 ELSE 0 END) AS pending_pickups,
          SUM(CASE WHEN pickup_date IS NOT NULL THEN 1 ELSE 0 END) AS delivered_results,
          SUM(CASE WHEN is_complete = FALSE THEN 1 ELSE 0 END) AS incomplete_records,
          SUM(CASE WHEN is_complete = TRUE THEN 1 ELSE 0 END) AS complete_records,
          SUM(CASE WHEN status = 'enviado' THEN 1 ELSE 0 END) AS sent_records,
          SUM(CASE WHEN status = 'parcial' THEN 1 ELSE 0 END) AS partial_records
        FROM laboratory_records
        ${where.sql}
      `,
      where.values
    );

  return rows[0];
}

export async function getLaboratoryTestCatalog() {
  const [rows]: any =
    await pool.query(
      `
        SELECT
          id,
          category,
          code,
          name,
          display_order
        FROM laboratory_test_catalog
        WHERE is_active = TRUE
        ORDER BY category, display_order, name
      `
    );

  return rows;
}

export async function getLaboratoryRecordById(
  id: number
) {
  const [rows]: any =
    await pool.query(
      `
        SELECT *
        FROM laboratory_records
        WHERE id = ?
      `,
      [id]
    );

  const records =
    await attachTestsToRecords(rows);

  return records[0];
}

export async function createLaboratoryRecord(
  data: any,
  userId?: number
) {
  const connection =
    await pool.getConnection();

  try {
    await connection.beginTransaction();

    const requestedTestIds =
      Array.isArray(data.requested_test_ids)
        ? data.requested_test_ids
          .map(Number)
          .filter((id: number) => id > 0)
        : [];

    const sampleFlags =
      await getSampleFlagsFromTests(
        connection,
        requestedTestIds
      );

    const {
      hasPhoneColumn
    } =
      await getLaboratoryOptionalColumns();

    const [result]: any =
      await connection.query(
        `
          INSERT INTO laboratory_records (
            protocol_number,
            study_date,
            patient_last_name,
            patient_first_name,
            patient_document,
            patient_birth_date,
            ${hasPhoneColumn ? 'patient_phone,' : ''}
            has_blood_extraction,
            has_urine_sample,
            is_complete,
            status,
            missing_details,
            completed_at,
            completed_by,
            notes,
            created_by,
            updated_by
          )
          VALUES (?, ?, ?, ?, ?, ?, ${hasPhoneColumn ? '?,' : ''} ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          data.protocol_number || null,
          data.study_date,
          data.patient_last_name,
          data.patient_first_name,
          data.patient_document || null,
          data.patient_birth_date || null,
          ...(hasPhoneColumn
            ? [data.patient_phone || null]
            : []),
          sampleFlags.hasBlood,
          sampleFlags.hasUrine,
          false,
          'enviado',
          'Resultados pendientes',
          null,
          null,
          data.notes || null,
          userId || null,
          userId || null
        ]
      );

    await replaceRequestedTests(
      connection,
      result.insertId,
      requestedTestIds
    );

    await syncLaboratoryRecordStatus(
      connection,
      result.insertId,
      userId
    );

    await connection.commit();
    return result.insertId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function updateLaboratoryRecord(
  id: number,
  data: any,
  userId?: number
) {
  const connection =
    await pool.getConnection();

  try {
    await connection.beginTransaction();

    const requestedTestIds =
      Array.isArray(data.requested_test_ids)
        ? data.requested_test_ids
          .map(Number)
          .filter((testId: number) => testId > 0)
        : [];

    const sampleFlags =
      await getSampleFlagsFromTests(
        connection,
        requestedTestIds
      );

    const {
      hasPhoneColumn
    } =
      await getLaboratoryOptionalColumns();

    await connection.query(
      `
        UPDATE laboratory_records
        SET
          protocol_number = ?,
          study_date = ?,
          patient_last_name = ?,
          patient_first_name = ?,
          patient_document = ?,
          patient_birth_date = ?,
          ${hasPhoneColumn ? 'patient_phone = ?,' : ''}
          has_blood_extraction = ?,
          has_urine_sample = ?,
          notes = ?,
          updated_by = ?
        WHERE id = ?
      `,
      [
        data.protocol_number || null,
        data.study_date,
        data.patient_last_name,
        data.patient_first_name,
        data.patient_document || null,
        data.patient_birth_date || null,
        ...(hasPhoneColumn
          ? [data.patient_phone || null]
          : []),
        sampleFlags.hasBlood,
        sampleFlags.hasUrine,
        data.notes || null,
        userId || null,
        id
      ]
    );

    await replaceRequestedTests(
      connection,
      id,
      requestedTestIds
    );

    await syncLaboratoryRecordStatus(
      connection,
      id,
      userId
    );

    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function updateLaboratoryCompletion(
  id: number,
  data: any,
  userId?: number
) {
  const receivedTestIds =
    Array.isArray(data.received_test_ids)
      ? data.received_test_ids
        .map(Number)
        .filter((testId: number) => testId > 0)
      : [];

  const connection =
    await pool.getConnection();

  try {
    await connection.beginTransaction();

    await connection.query(
      `
        UPDATE laboratory_record_tests
        SET
          received = FALSE,
          received_at = NULL,
          received_by = NULL,
          notes = NULL
        WHERE laboratory_record_id = ?
      `,
      [id]
    );

    if (receivedTestIds.length > 0) {
      await connection.query(
        `
          UPDATE laboratory_record_tests
          SET
            received = TRUE,
            received_at = COALESCE(received_at, NOW()),
            received_by = ?
          WHERE laboratory_record_id = ?
            AND test_id IN (${receivedTestIds
              .map(() => '?')
              .join(', ')})
        `,
        [
          userId || null,
          id,
          ...receivedTestIds
        ]
      );
    }

    await syncLaboratoryRecordStatus(
      connection,
      id,
      userId
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return true;
}

function normalizeWhatsappPhone(
  phone: string
) {
  const trimmed =
    String(phone || '').trim();

  if (trimmed.includes('@')) {
    return trimmed;
  }

  let digits =
    trimmed.replace(/\D/g, '');

  if (!digits) {
    throw new Error(
      'El paciente no tiene un telefono valido para WhatsApp'
    );
  }

  digits =
    digits.replace(/^00+/, '');

  if (digits.startsWith('549')) {
    return `${digits}@c.us`;
  }

  if (digits.startsWith('54')) {
    const nationalNumber =
      digits.slice(2);

    if (nationalNumber.startsWith('9')) {
      return `${digits}@c.us`;
    }

    return `549${nationalNumber}@c.us`;
  }

  if (digits.startsWith('0')) {
    digits = digits.replace(/^0+/, '');
  }

  if (digits.startsWith('15')) {
    digits = digits.slice(2);
  }

  if (digits.length < 8) {
    throw new Error(
      'El telefono del paciente parece incompleto. Cargalo con codigo de area, por ejemplo 2215062920'
    );
  }

  return `549${digits}@c.us`;
}

export async function notifyLaboratoryResultByWhatsapp(
  id: number,
  message: string,
  userId?: number
) {
  const record =
    await getLaboratoryRecordById(id);

  if (!record) {
    throw new Error(
      'Estudio de laboratorio no encontrado'
    );
  }

  if (!record.is_complete) {
    throw new Error(
      'El estudio todavia no esta completo'
    );
  }

  if (!record.patient_phone) {
    throw new Error(
      'El paciente no tiene telefono cargado'
    );
  }

  const cleanMessage =
    String(message || '').trim();

  if (!cleanMessage) {
    throw new Error(
      'El mensaje es obligatorio'
    );
  }

  const phone =
    normalizeWhatsappPhone(record.patient_phone);

  await sendWhatsappTextMessage(
    phone,
    cleanMessage
  );

  await saveWhatsappChatMessage({
    phone,
    direction: 'outgoing',
    message: cleanMessage,
    source: 'laboratorio'
  });

  const optionalColumns =
    await getLaboratoryOptionalColumns();

  if (
    optionalColumns.hasNotificationAtColumn &&
    optionalColumns.hasNotificationMessageColumn
  ) {
    await pool.query(
      `
        UPDATE laboratory_records
        SET
          result_notified_at = NOW(),
          result_notification_message = ?,
          ${
            optionalColumns.hasNotificationByColumn
              ? 'result_notified_by = ?,'
              : ''
          }
          updated_by = ?
        WHERE id = ?
      `,
      [
        cleanMessage,
        ...(optionalColumns.hasNotificationByColumn
          ? [userId || null]
          : []),
        userId || null,
        id
      ]
    );
  }

  return true;
}

export async function registerLaboratoryPickup(
  id: number,
  data: any,
  userId?: number
) {
  await pool.query(
    `
      UPDATE laboratory_records
      SET
        pickup_date = ?,
        picked_up_by = ?,
        pickup_document = ?,
        status = 'retirado',
        notes = ?,
        updated_by = ?
      WHERE id = ?
    `,
    [
      data.pickup_date,
      data.picked_up_by,
      data.pickup_document || null,
      data.notes || null,
      userId || null,
      id
    ]
  );

  return true;
}
