import 'dotenv/config';
import { createServer } from 'http';
import { spawn } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { randomBytes } from 'crypto';

const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID?.trim();
const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET?.trim();
const envPath = resolve(process.cwd(), '.env');

if (!clientId || !clientSecret) {
  console.error(
    '[drive] Faltan GOOGLE_DRIVE_CLIENT_ID o GOOGLE_DRIVE_CLIENT_SECRET en backend\\.env.',
  );
  process.exit(1);
}

const state = randomBytes(24).toString('hex');
const scope = 'https://www.googleapis.com/auth/drive';

function saveRefreshToken(refreshToken: string) {
  const current = readFileSync(envPath, 'utf8');
  const line = `GOOGLE_DRIVE_REFRESH_TOKEN=${refreshToken}`;
  const pattern = /^GOOGLE_DRIVE_REFRESH_TOKEN=.*$/m;
  const updated = pattern.test(current)
    ? current.replace(pattern, line)
    : `${current.trimEnd()}\n${line}\n`;

  writeFileSync(envPath, updated, { encoding: 'utf8', mode: 0o600 });
}

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');

  if (requestUrl.pathname !== '/oauth2callback') {
    response.writeHead(404).end('No encontrado');
    return;
  }

  if (requestUrl.searchParams.get('state') !== state) {
    response.writeHead(400).end('Solicitud invalida');
    console.error('[drive] Google devolvio un estado de autorizacion invalido.');
    server.close();
    return;
  }

  const error = requestUrl.searchParams.get('error');
  const code = requestUrl.searchParams.get('code');

  if (error || !code) {
    response
      .writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
      .end('<h2>La autorización fue cancelada.</h2><p>Ya podés cerrar esta ventana.</p>');
    console.error(`[drive] Autorizacion cancelada${error ? `: ${error}` : '.'}`);
    server.close();
    return;
  }

  try {
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('No se pudo determinar el puerto local.');
    }

    const redirectUri = `http://127.0.0.1:${address.port}/oauth2callback`;
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    const tokenData = (await tokenResponse.json()) as {
      refresh_token?: string;
      error?: string;
      error_description?: string;
    };

    if (!tokenResponse.ok || !tokenData.refresh_token) {
      throw new Error(
        tokenData.error_description ??
          tokenData.error ??
          'Google no entrego un refresh token. Revoca el acceso anterior y volve a intentar.',
      );
    }

    saveRefreshToken(tokenData.refresh_token);
    response
      .writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      .end(
        '<h2>Google Drive quedó autorizado correctamente.</h2><p>El token fue guardado en el archivo local. Ya podés cerrar esta ventana.</p>',
      );
    console.log('[drive] Autorizacion completada. El refresh token se guardo en backend\\.env.');
  } catch (authorizationError) {
    const message =
      authorizationError instanceof Error ? authorizationError.message : String(authorizationError);
    response
      .writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' })
      .end('<h2>No se pudo completar la autorización.</h2><p>Revisá la terminal.</p>');
    console.error(`[drive] ${message}`);
  } finally {
    server.close();
  }
});

server.listen(0, '127.0.0.1', () => {
  const address = server.address();
  if (!address || typeof address === 'string') {
    console.error('[drive] No se pudo iniciar la autorizacion local.');
    process.exit(1);
  }

  const redirectUri = `http://127.0.0.1:${address.port}/oauth2callback`;
  const authorizationUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authorizationUrl.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope,
    access_type: 'offline',
    prompt: 'consent',
    state,
  }).toString();

  console.log('[drive] Se abrira Google para autorizar la cuenta del hospital.');
  console.log('[drive] Si el navegador no se abre, copia esta URL:');
  console.log(authorizationUrl.toString());

  spawn(
    'rundll32.exe',
    ['url.dll,FileProtocolHandler', authorizationUrl.toString()],
    {
    detached: true,
    stdio: 'ignore',
    },
  ).unref();
});
