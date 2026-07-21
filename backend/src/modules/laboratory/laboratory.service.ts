import { pool } from '../../config/database';

type LaboratoryFilters = {
  search?: string;
  date_from?: string;
  date_to?: string;
  month?: string | number;
  year?: string | number;
  sample_type?: string;
  pickup_status?: string;
  completion_status?: string;
  test_status?: string;
  record_status?: string;
  page?: string | number;
  per_page?: string | number;
};

let patientPhoneColumnCache: boolean | null =
  null;

const laboratoryColumnCache =
  new Map<string, boolean>();

const tableCache =
  new Map<string, boolean>();

function normalizeDocument(
  value?: string | null
) {
  return String(value || '')
    .trim()
    .replace(/[.\s-]/g, '');
}

async function hasTable(
  tableName: string
) {
  if (tableCache.has(tableName)) {
    return Boolean(tableCache.get(tableName));
  }

  const [rows]: any =
    await pool.query(
      `
        SELECT COUNT(*) AS total
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
      `,
      [tableName]
    );

  const exists =
    Number(rows[0]?.total || 0) > 0;

  tableCache.set(tableName, exists);

  return exists;
}

async function hasLaboratoryColumn(
  columnName: string
) {
  if (laboratoryColumnCache.has(columnName)) {
    return Boolean(
      laboratoryColumnCache.get(columnName)
    );
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
    exists
  );

  return exists;
}

async function hasPatientPhoneColumn() {
  if (patientPhoneColumnCache !== null) {
    return patientPhoneColumnCache;
  }

  patientPhoneColumnCache =
    await hasLaboratoryColumn('patient_phone');

  return patientPhoneColumnCache;
}

async function hasPatientIdColumn() {
  return hasLaboratoryColumn('patient_id');
}

async function hasPeopleTable() {
  return hasTable('people');
}

export async function getPersonByDocument(
  documentNumber: string
) {
  const normalizedDocument =
    normalizeDocument(documentNumber);

  if (
    !normalizedDocument ||
    !(await hasPeopleTable())
  ) {
    return null;
  }

  const [rows]: any =
    await pool.query(
      `
        SELECT
          id,
          document_number,
          last_name,
          first_name,
          phone,
          birth_date
        FROM people
        WHERE document_number = ?
        LIMIT 1
      `,
      [normalizedDocument]
    );

  return rows[0] || null;
}

async function upsertPerson(
  connection: any,
  data: any
) {
  const normalizedDocument =
    normalizeDocument(data.patient_document);

  if (
    !normalizedDocument ||
    !(await hasPeopleTable())
  ) {
    return null;
  }

  const lastName =
    String(data.patient_last_name || '').trim();

  const firstName =
    String(data.patient_first_name || '').trim();

  if (!lastName || !firstName) {
    return null;
  }

  await connection.query(
    `
      INSERT INTO people (
        document_number,
        last_name,
        first_name,
        phone,
        birth_date
      )
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        last_name = VALUES(last_name),
        first_name = VALUES(first_name),
        phone = VALUES(phone),
        birth_date = VALUES(birth_date)
    `,
    [
      normalizedDocument,
      lastName,
      firstName,
      data.patient_phone || null,
      data.patient_birth_date || null
    ]
  );

  const [rows]: any =
    await connection.query(
      `
        SELECT id
        FROM people
        WHERE document_number = ?
        LIMIT 1
      `,
      [normalizedDocument]
    );

  return rows[0]?.id || null;
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
  hasPhoneColumn = false,
  hasPatientId = false
) {
  const where: string[] = [];
  const values: any[] = [];

  if (filters.search) {
    const search =
      `%${filters.search.trim()}%`;

    const lastNameExpression =
      hasPatientId
        ? 'COALESCE(p.last_name, laboratory_records.patient_last_name)'
        : 'laboratory_records.patient_last_name';

    const firstNameExpression =
      hasPatientId
        ? 'COALESCE(p.first_name, laboratory_records.patient_first_name)'
        : 'laboratory_records.patient_first_name';

    const documentExpression =
      hasPatientId
        ? 'COALESCE(p.document_number, laboratory_records.patient_document)'
        : 'laboratory_records.patient_document';

    const phoneExpression =
      hasPatientId
        ? 'COALESCE(p.phone, laboratory_records.patient_phone)'
        : 'laboratory_records.patient_phone';

    where.push(
      `(
        ${lastNameExpression} LIKE ?
        OR ${firstNameExpression} LIKE ?
        OR CONCAT(${lastNameExpression}, ' ', ${firstNameExpression}) LIKE ?
        OR CONCAT(${firstNameExpression}, ' ', ${lastNameExpression}) LIKE ?
        OR ${documentExpression} LIKE ?
        ${hasPhoneColumn ? `OR ${phoneExpression} LIKE ?` : ''}
        OR laboratory_records.picked_up_by LIKE ?
      )`
    );

    values.push(
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

  if (
    filters.year &&
    filters.year !== 'todos'
  ) {
    where.push(
      'YEAR(laboratory_records.study_date) = ?'
    );
    values.push(Number(filters.year));
  }

  if (
    filters.month &&
    filters.month !== 'todos'
  ) {
    where.push(
      'MONTH(laboratory_records.study_date) = ?'
    );
    values.push(Number(filters.month));
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

  if (filters.record_status === 'enviado') {
    where.push(
      "laboratory_records.status = 'enviado'"
    );
  }

  if (filters.record_status === 'parcial') {
    where.push(
      "laboratory_records.status = 'parcial'"
    );
  }

  if (filters.record_status === 'completo') {
    where.push(
      "laboratory_records.status = 'completo'"
    );
  }

  if (filters.record_status === 'retirado') {
    where.push(
      "laboratory_records.status = 'retirado'"
    );
  }

  if (filters.record_status === 'expirado') {
    where.push(
      "laboratory_records.status = 'expirado'"
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

export async function getLaboratoryRecords(
  filters: LaboratoryFilters
) {
  const hasPhoneColumn =
    await hasPatientPhoneColumn();

  const [
    hasPatientId,
    hasPickupRegisteredByColumn,
    hasPickupRegisteredAtColumn
  ] =
    await Promise.all([
      hasPatientIdColumn(),
      hasLaboratoryColumn('pickup_registered_by'),
      hasLaboratoryColumn('pickup_registered_at')
    ]);

  const where =
    buildWhereClause(
      filters,
      hasPhoneColumn,
      hasPatientId
    );

  const pagination =
    getPagination(filters);

  const [countRows]: any =
    await pool.query(
      `
        SELECT COUNT(*) AS total
        FROM laboratory_records
        ${
          hasPatientId
            ? `LEFT JOIN people p
          ON p.id = laboratory_records.patient_id`
            : ''
        }
        ${where.sql}
      `,
      where.values
    );

  const [rows]: any =
    await pool.query(
      `
        SELECT
          laboratory_records.id,
          laboratory_records.study_date,
          ${
            hasPatientId
              ? 'COALESCE(p.last_name, laboratory_records.patient_last_name)'
              : 'laboratory_records.patient_last_name'
          } AS patient_last_name,
          ${
            hasPatientId
              ? 'COALESCE(p.first_name, laboratory_records.patient_first_name)'
              : 'laboratory_records.patient_first_name'
          } AS patient_first_name,
          ${
            hasPatientId
              ? 'COALESCE(p.document_number, laboratory_records.patient_document)'
              : 'laboratory_records.patient_document'
          } AS patient_document,
          ${
            hasPatientId
              ? 'COALESCE(p.birth_date, laboratory_records.patient_birth_date)'
              : 'laboratory_records.patient_birth_date'
          } AS patient_birth_date,
          ${
            hasPhoneColumn
              ? hasPatientId
                ? 'COALESCE(p.phone, laboratory_records.patient_phone)'
                : 'laboratory_records.patient_phone'
              : 'NULL'
          } AS patient_phone,
          laboratory_records.has_blood_extraction,
          laboratory_records.has_urine_sample,
          laboratory_records.is_complete,
          laboratory_records.status,
          laboratory_records.missing_details,
          laboratory_records.completed_at,
          laboratory_records.pickup_date,
          laboratory_records.picked_up_by,
          laboratory_records.pickup_document,
          ${
            hasPickupRegisteredByColumn
              ? 'laboratory_records.pickup_registered_by'
              : 'NULL'
          } AS pickup_registered_by,
          ${
            hasPickupRegisteredAtColumn
              ? 'laboratory_records.pickup_registered_at'
              : 'NULL'
          } AS pickup_registered_at,
          laboratory_records.notes,
          laboratory_records.created_at,
          laboratory_records.updated_at,
          cu.username AS created_by_username,
          uu.username AS updated_by_username,
          COALESCE(
            NULLIF(
              TRIM(CONCAT_WS(' ', pu.first_name, pu.last_name)),
              ''
            ),
            pu.username,
            pu.email,
            NULL
          ) AS pickup_registered_by_name
        FROM laboratory_records
        ${
          hasPatientId
            ? `LEFT JOIN people p
          ON p.id = laboratory_records.patient_id`
            : ''
        }
        LEFT JOIN users cu
          ON cu.id = laboratory_records.created_by
        LEFT JOIN users uu
          ON uu.id = laboratory_records.updated_by
        LEFT JOIN users pu
          ON pu.id = ${
            hasPickupRegisteredByColumn
              ? 'laboratory_records.pickup_registered_by'
              : 'NULL'
          }
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
  const [
    hasPhoneColumn,
    hasPatientId
  ] =
    await Promise.all([
      hasPatientPhoneColumn(),
      hasPatientIdColumn()
    ]);

  const where =
    buildWhereClause(
      filters,
      hasPhoneColumn,
      hasPatientId
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
        ${
          hasPatientId
            ? `LEFT JOIN people p
          ON p.id = laboratory_records.patient_id`
            : ''
        }
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
  const [
    hasPatientId,
    hasPhoneColumn
  ] =
    await Promise.all([
      hasPatientIdColumn(),
      hasPatientPhoneColumn()
    ]);

  const [rows]: any =
    await pool.query(
      `
        SELECT
          laboratory_records.*,
          ${
            hasPatientId
              ? 'COALESCE(p.last_name, laboratory_records.patient_last_name)'
              : 'laboratory_records.patient_last_name'
          } AS patient_last_name,
          ${
            hasPatientId
              ? 'COALESCE(p.first_name, laboratory_records.patient_first_name)'
              : 'laboratory_records.patient_first_name'
          } AS patient_first_name,
          ${
            hasPatientId
              ? 'COALESCE(p.document_number, laboratory_records.patient_document)'
              : 'laboratory_records.patient_document'
          } AS patient_document,
          ${
            hasPatientId
              ? 'COALESCE(p.birth_date, laboratory_records.patient_birth_date)'
              : 'laboratory_records.patient_birth_date'
          } AS patient_birth_date,
          ${
            hasPhoneColumn
              ? hasPatientId
                ? 'COALESCE(p.phone, laboratory_records.patient_phone)'
                : 'laboratory_records.patient_phone'
              : 'NULL'
          } AS patient_phone
        FROM laboratory_records
        ${
          hasPatientId
            ? `LEFT JOIN people p
          ON p.id = laboratory_records.patient_id`
            : ''
        }
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

    const hasPhoneColumn =
      await hasPatientPhoneColumn();

    const hasPatientId =
      await hasPatientIdColumn();

    const patientId =
      await upsertPerson(
        connection,
        data
      );

    const patientDocument =
      normalizeDocument(data.patient_document);

    const [result]: any =
      await connection.query(
        `
          INSERT INTO laboratory_records (
            study_date,
            ${hasPatientId ? 'patient_id,' : ''}
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
          VALUES (?, ${hasPatientId ? '?,' : ''} ?, ?, ?, ?, ${hasPhoneColumn ? '?,' : ''} ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          data.study_date,
          ...(hasPatientId
            ? [patientId]
            : []),
          data.patient_last_name,
          data.patient_first_name,
          patientDocument || null,
          data.patient_birth_date || null,
          ...(hasPhoneColumn
            ? [data.patient_phone || null]
            : []),
          Boolean(data.has_blood_extraction),
          Boolean(data.has_urine_sample),
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
      []
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

    const hasPhoneColumn =
      await hasPatientPhoneColumn();

    const hasPatientId =
      await hasPatientIdColumn();

    const patientId =
      await upsertPerson(
        connection,
        data
      );

    const patientDocument =
      normalizeDocument(data.patient_document);

    await connection.query(
      `
        UPDATE laboratory_records
        SET
          study_date = ?,
          ${hasPatientId ? 'patient_id = ?,' : ''}
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
        data.study_date,
        ...(hasPatientId
          ? [patientId]
          : []),
        data.patient_last_name,
        data.patient_first_name,
        patientDocument || null,
        data.patient_birth_date || null,
        ...(hasPhoneColumn
          ? [data.patient_phone || null]
          : []),
        Boolean(data.has_blood_extraction),
        Boolean(data.has_urine_sample),
        data.notes || null,
        userId || null,
        id
      ]
    );

    await replaceRequestedTests(
      connection,
      id,
      []
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

export async function deleteLaboratoryRecord(
  id: number
) {
  await pool.query(
    `
      DELETE FROM laboratory_records
      WHERE id = ?
    `,
    [id]
  );

  return true;
}

export async function updateLaboratoryCompletion(
  id: number,
  data: any,
  userId?: number
) {
  const isComplete =
    Boolean(data.is_complete);

  const normalizedMissingDetails =
    String(data.missing_details || '').trim();

  const missingDetails =
    isComplete
      ? null
      : normalizedMissingDetails || 'Resultados pendientes';

  const hasMissingItems =
    !isComplete &&
    normalizedMissingDetails.length > 0;

  const connection =
    await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows]: any =
      await connection.query(
        `
          SELECT pickup_date
          FROM laboratory_records
          WHERE id = ?
          FOR UPDATE
        `,
        [id]
      );

    const status =
      rows[0]?.pickup_date
        ? 'retirado'
        : isComplete
          ? 'completo'
          : hasMissingItems
            ? 'parcial'
            : 'enviado';

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
        missingDetails,
        isComplete
          ? new Date()
          : null,
        isComplete
          ? userId || null
          : null,
        userId || null,
        id
      ]
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

export async function registerLaboratoryPickup(
  id: number,
  data: any,
  userId?: number
) {
  const [
    hasPickupRegisteredByColumn,
    hasPickupRegisteredAtColumn
  ] =
    await Promise.all([
      hasLaboratoryColumn('pickup_registered_by'),
      hasLaboratoryColumn('pickup_registered_at')
    ]);

  await pool.query(
    `
      UPDATE laboratory_records
      SET
        pickup_date = ?,
        picked_up_by = ?,
        pickup_document = ?,
        ${
          hasPickupRegisteredByColumn
            ? 'pickup_registered_by = ?,'
            : ''
        }
        ${
          hasPickupRegisteredAtColumn
            ? 'pickup_registered_at = CURRENT_TIMESTAMP,'
            : ''
        }
        status = 'retirado',
        notes = ?,
        updated_by = ?
      WHERE id = ?
    `,
    [
      data.pickup_date,
      data.picked_up_by,
      data.pickup_document || null,
      ...(
        hasPickupRegisteredByColumn
          ? [userId || null]
          : []
      ),
      data.notes || null,
      userId || null,
      id
    ]
  );

  return true;
}
