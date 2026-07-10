// backend/routes/paymentWebhook.js
const express = require("express");
const router = express.Router();

const { createNotification } = require("../services/notificationService");

// ✅ Postgres pool'a erişim (server.js içinde app.locals.pgPool set edildi varsayımı)
function getPgPool(req) {
  return req?.app?.locals?.pgPool;
}

// ✅ Son teklifi çek (opsiyonel kontrol)
async function getLatestOffer(pgPool, organizationId) {
  const r = await pgPool.query(
    `
      SELECT price
      FROM offers
      WHERE organization_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [organizationId]
  );
  if (!r.rowCount) return null;
  return Number(r.rows[0].price);
}

/**
 * ÖDEME BAŞARILI CALLBACK
 * Bu endpoint'i payment provider (iyzico / paytr / stripe vb)
 * başarı durumunda çağıracak.
 */
router.post("/success", async (req, res) => {
  try {
    /**
     * ⚠️ BURASI ÖNEMLİ
     * Senin payment provider'ın burada userId'yi
     * body / metadata / referenceId içinden veriyor olmalı
     *
     * ÖRNEKLER:
     * req.body.userId
     * req.body.buyerId
     * req.body.metadata.userId
     */
    const userId =
      req.body?.userId || req.body?.buyerId || req.body?.metadata?.userId;

    const paymentId =
      req.body?.paymentId || req.body?.conversationId || `pay_${Date.now()}`;

    if (!userId) {
      return res.status(400).json({ message: "userId bulunamadı" });
    }

    // ✅ (Opsiyonel) provider organizationId ve paidAmount gönderiyorsa teklif ile kıyasla
    const organizationId = req.body?.organizationId || req.body?.metadata?.organizationId;
    const paidAmountTRY = Number(
      req.body?.paidAmountTRY ?? req.body?.amountTRY ?? req.body?.price ?? req.body?.paidPrice
    );

    if (organizationId && Number.isFinite(paidAmountTRY) && paidAmountTRY > 0) {
      const pgPool = getPgPool(req);
      if (pgPool) {
        const offerPrice = await getLatestOffer(pgPool, organizationId);
        if (Number.isFinite(offerPrice) && offerPrice > 0 && paidAmountTRY !== offerPrice) {
          // mismatch: burada ister logla ister ayrı bildirim at
          await createNotification({
            userId,
            type: "event",
            module: "abonelik",
            title: "Ödeme tutarı uyuşmuyor ⚠️",
            message: `Ödeme: ${paidAmountTRY} TL, Teklif: ${offerPrice} TL. Lütfen kontrol edin.`,
            severity: "warning",
            link: "",
            key: `payment-mismatch:${paymentId}`,
          });

          return res.status(400).json({ message: "paidAmount teklif ile uyuşmuyor" });
        }
      }
    }

    // ✅ 1) Ödeme başarılı bildirimi
    await createNotification({
      userId,
      type: "event",
      module: "abonelik",
      title: "Ödeme başarılı ✅",
      message: "Ödemeniz başarıyla alınmıştır.",
      severity: "info",
      link: "",
      key: `payment:${paymentId}`,
    });

    // ✅ 2) HOŞ GELDİNİZ — SADECE 1 KEZ
    await createNotification({
      userId,
      type: "event",
      module: "abonelik",
      title: "Hoş geldiniz 👋",
      message: "Aboneliğiniz aktif edildi. Paneli kullanmaya başlayabilirsiniz.",
      severity: "info",
      link: "",
      key: "welcome:v1",
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("payment success webhook hata:", err);
    return res.status(500).json({ message: "Webhook hatası" });
  }
});

module.exports = router;
