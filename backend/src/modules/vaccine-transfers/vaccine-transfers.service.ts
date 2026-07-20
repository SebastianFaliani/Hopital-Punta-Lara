import { pool }
  from '../../config/database';

import {
  VaccineTransferInput
} from './vaccine-transfers.types';

type TransferFilters = {
  status?: string;
  facility_id?: number;
  search?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
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
        FROM vaccine_batch_stocks
        WHERE vaccine_batch_id = ?
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
      INSERT INTO vaccine_batch_stocks (
        vaccine_batch_id,
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
}

export async function getVaccineFacilityBatchStocks(
  facilityId: number
) {

  const [rows]: any =
    await pool.query(
      `
        SELECT
          vb.id AS vaccine_batch_id,
          vb.batch_number,
          vb.expiration_date,
          vbs.current_stock,
          v.id AS vaccine_id,
          v.name AS vaccine_name,
          v.target_disease,
          v.presentation,
          v.dose_unit
        FROM vaccine_batch_stocks vbs
        INNER JOIN vaccine_batches vb
          ON vb.id = vbs.vaccine_batch_id
        INNER JOIN vaccines v
          ON v.id = vb.vaccine_id
        WHERE vbs.facility_id = ?
          AND vbs.current_stock > 0
          AND vb.is_active = TRUE
          AND v.is_active = TRUE
        ORDER BY
          v.name ASC,
          vb.expiration_date ASC,
          vb.batch_number ASC
      `,
      [facilityId]
    );

  return rows;
}

export async function getVaccineTransfers(
  filters: TransferFilters
) {

  const params: any[] = [];
  const where: string[] = [];

  if (filters.status && filters.status !== 'todos') {
    where.push('vt.status = ?');
    params.push(filters.status);
  }

  if (filters.facility_id) {
    where.push(
      `(
        vt.source_facility_id = ?
        OR vt.destination_facility_id = ?
      )`
    );
    params.push(filters.facility_id, filters.facility_id);
  }

  if (filters.date_from) {
    where.push('vt.transfer_date >= ?');
    params.push(filters.date_from);
  }

  if (filters.date_to) {
    where.push('vt.transfer_date <= ?');
    params.push(filters.date_to);
  }

  if (filters.search) {
    where.push(
      `(
        sf.name LIKE ?
        OR df.name LIKE ?
        OR v.name LIKE ?
        OR vb.batch_number LIKE ?
      )`
    );
    const value = `%${filters.search}%`;
    params.push(value, value, value, value);
  }

  const whereSql =
    where.length
      ? `WHERE ${where.join(' AND ')}`
      : '';

  const page =
    Math.max(1, Number(filters.page || 1));

  const pageSize =
    Math.min(100, Math.max(5, Number(filters.page_size || 10)));

  const offset =
    (page - 1) * pageSize;

  const [countRows]: any =
    await pool.query(
      `
        SELECT COUNT(DISTINCT vt.id) AS total
        FROM vaccine_transfers vt
        INNER JOIN health_facilities sf
          ON sf.id = vt.source_facility_id
        INNER JOIN health_facilities df
          ON df.id = vt.destination_facility_id
        LEFT JOIN vaccine_transfer_items vti
          ON vti.vaccine_transfer_id = vt.id
        LEFT JOIN vaccine_batches vb
          ON vb.id = vti.vaccine_batch_id
        LEFT JOIN vaccines v
          ON v.id = vb.vaccine_id
        ${whereSql}
      `,
      params
    );

  const [rows]: any =
    await pool.query(
      `
        SELECT
          vt.id,
          vt.source_facility_id,
          sf.name AS source_facility_name,
          vt.destination_facility_id,
          df.name AS destination_facility_name,
          vt.transfer_date,
          vt.status,
          vt.notes,
          CONCAT(cu.first_name, ' ', cu.last_name)
            AS created_by_name,
          CONCAT(ru.first_name, ' ', ru.last_name)
            AS received_by_name,
          vt.received_at,
          vt.cancelled_at,
          vt.created_at,
          COUNT(vti.id) AS item_count,
          COALESCE(SUM(vti.quantity), 0) AS total_quantity
        FROM vaccine_transfers vt
        INNER JOIN health_facilities sf
          ON sf.id = vt.source_facility_id
        INNER JOIN health_facilities df
          ON df.id = vt.destination_facility_id
        LEFT JOIN users cu
          ON cu.id = vt.created_by
        LEFT JOIN users ru
          ON ru.id = vt.received_by
        LEFT JOIN vaccine_transfer_items vti
          ON vti.vaccine_transfer_id = vt.id
        LEFT JOIN vaccine_batches vb
          ON vb.id = vti.vaccine_batch_id
        LEFT JOIN vaccines v
          ON v.id = vb.vaccine_id
        ${whereSql}
        GROUP BY
          vt.id,
          sf.name,
          df.name,
          cu.first_name,
          cu.last_name,
          ru.first_name,
          ru.last_name
        ORDER BY vt.created_at DESC, vt.id DESC
        LIMIT ? OFFSET ?
      `,
      [
        ...params,
        pageSize,
        offset
      ]
    );

  const total =
    Number(countRows[0]?.total || 0);

  return {
    items: rows,
    pagination: {
      page,
      page_size: pageSize,
      total,
      total_pages: Math.max(1, Math.ceil(total / pageSize))
    }
  };
}

export async function getVaccineTransferById(
  id: number
) {

  const [transferRows]: any =
    await pool.query(
      `
        SELECT
          vt.*,
          sf.name AS source_facility_name,
          df.name AS destination_facility_name,
          CONCAT(cu.first_name, ' ', cu.last_name)
            AS created_by_name,
          CONCAT(ru.first_name, ' ', ru.last_name)
            AS received_by_name
        FROM vaccine_transfers vt
        INNER JOIN health_facilities sf
          ON sf.id = vt.source_facility_id
        INNER JOIN health_facilities df
          ON df.id = vt.destination_facility_id
        LEFT JOIN users cu
          ON cu.id = vt.created_by
        LEFT JOIN users ru
          ON ru.id = vt.received_by
        WHERE vt.id = ?
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
          vti.id,
          vti.vaccine_batch_id,
          vti.quantity,
          vb.batch_number,
          vb.expiration_date,
          v.name AS vaccine_name,
          v.target_disease,
          v.presentation,
          v.dose_unit
        FROM vaccine_transfer_items vti
        INNER JOIN vaccine_batches vb
          ON vb.id = vti.vaccine_batch_id
        INNER JOIN vaccines v
          ON v.id = vb.vaccine_id
        WHERE vti.vaccine_transfer_id = ?
        ORDER BY v.name ASC, vb.expiration_date ASC
      `,
      [id]
    );

  return {
    ...transferRows[0],
    items
  };
}

export async function createVaccineTransfer(
  data: VaccineTransferInput
) {

  const connection =
    await pool.getConnection();

  try {

    await connection.beginTransaction();

    if (data.source_facility_id === data.destination_facility_id) {
      throw new Error(
        'El origen y destino no pueden ser el mismo punto'
      );
    }

    const [result]: any =
      await connection.query(
        `
          INSERT INTO vaccine_transfers (
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
        Number(item.vaccine_batch_id),
        data.source_facility_id,
        quantity * -1
      );

      await connection.query(
        `
          INSERT INTO vaccine_transfer_items (
            vaccine_transfer_id,
            vaccine_batch_id,
            quantity
          )
          VALUES (?, ?, ?)
        `,
        [
          transferId,
          Number(item.vaccine_batch_id),
          quantity
        ]
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

export async function updateVaccineTransfer(
  id: number,
  data: VaccineTransferInput
) {

  const connection =
    await pool.getConnection();

  try {

    await connection.beginTransaction();

    if (data.source_facility_id === data.destination_facility_id) {
      throw new Error(
        'El origen y destino no pueden ser el mismo punto'
      );
    }

    const [transferRows]: any =
      await connection.query(
        `
          SELECT *
          FROM vaccine_transfers
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
        'Solo se pueden editar traslados enviados'
      );
    }

    const [previousItems]: any =
      await connection.query(
        `
          SELECT vaccine_batch_id, quantity
          FROM vaccine_transfer_items
          WHERE vaccine_transfer_id = ?
        `,
        [id]
      );

    for (const item of previousItems) {
      await updateFacilityStock(
        connection,
        Number(item.vaccine_batch_id),
        Number(transfer.source_facility_id),
        Number(item.quantity)
      );
    }

    await connection.query(
      `
        UPDATE vaccine_transfers
        SET
          source_facility_id = ?,
          destination_facility_id = ?,
          transfer_date = ?,
          notes = ?
        WHERE id = ?
      `,
      [
        data.source_facility_id,
        data.destination_facility_id,
        data.transfer_date,
        data.notes ?? null,
        id
      ]
    );

    await connection.query(
      `
        DELETE FROM vaccine_transfer_items
        WHERE vaccine_transfer_id = ?
      `,
      [id]
    );

    for (const item of data.items) {
      const quantity =
        Number(item.quantity);

      await updateFacilityStock(
        connection,
        Number(item.vaccine_batch_id),
        data.source_facility_id,
        quantity * -1
      );

      await connection.query(
        `
          INSERT INTO vaccine_transfer_items (
            vaccine_transfer_id,
            vaccine_batch_id,
            quantity
          )
          VALUES (?, ?, ?)
        `,
        [
          id,
          Number(item.vaccine_batch_id),
          quantity
        ]
      );
    }

    await connection.commit();

  } catch (error) {

    await connection.rollback();
    throw error;

  } finally {

    connection.release();
  }
}

export async function reactivateVaccineTransfer(
  id: number
) {

  const connection =
    await pool.getConnection();

  try {

    await connection.beginTransaction();

    const [transferRows]: any =
      await connection.query(
        `
          SELECT *
          FROM vaccine_transfers
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

    if (transfer.status !== 'cancelado') {
      throw new Error(
        'Solo se pueden reactivar traslados cancelados'
      );
    }

    const [items]: any =
      await connection.query(
        `
          SELECT vaccine_batch_id, quantity
          FROM vaccine_transfer_items
          WHERE vaccine_transfer_id = ?
        `,
        [id]
      );

    for (const item of items) {
      await updateFacilityStock(
        connection,
        Number(item.vaccine_batch_id),
        Number(transfer.source_facility_id),
        Number(item.quantity) * -1
      );
    }

    await connection.query(
      `
        UPDATE vaccine_transfers
        SET
          status = 'enviado',
          cancelled_by = NULL,
          cancelled_at = NULL
        WHERE id = ?
      `,
      [id]
    );

    await connection.commit();

  } catch (error) {

    await connection.rollback();
    throw error;

  } finally {

    connection.release();
  }
}

export async function receiveVaccineTransfer(
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
          FROM vaccine_transfers
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
          SELECT vaccine_batch_id, quantity
          FROM vaccine_transfer_items
          WHERE vaccine_transfer_id = ?
        `,
        [id]
      );

    for (const item of items) {
      await updateFacilityStock(
        connection,
        Number(item.vaccine_batch_id),
        Number(transfer.destination_facility_id),
        Number(item.quantity)
      );
    }

    await connection.query(
      `
        UPDATE vaccine_transfers
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

export async function cancelVaccineTransfer(
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
          FROM vaccine_transfers
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
          SELECT vaccine_batch_id, quantity
          FROM vaccine_transfer_items
          WHERE vaccine_transfer_id = ?
        `,
        [id]
      );

    for (const item of items) {
      await updateFacilityStock(
        connection,
        Number(item.vaccine_batch_id),
        Number(transfer.source_facility_id),
        Number(item.quantity)
      );
    }

    await connection.query(
      `
        UPDATE vaccine_transfers
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
