// backend/pdf/riskEkip.js
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");
const { PDFDocument } = require("pdf-lib");

/* <body> içeriğini alır (prosedur.js ile aynı mantık) */
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

/* {{a.b.c}} doldurucu */
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
    console.warn("[RISK EKIP LOGO] Dosya bulunamadı:", absPath);
    return "";
  }

  const ext = path.extname(absPath).toLowerCase();
  const mime =
    ext === ".png"
      ? "image/png"
      : ext === ".jpg"
      ? "image/jpeg"
      : ext === ".jpeg"
      ? "image/jpeg"
      : ext === ".svg"
      ? "image/svg+xml"
      : "application/octet-stream";

  const buf = fs.readFileSync(absPath);
  return `data:${mime};base64,${buf.toString("base64")}`;
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

function isDemoMode(pdfData) {
  if (pdfData?.demo === true) return true;
  return String(process.env.DEMO_MODE || "").toLowerCase() === "true";
}

async function launchBrowserSafe() {
  const args = [
    "--no-sandbox",
    "--disable-web-security",
    "--allow-file-access-from-files",
  ];

  try {
    return await puppeteer.launch({ headless: "new", args });
  } catch (_) {
    return await puppeteer.launch({ headless: true, args });
  }
}

/* PDF oluştuktan sonra imzaları kutulara bas */
async function placeSignatures(pdfPath, data) {
  const existingPdfBytes = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  const pages = pdfDoc.getPages();
  const imzalar = data?.imzalar || {};

  if (!pages.length) return;

  async function embedImage(dataUrl) {
    if (!dataUrl || typeof dataUrl !== "string") return null;

    const parts = dataUrl.split(",");
    if (parts.length < 2) return null;

    const meta = parts[0] || "";
    const base64 = parts[1] || "";
    if (!base64) return null;

    const bytes = Buffer.from(base64, "base64");

    try {
      if (meta.includes("image/jpeg") || meta.includes("image/jpg")) {
        return await pdfDoc.embedJpg(bytes);
      }
      return await pdfDoc.embedPng(bytes);
    } catch {
      try {
        return await pdfDoc.embedPng(bytes);
      } catch {
        try {
          return await pdfDoc.embedJpg(bytes);
        } catch {
          return null;
        }
      }
    }
  }

  const roles = ["isveren", "uzman", "hekim", "temsilci", "destek", "bilgi"];
  const images = {};

  for (const role of roles) {
    images[role] = {
      imza: await embedImage(imzalar?.[role]?.imza?.dataUrl),
      paraf: await embedImage(imzalar?.[role]?.paraf?.dataUrl),
    };
  }

  const page = pages[0];

  /*
    A4 portrait yaklaşık 595 x 842 pt.
    Koordinat sistemi alttan yukarı.
    Bu değerler senin ekran görüntündeki tabloya göre kutular için ayarlı başlangıç değerleridir.
  */
 const rowBoxes = {
  isveren:   { x: 413, y: 565, width: 135, height: 54 },
  uzman:     { x: 413, y: 518, width: 135, height: 54 },
  hekim:     { x: 413, y: 475, width: 135, height: 54 },
  temsilci:  { x: 413, y: 430, width: 135, height: 54 },
  destek:    { x: 413, y: 383, width: 135, height: 54 },
  bilgi:     { x: 413, y: 337, width: 135, height: 54 },
};

  // Sağdaki İMZA sütunundaki kutulara bas
  for (const role of roles) {
    const image = images?.[role]?.imza;
    const box = rowBoxes[role];
    if (!image || !box) continue;

    page.drawImage(image, {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
    });
  }

  // İşveren imzasını ayrıca alttaki imza alanına bas
  const isverenAltImza = images?.isveren?.imza;
  if (isverenAltImza) {
    page.drawImage(isverenAltImza, {
      x: 355,
      y: 102,
      width: 170,
      height: 72,
    });
  }

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(pdfPath, pdfBytes);
}

/**
 * createRiskEkipPdf(pdfData?)
 * - pdfData frontend'den server.js üzerinden gelebilir (req.body)
 * - gelmezse isg_prosedur_template/data.json içindeki veriyi kullanır
 * - her zaman oluşturduğu PDF dosyasının tam yolunu döndürür (string)
 *
 * Şablon: isg_prosedur_template/templates/riskekip/risk_ekip.html
 */
async function createRiskEkipPdf(pdfData) {
  // proje kökü: .../isgpanel
  const projectRoot = path.join(__dirname, "..", "..");

  // şablon kökü: .../isgpanel/isg_prosedur_template
  const tplRoot = path.join(projectRoot, "isg_prosedur_template");

  const t = (f) => path.join(tplRoot, "templates", "riskekip", f);
  const cssPath = path.join(tplRoot, "styles", "prosedur.css");
  const jsonPath = path.join(tplRoot, "data.json");
  const outDir = path.join(projectRoot, "output");

  const uniq = `${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
  const outPdf = path.join(outDir, `risk_ekip_${uniq}.pdf`);

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  // ŞABLON
  let body = readBodyOnly(t("risk_ekip.html"));

  // VERİ: data.json (varsayılan) + pdfData (frontend)
  let fileData = {};
  if (fs.existsSync(jsonPath)) {
    try {
      const raw = fs.readFileSync(jsonPath, "utf8");
      fileData = raw.trim() ? JSON.parse(raw) : {};
    } catch (e) {
      console.error("data.json okunamadı:", e);
    }
  }

  let data = {};
  if (fileData && typeof fileData === "object") {
    data = JSON.parse(JSON.stringify(fileData));
  }

  if (pdfData && typeof pdfData === "object") {
    data = {
      ...data,
      ...pdfData,
      firma: { ...(data.firma || {}), ...(pdfData.firma || {}) },
      tarihler: { ...(data.tarihler || {}), ...(pdfData.tarihler || {}) },
      kisiler: { ...(data.kisiler || {}), ...(pdfData.kisiler || {}) },
      kurumsal: { ...(data.kurumsal || {}), ...(pdfData.kurumsal || {}) },
      riskEkip: { ...(data.riskEkip || {}), ...(pdfData.riskEkip || {}) },
      panel: { ...(data.panel || {}), ...(pdfData.panel || {}) },
      imzalar: { ...(data.imzalar || {}), ...(pdfData.imzalar || {}) },
    };
  }

  if (!data.kurumsal) data.kurumsal = {};
  if (!data.panel) data.panel = {};
  if (!data.imzalar) data.imzalar = {};

  // LOGO: kurumsal -> firma -> panel sırasıyla dene
  const publicDir = path.join(projectRoot, "public");

  const uploadsDir = path.join(projectRoot, "uploads");  

  const kurumsal = data.kurumsal || {};
  const firma = data.firma || {};
  const panel = data.panel || {};

  let rawLogo = "";


if (kurumsal.logoDataUrl) {
  rawLogo = kurumsal.logoDataUrl;
} else if (kurumsal.firmaLogo) {
  rawLogo = kurumsal.firmaLogo;
} else if (kurumsal.kurumsalLogoUrl) {
  rawLogo = kurumsal.kurumsalLogoUrl;
}

  // 1) Kurumsal öncelikli
  else if (kurumsal.logoUrl) {
    rawLogo = kurumsal.logoUrl;
  } else if (kurumsal.logoBase64) {
    rawLogo = String(kurumsal.logoBase64);
  } else if (
    typeof kurumsal.logo === "string" &&
    kurumsal.logo.startsWith("data:image")
  ) {
    rawLogo = kurumsal.logo;
  } else if (kurumsal.logoSrc) {
    rawLogo = kurumsal.logoSrc;
  } else if (kurumsal.logoPath) {
    rawLogo = kurumsal.logoPath;
  } else if (typeof kurumsal.logo === "string") {
    rawLogo = kurumsal.logo;
  }
  // 2) Firma fallback
  else if (firma.logoUrl) {
    rawLogo = firma.logoUrl;
  } else if (firma.logoBase64) {
    rawLogo = String(firma.logoBase64);
  } else if (
    typeof firma.logo === "string" &&
    firma.logo.startsWith("data:image")
  ) {
    rawLogo = firma.logo;
  } else if (firma.logoSrc) {
    rawLogo = firma.logoSrc;
  } else if (firma.logoPath) {
    rawLogo = firma.logoPath;
  } else if (typeof firma.logo === "string") {
    rawLogo = firma.logo;
  }
  // 3) Panel fallback
  else if (panel.logoUrl) {
    rawLogo = panel.logoUrl;
  }

  let logoDataUri = rawLogo;

  if (logoDataUri && typeof logoDataUri === "string") {
    if (/^data:image\//i.test(logoDataUri)) {
      // zaten base64
    } else if (/^https?:\/\//i.test(logoDataUri)) {
      // dış URL ise olduğu gibi bırak
    } else {
      let cleanLogoPath = String(logoDataUri || "")
  .replace("https://api.isgpanel.tr/api/uploads/", "/uploads/")
  .replace("https://api.isgpanel.tr/uploads/", "/uploads/")
  .replace("/api/uploads/", "/uploads/");

let abs = "";

if (path.isAbsolute(cleanLogoPath)) {
  abs = cleanLogoPath;
} else if (cleanLogoPath.startsWith("/uploads/")) {
  abs = path.join(uploadsDir, cleanLogoPath.replace(/^\/uploads\//, ""));
} else {
  abs = path.join(publicDir, cleanLogoPath.replace(/^\//, ""));
}

logoDataUri = fileToDataUri(abs);
    }
  }

  data.panel = data.panel || {};
  data.panel.logoUrl = logoDataUri || " ";

  console.log(
    "[RISK EKIP PDF] imzalar:",
    JSON.stringify(data.imzalar || {}, null, 2)
  );

  // ŞABLONU DOLDUR
  body = fillVars(body, data);

  const css = fs.readFileSync(cssPath, "utf8");
  let html = `<!doctype html><html lang="tr"><head><meta charset="utf-8">
  <style>${css}
    img{ -webkit-print-color-adjust:exact; print-color-adjust:exact; image-rendering:auto; }
  </style></head><body>
  ${body}
  </body></html>`;

  if (isDemoMode(pdfData)) {
    html = injectDemoWatermark(html);
  }

  const browser = await launchBrowserSafe();
  const page = await browser.newPage();

  await page.setContent(html, { waitUntil: "load" });

  // Tüm görseller yüklensin
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

  // PDF OLUŞTURMA
  await page.pdf({
    path: outPdf,
    format: "A4",
    printBackground: true,
    displayHeaderFooter: false,
    margin: { top: "10mm", right: "12mm", bottom: "20mm", left: "12mm" },
  });

  await page.close();
  await browser.close();

  // PDF oluşturulduktan sonra imzaları yerleştir
  await placeSignatures(outPdf, data);

  return outPdf;
}

/* Komut satırından test: node backend/pdf/riskEkip.js */
if (require.main === module) {
  createRiskEkipPdf()
    .then((p) => console.log("OK ->", p))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

module.exports = createRiskEkipPdf;
module.exports.createPdf = createRiskEkipPdf;
module.exports.createRiskEkipPdf = createRiskEkipPdf;