import {
  Request,
  Response
} from 'express';

import { AuthRequest } from '../auth/auth.middleware';
import { logAudit } from '../audit/audit.service';

import {
  createLaboratoryRecord,
  getLaboratoryRecordById,
  getLaboratoryRecords,
  getLaboratoryResultNotificationTemplate,
  getLaboratoryStats,
  getLaboratoryTestCatalog,
  notifyLaboratoryResultByWhatsapp,
  registerLaboratoryPickup,
  updateLaboratoryResultNotificationTemplate,
  updateLaboratoryCompletion,
  updateLaboratoryRecord
} from './laboratory.service';

function validateLaboratoryBody(
  body: any
) {
  if (!body.study_date) {
    return 'La fecha del estudio es obligatoria';
  }

  if (!body.patient_last_name) {
    return 'El apellido del paciente es obligatorio';
  }

  if (!body.patient_first_name) {
    return 'El nombre del paciente es obligatorio';
  }

  if (
    !Array.isArray(body.requested_test_ids) ||
    body.requested_test_ids.length === 0
  ) {
    return 'Debe seleccionar al menos una practica solicitada';
  }

  return null;
}

function validatePickupBody(
  body: any
) {
  if (!body.pickup_date) {
    return 'La fecha de retiro es obligatoria';
  }

  return null;
}

export async function handleGetLaboratoryRecords(
  req: Request,
  res: Response
) {
  try {
    const records =
      await getLaboratoryRecords(req.query as any);

    return res.json({
      success: true,
      data: records.records,
      pagination: records.pagination
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: 'Error al obtener estudios de laboratorio'
    });
  }
}

export async function handleGetLaboratoryTestCatalog(
  req: Request,
  res: Response
) {
  try {
    const catalog =
      await getLaboratoryTestCatalog();

    return res.json({
      success: true,
      data: catalog
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: 'Error al obtener practicas de laboratorio'
    });
  }
}

export async function handleGetLaboratoryNotificationTemplate(
  req: AuthRequest,
  res: Response
) {
  try {
    return res.json({
      success: true,
      data: {
        template:
          await getLaboratoryResultNotificationTemplate()
      }
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function handleUpdateLaboratoryNotificationTemplate(
  req: AuthRequest,
  res: Response
) {
  try {
    const template =
      await updateLaboratoryResultNotificationTemplate(
        req.body.template,
        req.user?.userId || req.user?.id
      );

    await logAudit({
      user: req.user,
      module: 'laboratorio',
      action: 'actualizar_mensaje_whatsapp_resultados',
      entityType: 'laboratory_settings',
      entityId: null,
      description: 'Actualizo mensaje predeterminado de aviso de resultados por WhatsApp',
      newData: { template },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json({
      success: true,
      data: { template }
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function handleRegisterLaboratoryPickup(
  req: AuthRequest,
  res: Response
) {
  try {
    const validationError =
      validatePickupBody(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    const previous =
      await getLaboratoryRecordById(
        Number(req.params.id)
      );

    if (!previous) {
      return res.status(404).json({
        success: false,
        message: 'Estudio de laboratorio no encontrado'
      });
    }

    await registerLaboratoryPickup(
      Number(req.params.id),
      {
        ...req.body,
        picked_up_by:
          req.body.picked_up_by?.trim() ||
          'Titular'
      },
      req.user?.userId || req.user?.id
    );

    await logAudit({
      user: req.user,
      module: 'laboratorio',
      action: 'registrar_retiro',
      entityType: 'laboratory_record',
      entityId: Number(req.params.id),
      description: `Registro retiro de estudio ${req.params.id}`,
      oldData: previous,
      newData: {
        ...req.body,
        picked_up_by:
          req.body.picked_up_by?.trim() ||
          'Titular'
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json({
      success: true,
      message: 'Retiro registrado'
    });
  } catch (error: any) {
    console.error(error);

    return res.status(400).json({
      success: false,
      message: error.message || 'Error al registrar retiro'
    });
  }
}

export async function handleGetLaboratoryStats(
  req: Request,
  res: Response
) {
  try {
    const stats =
      await getLaboratoryStats(req.query as any);

    return res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: 'Error al obtener estadisticas de laboratorio'
    });
  }
}

export async function handleCreateLaboratoryRecord(
  req: AuthRequest,
  res: Response
) {
  try {
    const validationError =
      validateLaboratoryBody(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    const id =
      await createLaboratoryRecord(
        req.body,
        req.user?.userId || req.user?.id
      );

    await logAudit({
      user: req.user,
      module: 'laboratorio',
      action: 'crear_estudio',
      entityType: 'laboratory_record',
      entityId: id,
      description: `Cargo estudio de laboratorio para ${req.body.patient_last_name}, ${req.body.patient_first_name}`,
      newData: req.body,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.status(201).json({
      success: true,
      message: 'Estudio de laboratorio cargado',
      data: { id }
    });
  } catch (error: any) {
    console.error(error);

    return res.status(400).json({
      success: false,
      message: error.message || 'Error al cargar estudio'
    });
  }
}

export async function handleUpdateLaboratoryRecord(
  req: AuthRequest,
  res: Response
) {
  try {
    const validationError =
      validateLaboratoryBody(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    const previous =
      await getLaboratoryRecordById(
        Number(req.params.id)
      );

    if (!previous) {
      return res.status(404).json({
        success: false,
        message: 'Estudio de laboratorio no encontrado'
      });
    }

    if (
      previous.pickup_date &&
      req.user?.role !== 'admin'
    ) {
      return res.status(403).json({
        success: false,
        message: 'El estudio ya fue retirado. Solo un administrador puede modificarlo.'
      });
    }

    await updateLaboratoryRecord(
      Number(req.params.id),
      req.body,
      req.user?.userId || req.user?.id
    );

    await logAudit({
      user: req.user,
      module: 'laboratorio',
      action: 'editar_estudio',
      entityType: 'laboratory_record',
      entityId: Number(req.params.id),
      description: `Edito estudio de laboratorio ${req.params.id}`,
      oldData: previous,
      newData: req.body,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json({
      success: true,
      message: 'Estudio actualizado'
    });
  } catch (error: any) {
    console.error(error);

    return res.status(400).json({
      success: false,
      message: error.message || 'Error al actualizar estudio'
    });
  }
}

export async function handleUpdateLaboratoryCompletion(
  req: AuthRequest,
  res: Response
) {
  try {
    const previous =
      await getLaboratoryRecordById(
        Number(req.params.id)
      );

    if (!previous) {
      return res.status(404).json({
        success: false,
        message: 'Estudio de laboratorio no encontrado'
      });
    }

    if (
      previous.pickup_date &&
      req.user?.role !== 'admin'
    ) {
      return res.status(403).json({
        success: false,
        message: 'El estudio ya fue retirado. Solo un administrador puede modificar sus resultados.'
      });
    }

    if (!Array.isArray(req.body.received_test_ids)) {
      return res.status(400).json({
        success: false,
        message: 'Debe indicar que practicas llegaron'
      });
    }

    await updateLaboratoryCompletion(
      Number(req.params.id),
      req.body,
      req.user?.userId || req.user?.id
    );

    await logAudit({
      user: req.user,
      module: 'laboratorio',
      action: 'actualizar_resultados_laboratorio',
      entityType: 'laboratory_record',
      entityId: Number(req.params.id),
      description: `Actualizo resultados recibidos del estudio ${req.params.id}`,
      oldData: previous,
      newData: req.body,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json({
      success: true,
      message: 'Estado del estudio actualizado'
    });
  } catch (error: any) {
    console.error(error);

    return res.status(400).json({
      success: false,
      message: error.message || 'Error al actualizar estado del estudio'
    });
  }
}

export async function handleNotifyLaboratoryResult(
  req: AuthRequest,
  res: Response
) {
  try {
    const previous =
      await getLaboratoryRecordById(
        Number(req.params.id)
      );

    if (!previous) {
      return res.status(404).json({
        success: false,
        message: 'Estudio de laboratorio no encontrado'
      });
    }

    await notifyLaboratoryResultByWhatsapp(
      Number(req.params.id),
      req.body.message,
      req.user?.userId || req.user?.id
    );

    await logAudit({
      user: req.user,
      module: 'laboratorio',
      action: 'notificar_resultado_whatsapp',
      entityType: 'laboratory_record',
      entityId: Number(req.params.id),
      description:
        `Envio aviso de resultado por WhatsApp para ${previous.patient_last_name}, ${previous.patient_first_name}`,
      oldData: previous,
      newData: {
        message: req.body.message
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json({
      success: true,
      message: 'Notificacion enviada'
    });
  } catch (error: any) {
    console.error(error);

    return res.status(400).json({
      success: false,
      message: error.message || 'Error al enviar notificacion'
    });
  }
}
