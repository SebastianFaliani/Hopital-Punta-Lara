import {
  Request,
  Response
} from 'express';

import {
  AuthRequest
} from '../auth/auth.middleware';

import {
  createAmbulance,
  createAmbulanceMaintenanceRecord,
  createAmbulanceType,
  getAllAmbulances,
  getAllAmbulanceTypes,
  getAmbulanceMaintenanceRecords,
  getMaintenanceAlertsSummary,
  toggleAmbulance,
  toggleAmbulanceType,
  updateAmbulanceMaintenanceRecord,
  updateAmbulanceType,
  updateAmbulance
} from './ambulances.service';

function validateAmbulance(
  body: any
) {

  if (!body.internal_code) {
    return 'El codigo interno es obligatorio';
  }

  if (!body.plate) {
    return 'La patente es obligatoria';
  }

  if (!body.ambulance_type_id) {
    return 'El tipo es obligatorio';
  }

  return null;
}

function validateAmbulanceType(
  body: any
) {
  if (!body.name) {
    return 'El nombre del tipo es obligatorio';
  }

  return null;
}

function validateMaintenanceRecord(
  body: any
) {
  if (!body.maintenance_type) {
    return 'El tipo de mantenimiento es obligatorio';
  }

  if (!body.start_date) {
    return 'La fecha de inicio es obligatoria';
  }

  if (
    ![
      'service',
      'mecanica',
      'cubiertas',
      'aceite',
      'frenos',
      'electricidad',
      'limpieza',
      'verificacion',
      'otro'
    ].includes(body.maintenance_type)
  ) {
    return 'El tipo de mantenimiento no es valido';
  }

  if (
    body.status &&
    ![
      'programado',
      'en_reparacion',
      'finalizado',
      'cancelado'
    ].includes(body.status)
  ) {
    return 'El estado de mantenimiento no es valido';
  }

  return null;
}

export async function getTypes(
  req: Request,
  res: Response
) {
  try {
    return res.json({
      success: true,
      data:
        await getAllAmbulanceTypes()
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export async function createType(
  req: Request,
  res: Response
) {
  try {
    const validationError =
      validateAmbulanceType(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    const id =
      await createAmbulanceType(req.body);

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

export async function updateType(
  req: Request,
  res: Response
) {
  try {
    const validationError =
      validateAmbulanceType(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    await updateAmbulanceType(
      Number(req.params.id),
      req.body
    );

    return res.json({
      success: true
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function toggleTypeStatus(
  req: Request,
  res: Response
) {
  try {
    await toggleAmbulanceType(
      Number(req.params.id)
    );

    return res.json({
      success: true
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function getAmbulances(
  req: Request,
  res: Response
) {

  try {

    const ambulances =
      await getAllAmbulances();

    return res.json({
      success: true,
      data: ambulances
    });

  } catch (error: any) {

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export async function getMaintenanceAlerts(
  req: Request,
  res: Response
) {
  try {
    return res.json({
      success: true,
      data:
        await getMaintenanceAlertsSummary()
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export async function create(
  req: Request,
  res: Response
) {

  try {

    const validationError =
      validateAmbulance(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    const id =
      await createAmbulance(req.body);

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

export async function update(
  req: Request,
  res: Response
) {

  try {

    const validationError =
      validateAmbulance(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    await updateAmbulance(
      Number(req.params.id),
      req.body
    );

    return res.json({
      success: true,
      message:
        'Ambulancia actualizada'
    });

  } catch (error: any) {

    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function toggleStatus(
  req: Request,
  res: Response
) {

  try {

    await toggleAmbulance(
      Number(req.params.id)
    );

    return res.json({
      success: true
    });

  } catch (error: any) {

    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function getMaintenanceRecords(
  req: Request,
  res: Response
) {
  try {
    return res.json({
      success: true,
      data:
        await getAmbulanceMaintenanceRecords(
          Number(req.params.id)
        )
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function createMaintenanceRecord(
  req: AuthRequest,
  res: Response
) {
  try {
    const validationError =
      validateMaintenanceRecord(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    const id =
      await createAmbulanceMaintenanceRecord(
        Number(req.params.id),
        req.body,
        req.user?.userId ?? null
      );

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

export async function updateMaintenanceRecord(
  req: Request,
  res: Response
) {
  try {
    const validationError =
      validateMaintenanceRecord(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    await updateAmbulanceMaintenanceRecord(
      Number(req.params.recordId),
      req.body
    );

    return res.json({
      success: true
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}
