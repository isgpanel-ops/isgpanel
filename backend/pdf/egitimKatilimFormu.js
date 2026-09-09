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

function isBrowserUnavailableError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return (
    message.includes("could not find expected browser") ||
    message.includes("failed to launch the browser") ||
    message.includes("chromium revision") ||
    message.includes("executable doesn't exist") ||
    message.includes("did not find any executable")
  );
}

function drawFittedText(page, font, value, x, y, maxWidth, size = 9) {
  const text = safe(value).trim() || "-";
  let fitted = text;

  while (fitted.length > 1 && font.widthOfTextAtSize(fitted, size) > maxWidth) {
    fitted = `${fitted.slice(0, -2).trim()}...`;
  }

  page.drawText(fitted, { x, y, size, font, color: rgb(0.06, 0.12, 0.2) });
}

async function drawFallbackSignature(page, pdfDoc, dataUrl, x, y, width, height) {
  const image = await embedImageFromDataUrl(pdfDoc, dataUrl);
  if (!image) return;

  const scale = Math.min(width / image.width, height / image.height);
  const imageWidth = image.width * scale;
  const imageHeight = image.height * scale;
  page.drawImage(image, {
    x: x + (width - imageWidth) / 2,
    y: y + (height - imageHeight) / 2,
    width: imageWidth,
    height: imageHeight,
  });
}

async function createPdfLibFallback(payload = {}) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const font = await embedBoldFont(pdfDoc, fontkit);
  const page = pdfDoc.addPage([595.28, 841.89]);
  const navy = rgb(0.04, 0.19, 0.31);
  const line = rgb(0.65, 0.7, 0.76);
  const firmaAdi = safe(payload?.firma?.firmaAdi || payload?.kurumsal?.firmaAdi);
  const egitim = payload?.egitim || {};
  const rows = Array.isArray(payload?.katilimcilar) ? payload.katilimcilar : [];
  const verification = await buildVerificationData(payload);
  const { uzmanImza, hekimImza } = await resolveRoleSignatures(payload);
  const uzmanStamp = buildUzmanStampData(payload);
  const hekimStamp = buildHekimStampData(payload);

  page.drawRectangle({ x: 32, y: 778, width: 531, height: 36, color: navy });
  drawCenteredText(page, font, "İŞE GİRİŞ EĞİTİMİ KATILIM FORMU", 297.5, 791, 14, rgb(1, 1, 1));
  drawFittedText(page, font, firmaAdi, 42, 753, 510, 10);
  page.drawLine({ start: { x: 32, y: 745 }, end: { x: 563, y: 745 }, thickness: 1, color: line });

  const details = [
    `Genel konular: ${safe(egitim.genelSaat || "-")} saat`,
    `Teknik konular: ${safe(egitim.teknikSaat || "-")} saat`,
    `Sağlık konuları: ${safe(egitim.saglikSaat || "-")} saat`,
    `İşe özel riskler: ${safe(egitim.iseOzelRisklerSaat || "-")} saat`,
  ];
  details.forEach((detail, index) => drawFittedText(page, font, detail, 42 + (index % 2) * 264, 722 - Math.floor(index / 2) * 18, 245, 8));

  const columns = [
    [32, 28, "No"], [60, 95, "T.C. Kimlik No"], [155, 150, "Ad Soyad"],
    [305, 100, "Görevi"], [405, 82, "İşe Giriş"], [487, 76, "İmzalar"],
  ];
  const tableTop = 672;
  const rowHeight = 58;
  page.drawRectangle({ x: 32, y: tableTop - 23, width: 531, height: 23, color: rgb(0.9, 0.93, 0.96) });
  columns.forEach(([x, width, label]) => {
    page.drawRectangle({ x, y: tableTop - 23, width, height: 23, borderWidth: 0.5, borderColor: line });
    drawCenteredText(page, font, label, x + width / 2, tableTop - 15, 7, navy);
  });

  const visibleRows = rows.length ? rows.slice(0, 8) : [{}];
  for (let index = 0; index < visibleRows.length; index += 1) {
    const row = visibleRows[index] || {};
    const y = tableTop - 23 - (index + 1) * rowHeight;
    columns.forEach(([x, width]) => page.drawRectangle({ x, y, width, height: rowHeight, borderWidth: 0.5, borderColor: line }));
    drawCenteredText(page, font, String(row.no || index + 1), 46, y + 27, 8, navy);
    drawFittedText(page, font, row.tc, 64, y + 31, 87, 7);
    drawFittedText(page, font, row.adSoyad, 159, y + 31, 142, 8);
    drawFittedText(page, font, row.gorev, 309, y + 31, 92, 7);
    drawFittedText(page, font, formatDateTR(row.iseGirisTarihiTR || row.iseGirisTarihi), 409, y + 31, 74, 7);
    await drawFallbackSignature(page, pdfDoc, getPersonelSignatureDataUrlByKey(row, "genel"), 491, y + 30, 31, 23);
    await drawFallbackSignature(page, pdfDoc, getPersonelSignatureDataUrlByKey(row, "saglik"), 528, y + 30, 31, 23);
  }

  const signatureTop = Math.max(135, tableTop - 23 - visibleRows.length * rowHeight - 120);
  page.drawText("Eğitimi Verenler", { x: 42, y: signatureTop + 85, size: 10, font, color: navy });
  page.drawLine({ start: { x: 42, y: signatureTop + 80 }, end: { x: 553, y: signatureTop + 80 }, thickness: 1, color: line });
  const signatureBlocks = [
    { x: 62, label: uzmanStamp.title, name: uzmanStamp.name, cert: uzmanStamp.certNo, image: uzmanImza },
    { x: 325, label: hekimStamp.title, name: hekimStamp.name, cert: hekimStamp.certNo, image: hekimImza },
  ];
  for (const block of signatureBlocks) {
    drawCenteredText(page, font, block.label, block.x + 100, signatureTop + 62, 8, navy);
    drawCenteredText(page, font, block.name, block.x + 100, signatureTop + 49, 8, navy);
    drawCenteredText(page, font, block.cert, block.x + 100, signatureTop + 37, 7, navy);
    await drawFallbackSignature(page, pdfDoc, block.image, block.x + 25, signatureTop, 150, 32);
    page.drawLine({ start: { x: block.x + 18, y: signatureTop - 3 }, end: { x: block.x + 182, y: signatureTop - 3 }, thickness: 0.5, color: line });
  }

  page.drawText(`Doğrulama kodu: ${verification.verificationCode}`, { x: 42, y: 42, size: 7, font, color: rgb(0.3, 0.35, 0.4) });
  page.drawText("Bu belge İSG Panel üzerinden oluşturulmuştur.", { x: 312, y: 42, size: 7, font, color: rgb(0.3, 0.35, 0.4) });
  return Buffer.from(await pdfDoc.save());
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
  const templatePath = [
    "/var/www/isg_prosedur_template/templates/egitim/egitimKatilimFormu.html",
    path.join(
      findProjectRoot(),
      "isg_prosedur_template",
      "templates",
      "egitim",
      "egitimKatilimFormu.html"
    ),
  ].find((candidate) => fs.existsSync(candidate));

  if (!templatePath) {
    throw new Error("Eğitim katılım formu şablonu bulunamadı.");
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

  try {
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

    return await placeRoleSignaturesOnPdf(rawPdfBuffer, payload);
  } catch (error) {
    if (!isBrowserUnavailableError(error)) throw error;

    console.warn(
      "İşe giriş katılım formu tarayıcısız PDF üreticisiyle hazırlanıyor:",
      error.message
    );
    return await createPdfLibFallback(payload);
  }
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
