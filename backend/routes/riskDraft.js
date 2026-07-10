const express = require("express");
const RiskDraft = require("../models/RiskDraft");

const router = express.Router();

router.get("/risk-assessments/draft/:firmId", async (req, res) => {
  try {
    const draft = await RiskDraft.findOne({ firmaId: req.params.firmId });
    if (!draft) return res.status(404).json({ message: "Taslak yok" });

    res.json(draft);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Hata" });
  }
});

router.put("/risk-assessments/draft/:firmId", async (req, res) => {
  try {
    const { payload, firmaAdi } = req.body;

    const draft = await RiskDraft.findOneAndUpdate(
      { firmaId: req.params.firmId },
      {
        firmaId: req.params.firmId,
        firmaAdi,
        payload,
      },
      { new: true, upsert: true }
    );

    res.json(draft);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Hata" });
  }
});

module.exports = router;
