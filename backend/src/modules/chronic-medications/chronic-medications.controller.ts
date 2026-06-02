import {
  Request,
  Response
} from 'express';

import {
  AuthRequest
} from '../auth/auth.middleware';

import {
  logAudit
} from '../audit/audit.service';

import {
  assertFacilityAccess,
  canPrepareFromSecretary,
  getScopedFacilityId
} from '../health-facilities/facility-access';

import {
  receiveMedicationTransfer
} from '../medication-transfers/medication-transfers.service';

import {
  addChronicPlanItem,
  createChronicPackage,
  createChronicPatient,
  deliverChronicPackage,
  getChronicPackageById,
  getChronicPatientById,
  getChronicPatients,
  markChronicPackageTransferReceived,
  markPackageNotPickedUp,
  relocateChronicPackage,
  reopenChronicPackage,
  returnChronicPackageToSecretary,
  sendChronicPackage,
  toggleChronicPatient,
  toggleChronicPlanItem,
  updateChronicPatient
} from './chronic-medications.service';

function validatePatientBody(
  body: any
) {

  if (!body.full_name || !String(body.full_name).trim()) {
    return 'El nombre del paciente es obligatorio';
  }

  return null;
}

function validatePlanItemBody(
  body: any
) {

  if (!body.medication_id) {
    return 'Debe seleccionar el medicamento';
  }

  if (
    body.monthly_quantity === undefined ||
    Number(body.monthly_quantity) <= 0
  ) {
    return 'La cantidad mensual debe ser mayor a cero';
  }

  return null;
}

function validatePackageBody(
  body: any
) {

  if (!body.chronic_patient_id) {
    return 'Debe seleccionar el paciente';
  }

  if (!body.facility_id) {
    return 'Debe seleccionar el punto de retiro';
  }

  if (!body.package_year || Number(body.package_year) < 2020) {
    return 'El anio del paquete es invalido';
  }

  if (
    !body.package_month ||
    Number(body.package_month) < 1 ||
    Number(body.package_month) > 12
  ) {
    return 'El mes del paquete es invalido';
  }

  return null;
}

export async function handleGetChronicPatients(
  req: AuthRequest,
  res: Response
) {

  try {

    const patients =
      await getChronicPatients({
        search:
          req.query.search
            ? String(req.query.search)
            : undefined,
        status:
          req.query.status
            ? String(req.query.status)
            : 'todos',
        facility_id:
          getScopedFacilityId(req.user) || undefined
      });

    return res.json({
      success: true,
      data: patients
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      success: false,
      message: 'Error al obtener pacientes cronicos'
    });
  }
}

export async function handleGetChronicPatientById(
  req: AuthRequest,
  res: Response
) {

  try {

    const patient =
      await getChronicPatientById(
        Number(req.params.id)
      );

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Paciente no encontrado'
      });
    }

    if (patient.default_facility_id) {
      assertFacilityAccess(
        req.user,
        Number(patient.default_facility_id)
      );
    }

    return res.json({
      success: true,
      data: patient
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      success: false,
      message: 'Error al obtener paciente cronico'
    });
  }
}

export async function handleCreateChronicPatient(
  req: AuthRequest,
  res: Response
) {

  try {

    const validationError =
      validatePatientBody(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    if (req.body.default_facility_id) {
      assertFacilityAccess(
        req.user,
        Number(req.body.default_facility_id)
      );
    }

    const id =
      await createChronicPatient({
        full_name:
          String(req.body.full_name).trim(),
        document_number:
          req.body.document_number || null,
        phone:
          req.body.phone || null,
        address:
          req.body.address || null,
        default_facility_id:
          req.body.default_facility_id
            ? Number(req.body.default_facility_id)
            : null,
        notes:
          req.body.notes || null
      });

    await logAudit({
      user: req.user,
      module: 'farmacia',
      action: 'crear_paciente_cronico',
      entityType: 'chronic_patient',
      entityId: id,
      description: `Creo paciente cronico ${req.body.full_name}`,
      newData: req.body,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.status(201).json({
      success: true,
      message: 'Paciente cronico creado',
      data: { id }
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      success: false,
      message: 'Error al crear paciente cronico'
    });
  }
}

export async function handleUpdateChronicPatient(
  req: AuthRequest,
  res: Response
) {

  try {

    const validationError =
      validatePatientBody(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    if (req.body.default_facility_id) {
      assertFacilityAccess(
        req.user,
        Number(req.body.default_facility_id)
      );
    }

    await updateChronicPatient(
      Number(req.params.id),
      {
        full_name:
          String(req.body.full_name).trim(),
        document_number:
          req.body.document_number || null,
        phone:
          req.body.phone || null,
        address:
          req.body.address || null,
        default_facility_id:
          req.body.default_facility_id
            ? Number(req.body.default_facility_id)
            : null,
        notes:
          req.body.notes || null
      }
    );

    await logAudit({
      user: req.user,
      module: 'farmacia',
      action: 'editar_paciente_cronico',
      entityType: 'chronic_patient',
      entityId: Number(req.params.id),
      description: `Edito paciente cronico ${req.body.full_name}`,
      newData: req.body,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json({
      success: true,
      message: 'Paciente cronico actualizado'
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      success: false,
      message: 'Error al actualizar paciente cronico'
    });
  }
}

export async function handleToggleChronicPatient(
  req: AuthRequest,
  res: Response
) {

  try {

    await toggleChronicPatient(
      Number(req.params.id)
    );

    await logAudit({
      user: req.user,
      module: 'farmacia',
      action: 'activar_desactivar_paciente_cronico',
      entityType: 'chronic_patient',
      entityId: Number(req.params.id),
      description: `Cambio estado de paciente cronico ${req.params.id}`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json({
      success: true,
      message: 'Estado actualizado'
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      success: false,
      message: 'Error al actualizar estado'
    });
  }
}

export async function handleAddChronicPlanItem(
  req: AuthRequest,
  res: Response
) {

  try {

    const validationError =
      validatePlanItemBody(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    const id =
      await addChronicPlanItem(
        Number(req.params.id),
        {
          medication_id:
            Number(req.body.medication_id),
          monthly_quantity:
            Number(req.body.monthly_quantity),
          instructions:
            req.body.instructions || null
        }
      );

    await logAudit({
      user: req.user,
      module: 'farmacia',
      action: 'agregar_plan_cronico',
      entityType: 'chronic_plan_item',
      entityId: id,
      description: `Agrego medicacion al plan cronico ${req.params.id}`,
      newData: req.body,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.status(201).json({
      success: true,
      message: 'Medicacion agregada al plan',
      data: { id }
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      success: false,
      message: 'Error al agregar medicacion al plan'
    });
  }
}

export async function handleToggleChronicPlanItem(
  req: AuthRequest,
  res: Response
) {

  try {

    await toggleChronicPlanItem(
      Number(req.params.itemId)
    );

    await logAudit({
      user: req.user,
      module: 'farmacia',
      action: 'activar_desactivar_plan_cronico',
      entityType: 'chronic_plan_item',
      entityId: Number(req.params.itemId),
      description: `Cambio estado de item de plan cronico ${req.params.itemId}`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json({
      success: true,
      message: 'Estado actualizado'
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      success: false,
      message: 'Error al actualizar item del plan'
    });
  }
}

export async function handleCreateChronicPackage(
  req: AuthRequest,
  res: Response
) {

  try {

    const validationError =
      validatePackageBody(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    if (
      !(await canPrepareFromSecretary(req.user))
    ) {
      return res.status(403).json({
        success: false,
        message:
          'Los paquetes cronicos se preparan desde Secretaria de Salud'
      });
    }

    const id =
      await createChronicPackage({
        chronic_patient_id:
          Number(req.body.chronic_patient_id),
        facility_id:
          Number(req.body.facility_id),
        package_year:
          Number(req.body.package_year),
        package_month:
          Number(req.body.package_month),
        notes:
          req.body.notes || null,
        prepared_by:
          req.user?.userId ?? null
      });

    await logAudit({
      user: req.user,
      module: 'farmacia',
      action: 'crear_paquete_cronico',
      entityType: 'chronic_package',
      entityId: id,
      description: `Creo paquete cronico #${id}`,
      newData: req.body,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.status(201).json({
      success: true,
      message: 'Paquete cronico creado',
      data: { id }
    });

  } catch (error: any) {

    console.error(error);

    return res.status(400).json({
      success: false,
      message:
        error.message ||
        'Error al crear paquete cronico'
    });
  }
}

export async function handleGetChronicPackageById(
  req: AuthRequest,
  res: Response
) {

  try {

    const chronicPackage =
      await getChronicPackageById(
        Number(req.params.id)
      );

    if (!chronicPackage) {
      return res.status(404).json({
        success: false,
        message: 'Paquete no encontrado'
      });
    }

    assertFacilityAccess(
      req.user,
      Number(chronicPackage.facility_id)
    );

    return res.json({
      success: true,
      data: chronicPackage
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      success: false,
      message: 'Error al obtener paquete cronico'
    });
  }
}

export async function handleMarkPackageNotPickedUp(
  req: AuthRequest,
  res: Response
) {

  try {

    const chronicPackage =
      await getChronicPackageById(
        Number(req.params.id)
      );

    if (!chronicPackage) {
      return res.status(404).json({
        success: false,
        message: 'Paquete no encontrado'
      });
    }

    assertFacilityAccess(
      req.user,
      Number(chronicPackage.facility_id)
    );

    await markPackageNotPickedUp(
      Number(req.params.id)
    );

    await logAudit({
      user: req.user,
      module: 'farmacia',
      action: 'marcar_paquete_cronico_no_retirado',
      entityType: 'chronic_package',
      entityId: Number(req.params.id),
      description: `Marco no retirado paquete cronico #${req.params.id}`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json({
      success: true,
      message: 'Paquete marcado como no retirado'
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      success: false,
      message: 'Error al marcar paquete'
    });
  }
}

export async function handleSendChronicPackage(
  req: AuthRequest,
  res: Response
) {

  try {

    if (
      !Array.isArray(req.body.items) ||
      req.body.items.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'Debe indicar los lotes que se envian desde Secretaria'
      });
    }

    const transferId =
      await canPrepareFromSecretary(req.user)
        ? await sendChronicPackage(
            Number(req.params.id),
            req.body.items.map((item: any) => ({
              package_item_id:
                Number(item.package_item_id),
              medication_batch_id:
                Number(item.medication_batch_id),
              quantity:
                Number(item.quantity)
            })),
            req.user?.userId ?? null
          )
        : (() => {
            throw new Error(
              'Solo la vista central puede enviar paquetes desde Secretaria'
            );
          })();

    await logAudit({
      user: req.user,
      module: 'farmacia',
      action: 'enviar_paquete_cronico',
      entityType: 'chronic_package',
      entityId: Number(req.params.id),
      description: `Envio paquete cronico #${req.params.id} por traslado #${transferId}`,
      newData: req.body,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json({
      success: true,
      message: 'Paquete enviado a la unidad',
      data: {
        transfer_id: transferId
      }
    });

  } catch (error: any) {

    console.error(error);

    return res.status(400).json({
      success: false,
      message:
        error.message ||
        'Error al enviar paquete cronico'
    });
  }
}

export async function handleReopenChronicPackage(
  req: AuthRequest,
  res: Response
) {

  try {

    const chronicPackage =
      await getChronicPackageById(
        Number(req.params.id)
      );

    if (!chronicPackage) {
      return res.status(404).json({
        success: false,
        message: 'Paquete no encontrado'
      });
    }

    assertFacilityAccess(
      req.user,
      Number(chronicPackage.facility_id)
    );

    const nextStatus =
      await reopenChronicPackage(
        Number(req.params.id)
      );

    await logAudit({
      user: req.user,
      module: 'farmacia',
      action: 'reabrir_paquete_cronico',
      entityType: 'chronic_package',
      entityId: Number(req.params.id),
      description: `Reabrio paquete cronico #${req.params.id} como ${nextStatus}`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json({
      success: true,
      message: 'Paquete reabierto',
      data: {
        status: nextStatus
      }
    });

  } catch (error: any) {

    console.error(error);

    return res.status(400).json({
      success: false,
      message:
        error.message ||
        'Error al reabrir paquete'
    });
  }
}

export async function handleReturnChronicPackage(
  req: AuthRequest,
  res: Response
) {

  try {

    const chronicPackage =
      await getChronicPackageById(
        Number(req.params.id)
      );

    if (!chronicPackage) {
      return res.status(404).json({
        success: false,
        message: 'Paquete no encontrado'
      });
    }

    assertFacilityAccess(
      req.user,
      Number(chronicPackage.facility_id)
    );

    const transferId =
      await returnChronicPackageToSecretary(
        Number(req.params.id),
        req.user?.userId ?? null
      );

    await logAudit({
      user: req.user,
      module: 'farmacia',
      action: 'devolver_paquete_cronico',
      entityType: 'chronic_package',
      entityId: Number(req.params.id),
      description:
        transferId
          ? `Genero devolucion de paquete cronico #${req.params.id} por traslado #${transferId}`
          : `Marco devuelto paquete cronico #${req.params.id}`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json({
      success: true,
      message: 'Paquete devuelto a Secretaria',
      data: {
        transfer_id: transferId
      }
    });

  } catch (error: any) {

    console.error(error);

    return res.status(400).json({
      success: false,
      message:
        error.message ||
        'Error al devolver paquete'
    });
  }
}

export async function handleRelocateChronicPackage(
  req: AuthRequest,
  res: Response
) {

  try {

    if (!req.body.destination_facility_id) {
      return res.status(400).json({
        success: false,
        message: 'Debe seleccionar el nuevo punto'
      });
    }

    const chronicPackage =
      await getChronicPackageById(
        Number(req.params.id)
      );

    if (!chronicPackage) {
      return res.status(404).json({
        success: false,
        message: 'Paquete no encontrado'
      });
    }

    assertFacilityAccess(
      req.user,
      Number(chronicPackage.facility_id)
    );

    const transferId =
      await relocateChronicPackage(
        Number(req.params.id),
        Number(req.body.destination_facility_id),
        req.user?.userId ?? null
      );

    await logAudit({
      user: req.user,
      module: 'farmacia',
      action: 'trasladar_paquete_cronico',
      entityType: 'chronic_package',
      entityId: Number(req.params.id),
      description: `Traslado paquete cronico #${req.params.id} por remito #${transferId}`,
      newData: req.body,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json({
      success: true,
      message: 'Paquete trasladado a otro punto',
      data: {
        transfer_id: transferId
      }
    });

  } catch (error: any) {

    console.error(error);

    return res.status(400).json({
      success: false,
      message:
        error.message ||
        'Error al trasladar paquete'
    });
  }
}

export async function handleReceiveChronicPackageTransfer(
  req: AuthRequest,
  res: Response
) {

  try {

    const chronicPackage =
      await getChronicPackageById(
        Number(req.params.id)
      );

    if (!chronicPackage) {
      return res.status(404).json({
        success: false,
        message: 'Paquete no encontrado'
      });
    }

    if (!chronicPackage.medication_transfer_id) {
      return res.status(400).json({
        success: false,
        message: 'El paquete no tiene traslado asociado'
      });
    }

    if (
      chronicPackage.medication_transfer_status !==
      'enviado'
    ) {
      return res.status(400).json({
        success: false,
        message: 'El traslado no esta pendiente de recepcion'
      });
    }

    if (
      req.user?.facility_type === 'secretaria' &&
      req.user?.role !== 'admin'
    ) {
      return res.status(403).json({
        success: false,
        message:
          'La recepcion del paquete la debe confirmar el punto destino'
      });
    }

    assertFacilityAccess(
      req.user,
      Number(chronicPackage.facility_id)
    );

    await receiveMedicationTransfer(
      Number(chronicPackage.medication_transfer_id),
      req.user?.userId ?? null
    );

    await markChronicPackageTransferReceived(
      Number(req.params.id)
    );

    await logAudit({
      user: req.user,
      module: 'farmacia',
      action: 'recibir_traslado_paquete_cronico',
      entityType: 'chronic_package',
      entityId: Number(req.params.id),
      description:
        `Recibio traslado #${chronicPackage.medication_transfer_id} del paquete cronico #${req.params.id}`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json({
      success: true,
      message: 'Traslado del paquete recibido'
    });

  } catch (error: any) {

    console.error(error);

    return res.status(400).json({
      success: false,
      message:
        error.message ||
        'Error al recibir traslado del paquete'
    });
  }
}

export async function handleDeliverChronicPackage(
  req: AuthRequest,
  res: Response
) {

  try {

    if (
      !Array.isArray(req.body.items) ||
      req.body.items.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'Debe indicar los lotes retirados'
      });
    }

    const deliveryId =
      await (async () => {
        const chronicPackage =
          await getChronicPackageById(
            Number(req.params.id)
          );

        if (!chronicPackage) {
          throw new Error('Paquete no encontrado');
        }

        assertFacilityAccess(
          req.user,
          Number(chronicPackage.facility_id)
        );

        return deliverChronicPackage(
          Number(req.params.id),
          req.body.items.map((item: any) => ({
            package_item_id:
              Number(item.package_item_id),
            medication_batch_id:
              Number(item.medication_batch_id),
            delivered_quantity:
              Number(item.delivered_quantity)
          })),
          req.user?.userId ?? null
        );
      })();

    await logAudit({
      user: req.user,
      module: 'farmacia',
      action: 'retirar_paquete_cronico',
      entityType: 'chronic_package',
      entityId: Number(req.params.id),
      description: `Retiro paquete cronico #${req.params.id}`,
      newData: req.body,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json({
      success: true,
      message: 'Paquete retirado',
      data: {
        delivery_id: deliveryId
      }
    });

  } catch (error: any) {

    console.error(error);

    return res.status(400).json({
      success: false,
      message:
        error.message ||
        'Error al retirar paquete'
    });
  }
}
