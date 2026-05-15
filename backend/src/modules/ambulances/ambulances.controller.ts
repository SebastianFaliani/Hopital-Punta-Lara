import {
  Request,
  Response
} from 'express';

import {
  createAmbulance,
  getAllAmbulances,
  toggleAmbulance,
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

  if (!body.type) {
    return 'El tipo es obligatorio';
  }

  return null;
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
