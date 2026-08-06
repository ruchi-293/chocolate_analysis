const nodemailer = require('nodemailer');

/**
 * Sends transactional email (verification / password reset).
 * Configure SMTP_* vars in .env — works with Mailtrap for dev,
 * or SendGrid/SES/Gmail app-password in production.
 */
async function sendEmail({ to, subject, html }) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
  });
}

module.exports = sendEmail;
