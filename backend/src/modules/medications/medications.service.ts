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
        ORDER BY name ASC
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