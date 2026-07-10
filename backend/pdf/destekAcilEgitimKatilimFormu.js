// backend/pdf/destekAcilEgitimKatilimFormu.js
const fs = require("fs");
const path = require("path");
const pdf = require("html-pdf-node");
const axios = require("axios");

function esc(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getOnlyDisplayName(value = "") {
  return String(value || "")
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean)[0] || "";
}

const normalizeTC = (v) => String(v || "").replace(/\D/g, "").slice(0, 11);

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

function formatDateTR(value) {
  const v = String(value || "").trim();
  if (!v) return "__.__.____";

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

function normalizeImageToDataUri(val) {
  const s = String(val || "").trim();
  if (!s) return "";

  if (s.startsWith("data:image/")) return s;

  if (/^[A-Za-z0-9+/=\r\n]+$/.test(s) && s.length > 100) {
    return `data:image/png;base64,${s.replace(/\s/g, "")}`;
  }

  return s;
}

function getPersonelSignatureDataUrl(row = {}) {
  const val =
    row?.imzalar?.personel?.dataUrl ||
    row?.personelImzalari?.personel ||
    row?.personelImzasi ||
    "";

  return normalizeImageToDataUri(val);
}

function getRoleSignatureDataUrl(roleRecord = {}) {
  const val =
    roleRecord?.imza?.dataUrl ||
    roleRecord?.imza?.url ||
    roleRecord?.imza ||
    roleRecord?.signature?.dataUrl ||
    roleRecord?.signature?.url ||
    roleRecord?.signature ||
    roleRecord?.dataUrl ||
    roleRecord?.url ||
    roleRecord?.value ||
    roleRecord?.base64 ||
    "";

  return normalizeImageToDataUri(val);
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
  const k = payload?.kisiler || {};
  const personal = payload?.kisisel || {};
  const parsed = splitDisplayNameAndCert(k.uzman || "");

  const name = toUpperTR(getOnlyDisplayName(parsed.name || k.uzman || "")).trim();
  const certNo = sanitizeCertPrefix(
    personal?.sertifikaNo || parsed.certNo || "",
    "İGU-"
  );

  let title = "İŞ GÜVENLİĞİ UZMANI";
  const certClass = toUpperTR(personal?.sertifikaSinifi || "").trim();

  if (certClass) {
    title = `${certClass} SINIFI İŞ GÜVENLİĞİ UZMANI`;
  }

  return { name, certNo, title };
}

function buildHekimStampData(payload = {}) {
  const k = payload?.kisiler || {};
  const parsed = splitDisplayNameAndCert(k.hekim || "");

  const name = toUpperTR(getOnlyDisplayName(parsed.name || k.hekim || "")).trim();
  const certNo = sanitizeCertPrefix(parsed.certNo || "", "İH-");
  const title = "İŞYERİ HEKİMİ";

  return { name, certNo, title };
}

function buildStampHtml(stamp = {}) {
  const name = esc(stamp?.name || "");
  const title = esc(stamp?.title || "");
  const certNo = esc(stamp?.certNo || "");

  if (!name && !title && !certNo) return "";

  return `
    <div class="kaseBlock">
      ${name ? `<div class="kaseLine kaseName">${name}</div>` : ""}
      ${title ? `<div class="kaseLine kaseTitle">${title}</div>` : ""}
      ${certNo ? `<div class="kaseLine kaseCert">${certNo}</div>` : ""}
    </div>
  `;
}

function buildRoleImzaHtml(signatureDataUrl = "", stamp = null) {
  const stampHtml = stamp ? buildStampHtml(stamp) : "";
  const imzaHtml = signatureDataUrl
    ? `<img src="${signatureDataUrl}" class="rolImzaImg" />`
    : "";

  if (!stampHtml && !imzaHtml) return "";

  return `
    <div class="rolImzaWrap">
      ${stampHtml}
      ${imzaHtml}
    </div>
  `;
}

function buildPersonelImzaHtml(signatureDataUrl = "") {
  if (!signatureDataUrl) return "";
  return `
    <div class="personelImzaBox">
      <img src="${signatureDataUrl}" class="personelImzaImg" />
    </div>
  `;
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

function resolveTemplatePath() {
  let dir = path.resolve(__dirname, ".");
  for (let i = 0; i < 7; i++) {
    const candidate = path.join(
      dir,
      "isg_prosedur_template",
      "templates",
      "egitim",
      "destek_acil_egitim_katilim_formu.html"
    );
    if (fs.existsSync(candidate)) return candidate;
    dir = path.dirname(dir);
  }

  return path.join(
    __dirname,
    "isg_prosedur_template",
    "templates",
    "egitim",
    "destek_acil_egitim_katilim_formu.html"
  );
}

async function fetchFirmaImzalari(payload = {}) {
  const firmaId =
    payload?.firmaId ||
    payload?.firma?._id ||
    payload?.firma?.id ||
    "";

  if (!firmaId) return {};

  const apiBase = (
    process.env.VITE_API_URL ||
    process.env.API_URL ||
    process.env.API_BASE_URL ||
    "https://api.isgpanel.tr"
  )
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/api$/i, "");

  const authToken =
    payload?.authToken ||
    payload?.token ||
    payload?.accessToken ||
    "";

  const headers = {};
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const urls = [
    `${apiBase}/api/firma/${firmaId}/imzalar`,
    `${apiBase}/firma/${firmaId}/imzalar`,
  ];

  for (const url of urls) {
    try {
      const res = await axios.get(url, {
        headers,
        timeout: 15000,
        validateStatus: () => true,
      });

      if (res.status < 200 || res.status >= 300) continue;

      const raw = res.data || {};
      const root =
        raw?.payload?.imzalar ||
        raw?.payload ||
        raw?.data?.imzalar ||
        raw?.data ||
        raw?.imzalar ||
        raw ||
        {};

      return {
        uzman:
          root?.uzman ||
          root?.isgUzmani ||
          root?.uzmanImza ||
          { imza: null, paraf: null },

        hekim:
          root?.hekim ||
          root?.isyeriHekimi ||
          root?.hekimImza ||
          { imza: null, paraf: null },

        isveren:
          root?.isveren ||
          root?.isverenVekili ||
          root?.isveren_vekili ||
          root?.isverenVekiliImza ||
          { imza: null, paraf: null },
      };
    } catch {}
  }

  return {};
}

async function createDestekAcilEgitimKatilimFormuPdf(payload = {}) {
  const templatePath = resolveTemplatePath();
  if (!fs.existsSync(templatePath)) {
    throw new Error("Template bulunamadı: " + templatePath);
  }

  let html = fs.readFileSync(templatePath, "utf8");

  const extraCss = `
    <style>
      .personelImzaBox {
        width: 150px;
        height: 52px;
        margin: 0 auto;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }

      .personelImzaImg {
        width: 150px;
        height: 52px;
        object-fit: contain;
        object-position: center center;
        display: block;
      }

      .rolImzaWrap {
        width: 180px;
        height: 78px;
        margin: 0 auto;
        position: relative;
        overflow: hidden;
      }

      .kaseBlock {
        position: absolute;
        left: 0;
        right: 0;
        top: 36;
        width: 100%;
        text-align: center;
        line-height: 1.02;
        z-index: 1;
      }

      .kaseLine {
        font-weight: 700;
        color: rgba(29, 78, 216, 0.58);
        font-family: Arial, Helvetica, sans-serif;
      }

      .kaseName {
        font-size: 11px;
      }

      .kaseTitle {
        font-size: 8px;
      }

      .kaseCert {
        font-size: 8px;
      }

      .rolImzaImg {
        position: absolute;
        left: 50%;
        bottom: 30px;
        transform: translateX(-50%);
        width: 170px;
        height: 62px;
        object-fit: contain;
        object-position: center center;
        display: block;
        z-index: 2;
      }
    </style>
  `;

  if (html.includes("</head>")) {
    html = html.replace("</head>", `${extraCss}</head>`);
  } else {
    html = extraCss + html;
  }

  const firmaAdi = esc(payload?.firma?.firmaAdi || "");
  const egitimSaat = esc(String(payload?.egitim?.saat || "2"));

  const egitimTarih = esc(
    formatDateTR(payload?.egitim?.tarihTR || payload?.egitim?.tarihISO)
  );

  const isgUzmaniAdSoyad = esc(
    getOnlyDisplayName(
      payload?.kisiler?.uzmanAdSoyad || payload?.kisiler?.uzman || ""
    )
  );

  const isyeriHekimiAdSoyad = esc(
    getOnlyDisplayName(
      payload?.kisiler?.hekimAdSoyad || payload?.kisiler?.hekim || ""
    )
  );

  const isverenAdSoyad = esc(
    getOnlyDisplayName(
      payload?.kisiler?.isverenAdSoyad ||
      payload?.kisiler?.isveren ||
      payload?.kisiler?.isverenVekili ||
      ""
    )
  );

  const konular = [
    "Acil Durum Planı'nın içeriği",
    "Destek Elemanları/Acil Durum Ekiplerinin Görev ve Sorumlulukları",
    "İşyeri Tahliye Planı ve Kaçış Yolları ile Toplanma Yerleri",
    "Söndürme Ekibinin Görevleri",
    "Kurtarma Ekibinin görevleri",
    "Koruma Ekibinin Görevleri",
    "İlk Yardım Ekibinin Görevleri",
    "Yangından Korunma Prensipleri",
    "Yangın Söndürme Teknikleri",
    "İşyerini Dışarıdan Etkileyebilecek Durumlar",
    "Doğal Afetler (Deprem, Sel, Su Baskını), Sabotaj, Savaş ve Seferberlik gibi Durumlarda Yapılacaklar",
    "İş Kazalarında, Parlama Patlamalarda, Gıda Zehirlenmelerinde, Bulaşıcı Hastalıklarda Yapılacaklar",
    "Mevzuata Göre Acil Durumlar",
    "Tehlikeli kimyasal, biyolojik, radyoaktif ve nükleer maddelerden kaynaklanan yayılım, zehirlenme ve salgın hastalık ihtimali",
    "* İlk yardım ekibindeki destek elemanlarının alacağı ilk yardımcı eğitimlerinin ilk yardım yönetmeliği esaslarınca alınması sağlanır.",
  ];

  const egitimKonulariText = konular
    .map((k, i) => {
      const prefix = String.fromCharCode(97 + (i % 26));
      const raw = String(k || "");
      const line = raw.trim().startsWith("*") ? `<i>${esc(raw)}</i>` : esc(raw);
      return `${prefix}) ${line}`;
    })
    .join("<br/>");

  const firmaImzalari = await fetchFirmaImzalari(payload);

  let uzmanImza = getRoleSignatureDataUrl(
    payload?.imzalar?.uzman ||
    payload?.imzalar?.isgUzmani ||
    {}
  );
  if (!uzmanImza) {
    uzmanImza = getRoleSignatureDataUrl(firmaImzalari?.uzman);
  }

  let hekimImza = getRoleSignatureDataUrl(
    payload?.imzalar?.hekim ||
    payload?.imzalar?.isyeriHekimi ||
    {}
  );
  if (!hekimImza) {
    hekimImza = getRoleSignatureDataUrl(firmaImzalari?.hekim);
  }

  let isverenImza = getRoleSignatureDataUrl(
    payload?.imzalar?.isveren ||
    payload?.imzalar?.isverenVekili ||
    {}
  );
  if (!isverenImza) {
    isverenImza = getRoleSignatureDataUrl(firmaImzalari?.isveren);
  }

  const uzmanStamp = buildUzmanStampData(payload);
  const hekimStamp = buildHekimStampData(payload);

  const list = Array.isArray(payload?.katilimcilar) ? payload.katilimcilar : [];
  const rowsHtml = list
    .map((k, idx) => {
      const tc = esc(normalizeTC(k.tc || ""));
      const adSoyad = esc((k.adSoyad || "").toString());
      const gorev = esc((k.gorev || "").toString());

      const personelImza = getPersonelSignatureDataUrl(k);
      const personelImzaHtml = buildPersonelImzaHtml(personelImza);

      return `
        <tr>
          <td class="center">${idx + 1}</td>
          <td class="center">${tc}</td>
          <td class="center">${adSoyad}</td>
          <td class="center">${gorev}</td>
          <td class="center">${personelImzaHtml}</td>
        </tr>
      `;
    })
    .join("");

  const uzmanImzaHtml = buildRoleImzaHtml(uzmanImza, uzmanStamp);
  const hekimImzaHtml = buildRoleImzaHtml(hekimImza, hekimStamp);
  const isverenImzaHtml = buildRoleImzaHtml(isverenImza, null);

  html = html
    .split("{{logoSrc}}").join(await resolveLogoSrc(payload))
    .split("{{firmaAdi}}").join(firmaAdi)
    .split("{{egitimSaat}}").join(egitimSaat)
    .split("{{EGITIM_TARIH}}").join(egitimTarih)
    .split("{{EGITIM_KONULARI_TEXT}}").join(egitimKonulariText)
    .split("{{KATILIMCI_ROWS}}").join(rowsHtml || "")
    .split("{{isgUzmaniAdSoyad}}").join(isgUzmaniAdSoyad)
    .split("{{isyeriHekimiAdSoyad}}").join(isyeriHekimiAdSoyad)
    .split("{{isverenAdSoyad}}").join(isverenAdSoyad)
    .split("{{UZMAN_IMZA}}").join(uzmanImzaHtml)
    .split("{{HEKIM_IMZA}}").join(hekimImzaHtml)
    .split("{{ISVEREN_IMZA}}").join(isverenImzaHtml);

  html = html.replace(/{{\s*[^}]+\s*}}/g, "");

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

const fileName = `destek-acil-egitim-katilim-${Date.now()}.pdf`;
const filePath = path.join(outputDir, fileName);

fs.writeFileSync(filePath, pdfBuffer);

return filePath;
}

module.exports = createDestekAcilEgitimKatilimFormuPdf;