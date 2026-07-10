// routes/support.js
const express = require("express");

module.exports = function supportRoutes(pgPool) {
  const router = express.Router();

  // ✅ whatsapp-link
  router.post("/whatsapp-link", express.json(), (req, res) => {
    const { message, path, firm, user } = req.body || {};
    const WA_NUMBER = process.env.WHATSAPP_SUPPORT_NUMBER;

    const text = `
Merhaba, İSG Panel Destek

Kullanıcı: ${user || "-"}
Firma: ${firm || "-"}
Ekran: ${path || "-"}

Mesaj:
${message || "-"}
    `.trim();

    const url = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;
    res.json({ url });
  });

  // Ortak insert helper
  async function insertInbox({ fromName, fromEmail, subject, textBody, snippet, meta = {} }) {
    const toEmail = "teklif@isgpanel.tr";

    const q = `
      insert into inbox_messages
        (to_email, from_email, from_name, subject, snippet, text_body, html_body, meta)
      values
        ($1,$2,$3,$4,$5,$6,$7,$8)
      returning id
    `;

    const r = await pgPool.query(q, [
      toEmail,
      (fromEmail || "").toString(),
      (fromName || "").toString(),
      (subject || "").toString(),
      (snippet || "").toString(),
      (textBody || "").toString(),
      null,
      meta ? JSON.stringify(meta) : null,
    ]);

    return r.rows?.[0]?.id;
  }

  // 1) HelpWidget Satış Formu
  router.post("/sales-form", express.json(), async (req, res) => {
    try {
      const b = req.body || {};
      const companyName = (b.companyName || "").toString().trim(); // ✅ EKLE
      const fullName = (b.fullName || "").toString().trim();
      const email = (b.email || "").toString().trim();
      const userCount = (b.userCount || "").toString().trim();
      const note = (b.note || "").toString().trim();
      const path = (b.path || "").toString().trim();

      if (!fullName || !email) {
        return res.status(400).json({ ok: false, message: "fullName ve email zorunlu" });
      }

      // ✅ subject içinde kurum adı görünsün
      const subject = `Satış Talebi - ${companyName || fullName}${userCount ? ` (${userCount} kullanıcı)` : ""}`;

      // ✅ textBody içine de kurum adı yaz
      const textBody = [
        `Kurum Adı: ${companyName || "-"}`,
        `Ad Soyad: ${fullName}`,
        `E-posta: ${email}`,
        `Kullanıcı Sayısı: ${userCount || "-"}`,
        `Ekran: ${path || "-"}`,
        "",
        "Mesaj:",
        note || "-",
      ].join("\n");

      const id = await insertInbox({
        fromName: fullName,
        fromEmail: email,
        subject,
        snippet: (note || "").slice(0, 240),
        textBody,
        meta: { type: "sales_form", companyName, userCount, path },
      });

      return res.json({ ok: true, id });
    } catch (e) {
      console.error("POST /api/support/sales-form error:", e);
      return res.status(500).json({ ok: false, error: "INBOX_INSERT_FAILED" });
    }
  });

  // 2) Fiyatlandırma popup
  router.post("/teklif-al", express.json(), async (req, res) => {
    try {
      const b = req.body || {};

      const companyName = (b.companyName || "").toString().trim();
      const name = (b.name || "").toString().trim();
      const email = (b.email || "").toString().trim();
      const users = (b.users || "").toString().trim();
      const message = (b.message || "").toString().trim();

      if (!name || !email) {
        return res.status(400).json({ ok: false, message: "name ve email zorunlu" });
      }

      const src = (b.source || "web").toString().toLowerCase();

const subject = `${
  src === "panel" ? "Panel Teklif" : "Teklif Al"
} - ${companyName || name}${users ? ` (${users} kullanıcı)` : ""}`;

      const textBody = [
        `Kurum Adı: ${companyName || "-"}`,
        `Ad Soyad: ${name}`,
        `E-posta: ${email}`,
        `Kullanıcı Sayısı: ${users || "-"}`,
        "",
        "Mesaj:",
        message || "-",
      ].join("\n");

      const id = await insertInbox({
        fromName: name,
        fromEmail: email,
        subject,
        snippet: (message || "").slice(0, 240),
        textBody,
        meta: { type: "pricing_teklif_al", source: b.source || "web", companyName, users },

      });

      return res.json({ ok: true, id });
    } catch (e) {
      console.error("POST /api/support/teklif-al error:", e);
      return res.status(500).json({ ok: false, error: "INBOX_INSERT_FAILED" });
    }
  });

  return router;
};
