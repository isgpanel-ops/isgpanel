// backend/pdf/acildurumplani.js
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");
const { PDFDocument, rgb } = require("pdf-lib");
const QRCode = require("qrcode");
const fontkit = require("@pdf-lib/fontkit");
const { embedBoldFont } = require("../utils/pdfFonts");

/* <body> içeriğini alır */
function readBodyOnly(filePath) {
  let html = fs.readFileSync(filePath, "utf8").trim();
  const s = html.search(/<body[^>]*>/i);
  const e = html.search(/<\/body>/i);
  if (s !== -1 && e !== -1 && e > s) {
    return html
      .slice(s)
      .replace(/^[\s\S]*?<body[^>]*>/i, "")
      .replace(/<\/body>[\s\S]*$/i, "")
      .trim();
  }
  return html;
}

/* CSS + sayfaları tek HTML'e sarar */
function wrapHtml(css, body) {
  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <style>${css || ""}</style>
</head>
<body>${body || ""}</body>
</html>`;
}

/* Basit değişken doldurma: {{a.b.c}} */
function fillVars(tpl, data) {
  if (!tpl) return "";
  return tpl.replace(/{{\s*([^}]+)\s*}}/g, (_, key) => {
    const parts = key.split(".").map((x) => x.trim());
    let cur = data;
    for (const p of parts) {
      if (cur && typeof cur === "object" && p in cur) cur = cur[p];
      else return "";
    }
    const val = cur;
    return val == null ? "" : String(val);
  });
}

/* Dosyayı Base64 DataURI yapar (png/jpg/svg/webp) */
function fileToDataUri(absPath) {
  try {
    if (!absPath || !fs.existsSync(absPath)) return "";
    const ext = path.extname(absPath).toLowerCase();
    const mime =
      ext === ".png"
        ? "image/png"
        : ext === ".jpg" || ext === ".jpeg"
        ? "image/jpeg"
        : ext === ".svg"
        ? "image/svg+xml"
        : ext === ".webp"
        ? "image/webp"
        : "application/octet-stream";
    const b64 = fs.readFileSync(absPath).toString("base64");
    return `data:${mime};base64,${b64}`;
  } catch (e) {
    console.warn("fileToDataUri hata:", absPath, e.message);
    return "";
  }
}

/* ✅ /uploads/... veya http(s)://.../uploads/... -> absolute dosya yoluna çevirir */
function uploadsUrlToAbsPath(projectRoot, url) {
  try {
    if (!url || typeof url !== "string") return "";
    const u = url.trim();

    // ✅ ABS URL gelirse pathname'i al
    let pathname = u;
    if (u.startsWith("http://") || u.startsWith("https://")) {
      try {
        pathname = new URL(u).pathname || "";
      } catch {
        pathname = u;
      }
    }

    if (!pathname.startsWith("/uploads/")) return "";
    const rel = pathname.replace(/^\/uploads\//, "");
    return path.join(projectRoot, "backend", "uploads", rel);
  } catch {
    return "";
  }
}

/* base64 gibi mi? (kaba kontrol) */
function looksLikeBase64(str) {
  if (!str || typeof str !== "string") return false;
  const s = str.trim();
  if (s.length < 100) return false;
  return /^[A-Za-z0-9+/=\s]+$/.test(s);
}

/* ham base64 ya da dataURI -> dataURI döndür */
function ensureDataUriFromPossibleBase64(raw, defaultMime = "image/png") {
  if (!raw || typeof raw !== "string") return "";
  const s = raw.trim();
  if (s.startsWith("data:")) return s;
  if (looksLikeBase64(s))
    return `data:${defaultMime};base64,${s.replace(/\s+/g, "")}`;
  return "";
}

function isDataUri(v) {
  return typeof v === "string" && v.trim().startsWith("data:");
}

/* -------------------------
   ✅ OTOMATİK ASSET ENJEKTE
   ------------------------- */
function toKebabCase(str = "") {
  return String(str)
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[_\s]+/g, "-")
    .toLowerCase();
}

function findAssetFile(dir, baseNameNoExt) {
  const exts = [".png", ".jpg", ".jpeg", ".svg", ".webp"];
  for (const ext of exts) {
    const p = path.join(dir, baseNameNoExt + ext);
    if (fs.existsSync(p)) return p;
  }
  return "";
}

function autoInjectAcilAssetsFromTemplates(allHtmlBodies, data, assetsDir, iconsDir) {
  if (!data.acil) data.acil = {};
  const html = (allHtmlBodies || []).filter(Boolean).join("\n");
  const re = /{{\s*acil\.([a-zA-Z0-9_]+)\s*}}/g;

  const keys = new Set();
  let m;
  while ((m = re.exec(html))) keys.add(m[1]);

  for (const key of keys) {
    if (isDataUri(data.acil[key])) continue;

    let filePath = "";
    const looksIcon = key.toLowerCase().startsWith("icon");
    if (looksIcon) {
      filePath =
        findAssetFile(iconsDir, key) ||
        findAssetFile(iconsDir, toKebabCase(key));
    }
    if (!filePath) {
      filePath =
        findAssetFile(assetsDir, key) ||
        findAssetFile(assetsDir, toKebabCase(key));
    }

    if (filePath) {
      const uri = fileToDataUri(filePath);
      if (uri) data.acil[key] = uri;
    }
  }
}

/* =========================
   DEMO WATERMARK
   ========================= */
function injectDemoWatermark(html) {
  const watermarkCss = `
    <style>
      .demo-watermark {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) rotate(-30deg);
        font-size: 96px;
        color: rgba(0,0,0,0.06);
        z-index: 9999;
        pointer-events: none;
        user-select: none;
        white-space: nowrap;
      }
      .demo-footer {
        position: fixed;
        bottom: 6mm;
        left: 0;
        right: 0;
        text-align: center;
        font-size: 9px;
        color: #666;
        z-index: 9999;
        pointer-events: none;
      }
    </style>
  `;

  const watermarkHtml = `
    <div class="demo-watermark">İSG PANEL – DEMO</div>
    <div class="demo-footer">Demo sürüm – ticari kullanım için geçerli değildir</div>
  `;

  if (html.includes("</body>")) {
    return html.replace("</body>", `${watermarkCss}${watermarkHtml}</body>`);
  }
  return html + watermarkCss + watermarkHtml;
}

function isDemoRequest(pdfData) {
  if (pdfData?.demo === true) return true;
  return String(process.env.DEMO_MODE || "").toLowerCase() === "true";
}

/* =========================
   BROWSER REUSE
   ========================= */
let browserInstance = null;
let browserLaunchingPromise = null;

async function getBrowser() {
  if (browserInstance) return browserInstance;
  if (browserLaunchingPromise) return browserLaunchingPromise;

  browserLaunchingPromise = (async () => {
    const browser = await launchBrowserSafe(); // ✅ DOĞRU

    browser.on("disconnected", () => {
      browserInstance = null;
      browserLaunchingPromise = null;
    });

    browserInstance = browser;
    return browser;
  })();

  try {
    return await browserLaunchingPromise;
  } finally {
    browserLaunchingPromise = null;
  }
}

/* -------------------------
   ✅ Puppeteer headless uyumluluk
   ------------------------- */
async function launchBrowserSafe() {
  const args = ["--no-sandbox", "--disable-setuid-sandbox"];
  try {
    return await puppeteer.launch({ headless: "new", args });
  } catch (_) {
    return await puppeteer.launch({ headless: true, args });
  }
}

/* -------------------------
   KAŞE YARDIMCILARI
   ------------------------- */
function toUpperTR(value) {
  return String(value || "").toLocaleUpperCase("tr-TR");
}

function splitDisplayNameAndCert(value) {
  const raw = String(value || "").trim();
  if (!raw) return { name: "", certNo: "" };

  const parts = raw
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);

  if (parts.length === 0) return { name: "", certNo: "" };
  if (parts.length === 1) return { name: parts[0], certNo: "" };

  return {
    name: parts[0] || "",
    certNo: parts.slice(1).join(" / ") || "",
  };
}

function sanitizeCertPrefix(value, prefix) {
  const raw = toUpperTR(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith(prefix)) return raw;
  return `${prefix}${raw.replace(new RegExp(`^${prefix}`, "i"), "").trim()}`;
}

function buildUzmanStampData(data) {
  const k = data?.kisiler || {};
  const personal = data?.kisisel || {};
  const imzaUzman = data?.imzalar?.uzman || {};
  const parsed = splitDisplayNameAndCert(k.uzman || "");

 const name = toUpperTR(
  imzaUzman?.adSoyad ||
  parsed.name ||
  k.uzman ||
  personal?.adSoyad ||
  ""
).trim();

  const certNo = sanitizeCertPrefix(
    imzaUzman?.sertifikaNo ||
    personal?.sertifikaNo ||
    parsed.certNo ||
    "",
    "İGU-"
  );

  let title = "İŞ GÜVENLİĞİ UZMANI";

  const certClass = toUpperTR(
    imzaUzman?.sertifikaSinifi ||
    personal?.sertifikaSinifi ||
    ""
  ).trim();

  if (certClass) {
    title = `${certClass} SINIFI İŞ GÜVENLİĞİ UZMANI`;
  }

  return {
    name,
    certNo,
    title,
  };
}

function buildHekimStampData(data) {
  const k = data?.kisiler || {};
  const parsed = splitDisplayNameAndCert(k.hekim || "");

  const name = toUpperTR(parsed.name || "").trim();
  const certNo = sanitizeCertPrefix(parsed.certNo || "", "İH-");
  const title = "İŞYERİ HEKİMİ";

  return { name, certNo, title };
}

function drawCenteredText(page, font, text, centerX, y, size, color, opacity = 1) {
  const safeText = String(text || "").trim();
  if (!safeText) return;

  const textWidth = font.widthOfTextAtSize(safeText, size);
  page.drawText(safeText, {
    x: centerX - textWidth / 2,
    y,
    size,
    font,
    color,
    opacity,
  });
}

function drawStampBlock(page, fonts, centerX, baseY, stampData) {
  const { boldFont } = fonts;
  const { name, certNo, title } = stampData || {};

  if (!name && !certNo && !title) return;

  const stampColor = rgb(29 / 255, 78 / 255, 216 / 255);
  const stampOpacity = 0.42;

  drawCenteredText(page, boldFont, name, centerX, baseY + 10, 7.8, stampColor, stampOpacity);
  drawCenteredText(page, boldFont, title, centerX, baseY + 2, 6.0, stampColor, stampOpacity);
  drawCenteredText(page, boldFont, certNo, centerX, baseY - 6, 6.0, stampColor, stampOpacity);
}

/* ✅ prosedür.js ile aynı footer */
function buildFooter(data) {
  const k = data?.kisiler || {};

  function onlyName(val) {
    return String(val || "")
      .split("/")
      .map((s) => s.trim())[0] || "";
  }

  return `
  <style>
    .fwrap{
      width:100%;
      font-family:"Times New Roman", serif;
      font-size:5.8pt;
      line-height:1.05;
      text-align:center;
      padding:0 12mm;
      box-sizing:border-box;
      transform: translateY(-10mm);
    }
    .line{border-top:1px solid #000;margin-bottom:1.6mm;}
    table{width:100%;border-collapse:collapse;table-layout:fixed;}
    td{vertical-align:top;text-align:center;padding:0 2mm;white-space:nowrap;}
    .name{font-size:5.2pt;margin-top:0.6mm;}
    .pno{font-size:9pt;margin-top:0.6mm;}
  </style>

  <div class="fwrap">
    <div class="line"></div>
    <table>
      <tr>
        <td>İŞVEREN / İŞVEREN VEKİLİ<div class="name">${k.isveren || ""}</div></td>
        <td>İŞ GÜVENLİĞİ UZMANI<div class="name">${onlyName(k.uzman)}</div></td>
<td>İŞYERİ HEKİMİ<div class="name">${onlyName(k.hekim)}</div></td>
        <td>ÇALIŞAN TEMSİLCİSİ<div class="name">${k.temsilci || ""}</div></td>
        <td>DESTEK ELEMANI<div class="name">${k.destek || ""}</div></td>
        <td>BİLGİ SAHİBİ KİŞİ<div class="name">${k.bilgiSahibi || ""}</div></td>
      </tr>
    </table>
    <div class="pno"><span class="pageNumber"></span></div>
  </div>
  `;
}

async function mergePdfs(outPath, pdfPaths) {
  const merged = await PDFDocument.create();
  for (const p of pdfPaths) {
    const bytes = fs.readFileSync(p);
    const doc = await PDFDocument.load(bytes);
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    pages.forEach((pg) => merged.addPage(pg));
  }
  const outBytes = await merged.save();
  fs.writeFileSync(outPath, outBytes);
}

async function placeSignatures(pdfPath, data) {
  const existingPdfBytes = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(existingPdfBytes);

  pdfDoc.registerFontkit(fontkit);
  const pages = pdfDoc.getPages();
  const imzalar = data?.imzalar || {};

  const boldFont = await embedBoldFont(pdfDoc, fontkit);

  async function embedImage(dataUrl) {
    if (!dataUrl || typeof dataUrl !== "string") return null;

    const parts = dataUrl.split(",");
    if (parts.length < 2) return null;

    const meta = parts[0] || "";
    const base64 = parts[1] || "";
    if (!base64) return null;

    const imgBytes = Buffer.from(base64, "base64");

    try {
      if (meta.includes("image/jpeg") || meta.includes("image/jpg")) {
        return await pdfDoc.embedJpg(imgBytes);
      }
      return await pdfDoc.embedPng(imgBytes);
    } catch {
      try {
        return await pdfDoc.embedPng(imgBytes);
      } catch {
        try {
          return await pdfDoc.embedJpg(imgBytes);
        } catch {
          return null;
        }
      }
    }
  }

  const roles = ["isveren", "uzman", "hekim", "temsilci", "destek", "bilgi"];

  const roleImages = {};
  for (const role of roles) {
    roleImages[role] = {
      imza: await embedImage(imzalar?.[role]?.imza?.dataUrl),
      paraf: await embedImage(imzalar?.[role]?.paraf?.dataUrl),
    };
  }

  const centers = {
    isveren: 80,
    uzman: 165,
    hekim: 255,
    temsilci: 345,
    destek: 430,
    bilgi: 520,
  };

  const uzmanStamp = buildUzmanStampData(data);
  const hekimStamp = buildHekimStampData(data);

  pages.forEach((page, pageIndex) => {
    if (pageIndex === 0) return;

    for (const role of roles) {
      let image = null;
      let width = 0;
      let height = 0;
      let imageY = 0;
      let stampBaseY = 0;

      if (pageIndex === 1) {
        image = roleImages[role]?.imza;
        width = 135;
        height = 54;
        imageY = 7;
        stampBaseY = 30;
      } else {
        image = roleImages[role]?.paraf;
        width = 135;
        height = 54;
        imageY = 5;
        stampBaseY = 30;
      }

      const centerX = centers[role];

      if (role === "uzman") {
        drawStampBlock(page, { boldFont }, centerX, stampBaseY, uzmanStamp);
      }

      if (role === "hekim") {
        drawStampBlock(page, { boldFont }, centerX, stampBaseY, hekimStamp);
      }

      if (!image) continue;

      const x = centerX - width / 2;

      page.drawImage(image, {
        x,
        y: imageY,
        width,
        height,
      });
    }
  });

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(pdfPath, pdfBytes);
}

/* =========================
   ✅ KİŞİLERİ HER YERDEN TOPARLA (GARANTİ)
   ========================= */
function getByPath(obj, pathStr) {
  try {
    if (!obj) return undefined;
    const parts = String(pathStr).split(".").map((s) => s.trim()).filter(Boolean);
    let cur = obj;
    for (const p of parts) {
      if (cur && typeof cur === "object" && p in cur) cur = cur[p];
      else return undefined;
    }
    return cur;
  } catch {
    return undefined;
  }
}

function pickFirstPaths(obj, paths) {
  for (const p of paths) {
    const v = getByPath(obj, p);
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function normalizeKisiler(data, pdfData) {
  const sources = [
    data,
    data?.kisiler,
    pdfData,
    pdfData?.kisiler,
    pdfData?.prosedur,
    pdfData?.prosedur?.kisiler,
    pdfData?.risk,
    pdfData?.risk?.kisiler,
    pdfData?.kisisel,
    pdfData?.user,
  ].filter(Boolean);

  // dizi imza (yedek)
  const arr =
    (Array.isArray(pdfData?.imzaKisileri6) && pdfData.imzaKisileri6) ||
    (Array.isArray(data?.imzaKisileri6) && data.imzaKisileri6) ||
    (Array.isArray(pdfData?.imzaKisileri) && pdfData.imzaKisileri) ||
    (Array.isArray(data?.imzaKisileri) && data.imzaKisileri) ||
    null;

  const readFromAll = (paths) => {
    for (const s of sources) {
      const v = pickFirstPaths(s, paths);
      if (v) return v;
    }
    return "";
  };

  const out = {
    isveren:
      readFromAll([
        "kisiler.isveren",
        "kisiler.isverenVekili",
        "kisiler.isveren_vekili",
        "isveren",
        "isverenVekili",
        "isveren_vekili",
        "imza.isveren",
      ]) || (arr?.[0]?.adSoyad || arr?.[0]?.isim || ""),

    uzman:
      readFromAll([
        "kisiler.uzman",
        "kisiler.isgUzmani",
        "kisiler.isg_uzmani",
        "uzman",
        "isgUzmani",
        "isg_uzmani",
        "kisisel.adSoyad",
        "user.adSoyad",
        "user.ad",
      ]) || (arr?.[1]?.adSoyad || arr?.[1]?.isim || ""),

    hekim:
      readFromAll([
        "kisiler.hekim",
        "kisiler.isyeriHekimi",
        "kisiler.isyeri_hekim",
        "hekim",
        "isyeriHekimi",
        "isyeri_hekim",
      ]) || (arr?.[2]?.adSoyad || arr?.[2]?.isim || ""),

    temsilci:
      readFromAll([
        "kisiler.temsilci",
        "kisiler.calisanTemsilcisi",
        "kisiler.calisan_temsilcisi",
        "temsilci",
        "calisanTemsilcisi",
        "calisan_temsilcisi",
      ]) || (arr?.[3]?.adSoyad || arr?.[3]?.isim || ""),

    destek:
      readFromAll([
        "kisiler.destek",
        "kisiler.destekElemani",
        "kisiler.destek_elemani",
        "destek",
        "destekElemani",
        "destek_elemani",
      ]) || (arr?.[4]?.adSoyad || arr?.[4]?.isim || ""),

    bilgiSahibi:
      readFromAll([
        "kisiler.bilgiSahibi",
        "kisiler.bilgi",
        "kisiler.bilgiSahibiKisi",
        "kisiler.bilgi_sahibi",
        "bilgiSahibi",
        "bilgi",
        "bilgiSahibiKisi",
        "bilgi_sahibi",
      ]) || (arr?.[5]?.adSoyad || arr?.[5]?.isim || ""),
  };

  // son temizlik
  for (const k of Object.keys(out)) out[k] = (out[k] || "").toString().trim();

  return out;
}

function normalizeKisisel(data, pdfData) {
  const sources = [
    data,
    data?.kisisel,
    pdfData,
    pdfData?.kisisel,
    pdfData?.prosedur,
    pdfData?.prosedur?.kisisel,
    pdfData?.risk,
    pdfData?.risk?.kisisel,
    pdfData?.user,
  ].filter(Boolean);

  const readFromAll = (paths) => {
    for (const s of sources) {
      const v = pickFirstPaths(s, paths);
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return "";
  };

  return {
    adSoyad: readFromAll([
      "kisisel.adSoyad",
      "adSoyad",
      "user.adSoyad",
      "user.ad",
      "ad",
      "name",
    ]),
    sertifikaNo: readFromAll([
      "kisisel.sertifikaNo",
      "sertifikaNo",
      "uzmanSertifikaNo",
      "certificateNo",
    ]),
    sertifikaSinifi: readFromAll([
      "kisisel.sertifikaSinifi",
      "sertifikaSinifi",
      "sertifikaSınıfı",
      "sinif",
      "sinifi",
      "uzmanlikSinifi",
      "certificateClass",
    ]),
  };
}

/**
 * ACİL DURUM PLANI PDF üret (KAPAK + İÇERİK ayrı, sonra merge)
 */
async function createAcilDurumPlaniPdf(pdfData) {
  const projectRoot = path.join(__dirname, "..", "..");
  const tplRoot = path.join(projectRoot, "isg_prosedur_template");

  const t = (f) => path.join(tplRoot, "templates", "acildurum", f);
  const cssPath = path.join(tplRoot, "styles", "prosedur.css");
  const jsonPath = path.join(tplRoot, "data.json");

  const outDir = path.join(projectRoot, "output");
  const outPdf = path.join(outDir, "acildurumplani.pdf");
  const tmpKapakPdf = path.join(outDir, "_acil_kapak.pdf");
  const tmpIcerikPdf = path.join(outDir, "_acil_icerik.pdf");

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  // ✅ KAPAK
  let kapak = readBodyOnly(t("acildurumplani.html"));

  // ✅ İÇERİK
  let icerik = readBodyOnly(t("acildurum.html"));

  // DATA: data.json + pdfData merge
  let fileData = {};
  if (fs.existsSync(jsonPath)) {
    try {
      const raw = fs.readFileSync(jsonPath, "utf8");
      fileData = raw.trim() ? JSON.parse(raw) : {};
    } catch {
      fileData = {};
    }
  }

  let data = JSON.parse(JSON.stringify(fileData || {}));
  if (pdfData && typeof pdfData === "object") {
   data = {
  ...data,
  ...pdfData,
  kurumsal: { ...(data.kurumsal || {}), ...(pdfData.kurumsal || {}) },
  firma: { ...(data.firma || {}), ...(pdfData.firma || {}) },
  tarihler: { ...(data.tarihler || {}), ...(pdfData.tarihler || {}) },
  kisiler: { ...(data.kisiler || {}), ...(pdfData.kisiler || {}) },
  imzalar: { ...(data.imzalar || {}), ...(pdfData.imzalar || {}) },
  kisisel: { ...(data.kisisel || {}), ...(pdfData.kisisel || {}) },
  panel: { ...(data.panel || {}), ...(pdfData.panel || {}) },
  acil: { ...(data.acil || {}), ...(pdfData.acil || {}) },
};
  }

data.kurumsal = data.kurumsal || {};
data.firma = data.firma || {};
data.tarihler = data.tarihler || {};
data.kisiler = data.kisiler || {};
data.imzalar = data.imzalar || {};
data.kisisel = data.kisisel || {};
data.panel = data.panel || {};
data.acil = data.acil || {};

// ✅ QR doğrulama
const verificationCode =
  data.verificationCode ||
  Math.random().toString(36).slice(2, 10).toUpperCase();

data.verificationCode = verificationCode;

const verifyUrl =
  `https://app.isgpanel.tr/dogrula/${verificationCode}`;

data.verifyUrl = verifyUrl;

data.qrCodeDataUrl = await QRCode.toDataURL(verifyUrl, {
  width: 220,
  margin: 1,
});

  // ✅ KRİTİK: kişi bilgilerini burada GARANTİLE
  data.kisiler = normalizeKisiler(data, pdfData);

data.kisisel = {
  ...(data.kisisel || {}),
  ...normalizeKisisel(data, pdfData),
};

 // ✅ ALT LOGO (panel.logoUrl) garanti
const publicDir = path.join(projectRoot, "public");
const altLogoPath = path.join(publicDir, "isgpanel-logo.png");

let altLogoDataUri = fileToDataUri(altLogoPath);

if (!altLogoDataUri) {
  const demoSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="420" height="120">
  <rect width="100%" height="100%" fill="#0a2b45"/>
  <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle"
        font-family="Arial" font-size="42" fill="#fff">ISG PANEL</text>
</svg>`;
  altLogoDataUri =
    "data:image/svg+xml;base64," +
    Buffer.from(demoSvg, "utf8").toString("base64");
}

data.panel.logoUrl = altLogoDataUri;

// ✅ KURUMSAL LOGO ÇÖZÜMLE
let kurumsalDataUri =
  ensureDataUriFromPossibleBase64(data.kurumsal.logo, "image/png") ||
  ensureDataUriFromPossibleBase64(data.kurumsal.logoBase64, "image/png");

// logoUrl varsa onu da dene
if (!kurumsalDataUri && data.kurumsal.logoUrl) {
  const rawLogoUrl = String(data.kurumsal.logoUrl || "").trim();

  if (rawLogoUrl.startsWith("data:")) {
    kurumsalDataUri = rawLogoUrl;
  } else {
    const absLogoPath = uploadsUrlToAbsPath(projectRoot, rawLogoUrl);
    if (absLogoPath) {
      kurumsalDataUri = fileToDataUri(absLogoPath);
    }
  }
}

// ✅ EN SON FALLBACK: ISG PANEL LOGOSU
// ❌ fallback kaldırıldı
if (!kurumsalDataUri) {
  kurumsalDataUri = "";
}

data.kurumsal.logoUrl = kurumsalDataUri;
data.kurumsal.logo = kurumsalDataUri;

  // ✅ 3 foto url -> dataURI
  function urlToDataUriIfPossible(url) {
    const abs = uploadsUrlToAbsPath(projectRoot, url);
    return abs ? fileToDataUri(abs) : "";
  }

  if (!isDataUri(data.acil.toplanmaFoto) && data.acil.toplanmaFotoUrl) {
    const uri = urlToDataUriIfPossible(data.acil.toplanmaFotoUrl);
    if (uri) data.acil.toplanmaFoto = uri;
  }
  data.toplanmaFotoUrl = data.acil.toplanmaFoto || data.toplanmaFotoUrl || "";

  const tahliyeUrl = data.acil.tahliyeFotoUrl || data.acil.tahliyePlaniUrl || "";
  if (!isDataUri(data.acil.tahliyePlaniGorseli) && tahliyeUrl) {
    const uri = urlToDataUriIfPossible(tahliyeUrl);
    if (uri) data.acil.tahliyePlaniGorseli = uri;
  }
  data.tahliyeFotoUrl =
    data.acil.tahliyePlaniGorseli || data.tahliyeFotoUrl || "";

  if (!isDataUri(data.acil.hastaneFoto) && data.acil.hastaneFotoUrl) {
    const uri = urlToDataUriIfPossible(data.acil.hastaneFotoUrl);
    if (uri) data.acil.hastaneFoto = uri;
  }
  data.hastaneFotoUrl = data.acil.hastaneFoto || data.hastaneFotoUrl || "";
  data.acil.hastaneKrokisi =
    data.acil.hastaneFoto || data.acil.hastaneKrokisi || "";

  // ✅ asset auto inject
  const acilAssetsDir = path.join(projectRoot, "backend", "assets", "acil");
  const acilIconsDir = path.join(acilAssetsDir, "icons");

  function putAssetIfEmpty(key, filename) {
    if (isDataUri(data.acil[key])) return;
    const abs = path.join(acilAssetsDir, filename);
    const uri = fileToDataUri(abs);
    if (uri) data.acil[key] = uri;
  }
  function putIconIfEmpty(key, filename) {
    if (isDataUri(data.acil[key])) return;
    const abs = path.join(acilIconsDir, filename);
    const uri = fileToDataUri(abs);
    if (uri) data.acil[key] = uri;
  }

  putAssetIfEmpty("banner112", "banner-112.svg");
  putIconIfEmpty("iconAcilCikis", "icon-acil-cikis.svg");
  putIconIfEmpty("iconYanginTupu", "icon-yangin-tupu.svg");
  putIconIfEmpty("iconIlkYardim", "icon-ilk-yardim.svg");
  putIconIfEmpty("iconToplanma", "icon-toplanma.svg");
  putIconIfEmpty("iconAlarm", "icon-alarm.svg");

  // ✅ TEMPLATES içindeki {{acil.xxx}} placeholder'larını tarayıp otomatik asset doldur
  const allBodiesForScan = [kapak, icerik];
  autoInjectAcilAssetsFromTemplates(allBodiesForScan, data, acilAssetsDir, acilIconsDir);

  // ✅ fill templates
  kapak = fillVars(kapak, data);
  icerik = fillVars(icerik, data);

  const css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, "utf8") : "";

  let htmlKapak = wrapHtml(css, kapak);
  let htmlIcerik = wrapHtml(css, icerik);

  // ✅ DEMO watermark (demo kullanıcıda)
  if (isDemoRequest(pdfData)) {
    htmlKapak = injectDemoWatermark(htmlKapak);
    htmlIcerik = injectDemoWatermark(htmlIcerik);
  }

  // ✅ PDF üret
 const browser = await getBrowser();

   // kapak (footer yok)
  {
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(120000);
    page.setDefaultTimeout(120000);

    await page.setContent(htmlKapak, {
      waitUntil: "domcontentloaded",
      timeout: 0,
    });

    const kapakPdfBuffer = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      displayHeaderFooter: false,
      margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
    });

    fs.writeFileSync(tmpKapakPdf, kapakPdfBuffer);

    if (!fs.existsSync(tmpKapakPdf)) {
      throw new Error(`Kapak PDF oluşturulamadı: ${tmpKapakPdf}`);
    }

    await page.close();
  }


    // içerik (footer var)
  {
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(120000);
    page.setDefaultTimeout(120000);

    await page.setContent(htmlIcerik, {
      waitUntil: "domcontentloaded",
      timeout: 0,
    });

    const icerikPdfBuffer = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: `<div></div>`,
      footerTemplate: buildFooter(data),
      margin: { top: "0mm", right: "0mm", bottom: "55mm", left: "0mm" },
    });

    fs.writeFileSync(tmpIcerikPdf, icerikPdfBuffer);

    if (!fs.existsSync(tmpIcerikPdf)) {
      throw new Error(`İçerik PDF oluşturulamadı: ${tmpIcerikPdf}`);
    }

    await page.close();
  }

   

  if (!fs.existsSync(tmpKapakPdf)) {
    throw new Error(`Merge öncesi kapak PDF bulunamadı: ${tmpKapakPdf}`);
  }

  if (!fs.existsSync(tmpIcerikPdf)) {
    throw new Error(`Merge öncesi içerik PDF bulunamadı: ${tmpIcerikPdf}`);
  }

   // ✅ merge: kapak + içerik
  await mergePdfs(outPdf, [tmpKapakPdf, tmpIcerikPdf]);

  // ✅ prosedürde kayıtlı imza / parafları PDF'e bas
  await placeSignatures(outPdf, data);

  // temizlik
  try { fs.unlinkSync(tmpKapakPdf); } catch {}
  try { fs.unlinkSync(tmpIcerikPdf); } catch {}

  return outPdf;
}

module.exports = { createAcilDurumPlaniPdf };
