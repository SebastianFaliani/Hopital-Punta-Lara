import { Response } from 'express';
import { AuthRequest } from '../auth/auth.middleware';
import { getAuditLogs } from './audit.service';

export async function handleGetAuditLogs(
  req: AuthRequest,
  res: Response
) {

  try {
    const result =
      await getAuditLogs(req.query);

    return res.json({
      success: true,
      data: result.logs,
      pagination: result.pagination,
      options: result.options
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}
