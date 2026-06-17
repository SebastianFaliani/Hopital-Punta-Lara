import { pool } from '../../config/database';

type ItemInput = {
  name: string;
  category?: string;
  unit?: string;
  stock_quantity?: number;
  minimum_stock?: number;
  is_returnable?: boolean;
  notes?: string | null;
};

type MovementInput = {
  movement_date: string;
  item_id: number;
  movement_type: 'entrada' | 'salida' | 'prestamo' | 'consumo';
  quantity: number;
  destination_person?: string | null;
  destination_sector?: string | null;
  delivery_signature_name?: string | null;
  delivery_signed_on_paper?: boolean;
  requires_return?: boolean;
  expected_return_date?: string | null;
  notes?: string | null;
};

type ReturnInput = {
  return_date: string;
  returned_quantity: number;
  return_signature_name?: string | null;
  return_signed_on_paper?: boolean;
  notes?: string | null;
};

function getPagination(filters: any) {
  const page =
    Math.max(1, Number(filters.page || 1));

  const perPage =
    Math.min(
      100,
      Math.max(10, Number(filters.per_page || 25))
    );

  return {
    page,
    perPage,
    offset: (page - 1) * perPage
  };
}

function buildMovementWhere(filters: any) {
  const where: string[] = [];
  const values: any[] = [];

  if (filters.search) {
    const search = `%${String(filters.search).trim()}%`;

    where.push(
      `(
        hi.name LIKE ?
        OR hm.destination_person LIKE ?
        OR hm.destination_sector LIKE ?
        OR hm.delivery_signature_name LIKE ?
        OR hm.return_signature_name LIKE ?
        OR hm.notes LIKE ?
      )`
    );

    values.push(
      search,
      search,
      search,
      search,
      search,
      search
    );
  }

  if (filters.date_from) {
    where.push('hm.movement_date >= ?');
    values.push(filters.date_from);
  }

  if (filters.date_to) {
    where.push('hm.movement_date <= ?');
    values.push(filters.date_to);
  }

  if (filters.type && filters.type !== 'todos') {
    where.push('hm.movement_type = ?');
    values.push(filters.type);
  }

  if (filters.status && filters.status !== 'todos') {
    where.push('hm.status = ?');
    values.push(filters.status);
  }

  if (filters.category && filters.category !== 'todas') {
    where.push('hi.category = ?');
    values.push(filters.category);
  }

  return {
    sql: where.length > 0
      ? `WHERE ${where.join(' AND ')}`
      : '',
    values
  };
}

export async function getHousekeepingItems(filters: any = {}) {
  const where: string[] = [];
  const values: any[] = [];

  if (filters.search) {
    const search = `%${String(filters.search).trim()}%`;
    where.push('(name LIKE ? OR notes LIKE ?)');
    values.push(search, search);
  }

  if (filters.category && filters.category !== 'todas') {
    where.push('category = ?');
    values.push(filters.category);
  }

  if (filters.status === 'activos') {
    where.push('is_active = TRUE');
  }

  if (filters.status === 'inactivos') {
    where.push('is_active = FALSE');
  }

  const whereSql =
    where.length > 0
      ? `WHERE ${where.join(' AND ')}`
      : '';

  const [rows]: any =
    await pool.query(
      `
        SELECT
          id,
          name,
          category,
          unit,
          stock_quantity,
          minimum_stock,
          is_returnable,
          is_active,
          notes,
          created_at,
          updated_at
        FROM housekeeping_items
        ${whereSql}
        ORDER BY name ASC
      `,
      values
    );

  return rows;
}

export async function getHousekeepingItemById(id: number) {
  const [rows]: any =
    await pool.query(
      `
        SELECT *
        FROM housekeeping_items
        WHERE id = ?
        LIMIT 1
      `,
      [id]
    );

  return rows[0] || null;
}

export async function createHousekeepingItem(data: ItemInput) {
  const [result]: any =
    await pool.query(
      `
        INSERT INTO housekeeping_items (
          name,
          category,
          unit,
          stock_quantity,
          minimum_stock,
          is_returnable,
          notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        data.name.trim(),
        data.category || 'material',
        data.unit || 'unidad',
        Number(data.stock_quantity || 0),
        Number(data.minimum_stock || 0),
        Boolean(data.is_returnable),
        data.notes || null
      ]
    );

  return result.insertId;
}

export async function updateHousekeepingItem(
  id: number,
  data: ItemInput
) {
  await pool.query(
    `
      UPDATE housekeeping_items
      SET
        name = ?,
        category = ?,
        unit = ?,
        minimum_stock = ?,
        is_returnable = ?,
        notes = ?
      WHERE id = ?
    `,
    [
      data.name.trim(),
      data.category || 'material',
      data.unit || 'unidad',
      Number(data.minimum_stock || 0),
      Boolean(data.is_returnable),
      data.notes || null,
      id
    ]
  );

  return true;
}

export async function toggleHousekeepingItem(id: number) {
  await pool.query(
    `
      UPDATE housekeeping_items
      SET is_active = NOT is_active
      WHERE id = ?
    `,
    [id]
  );

  return true;
}

export async function getHousekeepingMovements(filters: any = {}) {
  const where =
    buildMovementWhere(filters);

  const pagination =
    getPagination(filters);

  const [countRows]: any =
    await pool.query(
      `
        SELECT COUNT(*) AS total
        FROM housekeeping_movements hm
        INNER JOIN housekeeping_items hi
          ON hi.id = hm.item_id
        ${where.sql}
      `,
      where.values
    );

  const [rows]: any =
    await pool.query(
      `
        SELECT
          hm.id,
          hm.movement_date,
          hm.item_id,
          hi.name AS item_name,
          hi.category AS item_category,
          hi.unit,
          hm.movement_type,
          hm.quantity,
          hm.destination_person,
          hm.destination_sector,
          hm.delivery_signature_name,
          hm.delivery_signed_on_paper,
          hm.requires_return,
          hm.expected_return_date,
          hm.returned_quantity,
          hm.return_date,
          hm.return_signature_name,
          hm.return_signed_on_paper,
          hm.status,
          hm.notes,
          hm.created_at,
          cu.username AS created_by_username,
          uu.username AS updated_by_username
        FROM housekeeping_movements hm
        INNER JOIN housekeeping_items hi
          ON hi.id = hm.item_id
        LEFT JOIN users cu
          ON cu.id = hm.created_by
        LEFT JOIN users uu
          ON uu.id = hm.updated_by
        ${where.sql}
        ORDER BY hm.movement_date DESC, hm.id DESC
        LIMIT ? OFFSET ?
      `,
      [
        ...where.values,
        pagination.perPage,
        pagination.offset
      ]
    );

  const total =
    Number(countRows[0]?.total || 0);

  return {
    records: rows,
    pagination: {
      page: pagination.page,
      per_page: pagination.perPage,
      total,
      total_pages: Math.max(
        1,
        Math.ceil(total / pagination.perPage)
      )
    }
  };
}

export async function getHousekeepingMovementById(id: number) {
  const [rows]: any =
    await pool.query(
      `
        SELECT
          hm.*,
          hi.name AS item_name
        FROM housekeeping_movements hm
        INNER JOIN housekeeping_items hi
          ON hi.id = hm.item_id
        WHERE hm.id = ?
        LIMIT 1
      `,
      [id]
    );

  return rows[0] || null;
}

export async function createHousekeepingMovement(
  data: MovementInput,
  userId?: number
) {
  const connection =
    await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [itemRows]: any =
      await connection.query(
        `
          SELECT *
          FROM housekeeping_items
          WHERE id = ?
          LIMIT 1
        `,
        [Number(data.item_id)]
      );

    const item =
      itemRows[0];

    if (!item) {
      throw new Error('Elemento no encontrado');
    }

    const quantity =
      Number(data.quantity || 0);

    if (quantity <= 0) {
      throw new Error('La cantidad debe ser mayor a cero');
    }

    const requiresReturn =
      data.movement_type === 'prestamo' &&
      Boolean(data.requires_return ?? item.is_returnable);

    const status =
      requiresReturn
        ? 'pendiente_devolucion'
        : 'registrado';

    const [result]: any =
      await connection.query(
        `
          INSERT INTO housekeeping_movements (
            movement_date,
            item_id,
            movement_type,
            quantity,
            destination_person,
            destination_sector,
            delivery_signature_name,
            delivery_signed_on_paper,
            requires_return,
            expected_return_date,
            status,
            notes,
            created_by
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          data.movement_date,
          Number(data.item_id),
          data.movement_type,
          quantity,
          data.destination_person || null,
          data.destination_sector || null,
          data.delivery_signature_name || null,
          Boolean(data.delivery_signed_on_paper),
          requiresReturn,
          data.expected_return_date || null,
          status,
          data.notes || null,
          userId || null
        ]
      );

    await connection.commit();

    return result.insertId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function registerHousekeepingReturn(
  id: number,
  data: ReturnInput,
  userId?: number
) {
  const connection =
    await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [movementRows]: any =
      await connection.query(
        `
          SELECT
            hm.*,
            hi.name AS item_name
          FROM housekeeping_movements hm
          INNER JOIN housekeeping_items hi
            ON hi.id = hm.item_id
          WHERE hm.id = ?
          FOR UPDATE
        `,
        [id]
      );

    const movement =
      movementRows[0];

    if (!movement) {
      throw new Error('Movimiento no encontrado');
    }

    if (!movement.requires_return) {
      throw new Error('Este movimiento no requiere devolucion');
    }

    if (movement.status === 'devuelto') {
      throw new Error('El movimiento ya fue devuelto');
    }

    const returnedQuantity =
      Number(data.returned_quantity || 0);

    const previousReturned =
      Number(movement.returned_quantity || 0);

    const pendingQuantity =
      Number(movement.quantity || 0) - previousReturned;

    if (returnedQuantity <= 0) {
      throw new Error('La cantidad devuelta debe ser mayor a cero');
    }

    if (returnedQuantity > pendingQuantity) {
      throw new Error(
        `La devolucion supera lo pendiente. Pendiente: ${pendingQuantity}`
      );
    }

    const totalReturned =
      previousReturned + returnedQuantity;

    const status =
      totalReturned >= Number(movement.quantity)
        ? 'devuelto'
        : 'parcial';

    await connection.query(
      `
        UPDATE housekeeping_movements
        SET
          returned_quantity = ?,
          return_date = ?,
          return_signature_name = ?,
          return_signed_on_paper = ?,
          status = ?,
          notes = CONCAT(
            COALESCE(notes, ''),
            CASE
              WHEN COALESCE(notes, '') = '' THEN ''
              ELSE '\n'
            END,
            COALESCE(?, '')
          ),
          updated_by = ?
        WHERE id = ?
      `,
      [
        totalReturned,
        data.return_date,
        data.return_signature_name || null,
        Boolean(data.return_signed_on_paper),
        status,
        data.notes || null,
        userId || null,
        id
      ]
      );

    await connection.commit();

    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function cancelHousekeepingMovement(
  id: number,
  userId?: number
) {
  const connection =
    await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows]: any =
      await connection.query(
        `
          SELECT *
          FROM housekeeping_movements
          WHERE id = ?
          FOR UPDATE
        `,
        [id]
      );

    const movement =
      rows[0];

    if (!movement) {
      throw new Error('Movimiento no encontrado');
    }

    if (movement.status === 'cancelado') {
      throw new Error('El movimiento ya esta cancelado');
    }

    await connection.query(
      `
        UPDATE housekeeping_movements
        SET
          status = 'cancelado',
          updated_by = ?
        WHERE id = ?
      `,
      [
        userId || null,
        id
      ]
    );

    await connection.commit();

    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function getHousekeepingStats(filters: any = {}) {
  const where =
    buildMovementWhere(filters);

  const [summaryRows]: any =
    await pool.query(
      `
        SELECT
          COUNT(*) AS total_movements,
          SUM(CASE WHEN hm.movement_type = 'entrada' THEN 1 ELSE 0 END) AS entries,
          SUM(CASE WHEN hm.movement_type = 'salida' THEN 1 ELSE 0 END) AS exits,
          SUM(CASE WHEN hm.movement_type = 'prestamo' THEN 1 ELSE 0 END) AS loans,
          SUM(CASE WHEN hm.movement_type = 'consumo' THEN 1 ELSE 0 END) AS consumptions,
          SUM(CASE WHEN hm.status = 'pendiente_devolucion' THEN 1 ELSE 0 END) AS pending_returns,
          SUM(CASE WHEN hm.status = 'devuelto' THEN 1 ELSE 0 END) AS returned
        FROM housekeeping_movements hm
        INNER JOIN housekeeping_items hi
          ON hi.id = hm.item_id
        ${where.sql}
      `,
      where.values
    );

  const [stockRows]: any =
    await pool.query(
      `
        SELECT
          COUNT(*) AS total_items,
          SUM(CASE WHEN is_active = TRUE THEN 1 ELSE 0 END) AS active_items
        FROM housekeeping_items
      `
    );

  return {
    ...summaryRows[0],
    ...stockRows[0]
  };
}
