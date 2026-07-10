const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

const safe = (v) => (v ?? "").toString().trim();
const normalizeTC = (v) => safe(v).replace(/\D/g, "").slice(0, 11);
const toUpperTR = (v) => safe(v).toLocaleUpperCase("tr-TR");

const ParticipantSchema = new mongoose.Schema(
  {
    tc: { type: String, default: "" },
    adSoyad: { type: String, default: "" },
    gorev: { type: String, default: "" },
    egitimTarihi: { type: String, default: "" },
    imzalar: {
      personel: {
        dataUrl: { type: String, default: "" },
        createdAt: { type: String, default: "" },
      },
    },
  },
  { _id: false }
);

const YuksekteCalismaSchema = new mongoose.Schema(
  {
    firmaId: { type: String, required: true, index: true },
    firmaAdi: { type: String, default: "" },
    egitimTuru: { type: String, default: "Yüksekte Çalışma Eğitimi" },
    katilimcilar: { type: [ParticipantSchema], default: [] },
  },
  {
    timestamps: true,
    collection: "yuksekte_calisma_katilimcilar",
  }
);

const YuksekteCalismaModel =
  mongoose.models.YuksekteCalismaKatilimci ||
  mongoose.model("YuksekteCalismaKatilimci", YuksekteCalismaSchema);

function isEmptyParticipant(row = {}) {
  return (
    !safe(row.tc) &&
    !safe(row.adSoyad) &&
    !safe(row.gorev) &&
    !safe(row.egitimTarihi)
  );
}

function normalizeParticipant(row = {}) {
  const personel = row?.imzalar?.personel || {};

  return {
    tc: normalizeTC(row.tc),
    adSoyad: toUpperTR(row.adSoyad),
    gorev: toUpperTR(row.gorev),
    egitimTarihi: safe(row.egitimTarihi),
    imzalar: {
      personel: {
        dataUrl: safe(personel?.dataUrl),
        createdAt:
          safe(personel?.createdAt) ||
          (safe(personel?.dataUrl) ? new Date().toISOString() : ""),
      },
    },
  };
}

function serializeParticipant(row = {}) {
  return {
    tc: safe(row.tc),
    adSoyad: safe(row.adSoyad),
    gorev: safe(row.gorev),
    egitimTarihi: safe(row.egitimTarihi),
    imzalar: {
      personel: {
        dataUrl: safe(row?.imzalar?.personel?.dataUrl),
        createdAt: safe(row?.imzalar?.personel?.createdAt),
      },
    },
  };
}

router.get("/yuksekte-calisma/katilimcilar", async (req, res) => {
  try {
    const firmaId = safe(req.query.firmaId);

    if (!firmaId) {
      return res.status(400).json({ message: "firmaId zorunlu." });
    }

    const doc = await YuksekteCalismaModel.findOne({ firmaId }).lean();

    const items = Array.isArray(doc?.katilimcilar)
      ? doc.katilimcilar
          .filter((row) => !isEmptyParticipant(row))
          .map(serializeParticipant)
      : [];

    return res.json({
      ok: true,
      items,
      katilimcilar: items,
      participants: items,
    });
  } catch (err) {
    console.error("GET /yuksekte-calisma/katilimcilar error:", err);
    return res.status(500).json({
      message: "Katılımcı listesi alınamadı.",
      error: err?.message || "unknown_error",
    });
  }
});

router.post("/yuksekte-calisma/katilimcilar", async (req, res) => {
  try {
    const firmaId = safe(req.body?.firmaId);
    const firmaAdi = safe(req.body?.firmaAdi);
    const egitimTuru = safe(req.body?.egitimTuru || "Yüksekte Çalışma Eğitimi");
    const incoming = Array.isArray(req.body?.katilimcilar)
      ? req.body.katilimcilar
      : [];

    if (!firmaId) {
      return res.status(400).json({ message: "firmaId zorunlu." });
    }

    const normalized = incoming
      .map(normalizeParticipant)
      .filter((row) => !isEmptyParticipant(row));

    const updated = await YuksekteCalismaModel.findOneAndUpdate(
      { firmaId },
      {
        $set: {
          firmaId,
          firmaAdi,
          egitimTuru,
          katilimcilar: normalized,
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    ).lean();

    const items = Array.isArray(updated?.katilimcilar)
      ? updated.katilimcilar.map(serializeParticipant)
      : [];

    return res.json({
      ok: true,
      items,
      katilimcilar: items,
      participants: items,
    });
  } catch (err) {
    console.error("POST /yuksekte-calisma/katilimcilar error:", err);
    return res.status(500).json({
      message: "Katılımcılar kaydedilemedi.",
      error: err?.message || "unknown_error",
    });
  }
});

module.exports = router;