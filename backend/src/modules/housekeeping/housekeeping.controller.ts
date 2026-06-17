import {
  Request,
  Response
} from 'express';

import { AuthRequest } from '../auth/auth.middleware';
import { logAudit } from '../audit/audit.service';

import {
  cancelHousekeepingMovement,
  createHousekeepingItem,
  createHousekeepingMovement,
  getHousekeepingItemById,
  getHousekeepingItems,
  getHousekeepingMovementById,
  getHousekeepingMovements,
  getHousekeepingStats,
  registerHousekeepingReturn,
  toggleHousekeepingItem,
  updateHousekeepingItem
} from './housekeeping.service';

function validateItemBody(body: any) {
  if (!body.name?.trim()) {
    return 'El elemento es obligatorio';
  }

  return null;
}

function validateMovementBody(body: any) {
  if (!body.movement_date) {
    return 'La fecha es obligatoria';
  }

  if (!body.item_id) {
    return 'El elemento es obligatorio';
  }

  if (!body.movement_type) {
    return 'El tipo de movimiento es obligatorio';
  }

  if (Number(body.quantity || 0) <= 0) {
    return 'La cantidad debe ser mayor a cero';
  }

  if (
    ['salida', 'prestamo', 'consumo'].includes(body.movement_type) &&
    !body.destination_person?.trim()
  ) {
    return 'Debe indicar a quien se entrega';
  }

  return null;
}

function validateReturnBody(body: any) {
  if (!body.return_date) {
    return 'La fecha de devolucion es obligatoria';
  }

  if (Number(body.returned_quantity || 0) <= 0) {
    return 'La cantidad devuelta debe ser mayor a cero';
  }

  return null;
}

export async function handleGetHousekeepingItems(
  req: Request,
  res: Response
) {
  try {
    return res.json({
      success: true,
      data: await getHousekeepingItems(req.query)
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export async function handleCreateHousekeepingItem(
  req: AuthRequest,
  res: Response
) {
  try {
    const validationError =
      validateItemBody(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    const id =
      await createHousekeepingItem(req.body);

    await logAudit({
      user: req.user,
      module: 'mayordomia',
      action: 'crear_elemento',
      entityType: 'housekeeping_item',
      entityId: id,
      description: `Creo elemento de mayordomia ${req.body.name}`,
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

export async function handleUpdateHousekeepingItem(
  req: AuthRequest,
  res: Response
) {
  try {
    const validationError =
      validateItemBody(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    const previous =
      await getHousekeepingItemById(Number(req.params.id));

    await updateHousekeepingItem(
      Number(req.params.id),
      req.body
    );

    await logAudit({
      user: req.user,
      module: 'mayordomia',
      action: 'editar_elemento',
      entityType: 'housekeeping_item',
      entityId: Number(req.params.id),
      description: `Edito elemento de mayordomia ${req.body.name}`,
      oldData: previous,
      newData: req.body,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json({ success: true });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function handleToggleHousekeepingItem(
  req: AuthRequest,
  res: Response
) {
  try {
    const previous =
      await getHousekeepingItemById(Number(req.params.id));

    await toggleHousekeepingItem(Number(req.params.id));

    await logAudit({
      user: req.user,
      module: 'mayordomia',
      action: 'cambiar_estado_elemento',
      entityType: 'housekeeping_item',
      entityId: Number(req.params.id),
      description: `Cambio estado de elemento ${req.params.id}`,
      oldData: previous,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json({ success: true });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function handleGetHousekeepingMovements(
  req: Request,
  res: Response
) {
  try {
    const result =
      await getHousekeepingMovements(req.query);

    return res.json({
      success: true,
      data: result.records,
      pagination: result.pagination
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export async function handleGetHousekeepingStats(
  req: Request,
  res: Response
) {
  try {
    return res.json({
      success: true,
      data: await getHousekeepingStats(req.query)
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export async function handleCreateHousekeepingMovement(
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

    const id =
      await createHousekeepingMovement(
        req.body,
        req.user?.userId || req.user?.id
      );

    await logAudit({
      user: req.user,
      module: 'mayordomia',
      action: 'crear_movimiento',
      entityType: 'housekeeping_movement',
      entityId: id,
      description: `Cargo movimiento de mayordomia ${req.body.movement_type}`,
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

export async function handleRegisterHousekeepingReturn(
  req: AuthRequest,
  res: Response
) {
  try {
    const validationError =
      validateReturnBody(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    const previous =
      await getHousekeepingMovementById(Number(req.params.id));

    await registerHousekeepingReturn(
      Number(req.params.id),
      req.body,
      req.user?.userId || req.user?.id
    );

    await logAudit({
      user: req.user,
      module: 'mayordomia',
      action: 'registrar_devolucion',
      entityType: 'housekeeping_movement',
      entityId: Number(req.params.id),
      description: `Registro devolucion de movimiento ${req.params.id}`,
      oldData: previous,
      newData: req.body,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json({ success: true });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function handleCancelHousekeepingMovement(
  req: AuthRequest,
  res: Response
) {
  try {
    const previous =
      await getHousekeepingMovementById(Number(req.params.id));

    await cancelHousekeepingMovement(
      Number(req.params.id),
      req.user?.userId || req.user?.id
    );

    await logAudit({
      user: req.user,
      module: 'mayordomia',
      action: 'cancelar_movimiento',
      entityType: 'housekeeping_movement',
      entityId: Number(req.params.id),
      description: `Cancelo movimiento de mayordomia ${req.params.id}`,
      oldData: previous,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json({ success: true });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}
