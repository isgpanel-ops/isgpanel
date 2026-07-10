const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const KurumsalKimlik = require("../models/KurumsalKimlik");

// ✅ TEK AUTH: projedeki ortak middleware (senin attığın auth.js)
const auth = require("../middleware/auth"); // yol farklıysa düzelt

const router = express.Router();

/**
 * OrgId çözümü:
 * - Yeni auth middleware req.user.organizationId'yi garanti etmeye çalışıyor (token veya DB fallback).
 * - Bu route dosyasında artık jwt verify / req.decoded yok.
 */
function getOrgId(req) {
  return (
    req?.user?.organizationId ||
    req?.user?.organization ||
    req?.user?.orgId ||
    null
  );
}

/* ✅ LOGO UPLOAD */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const orgId = getOrgId(req);
      if (!orgId) return cb(new Error("organizationId bulunamadı"));

      const dir = path.join(process.cwd(), "uploads", "org", String(orgId));
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".png";
    cb(null, `logo${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ["image/png", "image/jpeg", "image/webp"].includes(file.mimetype);
    cb(ok ? null : new Error("Sadece PNG/JPG/WEBP"), ok);
  },
});

/**
 * ✅ POST /api/kurumsal-kimlik/logo
 * - ticari_user yükleyemesin (aynı mantık kalsın)
 * - ama kimseyi organization'a göre ayırma: logo organization varlığıdır
 */
router.post("/logo", auth, upload.single("logo"), async (req, res) => {
  try {
    const role = String(req.user?.role || "").toLowerCase();
    if (role === "ticari_user") {
      return res.status(403).json({ message: "ticari_user logo yükleyemez" });
    }

    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ message: "organizationId bulunamadı" });
    if (!req.file) return res.status(400).json({ message: "Dosya yok (logo)" });

    const logoUrl = `/uploads/org/${orgId}/${req.file.filename}`;

    const doc = await KurumsalKimlik.findOneAndUpdate(
      { organizationId: orgId },
      { $set: { logoUrl } },
      { new: true, upsert: true }
    ).lean();

    return res.json({ ok: true, logoUrl: doc.logoUrl, doc });
  } catch (err) {
    console.error("KurumsalKimlik LOGO POST hata:", err);
    return res.status(500).json({ error: "Sunucu hatası" });
  }
});

/**
 * ✅ GET /api/kurumsal-kimlik
 * - Her rolde okunabilsin
 */
router.get("/", auth, async (req, res) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      return res.status(400).json({
        message: "organizationId bulunamadı (token/DB organization eksik)",
      });
    }

    let doc = await KurumsalKimlik.findOne({ organizationId: orgId }).lean();
    if (!doc) {
      const created = await KurumsalKimlik.create({ organizationId: orgId });
      doc = created.toObject();
    }

    return res.json(doc);
  } catch (err) {
    console.error("KurumsalKimlik GET hata:", err);
    return res.status(500).json({ error: "Sunucu hatası" });
  }
});

/**
 * ✅ PUT /api/kurumsal-kimlik
 * - ticari_user güncelleyemesin (aynı mantık kalsın)
 */
router.put("/", auth, async (req, res) => {
  try {
    const role = String(req.user?.role || "").toLowerCase();
    if (role === "ticari_user") {
      return res.status(403).json({ message: "ticari_user kurumsal kimlik güncelleyemez" });
    }

    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ message: "organizationId bulunamadı" });

    const allowed = ["firmaAdi", "adres", "telefon", "email", "web", "logo", "logoUrl"];
    const patch = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) patch[k] = req.body[k];
    }

    const doc = await KurumsalKimlik.findOneAndUpdate(
      { organizationId: orgId },
      { $set: patch },
      { new: true, upsert: true }
    ).lean();

    return res.json(doc);
  } catch (err) {
    console.error("KurumsalKimlik PUT hata:", err);
    return res.status(500).json({ error: "Sunucu hatası" });
  }
});

module.exports = router;
