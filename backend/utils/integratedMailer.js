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
  return MailIntegration.findOne({ userId: String(user?._id || user?.id || "") }).select("+encryptedPassword +encryptedRefreshToken");
}

function mimeHeader(value) {
  return `=?UTF-8?B?${Buffer.from(String(value || ""), "utf8").toString("base64")}?=`;
}

function createGmailRawMessage({ from, to, subject, text, html }) {
  const boundary = `isgpanel-${crypto.randomBytes(12).toString("hex")}`;
  const plain = Buffer.from(String(text || ""), "utf8").toString("base64");
  const rich = Buffer.from(String(html || text || ""), "utf8").toString("base64");
  return [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${mimeHeader(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary=\"${boundary}\"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    plain,
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    rich,
    `--${boundary}--`,
  ].join("\r\n");
}

async function sendGmailApiMail({ integration, oauthConfig, to, subject, html, text, from }) {
  const refreshToken = decrypt(integration.encryptedRefreshToken);
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: oauthConfig.clientId, client_secret: oauthConfig.clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
  });
  const tokens = await tokenResponse.json();
  if (!tokenResponse.ok || !tokens.access_token) throw new Error("Google e-posta erişim izni yenilenemedi.");

  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${tokens.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: Buffer.from(createGmailRawMessage({ from, to, subject, text, html })).toString("base64url") }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error?.message || "Google üzerinden e-posta gönderilemedi.");
  }
}

async function sendIntegratedMail({ user, to, subject, html, text }) {
  const integration = await integrationForUser(user);
  if (!integration) {
    const error = new Error("Belge paylaşımı için önce Kullanıcı/Yönetici menüsündeki Entegrasyonlar bölümünden e-posta hesabınızı bağlayınız.");
    error.code = "MAIL_INTEGRATION_REQUIRED";
    throw error;
  }
  const oauthConfig = {
    gmail: { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET },
    microsoft: { clientId: process.env.MICROSOFT_CLIENT_ID, clientSecret: process.env.MICROSOFT_CLIENT_SECRET },
    zoho: { clientId: process.env.ZOHO_CLIENT_ID, clientSecret: process.env.ZOHO_CLIENT_SECRET },
  }[integration.provider];
  const fromName = String(integration.displayName || user?.name || integration.email).replace(/["<>]/g, "");
  const from = `"${fromName}" <${integration.email}>`;
  if (integration.authType === "oauth" && integration.provider === "gmail") {
    return sendGmailApiMail({ integration, oauthConfig, to, subject, html, text, from });
  }
  const transporter = nodemailer.createTransport({
    host: integration.host,
    port: integration.port,
    secure: integration.secure,
    auth: integration.authType === "oauth"
      ? { type: "OAuth2", user: integration.email, clientId: oauthConfig?.clientId, clientSecret: oauthConfig?.clientSecret, refreshToken: decrypt(integration.encryptedRefreshToken) }
      : { user: integration.email, pass: decrypt(integration.encryptedPassword) },
  });
  return transporter.sendMail({ from, to, subject, html, text });
}

module.exports = { encrypt, sendIntegratedMail, integrationForUser };
