const fs = require("fs");
const path = require("path");
const axios = require("axios");
const Handlebars = require("handlebars");
const puppeteer = require("puppeteer");
const { PDFDocument, rgb } = require("pdf-lib");
const fontkit = require("@pdf-lib/fontkit");
const { embedBoldFont } = require("../utils/pdfFonts");

function templatePath() {
  return path.resolve(
    __dirname,
    "..",
    "..",
    "isg_prosedur_template",
    "templates",
    "yillikplanlar",
    "yillikdegerlendirme_raporu.html"
  );
}

async function urlToDataUri(input) {
  if (!input) return "";

  try {
    if (typeof input === "string" && input.startsWith("data:image/")) return input;

    if (
      typeof input === "string" &&
      (input.startsWith("http://") || input.startsWith("https://"))
    ) {
      const res = await axios.get(input, {
        responseType: "arraybuffer",
        timeout: 20000,
      });
      const contentType = res.headers["content-type"] || "image/png";
      const base64 = Buffer.from(res.data).toString("base64");
      return `data:${contentType};base64,${base64}`;
    }

    if (typeof input === "string" && input.length > 50) {
      const maybeBase64 = input.replace(/\s/g, "");
      if (/^[A-Za-z0-9+/=]+$/.test(maybeBase64)) {
        return `data:image/png;base64,${maybeBase64}`;
      }
    }

    return "";
  } catch (e) {
    console.error("Logo dönüştürülemedi:", e?.message || e);
    return "";
  }
}

const s = (v) => (v === null || v === undefined ? "" : String(v));

function getByPath(obj, dottedPath) {
  try {
    return dottedPath
      .split(".")
      .reduce((acc, key) => (acc ? acc[key] : undefined), obj);
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

function isDemoRequest(req, payload) {
  if (req?.user?.isDemo === true) return true;
  if (payload?.demo === true) return true;
  return String(process.env.DEMO_MODE || "").toLowerCase() === "true";
}

/**
 * Satırları sayfalara böler.
 * firstPageSize: ilk sayfadaki satır sayısı
 * otherPageSize: diğer sayfalardaki satır sayısı
 */
function chunkRows(rows = [], firstPageSize = 10, otherPageSize = 8) {
  const pages = [];
  let index = 0;
  let pageNo = 1;

  while (index < rows.length) {
    const size = pageNo === 1 ? firstPageSize : otherPageSize;

    pages.push({
      pageNo,
      satirlar: rows.slice(index, index + size),
    });

    index += size;
    pageNo += 1;
  }

  if (!pages.length) {
    pages.push({
      pageNo: 1,
      satirlar: [],
    });
  }

  return pages;
}

async function placeSignatures(pdfBuffer, payload) {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
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

  const roles = ["uzman", "hekim", "isveren"];

  const roleImages = {};
  for (const role of roles) {
    roleImages[role] = {
      imza: await embedImage(imzalar?.[role]?.imza?.dataUrl),
      paraf: await embedImage(imzalar?.[role]?.paraf?.dataUrl),
    };
  }

   const centers = {
    uzman: 160,
    hekim: 420,
    isveren: 690,
  };

  const uzmanStamp = buildUzmanStampData(payload);
  const hekimStamp = buildHekimStampData(payload);

  pages.forEach((page, index) => {
    for (const role of roles) {
      let img = null;
      let y = 30;

     if (index === 0) {
        img = roleImages[role]?.imza;
      } else {
        img = roleImages[role]?.paraf;
      }

      const centerX = centers[role];

      if (role === "uzman") {
        drawStampBlock(page, { boldFont }, centerX, 55, uzmanStamp);
      }

      if (role === "hekim") {
        drawStampBlock(page, { boldFont }, centerX, 55, hekimStamp);
      }

      
      if (!img) continue;

      const width = 150;
      const height = 62;
       const x = centerX - width / 2;

      page.drawImage(img, {
        x,
        y,
        width,
        height,
      });
    }
  });

  return await pdfDoc.save();
}

/**
 * POST /api/yillik-degerlendirme-raporu/pdf
 */
async function yillikDegerlendirmeRaporuPdf(req, res) {
  let browser;
  try {
    const payload = req.body || {};

    let logoCandidate =
      payload?.kurumsal?.logoUrl ||
      payload?.kurumsal?.logo ||
      payload?.logo ||
      payload?.firma?.logoUrl ||
      "";

    const logoDataUri = await urlToDataUri(logoCandidate);

    const allRows = (
      Array.isArray(payload?.rapor?.satirlar) ? payload.rapor.satirlar : []
    ).map((r, i) => ({
      no: r?.no ?? i + 1,
      yapilanCalisma: s(r?.yapilanCalisma),
      tarih: s(r?.tarih),
      yapanKisiUnvan: s(r?.yapanKisiUnvan),
      tekrarSayisi: s(r?.tekrarSayisi),
      kullanilanYontem: s(r?.kullanilanYontem),
      sonucYorum: s(r?.sonucYorum),
    }));

    const pages = chunkRows(allRows, 8, 8);

    const data = {
      logoDataUri,

      firmaAdi: s(payload?.firma?.firmaAdi),
      adres: s(payload?.firma?.adres),
      tehlikeSinifi: s(payload?.firma?.tehlikeSinifi),
      raporTarihi: s(payload?.rapor?.tarih),

      pages,

            imza_isgUzmani:
        splitDisplayNameAndCert(
          s(payload?.imzalar?.uzman?.signerName) ||
          s(payload?.prosedurKisiBilgileri?.isgUzmaniAdi) ||
          s(payload?.kisiler?.uzman)
        ).name,

      imza_isyeriHekimi:
        splitDisplayNameAndCert(
          s(payload?.imzalar?.hekim?.signerName) ||
          s(payload?.prosedurKisiBilgileri?.isyeriHekimiAdi) ||
          s(payload?.kisiler?.hekim)
        ).name,

      imza_isveren:
        splitDisplayNameAndCert(
          s(payload?.imzalar?.isveren?.signerName) ||
          s(payload?.prosedurKisiBilgileri?.isverenAdi) ||
          s(payload?.kisiler?.isveren)
        ).name,
    };

    const tPath = templatePath();
    if (!fs.existsSync(tPath)) {
      console.error("Template bulunamadı:", tPath);
      return res.status(404).send("HTML şablonu bulunamadı.");
    }

    const htmlRaw = fs.readFileSync(tPath, "utf-8");
    let html = Handlebars.compile(htmlRaw)(data);

    if (isDemoRequest(req, payload)) {
      html = injectDemoWatermark(html);
    }

    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    let pdfBuffer = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "18mm", right: "10mm", bottom: "12mm", left: "10mm" },
    });

    await page.close();

    pdfBuffer = await placeSignatures(pdfBuffer, payload);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'inline; filename="YillikDegerlendirmeRaporu.pdf"'
    );
    return res.end(pdfBuffer);
  } catch (err) {
    console.error("YillikDegerlendirmeRaporu PDF Hata:", err);
    return res.status(500).send("PDF oluşturulamadı.");
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { yillikDegerlendirmeRaporuPdf };
