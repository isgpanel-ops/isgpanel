const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");
const QRCode = require("qrcode");
const crypto = require("crypto");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const fontkit = require("@pdf-lib/fontkit");
const { embedBoldFont } = require("../utils/pdfFonts");
/* =========================
   BROWSER REUSE
   ========================= */
let browserInstance = null;
let browserLaunchingPromise = null;

async function getBrowser() {
  if (browserInstance) return browserInstance;
  if (browserLaunchingPromise) return browserLaunchingPromise;

  browserLaunchingPromise = (async () => {
    const browser = await launchBrowserSafe();

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

/* body içeriği al */
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

/* {{a.b}} doldur */
function fillVars(tpl, data) {
  return tpl.replace(/{{\s*([\w.]+)\s*}}/g, (_, key) => {
    const val = key
      .split(".")
      .reduce((o, k) => (o && o[k] != null ? o[k] : ""), data);
    return val == null ? "" : String(val);
  });
}

/* Dosyayı Base64 data URI yapar */
function fileToDataUri(absPath) {
  if (!fs.existsSync(absPath)) {
    console.warn("[LOGO] Dosya bulunamadı:", absPath);
    return "";
  }
  const ext = path.extname(absPath).toLowerCase();
  const mime =
    ext === ".png"
      ? "image/png"
      : ext === ".jpg" || ext === ".jpeg"
      ? "image/jpeg"
      : ext === ".svg"
      ? "image/svg+xml"
      : "application/octet-stream";
  const buf = fs.readFileSync(absPath);
  return `data:${mime};base64,${buf.toString("base64")}`;
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
  const isDemo =
    pdfData?.demo === true ||
    pdfData?.__isDemoUser === true ||
    pdfData?.isDemo === true;

  if (isDemo) return true;

  return String(process.env.DEMO_MODE || "").toLowerCase() === "true";
}

/* ✅ Puppeteer headless uyumluluk */
async function launchBrowserSafe() {
  const args = ["--no-sandbox", "--disable-setuid-sandbox"];
  try {
    return await puppeteer.launch({ headless: "new", args });
  } catch (_) {
    return await puppeteer.launch({ headless: true, args });
  }
}

/* -------------------------
   STRING YARDIMCILARI
   ------------------------- */
function toUpperTR(value) {
  return String(value || "").toLocaleUpperCase("tr-TR");
}

function normalizeTR(text) {
  return String(text || "")
    .replace(/İ/g, "I")
    .replace(/ı/g, "i")
    .replace(/Ş/g, "S")
    .replace(/ş/g, "s")
    .replace(/Ğ/g, "G")
    .replace(/ğ/g, "g")
    .replace(/Ü/g, "U")
    .replace(/ü/g, "u")
    .replace(/Ö/g, "O")
    .replace(/ö/g, "o")
    .replace(/Ç/g, "C")
    .replace(/ç/g, "c");
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

/* -------------------------
   ROL VERİSİ
   ------------------------- */
function buildUzmanStampData(data) {
  const k = data?.kisiler || {};
  const personal = data?.kisisel || {};

  const parsed = splitDisplayNameAndCert(k.uzman || "");

  const name = toUpperTR(parsed.name || k.uzman || "").trim();

  // Öncelik kişisel bilgilerdeki gerçek sertifika no
  // Yoksa prosedür alanındaki "AD SOYAD / İGU-12345" formatından al
  const certNo = sanitizeCertPrefix(
    personal?.sertifikaNo || parsed.certNo || "",
    "İGU-"
  );

  let title = "İŞ GÜVENLİĞİ UZMANI";

  const certClass = toUpperTR(personal?.sertifikaSinifi || "").trim();
  if (certClass) {
    title = `${certClass} SINIFI İŞ GÜVENLİĞİ UZMANI`;
  }

  return { name, certNo, title };
}

function buildHekimStampData(data) {
  const k = data?.kisiler || {};
  const parsed = splitDisplayNameAndCert(k.hekim || "");

  const name = toUpperTR(parsed.name || "").trim();
  const certNo = sanitizeCertPrefix(parsed.certNo || "", "İH-");
  const title = "İŞYERİ HEKİMİ";

  return { name, certNo, title };
}

function buildRoleLabels(data) {
  const k = data?.kisiler || {};
  return {
    isveren: {
      label: "İŞVEREN / İŞVEREN VEKİLİ",
      name: toUpperTR(k.isveren || ""),
    },
    uzman: {
      label: "İŞ GÜVENLİĞİ UZMANI",
      name: toUpperTR(splitDisplayNameAndCert(k.uzman || "").name || k.uzman || ""),
    },
    hekim: {
      label: "İŞYERİ HEKİMİ",
      name: toUpperTR(splitDisplayNameAndCert(k.hekim || "").name || ""),
    },
    temsilci: {
      label: "ÇALIŞAN TEMSİLCİSİ",
      name: toUpperTR(k.temsilci || ""),
    },
    destek: {
      label: "DESTEK ELEMANI",
      name: toUpperTR(k.destek || ""),
    },
    bilgi: {
      label: "BİLGİ SAHİBİ KİŞİ",
      name: toUpperTR(k.bilgiSahibi || ""),
    },
  };
}

/* footer template (icerik.pdf için)
   Uzman ve hekim ad soyad tekrar görünür.
   Kaşe + imza aynı kutuda PDF üstüne sonradan çizilir.
*/
function buildFooter(data) {
  const roles = buildRoleLabels(data);

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
    .line{
      border-top:1px solid #000;
      margin-bottom:1.6mm;
    }
    table{
      width:100%;
      border-collapse:collapse;
      table-layout:fixed;
    }
    td{
      vertical-align:top;
      text-align:center;
      padding:0 2mm;
      white-space:nowrap;
    }
    .role-label{
      font-size:5.3pt;
      font-weight:700;
      margin-bottom:0.8mm;
    }
    .name{
      font-size:5.0pt;
      margin-top:0.4mm;
    }
    .pno{
      font-size:9pt;
      margin-top:0.6mm;
    }
  </style>

  <div class="fwrap">
    <div class="line"></div>
    <table>
      <tr>
        <td>
          <div class="role-label">${roles.isveren.label}</div>
          <div class="name">${roles.isveren.name || ""}</div>
        </td>
        <td>
          <div class="role-label">${roles.uzman.label}</div>
          <div class="name">${roles.uzman.name || ""}</div>
        </td>
        <td>
          <div class="role-label">${roles.hekim.label}</div>
          <div class="name">${roles.hekim.name || ""}</div>
        </td>
        <td>
          <div class="role-label">${roles.temsilci.label}</div>
          <div class="name">${roles.temsilci.name || ""}</div>
        </td>
        <td>
          <div class="role-label">${roles.destek.label}</div>
          <div class="name">${roles.destek.name || ""}</div>
        </td>
        <td>
          <div class="role-label">${roles.bilgi.label}</div>
          <div class="name">${roles.bilgi.name || ""}</div>
        </td>
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

/* -------------------------
   KAŞE ÇİZİMİ
   ------------------------- */
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

  // Kaşe bir tık küçültüldü
  // Ve küçük isim satırının hemen altına yaklaştırıldı

drawCenteredText(
  page,
  boldFont,
  name,
  centerX,
  baseY + 10,
  7.8,
  stampColor,
  stampOpacity
);

drawCenteredText(
  page,
  boldFont,
  title,
  centerX,
  baseY + 2,
  6.0,
  stampColor,
  stampOpacity
);

drawCenteredText(
  page,
  boldFont,
  certNo,
  centerX,
  baseY - 6,
  6.0,
  stampColor,
  stampOpacity
);


}

/* ✅ kapak hariç:
   - içerik ilk sayfa = gerçek imza
   - içerik diğer sayfalar = paraf
   - uzman/hekim için kaşe + imza aynı merkezde
   - kaşe metni aynı kutuda ortalı
*/
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
        imageY = 5;
        // Kaşe isim satırının hemen altına gelsin diye yukarı aldık
        stampBaseY =30;
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

async function createPdf(pdfData) {
  const root = path.join(__dirname, "..", "..");
  const tplRoot = path.join(root, "isg_prosedur_template");

  const kapakPath = path.join(tplRoot, "templates", "prosedur", "kapak.html");
  const prosedurPath = path.join(
    tplRoot,
    "templates",
    "prosedur",
    "prosedur.html"
  );
  const cssPath = path.join(tplRoot, "styles", "prosedur.css");
  const jsonPath = path.join(tplRoot, "data.json");

  const outDir = path.join(root, "output");

  const uniq = `${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;

  const outPdf = path.join(outDir, `prosedur_${uniq}.pdf`);
  const tmpKapakPdf = path.join(outDir, `_kapak_${uniq}.pdf`);
  const tmpIcerikPdf = path.join(outDir, `_icerik_${uniq}.pdf`);

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  let kapak = readBodyOnly(kapakPath);
  let prosedur = readBodyOnly(prosedurPath);

  let data = {};
  if (fs.existsSync(jsonPath)) {
    const raw = fs.readFileSync(jsonPath, "utf8");
    data = raw.trim() ? JSON.parse(raw) : {};
  }

  if (pdfData) {
    data = {
      ...data,
      ...pdfData,
      kurumsal: { ...(data.kurumsal || {}), ...(pdfData.kurumsal || {}) },
      panel: { ...(data.panel || {}), ...(pdfData.panel || {}) },
      kisiler: { ...(data.kisiler || {}), ...(pdfData.kisiler || {}) },
      imzalar: { ...(data.imzalar || {}), ...(pdfData.imzalar || {}) },
      kisisel: { ...(data.kisisel || {}), ...(pdfData.kisisel || {}) },
    };
  }
  if (!data.panel) data.panel = {};

 // ✅ Sadece yüklenen firma logosu kullanılır
const publicDir = path.join(root, "public");
const altLogoPath = path.join(publicDir, "isgpanel-logo.png");

let altLogoDataUri = fileToDataUri(altLogoPath);

data.panel.logoUrl = altLogoDataUri;

/* =========================
   QR DOĞRULAMA
   ========================= */

const verificationCode =
  data.verificationCode ||
  crypto.randomBytes(5)
    .toString("hex")
    .toUpperCase();

const verifyUrl =
  `https://app.isgpanel.tr/dogrula/${verificationCode}`;

const verifyQr = await QRCode.toDataURL(verifyUrl);

data.verificationCode = verificationCode;
data.verifyUrl = verifyUrl;
data.verifyQr = verifyQr;

  kapak = fillVars(kapak, data);
  prosedur = fillVars(prosedur, data);

  const css = fs.readFileSync(cssPath, "utf8");

  let htmlKapak = `<!doctype html><html lang="tr"><head><meta charset="utf-8">
  <style>${css}</style></head><body>${kapak}</body></html>`;

  let htmlIcerik = `<!doctype html><html lang="tr"><head><meta charset="utf-8">
  <style>${css}</style></head><body>${prosedur}</body></html>`;

  if (isDemoRequest(pdfData)) {
    htmlKapak = injectDemoWatermark(htmlKapak);
    htmlIcerik = injectDemoWatermark(htmlIcerik);
  }

  const browser = await getBrowser();

  {
    const page = await browser.newPage();
    await page.setContent(htmlKapak, { waitUntil: "load" });
    await page.pdf({
      path: tmpKapakPdf,
      format: "A4",
      printBackground: true,
      displayHeaderFooter: false,
      margin: { top: "10mm", right: "12mm", bottom: "20mm", left: "12mm" },
    });
    await page.close();
  }

  {
    const page = await browser.newPage();
    await page.setContent(htmlIcerik, { waitUntil: "load" });
    await page.pdf({
      path: tmpIcerikPdf,
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: `<div></div>`,
      footerTemplate: buildFooter(data),
      margin: { top: "10mm", right: "12mm", bottom: "55mm", left: "12mm" },
    });
    await page.close();
  }

  await mergePdfs(outPdf, [tmpKapakPdf, tmpIcerikPdf]);
  await placeSignatures(outPdf, data);

  try {
    fs.unlinkSync(tmpKapakPdf);
  } catch {}
  try {
    fs.unlinkSync(tmpIcerikPdf);
  } catch {}

  return outPdf;
}

module.exports = createPdf;
module.exports.createPdf = createPdf;
module.exports.getBrowser = getBrowser;
