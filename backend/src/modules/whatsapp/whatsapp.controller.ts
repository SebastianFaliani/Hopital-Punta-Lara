import {
  Request,
  Response
} from 'express';

import {
  buildWhatsappResponse,
  confirmWhatsappAppointmentRequest,
  createWhatsappReply,
  createWhatsappAppointmentDoctor,
  deleteAllWhatsappLogs,
  deleteWhatsappLogsBefore,
  getWhatsappAppointmentDoctors,
  getWhatsappAppointmentRequests,
  getWhatsappChatConversations,
  getWhatsappChatMessages,
  getAllWhatsappLogsForExport,
  getRecentWhatsappLogs,
  getAllWhatsappReplies,
  markWhatsappAppointmentNoAvailability,
  replaceWhatsappDoctorSchedules,
  saveWhatsappChatMessage,
  setWhatsappDoctorBookingStatus,
  toggleWhatsappReply,
  updateWhatsappAppointmentDoctor,
  updateWhatsappReply
} from './whatsapp.service';

import {
  getWhatsappWebStatus,
  getWhatsappWebStatusFresh,
  getWhatsappProfilePictureUrl,
  logoutWhatsappWebSession,
  sendWhatsappTextMessage,
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
    data:
      await getWhatsappWebStatusFresh()
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

export async function getChatConversations(
  req: Request,
  res: Response
) {

  try {

    const conversations =
      await getWhatsappChatConversations();

    return res.json({
      success: true,
      data: conversations
    });

  } catch (error: any) {

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export async function getChatMessages(
  req: Request,
  res: Response
) {

  try {

    const messages =
      await getWhatsappChatMessages(
        String(req.params.phone)
      );

    return res.json({
      success: true,
      data: messages
    });

  } catch (error: any) {

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export async function getChatProfilePicture(
  req: Request,
  res: Response
) {

  try {

    const profilePictureUrl =
      await getWhatsappProfilePictureUrl(
        String(req.params.phone)
      );

    return res.json({
      success: true,
      data: {
        profile_picture_url: profilePictureUrl
      }
    });

  } catch (error: any) {

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export async function sendChatMessage(
  req: Request,
  res: Response
) {

  try {

    const phone =
      String(req.params.phone);

    const message =
      String(req.body.message || '').trim();

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'El mensaje es obligatorio'
      });
    }

    await sendWhatsappTextMessage(
      phone,
      message
    );

    await saveWhatsappChatMessage({
      phone,
      direction: 'outgoing',
      message,
      source: 'manual'
    });

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

export async function getAppointmentDoctors(
  req: Request,
  res: Response
) {

  try {

    const doctors =
      await getWhatsappAppointmentDoctors();

    return res.json({
      success: true,
      data: doctors
    });

  } catch (error: any) {

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export async function createAppointmentDoctor(
  req: Request,
  res: Response
) {

  try {

    const doctor =
      await createWhatsappAppointmentDoctor(
        req.body
      );

    return res.status(201).json({
      success: true,
      data: doctor
    });

  } catch (error: any) {

    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function updateAppointmentDoctor(
  req: Request,
  res: Response
) {

  try {

    await updateWhatsappAppointmentDoctor(
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

export async function updateAppointmentDoctorBooking(
  req: Request,
  res: Response
) {

  try {

    await setWhatsappDoctorBookingStatus(
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

export async function updateAppointmentDoctorSchedules(
  req: Request,
  res: Response
) {

  try {

    await replaceWhatsappDoctorSchedules(
      Number(req.params.id),
      req.body.schedules || []
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

export async function getAppointmentRequests(
  req: Request,
  res: Response
) {

  try {

    const requests =
      await getWhatsappAppointmentRequests(
        req.query
      );

    return res.json({
      success: true,
      data: requests
    });

  } catch (error: any) {

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export async function confirmAppointmentRequest(
  req: Request,
  res: Response
) {

  try {

    const request =
      await confirmWhatsappAppointmentRequest(
        Number(req.params.id),
        req.body
      );

    const message = [
      'Turno confirmado.',
      '',
      `Paciente: ${request.patient_name}`,
      `Especialidad: ${request.specialty}`,
      `Medico: ${request.doctor_name}`,
      `Fecha: ${new Date(request.assigned_date).toLocaleDateString('es-AR')}`,
      `Horario: ${request.assigned_time} hs`,
      '',
      'Por favor concurrir con DNI y orden medica si corresponde.'
    ].join('\n');

    let sent = false;

    try {
      await sendWhatsappTextMessage(
        request.phone,
        message
      );
      sent = true;
    } catch (error) {
      sent = false;
    }

    return res.json({
      success: true,
      data: {
        sent,
        message
      }
    });

  } catch (error: any) {

    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function rejectAppointmentRequest(
  req: Request,
  res: Response
) {

  try {

    const request =
      await markWhatsappAppointmentNoAvailability(
        Number(req.params.id),
        req.body
      );

    const nextOpen =
      request.next_open_at
        ? new Date(request.next_open_at)
          .toLocaleString('es-AR')
        : 'a confirmar';

    const message =
      req.body.message ||
      [
        `Hola ${request.patient_name}.`,
        '',
        `Por el momento no quedan turnos disponibles para ${request.specialty} - ${request.doctor_name}.`,
        `La turnera vuelve a abrir el ${nextOpen}.`
      ].join('\n');

    let sent = false;

    try {
      await sendWhatsappTextMessage(
        request.phone,
        message
      );
      sent = true;
    } catch (error) {
      sent = false;
    }

    return res.json({
      success: true,
      data: {
        sent,
        message
      }
    });

  } catch (error: any) {

    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}
