import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT),
  secure: false,

  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

export async function sendResetPasswordEmail(
  email: string,
  token: string
) {

  const resetLink =
    `http://localhost:5173/reset-password?token=${token}`;

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