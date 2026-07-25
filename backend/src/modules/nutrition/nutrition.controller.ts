import { Response } from 'express';

import { AuthRequest } from '../auth/auth.middleware';
import { logAudit } from '../audit/audit.service';

import {
  createNutritionControl,
  createNutritionPatient,
  getNutritionControlById,
  getNutritionControls,
  getNutritionPatientById,
  getNutritionPatients,
  getNutritionStats,
  updateNutritionControl,
  updateNutritionPatient
} from './nutrition.service';

function validatePatient(
  body: any
) {
  if (!body.document) {
    return 'El DNI es obligatorio';
  }

  if (!body.first_name) {
    return 'El nombre es obligatorio';
  }

  if (!body.last_name) {
    return 'El apellido es obligatorio';
  }

  return null;
}

function validateControl(
  body: any
) {
  if (!body.control_date) {
    return 'La fecha del control es obligatoria';
  }

  if (
    !body.weight_kg ||
    Number(body.weight_kg) <= 0
  ) {
    return 'El peso debe ser mayor a cero';
  }

  if (
    !body.height_m ||
    Number(body.height_m) <= 0
  ) {
    return 'La talla debe ser mayor a cero';
  }

  return null;
}

export async function handleGetNutritionPatients(
  req: AuthRequest,
  res: Response
) {
  try {
    const [patients, stats] =
      await Promise.all([
        getNutritionPatients(req.query as any),
        getNutritionStats()
      ]);

    return res.json({
      success: true,
      data: patients,
      stats
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener pacientes'
    });
  }
}

export async function handleCreateNutritionPatient(
  req: AuthRequest,
  res: Response
) {
  try {
    const validationError =
      validatePatient(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    const id =
      await createNutritionPatient(
        req.body,
        req.user?.userId || req.user?.id
      );

    await logAudit({
      user: req.user,
      module: 'nutricion',
      action: 'crear_paciente',
      entityType: 'nutrition_patient',
      entityId: id,
      description:
        `Creo paciente nutricional ${req.body.last_name}, ${req.body.first_name}`,
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
      message: error.message || 'Error al crear paciente'
    });
  }
}

export async function handleUpdateNutritionPatient(
  req: AuthRequest,
  res: Response
) {
  try {
    const validationError =
      validatePatient(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    const previous =
      await getNutritionPatientById(
        Number(req.params.id)
      );

    if (!previous) {
      return res.status(404).json({
        success: false,
        message: 'Paciente no encontrado'
      });
    }

    await updateNutritionPatient(
      Number(req.params.id),
      req.body,
      req.user?.userId || req.user?.id
    );

    await logAudit({
      user: req.user,
      module: 'nutricion',
      action: 'editar_paciente',
      entityType: 'nutrition_patient',
      entityId: Number(req.params.id),
      description:
        `Edito paciente nutricional ${req.body.last_name}, ${req.body.first_name}`,
      oldData: previous,
      newData: req.body,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json({
      success: true
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message || 'Error al editar paciente'
    });
  }
}

export async function handleGetNutritionControls(
  req: AuthRequest,
  res: Response
) {
  try {
    const [patient, controls] =
      await Promise.all([
        getNutritionPatientById(
          Number(req.params.patientId)
        ),
        getNutritionControls(
          Number(req.params.patientId)
        )
      ]);

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Paciente no encontrado'
      });
    }

    return res.json({
      success: true,
      data: {
        patient,
        controls
      }
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener controles'
    });
  }
}

export async function handleCreateNutritionControl(
  req: AuthRequest,
  res: Response
) {
  try {
    const validationError =
      validateControl(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    const patient =
      await getNutritionPatientById(
        Number(req.params.patientId)
      );

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Paciente no encontrado'
      });
    }

    const id =
      await createNutritionControl(
        Number(req.params.patientId),
        req.body,
        req.user?.userId || req.user?.id
      );

    await logAudit({
      user: req.user,
      module: 'nutricion',
      action: 'crear_control',
      entityType: 'nutrition_control',
      entityId: id,
      description:
        `Cargo control nutricional de ${patient.last_name}, ${patient.first_name}`,
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
      message: error.message || 'Error al crear control'
    });
  }
}

export async function handleUpdateNutritionControl(
  req: AuthRequest,
  res: Response
) {
  try {
    const validationError =
      validateControl(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    const previous =
      await getNutritionControlById(
        Number(req.params.controlId)
      );

    if (!previous) {
      return res.status(404).json({
        success: false,
        message: 'Control no encontrado'
      });
    }

    await updateNutritionControl(
      Number(req.params.controlId),
      req.body,
      req.user?.userId || req.user?.id
    );

    await logAudit({
      user: req.user,
      module: 'nutricion',
      action: 'editar_control',
      entityType: 'nutrition_control',
      entityId: Number(req.params.controlId),
      description:
        `Edito control nutricional ${req.params.controlId}`,
      oldData: previous,
      newData: req.body,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json({
      success: true
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message || 'Error al editar control'
    });
  }
}
