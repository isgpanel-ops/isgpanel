const path = require("path");

require("dotenv").config({
  path: path.join(__dirname, ".env"),
  override: true,
});

console.log(
  "DATABASE_URL:",
  process.env.DATABASE_URL ? "✅ VAR" : "❌ YOK"
);
console.log("SUPER_ADMIN_NOTIFY_USER_IDS:", process.env.SUPER_ADMIN_NOTIFY_USER_IDS || "❌ YOK");


console.log("IYZICO_API_KEY:", process.env.IYZICO_API_KEY ? "✅ VAR" : "❌ YOK");
console.log("IYZICO_SECRET_KEY:", process.env.IYZICO_SECRET_KEY ? "✅ VAR" : "❌ YOK");
console.log("IYZICO_BASE_URL:", process.env.IYZICO_BASE_URL ? "✅ VAR" : "❌ YOK");


const express = require("express");
const cors = require("cors"); 
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const hpp = require("hpp");

const mongoose = require("mongoose");
const { verifyMailer } = require("./utils/mailer");
const fs = require("fs");
const multer = require("multer");
const archiver = require("archiver");

/* ROUTES */
const authRoutes = require("./routes/auth");
const firmaRoutes = require("./routes/firma");
const orgRoutes = require("./routes/organizationUsers");
const paymentRoutes = require("./routes/payment");
const pricingRoutes = require("./routes/pricing");
const plansRoutes = require("./routes/plans");
const assignmentRoutes = require("./routes/assignments");
const isgKatipAssignmentRoutes = require("./routes/isgKatipAssignments");
const profileRoutes = require("./routes/profile");
const kurumsalKimlikRoutes = require("./routes/kurumsalKimlik");
const destekAcilPdfRoutes = require("./routes/destekAcilPdfRoutes");
const guvenlikGirisRoutes = require("./routes/guvenlikGiris")
const firmsRoutes = require("./routes/firms");
const superAdminRoutes = require("./routes/superAdmin");
const superUsersRoutes = require("./routes/superUsers");
const superOverviewRoutes = require("./routes/superOverview");
const superAnnouncementsRoutes = require("./routes/superAnnouncements");
const superSystemStatusRoutes = require("./routes/superSystemStatus");
const teklifPublicRoutes = require("./routes/teklifPublic");
const teklifInboxRoutes = require("./routes/teklifInbox");
const publicRegisterRoutes = require("./routes/publicRegister");
const checkoutRoutes = require("./routes/checkout");
const superPilotsRoutes = require("./routes/superPilots");
const authMiddleware = require("./middleware/auth");
const jwt = require("jsonwebtoken");
const User = require("./models/User");
const PdfJob = require("./models/PdfJob");
const crypto = require("crypto");
const YillikDegerlendirmeForm = require("./models/YillikDegerlendirmeForm");
const YillikCalismaPlaniForm = require("./models/YillikCalismaPlaniForm");

function optionalAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return next();

    const SECRET = process.env.JWT_SECRET || "SUPER_SECRET_KEY";
    req.user = jwt.verify(token, SECRET); // token geçerliyse req.user dolar
    return next();
  } catch (e) {
    // token hatalıysa bile PDF üretimini engelleme
    return next();
  }
}

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

const notificationRoutes = require("./routes/notifications");
const paymentWebhookRoutes = require("./routes/paymentWebhook");
const billingRoutes = require("./routes/billing");
const subscriptionRoutes = require("./routes/subscription");
const subscriptionStartRoutes = require("./routes/subscriptionStart");

const { startScheduler } = require("./jobs/notificationScheduler");
const { startWorker } = require("./jobs/firmAssignmentNotificationJob");
require("./cron/notificationCron");

const meAnnouncementsRoutes = require("./routes/meAnnouncements");
const documentsRoutes = require("./routes/documents");
const supportRoutes = require("./routes/support");
const dashboardRoutes = require("./routes/dashboard");
const kkdRoutes = require("./routes/kkd");
const defterNushalariRoutes = require("./routes/defterNushalari");
const kurulNushalariRoutes = require("./routes/kurulNushalari");
const periyodikRaporlarRoutes = require("./routes/periyodikRaporlar");
const isHijyenRaporlariRoutes = require("./routes/isHijyenRaporlari");
const egitimRoutes = require("./routes/egitim");
const riskDraftRoutes = require("./routes/riskDraft");
const yuksekteCalismaKatilimcilarRoutes = require("./routes/yuksekteCalismaKatilimcilar");
const dofRoutes = require("./routes/dof");


/* MODELS (senin dosyandaki gibi kalsın) */
const KurumsalKimlik = require("./models/KurumsalKimlik");

let FirmUser = null;
try {
  FirmUser = require("./models/FirmUser");
} catch (_) {
  FirmUser = null;
}

/* =========================
   ✅ PDF MODÜLLERİ (KORUNDU + HATA KESİLDİ)
   ========================= */
function loadPdfCreator(modPath, fnName) {
  const mod = require(modPath);

  if (typeof mod === "function") return mod;
  if (fnName && mod && typeof mod[fnName] === "function") return mod[fnName];
  if (mod && typeof mod.default === "function") return mod.default;
  if (fnName && mod?.default && typeof mod.default[fnName] === "function")
    return mod.default[fnName];

  if (mod && typeof mod === "object") {
    const firstFnKey = Object.keys(mod).find((k) => typeof mod[k] === "function");
    if (firstFnKey) return mod[firstFnKey];
  }

  throw new Error(`PDF module load failed: ${modPath} (function not found)`);
}

// ✅ Senin dosya isimlerin aynı bırakıldı
const createProsedurPdf = loadPdfCreator("./pdf/prosedur", "createProsedurPdf");
const createRiskDegerlendirmesiPdf = loadPdfCreator(
  "./pdf/riskdegerlendirmesi.playwright",
  "createRiskDegerlendirmesiPdf"
);
const createRiskEkipPdf = loadPdfCreator("./pdf/riskEkip", "createRiskEkipPdf");
const createDofPdf = loadPdfCreator("./pdf/dof", "createDofPdf");
const createAcilEkipPdf = loadPdfCreator("./pdf/acilEkip", "createAcilEkipPdf");
const createYillikEgitimPlaniPdf = loadPdfCreator(
  "./pdf/yillikEgitimPlani.puppeteer",
  "createYillikEgitimPlaniPdf"
);

const createYillikCalismaPlaniPdf = loadPdfCreator(
  "./pdf/yillikCalismaPlani.puppeteer",
  "createYillikCalismaPlaniPdf"
);

const createYillikDegerlendirmeRaporuPdf = loadPdfCreator(
  "./pdf/yillikDegerlendirmeRaporu.puppeteer",
  "yillikDegerlendirmeRaporuPdf"
);


const createAcilDurumPlaniPdf = loadPdfCreator(
  "./pdf/acildurumplani",
  "createAcilDurumPlaniPdf"
);
const createEgitimKatilimFormuPdf = loadPdfCreator(
  "./pdf/egitimKatilimFormu",
  "createEgitimKatilimFormuPdf"
);
const createCalisanTemsilcisiEgitimKatilimFormuPdf = loadPdfCreator(
  "./pdf/calisanTemsilcisiEgitimKatilimFormu",
  "createCalisanTemsilcisiEgitimKatilimFormuPdf"
);

const createCalisanTemsilcisiAtamaFormuPdf = loadPdfCreator(
  "./pdf/calisanTemsilcisiAtamaFormu",
  "createCalisanTemsilcisiAtamaFormuPdf"
);

const createDestekAcilEgitimKatilimFormuPdf = loadPdfCreator(
  "./pdf/destekAcilEgitimKatilimFormu",
  "createDestekAcilEgitimKatilimFormuPdf"
);

const createDestekElemaniAtamaFormuPdf = loadPdfCreator(
  "./pdf/destekElemaniAtamaFormu",
  "createDestekElemaniAtamaFormuPdf"
);


const createSertifikaPdf = loadPdfCreator("./pdf/sertifika", "createSertifikaPdf");

const {
  createIseBaslamaFormuPdf,
} = require("./pdf/iseBaslamaFormu");

const iseGirisTestMod = require("./pdf/isegirisTest");

const createIseGirisTestPdf =
  iseGirisTestMod.createIseGirisTestPdf ||
  iseGirisTestMod.createIsegirisTestPdf ||
  iseGirisTestMod.default;

// ✅ GENEL TALİMAT PDF (YENİ)
const {
  genelTalimatPdf,
  genelTalimatPdfBulk,
} = require("./pdf/talimatGenel");

// ✅ İNŞAAT TALİMAT PDF (YENİ)
const {
  insaatTalimatPdf,
  insaatTalimatPdfBulk,
} = require("./pdf/talimatInsaat");

// ✅ ÖNERİ TALİMAT PDF (YENİ)
const {
  oneriTalimatPdf,
  oneriTalimatPdfBulk,
} = require("./pdf/talimatOneri");

const {
  kkdTeslimTutanagiPdf,
  kkdTeslimTutanagiPdfBulk,
} = require("./pdf/kkdTeslimTutanagi");

/* =========================
   ✅ YÜKSEKTE ÇALIŞMA PDF MODÜLLERİ (YENİ)
   ========================= */

let createYuksekteKatilimPdf = null;
let createYuksekteKatilimPdfBulk = null;
let createYuksekteSertifikaPdf = null;
let createYuksekteSertifikaPdfBulk = null;

try {
  const ykKatilim = require("./pdf/yuksekteEgitimKatilimFormu");
  createYuksekteKatilimPdf =
    ykKatilim.createYuksekteKatilimPdf ||
    ykKatilim.default?.createYuksekteKatilimPdf ||
    (typeof ykKatilim === "function" ? ykKatilim : null);

  createYuksekteKatilimPdfBulk =
    ykKatilim.createYuksekteKatilimPdfBulk ||
    ykKatilim.default?.createYuksekteKatilimPdfBulk ||
    null;

  const ykSert = require("./pdf/yuksekteSertifika");
  createYuksekteSertifikaPdf =
    ykSert.createYuksekteSertifikaPdf ||
    ykSert.default?.createYuksekteSertifikaPdf ||
    (typeof ykSert === "function" ? ykSert : null);

  createYuksekteSertifikaPdfBulk =
    ykSert.createYuksekteSertifikaPdfBulk ||
    ykSert.default?.createYuksekteSertifikaPdfBulk ||
    null;
} catch (e) {
  console.warn(
    "Yüksekte çalışma PDF modülleri yüklenemedi (dosyalar eklenmemiş olabilir):",
    e?.message
  );
}

/* =========================
   ✅ ZIP + HEADER SAFE HELPERS
   ========================= */
function toAsciiFileName(input = "") {
  return String(input)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/İ/g, "I")
    .replace(/ğ/g, "g")
    .replace(/Ğ/g, "G")
    .replace(/ş/g, "s")
    .replace(/Ş/g, "S")
    .replace(/ç/g, "c")
    .replace(/Ç/g, "C")
    .replace(/ö/g, "o")
    .replace(/Ö/g, "O")
    .replace(/ü/g, "u")
    .replace(/Ü/g, "U")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 180);
}

function safeContentDisposition(fileName) {
  const safe = toAsciiFileName(fileName || "dosya");
  return `attachment; filename="${safe}"`;
}

/* =========================
   ✅ "FARKLI TARİHLER TEK PDF" PROBLEMİ ÇÖZÜMÜ
   ========================= */
function pickDateRangeKey(k) {
  const start =
    k?.baslangicTarihi ||
    k?.egitimBaslangic ||
    k?.tarihBaslangic ||
    k?.tarihISO ||
    k?.tarih ||
    "";
  const end =
    k?.bitisTarihi ||
    k?.egitimBitis ||
    k?.tarihBitis ||
    k?.bitis ||
    k?.tarihISO ||
    k?.tarih ||
    "";
  return `${String(start)}__${String(end)}`;
}

function getDistinctDateRangeCount(katilimcilar = []) {
  const set = new Set();
  for (const k of katilimcilar) set.add(pickDateRangeKey(k));
  return set.size;
}

function rejectIfMultiDateInSinglePdf(req, res, next) {
  try {
    const payload = req.body || {};
    const list = Array.isArray(payload?.katilimcilar) ? payload.katilimcilar : [];
    if (list.length <= 1) return next();

    const distinct = getDistinctDateRangeCount(list);
    if (distinct <= 1) return next();

    return res.status(409).json({
      ok: false,
      code: "MULTI_DATE_NOT_ALLOWED",
      message:
        "Seçili kayıtlarda farklı eğitim tarihleri var. Tek PDF yerine toplu ZIP indir (pdf-bulk) kullanmalısın.",
    });
  } catch (e) {
    console.error("rejectIfMultiDateInSinglePdf hata:", e);
    return next();
  }
}

/* =========================
   ✅ LOGO ENJEKTE
   ========================= */
const toAbs = (url) => {
  if (!url) return "";
  if (url.startsWith("data:image")) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;

  const base =
    process.env.PUBLIC_BASE_URL ||
    `http://localhost:${process.env.PORT || 5001}`;

  return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
};

async function injectKurumsalLogo(req, res, next) {
  try {
    const firmaId = req.body?.firmaId || req.body?.firma?.id || req.body?.firma?.firmaId;
    if (!firmaId) return next();

    const k = await KurumsalKimlik.findOne({ firmaId }).lean();
    if (!k) return next();

    req.body.kurumsal = req.body.kurumsal || {};
    const logoUrlRel = k.logoUrl || "";
    const logoB64 = k.logoBase64 || k.logo || "";
    const absLogoUrl = toAbs(logoUrlRel);
    const logo = absLogoUrl || logoB64 || "";
    if (!logo) return next();

    req.body.kurumsal.logoUrl = absLogoUrl || "";
    req.body.kurumsal.logo = logoB64 || "";
    req.body.logo = req.body.logo || logo;

    return next();
  } catch (e) {
    console.error("injectKurumsalLogo hata:", e);
    return next();
  }
}

/* =========================
   ✅ DEMO USER DETECTION MIDDLEWARE
   ========================= */
function injectDemoFlag(req, res, next) {
  try {
    const isDemo = req.user && (req.user.isDemo === true || req.user.demo === true);

    if (isDemo) {
      req.body = req.body || {};
      req.body.__isDemoUser = true;
      req.body.demo = true; // ✅ prosedur.js bunu yakalar
    }

    return next();
  } catch (e) {
    console.error("injectDemoFlag hata:", e);
    return next();
  }
}



/* 👉 TÜM PDF İSTEKLERİNE UYGULA */
const pdfMiddleware = [optionalAuth, injectKurumsalLogo, injectDemoFlag];



const { Pool } = require("pg");
const pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
async function ensureInboxTables() {
  try {
    await pgPool.query(`
      create table if not exists inbox_messages (
        id bigserial primary key,
        to_email text,
        from_email text,
        from_name text,
        subject text,
        snippet text,
        text_body text,
        html_body text,
        status text not null default 'new',
        received_at timestamptz not null default now(),
        meta jsonb
      );
    `);

   // 0) Eski tabloda "meta" farklı adla kaldıysa (ör: "meta_data"), meta'ya çevir
await pgPool
  .query(`alter table inbox_messages rename column meta_data to meta;`)
  .catch(() => {});

// 1) Kolonlar eksikse ekle
await pgPool.query(`alter table inbox_messages add column if not exists to_email text;`);
await pgPool.query(`alter table inbox_messages add column if not exists from_email text;`);
await pgPool.query(`alter table inbox_messages add column if not exists from_name text;`);
await pgPool.query(`alter table inbox_messages add column if not exists subject text;`);
await pgPool.query(`alter table inbox_messages add column if not exists snippet text;`);
await pgPool.query(`alter table inbox_messages add column if not exists text_body text;`);
await pgPool.query(`alter table inbox_messages add column if not exists html_body text;`);
await pgPool.query(`alter table inbox_messages add column if not exists meta jsonb;`);

// 2) Defaultlar (hata verirse takılma)
await pgPool.query(`alter table inbox_messages alter column status set default 'new';`).catch(()=>{});
await pgPool.query(`alter table inbox_messages alter column received_at set default now();`).catch(()=>{});

// ❌ status ekleme satırını kaldırdık çünkü create table içinde zaten var.


    // status/received_at default yoksa (hata verirse önemseme)
    await pgPool.query(`alter table inbox_messages alter column status set default 'new';`).catch(()=>{});
    await pgPool.query(`alter table inbox_messages alter column received_at set default now();`).catch(()=>{});

    console.log("✅ inbox_messages tablosu/kolonları hazır");
  } catch (e) {
    console.error("❌ inbox_messages ensure hatası:", e?.message || e);
  }
}



ensureInboxTables();


const app = express();


app.set("trust proxy", 1);

// ✅ Helmet
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

// ✅ Mongo injection koruması
app.use(mongoSanitize());

// ✅ Parametre pollution koruması
app.use(hpp());

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    message: "Çok fazla istek gönderildi. Lütfen bekleyin."
  }
});

app.use(globalLimiter);

// ✅ payment.js'nin beklediği yer
app.locals.pgPool = pgPool;


/* MIDDLEWARE */
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(express.json({ limit: "50mb" }));


/* ✅ CORS */
const allowedOrigins = new Set([
  "https://app.isgpanel.tr",
  "https://isgpanel.tr",
  "http://localhost:5173",
  "http://localhost:3000",
]);

const corsOptions = {
  origin(origin, callback) {
    // Postman, server-to-server, same-origin gibi origin olmayan istekleri engelleme
    if (!origin) return callback(null, true);

    // ✅ kendi originlerin
    if (allowedOrigins.has(origin)) {
      return callback(null, true);
    }

    if (origin.startsWith("chrome-extension://")) {
      return callback(null, true);
    }

    // ✅ iyzico checkout / callback test ve canlı akışı
    if (origin.includes("iyzipay.com")) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));



/* STATIC */
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/output", express.static(path.join(__dirname, "..", "output")));
app.use("/temp_pdfs", express.static(path.join(__dirname, "temp_pdfs")));
app.use("/temp_pdfs", express.static(path.join(__dirname, "..", "temp_pdfs")));
/* DB */
const mongoUri = (process.env.MONGO_URI || "").trim();
console.log(
  "MONGO_URI:",
  mongoUri ? "✅ VAR" : "❌ YOK"
);

if (mongoUri) {
  mongoose
    .connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
    })
    .then(() => {
      console.log("☑ MongoDB connected");
    })
    .catch((err) => {
      console.error("✘ MongoDB connect error:", err?.message || err);
    });
} else {
  console.log("ℹ MongoDB devre dışı: MONGO_URI tanımlı değil");
}

// ✅ FRONTEND "/api/guvenlik-giris" root çağırıyorsa 500 yemesin diye
app.all("/api/guvenlik-giris", (req, res) => {
  return res.status(200).json({
    ok: true,
    message:
      "guvenlik-giris root OK. Kullanılabilir yollar: /me, /settings, /change-password, /logout-all",
    routes: {
      me: "/api/guvenlik-giris/me",
      settings: "/api/guvenlik-giris/settings",
      changePassword: "/api/guvenlik-giris/change-password",
      logoutAll: "/api/guvenlik-giris/logout-all",
    },
  });
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    message: "Çok fazla giriş denemesi."
  }
});
app.use("/api/auth/login", authLimiter);

/* ROUTE USE */
app.use("/api/auth", authRoutes(pgPool));

app.use("/api/firma", firmaRoutes);
app.use("/api/firms", authMiddleware, firmsRoutes);


// =========================
// ✅ FİRMA KİŞİLER ENDPOINT
// =========================
const Firma = require("./models/Firma");

const AcilEkipFormSchema = new mongoose.Schema(
  {
    firmaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Firma",
      required: true,
      index: true,
      unique: true,
    },
    teams: {
      type: Array,
      default: [],
    },
    meta: {
      type: Object,
      default: {},
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: "acil_ekip_formlari",
  }
);

const AcilEkipForm =
  mongoose.models.AcilEkipForm ||
  mongoose.model("AcilEkipForm", AcilEkipFormSchema);

// Firma kisiler GET
app.get("/api/firma/:id/kisiler", authMiddleware, async (req, res) => {
  try {
    const firma = await Firma.findById(req.params.id).lean();
    if (!firma) return res.status(404).json({ message: "Firma bulunamadı" });

    return res.json(firma.kisiler || {});
  } catch (err) {
    console.error("Firma kisiler GET hata:", err);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});

// =========================
// 🏢 Kurumsal Bilgi / Logo GET (ALIAS)
// =========================

app.get("/api/firma/:id/kurumsal", authMiddleware, async (req, res) => {
  try {
   const kayit = await KurumsalKimlik.findOne({
  organizationId: req.user.organizationId,
}).lean();

    if (!kayit) {
      return res.status(404).json({ message: "Kurumsal kayıt bulunamadı" });
    }

    return res.json({ ok: true, payload: kayit });
  } catch (err) {
    console.error("GET /api/firma/:id/kurumsal hata:", err);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});

app.get("/api/firma/:id/kurumsal-bilgiler", authMiddleware, async (req, res) => {
  try {
    const kayit = await KurumsalKimlik.findOne({
  organizationId: req.user.organizationId,
}).lean();

    if (!kayit) {
      return res.status(404).json({ message: "Kurumsal kayıt bulunamadı" });
    }

    return res.json({ ok: true, payload: kayit });
  } catch (err) {
    console.error("GET /api/firma/:id/kurumsal-bilgiler hata:", err);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});

app.get("/api/kurumsal/:id", authMiddleware, async (req, res) => {
  try {
    const kayit = await KurumsalKimlik.findOne({
  organizationId: req.user.organizationId,
}).lean();

    if (!kayit) {
      return res.status(404).json({ message: "Kurumsal kayıt bulunamadı" });
    }

    return res.json({ ok: true, payload: kayit });
  } catch (err) {
    console.error("GET /api/kurumsal/:id hata:", err);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});

app.get("/api/kurumsal-bilgiler/:id", authMiddleware, async (req, res) => {
  try {
    const kayit = await KurumsalKimlik.findOne({
  organizationId: req.user.organizationId,
}).lean();

    if (!kayit) {
      return res.status(404).json({ message: "Kurumsal kayıt bulunamadı" });
    }

    return res.json({ ok: true, payload: kayit });
  } catch (err) {
    console.error("GET /api/kurumsal-bilgiler/:id hata:", err);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});


// Firma kisiler PUT
app.put("/api/firma/:id/kisiler", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const kisiler = {
      isveren: req.body.isverenVekiliAdSoyad || "",
      uzman: req.body.isgUzmaniAdSoyad || "",
      hekim: req.body.isyeriHekimiAdSoyad || "",
      temsilci: req.body.calisanTemsilcisiAdSoyad || "",
      destek: req.body.destekElemaniAdSoyad || "",
      bilgi: req.body.bilgiSahibiKisiAdSoyad || "",
    };

    await Firma.findByIdAndUpdate(
      id,
      { $set: { kisiler } },
      { new: true }
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error("Firma kisiler PUT hata:", err);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});

// =========================
// ✅ ACIL EKIP FORM GET
// =========================
app.get("/api/acil-ekipleri/form/:firmaId", authMiddleware, async (req, res) => {
  try {
    const { firmaId } = req.params;

    const form = await AcilEkipForm.findOne({ firmaId }).lean();

    if (!form) {
      return res.status(404).json({ message: "Acil ekip formu bulunamadı" });
    }

    return res.json(form);
  } catch (err) {
    console.error("Acil ekip form GET hata:", err);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});

// =========================
// ✅ ACIL EKIP FORM PUT
// =========================
app.put("/api/acil-ekipleri/form/:firmaId", authMiddleware, async (req, res) => {
  try {
    const { firmaId } = req.params;

    const updated = await AcilEkipForm.findOneAndUpdate(
      { firmaId },
      {
        $set: {
          firmaId,
          teams: Array.isArray(req.body.teams) ? req.body.teams : [],
          meta: req.body.meta || {},
          updatedAt: req.body.updatedAt ? new Date(req.body.updatedAt) : new Date(),
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
      message: "Acil ekip formu kaydedildi",
      data: updated,
    });
  } catch (err) {
    console.error("Acil ekip form PUT hata:", err);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});


app.use("/api/notifications", notificationRoutes);
app.use("/api/webhooks/payment", paymentWebhookRoutes);

app.use("/api/org", orgRoutes);
app.use("/api/payment", paymentRoutes(pgPool));
app.use("/api/billing", optionalAuth, billingRoutes);
app.use("/api/subscription", subscriptionRoutes(pgPool));

app.use("/api/subscription", subscriptionStartRoutes);

app.use("/api/pricing", pricingRoutes);
app.use("/api/plans", plansRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/isg-katip", authMiddleware, isgKatipAssignmentRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/kurumsal-kimlik", kurumsalKimlikRoutes);
app.use("/api/support", supportRoutes(pgPool));

app.use("/api", egitimRoutes);
app.use("/api", riskDraftRoutes);
app.use("/api", yuksekteCalismaKatilimcilarRoutes);
app.use("/api/dof", authMiddleware, dofRoutes);
app.use("/api/guvenlik-giris", guvenlikGirisRoutes);
app.use("/api/documents", documentsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/kkd", kkdRoutes);
app.use("/api/defter-nushalari", authMiddleware, defterNushalariRoutes);
app.use("/api/kurul-nushalari", authMiddleware, kurulNushalariRoutes);
app.use(
  "/api/periyodik-raporlar",
  authMiddleware,
  periyodikRaporlarRoutes
);

app.use(
  "/api/is-hijyen-raporlari",
  authMiddleware,
  isHijyenRaporlariRoutes
);
// =========================
// ✅ BELGE DOĞRULAMA API
// =========================
app.get("/api/verify/:code", async (req, res) => {
  try {
    const { code } = req.params;

    const job = await PdfJob.findOne({
      verificationCode: String(code).trim(),
    }).lean();

    if (!job) {
      return res.status(404).json({
        ok: false,
        message: "Belge bulunamadı",
      });
    }

    const data = job.data || {};
    const firma = data?.firma || {};
    const kisiler = data?.kisiler || {};

const katilimcilar =
  Array.isArray(data?.katilimcilar)
    ? data.katilimcilar
    : [];

const firstPerson =
  katilimcilar?.[0] || {};

const personelImza =
  firstPerson?.imzalar?.genel ||
  firstPerson?.imzalar?.teknik ||
  firstPerson?.imzalar?.saglik ||
  firstPerson?.imzalar?.iseOzelRiskler ||
  firstPerson?.imzalar?.personel ||
  firstPerson?.personelImzalari?.personel ||
  firstPerson?.personelImzasi ||
  {};

   const imzalar = data?.imzalar || {};

function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLocaleUpperCase("tr-TR")
    .replace(/\s+/g, " ");
}

function checkRole(roleKey, nameValue) {
  const roleObj = imzalar?.[roleKey] || {};
  const imzaObj = roleObj?.imza || {};

  const roleImza = imzaObj?.dataUrl || "";

  const hasSignature =
    typeof roleImza === "string" &&
    roleImza.startsWith("data:image");

  const hasPerson =
    !!String(nameValue || "").trim();

  const imzaOwner =
    imzaObj?.adSoyad ||
    imzaObj?.name ||
    imzaObj?.ownerName ||
    imzaObj?.kisi ||
    roleObj?.adSoyad ||
    roleObj?.name ||
    roleObj?.ownerName ||
    "";

  const hasOwner =
    !!String(imzaOwner || "").trim();

  const nameMatches =
    !hasOwner ||
    normalizeName(imzaOwner) === normalizeName(nameValue);

  const needsUpdate =
    imzaObj?.needsUpdate === true ||
    imzaObj?.guncelleGerekli === true ||
    imzaObj?.guncel === false ||
    imzaObj?.isCurrent === false ||
    roleObj?.needsUpdate === true ||
    roleObj?.guncelleGerekli === true ||
    roleObj?.guncel === false ||
    roleObj?.isCurrent === false ||
    nameMatches === false;

  const guncel =
    hasPerson &&
    hasSignature &&
    !needsUpdate;

  return {
  adSoyad: nameValue || "",

  durum: guncel,

  signedAt:
    imzaObj?.signedAt ||
    imzaObj?.updatedAt ||
    roleObj?.signedAt ||
    roleObj?.updatedAt ||
    null,

  deviceType:
    imzaObj?.deviceType ||
    roleObj?.deviceType ||
    "",

  signerRole:
    imzaObj?.signerRole ||
    roleObj?.signerRole ||
    roleKey,

  signatureType:
    imzaObj?.signatureType ||
    roleObj?.signatureType ||
    "imza",

  signatureHash:
    imzaObj?.signatureHash ||
    roleObj?.signatureHash ||
    "",

  message: guncel
    ? "İmza doğrulandı"
    : !hasPerson
    ? "Henüz doğrulanmadı"
    : !hasSignature
    ? "İmza bulunamadı"
    : "İmza güncel değil",
};
}

    return res.json({
      ok: true,

      verificationCode: job.verificationCode,
      rawType: job.type,
      belgeTipi:
        job.type === "prosedur"
          ? "Risk Değerlendirmesi"
          : job.type,

      firmaAdi:
        firma?.firmaAdi ||
        data?.firmaAdi ||
        "",

      hazirlamaTarihi:
        data?.tarihler?.hazirlamaTr ||
        "",

      gecerlilikTarihi:
        data?.tarihler?.gecerlilikTr ||
        "",

personel: {
  adSoyad:
    firstPerson?.adSoyad || "",

  tc:
    firstPerson?.tc || "",

  egitimTarihiBaslangic:
    firstPerson?.baslangicTarihi || "",

  egitimTarihiBitis:
    firstPerson?.bitisTarihi || "",

  egitimTarihi:
    firstPerson?.egitimTarihi ||
    firstPerson?.tarih ||
    "",

iseGirisTarihi:
  firstPerson?.iseGirisTarihi ||
  firstPerson?.iseBaslamaTarihi ||
  firstPerson?.girisTarihi ||
  "",

  foto:
    firstPerson?.personelFoto ||
    firstPerson?.personelFotoDataUrl ||
    "",

  signedAt:
    personelImza?.signedAt ||
    personelImza?.createdAt ||
    "",
},

     imzalar: {
  isveren: checkRole(
    "isveren",
    kisiler?.isveren
  ),

  uzman: checkRole(
    "uzman",
    kisiler?.uzman
  ),

  hekim: checkRole(
    "hekim",
    kisiler?.hekim
  ),

  temsilci: checkRole(
    "temsilci",
    kisiler?.temsilci
  ),

  destek: checkRole(
    "destek",
    kisiler?.destek
  ),

  bilgi: checkRole(
    "bilgi",
    kisiler?.bilgi ||
      kisiler?.bilgiSahibi ||
      kisiler?.bilgiSahibiKisi
  ),
}, 


    });
  } catch (e) {
    console.error("verify api hata:", e);

    return res.status(500).json({
      ok: false,
      message: "Doğrulama yapılamadı",
    });
  }
});

app.use("/api/public", teklifPublicRoutes(pgPool));
app.use("/api/public", publicRegisterRoutes(pgPool));
app.use("/api", checkoutRoutes(pgPool));


const teklifRouter = teklifInboxRoutes(pgPool);

// ✅ Super admin tarafı (full route set)
app.use("/api/super", authMiddleware, teklifRouter);

// ✅ Ticari panel tarafı: SADECE /offers/my (ve alias) geçsin
app.use("/api", authMiddleware, teklifRouter);



app.get("/api/health", async (req, res) => {
  try {
    const mongoReady =
      mongoose.connection &&
      mongoose.connection.readyState === 1;

    return res.status(mongoReady ? 200 : 503).json({
      ok: mongoReady,
      service: "isgpanel-api",
      mongo: mongoReady ? "up" : "down",
      uptimeSec: Math.floor(process.uptime()),
      timestamp: Date.now(),
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      service: "isgpanel-api",
      error: err.message,
      timestamp: Date.now(),
    });
  }
});


app.use("/api/super", authMiddleware, superSystemStatusRoutes);
app.use("/api/super", authMiddleware, superAdminRoutes);
app.use("/api/super", authMiddleware, superUsersRoutes);

app.use("/api/super/invoices/:id/pdf", (req, res, next) => {
  if (req.query.token && !req.headers.authorization) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
});
app.use("/api/super", authMiddleware, superOverviewRoutes);
app.use("/api/super/pilots", superPilotsRoutes(pgPool));

app.use("/api/super/announcements", authMiddleware, superAnnouncementsRoutes);
app.use("/api/me/announcements", authMiddleware, meAnnouncementsRoutes);





// app.use("/api/destek-acil", destekAcilPdfRoutes);



/* =========================
   ✅ UPLOAD ENDPOINTS (DÜZELTİLDİ)
   - topalanma/hastane response: { ok:true, url }
   - tahliye endpoint eklendi
   ========================= */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "uploads");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const name = `${Date.now()}_${Math.random().toString(16).slice(2)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
});

app.post("/api/upload/toplanma", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, message: "Dosya yok" });
  const url = `/uploads/${req.file.filename}`;
  res.json({ ok: true, url });
});

app.post("/api/upload/tahliye", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, message: "Dosya yok" });
  const url = `/uploads/${req.file.filename}`;
  res.json({ ok: true, url });
});

app.post("/api/upload/hastane", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, message: "Dosya yok" });
  const url = `/uploads/${req.file.filename}`;
  res.json({ ok: true, url });
});

/* =========================
   ✅ PDF ENDPOINTS
   ========================= */
app.post("/api/pdf/risk-degerlendirmesi", pdfMiddleware, async (req, res) => {
  try {
    const pdf = await createRiskDegerlendirmesiPdf(req.body);

    // ✅ Belgelerime kalıcı kayıt
    if (req.body?.persist === true) {
      const absPath = path.resolve(pdf);
      const outputRoot = path.join(__dirname, "..", "output");
      const fileName = path.basename(absPath);

      if (!absPath.startsWith(outputRoot)) {
        return res.status(500).json({
          ok: false,
          message: "PDF output yolu beklenen klasörde değil.",
        });
      }

      const relPath = `/output/${fileName}`;
      const base =
        process.env.PUBLIC_BASE_URL ||
        `${req.protocol}://${req.get("host")}`;

      const absoluteUrl = `${base}${relPath}`;

      return res.json({
        ok: true,
        fileUrl: relPath,
        absoluteUrl,
      });
    }

    return res.sendFile(path.resolve(pdf));
  } catch (e) {
    console.error("risk-degerlendirmesi pdf hata:", e);
    res.status(500).send("Risk PDF üretilemedi.");
  }
});


app.post("/api/prosedur/pdf", pdfMiddleware, async (req, res) => {
  try {
    const isDemo = Boolean(
      req.user?.demo === true ||
      req.user?.isDemo === true ||
      req.body?.demo === true ||
      req.body?.__isDemoUser === true
    );

    req.body = req.body || {};
    req.body.demo = isDemo;
    req.body.isDemo = isDemo;
    req.body.__isDemoUser = isDemo;

   const verificationCode =
  req.body.verificationCode ||
  crypto.randomBytes(5).toString("hex").toUpperCase();

req.body.verificationCode = verificationCode;

    const createdByUserId = String(req.user?._id || req.user?.id || "");
    const organizationId = String(
      req.user?.organizationId ||
      req.user?.organizationUuid ||
      req.user?._id ||
      req.user?.id ||
      ""
    );

   const job = await PdfJob.create({
  type: "prosedur",
  status: "queued",
  data: { ...req.body },
  createdByUserId,
  organizationId,
  verificationCode,
});

    return res.status(202).json({
      ok: true,
      jobId: String(job._id),
      status: "queued",
      message: "Prosedür PDF oluşturma kuyruğa alındı",
    });
  } catch (e) {
    console.error("prosedur job hata:", e);
    return res.status(500).json({
      ok: false,
      message: "Prosedür PDF kuyruğa alınamadı",
      error: e?.message,
    });
  }
});

app.get("/api/prosedur/pdf-job/:jobId", authMiddleware, async (req, res) => {
  try {
    const { jobId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(String(jobId))) {
      return res.status(400).json({
        ok: false,
        message: "Geçersiz jobId",
      });
    }

    const userId = String(req.user?._id || req.user?.id || "");
    const organizationId = String(
      req.user?.organizationId ||
      req.user?.organizationUuid ||
      req.user?._id ||
      req.user?.id ||
      ""
    );

    const job = await PdfJob.findOne({
      _id: jobId,
      $or: [
        { createdByUserId: userId },
        { organizationId },
      ],
    }).lean();

    if (!job) {
      return res.status(404).json({
        ok: false,
        message: "Job bulunamadı",
      });
    }

    return res.json({
      ok: true,
      jobId: String(job._id),
      status: job.status,
      resultFileUrl: job.resultFileUrl || "",
      resultFilePath: job.resultFilePath || "",
      error: job.error || "",
      startedAt: job.startedAt || null,
      finishedAt: job.finishedAt || null,
      createdAt: job.createdAt || null,
      updatedAt: job.updatedAt || null,
    });
  } catch (e) {
    console.error("prosedur pdf-job hata:", e);
    return res.status(500).json({
      ok: false,
      message: "Job durumu alınamadı",
      error: e?.message,
    });
  }
});


app.post("/api/pdf/risk-ekip", pdfMiddleware, async (req, res) => {
  try {
    const pdf = await createRiskEkipPdf(req.body);
    res.sendFile(path.resolve(pdf));
  } catch (e) {
    console.error("risk-ekip pdf hata:", e);
    res.status(500).send("Risk Ekip PDF üretilemedi.");
  }
});

app.post("/api/dof/pdf", pdfMiddleware, async (req, res) => {
  try {
    const pdf = await createDofPdf(req.body);
    res.sendFile(path.resolve(pdf));
  } catch (e) {
    console.error("dof pdf hata:", e);
    res.status(500).send("DOF PDF üretilemedi.");
  }
});

app.post("/api/acil-ekipleri/pdf", pdfMiddleware, async (req, res) => {
  try {
    const pdfBuffer = await createAcilEkipPdf(req.body);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'inline; filename="acil-ekipleri.pdf"');
    return res.send(pdfBuffer);
  } catch (e) {
    console.error("acil-ekipleri pdf hata:", e);
    return res.status(500).send("Acil Ekipleri PDF üretilemedi.");
  }
});


app.post("/api/yillik-egitim-plani/pdf", pdfMiddleware, async (req, res) => {
  try {
    const pdf = await createYillikEgitimPlaniPdf(req.body);
    res.sendFile(path.resolve(pdf));
  } catch (e) {
    console.error("yillik-egitim-plani pdf hata:", e);
    res.status(500).send("Yıllık Eğitim Planı PDF üretilemedi.");
  }
});

app.get("/api/yillik-calisma-plani/form/:firmaId", authMiddleware, async (req, res) => {
  try {
    const { firmaId } = req.params;
    const orgIdCandidates = buildOrgIdCandidates(req.user);

    if (!firmaId) {
      return res.status(400).json({ message: "firmaId zorunlu" });
    }

    if (!orgIdCandidates.length) {
      return res.status(400).json({ message: "Organizasyon bulunamadı" });
    }

    const form = await YillikCalismaPlaniForm.findOne({
      organizationId: { $in: orgIdCandidates },
      firmaId: String(firmaId),
      type: "yillik-calisma-plani",
    }).lean();

    return res.json({
      ok: true,
      form: form || null,
    });
  } catch (err) {
    console.error("YÇP form GET hata:", err);
    return res.status(500).json({
      ok: false,
      message: "Yıllık çalışma planı formu alınamadı",
      error: err?.message,
    });
  }
});

app.put("/api/yillik-calisma-plani/form/:firmaId", authMiddleware, async (req, res) => {
  try {
    const { firmaId } = req.params;
    const orgIdCandidates = buildOrgIdCandidates(req.user);
    const ownerId =
      req.user?.organizationId ||
      req.user?.organizationUuid ||
      req.user?._id ||
      req.user?.id;

    if (!firmaId) {
      return res.status(400).json({ message: "firmaId zorunlu" });
    }

    if (!ownerId) {
      return res.status(400).json({ message: "Organizasyon bulunamadı" });
    }

    const body = req.body || {};
    const incomingActivities = Array.isArray(body?.activities) ? body.activities : [];

    const cleanedActivities = incomingActivities.map((row, index) => ({
      id: String(row?.id || `${Date.now()}_${index}`),
      siraNo: Number(index + 1),
      name: String(row?.name || ""),
      months:
        row?.months && typeof row.months === "object"
          ? row.months
          : {},
    }));

    const updated = await YillikCalismaPlaniForm.findOneAndUpdate(
      {
        organizationId: { $in: orgIdCandidates },
        firmaId: String(firmaId),
        type: "yillik-calisma-plani",
      },
      {
        $set: {
          organizationId: String(ownerId),
          firmaId: String(firmaId),
          firmaAdi: String(body?.firmaAdi || ""),
          type: "yillik-calisma-plani",
          planYear: Number(body?.planYear || new Date().getFullYear()),
          startDate: String(body?.startDate || ""),
          monthMode: String(body?.monthMode || "fromStart"),
          customMonths: Array.isArray(body?.customMonths) ? body.customMonths : [],
          activities: cleanedActivities,
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
      form: updated,
      message: "Yıllık çalışma planı formu kaydedildi",
    });
  } catch (err) {
    console.error("YÇP form PUT hata:", err);
    return res.status(500).json({
      ok: false,
      message: "Yıllık çalışma planı formu kaydedilemedi",
      error: err?.message,
    });
  }
});

app.post("/api/yillik-calisma-plani/pdf", pdfMiddleware, async (req, res) => {
  try {
    const pdfPath = await createYillikCalismaPlaniPdf(req.body);
    res.sendFile(path.resolve(pdfPath));
  } catch (e) {
    console.error("yillik-calisma-plani pdf hata:", e);
    res.status(500).send("Yıllık Çalışma Planı PDF üretilemedi.");
  }
});

app.get("/api/yillik-degerlendirme-raporu/form/:firmaId", authMiddleware, async (req, res) => {
  try {
    const { firmaId } = req.params;
    const orgIdCandidates = buildOrgIdCandidates(req.user);

    if (!firmaId) {
      return res.status(400).json({ message: "firmaId zorunlu" });
    }

    if (!orgIdCandidates.length) {
      return res.status(400).json({ message: "Organizasyon bulunamadı" });
    }

    const form = await YillikDegerlendirmeForm.findOne({
      organizationId: { $in: orgIdCandidates },
      firmaId: String(firmaId),
      type: "yillik-degerlendirme-raporu",
    }).lean();

    return res.json({
      ok: true,
      form: form || null,
    });
  } catch (err) {
    console.error("YDR form GET hata:", err);
    return res.status(500).json({
      ok: false,
      message: "Yıllık değerlendirme formu alınamadı",
      error: err?.message,
    });
  }
});

app.put("/api/yillik-degerlendirme-raporu/form/:firmaId", authMiddleware, async (req, res) => {
  try {
    const { firmaId } = req.params;
    const orgIdCandidates = buildOrgIdCandidates(req.user);
    const ownerId =
      req.user?.organizationId ||
      req.user?.organizationUuid ||
      req.user?._id ||
      req.user?.id;

    if (!firmaId) {
      return res.status(400).json({ message: "firmaId zorunlu" });
    }

    if (!ownerId) {
      return res.status(400).json({ message: "Organizasyon bulunamadı" });
    }

    const body = req.body || {};
    const incomingRows = Array.isArray(body?.rows) ? body.rows : [];

    const cleanedRows = incomingRows.map((row, index) => ({
      id: String(row?.id || `${Date.now()}_${index}`),
      siraNo: Number(row?.siraNo || index + 1),
      calisma: String(row?.calisma || ""),
      tarih: String(row?.tarih || ""),
      yapanKisiUnvan: String(row?.yapanKisiUnvan || ""),
      tekrarSayisi: String(row?.tekrarSayisi || ""),
      kullanilanYontem: String(row?.kullanilanYontem || ""),
      sonucYorum: String(row?.sonucYorum || ""),
    }));

    const updated = await YillikDegerlendirmeForm.findOneAndUpdate(
      {
        organizationId: { $in: orgIdCandidates },
        firmaId: String(firmaId),
        type: "yillik-degerlendirme-raporu",
      },
      {
        $set: {
          organizationId: String(ownerId),
          firmaId: String(firmaId),
          firmaAdi: String(body?.firmaAdi || ""),
          type: "yillik-degerlendirme-raporu",
          raporTarihi: String(body?.raporTarihi || ""),
          raporYili: String(body?.raporYili || ""),
          rows: cleanedRows,
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
      form: updated,
      message: "Yıllık değerlendirme formu kaydedildi",
    });
  } catch (err) {
    console.error("YDR form PUT hata:", err);
    return res.status(500).json({
      ok: false,
      message: "Yıllık değerlendirme formu kaydedilemedi",
      error: err?.message,
    });
  }
});

app.post("/api/yillik-degerlendirme-raporu/pdf", pdfMiddleware, async (req, res) => {
  try {
    await createYillikDegerlendirmeRaporuPdf(req, res);
  } catch (e) {
    console.error("yillik-degerlendirme-raporu pdf hata:", e);
    res.status(500).send("Yıllık Değerlendirme Raporu PDF üretilemedi.");
  }
});


app.post("/api/acil-durum-plani/pdf", pdfMiddleware, async (req, res) => {
  try {
    const pdf = await createAcilDurumPlaniPdf(req.body);
    res.sendFile(path.resolve(pdf));
  } catch (e) {
    console.error("acil-durum-plani pdf hata:", e);
    res.status(500).send("Acil Durum Planı PDF üretilemedi.");
  }
});

app.post("/api/pdf/acildurumplani", pdfMiddleware, async (req, res) => {
  try {
    const createdByUserId = String(req.user?._id || req.user?.id || "");
    const organizationId = String(
      req.user?.organizationId ||
        req.user?.organizationUuid ||
        req.user?._id ||
        req.user?.id ||
        ""
    );

    const verificationCode =
  req.body.verificationCode ||
  crypto.randomBytes(5).toString("hex").toUpperCase();

req.body.verificationCode = verificationCode;

  const job = await PdfJob.create({
  type: "acildurumplani",
  status: "queued",
  data: { ...req.body },
  createdByUserId,
  organizationId,
  verificationCode,
});

    console.log("📥 YENİ PDF JOB:", "acildurumplani", String(job._id));

    return res.status(202).json({
      ok: true,
      jobId: String(job._id),
      status: "queued",
      message: "Acil Durum Planı PDF kuyruğa alındı",
    });
  } catch (e) {
    console.error("acildurumplani job hata:", e);
    return res.status(500).json({
      ok: false,
      message: "Acil Durum Planı PDF kuyruğa alınamadı",
      error: e?.message,
    });
  }
});

app.post(
  "/api/pdf/isegiris",
  authMiddleware,
  injectKurumsalLogo,
  injectDemoFlag,
  async (req, res) => {
  try {
    const allowedTypes = [
  "isegiris-egitim-katilim",
  "isegiris-sertifika",
  "isegiris-test",
  "ise-baslama-formu",
];

    const type = String(req.body?.type || "").trim();

    if (!allowedTypes.includes(type)) {
      return res.status(400).json({
        ok: false,
        message: "Geçersiz İşe Giriş PDF tipi",
      });
    }

    const createdByUserId = String(req.user?._id || req.user?.id || "");
    const organizationId = String(
      req.user?.organizationId ||
        req.user?.organizationUuid ||
        req.user?._id ||
        req.user?.id ||
        ""
    );

    const verificationCode =
  req.body?.data?.verificationCode ||
  crypto.randomBytes(5)
    .toString("hex")
    .toUpperCase();

if (!req.body.data) {
  req.body.data = {};
}

req.body.data.verificationCode =
  verificationCode;

const job = await PdfJob.create({
  type,
  status: "queued",

  data: {
    ...(req.body?.data || {}),
  },

  createdByUserId,
  organizationId,

  verificationCode,
});

    console.log("📥 YENİ PDF JOB:", type, String(job._id));

    return res.status(202).json({
      ok: true,
      jobId: String(job._id),
      status: "queued",
      message: "İşe Giriş PDF kuyruğa alındı",
    });
  } catch (e) {
    console.error("isegiris job hata:", e);
    return res.status(500).json({
      ok: false,
      message: "İşe Giriş PDF kuyruğa alınamadı",
      error: e?.message,
    });
  }
});

app.post(
  "/api/pdf/destek-acil",
  authMiddleware,
  injectKurumsalLogo,
  injectDemoFlag,
  async (req, res) => {
    try {
      const allowedTypes = [
        "destek-acil-egitim-katilim",
        "destek-acil-atama",
        "destek-acil-ekip-formu",
      ];

      const type = String(req.body?.type || "").trim();

      if (!allowedTypes.includes(type)) {
        return res.status(400).json({
          ok: false,
          message: "Geçersiz Destek/Acil PDF tipi",
        });
      }

      const createdByUserId = String(req.user?._id || req.user?.id || "");
      const organizationId = String(
        req.user?.organizationId ||
          req.user?.organizationUuid ||
          req.user?._id ||
          req.user?.id ||
          ""
      );

const verificationCode =
  req.body?.data?.verificationCode ||
  crypto.randomBytes(5)
    .toString("hex")
    .toUpperCase();

if (!req.body.data) {
  req.body.data = {};
}

req.body.data.verificationCode =
  verificationCode;

     const job = await PdfJob.create({
  type,
  status: "queued",

  data: {
    ...(req.body?.data || {}),
  },

  createdByUserId,
  organizationId,

  verificationCode,
});

      console.log("📥 YENİ DESTEK/ACİL JOB:", type, String(job._id));

      return res.status(202).json({
        ok: true,
        jobId: String(job._id),
        status: "queued",
        message: "Destek/Acil PDF kuyruğa alındı",
      });
    } catch (e) {
      console.error("destek-acil job hata:", e);
      return res.status(500).json({
        ok: false,
        message: "Destek/Acil PDF kuyruğa alınamadı",
        error: e?.message,
      });
    }
  }
);

app.get("/api/pdf/job/:jobId", authMiddleware, async (req, res) => {
  try {
    const { jobId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(String(jobId))) {
      return res.status(400).json({
        ok: false,
        message: "Geçersiz jobId",
      });
    }

    const userId = String(req.user?._id || req.user?.id || "");
    const organizationId = String(
      req.user?.organizationId ||
        req.user?.organizationUuid ||
        req.user?._id ||
        req.user?.id ||
        ""
    );

    const job = await PdfJob.findOne({
      _id: jobId,
      $or: [{ createdByUserId: userId }, { organizationId }],
    }).lean();

    if (!job) {
      return res.status(404).json({
        ok: false,
        message: "Job bulunamadı",
      });
    }

    return res.json({
      ok: true,
      jobId: String(job._id),
      type: job.type,
      status: job.status,
      resultFileUrl: job.resultFileUrl || "",
      resultFilePath: job.resultFilePath || "",
      error: job.error || "",
    });
  } catch (e) {
    console.error("pdf job status hata:", e);
    return res.status(500).json({
      ok: false,
      message: "Job durumu alınamadı",
      error: e?.message,
    });
  }
});

/* =========================
   ✅ EĞİTİM: TEK PDF ENDPOINT’LERİ
   ========================= */
app.post(
  "/api/egitim-katilim-formu/pdf",
  pdfMiddleware,
  rejectIfMultiDateInSinglePdf,
  async (req, res) => {
    try {
      const pdf = await createEgitimKatilimFormuPdf(req.body);
      res.sendFile(path.resolve(pdf));
    } catch (e) {
      console.error("egitim-katilim-formu pdf hata:", e);
      res.status(500).send("Eğitim Katılım Formu PDF üretilemedi.");
    }
  }
);

app.post(
  "/api/sertifika/pdf",
  pdfMiddleware,
  rejectIfMultiDateInSinglePdf,
  async (req, res) => {
    try {
      const pdf = await createSertifikaPdf(req.body);
      res.sendFile(path.resolve(pdf));
    } catch (e) {
      console.error("sertifika pdf hata:", e);
      res.status(500).send("Sertifika PDF üretilemedi.");
    }
  }
);

/* =========================
   ✅ DESTEK / ACİL (3 BUTON) PDF ENDPOINTS
   ========================= */

app.post(
  "/api/destek-acil/egitim-katilim-formu/pdf",
  pdfMiddleware,
  async (req, res) => {
    try {
      const pdfBuffer = await createDestekAcilEgitimKatilimFormuPdf(req.body);
      res.setHeader("Content-Type", "application/pdf");
      return res.send(pdfBuffer);
    } catch (err) {
      console.error("Destek/Acil Eğitim Katılım Formu PDF Hatası:", err);
      return res.status(500).send("PDF oluşturulamadı");
    }
  }
);


// 1) Destek/Acil Eğitim Katılım Formu
app.post(
  "/api/destek-acil/egitim-katilim-formu/pdf",
  pdfMiddleware,
  async (req, res) => {
    try {
      const out = await createDestekAcilEgitimKatilimFormuPdf(req.body);

      // Buffer dönerse
      if (Buffer.isBuffer(out)) {
        res.setHeader("Content-Type", "application/pdf");
        return res.send(out);
      }

      // {buffer} / {pdfBuffer}
      if (out && (Buffer.isBuffer(out.buffer) || Buffer.isBuffer(out.pdfBuffer))) {
        const buf = out.buffer || out.pdfBuffer;
        res.setHeader("Content-Type", "application/pdf");
        return res.send(buf);
      }

      // string path dönerse
      if (typeof out === "string") {
        return res.sendFile(path.resolve(out));
      }

      return res.status(500).send("Destek/Acil katılım PDF modülü beklenmeyen çıktı döndürdü.");
    } catch (e) {
      console.error("Destek/Acil Eğitim Katılım PDF hata:", e);
      return res.status(500).send("Destek/Acil Eğitim Katılım Formu PDF üretilemedi.");
    }
  }
);

// 2) Destek Elemanı Atama Formu (yedek yok)
app.post(
  "/api/destek-acil/destek-elemani-atama-formu/pdf",
  pdfMiddleware,
  async (req, res) => {
    try {
      const out = await createDestekElemaniAtamaFormuPdf(req.body);

      // Buffer dönerse
      if (Buffer.isBuffer(out)) {
        res.setHeader("Content-Type", "application/pdf");
        return res.send(out);
      }

      // {buffer} / {pdfBuffer}
      if (out && (Buffer.isBuffer(out.buffer) || Buffer.isBuffer(out.pdfBuffer))) {
        const buf = out.buffer || out.pdfBuffer;
        res.setHeader("Content-Type", "application/pdf");
        return res.send(buf);
      }

      // string path dönerse
      if (typeof out === "string") {
        return res.sendFile(path.resolve(out));
      }

      return res.status(500).send("Destek elemanı atama PDF modülü beklenmeyen çıktı döndürdü.");
    } catch (e) {
      console.error("Destek Elemanı Atama PDF hata:", e);
      return res.status(500).send("Destek Elemanı Atama Formu PDF üretilemedi.");
    }
  }
);

// 3) Acil Durum Ekip Formu (acil_ekip.html şablonundan)
// Not: Senin createAcilEkipPdf zaten çalışıyor ve sendFile ile dönüyor. Aynı modülü kullanıyoruz.
app.post(
  "/api/destek-acil/acil-ekip-formu/pdf",
  pdfMiddleware,
  async (req, res) => {
    try {
      const pdfBuffer = await createAcilEkipPdf(req.body);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        'inline; filename="acil-durum-ekip-formu.pdf"'
      );

      return res.send(pdfBuffer);
    } catch (e) {
      console.error("Destek/Acil Acil Ekip Formu PDF hata:", e);
      return res
        .status(500)
        .send("Acil Durum Ekip Formu PDF üretilemedi.");
    }
  }
);

/* =========================
   ✅ İŞE GİRİŞ TEST PDF
   ========================= */

app.post(
  "/api/isegiris-test/pdf",
  pdfMiddleware,
  async (req, res) => {
    try {

      const pdfPath =
        await createIseGirisTestPdf(req.body);

      return res.sendFile(
        path.resolve(pdfPath)
      );

    } catch (e) {

      console.error(
        "isegiris test pdf hata:",
        e
      );

      return res
        .status(500)
        .send("İşe Giriş Test PDF üretilemedi.");
    }
  }
);

/* =========================
   ✅ İŞE GİRİŞ TEST ZIP
   ========================= */
app.post(
  "/api/isegiris-test/pdf-bulk",
  pdfMiddleware,
  async (req, res) => {
    try {
      const payload = req.body || {};
      const items = Array.isArray(payload?.items) ? payload.items : [];

      if (!items.length) {
        return res.status(400).send("Toplu test listesi boş.");
      }

      const firmaAdi =
        payload?.firma?.firmaAdi ||
        items?.[0]?.firma?.firmaAdi ||
        "firma";

      const safeFirma = toAsciiFileName(firmaAdi);

      res.setHeader("Content-Type", "application/zip");
      res.setHeader(
        "Content-Disposition",
        safeContentDisposition(`${safeFirma}_testler.zip`)
      );

      const archive = archiver("zip", { zlib: { level: 9 } });

      archive.on("error", (err) => {
        console.error("İşe giriş test ZIP error:", err);
        try {
          res.status(500).end();
        } catch {}
      });

      archive.pipe(res);

      let i = 1;

      for (const onePayloadRaw of items) {
        const onePayload = onePayloadRaw || {};
        const personel =
          onePayload?.personel ||
          onePayload?.katilimcilar?.[0] ||
          {};

        const pdfPath = await createIseGirisTestPdf({
          ...payload,
          ...onePayload,
          personel,
          katilimcilar: [{ no: 1, ...personel }],
          testSorulari:
            onePayload?.testSorulari ||
            payload?.testSorulari ||
            [],
        });

        const safeAd = toAsciiFileName(
          personel?.adSoyad || `personel_${i}`
        );

        archive.file(pdfPath, {
          name: `${safeAd} - test.pdf`,
        });

        i++;
      }

      await archive.finalize();
    } catch (e) {
      console.error("isegiris test bulk hata:", e);
      return res.status(500).send("Toplu Test ZIP üretilemedi.");
    }
  }
);


/* =========================
   ✅ İŞE BAŞLAMA FORMU ZIP
   ========================= */
app.post(
  "/api/ise-baslama-formu/pdf-bulk",
  pdfMiddleware,
  async (req, res) => {
    try {
      const payload = req.body || {};
      const items = Array.isArray(payload?.items)
        ? payload.items
        : [];

      if (!items.length) {
        return res
          .status(400)
          .send("Toplu işe başlama listesi boş.");
      }

      const firmaAdi =
        payload?.firma?.firmaAdi ||
        items?.[0]?.firma?.firmaAdi ||
        "firma";

      const safeFirma = toAsciiFileName(firmaAdi);

      res.setHeader("Content-Type", "application/zip");
      res.setHeader(
        "Content-Disposition",
        safeContentDisposition(
          `${safeFirma}_ise_baslama_formlari.zip`
        )
      );

      const archive = archiver("zip", {
        zlib: { level: 9 },
      });

      archive.on("error", (err) => {
        console.error(
          "İşe başlama ZIP error:",
          err
        );

        try {
          res.status(500).end();
        } catch {}
      });

      archive.pipe(res);

      let i = 1;

      for (const onePayloadRaw of items) {
        const onePayload = onePayloadRaw || {};

        const personel =
          onePayload?.personel ||
          onePayload?.katilimcilar?.[0] ||
          {};

        const pdfPath =
          await createIseBaslamaFormuPdf({
            ...payload,
            ...onePayload,
            personel,
            katilimcilar: [
              {
                no: 1,
                ...personel,
              },
            ],
          });

        const safeAd = toAsciiFileName(
          personel?.adSoyad ||
            `personel_${i}`
        );

        archive.file(pdfPath, {
          name: `${safeAd} - ise-baslama-formu.pdf`,
        });

        i++;
      }

      await archive.finalize();
    } catch (e) {
      console.error(
        "ise-baslama bulk hata:",
        e
      );

      return res
        .status(500)
        .send("Toplu İşe Başlama ZIP üretilemedi.");
    }
  }
);

/* =========================
   ✅ TOPLU ZIP ENDPOINTS
   ========================= */

// ✅ Toplu Eğitim Katılım Formu ZIP
app.post("/api/egitim-katilim-formu/pdf-bulk", pdfMiddleware, async (req, res) => {
  try {
    const payload = req.body || {};
    const items = Array.isArray(payload?.items) ? payload.items : null;

    const firmaAdiFromPayload =
      payload?.firma?.firmaAdi || items?.[0]?.firma?.firmaAdi || "firma";

    const safeFirma = toAsciiFileName(firmaAdiFromPayload);

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      safeContentDisposition(`${safeFirma}_egitim_katilim_formlari.zip`)
    );

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => {
      console.error("ZIP error:", err);
      try {
        res.status(500).end();
      } catch {}
    });

    archive.pipe(res);

    if (items && items.length) {
      let i = 1;
      for (const onePayload of items) {
        const oneList = Array.isArray(onePayload?.katilimcilar) ? onePayload.katilimcilar : [];
        const k = oneList?.[0] || {};

        const pdfPath = await createEgitimKatilimFormuPdf(onePayload);

        const safeAd = toAsciiFileName((k?.adSoyad || `personel_${i}`).toString());
        const pdfName = `${safeFirma}_katilim_${String(i).padStart(3, "0")}_${safeAd}.pdf`;

        archive.file(pdfPath, { name: pdfName });
        i++;
      }

      await archive.finalize();
      return;
    }

    const katilimcilar = Array.isArray(payload?.katilimcilar) ? payload.katilimcilar : [];
    if (!katilimcilar.length) return res.status(400).send("Katilimci listesi bos.");

    let i = 1;
    for (const k of katilimcilar) {
      const onePayload = { ...payload, katilimcilar: [k] };
      const pdfPath = await createEgitimKatilimFormuPdf(onePayload);

      const safeAd = toAsciiFileName((k?.adSoyad || `personel_${i}`).toString());
      const pdfName = `${safeFirma}_katilim_${String(i).padStart(3, "0")}_${safeAd}.pdf`;

      archive.file(pdfPath, { name: pdfName });
      i++;
    }

    await archive.finalize();
  } catch (e) {
    console.error("pdf-bulk (katilim) hata:", e);
    return res.status(500).send("Toplu katilim ZIP üretilemedi.");
  }
});

// ✅ Toplu Sertifika ZIP
app.post("/api/sertifika/pdf-bulk", pdfMiddleware, async (req, res) => {
  try {
    const payload = req.body || {};
    const items = Array.isArray(payload?.items) ? payload.items : null;

    const firmaAdiFromPayload =
      payload?.firma?.firmaAdi || items?.[0]?.firma?.firmaAdi || "firma";

    const safeFirma = toAsciiFileName(firmaAdiFromPayload);

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      safeContentDisposition(`${safeFirma}_sertifikalar.zip`)
    );

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => {
      console.error("ZIP error:", err);
      try {
        res.status(500).end();
      } catch {}
    });

    archive.pipe(res);

    if (items && items.length) {
      let i = 1;
      for (const onePayloadRaw of items) {
        const oneList = Array.isArray(onePayloadRaw?.katilimcilar) ? onePayloadRaw.katilimcilar : [];
        const k = oneList?.[0] || {};

        const personel = onePayloadRaw?.personel || {
          adSoyad: k?.adSoyad || "",
          gorev: k?.gorev || "",
        };
        const onePayload = { ...onePayloadRaw, personel };

        const pdfPath = await createSertifikaPdf(onePayload);

        const safeAd = toAsciiFileName((k?.adSoyad || `personel_${i}`).toString());
        const pdfName = `${safeFirma}_sertifika_${String(i).padStart(3, "0")}_${safeAd}.pdf`;

        archive.file(pdfPath, { name: pdfName });
        i++;
      }

      await archive.finalize();
      return;
    }

    const katilimcilar = Array.isArray(payload?.katilimcilar) ? payload.katilimcilar : [];
    if (!katilimcilar.length) return res.status(400).send("Katilimci listesi bos.");

    let i = 1;
    for (const k of katilimcilar) {
      const personel = { adSoyad: k?.adSoyad || "", gorev: k?.gorev || "" };
      const onePayload = { ...payload, personel, katilimcilar: [k] };

      const pdfPath = await createSertifikaPdf(onePayload);

      const safeAd = toAsciiFileName((k?.adSoyad || `personel_${i}`).toString());
      const pdfName = `${safeFirma}_sertifika_${String(i).padStart(3, "0")}_${safeAd}.pdf`;

      archive.file(pdfPath, { name: pdfName });
      i++;
    }

    await archive.finalize();
  } catch (e) {
    console.error("pdf-bulk (sertifika) hata:", e);
    return res.status(500).send("Toplu sertifika ZIP üretilemedi.");
  }
});

/* =========================
   ✅ YÜKSEKTE ÇALIŞMA ENDPOINTS
   ========================= */
app.post(
  "/api/yuksekte-calisma/katilim/pdf",
  pdfMiddleware,
  rejectIfMultiDateInSinglePdf,
  async (req, res) => {
    try {
      if (!createYuksekteKatilimPdf) {
        return res.status(500).send("Yüksekte çalışma katılım PDF modülü bulunamadı.");
      }
      return await createYuksekteKatilimPdf(req, res);
    } catch (e) {
      console.error("yuksekte katilim pdf hata:", e);
      return res.status(500).send("Yüksekte çalışma katılım PDF üretilemedi.");
    }
  }
);

app.post("/api/yuksekte-calisma/katilim/pdf-bulk", pdfMiddleware, async (req, res) => {
  try {
    if (!createYuksekteKatilimPdfBulk) {
      return res.status(500).send("Yüksekte çalışma katılım ZIP modülü bulunamadı.");
    }
    return await createYuksekteKatilimPdfBulk(req, res);
  } catch (e) {
    console.error("yuksekte katilim pdf-bulk hata:", e);
    return res.status(500).send("Yüksekte çalışma katılım ZIP üretilemedi.");
  }
});

app.post(
  "/api/yuksekte-calisma/sertifika/pdf",
  pdfMiddleware,
  rejectIfMultiDateInSinglePdf,
  async (req, res) => {
    try {
      if (!createYuksekteSertifikaPdf) {
        return res.status(500).send("Yüksekte çalışma sertifika PDF modülü bulunamadı.");
      }
      const pdfPath = await createYuksekteSertifikaPdf(req.body, req);
return res.sendFile(path.resolve(pdfPath));
    } catch (e) {
      console.error("yuksekte sertifika pdf hata:", e);
      return res.status(500).send("Yüksekte çalışma sertifika PDF üretilemedi.");
    }
  }
);

app.post("/api/yuksekte-calisma/sertifika/pdf-bulk", pdfMiddleware, async (req, res) => {
  try {
    if (!createYuksekteSertifikaPdfBulk) {
      return res.status(500).send("Yüksekte çalışma sertifika ZIP modülü bulunamadı.");
    }
    return await createYuksekteSertifikaPdfBulk(req, res);
  } catch (e) {
    console.error("yuksekte sertifika pdf-bulk hata:", e);
    return res.status(500).send("Yüksekte çalışma sertifika ZIP üretilemedi.");
  }
});

app.post(
  "/api/calisan-temsilcisi/egitim-katilim-formu/pdf",
  pdfMiddleware,
  async (req, res) => {
    try {
      const pdfPath = await createCalisanTemsilcisiEgitimKatilimFormuPdf(req.body);
      res.sendFile(path.resolve(pdfPath));
    } catch (e) {
      console.error("Çalışan Temsilcisi Eğitim Katılım PDF hata:", e);
      res
        .status(500)
        .send("Çalışan Temsilcisi Eğitim Katılım Formu PDF üretilemedi.");
    }
  }
);

app.post(
  "/api/calisan-temsilcisi/atama-formu/pdf",
  pdfMiddleware,
  async (req, res) => {
    try {
      const out = await createCalisanTemsilcisiAtamaFormuPdf(req.body);

      // ✅ 1) Buffer dönerse direkt gönder
      if (Buffer.isBuffer(out)) {
        res.setHeader("Content-Type", "application/pdf");
        return res.send(out);
      }

      // ✅ 2) {buffer} veya {pdfBuffer} dönerse
      if (out && (Buffer.isBuffer(out.buffer) || Buffer.isBuffer(out.pdfBuffer))) {
        const buf = out.buffer || out.pdfBuffer;
        res.setHeader("Content-Type", "application/pdf");
        return res.send(buf);
      }

      // ✅ 3) String path dönerse sendFile
      if (typeof out === "string") {
        return res.sendFile(path.resolve(out));
      }

      return res.status(500).send("Atama PDF modülü beklenmeyen çıktı döndürdü.");
    } catch (e) {
      console.error("Çalışan Temsilcisi Atama Formu PDF hata:", e);
      res.status(500).send("Çalışan Temsilcisi Atama Formu PDF üretilemedi.");
    }
  }
);

// ✅ FRONTEND UYUMLULUK ALIAS: Katılım formu
app.post(
  "/api/calisan-temsilcisi/katilim/pdf",
  pdfMiddleware,
  async (req, res) => {
    try {
      const pdfPath = await createCalisanTemsilcisiEgitimKatilimFormuPdf(req.body);
      return res.sendFile(path.resolve(pdfPath));
    } catch (e) {
      console.error("Çalışan Temsilcisi Katılım PDF hata:", e);
      return res
        .status(500)
        .send("Çalışan Temsilcisi Eğitim Katılım Formu PDF üretilemedi.");
    }
  }
);

// ✅ FRONTEND UYUMLULUK ALIAS: Atama formu
app.post(
  "/api/calisan-temsilcisi/atama/pdf",
  pdfMiddleware,
  async (req, res) => {
    try {
      const out = await createCalisanTemsilcisiAtamaFormuPdf(req.body);

      if (Buffer.isBuffer(out)) {
        res.setHeader("Content-Type", "application/pdf");
        return res.send(out);
      }

      if (out && (Buffer.isBuffer(out.buffer) || Buffer.isBuffer(out.pdfBuffer))) {
        const buf = out.buffer || out.pdfBuffer;
        res.setHeader("Content-Type", "application/pdf");
        return res.send(buf);
      }

      if (typeof out === "string") {
        return res.sendFile(path.resolve(out));
      }

      return res.status(500).send("Atama PDF modülü beklenmeyen çıktı döndürdü.");
    } catch (e) {
      console.error("Çalışan Temsilcisi Atama PDF hata:", e);
      return res.status(500).send("Çalışan Temsilcisi Atama Formu PDF üretilemedi.");
    }
  }
);

/* =========================
   ✅ TALİMAT PDF ENDPOINTS (YENİ)
   ========================= */

// 1️⃣ Tekli Genel Talimat PDF
app.post(
  "/api/talimat/pdf",
  pdfMiddleware,
  async (req, res) => {
    return genelTalimatPdf(req, res);
  }
);

// 2️⃣ Toplu Genel Talimat ZIP
app.post(
  "/api/talimat/pdf-bulk",
  pdfMiddleware,
  async (req, res) => {
    return genelTalimatPdfBulk(req, res);
  }
);

// 3️⃣ Tekli İnşaat Talimat PDF
app.post(
  "/api/talimat/insaat/pdf",
  pdfMiddleware,
  async (req, res) => {
    return insaatTalimatPdf(req, res);
  }
);

// 4️⃣ Toplu İnşaat Talimat ZIP
app.post(
  "/api/talimat/insaat/pdf-bulk",
  pdfMiddleware,
  async (req, res) => {
    return insaatTalimatPdfBulk(req, res);
  }
);

// 5️⃣ Tekli Öneri Talimat PDF
app.post(
  "/api/talimat/oneri/pdf",
  pdfMiddleware,
  async (req, res) => {
    return oneriTalimatPdf(req, res);
  }
);

// 6️⃣ Toplu Öneri Talimat ZIP
app.post(
  "/api/talimat/oneri/pdf-bulk",
  pdfMiddleware,
  async (req, res) => {
    return oneriTalimatPdfBulk(req, res);
  }
);

/* =========================
   ✅ KKD PDF ENDPOINTS
   ========================= */

// Tekli KKD PDF
app.post(
  "/api/kkd/pdf",
  pdfMiddleware,
  async (req, res) => {
    return kkdTeslimTutanagiPdf(req, res);
  }
);

// Toplu KKD ZIP
app.post(
  "/api/kkd/pdf-bulk",
  pdfMiddleware,
  async (req, res) => {
    return kkdTeslimTutanagiPdfBulk(req, res);
  }
);


/* =========================
   FRONTEND BUILD SERVE + SPA FALLBACK
   ========================= */
const frontendDistPath = path.join(__dirname, "..", "dist");
console.log("frontendDistPath =", frontendDistPath);
console.log("frontendDist exists =", fs.existsSync(frontendDistPath));

if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));

  // API dışındaki tüm route'ları React'e bırak
  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(frontendDistPath, "index.html"));
  });
}

/* =========================
   SERVER START
   ========================= */

const PORT = process.env.PORT || 5001;

startScheduler(); // 🔔 mevcut
startWorker();    // firma atama worker

// ✅ PDF WORKER EKLENDİ
const startPdfWorker = require("./workers/pdfWorker");
startPdfWorker();

// ✅ MAIL TEST EKLENDİ
verifyMailer();

app.listen(PORT, "0.0.0.0", () => {
  console.log(`SERVER CALISIYOR -> http://0.0.0.0:${PORT}`);
});
