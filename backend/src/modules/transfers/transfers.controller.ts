import {
  Request,
  Response
} from 'express';

import {
  AuthRequest
} from '../auth/auth.middleware';
import { logAudit } from '../audit/audit.service';

import {
  createRecurringTransfer,
  createTransfer,
  getAllTransfers,
  getAvailableDriversForTrip,
  getRecurringTransfers,
  getTransferOverview,
  logRoutePrint,
  toggleRecurringTransfer,
  updateRecurringTransfer,
  updateTransfer,
  updateTransferStatus,
  updateTransferTrip
} from './transfers.service';

function validateTransfer(
  body: any
) {

  if (!body.patient_name) {
    return 'El paciente es obligatorio';
  }

  if (!body.facility_id) {
    return 'La dependencia solicitante es obligatoria';
  }

  if (!body.origin_address) {
    return 'El origen es obligatorio';
  }

  if (!body.destination_address) {
    return 'El destino es obligatorio';
  }

  if (!body.destination_type) {
    return 'El tipo de destino es obligatorio';
  }

  if (!body.transfer_date) {
    return 'La fecha es obligatoria';
  }

  return null;
}

export async function getTransfers(
  req: Request,
  res: Response
) {

  try {

    const transfers =
      await getAllTransfers(req.query);

    return res.json({
      success: true,
      data: transfers
    });

  } catch (error: any) {

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export async function getOverview(
  req: Request,
  res: Response
) {
  try {
    const date =
      String(req.query.date || '')
        .slice(0, 10);

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'La fecha es obligatoria'
      });
    }

    const overview =
      await getTransferOverview(date);

    return res.json({
      success: true,
      data: overview
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function create(
  req: AuthRequest,
  res: Response
) {

  try {

    const validationError =
      validateTransfer(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    const id =
      await createTransfer(
        req.body,
        req.user?.userId ?? null
      );

    await logAudit({
      user: req.user,
      module: 'traslados',
      action: 'crear_traslado',
      entityType: 'transfer_request',
      entityId: id,
      description: `Creo traslado de ${req.body.patient_name}`,
      newData: req.body,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

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

export async function updateStatus(
  req: AuthRequest,
  res: Response
) {

  try {

    await updateTransferStatus(
      Number(req.params.id),
      req.body.status,
      req.user?.userId,
      req.body.reason,
      req.user?.role
    );

    await logAudit({
      user: req.user,
      module: 'traslados',
      action: 'cambiar_estado_traslado',
      entityType: 'transfer_request',
      entityId: Number(req.params.id),
      description: `Cambio estado de traslado a ${req.body.status}`,
      newData: req.body,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
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

export async function updateTrip(
  req: AuthRequest,
  res: Response
) {

  try {

    await updateTransferTrip(
      Number(req.params.id),
      req.body,
      req.user?.userId
    );

    await logAudit({
      user: req.user,
      module: 'traslados',
      action: 'editar_viaje_traslado',
      entityType: 'transfer_trip',
      entityId: Number(req.params.id),
      description: `Edito viaje de traslado ${req.params.id}`,
      newData: req.body,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json({
      success: true,
      message:
        'Viaje actualizado'
    });

  } catch (error: any) {

    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function getAvailableDrivers(
  req: AuthRequest,
  res: Response
) {
  try {
    const drivers =
      await getAvailableDriversForTrip(
        Number(req.params.id)
      );

    return res.json({
      success: true,
      data: drivers
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function updateRequest(
  req: AuthRequest,
  res: Response
) {
  try {
    const validationError =
      validateTransfer(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    await updateTransfer(
      Number(req.params.id),
      req.body,
      req.user
    );

    await logAudit({
      user: req.user,
      module: 'traslados',
      action: 'editar_solicitud_traslado',
      entityType: 'transfer_request',
      entityId: Number(req.params.id),
      description:
        `Edito solicitud de traslado ${req.params.id}`,
      newData: req.body,
      ipAddress: req.ip,
      userAgent:
        req.headers['user-agent'] || null
    });

    return res.json({
      success: true,
      message: 'Solicitud actualizada'
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function getRecurring(
  req: Request,
  res: Response
) {
  try {
    return res.json({
      success: true,
      data:
        await getRecurringTransfers()
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export async function createRecurring(
  req: AuthRequest,
  res: Response
) {
  try {
    const validationError =
      validateTransfer(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    const result =
      await createRecurringTransfer(
        req.body,
        req.user?.userId ?? null
      );

    await logAudit({
      user: req.user,
      module: 'traslados',
      action: 'crear_traslado_recurrente',
      entityType:
        'recurring_transfer_template',
      entityId: result.id,
      description:
        `Creo traslado recurrente de ${req.body.patient_name}`,
      newData: req.body,
      ipAddress: req.ip,
      userAgent:
        req.headers['user-agent'] || null
    });

    return res.status(201).json({
      success: true,
      data: result,
      message:
        `Traslado recurrente creado. Se generaron ${result.generated} solicitudes.`
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function updateRecurring(
  req: AuthRequest,
  res: Response
) {
  try {
    const validationError =
      validateTransfer(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    const result =
      await updateRecurringTransfer(
        Number(req.params.id),
        req.body,
        req.user?.userId ?? null
      );

    await logAudit({
      user: req.user,
      module: 'traslados',
      action: 'editar_traslado_recurrente',
      entityType:
        'recurring_transfer_template',
      entityId: Number(req.params.id),
      description:
        `Edito traslado recurrente de ${req.body.patient_name}`,
      newData: req.body,
      ipAddress: req.ip,
      userAgent:
        req.headers['user-agent'] || null
    });

    return res.json({
      success: true,
      data: result,
      message:
        `Traslado recurrente actualizado. Se regeneraron ${result.generated} solicitudes futuras pendientes.`
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function toggleRecurring(
  req: AuthRequest,
  res: Response
) {
  try {
    await toggleRecurringTransfer(
      Number(req.params.id),
      Boolean(req.body.is_active)
    );

    await logAudit({
      user: req.user,
      module: 'traslados',
      action: 'cambiar_estado_recurrente',
      entityType:
        'recurring_transfer_template',
      entityId: Number(req.params.id),
      description:
        `${req.body.is_active ? 'Activo' : 'Pauso'} traslado recurrente`,
      newData: req.body,
      ipAddress: req.ip,
      userAgent:
        req.headers['user-agent'] || null
    });

    return res.json({ success: true });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function registerRoutePrint(
  req: AuthRequest,
  res: Response
) {
  try {
    const id =
      await logRoutePrint(
        req.body,
        req.user?.userId ?? null
      );

    await logAudit({
      user: req.user,
      module: 'traslados',
      action: 'imprimir_hoja_ruta',
      entityType:
        'transfer_route_print_log',
      entityId: id,
      description:
        `Imprimio hoja de ruta del ${req.body.route_date}`,
      newData: req.body,
      ipAddress: req.ip,
      userAgent:
        req.headers['user-agent'] || null
    });

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
