// Mailer for Notification Engine — T02
// Test mode routes every message only to TEST_EMAIL (FR-14, BR-07).

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendMail({ to, cc, bcc, subject, html, attachments = [] }) {
  const testMode = String(process.env.TEST_MODE).toLowerCase() === 'true';

  if (testMode && !process.env.TEST_EMAIL) {
    throw new Error('TEST_EMAIL must be set when TEST_MODE=true');
  }

  const mailOptions = {
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: testMode ? process.env.TEST_EMAIL : to,
    subject,
    html,
    attachments,
  };

  if (testMode) {
    // Test mode overrides all recipient fields.
    mailOptions.cc = undefined;
    mailOptions.bcc = undefined;
  } else {
    if (cc) mailOptions.cc = cc;
    if (bcc) mailOptions.bcc = bcc;
  }

  const info = await transporter.sendMail(mailOptions);

  return {
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
    previewUrl: nodemailer.getTestMessageUrl(info),
  };
}

module.exports = { sendMail };