const express = require("express");

module.exports = function (pgPool) {
  const router = express.Router();

 router.get("/checkout/:orgId", async (req, res) => {
  const { orgId } = req.params;
  const token = String(req.query.token || "").trim();

    const isUUID = (s) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        String(s)
      );

    if (!isUUID(orgId)) {
      return res.status(400).json({
        message: "org parametresi UUID olmalı",
      });
    }

    try {
      /* 🔹 organizations tablosu varsa kontrol et */
      try {
        await pgPool.query(
          `SELECT id FROM organizations WHERE id = $1`,
          [orgId]
        );
      } catch (err) {
        console.warn('WARN: organizations tablosu yok, pas geçildi.');
      }

      /* 🔹 offers kolonlarını oku */
      const colsRes = await pgPool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'offers'
      `);

      const cols = colsRes.rows.map((r) => r.column_name);

      const orgCol =
        [ "accepted_org_id", "organization_id", "org_id", "company_id"].find((c) =>
          cols.includes(c)
        ) || null;

      if (!orgCol) {
        return res.status(500).json({ message: "Org kolonu bulunamadı" });
      }

      const priceCol =
        ["price_try", "price", "amount", "total"].find((c) =>
          cols.includes(c)
        ) || null;

      if (!priceCol) {
        return res.status(500).json({ message: "Fiyat kolonu yok" });
      }

      const usersCol =
        ["users_count", "user_count"].find((c) =>
          cols.includes(c)
        ) || null;

     let offerRes;

if (token) {
  offerRes = await pgPool.query(
    `
    SELECT
      ${priceCol} AS price
      ${usersCol ? `, ${usersCol} AS users_count` : ""}
    FROM offers
    WHERE token = $1
    LIMIT 1
    `,
    [token]
  );
} else {
  offerRes = await pgPool.query(
    `
    SELECT
      ${priceCol} AS price
      ${usersCol ? `, ${usersCol} AS users_count` : ""}
    FROM offers
    WHERE ${orgCol} = $1
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [orgId]
  );
}


      if (offerRes.rowCount === 0) {
        return res.json({
          amountTRY: 0,
          usersCount: 0,
        });
      }

      const offer = offerRes.rows[0];

      return res.json({
        amountTRY: Math.round(Number(offer.price)),
        usersCount: Number(offer.users_count || 0),
      });
    } catch (err) {
      console.error("CHECKOUT ERROR:", err);
      res.status(500).json({ message: "Checkout hata" });
    }
  });

  return router;
};
