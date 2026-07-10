const fs = require("fs");
const path = require("path");
const pdf = require("html-pdf-node");
const axios = require("axios");
const archiver = require("archiver");
const { PDFDocument, rgb } = require("pdf-lib");
const fontkit = require("@pdf-lib/fontkit");
const QRCode = require("qrcode");
const crypto = require("crypto");
const PdfJob = require("../models/PdfJob");
const safe = (v) => (v ?? "").toString();

const TRANSPARENT_1PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO6qK3cAAAAASUVORK5CYII=";

async function buildVerificationData(payload = {}) {
  const verificationCode =
    payload?.verificationCode ||
    crypto.randomBytes(5).toString("hex").toUpperCase();

  const verifyUrl = `https://app.isgpanel.tr/dogrula/${verificationCode}`;

  const verifyQr = await QRCode.toDataURL(verifyUrl, {
    width: 220,
    margin: 1,
  });

  return {
    verificationCode,
    verifyUrl,
    verifyQr,
  };
}

function formatDateTR(val) {
  const v = safe(val).trim();
  if (!v) return "";

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

function findProjectRoot() {
  let dir = path.resolve(__dirname, ".");
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, "isg_prosedur_template"))) return dir;
    dir = path.dirname(dir);
  }
  return path.resolve(__dirname, ".", ".");
}

function isDataImage(v) {
  return safe(v).trim().startsWith("data:image/");
}

function normalizeImageToDataUri(maybeBase64OrDataUriOrUrl) {
  const s = safe(maybeBase64OrDataUriOrUrl).trim();
  if (!s) return "";

  if (s.startsWith("data:image/")) return s;
  if (/^https?:\/\//i.test(s)) return s;

  if (s.length > 100 && /^[A-Za-z0-9+/=\r\n]+$/.test(s)) {
    return `data:image/png;base64,${s.replace(/\s/g, "")}`;
  }

  return s;
}

async function fetchAsDataUri(url, authToken) {
  const u = safe(url).trim();
  if (!u) return "";

  if (isDataImage(u)) return u;

  try {
    const headers = {};
    if (authToken) headers.Authorization = `Bearer ${authToken}`;

    const res = await axios.get(u, {
      responseType: "arraybuffer",
      headers,
      timeout: 15000,
      validateStatus: () => true,
    });

    if (res.status < 200 || res.status >= 300) return "";

    const contentType =
      res.headers?.["content-type"] ||
      (u.toLowerCase().endsWith(".jpg") || u.toLowerCase().endsWith(".jpeg")
        ? "image/jpeg"
        : u.toLowerCase().endsWith(".webp")
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
  const kurumsal = p.kurumsal || {};
  const kk = p.kurumsalKimlik || p.kurumsal_kimlik || p.kurumsalBilgiler || {};
  const firma = p.firma || {};

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
    kurumsal.logoURL,
    kk.logoURL,
  ]
    .map((x) => safe(x).trim())
    .filter(Boolean);
}

async function resolveLogoSrc(payload) {
  const authToken = safe(payload?.authToken || payload?.token || payload?.accessToken);
  const candidates = pickLogoCandidates(payload);

  for (const c of candidates) {
    const n = normalizeImageToDataUri(c);
    if (n && n.startsWith("data:image/")) return n;
  }

  for (const c of candidates) {
    const n = normalizeImageToDataUri(c);
    if (/^https?:\/\//i.test(n)) {
      const d = await fetchAsDataUri(n, authToken);
      if (d) return d;
      return n;
    }
  }

  return TRANSPARENT_1PX;
}

function pickFirmaAdi(payload) {
  return (
    payload?.firma?.firmaAdi ||
    payload?.firma?.ad ||
    payload?.firmaAdi ||
    payload?.kurumsal?.firmaAdi ||
    payload?.kurumsalKimlik?.firmaAdi ||
    ""
  );
}

function cleanDisplayName(value) {
  return safe(value).split("/")[0].trim();
}

function pickKisiAdlari(payload) {
  const kisiler =
    payload?.kisiler ||
    payload?.riskKisiler ||
    payload?.risk_prosedur_kisiler ||
    {};

  return {
    uzman: cleanDisplayName(
      kisiler?.uzman ||
      kisiler?.uzmanAdSoyad ||
      kisiler?.isgUzmani ||
      kisiler?.isgUzmaniAdSoyad ||
      payload?.firma?.uzmanAdSoyad ||
      ""
    ),
    hekim: cleanDisplayName(
      kisiler?.hekim ||
      kisiler?.hekimAdSoyad ||
      kisiler?.isyeriHekimi ||
      kisiler?.isyeriHekimiAdSoyad ||
      payload?.firma?.hekimAdSoyad ||
      ""
    ),
    isveren: cleanDisplayName(
      kisiler?.isveren ||
      kisiler?.isverenAdSoyad ||
      kisiler?.isverenVekili ||
      kisiler?.isverenVekiliAdSoyad ||
      payload?.firma?.isverenAdSoyad ||
      ""
    ),
  };
}

function getKisiler(payload = {}) {
  return (
    payload?.kisiler ||
    payload?.riskKisiler ||
    payload?.risk_prosedur_kisiler ||
    {}
  );
}

function getKisisel(payload = {}) {
  return payload?.kisisel || payload?.personal || {};
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

// sadece isim, slash sonrası tamamen çöpe
const name = toUpperTR(
  rawHekim.split("/")[0] || parsed.name || ""
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

function pickYKDate(payload) {
  const first = Array.isArray(payload?.katilimcilar) ? payload.katilimcilar[0] : null;
  return (
    payload?.egitim?.tarihISO ||
    payload?.egitim?.baslangicISO ||
    first?.egitimTarihi ||
    first?.tarih ||
    first?.baslangicTarihi ||
    first?.bitisTarihi ||
    ""
  );
}

function pickYKSaat(payload) {
  const s = safe(payload?.egitim?.saat || payload?.egitim?.ykSaat || "4").trim();
  return s || "4";
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

    if (res.status < 200 || res.status >= 300) {
      return empty;
    }

    const incoming = res.data || {};
    return normalizeFirmaImzaResponse(incoming);
  } catch {
    return empty;
  }
}

function getPersonelSignatureDataUrl(row) {
  const val =
    row?.imzalar?.personel?.dataUrl ||
    row?.personelImzalari?.personel ||
    row?.personelImzasi ||
    "";

  if (!val) return "";

  if (val.startsWith("data:image/")) return val;

  if (/^[A-Za-z0-9+/=\r\n]+$/.test(val)) {
    return `data:image/png;base64,${val.replace(/\s/g, "")}`;
  }

  return val;
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

function normalizePayloadRoleImzalari(payload = {}) {
  const p = payload?.imzalar || {};

  return {
    uzman:
      p?.uzman ||
      p?.isgUzmani ||
      p?.isg_uzmani ||
      (p?.uzmanImza || p?.uzmanParaf
        ? {
            imza: p?.uzmanImza ? { dataUrl: p.uzmanImza } : null,
            paraf: p?.uzmanParaf ? { dataUrl: p.uzmanParaf } : null,
          }
        : { imza: null, paraf: null }),

    hekim:
      p?.hekim ||
      p?.isyeriHekimi ||
      p?.isyeri_hekimi ||
      (p?.hekimImza || p?.hekimParaf
        ? {
            imza: p?.hekimImza ? { dataUrl: p.hekimImza } : null,
            paraf: p?.hekimParaf ? { dataUrl: p.hekimParaf } : null,
          }
        : { imza: null, paraf: null }),

    isveren:
      p?.isveren ||
      p?.isverenVekili ||
      p?.isveren_vekili ||
      (p?.isverenImza || p?.isverenParaf
        ? {
            imza: p?.isverenImza ? { dataUrl: p.isverenImza } : null,
            paraf: p?.isverenParaf ? { dataUrl: p.isverenParaf } : null,
          }
        : { imza: null, paraf: null }),
  };
}

function escapeHtml(value) {
  return safe(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildRows(katilimcilar) {
  const rows = Array.isArray(katilimcilar) ? katilimcilar : [];

  return rows
    .map((r, idx) => {
      const no = safe(r?.no || idx + 1);
      const tc = safe(r?.tc);
      const ad = safe(r?.adSoyad);
      const gorev = safe(r?.gorev);
      const personelImza = normalizeImageToDataUri(getPersonelSignatureDataUrl(r));

     

      return `
        <tr class="rowH">
          <td class="center">${escapeHtml(no)}</td>
          <td class="centerCell">${escapeHtml(tc)}</td>
          <td class="centerCell">${escapeHtml(ad)}</td>
          <td class="centerCell">${escapeHtml(gorev)}</td>
        <td class="imzaCell">
  ${
    personelImza
      ? `<div class="imzaBox"><img src="${personelImza}" class="imzaImg" /></div>`
      : `<div class="imzaBox"></div>`
  }
</td>
        </tr>
      `;
    })
    .join("");
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

function isDemoRequest(req, payload) {
  if (req?.user?.isDemo === true) return true;
  if (payload?.demo === true) return true;
  return String(process.env.DEMO_MODE || "").toLowerCase() === "true";
}

function injectSignatureCss(html) {
  const extraCss = `
    <style>
      .imzaCell {
        padding: 0 !important;
        text-align: center !important;
        vertical-align: middle !important;
      }

      .imzaBox {
        width: 170px;
        height: 72px;
        margin: 0 auto 0 -8px;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }

      .imzaImg {
        width: 170px;
        height: 72px;
        object-fit: contain;
        object-position: 42% center;
        display: block;
      }

    

      .altImzaBox {
        width: 180px;
        height: 78px;
        margin: 4px auto 0;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }

      .altImzaImg {
        width: 180px;
        height: 78px;
        object-fit: contain;
        object-position: center center;
        display: block;
      }
    </style>
  `;

  if (html.includes("</head>")) {
    return html.replace("</head>", `${extraCss}</head>`);
  }

  return extraCss + html;
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

async function resolveRoleSignatures(payload, req) {
  let prosedurImzalari = normalizePayloadRoleImzalari(payload);

  const payloadUzmanImza = getRoleSignatureDataUrl(prosedurImzalari?.uzman);
  const payloadHekimImza = getRoleSignatureDataUrl(prosedurImzalari?.hekim);
  const payloadIsverenImza = getRoleSignatureDataUrl(prosedurImzalari?.isveren);

  const payloaddaRolImzasiVar = Boolean(
    payloadUzmanImza || payloadHekimImza || payloadIsverenImza
  );

  if (!payloaddaRolImzasiVar) {
    prosedurImzalari = await fetchFirmaImzalari(payload, req);
  }

  return {
    uzmanImza: normalizeImageToDataUri(
      getRoleSignatureDataUrl(prosedurImzalari?.uzman)
    ),
    hekimImza: normalizeImageToDataUri(
      getRoleSignatureDataUrl(prosedurImzalari?.hekim)
    ),
    isverenImza: normalizeImageToDataUri(
      getRoleSignatureDataUrl(prosedurImzalari?.isveren)
    ),
    raw: prosedurImzalari,
  };
}

async function placeRoleSignaturesOnPdf(pdfBuffer, payload = {}, req = null) {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  pdfDoc.registerFontkit(fontkit);

  const pages = pdfDoc.getPages();
  if (!pages.length) return pdfBuffer;

  const firstPage = pages[0];
  const { width, height } = firstPage.getSize();

  const { uzmanImza, hekimImza, isverenImza, raw } = await resolveRoleSignatures(
    payload,
    req
  );

  console.log("[YUKSEKTE PDF / PDF-LIB] IMZA DEBUG =>", {
    firmaId:
      payload?.firmaId ||
      payload?.firma?._id ||
      payload?.firma?.id ||
      "",
    payloadImzalar: payload?.imzalar || {},
    prosedurImzalari: raw,
    uzmanImzaVar: !!uzmanImza,
    hekimImzaVar: !!hekimImza,
    
    pageWidth: width,
    pageHeight: height,
  });

  const uzmanImage = await embedImageFromDataUrl(pdfDoc, uzmanImza);
  const hekimImage = await embedImageFromDataUrl(pdfDoc, hekimImza);
  

  const fontBytes = fs.readFileSync(
    path.join(findProjectRoot(), "isg_prosedur_template", "fonts", "NotoSans-Bold.ttf")
  );
  const boldFont = await pdfDoc.embedFont(fontBytes);

  const uzmanStamp = buildUzmanStampData(payload);
  const hekimStamp = buildHekimStampData(payload);

  const signWidth = 145;
  const signHeight = 52;
 const y = 340;

const uzmanX = 92;
const hekimX = 356;
  

  const uzmanCenterX = uzmanX + signWidth / 2;
  const hekimCenterX = hekimX + signWidth / 2;

  drawStampBlock(firstPage, boldFont, uzmanCenterX, 365, uzmanStamp);
drawStampBlock(firstPage, boldFont, hekimCenterX, 365, hekimStamp);

  if (uzmanImage) {
    firstPage.drawImage(uzmanImage, {
      x: uzmanX,
      y,
      width: signWidth,
      height: signHeight,
    });
  }

  if (hekimImage) {
    firstPage.drawImage(hekimImage, {
      x: hekimX,
      y,
      width: signWidth,
      height: signHeight,
    });
  }

  

  const out = await pdfDoc.save();
  return Buffer.from(out);
}

async function renderHtml(payload, req) {
  const ROOT = findProjectRoot();
  const templatePath = path.join(
    ROOT,
    "isg_prosedur_template",
    "templates",
    "egitim",
    "yuksekte_egitimKatilimFormu.html"
  );

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template bulunamadı: ${templatePath}`);
  }

  let html = fs.readFileSync(templatePath, "utf8");

  const logoSrc = await resolveLogoSrc(payload);
  const firmaAdi = safe(pickFirmaAdi(payload));

const verification = await buildVerificationData(payload);

payload.verificationCode = verification.verificationCode;
payload.verifyUrl = verification.verifyUrl;
payload.verifyQr = verification.verifyQr;

  const ykSaat = safe(pickYKSaat(payload));
  const ykTarih = formatDateTR(pickYKDate(payload));


const rows = Array.isArray(payload?.katilimcilar) ? payload.katilimcilar : [];
const firstPerson = rows?.[0] || {};

const personelFoto =
  normalizeImageToDataUri(
    firstPerson?.personelFoto ||
    firstPerson?.personelFotoDataUrl ||
    payload?.personel?.personelFoto ||
    payload?.personel?.personelFotoDataUrl ||
    ""
  ) || TRANSPARENT_1PX;

  const kisiAdlari = pickKisiAdlari(payload);
  const { uzmanImza, hekimImza, isverenImza, raw } = await resolveRoleSignatures(
    payload,
    req
  );

  console.log("[YUKSEKTE PDF / HTML] IMZA DEBUG =>", {
    firmaId:
      payload?.firmaId ||
      payload?.firma?._id ||
      payload?.firma?.id ||
      "",
    payloadImzalar: payload?.imzalar || {},
    prosedurImzalari: raw,
    uzmanImzaVar: !!uzmanImza,
    hekimImzaVar: !!hekimImza,
    
  });

  const map = {
  "{{LOGO_SRC}}": logoSrc,
  "{{firmaAdi}}": firmaAdi,
  "{{YK_SAAT}}": ykSaat,
  "{{YK_TARIH}}": ykTarih,
  "{{PERSONEL_FOTO}}": personelFoto,
"{{VERIFY_QR}}": verification.verifyQr,
"{{VERIFICATION_CODE}}": verification.verificationCode,


    "{{UZMAN_ADSOYAD}}": safe(kisiAdlari.uzman || ""),
    "{{HEKIM_ADSOYAD}}": safe(kisiAdlari.hekim || ""),
    

    "{{UZMAN_IMZA}}": "",
"{{HEKIM_IMZA}}": "",
   
  };

  Object.keys(map).forEach((k) => {
    html = html.split(k).join(map[k]);
  });

  html = html.split("{{KATILIMCI_ROWS}}").join(buildRows(payload?.katilimcilar));
  html = injectSignatureCss(html);
  html = stripLeftoverMustache(html);

  if (isDemoRequest(req, payload)) {
    html = injectDemoWatermark(html);
  }

  return html;
}

async function createPdfBuffer(payload, req) {
  const html = await renderHtml(payload, req);

  const options = {
    format: "A4",
    printBackground: true,
    margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
  };

  const rawPdfBuffer = await pdf.generatePdf({ content: html }, options);
  const signedPdfBuffer = await placeRoleSignaturesOnPdf(rawPdfBuffer, payload, req);
  return signedPdfBuffer;
}

async function createYuksekteKatilimPdf(req, res) {
  try {
    const payload = req.body || {};

    const verificationCode =
      payload.verificationCode ||
      crypto.randomBytes(5).toString("hex").toUpperCase();

    payload.verificationCode = verificationCode;
    req.body.verificationCode = verificationCode;

    const createdByUserId = String(req.user?._id || req.user?.id || "");
    const organizationId = String(
      req.user?.organizationId ||
        req.user?.organizationUuid ||
        req.user?._id ||
        req.user?.id ||
        ""
    );

    await PdfJob.findOneAndUpdate(
      { verificationCode },
      {
        $set: {
          type: "yuksekte-calisma-egitim-katilim",
          status: "finished",
          data: { ...payload },
          createdByUserId,
          organizationId,
          verificationCode,
          finishedAt: new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const buf = await createPdfBuffer(payload, req);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="yuksekte-calisma-katilim-formu.pdf"`
    );
    return res.end(buf);
  } catch (err) {
    console.error("createYuksekteKatilimPdf error:", err);
    return res.status(500).send(err?.message || "PDF üretim hatası");
  }
}

async function createYuksekteKatilimPdfBulk(req, res) {
  try {
    const payload = req.body || {};
    const list = Array.isArray(payload?.katilimcilar) ? payload.katilimcilar : [];

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="yuksekte-calisma-katilim-formlari_${new Date()
        .toISOString()
        .slice(0, 10)}.zip"`
    );

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (e) => {
      console.error("zip error:", e);
      try {
        res.status(500).end("ZIP üretim hatası");
      } catch {}
    });

    archive.pipe(res);

    for (let i = 0; i < list.length; i++) {
      const one = list[i];
      const onePayload = { ...payload, katilimcilar: [{ ...one }] };
      const buf = await createPdfBuffer(onePayload, req);

      const safeName = safe(one?.adSoyad || `katilimci_${i + 1}`)
        .replace(/[^\p{L}\p{N}\s._-]/gu, "")
        .trim();

      archive.append(buf, { name: `${i + 1}_${safeName || "katilimci"}.pdf` });
    }

    await archive.finalize();
  } catch (err) {
    console.error("createYuksekteKatilimPdfBulk error:", err);
    return res.status(500).send(err?.message || "ZIP üretim hatası");
  }
}

module.exports = {
  createYuksekteKatilimPdf,
  createYuksekteKatilimPdfBulk,
};