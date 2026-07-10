// backend/pdf/riskdegerlendirmesi.playwright.js
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { PDFDocument, rgb } = require("pdf-lib");
const fontkit = require("@pdf-lib/fontkit");

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

function normalizeImza6(imzaKisileri = []) {
  const base = (Array.isArray(imzaKisileri) ? imzaKisileri : []).slice(0, 6);

  while (base.length < 6) {
    base.push({ unvan: "", adSoyad: "", sertifikaNo: "" });
  }

  return base.map((x, i) => {
    const rawName = String(x?.adSoyad || "").trim();
    const parsed = splitDisplayNameAndCert(rawName);

    let sertifikaNo = x?.sertifikaNo || parsed.certNo || "";

    if (i === 1) {
      sertifikaNo = sanitizeCertPrefix(sertifikaNo, "İGU-");
    } else if (i === 2) {
      sertifikaNo = sanitizeCertPrefix(sertifikaNo, "İH-");
    } else {
      sertifikaNo = toUpperTR(sertifikaNo || "").trim();
    }

    return {
      unvan: x?.unvan || "",
      adSoyad: toUpperTR(parsed.name || rawName.split("/")[0] || "").trim(),
      sertifikaNo,
    };
  });
}

function getImzaKisiMap(payload = {}) {
  const arr = normalizeImza6(payload?.imzaKisileri || []);
  const roles = ["isveren", "uzman", "hekim", "temsilci", "destek", "bilgi"];

  const map = {};
  roles.forEach((role, i) => {
    map[role] = arr[i] || {};
  });

  return map;
}

function buildUzmanStampData(payload = {}) {
  const kisiMap = getImzaKisiMap(payload);
  const kisi = kisiMap?.uzman || {};
  const kisisel = payload?.kisisel || {};

  const rawUzman =
    String(kisisel?.uzman || "").trim() ||
    String(kisi?.adSoyad || "").trim();

  const parsed = splitDisplayNameAndCert(rawUzman);

  const name = toUpperTR(parsed.name || rawUzman || "").trim();

 const certNo = sanitizeCertPrefix(
  kisisel?.sertifikaNo ||
    kisisel?.uzmanSertifikaNo ||
    kisisel?.isgUzmaniSertifikaNo ||
    kisisel?.sertifikaNumarasi ||
    kisisel?.certificateNo ||
    parsed.certNo ||
    kisi?.sertifikaNo ||
    "",
  "İGU-"
);

  let title = "İŞ GÜVENLİĞİ UZMANI";

  const certClass = toUpperTR(
  kisisel?.sertifikaSinifi ||
    kisisel?.uzmanlikSinifi ||
    kisisel?.sertifikaSinif ||
    kisisel?.certificateClass ||
    ""
).trim();

  if (certClass) {
    title = `${certClass} SINIFI İŞ GÜVENLİĞİ UZMANI`;
  }

  return { name, certNo, title };
}

function buildHekimStampData(payload = {}) {
  const kisiMap = getImzaKisiMap(payload);
  const kisi = kisiMap?.hekim || {};

  const rawHekim = String(kisi?.adSoyad || "").trim();
  const parsed = splitDisplayNameAndCert(rawHekim);

  const name = toUpperTR(parsed.name || rawHekim || "").trim();
  const certNo = sanitizeCertPrefix(
    parsed.certNo || kisi?.sertifikaNo || "",
    "İH-"
  );
  const title = "İŞYERİ HEKİMİ";

  return { name, certNo, title };
}

function buildGenericStampData(payload = {}, role = "") {
  const kisiMap = getImzaKisiMap(payload);
  const kisi = kisiMap[role] || {};
  const rawName = String(kisi?.adSoyad || "").trim();
  const rawTitle = String(kisi?.unvan || "").trim();

  return {
    name: toUpperTR(
      splitDisplayNameAndCert(rawName).name || rawName.split("/")[0] || ""
    ).trim(),
    certNo: toUpperTR(kisi?.sertifikaNo || "").trim(),
    title: toUpperTR(rawTitle),
  };
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

function drawStampBlock(page, font, centerX, baseY, stampData) {
  const { name, certNo, title } = stampData || {};
  if (!name && !certNo && !title) return;

  const stampColor = rgb(29 / 255, 78 / 255, 216 / 255);
  const stampOpacity = 0.42;

 drawCenteredText(page, font, name, centerX, baseY + 30, 7.8, stampColor, stampOpacity);
drawCenteredText(page, font, title, centerX, baseY + 22, 6.0, stampColor, stampOpacity);

if (certNo) {
  drawCenteredText(page, font, certNo, centerX, baseY + 14, 6.0, stampColor, stampOpacity);
}
}

async function placeSignatures(pdfPath, payload = {}) {
  const existingPdfBytes = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  pdfDoc.registerFontkit(fontkit);

  const pages = pdfDoc.getPages();
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

  const roles = ["isveren", "uzman", "hekim", "temsilci", "destek", "bilgi"];

  const roleImages = {};
  for (const role of roles) {
    roleImages[role] = {
      imza: await embedImage(imzalar?.[role]?.imza?.dataUrl),
      paraf: await embedImage(imzalar?.[role]?.paraf?.dataUrl),
    };
  }

  const centers = {
    isveren: 95,
    uzman: 185,
    hekim: 275,
    temsilci: 370,
    destek: 465,
    bilgi: 560,
  };

  const fontBytes = fs.readFileSync(
    path.join(process.cwd(), "isg_prosedur_template", "fonts", "NotoSans-Bold.ttf")
  );
  const boldFont = await pdfDoc.embedFont(fontBytes);

    pages.forEach((page, index) => {
    for (const role of roles) {
      let img = null;
      let y = 36;

      if (index === 0) {
        img = roleImages[role]?.imza;
      } else {
        img = roleImages[role]?.paraf;
        y = 40;
      }

      const centerX = centers[role];

      let stampData = null;
      if (role === "uzman") {
        stampData = buildUzmanStampData(payload);
      } else if (role === "hekim") {
        stampData = buildHekimStampData(payload);
      } else {
        stampData = buildGenericStampData(payload, role);
      }

      drawStampBlock(page, boldFont, centerX, 63, stampData);

      if (!img) continue;

      const width = 170;
      const height = 72;
      const x = centerX - width / 2;

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

/**
 * HTML dosyasını A4 yatay PDF'e çevirir
 * - CSS @page kullanılsın diye preferCSSPageSize: true
 * - Margin: üst/alt 10mm, sağ/sol 5mm (1cm / 0.5cm)
 */
async function htmlFileToPdf(htmlFilePath, outPdfPath, payload = {}) {
  const html = fs.readFileSync(htmlFilePath, "utf8");

  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.emulateMedia({ media: "print" });
  await page.setContent(html, { waitUntil: "networkidle" });

  await page.pdf({
    path: outPdfPath,
    format: "A4",
    landscape: true,
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: "10mm", right: "5mm", bottom: "10mm", left: "5mm" },
  });

  await browser.close();

  await placeSignatures(outPdfPath, payload);

 return outPdfPath;
}

module.exports = { htmlFileToPdf };