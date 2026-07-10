const express = require("express");
const router = express.Router();

const PLANS = require("../plans");

// GET /api/pricing?plan=...
router.get("/", (req, res) => {
  try {
    const planCode = req.query.plan;

    if (!planCode) {
      return res.status(400).json({ message: "plan parametresi gerekli." });
    }

    const plan = PLANS[planCode];
    if (!plan) {
      return res.status(404).json({ message: "Plan bulunamadı." });
    }

    const base = plan.monthlyPrice;         // KDV hariç gibi düşün
    const kdvRate = plan.kdvRate || 0;
    const kdv = base * kdvRate;
    const total = base + kdv;

    res.json({
      planCode: plan.code,
      name: plan.name,
      maxUsers: plan.maxUsers,
      basePrice: base,   // KDV hariç
      kdv,
      total,             // KDV dahil
      kdvRate,
    });
  } catch (err) {
    console.error("PRICING ERROR:", err);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

module.exports = router;
