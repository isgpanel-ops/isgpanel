const fs = require("fs");
const path = require("path");
const pdf = require("html-pdf-node");
const axios = require("axios");
const { PDFDocument, rgb } = require("pdf-lib");
const fontkit = require("@pdf-lib/fontkit");

const BelgeNo = require("../models/BelgeNo");
const safe = (v) => (v ?? "").toString();

const OUT_DIR = path.join(__dirname, "..", "temp_pdfs");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const TRANSPARENT_1PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO6qK3cAAAAASUVORK5CYII=";

function normalizeImage(val) {
  const s = safe(val).trim();
  if (!s) return "";

  if (s.startsWith("data:image/")) return s;
  if (/^https?:\/\//i.test(s)) return s;

  if (/^[A-Za-z0-9+/=\r\n]+$/.test(s) && s.length > 100) {
    return `data:image/png;base64,${s.replace(/\s/g, "")}`;
  }

  return s;
}

function escapeHtml(value) {
  return safe(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDateTR(val) {
  const v = safe(val).trim();
  if (!v) return "";

  if (/^\d{2}\.\d{2}\.\d{4}$/.test(v)) return v;

  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split("-");
    return `${d}.${m}.${y}`;
  }

  try {
    const dt = new Date(v);
    if (Number.isNaN(dt.getTime())) return v;

    const dd = String(dt.getDate()).padStart(2, "0");
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const yy = dt.getFullYear();
    return `${dd}.${mm}.${yy}`;
  } catch {
    return v;
  }
}

// Eski fonksiyon fallback için korunuyor
function makeBelgeNo(payload = {}) {
  const given = safe(payload?.belgeNo || payload?.sertifikaNo).trim();
  if (given) return given;

  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");

  return `ISG-${yyyy}${mm}${dd}-${hh}${mi}`;
}

// Firma bazlı belge no
async function generateBelgeNo(payload = {}) {
  const given = safe(payload?.belgeNo || payload?.sertifikaNo).trim();
  if (given) return given;

  try {
    const firmaId = safe(
      payload?.firmaId ||
        payload?.firma?._id ||
        payload?.firma?.id
    ).trim();

    const yil = new Date().getFullYear();

    const kayit = await BelgeNo.findOneAndUpdate(
      { firmaId, yil },
      { $inc: { sayac: 1 } },
      { new: true, upsert: true }
    );

    const no = String(kayit.sayac).padStart(4, "0");
    return `ISG-${yil}-${no}`;
  } catch (err) {
    console.error("BelgeNo üretilemedi fallback çalıştı:", err);
    return makeBelgeNo(payload);
  }
}

function stripLeftoverMustache(html) {
  return String(html || "").replace(/{{\s*[^}]+\s*}}/g, "");
}

function isDemoRequest(payload = {}) {
  if (process.env.DEMO_MODE === "true") return true;
  if (payload?.isDemo === true) return true;
  if (payload?.demo === true) return true;
  return false;
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

function getKisi(payload = {}) {
  return payload?.katilimci || payload?.personel || {};
}

function getKisiler(payload = {}) {
  return (
    payload?.kisiler ||
    payload?.riskKisiler ||
    payload?.risk_prosedur_kisiler ||
    {}
  );
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

function getKisisel(payload = {}) {
  return payload?.kisisel || payload?.personal || {};
}

function buildUzmanStampData(payload = {}) {
  const kisiler = getKisiler(payload);
  const kisisel = getKisisel(payload);
  const imzaUzman = payload?.imzalar?.uzman || {};

  const rawUzman =
    kisiler?.uzman ||
    kisiler?.uzmanAdSoyad ||
    kisiler?.isgUzmani ||
    kisiler?.isgUzmaniAdSoyad ||
    payload?.uzman ||
    "";

  const parsed = splitDisplayNameAndCert(rawUzman);

  const name = toUpperTR(
    imzaUzman?.adSoyad ||
    parsed.name ||
    rawUzman.split("/")[0] ||
    ""
  ).trim();

  const certNo = sanitizeCertPrefix(
    imzaUzman?.sertifikaNo ||
    kisiler?.uzmanSertifikaNo ||
    kisisel?.sertifikaNo ||
    parsed.certNo ||
    "",
    "İGU-"
  );

  const certClass = toUpperTR(
    imzaUzman?.sertifikaSinifi ||
    kisisel?.sertifikaSinifi ||
    payload?.sertifikaSinifi ||
    ""
  ).trim();

  let title = "İŞ GÜVENLİĞİ UZMANI";
  if (certClass) {
    title = `${certClass} SINIFI İŞ GÜVENLİĞİ UZMANI`;
  }

  return { name, certNo, title };
}

function buildHekimStampData(payload = {}) {
  const kisiler = getKisiler(payload);
  const kisisel = getKisisel(payload);

  const rawHekim =
    kisiler?.hekim ||
    kisiler?.hekimAdSoyad ||
    kisiler?.isyeriHekimi ||
    kisiler?.isyeriHekimiAdSoyad ||
    payload?.hekim ||
    "";

  const parsed = splitDisplayNameAndCert(rawHekim);

  const name = toUpperTR(
    parsed.name ||
    rawHekim.split("/")[0] ||
    ""
  ).trim();

  const certNo = sanitizeCertPrefix(
    kisisel?.hekimSertifikaNo ||
    payload?.hekimSertifikaNo ||
    parsed.certNo ||
    "",
    "İH-"
  );

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

function drawStampBlock(page, font, centerX, baseY, stampData) {
  const { name, certNo, title } = stampData || {};
  if (!name && !certNo && !title) return;

  const stampColor = rgb(29 / 255, 78 / 255, 216 / 255);
  const stampOpacity = 0.42;

  drawCenteredText(page, font, name, centerX, baseY + 10, 7.8, stampColor, stampOpacity);
  drawCenteredText(page, font, title, centerX, baseY + 2, 6.0, stampColor, stampOpacity);

  if (certNo) {
    drawCenteredText(page, font, certNo, centerX, baseY - 6, 6.0, stampColor, stampOpacity);
  }
}

function normalizeFirmaImzaResponse(raw) {
  const src =
    raw?.imzalar ||
    raw?.payload?.imzalar ||
    raw?.payload ||
    raw ||
    {};

  return {
    uzman:
      src?.uzman ||
      src?.isgUzmani ||
      src?.isg_uzmani ||
      { imza: null, paraf: null },

    hekim:
      src?.hekim ||
      src?.isyeriHekimi ||
      src?.isyeri_hekimi ||
      { imza: null, paraf: null },

    isveren:
      src?.isveren ||
      src?.isverenVekili ||
      src?.isveren_vekili ||
      { imza: null, paraf: null },
  };
}

function normalizePayloadRoleImzalari(payload = {}) {
  const p = payload?.imzalar || {};

  return {
    uzman:
      p?.uzman ||
      p?.isgUzmani ||
      p?.isg_uzmani ||
      (p?.uzmanImza
        ? { imza: { dataUrl: p.uzmanImza }, paraf: null }
        : { imza: null, paraf: null }),

    hekim:
      p?.hekim ||
      p?.isyeriHekimi ||
      p?.isyeri_hekimi ||
      (p?.hekimImza
        ? { imza: { dataUrl: p.hekimImza }, paraf: null }
        : { imza: null, paraf: null }),

    isveren:
      p?.isveren ||
      p?.isverenVekili ||
      p?.isveren_vekili ||
      (p?.isverenImza
        ? { imza: { dataUrl: p.isverenImza }, paraf: null }
        : { imza: null, paraf: null }),
  };
}

function getRoleSignatureDataUrl(roleRecord) {
  const val =
    roleRecord?.imza?.dataUrl ||
    roleRecord?.imza?.url ||
    roleRecord?.imza ||
    roleRecord?.signature?.dataUrl ||
    roleRecord?.signature?.url ||
    roleRecord?.signature ||
    "";

  if (!val) return "";

  if (String(val).startsWith("data:image/")) return String(val);

  if (/^[A-Za-z0-9+/=\r\n]+$/.test(String(val)) && String(val).length > 100) {
    return `data:image/png;base64,${String(val).replace(/\s/g, "")}`;
  }

  return String(val);
}

async function fetchFirmaImzalari(payload, req) {
  const firmaId = safe(
    payload?.firmaId ||
      payload?.firma?._id ||
      payload?.firma?.id ||
      payload?.firmaIdMongo ||
      req?.body?.firmaId
  ).trim();

  const authToken = safe(
    payload?.authToken ||
      payload?.token ||
      payload?.accessToken ||
      payload?.jwt ||
      req?.headers?.authorization?.replace(/^Bearer\s+/i, "")
  ).trim();

  const empty = {
    uzman: { imza: null, paraf: null },
    hekim: { imza: null, paraf: null },
    isveren: { imza: null, paraf: null },
  };

  if (!firmaId) return empty;

  const apiBase =
    (process.env.VITE_API_URL || process.env.API_URL || "https://api.isgpanel.tr")
      .trim()
      .replace(/\/+$/, "")
      .replace(/\/api$/i, "") + "/api";

  try {
    const headers = {};
    if (authToken) headers.Authorization = `Bearer ${authToken}`;

    const res = await axios.get(`${apiBase}/firma/${firmaId}/imzalar`, {
      headers,
      timeout: 15000,
      validateStatus: () => true,
    });

    if (res.status < 200 || res.status >= 300) return empty;

    return normalizeFirmaImzaResponse(res.data || {});
  } catch {
    return empty;
  }
}

async function resolveRoleSignatures(payload = {}, req = null) {
  let roleImzalari = normalizePayloadRoleImzalari(payload);

  const payloadUzmanImza = getRoleSignatureDataUrl(roleImzalari?.uzman);
  const payloadHekimImza = getRoleSignatureDataUrl(roleImzalari?.hekim);
  const payloadIsverenImza = getRoleSignatureDataUrl(roleImzalari?.isveren);

  const payloaddaRolImzasiVar = Boolean(
    payloadUzmanImza || payloadHekimImza || payloadIsverenImza
  );

  if (!payloaddaRolImzasiVar) {
    roleImzalari = await fetchFirmaImzalari(payload, req);
  }

  return {
    uzmanImza: normalizeImage(getRoleSignatureDataUrl(roleImzalari?.uzman)),
    hekimImza: normalizeImage(getRoleSignatureDataUrl(roleImzalari?.hekim)),
    isverenImza: normalizeImage(getRoleSignatureDataUrl(roleImzalari?.isveren)),
    raw: roleImzalari,
  };
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

async function placeSertifikaSignatures(pdfPath, payload = {}, req = null) {
  const existingPdfBytes = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  pdfDoc.registerFontkit(fontkit);

  const pages = pdfDoc.getPages();
  if (!pages.length) return pdfPath;

  const firstPage = pages[0];

  const { uzmanImza, hekimImza, isverenImza } =
    await resolveRoleSignatures(payload, req);

  const uzmanImage = await embedImageFromDataUrl(pdfDoc, uzmanImza);
  const hekimImage = await embedImageFromDataUrl(pdfDoc, hekimImza);
  const isverenImage = await embedImageFromDataUrl(pdfDoc, isverenImza);

  const fontBytes = fs.readFileSync(
    path.join(findProjectRoot(), "isg_prosedur_template", "fonts", "NotoSans-Bold.ttf")
  );
  const boldFont = await pdfDoc.embedFont(fontBytes);

  const uzmanStamp = buildUzmanStampData(payload);
  const hekimStamp = buildHekimStampData(payload);

  if (isverenImage) {
    drawImageCentered(
      firstPage,
      isverenImage,
      {
        x: 140,
        y: 250,
        width: 160,
        height: 68,
      },
      { padX: 8, padY: 3 }
    );
  }

  drawStampBlock(firstPage, boldFont, 58 + (160 / 2), 108, uzmanStamp);

  if (uzmanImage) {
    drawImageCentered(
      firstPage,
      uzmanImage,
      {
        x: 58,
        y: 80,
        width: 160,
        height: 68,
      },
      { padX: 8, padY: 3 }
    );
  }

    drawStampBlock(firstPage, boldFont, 240 + (160 / 2), 108, hekimStamp);

  if (hekimImage) {
    drawImageCentered(
      firstPage,
      hekimImage,
      {
        x: 240,
        y: 80,
        width: 160,
        height: 68,
      },
      { padX: 8, padY: 3 }
    );
  }

  const outBytes = await pdfDoc.save();
  fs.writeFileSync(pdfPath, outBytes);

  return pdfPath;
}

async function createSertifikaHtml(payload = {}) {
  const ROOT = findProjectRoot();

  const templatePath = path.join(
    ROOT,
    "isg_prosedur_template",
    "templates",
    "egitim",
    "sertifika.html"
  );

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template bulunamadı: ${templatePath}`);
  }

  let html = fs.readFileSync(templatePath, "utf8");

  const authToken = safe(payload?.authToken);
  const logoSrc = await resolveLogoSrc(payload, authToken);

 // 🏭 ÇALIŞANIN İŞYERİ
const firmaAdi = safe(
  payload?.firma?.firmaAdi ||   // 🔥 artık burası
  payload?.firmaAdi ||
  ""
);

// 🏢 EĞİTİM VEREN KURUM
const kurumFirma = safe(
  payload?.kurumsal?.firmaAdi ||  // 🔥 bu aynı kalıyor
  ""
);

  const kisi = getKisi(payload);
  const kisiler = getKisiler(payload);

  const egitimBaslangic = formatDateTR(
    payload?.egitim?.baslangicISO ||
      payload?.egitim?.baslangicTarihi ||
      payload?.egitim?.egitimTarihi ||
      payload?.egitim?.tarih ||
      kisi?.baslangicTarihi ||
      kisi?.egitimTarihi ||
      ""
  );

  const egitimBitis = formatDateTR(
    payload?.egitim?.bitisISO ||
      payload?.egitim?.bitisTarihi ||
      kisi?.bitisTarihi ||
      ""
  );

  const egitimTarih =
    egitimBaslangic && egitimBitis
      ? egitimBaslangic === egitimBitis
        ? egitimBaslangic
        : `${egitimBaslangic} - ${egitimBitis}`
      : egitimBaslangic || egitimBitis || "";

  const takvim = Array.isArray(payload?.takvim) ? payload.takvim : [];

  const getTakvimTarih = (key, fallback = "") => {
    const item = takvim.find((x) => safe(x?.key).trim() === key);
    return formatDateTR(item?.tarihTR || item?.tarihISO || fallback || "");
  };

  const genelTarih = getTakvimTarih("genel", egitimBaslangic);
  const teknikTarih = getTakvimTarih("teknik", egitimBaslangic);
  const saglikTarih = getTakvimTarih("saglik", egitimBitis || egitimBaslangic);
  const iseOzelRisklerTarih = getTakvimTarih(
    "iseOzelRiskler",
    egitimBitis || egitimBaslangic
  );

  const egitimSure = safe(
    payload?.egitim?.saat ||
      payload?.egitim?.toplamSaat ||
      payload?.egitimSure ||
      [
        Number(payload?.egitim?.genelSaat || 0),
        Number(payload?.egitim?.teknikSaat || 0),
        Number(payload?.egitim?.saglikSaat || 0),
        Number(payload?.egitim?.iseOzelRisklerSaat || 0),
      ].reduce((toplam, val) => toplam + val, 0) ||
      ""
  );

  const belgeNo = await generateBelgeNo(payload);

   const uzmanStamp = buildUzmanStampData(payload);
  const hekimStamp = buildHekimStampData(payload);

 const map = {
  "{{logoUrl}}": logoSrc,
  "{{firmaAdi}}": escapeHtml(firmaAdi),
  "{{kurumFirma}}": escapeHtml(kurumFirma),
  "{{personelAdSoyad}}": escapeHtml(kisi?.adSoyad),
  "{{tc}}": escapeHtml(kisi?.tc),
  "{{gorevi}}": escapeHtml(kisi?.gorev),
  "{{egitimTarih}}": escapeHtml(egitimTarih),
  "{{egitimTarihi}}": escapeHtml(egitimTarih),
  "{{egitimBaslangic}}": escapeHtml(egitimBaslangic),
  "{{egitimBaslangicTarihi}}": escapeHtml(egitimBaslangic),
  "{{egitimBitis}}": escapeHtml(egitimBitis),
  "{{egitimBitisTarihi}}": escapeHtml(egitimBitis),
  "{{egitimTarihAraligi}}": escapeHtml(egitimTarih),
  "{{genelTarih}}": escapeHtml(genelTarih),
  "{{teknikTarih}}": escapeHtml(teknikTarih),
  "{{saglikTarih}}": escapeHtml(saglikTarih),
  "{{iseOzelRisklerTarih}}": escapeHtml(iseOzelRisklerTarih),
  "{{genelSaat}}": escapeHtml(payload?.egitim?.genelSaat || ""),
  "{{teknikSaat}}": escapeHtml(payload?.egitim?.teknikSaat || ""),
  "{{saglikSaat}}": escapeHtml(payload?.egitim?.saglikSaat || ""),
  "{{iseOzelRisklerSaat}}": escapeHtml(payload?.egitim?.iseOzelRisklerSaat || ""),
  "{{iseOzelRisklerA}}": escapeHtml(
    payload?.egitim?.iseOzelRiskler ||
      payload?.egitim?.iseOzelRisklerAciklama ||
      ""
  ),
  "{{egitimSure}}": escapeHtml(egitimSure),
  "{{belgeNo}}": escapeHtml(belgeNo),

  "{{uzmanAdSoyad}}": escapeHtml(
    kisiler?.uzmanAdSoyad ||
      kisiler?.uzman ||
      kisiler?.isgUzmaniAdSoyad ||
      kisiler?.isgUzmani ||
      ""
  ),
  "{{hekimAdSoyad}}": escapeHtml(
  (
    kisiler?.hekimAdSoyad ||
    kisiler?.hekim ||
    kisiler?.isyeriHekimiAdSoyad ||
    kisiler?.isyeriHekimi ||
    ""
  ).split("/")[0].trim()
),
  "{{isverenAdSoyad}}": escapeHtml(
    kisiler?.isverenAdSoyad ||
      kisiler?.isveren ||
      kisiler?.isverenVekiliAdSoyad ||
      kisiler?.isverenVekili ||
      ""
  ),

  "{{uzmanUnvan}}": escapeHtml(uzmanStamp.title || "İŞ GÜVENLİĞİ UZMANI"),
  "{{hekimUnvan}}": escapeHtml(hekimStamp.title || "İŞYERİ HEKİMİ"),

  "{{UZMAN_IMZA}}": "",
  "{{HEKIM_IMZA}}": "",
  "{{ISVEREN_IMZA}}": "",
};

  Object.keys(map).forEach((k) => {
    html = html.split(k).join(map[k]);
  });

  html = stripLeftoverMustache(html);

  if (isDemoRequest(payload)) {
    html = injectDemoWatermark(html);
  }

  return html;
}

async function createSertifikaPdf(payload, req = null) {
  const html = await createSertifikaHtml(payload);

  const options = {
    format: "A4",
    landscape: true,
    printBackground: true,
    margin: { top: "8mm", right: "8mm", bottom: "8mm", left: "8mm" },
  };

  const pdfBuffer = await pdf.generatePdf({ content: html }, options);

  const fileName = `sertifika_${Date.now()}.pdf`;
  const outPath = path.join(OUT_DIR, fileName);
  fs.writeFileSync(outPath, pdfBuffer);

  await placeSertifikaSignatures(outPath, payload, req);

  return outPath;
}

module.exports = { createSertifikaPdf };