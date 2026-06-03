import { pool } from '../../config/database';
import {
  canAccessAllFacilities
} from '../health-facilities/facility-access';

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
  filters: any,
  user?: any
) {

  const params: any[] = [];
  const where: string[] = [];

  if (
    user &&
    !canAccessAllFacilities(user)
  ) {
    where.push('audit_user.facility_id = ?');
    params.push(Number(user.facility_id));
  }

  if (filters.search) {
    where.push(
      `(
        al.description LIKE ?
        OR al.username LIKE ?
        OR al.module LIKE ?
        OR al.action LIKE ?
        OR al.entity_type LIKE ?
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
    where.push('al.module = ?');
    params.push(filters.module);
  }

  if (filters.action && filters.action !== 'todos') {
    where.push('al.action = ?');
    params.push(filters.action);
  }

  if (filters.user && filters.user !== 'todos') {
    where.push('al.username = ?');
    params.push(filters.user);
  }

  if (filters.date_from) {
    where.push('DATE(al.created_at) >= ?');
    params.push(filters.date_from);
  }

  if (filters.date_to) {
    where.push('DATE(al.created_at) <= ?');
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
        FROM audit_logs al
        LEFT JOIN users audit_user
          ON audit_user.id = al.user_id
        ${whereSql}
      `,
      params
    );

  const [rows]: any =
    await pool.query(
      `
        SELECT
          al.id,
          al.user_id,
          al.username,
          al.user_role,
          al.module,
          al.action,
          al.entity_type,
          al.entity_id,
          al.description,
          al.old_data,
          al.new_data,
          al.ip_address,
          al.user_agent,
          al.created_at
        FROM audit_logs al
        LEFT JOIN users audit_user
          ON audit_user.id = al.user_id
        ${whereSql}
        ORDER BY al.created_at DESC, al.id DESC
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
        SELECT DISTINCT al.module
        FROM audit_logs al
        LEFT JOIN users audit_user
          ON audit_user.id = al.user_id
        ${whereSql}
          ${whereSql ? 'AND' : 'WHERE'} al.module IS NOT NULL
        ORDER BY al.module ASC
      `
      ,
      params
    );

  const [actions]: any =
    await pool.query(
      `
        SELECT DISTINCT al.action
        FROM audit_logs al
        LEFT JOIN users audit_user
          ON audit_user.id = al.user_id
        ${whereSql}
          ${whereSql ? 'AND' : 'WHERE'} al.action IS NOT NULL
        ORDER BY al.action ASC
      `
      ,
      params
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
