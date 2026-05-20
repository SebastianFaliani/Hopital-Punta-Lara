import path from 'path';

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
        if (message.fromMe || !message.body) {
          return;
        }

        const result =
          await buildWhatsappResponse(
            message.body,
            message.from
          );

        await message.reply(
          result.response
        );
      } catch (error: any) {
        setEvent(
          'failed',
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
  if (client) {
    try {
      await client.logout();
    } catch (error) {
      // Si ya estaba desconectado, se destruye igual.
    }
  }

  return stopWhatsappWebSession();
}
