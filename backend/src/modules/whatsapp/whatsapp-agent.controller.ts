import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import {
  claimWhatsappOutboxJobs,
  completeWhatsappOutboxJob,
  updateWhatsappAgentStatus
} from './whatsapp-delivery.service';

export function authenticateWhatsappAgent(req: Request, res: Response, next: NextFunction) {
  const configured = process.env.WHATSAPP_AGENT_KEY || '';
  const supplied = String(req.header('x-whatsapp-agent-key') || '');
  const configuredBuffer = Buffer.from(configured);
  const suppliedBuffer = Buffer.from(supplied);
  const valid = configured.length >= 32 && suppliedBuffer.length === configuredBuffer.length &&
    crypto.timingSafeEqual(suppliedBuffer, configuredBuffer);
  if (!valid) {
    return res.status(401).json({ success: false, message: 'Agente no autorizado' });
  }
  next();
}

export async function heartbeatWhatsappAgent(req: Request, res: Response) {
  try {
    const agentId = String(req.body.agent_id || '').trim().slice(0, 120);
    if (!agentId) return res.status(400).json({ success: false, message: 'agent_id es obligatorio' });
    await updateWhatsappAgentStatus(agentId, req.body.status || {});
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function claimAgentJobs(req: Request, res: Response) {
  try {
    const agentId = String(req.body.agent_id || '').trim().slice(0, 120);
    if (!agentId) return res.status(400).json({ success: false, message: 'agent_id es obligatorio' });
    const jobs = await claimWhatsappOutboxJobs(agentId, Number(req.body.limit || 5));
    return res.json({ success: true, data: jobs });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function reportAgentJob(req: Request, res: Response) {
  try {
    const agentId = String(req.body.agent_id || '').trim().slice(0, 120);
    const updated = await completeWhatsappOutboxJob(
      Number(req.params.id), agentId, req.body.success === true, req.body.error
    );
    if (!updated) return res.status(409).json({ success: false, message: 'Trabajo vencido o asignado a otro agente' });
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
