import {
  Response
} from 'express';

import {
  AuthRequest
} from '../auth/auth.middleware';

import {
  logAudit
} from '../audit/audit.service';

import {
  assertFacilityAccess,
  canAccessAllFacilities,
  getScopedFacilityId
} from '../health-facilities/facility-access';

import {
  cancelVaccineTransfer,
  createVaccineTransfer,
  getVaccineFacilityBatchStocks,
  getVaccineTransferById,
  getVaccineTransfers,
  receiveVaccineTransfer
} from './vaccine-transfers.service';

const allowedStatuses = [
  'todos',
  'enviado',
  'recibido',
  'cancelado'
];

function validateTransferBody(
  body: any
) {

  if (!body.source_facility_id) {
    return 'Debe seleccionar el punto de origen';
  }

  if (!body.destination_facility_id) {
    return 'Debe seleccionar el punto de destino';
  }

  if (
    Number(body.source_facility_id) ===
    Number(body.destination_facility_id)
  ) {
    return 'El origen y destino no pueden ser el mismo punto';
  }

  if (!body.transfer_date) {
    return 'La fecha del traslado es obligatoria';
  }

  if (
    !Array.isArray(body.items) ||
    body.items.length === 0
  ) {
    return 'Debe agregar al menos una vacuna';
  }

  for (const item of body.items) {
    if (!item.vaccine_batch_id) {
      return 'Todos los items deben tener lote';
    }

    if (
      item.quantity === undefined ||
      Number(item.quantity) <= 0
    ) {
      return 'Todas las cantidades deben ser mayores a cero';
    }
  }

  return null;
}

export async function handleGetVaccineFacilityBatchStocks(
  req: AuthRequest,
  res: Response
) {

  try {

    const facilityId =
      Number(req.query.facility_id);

    if (!facilityId) {
      return res.status(400).json({
        success: false,
        message: 'Debe seleccionar un punto de stock'
      });
    }

    assertFacilityAccess(req.user, facilityId);

    const rows =
      await getVaccineFacilityBatchStocks(facilityId);

    return res.json({
      success: true,
      data: rows
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      success: false,
      message: 'Error al obtener stock del punto'
    });
  }
}

export async function handleGetVaccineTransfers(
  req: AuthRequest,
  res: Response
) {

  try {

    const status =
      String(req.query.status || 'todos');

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Estado invalido'
      });
    }

    const transfers =
      await getVaccineTransfers({
        status,
        facility_id:
          getScopedFacilityId(
            req.user,
            req.query.facility_id
              ? Number(req.query.facility_id)
              : null
          ) || undefined,
        search:
          req.query.search
            ? String(req.query.search)
            : undefined,
        date_from:
          req.query.date_from
            ? String(req.query.date_from)
            : undefined,
        date_to:
          req.query.date_to
            ? String(req.query.date_to)
            : undefined,
        page:
          req.query.page
            ? Number(req.query.page)
            : 1,
        page_size:
          req.query.page_size
            ? Number(req.query.page_size)
            : 10
      });

    return res.json({
      success: true,
      data: transfers
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      success: false,
      message: 'Error al obtener traslados'
    });
  }
}

export async function handleGetVaccineTransferById(
  req: AuthRequest,
  res: Response
) {

  try {

    const transfer =
      await getVaccineTransferById(
        Number(req.params.id)
      );

    if (!transfer) {
      return res.status(404).json({
        success: false,
        message: 'Traslado no encontrado'
      });
    }

    if (
      !canAccessAllFacilities(req.user) &&
      Number(req.user?.facility_id) !==
        Number(transfer.source_facility_id) &&
      Number(req.user?.facility_id) !==
        Number(transfer.destination_facility_id)
    ) {
      return res.status(403).json({
        success: false,
        message: 'No tenes permiso para ver este traslado'
      });
    }

    return res.json({
      success: true,
      data: transfer
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      success: false,
      message: 'Error al obtener traslado'
    });
  }
}

export async function handleCreateVaccineTransfer(
  req: AuthRequest,
  res: Response
) {

  try {

    const validationError =
      validateTransferBody(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    assertFacilityAccess(
      req.user,
      Number(req.body.source_facility_id)
    );

    const id =
      await createVaccineTransfer({
        source_facility_id:
          Number(req.body.source_facility_id),
        destination_facility_id:
          Number(req.body.destination_facility_id),
        transfer_date:
          req.body.transfer_date,
        notes:
          req.body.notes || null,
        created_by:
          req.user?.userId ?? null,
        items:
          req.body.items.map((item: any) => ({
            vaccine_batch_id:
              Number(item.vaccine_batch_id),
            quantity:
              Number(item.quantity)
          }))
      });

    await logAudit({
      user: req.user,
      module: 'vacunas',
      action: 'crear_traslado_vacuna',
      entityType: 'vaccine_transfer',
      entityId: id,
      description: `Creo traslado de vacunas #${id}`,
      newData: req.body,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.status(201).json({
      success: true,
      message: 'Traslado creado',
      data: { id }
    });

  } catch (error: any) {

    console.error(error);

    return res.status(400).json({
      success: false,
      message:
        error.message ||
        'Error al crear traslado'
    });
  }
}

export async function handleReceiveVaccineTransfer(
  req: AuthRequest,
  res: Response
) {

  try {

    const id =
      Number(req.params.id);

    const transfer =
      await getVaccineTransferById(id);

    if (!transfer) {
      return res.status(404).json({
        success: false,
        message: 'Traslado no encontrado'
      });
    }

    assertFacilityAccess(
      req.user,
      Number(transfer.destination_facility_id)
    );

    await receiveVaccineTransfer(
      id,
      req.user?.userId ?? null
    );

    await logAudit({
      user: req.user,
      module: 'vacunas',
      action: 'recibir_traslado_vacuna',
      entityType: 'vaccine_transfer',
      entityId: id,
      description: `Recibio traslado de vacunas #${id}`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json({
      success: true,
      message: 'Traslado recibido'
    });

  } catch (error: any) {

    console.error(error);

    return res.status(400).json({
      success: false,
      message:
        error.message ||
        'Error al recibir traslado'
    });
  }
}

export async function handleCancelVaccineTransfer(
  req: AuthRequest,
  res: Response
) {

  try {

    const id =
      Number(req.params.id);

    const transfer =
      await getVaccineTransferById(id);

    if (!transfer) {
      return res.status(404).json({
        success: false,
        message: 'Traslado no encontrado'
      });
    }

    assertFacilityAccess(
      req.user,
      Number(transfer.source_facility_id)
    );

    await cancelVaccineTransfer(
      id,
      req.user?.userId ?? null
    );

    await logAudit({
      user: req.user,
      module: 'vacunas',
      action: 'cancelar_traslado_vacuna',
      entityType: 'vaccine_transfer',
      entityId: id,
      description: `Cancelo traslado de vacunas #${id}`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json({
      success: true,
      message: 'Traslado cancelado'
    });

  } catch (error: any) {

    console.error(error);

    return res.status(400).json({
      success: false,
      message:
        error.message ||
        'Error al cancelar traslado'
    });
  }
}
