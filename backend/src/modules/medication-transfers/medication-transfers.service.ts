import { pool }
  from '../../config/database';

import {
  MedicationTransferInput
} from './medication-transfers.types';

type TransferFilters = {
  status?: string;
  facility_id?: number;
  search?: string;
};

async function updateFacilityStock(
  connection: any,
  batchId: number,
  facilityId: number,
  signedQuantity: number
) {

  const [rows]: any =
    await connection.query(
      `
        SELECT current_stock
        FROM medication_batch_stocks
        WHERE medication_batch_id = ?
          AND facility_id = ?
        FOR UPDATE
      `,
      [
        batchId,
        facilityId
      ]
    );

  const currentStock =
    rows.length > 0
      ? Number(rows[0].current_stock)
      : 0;

  const newStock =
    currentStock + signedQuantity;

  if (newStock < 0) {
    throw new Error(
      'El traslado deja stock negativo en el punto origen'
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
      facilityId,
      newStock
    ]
  );

  return newStock;
}

async function insertTransferMovement(
  connection: any,
  batchId: number,
  facilityId: number,
  movementType: string,
  quantity: number,
  transferId: number,
  userId?: number | null
) {

  await connection.query(
    `
      INSERT INTO inventory_movements (
        medication_batch_id,
        facility_id,
        movement_type,
        quantity,
        reference_type,
        reference_id,
        notes,
        created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      batchId,
      facilityId,
      movementType,
      quantity,
      'medication_transfer',
      transferId,
      `Traslado de medicacion #${transferId}`,
      userId ?? null
    ]
  );
}

export async function getFacilityBatchStocks(
  facilityId: number
) {

  const [rows]: any =
    await pool.query(
      `
        SELECT
          mb.id AS medication_batch_id,
          mb.batch_number,
          mb.expiration_date,
          mbs.current_stock,
          m.id AS medication_id,
          m.name AS medication_name,
          m.generic_name,
          m.presentation,
          m.concentration,
          m.unit
        FROM medication_batch_stocks mbs
        INNER JOIN medication_batches mb
          ON mb.id = mbs.medication_batch_id
        INNER JOIN medications m
          ON m.id = mb.medication_id
        WHERE mbs.facility_id = ?
          AND mbs.current_stock > 0
          AND mb.is_active = TRUE
          AND m.is_active = TRUE
        ORDER BY
          m.name ASC,
          mb.expiration_date ASC,
          mb.batch_number ASC
      `,
      [facilityId]
    );

  return rows;
}

export async function getMedicationTransfers(
  filters: TransferFilters
) {

  const params: any[] = [];
  const where: string[] = [];

  if (filters.status && filters.status !== 'todos') {
    where.push('mt.status = ?');
    params.push(filters.status);
  }

  if (filters.facility_id) {
    where.push(
      `(
        mt.source_facility_id = ?
        OR mt.destination_facility_id = ?
      )`
    );
    params.push(
      filters.facility_id,
      filters.facility_id
    );
  }

  if (filters.search) {
    where.push(
      `(
        sf.name LIKE ?
        OR df.name LIKE ?
        OR m.name LIKE ?
        OR mb.batch_number LIKE ?
      )`
    );
    const value =
      `%${filters.search}%`;
    params.push(
      value,
      value,
      value,
      value
    );
  }

  const whereSql =
    where.length
      ? `WHERE ${where.join(' AND ')}`
      : '';

  const [rows]: any =
    await pool.query(
      `
        SELECT
          mt.id,
          mt.source_facility_id,
          sf.name AS source_facility_name,
          mt.destination_facility_id,
          df.name AS destination_facility_name,
          mt.transfer_date,
          mt.status,
          mt.notes,
          mt.created_by,
          CONCAT(cu.first_name, ' ', cu.last_name)
            AS created_by_name,
          mt.received_by,
          CONCAT(ru.first_name, ' ', ru.last_name)
            AS received_by_name,
          mt.received_at,
          mt.cancelled_by,
          mt.cancelled_at,
          mt.created_at,
          COUNT(mti.id) AS item_count,
          COALESCE(SUM(mti.quantity), 0) AS total_quantity
        FROM medication_transfers mt
        INNER JOIN health_facilities sf
          ON sf.id = mt.source_facility_id
        INNER JOIN health_facilities df
          ON df.id = mt.destination_facility_id
        LEFT JOIN users cu
          ON cu.id = mt.created_by
        LEFT JOIN users ru
          ON ru.id = mt.received_by
        LEFT JOIN medication_transfer_items mti
          ON mti.medication_transfer_id = mt.id
        LEFT JOIN medication_batches mb
          ON mb.id = mti.medication_batch_id
        LEFT JOIN medications m
          ON m.id = mb.medication_id
        ${whereSql}
        GROUP BY
          mt.id,
          sf.name,
          df.name,
          cu.first_name,
          cu.last_name,
          ru.first_name,
          ru.last_name
        ORDER BY mt.created_at DESC, mt.id DESC
      `,
      params
    );

  return rows;
}

export async function getMedicationTransferById(
  id: number
) {

  const [transferRows]: any =
    await pool.query(
      `
        SELECT
          mt.id,
          mt.source_facility_id,
          sf.name AS source_facility_name,
          mt.destination_facility_id,
          df.name AS destination_facility_name,
          mt.transfer_date,
          mt.status,
          mt.notes,
          mt.created_by,
          CONCAT(cu.first_name, ' ', cu.last_name)
            AS created_by_name,
          mt.received_by,
          CONCAT(ru.first_name, ' ', ru.last_name)
            AS received_by_name,
          mt.received_at,
          mt.cancelled_by,
          mt.cancelled_at,
          mt.created_at
        FROM medication_transfers mt
        INNER JOIN health_facilities sf
          ON sf.id = mt.source_facility_id
        INNER JOIN health_facilities df
          ON df.id = mt.destination_facility_id
        LEFT JOIN users cu
          ON cu.id = mt.created_by
        LEFT JOIN users ru
          ON ru.id = mt.received_by
        WHERE mt.id = ?
      `,
      [id]
    );

  if (transferRows.length === 0) {
    return null;
  }

  const [items]: any =
    await pool.query(
      `
        SELECT
          mti.id,
          mti.medication_batch_id,
          mti.quantity,
          mb.batch_number,
          mb.expiration_date,
          m.name AS medication_name,
          m.generic_name,
          m.presentation,
          m.concentration,
          m.unit
        FROM medication_transfer_items mti
        INNER JOIN medication_batches mb
          ON mb.id = mti.medication_batch_id
        INNER JOIN medications m
          ON m.id = mb.medication_id
        WHERE mti.medication_transfer_id = ?
        ORDER BY m.name ASC, mb.expiration_date ASC
      `,
      [id]
    );

  return {
    ...transferRows[0],
    items
  };
}

export async function createMedicationTransfer(
  data: MedicationTransferInput
) {

  const connection =
    await pool.getConnection();

  try {

    await connection.beginTransaction();

    if (
      data.source_facility_id ===
      data.destination_facility_id
    ) {
      throw new Error(
        'El origen y destino no pueden ser el mismo punto'
      );
    }

    const [result]: any =
      await connection.query(
        `
          INSERT INTO medication_transfers (
            source_facility_id,
            destination_facility_id,
            transfer_date,
            status,
            notes,
            created_by
          )
          VALUES (?, ?, ?, 'enviado', ?, ?)
        `,
        [
          data.source_facility_id,
          data.destination_facility_id,
          data.transfer_date,
          data.notes ?? null,
          data.created_by ?? null
        ]
      );

    const transferId =
      Number(result.insertId);

    for (const item of data.items) {
      const quantity =
        Number(item.quantity);

      await updateFacilityStock(
        connection,
        Number(item.medication_batch_id),
        data.source_facility_id,
        quantity * -1
      );

      await connection.query(
        `
          INSERT INTO medication_transfer_items (
            medication_transfer_id,
            medication_batch_id,
            quantity
          )
          VALUES (?, ?, ?)
        `,
        [
          transferId,
          Number(item.medication_batch_id),
          quantity
        ]
      );

      await insertTransferMovement(
        connection,
        Number(item.medication_batch_id),
        data.source_facility_id,
        'traslado_envio',
        quantity * -1,
        transferId,
        data.created_by
      );
    }

    await connection.commit();

    return transferId;

  } catch (error) {

    await connection.rollback();

    throw error;

  } finally {

    connection.release();
  }
}

export async function receiveMedicationTransfer(
  id: number,
  userId?: number | null
) {

  const connection =
    await pool.getConnection();

  try {

    await connection.beginTransaction();

    const [transferRows]: any =
      await connection.query(
        `
          SELECT *
          FROM medication_transfers
          WHERE id = ?
          FOR UPDATE
        `,
        [id]
      );

    if (transferRows.length === 0) {
      throw new Error('Traslado no encontrado');
    }

    const transfer =
      transferRows[0];

    if (transfer.status !== 'enviado') {
      throw new Error(
        'Solo se pueden recibir traslados enviados'
      );
    }

    const [items]: any =
      await connection.query(
        `
          SELECT medication_batch_id, quantity
          FROM medication_transfer_items
          WHERE medication_transfer_id = ?
        `,
        [id]
      );

    for (const item of items) {
      const quantity =
        Number(item.quantity);

      await updateFacilityStock(
        connection,
        Number(item.medication_batch_id),
        Number(transfer.destination_facility_id),
        quantity
      );

      await insertTransferMovement(
        connection,
        Number(item.medication_batch_id),
        Number(transfer.destination_facility_id),
        'traslado_recepcion',
        quantity,
        id,
        userId
      );
    }

    await connection.query(
      `
        UPDATE medication_transfers
        SET
          status = 'recibido',
          received_by = ?,
          received_at = NOW()
        WHERE id = ?
      `,
      [
        userId ?? null,
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
}

export async function cancelMedicationTransfer(
  id: number,
  userId?: number | null
) {

  const connection =
    await pool.getConnection();

  try {

    await connection.beginTransaction();

    const [transferRows]: any =
      await connection.query(
        `
          SELECT *
          FROM medication_transfers
          WHERE id = ?
          FOR UPDATE
        `,
        [id]
      );

    if (transferRows.length === 0) {
      throw new Error('Traslado no encontrado');
    }

    const transfer =
      transferRows[0];

    if (transfer.status !== 'enviado') {
      throw new Error(
        'Solo se pueden cancelar traslados enviados'
      );
    }

    const [items]: any =
      await connection.query(
        `
          SELECT medication_batch_id, quantity
          FROM medication_transfer_items
          WHERE medication_transfer_id = ?
        `,
        [id]
      );

    for (const item of items) {
      const quantity =
        Number(item.quantity);

      await updateFacilityStock(
        connection,
        Number(item.medication_batch_id),
        Number(transfer.source_facility_id),
        quantity
      );

      await insertTransferMovement(
        connection,
        Number(item.medication_batch_id),
        Number(transfer.source_facility_id),
        'traslado_cancelacion',
        quantity,
        id,
        userId
      );
    }

    await connection.query(
      `
        UPDATE medication_transfers
        SET
          status = 'cancelado',
          cancelled_by = ?,
          cancelled_at = NOW()
        WHERE id = ?
      `,
      [
        userId ?? null,
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
}
