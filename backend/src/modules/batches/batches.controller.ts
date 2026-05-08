import {
  Request,
  Response
} from 'express';
import { AuthRequest } from '../auth/auth.middleware';
import { logAudit } from '../audit/audit.service';

import {
  createBatch,
  getBatchesByMedication,
  toggleBatch,
  updateBatch
} from './batches.service';

import {
  getMedicationById
} from '../medications/medications.service';

function validateBatchBody(
  body: any
) {

  if (!body.batch_number) {
    return 'El lote es obligatorio';
  }

  if (!body.expiration_date) {
    return 'El vencimiento es obligatorio';
  }

  if (
    body.current_stock === undefined ||
    Number(body.current_stock) < 0
  ) {
    return 'El stock debe ser mayor o igual a cero';
  }

  if (
    body.purchase_price !== undefined &&
    body.purchase_price !== null &&
    Number(body.purchase_price) < 0
  ) {
    return 'El costo debe ser mayor o igual a cero';
  }

  return null;
}

export async function handleGetBatchesByMedication(
  req: Request,
  res: Response
) {

  try {

    const medicationId =
      Number(req.params.id);

    const medication =
      await getMedicationById(
        medicationId
      );

    if (!medication) {

      return res.status(404).json({
        success: false,
        message:
          'Medicamento no encontrado'
      });
    }

    const batches =
      await getBatchesByMedication(
        medicationId
      );

    return res.json({
      success: true,
      data: {
        medication,
        batches
      }
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        'Error al obtener lotes'
    });
  }
}

export async function handleCreateBatch(
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

    const medicationId =
      Number(req.params.id);

    const medication =
      await getMedicationById(
        medicationId
      );

    if (!medication) {

      return res.status(404).json({
        success: false,
        message:
          'Medicamento no encontrado'
      });
    }

    const batchId =
      await createBatch(
        medicationId,
        {
          batch_number:
            req.body.batch_number,
          expiration_date:
            req.body.expiration_date,
          current_stock:
            Number(req.body.current_stock),
          purchase_price:
            req.body.purchase_price === ''
              ? null
              : req.body.purchase_price
          === undefined
                ? null
                : Number(req.body.purchase_price)
        }
      );

    await logAudit({
      user: req.user,
      module: 'farmacia',
      action: 'crear_lote_medicamento',
      entityType: 'medication_batch',
      entityId: batchId,
      description: `Creo lote ${req.body.batch_number} para medicamento ${medicationId}`,
      newData: req.body,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.status(201).json({
      success: true,
      message:
        'Lote creado',
      data: {
        id: batchId
      }
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        'Error al crear lote'
    });
  }
}

export async function handleUpdateBatch(
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

    await updateBatch(
      Number(req.params.id),
      {
        batch_number:
          req.body.batch_number,
        expiration_date:
          req.body.expiration_date,
        current_stock:
          Number(req.body.current_stock),
        purchase_price:
          req.body.purchase_price === ''
            ? null
            : req.body.purchase_price
        === undefined
              ? null
              : Number(req.body.purchase_price)
      }
    );

    await logAudit({
      user: req.user,
      module: 'farmacia',
      action: 'editar_lote_medicamento',
      entityType: 'medication_batch',
      entityId: Number(req.params.id),
      description: `Edito lote de medicamento ${req.params.id}`,
      newData: req.body,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json({
      success: true,
      message:
        'Lote actualizado'
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        'Error al actualizar lote'
    });
  }
}

export async function handleToggleBatch(
  req: AuthRequest,
  res: Response
) {

  try {

    await toggleBatch(
      Number(req.params.id)
    );

    await logAudit({
      user: req.user,
      module: 'farmacia',
      action: 'activar_desactivar_lote_medicamento',
      entityType: 'medication_batch',
      entityId: Number(req.params.id),
      description: `Cambio estado de lote de medicamento ${req.params.id}`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json({
      success: true,
      message:
        'Estado actualizado'
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        'Error al actualizar estado'
    });
  }
}
