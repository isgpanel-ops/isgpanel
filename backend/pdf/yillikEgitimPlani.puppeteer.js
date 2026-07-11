// backend/pdf/yillikEgitimPlani.puppeteer.js
const fs = require("fs");
const path = require("path");
const Mustache = require("mustache");
const puppeteer = require("puppeteer");
const { PDFDocument, rgb } = require("pdf-lib");
const fontkit = require("@pdf-lib/fontkit");
const { embedBoldFont } = require("../utils/pdfFonts");

const TEMP_DIR = path.join(__dirname, "temp");

// Prod’da domaininle ayarla (örn: https://app.isgpanel.tr)
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || "http://localhost:5001";

/* =========================
   Helpers
   ========================= */
function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function toTrDate(d) {
  if (!d) return "";
  const s = String(d).trim();
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) return s;

  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}.${m[2]}.${m[1]}`;

  if (d instanceof Date && !isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}.${mm}.${yyyy}`;
  }
  return s;
}

// process.cwd() bazen .../isgpanel, bazen .../isgpanel/backend olur
function getProjectRoot() {
  const cwd = process.cwd();
  const base = path.basename(cwd).toLowerCase();
  if (base === "backend") return path.dirname(cwd);
  return cwd;
}

/**
 * Yapıyı bozmadan: önce dışarıdaki şablon, yoksa backend altındaki şablon
 */
function getTemplateAbsPath() {
  const root = getProjectRoot();

  const pOutsideBackend = path.join(
    root,
    "isg_prosedur_template",
    "templates",
    "yillikplanlar",
    "yillik_egitim_plani.html"
  );

  const pInsideBackend = path.join(
    root,
    "backend",
    "isg_prosedur_template",
    "templates",
    "yillikplanlar",
    "yillik_egitim_plani.html"
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

/**
 * obj içinden "a.b.c" gibi path ile güvenli değer okur
 */
function getByPath(obj, dottedPath) {
  try {
    return dottedPath
      .split(".")
      .reduce((acc, key) => (acc ? acc[key] : undefined), obj);
  } catch {
    return undefined;
  }
}

/**
 * Birden çok olası path/key dener, ilk dolu değeri döndürür
 */
function pickFirst(payload, paths) {
  for (const p of paths) {
    const v = getByPath(payload, p);
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      return String(v).trim();
    }
  }
  return "";
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

/* =========================
   Kaşe yardımcıları
   ========================= */
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
  ]);

  const parsed = splitDisplayNameAndCert(uzmanRaw);

  const personalCertNo = pickFirst(payload, [
    // kişisel bilgiler
    "kisisel.sertifikaNo",
    "kisiselBilgiler.sertifikaNo",
    "kisisel.sertifika_no",

    // kişi bilgileri fallback
    "kisiBilgileri.sertifikaNo",
    "kisiBilgileri.uzmanSertifikaNo",
    "kurumsal.kisiBilgileri.sertifikaNo",
    "kurumsal.kisiBilgileri.uzmanSertifikaNo",
    "prosedurKisiBilgileri.sertifikaNo",
    "prosedurKisiBilgileri.uzmanSertifikaNo",
  ]);

  const personalCertClass = pickFirst(payload, [
    // kişisel bilgiler
    "kisisel.sertifikaSinifi",
    "kisiselBilgiler.sertifikaSinifi",
    "kisisel.sertifika_sinifi",

    // kişi bilgileri fallback
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
  ]);

  const parsed = splitDisplayNameAndCert(hekimRaw);

  const name = toUpperTR(parsed.name || hekimRaw).trim();
  const certNo = sanitizeCertPrefix(parsed.certNo || "", "İH-");
  const title = "İŞYERİ HEKİMİ";

  return { name, certNo, title };
}

/* =========================
   Eğitim konu listesi
   ========================= */
const KONULAR_20 = [
  // 1-4 (İSG Uzmanı)
  "İŞYERİ TEMİZLİĞİ VE DÜZENİ",
  "ÇALIŞMA MEVZUATI İLE İLGİLİ BİLGİLER",
  "ÇALIŞANLARIN YASAL HAK VE SORUMLULUKLARI",
  "İŞ KAZASI VE MESLEK HASTALIĞINDAN DOĞAN HUKUKİ SONUÇLAR",
  // 5-7 (İşyeri Hekimi)
  "MESLEK HASTALIKLARININ SEBEPLERİ",
  "HASTALIKTAN KORUNMA PRENSİPLERİ VE KORUNMA TEKNİKLERİ",
  "BİYOLOJİK VE PSİKOLOJİK RİSK ETMENLERİ",
  // 8-19 (İSG Uzmanı)
  "İLKYARDIM",
  "TÜTÜN ÜRÜNLERİNİN ZARARLARI VE PASİF ETKİLENİM",
  "KİMYASAL,FİZİKSEL VE ERGONOMİK RİSK ETMENLERİ",
  "ELLE KALDIRMA VE TAŞIMA",
  "YANGIN EĞİTİMİ",
  "İŞ EKİPMANLARININ GÜVENLİ KULLANIMI",
  "EKRANLI ARAÇLARLA ÇALIŞMA",
  "ELEKTRİK TEHLİKELERİ RİSKLERİ VE ÖNLEMLERİ",
  "GÜVENLİK VE SAĞLIK İŞARETLERİ",
  "KİŞİSEL KORUYUCU DONANIM KULLANIMI",
  "SAĞLIK VE GÜVENLİK GENEL KURALLARI",
  "TAHLİYE VE KURTARMA",
  "İŞE ÖZEL RİSKLER",
];

function getSaatDeseni(tehlikeSinifi) {
  const t = String(tehlikeSinifi || "").toLowerCase();

  // Az Tehlikeli => 2 + 2 + 2 + 2
  if (t.includes("az")) return [2, 2, 2, 2];

  // Çok Tehlikeli => 2 + 1 + 1 + 4
  if (t.includes("çok")) return [2, 1, 1, 4];

  // Tehlikeli => 2 + 2 + 1 + 3
  if (t.includes("tehlikeli")) return [2, 2, 1, 3];

  return [2, 2, 2, 2];
}

function buildSatirlarHtml(pattern) {
  let html = "";

  for (let i = 0; i < KONULAR_20.length; i++) {
    const no = i + 1;
    const konu = KONULAR_20[i];

    const start1 = no === 1; // 1-4
    const start2 = no === 5; // 5-7
    const start3 = no === 8; // 8-19
    const start4 = no === 20; // 20

    html += `<tr>`;
    html += `<td class="no">${no}</td>`;
    html += `<td class="topic">${konu}</td>`;

    if (start1) {
      html += `<td class="center" rowspan="4">İŞ GÜVENLİĞİ<br>UZMANI</td>`;
    }
    if (start2) {
      html += `<td class="center" rowspan="3">İŞYERİ HEKİMİ</td>`;
    }
    if (start3) {
      html += `<td class="center" rowspan="12">İŞ GÜVENLİĞİ<br>UZMANI</td>`;
    }
    if (start4) {
      html += `<td class="center">İŞ GÜVENLİĞİ<br>UZMANI</td>`;
    }

    html += `<td class="center">TÜM ÇALIŞANLAR</td>`;
    html += `<td></td>`;

    if (start1) {
      html += `<td class="center" rowspan="4">${pattern[0]}</td>`;
    }
    if (start2) {
      html += `<td class="center" rowspan="3">${pattern[1]}</td>`;
    }
    if (start3) {
      html += `<td class="center" rowspan="12">${pattern[2]}</td>`;
    }
    if (start4) {
      html += `<td class="center">${pattern[3]}</td>`;
    }

    html += `<td></td>`;
    html += `</tr>\n`;
  }

  return html;
}

/* =========================
   Puppeteer (tek instance)
   ========================= */
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

/* =========================
   Kaşe çizimi
   ========================= */
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

/* =========================
   İmzalar + kaşe
   ========================= */
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

  const roles = ["isveren", "uzman", "hekim"];

  const roleImages = {};
  for (const role of roles) {
    roleImages[role] = {
      imza: await embedImage(imzalar?.[role]?.imza?.dataUrl),
      paraf: await embedImage(imzalar?.[role]?.paraf?.dataUrl),
    };
  }

  const centers = {
    uzman: 200,
    hekim: 430,
    isveren: 660,
  };

  const uzmanStamp = buildUzmanStampData(payload);
  const hekimStamp = buildHekimStampData(payload);

  pages.forEach((page, pageIndex) => {
    for (const role of roles) {
      let image = null;
      let width = 150;
let height = 62;
let imageY = 70;
let stampBaseY = 96;

      if (pageIndex === 0) {
        image = roleImages[role]?.imza;
      } else {
        image = roleImages[role]?.paraf;
        width = 155;
        height = 64;
        imageY = 84;
        stampBaseY = 108;
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

process.on("exit", async () => {
  try {
    if (_browserPromise) (await _browserPromise).close();
  } catch {}
});

process.on("exit", async () => {
  try {
    if (_browserPromise) (await _browserPromise).close();
  } catch {}
});

/* =========================
   MAIN
   ========================= */
async function createYillikEgitimPlaniPdf(payload) {
  ensureDir(TEMP_DIR);

  const templatePath = getTemplateAbsPath();
  console.log("[YEP-PUP] TEMPLATE =>", templatePath);

  const template = fs.readFileSync(templatePath, "utf8");

  const firma = payload?.firma || {};
  const tarihler = payload?.tarihler || {};
  const kurumsal = payload?.kurumsal || {};

  const tarih = toTrDate(
    tarihler.hazirlamaTr || tarihler.tarih || tarihler.hazirlamaTarihi
  );

  let logoUrl = kurumsal.logoUrl || kurumsal.logo || payload?.logoUrl || "";

  if (logoUrl && logoUrl.startsWith("/")) {
    logoUrl = `${PUBLIC_BASE_URL}${logoUrl}`;
  }
  const logoVarMi = logoUrl ? "has-logo" : "";

  const pattern = getSaatDeseni(firma.tehlikeSinifi || payload?.tehlikeSinifi);
  const satirlarHtml = buildSatirlarHtml(pattern);

  const rawIsgUzmaniAdi = pickFirst(payload, [
    "imzalar.isgUzmaniAdi",
    "imzalar.isgUzmaniAd",
    "kisiBilgileri.isgUzmaniAdi",
    "kisiBilgileri.isgUzmaniAd",
    "kurumsal.kisiBilgileri.isgUzmaniAdi",
    "kurumsal.kisiBilgileri.isgUzmaniAd",
    "prosedurKisiBilgileri.isgUzmaniAdi",
    "prosedurKisiBilgileri.isgUzmaniAd",
    "imzalar.uzman.signerName",
  ]);

  const isgUzmaniAdi = splitDisplayNameAndCert(rawIsgUzmaniAdi).name || rawIsgUzmaniAdi;

  const rawIsyeriHekimiAdi = pickFirst(payload, [
    "imzalar.isyeriHekimiAdi",
    "imzalar.isYeriHekimiAdi",
    "imzalar.isYeriHekimiAd",
    "imzalar.isyeriHekimiAd",
    "kisiBilgileri.isyeriHekimiAdi",
    "kisiBilgileri.isYeriHekimiAdi",
    "kisiBilgileri.isYeriHekimiAd",
    "kisiBilgileri.isyeriHekimiAd",
    "kurumsal.kisiBilgileri.isyeriHekimiAdi",
    "kurumsal.kisiBilgileri.isYeriHekimiAdi",
    "kurumsal.kisiBilgileri.isYeriHekimiAd",
    "prosedurKisiBilgileri.isyeriHekimiAdi",
    "prosedurKisiBilgileri.isYeriHekimiAdi",
    "prosedurKisiBilgileri.isYeriHekimiAd",
    "imzalar.hekim.signerName",
  ]);

  const isyeriHekimiAdi =
    splitDisplayNameAndCert(rawIsyeriHekimiAdi).name || rawIsyeriHekimiAdi;

  const rawIsverenAdi = pickFirst(payload, [
    "imzalar.isverenAdi",
    "imzalar.isVerenAdi",
    "imzalar.isVerenAd",
    "imzalar.isverenAd",
    "kisiBilgileri.isverenAdi",
    "kisiBilgileri.isVerenAdi",
    "kisiBilgileri.isVerenAd",
    "kurumsal.kisiBilgileri.isverenAdi",
    "kurumsal.kisiBilgileri.isVerenAdi",
    "kurumsal.kisiBilgileri.isVerenAd",
    "prosedurKisiBilgileri.isverenAdi",
    "prosedurKisiBilgileri.isVerenAdi",
    "prosedurKisiBilgileri.isVerenAd",
    "imzalar.isveren.signerName",
  ]);

  const isverenAdi = splitDisplayNameAndCert(rawIsverenAdi).name || rawIsverenAdi;

  console.log("[YEP-PUP] IMZA DEBUG =>", {
    isgUzmaniAdi,
    isyeriHekimiAdi,
    isverenAdi,
    imzalar: payload?.imzalar,
    prosedurKisiBilgileri: payload?.prosedurKisiBilgileri,
  });

  const view = {
    firmaAdi: firma.firmaAdi || payload?.firmaAdi || "",
    tarih,

    logoUrl,
    logoVarMi,

    satirlarHtml,

    isgUzmaniAdi,
    isyeriHekimiAdi,
    isverenAdi,

    isgUzmaniAd: isgUzmaniAdi,

    isYeriHekimiAdi: isyeriHekimiAdi,
    isYeriHekimiAd: isyeriHekimiAdi,
    isyeriHekimiAd: isyeriHekimiAdi,

    isVerenAdi: isverenAdi,
    isVerenAd: isverenAdi,
    isverenAd: isverenAdi,
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
    scale: 0.98,
  });

  await page.close();

  await placeSignatures(pdfPath, payload);

  return pdfPath;
}

module.exports = { createYillikEgitimPlaniPdf };
