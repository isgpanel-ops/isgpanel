const express = require("express");
const router = express.Router();

const PLANS = require("../plans");
const PlanSetting = require("../models/PlanSetting");

// Tüm paketleri getir
router.get("/", async (req, res) => {
  try {
    const dbPlans = await PlanSetting.find({}).lean();

    if (dbPlans && dbPlans.length) {
      return res.json(dbPlans);
    }

    // fallback
    return res.json(Object.values(PLANS));
  } catch (e) {
    console.error("plans GET error:", e);
    return res.status(500).json({ message: "Planlar alınamadı" });
  }
});

// Tek paket getir
router.get("/:code", async (req, res) => {
  try {
    const plan = await PlanSetting.findOne({ code: req.params.code }).lean();

    if (plan) {
      return res.json(plan);
    }

    const fallback = PLANS[req.params.code];
    if (!fallback) {
      return res.status(404).json({ error: "Plan bulunamadı" });
    }

    return res.json(fallback);
  } catch (e) {
    console.error("plan GET error:", e);
    return res.status(500).json({ message: "Plan alınamadı" });
  }
});

module.exports = router;