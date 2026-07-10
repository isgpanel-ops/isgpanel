// backend/pdf/calisanTemsilcisiAtamaFormu.js
const fs = require("fs");
const path = require("path");
const html_to_pdf = require("html-pdf-node");
const axios = require("axios");
const { PDFDocument } = require("pdf-lib");

function toTrDate(dateISO) {
  const d = dateISO ? new Date(dateISO) : new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

const TRANSPARENT_1PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO6qK3cAAAAASUVORK5CYII=";

function safe(val) {
  return (val ?? "").toString();
}

function normalizeLogoToDataUri(value) {
  const s = safe(value).trim();
  if (!s) return "";

  if (s.startsWith("data:image/")) return s;

  if (s.length < 200) return s;

  if (/^[A-Za-z0-9+/=\r\n]+$/.test(s)) {
    return `data:image/png;base64,${s.replace(/\s/g, "")}`;
  }

  return s;
}

async function fetchLogoAsDataUri(logoUrl, authToken) {
  let url = safe(logoUrl).trim();
  if (!url) return "";

  if (url.startsWith("/uploads")) {
    url = `https://api.isgpanel.tr${url}`;
  }

  url = url
    .replace("https://api.isgpanel.tr/api/uploads/", "https://api.isgpanel.tr/uploads/")
    .replace("/api/uploads/", "/uploads/");

  try {
    const res = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 15000,
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      validateStatus: () => true,
    });

    if (res.status < 200 || res.status >= 300) return "";

    const contentType = res.headers?.["content-type"] || "image/png";
    if (!String(contentType).startsWith("image/")) return "";

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
    kurumsal.firmaLogo,
    kurumsal.kurumsalLogo,
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
    kurumsal.logoPath,
    kk.logoUrl,
    firma.logoUrl,
    p.logoUrl,
  ]
    .map((x) => safe(x).trim())
    .filter(Boolean);
}

async function resolveLogoSrc(payload = {}, authToken = "") {
  const candidates = pickLogoCandidates(payload);

  for (const c of candidates) {
    const normalized = normalizeLogoToDataUri(c);
    if (normalized && normalized.startsWith("data:image/")) {
      return normalized;
    }
  }

  for (const c of candidates) {
    const maybe = normalizeLogoToDataUri(c);
    if (!maybe) continue;

    if (maybe.startsWith("/uploads") || /^https?:\/\//i.test(maybe)) {
      const dataUri = await fetchLogoAsDataUri(maybe, authToken);
      if (dataUri) return dataUri;
    }
  }

  return TRANSPARENT_1PX;
}

function escHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

function isDemoRequest(payload = {}) {
  if (process.env.DEMO_MODE === "true") return true;
  if (payload?.isDemo === true) return true;
  if (payload?.demo === true) return true;
  return false;
}

function buildRowsFromPayload(payload = {}) {
  const list = Array.isArray(payload.katilimcilar)
    ? payload.katilimcilar
    : Array.isArray(payload.temsilciler)
    ? payload.temsilciler
    : null;

  if (list && list.length) {
    return list
      .filter((x) => (x?.adSoyad || "").trim() !== "")
      .map((x) => {
        const ad = escHtml(x.adSoyad || "");
        const tc = escHtml(x.tc || "");
        const gorev = escHtml(x.gorev || "ÇALIŞAN TEMSİLCİSİ");
        return `
          <tr>
            <td class="center">${ad}</td>
            <td class="center">${tc}</td>
            <td class="center">${gorev}</td>
            <td></td>
          </tr>
        `.trim();
      })
      .join("\n");
  }

  const t = payload.temsilci || {};
  const ad = escHtml(t.adSoyad || "");
  const tc = escHtml(t.tc || "");
  const gorev = escHtml(t.gorev || "ÇALIŞAN TEMSİLCİSİ");

  return `
    <tr>
      <td class="center">${ad}</td>
      <td class="center">${tc}</td>
      <td class="center">${gorev}</td>
      <td></td>
    </tr>
  `.trim();
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

async function placeAtamaSignatures(pdfBuffer, payload = {}) {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();
  if (!pages.length) return pdfBuffer;

  const firstPage = pages[0];
  const imzalar = payload?.imzalar || {};

  const temsilciImage = await embedImageFromDataUrl(
    pdfDoc,
    imzalar?.temsilci?.imza?.dataUrl ||
      imzalar?.temsilci?.dataUrl ||
      imzalar?.calisanTemsilcisi?.imza?.dataUrl ||
      imzalar?.calisanTemsilcisi?.dataUrl ||
      imzalar?.temsilciImza ||
      ""
  );

  const isverenImage = await embedImageFromDataUrl(
    pdfDoc,
    imzalar?.isveren?.imza?.dataUrl ||
      imzalar?.isveren?.dataUrl ||
      imzalar?.isverenImza ||
      ""
  );

  const signWidth = 160;
  const signHeight = 65;

  // İlk yerleşim. Sonra milimetrik ayarlanır.
  if (temsilciImage) {
    firstPage.drawImage(temsilciImage, {
      x: 300,
      y: 360,
      width: signWidth,
      height: signHeight,
    });
  }

if (temsilciImage) {
    firstPage.drawImage(temsilciImage, {
      x: 430,
      y: 450,
      width: 115,
      height: 46,
    });
  }

  if (isverenImage) {
    firstPage.drawImage(isverenImage, {
      x: 50,
      y: 360,
      width: signWidth,
      height: signHeight,
    });
  }

  const out = await pdfDoc.save();
  return Buffer.from(out);
}

async function createCalisanTemsilcisiAtamaFormuPdf(payload = {}) {
  const templatePath = path.join(
    __dirname,
    "..",
    "..",
    "isg_prosedur_template",
    "templates",
    "egitim",
    "calisan-temsilcisi-atama-formu.html"
  );

  if (!fs.existsSync(templatePath)) {
    throw new Error("Atama formu HTML bulunamadı: " + templatePath);
  }

  let html = fs.readFileSync(templatePath, "utf8");

  const temsilciRows = buildRowsFromPayload(payload);

  const basTemsilciAdSoyad =
    (payload?.temsilci?.adSoyad || "").trim() ||
    (payload?.kisiler?.temsilciAdSoyad || "").trim() ||
    (payload?.kisiler?.temsilci || "").trim() ||
    (Array.isArray(payload?.katilimcilar) && payload.katilimcilar[0]?.adSoyad) ||
    "";

  html = html
    .replaceAll("{{logoSrc}}", await resolveLogoSrc(payload, payload?.authToken || ""))
    .replaceAll("{{firmaAdi}}", escHtml(payload?.firma?.firmaAdi || ""))
    .replaceAll("{{tehlikeSinifi}}", escHtml(payload?.firma?.tehlike || payload?.firma?.tehlikeSinifi || ""))
    .replaceAll("{{duzenlemeTarihi}}", escHtml(toTrDate(payload?.tarihISO || payload?.egitim?.tarih || payload?.egitim?.tarihTR)))
    .replaceAll("{{temsilciRows}}", temsilciRows)
    .replaceAll("{{basTemsilciAdSoyad}}", escHtml(basTemsilciAdSoyad))
    .replaceAll(
      "{{temsilciAdSoyad}}",
      escHtml(
        payload?.kisiler?.temsilciAdSoyad ||
          payload?.kisiler?.temsilci ||
          payload?.temsilci?.adSoyad ||
          ""
      )
    )
    .replaceAll("{{temsilciTc}}", escHtml(payload?.temsilci?.tc || ""))
    .replaceAll(
      "{{temsilciGorev}}",
      escHtml(payload?.temsilci?.gorev || "ÇALIŞAN TEMSİLCİSİ")
    )
    .replaceAll(
      "{{isverenAdSoyad}}",
      escHtml(
        payload?.kisiler?.isverenAdSoyad ||
          payload?.kisiler?.isveren ||
          ""
      )
    );

  html = html.replace(/{{[^}]+}}/g, "");

  if (isDemoRequest(payload)) {
    html = injectDemoWatermark(html);
  }

  const file = { content: html };

  const options = {
    format: "A4",
    printBackground: true,
    margin: { top: 10, right: 10, bottom: 10, left: 10 },
  };

  const pdfBuffer = await html_to_pdf.generatePdf(file, options);
  const signedBuffer = await placeAtamaSignatures(pdfBuffer, payload);
  return signedBuffer;
}

module.exports = createCalisanTemsilcisiAtamaFormuPdf;