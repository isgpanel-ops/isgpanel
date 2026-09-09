// backend/pdf/destekElemaniAtamaFormu.js
const fs = require("fs");
const path = require("path");
const pdf = require("html-pdf-node");
const axios = require("axios");

function toTrDate(dateISO) {
  const d = dateISO ? new Date(dateISO) : new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

// ✅ isg_prosedur_template/templates/... yolunu otomatik bulur
function resolveTemplatePath(...parts) {
  let dir = path.resolve(__dirname, ".");
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, "isg_prosedur_template");
    if (fs.existsSync(candidate)) {
      return path.join(candidate, "templates", ...parts);
    }
    dir = path.dirname(dir);
  }
  // fallback
  return path.join(__dirname, ".", "isg_prosedur_template", "templates", ...parts);
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

// ✅ DEMO kontrolü: gerçek kullanıcıda asla basma
function isDemoRequest(payload = {}) {
  // Global demo ortamı (opsiyonel). Prod’da kapalı olmalı.
  if (process.env.DEMO_MODE === "true") return true;

  // Demo kullanıcı / istek flag’i
  if (payload?.isDemo === true) return true;
  if (payload?.demo === true) return true;

  return false;
}

const TRANSPARENT_1PX =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

function normalizeLogoCandidate(value = "") {
  const s = String(value || "").trim();
  if (!s) return "";

  if (s.startsWith("data:image")) return s;

  if (/^[A-Za-z0-9+/=\r\n]+$/.test(s) && s.length > 200) {
    return `data:image/png;base64,${s.replace(/\s/g, "")}`;
  }

  return s;
}

async function fetchLogoAsDataUri(url, authToken = "") {
  let finalUrl = String(url || "").trim();
  if (!finalUrl) return "";

  if (finalUrl.startsWith("/uploads")) {
    finalUrl = `https://api.isgpanel.tr${finalUrl}`;
  }

  finalUrl = finalUrl
    .replace("https://api.isgpanel.tr/api/uploads/", "https://api.isgpanel.tr/uploads/")
    .replace("/api/uploads/", "/uploads/");

  try {
    const res = await axios.get(finalUrl, {
      responseType: "arraybuffer",
      timeout: 15000,
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      validateStatus: () => true,
    });

    const contentType = res.headers?.["content-type"] || "image/png";

    if (res.status < 200 || res.status >= 300) return "";
    if (!String(contentType).startsWith("image/")) return "";

    const b64 = Buffer.from(res.data).toString("base64");
    return `data:${contentType};base64,${b64}`;
  } catch {
    return "";
  }
}

async function resolveLogoSrc(payload = {}) {
  const kurumsal = payload?.kurumsal || {};
  const firma = payload?.firma || {};

  const candidates = [
    kurumsal.logoBase64,
    kurumsal.logo,
    kurumsal.firmaLogo,
    kurumsal.kurumsalLogo,
    payload.logoBase64,
    payload.logo,
    payload.firmaLogo,
    firma.logoBase64,
    firma.logo,

    kurumsal.logoUrl,
    kurumsal.logoPath,
    payload.logoUrl,
    firma.logoUrl,
  ].filter(Boolean);

  for (const c of candidates) {
    const normalized = normalizeLogoCandidate(c);
    if (normalized.startsWith("data:image")) return normalized;
  }

  const authToken = payload?.authToken || payload?.token || "";

  for (const c of candidates) {
    const normalized = normalizeLogoCandidate(c);
    if (!normalized) continue;

    if (normalized.startsWith("/uploads") || /^https?:\/\//i.test(normalized)) {
      const dataUri = await fetchLogoAsDataUri(normalized, authToken);
      if (dataUri) return dataUri;
    }
  }

  return TRANSPARENT_1PX;
}

async function createDestekElemaniAtamaFormuPdf(payload = {}) {
  const templatePath = resolveTemplatePath("egitim", "destek-elemani-atama-formu.html");
  if (!fs.existsSync(templatePath)) {
    throw new Error("Atama template bulunamadı: " + templatePath);
  }

  let html = fs.readFileSync(templatePath, "utf8");

  const firmaAdi = escHtml(payload?.firma?.firmaAdi || "");
  const tarih = escHtml(toTrDate(payload?.tarihISO));
  const destekAdSoyad = escHtml(payload?.destek?.adSoyad || "");
  const destekTc = escHtml(payload?.destek?.tc || "");
  const isverenAdSoyad = escHtml(payload?.kisiler?.isverenAdSoyad || "");

  html = html
    .split("{{logoSrc}}").join(await resolveLogoSrc(payload))
    .split("{{firmaAdi}}").join(firmaAdi)
    .split("{{duzenlemeTarihi}}").join(tarih)
    .split("{{destekAdSoyad}}").join(destekAdSoyad)
    .split("{{destekTc}}").join(destekTc)
    .split("{{isverenAdSoyad}}").join(isverenAdSoyad);

  // kalan placeholderları temizle
  html = html.replace(/{{\s*[^}]+\s*}}/g, "");

  // ✅ DEMO watermark sadece demo ise
  if (isDemoRequest(payload)) {
    html = injectDemoWatermark(html);
  }

  const options = {
    format: "A4",
    printBackground: true,
    margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
  };

  const pdfBuffer = await pdf.generatePdf({ content: html }, options);

const outputDir = path.join(path.resolve(__dirname, "..", ".."), "output");
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const fileName = `destek-elemani-atama-${Date.now()}.pdf`;
const filePath = path.join(outputDir, fileName);

fs.writeFileSync(filePath, pdfBuffer);

return filePath;
}

/**
 * ✅ EN KRİTİK DÜZELTME:
 * loadPdfCreator için en sorunsuz export bu:
 */
module.exports = createDestekElemaniAtamaFormuPdf;
