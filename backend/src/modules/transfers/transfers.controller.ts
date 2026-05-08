import {
  Request,
  Response
} from 'express';

import {
  AuthRequest
} from '../auth/auth.middleware';
import { logAudit } from '../audit/audit.service';

import {
  createTransfer,
  getAllTransfers,
  updateTransferStatus,
  updateTransferTrip
} from './transfers.service';

function validateTransfer(
  body: any
) {

  if (!body.patient_name) {
    return 'El paciente es obligatorio';
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
      await getAllTransfers();

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
      req.body.status
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
      req.body
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
