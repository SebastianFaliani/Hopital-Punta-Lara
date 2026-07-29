import dotenv from 'dotenv';
import os from 'os';
import {
  getWhatsappWebStatus,
  sendWhatsappDocumentMessage,
  sendWhatsappTextMessage,
  startWhatsappWebSession,
  stopWhatsappWebSession
} from './modules/whatsapp/whatsapp-web.service';

dotenv.config();
const qrcode: any = require('qrcode');

const baseUrl = String(process.env.WHATSAPP_AGENT_API_URL || '').replace(/\/$/, '');
const key = String(process.env.WHATSAPP_AGENT_KEY || '');
const agentId = String(process.env.WHATSAPP_AGENT_ID || `${os.hostname()}-${process.pid}`).slice(0, 120);
const pollMs = Math.max(1000, Number(process.env.WHATSAPP_AGENT_POLL_MS || 5000));
let stopping = false;
let lastQr = '';
let starting: Promise<unknown> | null = null;
let heartbeatInFlight = false;

async function api(path: string, body: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-whatsapp-agent-key': key },
    body: JSON.stringify(body), signal: AbortSignal.timeout(30000)
  });
  const payload: any = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || `API HTTP ${response.status}`);
  return payload;
}

async function downloadAttachment(jobId: number, attachment: { id: number; name: string }) {
  const response = await fetch(
    `${baseUrl}/whatsapp/agent/jobs/${jobId}/attachments/${attachment.id}`,
    { headers: { 'x-whatsapp-agent-key': key }, signal: AbortSignal.timeout(60000) }
  );
  if (!response.ok) {
    const payload: any = await response.json().catch(() => ({}));
    throw new Error(payload.message || `No se pudo descargar ${attachment.name}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function ensureConnected() {
  let status = getWhatsappWebStatus();
  if (status.status === 'failed' && status.hasClient && !status.initializing) {
    await stopWhatsappWebSession();
    status = getWhatsappWebStatus();
  }
  if (!status.hasClient && !status.initializing) {
    if (!starting) {
      starting = startWhatsappWebSession()
        .catch((error: any) => console.error(`[agente] No se pudo iniciar WhatsApp: ${error.message}`))
        .finally(() => { starting = null; });
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
    status = getWhatsappWebStatus();
  }
  if (status.qr && status.qr !== lastQr) {
    lastQr = status.qr;
    console.log(await qrcode.toString(status.qr, { type: 'terminal', small: true }));
    console.log('[agente] Escanea el QR desde WhatsApp > Dispositivos vinculados.');
  }
  return status;
}

async function reportWithRetry(id: number, body: unknown) {
  let lastError: any;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      await api(`/whatsapp/agent/jobs/${id}/result`, body);
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }
  throw lastError;
}

async function reportHeartbeat() {
  if (heartbeatInFlight) return;
  heartbeatInFlight = true;

  try {
    const status = getWhatsappWebStatus();
    await api('/whatsapp/agent/heartbeat', {
      agent_id: agentId,
      status: {
        isReady: status.isReady,
        status: status.status,
        phone: status.phone,
        lastEvent: status.lastEvent
      }
    });
  } finally {
    heartbeatInFlight = false;
  }
}

async function cycle() {
  const status = await ensureConnected();
  await reportHeartbeat();
  if (!status.isReady) return;
  const payload = await api('/whatsapp/agent/jobs/claim', { agent_id: agentId, limit: 5 });
  for (const job of payload.data || []) {
    let sent = false;
    try {
      const attachments = typeof job.attachments_json === 'string'
        ? JSON.parse(job.attachments_json) : (job.attachments_json || []);
      for (const attachment of attachments) {
        const buffer = await downloadAttachment(job.id, attachment);
        await sendWhatsappDocumentMessage(job.phone, buffer, attachment.name);
      }
      await sendWhatsappTextMessage(job.phone, job.message);
      sent = true;
      await reportWithRetry(job.id, { agent_id: agentId, success: true });
      console.log(`[agente] Mensaje ${job.id} enviado.`);
    } catch (error: any) {
      console.error(`[agente] Mensaje ${job.id} fallo: ${error.message}`);
      if (!sent) try {
        await reportWithRetry(job.id, {
          agent_id: agentId, success: false, error: error.message
        });
      } catch (reportError: any) {
        console.error(`[agente] No se pudo informar el resultado: ${reportError.message}`);
      }
    }
  }
}

async function main() {
  const localDevelopmentUrl = /^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/i.test(baseUrl);
  if (!baseUrl || (!/^https:\/\//i.test(baseUrl) && !localDevelopmentUrl)) {
    throw new Error('WHATSAPP_AGENT_API_URL debe usar HTTPS, salvo localhost en desarrollo');
  }
  if (key.length < 32) throw new Error('WHATSAPP_AGENT_KEY debe tener al menos 32 caracteres');
  console.log(`[agente] Iniciado como ${agentId}. No abre puertos locales.`);

  const heartbeatTimer = setInterval(() => {
    void reportHeartbeat().catch((error: any) => {
      console.error(`[agente] No se pudo informar el estado: ${error.message}`);
    });
  }, 10000);

  while (!stopping) {
    try { await cycle(); } catch (error: any) { console.error(`[agente] ${error.message}`); }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  clearInterval(heartbeatTimer);
}

process.on('SIGINT', () => { stopping = true; });
process.on('SIGTERM', () => { stopping = true; });
void main().catch((error) => { console.error(`[agente] ${error.message}`); process.exitCode = 1; });
