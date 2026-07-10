const nodemailer = require("nodemailer");

const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = String(process.env.SMTP_SECURE || "false") === "true";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_SECURE,
  auth: {
    user: process.env.SYSTEM_MAIL_USER || process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },

  // ✅ Takılmaları azalt
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
});

async function sendMail({ to, subject, html, text, from, attachments = [] }) {
  try {
    const info = await transporter.sendMail({
      from:
        from ||
        process.env.SYSTEM_MAIL_FROM ||
        process.env.MAIL_FROM ||
        process.env.SMTP_USER,
      to,
      subject,
      html,
      text,
      attachments,
    });

    return info;
  } catch (err) {
    console.error("MAIL SEND ERROR:", {
      message: err?.message,
      code: err?.code,
      command: err?.command,
      response: err?.response,
    });
    throw err;
  }
}

async function verifyMailer() {
  try {
    await transporter.verify();
    console.log("✅ SMTP bağlantısı başarılı");
    return true;
  } catch (err) {
    console.error("❌ SMTP VERIFY ERROR:", {
      message: err?.message,
      code: err?.code,
      response: err?.response,
    });
    return false;
  }
}

module.exports = { sendMail, verifyMailer };