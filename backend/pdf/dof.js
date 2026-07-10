// backend/pdf/dof.js
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");
const { PDFDocument, rgb } = require("pdf-lib");
const fontkit = require("@pdf-lib/fontkit");

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

function fillVars(tpl, data) {
  return tpl.replace(/{{\s*([\w.]+)\s*}}/g, (_, key) => {
    const val = key
      .split(".")
      .reduce((o, k) => (o && o[k] != null ? o[k] : ""), data);
    return val == null ? "" : String(val);
  });
}

function upperTr(text) {
  return (text || "").toLocaleUpperCase("tr-TR");
}

function safeRead(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
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

function isDemoMode(data = {}) {
  if (data?.demo === true) return true;
  if (data?.isDemo === true) return true;
  return String(process.env.DEMO_MODE || "").toLowerCase() === "true";
}

function fallbackBody() {
  return `
  <div style="position:relative; min-height:250mm;">
    {{logoHtml}}
    <h2 style="text-align:center; margin:0; padding-top:10px;">DÜZELTİCİ VE ÖNLEYİCİ FAALİYET TALEP FORMU</h2>
    <div style="margin-top:14px; font-size:12px;">
      <b>Firma:</b> {{firmaAdi}}<br/>
      <b>SGK:</b> {{sgkSicilNo}}<br/>
      <b>Tarih:</b> {{tarih}}<br/>
      <b>No:</b> {{kayitNo}}
    </div>
  </div>
  `;
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

  if (parts.length === 1) {
    return { name: parts[0], certNo: "" };
  }

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
  const kisiler = data?.kisiler || {};
  const personal = data?.kisisel || {};

  const parsed = splitDisplayNameAndCert(kisiler.uzman || "");

  const name = toUpperTR(parsed.name || kisiler.uzman || "").trim();

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

  drawCenteredText(page, boldFont, name, centerX, baseY + 10, 7.4, stampColor, stampOpacity);
  drawCenteredText(page, boldFont, title, centerX, baseY + 2, 5.8, stampColor, stampOpacity);
  drawCenteredText(page, boldFont, certNo, centerX, baseY - 6, 5.8, stampColor, stampOpacity);
}

async function placeSignatures(pdfPath, data) {
  const existingPdfBytes = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  pdfDoc.registerFontkit(fontkit);

  const fontPath = path.join(__dirname, "../fonts/NotoSans-Bold.ttf");
  if (!fs.existsSync(fontPath)) {
    throw new Error("Font bulunamadı: " + fontPath);
  }

  const fontBytes = fs.readFileSync(fontPath);
  const boldFont = await pdfDoc.embedFont(fontBytes);

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

  const pages = pdfDoc.getPages();
  const imzalar = data?.imzalar || {};

  const isverenImza =
    (await embedImage(imzalar?.isveren?.imza?.dataUrl)) ||
    (await embedImage(imzalar?.isveren?.dataUrl)) ||
    null;

  const uzmanImza =
    (await embedImage(imzalar?.uzman?.imza?.dataUrl)) ||
    (await embedImage(imzalar?.uzman?.dataUrl)) ||
    null;

  const uzmanStamp = buildUzmanStampData(data);

  for (const page of pages) {
    const { width } = page.getSize();

    const leftCenterX = width * 0.25 + 10;
const rightCenterX = width * 0.75 - 10;

    // İmza bloğu alt tarafta
    const imageWidth = 128;
    const imageHeight = 52;
    const imageY = 35;

    // Kaşe uzman imza kutusunun içine gelsin
    const stampBaseY = 54;

    if (isverenImza) {
      page.drawImage(isverenImza, {
        x: leftCenterX - imageWidth / 2,
        y: imageY,
        width: imageWidth,
        height: imageHeight,
      });
    }

    drawStampBlock(page, { boldFont }, rightCenterX, stampBaseY, uzmanStamp);

    if (uzmanImza) {
      page.drawImage(uzmanImza, {
        x: rightCenterX - imageWidth / 2,
        y: imageY,
        width: imageWidth,
        height: imageHeight,
      });
    }
  }

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(pdfPath, pdfBytes);
}

async function createDofPdf(pdfData) {
  const projectRoot = path.resolve(__dirname, "..", "..");
  const tplRoot = path.join(projectRoot, "isg_prosedur_template");

  const tplPath = path.join(tplRoot, "templates", "dof", "dof.html");
  const jsonPath = path.join(tplRoot, "data.json");

  const outDir = path.join(projectRoot, "output");
  const uniq = `${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
  const outPdf = path.join(outDir, `dof_${uniq}.pdf`);

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const tplRaw = safeRead(tplPath);
  const tpl = tplRaw ? readBodyOnly(tplPath) : fallbackBody();

  let fileData = {};
  if (fs.existsSync(jsonPath)) {
    try {
      const raw = fs.readFileSync(jsonPath, "utf8");
      fileData = raw.trim() ? JSON.parse(raw) : {};
    } catch {}
  }

  const data = {
    ...fileData,
    ...pdfData,
    kurumsal: { ...(fileData.kurumsal || {}), ...(pdfData?.kurumsal || {}) },
    firma: { ...(fileData.firma || {}), ...(pdfData?.firma || {}) },
    uzman: { ...(fileData.uzman || {}), ...(pdfData?.uzman || {}) },
    isveren: { ...(fileData.isveren || {}), ...(pdfData?.isveren || {}) },
    form: { ...(fileData.form || {}), ...(pdfData?.form || {}) },
    kisiler: { ...(fileData.kisiler || {}), ...(pdfData?.kisiler || {}) },
    imzalar: { ...(fileData.imzalar || {}), ...(pdfData?.imzalar || {}) },
    kisisel: { ...(fileData.kisisel || {}), ...(pdfData?.kisisel || {}) },
  };

  const kurumsal = data.kurumsal || {};
  const firma = data.firma || {};
  const uzman = data.uzman || {};
  const isveren = data.isveren || {};
  const form = data.form || {};

  data.logoHtml = kurumsal.logoUrl
    ? `<img src="${kurumsal.logoUrl}" style="max-height:15mm; max-width:80%; width:auto; height:auto; object-fit:contain; display:block;" />`
    : "";

  data.firmaAdi = firma.firmaAdi || "";
  data.sgkSicilNo = firma.sgkSicilNo || "";

  data.uzmanAdi = upperTr(form.isgUzmani || uzman.adSoyad || "");
  data.isverenAdi = upperTr(
    form.ilgiliBolumSorumlusu ||
    form.yonetimTemsilcisi ||
    isveren.adSoyad ||
    ""
  );

  data.tarih = upperTr(form.tarih || "");
  data.kayitNo = upperTr(form.kayitNo || "");

  data.tanim = upperTr(form.tanim || "");
  data.neden = upperTr(form.neden || "");
  data.faaliyet = upperTr(form.faaliyet || "");

  data.planBaslangic = upperTr(form.planBaslangic || form.tarih || "");
  data.planBitis = upperTr(form.planBitis || "");
  data.gercekBitis = upperTr(form.gercekBitis || form.planBitis || "");

  data.kisiler = {
    ...(data.kisiler || {}),
    isveren: data.isverenAdi || "",
    uzman: data?.kisiler?.uzman || data.uzmanAdi || "",
  };

  data.kisisel = {
    ...(data.kisisel || {}),
    sertifikaNo: data?.kisisel?.sertifikaNo || "",
    sertifikaSinifi: data?.kisisel?.sertifikaSinifi || "",
  };

  let html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"/></head><body>${fillVars(
    tpl,
    data
  )}</body></html>`;

  if (isDemoMode(data)) {
    html = injectDemoWatermark(html);
  }

  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-web-security",
      "--allow-file-access-from-files",
    ],
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "load" });

  await page.evaluate(async () => {
    const imgs = Array.from(document.images || []);
    await Promise.all(
      imgs.map((img) => {
        const p = img.decode
          ? img.decode().catch(() => {})
          : img.complete
            ? Promise.resolve()
            : new Promise((res) => {
                img.onload = img.onerror = () => res();
              });
        return p;
      })
    );
  });

  await page.pdf({
    path: outPdf,
    format: "A4",
    printBackground: true,
    margin: {
      top: "0mm",
      right: "0mm",
      bottom: "0mm",
      left: "0mm",
    },
  });

  await browser.close();

  await placeSignatures(outPdf, data);

  return outPdf;
}

module.exports = { createDofPdf };