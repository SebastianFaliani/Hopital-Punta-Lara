import { pool } from '../../config/database';

export async function getBatchesByVaccine(
  vaccineId: number
) {
  const [rows]: any =
    await pool.query(
      `
        SELECT
          id,
          vaccine_id,
          batch_number,
          expiration_date,
          current_stock,
          purchase_price,
          is_active,
          created_at,
          updated_at
        FROM vaccine_batches
        WHERE vaccine_id = ?
        ORDER BY expiration_date ASC, batch_number ASC
      `,
      [vaccineId]
    );

  return rows;
}

export async function createVaccineBatch(
  vaccineId: number,
  data: any
) {
  const [result]: any =
    await pool.query(
      `
        INSERT INTO vaccine_batches (
          vaccine_id,
          batch_number,
          expiration_date,
          current_stock,
          purchase_price
        )
        VALUES (?, ?, ?, ?, ?)
      `,
      [
        vaccineId,
        data.batch_number,
        data.expiration_date,
        Number(data.current_stock),
        data.purchase_price ?? null
      ]
    );

  return result.insertId;
}

export async function updateVaccineBatch(
  id: number,
  data: any
) {
  await pool.query(
    `
      UPDATE vaccine_batches
      SET
        batch_number = ?,
        expiration_date = ?,
        current_stock = ?,
        purchase_price = ?
      WHERE id = ?
    `,
    [
      data.batch_number,
      data.expiration_date,
      Number(data.current_stock),
      data.purchase_price ?? null,
      id
    ]
  );

  return true;
}

export async function toggleVaccineBatch(
  id: number
) {
  await pool.query(
    `
      UPDATE vaccine_batches
      SET is_active = NOT is_active
      WHERE id = ?
    `,
    [id]
  );

  return true;
}

function getSignedQuantity(
  data: any
) {
  const quantity =
    Number(data.quantity);

  if (
    data.movement_type === 'ingreso' ||
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

export async function getVaccineMovementsByBatch(
  batchId: number
) {
  const [rows]: any =
    await pool.query(
      `
        SELECT
          vm.id,
          vm.vaccine_batch_id,
          vm.movement_type,
          vm.quantity,
          vm.reference_type,
          vm.notes,
          vm.created_by,
          vm.created_at,
          vm.updated_at,
          CONCAT(u.first_name, ' ', u.last_name)
            AS created_by_name
        FROM vaccine_movements vm
        LEFT JOIN users u
          ON u.id = vm.created_by
        WHERE vm.vaccine_batch_id = ?
        ORDER BY vm.created_at DESC, vm.id DESC
      `,
      [batchId]
    );

  return rows;
}

export async function createVaccineMovement(
  batchId: number,
  data: any
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
          FROM vaccine_batches
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
      throw new Error('No se puede mover stock en un lote inactivo');
    }

    const signedQuantity =
      getSignedQuantity(data);

    const newStock =
      Number(batch.current_stock) +
      signedQuantity;

    if (newStock < 0) {
      throw new Error('El movimiento deja el stock en negativo');
    }

    const [result]: any =
      await connection.query(
        `
          INSERT INTO vaccine_movements (
            vaccine_batch_id,
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
        UPDATE vaccine_batches
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
