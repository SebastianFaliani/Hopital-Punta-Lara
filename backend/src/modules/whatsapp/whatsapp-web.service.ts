import path from 'path';
import fs from 'fs/promises';

import {
  buildWhatsappResponse
} from './whatsapp.service';

type WhatsappWebStatus =
  | 'not_configured'
  | 'disconnected'
  | 'initializing'
  | 'qr'
  | 'authenticated'
  | 'connected'
  | 'failed';

type WhatsappWebState = {
  status: WhatsappWebStatus;
  qr: string | null;
  qrDataUrl: string | null;
  phone: string | null;
  lastEvent: string | null;
  lastEventAt: string | null;
  isReady: boolean;
};

let client: any = null;
let initializing = false;
const processedMessageIds =
  new Set<string>();

const state: WhatsappWebState = {
  status: 'disconnected',
  qr: null,
  qrDataUrl: null,
  phone: null,
  lastEvent: null,
  lastEventAt: null,
  isReady: false
};

function setEvent(
  status: WhatsappWebStatus,
  event: string
) {
  state.status = status;
  state.lastEvent = event;
  state.lastEventAt =
    new Date().toISOString();
}

async function loadWhatsappModules() {
  try {
    const whatsappWeb =
      require('whatsapp-web.js');

    const qrcode =
      require('qrcode');

    return {
      Client: whatsappWeb.Client,
      LocalAuth: whatsappWeb.LocalAuth,
      qrcode
    };
  } catch (error: any) {
    setEvent(
      'not_configured',
      'Faltan instalar dependencias de WhatsApp Web'
    );

    throw new Error(
      'Faltan dependencias. Ejecuta: npm --prefix backend install'
    );
  }
}

function getSessionPath() {
  const cwd =
    process.cwd();

  const backendRoot =
    path.basename(cwd).toLowerCase() === 'backend'
      ? cwd
      : path.resolve(cwd, 'backend');

  return (
    process.env.WHATSAPP_SESSION_PATH ||
    path.resolve(
      backendRoot,
      'storage',
      'whatsapp-session'
    )
  );
}

function getPuppeteerOptions() {
  return {
    headless:
      process.env.WHATSAPP_HEADLESS !== 'false',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  };
}

async function destroyClient() {
  if (!client) {
    return;
  }

  try {
    await client.destroy();
  } catch (error) {
    // La sesion puede estar medio abierta; se ignora para permitir reconectar.
  }

  client = null;
  initializing = false;
  state.isReady = false;
}

export function getWhatsappWebStatus() {
  return {
    ...state,
    hasClient: Boolean(client),
    initializing
  };
}

async function refreshWhatsappReadyState() {
  if (!client) {
    state.isReady = false;
    return false;
  }

  try {
    const clientState =
      await client.getState();

    if (clientState === 'CONNECTED') {
      initializing = false;
      state.isReady = true;
      state.qr = null;
      state.qrDataUrl = null;
      state.phone =
        client?.info?.wid?.user || state.phone || null;
      setEvent(
        'connected',
        'WhatsApp conectado'
      );

      return true;
    }
  } catch (error) {
    // Si el cliente todavia no responde, se mantiene el estado actual.
  }

  return state.isReady;
}

async function waitUntilWhatsappReady(
  timeoutMs = 12000
) {
  const startedAt =
    Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await refreshWhatsappReadyState()) {
      return true;
    }

    await wait(750);
  }

  return false;
}

export async function getWhatsappWebStatusFresh() {
  await refreshWhatsappReadyState();

  return getWhatsappWebStatus();
}

function getWhatsappMessageId(
  message: any
) {
  return (
    message?.id?._serialized ||
    message?._data?.id?._serialized ||
    `${message?.from || 'unknown'}-${message?.timestamp || Date.now()}-${message?.body || message?._data?.body || ''}`
  );
}

function getWhatsappMessageText(
  message: any
) {
  return String(
    message?.body ||
    message?._data?.body ||
    message?._data?.caption ||
    ''
  ).trim();
}

function shouldIgnoreWhatsappMessage(
  message: any
) {
  const from =
    String(message?.from || '');

  return (
    Boolean(message?.fromMe) ||
    from === 'status@broadcast' ||
    from.endsWith('@g.us')
  );
}

async function replyToWhatsappMessage(
  message: any,
  response: string
) {
  try {
    await message.reply(response);
  } catch (error) {
    if (!client || !message?.from) {
      throw error;
    }

    await client.sendMessage(
      message.from,
      response
    );
  }
}

async function handleIncomingWhatsappMessage(
  message: any
) {
  if (shouldIgnoreWhatsappMessage(message)) {
    return;
  }

  const messageId =
    getWhatsappMessageId(message);

  if (processedMessageIds.has(messageId)) {
    return;
  }

  processedMessageIds.add(messageId);

  if (processedMessageIds.size > 500) {
    const firstMessageId =
      processedMessageIds.values().next().value;

    if (firstMessageId) {
      processedMessageIds.delete(firstMessageId);
    }
  }

  if (message?.hasMedia) {
    await message.reply(
      'Por este canal solo procesamos mensajes de texto. No se guardan audios, imagenes, videos ni archivos.'
    );

    return;
  }

  const text =
    getWhatsappMessageText(message);

  if (!text) {
    return;
  }

  setEvent(
    state.isReady ? 'connected' : 'authenticated',
    `Mensaje recibido de ${message.from}: ${text.slice(0, 60)}`
  );

  console.info(
    `[whatsapp] Mensaje recibido de ${message.from}: ${text}`
  );

  const result =
    await buildWhatsappResponse(
      text,
      message.from
    );

  await replyToWhatsappMessage(
    message,
    result.response
  );

  setEvent(
    'connected',
    `Ultimo mensaje respondido: ${message.from}`
  );
}

function wait(
  milliseconds: number
) {
  return new Promise((resolve) =>
    setTimeout(resolve, milliseconds)
  );
}

async function removeSessionFolderWithRetry() {
  const sessionPath =
    getSessionPath();

  let lastError: any = null;

  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      await fs.rm(
        sessionPath,
        {
          recursive: true,
          force: true,
          maxRetries: 2,
          retryDelay: 500
        }
      );

      return true;
    } catch (error: any) {
      lastError = error;

      if (
        error?.code !== 'EBUSY' &&
        error?.code !== 'EPERM'
      ) {
        throw error;
      }

      await wait(750 * attempt);
    }
  }

  throw lastError;
}

export async function sendWhatsappTextMessage(
  phone: string,
  message: string
) {
  if (!client) {
    throw new Error(
      'WhatsApp Web no esta iniciado. Ingresa al menu WhatsApp, presiona Iniciar y verifica que el telefono este vinculado.'
    );
  }

  if (!state.isReady) {
    await waitUntilWhatsappReady();
  }

  if (!state.isReady) {
    throw new Error(
      'WhatsApp Web esta autenticado pero todavia no esta listo para enviar. Espera unos segundos o reinicia la conexion desde el menu WhatsApp.'
    );
  }

  await client.sendMessage(
    phone,
    message
  );

  return true;
}

export async function getWhatsappProfilePictureUrl(
  phone: string
) {
  if (!client || !state.isReady) {
    return null;
  }

  try {
    return await client.getProfilePicUrl(
      phone
    );
  } catch (error) {
    return null;
  }
}

export async function startWhatsappWebSession() {
  if (client || initializing) {
    return getWhatsappWebStatus();
  }

  const {
    Client,
    LocalAuth,
    qrcode
  } = await loadWhatsappModules();

  initializing = true;
  state.qr = null;
  state.qrDataUrl = null;
  state.phone = null;
  state.isReady = false;
  setEvent(
    'initializing',
    'Iniciando WhatsApp Web'
  );

  client =
    new Client({
      authStrategy:
        new LocalAuth({
          dataPath: getSessionPath()
        }),
      puppeteer: getPuppeteerOptions()
    });

  client.on(
    'qr',
    async (qr: string) => {
      state.qr = qr;
      state.qrDataUrl =
        await qrcode.toDataURL(qr);
      state.isReady = false;
      setEvent(
        'qr',
        'Escanea el codigo QR con WhatsApp'
      );
    }
  );

  client.on(
    'authenticated',
    () => {
      state.qr = null;
      state.qrDataUrl = null;
      setEvent(
        'authenticated',
        'Telefono autenticado'
      );
    }
  );

  client.on(
    'ready',
    () => {
      initializing = false;
      state.isReady = true;
      state.qr = null;
      state.qrDataUrl = null;
      state.phone =
        client?.info?.wid?.user || null;
      setEvent(
        'connected',
        'WhatsApp conectado'
      );
    }
  );

  client.on(
    'disconnected',
    async (reason: string) => {
      await destroyClient();
      state.qr = null;
      state.qrDataUrl = null;
      setEvent(
        'disconnected',
        `WhatsApp desconectado: ${reason || 'sin detalle'}`
      );
    }
  );

  client.on(
    'auth_failure',
    async (message: string) => {
      await destroyClient();
      state.qr = null;
      state.qrDataUrl = null;
      setEvent(
        'failed',
        `Fallo la autenticacion: ${message || 'sin detalle'}`
      );
    }
  );

  client.on(
    'message',
    async (message: any) => {
      try {
        await handleIncomingWhatsappMessage(
          message
        );
      } catch (error: any) {
        setEvent(
          'failed',
          error.message || 'Error respondiendo mensaje'
        );
      }
    }
  );

  client.on(
    'message_create',
    async (message: any) => {
      try {
        await handleIncomingWhatsappMessage(
          message
        );
      } catch (error: any) {
        setEvent(
          state.isReady ? 'connected' : 'failed',
          error.message || 'Error respondiendo mensaje'
        );
      }
    }
  );

  await client.initialize();

  return getWhatsappWebStatus();
}

export async function stopWhatsappWebSession() {
  await destroyClient();
  state.qr = null;
  state.qrDataUrl = null;
  state.phone = null;
  setEvent(
    'disconnected',
    'Sesion cerrada'
  );

  return getWhatsappWebStatus();
}

export async function logoutWhatsappWebSession() {
  await destroyClient();

  await wait(1200);

  try {
    await removeSessionFolderWithRetry();
    setEvent(
      'disconnected',
      'Sesion cerrada. Volve a iniciar para generar un nuevo QR.'
    );
  } catch (error: any) {
    setEvent(
      'failed',
      'No se pudo borrar la sesion porque Windows todavia tiene archivos bloqueados. Cierra procesos de Chrome/Chromium y vuelve a intentar.'
    );
  }

  state.qr = null;
  state.qrDataUrl = null;
  state.phone = null;

  return getWhatsappWebStatus();
}
