import { pool }
  from '../../config/database';

import {
  ChronicPackageDeliveryItemInput,
  ChronicPackageInput,
  ChronicPatientInput,
  ChronicPlanItemInput,
  ChronicPackageTransferItemInput
} from './chronic-medications.types';

type ChronicFilters = {
  search?: string;
  status?: string;
  facility_id?: number;
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
      'El retiro deja stock negativo en el punto seleccionado'
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
}

async function insertDeliveryMovement(
  connection: any,
  batchId: number,
  facilityId: number,
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
      VALUES (?, ?, 'entrega_paciente', ?, 'medication_delivery', ?, ?, ?)
    `,
    [
      batchId,
      facilityId,
      quantity * -1,
      deliveryId,
      `Entrega cronica #${deliveryId}`,
      userId ?? null
    ]
  );
}

async function getSecretaryFacilityId(
  connection: any
) {

  const [rows]: any =
    await connection.query(
      `
        SELECT id
        FROM health_facilities
        WHERE facility_type = 'secretaria'
          AND is_active = TRUE
        ORDER BY id ASC
        LIMIT 1
      `
    );

  if (rows.length === 0) {
    throw new Error(
      'No hay Secretaria de Salud activa para preparar paquetes'
    );
  }

  return Number(rows[0].id);
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
      VALUES (?, ?, ?, ?, 'medication_transfer', ?, ?, ?)
    `,
    [
      batchId,
      facilityId,
      movementType,
      quantity,
      transferId,
      `Traslado paquete cronico #${transferId}`,
      userId ?? null
    ]
  );
}

export async function getChronicPatients(
  filters: ChronicFilters
) {

  const params: any[] = [];
  const where: string[] = [];

  if (filters.status && filters.status !== 'todos') {
    where.push('cp.is_active = ?');
    params.push(filters.status === 'activos');
  }

  if (filters.search) {
    where.push(
      `(
        cp.full_name LIKE ?
        OR cp.document_number LIKE ?
        OR hf.name LIKE ?
      )`
    );
    const value =
      `%${filters.search}%`;
    params.push(value, value, value);
  }

  if (filters.facility_id) {
    where.push('cp.default_facility_id = ?');
    params.push(filters.facility_id);
  }

  const whereSql =
    where.length
      ? `WHERE ${where.join(' AND ')}`
      : '';

  const [rows]: any =
    await pool.query(
      `
        SELECT
          cp.id,
          cp.full_name,
          cp.document_number,
          cp.phone,
          cp.address,
          cp.default_facility_id,
          hf.name AS default_facility_name,
          cp.notes,
          cp.is_active,
          cp.created_at,
          COUNT(DISTINCT cpi.id) AS active_plan_items,
          COUNT(DISTINCT cmp.id) AS package_count,
          SUM(
            CASE
              WHEN cmp.status IN ('preparado', 'enviado', 'recibido', 'parcial')
                THEN 1
              ELSE 0
            END
          ) AS pending_packages
        FROM chronic_patients cp
        LEFT JOIN health_facilities hf
          ON hf.id = cp.default_facility_id
        LEFT JOIN chronic_medication_plan_items cpi
          ON cpi.chronic_patient_id = cp.id
          AND cpi.is_active = TRUE
        LEFT JOIN chronic_medication_packages cmp
          ON cmp.chronic_patient_id = cp.id
          AND cmp.status IN ('preparado', 'enviado', 'recibido', 'parcial')
        ${whereSql}
        GROUP BY
          cp.id,
          hf.name
        ORDER BY cp.full_name ASC
      `,
      params
    );

  return rows;
}

export async function getChronicPatientById(
  id: number
) {

  const [patientRows]: any =
    await pool.query(
      `
        SELECT
          cp.id,
          cp.full_name,
          cp.document_number,
          cp.phone,
          cp.address,
          cp.default_facility_id,
          hf.name AS default_facility_name,
          cp.notes,
          cp.is_active,
          cp.created_at
        FROM chronic_patients cp
        LEFT JOIN health_facilities hf
          ON hf.id = cp.default_facility_id
        WHERE cp.id = ?
      `,
      [id]
    );

  if (patientRows.length === 0) {
    return null;
  }

  const [planItems]: any =
    await pool.query(
      `
        SELECT
          cpi.id,
          cpi.medication_id,
          m.name AS medication_name,
          m.generic_name,
          m.presentation,
          m.concentration,
          m.unit,
          cpi.monthly_quantity,
          cpi.instructions,
          cpi.is_active
        FROM chronic_medication_plan_items cpi
        INNER JOIN medications m
          ON m.id = cpi.medication_id
        WHERE cpi.chronic_patient_id = ?
        ORDER BY cpi.is_active DESC, m.name ASC
      `,
      [id]
    );

  const [packages]: any =
    await pool.query(
      `
        SELECT
          cmp.id,
          cmp.facility_id,
          hf.name AS facility_name,
          cmp.package_year,
          cmp.package_month,
          cmp.status,
          cmp.delivered_at,
          cmp.not_picked_up_at,
          cmp.notes,
          cmp.medication_transfer_id,
          mt.status AS medication_transfer_status,
          cmp.medication_delivery_id,
          cmp.created_at
        FROM chronic_medication_packages cmp
        INNER JOIN health_facilities hf
          ON hf.id = cmp.facility_id
        LEFT JOIN medication_transfers mt
          ON mt.id = cmp.medication_transfer_id
        WHERE cmp.chronic_patient_id = ?
        ORDER BY cmp.package_year DESC, cmp.package_month DESC
      `,
      [id]
    );

  return {
    ...patientRows[0],
    plan_items: planItems,
    packages
  };
}

export async function createChronicPatient(
  data: ChronicPatientInput
) {

  const [result]: any =
    await pool.query(
      `
        INSERT INTO chronic_patients (
          full_name,
          document_number,
          phone,
          address,
          default_facility_id,
          notes
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        data.full_name,
        data.document_number ?? null,
        data.phone ?? null,
        data.address ?? null,
        data.default_facility_id ?? null,
        data.notes ?? null
      ]
    );

  return result.insertId;
}

export async function updateChronicPatient(
  id: number,
  data: ChronicPatientInput
) {

  await pool.query(
    `
      UPDATE chronic_patients
      SET
        full_name = ?,
        document_number = ?,
        phone = ?,
        address = ?,
        default_facility_id = ?,
        notes = ?
      WHERE id = ?
    `,
    [
      data.full_name,
      data.document_number ?? null,
      data.phone ?? null,
      data.address ?? null,
      data.default_facility_id ?? null,
      data.notes ?? null,
      id
    ]
  );
}

export async function toggleChronicPatient(
  id: number
) {

  await pool.query(
    `
      UPDATE chronic_patients
      SET is_active = NOT is_active
      WHERE id = ?
    `,
    [id]
  );
}

export async function addChronicPlanItem(
  patientId: number,
  data: ChronicPlanItemInput
) {

  const [result]: any =
    await pool.query(
      `
        INSERT INTO chronic_medication_plan_items (
          chronic_patient_id,
          medication_id,
          monthly_quantity,
          instructions
        )
        VALUES (?, ?, ?, ?)
      `,
      [
        patientId,
        data.medication_id,
        data.monthly_quantity,
        data.instructions ?? null
      ]
    );

  return result.insertId;
}

export async function toggleChronicPlanItem(
  id: number
) {

  await pool.query(
    `
      UPDATE chronic_medication_plan_items
      SET is_active = NOT is_active
      WHERE id = ?
    `,
    [id]
  );
}

export async function createChronicPackage(
  data: ChronicPackageInput
) {

  const connection =
    await pool.getConnection();

  try {

    await connection.beginTransaction();

    const [existingMonthRows]: any =
      await connection.query(
        `
          SELECT id, status
          FROM chronic_medication_packages
          WHERE chronic_patient_id = ?
            AND package_year = ?
            AND package_month = ?
          LIMIT 1
        `,
        [
          data.chronic_patient_id,
          data.package_year,
          data.package_month
        ]
      );

    if (existingMonthRows.length > 0) {
      throw new Error(
        `Este paciente ya tiene un paquete creado para ${data.package_month}/${data.package_year}`
      );
    }

    const [pendingRows]: any =
      await connection.query(
        `
          SELECT id, package_year, package_month
          FROM chronic_medication_packages
          WHERE chronic_patient_id = ?
            AND status IN ('preparado', 'enviado', 'recibido', 'parcial', 'no_retirado')
          ORDER BY package_year DESC, package_month DESC
          LIMIT 1
        `,
        [data.chronic_patient_id]
      );

    if (pendingRows.length > 0) {
      const pending =
        pendingRows[0];

      throw new Error(
        `El paciente tiene un paquete pendiente/no retirado (${pending.package_month}/${pending.package_year})`
      );
    }

    const [planItems]: any =
      await connection.query(
        `
          SELECT medication_id, monthly_quantity
          FROM chronic_medication_plan_items
          WHERE chronic_patient_id = ?
            AND is_active = TRUE
        `,
        [data.chronic_patient_id]
      );

    if (planItems.length === 0) {
      throw new Error(
        'El paciente no tiene medicacion activa en el plan'
      );
    }

    const [result]: any =
      await connection.query(
        `
          INSERT INTO chronic_medication_packages (
            chronic_patient_id,
            facility_id,
            package_year,
            package_month,
            status,
            prepared_by,
            notes
          )
          VALUES (?, ?, ?, ?, 'preparado', ?, ?)
        `,
        [
          data.chronic_patient_id,
          data.facility_id,
          data.package_year,
          data.package_month,
          data.prepared_by ?? null,
          data.notes ?? null
        ]
      );

    const packageId =
      Number(result.insertId);

    for (const item of planItems) {
      await connection.query(
        `
          INSERT INTO chronic_medication_package_items (
            chronic_medication_package_id,
            medication_id,
            planned_quantity
          )
          VALUES (?, ?, ?)
        `,
        [
          packageId,
          Number(item.medication_id),
          Number(item.monthly_quantity)
        ]
      );
    }

    await connection.commit();

    return packageId;

  } catch (error: any) {

    await connection.rollback();

    if (
      error?.code === 'ER_DUP_ENTRY' &&
      String(error?.message || '').includes(
        'uq_chronic_package_patient_month'
      )
    ) {
      throw new Error(
        `Este paciente ya tiene un paquete creado para ${data.package_month}/${data.package_year}`
      );
    }

    throw error;

  } finally {

    connection.release();
  }
}

export async function getChronicPackageById(
  id: number
) {

  const [packageRows]: any =
    await pool.query(
      `
        SELECT
          cmp.id,
          cmp.chronic_patient_id,
          cp.full_name AS patient_name,
          cp.document_number AS patient_document,
          cp.phone AS patient_phone,
          cmp.facility_id,
          hf.name AS facility_name,
          cmp.package_year,
          cmp.package_month,
          cmp.status,
          cmp.notes,
          cmp.medication_transfer_id,
          mt.status AS medication_transfer_status,
          cmp.medication_delivery_id,
          cmp.created_at
        FROM chronic_medication_packages cmp
        INNER JOIN chronic_patients cp
          ON cp.id = cmp.chronic_patient_id
        INNER JOIN health_facilities hf
          ON hf.id = cmp.facility_id
        LEFT JOIN medication_transfers mt
          ON mt.id = cmp.medication_transfer_id
        WHERE cmp.id = ?
      `,
      [id]
    );

  if (packageRows.length === 0) {
    return null;
  }

  const [items]: any =
    await pool.query(
      `
        SELECT
          cpi.id,
          cpi.medication_id,
          m.name AS medication_name,
          m.generic_name,
          m.presentation,
          m.concentration,
          m.unit,
          cpi.medication_batch_id,
          mb.batch_number,
          mb.expiration_date,
          cpi.planned_quantity,
          cpi.delivered_quantity,
          cpi.item_status,
          cpi.notes
        FROM chronic_medication_package_items cpi
        INNER JOIN medications m
          ON m.id = cpi.medication_id
        LEFT JOIN medication_batches mb
          ON mb.id = cpi.medication_batch_id
        WHERE cpi.chronic_medication_package_id = ?
        ORDER BY m.name ASC
      `,
      [id]
    );

  return {
    ...packageRows[0],
    items
  };
}

export async function markPackageNotPickedUp(
  id: number
) {

  await pool.query(
    `
      UPDATE chronic_medication_packages
      SET
        status = 'no_retirado',
        not_picked_up_at = NOW()
      WHERE id = ?
        AND status IN ('preparado', 'enviado', 'recibido', 'parcial')
    `,
    [id]
  );
}

async function getPackageForMovement(
  connection: any,
  id: number
) {

  const [packageRows]: any =
    await connection.query(
      `
        SELECT
          cmp.*,
          cp.full_name
        FROM chronic_medication_packages cmp
        INNER JOIN chronic_patients cp
          ON cp.id = cmp.chronic_patient_id
        WHERE cmp.id = ?
        FOR UPDATE
      `,
      [id]
    );

  if (packageRows.length === 0) {
    throw new Error('Paquete no encontrado');
  }

  return packageRows[0];
}

async function getPackageTransferItems(
  connection: any,
  packageId: number
) {

  const [items]: any =
    await connection.query(
      `
        SELECT
          id,
          medication_batch_id,
          planned_quantity,
          delivered_quantity
        FROM chronic_medication_package_items
        WHERE chronic_medication_package_id = ?
          AND item_status IN ('enviado', 'retirado')
      `,
      [packageId]
    );

  if (items.length === 0) {
    throw new Error('El paquete no tiene medicamentos');
  }

  return items.map((item: any) => {
    const batchId =
      item.medication_batch_id
        ? Number(item.medication_batch_id)
        : null;

    if (!batchId) {
      throw new Error(
        'El paquete no tiene lotes asignados. Reabrilo y envialo nuevamente desde Secretaria.'
      );
    }

    return {
      medication_batch_id: batchId,
      quantity:
        Number(
          item.delivered_quantity ||
          item.planned_quantity
        )
    };
  });
}

async function createPackageTransfer(
  connection: any,
  packageData: any,
  sourceFacilityId: number,
  destinationFacilityId: number,
  items: Array<{
    medication_batch_id: number;
    quantity: number;
  }>,
  notes: string,
  userId?: number | null
) {

  if (sourceFacilityId === destinationFacilityId) {
    throw new Error(
      'El origen y destino no pueden ser el mismo punto'
    );
  }

  const [transferResult]: any =
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
        VALUES (?, ?, CURDATE(), 'enviado', ?, ?)
      `,
      [
        sourceFacilityId,
        destinationFacilityId,
        notes,
        userId ?? null
      ]
    );

  const transferId =
    Number(transferResult.insertId);

  for (const item of items) {
    await updateFacilityStock(
      connection,
      item.medication_batch_id,
      sourceFacilityId,
      item.quantity * -1
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
        item.medication_batch_id,
        item.quantity
      ]
    );

    await insertTransferMovement(
      connection,
      item.medication_batch_id,
      sourceFacilityId,
      'traslado_envio',
      item.quantity * -1,
      transferId,
      userId
    );
  }

  return transferId;
}

export async function reopenChronicPackage(
  id: number
) {

  const connection =
    await pool.getConnection();

  try {

    await connection.beginTransaction();

    const packageData =
      await getPackageForMovement(
        connection,
        id
      );

    if (packageData.status !== 'no_retirado') {
      throw new Error(
        'Solo se pueden reabrir paquetes no retirados'
      );
    }

    const nextStatus =
      packageData.medication_transfer_id
        ? 'enviado'
        : 'preparado';

    await connection.query(
      `
        UPDATE chronic_medication_packages
        SET
          status = ?,
          not_picked_up_at = NULL
        WHERE id = ?
      `,
      [
        nextStatus,
        id
      ]
    );

    await connection.commit();

    return nextStatus;

  } catch (error) {

    await connection.rollback();

    throw error;

  } finally {

    connection.release();
  }
}

export async function returnChronicPackageToSecretary(
  id: number,
  userId?: number | null
) {

  const connection =
    await pool.getConnection();

  try {

    await connection.beginTransaction();

    const packageData =
      await getPackageForMovement(
        connection,
        id
      );

    if (packageData.status !== 'no_retirado') {
      throw new Error(
        'Solo se pueden devolver paquetes no retirados'
      );
    }

    const secretaryFacilityId =
      await getSecretaryFacilityId(connection);

    if (
      Number(packageData.facility_id) ===
      secretaryFacilityId
    ) {
      await connection.query(
        `
          UPDATE chronic_medication_packages
          SET status = 'devuelto'
          WHERE id = ?
        `,
        [id]
      );

      await connection.commit();

      return null;
    }

    const items =
      await getPackageTransferItems(
        connection,
        id
      );

    const transferId =
      await createPackageTransfer(
        connection,
        packageData,
        Number(packageData.facility_id),
        secretaryFacilityId,
        items,
        `Devolucion a Secretaria de paquete cronico ${packageData.full_name} ${packageData.package_month}/${packageData.package_year}`,
        userId
      );

    await connection.query(
      `
        UPDATE chronic_medication_packages
        SET
          status = 'devuelto',
          facility_id = ?,
          medication_transfer_id = ?
        WHERE id = ?
      `,
      [
        secretaryFacilityId,
        transferId,
        id
      ]
    );

    await connection.commit();

    return transferId;

  } catch (error) {

    await connection.rollback();

    throw error;

  } finally {

    connection.release();
  }
}

export async function relocateChronicPackage(
  id: number,
  destinationFacilityId: number,
  userId?: number | null
) {

  const connection =
    await pool.getConnection();

  try {

    await connection.beginTransaction();

    const packageData =
      await getPackageForMovement(
        connection,
        id
      );

    if (packageData.status !== 'no_retirado') {
      throw new Error(
        'Solo se pueden trasladar paquetes no retirados'
      );
    }

    const items =
      await getPackageTransferItems(
        connection,
        id
      );

    const transferId =
      await createPackageTransfer(
        connection,
        packageData,
        Number(packageData.facility_id),
        destinationFacilityId,
        items,
        `Traslado a otro punto de paquete cronico ${packageData.full_name} ${packageData.package_month}/${packageData.package_year}`,
        userId
      );

    await connection.query(
      `
        UPDATE chronic_medication_packages
        SET
          status = 'enviado',
          facility_id = ?,
          medication_transfer_id = ?,
          not_picked_up_at = NULL
        WHERE id = ?
      `,
      [
        destinationFacilityId,
        transferId,
        id
      ]
    );

    await connection.commit();

    return transferId;

  } catch (error) {

    await connection.rollback();

    throw error;

  } finally {

    connection.release();
  }
}

export async function sendChronicPackage(
  id: number,
  items: ChronicPackageTransferItemInput[],
  userId?: number | null
) {

  const connection =
    await pool.getConnection();

  try {

    await connection.beginTransaction();

    const [packageRows]: any =
      await connection.query(
        `
          SELECT
            cmp.*,
            cp.full_name
          FROM chronic_medication_packages cmp
          INNER JOIN chronic_patients cp
            ON cp.id = cmp.chronic_patient_id
          WHERE cmp.id = ?
          FOR UPDATE
        `,
        [id]
      );

    if (packageRows.length === 0) {
      throw new Error('Paquete no encontrado');
    }

    const packageData =
      packageRows[0];

    if (
      packageData.status !== 'preparado' &&
      packageData.status !== 'parcial'
    ) {
      throw new Error(
        'Solo se pueden enviar paquetes preparados o parciales'
      );
    }

    const validItems =
      items.filter((item) =>
        Number(item.medication_batch_id) > 0 &&
        Number(item.quantity) > 0
      );

    if (validItems.length === 0) {
      throw new Error(
        'No se selecciono ningun lote con stock para enviar'
      );
    }

    const secretaryFacilityId =
      await getSecretaryFacilityId(connection);

    if (
      Number(packageData.facility_id) ===
      secretaryFacilityId
    ) {
      throw new Error(
        'El paquete ya tiene como punto de retiro la Secretaria de Salud'
      );
    }

    const [transferResult]: any =
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
          VALUES (?, ?, CURDATE(), 'enviado', ?, ?)
        `,
        [
          secretaryFacilityId,
          Number(packageData.facility_id),
          `Paquete cronico ${packageData.full_name} ${packageData.package_month}/${packageData.package_year}`,
          userId ?? null
        ]
      );

    const transferId =
      Number(transferResult.insertId);

    for (const item of validItems) {
      const quantity =
        Number(item.quantity);

      if (quantity <= 0) {
        throw new Error(
          'Todas las cantidades enviadas deben ser mayores a cero'
        );
      }

      const [packageItemRows]: any =
        await connection.query(
          `
            SELECT
              cpi.id,
              cpi.medication_id,
              m.name AS medication_name
            FROM chronic_medication_package_items
            cpi
            INNER JOIN medications m
              ON m.id = cpi.medication_id
            WHERE cpi.id = ?
              AND cpi.chronic_medication_package_id = ?
              AND cpi.item_status = 'pendiente'
            FOR UPDATE
          `,
          [
            item.package_item_id,
            id
          ]
        );

      if (packageItemRows.length === 0) {
        throw new Error(
          'Item del paquete no encontrado'
        );
      }

      const [stockRows]: any =
        await connection.query(
          `
            SELECT current_stock
            FROM medication_batch_stocks
            WHERE medication_batch_id = ?
              AND facility_id = ?
            FOR UPDATE
          `,
          [
            Number(item.medication_batch_id),
            secretaryFacilityId
          ]
        );

      const availableStock =
        stockRows.length > 0
          ? Number(stockRows[0].current_stock)
          : 0;

      if (availableStock < quantity) {
        throw new Error(
          `Stock insuficiente en Secretaria para ${packageItemRows[0].medication_name}. Disponible: ${availableStock}`
        );
      }

      await updateFacilityStock(
        connection,
        Number(item.medication_batch_id),
        secretaryFacilityId,
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

      await connection.query(
        `
          UPDATE chronic_medication_package_items
          SET
            medication_batch_id = ?,
            delivered_quantity = ?,
            item_status = 'enviado'
          WHERE id = ?
        `,
        [
          Number(item.medication_batch_id),
          quantity,
          Number(item.package_item_id)
        ]
      );

      await insertTransferMovement(
        connection,
        Number(item.medication_batch_id),
        secretaryFacilityId,
        'traslado_envio',
        quantity * -1,
        transferId,
        userId
      );
    }

    await connection.query(
      `
        UPDATE chronic_medication_packages
        SET
        status = 'enviado',
        medication_transfer_id = ?
      WHERE id = ?
      `,
      [
        transferId,
        id
      ]
    );

    await connection.commit();

    return transferId;

  } catch (error) {

    await connection.rollback();

    throw error;

  } finally {

    connection.release();
  }
}

export async function markChronicPackageTransferReceived(
  id: number
) {

  const connection =
    await pool.getConnection();

  try {

    await connection.beginTransaction();

    const [packageRows]: any =
      await connection.query(
        `
          SELECT id, status
          FROM chronic_medication_packages
          WHERE id = ?
          FOR UPDATE
        `,
        [id]
      );

    if (packageRows.length === 0) {
      throw new Error('Paquete no encontrado');
    }

    const packageData =
      packageRows[0];

    if (
      packageData.status !== 'enviado' &&
      packageData.status !== 'parcial'
    ) {
      await connection.commit();
      return;
    }

    const [pendingRows]: any =
      await connection.query(
        `
          SELECT COUNT(*) AS pending
          FROM chronic_medication_package_items
          WHERE chronic_medication_package_id = ?
            AND item_status = 'pendiente'
        `,
        [id]
      );

    const nextStatus =
      Number(pendingRows[0]?.pending || 0) > 0
        ? 'parcial'
        : 'recibido';

    await connection.query(
      `
        UPDATE chronic_medication_packages
        SET status = ?
        WHERE id = ?
      `,
      [
        nextStatus,
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

export async function deliverChronicPackage(
  id: number,
  items: ChronicPackageDeliveryItemInput[],
  userId?: number | null
) {

  const connection =
    await pool.getConnection();

  try {

    await connection.beginTransaction();

    const [packageRows]: any =
      await connection.query(
        `
          SELECT
            cmp.*,
            cp.full_name,
            cp.document_number,
            cp.phone
          FROM chronic_medication_packages cmp
          INNER JOIN chronic_patients cp
            ON cp.id = cmp.chronic_patient_id
          WHERE cmp.id = ?
          FOR UPDATE
        `,
        [id]
      );

    if (packageRows.length === 0) {
      throw new Error('Paquete no encontrado');
    }

    const packageData =
      packageRows[0];

    if (
      packageData.status !== 'preparado' &&
      packageData.status !== 'enviado' &&
      packageData.status !== 'recibido' &&
      packageData.status !== 'parcial'
    ) {
      throw new Error(
        'Solo se pueden retirar paquetes preparados, recibidos o parciales'
      );
    }

    if (
      packageData.status === 'enviado' ||
      packageData.status === 'recibido'
    ) {
      const [transferRows]: any =
        await connection.query(
          `
            SELECT status
            FROM medication_transfers
            WHERE id = ?
          `,
          [packageData.medication_transfer_id]
        );

      if (
        transferRows.length === 0 ||
        transferRows[0].status !== 'recibido'
      ) {
        throw new Error(
          'El paquete fue enviado, pero el traslado aun no fue recibido por el punto de retiro'
        );
      }
    }

    const validItems =
      items.filter((item) =>
        Number(item.medication_batch_id) > 0 &&
        Number(item.delivered_quantity) > 0
      );

    if (validItems.length === 0) {
      throw new Error(
        'No hay medicamentos seleccionados para retirar'
      );
    }

    const [deliveryResult]: any =
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
          VALUES (?, CURDATE(), ?, ?, ?, ?, 'cronico', 'entregado', ?, ?)
        `,
        [
          packageData.facility_id,
          packageData.chronic_patient_id,
          packageData.full_name,
          packageData.document_number,
          packageData.phone,
          `Retiro paquete cronico ${packageData.package_month}/${packageData.package_year}`,
          userId ?? null
        ]
      );

    const deliveryId =
      Number(deliveryResult.insertId);

    for (const item of validItems) {
      const deliveredQuantity =
        Number(item.delivered_quantity);

      if (deliveredQuantity <= 0) {
        throw new Error(
          'Todas las cantidades retiradas deben ser mayores a cero'
        );
      }

      const [packageItemRows]: any =
        await connection.query(
          `
            SELECT
              id,
              medication_id,
              planned_quantity,
              item_status
            FROM chronic_medication_package_items
            WHERE id = ?
              AND chronic_medication_package_id = ?
              AND item_status <> 'retirado'
            FOR UPDATE
          `,
          [
            item.package_item_id,
            id
          ]
        );

      if (packageItemRows.length === 0) {
        throw new Error(
          'Item del paquete no encontrado'
        );
      }

      const packageItem =
        packageItemRows[0];

      if (
        (
          packageData.status === 'enviado' ||
          packageData.status === 'recibido'
        ) &&
        packageItem.item_status !== 'enviado'
      ) {
        throw new Error(
          'Solo se pueden retirar medicamentos enviados y recibidos'
        );
      }

      await updateFacilityStock(
        connection,
        Number(item.medication_batch_id),
        Number(packageData.facility_id),
        deliveredQuantity * -1
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
          deliveredQuantity
        ]
      );

      await connection.query(
        `
          UPDATE chronic_medication_package_items
          SET
            medication_batch_id = ?,
            delivered_quantity = ?,
            item_status = 'retirado'
          WHERE id = ?
        `,
        [
          Number(item.medication_batch_id),
          deliveredQuantity,
          Number(item.package_item_id)
        ]
      );

      await insertDeliveryMovement(
        connection,
        Number(item.medication_batch_id),
        Number(packageData.facility_id),
        deliveredQuantity,
        deliveryId,
        userId
      );
    }

    const [pendingRows]: any =
      await connection.query(
        `
          SELECT COUNT(*) AS pending
          FROM chronic_medication_package_items
          WHERE chronic_medication_package_id = ?
            AND item_status <> 'retirado'
        `,
        [id]
      );

    const nextPackageStatus =
      Number(pendingRows[0]?.pending || 0) > 0
        ? 'parcial'
        : 'retirado';

    await connection.query(
      `
        UPDATE chronic_medication_packages
        SET
          status = ?,
          delivered_by = ?,
          delivered_at = NOW(),
          medication_delivery_id = ?
        WHERE id = ?
      `,
      [
        nextPackageStatus,
        userId ?? null,
        deliveryId,
        id
      ]
    );

    await connection.commit();

    return deliveryId;

  } catch (error) {

    await connection.rollback();

    throw error;

  } finally {

    connection.release();
  }
}
