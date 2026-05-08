import {
  Request,
  Response
} from 'express';

import {
  AuthRequest
} from '../auth/auth.middleware';
import { logAudit } from '../audit/audit.service';

import {
  createStockMovement,
  getMovementsByBatch
} from './inventory-movements.service';

const allowedTypes = [
  'compra',
  'ajuste',
  'perdida',
  'devolucion'
];

function validateMovementBody(
  body: any
) {

  if (
    !body.movement_type ||
    !allowedTypes.includes(
      body.movement_type
    )
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

export async function handleGetMovementsByBatch(
  req: Request,
  res: Response
) {

  try {

    const movements =
      await getMovementsByBatch(
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
      message:
        'Error al obtener movimientos'
    });
  }
}

export async function handleCreateStockMovement(
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

    const result =
      await createStockMovement(
        Number(req.params.id),
        {
          movement_type:
            req.body.movement_type,
          movement_direction:
            req.body.movement_direction,
          quantity:
            Number(req.body.quantity),
          notes:
            req.body.notes,
          created_by:
            req.user?.userId ?? null
        }
      );

    await logAudit({
      user: req.user,
      module: 'farmacia',
      action: 'movimiento_stock_medicamento',
      entityType: 'medication_batch',
      entityId: Number(req.params.id),
      description:
        `Registro movimiento ${req.body.movement_type} de ${Number(req.body.quantity)} unidades en lote ${req.params.id}`,
      newData: req.body,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.status(201).json({
      success: true,
      message:
        'Movimiento registrado',
      data: result
    });

  } catch (error: any) {

    console.error(error);

    return res.status(400).json({
      success: false,
      message:
        error.message ||
        'Error al registrar movimiento'
    });
  }
}
