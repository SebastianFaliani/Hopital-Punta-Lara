import {
  Request,
  Response
} from 'express';

import { AuthRequest } from '../auth/auth.middleware';
import { getVaccineById } from '../vaccines/vaccines.service';
import { logAudit } from '../audit/audit.service';
import {
  assertFacilityAccess,
  getScopedFacilityId
} from '../health-facilities/facility-access';

import {
  createVaccineBatch,
  createVaccineMovement,
  getBatchesByVaccine,
  getVaccineMovementsByBatch,
  toggleVaccineBatch,
  updateVaccineBatch
} from './vaccine-batches.service';

const allowedMovementTypes = [
  'ingreso',
  'ajuste',
  'perdida',
  'devolucion'
];

function validateBatchBody(
  body: any,
  requireStock = true
) {
  if (!body.batch_number) {
    return 'El lote es obligatorio';
  }

  if (!body.expiration_date) {
    return 'El vencimiento es obligatorio';
  }

  if (
    requireStock &&
    (
    body.current_stock === undefined ||
    Number(body.current_stock) < 0
    )
  ) {
    return 'El stock debe ser mayor o igual a cero';
  }

  if (
    body.purchase_price !== undefined &&
    body.purchase_price !== null &&
    body.purchase_price !== '' &&
    Number(body.purchase_price) < 0
  ) {
    return 'El costo debe ser mayor o igual a cero';
  }

  return null;
}

function validateMovementBody(
  body: any
) {
  if (
    !body.movement_type ||
    !allowedMovementTypes.includes(body.movement_type)
  ) {
    return 'Tipo de movimiento invalido';
  }

  if (
    body.quantity === undefined ||
    Number(body.quantity) <= 0
  ) {
    return 'La cantidad debe ser mayor a cero';
  }

  if (
    body.movement_type === 'ajuste' &&
    body.movement_direction !== 'entrada' &&
    body.movement_direction !== 'salida'
  ) {
    return 'El ajuste debe indicar entrada o salida';
  }

  return null;
}

export async function handleGetBatchesByVaccine(
  req: AuthRequest,
  res: Response
) {
  try {
    const vaccineId =
      Number(req.params.id);

    const vaccine =
      await getVaccineById(vaccineId);

    if (!vaccine) {
      return res.status(404).json({
        success: false,
        message: 'Vacuna no encontrada'
      });
    }

    const batches =
      await getBatchesByVaccine(
        vaccineId,
        getScopedFacilityId(req.user)
      );

    return res.json({
      success: true,
      data: {
        vaccine,
        batches
      }
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: 'Error al obtener lotes'
    });
  }
}

export async function handleCreateVaccineBatch(
  req: AuthRequest,
  res: Response
) {
  try {
    const validationError =
      validateBatchBody(req.body, false);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    const vaccineId =
      Number(req.params.id);

    const vaccine =
      await getVaccineById(vaccineId);

    if (!vaccine) {
      return res.status(404).json({
        success: false,
        message: 'Vacuna no encontrada'
      });
    }

    const id =
      await createVaccineBatch(
        vaccineId,
        {
          batch_number: req.body.batch_number,
          expiration_date: req.body.expiration_date,
          current_stock: Number(req.body.current_stock),
          purchase_price:
            req.body.purchase_price === '' ||
            req.body.purchase_price === undefined
              ? null
              : Number(req.body.purchase_price),
          facility_id:
            req.body.facility_id
              ? getScopedFacilityId(
                req.user,
                Number(req.body.facility_id)
              )
              : getScopedFacilityId(req.user)
        }
      );

    await logAudit({
      user: req.user,
      module: 'vacunas',
      action: 'crear_lote_vacuna',
      entityType: 'vaccine_batch',
      entityId: id,
      description: `Creo lote ${req.body.batch_number} para vacuna ${vaccineId}`,
      newData: req.body,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.status(201).json({
      success: true,
      message: 'Lote creado',
      data: { id }
    });
  } catch (error: any) {
    console.error(error);

    return res.status(400).json({
      success: false,
      message: error.message || 'Error al crear lote'
    });
  }
}

export async function handleUpdateVaccineBatch(
  req: AuthRequest,
  res: Response
) {
  try {
    const validationError =
      validateBatchBody(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    await updateVaccineBatch(
      Number(req.params.id),
      {
        batch_number: req.body.batch_number,
        expiration_date: req.body.expiration_date,
        current_stock: 0,
        purchase_price:
          req.body.purchase_price === '' ||
          req.body.purchase_price === undefined
            ? null
            : Number(req.body.purchase_price)
      }
    );

    await logAudit({
      user: req.user,
      module: 'vacunas',
      action: 'editar_lote_vacuna',
      entityType: 'vaccine_batch',
      entityId: Number(req.params.id),
      description: `Edito lote de vacuna ${req.params.id}`,
      newData: req.body,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json({
      success: true,
      message: 'Lote actualizado'
    });
  } catch (error: any) {
    console.error(error);

    return res.status(400).json({
      success: false,
      message: error.message || 'Error al actualizar lote'
    });
  }
}

export async function handleToggleVaccineBatch(
  req: AuthRequest,
  res: Response
) {
  try {
    await toggleVaccineBatch(
      Number(req.params.id)
    );

    await logAudit({
      user: req.user,
      module: 'vacunas',
      action: 'activar_desactivar_lote_vacuna',
      entityType: 'vaccine_batch',
      entityId: Number(req.params.id),
      description: `Cambio estado de lote de vacuna ${req.params.id}`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json({
      success: true,
      message: 'Estado actualizado'
    });
  } catch (error: any) {
    console.error(error);

    return res.status(400).json({
      success: false,
      message: error.message || 'Error al actualizar estado'
    });
  }
}

export async function handleGetVaccineMovements(
  req: Request,
  res: Response
) {
  try {
    const movements =
      await getVaccineMovementsByBatch(
        Number(req.params.id)
      );

    return res.json({
      success: true,
      data: movements
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: 'Error al obtener movimientos'
    });
  }
}

export async function handleCreateVaccineMovement(
  req: AuthRequest,
  res: Response
) {
  try {
    const validationError =
      validateMovementBody(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    const facilityId =
      req.body.facility_id
        ? Number(req.body.facility_id)
        : getScopedFacilityId(req.user);

    if (facilityId) {
      assertFacilityAccess(req.user, facilityId);
    }

    const result =
      await createVaccineMovement(
        Number(req.params.id),
        {
          movement_type: req.body.movement_type,
          movement_direction: req.body.movement_direction,
          quantity: Number(req.body.quantity),
          notes: req.body.notes,
          created_by: req.user?.userId ?? null,
          facility_id: facilityId
        }
      );

    await logAudit({
      user: req.user,
      module: 'vacunas',
      action: 'movimiento_stock_vacuna',
      entityType: 'vaccine_batch',
      entityId: Number(req.params.id),
      description:
        `Registro movimiento ${req.body.movement_type} de ${Number(req.body.quantity)} unidades en lote de vacuna ${req.params.id}`,
      newData: req.body,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.status(201).json({
      success: true,
      message: 'Movimiento registrado',
      data: result
    });
  } catch (error: any) {
    console.error(error);

    return res.status(400).json({
      success: false,
      message: error.message || 'Error al registrar movimiento'
    });
  }
}
