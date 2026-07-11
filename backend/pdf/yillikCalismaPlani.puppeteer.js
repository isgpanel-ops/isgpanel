const fs = require("fs");
const path = require("path");
const Mustache = require("mustache");
const puppeteer = require("puppeteer");
const { PDFDocument, rgb } = require("pdf-lib");
const fontkit = require("@pdf-lib/fontkit");
const { embedBoldFont } = require("../utils/pdfFonts");

const TEMP_DIR = path.join(__dirname, "temp");
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || "http://localhost:5001";

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}
function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function toTrDate(value) {
  if (!value) return "";
  const s = String(value).trim();
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) return s;

  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}.${m[2]}.${m[1]}`;

  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = d.getFullYear();
    return `${dd}.${mm}.${yy}`;
  }
  return s;
}

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function injectDemoWatermark(html) {
  const watermarkCss = `
    <style>
      .demo-watermark {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) rotate(-30deg);
        font-size: 96px;
        color: rgba(0, 0, 0, 0.06);
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

function isDemoMode(payload = {}) {
  if (payload?.demo === true) return true;
  return String(process.env.DEMO_MODE || "").toLowerCase() === "true";
}

function getProjectRoot() {
  const cwd = process.cwd();
  const base = path.basename(cwd).toLowerCase();
  if (base === "backend") return path.dirname(cwd);
  return cwd;
}

function getTemplateAbsPath() {
  const root = getProjectRoot();

  const pOutsideBackend = path.join(
    root,
    "isg_prosedur_template",
    "templates",
    "yillikplanlar",
    "yillik_calisma_plani.html"
  );

  const pInsideBackend = path.join(
    root,
    "backend",
    "isg_prosedur_template",
    "templates",
    "yillikplanlar",
    "yillik_calisma_plani.html"
  );

  if (fs.existsSync(pOutsideBackend)) return pOutsideBackend;
  if (fs.existsSync(pInsideBackend)) return pInsideBackend;

  const err = new Error(
    "Template bulunamadı. Şu yollara baktım:\n" +
      pOutsideBackend +
      "\n" +
      pInsideBackend
  );
  err.code = "TEMPLATE_NOT_FOUND";
  throw err;
}

function isMonthActive(plan, monthKey) {
  const mode = plan?.monthMode || "fromStart";
  if (mode === "full") return true;

  if (mode === "fromStart") {
    const startDate = plan?.baslangicTarihi;
    if (!startDate) return true;
    const d = new Date(startDate);
    const startIdx = Number.isNaN(d.getTime()) ? 0 : d.getMonth();
    const months = Array.isArray(plan?.months) ? plan.months : [];
    const idx = months.findIndex((m) => m.key === monthKey);
    if (idx === -1) return true;
    return idx >= startIdx;
  }

  if (mode === "custom") {
    const cm = Array.isArray(plan?.customMonths) ? plan.customMonths : [];
    return cm.includes(monthKey);
  }

  return true;
}

function pmIcon(val) {
  if (val === "+") {
    return `
      <span class="pm-icon">
        <svg viewBox="0 0 24 24" class="pm-plus" aria-hidden="true">
          <line x1="12" y1="4" x2="12" y2="20"></line>
          <line x1="4" y1="12" x2="20" y2="12"></line>
        </svg>
      </span>
    `;
  }
  if (val === "-") {
    return `
      <span class="pm-icon">
        <svg viewBox="0 0 24 24" class="pm-minus" aria-hidden="true">
          <line x1="4" y1="12" x2="20" y2="12"></line>
        </svg>
      </span>
    `;
  }
  return "";
}

function buildRowsHtml(plan, activitiesSlice = [], startIndex = 0) {
  const months = Array.isArray(plan?.months) ? plan.months : [];

  let html = "";
  activitiesSlice.forEach((row, i) => {
    html += `<tr>`;
    html += `<td class="c">${startIndex + i + 1}</td>`;
    html += `<td class="l">${escapeHtml(row?.name || "")}</td>`;

    months.forEach((m) => {
      const active = isMonthActive(plan, m.key);
      const val = row?.months?.[m.key] || "";

      if (!active) {
        html += `<td class="c"></td>`;
        return;
      }

      if (val === "+" || val === "-") {
        html += `<td class="c">${pmIcon(val)}</td>`;
      } else {
        html += `<td class="c">${escapeHtml(val)}</td>`;
      }
    });

    html += `</tr>\n`;
  });

  if (!activitiesSlice.length) {
    html += `<tr><td class="c" colspan="${2 + months.length}">Kayıt bulunamadı</td></tr>`;
  }

  return html;
}

function chunkActivities(items = [], firstPageSize = 22, otherPageSize = 26) {
  const pages = [];
  let index = 0;
  let pageNo = 0;

  while (index < items.length) {
    const size = pageNo === 0 ? firstPageSize : otherPageSize;
    const slice = items.slice(index, index + size);
    pages.push({
      pageNo: pageNo + 1,
      startIndex: index,
      items: slice,
    });
    index += size;
    pageNo += 1;
  }

  if (!pages.length) {
    pages.push({
      pageNo: 1,
      startIndex: 0,
      items: [],
    });
  }

  return pages;
}

/* Puppeteer tek instance */
let _browserPromise = null;
async function getBrowser() {
  if (!_browserPromise) {
    _browserPromise = puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
  return _browserPromise;
}

async function placeSignatures(pdfPath, payload) {
  const existingPdfBytes = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  pdfDoc.registerFontkit(fontkit);

  const pages = pdfDoc.getPages();

  const boldFont = await embedBoldFont(pdfDoc, fontkit);

  const imzalar = payload?.imzalar || {};

  async function embedImage(dataUrl) {
    if (!dataUrl || typeof dataUrl !== "string") return null;

    const parts = dataUrl.split(",");
    if (parts.length < 2) return null;

    const meta = parts[0];
    const base64 = parts[1];
    const imgBytes = Buffer.from(base64, "base64");

    try {
      if (meta.includes("image/jpeg")) {
        return await pdfDoc.embedJpg(imgBytes);
      }
      return await pdfDoc.embedPng(imgBytes);
    } catch {
      return null;
    }
  }

  const roles = ["uzman", "hekim", "isveren"];

  const roleImages = {};
  for (const role of roles) {
    roleImages[role] = {
      imza: await embedImage(imzalar?.[role]?.imza?.dataUrl),
      paraf: await embedImage(imzalar?.[role]?.paraf?.dataUrl),
    };
  }

 const centers = {
  uzman: 150,
  hekim: 420,
  isveren: 690,
};

const uzmanStamp = buildUzmanStampData(payload);
const hekimStamp = buildHekimStampData(payload);

  pages.forEach((page, index) => {
    for (const role of roles) {
      let img = null;
      let y = 40;

     if (index === 0) {
        img = roleImages[role]?.imza;
      } else {
        img = roleImages[role]?.paraf;
      }

      const centerX = centers[role];

if (role === "uzman") {
  drawStampBlock(page, { boldFont }, centerX, 66, uzmanStamp);
}

if (role === "hekim") {
  drawStampBlock(page, { boldFont }, centerX, 66, hekimStamp);
}

if (!img) continue;

      const width = 150;
      const height = 62;
      const x = centers[role] - width / 2;

      page.drawImage(img, {
        x,
        y,
        width,
        height,
      });
    }
  });

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(pdfPath, pdfBytes);
}

process.on("exit", async () => {
  try {
    if (_browserPromise) (await _browserPromise).close();
  } catch {}
});

function getByPath(obj, dottedPath) {
  try {
    return dottedPath
      .split(".")
      .reduce((acc, k) => (acc && acc[k] !== undefined ? acc[k] : undefined), obj);
  } catch {
    return undefined;
  }
}

function pickFirst(payload, paths) {
  for (const p of paths) {
    const v = getByPath(payload, p);
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      return String(v).trim();
    }
  }
  return "";
}

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

function buildUzmanStampData(payload) {
  const uzmanRaw = pickFirst(payload, [
    "prosedurKisiBilgileri.isgUzmaniAdi",
    "kisiBilgileri.isgUzmaniAdi",
    "kurumsal.kisiBilgileri.isgUzmaniAdi",
    "imzalar.uzman.signerName",
    "imzalar.isgUzmaniAdi",
    "imzalar.isgUzmaniAd",
    "kisiler.uzman",
  ]);

  const parsed = splitDisplayNameAndCert(uzmanRaw);

  const personalCertNo = pickFirst(payload, [
    "kisisel.sertifikaNo",
    "kisiselBilgiler.sertifikaNo",
    "kisisel.sertifika_no",
    "kisiBilgileri.sertifikaNo",
    "kisiBilgileri.uzmanSertifikaNo",
    "kurumsal.kisiBilgileri.sertifikaNo",
    "kurumsal.kisiBilgileri.uzmanSertifikaNo",
    "prosedurKisiBilgileri.sertifikaNo",
    "prosedurKisiBilgileri.uzmanSertifikaNo",
  ]);

  const personalCertClass = pickFirst(payload, [
    "kisisel.sertifikaSinifi",
    "kisiselBilgiler.sertifikaSinifi",
    "kisisel.sertifika_sinifi",
    "kisiBilgileri.sertifikaSinifi",
    "kisiBilgileri.uzmanlikSinifi",
    "kurumsal.kisiBilgileri.sertifikaSinifi",
    "kurumsal.kisiBilgileri.uzmanlikSinifi",
    "prosedurKisiBilgileri.sertifikaSinifi",
    "prosedurKisiBilgileri.uzmanlikSinifi",
  ]);

  const name = toUpperTR(parsed.name || uzmanRaw).trim();
  const certNo = sanitizeCertPrefix(
    personalCertNo || parsed.certNo || "",
    "İGU-"
  );

  let title = "İŞ GÜVENLİĞİ UZMANI";
  const certClass = toUpperTR(personalCertClass).trim();

  if (certClass) {
    title = `${certClass} SINIFI İŞ GÜVENLİĞİ UZMANI`;
  }

  return { name, certNo, title };
}

function buildHekimStampData(payload) {
  const hekimRaw = pickFirst(payload, [
    "prosedurKisiBilgileri.isyeriHekimiAdi",
    "prosedurKisiBilgileri.isYeriHekimiAdi",
    "kisiBilgileri.isyeriHekimiAdi",
    "kurumsal.kisiBilgileri.isyeriHekimiAdi",
    "imzalar.hekim.signerName",
    "imzalar.isyeriHekimiAdi",
    "imzalar.isYeriHekimiAdi",
    "imzalar.isYeriHekimiAd",
    "imzalar.isyeriHekimiAd",
    "kisiler.hekim",
  ]);

  const parsed = splitDisplayNameAndCert(hekimRaw);

  const name = toUpperTR(parsed.name || hekimRaw).trim();
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

async function createYillikCalismaPlaniPdf(payload) {
  ensureDir(TEMP_DIR);

  const templatePath = getTemplateAbsPath();
  const template = fs.readFileSync(templatePath, "utf8");

  const firma = payload?.firma || {};
  const plan = payload?.plan || {};
  const kurumsal = payload?.kurumsal || {};

  let logoUrl = kurumsal.logoUrl || "";
  if (logoUrl && logoUrl.startsWith("/")) {
    logoUrl = `${PUBLIC_BASE_URL}${logoUrl}`;
  }

  const yil = plan?.yil || new Date().getFullYear();
  const baslangicTr = toTrDate(plan?.baslangicTarihi);
  const bitisTr = toTrDate(plan?.bitisTarihi);

  const monthHeaders = (Array.isArray(plan?.months) ? plan.months : []).map(
    (m) => m.label || m.key
  );

  const allActivities = Array.isArray(plan?.activities) ? plan.activities : [];
const pageChunks = chunkActivities(allActivities, 18, 26);

const firstPage = pageChunks.length
  ? [{
      pageNo: 1,
      rowsHtml: buildRowsHtml(plan, pageChunks[0].items, pageChunks[0].startIndex),
    }]
  : [{
      pageNo: 1,
      rowsHtml: buildRowsHtml(plan, [], 0),
    }];

const otherPages = pageChunks.slice(1).map((p) => ({
  pageNo: p.pageNo,
  rowsHtml: buildRowsHtml(plan, p.items, p.startIndex),
}));


const rawIsgUzmaniAdi =
  pickFirst(payload, [
    "imzalar.isgUzmaniAdi",
    "imzalar.isgUzmaniAd",
    "imzalar.isgUzmaniAdSoyad",
    "imzalar.isgUzmaniAdSoyadi",
    "prosedurKisiBilgileri.isgUzmaniAdi",
    "prosedurKisiBilgileri.isgUzmaniAd",
    "kisiler.uzman",
    "olusturan",
  ]) || "İSG Uzmanı";

const isgUzmaniAdi =
  splitDisplayNameAndCert(rawIsgUzmaniAdi).name || rawIsgUzmaniAdi;

const rawIsyeriHekimiAdi = pickFirst(payload, [
  "imzalar.isyeriHekimiAdi",
  "imzalar.isYeriHekimiAd",
  "imzalar.isYeriHekimiAdi",
  "imzalar.isyeriHekimiAdSoyad",
  "imzalar.isyeriHekimiAdSoyadi",
  "imzalar.isYeriHekimiAdSoyad",
  "imzalar.isYeriHekimiAdSoyadi",
  "prosedurKisiBilgileri.isyeriHekimiAdi",
  "prosedurKisiBilgileri.isYeriHekimiAdi",
  "prosedurKisiBilgileri.isYeriHekimiAd",
  "kisiler.hekim",
]);

const isyeriHekimiAdi =
  splitDisplayNameAndCert(rawIsyeriHekimiAdi).name || rawIsyeriHekimiAdi;

// ✅ İŞVEREN
const isverenAdi = pickFirst(payload, [
  // YEP ana
  "imzalar.isverenAdi",
  "imzalar.isVerenAd",
  "imzalar.isVerenAdi",
  // eski/geri uyum
  "imzalar.isverenAdSoyad",
  "imzalar.isverenAdSoyadi",
  "imzalar.isVerenAdSoyad",
  "imzalar.isVerenAdSoyadi",
  // alternatif bloklar
  "prosedurKisiBilgileri.isverenAdi",
  "prosedurKisiBilgileri.isVerenAdi",
  "prosedurKisiBilgileri.isVerenAd",
  "kisiler.isveren",
]);

console.log("[YCP] IMZA DEBUG =>", {
  isgUzmaniAdi,
  isyeriHekimiAdi,
  isverenAdi,
  // 👇 hızlı teşhis için
  imzalarKeys: Object.keys(payload?.imzalar || {}),
  kisiler: payload?.kisiler || {},
  prosedurKisiBilgileri: payload?.prosedurKisiBilgileri || {},
});




const view = {
  logoUrl,
  firmaAdi: firma.firmaAdi || "",
  sgkSicilNo: firma.sgkSicilNo || "",
  tehlikeSinifi: firma.tehlikeSinifi || "",
  yil,
  baslangicTr,
  bitisTr,
  monthHeaders,
  firstPage,
  otherPages,

  // UZMAN
  isgUzmaniAdi,
  isgUzmaniAdSoyad: isgUzmaniAdi,

  // HEKİM
  isyeriHekimiAdi,
  isyeriHekimiAdSoyad: isyeriHekimiAdi,

  // İŞVEREN
  isverenAdi,
  isverenAdSoyad: isverenAdi,
};



  let html = Mustache.render(template, view);

if (isDemoMode(payload)) {
  html = injectDemoWatermark(html);
}


  const browser = await getBrowser();
  const page = await browser.newPage();

  await page.setContent(html, { waitUntil: "networkidle0" });

  const id = makeId();
  const pdfPath = path.join(TEMP_DIR, `${id}.pdf`);

  await page.pdf({
    path: pdfPath,
    printBackground: true,
    preferCSSPageSize: true,
    landscape: true,
    margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
    scale: 0.94, // ✅ TAŞMAYI ENGELLE: 0.98 -> 0.94
  });
await page.close();

// ✅ İMZA BAS
await placeSignatures(pdfPath, payload);

return pdfPath;
}

module.exports = { createYillikCalismaPlaniPdf };
