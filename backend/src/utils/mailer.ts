import nodemailer from 'nodemailer';

function getTransporter() {
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

  return nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT),
    secure: process.env.MAIL_SECURE === 'true',
    family: 4,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,

    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS
    }
  } as any);
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

  const transporter =
    getTransporter();

  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: email,
    subject: 'Recuperar contraseña',

    html: `
      <h2>Recuperación de contraseña</h2>

      <p>
        Hacé click en el siguiente link:
      </p>

      <a href="${resetLink}">
        Recuperar contraseña
      </a>

      <p>
        Este enlace expira en 1 hora.
      </p>
    `
  });
}
