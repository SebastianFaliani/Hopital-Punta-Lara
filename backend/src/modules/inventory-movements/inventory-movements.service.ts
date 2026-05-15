import { pool }
  from '../../config/database';

import {
  StockMovementInput
} from './inventory-movements.types';

function getSignedQuantity(
  data: StockMovementInput
) {

  const quantity =
    Number(data.quantity);

  if (
    data.movement_type === 'compra' ||
    data.movement_type === 'devolucion'
  ) {
    return quantity;
  }

  if (data.movement_type === 'perdida') {
    return quantity * -1;
  }

  return data.movement_direction === 'salida'
    ? quantity * -1
    : quantity;
}

export async function getMovementsByBatch(
  batchId: number
) {

  const [rows]: any =
    await pool.query(
      `
        SELECT
          im.id,
          im.medication_batch_id,
          im.movement_type,
          im.quantity,
          im.reference_type,
          im.reference_id,
          im.notes,
          im.created_by,
          im.created_at,
          im.updated_at,
          CONCAT(u.first_name, ' ', u.last_name)
            AS created_by_name
        FROM inventory_movements im
        LEFT JOIN users u
          ON u.id = im.created_by
        WHERE im.medication_batch_id = ?
        ORDER BY im.created_at DESC, im.id DESC
      `,
      [batchId]
    );

  return rows;
}

export async function createStockMovement(
  batchId: number,
  data: StockMovementInput
) {

  const connection =
    await pool.getConnection();

  try {

    await connection.beginTransaction();

    const [batchRows]: any =
      await connection.query(
        `
          SELECT
            id,
            current_stock,
            is_active
          FROM medication_batches
          WHERE id = ?
          FOR UPDATE
        `,
        [batchId]
      );

    if (batchRows.length === 0) {
      throw new Error('Lote no encontrado');
    }

    const batch = batchRows[0];

    if (!batch.is_active) {
      throw new Error(
        'No se puede mover stock en un lote inactivo'
      );
    }

    const signedQuantity =
      getSignedQuantity(data);

    const currentStock =
      Number(batch.current_stock);

    const newStock =
      currentStock + signedQuantity;

    if (newStock < 0) {
      throw new Error(
        'El movimiento deja el stock en negativo'
      );
    }

    const [result]: any =
      await connection.query(
        `
          INSERT INTO inventory_movements (
            medication_batch_id,
            movement_type,
            quantity,
            reference_type,
            notes,
            created_by
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          batchId,
          data.movement_type,
          signedQuantity,
          'manual',
          data.notes ?? null,
          data.created_by ?? null
        ]
      );

    await connection.query(
      `
        UPDATE medication_batches
        SET current_stock = ?
        WHERE id = ?
      `,
      [
        newStock,
        batchId
      ]
    );

    await connection.commit();

    return {
      id: result.insertId,
      current_stock: newStock
    };

  } catch (error) {

    await connection.rollback();

    throw error;

  } finally {

    connection.release();
  }
}
