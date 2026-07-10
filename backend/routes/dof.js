const express = require("express");
const router = express.Router();
const DofFormDraft = require("../models/DofFormDraft");

const EMPTY_FORM = {
  tarih: "",
  kayitNo: "",
  tanim: "",
  neden: "",
  faaliyet: "",
  planBitis: "",
  takipSonucu: "",
  yeniFaaliyetNo: "",
};

function yearFromTrDate(tarihStr) {
  if (!tarihStr) return null;

  const m = String(tarihStr).trim().match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (m) return Number(m[3]);

  const y = String(tarihStr).trim().match(/\b(19|20)\d{2}\b/);
  return y ? Number(y[0]) : null;
}

function pad3(n) {
  return String(n).padStart(3, "0");
}

function normalizeForm(input = {}) {
  return {
    tarih: String(input?.tarih || "").trim(),
    kayitNo: String(input?.kayitNo || "").trim().toUpperCase(),
    tanim: String(input?.tanim || "").trim(),
    neden: String(input?.neden || "").trim(),
    faaliyet: String(input?.faaliyet || "").trim(),
    planBitis: String(input?.planBitis || "").trim(),
    takipSonucu: String(input?.takipSonucu || "").trim(),
    yeniFaaliyetNo: String(input?.yeniFaaliyetNo || "").trim().toUpperCase(),
  };
}

async function getNextKayitNo(firmaId, tarih) {
  const year = yearFromTrDate(tarih) || new Date().getFullYear();
  const prefix = `DOF-${year}-`;

  const docs = await DofFormDraft.find(
    {
      firmaId: { $ne: String(firmaId) },
      "form.kayitNo": { $regex: `^${prefix}` },
    },
    { "form.kayitNo": 1 }
  ).lean();

  let maxSeq = 0;

  for (const item of docs) {
    const kayitNo = item?.form?.kayitNo || "";
    const match = String(kayitNo).match(/DOF-(\d{4})-(\d+)/i);
    if (!match) continue;

    const seq = Number(match[2]);
    if (!Number.isNaN(seq)) {
      maxSeq = Math.max(maxSeq, seq);
    }
  }

  return `DOF-${year}-${pad3(maxSeq + 1)}`;
}

/**
 * GET /api/dof/form/:firmaId
 */
router.get("/form/:firmaId", async (req, res) => {
  try {
    const { firmaId } = req.params;

    if (!firmaId) {
      return res.status(400).json({
        ok: false,
        message: "firmaId zorunludur.",
      });
    }

    const existing = await DofFormDraft.findOne({
      firmaId: String(firmaId),
    }).lean();

    if (!existing) {
      return res.status(404).json({
        ok: false,
        message: "Bu firmaya ait kayıtlı DÖF taslağı bulunamadı.",
      });
    }

    return res.status(200).json({
      ok: true,
      form: existing.form || EMPTY_FORM,
      updatedAt: existing.updatedAt,
      createdAt: existing.createdAt,
    });
  } catch (error) {
    console.error("GET /api/dof/form/:firmaId hata:", error);
    return res.status(500).json({
      ok: false,
      message: "DÖF formu alınırken hata oluştu.",
      error: error.message,
    });
  }
});

/**
 * PUT /api/dof/form/:firmaId
 */
router.put("/form/:firmaId", async (req, res) => {
  try {
    const { firmaId } = req.params;
    const bodyForm = req.body?.form || {};

    const updatedBy =
      req.user?._id ||
      req.user?.id ||
      req.body?.updatedBy ||
      "";

    if (!firmaId) {
      return res.status(400).json({
        ok: false,
        message: "firmaId zorunludur.",
      });
    }

    const normalizedForm = normalizeForm(bodyForm);

    if (!normalizedForm.kayitNo) {
      normalizedForm.kayitNo = await getNextKayitNo(
        firmaId,
        normalizedForm.tarih
      );
    }

    const updated = await DofFormDraft.findOneAndUpdate(
      { firmaId: String(firmaId) },
      {
        $set: {
          firmaId: String(firmaId),
          form: normalizedForm,
          updatedBy: String(updatedBy || ""),
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    ).lean();

    return res.status(200).json({
      ok: true,
      message: "DÖF formu kaydedildi.",
      form: updated.form,
      updatedAt: updated.updatedAt,
      createdAt: updated.createdAt,
    });
  } catch (error) {
    console.error("PUT /api/dof/form/:firmaId hata:", error);
    return res.status(500).json({
      ok: false,
      message: "DÖF formu kaydedilirken hata oluştu.",
      error: error.message,
    });
  }
});

/**
 * DELETE /api/dof/form/:firmaId
 */
router.delete("/form/:firmaId", async (req, res) => {
  try {
    const { firmaId } = req.params;

    if (!firmaId) {
      return res.status(400).json({
        ok: false,
        message: "firmaId zorunludur.",
      });
    }

    await DofFormDraft.findOneAndDelete({
      firmaId: String(firmaId),
    });

    return res.status(200).json({
      ok: true,
      message: "DÖF taslağı silindi.",
    });
  } catch (error) {
    console.error("DELETE /api/dof/form/:firmaId hata:", error);
    return res.status(500).json({
      ok: false,
      message: "DÖF taslağı silinirken hata oluştu.",
      error: error.message,
    });
  }
});

module.exports = router;