const crypto = require("crypto");
const nodemailer = require("nodemailer");
const MailIntegration = require("../models/MailIntegration");

function encryptionKey() {
  return crypto.createHash("sha256").update(process.env.MAIL_INTEGRATION_ENCRYPTION_KEY || process.env.JWT_SECRET || "isgpanel-mail-integration").digest();
}

function encrypt(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  return [iv.toString("base64"), cipher.getAuthTag().toString("base64"), encrypted.toString("base64")].join(".");
}

function decrypt(value) {
  const [iv, tag, encrypted] = String(value || "").split(".");
  if (!iv || !tag || !encrypted) throw new Error("E-posta entegrasyonu parolası okunamadı.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64")), decipher.final()]).toString("utf8");
}

function integrationForUser(user) {
  return MailIntegration.findOne({ userId: String(user?._id || user?.id || "") }).select("+encryptedPassword");
}

async function sendIntegratedMail({ user, to, subject, html, text }) {
  const integration = await integrationForUser(user);
  if (!integration) {
    const error = new Error("Belge paylaşımı için önce Kullanıcı/Yönetici menüsündeki Entegrasyonlar bölümünden e-posta hesabınızı bağlayınız.");
    error.code = "MAIL_INTEGRATION_REQUIRED";
    throw error;
  }
  const transporter = nodemailer.createTransport({
    host: integration.host,
    port: integration.port,
    secure: integration.secure,
    auth: { user: integration.email, pass: decrypt(integration.encryptedPassword) },
  });
  const fromName = String(integration.displayName || user?.name || integration.email).replace(/["<>]/g, "");
  return transporter.sendMail({ from: `"${fromName}" <${integration.email}>`, to, subject, html, text });
}

module.exports = { encrypt, sendIntegratedMail, integrationForUser };
