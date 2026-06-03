import { pool } from '../../config/database';
import {
  getDefaultFacilityId
} from '../health-facilities/health-facilities.service';

export async function getBatchesByVaccine(
  vaccineId: number,
  facilityId?: number | null
) {
  const stockJoinCondition =
    facilityId
      ? 'vbs.vaccine_batch_id = vb.id AND vbs.facility_id = ?'
      : 'vbs.vaccine_batch_id = vb.id';

  const stockParams =
    facilityId
      ? [facilityId, vaccineId]
      : [vaccineId];

  const scopedHaving =
    facilityId
      ? 'HAVING COUNT(vbs.vaccine_batch_id) > 0'
      : '';

  const [rows]: any =
    await pool.query(
      `
        SELECT
          vb.id,
          vb.vaccine_id,
          vb.batch_number,
          vb.expiration_date,
          COALESCE(SUM(vbs.current_stock), 0) AS current_stock,
          vb.purchase_price,
          vb.is_active,
          vb.created_at,
          vb.updated_at
        FROM vaccine_batches vb
        LEFT JOIN vaccine_batch_stocks vbs
          ON ${stockJoinCondition}
        WHERE vb.vaccine_id = ?
        GROUP BY
          vb.id,
          vb.vaccine_id,
          vb.batch_number,
          vb.expiration_date,
          vb.purchase_price,
          vb.is_active,
          vb.created_at,
          vb.updated_at
        ${scopedHaving}
        ORDER BY vb.expiration_date ASC, vb.batch_number ASC
      `,
      stockParams
    );

  if (rows.length === 0) {
    return [];
  }

  const facilityFilter =
    facilityId
      ? 'AND vbs.facility_id = ?'
      : '';

  const stockByFacilityParams =
    facilityId
      ? [
        rows.map((row: any) => row.id),
        facilityId
      ]
      : [
        rows.map((row: any) => row.id)
      ];

  const [stockRows]: any =
    await pool.query(
      `
        SELECT
          vbs.vaccine_batch_id,
          vbs.facility_id,
          hf.name AS facility_name,
          hf.facility_type,
          vbs.current_stock
        FROM vaccine_batch_stocks vbs
        INNER JOIN health_facilities hf
          ON hf.id = vbs.facility_id
        WHERE vbs.vaccine_batch_id IN (?)
          ${facilityFilter}
        ORDER BY hf.name ASC
      `,
      stockByFacilityParams
    );

  const stocksByBatch =
    stockRows.reduce(
      (acc: Record<number, any[]>, stock: any) => {
        const batchId =
          Number(stock.vaccine_batch_id);

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

export async function createVaccineBatch(
  vaccineId: number,
  data: any
) {
  const connection =
    await pool.getConnection();

  try {
    await connection.beginTransaction();

    const initialStock =
      Number(data.current_stock || 0);

    const [result]: any =
      await connection.query(
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
          initialStock,
          data.purchase_price ?? null
        ]
      );

    const batchId =
      Number(result.insertId);

    if (initialStock > 0) {
      const targetFacilityId =
        data.facility_id ??
        await getDefaultFacilityId(connection);

      if (!targetFacilityId) {
        throw new Error(
          'No hay un punto de stock activo para cargar el lote'
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
        purchase_price = ?
      WHERE id = ?
    `,
    [
      data.batch_number,
      data.expiration_date,
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
          vm.facility_id,
          hf.name AS facility_name,
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
        LEFT JOIN health_facilities hf
          ON hf.id = vm.facility_id
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

    const facilityId =
      data.facility_id
        ? Number(data.facility_id)
        : null;

    if (!facilityId) {
      throw new Error(
        'Debe seleccionar el punto de stock'
      );
    }

    const [facilityRows]: any =
      await connection.query(
        `
          SELECT id, is_active
          FROM health_facilities
          WHERE id = ?
          FOR UPDATE
        `,
        [facilityId]
      );

    if (facilityRows.length === 0) {
      throw new Error(
        'Punto de stock no encontrado'
      );
    }

    if (!facilityRows[0].is_active) {
      throw new Error(
        'No se puede mover stock en un punto inactivo'
      );
    }

    const [stockRows]: any =
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

    const currentFacilityStock =
      stockRows.length > 0
        ? Number(stockRows[0].current_stock)
        : 0;

    const newFacilityStock =
      currentFacilityStock +
      signedQuantity;

    if (newFacilityStock < 0) {
      throw new Error('El movimiento deja el stock en negativo');
    }

    const [result]: any =
      await connection.query(
        `
          INSERT INTO vaccine_movements (
            vaccine_batch_id,
            facility_id,
            movement_type,
            quantity,
            reference_type,
            notes,
            created_by
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          batchId,
          facilityId,
          data.movement_type,
          signedQuantity,
          'manual',
          data.notes ?? null,
          data.created_by ?? null
        ]
      );

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
        newFacilityStock
      ]
    );

    const [totalRows]: any =
      await connection.query(
        `
          SELECT COALESCE(SUM(current_stock), 0) AS total_stock
          FROM vaccine_batch_stocks
          WHERE vaccine_batch_id = ?
        `,
        [batchId]
      );

    const newStock =
      Number(totalRows[0]?.total_stock || 0);

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
      current_stock: newStock,
      facility_stock: newFacilityStock
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
