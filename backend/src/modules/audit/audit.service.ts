import { pool } from '../../config/database';

type AuditInput = {
  user?: any;
  module: string;
  action: string;
  entityType: string;
  entityId?: number | null;
  description: string;
  oldData?: any;
  newData?: any;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function logAudit(
  input: AuditInput
) {

  await pool.query(
    `
      INSERT INTO audit_logs (
        user_id,
        username,
        user_role,
        module,
        action,
        entity_type,
        entity_id,
        description,
        old_data,
        new_data,
        ip_address,
        user_agent
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      input.user?.userId || input.user?.id || null,
      input.user?.username || input.user?.email || null,
      input.user?.role || null,
      input.module,
      input.action,
      input.entityType,
      input.entityId || null,
      input.description,
      input.oldData
        ? JSON.stringify(input.oldData)
        : null,
      input.newData
        ? JSON.stringify(input.newData)
        : null,
      input.ipAddress || null,
      input.userAgent || null
    ]
  );
}

export async function getAuditLogs(
  filters: any
) {

  const params: any[] = [];
  const where: string[] = [];

  if (filters.search) {
    where.push(
      `(
        description LIKE ?
        OR username LIKE ?
        OR module LIKE ?
        OR action LIKE ?
        OR entity_type LIKE ?
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

  if (filters.module && filters.module !== 'todos') {
    where.push('module = ?');
    params.push(filters.module);
  }

  if (filters.action && filters.action !== 'todos') {
    where.push('action = ?');
    params.push(filters.action);
  }

  if (filters.user && filters.user !== 'todos') {
    where.push('username = ?');
    params.push(filters.user);
  }

  if (filters.date_from) {
    where.push('DATE(created_at) >= ?');
    params.push(filters.date_from);
  }

  if (filters.date_to) {
    where.push('DATE(created_at) <= ?');
    params.push(filters.date_to);
  }

  const whereSql =
    where.length
      ? `WHERE ${where.join(' AND ')}`
      : '';

  const page =
    Math.max(
      1,
      Number(filters.page || 1)
    );

  const perPage =
    Math.min(
      100,
      Math.max(
        10,
        Number(filters.per_page || 25)
      )
    );

  const offset =
    (page - 1) * perPage;

  const [countRows]: any =
    await pool.query(
      `
        SELECT COUNT(*) AS total
        FROM audit_logs
        ${whereSql}
      `,
      params
    );

  const [rows]: any =
    await pool.query(
      `
        SELECT
          id,
          user_id,
          username,
          user_role,
          module,
          action,
          entity_type,
          entity_id,
          description,
          old_data,
          new_data,
          ip_address,
          user_agent,
          created_at
        FROM audit_logs
        ${whereSql}
        ORDER BY created_at DESC, id DESC
        LIMIT ? OFFSET ?
      `,
      [
        ...params,
        perPage,
        offset
      ]
    );

  const [modules]: any =
    await pool.query(
      `
        SELECT DISTINCT module
        FROM audit_logs
        WHERE module IS NOT NULL
        ORDER BY module ASC
      `
    );

  const [actions]: any =
    await pool.query(
      `
        SELECT DISTINCT action
        FROM audit_logs
        WHERE action IS NOT NULL
        ORDER BY action ASC
      `
    );

  const total =
    Number(countRows[0]?.total || 0);

  return {
    logs: rows,
    pagination: {
      page,
      per_page: perPage,
      total,
      total_pages:
        Math.max(
          1,
          Math.ceil(total / perPage)
        )
    },
    options: {
      modules:
        modules.map((item: any) => item.module),
      actions:
        actions.map((item: any) => item.action)
    }
  };
}
