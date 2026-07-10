const express = require("express");

/**
 * Factory route
 * pgPool server.js’ten PARAMETRE olarak gelir
 */
module.exports = function publicRegisterRoutes(pgPool) {
  const router = express.Router();

  /**
   * POST /api/public/offer/:token/register
   * Akış:
   * - Teklif var mı?
   * - Süresi dolmuş mu?
   * - Daha önce kullanıldı mı?
   * - Organization oluştur (pending)
   * - Teklifi org’a bağla
   */
  router.post("/offer/:token/register", async (req, res) => {
    const { token } = req.params;

    try {
      // 1️⃣ Teklifi bul
      const offerResult = await pgPool.query(
        "SELECT * FROM offers WHERE token = $1",
        [token]
      );

      if (offerResult.rowCount === 0) {
        return res.status(404).json({ error: "NOT_FOUND" });
      }

      const offer = offerResult.rows[0];

      // 2️⃣ Süre kontrolü
      if (offer.link_expires_at && new Date() > new Date(offer.link_expires_at)) {
        return res.status(410).json({ error: "EXPIRED" });
      }

      // 3️⃣ Daha önce kullanıldıysa aynı org’u dön
      if (offer.org_id) {
        return res.json({ organizationId: offer.org_id });
      }

      // 4️⃣ Organization oluştur (pending)
      const orgResult = await pgPool.query(
        `
        INSERT INTO organizations (name, email, status)
        VALUES ($1, $2, 'pending')
        RETURNING id
        `,
        [offer.company_name, offer.email]
      );

      const organizationId = orgResult.rows[0].id;

      // 5️⃣ Teklifi organization’a bağla
      await pgPool.query(
        `
        UPDATE offers
        SET status = 'registered',
            org_id = $1
        WHERE token = $2
        `,
        [organizationId, token]
      );

      // 6️⃣ Frontend’e orgId dön
      return res.json({ organizationId });
    } catch (err) {
      console.error("publicRegister error:", err);
      return res.status(500).json({ error: "SERVER_ERROR" });
    }
  });

  return router;
};
