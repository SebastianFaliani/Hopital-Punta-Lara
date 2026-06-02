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
  getScopedFacilityId
} from '../health-facilities/facility-access';

import {
  cancelMedicationDelivery,
  createMedicationDelivery,
  getMedicationDeliveries,
  getMedicationDeliveryById
} from './medication-deliveries.service';

const allowedStatuses = [
  'todos',
  'entregado',
  'cancelado'
];

const allowedReasons = [
  'tratamiento',
  'cronico',
  'guardia',
  'otro'
];

function validateDeliveryBody(
  body: any
) {

  if (!body.facility_id) {
    return 'Debe seleccionar el punto de entrega';
  }

  if (!body.delivery_date) {
    return 'La fecha de entrega es obligatoria';
  }

  if (!body.patient_name || !String(body.patient_name).trim()) {
    return 'El nombre del paciente es obligatorio';
  }

  if (
    !body.delivery_reason ||
    !allowedReasons.includes(body.delivery_reason)
  ) {
    return 'El motivo de entrega es invalido';
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

export async function handleGetMedicationDeliveries(
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

    const reason =
      String(req.query.reason || 'todos');

    if (
      reason !== 'todos' &&
      !allowedReasons.includes(reason)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Motivo invalido'
      });
    }

    const deliveries =
      await getMedicationDeliveries({
        status,
        reason,
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
            : undefined
      });

    return res.json({
      success: true,
      data: deliveries
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      success: false,
      message: 'Error al obtener entregas'
    });
  }
}

export async function handleGetMedicationDeliveryById(
  req: AuthRequest,
  res: Response
) {

  try {

    const delivery =
      await getMedicationDeliveryById(
        Number(req.params.id)
      );

    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: 'Entrega no encontrada'
      });
    }

    assertFacilityAccess(
      req.user,
      Number(delivery.facility_id)
    );

    return res.json({
      success: true,
      data: delivery
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      success: false,
      message: 'Error al obtener entrega'
    });
  }
}

export async function handleCreateMedicationDelivery(
  req: AuthRequest,
  res: Response
) {

  try {

    const validationError =
      validateDeliveryBody(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    assertFacilityAccess(
      req.user,
      Number(req.body.facility_id)
    );

    const id =
      await createMedicationDelivery({
        facility_id:
          Number(req.body.facility_id),
        delivery_date:
          req.body.delivery_date,
        patient_id:
          req.body.patient_id
            ? Number(req.body.patient_id)
            : null,
        patient_name:
          String(req.body.patient_name).trim(),
        patient_document:
          req.body.patient_document || null,
        patient_phone:
          req.body.patient_phone || null,
        delivery_reason:
          req.body.delivery_reason,
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
      action: 'crear_entrega_medicamento',
      entityType: 'medication_delivery',
      entityId: id,
      description: `Registro entrega de medicamentos #${id}`,
      newData: req.body,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.status(201).json({
      success: true,
      message: 'Entrega registrada',
      data: { id }
    });

  } catch (error: any) {

    console.error(error);

    return res.status(400).json({
      success: false,
      message:
        error.message ||
        'Error al registrar entrega'
    });
  }
}

export async function handleCancelMedicationDelivery(
  req: AuthRequest,
  res: Response
) {

  try {

    const id =
      Number(req.params.id);

    const delivery =
      await getMedicationDeliveryById(id);

    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: 'Entrega no encontrada'
      });
    }

    assertFacilityAccess(
      req.user,
      Number(delivery.facility_id)
    );

    await cancelMedicationDelivery(
      id,
      req.user?.userId ?? null
    );

    await logAudit({
      user: req.user,
      module: 'farmacia',
      action: 'cancelar_entrega_medicamento',
      entityType: 'medication_delivery',
      entityId: id,
      description: `Cancelo entrega de medicamentos #${id}`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json({
      success: true,
      message: 'Entrega cancelada'
    });

  } catch (error: any) {

    console.error(error);

    return res.status(400).json({
      success: false,
      message:
        error.message ||
        'Error al cancelar entrega'
    });
  }
}
