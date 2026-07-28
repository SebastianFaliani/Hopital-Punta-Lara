import { Response } from 'express';
import { AuthRequest } from '../auth/auth.middleware';
import { deleteLaboratoryPdf, getLaboratoryPdf, getLaboratoryPdfMetadata, uploadLaboratoryPdf } from './laboratory-pdf.service';
import { logAudit } from '../audit/audit.service';

export async function handleUploadLaboratoryPdf(req: AuthRequest, res: Response) {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Selecciona un archivo PDF' });
    if (req.file.mimetype !== 'application/pdf' || !req.file.buffer.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
      return res.status(400).json({ success: false, message: 'El archivo seleccionado no es un PDF valido' });
    }
    const data = await uploadLaboratoryPdf(
      Number(req.params.id), req.file, req.user?.userId || req.user?.id,
    );
    await logAudit({ user: req.user, module: 'laboratorio', action: 'subir_pdf_resultado',
      entityType: 'laboratory_record', entityId: Number(req.params.id),
      description: `Subio PDF de laboratorio: ${data.name}`, newData: data,
      ipAddress: req.ip, userAgent: req.headers['user-agent'] || null });
    return res.json({ success: true, message: 'PDF guardado en Google Drive', data });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message || 'No se pudo guardar el PDF' });
  }
}

export async function handleGetLaboratoryPdf(req: AuthRequest, res: Response) {
  try {
    const pdf = await getLaboratoryPdf(Number(req.params.id), Number(req.params.pdfId));
    const disposition = req.query.download === '1' ? 'attachment' : 'inline';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${disposition}; filename="${pdf.name.replace(/"/g, '')}"`);
    return res.send(pdf.buffer);
  } catch (error: any) {
    return res.status(404).json({ success: false, message: error.message || 'PDF no encontrado' });
  }
}

export async function handleGetLaboratoryPdfMetadata(req: AuthRequest, res: Response) {
  const data = await getLaboratoryPdfMetadata(Number(req.params.id));
  return res.json({ success: true, data });
}

export async function handleDeleteLaboratoryPdf(req: AuthRequest, res: Response) {
  try {
    const data = await deleteLaboratoryPdf(Number(req.params.id), Number(req.params.pdfId));
    await logAudit({ user: req.user, module: 'laboratorio', action: 'eliminar_pdf_resultado',
      entityType: 'laboratory_record', entityId: Number(req.params.id),
      description: `Elimino PDF de laboratorio: ${data.name}`, oldData: data,
      ipAddress: req.ip, userAgent: req.headers['user-agent'] || null });
    return res.json({ success: true, message: 'PDF eliminado', data });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message || 'No se pudo eliminar el PDF' });
  }
}
