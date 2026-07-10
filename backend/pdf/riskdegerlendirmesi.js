// backend/pdf/riskdegerlendirmesi.js
const fs = require("fs");
const path = require("path");
const Handlebars = require("handlebars");
const { chromium } = require("playwright");
const { PDFDocument, rgb } = require("pdf-lib");
const fontkit = require("@pdf-lib/fontkit");

/**
 * Payload beklenen alanlar (frontend -> backend):
 * {
 *  firmaAdi, sgkSicilNo, tehlikeSinifi, hazirlamaTarihi, gecerlilikTarihi, revizyonNo,
 *  kurumsalLogo,
 *  startPageNo: 1,
 *  pageSize: 12,
 *  rows: [
 *    { bolum, faaliyet, tehlike, risk, sonuc, etkiAlani:[], olasilik, siddet, rds, riskTanimi, onlem,
 *      mevcutDurum:[], mevcutDurumNot, sorumlu:[], termin,
 *      sonO, sonS, sonRds }
 *  ],
 *  imzaKisileri: [ { unvan, adSoyad } ] // 0..6
 * }
 */

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < (arr?.length || 0); i += size) out.push(arr.slice(i, i + size));
  return out;
}

function toTextArray(x) {
  if (!x) return "";
  if (Array.isArray(x)) return x.filter(Boolean).join(", ");
  return String(x);
}

function rdsClassFromTanimi(riskTanimi = "") {
  const t = (riskTanimi || "").toLowerCase();
  if (t.includes("çok") || t.includes("cok")) return "rds-cok-yuksek";
  if (t.includes("yüksek") || t.includes("yuksek")) return "rds-yuksek";
  if (t.includes("orta")) return "rds-orta";
  if (t.includes("toler")) return "rds-toler";
  return "";
}

function rdsClassFromValue(rds) {
  const v = Number(rds);
  if (!Number.isFinite(v)) return "";
  if (v >= 16) return "rds-cok-yuksek";
  if (v >= 9) return "rds-yuksek";
  if (v >= 4) return "rds-orta";
  return "rds-toler";
}

function normalizeImza6(imzaKisileri = []) {
  const base = (Array.isArray(imzaKisileri) ? imzaKisileri : []).slice(0, 6);

  while (base.length < 6) {
    base.push({ unvan: "", adSoyad: "", sertifikaNo: "" });
  }

  return base.map((x, i) => {
    const rawName = (x?.adSoyad || "").toString().trim();
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
  const kisiMap = getImzaKisiMap(payload);
  const kisi = kisiMap?.uzman || {};
  const kisisel = payload?.kisisel || {};
  const prosedurKisiBilgileri = payload?.prosedurKisiBilgileri || {};
  const imzalar = payload?.imzalar || {};

  const rawUzman =
    String(kisisel?.uzman || "").trim() ||
    String(prosedurKisiBilgileri?.isgUzmaniAdi || "").trim() ||
    String(imzalar?.uzman?.signerName || "").trim() ||
    String(kisi?.adSoyad || "").trim();

  const parsed = splitDisplayNameAndCert(rawUzman);
  const name = toUpperTR(parsed.name || rawUzman || "").trim();

 const certNo = sanitizeCertPrefix(
  kisisel?.sertifikaNo ||
    kisisel?.uzmanSertifikaNo ||
    kisisel?.isgUzmaniSertifikaNo ||
    kisisel?.sertifikaNumarasi ||
    kisisel?.certificateNo ||
    prosedurKisiBilgileri?.uzmanSertifikaNo ||
    prosedurKisiBilgileri?.isgUzmaniSertifikaNo ||
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
    prosedurKisiBilgileri?.sertifikaSinifi ||
    prosedurKisiBilgileri?.uzmanlikSinifi ||
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
  const prosedurKisiBilgileri = payload?.prosedurKisiBilgileri || {};
  const imzalar = payload?.imzalar || {};

  const rawHekim =
    String(prosedurKisiBilgileri?.isyeriHekimiAdi || "").trim() ||
    String(imzalar?.hekim?.signerName || "").trim() ||
    String(kisi?.adSoyad || "").trim();

  const parsed = splitDisplayNameAndCert(rawHekim);

  const name = toUpperTR(parsed.name || rawHekim || "").trim();
  const certNo = sanitizeCertPrefix(
    parsed.certNo || kisi?.sertifikaNo || prosedurKisiBilgileri?.hekimSertifikaNo || "",
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
    name: toUpperTR(splitDisplayNameAndCert(rawName).name || rawName.split("/")[0] || "").trim(),
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

function normalizeRows(rows = []) {
  return (rows || []).map((r, idx) => {
    const etkiAlaniText = toTextArray(r.etkiAlani);
    const mevcutDurumText = [toTextArray(r.mevcutDurum), r.mevcutDurumNot].filter(Boolean).join(" - ");
    const sorumluText = toTextArray(r.sorumlu);

    const rds = r.rds ?? (Number(r.olasilik) * Number(r.siddet));
    const sonRds = r.sonRds ?? (Number(r.sonO) * Number(r.sonS));

    return {
      no: r.no ?? idx + 1,
      bolum: r.bolum ?? "",
      faaliyet: r.faaliyet ?? "",
      tehlike: r.tehlike ?? "",
      risk: r.risk ?? "",
      sonuc: r.sonuc ?? "",
      etkiAlaniText,

      olasilik: r.olasilik ?? "",
      siddet: r.siddet ?? "",
      rds,
      riskTanimi: r.riskTanimi ?? "",

      onlem: r.onlem ?? "",
      mevcutDurumText,
      sorumluText,
      termin: r.termin ?? "",

      sonO: r.sonO ?? "",
      sonS: r.sonS ?? "",
      sonRds,

      rdsClass: r.rdsClass || rdsClassFromTanimi(r.riskTanimi) || rdsClassFromValue(rds),
      sonRdsClass: r.sonRdsClass || rdsClassFromValue(sonRds),
    };
  });
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
        bottom: 5mm;
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
  if (req?.user?.isDemo === true) return true;          // loginli demo kullanıcı
  if (payload?.demo === true) return true;              // istek bazlı override
  return String(process.env.DEMO_MODE || "").toLowerCase() === "true"; // env
}

function buildHtmlFromPayload(payload) {
  const templatePath = path.join(
    process.cwd(),
    "isg_prosedur_template",
    "templates",
    "riskdegerlendirmesi",
    "riskdegerlendirmesi.html"
  );

  const htmlRaw = fs.readFileSync(templatePath, "utf8");
  const compile = Handlebars.compile(htmlRaw);

  const pageSize = Number(payload.pageSize || 12);
  const startPageNo = Number(payload.startPageNo || 1);

  const allRows = normalizeRows(payload.rows || []);
  const pagesRows = chunk(allRows, pageSize);

  const pages = pagesRows.map((rows, i) => ({
    rows,
    pageNo: startPageNo + i,
  }));

  const viewModel = {
  ...payload,
  firmaAdresi:
    payload?.firmaAdresi ||
    payload?.selectedFirm?.adres ||
    payload?.adres ||
    "-",

  pages,

  imzaKisileri6: normalizeImza6(payload.imzaKisileri || []),
};

  return compile(viewModel);
}

async function placeSignatures(pdfBuffer, payload = {}) {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
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

  const fontPath = path.join(
    process.cwd(),
    "isg_prosedur_template",
    "fonts",
    "NotoSans-Bold.ttf"
  );
  const fontBytes = fs.readFileSync(fontPath);
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

  return await pdfDoc.save();
}

/** ✅ HTML üret + output klasörüne kaydet */
async function riskDegerlendirmesiHtml(req, res) {
  try {
    const payload = req.body || {};
    let html = buildHtmlFromPayload(payload);

if (isDemoRequest(req, payload)) {
  html = injectDemoWatermark(html);
}


    const outDir = path.join(process.cwd(), "backend", "pdf", "output");
    ensureDir(outDir);

    const safeFirma = (payload.firmaAdi || "firma").toString().replace(/[^\w\d-_]+/g, "_").slice(0, 40);
    const outName = `riskdegerlendirmesi_${safeFirma}_${Date.now()}.html`;
    const outPath = path.join(outDir, outName);

    fs.writeFileSync(outPath, html, "utf8");

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("X-Generated-Path", outPath);
    return res.status(200).send(html);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "HTML üretim hatası", detail: String(err?.message || err) });
  }
}

/** ✅ Aynı HTML'den PDF bas (Playwright) */
async function riskDegerlendirmesiPdf(req, res) {
  try {
    const payload = req.body || {};
    let html = buildHtmlFromPayload(payload);

if (isDemoRequest(req, payload)) {
  html = injectDemoWatermark(html);
}


    const browser = await chromium.launch();
    const page = await browser.newPage();

    // ✅ PRINT media + tek setContent (karışıklık yok)
    await page.emulateMedia({ media: "print" });
    await page.setContent(html, { waitUntil: "networkidle" });

        let pdfBuffer = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      preferCSSPageSize: true,

      // ✅ İstenen boşluklar
      margin: { top: "10mm", right: "5mm", bottom: "10mm", left: "5mm" },
    });

    await browser.close();

    // ✅ 6 kişilik prosedür imza/paraf bas
    pdfBuffer = await placeSignatures(pdfBuffer, payload);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="risk-degerlendirmesi.pdf"`);
    return res.send(pdfBuffer);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "PDF üretim hatası", detail: String(err?.message || err) });
  }
}

module.exports = riskDegerlendirmesiPdf;
module.exports.riskDegerlendirmesiHtml = riskDegerlendirmesiHtml;
module.exports.riskDegerlendirmesiPdf = riskDegerlendirmesiPdf;
