import { pool }
  from '../../config/database';

import { Medication }
  from './medications.types';



// ======================================
// OBTENER TODOS
// ======================================

export async function getAllMedications() {

  const [rows]: any =
    await pool.query(
      `
        SELECT
          m.id,
          m.name,
          m.generic_name,
          m.presentation,
          m.concentration,
          m.unit,
          m.description,
          m.minimum_stock,
          COALESCE(
            SUM(
              CASE
                WHEN mb.is_active = TRUE
                  THEN mb.current_stock
                ELSE 0
              END
            ),
            0
          ) AS total_stock,
          m.is_active,
          m.created_at
        FROM medications m
        LEFT JOIN medication_batches mb
          ON mb.medication_id = m.id
        GROUP BY
          m.id,
          m.name,
          m.generic_name,
          m.presentation,
          m.concentration,
          m.unit,
          m.description,
          m.minimum_stock,
          m.is_active,
          m.created_at
        ORDER BY m.name ASC
      `
    );

  return rows;
}



// ======================================
// OBTENER POR ID
// ======================================

export async function getMedicationById(
  id: number
) {

  const [rows]: any =
    await pool.query(
      `
        SELECT
          id,
          name,
          generic_name,
          presentation,
          concentration,
          unit,
          description,
          minimum_stock,
          is_active,
          created_at
        FROM medications
        WHERE id = ?
      `,
      [id]
    );

  return rows[0];
}



// ======================================
// CREAR
// ======================================

export async function createMedication(
  medication: Omit<
    Medication,
    'id'
  >
) {

  const {
    name,
    generic_name,
    presentation,
    concentration,
    unit,
    description,
    minimum_stock
  } = medication;

  const [result]: any =
    await pool.query(
      `
        INSERT INTO medications (
          name,
          generic_name,
          presentation,
          concentration,
          unit,
          description,
          minimum_stock
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        name,
        generic_name,
        presentation,
        concentration,
        unit,
        description,
        minimum_stock
      ]
    );

  return result.insertId;
}



// ======================================
// ACTUALIZAR
// ======================================

export async function updateMedication(
  id: number,
  medication: Partial<Medication>
) {

  const {
    name,
    generic_name,
    presentation,
    concentration,
    unit,
    description,
    minimum_stock
  } = medication;

  await pool.query(
    `
      UPDATE medications
      SET
        name = ?,
        generic_name = ?,
        presentation = ?,
        concentration = ?,
        unit = ?,
        description = ?,
        minimum_stock = ?
      WHERE id = ?
    `,
    [
      name,
      generic_name,
      presentation,
      concentration,
      unit,
      description,
      minimum_stock,
      id
    ]
  );
}



// ======================================
// ACTIVAR / DESACTIVAR
// ======================================

export async function toggleMedication(
  id: number
) {

  await pool.query(
    `
      UPDATE medications
      SET is_active = NOT is_active
      WHERE id = ?
    `,
    [id]
  );
}
