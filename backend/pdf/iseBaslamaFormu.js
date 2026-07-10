const fs = require("fs");
const path = require("path");
const pdf = require("html-pdf-node");
const axios = require("axios");
const crypto = require("crypto");
const QRCode = require("qrcode");
const { PDFDocument, rgb } = require("pdf-lib");
const fontkit = require("@pdf-lib/fontkit");

const OUT_DIR = path.join(__dirname, "..", "temp_pdfs");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const TRANSPARENT_1PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO6qK3cAAAAASUVORK5CYII=";

async function buildVerificationData(payload = {}) {
  const verificationCode =
    payload?.verificationCode ||
    crypto.randomBytes(5)
      .toString("hex")
      .toUpperCase();

  const verifyUrl =
    `https://app.isgpanel.tr/dogrula/${verificationCode}`;

  const verifyQr =
    await QRCode.toDataURL(
      verifyUrl,
      {
        width: 220,
        margin: 1,
      }
    );

  return {
    verificationCode,
    verifyUrl,
    verifyQr,
  };
}

const safe = (v) => (v ?? "").toString();

function formatDateTR(val) {
  const v = safe(val).trim();
  if (!v) return "";
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(v)) return v;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split("-");
    return `${d}.${m}.${y}`;
  }
  return v;
}

function normalizeImageToDataUri(value) {
  const s = safe(value).trim();
  if (!s) return "";
  if (s.startsWith("data:image/")) return s;
  if (/^https?:\/\//i.test(s)) return s;

  if (s.length > 100 && /^[A-Za-z0-9+/=\r\n]+$/.test(s)) {
    return `data:image/png;base64,${s.replace(/\s/g, "")}`;
  }

  return s;
}

function isDataImage(v) {
  return safe(v).trim().startsWith("data:image/");
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

async function resolveLogo(kurumsal, token) {
  const direct =
    kurumsal?.logoBase64 ||
    kurumsal?.logo ||
    kurumsal?.logoB64 ||
    "";

  if (isDataImage(direct)) return direct;

  if (kurumsal?.logoUrl) {
    return (await fetchAsDataUri(kurumsal.logoUrl, token)) || "";
  }

  return "";
}

function cleanDisplayName(value) {
  return safe(value).split("/")[0].trim();
}

function toUpperTR(value) {
  return safe(value).toLocaleUpperCase("tr-TR");
}

function normalizeFirmaImzaResponse(raw) {
  const src = raw?.imzalar || raw?.payload?.imzalar || raw?.payload || raw || {};

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

async function fetchFirmaImzalari(payload) {
  const firmaId = safe(
    payload?.firmaId ||
      payload?.firma?._id ||
      payload?.firma?.id ||
      payload?.firmaIdMongo
  ).trim();

  const authToken = safe(
    payload?.authToken ||
      payload?.token ||
      payload?.accessToken ||
      payload?.jwt
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
  return normalizeImageToDataUri(val);
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

async function resolveRoleSignatures(payload) {
  let roleImzalari = normalizePayloadRoleImzalari(payload);

  const payloadUzmanImza = getRoleSignatureDataUrl(roleImzalari?.uzman);
  const payloadIsverenImza = getRoleSignatureDataUrl(roleImzalari?.isveren);

  if (!payloadUzmanImza && !payloadIsverenImza) {
    roleImzalari = await fetchFirmaImzalari(payload);
  }

  return {
    uzmanImza: getRoleSignatureDataUrl(roleImzalari?.uzman),
    isverenImza: getRoleSignatureDataUrl(roleImzalari?.isveren),
    raw: roleImzalari,
  };
}

function getPersonelTekImza(row) {
  const val =
    row?.personelImzasi ||
    row?.personelTekImza ||

    // YENİ PERSONEL İMZA YAPISI
    row?.imzalar?.personel?.dataUrl ||

    // ESKİ YAPILAR
    row?.imzalar?.genel?.dataUrl ||
    row?.imzalar?.teknik?.dataUrl ||
    row?.imzalar?.saglik?.dataUrl ||
    row?.imzalar?.iseOzelRiskler?.dataUrl ||

    row?.personelImzalari?.personel ||

    row?.personelImzalari?.genel ||
    row?.personelImzalari?.teknik ||
    row?.personelImzalari?.saglik ||
    row?.personelImzalari?.iseOzelRiskler ||

    row?.personelImzasiDataUrl ||

    "";

  return normalizeImageToDataUri(val);
}

function tick() {
  return "✓";
}

function findProjectRoot() {
  let dir = path.resolve(__dirname, ".");

  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, "isg_prosedur_template"))) {
      return dir;
    }

    dir = path.dirname(dir);
  }

  return path.resolve(__dirname, "..");
}

function templatePath() {
  return path.join(
    findProjectRoot(),
    "isg_prosedur_template",
    "templates",
    "egitim",
    "iseBaslamaFormu.html"
  );
}

function replaceAllMap(html, map) {
  Object.keys(map).forEach((k) => {
    html = html.split(k).join(map[k]);
  });
  return html;
}

async function createPdfBuffer(payload = {}) {
  const htmlPath = templatePath();

console.log("ISE BASLAMA HTML PATH =>", htmlPath);

  if (!fs.existsSync(htmlPath)) {
    throw new Error(`Template bulunamadı: ${htmlPath}`);
  }

  let html = fs.readFileSync(htmlPath, "utf8");

  const rows = Array.isArray(payload?.katilimcilar) ? payload.katilimcilar : [];

const verification =
  await buildVerificationData(payload);

  const personel = payload?.personel || rows?.[0] || {};

  const logo = await resolveLogo(payload?.kurumsal || {}, payload?.authToken);
  const { uzmanImza, isverenImza } = await resolveRoleSignatures(payload);

  const personelFoto =
    normalizeImageToDataUri(
      personel?.personelFoto ||
        personel?.personelFotoDataUrl ||
        personel?.foto ||
        personel?.biometrikFoto
    ) || TRANSPARENT_1PX;

  const personelImzasi = getPersonelTekImza(personel);

  const kisiler = payload?.kisiler || {};
  const imzalar = payload?.imzalar || {};
  const firma = payload?.firma || {};
  const kurumsal = payload?.kurumsal || {};
  const egitim = payload?.egitim || {};

  const uzmanAd =
    cleanDisplayName(kisiler?.uzman) ||
    cleanDisplayName(imzalar?.isgUzmaniAdi) ||
    cleanDisplayName(payload?.uzman) ||
    "";

  const isverenAd =
    cleanDisplayName(kisiler?.isveren) ||
    cleanDisplayName(imzalar?.isverenAdi) ||
    cleanDisplayName(payload?.isveren) ||
    "";

  const map = {
    "%%LOGO_SRC%%": logo || TRANSPARENT_1PX,
    "%%PERSONEL_FOTO%%": personelFoto,

    "%%FIRMA_ADI%%":
      safe(kurumsal?.calisaninIsyeriUnvani) ||
      safe(firma?.firmaAdi) ||
      safe(kurumsal?.firmaAdi),

    "%%PERSONEL_ADSOYAD%%": toUpperTR(personel?.adSoyad),
    "%%PERSONEL_TC%%": safe(personel?.tc),
    "%%PERSONEL_GOREV%%": toUpperTR(personel?.gorev),
    "%%ISE_GIRIS_TARIHI%%": formatDateTR(
      personel?.iseGirisTarihiTR || personel?.iseGirisTarihi
    ),

    "%%EGITIM_YERI%%": safe(egitim?.yer || firma?.firmaAdi || ""),
    "%%EGITIM_TARIHI%%": formatDateTR(
       personel?.iseGirisTarihiTR || personel?.iseGirisTarihi
    ),

    "%%TICK_VERILDI_1%%": tick(),
    "%%TICK_VERILDI_2%%": tick(),
    "%%TICK_VERILDI_3%%": tick(),
    "%%TICK_VERILDI_4%%": tick(),
    "%%TICK_VERILDI_5%%": tick(),
    "%%TICK_VERILDI_6%%": tick(),
    "%%TICK_VERILDI_7%%": tick(),
    "%%TICK_VERILDI_8%%": tick(),

    "%%UZMAN_ADSOYAD%%": uzmanAd,
    "%%ISVEREN_ADSOYAD%%": isverenAd,
    "%%PERSONEL_IMZA_ADSOYAD%%": toUpperTR(personel?.adSoyad),

    "%%UZMAN_IMZA%%": uzmanImza
      ? `<img src="${uzmanImza}" class="signImg" />`
      : "",
    "%%ISVEREN_IMZA%%": isverenImza
      ? `<img src="${isverenImza}" class="signImg" />`
      : "",
    "%%PERSONEL_IMZA%%": personelImzasi
      ? `<img src="${personelImzasi}" class="signImg" />`
      : "",
     "%%VERIFY_QR%%":
  verification.verifyQr || "",

"%%VERIFICATION_CODE%%":
  verification.verificationCode || "",
    
  };

  html = replaceAllMap(html, map);

  const rawPdfBuffer = await pdf.generatePdf(
    { content: html },
    {
      format: "A4",
      printBackground: true,
      margin: {
        top: "8mm",
        bottom: "8mm",
        left: "8mm",
        right: "8mm",
      },
    }
  );

  return rawPdfBuffer;
}

async function createIseBaslamaFormuPdf(payload) {
  const buffer = await createPdfBuffer(payload);

  const personel =
    payload?.personel?.adSoyad ||
    payload?.katilimcilar?.[0]?.adSoyad ||
    "personel";

  const safeName = safe(personel)
    .replace(/[^\p{L}\p{N}\s._-]/gu, "")
    .trim()
    .replace(/\s+/g, "_");

  const file = `ise_baslama_formu_${safeName || "personel"}_${Date.now()}.pdf`;
  const out = path.join(OUT_DIR, file);

  fs.writeFileSync(out, buffer);
  return out;
}

module.exports = {
  createIseBaslamaFormuPdf,
};