import { pool }
  from '../../config/database';

import {
  VaccineDeliveryInput
} from './vaccine-deliveries.types';

type DeliveryFilters = {
  facility_id?: number;
  status?: string;
  reason?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
};

async function updateFacilityStock(
  connection: any,
  batchId: number,
  facilityId: number,
  signedQuantity: number,
  negativeMessage: string
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
    throw new Error(negativeMessage);
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

export async function getVaccineDeliveries(
  filters: DeliveryFilters
) {

  const params: any[] = [];
  const where: string[] = [];

  if (filters.facility_id) {
    where.push('vd.facility_id = ?');
    params.push(filters.facility_id);
  }

  if (filters.status && filters.status !== 'todos') {
    where.push('vd.status = ?');
    params.push(filters.status);
  }

  if (filters.reason && filters.reason !== 'todos') {
    where.push('vd.delivery_reason = ?');
    params.push(filters.reason);
  }

  if (filters.date_from) {
    where.push('vd.delivery_date >= ?');
    params.push(filters.date_from);
  }

  if (filters.date_to) {
    where.push('vd.delivery_date <= ?');
    params.push(filters.date_to);
  }

  if (filters.search) {
    where.push(
      `(
        vd.patient_name LIKE ?
        OR vd.patient_document LIKE ?
        OR hf.name LIKE ?
        OR v.name LIKE ?
        OR vb.batch_number LIKE ?
      )`
    );
    const value = `%${filters.search}%`;
    params.push(value, value, value, value, value);
  }

  const whereSql =
    where.length
      ? `WHERE ${where.join(' AND ')}`
      : '';

  const [rows]: any =
    await pool.query(
      `
        SELECT
          vd.id,
          vd.facility_id,
          hf.name AS facility_name,
          vd.delivery_date,
          vd.patient_id,
          vd.patient_name,
          vd.patient_document,
          vd.patient_phone,
          vd.delivery_reason,
          vd.status,
          vd.notes,
          CONCAT(cu.first_name, ' ', cu.last_name)
            AS created_by_name,
          vd.cancelled_at,
          vd.created_at,
          COUNT(vdi.id) AS item_count,
          COALESCE(SUM(vdi.quantity), 0) AS total_quantity
        FROM vaccine_deliveries vd
        INNER JOIN health_facilities hf
          ON hf.id = vd.facility_id
        LEFT JOIN users cu
          ON cu.id = vd.created_by
        LEFT JOIN vaccine_delivery_items vdi
          ON vdi.vaccine_delivery_id = vd.id
        LEFT JOIN vaccine_batches vb
          ON vb.id = vdi.vaccine_batch_id
        LEFT JOIN vaccines v
          ON v.id = vb.vaccine_id
        ${whereSql}
        GROUP BY
          vd.id,
          hf.name,
          cu.first_name,
          cu.last_name
        ORDER BY vd.delivery_date DESC, vd.id DESC
      `,
      params
    );

  return rows;
}

export async function getVaccineDeliveryById(
  id: number
) {

  const [deliveryRows]: any =
    await pool.query(
      `
        SELECT
          vd.*,
          hf.name AS facility_name,
          CONCAT(cu.first_name, ' ', cu.last_name)
            AS created_by_name
        FROM vaccine_deliveries vd
        INNER JOIN health_facilities hf
          ON hf.id = vd.facility_id
        LEFT JOIN users cu
          ON cu.id = vd.created_by
        WHERE vd.id = ?
      `,
      [id]
    );

  if (deliveryRows.length === 0) {
    return null;
  }

  const [items]: any =
    await pool.query(
      `
        SELECT
          vdi.id,
          vdi.vaccine_batch_id,
          vdi.quantity,
          vb.batch_number,
          vb.expiration_date,
          v.name AS vaccine_name,
          v.target_disease,
          v.presentation,
          v.dose_unit
        FROM vaccine_delivery_items vdi
        INNER JOIN vaccine_batches vb
          ON vb.id = vdi.vaccine_batch_id
        INNER JOIN vaccines v
          ON v.id = vb.vaccine_id
        WHERE vdi.vaccine_delivery_id = ?
        ORDER BY v.name ASC, vb.expiration_date ASC
      `,
      [id]
    );

  return {
    ...deliveryRows[0],
    items
  };
}

export async function createVaccineDelivery(
  data: VaccineDeliveryInput
) {

  const connection =
    await pool.getConnection();

  try {

    await connection.beginTransaction();

    const [result]: any =
      await connection.query(
        `
          INSERT INTO vaccine_deliveries (
            facility_id,
            delivery_date,
            patient_id,
            patient_name,
            patient_document,
            patient_phone,
            delivery_reason,
            status,
            notes,
            created_by
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, 'entregado', ?, ?)
        `,
        [
          data.facility_id,
          data.delivery_date,
          data.patient_id ?? null,
          data.patient_name,
          data.patient_document ?? null,
          data.patient_phone ?? null,
          data.delivery_reason,
          data.notes ?? null,
          data.created_by ?? null
        ]
      );

    const deliveryId =
      Number(result.insertId);

    for (const item of data.items) {
      const quantity =
        Number(item.quantity);

      await updateFacilityStock(
        connection,
        Number(item.vaccine_batch_id),
        data.facility_id,
        quantity * -1,
        'La entrega deja stock negativo en el punto seleccionado'
      );

      await connection.query(
        `
          INSERT INTO vaccine_delivery_items (
            vaccine_delivery_id,
            vaccine_batch_id,
            quantity
          )
          VALUES (?, ?, ?)
        `,
        [
          deliveryId,
          Number(item.vaccine_batch_id),
          quantity
        ]
      );
    }

    await connection.commit();

    return deliveryId;

  } catch (error) {

    await connection.rollback();
    throw error;

  } finally {

    connection.release();
  }
}

export async function cancelVaccineDelivery(
  id: number,
  userId?: number | null
) {

  const connection =
    await pool.getConnection();

  try {

    await connection.beginTransaction();

    const [deliveryRows]: any =
      await connection.query(
        `
          SELECT *
          FROM vaccine_deliveries
          WHERE id = ?
          FOR UPDATE
        `,
        [id]
      );

    if (deliveryRows.length === 0) {
      throw new Error('Entrega no encontrada');
    }

    const delivery =
      deliveryRows[0];

    if (delivery.status !== 'entregado') {
      throw new Error(
        'Solo se pueden cancelar entregas activas'
      );
    }

    const [items]: any =
      await connection.query(
        `
          SELECT vaccine_batch_id, quantity
          FROM vaccine_delivery_items
          WHERE vaccine_delivery_id = ?
        `,
        [id]
      );

    for (const item of items) {
      await updateFacilityStock(
        connection,
        Number(item.vaccine_batch_id),
        Number(delivery.facility_id),
        Number(item.quantity),
        'No se pudo devolver el stock de la entrega'
      );
    }

    await connection.query(
      `
        UPDATE vaccine_deliveries
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
