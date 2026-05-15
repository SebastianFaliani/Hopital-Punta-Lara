import {
  Request,
  Response
} from 'express';

import {
  getDashboardStats
} from './dashboard.service';

export async function getDashboard(
  req: Request,
  res: Response
) {

  try {

    const stats =
      await getDashboardStats();

    return res.json({
      success: true,
      data: stats
    });

  } catch (error: any) {

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}
