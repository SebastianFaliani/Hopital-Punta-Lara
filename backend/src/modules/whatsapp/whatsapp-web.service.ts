import path from 'path';
import fs from 'fs/promises';

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
let whatsappAuthenticated = false;
let syncFallbackTimer: ReturnType<typeof setTimeout> | null = null;
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

function getBackendRoot() {
  const cwd = process.cwd();

  return path.basename(cwd).toLowerCase() === 'backend'
    ? cwd
    : path.resolve(cwd, 'backend');
}

function getWhatsappWebCachePath() {
  return path.resolve(
    getBackendRoot(),
    '.wwebjs_cache'
  );
}
function getSessionPath() {
  return (
    process.env.WHATSAPP_SESSION_PATH ||
    path.resolve(
      getBackendRoot(),
      'storage',
      'whatsapp-session'
    )
  );
}

function getPuppeteerOptions() {
  const executablePath =
    process.env.WHATSAPP_CHROME_PATH ||
    process.env.PUPPETEER_EXECUTABLE_PATH;

  return {
    headless:
      process.env.WHATSAPP_HEADLESS !== 'false',
    ...(executablePath
      ? { executablePath }
      : {}),
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  };
}

async function destroyClient() {
  if (syncFallbackTimer) {
    clearTimeout(syncFallbackTimer);
    syncFallbackTimer = null;
  }

  whatsappAuthenticated = false;

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

function isIncomingBotEnabled() {
  return process.env.WHATSAPP_ENABLE_INCOMING_BOT === 'true';
}

function getArgentinaWhatsappNumber(
  phone: string
) {
  let digits =
    String(phone || '')
      .replace(/\D/g, '')
      .replace(/^0+/, '');

  if (!digits) {
    throw new Error('Telefono de WhatsApp invalido');
  }

  if (digits.startsWith('54')) {
    digits = digits.slice(2);
  }

  if (digits.startsWith('9') && digits.length === 11) {
    digits = digits.slice(1);
  }

  digits = digits.replace(/^(\d{2,4})15/, '$1');

  if (digits.length !== 10) {
    throw new Error(
      'El telefono debe incluir codigo de area y numero, por ejemplo 2211234567'
    );
  }

  return `549${digits}`;
}

function formatWhatsappRecipient(
  phone: string
) {
  const raw = String(phone || '').trim();

  if (
    raw.endsWith('@c.us') ||
    raw.endsWith('@s.whatsapp.net')
  ) {
    return raw;
  }

  return `${getArgentinaWhatsappNumber(phone)}@c.us`;
}

function withTimeout<T>(
  operation: Promise<T>,
  milliseconds: number,
  message: string
) {
  let timeout: ReturnType<typeof setTimeout>;

  return Promise.race([
    operation,
    new Promise<T>((_, reject) => {
      timeout = setTimeout(
        () => reject(new Error(message)),
        milliseconds
      );
    })
  ]).finally(() => clearTimeout(timeout));
}

async function resolveWhatsappRecipient(
  phone: string
) {
  const raw = String(phone || '').trim();

  if (
    raw.endsWith('@c.us') ||
    raw.endsWith('@s.whatsapp.net')
  ) {
    return raw;
  }

  const candidate = getArgentinaWhatsappNumber(phone);

  try {
    const numberId: any = await withTimeout(
      client.getNumberId(candidate),
      8000,
      'WhatsApp no respondio al verificar el numero'
    );

    if (numberId?._serialized) {
      return numberId._serialized;
    }
  } catch (error) {
    // Se intenta el envio directo al formato movil argentino.
  }

  return `${candidate}@c.us`;
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
  if (!isIncomingBotEnabled()) {
    return;
  }

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

  const {
    buildWhatsappResponse
  } =
    await import('./whatsapp.service');

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
    throw new Error('WhatsApp no esta conectado');
  }

  if (!state.isReady) {
    try {
      const clientState =
        await client.getState();

      if (clientState === 'CONNECTED') {
        state.isReady = true;
        setEvent(
          'connected',
          'WhatsApp conectado'
        );
      }
    } catch (error) {
      // Si no se puede consultar el estado, se informa abajo.
    }
  }

  if (!state.isReady) {
    throw new Error(
      'WhatsApp esta autenticado pero todavia no esta listo. Espera unos segundos y volve a intentar.'
    );
  }

  const recipient =
    await resolveWhatsappRecipient(phone);

  setEvent(
    'connected',
    `Enviando mensaje a ${recipient.replace(/@.+$/, '')}`
  );

  await withTimeout(
    client.sendMessage(
      recipient,
      message
    ),
    30000,
    'WhatsApp no confirmo el envio en 30 segundos. Verifica la conexion y volve a intentar.'
  );

  setEvent(
    'connected',
    `Mensaje enviado a ${recipient.replace(/@.+$/, '')}`
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

async function triggerWhatsappSyncFallback() {
  if (!client || state.isReady) {
    return;
  }

  try {
    const result = await client.pupPage?.evaluate(() => {
      const appState = (window as any).AuthStore?.AppState;
      const connectionState = appState?.state || null;
      const canTrigger =
        connectionState === 'CONNECTED' &&
        typeof (window as any).onAppStateHasSyncedEvent === 'function';

      if (canTrigger) {
        (window as any).onAppStateHasSyncedEvent();
      }

      return {
        connectionState,
        hasSynced: Boolean(appState?.hasSynced),
        triggered: canTrigger
      };
    });

    if (!state.isReady) {
      setEvent(
        whatsappAuthenticated ? 'authenticated' : 'initializing',
        result?.triggered
          ? 'Conexion detectada. Completando sincronizacion de WhatsApp...'
          : `WhatsApp cargado, esperando sincronizacion${result?.connectionState ? ` (${result.connectionState})` : ''}`
      );
    }
  } catch (error: any) {
    console.error('[whatsapp] Error recuperando sincronizacion:', error);
    if (!state.isReady) {
      setEvent(
        'failed',
        `No se pudo completar la sincronizacion: ${error?.message || String(error)}`
      );
    }
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
  whatsappAuthenticated = false;
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
      deviceName: 'Hospital Punta Lara',
      browserName: 'Chrome',
      webVersion: '2.3000.1043545460',
      webVersionCache: {
        type: 'local',
        path: getWhatsappWebCachePath(),
        strict: true
      },
      takeoverOnConflict: true,
      takeoverTimeoutMs: 10000,
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
    'loading_screen',
    (percent: string, message: string) => {
      const numericPercent = Number(percent || 0);

      if (numericPercent >= 95) {
        state.qr = null;
        state.qrDataUrl = null;
      }

      setEvent(
        whatsappAuthenticated ? 'authenticated' : 'initializing',
        `Cargando WhatsApp: ${percent}% ${message || ''}`.trim()
      );

      if (numericPercent >= 99 && !syncFallbackTimer) {
        syncFallbackTimer = setTimeout(() => {
          syncFallbackTimer = null;
          void triggerWhatsappSyncFallback();
        }, 2500);
      }
    }
  );

  client.on(
    'change_state',
    (connectionState: string) => {
      if (!state.isReady) {
        setEvent(
          'authenticated',
          `Estado de WhatsApp: ${connectionState}`
        );
      }
    }
  );

  client.on(
    'authenticated',
    () => {
      whatsappAuthenticated = true;
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
      if (syncFallbackTimer) {
        clearTimeout(syncFallbackTimer);
        syncFallbackTimer = null;
      }
      initializing = false;
      whatsappAuthenticated = true;
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

  try {
    await client.initialize();

    client?.pupPage?.on(
      'pageerror',
      (error: Error) => {
        console.error('[whatsapp] Error en Chrome:', error);
        setEvent(
          'failed',
          `Error cargando WhatsApp Web: ${error.message}`
        );
      }
    );

    client?.pupBrowser?.on(
      'disconnected',
      () => {
        if (client && !state.isReady) {
          setEvent(
            'failed',
            'Chrome se cerro antes de completar la conexion'
          );
        }
      }
    );
  } catch (error: any) {
    console.error('[whatsapp] Error inicializando:', error);
    await destroyClient();
    setEvent(
      'failed',
      `No se pudo iniciar WhatsApp Web: ${error?.message || String(error)}`
    );
    throw error;
  }

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
