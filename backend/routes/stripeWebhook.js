// filename: backend/routes/stripeWebhook.js
const express = require("express");
const router = express.Router();

const { createNotification } = require("../services/notificationService");

// Stripe signature doğrulaması için raw body gerekir.
// Bu route'u server.js'de JSON middleware'inden ÖNCE bağlamalısın (aşağıda not var).
router.post(
  "/stripe",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      const stripeSecret = process.env.STRIPE_WEBHOOK_SECRET;
      const stripeKey = process.env.STRIPE_SECRET_KEY;

      if (!stripeSecret || !stripeKey) {
        return res.status(500).json({ message: "Stripe env eksik (SECRET_KEY / WEBHOOK_SECRET)" });
      }

      // Stripe SDK
      // npm i stripe
      // eslint-disable-next-line global-require
      const Stripe = require("stripe");
      const stripe = new Stripe(stripeKey);

      const sig = req.headers["stripe-signature"];
      let event;

      try {
        event = stripe.webhooks.constructEvent(req.body, sig, stripeSecret);
      } catch (err) {
        console.error("Stripe signature doğrulama hatası:", err?.message || err);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      // ✅ Burada en önemli şey: event -> userId eşlemesi
      // Pratik yaklaşım: Checkout Session / Subscription metadata içine userId yazmak
      // Örn: metadata: { userId: "..." }
      const getUserIdFromObject = (obj) => obj?.metadata?.userId || obj?.metadata?.userid || "";

      // Bu projede abonelik modelinin adı sende farklı olabilir; o yüzden burada sadece Notification yazıyoruz.
      // Abonelik aktif etme kısmını kendi subscription servisinde yapıyorsun varsayımıyla.

      // ---- OLAYLAR ----
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const userId = getUserIdFromObject(session);

        // Ödeme başarılı bildirimi (anlık)
        if (userId) {
          await createNotification({
            userId,
            type: "event",
            module: "abonelik",
            title: "Ödeme başarılı ✅",
            message: "Ödemeniz başarıyla alındı.",
            severity: "info",
            link: "",
            key: `payment:${session.id}`, // tekilleştirme
          });

          // ✅ Hoş geldiniz (abonelik sonrası) — 1 kez
          await createNotification({
            userId,
            type: "event",
            module: "abonelik",
            title: "Hoş geldiniz 👋",
            message: "Aboneliğiniz aktif edildi. Paneli kullanmaya başlayabilirsiniz.",
            severity: "info",
            link: "", // popup
            key: "welcome:v1",
          });
        }
      }

      if (event.type === "invoice.payment_failed") {
        const invoice = event.data.object;
        const userId = getUserIdFromObject(invoice);

        if (userId) {
          await createNotification({
            userId,
            type: "event",
            module: "abonelik",
            title: "Ödeme başarısız ❌",
            message: "Ödeme alınamadı. Kart / limit / banka kaynaklı olabilir.",
            severity: "warning",
            link: "",
            key: `payment_failed:${invoice.id}`,
          });
        }
      }

      if (event.type === "customer.subscription.deleted") {
        const sub = event.data.object;
        const userId = getUserIdFromObject(sub);

        if (userId) {
          await createNotification({
            userId,
            type: "event",
            module: "abonelik",
            title: "Abonelik iptal edildi",
            message: "Aboneliğiniz iptal edildi.",
            severity: "info",
            link: "",
            key: `sub_event:${sub.id}:deleted`,
          });
        }
      }

      // Stripe “OK” bekler
      return res.json({ received: true });
    } catch (err) {
      console.error("Stripe webhook genel hata:", err?.message || err);
      return res.status(500).json({ message: "Webhook hatası" });
    }
  }
);

module.exports = router;
