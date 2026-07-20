import {
  Request,
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
  canAccessFacility,
  canAccessAllFacilities,
  getScopedFacilityId
} from '../health-facilities/facility-access';

import {
  cancelMedicationTransfer,
  createMedicationTransfer,
  getFacilityBatchStocks,
  getMedicationTransferById,
  getMedicationTransfers,
  reactivateMedicationTransfer,
  receiveMedicationTransfer,
  updateMedicationTransfer
} from './medication-transfers.service';

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
    return 'Debe agregar al menos un medicamento';
  }

  for (const item of body.items) {
    if (!item.medication_batch_id) {
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

export async function handleGetFacilityBatchStocks(
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

    assertFacilityAccess(
      req.user,
      facilityId
    );

    const rows =
      await getFacilityBatchStocks(facilityId);

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

export async function handleGetMedicationTransfers(
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
      await getMedicationTransfers({
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

export async function handleGetMedicationTransferById(
  req: AuthRequest,
  res: Response
) {

  try {

    const transfer =
      await getMedicationTransferById(
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
      !canAccessFacility(
        req.user,
        Number(transfer.source_facility_id)
      ) &&
      !canAccessFacility(
        req.user,
        Number(transfer.destination_facility_id)
      )
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

export async function handleCreateMedicationTransfer(
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
      await createMedicationTransfer({
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
            medication_batch_id:
              Number(item.medication_batch_id),
            quantity:
              Number(item.quantity)
          }))
      });

    await logAudit({
      user: req.user,
      module: 'farmacia',
      action: 'crear_traslado_medicamento',
      entityType: 'medication_transfer',
      entityId: id,
      description: `Creo traslado de medicamentos #${id}`,
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

export async function handleUpdateMedicationTransfer(
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

    const id =
      Number(req.params.id);

    const transfer =
      await getMedicationTransferById(id);

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

    assertFacilityAccess(
      req.user,
      Number(req.body.source_facility_id)
    );

    await updateMedicationTransfer(
      id,
      {
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
            medication_batch_id:
              Number(item.medication_batch_id),
            quantity:
              Number(item.quantity)
          }))
      }
    );

    await logAudit({
      user: req.user,
      module: 'farmacia',
      action: 'editar_traslado_medicamento',
      entityType: 'medication_transfer',
      entityId: id,
      description: `Edito traslado de medicamentos #${id}`,
      newData: req.body,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json({
      success: true,
      message: 'Traslado actualizado'
    });

  } catch (error: any) {

    console.error(error);

    return res.status(400).json({
      success: false,
      message:
        error.message ||
        'Error al actualizar traslado'
    });
  }
}

export async function handleReactivateMedicationTransfer(
  req: AuthRequest,
  res: Response
) {

  try {

    const id =
      Number(req.params.id);

    await reactivateMedicationTransfer(id);

    await logAudit({
      user: req.user,
      module: 'farmacia',
      action: 'reactivar_traslado_medicamento',
      entityType: 'medication_transfer',
      entityId: id,
      description: `Reactivo traslado de medicamentos #${id}`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json({
      success: true,
      message: 'Traslado reactivado'
    });

  } catch (error: any) {

    console.error(error);

    return res.status(400).json({
      success: false,
      message:
        error.message ||
        'Error al reactivar traslado'
    });
  }
}

export async function handleReceiveMedicationTransfer(
  req: AuthRequest,
  res: Response
) {

  try {

    const id =
      Number(req.params.id);

    const transfer =
      await getMedicationTransferById(id);

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

    await receiveMedicationTransfer(
      id,
      req.user?.userId ?? null
    );

    await logAudit({
      user: req.user,
      module: 'farmacia',
      action: 'recibir_traslado_medicamento',
      entityType: 'medication_transfer',
      entityId: id,
      description: `Recibio traslado de medicamentos #${id}`,
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

export async function handleCancelMedicationTransfer(
  req: AuthRequest,
  res: Response
) {

  try {

    const id =
      Number(req.params.id);

    const transfer =
      await getMedicationTransferById(id);

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

    await cancelMedicationTransfer(
      id,
      req.user?.userId ?? null
    );

    await logAudit({
      user: req.user,
      module: 'farmacia',
      action: 'cancelar_traslado_medicamento',
      entityType: 'medication_transfer',
      entityId: id,
      description: `Cancelo traslado de medicamentos #${id}`,
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
