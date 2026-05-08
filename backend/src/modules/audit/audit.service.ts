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
      input.user?.id || null,
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
        LIMIT 300
      `,
      params
    );

  return rows;
}
