import {
  Request,
  Response
} from 'express';

import { AuthRequest } from '../auth/auth.middleware';
import { getVaccineById } from '../vaccines/vaccines.service';

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
  req: Request,
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
      await getBatchesByVaccine(vaccineId);

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
  req: Request,
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
              : Number(req.body.purchase_price)
        }
      );

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
  req: Request,
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
        current_stock: Number(req.body.current_stock),
        purchase_price:
          req.body.purchase_price === '' ||
          req.body.purchase_price === undefined
            ? null
            : Number(req.body.purchase_price)
      }
    );

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
  req: Request,
  res: Response
) {
  try {
    await toggleVaccineBatch(
      Number(req.params.id)
    );

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

    const result =
      await createVaccineMovement(
        Number(req.params.id),
        {
          movement_type: req.body.movement_type,
          movement_direction: req.body.movement_direction,
          quantity: Number(req.body.quantity),
          notes: req.body.notes,
          created_by: req.user?.userId ?? null
        }
      );

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
