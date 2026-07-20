import { pool }
  from '../../config/database';

import {
  MedicationDeliveryInput
} from './medication-deliveries.types';

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
    throw new Error(negativeMessage);
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
}

async function insertDeliveryMovement(
  connection: any,
  batchId: number,
  facilityId: number,
  movementType: string,
  quantity: number,
  deliveryId: number,
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
      'medication_delivery',
      deliveryId,
      `Entrega de medicacion #${deliveryId}`,
      userId ?? null
    ]
  );
}

export async function getMedicationDeliveries(
  filters: DeliveryFilters
) {

  const params: any[] = [];
  const where: string[] = [];

  if (filters.facility_id) {
    where.push('md.facility_id = ?');
    params.push(filters.facility_id);
  }

  if (filters.status && filters.status !== 'todos') {
    where.push('md.status = ?');
    params.push(filters.status);
  }

  if (filters.reason && filters.reason !== 'todos') {
    where.push('md.delivery_reason = ?');
    params.push(filters.reason);
  }

  if (filters.date_from) {
    where.push('md.delivery_date >= ?');
    params.push(filters.date_from);
  }

  if (filters.date_to) {
    where.push('md.delivery_date <= ?');
    params.push(filters.date_to);
  }

  if (filters.search) {
    where.push(
      `(
        md.patient_name LIKE ?
        OR md.patient_document LIKE ?
        OR hf.name LIKE ?
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
          md.id,
          md.facility_id,
          hf.name AS facility_name,
          md.delivery_date,
          md.patient_id,
          md.patient_name,
          md.patient_document,
          md.patient_phone,
          md.delivery_reason,
          md.status,
          md.notes,
          md.created_by,
          CONCAT(cu.first_name, ' ', cu.last_name)
            AS created_by_name,
          md.cancelled_by,
          md.cancelled_at,
          md.created_at,
          COUNT(mdi.id) AS item_count,
          COALESCE(SUM(mdi.quantity), 0) AS total_quantity
        FROM medication_deliveries md
        INNER JOIN health_facilities hf
          ON hf.id = md.facility_id
        LEFT JOIN users cu
          ON cu.id = md.created_by
        LEFT JOIN medication_delivery_items mdi
          ON mdi.medication_delivery_id = md.id
        LEFT JOIN medication_batches mb
          ON mb.id = mdi.medication_batch_id
        LEFT JOIN medications m
          ON m.id = mb.medication_id
        ${whereSql}
        GROUP BY
          md.id,
          hf.name,
          cu.first_name,
          cu.last_name
        ORDER BY md.delivery_date DESC, md.id DESC
      `,
      params
    );

  return rows;
}

export async function getMedicationDeliveryById(
  id: number
) {

  const [deliveryRows]: any =
    await pool.query(
      `
        SELECT
          md.id,
          md.facility_id,
          hf.name AS facility_name,
          md.delivery_date,
          md.patient_id,
          md.patient_name,
          md.patient_document,
          md.patient_phone,
          md.delivery_reason,
          md.status,
          md.notes,
          md.created_by,
          CONCAT(cu.first_name, ' ', cu.last_name)
            AS created_by_name,
          md.cancelled_by,
          md.cancelled_at,
          md.created_at
        FROM medication_deliveries md
        INNER JOIN health_facilities hf
          ON hf.id = md.facility_id
        LEFT JOIN users cu
          ON cu.id = md.created_by
        WHERE md.id = ?
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
          mdi.id,
          mdi.medication_batch_id,
          mdi.quantity,
          mb.batch_number,
          mb.expiration_date,
          m.name AS medication_name,
          m.generic_name,
          m.presentation,
          m.concentration,
          m.unit
        FROM medication_delivery_items mdi
        INNER JOIN medication_batches mb
          ON mb.id = mdi.medication_batch_id
        INNER JOIN medications m
          ON m.id = mb.medication_id
        WHERE mdi.medication_delivery_id = ?
        ORDER BY m.name ASC, mb.expiration_date ASC
      `,
      [id]
    );

  return {
    ...deliveryRows[0],
    items
  };
}

export async function createMedicationDelivery(
  data: MedicationDeliveryInput
) {

  const connection =
    await pool.getConnection();

  try {

    await connection.beginTransaction();

    const [result]: any =
      await connection.query(
        `
          INSERT INTO medication_deliveries (
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
        Number(item.medication_batch_id),
        data.facility_id,
        quantity * -1,
        'La entrega deja stock negativo en el punto seleccionado'
      );

      await connection.query(
        `
          INSERT INTO medication_delivery_items (
            medication_delivery_id,
            medication_batch_id,
            quantity
          )
          VALUES (?, ?, ?)
        `,
        [
          deliveryId,
          Number(item.medication_batch_id),
          quantity
        ]
      );

      await insertDeliveryMovement(
        connection,
        Number(item.medication_batch_id),
        data.facility_id,
        'entrega_paciente',
        quantity * -1,
        deliveryId,
        data.created_by
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

export async function updateMedicationDelivery(
  id: number,
  data: MedicationDeliveryInput
) {

  const connection =
    await pool.getConnection();

  try {

    await connection.beginTransaction();

    const [deliveryRows]: any =
      await connection.query(
        `
          SELECT *
          FROM medication_deliveries
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
        'Solo se pueden editar entregas activas'
      );
    }

    const [oldItems]: any =
      await connection.query(
        `
          SELECT medication_batch_id, quantity
          FROM medication_delivery_items
          WHERE medication_delivery_id = ?
        `,
        [id]
      );

    for (const item of oldItems) {
      await updateFacilityStock(
        connection,
        Number(item.medication_batch_id),
        Number(delivery.facility_id),
        Number(item.quantity),
        'No se pudo devolver el stock anterior de la entrega'
      );
    }

    await connection.query(
      `
        UPDATE medication_deliveries
        SET
          facility_id = ?,
          delivery_date = ?,
          patient_id = ?,
          patient_name = ?,
          patient_document = ?,
          patient_phone = ?,
          delivery_reason = ?,
          notes = ?
        WHERE id = ?
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
        id
      ]
    );

    await connection.query(
      `
        DELETE FROM medication_delivery_items
        WHERE medication_delivery_id = ?
      `,
      [id]
    );

    for (const item of data.items) {
      const quantity =
        Number(item.quantity);

      await updateFacilityStock(
        connection,
        Number(item.medication_batch_id),
        data.facility_id,
        quantity * -1,
        'La entrega deja stock negativo en el punto seleccionado'
      );

      await connection.query(
        `
          INSERT INTO medication_delivery_items (
            medication_delivery_id,
            medication_batch_id,
            quantity
          )
          VALUES (?, ?, ?)
        `,
        [
          id,
          Number(item.medication_batch_id),
          quantity
        ]
      );

      await insertDeliveryMovement(
        connection,
        Number(item.medication_batch_id),
        data.facility_id,
        'edicion_entrega_paciente',
        quantity * -1,
        id,
        data.created_by
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

export async function cancelMedicationDelivery(
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
          FROM medication_deliveries
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
          SELECT medication_batch_id, quantity
          FROM medication_delivery_items
          WHERE medication_delivery_id = ?
        `,
        [id]
      );

    for (const item of items) {
      const quantity =
        Number(item.quantity);

      await updateFacilityStock(
        connection,
        Number(item.medication_batch_id),
        Number(delivery.facility_id),
        quantity,
        'No se pudo devolver el stock de la entrega'
      );

      await insertDeliveryMovement(
        connection,
        Number(item.medication_batch_id),
        Number(delivery.facility_id),
        'cancelacion_entrega_paciente',
        quantity,
        id,
        userId
      );
    }

    await connection.query(
      `
        UPDATE medication_deliveries
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
