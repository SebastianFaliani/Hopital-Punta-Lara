import { pool } from '../../config/database';

type PatientFilters = {
  search?: string;
  status?: string;
};

type Queryable = {
  query: typeof pool.query;
};

function normalizeDocument(
  value: unknown
) {
  return String(value || '')
    .replace(/\D/g, '');
}

function normalizeText(
  value: unknown
) {
  const text =
    String(value || '')
      .trim()
      .replace(/\s+/g, ' ');

  return text
    ? text.toLocaleUpperCase('es-AR')
    : '';
}

function normalizePhone(
  value: unknown
) {
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

async function upsertPeoplePatient(
  data: any,
  connection: Queryable = pool
) {
  const document =
    normalizeDocument(data.document);

  const firstName =
    normalizeText(data.first_name);

  const lastName =
    normalizeText(data.last_name);

  const phone =
    normalizePhone(data.phone);

  const birthDate =
    data.birth_date || null;

  if (!firstName || !lastName) {
    throw new Error('Debe cargar nombre y apellido');
  }

  if (data.patient_id) {
    await connection.query(
      `
        UPDATE people
        SET
          document_number = ?,
          document_type = ?,
          first_name = ?,
          last_name = ?,
          phone = ?,
          birth_date = ?
        WHERE id = ?
      `,
      [
        document || null,
        document ? 'DNI' : null,
        firstName,
        lastName,
        phone,
        birthDate,
        data.patient_id
      ]
    );

    return Number(data.patient_id);
  }

  if (document) {
    const [existingRows]: any =
      await connection.query(
        `
          SELECT id
          FROM people
          WHERE document_number = ?
          LIMIT 1
        `,
        [document]
      );

    if (existingRows[0]) {
      await connection.query(
        `
          UPDATE people
          SET
            document_type = COALESCE(NULLIF(document_type, ''), 'DNI'),
            first_name = ?,
            last_name = ?,
            phone = COALESCE(?, phone),
            birth_date = COALESCE(?, birth_date)
          WHERE id = ?
        `,
        [
          firstName,
          lastName,
          phone,
          birthDate,
          existingRows[0].id
        ]
      );

      return Number(existingRows[0].id);
    }
  }

  const [result]: any =
    await connection.query(
      `
        INSERT INTO people (
          document_number,
          document_type,
          first_name,
          last_name,
          phone,
          birth_date
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        document || null,
        document ? 'DNI' : null,
        firstName,
        lastName,
        phone,
        birthDate
      ]
    );

  return Number(result.insertId);
}

async function ensureNutritionPatientIsUnique(
  patientId: number,
  currentNutritionId: number | null,
  connection: Queryable = pool
) {
  const params: any[] =
    [patientId];

  let excludeSql = '';

  if (currentNutritionId) {
    excludeSql = 'AND id <> ?';
    params.push(currentNutritionId);
  }

  const [rows]: any =
    await connection.query(
      `
        SELECT id
        FROM nutrition_patients
        WHERE patient_id = ?
          ${excludeSql}
        LIMIT 1
      `,
      params
    );

  if (rows[0]) {
    throw new Error(
      'Este paciente ya tiene una ficha de nutricion'
    );
  }
}

function calculateBmi(
  weightKg: number,
  heightM: number
) {
  return Number(
    (weightKg / (heightM * heightM))
      .toFixed(2)
  );
}

export function classifyBmi(
  bmi: number
) {
  if (bmi < 18.5) {
    return 'Bajo peso';
  }

  if (bmi < 25) {
    return 'Normal';
  }

  if (bmi < 30) {
    return 'Sobrepeso';
  }

  if (bmi < 35) {
    return 'Obesidad grado I';
  }

  if (bmi < 40) {
    return 'Obesidad grado II';
  }

  return 'Obesidad grado III';
}

function buildPatientWhere(
  filters: PatientFilters
) {
  const where: string[] = [];
  const values: any[] = [];

  if (filters.search) {
    const search =
      `%${filters.search.trim()}%`;

    where.push(
      `(
        COALESCE(p.first_name, np.first_name) LIKE ?
        OR COALESCE(p.last_name, np.last_name) LIKE ?
        OR CONCAT(COALESCE(p.first_name, np.first_name), ' ', COALESCE(p.last_name, np.last_name)) LIKE ?
        OR CONCAT(COALESCE(p.last_name, np.last_name), ' ', COALESCE(p.first_name, np.first_name)) LIKE ?
        OR COALESCE(p.document_number, np.document) LIKE ?
      )`
    );

    values.push(
      search,
      search,
      search,
      search,
      search
    );
  }

  if (filters.status === 'activo') {
    where.push('np.is_active = TRUE');
  }

  if (filters.status === 'inactivo') {
    where.push('np.is_active = FALSE');
  }

  return {
    sql:
      where.length > 0
        ? `WHERE ${where.join(' AND ')}`
        : '',
    values
  };
}

export async function getNutritionPatients(
  filters: PatientFilters
) {
  const where =
    buildPatientWhere(filters);

  const [rows]: any =
    await pool.query(
      `
        SELECT
          np.*,
          COALESCE(p.first_name, np.first_name) AS first_name,
          COALESCE(p.last_name, np.last_name) AS last_name,
          COALESCE(p.document_number, np.document) AS document,
          DATE_FORMAT(COALESCE(p.birth_date, np.birth_date), '%Y-%m-%d') AS birth_date,
          COALESCE(p.phone, np.phone) AS phone,
          p.email,
          p.health_insurance,
          p.affiliate_number,
          p.address,
          lc.control_date AS last_control_date,
          lc.weight_kg AS last_weight_kg,
          lc.height_m AS last_height_m,
          lc.bmi AS last_bmi,
          lc.waist_circumference_cm AS last_waist_circumference_cm,
          fc.weight_kg AS first_weight_kg,
          (
            SELECT COUNT(*)
            FROM nutrition_controls nc_count
            WHERE nc_count.patient_id = np.id
          ) AS controls_count
        FROM nutrition_patients np
        LEFT JOIN people p
          ON p.id = np.patient_id
        LEFT JOIN nutrition_controls lc
          ON lc.id = (
            SELECT nc_last.id
            FROM nutrition_controls nc_last
            WHERE nc_last.patient_id = np.id
            ORDER BY nc_last.control_date DESC, nc_last.id DESC
            LIMIT 1
          )
        LEFT JOIN nutrition_controls fc
          ON fc.id = (
            SELECT nc_first.id
            FROM nutrition_controls nc_first
            WHERE nc_first.patient_id = np.id
            ORDER BY nc_first.control_date ASC, nc_first.id ASC
            LIMIT 1
          )
        ${where.sql}
        ORDER BY np.is_active DESC, np.last_name ASC, np.first_name ASC
      `,
      where.values
    );

  return rows.map((row: any) => ({
    ...row,
    bmi_classification:
      row.last_bmi
        ? classifyBmi(Number(row.last_bmi))
        : null,
    weight_change_kg:
      row.last_weight_kg &&
      row.first_weight_kg
        ? Number(
          (
            Number(row.last_weight_kg) -
            Number(row.first_weight_kg)
          ).toFixed(2)
        )
        : null
  }));
}

export async function getNutritionStats() {
  const [rows]: any =
    await pool.query(
      `
        SELECT
          COUNT(*) AS total_patients,
          SUM(CASE WHEN is_active = TRUE THEN 1 ELSE 0 END) AS active_patients,
          (
            SELECT COUNT(*)
            FROM nutrition_controls
            WHERE MONTH(control_date) = MONTH(CURRENT_DATE())
              AND YEAR(control_date) = YEAR(CURRENT_DATE())
          ) AS controls_this_month,
          (
            SELECT ROUND(AVG(bmi), 2)
            FROM nutrition_controls nc
            INNER JOIN (
              SELECT patient_id, MAX(control_date) AS max_date
              FROM nutrition_controls
              GROUP BY patient_id
            ) latest
              ON latest.patient_id = nc.patient_id
              AND latest.max_date = nc.control_date
          ) AS average_last_bmi,
          (
            SELECT COUNT(*)
            FROM nutrition_patients np
            LEFT JOIN nutrition_controls nc
              ON nc.id = (
                SELECT id
                FROM nutrition_controls nc_last
                WHERE nc_last.patient_id = np.id
                ORDER BY control_date DESC, id DESC
                LIMIT 1
              )
            WHERE np.is_active = TRUE
              AND (
                nc.control_date IS NULL
                OR nc.control_date < DATE_SUB(CURRENT_DATE(), INTERVAL 45 DAY)
              )
          ) AS patients_without_recent_control
        FROM nutrition_patients
      `
    );

  return rows[0];
}

export async function getNutritionPatientById(
  id: number
) {
  const [rows]: any =
    await pool.query(
      `
        SELECT
          np.*,
          COALESCE(p.first_name, np.first_name) AS first_name,
          COALESCE(p.last_name, np.last_name) AS last_name,
          COALESCE(p.document_number, np.document) AS document,
          DATE_FORMAT(COALESCE(p.birth_date, np.birth_date), '%Y-%m-%d') AS birth_date,
          COALESCE(p.phone, np.phone) AS phone,
          p.email,
          p.health_insurance,
          p.affiliate_number,
          p.address
        FROM nutrition_patients np
        LEFT JOIN people p
          ON p.id = np.patient_id
        WHERE np.id = ?
        LIMIT 1
      `,
      [id]
    );

  return rows[0];
}

export async function createNutritionPatient(
  data: any,
  userId?: number
) {
  const connection =
    await pool.getConnection();

  try {
    await connection.beginTransaction();

    const patientId =
      await upsertPeoplePatient(
        data,
        connection
      );

    await ensureNutritionPatientIsUnique(
      patientId,
      null,
      connection
    );

    const document =
      normalizeDocument(data.document);

    const [result]: any =
      await connection.query(
      `
        INSERT INTO nutrition_patients (
          patient_id,
          first_name,
          last_name,
          document,
          birth_date,
          phone,
          target_weight_kg,
          nutritional_diagnosis,
          meal_plan,
          physical_activity,
          has_diabetes,
          has_hypertension,
          has_high_cholesterol,
          medical_history,
          notes,
          is_active,
          created_by,
          updated_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        patientId,
        normalizeText(data.first_name),
        normalizeText(data.last_name),
        document || null,
        data.birth_date || null,
        normalizePhone(data.phone),
        data.target_weight_kg || null,
        data.nutritional_diagnosis || null,
        data.meal_plan || null,
        data.physical_activity || null,
        Boolean(data.has_diabetes),
        Boolean(data.has_hypertension),
        Boolean(data.has_high_cholesterol),
        data.medical_history || null,
        data.notes || null,
        data.is_active !== false,
        userId || null,
        userId || null
      ]
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

export async function updateNutritionPatient(
  id: number,
  data: any,
  userId?: number
) {
  const connection =
    await pool.getConnection();

  try {
    await connection.beginTransaction();

    const current =
      await getNutritionPatientById(id);

    const patientId =
      await upsertPeoplePatient(
        {
          ...data,
          patient_id:
            current?.patient_id || data.patient_id
        },
        connection
      );

    await ensureNutritionPatientIsUnique(
      patientId,
      id,
      connection
    );

    const document =
      normalizeDocument(data.document);

    await connection.query(
    `
      UPDATE nutrition_patients
      SET
        patient_id = ?,
        first_name = ?,
        last_name = ?,
        document = ?,
        birth_date = ?,
        phone = ?,
        target_weight_kg = ?,
        nutritional_diagnosis = ?,
        meal_plan = ?,
        physical_activity = ?,
        has_diabetes = ?,
        has_hypertension = ?,
        has_high_cholesterol = ?,
        medical_history = ?,
        notes = ?,
        is_active = ?,
        updated_by = ?
      WHERE id = ?
    `,
    [
      patientId,
      normalizeText(data.first_name),
      normalizeText(data.last_name),
      document || null,
      data.birth_date || null,
      normalizePhone(data.phone),
      data.target_weight_kg || null,
      data.nutritional_diagnosis || null,
      data.meal_plan || null,
      data.physical_activity || null,
      Boolean(data.has_diabetes),
      Boolean(data.has_hypertension),
      Boolean(data.has_high_cholesterol),
      data.medical_history || null,
      data.notes || null,
      data.is_active !== false,
      userId || null,
      id
    ]
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

export async function getNutritionControls(
  patientId: number
) {
  const [rows]: any =
    await pool.query(
      `
        SELECT
          nc.*,
          DATE_FORMAT(nc.control_date, '%Y-%m-%d') AS control_date,
          CONCAT(u.first_name, ' ', u.last_name) AS created_by_name
        FROM nutrition_controls nc
        LEFT JOIN users u
          ON u.id = nc.created_by
        WHERE nc.patient_id = ?
        ORDER BY nc.control_date ASC, nc.id ASC
      `,
      [patientId]
    );

  return rows.map((row: any) => ({
    ...row,
    bmi_classification:
      classifyBmi(Number(row.bmi))
  }));
}

export async function getNutritionControlById(
  id: number
) {
  const [rows]: any =
    await pool.query(
      `
        SELECT *
        FROM nutrition_controls
        WHERE id = ?
        LIMIT 1
      `,
      [id]
    );

  return rows[0];
}

export async function createNutritionControl(
  patientId: number,
  data: any,
  userId?: number
) {
  const weight =
    Number(data.weight_kg);

  const height =
    Number(data.height_m);

  const bmi =
    calculateBmi(weight, height);

  const [result]: any =
    await pool.query(
      `
        INSERT INTO nutrition_controls (
          patient_id,
          control_date,
          weight_kg,
          height_m,
          bmi,
          waist_circumference_cm,
          notes,
          created_by,
          updated_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        patientId,
        data.control_date,
        weight,
        height,
        bmi,
        data.waist_circumference_cm || null,
        data.notes || null,
        userId || null,
        userId || null
      ]
    );

  return result.insertId;
}

export async function updateNutritionControl(
  id: number,
  data: any,
  userId?: number
) {
  const weight =
    Number(data.weight_kg);

  const height =
    Number(data.height_m);

  const bmi =
    calculateBmi(weight, height);

  await pool.query(
    `
      UPDATE nutrition_controls
      SET
        control_date = ?,
        weight_kg = ?,
        height_m = ?,
        bmi = ?,
        waist_circumference_cm = ?,
        notes = ?,
        updated_by = ?
      WHERE id = ?
    `,
    [
      data.control_date,
      weight,
      height,
      bmi,
      data.waist_circumference_cm || null,
      data.notes || null,
      userId || null,
      id
    ]
  );

  return true;
}
