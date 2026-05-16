import {
  Request,
  Response
} from 'express';

import {
  buildWhatsappResponse,
  createWhatsappReply,
  getAllWhatsappReplies,
  toggleWhatsappReply,
  updateWhatsappReply
} from './whatsapp.service';

function validateReply(
  body: any
) {

  if (!body.code) {
    return 'El codigo es obligatorio';
  }

  if (!body.title) {
    return 'El titulo es obligatorio';
  }

  if (!body.response) {
    return 'La respuesta es obligatoria';
  }

  return null;
}

export async function getReplies(
  req: Request,
  res: Response
) {

  try {

    const replies =
      await getAllWhatsappReplies();

    return res.json({
      success: true,
      data: replies
    });

  } catch (error: any) {

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export async function createReply(
  req: Request,
  res: Response
) {

  try {

    const validationError =
      validateReply(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    const id =
      await createWhatsappReply(req.body);

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

export async function updateReply(
  req: Request,
  res: Response
) {

  try {

    const validationError =
      validateReply(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    await updateWhatsappReply(
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

export async function toggleReply(
  req: Request,
  res: Response
) {

  try {

    await toggleWhatsappReply(
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

export async function simulateMessage(
  req: Request,
  res: Response
) {

  try {

    const result =
      await buildWhatsappResponse(
        req.body.message || '',
        req.body.phone || null
      );

    return res.json({
      success: true,
      data: result
    });

  } catch (error: any) {

    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function receiveIncomingMessage(
  req: Request,
  res: Response
) {

  try {

    const result =
      await buildWhatsappResponse(
        req.body.message ||
          req.body.text ||
          '',
        req.body.phone ||
          req.body.from ||
          null
      );

    return res.json({
      success: true,
      data: result
    });

  } catch (error: any) {

    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}
