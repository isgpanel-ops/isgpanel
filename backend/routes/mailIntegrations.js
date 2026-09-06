const express = require("express");
const auth = require("../middleware/auth");
const MailIntegration = require("../models/MailIntegration");
const { encrypt, integrationForUser, sendIntegratedMail } = require("../utils/integratedMailer");
const crypto = require("crypto");

const router = express.Router();
const PROVIDERS = {
  gmail: { host: "smtp.gmail.com", port: 465, secure: true },
  zoho: { host: "smtp.zoho.com", port: 465, secure: true },
  microsoft: { host: "smtp.office365.com", port: 587, secure: false },
  outlook: { host: "smtp-mail.outlook.com", port: 587, secure: false },
};
const publicData = (item) => item && ({ provider: item.provider, email: item.email, displayName: item.displayName, host: item.host, port: item.port, secure: item.secure, verifiedAt: item.verifiedAt, updatedAt: item.updatedAt });
const oauthProviders = {
  gmail: { authUrl: "https://accounts.google.com/o/oauth2/v2/auth", tokenUrl: "https://oauth2.googleapis.com/token", profileUrl: "https://www.googleapis.com/oauth2/v3/userinfo", clientId: "GOOGLE_CLIENT_ID", clientSecret: "GOOGLE_CLIENT_SECRET", scope: "https://mail.google.com/ openid email profile", smtp: PROVIDERS.gmail },
  microsoft: { authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize", tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token", profileUrl: "https://graph.microsoft.com/v1.0/me", clientId: "MICROSOFT_CLIENT_ID", clientSecret: "MICROSOFT_CLIENT_SECRET", scope: "offline_access https://outlook.office.com/SMTP.Send User.Read", smtp: PROVIDERS.microsoft },
  zoho: { authUrl: "https://accounts.zoho.com/oauth/v2/auth", tokenUrl: "https://accounts.zoho.com/oauth/v2/token", profileUrl: "https://mail.zoho.com/api/accounts", clientId: "ZOHO_CLIENT_ID", clientSecret: "ZOHO_CLIENT_SECRET", scope: "ZohoMail.accounts.READ,ZohoMail.messages.CREATE", smtp: PROVIDERS.zoho },
};
function stateFor(userId, provider) { const payload = `${userId}.${provider}.${Date.now()}`; const sig = crypto.createHmac("sha256", process.env.JWT_SECRET || "isgpanel").update(payload).digest("hex"); return Buffer.from(`${payload}.${sig}`).toString("base64url"); }
function readState(state) { const raw = Buffer.from(String(state || ""), "base64url").toString("utf8"); const parts = raw.split("."); const sig = parts.pop(); const payload = parts.join("."); const valid = crypto.createHmac("sha256", process.env.JWT_SECRET || "isgpanel").update(payload).digest("hex") === sig; if (!valid || Date.now() - Number(parts[2]) > 10 * 60 * 1000) throw new Error("Bağlantı isteğinin süresi doldu."); return { userId: parts[0], provider: parts[1] }; }
function callbackUrl(req, provider) { return `${process.env.MAIL_OAUTH_CALLBACK_BASE || `${req.protocol}://${req.get("host")}`}/api/mail-integrations/oauth/${provider}/callback`; }

router.get("/me", auth, async (req, res) => res.json({ integration: publicData(await MailIntegration.findOne({ userId: String(req.user._id) }).lean()) || null }));

router.post("/oauth/:provider/start", auth, async (req, res) => {
  const provider = oauthProviders[req.params.provider];
  if (!provider) return res.status(400).json({ message: "Bu sağlayıcı desteklenmiyor." });
  const clientId = process.env[provider.clientId];
  if (!clientId || !process.env[provider.clientSecret]) return res.status(503).json({ message: "Bu sağlayıcı için OAuth yapılandırması henüz tamamlanmadı." });
  const params = new URLSearchParams({ client_id: clientId, redirect_uri: callbackUrl(req, req.params.provider), response_type: "code", scope: provider.scope, access_type: "offline", prompt: "consent", state: stateFor(String(req.user._id), req.params.provider) });
  res.json({ url: `${provider.authUrl}?${params}` });
});

router.get("/oauth/:provider/callback", async (req, res) => {
  try {
    const { userId, provider: providerName } = readState(req.query.state); const provider = oauthProviders[providerName];
    if (!provider || req.params.provider !== providerName || !req.query.code) throw new Error("E-posta hesabı doğrulanamadı.");
    const body = new URLSearchParams({ grant_type: "authorization_code", code: String(req.query.code), client_id: process.env[provider.clientId], client_secret: process.env[provider.clientSecret], redirect_uri: callbackUrl(req, providerName) });
    const tokenResponse = await fetch(provider.tokenUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body }); const tokens = await tokenResponse.json();
    if (!tokenResponse.ok || !tokens.refresh_token) throw new Error("Sağlayıcı kalıcı erişim izni vermedi.");
    const profile = await fetch(provider.profileUrl, { headers: { Authorization: `Bearer ${tokens.access_token}` } }).then((r) => r.json());
    const email = profile.email || profile.mail || profile.userPrincipalName || profile.data?.[0]?.emailAddress || "";
    if (!email) throw new Error("Bağlanan e-posta hesabı okunamadı.");
    await MailIntegration.findOneAndUpdate({ userId }, { $set: { provider: providerName, authType: "oauth", email, displayName: profile.name || profile.displayName || "", host: provider.smtp.host, port: provider.smtp.port, secure: provider.smtp.secure, encryptedPassword: encrypt("oauth"), encryptedRefreshToken: encrypt(tokens.refresh_token), verifiedAt: new Date() } }, { upsert: true, new: true, setDefaultsOnInsert: true });
    res.type("html").send("<script>window.close();</script><p>E-posta hesabı bağlandı. Bu pencereyi kapatıp İSG Panel'e dönebilirsiniz.</p>");
  } catch (error) { res.status(400).type("html").send(`<p>E-posta hesabı bağlanamadı: ${String(error.message).replace(/[<>&]/g, "")}</p>`); }
});

router.put("/me", auth, async (req, res) => {
  try {
    const provider = ["gmail", "zoho", "microsoft", "outlook", "custom"].includes(req.body.provider) ? req.body.provider : "custom";
    const preset = PROVIDERS[provider] || {};
    const email = String(req.body.email || "").trim().toLowerCase();
    const host = String(req.body.host || preset.host || "").trim();
    const port = Number(req.body.port || preset.port || 0);
    const secure = typeof req.body.secure === "boolean" ? req.body.secure : Boolean(preset.secure);
    const password = String(req.body.password || "");
    if (!/^\S+@\S+\.\S+$/.test(email) || !host || !port) return res.status(400).json({ message: "E-posta, SMTP sunucusu ve port bilgisi gereklidir." });
    const existing = await MailIntegration.findOne({ userId: String(req.user._id) }).select("+encryptedPassword");
    if (!password && !existing) return res.status(400).json({ message: "E-posta hesabınızın uygulama parolasını giriniz." });
    const integration = await MailIntegration.findOneAndUpdate(
      { userId: String(req.user._id) },
      { $set: { provider, authType: "smtp", email, displayName: String(req.body.displayName || "").trim(), host, port, secure, ...(password ? { encryptedPassword: encrypt(password) } : {}) } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.json({ integration: publicData(integration) });
  } catch (error) { res.status(500).json({ message: "E-posta entegrasyonu kaydedilemedi." }); }
});

router.post("/me/test", auth, async (req, res) => {
  try {
    const integration = await integrationForUser(req.user);
    if (!integration) return res.status(400).json({ message: "Önce e-posta entegrasyonunu kaydediniz." });
    await sendIntegratedMail({ user: req.user, to: integration.email, subject: "İSG Panel e-posta entegrasyon testi", text: "E-posta entegrasyonunuz başarıyla doğrulandı.", html: "<p>E-posta entegrasyonunuz başarıyla doğrulandı.</p>" });
    integration.verifiedAt = new Date(); await integration.save();
    res.json({ ok: true, integration: publicData(integration) });
  } catch (error) { res.status(400).json({ message: `Bağlantı doğrulanamadı: ${error.message}` }); }
});

router.delete("/me", auth, async (req, res) => { await MailIntegration.deleteOne({ userId: String(req.user._id) }); res.json({ ok: true }); });
module.exports = router;
