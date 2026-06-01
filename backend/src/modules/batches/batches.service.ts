import { pool }
  from '../../config/database';

import {
  MedicationBatchInput
} from './batches.types';

import {
  getDefaultFacilityId
} from '../health-facilities/health-facilities.service';

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

  const [stockRows]: any =
    await pool.query(
      `
        SELECT
          mbs.medication_batch_id,
          mbs.facility_id,
          hf.name AS facility_name,
          hf.facility_type,
          mbs.current_stock
        FROM medication_batch_stocks mbs
        INNER JOIN health_facilities hf
          ON hf.id = mbs.facility_id
        WHERE mbs.medication_batch_id IN (?)
        ORDER BY hf.name ASC
      `,
      [
        rows.length > 0
          ? rows.map((row: any) => row.id)
          : [0]
      ]
    );

  const stocksByBatch =
    stockRows.reduce(
      (acc: Record<number, any[]>, stock: any) => {
        const batchId =
          Number(stock.medication_batch_id);

        acc[batchId] =
          acc[batchId] || [];

        acc[batchId].push({
          facility_id:
            Number(stock.facility_id),
          facility_name:
            stock.facility_name,
          facility_type:
            stock.facility_type,
          current_stock:
            Number(stock.current_stock)
        });

        return acc;
      },
      {}
    );

  return rows.map((row: any) => ({
    ...row,
    current_stock:
      Number(row.current_stock),
    stock_by_facility:
      stocksByBatch[Number(row.id)] || []
  }));
}

export async function createBatch(
  medicationId: number,
  batch: MedicationBatchInput
) {

  const connection =
    await pool.getConnection();

  try {

    await connection.beginTransaction();

    const {
      batch_number,
      expiration_date,
      current_stock,
      purchase_price,
      facility_id
    } = batch;

    const initialStock =
      Number(current_stock || 0);

    const [result]: any =
      await connection.query(
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
          initialStock,
          purchase_price ?? null
        ]
      );

    const batchId =
      Number(result.insertId);

    if (initialStock > 0) {
      const targetFacilityId =
        facility_id ??
        await getDefaultFacilityId(connection);

      if (!targetFacilityId) {
        throw new Error(
          'No hay un punto de stock activo para cargar el lote'
        );
      }

      await connection.query(
        `
          INSERT INTO medication_batch_stocks (
            medication_batch_id,
            facility_id,
            current_stock
          )
          VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE
            current_stock = VALUES(current_stock)
        `,
        [
          batchId,
          targetFacilityId,
          initialStock
        ]
      );
    }

    await connection.commit();

    return batchId;

  } catch (error) {

    await connection.rollback();

    throw error;

  } finally {

    connection.release();
  }
}

export async function updateBatch(
  id: number,
  batch: MedicationBatchInput
) {

  const {
    batch_number,
    expiration_date,
    purchase_price
  } = batch;

  await pool.query(
    `
      UPDATE medication_batches
      SET
        batch_number = ?,
        expiration_date = ?,
        purchase_price = ?
      WHERE id = ?
    `,
    [
      batch_number,
      expiration_date,
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
