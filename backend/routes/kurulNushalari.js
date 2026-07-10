const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const KurulNushasi = require("../models/KurulNushasi");
const Document = require("../models/Document");

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, "..", "uploads", "kurul-nushalari");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function safeName(name = "") {
  return String(name)
    .replace(/[ğ]/g, "g")
    .replace(/[Ğ]/g, "G")
    .replace(/[ü]/g, "u")
    .replace(/[Ü]/g, "U")
    .replace(/[ş]/g, "s")
    .replace(/[Ş]/g, "S")
    .replace(/[ı]/g, "i")
    .replace(/[İ]/g, "I")
    .replace(/[ö]/g, "o")
    .replace(/[Ö]/g, "O")
    .replace(/[ç]/g, "c")
    .replace(/[Ç]/g, "C")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
}

function fixMulterTurkishName(name = "") {
  try {
    return Buffer.from(name, "latin1").toString("utf8");
  } catch {
    return name;
  }
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },

  filename: function (req, file, cb) {
    const fixedOriginalName = fixMulterTurkishName(file.originalname);
    const ext = path.extname(fixedOriginalName);
    const base = path.basename(fixedOriginalName, ext);

    cb(
      null,
      `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeName(base)}${ext}`
    );
  },
});

const upload = multer({
  storage,

  limits: {
    fileSize: 30 * 1024 * 1024,
    files: 30,
  },

  fileFilter: function (req, file, cb) {
    const allowed =
      file.mimetype === "application/pdf" || file.mimetype.startsWith("image/");

    if (!allowed) {
      return cb(new Error("Sadece PDF veya görsel dosyası yüklenebilir."));
    }

    cb(null, true);
  },
});

function getUserId(req) {
  return req.user?._id || req.user?.id || "";
}

function getOrganizationId(req, firmaId) {
  return (
    req.user?.organizationId ||
    req.user?.organization ||
    req.body.organizationId ||
    firmaId
  );
}

function fileUrl(fileName) {
  return `/uploads/kurul-nushalari/${fileName}`;
}

/* =========================================================
   LIST
========================================================= */

router.get("/", async (req, res) => {
  try {
    const { firmaId } = req.query;

    if (!firmaId) {
      return res.status(400).json({
        ok: false,
        message: "firmaId zorunludur.",
      });
    }

    const items = await KurulNushasi.find({
      firmaId: String(firmaId),
    })
      .sort({
        year: -1,
        month: -1,
      })
      .lean();

    return res.json({
      ok: true,
      items,
    });
  } catch (err) {
    console.error("Kurul nüshaları listeleme hatası:", err);

    return res.status(500).json({
      ok: false,
      message: "Kurul nüshaları alınamadı.",
    });
  }
});

/* =========================================================
   UPLOAD
========================================================= */

router.post("/upload", upload.array("files", 30), async (req, res) => {
  try {
    const {
  firmaId,
  firmaAdi,
  year,
  month,
  periodLabel,
  belgeAdi,
  kurulStartMonth,
  tehlikeSinifi,

  hazirlayan,
  hazirlayanAdSoyad,
  preparedBy,
  preparedByName,
  createdByName,
  createdByFullName,
  olusturan,
  olusturanAdSoyad,
} = req.body;

    if (!firmaId || !year || !month) {
      return res.status(400).json({
        ok: false,
        message: "firmaId, year ve month zorunludur.",
      });
    }

    if (!req.files || !req.files.length) {
      return res.status(400).json({
        ok: false,
        message: "Dosya seçilmedi.",
      });
    }

    const mappedFiles = req.files.map((file) => {
      const fixedOriginalName = fixMulterTurkishName(file.originalname);

      return {
        originalName: fixedOriginalName,
        fileName: file.filename,
        mimeType: file.mimetype,
        size: file.size,
        path: file.path,
        url: fileUrl(file.filename),
      };
    });

    const item = await KurulNushasi.findOneAndUpdate(
      {
        firmaId: String(firmaId),
        year: Number(year),
        month: Number(month),
      },
      {
        $setOnInsert: {
          firmaId: String(firmaId),
          userId: String(getUserId(req)),
          year: Number(year),
          month: Number(month),
        },

        $set: {
          firmaAdi: firmaAdi || "",
          periodLabel: periodLabel || "",
          kurulStartMonth: Number(kurulStartMonth || 1),
          tehlikeSinifi: tehlikeSinifi || "",
          savedToBelgelerim: false,
        },

        $push: {
          files: {
            $each: mappedFiles,
          },
        },
      },
      {
        new: true,
        upsert: true,
      }
    );

    return res.json({
      ok: true,
      item,
    });
  } catch (err) {
    console.error("Kurul yükleme hatası:", err);

    return res.status(500).json({
      ok: false,
      message: err.message || "Dosya yüklenemedi.",
    });
  }
});

/* =========================================================
   DELETE FILE
========================================================= */

router.delete("/file/:fileId", async (req, res) => {
  try {
    const { fileId } = req.params;

    const item = await KurulNushasi.findOne({
      "files._id": fileId,
    });

    if (!item) {
      return res.status(404).json({
        ok: false,
        message: "Dosya bulunamadı.",
      });
    }

    const file = item.files.id(fileId);

    if (file?.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    item.files.pull(fileId);

    if (!item.files.length) {
      item.savedToBelgelerim = false;
      item.belgelerimDocumentId = null;
    }

    await item.save();

    return res.json({
      ok: true,
      item,
    });
  } catch (err) {
    console.error("Kurul dosya silme hatası:", err);

    return res.status(500).json({
      ok: false,
      message: "Dosya silinemedi.",
    });
  }
});

/* =========================================================
   SAVE TO BELGELERIM
========================================================= */

router.post("/save-belgelerim", async (req, res) => {
  try {
    const {
  firmaId,
  firmaAdi,
  year,
  month,
  periodLabel,
  belgeAdi,
  kurulStartMonth,
  tehlikeSinifi,

  hazirlayan,
  hazirlayanAdSoyad,
  preparedBy,
  preparedByName,
  createdByName,
  createdByFullName,
  olusturan,
  olusturanAdSoyad,
} = req.body;

    if (!firmaId || !year || !month) {
      return res.status(400).json({
        ok: false,
        message: "firmaId, year ve month zorunludur.",
      });
    }

    const item = await KurulNushasi.findOne({
      firmaId: String(firmaId),
      year: Number(year),
      month: Number(month),
    });

    if (!item || !item.files.length) {
      return res.status(400).json({
        ok: false,
        message: "Bu dönem için kayıtlı dosya bulunamadı.",
      });
    }

    let documentId = item.belgelerimDocumentId;

let existingDocument = null;

if (documentId) {
  existingDocument = await Document.findById(documentId);
}

if (!existingDocument) {

      const firstFile = item.files[0];

      const organizationId = String(getOrganizationId(req, firmaId));
      const createdByUserId = String(getUserId(req));

      const createdBy =
  hazirlayan ||
  hazirlayanAdSoyad ||
  preparedBy ||
  preparedByName ||
  createdByName ||
  createdByFullName ||
  olusturan ||
  olusturanAdSoyad ||
  req.user?.name ||
  req.user?.fullName ||
  req.user?.adSoyad ||
  req.user?.email ||
  "";
      const title =
        belgeAdi || `${firmaAdi || item.firmaAdi} Kurul ${periodLabel}`;

      const doc = await Document.create({
        organizationId,

        firmaId: String(firmaId),
        firmaAdi: firmaAdi || item.firmaAdi || "",

        category: "defter-kurul",
        subCategory: "kurul-nushalari",

        title,
        year: Number(year),

        status: "hazir",

        createdBy,
        createdByUserId,

        belgeTuru: "Kurul Nüshaları",

        tarih: periodLabel || item.periodLabel || "",

        uniqueKey: `kurul-nushalari:${firmaId}:${year}:${month}`,

        hazirlayan: createdBy,

        dosyaTuru: "pdf-gorsel",

        dateISO: new Date().toISOString(),

        absoluteUrl: firstFile.url,

        fileName: firstFile.fileName,

        fileUrl: firstFile.url,

        storageType: "local",

        storagePath: firstFile.path,

        fileSize: firstFile.size || 0,

        data: {
          module: "kurul-nushalari",

          periodLabel: periodLabel || item.periodLabel,

          year: Number(year),
          month: Number(month),

          kurulStartMonth:
            Number(kurulStartMonth || item.kurulStartMonth || 1),

          tehlikeSinifi:
            tehlikeSinifi || item.tehlikeSinifi || "",

          files: item.files.map((f) => ({
            originalName: f.originalName,
            fileName: f.fileName,
            mimeType: f.mimeType,
            size: f.size,
            url: f.url,
            path: f.path,
          })),
        },
      });

      documentId = doc._id;
      existingDocument = doc;
    }

    item.savedToBelgelerim = true;
    item.belgelerimDocumentId = documentId;
    item.kurulStartMonth = Number(kurulStartMonth || item.kurulStartMonth || 1);
    item.tehlikeSinifi = tehlikeSinifi || item.tehlikeSinifi || "";

    await item.save();

    return res.json({
      ok: true,
      item,
      documentId,
    });
  } catch (err) {
    console.error("Kurul Belgelerim kayıt hatası:", err);

    return res.status(500).json({
      ok: false,
      message: err.message || "Belgelerim’e kaydedilemedi.",
    });
  }
});

module.exports = router;