import { Request, Response }
  from 'express';
import { AuthRequest } from '../auth/auth.middleware';
import { logAudit } from '../audit/audit.service';
import {
  getScopedFacilityId
} from '../health-facilities/facility-access';

import {
  getAllMedications,
  getMedicationById,
  createMedication,
  updateMedication,
  toggleMedication
} from './medications.service';
import { log } from 'node:console';



// ======================================
// OBTENER TODOS
// ======================================

export async function handleGetAllMedications(
  req: AuthRequest,
  res: Response
) {

  try {

    const medications =
      await getAllMedications(
        getScopedFacilityId(
          req.user,
          req.query.facility_id
            ? Number(req.query.facility_id)
            : null
        )
      );

    return res.json({
      success: true,
      data: medications
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        'Error al obtener medicamentos'
    });
  }
}



// ======================================
// OBTENER POR ID
// ======================================

export async function handleGetMedicationById(
  req: Request,
  res: Response
) {

  try {

    const medication =
      await getMedicationById(
        Number(req.params.id)
      );

    if (!medication) {

      return res.status(404).json({
        success: false,
        message:
          'Medicamento no encontrado'
      });
    }

    return res.json({
      success: true,
      data: medication
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        'Error al obtener medicamento'
    });
  }
}



// ======================================
// CREAR
// ======================================

export async function handleCreateMedication(
  req: AuthRequest,
  res: Response
) {
  try {

    const {
      name,
      generic_name,
      presentation,
      concentration,
      unit,
      description,
      minimum_stock
    } = req.body;

    if (!name) {

      return res.status(400).json({
        success: false,
        message:
          'El nombre es obligatorio'
      });
    }

    const medicationId =
      await createMedication({
        name,
        generic_name,
        presentation,
        concentration,
        unit,
        description,
        minimum_stock,
        is_active: true
      });

    await logAudit({
      user: req.user,
      module: 'farmacia',
      action: 'crear_medicamento',
      entityType: 'medication',
      entityId: medicationId,
      description: `Creo medicamento ${name}`,
      newData: req.body,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.status(201).json({
      success: true,
      message:
        'Medicamento creado',
      data: {
        id: medicationId
      }
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        'Error al crear medicamento'
    });
  }
}



// ======================================
// ACTUALIZAR
// ======================================

export async function handleUpdateMedication(
  req: AuthRequest,
  res: Response
) {

  try {

    await updateMedication(
      Number(req.params.id),
      req.body
    );

    await logAudit({
      user: req.user,
      module: 'farmacia',
      action: 'editar_medicamento',
      entityType: 'medication',
      entityId: Number(req.params.id),
      description: `Edito medicamento ${req.params.id}`,
      newData: req.body,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json({
      success: true,
      message:
        'Medicamento actualizado'
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        'Error al actualizar medicamento'
    });
  }
}



// ======================================
// ACTIVAR / DESACTIVAR
// ======================================

export async function handleToggleMedication(
  req: AuthRequest,
  res: Response
) {

  try {

    await toggleMedication(
      Number(req.params.id)
    );

    await logAudit({
      user: req.user,
      module: 'farmacia',
      action: 'activar_desactivar_medicamento',
      entityType: 'medication',
      entityId: Number(req.params.id),
      description: `Cambio estado de medicamento ${req.params.id}`,
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
