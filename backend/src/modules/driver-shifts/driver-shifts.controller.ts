import {
  Request,
  Response
} from 'express';

import {
  createDriverShift,
  getAllDriverShifts,
  updateDriverShift
} from './driver-shifts.service';

function validateShift(
  body: any
) {

  if (!body.driver_id) {
    return 'El chofer es obligatorio';
  }

  if (!body.ambulance_id) {
    return 'La ambulancia es obligatoria';
  }

  if (!body.start_datetime || !body.end_datetime) {
    return 'Inicio y fin son obligatorios';
  }

  if (
    new Date(body.start_datetime) >=
    new Date(body.end_datetime)
  ) {
    return 'La guardia debe terminar despues de empezar';
  }

  return null;
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

    await updateDriverShift(
      Number(req.params.id),
      req.body
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
