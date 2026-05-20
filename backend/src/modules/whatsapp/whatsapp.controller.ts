import {
  Request,
  Response
} from 'express';

import {
  buildWhatsappResponse,
  createWhatsappReply,
  deleteAllWhatsappLogs,
  deleteWhatsappLogsBefore,
  getAllWhatsappLogsForExport,
  getRecentWhatsappLogs,
  getAllWhatsappReplies,
  toggleWhatsappReply,
  updateWhatsappReply
} from './whatsapp.service';

import {
  getWhatsappWebStatus,
  logoutWhatsappWebSession,
  startWhatsappWebSession,
  stopWhatsappWebSession
} from './whatsapp-web.service';

function validateReply(
  body: any
) {

  if (!body.code) {
    return 'El codigo es obligatorio';
  }

  if (!body.title) {
    return 'El titulo es obligatorio';
  }

  if (!body.response) {
    return 'La respuesta es obligatoria';
  }

  return null;
}

function escapeCsvValue(
  value: unknown
) {
  const text =
    value === null ||
    value === undefined
      ? ''
      : String(value);

  return `"${text.replace(/"/g, '""')}"`;
}

function buildLogsCsv(
  logs: any[]
) {
  const headers = [
    'ID',
    'Telefono',
    'Mensaje recibido',
    'Respuesta enviada',
    'Fecha'
  ];

  const rows =
    logs.map((log) => [
      log.id,
      log.phone,
      log.incoming_message,
      log.response_message,
      log.created_at
    ]);

  return [
    headers,
    ...rows
  ]
    .map((row) =>
      row.map(escapeCsvValue).join(',')
    )
    .join('\r\n');
}

export async function getReplies(
  req: Request,
  res: Response
) {

  try {

    const replies =
      await getAllWhatsappReplies();

    return res.json({
      success: true,
      data: replies
    });

  } catch (error: any) {

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export async function createReply(
  req: Request,
  res: Response
) {

  try {

    const validationError =
      validateReply(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    const id =
      await createWhatsappReply(req.body);

    return res.status(201).json({
      success: true,
      data: { id }
    });

  } catch (error: any) {

    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function updateReply(
  req: Request,
  res: Response
) {

  try {

    const validationError =
      validateReply(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    await updateWhatsappReply(
      Number(req.params.id),
      req.body
    );

    return res.json({
      success: true
    });

  } catch (error: any) {

    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function toggleReply(
  req: Request,
  res: Response
) {

  try {

    await toggleWhatsappReply(
      Number(req.params.id)
    );

    return res.json({
      success: true
    });

  } catch (error: any) {

    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function simulateMessage(
  req: Request,
  res: Response
) {

  try {

    const result =
      await buildWhatsappResponse(
        req.body.message || '',
        req.body.phone || null
      );

    return res.json({
      success: true,
      data: result
    });

  } catch (error: any) {

    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function receiveIncomingMessage(
  req: Request,
  res: Response
) {

  try {

    const result =
      await buildWhatsappResponse(
        req.body.message ||
          req.body.text ||
          '',
        req.body.phone ||
          req.body.from ||
          null
      );

    return res.json({
      success: true,
      data: result
    });

  } catch (error: any) {

    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function getWhatsappConnectionStatus(
  req: Request,
  res: Response
) {

  return res.json({
    success: true,
    data: getWhatsappWebStatus()
  });
}

export async function startWhatsappConnection(
  req: Request,
  res: Response
) {

  try {

    const status =
      await startWhatsappWebSession();

    return res.json({
      success: true,
      data: status
    });

  } catch (error: any) {

    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function stopWhatsappConnection(
  req: Request,
  res: Response
) {

  const status =
    await stopWhatsappWebSession();

  return res.json({
    success: true,
    data: status
  });
}

export async function logoutWhatsappConnection(
  req: Request,
  res: Response
) {

  const status =
    await logoutWhatsappWebSession();

  return res.json({
    success: true,
    data: status
  });
}

export async function getWhatsappLogs(
  req: Request,
  res: Response
) {

  try {

    const logs =
      await getRecentWhatsappLogs();

    return res.json({
      success: true,
      data: logs
    });

  } catch (error: any) {

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export async function exportWhatsappLogs(
  req: Request,
  res: Response
) {

  try {

    const logs =
      await getAllWhatsappLogsForExport();

    const csv =
      buildLogsCsv(logs);

    const fileDate =
      new Date()
        .toISOString()
        .slice(0, 10);

    res.setHeader(
      'Content-Type',
      'text/csv; charset=utf-8'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="whatsapp-historial-${fileDate}.csv"`
    );

    return res.send(
      `\uFEFF${csv}`
    );

  } catch (error: any) {

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export async function cleanupWhatsappLogs(
  req: Request,
  res: Response
) {

  try {

    const {
      before_date,
      delete_all
    } = req.body;

    let result;

    if (delete_all) {
      result =
        await deleteAllWhatsappLogs();
    } else {
      if (!before_date) {
        return res.status(400).json({
          success: false,
          message: 'Debe indicar una fecha limite'
        });
      }

      result =
        await deleteWhatsappLogsBefore(
          `${before_date} 00:00:00`
        );
    }

    return res.json({
      success: true,
      data: result
    });

  } catch (error: any) {

    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}
