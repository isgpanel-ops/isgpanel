const express = require("express");
const auth = require("../middleware/auth");
const MailIntegration = require("../models/MailIntegration");
const { encrypt, integrationForUser, sendIntegratedMail } = require("../utils/integratedMailer");

const router = express.Router();
const PROVIDERS = {
  gmail: { host: "smtp.gmail.com", port: 465, secure: true },
  zoho: { host: "smtp.zoho.com", port: 465, secure: true },
  microsoft: { host: "smtp.office365.com", port: 587, secure: false },
  outlook: { host: "smtp-mail.outlook.com", port: 587, secure: false },
};
const publicData = (item) => item && ({ provider: item.provider, email: item.email, displayName: item.displayName, host: item.host, port: item.port, secure: item.secure, verifiedAt: item.verifiedAt, updatedAt: item.updatedAt });

router.get("/me", auth, async (req, res) => res.json({ integration: publicData(await MailIntegration.findOne({ userId: String(req.user._id) }).lean()) || null }));

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
      { $set: { provider, email, displayName: String(req.body.displayName || "").trim(), host, port, secure, ...(password ? { encryptedPassword: encrypt(password) } : {}) } },
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
