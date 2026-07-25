import {
  Request,
  Response
} from 'express';

import { AuthRequest } from '../auth/auth.middleware';
import { logAudit } from '../audit/audit.service';

import { deliverWhatsappTextMessage } from '../whatsapp/whatsapp-delivery.service';
import { getLaboratoryPdfMetadata } from './laboratory-pdf.service';

import {
  createLaboratoryRecord,
  deleteLaboratoryRecord,
  expireOldLaboratoryRecords,
  getLaboratoryRecordById,
  getLaboratoryRecords,
  getLaboratoryStats,
  getLaboratoryTestCatalog,
  getPendingLaboratoryWhatsappNotifications,
  getPersonByDocument,
  markLaboratoryWhatsappNotified,
  registerLaboratoryPickup,
  reopenLaboratoryWorkflow,
  revertLaboratoryPickup,
  updateLaboratoryCompletion,
  updateLaboratoryRecord
} from './laboratory.service';

function isLaboratoryWorkflowLocked(record: any) {
  return Boolean(
    (record?.pickup_date || record?.whatsapp_notified_at) &&
    !record?.workflow_reopened_at
  );
}

function validateLaboratoryBody(
  body: any
) {
  if (!body.study_date) {
    return 'La fecha del estudio es obligatoria';
  }

  if (!body.patient_document) {
    return 'El DNI del paciente es obligatorio';
  }

  if (!body.patient_last_name) {
    return 'El apellido del paciente es obligatorio';
  }

  if (!body.patient_first_name) {
    return 'El nombre del paciente es obligatorio';
  }

  if (
    !body.has_blood_extraction &&
    !body.has_urine_sample
  ) {
    return 'Debe seleccionar Extraccion, Orina o ambas';
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

function formatLaboratoryWhatsappMessage(
  record: any
) {
  const patientName =
    [
      record.patient_first_name,
      record.patient_last_name
    ]
      .filter(Boolean)
      .join(' ')
      .trim() ||
    'paciente';

  const studyDate =
    record.study_date
      ? new Date(record.study_date)
        .toLocaleDateString('es-AR')
      : '';

  return [
    `Hola ${patientName}.`,
    '',
    studyDate
      ? `Te enviamos adjuntos tus resultados de laboratorio correspondientes al ${studyDate}.`
      : 'Te enviamos adjuntos tus resultados de laboratorio.',
    '',
    'Si lo preferis, tambien podes retirar una copia personalmente en el Hospital Municipal de Punta Lara, de lunes a viernes de 8:00 a 18:00 hs.',
    '',
    'Este es un mensaje automatico enviado por el sistema del Hospital Municipal de Punta Lara.'
  ].join('\n');
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

export async function handleGetLaboratoryPatient(
  req: Request,
  res: Response
) {
  try {
    const patient =
      await getPersonByDocument(
        String(req.params.document || '')
      );

    return res.json({
      success: true,
      data: patient
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: 'Error al buscar paciente'
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

export async function handleRevertLaboratoryPickup(
  req: AuthRequest,
  res: Response
) {
  try {
    const id = Number(req.params.id);
    const previous = await getLaboratoryRecordById(id);

    if (!previous) {
      return res.status(404).json({
        success: false,
        message: 'Estudio de laboratorio no encontrado'
      });
    }

    await revertLaboratoryPickup(
      id,
      req.user?.userId || req.user?.id
    );

    const updated = await getLaboratoryRecordById(id);

    await logAudit({
      user: req.user,
      module: 'laboratorio',
      action: 'deshacer_retiro',
      entityType: 'laboratory_record',
      entityId: id,
      description: `Deshizo retiro de estudio ${id}`,
      oldData: previous,
      newData: updated,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json({
      success: true,
      message: 'El retiro fue deshecho correctamente'
    });
  } catch (error: any) {
    console.error(error);

    return res.status(400).json({
      success: false,
      message: error.message || 'Error al deshacer el retiro'
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
      isLaboratoryWorkflowLocked(previous)
    ) {
      return res.status(403).json({
        success: false,
        message: 'El laboratorio ya fue entregado. Debe reabrirse por correccion antes de modificarlo.'
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

export async function handleDeleteLaboratoryRecord(
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
      previous.pickup_date || previous.whatsapp_notified_at
    ) {
      return res.status(403).json({
        success: false,
        message: 'Un laboratorio entregado no se elimina: debe conservarse o archivarse.'
      });
    }

    await deleteLaboratoryRecord(
      Number(req.params.id)
    );

    await logAudit({
      user: req.user,
      module: 'laboratorio',
      action: 'eliminar_estudio',
      entityType: 'laboratory_record',
      entityId: Number(req.params.id),
      description: `Elimino estudio de laboratorio ${req.params.id}`,
      oldData: previous,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json({
      success: true,
      message: 'Estudio eliminado'
    });
  } catch (error: any) {
    console.error(error);

    return res.status(400).json({
      success: false,
      message: error.message || 'Error al eliminar estudio'
    });
  }
}

export async function handleExpireOldLaboratoryRecords(
  req: AuthRequest,
  res: Response
) {
  try {
    const result =
      await expireOldLaboratoryRecords(
        req.user?.userId || req.user?.id
      );

    await logAudit({
      user: req.user,
      module: 'laboratorio',
      action: 'archivar_estudios',
      entityType: 'laboratory_record',
      description: `Archivo ${result.affected_rows} estudios sin eliminar sus PDF`,
      newData: result,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json({
      success: true,
      message:
        result.affected_rows > 0
          ? 'Estudios archivados correctamente'
          : 'No habia estudios para archivar',
      data: result
    });
  } catch (error: any) {
    console.error(error);

    return res.status(400).json({
      success: false,
      message: error.message || 'Error al archivar estudios'
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
      isLaboratoryWorkflowLocked(previous)
    ) {
      return res.status(403).json({
        success: false,
        message: 'El laboratorio ya fue entregado. Debe reabrirse por correccion antes de modificar sus resultados.'
      });
    }

    if (typeof req.body.is_complete !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Debe indicar si el estudio esta completo o incompleto'
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

export async function handleSendLaboratoryWhatsappNotification(
  req: AuthRequest,
  res: Response
) {
  try {
    const record =
      await getLaboratoryRecordById(
        Number(req.params.id)
      );

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Estudio de laboratorio no encontrado'
      });
    }

    if (!record.patient_phone) {
      return res.status(400).json({
        success: false,
        message: 'El paciente no tiene telefono cargado'
      });
    }

    if (!record.is_complete) {
      return res.status(400).json({
        success: false,
        message: 'Solo se puede avisar cuando el estudio esta completo'
      });
    }

    if (record.pickup_date && !record.workflow_reopened_at) {
      return res.status(400).json({
        success: false,
        message: 'El estudio ya fue retirado'
      });
    }

    const message =
      String(req.body.message || '').trim() ||
      formatLaboratoryWhatsappMessage(record);

    const pdfs = await getLaboratoryPdfMetadata(Number(req.params.id));
    if (!pdfs.length) {
      return res.status(400).json({
        success: false,
        message: 'Debe cargar al menos un PDF antes de enviar el laboratorio por WhatsApp'
      });
    }
    const delivery = await deliverWhatsappTextMessage(
      record.patient_phone,
      message,
      'laboratory_notification',
      {
        attachments: pdfs.map((pdf: any) => ({ id: Number(pdf.id), name: pdf.file_name })),
        referenceType: 'laboratory_record',
        referenceId: Number(req.params.id),
        requestedBy: req.user?.userId || req.user?.id
      }
    );

    if (!delivery.queued) {
      await markLaboratoryWhatsappNotified(
        Number(req.params.id),
        req.user?.userId || req.user?.id
      );
    }

    await logAudit({
      user: req.user,
      module: 'laboratorio',
      action: 'avisar_resultado_whatsapp',
      entityType: 'laboratory_record',
      entityId: Number(req.params.id),
      description: `Envio aviso por WhatsApp del estudio ${req.params.id}`,
      newData: {
        phone: record.patient_phone,
        message
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json({
      success: true,
      message: delivery.queued
        ? 'Aviso pendiente de envio por WhatsApp'
        : 'Aviso enviado por WhatsApp'
    });
  } catch (error: any) {
    console.error(error);

    return res.status(400).json({
      success: false,
      message: error.message || 'Error al enviar WhatsApp'
    });
  }
}

export async function handleReopenLaboratoryWorkflow(
  req: AuthRequest,
  res: Response
) {
  try {
    const reason = String(req.body.reason || '').trim();
    if (reason.length < 5) {
      return res.status(400).json({ success: false, message: 'Debe indicar el motivo de la correccion' });
    }
    const previous = await getLaboratoryRecordById(Number(req.params.id));
    if (!previous) {
      return res.status(404).json({ success: false, message: 'Estudio de laboratorio no encontrado' });
    }
    const reopened = await reopenLaboratoryWorkflow(
      Number(req.params.id), reason, req.user?.userId || req.user?.id
    );
    if (!reopened) {
      return res.status(400).json({ success: false, message: 'El laboratorio no tiene una entrega para reabrir' });
    }
    await logAudit({
      user: req.user, module: 'laboratorio', action: 'reabrir_por_correccion',
      entityType: 'laboratory_record', entityId: Number(req.params.id),
      description: `Reabrio laboratorio por correccion: ${reason}`,
      oldData: previous, newData: { reason }, ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });
    return res.json({ success: true, message: 'Laboratorio reabierto para correccion' });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message || 'No se pudo reabrir' });
  }
}

export async function handleSendPendingLaboratoryWhatsappNotifications(
  req: AuthRequest,
  res: Response
) {
  try {
    const records = await getPendingLaboratoryWhatsappNotifications();
    let queued = 0;
    const errors: Array<{ id: number; patient: string; error: string }> = [];

    for (const record of records) {
      try {
        const pdfs = await getLaboratoryPdfMetadata(Number(record.id));
        const delivery = await deliverWhatsappTextMessage(
          record.patient_phone,
          formatLaboratoryWhatsappMessage(record),
          'laboratory_notification_bulk',
          {
            attachments: pdfs.map((pdf: any) => ({ id: Number(pdf.id), name: pdf.file_name })),
            referenceType: 'laboratory_record',
            referenceId: Number(record.id),
            requestedBy: req.user?.userId || req.user?.id
          }
        );
        if (!delivery.queued) {
          await markLaboratoryWhatsappNotified(
            Number(record.id),
            req.user?.userId || req.user?.id
          );
        }
        queued += 1;
      } catch (error: any) {
        errors.push({
          id: Number(record.id),
          patient: `${record.patient_last_name || ''} ${record.patient_first_name || ''}`.trim(),
          error: error.message || 'No se pudo preparar el aviso'
        });
      }
    }

    await logAudit({
      user: req.user,
      module: 'laboratorio',
      action: 'avisar_resultados_whatsapp_pendientes',
      entityType: 'laboratory_record',
      description: `Avisos masivos de laboratorio: ${queued} preparados, ${errors.length} con error`,
      newData: { queued, failed: errors.length, record_ids: records.map((record: any) => record.id) },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json({
      success: true,
      message: queued
        ? `${queued} aviso${queued === 1 ? '' : 's'} pendiente${queued === 1 ? '' : 's'} de envio por WhatsApp`
        : 'No hay estudios pendientes en condiciones de recibir el aviso',
      data: { queued, failed: errors.length, errors }
    });
  } catch (error: any) {
    console.error(error);
    return res.status(400).json({
      success: false,
      message: error.message || 'No se pudieron preparar los avisos de WhatsApp'
    });
  }
}
