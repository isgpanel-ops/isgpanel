// backend/routes/teklifPublic.js
const express = require("express");

module.exports = function teklifPublicRoutes(pgPool) {
  const router = express.Router();

  // Postmark inbound webhook payload büyük olabilir
  router.post("/inbound-email", express.json({ limit: "10mb" }), async (req, res) => {
    try {
      const payload = req.body || {};

      const toEmail = String(payload.ToFull?.[0]?.Email || payload.To || "").toLowerCase();
      const fromEmail = String(payload.FromFull?.Email || payload.From || "").toLowerCase();

      const fromName = payload.FromFull?.Name || null;
      const subject = payload.Subject || "";
      const textBody = payload.TextBody || "";
      const htmlBody = payload.HtmlBody || "";
      const snippet = String(textBody || subject || "").slice(0, 180);

      const attachments = Array.isArray(payload.Attachments)
        ? payload.Attachments.map((a) => ({
            name: a.Name,
            contentType: a.ContentType,
            contentLength: a.ContentLength,
          }))
        : [];

      const providerMessageId = payload.MessageID || null;

      const q = `
        insert into inbox_messages
        (to_email, from_email, from_name, subject, snippet, text_body, html_body, attachments, provider, provider_message_id)
        values ($1,$2,$3,$4,$5,$6,$7,$8,'postmark',$9)
        returning id
      `;

      const r = await pgPool.query(q, [
        toEmail,
        fromEmail,
        fromName,
        subject,
        snippet,
        textBody,
        htmlBody,
        JSON.stringify(attachments),
        providerMessageId,
      ]);

      return res.json({ ok: true, inboxMessageId: r.rows[0].id });
    } catch (err) {
      console.error("inbound-email error:", err);
      return res.status(500).json({ ok: false, error: "INBOUND_EMAIL_FAILED" });
    }
  });

  // =========================================================
  // ✅ PUBLIC TEKLİF OKUMA (token ile)
  // GET /api/public/offer/:token
  // =========================================================
  router.get("/offer/:token", async (req, res) => {
    try {
      const token = String(req.params.token || "").trim();
      console.log("TOKEN GELDİ:", token);

      if (!token) return res.status(400).json({ ok: false, error: "TOKEN_REQUIRED" });

      const r = await pgPool.query("select * from offers where token = $1 limit 1", [token]);

      console.log("DB RESULT:", r.rows);

      if (!r.rows.length) {
        return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      }

      // Debug için şimdilik ham kaydı dönüyoruz
      // (Sonra istersen frontend'e özel mapleriz)
      const o = r.rows[0];

return res.json({
  ok: true,
  offer: {
    companyName: o.company_name || "",
    email: o.to_email || "",
    usersCount: Number(o.users_count || 0),
    priceTRY: Number(o.price_try || 0),
    durationDays: Number(o.duration_days || 0),
    note: o.note || "",
    status: o.status || "draft",
    token: o.token,
    linkExpiresAt: o.link_expires_at,
    createdAt: o.created_at,
     pgOrgId: o.organization_id || "",
  },
});

    } catch (err) {
      console.error("OFFER READ ERROR >>>", err);
      return res.status(500).json({ ok: false, error: "OFFER_READ_FAILED" });
    }
  });

  // =========================================================
  // ✅ PUBLIC TEKLİF KAYIT (token ile)
  // POST /api/public/offer/:token/register
  // =========================================================
  router.post("/offer/:token/register", express.json(), async (req, res) => {
    try {
      const token = String(req.params.token || "").trim();
      if (!token) return res.status(400).json({ ok: false, error: "TOKEN_REQUIRED" });

      const body = req.body || {};
      const fullName = String(body.fullName || "").trim();
      const email = String(body.email || "").trim().toLowerCase();

      if (!fullName) return res.status(400).json({ ok: false, error: "FULL_NAME_REQUIRED" });
      if (!email) return res.status(400).json({ ok: false, error: "EMAIL_REQUIRED" });

      const r = await pgPool.query(
        `select id, status, created_at, duration_days from offers where token = $1 limit 1`,
        [token]
      );

      const offer = r.rows?.[0];
      if (!offer) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

      const createdAt = offer.created_at ? new Date(offer.created_at) : null;
      const durationDays = Number(offer.duration_days || 0);
      const expiresAt =
        createdAt && durationDays
          ? new Date(createdAt.getTime() + durationDays * 24 * 60 * 60 * 1000)
          : null;

      if (expiresAt && Date.now() > expiresAt.getTime()) {
        return res.status(410).json({ ok: false, error: "EXPIRED", expiresAt });
      }

      const ins = await pgPool.query(
        `
        insert into offer_registrations
          (offer_id, full_name, email, phone, company_tax_name, company_tax_no, company_address)
        values
          ($1,$2,$3,$4,$5,$6,$7)
        returning id, created_at
        `,
        [
          offer.id,
          fullName,
          email,
          body.phone || null,
          body.companyTaxName || null,
          body.companyTaxNo || null,
          body.companyAddress || null,
        ]
      );

      await pgPool.query(
        `
        update offers
        set status = case
          when status in ('paid','active') then status
          else 'registered'
        end
        where id = $1
        `,
        [offer.id]
      );

      return res.json({
        ok: true,
        registrationId: ins.rows[0].id,
        createdAt: ins.rows[0].created_at,
        next: "payment",
      });
    } catch (err) {
      console.error("POST /api/public/offer/:token/register error:", err);
      return res.status(500).json({ ok: false, error: "REGISTER_FAILED" });
    }
  });

  return router;
};
