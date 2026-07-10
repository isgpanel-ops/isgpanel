import express from "express";
import RiskDraft from "../models/RiskDraft.js";

const router = express.Router();

// GET
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

// PUT
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

export default router;