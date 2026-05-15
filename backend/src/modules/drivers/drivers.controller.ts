import {
  Request,
  Response
} from 'express';

import {
  createDriver,
  getAllDrivers,
  toggleDriver,
  updateDriver
} from './drivers.service';

function validateDriver(
  body: any
) {

  if (!body.first_name) {
    return 'El nombre es obligatorio';
  }

  if (!body.last_name) {
    return 'El apellido es obligatorio';
  }

  return null;
}

export async function getDrivers(
  req: Request,
  res: Response
) {

  try {

    const drivers =
      await getAllDrivers();

    return res.json({
      success: true,
      data: drivers
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
      validateDriver(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    const id =
      await createDriver(req.body);

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
      validateDriver(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    await updateDriver(
      Number(req.params.id),
      req.body
    );

    return res.json({
      success: true,
      message:
        'Chofer actualizado'
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

    await toggleDriver(
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
