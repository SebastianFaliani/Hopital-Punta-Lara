import { Response } from 'express';
import { AuthRequest } from '../auth/auth.middleware';
import { getAuditLogs } from './audit.service';

export async function handleGetAuditLogs(
  req: AuthRequest,
  res: Response
) {

  try {
    return res.json({
      success: true,
      data: await getAuditLogs(req.query)
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}
