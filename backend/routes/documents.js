const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const Document = require("../models/Document");
const FirmUser = require("../models/FirmUser");
const Firma = require("../models/Firma");
const auth = require("../middleware/auth");

/* ---------------- helpers ---------------- */
const roleOf = (u) => String(u?.role || "").toLowerCase().trim();
const isTicariAdmin = (u) => roleOf(u) === "ticari_admin";
const isTicariUser = (u) => roleOf(u) === "ticari_user";
const isBireysel = (u) => roleOf(u) === "bireysel";

function buildOrgIdCandidates(user) {
  return [
    user?.organizationId,
    user?.organizationUuid,
    user?._id,
    user?.id,
  ]
    .filter(Boolean)
    .map(String);
}

function requireOrg(req, res, next) {
  // ✅ auth middleware: organizationId (mongoId string) + organizationUuid (uuid string)
  const mongoId = req.user?.organizationId || null;
  const uuid = req.user?.organizationUuid || null;

  // ✅ bireysel kullanıcı için user id fallback
  const userId = req.user?._id || req.user?.id || null;

  if (!mongoId && !uuid && !userId) {
    return res.status(400).json({ message: "Organizasyon / kullanıcı bulunamadı" });
  }

  // ✅ Document.organizationId String olduğu için string candidate listesi
  req.orgIdCandidates = buildOrgIdCandidates(req.user);

  // ✅ FirmUser/Firma ObjectId istediği için
  req.orgObjectId =
    mongoId && mongoose.Types.ObjectId.isValid(String(mongoId))
      ? new mongoose.Types.ObjectId(String(mongoId))
      : null;

  next();
}

function requireTicariRole(req, res, next) {
  const user = req.user || {};
  const role = String(user.role || "").toLowerCase().trim();

  console.log("DOC REQUIRE ROLE DEBUG:", {
    userId: user._id || user.id,
    role,
    organizationId: user.organizationId,
    organizationUuid: user.organizationUuid,
    orgIdCandidates: req.orgIdCandidates,
    path: req.originalUrl,
  });

  if (
  role === "ticari_admin" ||
  role === "ticari_user" ||
  role === "admin" ||
  role === "super_admin" ||
  role === "superadmin" ||
  (role === "bireysel" && user.organizationId)
) {
  return next();
}

  return res.status(403).json({
    message: "Yetkisiz",
    debug: {
      role,
      organizationId: user.organizationId,
      organizationUuid: user.organizationUuid,
    },
  });
}

const EXTERNAL_STORAGE_ROOT =
  process.env.EXTERNAL_STORAGE_ROOT ||
  path.join(__dirname, "..", "archive-storage");

const EXTERNAL_DOCUMENTS_DIR = path.join(EXTERNAL_STORAGE_ROOT, "documents");

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function sanitizeFileName(name) {
  return String(name || "file.pdf")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, " ")
    .trim();
}

function getRawDocumentFileUrl(doc) {
  return (
    doc?.fileUrl ||
    doc?.absoluteUrl ||
    doc?.data?.fileUrl ||
    doc?.data?.absoluteUrl ||
    doc?.url ||
    doc?.pdfUrl ||
    doc?.downloadUrl ||
    ""
  );
}

function resolveLocalDocumentAbsolutePath(doc) {
  const rawFileUrl = String(getRawDocumentFileUrl(doc) || "").trim();
  if (!rawFileUrl) return "";

  let normalizedFileUrl = rawFileUrl;

  if (
    normalizedFileUrl.startsWith("http://") ||
    normalizedFileUrl.startsWith("https://")
  ) {
    try {
      const u = new URL(normalizedFileUrl);
      normalizedFileUrl = u.pathname || "";
    } catch {
      return "";
    }
  }

  if (normalizedFileUrl.startsWith("/output/")) {
    return path.join(
      __dirname,
      "..",
      "..",
      normalizedFileUrl.replace(/^\/+/, "")
    );
  }

  if (normalizedFileUrl.startsWith("/uploads/")) {
    return path.join(
      __dirname,
      "..",
      normalizedFileUrl.replace(/^\/+/, "")
    );
  }

  return "";
}

function buildExternalStoredFileName(doc, sourceAbsPath) {
  const ext = path.extname(sourceAbsPath || doc?.fileName || ".pdf") || ".pdf";
  const safeTitle = sanitizeFileName(doc?.title || doc?.fileName || "belge");
  const safeFirma = sanitizeFileName(doc?.firmaAdi || "Firma");
  const safeId = String(doc?._id || Date.now());
  return `${safeFirma} - ${safeTitle} - ${safeId}${ext}`;
}

const docsStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "..", "uploads", "documents");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || ".pdf") || ".pdf";
    const name = `${Date.now()}_${Math.random().toString(16).slice(2)}${ext}`;
    cb(null, dirSafeName(name));
  },
});

function dirSafeName(name) {
  return String(name || "file.pdf").replace(/[\\/:*?"<>|]+/g, "_");
}

const uploadPdf = multer({
  storage: docsStorage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const mime = String(file.mimetype || "").toLowerCase();

    if (mime === "application/pdf" || ext === ".pdf") {
      return cb(null, true);
    }

    return cb(new Error("Sadece PDF dosyası yüklenebilir"));
  },
});

router.post("/upload-pdf", auth, (req, res) => {
  uploadPdf.single("file")(req, res, async (err) => {
    try {
      if (err) {
        console.error("UPLOAD_PDF multer hata:", err);

        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            message: "PDF boyutu çok büyük. Maksimum dosya boyutu 100 MB.",
            error: err.message,
            code: err.code,
          });
        }

        return res.status(400).json({
          message: "PDF yükleme hatası",
          error: err.message,
          code: err.code || "",
        });
      }

      console.log("UPLOAD_PDF req.file:", req.file);

      if (!req.file) {
        return res.status(400).json({ message: "PDF dosyası bulunamadı" });
      }

      const relPath = `/uploads/documents/${req.file.filename}`;
      const base =
        process.env.PUBLIC_BASE_URL ||
        `${req.protocol}://${req.get("host")}`;

      return res.status(201).json({
        ok: true,
        fileUrl: relPath,
        absoluteUrl: `${base}${relPath}`,
        fileName: req.file.originalname || req.file.filename,
      });
    } catch (err2) {
      console.error("UPLOAD_PDF genel hata:", err2);
      return res.status(500).json({
        message: "PDF yüklenemedi",
        error: err2?.message,
      });
    }
  });
});

/* ---------------- routes ---------------- */

/**
 * ✅ POST /api/documents
 * Belgelerime kaydet
 * - ticari: org id kullanır
 * - bireysel: user id fallback kullanır
 */
router.post("/", auth, async (req, res) => {
  try {
    const raw = { ...(req.body || {}) };
    const user = req.user || {};
    const userId = String(user?._id || user?.id || "");
    const ownerId =
      user?.organizationId ||
      user?.organizationUuid ||
      user?._id ||
      user?.id;

    if (!ownerId) {
      return res.status(400).json({ message: "Organizasyon / kullanıcı bulunamadı" });
    }

    const body = {
      // ✅ temel alanlar
      firmaId: raw.firmaId ? String(raw.firmaId) : "",
      firmaAdi: raw.firmaAdi ? String(raw.firmaAdi) : "",
      category: raw.category ? String(raw.category) : "",
      subCategory: raw.subCategory ? String(raw.subCategory) : "",
      title: raw.title ? String(raw.title) : "",
      year: raw.year ? Number(raw.year) : undefined,
      status: raw.status ? String(raw.status) : "hazir",

      // ✅ kritik alanlar
      tarih: raw.tarih ? String(raw.tarih) : "",
      uniqueKey: raw.uniqueKey ? String(raw.uniqueKey) : "",

      // ✅ oluşturan
      createdBy: raw.createdBy ? String(raw.createdBy) : "",
      createdByUserId: userId, // ✅ KRİTİK DÜZELTME: backend zorunlu set eder
      hazirlayan: raw.hazirlayan ? String(raw.hazirlayan) : "",

      // ✅ belge detayları
      belgeTuru: raw.belgeTuru ? String(raw.belgeTuru) : "",
      personName: raw.personName ? String(raw.personName) : "",
      dateISO: raw.dateISO ? String(raw.dateISO) : "",
      baslangicTarihi: raw.baslangicTarihi ? String(raw.baslangicTarihi) : "",
      bitisTarihi: raw.bitisTarihi ? String(raw.bitisTarihi) : "",
      gecerlilik:
  raw.gecerlilik ||
  raw.bitisTarihi ||
  raw.sonGecerlilikTarihi ||
  raw.acilDurumGecerlilikTarihi ||
  raw.data?.gecerlilik ||
  raw.data?.bitisTarihi ||
  raw.data?.payload?.gecerlilik ||
  raw.data?.payload?.bitisTarihi ||
  "",

      // ✅ dosya alanları
      fileUrl: raw.fileUrl ? String(raw.fileUrl) : "",
      absoluteUrl: raw.absoluteUrl ? String(raw.absoluteUrl) : "",
      fileName: raw.fileName ? String(raw.fileName) : "",
      dosyaTuru: raw.dosyaTuru ? String(raw.dosyaTuru) : "",
      data: raw.data ?? null,
    };

    // ✅ güvenlik: owner her zaman server’dan
    body.organizationId = String(ownerId);

    if (!body.firmaId) {
      return res.status(400).json({ message: "firmaId zorunlu" });
    }
    if (!body.firmaAdi) {
      return res.status(400).json({ message: "firmaAdi zorunlu" });
    }
    if (!body.category) {
      return res.status(400).json({ message: "category zorunlu" });
    }
    if (!body.subCategory) {
      return res.status(400).json({ message: "subCategory zorunlu" });
    }
    if (!body.title) {
      return res.status(400).json({ message: "title zorunlu" });
    }

    // 🔒 DUPLICATE ENGEL
    try {
      let doc = null;

      if (body.uniqueKey) {
        doc = await Document.findOneAndUpdate(
          {
            organizationId: body.organizationId,
            uniqueKey: body.uniqueKey,
          },
          {
            $setOnInsert: body,
          },
          {
            new: true,
            upsert: true,
            rawResult: true,
          }
        );

        if (doc?.lastErrorObject?.updatedExisting) {
          return res.status(200).json({
            message: "Belge zaten mevcut",
            existingId: doc?.value?._id,
            doc: doc?.value,
          });
        }

        return res.status(201).json(doc?.value);
      }

      const existing = await Document.findOne({
        organizationId: body.organizationId,
        firmaId: body.firmaId,
        category: body.category,
        subCategory: body.subCategory,
        title: body.title,
        tarih: body.tarih,
      });

      if (existing) {
        return res.status(200).json({
          message: "Belge zaten mevcut",
          existingId: existing._id,
          doc: existing,
        });
      }

      console.log("POST /documents body:", body);

const created = await Document.create(body);

console.log("POST /documents created:", {
  _id: created?._id,
  organizationId: created?.organizationId,
  firmaId: created?.firmaId,
  category: created?.category,
  subCategory: created?.subCategory,
  belgeTuru: created?.belgeTuru,
  title: created?.title,
  fileUrl: created?.fileUrl,
});

return res.status(201).json(created);
    } catch (err) {
      if (err?.code === 11000) {
        const existing = await Document.findOne({
          organizationId: body.organizationId,
          uniqueKey: body.uniqueKey,
        });

        return res.status(200).json({
          message: "Belge zaten mevcut",
          existingId: existing?._id,
          doc: existing || null,
        });
      }

      return res.status(500).json({
        message: "Belge kaydedilemedi",
        error: err?.message,
      });
    }
  } catch (err) {
    return res.status(500).json({
      message: "Belge kaydedilemedi",
      error: err?.message,
    });
  }
});

/**
 * ✅ GET /api/documents
 * - ticari: org içi liste
 * - bireysel: sadece kendi oluşturduğu belgeler
 */
router.get("/", auth, async (req, res) => {
  try {
    const { firmaId, category, status, subCategory, personName } = req.query;

    const user = req.user || {};
    const role = String(user?.role || "").toLowerCase().trim();
    const bireyselMi = role === "bireysel";

    let filter = {};

    if (bireyselMi) {
      const userId = String(user?._id || user?.id || "");

      if (!userId) {
        return res.status(400).json({
          message: "Kullanıcı bilgisi bulunamadı",
        });
      }

      // ✅ KRİTİK DÜZELTME:
      // yeni kayıtlar createdByUserId ile,
      // eski kayıtlar organizationId=userId mantığıyla bulunabilsin
      filter = {
        $or: [
          { createdByUserId: userId },
          { organizationId: userId },
        ],
      };
    } else {
      const orgIdCandidates = buildOrgIdCandidates(user);

      if (!Array.isArray(orgIdCandidates) || orgIdCandidates.length === 0) {
        return res.json([]);
      }

      // ✅ ticari taraf mevcut mantıkla organization bazlı çalışsın
      filter = {
        organizationId: { $in: orgIdCandidates },
      };
    }

    if (firmaId) filter.firmaId = String(firmaId);
    if (category) filter.category = String(category);
    if (status) filter.status = String(status);
    if (subCategory) filter.subCategory = String(subCategory);
    if (personName) filter.personName = String(personName);

    const docs = await Document.find(filter).sort({ createdAt: -1 });

console.log("GET /documents filter:", filter);
console.log(
  "GET /documents docs:",
  docs.map((d) => ({
    _id: d?._id,
    organizationId: d?.organizationId,
    firmaId: d?.firmaId,
    category: d?.category,
    subCategory: d?.subCategory,
    belgeTuru: d?.belgeTuru,
    title: d?.title,
  }))
);

    // ✅ ekstra güvenlik: aynı belge iki farklı eski kayıt yüzünden geldiyse tekilleştir
    const seen = new Set();
    const uniqueDocs = docs.filter((doc) => {
      const key =
        String(doc?.uniqueKey || "").trim() ||
        [
          String(doc?.organizationId || "").trim(),
          String(doc?.createdByUserId || "").trim(),
          String(doc?.firmaId || "").trim(),
          String(doc?.category || "").trim(),
          String(doc?.subCategory || "").trim(),
          String(doc?.title || "").trim(),
          String(doc?.tarih || "").trim(),
          String(doc?.fileUrl || "").trim(),
        ].join("::");

      if (!key) return true;
      if (seen.has(key)) return false;

      seen.add(key);
      return true;
    });

    return res.json(uniqueDocs);
  } catch (err) {
    return res.status(500).json({
      message: "Belgeler çekilemedi",
      error: err?.message,
    });
  }
});

/**
 * ✅ GET /api/documents/assigned
 * Ticari user’a atanmış firmaların belgeleri
 */
router.get("/assigned", auth, requireOrg, async (req, res) => {
  try {
    const user = req.user;
    if (!isTicariUser(user)) {
      return res.status(403).json({ message: "Bu endpoint ticari_user içindir." });
    }

    const { category, status, subCategory, personName } = req.query;

    // ✅ atama modelleri ObjectId ile çalışıyor -> orgObjectId şart
    if (!req.orgObjectId) return res.json([]);

    const rawUserId = req.user?._id || req.user?.id;
    const userObjectId =
      rawUserId && mongoose.Types.ObjectId.isValid(String(rawUserId))
        ? new mongoose.Types.ObjectId(String(rawUserId))
        : null;

    if (!userObjectId) return res.json([]);

    // ✅ 1) Atanan firmaları al
    const links = await FirmUser.find({
      organization: req.orgObjectId,
      userId: userObjectId,
      isActive: true,
    })
      .select("firmId")
      .lean();

    const firmObjectIds = links.map((x) => x.firmId).filter(Boolean);
    if (firmObjectIds.length === 0) return res.json([]);

    // ✅ 2) Güvenlik: sadece bu org firmaları
    const firms = await Firma.find({
      _id: { $in: firmObjectIds },
      organization: req.orgObjectId,
    })
      .select("_id firmaAdi")
      .lean();

    const firmIds = firms.map((f) => String(f._id)).filter(Boolean);
    if (firmIds.length === 0) return res.json([]);

    const firmNames = firms
      .map((f) => String(f.firmaAdi || "").trim())
      .filter(Boolean);

    // ✅ 3) Belgeler: firmaId String olduğu için string listesi yeter
    const filter = {
      organizationId: { $in: req.orgIdCandidates },
      $or: [
        { firmaId: { $in: firmIds } },
        ...(firmNames.length ? [{ firmaAdi: { $in: firmNames } }] : []),
      ],
    };

    if (category) filter.category = String(category);
    if (status) filter.status = String(status);
    if (subCategory) filter.subCategory = String(subCategory);
    if (personName) filter.personName = String(personName);

    const docs = await Document.find(filter).sort({ createdAt: -1 });
    return res.json(docs);
  } catch (err) {
    return res.status(500).json({
      message: "Atanmış firma belgeleri çekilemedi",
      error: err?.message,
    });
  }
});

/**
 * ✅ GET /api/documents/admin
 * Geriye dönük uyumluluk
 */
router.get("/admin", auth, requireOrg, async (req, res) => {
  try {
    const { firmaId, category, status, subCategory, personName } = req.query;

    const filter = {
      organizationId: { $in: req.orgIdCandidates },
    };

    if (firmaId) filter.firmaId = String(firmaId);
    if (category) filter.category = String(category);
    if (status) filter.status = String(status);
    if (subCategory) filter.subCategory = String(subCategory);
    if (personName) filter.personName = String(personName);

    const docs = await Document.find(filter).sort({ createdAt: -1 });
    return res.json(docs);
  } catch (err) {
    return res.status(500).json({
      message: "Admin belgeler çekilemedi",
      error: err?.message,
    });
  }
});

/**
 * ✅ PATCH /api/documents/:id/status
 */
router.patch("/:id/status", auth, requireOrg, requireTicariRole, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(String(id))) {
      return res.status(400).json({ message: "Geçersiz id" });
    }
    if (!status) return res.status(400).json({ message: "status zorunlu" });

    const updated = await Document.findOneAndUpdate(
      { _id: id, organizationId: { $in: req.orgIdCandidates } },
      { status },
      { new: true }
    );

    if (!updated) return res.status(404).json({ message: "Belge bulunamadı" });
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({
      message: "Belge durumu güncellenemedi",
      error: err?.message,
    });
  }
});

/**
 * ✅ PATCH /api/documents/:id
 * uyumluluk: durum -> status
 */
router.patch("/:id", auth, requireOrg, requireTicariRole, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(String(id))) {
      return res.status(400).json({ message: "Geçersiz id" });
    }

    const body = req.body || {};

    const nextStatus =
      body.status ||
      (body.durum === "Arşivde" ? "arsiv" : body.durum === "Hazır" ? "hazir" : undefined);

    const updateData = {};

    if (nextStatus) updateData.status = nextStatus;
    if (Object.prototype.hasOwnProperty.call(body, "data")) updateData.data = body.data;

    if (body.firmaId !== undefined) updateData.firmaId = String(body.firmaId || "");
    if (body.firmaAdi !== undefined) updateData.firmaAdi = String(body.firmaAdi || "");
    if (body.category !== undefined) updateData.category = String(body.category || "");
    if (body.subCategory !== undefined) updateData.subCategory = String(body.subCategory || "");
    if (body.title !== undefined) updateData.title = String(body.title || "");
    if (body.year !== undefined) updateData.year = body.year ? Number(body.year) : undefined;
    if (body.createdBy !== undefined) updateData.createdBy = String(body.createdBy || "");
    if (body.createdByUserId !== undefined) updateData.createdByUserId = String(body.createdByUserId || "");
       if (body.storageType !== undefined) updateData.storageType = String(body.storageType || "");
    if (body.storagePath !== undefined) updateData.storagePath = String(body.storagePath || "");
    if (body.externalProvider !== undefined) updateData.externalProvider = String(body.externalProvider || "");
    if (body.archivedAt !== undefined) updateData.archivedAt = body.archivedAt || null;
    if (body.fileSize !== undefined) updateData.fileSize = Number(body.fileSize || 0);
    if (body.checksum !== undefined) updateData.checksum = String(body.checksum || "");

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: "Güncellenecek alan bulunamadı" });
    }

    const updated = await Document.findOneAndUpdate(
      { _id: id, organizationId: { $in: req.orgIdCandidates } },
      updateData,
      { new: true }
    );

    if (!updated) return res.status(404).json({ message: "Belge bulunamadı" });
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({
      message: "Belge güncellenemedi",
      error: err?.message,
    });
  }
});

/**
 * ✅ GET /api/documents/:id/download
 * Belgeyi indir
 * - local ise mevcut diskten verir
 * - external ise şimdilik storagePath/external url üzerinden yönlenmeye hazırdır
 */
router.get("/:id/download", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(String(id))) {
      return res.status(400).json({ message: "Geçersiz id" });
    }

    const doc = await Document.findById(id).lean();

    if (!doc) {
      return res.status(404).json({ message: "Belge bulunamadı" });
    }

    console.log("DOWNLOAD DOC:", {
      id: doc?._id,
      title: doc?.title,
      storageType: doc?.storageType,
      storagePath: doc?.storagePath,
      externalProvider: doc?.externalProvider,
      fileUrl: doc?.fileUrl,
      absoluteUrl: doc?.absoluteUrl,
      dataFileUrl: doc?.data?.fileUrl,
      dataAbsoluteUrl: doc?.data?.absoluteUrl,
    });

    const baseName =
      String(doc.fileName || doc.title || "belge")
        .replace(/[\\/:*?"<>|]+/g, " ")
        .replace(/\s+/g, " ")
        .trim() || "belge";

    const safeName = baseName.toLowerCase().endsWith(".pdf")
      ? baseName
      : `${baseName}.pdf`;

    // ✅ 1) Önce yeni storage mantığına bak
    const storageType = String(doc?.storageType || "local").trim().toLowerCase();

    // -------------------------------------------------
    // ✅ LOCAL DOSYA AKIŞI
    // -------------------------------------------------
    if (storageType === "local") {
      const rawFileUrl =
        doc.fileUrl ||
        doc.absoluteUrl ||
        doc.data?.fileUrl ||
        doc.data?.absoluteUrl ||
        doc.url ||
        doc.pdfUrl ||
        doc.downloadUrl ||
        "";

      if (!rawFileUrl) {
        return res.status(404).json({
          message: "Dosya URL'si bulunamadı",
          debug: {
            id: doc?._id,
            storageType,
            fileUrl: doc?.fileUrl,
            absoluteUrl: doc?.absoluteUrl,
            dataFileUrl: doc?.data?.fileUrl,
            dataAbsoluteUrl: doc?.data?.absoluteUrl,
          },
        });
      }

      let absPath = "";
      let normalizedFileUrl = String(rawFileUrl || "").trim();

      if (
        normalizedFileUrl.startsWith("http://") ||
        normalizedFileUrl.startsWith("https://")
      ) {
        try {
          const u = new URL(normalizedFileUrl);
          normalizedFileUrl = u.pathname || "";
        } catch {
          return res.status(400).json({ message: "Geçersiz dosya URL'si" });
        }
      }

      if (normalizedFileUrl.startsWith("/output/")) {
        absPath = path.join(
          __dirname,
          "..",
          "..",
          normalizedFileUrl.replace(/^\/+/, "")
        );
      } else if (normalizedFileUrl.startsWith("/uploads/")) {
        absPath = path.join(
          __dirname,
          "..",
          normalizedFileUrl.replace(/^\/+/, "")
        );
      } else {
        return res.status(400).json({ message: "Desteklenmeyen dosya yolu" });
      }

      if (!fs.existsSync(absPath)) {
        return res.status(404).json({ message: "Dosya sunucuda bulunamadı" });
      }

      const stat = fs.statSync(absPath);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(safeName)}"`
      );
      res.setHeader("Content-Length", stat.size);

      const stream = fs.createReadStream(absPath);
      return stream.pipe(res);
    }

    // -------------------------------------------------
    // ✅ EXTERNAL DOSYA AKIŞI
    // Şimdilik güvenli hazırlık:
    // - storagePath varsa oradan ilerleyeceğiz
    // - henüz Hetzner entegrasyonu yapılmadıysa hata dönecek
    // -------------------------------------------------
       if (storageType === "external") {
      const externalPath = String(doc?.storagePath || "").trim();

      if (!externalPath) {
        return res.status(404).json({
          message: "Harici depolama yolu bulunamadı",
          debug: {
            id: doc?._id,
            storageType,
            storagePath: doc?.storagePath,
          },
        });
      }

      let externalAbsPath = "";

      if (path.isAbsolute(externalPath)) {
        externalAbsPath = externalPath;
      } else if (externalPath.startsWith("/archive-storage/")) {
        externalAbsPath = path.join(
          __dirname,
          "..",
          externalPath.replace(/^\/+/, "")
        );
      } else {
        return res.status(400).json({
          message: "Desteklenmeyen harici depolama yolu",
          storagePath: externalPath,
        });
      }

      if (!fs.existsSync(externalAbsPath)) {
        return res.status(404).json({
          message: "Harici depodaki dosya bulunamadı",
          externalAbsPath,
        });
      }

      const stat = fs.statSync(externalAbsPath);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(safeName)}"`
      );
      res.setHeader("Content-Length", stat.size);

      const stream = fs.createReadStream(externalAbsPath);
      return stream.pipe(res);
    }

    return res.status(400).json({
      message: "Geçersiz storageType",
      storageType: doc?.storageType,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Belge indirilemedi",
      error: err?.message,
    });
  }
});

/**
 * ✅ POST /api/documents/:id/move-to-external
 * Local belgeyi test amaçlı harici depoya taşır
 */
router.post("/:id/move-to-external", auth, requireOrg, requireTicariRole, async (req, res) => {
  try {
    const { id } = req.params;
    const { deleteLocalAfterMove = true } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(String(id))) {
      return res.status(400).json({ message: "Geçersiz id" });
    }

    const doc = await Document.findOne({
      _id: id,
      organizationId: { $in: req.orgIdCandidates },
    });

    if (!doc) {
      return res.status(404).json({ message: "Belge bulunamadı" });
    }

    const currentStorageType = String(doc.storageType || "local").trim().toLowerCase();

    if (currentStorageType === "external") {
      return res.status(200).json({
        message: "Belge zaten harici depoda",
        doc,
      });
    }

    const localAbsPath = resolveLocalDocumentAbsolutePath(doc);

    if (!localAbsPath) {
      return res.status(400).json({
        message: "Local dosya yolu çözümlenemedi",
        debug: {
          fileUrl: doc.fileUrl,
          absoluteUrl: doc.absoluteUrl,
          dataFileUrl: doc.data?.fileUrl,
          dataAbsoluteUrl: doc.data?.absoluteUrl,
        },
      });
    }

    if (!fs.existsSync(localAbsPath)) {
      return res.status(404).json({
        message: "Taşınacak local dosya sunucuda bulunamadı",
        localAbsPath,
      });
    }

    ensureDir(EXTERNAL_DOCUMENTS_DIR);

    const targetFileName = buildExternalStoredFileName(doc, localAbsPath);
    const targetAbsPath = path.join(EXTERNAL_DOCUMENTS_DIR, targetFileName);

    fs.copyFileSync(localAbsPath, targetAbsPath);

    if (!fs.existsSync(targetAbsPath)) {
      return res.status(500).json({
        message: "Dosya harici depoya kopyalanamadı",
      });
    }

    const stat = fs.statSync(targetAbsPath);

    doc.storageType = "external";
    doc.storagePath = `/archive-storage/documents/${targetFileName}`;
    doc.externalProvider = "local-archive-test";
    doc.archivedAt = new Date();
    doc.fileSize = stat.size || 0;

    await doc.save();

    if (deleteLocalAfterMove) {
      try {
        fs.unlinkSync(localAbsPath);
      } catch (deleteErr) {
        console.error("Local dosya silinemedi:", deleteErr);
      }
    }

    return res.json({
      ok: true,
      message: "Belge harici depoya taşındı",
      doc,
      moved: {
        from: localAbsPath,
        to: targetAbsPath,
        deleteLocalAfterMove: !!deleteLocalAfterMove,
      },
    });
  } catch (err) {
    return res.status(500).json({
      message: "Belge harici depoya taşınamadı",
      error: err?.message,
    });
  }
});

/**
 * ✅ DELETE /api/documents/:id
 * Silme
 * - ticari_admin: org içinden silebilir
 * - bireysel: kendi belgesini silebilir
 */

router.delete("/:id", auth, requireOrg, async (req, res) => {
  try {
    const user = req.user || {};
    const isDemoUser = !!user?.demo;

    // ✅ ticari admin, bireysel ve demo kullanıcı silebilsin
    if (!(isTicariAdmin(user) || isBireysel(user) || isDemoUser)) {
      return res.status(403).json({ message: "Yetkisiz" });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(String(id))) {
      return res.status(400).json({ message: "Geçersiz id" });
    }

    let deleteFilter = { _id: id };

    // ✅ bireysel + demo kullanıcı kendi belgesini silebilsin
    if (isBireysel(user) || isDemoUser) {
      const userId = String(user?._id || user?.id || "");

      deleteFilter = {
        _id: id,
        $or: [
          { createdByUserId: userId },
          { organizationId: userId },
        ],
      };
    } else {
      // ✅ ticari admin organization içinden silebilsin
      deleteFilter = {
        _id: id,
        organizationId: { $in: req.orgIdCandidates },
      };
    }

    const deleted = await Document.findOneAndDelete(deleteFilter);

    if (!deleted) {
      return res.status(404).json({ message: "Belge bulunamadı" });
    }

    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({
      message: "Belge silinemedi",
      error: err?.message,
    });
  }
});


module.exports = router;
