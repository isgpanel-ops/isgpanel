// backend/pdf/calisanTemsilcisiEgitimKatilimFormu.js
const fs = require("fs");
const path = require("path");
const pdf = require("html-pdf-node");
const axios = require("axios");
const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");

// OUT: backend/temp_pdfs
const OUT_DIR = path.join(__dirname, "..", "temp_pdfs");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });



function safe(val) {
  return (val ?? "").toString();
}

function getOnlyDisplayName(value = "") {
  return String(value || "")
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean)[0] || "";
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

function buildUzmanStampData(payload = {}) {
  const k = payload?.kisiler || {};
  const personal = payload?.kisisel || {};
  const parsed = splitDisplayNameAndCert(k.uzman || k.uzmanAdSoyad || "");

  const name = toUpperTR(
    getOnlyDisplayName(parsed.name || k.uzmanAdSoyad || k.uzman || "")
  ).trim();

  const certNo = sanitizeCertPrefix(
  personal?.sertifikaNo ||
    personal?.iguSertifikaNo ||
    personal?.isgUzmaniSertifikaNo ||
    personal?.isgSertifikaNo ||
    personal?.sertifikaNumarasi ||
    personal?.certificateNo ||
    k?.uzmanSertifikaNo ||
    k?.isgUzmaniSertifikaNo ||
    k?.sertifikaNo ||
    parsed.certNo ||
    "",
  "İGU-"
);

  let title = "İŞ GÜVENLİĞİ UZMANI";
  const certClass = toUpperTR(personal?.sertifikaSinifi || "").trim();

  if (certClass) {
    title = `${certClass} SINIFI İŞ GÜVENLİĞİ UZMANI`;
  }

  return { name, certNo, title };
}

function buildHekimStampData(payload = {}) {
  const k = payload?.kisiler || {};
  const parsed = splitDisplayNameAndCert(k.hekim || k.hekimAdSoyad || "");

  const name = toUpperTR(
    getOnlyDisplayName(parsed.name || k.hekimAdSoyad || k.hekim || "")
  ).trim();

  const certNo = sanitizeCertPrefix(parsed.certNo || "", "İH-");
  const title = "İŞYERİ HEKİMİ";

  return { name, certNo, title };
}

function formatDateTR(value) {
  const v = safe(value);
  if (!v) return "__.__.____";

  if (/^\d{2}\.\d{2}\.\d{4}$/.test(v)) return v;

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
    const [dd, mm, yyyy] = v.split("/");
    return `${dd}.${mm}.${yyyy}`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split("-");
    return `${d}.${m}.${y}`;
  }

  return v;
}

function stripLeftoverMustache(html) {
  return String(html || "").replace(/{{\s*[^}]+\s*}}/g, "");
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

function isDemoRequest(payload = {}) {
  if (process.env.DEMO_MODE === "true") return true;
  if (payload?.isDemo === true) return true;
  if (payload?.demo === true) return true;
  return false;
}

const TRANSPARENT_1PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO6qK3cAAAAASUVORK5CYII=";

function normalizeLogoToDataUri(maybeBase64OrDataUri) {
  const s = safe(maybeBase64OrDataUri).trim();
  if (!s) return "";

  if (s.startsWith("data:image/")) return s;
  if (s.length < 200) return s;

  if (/^[A-Za-z0-9+/=\r\n]+$/.test(s)) {
    return `data:image/png;base64,${s.replace(/\s/g, "")}`;
  }

  return s;
}

async function fetchLogoAsDataUri(logoUrl, authToken) {
  const url = safe(logoUrl).trim();
  if (!url) return "";

  try {
    const res = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 15000,
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      validateStatus: () => true,
    });

    if (res.status < 200 || res.status >= 300) return "";

    const contentType =
      res.headers?.["content-type"] ||
      (url.toLowerCase().endsWith(".png")
        ? "image/png"
        : url.toLowerCase().endsWith(".jpg") || url.toLowerCase().endsWith(".jpeg")
        ? "image/jpeg"
        : url.toLowerCase().endsWith(".webp")
        ? "image/webp"
        : "image/png");

    const b64 = Buffer.from(res.data).toString("base64");
    return `data:${contentType};base64,${b64}`;
  } catch {
    return "";
  }
}

function pickLogoCandidates(payload) {
  const p = payload || {};
  const firma = p.firma || {};
  const kurumsal = p.kurumsal || {};
  const kk = p.kurumsalKimlik || p.kurumsal_kimlik || {};

  return [
    kurumsal.logoBase64,
    kurumsal.logoB64,
    kurumsal.logo,
    kk.logoBase64,
    kk.logoB64,
    kk.logo,
    firma.logoBase64,
    firma.logoB64,
    firma.logo,
    p.logoBase64,
    p.logoB64,
    p.logo,

    kurumsal.logoUrl,
    kk.logoUrl,
    firma.logoUrl,
    p.logoUrl,
  ]
    .map((x) => safe(x).trim())
    .filter(Boolean);
}

async function resolveLogoSrc(payload, authToken) {
  const candidates = pickLogoCandidates(payload);

  for (const c of candidates) {
    const normalized = normalizeLogoToDataUri(c);
    if (normalized && normalized.startsWith("data:image/")) return normalized;
  }

  for (const c of candidates) {
    const maybe = normalizeLogoToDataUri(c);
    if (!maybe) continue;

    if (/^https?:\/\//i.test(maybe)) {
      const dataUri = await fetchLogoAsDataUri(maybe, authToken);
      if (dataUri) return dataUri;
    }
  }

  return TRANSPARENT_1PX;
}

function findProjectRoot() {
  let dir = path.resolve(__dirname, "..");
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, "isg_prosedur_template"))) return dir;
    dir = path.dirname(dir);
  }
  return path.resolve(__dirname, "..", "..");
}

async function embedImageFromDataUrl(pdfDoc, dataUrl) {
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

async function placeKatilimSignatures(pdfPath, payload = {}) {
  const existingPdfBytes = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  const pages = pdfDoc.getPages();
  if (!pages.length) return pdfPath;

  const firstPage = pages[0];
   

const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

const uzmanStamp = buildUzmanStampData(payload);
const hekimStamp = buildHekimStampData(payload);

const imzalar = payload?.imzalar || {};

  console.log("KATILIM IMZA DURUMU", {
    temsilci: !!(
      imzalar?.temsilci?.imza?.dataUrl ||
      imzalar?.temsilci?.dataUrl ||
      imzalar?.calisanTemsilcisi?.imza?.dataUrl ||
      imzalar?.calisanTemsilcisi?.dataUrl ||
      imzalar?.temsilciImza
    ),
    uzman: !!(
      imzalar?.uzman?.imza?.dataUrl ||
      imzalar?.uzman?.dataUrl ||
      imzalar?.uzmanImza
    ),
    hekim: !!(
      imzalar?.hekim?.imza?.dataUrl ||
      imzalar?.hekim?.dataUrl ||
      imzalar?.hekimImza
    ),
    isveren: !!(
      imzalar?.isveren?.imza?.dataUrl ||
      imzalar?.isveren?.dataUrl ||
      imzalar?.isverenImza
    ),
  });

  const temsilciImage = await embedImageFromDataUrl(
    pdfDoc,
    imzalar?.temsilci?.imza?.dataUrl ||
      imzalar?.temsilci?.dataUrl ||
      imzalar?.calisanTemsilcisi?.imza?.dataUrl ||
      imzalar?.calisanTemsilcisi?.dataUrl ||
      imzalar?.temsilciImza ||
      ""
  );

  const uzmanImage = await embedImageFromDataUrl(
    pdfDoc,
    imzalar?.uzman?.imza?.dataUrl ||
      imzalar?.uzman?.dataUrl ||
      imzalar?.uzmanImza ||
      ""
  );

  const hekimImage = await embedImageFromDataUrl(
    pdfDoc,
    imzalar?.hekim?.imza?.dataUrl ||
      imzalar?.hekim?.dataUrl ||
      imzalar?.hekimImza ||
      ""
  );

  const isverenImage = await embedImageFromDataUrl(
    pdfDoc,
    imzalar?.isveren?.imza?.dataUrl ||
      imzalar?.isveren?.dataUrl ||
      imzalar?.isverenImza ||
      ""
  );

   function drawImageCentered(page, image, box, opts = {}) {
  if (!image) return;

  const padX = Number(opts.padX ?? 6);
  const padY = Number(opts.padY ?? 6);

  const rawWidth = image.width || 1;
  const rawHeight = image.height || 1;

  const maxWidth = Math.max(1, box.width - padX * 2);
  const maxHeight = Math.max(1, box.height - padY * 2);

  const scale = Math.min(maxWidth / rawWidth, maxHeight / rawHeight);

  const drawWidth = rawWidth * scale;
  const drawHeight = rawHeight * scale;

  const drawX = box.x + (box.width - drawWidth) / 2;
  const drawY = box.y + (box.height - drawHeight) / 2;

  page.drawImage(image, {
    x: drawX,
    y: drawY,
    width: drawWidth,
    height: drawHeight,
  });
}

function pdfSafeText(value = "") {
  return String(value || "")
    .replace(/İ/g, "I")
    .replace(/ı/g, "i")
    .replace(/Ğ/g, "G")
    .replace(/ğ/g, "g")
    .replace(/Ü/g, "U")
    .replace(/ü/g, "u")
    .replace(/Ş/g, "S")
    .replace(/ş/g, "s")
    .replace(/Ö/g, "O")
    .replace(/ö/g, "o")
    .replace(/Ç/g, "C")
    .replace(/ç/g, "c");
}

function drawStampBlock(page, stamp = {}, box = {}, fontBold, fontRegular) {
  const name = pdfSafeText(safe(stamp?.name)).trim();
const title = pdfSafeText(safe(stamp?.title)).trim();
const certNo = pdfSafeText(safe(stamp?.certNo)).trim();

  if (!name && !title && !certNo) return;

  const blue = rgb(29 / 255, 78 / 255, 216 / 255);

  const lines = [
    name ? { text: name, size: 8.5, font: fontBold } : null,
    title ? { text: title, size: 6.5, font: fontBold } : null,
    certNo ? { text: certNo, size: 6.5, font: fontRegular } : null,
  ].filter(Boolean);

  const lineGap = 7;
  const totalHeight = lines.length * lineGap;
  const startY = box.y + 30 + totalHeight / 2;

  lines.forEach((line, index) => {
    const textWidth = line.font.widthOfTextAtSize(line.text, line.size);
    const x = box.x + (box.width - textWidth) / 2;
    const y = startY - index * lineGap;

    page.drawText(line.text, {
      x,
      y,
      size: line.size,
      font: line.font,
      color: blue,
      opacity: 0.58,
    });
  });
}

  // Üst tablo - temsilci imza alanı
  // Not: Bu dosyada temsilci imzası şu an tek hücreye çiziliyor.
  // Gerekirse y değeri 2-5 puan oynatılabilir.
  if (temsilciImage) {
    drawImageCentered(
      firstPage,
      temsilciImage,
      {
        x: 438,
        y: 526,
        width: 126,
        height: 52,
      },
      { padX: 8, padY: 6 }
    );
  }

 // Alt blok - uzman
const uzmanBox = {
  x: 42,
  y: 432,
  width: 160,
  height: 70,
};

drawStampBlock(firstPage, uzmanStamp, uzmanBox, fontBold, fontRegular);

if (uzmanImage) {
  drawImageCentered(
    firstPage,
    uzmanImage,
    uzmanBox,
    { padX: 10, padY: 8 }
  );
}

// Alt blok - hekim
const hekimBox = {
  x: 217,
  y: 432,
  width: 160,
  height: 70,
};

drawStampBlock(firstPage, hekimStamp, hekimBox, fontBold, fontRegular);

if (hekimImage) {
  drawImageCentered(
    firstPage,
    hekimImage,
    hekimBox,
    { padX: 10, padY: 8 }
  );
}

  // Alt blok - işveren
  if (isverenImage) {
    drawImageCentered(
      firstPage,
      isverenImage,
      {
        x: 392,
        y: 432,
        width: 160,
        height: 70,
      },
      { padX: 10, padY: 8 }
    );
  }

  const outBytes = await pdfDoc.save();
  fs.writeFileSync(pdfPath, outBytes);

  return pdfPath;
}

/**
 * payload beklenen örnek:
 * {
 *   authToken: "...",
 *   firma: { firmaAdi: "...", logoUrl/logoBase64... },
 *   kurumsal: { logoBase64 | logoUrl | ... },
 *   kurumsalKimlik: { logoBase64 | logoUrl | ... },
 *   egitim: { saat: 4, tarihTR: "01.01.2026" | tarihISO: "2026-01-01" },
 *   katilimcilar: [{ tc, adSoyad, gorev }, ...],
 *   kisiler: { uzmanAdSoyad, hekimAdSoyad, isverenAdSoyad, temsilciAdSoyad },
 *   imzalar: { temsilci, uzman, hekim, isveren },
 *   demo: true | false,
 *   isDemo: true | false
 * }
 */
async function createCalisanTemsilcisiEgitimKatilimFormuPdf(payload) {
  const ROOT = findProjectRoot();

  const templatePath = path.join(
    ROOT,
    "isg_prosedur_template",
    "templates",
    "egitim",
    "egitimKatilimFormu_calisan_temsilcisi.html"
  );

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template bulunamadı: ${templatePath}`);
  }

  let html = fs.readFileSync(templatePath, "utf8");

  const authToken = safe(payload?.authToken);
  const logoSrc = await resolveLogoSrc(payload, authToken);

  const firmaAdi = safe(payload?.firma?.firmaAdi);

  const egitim = payload?.egitim || {};
  const egitimSaat = safe(egitim?.saat || 4);
  const egitimTarih = formatDateTR(egitim?.tarihTR || egitim?.tarihISO || egitim?.tarih);

  const kisiler = payload?.kisiler || {};
  const uzmanAdSoyad = safe(kisiler?.uzmanAdSoyad || kisiler?.uzman);
  const hekimAdSoyad = safe(kisiler?.hekimAdSoyad || kisiler?.hekim);
  const isverenAdSoyad = safe(kisiler?.isverenAdSoyad || kisiler?.isveren);
  const temsilciAdSoyad = safe(
    kisiler?.temsilciAdSoyad ||
      kisiler?.temsilci ||
      (Array.isArray(payload?.katilimcilar) && payload.katilimcilar[0]?.adSoyad) ||
      ""
  );

  const map = {
    "{{LOGO_SRC}}": logoSrc,
    "{{firmaAdi}}": firmaAdi,
    "{{EGITIM_SAAT}}": egitimSaat,
    "{{EGITIM_TARIH}}": egitimTarih,
    "{{TEMSILCI_ADSOYAD}}": temsilciAdSoyad || "",
    "{{UZMAN_ADSOYAD}}": uzmanAdSoyad || "",
    "{{HEKIM_ADSOYAD}}": hekimAdSoyad || "",
    "{{ISVEREN_ADSOYAD}}": isverenAdSoyad || "",
  };

  const rows = Array.isArray(payload?.katilimcilar) ? payload.katilimcilar : [];

  const tableRowsHtml = rows
    .map((r, idx) => {
      const no = safe(r.no || idx + 1);
      const tc = safe(r.tc);
      const ad = safe(r.adSoyad);
      const gorev = safe(r.gorev);

      return `
<tr class="rowH">
  <td class="center">${no}</td>
  <td class="centerCell">${tc}</td>
  <td class="centerCell">${ad}</td>
  <td class="centerCell">${gorev}</td>
  <td>&nbsp;</td>
</tr>
`;
    })
    .join("");

  Object.keys(map).forEach((k) => {
    html = html.split(k).join(map[k]);
  });

  html = html.split("{{KATILIMCI_ROWS}}").join(tableRowsHtml);
  html = stripLeftoverMustache(html);

  if (isDemoRequest(payload)) {
    html = injectDemoWatermark(html);
  }

  const options = {
    format: "A4",
    printBackground: true,
    margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
  };

  const pdfBuffer = await pdf.generatePdf({ content: html }, options);

  const fileName = `calisan_temsilcisi_egitim_katilim_${Date.now()}.pdf`;
  const outPath = path.join(OUT_DIR, fileName);
  fs.writeFileSync(outPath, pdfBuffer);

  await placeKatilimSignatures(outPath, payload);

  return outPath;
}

module.exports = { createCalisanTemsilcisiEgitimKatilimFormuPdf };