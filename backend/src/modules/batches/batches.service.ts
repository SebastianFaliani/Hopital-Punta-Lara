import { pool }
  from '../../config/database';

import {
  MedicationBatchInput
} from './batches.types';

export async function getBatchesByMedication(
  medicationId: number
) {

  const [rows]: any =
    await pool.query(
      `
        SELECT
          id,
          medication_id,
          batch_number,
          expiration_date,
          current_stock,
          purchase_price,
          is_active,
          created_at,
          updated_at
        FROM medication_batches
        WHERE medication_id = ?
        ORDER BY expiration_date ASC, batch_number ASC
      `,
      [medicationId]
    );

  return rows;
}

export async function createBatch(
  medicationId: number,
  batch: MedicationBatchInput
) {

  const {
    batch_number,
    expiration_date,
    current_stock,
    purchase_price
  } = batch;

  const [result]: any =
    await pool.query(
      `
        INSERT INTO medication_batches (
          medication_id,
          batch_number,
          expiration_date,
          current_stock,
          purchase_price
        )
        VALUES (?, ?, ?, ?, ?)
      `,
      [
        medicationId,
        batch_number,
        expiration_date,
        current_stock,
        purchase_price ?? null
      ]
    );

  return result.insertId;
}

export async function updateBatch(
  id: number,
  batch: MedicationBatchInput
) {

  const {
    batch_number,
    expiration_date,
    current_stock,
    purchase_price
  } = batch;

  await pool.query(
    `
      UPDATE medication_batches
      SET
        batch_number = ?,
        expiration_date = ?,
        current_stock = ?,
        purchase_price = ?
      WHERE id = ?
    `,
    [
      batch_number,
      expiration_date,
      current_stock,
      purchase_price ?? null,
      id
    ]
  );

  return true;
}

export async function toggleBatch(
  id: number
) {

  await pool.query(
    `
      UPDATE medication_batches
      SET is_active = NOT is_active
      WHERE id = ?
    `,
    [id]
  );

  return true;
}
