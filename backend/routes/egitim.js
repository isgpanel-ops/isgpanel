const express = require("express");
const mongoose = require("mongoose");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

/* =========================
   ORTAK HELPERS
========================= */
const normalizeTC = (v) => String(v || "").replace(/\D/g, "").slice(0, 11);
const cleanText = (v) => String(v || "").trim();

const pickFirmaObjectId = (firmaId) => {
  try {
    if (!firmaId) return null;
    if (firmaId instanceof mongoose.Types.ObjectId) return firmaId;
    if (mongoose.Types.ObjectId.isValid(String(firmaId))) {
      return new mongoose.Types.ObjectId(String(firmaId));
    }
    return null;
  } catch {
    return null;
  }
};

function buildModel(modelName, collectionName) {
  const schema = new mongoose.Schema(
    {
      firmaId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        unique: true,
        index: true,
      },
      firmaAdi: {
        type: String,
        default: "",
        trim: true,
      },
      egitimTuru: {
        type: String,
        default: "",
        trim: true,
      },
      payload: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
      katilimcilar: {
        type: Array,
        default: [],
      },
      updatedBy: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
      },
    },
    {
      timestamps: true,
      collection: collectionName,
    }
  );

  return mongoose.models[modelName] || mongoose.model(modelName, schema);
}

const YuksekteModel = buildModel(
  "YuksekteCalismaEgitimiKayit",
  "egitim_yuksekte_calisma"
);

const IseGirisModel = buildModel(
  "IseGirisEgitimiKayit",
  "egitim_ise_giris"
);

const DestekAcilModel = buildModel(
  "DestekAcilEgitimiKayit",
  "egitim_destek_acil"
);

const CalisanTemsilcisiModel = buildModel(
  "CalisanTemsilcisiEgitimiKayit",
  "egitim_calisan_temsilcisi"
);

/* =========================
   NORMALIZER'LAR
========================= */
function normalizeYuksekteRows(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((k) => ({
      tc: normalizeTC(k?.tc),
      adSoyad: cleanText(k?.adSoyad),
      gorev: cleanText(k?.gorev),
      egitimTarihi: cleanText(k?.egitimTarihi),

      personelFoto: cleanText(
        k?.personelFoto || k?.personelFotoDataUrl
      ),

      imzalar: {
        personel: {
          dataUrl: cleanText(k?.imzalar?.personel?.dataUrl),
          createdAt: cleanText(k?.imzalar?.personel?.createdAt),
        },
      },
    }))
   .filter(
  (k) =>
    k.tc ||
    k.adSoyad ||
    k.gorev ||
    k.egitimTarihi ||
    k?.imzalar?.personel?.dataUrl ||
    k?.personelFoto
);
}

function normalizeIseGirisRows(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((k) => ({
      tc: normalizeTC(k?.tc),
      adSoyad: cleanText(k?.adSoyad),
      gorev: cleanText(k?.gorev),
      iseGirisTarihi: cleanText(k?.iseGirisTarihi),
      baslangicTarihi: cleanText(k?.baslangicTarihi),
      bitisTarihi: cleanText(k?.bitisTarihi),

personelFoto: cleanText(
  k?.personelFoto || k?.personelFotoDataUrl
),

imzalar: {
        genel: {
          dataUrl: cleanText(k?.imzalar?.genel?.dataUrl),
          createdAt: cleanText(k?.imzalar?.genel?.createdAt),
        },
        teknik: {
          dataUrl: cleanText(k?.imzalar?.teknik?.dataUrl),
          createdAt: cleanText(k?.imzalar?.teknik?.createdAt),
        },
        saglik: {
          dataUrl: cleanText(k?.imzalar?.saglik?.dataUrl),
          createdAt: cleanText(k?.imzalar?.saglik?.createdAt),
        },
        iseOzelRiskler: {
          dataUrl: cleanText(k?.imzalar?.iseOzelRiskler?.dataUrl),
          createdAt: cleanText(k?.imzalar?.iseOzelRiskler?.createdAt),
        },
      },

      testSonucu:
        k?.testSonucu && typeof k.testSonucu === "object"
          ? k.testSonucu
          : null,
    }))
    .filter(
      (k) =>
        k.tc ||
        k.adSoyad ||
        k.gorev ||
        k.iseGirisTarihi ||
        k.baslangicTarihi ||
        k.bitisTarihi ||
        k?.imzalar?.genel?.dataUrl ||
        k?.imzalar?.teknik?.dataUrl ||
        k?.imzalar?.saglik?.dataUrl ||
        k?.imzalar?.iseOzelRiskler?.dataUrl ||
k?.personelFoto ||
k?.testSonucu
    );
}

function normalizeDestekAcilRows(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((k) => ({
      tc: normalizeTC(k?.tc),
      adSoyad: cleanText(k?.adSoyad),
      gorev: cleanText(k?.gorev),
      ekip: cleanText(k?.ekip),
      kaynak: cleanText(k?.kaynak),
      egitimTarihi: cleanText(k?.egitimTarihi),
      belgeTipi: cleanText(k?.belgeTipi),
      imzalar: {
        personel: {
          dataUrl: cleanText(k?.imzalar?.personel?.dataUrl),
          createdAt: cleanText(k?.imzalar?.personel?.createdAt),
        },
      },
    }))
    .filter(
      (k) =>
        k.tc ||
        k.adSoyad ||
        k.gorev ||
        k.ekip ||
        k.kaynak ||
        k.egitimTarihi ||
        k.belgeTipi ||
        k?.imzalar?.personel?.dataUrl
    );
}

function normalizeCalisanTemsilcisiRows(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((k, idx) => ({
      no: Number(k?.no || idx + 1),
      tc: normalizeTC(k?.tc),
      adSoyad: cleanText(k?.adSoyad),
      gorev: cleanText(k?.gorev || "ÇALIŞAN TEMSİLCİSİ"),
    }))
    .filter((k) => k.tc || k.adSoyad || k.gorev);
}

/* =========================
   ORTAK CRUD
========================= */
async function handleGet(req, res, Model, options = {}) {
  try {
    const { firmaId } = req.query;
    if (!firmaId) {
      return res.status(400).json({ ok: false, message: "firmaId zorunlu" });
    }

    const oid = pickFirmaObjectId(firmaId);
    if (!oid) {
      return res.status(400).json({ ok: false, message: "Geçersiz firmaId" });
    }

    const doc = await Model.findOne({ firmaId: oid }).lean();

    return res.json({
      ok: true,
      firmaId,
      firmaAdi: doc?.firmaAdi || "",
      egitimTuru: doc?.egitimTuru || options.defaultEgitimTuru || "",
      items: Array.isArray(doc?.katilimcilar) ? doc.katilimcilar : [],
      payload: doc?.payload || {},
      updatedAt: doc?.updatedAt || null,
    });
  } catch (err) {
    console.error("Eğitim GET hata:", err);
    return res.status(500).json({ ok: false, message: "Sunucu hatası" });
  }
}

async function handlePost(req, res, Model, normalizeRows, options = {}) {
  try {
    const body = req.body || {};
    const { firmaId, firmaAdi, egitimTuru } = body;

    if (!firmaId) {
      return res.status(400).json({ ok: false, message: "firmaId zorunlu" });
    }

    const oid = pickFirmaObjectId(firmaId);
    if (!oid) {
      return res.status(400).json({ ok: false, message: "Geçersiz firmaId" });
    }

    const rows = normalizeRows(body?.katilimcilar);
    const updated = await Model.findOneAndUpdate(
      { firmaId: oid },
      {
        $set: {
          firmaId: oid,
          firmaAdi: cleanText(firmaAdi),
          egitimTuru: cleanText(egitimTuru || options.defaultEgitimTuru || ""),
          katilimcilar: rows,
          payload: body?.payload && typeof body.payload === "object" ? body.payload : {},
          updatedBy: req.user?.id || req.user?._id || null,
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    ).lean();

    return res.json({
      ok: true,
      message: "Kayıt kaydedildi",
      items: Array.isArray(updated?.katilimcilar) ? updated.katilimcilar : [],
      payload: updated?.payload || {},
      updatedAt: updated?.updatedAt || null,
    });
  } catch (err) {
    console.error("Eğitim POST hata:", err);
    return res.status(500).json({ ok: false, message: "Sunucu hatası" });
  }
}

/* =========================
   YÜKSEKTE ÇALIŞMA
   frontend mevcut endpoint ile uyumlu
========================= */
router.get(
  "/yuksekte-calisma/katilimcilar",
  authMiddleware,
  async (req, res) =>
    handleGet(req, res, YuksekteModel, {
      defaultEgitimTuru: "Yüksekte Çalışma Eğitimi",
    })
);

router.post(
  "/yuksekte-calisma/katilimcilar",
  authMiddleware,
  async (req, res) =>
    handlePost(req, res, YuksekteModel, normalizeYuksekteRows, {
      defaultEgitimTuru: "Yüksekte Çalışma Eğitimi",
    })
);

/* =========================
   İŞE GİRİŞ EĞİTİMİ
   frontend sonra buna bağlanacak
========================= */
router.get(
  "/ise-giris/katilimcilar",
  authMiddleware,
  async (req, res) =>
    handleGet(req, res, IseGirisModel, {
      defaultEgitimTuru: "İşe Giriş Eğitimi",
    })
);

router.post(
  "/ise-giris/katilimcilar",
  authMiddleware,
  async (req, res) =>
    handlePost(req, res, IseGirisModel, normalizeIseGirisRows, {
      defaultEgitimTuru: "İşe Giriş Eğitimi",
    })
);

/* =========================
   DESTEK / ACİL EKİP EĞİTİMİ
   frontend sonra buna bağlanacak
========================= */
router.get(
  "/destek-acil/katilimcilar",
  authMiddleware,
  async (req, res) =>
    handleGet(req, res, DestekAcilModel, {
      defaultEgitimTuru: "Destek Acil Ekip Eğitimi",
    })
);

router.post(
  "/destek-acil/katilimcilar",
  authMiddleware,
  async (req, res) =>
    handlePost(req, res, DestekAcilModel, normalizeDestekAcilRows, {
      defaultEgitimTuru: "Destek Acil Ekip Eğitimi",
    })
);

/* =========================
   ÇALIŞAN TEMSİLCİSİ EĞİTİMİ
   frontend sonra buna bağlanacak
========================= */
router.get(
  "/calisan-temsilcisi/katilimcilar",
  authMiddleware,
  async (req, res) =>
    handleGet(req, res, CalisanTemsilcisiModel, {
      defaultEgitimTuru: "Çalışan Temsilcisi Eğitimi",
    })
);

router.post(
  "/calisan-temsilcisi/katilimcilar",
  authMiddleware,
  async (req, res) =>
    handlePost(req, res, CalisanTemsilcisiModel, normalizeCalisanTemsilcisiRows, {
      defaultEgitimTuru: "Çalışan Temsilcisi Eğitimi",
    })
);

module.exports = router;