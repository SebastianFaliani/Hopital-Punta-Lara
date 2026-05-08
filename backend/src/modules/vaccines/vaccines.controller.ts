import {
  Request,
  Response
} from 'express';
import { AuthRequest } from '../auth/auth.middleware';
import { logAudit } from '../audit/audit.service';

import {
  createVaccine,
  getAllVaccines,
  getVaccineById,
  toggleVaccine,
  updateVaccine
} from './vaccines.service';

function validateVaccineBody(
  body: any
) {
  if (!body.name) {
    return 'El nombre es obligatorio';
  }

  if (
    body.minimum_stock !== undefined &&
    Number(body.minimum_stock) < 0
  ) {
    return 'El stock minimo debe ser mayor o igual a cero';
  }

  return null;
}

export async function handleGetAllVaccines(
  req: Request,
  res: Response
) {
  try {
    const vaccines =
      await getAllVaccines();

    return res.json({
      success: true,
      data: vaccines
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: 'Error al obtener vacunas'
    });
  }
}

export async function handleGetVaccineById(
  req: Request,
  res: Response
) {
  try {
    const vaccine =
      await getVaccineById(
        Number(req.params.id)
      );

    if (!vaccine) {
      return res.status(404).json({
        success: false,
        message: 'Vacuna no encontrada'
      });
    }

    return res.json({
      success: true,
      data: vaccine
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: 'Error al obtener vacuna'
    });
  }
}

export async function handleCreateVaccine(
  req: AuthRequest,
  res: Response
) {
  try {
    const validationError =
      validateVaccineBody(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    const id =
      await createVaccine(req.body);

    await logAudit({
      user: req.user,
      module: 'vacunas',
      action: 'crear_vacuna',
      entityType: 'vaccine',
      entityId: id,
      description: `Creo vacuna ${req.body.name}`,
      newData: req.body,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.status(201).json({
      success: true,
      message: 'Vacuna creada',
      data: { id }
    });
  } catch (error: any) {
    console.error(error);

    return res.status(400).json({
      success: false,
      message: error.message || 'Error al crear vacuna'
    });
  }
}

export async function handleUpdateVaccine(
  req: AuthRequest,
  res: Response
) {
  try {
    const validationError =
      validateVaccineBody(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    await updateVaccine(
      Number(req.params.id),
      req.body
    );

    await logAudit({
      user: req.user,
      module: 'vacunas',
      action: 'editar_vacuna',
      entityType: 'vaccine',
      entityId: Number(req.params.id),
      description: `Edito vacuna ${req.params.id}`,
      newData: req.body,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json({
      success: true,
      message: 'Vacuna actualizada'
    });
  } catch (error: any) {
    console.error(error);

    return res.status(400).json({
      success: false,
      message: error.message || 'Error al actualizar vacuna'
    });
  }
}

export async function handleToggleVaccine(
  req: AuthRequest,
  res: Response
) {
  try {
    await toggleVaccine(
      Number(req.params.id)
    );

    await logAudit({
      user: req.user,
      module: 'vacunas',
      action: 'activar_desactivar_vacuna',
      entityType: 'vaccine',
      entityId: Number(req.params.id),
      description: `Cambio estado de vacuna ${req.params.id}`,
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
