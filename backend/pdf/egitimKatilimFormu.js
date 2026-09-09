const fs = require("fs");
const path = require("path");
const pdf = require("html-pdf-node");
const axios = require("axios");
const archiver = require("archiver");
const { PDFDocument, rgb } = require("pdf-lib");
const fontkit = require("@pdf-lib/fontkit");
const QRCode = require("qrcode");
const crypto = require("crypto");
const { embedBoldFont } = require("../utils/pdfFonts");

const OUT_DIR = path.join(__dirname, "..", "temp_pdfs");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

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

function tick(val) {
  return val ? "✓" : "";
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

async function fetchLogoAsDataUri(url, token) {
  return await fetchAsDataUri(url, token);
}

async function resolveLogo(kurumsal, token) {
  const direct =
    kurumsal?.logoBase64 ||
    kurumsal?.logo ||
    kurumsal?.logoB64 ||
    "";

  if (isDataImage(direct)) return direct;

  if (kurumsal?.logoUrl) {
    const data = await fetchLogoAsDataUri(kurumsal.logoUrl, token);
    return data || "";
  }

  return "";
}

function findProjectRoot() {
  let dir = path.resolve(__dirname, ".");
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, "isg_prosedur_template"))) return dir;
    dir = path.dirname(dir);
  }
  return path.resolve(__dirname, ".", ".");
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

function cleanDisplayName(value) {
  return safe(value).split("/")[0].trim();
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
    cleanDisplayName(rawUzman) ||
    parsed.name ||
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
    cleanDisplayName(rawHekim) || parsed.name || ""
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

    if (res.status < 200 || res.status >= 300) {
      return empty;
    }

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

async function resolveRoleSignatures(payload) {
  let roleImzalari = normalizePayloadRoleImzalari(payload);

  const payloadUzmanImza = getRoleSignatureDataUrl(roleImzalari?.uzman);
  const payloadHekimImza = getRoleSignatureDataUrl(roleImzalari?.hekim);
  const payloadIsverenImza = getRoleSignatureDataUrl(roleImzalari?.isveren);

  const payloaddaRolImzasiVar = Boolean(
    payloadUzmanImza || payloadHekimImza || payloadIsverenImza
  );

  if (!payloaddaRolImzasiVar) {
    roleImzalari = await fetchFirmaImzalari(payload);
  }

  return {
    uzmanImza: normalizeImageToDataUri(getRoleSignatureDataUrl(roleImzalari?.uzman)),
    hekimImza: normalizeImageToDataUri(getRoleSignatureDataUrl(roleImzalari?.hekim)),
    isverenImza: normalizeImageToDataUri(getRoleSignatureDataUrl(roleImzalari?.isveren)),
    raw: roleImzalari,
  };
}

function getPersonelSignatureDataUrlByKey(row, key) {
  const val =
    row?.imzalar?.[key]?.dataUrl ||
    row?.personelImzalari?.[key] ||
    "";

  if (!val) return "";

  if (String(val).startsWith("data:image/")) return String(val);

  if (/^[A-Za-z0-9+/=\r\n]+$/.test(String(val)) && String(val).length > 100) {
    return `data:image/png;base64,${String(val).replace(/\s/g, "")}`;
  }

  return String(val);
}

function buildRows(katilimcilar) {
  const rows = Array.isArray(katilimcilar) ? katilimcilar : [];

  return rows
    .map((r, i) => {
      const genel = getPersonelSignatureDataUrlByKey(r, "genel");
      const teknik = getPersonelSignatureDataUrlByKey(r, "teknik");
      const saglik = getPersonelSignatureDataUrlByKey(r, "saglik");
      const iseOzelRiskler = getPersonelSignatureDataUrlByKey(r, "iseOzelRiskler");

      const genelImg = genel
        ? `<img src="${normalizeImageToDataUri(genel)}" class="miniImzaImg" />`
        : "";

      const teknikImg = teknik
        ? `<img src="${normalizeImageToDataUri(teknik)}" class="miniImzaImg" />`
        : "";

      const saglikImg = saglik
        ? `<img src="${normalizeImageToDataUri(saglik)}" class="miniImzaImg" />`
        : "";

      const iseOzelImg = iseOzelRiskler
        ? `<img src="${normalizeImageToDataUri(iseOzelRiskler)}" class="miniImzaImg" />`
        : "";

      return `
<tr class="rowH">
  <td class="center">${safe(r.no || i + 1)}</td>
  <td class="centerCell">${safe(r.tc)}</td>
  <td class="centerCell">${safe(r.adSoyad)}</td>
  <td class="centerCell gorevCell">${safe(r.gorev)}</td>
  <td class="centerCell">${formatDateTR(r.iseGirisTarihiTR || r.iseGirisTarihi)}</td>

  <td class="miniWrap">
    <table class="miniTable">
      <tr>
        <td class="miniImzaBox">${genelImg}</td>
        <td class="miniImzaBox">${teknikImg}</td>
      </tr>
    </table>
  </td>

  <td class="miniWrap">
    <table class="miniTable">
      <tr>
        <td class="miniImzaBox">${saglikImg}</td>
        <td class="miniImzaBox">${iseOzelImg}</td>
      </tr>
    </table>
  </td>
</tr>`;
    })
    .join("");
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

async function placeRoleSignaturesOnPdf(pdfBuffer, payload = {}) {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  pdfDoc.registerFontkit(fontkit);

  const pages = pdfDoc.getPages();
  if (!pages.length) return pdfBuffer;

  const firstPage = pages[0];

  const { uzmanImza, hekimImza } = await resolveRoleSignatures(payload);

  const uzmanImage = await embedImageFromDataUrl(pdfDoc, uzmanImza);
  const hekimImage = await embedImageFromDataUrl(pdfDoc, hekimImza);
  
  const boldFont = await embedBoldFont(pdfDoc, fontkit);

  const uzmanStamp = buildUzmanStampData(payload);
  const hekimStamp = buildHekimStampData(payload);

  const signWidth = 145;
  const signHeight = 52;
  const y = 185;

  const uzmanX = 93;
  const hekimX = 357;
  

  const uzmanCenterX = uzmanX + signWidth / 2;
  const hekimCenterX = hekimX + signWidth / 2;

 drawStampBlock(firstPage, boldFont, uzmanCenterX, 210, uzmanStamp);
drawStampBlock(firstPage, boldFont, hekimCenterX, 210, hekimStamp);
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

function injectSignatureCss(html) {
  const extraCss = `
    <style>
      .miniImzaBox {
        width: 100%;
        height: 62px;
        text-align: center;
        vertical-align: middle;
        overflow: hidden;
        padding: 0 !important;
      }

      .miniImzaImg {
        max-width: 100%;
        max-height: 60px;
        object-fit: contain;
        display: block;
        margin: 0 auto;
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

.personelFotoWrap {
  position: absolute;
  top: 18px;
  right: 22px;
  width: 74px;
  height: 74px;
  border-radius: 9999px;
  overflow: hidden;
  border: 2px solid #1e293b;
  background: #fff;
}

.personelFotoImg {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

      .gorevCell {
  white-space: normal !important;
  word-break: break-word !important;
  overflow-wrap: anywhere !important;
  text-align: center !important;
  vertical-align: middle !important;
  line-height: 1.15 !important;
  font-size: 12px !important;
  padding: 4px 6px !important;
}     
    </style>
  `;

  if (html.includes("</head>")) {
    return html.replace("</head>", `${extraCss}</head>`);
  }

  return extraCss + html;
}

async function createPdfBuffer(payload) {
  const templatePath =
    "/var/www/isg_prosedur_template/templates/egitim/egitimKatilimFormu.html";

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template bulunamadı: ${templatePath}`);
  }

  let html = fs.readFileSync(templatePath, "utf8");

 const logo = await resolveLogo(payload?.kurumsal || {}, payload?.authToken);
const firmaAdi = safe(payload?.firma?.firmaAdi);

const verification = await buildVerificationData(payload);
payload.verificationCode = verification.verificationCode;
payload.verifyUrl = verification.verifyUrl;
payload.verifyQr = verification.verifyQr;

  const egitim = payload?.egitim || {};
  const kisiler = payload?.kisiler || {};
  const rows = Array.isArray(payload?.katilimcilar) ? payload.katilimcilar : [];
const firstPerson = rows?.[0] || {};

const personelFoto =
  normalizeImageToDataUri(
    firstPerson?.personelFoto ||
    firstPerson?.personelFotoDataUrl
  ) || TRANSPARENT_1PX;

  const schedule = Array.isArray(payload?.takvim) ? payload.takvim : [];

  const findByKey = (key) => schedule.find((x) => x && x.key === key) || {};

  const genelTakvim = findByKey("genel");
  const teknikTakvim = findByKey("teknik");
  const saglikTakvim = findByKey("saglik");
  const iseOzelTakvim = findByKey("iseOzelRiskler");

  const ticks = {
    genel: !!safe(egitim?.genelSaat),
    teknik: !!safe(egitim?.teknikSaat),
    saglik: !!safe(egitim?.saglikSaat),
    iseOzelRiskler: !!safe(egitim?.iseOzelRisklerSaat),
  };

  const ortakGenelTeknikTarih = safe(
    genelTakvim.tarihTR ||
      teknikTakvim.tarihTR ||
      genelTakvim.tarihISO ||
      teknikTakvim.tarihISO
  );

  const ortakSaglikOzelTarih = safe(
    saglikTakvim.tarihTR ||
      iseOzelTakvim.tarihTR ||
      saglikTakvim.tarihISO ||
      iseOzelTakvim.tarihISO
  );

  const { uzmanImza, hekimImza } = await resolveRoleSignatures(payload);

  const map = {
    "%%LOGO_SRC%%": logo || TRANSPARENT_1PX,
    "%%firmaAdi%%": firmaAdi,
    "%%PERSONEL_FOTO%%": personelFoto,
"%%VERIFY_QR%%": verification.verifyQr,
"%%VERIFICATION_CODE%%": verification.verificationCode,

    "%%TICK_GENEL%%": tick(ticks.genel),
    "%%TICK_TEKNIK%%": tick(ticks.teknik),
    "%%TICK_SAGLIK%%": tick(ticks.saglik),
    "%%TICK_ISE_OZEL_RISKLER%%": tick(ticks.iseOzelRiskler),

    "%%GENEL_SAAT%%": safe(egitim.genelSaat),
    "%%TEKNIK_SAAT%%": safe(egitim.teknikSaat),
    "%%SAGLIK_SAAT%%": safe(egitim.saglikSaat),
    "%%ISE_OZEL_RISKLER_SAAT%%": safe(egitim.iseOzelRisklerSaat),

    "%%GENEL_TEKNIK_TARIH%%": ortakGenelTeknikTarih,
    "%%SAGLIK_OZEL_TARIH%%": ortakSaglikOzelTarih,

   "%%UZMAN_ADSOYAD%%": cleanDisplayName(kisiler.uzman),
"%%HEKIM_ADSOYAD%%": cleanDisplayName(kisiler.hekim),


    "%%UZMAN_IMZA%%": uzmanImza
      ? `<div class="altImzaBox"><img src="${uzmanImza}" class="altImzaImg" /></div>`
      : `<div class="altImzaBox"></div>`,
    "%%HEKIM_IMZA%%": hekimImza
      ? `<div class="altImzaBox"><img src="${hekimImza}" class="altImzaImg" /></div>`
      : `<div class="altImzaBox"></div>`,
  
  };

  Object.keys(map).forEach((k) => {
    html = html.split(k).join(map[k]);
  });

  html = html.split("%%KATILIMCI_ROWS%%").join(buildRows(rows));
  html = injectSignatureCss(html);

  const rawPdfBuffer = await pdf.generatePdf(
    { content: html },
    {
      format: "A4",
      printBackground: true,
      margin: {
        top: "10mm",
        bottom: "10mm",
        left: "10mm",
        right: "10mm",
      },
    }
  );

  const signedPdfBuffer = await placeRoleSignaturesOnPdf(rawPdfBuffer, payload);
  return signedPdfBuffer;
}

async function createEgitimKatilimFormuPdf(payload) {
  const buffer = await createPdfBuffer(payload);

  const file = `egitim_${Date.now()}.pdf`;
  const out = path.join(OUT_DIR, file);

  fs.writeFileSync(out, buffer);
  return out;
}

async function createEgitimKatilimFormuPdfBulk(payload) {
  const list = Array.isArray(payload?.items)
    ? payload.items
    : Array.isArray(payload?.katilimcilar)
    ? payload.katilimcilar.map((k) => ({ ...payload, katilimcilar: [{ ...k }] }))
    : [];

  const zipName = `egitim_katilim_formlari_${Date.now()}.zip`;
  const zipPath = path.join(OUT_DIR, zipName);

  await new Promise(async (resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", resolve);
    archive.on("error", reject);
    archive.pipe(output);

    for (let i = 0; i < list.length; i++) {
      const onePayload = list[i];
      const buf = await createPdfBuffer(onePayload);
      const person =
        onePayload?.personel?.adSoyad ||
        onePayload?.katilimcilar?.[0]?.adSoyad ||
        `katilimci_${i + 1}`;

      const safeName = safe(person)
        .replace(/[^\p{L}\p{N}\s._-]/gu, "")
        .trim();

      archive.append(buf, { name: `${i + 1}_${safeName || "katilimci"}.pdf` });
    }

    await archive.finalize();
  });

  return zipPath;
}

module.exports = {
  createEgitimKatilimFormuPdf,
  createEgitimKatilimFormuPdfBulk,
};
