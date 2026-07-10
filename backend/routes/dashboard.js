const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const router = express.Router();

const User = require("../models/User");
const Firma = require("../models/Firma");
const Document = require("../models/Document");
const Organization = require("../models/Organization");
const IseGirisEgitimiKayit =
  mongoose.models.IseGirisEgitimiKayit ||
  mongoose.model(
    "IseGirisEgitimiKayit",
    new mongoose.Schema(
      {
        firmaId: mongoose.Schema.Types.ObjectId,
        firmaAdi: String,
        egitimTuru: String,
        payload: mongoose.Schema.Types.Mixed,
        katilimcilar: Array,
      },
      {
        timestamps: true,
        collection: "egitim_ise_giris",
      }
    )
  );

let FirmUser = null;
try {
  FirmUser = require("../models/FirmUser");
} catch (_) {
  FirmUser = null;
}

/* ---------------- AUTH ---------------- */
async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Token yok" });

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ message: "JWT_SECRET tanımlı değil." });
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

/* ---------------- HELPERS ---------------- */
const roleOf = (u) => String(u?.role || "").toLowerCase().trim();
const isAdmin = (u) => roleOf(u) === "ticari_admin";

const safeUserName = (u) =>
  u?.name || u?.fullName || u?.adSoyad || u?.email || "Kullanıcı";

const getOrgId = (req) => req.user?.organization || req.user?.organizationId || null;

function buildOrgIdCandidates(user) {
  const organizationValue = user?.organization;

  return [
    user?.organizationId,
    user?.organizationUuid,

    // ✅ organization string de gelse ObjectId de gelse yakala
    organizationValue ? String(organizationValue) : null,

    // ✅ organization populate edilmiş obje gelirse _id de yakala
    organizationValue?._id ? String(organizationValue._id) : null,

    user?._id,
    user?.id,
  ]
    .filter(Boolean)
    .map(String);
}

const toDateSafe = (value) => {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  const text = String(value).trim();

  // 15.05.2026 veya 15/05/2026 formatı
  const trMatch = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (trMatch) {
    const gun = Number(trMatch[1]);
    const ay = Number(trMatch[2]);
    const yil = Number(trMatch[3]);

    const d = new Date(yil, ay - 1, gun);
    if (!Number.isNaN(d.getTime())) return d;
  }

  // 2026-05-15 formatı
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return null;

  return d;
};

const diffDaysFromToday = (dateValue) => {
  const target = toDateSafe(dateValue);
  if (!target) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  target.setHours(0, 0, 0, 0);

  return Math.ceil(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
};

const normalizeText = (value) =>
  String(value || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .trim();

function resolveDocType(doc = {}) {
  const text = (
    (doc.category || "") +
    " " +
    (doc.subCategory || "") +
    " " +
    (doc.belgeTuru || "") +
    " " +
    (doc.title || "")
  )
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");

  // 🔥 ÇOK GENİŞ YAKALAMA
  if (text.includes("risk")) return "risk";

  if (text.includes("acil")) return "acil";

 // 🔥 YILLIK ALT TÜRLER
if (text.includes("yillik") && text.includes("egitim"))
  return "yillik_egitim";

if (text.includes("yillik") && text.includes("calisma"))
  return "yillik_calisma";

if (text.includes("yillik") && text.includes("degerlendirme"))
  return "yillik_degerlendirme";

// fallback
if (text.includes("yillik")) return "yillik";

   if (
    text.includes("egitim") ||
    text.includes("katilim") ||
    text.includes("sertifika")
  )
    return "egitim";

  // 🔥 DEFTER
  if (
    text.includes("defter") ||
    text.includes("isg defteri") ||
    text.includes("onayli defter")
  )
    return "defter";

  return null;
}

function getDocDate(doc = {}) {
  return (
    // ✅ direkt alanlar
    doc.sonKullanmaTarihi ||
    doc.gecerlilikTarihi ||
    doc.gecerlilik ||
    doc.bitisTarihi ||
    doc.sonGecerlilikTarihi ||
    doc.planGecerlilikTarihi ||
    doc.acilDurumGecerlilik ||
    doc.acilDurumGecerlilikTarihi ||
    doc.acilDurumSonGecerlilikTarihi ||

    // ✅ data içi
    doc.data?.sonKullanmaTarihi ||
    doc.data?.gecerlilikTarihi ||
    doc.data?.gecerlilik ||
    doc.data?.bitisTarihi ||
    doc.data?.sonGecerlilikTarihi ||
    doc.data?.planGecerlilikTarihi ||
    doc.data?.acilDurumGecerlilik ||
    doc.data?.acilDurumGecerlilikTarihi ||
    doc.data?.acilDurumSonGecerlilikTarihi ||

    // ✅ payload içi
    doc.data?.payload?.sonKullanmaTarihi ||
    doc.data?.payload?.gecerlilikTarihi ||
    doc.data?.payload?.gecerlilik ||
    doc.data?.payload?.bitisTarihi ||
    doc.data?.payload?.sonGecerlilikTarihi ||
    doc.data?.payload?.planGecerlilikTarihi ||
    doc.data?.payload?.acilDurumGecerlilik ||
    doc.data?.payload?.acilDurumGecerlilikTarihi ||
    doc.data?.payload?.acilDurumSonGecerlilikTarihi ||

    doc.payload?.sonKullanmaTarihi ||
    doc.payload?.gecerlilikTarihi ||
    doc.payload?.gecerlilik ||
    doc.payload?.bitisTarihi ||
    doc.payload?.sonGecerlilikTarihi ||
    doc.payload?.planGecerlilikTarihi ||
    doc.payload?.acilDurumGecerlilik ||
    doc.payload?.acilDurumGecerlilikTarihi ||
    doc.payload?.acilDurumSonGecerlilikTarihi ||

   
    ""
  );
}

function getDocStatusFromDoc(doc) {
  if (!doc) {
    return {
      key: "missing",
      label: "Yok",
      kalanGun: null,
      date: "",
      doc: null,
    };
  }

  const dateValue = getDocDate(doc);
  const kalanGun = diffDaysFromToday(dateValue);

  if (kalanGun === null) {
    return {
      key: "valid",
      label: "Kayıt Var",
      kalanGun: null,
      date: dateValue || "",
      doc,
    };
  }

  if (kalanGun < 0) {
    return {
      key: "expired",
      label: "Süresi Dolmuş",
      kalanGun,
      date: dateValue,
      doc,
    };
  }

  if (kalanGun <= 30) {
    return {
      key: "upcoming",
      label: "Yaklaşıyor",
      kalanGun,
      date: dateValue,
      doc,
    };
  }

  return {
    key: "valid",
    label: "Güncel",
    kalanGun,
    date: dateValue,
    doc,
  };
}

function getYillikStatus(latestDocs) {
  const egitim = latestDocs.yillik_egitim;
  const calisma = latestDocs.yillik_calisma;
  const degerlendirme = latestDocs.yillik_degerlendirme;

  const mevcutSayisi = [egitim, calisma, degerlendirme].filter(Boolean).length;

  if (mevcutSayisi < 3) {
    return {
      key: "missing",
      label: "Eksik Var",
      kalanGun: null,
      date: "",
      toplam: 3,
      mevcut: mevcutSayisi,
      eksik: 3 - mevcutSayisi,
      docs: { egitim, calisma, degerlendirme },
    };
  }

  const now = new Date();
  const yil = now.getFullYear();
  const yilSonu = new Date(yil, 11, 31);
  yilSonu.setHours(0, 0, 0, 0);

  const kalanGun = diffDaysFromToday(yilSonu);

  if (kalanGun < 0) {
    return {
      key: "expired",
      label: "Süresi Dolmuş",
      kalanGun,
      date: `${yil}-12-31`,
      toplam: 3,
      mevcut: 3,
      eksik: 0,
      docs: { egitim, calisma, degerlendirme },
    };
  }

  if (kalanGun <= 30) {
    return {
      key: "upcoming",
      label: "Yıl Sonu Yaklaşıyor",
      kalanGun,
      date: `${yil}-12-31`,
      toplam: 3,
      mevcut: 3,
      eksik: 0,
      docs: { egitim, calisma, degerlendirme },
    };
  }

  return {
    key: "valid",
    label: "Güncel",
    kalanGun,
    date: `${yil}-12-31`,
    toplam: 3,
    mevcut: 3,
    eksik: 0,
    docs: { egitim, calisma, degerlendirme },
  };
}

function getDefterStatus(defterDocs = []) {
  const now = new Date();

  const aktifYil = now.getFullYear();
  const aktifAy = now.getMonth(); // 0-11

  const aylar = [
    "Ocak",
    "Şubat",
    "Mart",
    "Nisan",
    "Mayıs",
    "Haziran",
    "Temmuz",
    "Ağustos",
    "Eylül",
    "Ekim",
    "Kasım",
    "Aralık",
  ];

  const mevcutAylar = new Set();

  for (const doc of defterDocs) {
    const tarih =
      toDateSafe(
        doc?.tarih ||
          doc?.createdAt ||
          doc?.updatedAt ||
          doc?.dateISO
      );

    if (!tarih) continue;

    const yil = tarih.getFullYear();

    // 🔥 sadece aktif yıl
    if (yil !== aktifYil) continue;

    mevcutAylar.add(tarih.getMonth());
  }

  const eksikAylar = [];

  for (let i = 0; i <= aktifAy; i++) {
    if (!mevcutAylar.has(i)) {
      eksikAylar.push(aylar[i]);
    }
  }

  const toplam = aktifAy + 1;
  const mevcut = toplam - eksikAylar.length;

  if (eksikAylar.length > 0) {
    return {
      key: "missing",
      label: "Eksik Var",
      kalanGun: null,
      toplam,
      mevcut,
      eksikAylar,
    };
  }

  return {
    key: "valid",
    label: "Güncel",
    kalanGun: null,
    toplam,
    mevcut,
    eksikAylar: [],
  };
}

function getEgitimKisiDurumu(doc) {
  if (!doc) {
    return {
      toplam: 0,
      guncel: 0,
      yaklasan: 0,
      gecmis: 0,
      eksikTarih: 0,
      oran: 0,
    };
  }

  const kisiler =
    doc?.data?.katilimcilar ||
    doc?.data?.personeller ||
    doc?.katilimcilar ||
    doc?.personeller ||
    [];

  let guncel = 0;
  let yaklasan = 0;
  let gecmis = 0;
  let eksikTarih = 0;

  for (const k of kisiler) {
    const tarih =
      k?.gecerlilikTarihi ||
      k?.gecerlilik ||
      k?.bitisTarihi ||
      k?.egitimGecerlilikTarihi ||
      k?.egitimTarihi ||
      k?.tarih ||
      doc?.data?.gecerlilikTarihi ||
      doc?.data?.gecerlilik ||
      doc?.gecerlilikTarihi ||
      doc?.gecerlilik ||
      "";

    const kalan = diffDaysFromToday(tarih);

    if (kalan === null) {
      eksikTarih++;
      continue;
    }

    if (kalan < 0) gecmis++;
    else if (kalan <= 30) yaklasan++;
    else guncel++;
  }

  const toplam = kisiler.length;
  const oran = toplam > 0 ? Math.round((guncel / toplam) * 100) : 0;

  return {
    toplam,
    guncel,
    yaklasan,
    gecmis,
    eksikTarih,
    oran,
  };
}

function getEgitimKisiDurumuFromDocs(egitimDocs = []) {
  let toplam = 0;
  let guncel = 0;
  let yaklasan = 0;
  let gecmis = 0;
  let eksikTarih = 0;

  for (const doc of egitimDocs) {
    const kisiler =
      doc?.data?.katilimcilar ||
      doc?.data?.personeller ||
      doc?.data?.participants ||
      doc?.katilimcilar ||
      doc?.personeller ||
      [];

    for (const k of kisiler) {
      toplam++;

      const tarih =
        k?.gecerlilikTarihi ||
        k?.gecerlilik ||
        k?.bitisTarihi ||
        k?.egitimGecerlilikTarihi ||
        doc?.data?.gecerlilikTarihi ||
        doc?.data?.gecerlilik ||
        doc?.gecerlilikTarihi ||
        doc?.gecerlilik ||
        doc?.bitisTarihi ||
        "";

      const kalan = diffDaysFromToday(tarih);

      if (kalan === null) {
        eksikTarih++;
      } else if (kalan < 0) {
        gecmis++;
      } else if (kalan <= 30) {
        yaklasan++;
      } else {
        guncel++;
      }
    }
  }

  return {
    toplam,
    guncel,
    yaklasan,
    gecmis,
    eksikTarih,
    oran: toplam > 0 ? Math.round((guncel / toplam) * 100) : 0,
  };
}

function getOverallStatus(docsStatus = {}, egitimKisiDurumu = null) {
  const values = Object.values(docsStatus);

  if (
    values.some((x) => x?.key === "expired") ||
    (egitimKisiDurumu && egitimKisiDurumu.gecmis > 0)
  ) {
    return {
      key: "critical",
      renk: "kirmizi",
      label: "Kritik",
      icon: "🔴",
    };
  }

  if (
    values.some((x) => x?.key === "missing" || x?.key === "upcoming") ||
    (egitimKisiDurumu &&
      (egitimKisiDurumu.yaklasan > 0 ||
        egitimKisiDurumu.eksikTarih > 0 ||
        egitimKisiDurumu.toplam === 0))
  ) {
    return {
      key: "warning",
      renk: "sari",
      label: "Eksik / Yaklaşan",
      icon: "🟡",
    };
  }

  return {
    key: "complete",
    renk: "yesil",
    label: "Tam",
    icon: "🟢",
  };
}

function pickLatestDocsByType(firmDocs = []) {
  const latest = {
    risk: null,
    acil: null,
    yillik_egitim: null,
    yillik_calisma: null,
    yillik_degerlendirme: null,
        egitim: null,
    defter: [],
  };



  for (const doc of firmDocs) {
    const type = resolveDocType(doc);
    if (!type) continue;

    const current = latest[type];

    // 🔥 Defter aylık takip için hepsi lazım
    if (type === "defter") {
      latest.defter.push(doc);
      continue;
    }

    const docDate = getDocDate(doc);
    const parsedDocDate = toDateSafe(docDate);

    const currentDate = current ? getDocDate(current) : "";
    const parsedCurrentDate = current ? toDateSafe(currentDate) : null;

    const docCreatedTime = new Date(
      doc.createdAt || doc.updatedAt || doc.tarih || 0
    ).getTime();

    const currentCreatedTime = current
      ? new Date(current.createdAt || current.updatedAt || current.tarih || 0).getTime()
      : 0;

    let shouldReplace = false;

    if (!current) {
      shouldReplace = true;
    } else if (parsedDocDate && parsedCurrentDate) {
      // İkisinde de geçerlilik varsa geçerlilik tarihine göre seç
      shouldReplace = parsedDocDate.getTime() > parsedCurrentDate.getTime();
    } else if (parsedDocDate && !parsedCurrentDate) {
      // Yeni belgede geçerlilik var, mevcutta yoksa yeniyi seç
      shouldReplace = true;
    } else if (!parsedDocDate && !parsedCurrentDate) {
      // İkisinde de geçerlilik yoksa kayıt tarihine göre seç
      shouldReplace = docCreatedTime > currentCreatedTime;
    } else {
      // Mevcutta geçerlilik varsa, geçerliliği olmayan yeni belgeyle ezme
      shouldReplace = false;
    }

    if (shouldReplace) {
      latest[type] = doc;
    }
  }

  return latest;
}

function docSummary(doc) {
  if (!doc) return null;

  return {
    _id: doc._id,
    firmaId: doc.firmaId,
    firmaAdi: doc.firmaAdi,
    category: doc.category,
    subCategory: doc.subCategory,
    belgeTuru: doc.belgeTuru,
    title: doc.title,
    tarih: doc.tarih,
    gecerlilik: doc.gecerlilik,
    bitisTarihi: doc.bitisTarihi,
    dateISO: doc.dateISO,
    fileUrl: doc.fileUrl,
    absoluteUrl: doc.absoluteUrl,
    fileName: doc.fileName,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    createdBy: doc.createdBy,
    createdByUserId: doc.createdByUserId,
  };
}

/* ---------------- GET /api/dashboard ---------------- */

router.get("/", auth, async (req, res) => {
  try {
    const user = req.user;

    if (!isAdmin(user)) {
      return res
        .status(403)
        .json({ message: "Bu endpoint sadece ticari_admin içindir." });
    }

    const orgId = getOrgId(req);
    if (!orgId) {
      return res.status(400).json({ message: "Organizasyon bulunamadı" });
    }

    const orgObjectId =
      mongoose.Types.ObjectId.isValid(String(orgId))
        ? new mongoose.Types.ObjectId(String(orgId))
        : orgId;

    const orgIdCandidates = buildOrgIdCandidates(user);

    /* 0) ORGANİZASYON */
    const orgDoc = mongoose.Types.ObjectId.isValid(String(orgId))
      ? await Organization.findById(orgId).lean()
      : null;

    /* 1) FİRMALAR */
    const firms = await Firma.find({ organization: orgObjectId })
      .sort({ firmaAdi: 1 })
      .lean();

    const firmIds = firms.map((f) => f._id).filter(Boolean);
    const firmIdStrings = firmIds.map((x) => String(x));

    /* 2) ATAMALAR */
    let activeAssignments = [];
    let allAssignments = [];

    if (FirmUser && firmIds.length > 0) {
      activeAssignments = await FirmUser.find({
        organization: orgObjectId,
        firmId: { $in: firmIds },
        isActive: true,
      })
        .populate("userId", "name fullName adSoyad email")
        .lean();

      allAssignments = await FirmUser.find({
        organization: orgObjectId,
        firmId: { $in: firmIds },
      })
        .populate("userId", "name fullName adSoyad email")
        .sort({ createdAt: -1 })
        .lean();
    }

    const assignMap = new Map();
    for (const a of activeAssignments) {
      assignMap.set(String(a.firmId), a.userId || null);
    }

    /* 3) BELGELERİ ÇEK */
    const firmNames = firms
  .map((f) => String(f.firmaAdi || "").trim())
  .filter(Boolean);

const documents = await Document.find({
 
  organizationId: { $in: orgIdCandidates },
  $or: [
    { firmaId: { $in: firmIdStrings } },
    { firmaAdi: { $in: firmNames } },
  ],
  status: { $ne: "arsiv" },
})
  .sort({ createdAt: -1 })
  .lean();


console.log("DASHBOARD DEBUG:", {
  orgIdCandidates,
  firmIdStrings,
  documentsCount: documents.length,
  documents: documents.map((d) => ({
    _id: d._id,
    organizationId: d.organizationId,
    firmaId: d.firmaId,
    firmaAdi: d.firmaAdi,
    category: d.category,
    subCategory: d.subCategory,
    belgeTuru: d.belgeTuru,
    title: d.title,
    gecerlilik: d.gecerlilik,
    tarih: d.tarih,
    status: d.status,
  })),
});

  const firmNameToId = new Map(
  firms
    .map((f) => [String(f.firmaAdi || "").trim(), String(f._id)])
    .filter(([name]) => !!name)
);

const docsByFirm = new Map();

for (const doc of documents) {
  let fid = String(doc.firmaId || "").trim();

  if (!firmIdStrings.includes(fid)) {
    const fallbackId = firmNameToId.get(String(doc.firmaAdi || "").trim());
    if (fallbackId) fid = fallbackId;
  }

  if (!fid) continue;

  if (!docsByFirm.has(fid)) docsByFirm.set(fid, []);
  docsByFirm.get(fid).push(doc);
}

    /* 4) FİRMALARI BELGELERLE ZENGİNLEŞTİR */
    const enrichedFirms = await Promise.all(
  firms.map(async (f) => {
      const fid = String(f._id);
      const assignedUser = assignMap.get(fid) || null;

      const firmDocs = docsByFirm.get(fid) || [];
      const latestDocs = pickLatestDocsByType(firmDocs);

            const docsStatus = {
        risk: getDocStatusFromDoc(latestDocs.risk),
        acil: getDocStatusFromDoc(latestDocs.acil),
        yillik: getYillikStatus(latestDocs),
        egitim: getDocStatusFromDoc(latestDocs.egitim),

        defter: getDefterStatus(latestDocs.defter || []),
      };

const iseGirisEgitimi = await IseGirisEgitimiKayit.findOne({
  firmaId: f._id,
}).lean();

const egitimKisiDurumu = getEgitimKisiDurumuFromDocs(
  iseGirisEgitimi ? [iseGirisEgitimi] : []
);


      const overall = getOverallStatus(docsStatus, egitimKisiDurumu);

const toplam = 5;

let tamam = 0;

if (docsStatus.risk.key === "valid") tamam++;
if (docsStatus.acil.key === "valid") tamam++;
if (docsStatus.yillik.key === "valid") tamam++;
if (egitimKisiDurumu.oran >= 50) tamam++;
if (docsStatus.defter.key === "valid") tamam++;

const genelEvrakOrani = Math.round((tamam / toplam) * 100);

      return {
        ...f,

egitimKisiDurumu,
egitimOran: egitimKisiDurumu.oran,
genelEvrakOrani,

        atanmisKullanici: assignedUser?._id || null,
        atanmisKullaniciId: assignedUser?._id ? String(assignedUser._id) : "",
        atanmisKullaniciAdSoyad: assignedUser ? safeUserName(assignedUser) : null,


dashboardDocs: {
  risk: docSummary(latestDocs.risk),
  acil: docSummary(latestDocs.acil),

  yillik: {
    egitim: docSummary(latestDocs.yillik_egitim),
    calisma: docSummary(latestDocs.yillik_calisma),
    degerlendirme: docSummary(latestDocs.yillik_degerlendirme),
  },

    egitim: docSummary(latestDocs.egitim),

  defter: (latestDocs.defter || []).map(docSummary),
},

        dashboardDocStatus: docsStatus,
        dashboardOverallStatus: overall,

        riskGecerlilik: docsStatus.risk.date || "",
        acilDurumGecerlilik: docsStatus.acil.date || "",
        yillikPlanGecerlilik: docsStatus.yillik.date || "",
        egitimGecerlilik: docsStatus.egitim.date || "",
 };
      })
    );


    /* 5) KULLANICI / LİMİT */
    const orgUsers = await User.find({ organization: orgId }).lean();
    const ticariUsers = orgUsers.filter((u) => roleOf(u) === "ticari_user");
    const aktifKullanici = ticariUsers.length;

    const kullaniciLimit =
      orgDoc?.userLimit ??
      req.user?.organizationUserLimit ??
      req.user?.userLimit ??
      0;

    /* 6) EXPIRED / UPCOMING GERÇEK BELGELER */
    const allTrackedDocs = [];

    for (const f of enrichedFirms) {
      const statusMap = f.dashboardDocStatus || {};
      const docMap = f.dashboardDocs || {};

      for (const type of ["risk", "acil", "yillik", "egitim"]) {
        const status = statusMap[type];
        const doc = docMap[type];

        if (!doc || !status || status.kalanGun === null) continue;

        allTrackedDocs.push({
          firmaId: String(f._id),
          firmaAdi: f.firmaAdi,
          type,
          belgeTuru: doc.belgeTuru || doc.title || type,
          title: doc.title || doc.belgeTuru || type,
          documentId: doc._id,
          gecerlilik: status.date,
          kalanGun: status.kalanGun,
          atanmisKullaniciAdSoyad: f.atanmisKullaniciAdSoyad || null,
        });
      }
    }

    const expiredDocs = allTrackedDocs
      .filter((x) => x.kalanGun < 0)
      .sort((a, b) => a.kalanGun - b.kalanGun)
      .slice(0, 20);

    const upcomingDocs = allTrackedDocs
      .filter((x) => x.kalanGun >= 0 && x.kalanGun <= 60)
      .sort((a, b) => a.kalanGun - b.kalanGun)
      .slice(0, 20);

    /* 7) FİRMA İSTATİSTİKLERİ */
    const toplamFirma = enrichedFirms.length;
    const atananFirmalar = enrichedFirms.filter((f) => !!f.atanmisKullanici).length;
    const atamaBekleyenFirmalar = Math.max(0, toplamFirma - atananFirmalar);

    const tamamlananFirmalar = enrichedFirms.filter(
      (f) => f.dashboardOverallStatus?.key === "complete"
    ).length;


const hicIslemYapilmayanFirmalar = enrichedFirms.filter((f) => {
  const docs = f.dashboardDocs || {};
  const yillik = docs.yillik || {};

  return (
    !docs.risk &&
    !docs.acil &&
    !yillik.egitim &&
    !yillik.calisma &&
    !yillik.degerlendirme &&
        !docs.egitim &&
    (!docs.defter || docs.defter.length === 0)
  );
}).length;


    const kismiTamamFirmalar = Math.max(
      0,
      toplamFirma - tamamlananFirmalar - hicIslemYapilmayanFirmalar
    );

    const askidaFirmalar = enrichedFirms.filter((f) => f.durum === "Askıda").length;

    /* 8) SON İŞLEMLER */
    const recentFirmActions = enrichedFirms.flatMap((f) => {
      const items = [];

      if (f.createdAt) {
        items.push({
          type: "FIRMA_CREATED",
          title: "Yeni firma eklendi",
          description: `${f.firmaAdi} firması sisteme eklendi.`,
          firmaAdi: f.firmaAdi,
          date: f.createdAt,
        });
      }

      if (
        f.updatedAt &&
        f.createdAt &&
        new Date(f.updatedAt).getTime() - new Date(f.createdAt).getTime() > 5000
      ) {
        items.push({
          type: "FIRMA_UPDATED",
          title: "Firma güncellendi",
          description: `${f.firmaAdi} firması güncellendi.`,
          firmaAdi: f.firmaAdi,
          date: f.updatedAt,
        });
      }

      return items;
    });

    const recentAssignmentActions = (allAssignments || []).flatMap((a) => {
      const items = [];
      const firm = enrichedFirms.find((f) => String(f._id) === String(a.firmId));
      const firmName = firm?.firmaAdi || "Firma";
      const userName = safeUserName(a?.userId);

      if (a.createdAt) {
        items.push({
          type: "USER_ASSIGNED_TO_FIRM",
          title: "Kullanıcı atandı",
          description: `${userName} kullanıcısı ${firmName} firmasına atandı.`,
          firmaAdi: firmName,
          date: a.createdAt,
        });
      }

      if (
        a.updatedAt &&
        a.createdAt &&
        new Date(a.updatedAt).getTime() - new Date(a.createdAt).getTime() > 5000 &&
        a.isActive === false
      ) {
        items.push({
          type: "USER_UNASSIGNED_FROM_FIRM",
          title: "Kullanıcı firmadan kaldırıldı",
          description: `${userName} kullanıcısının ${firmName} firması ataması kaldırıldı.`,
          firmaAdi: firmName,
          date: a.updatedAt,
        });
      }

      return items;
    });

    const recentDocumentActions = documents.slice(0, 30).map((d) => ({
      type: "DOCUMENT_CREATED",
      title: "Belge oluşturuldu",
      description: `${d.firmaAdi} için ${d.title || d.belgeTuru || "Belge"} oluşturuldu.`,
      firmaAdi: d.firmaAdi,
      documentId: d._id,
      belgeTuru: d.belgeTuru || d.title || "",
      date: d.createdAt || d.updatedAt,
    }));

    const recentActivities = [
      ...recentFirmActions,
      ...recentAssignmentActions,
      ...recentDocumentActions,
    ]
      .filter((x) => x.date)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 10);

    return res.json({
      ok: true,
      firms: enrichedFirms,
      expiredDocs,
      upcomingDocs,
      recentActivities,

      summary: {
        toplamFirma,
        atananFirmalar,
        atamaBekleyenFirmalar,
        aktifKullanici,
        kullaniciLimit: kullaniciLimit || 0,
        kalanKoltuk: Math.max((kullaniciLimit || 0) - (aktifKullanici || 0), 0),
        tamamlananFirmalar,
        hicIslemYapilmayanFirmalar,
        kismiTamamFirmalar,
        askidaFirmalar,
      },
    });
  } catch (err) {
    console.error("GET /api/dashboard hata:", err);
    return res.status(500).json({
      message: "Dashboard verileri alınamadı",
      error: err?.message,
    });
  }
});

module.exports = router;