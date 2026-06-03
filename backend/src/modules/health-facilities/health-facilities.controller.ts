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
  createFacility,
  getActiveFacilities,
  getAllFacilities,
  toggleFacility,
  updateFacility
} from './health-facilities.service';

const allowedTypes = [
  'secretaria',
  'hospital',
  'unidad_sanitaria',
  'otro'
];

function validateFacilityBody(
  body: any
) {

  if (!body.name || !String(body.name).trim()) {
    return 'El nombre del punto es obligatorio';
  }

  if (
    !body.facility_type ||
    !allowedTypes.includes(body.facility_type)
  ) {
    return 'El tipo de punto es invalido';
  }

  return null;
}

export async function handleGetFacilities(
  req: AuthRequest,
  res: Response
) {

  try {

    const includeInactive =
      req.user?.role === 'admin' &&
      req.query.includeInactive === 'true';

    const facilities =
      includeInactive
        ? await getAllFacilities()
        : await getActiveFacilities();

    return res.json({
      success: true,
      data: facilities
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        'Error al obtener dependencias'
    });
  }
}

export async function handleCreateFacility(
  req: AuthRequest,
  res: Response
) {

  try {

    const validationError =
      validateFacilityBody(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    const id =
      await createFacility({
        name: String(req.body.name).trim(),
        facility_type: req.body.facility_type,
        address: req.body.address || null,
        phone: req.body.phone || null,
        notes: req.body.notes || null
      });

    await logAudit({
      user: req.user,
      module: 'farmacia',
      action: 'crear_punto_stock_medicamento',
      entityType: 'health_facility',
      entityId: id,
      description: `Creo dependencia ${req.body.name}`,
      newData: req.body,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.status(201).json({
      success: true,
      message: 'Dependencia creada',
      data: { id }
    });

  } catch (error: any) {

    console.error(error);

    return res.status(400).json({
      success: false,
      message:
        error.code === 'ER_DUP_ENTRY'
          ? 'Ya existe un punto con ese nombre'
          : 'Error al crear dependencia'
    });
  }
}

export async function handleUpdateFacility(
  req: AuthRequest,
  res: Response
) {

  try {

    const validationError =
      validateFacilityBody(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    await updateFacility(
      Number(req.params.id),
      {
        name: String(req.body.name).trim(),
        facility_type: req.body.facility_type,
        address: req.body.address || null,
        phone: req.body.phone || null,
        notes: req.body.notes || null
      }
    );

    await logAudit({
      user: req.user,
      module: 'farmacia',
      action: 'editar_punto_stock_medicamento',
      entityType: 'health_facility',
      entityId: Number(req.params.id),
      description: `Edito dependencia ${req.body.name}`,
      newData: req.body,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json({
      success: true,
      message: 'Dependencia actualizada'
    });

  } catch (error: any) {

    console.error(error);

    return res.status(400).json({
      success: false,
      message:
        error.code === 'ER_DUP_ENTRY'
          ? 'Ya existe un punto con ese nombre'
          : 'Error al actualizar dependencia'
    });
  }
}

export async function handleToggleFacility(
  req: AuthRequest,
  res: Response
) {

  try {

    await toggleFacility(
      Number(req.params.id)
    );

    await logAudit({
      user: req.user,
      module: 'farmacia',
      action: 'activar_desactivar_punto_stock_medicamento',
      entityType: 'health_facility',
      entityId: Number(req.params.id),
      description: `Cambio estado de dependencia ${req.params.id}`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json({
      success: true,
      message: 'Estado actualizado'
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
