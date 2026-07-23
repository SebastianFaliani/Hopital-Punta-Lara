import { Response } from 'express';
import { AuthRequest } from '../auth/auth.middleware';
import { logAudit } from '../audit/audit.service';
import {
  applyPatientImport,
  previewPatientImport
} from './patients-import.service';
import {
  cleanPatientInput,
  createPatient,
  getPatientDetail,
  getPatients,
  updatePatient
} from './patients.service';

function validatePatient(data: any) {
  if (!data.document_number) {
    return 'El DNI es obligatorio';
  }

  if (!data.last_name) {
    return 'El apellido es obligatorio';
  }

  if (!data.first_name) {
    return 'El nombre es obligatorio';
  }

  return null;
}

function getImportBase64(req: AuthRequest) {
  const value =
    String(req.body?.file_base64 || '');

  return value.includes(',')
    ? value.split(',').pop() || ''
    : value;
}

export async function handleGetPatients(
  req: AuthRequest,
  res: Response
) {
  try {
    return res.json({
      success: true,
      ...await getPatients(req.query)
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener pacientes'
    });
  }
}

export async function handleGetPatient(
  req: AuthRequest,
  res: Response
) {
  try {
    const data =
      await getPatientDetail(Number(req.params.id));

    return data
      ? res.json({
        success: true,
        data
      })
      : res.status(404).json({
        success: false,
        message: 'Paciente no encontrado'
      });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener el paciente'
    });
  }
}

export async function handleCreatePatient(
  req: AuthRequest,
  res: Response
) {
  try {
    const data =
      cleanPatientInput(req.body);

    const validation =
      validatePatient(data);

    if (validation) {
      return res.status(400).json({
        success: false,
        message: validation
      });
    }

    const id =
      await createPatient(data);

    await logAudit({
      user: req.user,
      module: 'pacientes',
      action: 'crear_paciente',
      entityType: 'patient',
      entityId: id,
      description: `Creo paciente ${data.last_name}, ${data.first_name}`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.status(201).json({
      success: true,
      data: { id }
    });
  } catch (error: any) {
    if (error?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'Ya existe un paciente con ese DNI'
      });
    }

    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Error al crear el paciente'
    });
  }
}

export async function handleUpdatePatient(
  req: AuthRequest,
  res: Response
) {
  try {
    const id =
      Number(req.params.id);

    const data =
      cleanPatientInput(req.body);

    const validation =
      validatePatient(data);

    if (validation) {
      return res.status(400).json({
        success: false,
        message: validation
      });
    }

    await updatePatient(id, data);

    await logAudit({
      user: req.user,
      module: 'pacientes',
      action: 'editar_paciente',
      entityType: 'patient',
      entityId: id,
      description: `Edito paciente ${data.last_name}, ${data.first_name}`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json({
      success: true
    });
  } catch (error: any) {
    if (error?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'Ya existe un paciente con ese DNI'
      });
    }

    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Error al modificar el paciente'
    });
  }
}

export async function handlePreviewPatientImport(
  req: AuthRequest,
  res: Response
) {
  try {
    const fileBase64 =
      getImportBase64(req);

    if (!fileBase64) {
      return res.status(400).json({
        success: false,
        message: 'Debe seleccionar un archivo XLS'
      });
    }

    const data =
      await previewPatientImport(fileBase64);

    return res.json({
      success: true,
      data
    });
  } catch (error: any) {
    console.error(error);
    return res.status(400).json({
      success: false,
      message:
        error.message || 'No se pudo analizar el archivo'
    });
  }
}

export async function handleApplyPatientImport(
  req: AuthRequest,
  res: Response
) {
  try {
    const fileBase64 =
      getImportBase64(req);

    if (!fileBase64) {
      return res.status(400).json({
        success: false,
        message: 'Debe seleccionar un archivo XLS'
      });
    }

    const data =
      await applyPatientImport(fileBase64);

    await logAudit({
      user: req.user,
      module: 'pacientes',
      action: 'importar_pacientes',
      entityType: 'patient',
      entityId: null,
      description:
        `Importo pacientes: ${data.summary.created} nuevos, ${data.summary.updated} actualizados`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json({
      success: true,
      data,
      message: 'Importacion finalizada correctamente'
    });
  } catch (error: any) {
    console.error(error);
    return res.status(400).json({
      success: false,
      message:
        error.message || 'No se pudo importar el archivo'
    });
  }
}
