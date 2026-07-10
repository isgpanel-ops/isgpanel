const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

/* =====================================================
   MODEL
===================================================== */
const KkdSchema = new mongoose.Schema(
  {
    firmaId: { type: String, required: true, index: true },
    firmaAdi: { type: String, default: "" },

    tc: { type: String, required: true, index: true },
    adSoyad: { type: String, default: "" },
    gorev: { type: String, default: "" },

    tarih: { type: String, default: "" },

    items: [
      {
        ad: { type: String, required: true },
        selected: { type: Boolean, default: false },
        adet: { type: Number, default: 0 },
      },
    ],

    createdBy: { type: String, default: "" },
    updatedBy: { type: String, default: "" },
  },
  { timestamps: true }
);

/* aynı personel tek kayıt */
KkdSchema.index(
  { firmaId: 1, tc: 1 },
  { unique: true }
);

const Kkd =
  mongoose.models.Kkd ||
  mongoose.model("Kkd", KkdSchema);

/* =====================================================
   HELPERS
===================================================== */
function cleanTc(v) {
  return String(v || "")
    .replace(/\D/g, "")
    .slice(0, 11);
}

function cleanItems(arr) {
  if (!Array.isArray(arr)) return [];

  return arr.map((x) => ({
    ad: String(x?.ad || "").trim(),
    selected: !!x?.selected,
    adet: Number(x?.adet || 0),
  }));
}

/* =====================================================
   GET LIST
   /api/kkd/list?firmaId=123
===================================================== */
router.get("/list", async (req, res) => {
  try {
    const { firmaId } = req.query;

    if (!firmaId) {
      return res.status(400).json({
        ok: false,
        message: "firmaId gerekli",
      });
    }

    const rows = await Kkd.find({
      firmaId: String(firmaId),
    }).sort({ adSoyad: 1 });

    res.json({
      ok: true,
      items: rows,
    });
  } catch (err) {
    console.error("KKD LIST ERROR:", err);
    res.status(500).json({
      ok: false,
      message: "Liste alınamadı",
    });
  }
});

/* =====================================================
   GET SINGLE
   /api/kkd/detail?firmaId=1&tc=11111111111
===================================================== */
router.get("/detail", async (req, res) => {
  try {
    const firmaId = String(
      req.query.firmaId || ""
    ).trim();

    const tc = cleanTc(req.query.tc);

    if (!firmaId || !tc) {
      return res.status(400).json({
        ok: false,
        message: "firmaId ve tc gerekli",
      });
    }

    const row = await Kkd.findOne({
      firmaId,
      tc,
    });

    res.json({
      ok: true,
      item: row || null,
    });
  } catch (err) {
    console.error("KKD DETAIL ERROR:", err);
    res.status(500).json({
      ok: false,
      message: "Detay alınamadı",
    });
  }
});

/* =====================================================
   SAVE / UPDATE
===================================================== */
router.post("/save", async (req, res) => {
  try {
    const body = req.body || {};

    const firmaId = String(
      body.firmaId || ""
    ).trim();

    const firmaAdi = String(
      body.firmaAdi || ""
    ).trim();

    const tc = cleanTc(body.tc);

    if (!firmaId || !tc) {
      return res.status(400).json({
        ok: false,
        message: "firmaId ve tc gerekli",
      });
    }

    const payload = {
      firmaId,
      firmaAdi,
      tc,
      adSoyad: String(
        body.adSoyad || ""
      ).trim(),
      gorev: String(
        body.gorev || ""
      ).trim(),
      tarih: String(
        body.tarih || ""
      ).trim(),
      items: cleanItems(body.items),
      updatedBy: String(
        body.updatedBy || ""
      ).trim(),
    };

    const row =
      await Kkd.findOneAndUpdate(
        { firmaId, tc },
        {
          $set: payload,
          $setOnInsert: {
            createdBy: String(
              body.createdBy || ""
            ).trim(),
          },
        },
        {
          new: true,
          upsert: true,
        }
      );

    res.json({
      ok: true,
      item: row,
      message: "KKD kaydedildi",
    });
  } catch (err) {
    console.error("KKD SAVE ERROR:", err);

    res.status(500).json({
      ok: false,
      message: "KKD kaydedilemedi",
    });
  }
});

/* =====================================================
   DELETE
===================================================== */
router.post("/delete", async (req, res) => {
  try {
    const firmaId = String(
      req.body?.firmaId || ""
    ).trim();

    const tc = cleanTc(req.body?.tc);

    if (!firmaId || !tc) {
      return res.status(400).json({
        ok: false,
        message: "firmaId ve tc gerekli",
      });
    }

    await Kkd.deleteOne({
      firmaId,
      tc,
    });

    res.json({
      ok: true,
      message: "KKD silindi",
    });
  } catch (err) {
    console.error("KKD DELETE ERROR:", err);

    res.status(500).json({
      ok: false,
      message: "KKD silinemedi",
    });
  }
});

/* =====================================================
   BULK LIST FOR PDF
===================================================== */
router.post("/bulk", async (req, res) => {
  try {
    const firmaId = String(
      req.body?.firmaId || ""
    ).trim();

    const tcler = Array.isArray(req.body?.tcler)
      ? req.body.tcler.map(cleanTc)
      : [];

    if (!firmaId || !tcler.length) {
      return res.status(400).json({
        ok: false,
        message: "firmaId ve tcler gerekli",
      });
    }

    const rows = await Kkd.find({
      firmaId,
      tc: { $in: tcler },
    });

    res.json({
      ok: true,
      items: rows,
    });
  } catch (err) {
    console.error("KKD BULK ERROR:", err);

    res.status(500).json({
      ok: false,
      message: "Toplu veri alınamadı",
    });
  }
});

module.exports = router;