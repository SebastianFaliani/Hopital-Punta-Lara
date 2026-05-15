import { Request, Response }
  from 'express';

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
  req: Request,
  res: Response
) {

  try {

    const medications =
      await getAllMedications();

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
  req: Request,
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
  req: Request,
  res: Response
) {

  try {

    await updateMedication(
      Number(req.params.id),
      req.body
    );

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
  req: Request,
  res: Response
) {

  try {

    await toggleMedication(
      Number(req.params.id)
    );

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