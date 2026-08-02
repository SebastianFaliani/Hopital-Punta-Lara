import {
  Request,
  Response
} from 'express';

import { AuthRequest }
  from '../auth/auth.middleware';

import {
  createBulkDriverShifts,
  createDriverShift,
  deleteDriverShift,
  getAllDriverShifts,
  getDriverShiftChangeReport,
  updateDriverShift
} from './driver-shifts.service';

function validateShift(
  body: any
) {

  if (!body.driver_id) {
    return 'El chofer es obligatorio';
  }

  if (!body.shift_date || !body.shift_type) {
    return 'Fecha y turno son obligatorios';
  }

  if (
    !['manana', 'tarde'].includes(body.shift_type)
  ) {
    return 'El turno seleccionado no es valido';
  }

  return null;
}

export async function createBulk(
  req: Request,
  res: Response
) {
  try {
    if (
      !req.body.driver_id ||
      !/^\d{4}-\d{2}$/.test(req.body.month || '')
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Chofer y mes son obligatorios'
      });
    }

    const totalDays =
      (req.body.morning_days || []).length +
      (req.body.afternoon_days || []).length;

    if (
      totalDays === 0 &&
      !req.body.sync_existing
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Selecciona al menos un dia de guardia'
      });
    }

    const result =
      await createBulkDriverShifts(req.body);

    return res.status(201).json({
      success: true,
      data: result,
      message:
        `Se guardaron ${result.created} guardias` +
        (
          result.skipped
            ? ` y se omitieron ${result.skipped} repetidas`
            : ''
        ) +
        (
          result.deleted
            ? `. Se actualizaron ${result.deleted} guardias existentes`
            : ''
        )
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function getDriverShifts(
  req: Request,
  res: Response
) {

  try {

    const shifts =
      await getAllDriverShifts();

    return res.json({
      success: true,
      data: shifts
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
      validateShift(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    const id =
      await createDriverShift(req.body);

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
  req: AuthRequest,
  res: Response
) {

  try {

    const validationError =
      validateShift(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    await updateDriverShift(
      Number(req.params.id),
      req.body,
      req.user?.userId || req.user?.id || null
    );

    return res.json({
      success: true,
      message:
        'Guardia actualizada'
    });

  } catch (error: any) {

    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function getShiftChangeReport(
  req: Request,
  res: Response
) {

  try {

    const report =
      await getDriverShiftChangeReport(
        req.query
      );

    return res.json({
      success: true,
      data: report
    });

  } catch (error: any) {

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export async function remove(
  req: Request,
  res: Response
) {

  try {

    await deleteDriverShift(
      Number(req.params.id)
    );

    return res.json({
      success: true,
      message:
        'Guardia eliminada'
    });

  } catch (error: any) {

    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}
