const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const multer = require("multer");
const zlib = require("zlib");
const router = express.Router();

const User = require("../models/User");
const Firma = require("../models/Firma");

let FirmUser = null;
try {
  // eslint-disable-next-line global-require
  FirmUser = require("../models/FirmUser");
} catch (_) {
  FirmUser = null;
}

/** ✅ EKLENDİ: createNotification güvenli require (mevcut kod bozulmasın) */
function safeRequire(paths) {
  for (const p of paths) {
    try {
      // eslint-disable-next-line import/no-dynamic-require, global-require
      return require(p);
    } catch (_) {}
  }
  return null;
}

const { createNotification } =
  safeRequire([
    "../services/notificationService",
    "../services/notificationService.js",
    "./services/notificationService",
    "./services/notificationService.js",

    // ✅ projede farklı klasör isimleri olabiliyor (organizationUsers.js ile aynı yedekler)
    "./services/notification/notificationService",
    "./services/notification/notificationService.js",
    "./services/notifications/notificationService",
    "./services/notifications/notificationService.js",
    "../services/notification/notificationService",
    "../services/notification/notificationService.js",
    "../services/notifications/notificationService",
    "../services/notifications/notificationService.js",
  ]) || {};

// ✅ NEW: Job enqueue (bağımsız)
const {
  enqueueFirmAssigned,
  enqueueFirmRemoved,
} = require("../jobs/firmAssignmentNotificationJob");

// -------------------- AUTH
async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Token yok" });

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({
        message: "JWT_SECRET tanımlı değil. .env içine JWT_SECRET ekleyin.",
      });
    }

    const decoded = jwt.verify(token, secret);
    const userId = decoded.id || decoded.userId || decoded._id;
    if (!userId) return res.status(401).json({ message: "Token userId yok" });

    const user = await User.findById(userId).lean();
    if (!user) return res.status(401).json({ message: "Kullanıcı bulunamadı" });

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Geçersiz token" });
  }
}

const roleOf = (u) => String(u?.role || "").toLowerCase().trim();
const isAdmin = (u) => roleOf(u) === "ticari_admin";
const isTicariUser = (u) => roleOf(u) === "ticari_user";
const isBireysel = (u) => {
  const role = roleOf(u);
  return role === "bireysel" || role === "uzman";
};
const getOrgId = (req) => req.user?.organization || req.user?.organizationId || null;
const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
});

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeHazard(value) {
  const text = String(value || "").toLocaleUpperCase("tr-TR");
  if (text.includes("ÇOK") || text.includes("COK")) return "Çok Tehlikeli";
  if (text.includes("AZ")) return "Az Tehlikeli";
  if (text.includes("TEHLİKELİ") || text.includes("TEHLIKELI")) return "Tehlikeli";
  return "";
}

function parseDateInput(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const text = String(value).trim();
  const dot = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dot) {
    const d = new Date(Number(dot[3]), Number(dot[2]) - 1, Number(dot[1]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(text);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toDateOnly(value) {
  const d = parseDateInput(value);
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function computeValidityDate(hazirlama, tehlike) {
  const d = parseDateInput(hazirlama);
  if (!d) return null;
  const hazard = normalizeHazard(tehlike) || tehlike;
  const years = hazard === "Az Tehlikeli" ? 6 : hazard === "Tehlikeli" ? 4 : 2;
  d.setFullYear(d.getFullYear() + years);
  return d;
}

function firmScopeFilter(user) {
  if (isAdmin(user) || isTicariUser(user)) {
    const orgId = user?.organization || user?.organizationId || null;
    return orgId ? { organization: orgId } : null;
  }
  if (isBireysel(user)) return { userId: user._id };
  return null;
}

async function findDuplicateFirma(user, sgkNo, excludeId = null) {
  const normalized = digitsOnly(sgkNo);
  if (!normalized) return null;
  const scope = firmScopeFilter(user);
  if (!scope) return null;
  const query = { ...scope, sgkNo: normalized };
  if (excludeId) query._id = { $ne: excludeId };
  return Firma.findOne(query).lean();
}

function decodePdfLiteralString(value) {
  return String(value || "")
    .replace(/\\([nrtbf()\\])/g, (_, c) => {
      const map = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", "(": "(", ")": ")", "\\": "\\" };
      return map[c] || c;
    })
    .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
}

function extractPdfText(buffer) {
  const raw = Buffer.isBuffer(buffer) ? buffer.toString("latin1") : "";
  const chunks = [];
  const streamRe = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match;

  while ((match = streamRe.exec(raw))) {
    let text = "";
    try {
      text = zlib.inflateSync(Buffer.from(match[1], "latin1")).toString("utf8");
    } catch (_) {
      try {
        text = Buffer.from(match[1], "latin1").toString("utf8");
      } catch (_) {
        text = "";
      }
    }

    if (!text) continue;
    for (const s of text.matchAll(/\((?:\\.|[^\\)])*\)/g)) {
      const decoded = normalizeText(decodePdfLiteralString(s[0].slice(1, -1)));
      if (/[A-Za-z0-9ĞÜŞİÖÇğüşiöç]/.test(decoded)) chunks.push(decoded);
    }
  }

  const direct = raw
    .replace(/[^\x20-\x7EĞÜŞİÖÇğüşiöçİı]/g, " ")
    .replace(/\s+/g, " ");
  return normalizeText(`${chunks.join(" ")} ${direct}`);
}

function pickAfterLabel(text, labels, stopLabels = []) {
  const source = normalizeText(text);
  const stops = stopLabels.length
    ? `(?=${stopLabels.map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")}|$)`
    : "$";
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`${escaped}\\s*[:\\-]?\\s*(.*?)\\s*${stops}`, "i");
    const m = source.match(re);
    if (m?.[1]) return normalizeText(m[1]);
  }
  return "";
}

function parseIskatipPdf(buffer) {
  const text = extractPdfText(buffer);
  const labels = [
    "Hizmet Alan İşyeri Unvanı",
    "Hizmet Alan İşyeri SGK / DETSİS No",
    "Hizmet Alan İşyeri Adresi",
    "Hizmet Alan İşyeri İli",
    "Güncel Çalışan Sayısı",
    "Güncel Tehlike Sınıfı",
    "Sözleşme Onay Tarihi",
  ];
  const firmName = pickAfterLabel(text, ["Hizmet Alan İşyeri Unvanı", "Hizmet Alan Isyeri Unvani"], labels);
  const sgkRaw = pickAfterLabel(text, ["Hizmet Alan İşyeri SGK / DETSİS No", "Hizmet Alan Isyeri SGK / DETSIS No", "SGK / DETSİS No"], labels);
  const adres = pickAfterLabel(text, ["Hizmet Alan İşyeri Adresi", "Hizmet Alan Isyeri Adresi"], labels);
  const il = pickAfterLabel(text, ["Hizmet Alan İşyeri İli", "Hizmet Alan Isyeri Ili"], labels);
  const countRaw = pickAfterLabel(text, ["Güncel Çalışan Sayısı", "Guncel Calisan Sayisi"], labels);
  const hazardRaw = pickAfterLabel(text, ["Güncel Tehlike Sınıfı", "Guncel Tehlike Sinifi"], labels);
  const dateRaw = pickAfterLabel(text, ["Sözleşme Onay Tarihi", "Sozlesme Onay Tarihi"], labels);
  const tehlike = normalizeHazard(hazardRaw);
  const hazirlama = toDateOnly(dateRaw);

  return {
    firmaAdi: firmName,
    sgkSicilNo: digitsOnly(sgkRaw),
    sgkNo: digitsOnly(sgkRaw),
    adres,
    il,
    calisanSayisi: Number(digitsOnly(countRaw)) || "",
    tehlike,
    hazirlama,
    gecerlilik: hazirlama && tehlike ? toDateOnly(computeValidityDate(hazirlama, tehlike)) : "",
  };
}

// ✅ payload seçici (NACE + FAALİYET + TARİHLER DAHİL)
function pickFirmaFields(body) {
  const b = body || {};
  return {
    firmaAdi: b.firmaAdi,
    sgkNo: b.sgkNo ?? b.sgkSicilNo,

    // tarih
    hazirlama: b.hazirlama ?? b.hazirlamaTarihi ?? b.hazirlamaTarih,
    gecerlilik: b.gecerlilik ?? b.gecerlilikTarihi ?? b.gecerlilikTarih,

    adres: b.adres,
    il: b.il,
    calisanSayisi:
      b.calisanSayisi ?? b.calisanSayisiGuncel ?? b.guncelCalisanSayisi,
    telefon: b.telefon,
    sektor: b.sektor,

    // ✅ asıl eksik olanlar
    nace: b.nace ?? b.naceKodu ?? b.naceKod ?? b.naceCode,
    faaliyet: b.faaliyet ?? b.faaliyetAlani ?? b.faaliyetAdi ?? b.activity,

    tehlike: b.tehlike,
    durum: b.durum,
  };
}

// ✅ GET tarafı normalize (SORUNU KÖKTEN BİTİREN YER)
function normalizeFirmaOut(f) {
  if (!f) return f;

  const resolvedLogo =
    f?.kurumsal?.logoUrl ||
    f?.kurumsal?.logo ||
    f?.kurumsal?.logoPath ||
    f?.kurumsal?.firmaLogo ||
    f?.logoUrl ||
    f?.logo ||
    f?.logoPath ||
    f?.firmaLogo ||
    "";

  return {
    ...f,

    hazirlama:
      f.hazirlama ||
      f.hazirlamaTarihi ||
      f.hazirlamaTarih ||
      "",

    gecerlilik:
      f.gecerlilik ||
      f.gecerlilikTarihi ||
      f.gecerlilikTarih ||
      "",

    // ✅ frontend artık bunları görebilecek
    logo: resolvedLogo,
    logoUrl: resolvedLogo,

    kurumsal: {
      ...(f.kurumsal || {}),
      logo: resolvedLogo,
      logoUrl: resolvedLogo,
      firmaLogo: resolvedLogo,
    },
  };
}

/** ✅ EKLENDİ: küçük helperlar (ticari bildirim için) */
function upTR(s) {
  return (s || "").toLocaleUpperCase("tr-TR");
}
function pickUserDisplayName(u) {
  const name =
    u?.name ||
    u?.fullName ||
    u?.adSoyad ||
    (u?.personal ? `${u.personal.ad || ""} ${u.personal.soyad || ""}`.trim() : "") ||
    u?.email ||
    "";
  return upTR(name || "KULLANICI");
}

// -------------------- GET /api/firma
router.get("/", auth, async (req, res) => {
  try {
    const user = req.user;

    // ADMIN: org firmaları + atama bilgisi
    if (isAdmin(user)) {
      const orgId = getOrgId(req);
      if (!orgId) return res.status(400).json({ message: "Organizasyon bulunamadı" });

      const firms = await Firma.find({ organization: orgId }).sort({ firmaAdi: 1 }).lean();

      if (!FirmUser || firms.length === 0) {
        return res.json(firms.map(normalizeFirmaOut));
      }

      const firmIds = firms.map((f) => f._id);

      const assignments = await FirmUser.find({
        organization: orgId,
        firmId: { $in: firmIds },
        isActive: true,
      })
        .populate("userId", "name adSoyad fullName email")
        .lean();

      const assignMap = new Map();
      for (const a of assignments) assignMap.set(String(a.firmId), a.userId || null);

      const result = firms.map((f) => {
        const u = assignMap.get(String(f._id));
        const adSoyad = u?.name || u?.adSoyad || u?.fullName || u?.email || null;

        return {
          ...f,
          atanmisKullanici: u?._id || null,
          atanmisKullaniciAdSoyad: adSoyad,
        };
      });

      return res.json(result.map(normalizeFirmaOut));
    }

    // TICARI USER (kapalı)
    if (isTicariUser(user)) {
      return res.status(403).json({
        message: "Ticari kullanıcılar firma listesini /api/me/firms üzerinden almalı.",
      });
    }

    // BIREYSEL (legacy)
    const firms = await Firma.find({ userId: user._id }).sort({ firmaAdi: 1 }).lean();
    return res.json(firms.map(normalizeFirmaOut));
  } catch (e) {
    console.error("GET /api/firma hata:", e);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});

/* =========================================================
   ✅✅ YENİ: ADMIN -> TICARI USER ANLIK ATAMA BİLDİRİMİ
   POST /api/firma/:id/assign   { userId }
   POST /api/firma/:id/unassign { userId? }  (boşsa aktif atamayı söker)
   ========================================================= */

router.post("/:id/assign", auth, async (req, res) => {
  try {
    const admin = req.user;
    if (!isAdmin(admin)) return res.status(403).json({ message: "Yetkisiz" });

    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ message: "Organizasyon bulunamadı" });

    if (!FirmUser) {
      return res.status(500).json({ message: "FirmUser modeli bulunamadı (FirmUser yok)." });
    }

    const firmId = req.params.id;
    const targetUserId = req.body?.userId;
    if (!targetUserId) return res.status(400).json({ message: "userId zorunlu" });

    const firm = await Firma.findById(firmId);
    if (!firm) return res.status(404).json({ message: "Firma bulunamadı" });

    if (String(firm.organization || "") !== String(orgId)) {
      return res.status(403).json({ message: "Bu firma sizin organizasyona ait değil" });
    }

    const targetUser = await User.findById(targetUserId).lean();
    if (!targetUser) return res.status(404).json({ message: "Kullanıcı bulunamadı" });

    // kullanıcı aynı org’da mı?
    if (String(targetUser.organization || "") !== String(orgId)) {
      return res.status(400).json({ message: "Kullanıcı bu organizasyona ait değil" });
    }

    // rol kontrolü (istersen gevşetebilirsin)
    if (roleOf(targetUser) !== "ticari_user") {
      return res.status(400).json({ message: "Atama yapılacak kullanıcı ticari_user olmalı" });
    }

    // aktif atama ver
    await FirmUser.updateOne(
      { organization: orgId, firmId: firm._id, userId: targetUserId },
      { $set: { isActive: true, assignedBy: admin._id, assignedAt: new Date() } },
      { upsert: true }
    );

    // diğer aktif atamaları kapat (aynı firmada tek kişi aktif kalsın)
    await FirmUser.updateMany(
      {
        organization: orgId,
        firmId: firm._id,
        userId: { $ne: targetUserId },
        isActive: true,
      },
      { $set: { isActive: false, removedBy: admin._id, removedAt: new Date() } }
    );

    // legacy: firm.userId hedef kullanıcı olsun (tarama/akışlar düzgün çalışsın)
    firm.userId = targetUserId;
    await firm.save();

    // ✅✅ JOB'a enqueue (bildirim üretimi job tarafından yapılacak)
    try {
      enqueueFirmAssigned({
        assignedUserId: targetUserId,
        firmId: firm._id,
        firmName: firm.firmaAdi,
        actorName: pickUserDisplayName(admin),
        actionId: Date.now(),
      });
    } catch (e) {
      console.error("enqueueFirmAssigned hata:", e);
    }

    return res.json({
      ok: true,
      firm: normalizeFirmaOut(firm.toObject?.() || firm),
      assignedTo: targetUserId,
    });
  } catch (e) {
    console.error("POST /api/firma/:id/assign hata:", e);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});

router.post("/:id/unassign", auth, async (req, res) => {
  try {
    const admin = req.user;
    if (!isAdmin(admin)) return res.status(403).json({ message: "Yetkisiz" });

    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ message: "Organizasyon bulunamadı" });

    if (!FirmUser) {
      return res.status(500).json({ message: "FirmUser modeli bulunamadı (FirmUser yok)." });
    }

    const firmId = req.params.id;
    const firm = await Firma.findById(firmId);
    if (!firm) return res.status(404).json({ message: "Firma bulunamadı" });

    if (String(firm.organization || "") !== String(orgId)) {
      return res.status(403).json({ message: "Bu firma sizin organizasyona ait değil" });
    }

    // hedef userId verilmezse aktif atamayı bul
    let targetUserId = req.body?.userId || null;
    if (!targetUserId) {
      const active = await FirmUser.findOne({
        organization: orgId,
        firmId: firm._id,
        isActive: true,
      })
        .select("userId")
        .lean();
      targetUserId = active?.userId ? String(active.userId) : null;
    }

    // atamayı düşür
    await FirmUser.updateMany(
      { organization: orgId, firmId: firm._id, ...(targetUserId ? { userId: targetUserId } : {}) },
      { $set: { isActive: false, removedBy: admin._id, removedAt: new Date() } }
    );

    // legacy: firma kullanıcı bağını kaldır
    firm.userId = null;
    await firm.save();

    // ✅✅ JOB'a enqueue
    if (targetUserId) {
      try {
        enqueueFirmRemoved({
          assignedUserId: targetUserId,
          firmId: firm._id,
          firmName: firm.firmaAdi,
          actorName: pickUserDisplayName(admin),
          actionId: Date.now(),
        });
      } catch (e) {
        console.error("enqueueFirmRemoved hata:", e);
      }
    }

    return res.json({
      ok: true,
      firm: normalizeFirmaOut(firm.toObject?.() || firm),
      unassignedFrom: targetUserId,
    });
  } catch (e) {
    console.error("POST /api/firma/:id/unassign hata:", e);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});

// -------------------- GET /api/firma/:id  ✅ (Prosedür için en kritik)
// -------------------- POST /api/firma/parse-iskatip-pdf
router.post("/parse-iskatip-pdf", auth, uploadMemory.single("file"), async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ message: "PDF dosyası bulunamadı" });
    }

    const parsed = parseIskatipPdf(req.file.buffer);
    if (!parsed.firmaAdi && !parsed.sgkSicilNo) {
      return res.status(422).json({
        message: "PDF içinden firma bilgileri okunamadı. Lütfen doğru İSG-KATİP hizmet sözleşmesi PDF'si yükleyin.",
      });
    }

    return res.json({ ok: true, firma: parsed });
  } catch (e) {
    console.error("POST /api/firma/parse-iskatip-pdf hata:", e);
    return res.status(500).json({ message: "PDF işlenirken hata oluştu" });
  }
});

// -------------------- POST /api/firma/bulk
router.post("/bulk", auth, async (req, res) => {
  try {
    const user = req.user;
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (!rows.length) return res.status(400).json({ message: "Excel satırı bulunamadı" });

    const scope = firmScopeFilter(user);
    if (!scope) return res.status(403).json({ message: "Yetkisiz" });

    const orgId = getOrgId(req);
    if ((isAdmin(user) || isTicariUser(user)) && !orgId) {
      return res.status(400).json({ message: "Organizasyon bulunamadı" });
    }

    const existing = await Firma.find(scope).select("sgkNo").lean();
    const existingSgk = new Set(existing.map((f) => digitsOnly(f.sgkNo)).filter(Boolean));
    const seenInExcel = new Set();
    const inserted = [];
    const duplicates = [];
    const invalidRows = [];

    for (const [index, row] of rows.entries()) {
      const rowNumber = Number(row?.rowNumber || index + 2);
      const firmaAdi = normalizeText(row?.firmaAdi);
      const sgkNo = digitsOnly(row?.sgkNo || row?.sgkSicilNo);
      const tehlike = normalizeHazard(row?.tehlike);
      const hazirlamaDate = parseDateInput(row?.hazirlama || row?.sozlesmeOnayTarihi);

      const missing = [];
      if (!firmaAdi) missing.push("Firma Adı boş");
      if (!sgkNo) missing.push("SGK Sicil No boş");
      if (!tehlike) missing.push("Tehlike Sınıfı boş");
      if (!hazirlamaDate) missing.push("Tarih hatalı");

      if (missing.length) {
        invalidRows.push({ rowNumber, firmaAdi, sgkNo, reason: missing.join(", ") });
        continue;
      }

      if (existingSgk.has(sgkNo)) {
        duplicates.push({ rowNumber, firmaAdi, sgkNo, reason: "Sistemde kayıtlı" });
        continue;
      }

      if (seenInExcel.has(sgkNo)) {
        duplicates.push({ rowNumber, firmaAdi, sgkNo, reason: "Excel içinde mükerrer" });
        continue;
      }

      seenInExcel.add(sgkNo);
      const gecerlilik = parseDateInput(row?.gecerlilik) || computeValidityDate(hazirlamaDate, tehlike);
      const doc = {
        firmaAdi: upTR(firmaAdi),
        sgkNo,
        il: upTR(row?.il || ""),
        adres: upTR(row?.adres || ""),
        calisanSayisi: Number(digitsOnly(row?.calisanSayisi)) || null,
        nace: digitsOnly(row?.nace),
        faaliyet: upTR(row?.faaliyet || ""),
        tehlike,
        hazirlama: hazirlamaDate,
        gecerlilik,
      };

      if (isAdmin(user) || isTicariUser(user)) {
        doc.organization = orgId;
        doc.createdBy = user._id;
        doc.userId = user._id;
        doc.durum = "Aktif";
      } else {
        doc.userId = user._id;
      }

      const firm = await Firma.create(doc);
      existingSgk.add(sgkNo);
      inserted.push(normalizeFirmaOut(firm.toObject?.() || firm));

      if (isTicariUser(user) && FirmUser) {
        await FirmUser.updateOne(
          { organization: orgId, firmId: firm._id, userId: user._id },
          { $set: { isActive: true, assignedBy: user._id } },
          { upsert: true }
        );
      }
    }

    return res.status(201).json({
      ok: true,
      totalRows: rows.length,
      insertedCount: inserted.length,
      duplicateCount: duplicates.length,
      invalidCount: invalidRows.length,
      inserted,
      duplicates,
      invalidRows,
    });
  } catch (e) {
    console.error("POST /api/firma/bulk hata:", e);
    return res.status(500).json({ message: "Toplu firma ekleme sırasında hata oluştu" });
  }
});

router.get("/:id", auth, async (req, res) => {
  try {
    const user = req.user;
    const firmId = req.params.id;

    const firm = await Firma.findById(firmId).lean();
    if (!firm) return res.status(404).json({ message: "Firma bulunamadı" });

    // ADMIN
    if (isAdmin(user)) {
      const orgId = getOrgId(req);
      if (!orgId) return res.status(400).json({ message: "Organizasyon bulunamadı" });
      if (String(firm.organization || "") !== String(orgId)) {
        return res.status(403).json({ message: "Bu firma sizin organizasyona ait değil" });
      }
      return res.json(normalizeFirmaOut(firm));
    }

    // TICARI USER
    if (isTicariUser(user)) {
      const orgId = getOrgId(req);
      if (!orgId) return res.status(400).json({ message: "Organizasyon bulunamadı" });
      if (String(firm.organization || "") !== String(orgId)) {
        return res.status(403).json({ message: "Bu firma sizin organizasyona ait değil" });
      }

      if (FirmUser) {
        const link = await FirmUser.findOne({
          organization: orgId,
          firmId: firm._id,
          userId: user._id,
          isActive: true,
        }).lean();
        if (!link) return res.status(403).json({ message: "Bu firmaya yetkiniz yok" });
      }

      return res.json(normalizeFirmaOut(firm));
    }

    // BIREYSEL
    if (isBireysel(user)) {
      if (String(firm.userId || "") !== String(user._id)) {
        return res.status(403).json({ message: "Bu firmaya yetkiniz yok" });
      }
      return res.json(normalizeFirmaOut(firm));
    }

    return res.status(403).json({ message: "Yetkisiz" });
  } catch (e) {
    console.error("GET /api/firma/:id hata:", e);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});

// -------------------- POST /api/firma
router.post("/", auth, async (req, res) => {
  try {
    const user = req.user;
    const data = pickFirmaFields(req.body);

    if (!data.firmaAdi) return res.status(400).json({ message: "firmaAdi zorunlu" });
    data.sgkNo = digitsOnly(data.sgkNo);
    if (!data.sgkNo) return res.status(400).json({ message: "SGK Sicil No zorunlu" });

    const duplicate = await findDuplicateFirma(user, data.sgkNo);
    if (duplicate) {
      return res.status(409).json({
        message: "Bu SGK Sicil Numarasına ait firma sistemde zaten kayıtlıdır.",
      });
    }

    if (isAdmin(user) || isTicariUser(user)) {
      const orgId = getOrgId(req);
      if (!orgId) return res.status(400).json({ message: "Organizasyon bulunamadı" });

      const firmDoc = {
        ...data,
        organization: orgId,
        createdBy: user._id,
        durum: data.durum || "Aktif",
        userId: user._id, // legacy uyumluluk
      };

      const firm = await Firma.create(firmDoc);

      if (isTicariUser(user) && FirmUser) {
        await FirmUser.updateOne(
          { organization: orgId, firmId: firm._id, userId: user._id },
          { $set: { isActive: true, assignedBy: user._id } },
          { upsert: true }
        );
      }

      /** ✅✅ EKLENDİ: Ticari kullanıcı firma ekleyince admin(ler)e anında bildirim */
      if (isTicariUser(user) && createNotification) {
        // org içindeki ticari adminleri bul
        const admins = await User.find({ organization: orgId })
          .select("_id role name fullName adSoyad personal email")
          .lean();

        const adminIds = admins
          .filter((a) => roleOf(a) === "ticari_admin")
          .map((a) => String(a._id));

        if (adminIds.length) {
          const creatorName = pickUserDisplayName(user);
          const firmName = upTR(firm.firmaAdi);

          await Promise.all(
            adminIds.map((adminId) =>
              createNotification({
                userId: adminId,
                firmId: firm._id,
                type: "event",
                module: "ticari",
                title: "Firma eklendi",
                message: `${creatorName} kullanıcısı ${firmName} firmasını ekledi.`,
                severity: "info",
                link: "",
                dueDate: new Date(),
                // admin bazlı key: duplicate engeller
                key: `corp_firma_created:${String(orgId)}:${String(firm._id)}:admin:${String(
                  adminId
                )}`,
              })
            )
          );
        }
      }

      return res.status(201).json(normalizeFirmaOut(firm.toObject?.() || firm));
    }

    if (isBireysel(user)) {
      const firm = await Firma.create({ ...data, userId: user._id });
      return res.status(201).json(normalizeFirmaOut(firm.toObject?.() || firm));
    }

    return res.status(403).json({ message: "Yetkisiz" });
  } catch (e) {
    console.error("POST /api/firma hata:", e);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});

// -------------------- PUT /api/firma/:id
router.put("/:id", auth, async (req, res) => {
  try {
    const user = req.user;
    const firmId = req.params.id;
    const patch = pickFirmaFields(req.body);
    if (patch.sgkNo !== undefined) {
      patch.sgkNo = digitsOnly(patch.sgkNo);
      if (!patch.sgkNo) return res.status(400).json({ message: "SGK Sicil No zorunlu" });
      const duplicate = await findDuplicateFirma(user, patch.sgkNo, firmId);
      if (duplicate) {
        return res.status(409).json({
          message: "Bu SGK Sicil Numarasına ait firma sistemde zaten kayıtlıdır.",
        });
      }
    }

    const firm = await Firma.findById(firmId);
    if (!firm) return res.status(404).json({ message: "Firma bulunamadı" });

    // ADMIN
    if (isAdmin(user)) {
      const orgId = getOrgId(req);
      if (!orgId) return res.status(400).json({ message: "Organizasyon bulunamadı" });
      if (String(firm.organization || "") !== String(orgId)) {
        return res.status(403).json({ message: "Bu firma sizin organizasyona ait değil" });
      }

      Object.keys(patch).forEach((k) => {
        if (patch[k] !== undefined) firm[k] = patch[k];
      });

      await firm.save();
      return res.json(normalizeFirmaOut(firm.toObject?.() || firm));
    }

    // TICARI USER
    if (isTicariUser(user)) {
      const orgId = getOrgId(req);
      if (!orgId) return res.status(400).json({ message: "Organizasyon bulunamadı" });

      if (String(firm.organization || "") !== String(orgId)) {
        return res.status(403).json({ message: "Bu firma sizin organizasyona ait değil" });
      }

      if (FirmUser) {
        const link = await FirmUser.findOne({
          organization: orgId,
          firmId: firm._id,
          userId: user._id,
          isActive: true,
        }).lean();
        if (!link) return res.status(403).json({ message: "Bu firmaya yetkiniz yok" });
      } else {
        const ok =
          String(firm.createdBy || "") === String(user._id) ||
          String(firm.userId || "") === String(user._id);
        if (!ok) return res.status(403).json({ message: "Bu firmaya yetkiniz yok" });
      }

      Object.keys(patch).forEach((k) => {
        if (patch[k] !== undefined) firm[k] = patch[k];
      });

      await firm.save();
      return res.json(normalizeFirmaOut(firm.toObject?.() || firm));
    }

    // BIREYSEL
    if (isBireysel(user)) {
      if (String(firm.userId || "") !== String(user._id)) {
        return res.status(403).json({ message: "Bu firmaya yetkiniz yok" });
      }

      Object.keys(patch).forEach((k) => {
        if (patch[k] !== undefined) firm[k] = patch[k];
      });

      await firm.save();
      return res.json(normalizeFirmaOut(firm.toObject?.() || firm));
    }

    return res.status(403).json({ message: "Yetkisiz" });
  } catch (e) {
    console.error("PUT /api/firma/:id hata:", e);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});

// -------------------- DELETE /api/firma/:id
router.delete("/:id", auth, async (req, res) => {
  try {
    const user = req.user;
    const firmId = req.params.id;

    const firm = await Firma.findById(firmId);
    if (!firm) return res.status(404).json({ message: "Firma bulunamadı" });

    if (isTicariUser(user)) {
      return res.status(403).json({ message: "Ticari kullanıcı firma silemez." });
    }

    // ADMIN
    if (isAdmin(user)) {
      const orgId = getOrgId(req);
      if (!orgId) return res.status(400).json({ message: "Organizasyon bulunamadı" });
      if (String(firm.organization || "") !== String(orgId)) {
        return res.status(403).json({ message: "Bu firma sizin organizasyona ait değil" });
      }

      await Firma.deleteOne({ _id: firm._id });
      if (FirmUser) await FirmUser.deleteMany({ firmId: firm._id, organization: orgId });

      return res.json({ ok: true });
    }

    // BIREYSEL
    if (isBireysel(user)) {
      if (String(firm.userId || "") !== String(user._id)) {
        return res.status(403).json({ message: "Bu firmaya yetkiniz yok" });
      }
      await Firma.deleteOne({ _id: firm._id });
      return res.json({ ok: true });
    }

    return res.status(403).json({ message: "Yetkisiz" });
  } catch (e) {
    console.error("DELETE /api/firma/:id hata:", e);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});

// ================== FİRMA KİŞİLER ==================

router.get("/:id/kisiler", auth, async (req, res) => {
  try {
    const user = req.user;
    const firmId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(firmId)) {
      return res.status(400).json({ message: "Geçersiz firma ID", firmId });
    }

    const firm = await Firma.findById(firmId)
      .populate("userId", "name adSoyad fullName email personal")
      .lean();

    if (!firm) {
      return res.status(404).json({ message: "Firma bulunamadı" });
    }

    const orgId = getOrgId(req);

    if (isAdmin(user)) {
      if (!orgId) return res.status(400).json({ message: "Organizasyon bulunamadı" });
      if (String(firm.organization || "") !== String(orgId)) {
        return res.status(403).json({ message: "Bu firma sizin organizasyona ait değil" });
      }
    } else if (isTicariUser(user)) {
      if (!orgId) return res.status(400).json({ message: "Organizasyon bulunamadı" });
      if (String(firm.organization || "") !== String(orgId)) {
        return res.status(403).json({ message: "Bu firma sizin organizasyona ait değil" });
      }

      if (FirmUser) {
        const link = await FirmUser.findOne({
          organization: orgId,
          firmId: firm._id,
          userId: user._id,
          isActive: true,
        }).lean();

        if (!link) return res.status(403).json({ message: "Bu firmaya yetkiniz yok" });
      }
    } else if (isBireysel(user)) {
      if (String(firm.userId?._id || firm.userId || "") !== String(user._id)) {
        return res.status(403).json({ message: "Bu firmaya yetkiniz yok" });
      }
    } else {
      return res.status(403).json({ message: "Yetkisiz" });
    }

    const assignedUser = firm.userId || null;
    const assignedName = assignedUser
      ? pickUserDisplayName(assignedUser)
      : "";

   

    return res.json({
      ...(firm.kisiler || {}),
      uzman: assignedName || firm.kisiler?.uzman || "",
    });
  } catch (e) {
    console.error("GET /api/firma/:id/kisiler hata:", e);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});

router.put("/:id/kisiler", auth, async (req, res) => {
  try {
    const user = req.user;
    const firmId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(firmId)) {
      return res.status(400).json({ message: "Geçersiz firma ID", firmId });
    }

    const firm = await Firma.findById(firmId)
      .populate("userId", "name adSoyad fullName email personal");

    if (!firm) {
      return res.status(404).json({ message: "Firma bulunamadı" });
    }

    const orgId = getOrgId(req);

    if (isAdmin(user)) {
      if (!orgId) return res.status(400).json({ message: "Organizasyon bulunamadı" });
      if (String(firm.organization || "") !== String(orgId)) {
        return res.status(403).json({ message: "Bu firma sizin organizasyona ait değil" });
      }
    } else if (isTicariUser(user)) {
      if (!orgId) return res.status(400).json({ message: "Organizasyon bulunamadı" });
      if (String(firm.organization || "") !== String(orgId)) {
        return res.status(403).json({ message: "Bu firma sizin organizasyona ait değil" });
      }

      if (FirmUser) {
        const link = await FirmUser.findOne({
          organization: orgId,
          firmId: firm._id,
          userId: user._id,
          isActive: true,
        }).lean();

        if (!link) return res.status(403).json({ message: "Bu firmaya yetkiniz yok" });
      }
    } else if (isBireysel(user)) {
      if (String(firm.userId?._id || firm.userId || "") !== String(user._id)) {
        return res.status(403).json({ message: "Bu firmaya yetkiniz yok" });
      }
    } else {
      return res.status(403).json({ message: "Yetkisiz" });
    }

    const assignedUser = firm.userId || null;
    const assignedName = assignedUser
      ? pickUserDisplayName(assignedUser)
      : "";

   
    firm.kisiler = {
      isveren: req.body.isveren || req.body.isverenVekiliAdSoyad || "",
      uzman: assignedName || "",
      hekim: req.body.hekim || req.body.isyeriHekimiAdSoyad || "",
      temsilci: req.body.temsilci || req.body.calisanTemsilcisiAdSoyad || "",
      destek: req.body.destek || req.body.destekElemaniAdSoyad || "",
      bilgi: req.body.bilgi || req.body.bilgiSahibiKisiAdSoyad || "",
    };

    await firm.save();

    return res.json({
      ok: true,
      kisiler: firm.kisiler,
    });
  } catch (e) {
    console.error("PUT /api/firma/:id/kisiler hata:", e);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});


// ================== İMZA / PARAF ==================

router.get("/:id/imzalar", auth, async (req, res) => {
  try {
    const user = req.user;
    const firm = await Firma.findById(req.params.id).lean();

    if (!firm) {
      return res.status(404).json({ message: "Firma bulunamadı" });
    }

    // ADMIN
    if (isAdmin(user)) {
      const orgId = getOrgId(req);
      if (!orgId) return res.status(400).json({ message: "Organizasyon bulunamadı" });
      if (String(firm.organization || "") !== String(orgId)) {
        return res.status(403).json({ message: "Bu firma sizin organizasyona ait değil" });
      }
      return res.json(firm.imzalar || {});
    }

    // TICARI USER
    if (isTicariUser(user)) {
      const orgId = getOrgId(req);
      if (!orgId) return res.status(400).json({ message: "Organizasyon bulunamadı" });
      if (String(firm.organization || "") !== String(orgId)) {
        return res.status(403).json({ message: "Bu firma sizin organizasyona ait değil" });
      }

      if (FirmUser) {
        const link = await FirmUser.findOne({
          organization: orgId,
          firmId: firm._id,
          userId: user._id,
          isActive: true,
        }).lean();

        if (!link) return res.status(403).json({ message: "Bu firmaya yetkiniz yok" });
      }

      return res.json(firm.imzalar || {});
    }

    // BIREYSEL
    if (isBireysel(user)) {
      if (String(firm.userId || "") !== String(user._id)) {
        return res.status(403).json({ message: "Bu firmaya yetkiniz yok" });
      }
      return res.json(firm.imzalar || {});
    }

    return res.status(403).json({ message: "Yetkisiz" });
  } catch (e) {
    console.error("GET imzalar hata:", e);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});

router.put("/:id/imzalar", auth, async (req, res) => {
  try {
    const user = req.user;
    const firm = await Firma.findById(req.params.id);

    if (!firm) {
      return res.status(404).json({ message: "Firma bulunamadı" });
    }

    // ADMIN
    if (isAdmin(user)) {
      const orgId = getOrgId(req);
      if (!orgId) return res.status(400).json({ message: "Organizasyon bulunamadı" });
      if (String(firm.organization || "") !== String(orgId)) {
        return res.status(403).json({ message: "Bu firma sizin organizasyona ait değil" });
      }

      firm.imzalar = req.body.imzalar || {};
      await firm.save();

      return res.json({
        ok: true,
        imzalar: firm.imzalar,
      });
    }

    // TICARI USER
    if (isTicariUser(user)) {
      const orgId = getOrgId(req);
      if (!orgId) return res.status(400).json({ message: "Organizasyon bulunamadı" });

      if (String(firm.organization || "") !== String(orgId)) {
        return res.status(403).json({ message: "Bu firma sizin organizasyona ait değil" });
      }

      if (FirmUser) {
        const link = await FirmUser.findOne({
          organization: orgId,
          firmId: firm._id,
          userId: user._id,
          isActive: true,
        }).lean();

        if (!link) return res.status(403).json({ message: "Bu firmaya yetkiniz yok" });
      } else {
        const ok =
          String(firm.createdBy || "") === String(user._id) ||
          String(firm.userId || "") === String(user._id);
        if (!ok) return res.status(403).json({ message: "Bu firmaya yetkiniz yok" });
      }

      firm.imzalar = req.body.imzalar || {};
      await firm.save();

      return res.json({
        ok: true,
        imzalar: firm.imzalar,
      });
    }

    // BIREYSEL
    if (isBireysel(user)) {
      if (String(firm.userId || "") !== String(user._id)) {
        return res.status(403).json({ message: "Bu firmaya yetkiniz yok" });
      }

      firm.imzalar = req.body.imzalar || {};
      await firm.save();

      return res.json({
        ok: true,
        imzalar: firm.imzalar,
      });
    }

    return res.status(403).json({ message: "Yetkisiz" });
  } catch (e) {
    console.error("PUT imzalar hata:", e);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});

// ================== İMZA / PARAF ==================

module.exports = router;
