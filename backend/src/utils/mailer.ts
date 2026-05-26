import nodemailer from 'nodemailer';
import dns from 'node:dns';
import { promisify } from 'node:util';

dns.setDefaultResultOrder('ipv4first');

const resolve4 =
  promisify(dns.resolve4);

async function getTransporter() {
  const requiredVariables = [
    'MAIL_HOST',
    'MAIL_PORT',
    'MAIL_USER',
    'MAIL_PASS',
    'MAIL_FROM'
  ];

  const missingVariables =
    requiredVariables.filter((name) => !process.env[name]);

  if (missingVariables.length > 0) {
    throw new Error(
      `Faltan variables de correo: ${missingVariables.join(', ')}`
    );
  }

  const mailHost =
    process.env.MAIL_HOST as string;

  const [ipv4Host] =
    await resolve4(mailHost);

  return nodemailer.createTransport({
    host: ipv4Host || mailHost,
    port: Number(process.env.MAIL_PORT),
    secure: process.env.MAIL_SECURE === 'true',
    family: 4,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,

    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS
    },

    tls: {
      servername: mailHost
    }
  } as any);
}

async function sendWithResend(
  email: string,
  subject: string,
  html: string
) {
  const apiKey =
    process.env.RESEND_API_KEY;

  const from =
    process.env.RESEND_FROM ||
    process.env.MAIL_FROM;

  if (!apiKey || !from) {
    throw new Error(
      'Faltan variables de Resend: RESEND_API_KEY y RESEND_FROM'
    );
  }

  const response =
    await fetch(
      'https://api.resend.com/emails',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from,
          to: email,
          subject,
          html
        })
      }
    );

  if (!response.ok) {
    const errorText =
      await response.text();

    throw new Error(
      `No se pudo enviar el correo por Resend: ${errorText}`
    );
  }
}

export async function sendResetPasswordEmail(
  email: string,
  token: string
) {

  const frontendUrl =
    process.env.FRONTEND_URL ||
    'http://localhost:5173';

  const resetLink =
    `${frontendUrl.replace(/\/$/, '')}/reset-password?token=${token}`;

  const subject =
    'Recuperar contrasena';

  const html = `
    <h2>Recuperacion de contrasena</h2>

    <p>
      Hace click en el siguiente link:
    </p>

    <a href="${resetLink}">
      Recuperar contrasena
    </a>

    <p>
      Este enlace expira en 1 hora.
    </p>
  `;

  if (process.env.RESEND_API_KEY) {
    await sendWithResend(
      email,
      subject,
      html
    );

    return;
  }

  const transporter =
    await getTransporter();

  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: email,
    subject,
    html
  });
}
