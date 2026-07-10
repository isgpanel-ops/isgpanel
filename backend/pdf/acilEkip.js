// backend/pdf/acilEkip.js
const fs = require("fs");
const path = require("path");
const pdf = require("html-pdf-node");
const axios = require("axios");

// -------------------------
// yardımcılar
// -------------------------
function safeRead(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

function fillVars(tpl, data) {
  return tpl.replace(/{{\s*([^}]+)\s*}}/g, (_, key) => {
    const parts = String(key)
      .split(".")
      .map((x) => x.trim())
      .filter(Boolean);

    let cur = data;
    for (const p of parts) {
      if (!cur || typeof cur !== "object") return "";
      cur = cur[p];
    }
    return cur == null ? "" : String(cur);
  });
}

function pickFirstExistingDir(dirs) {
  for (const d of dirs) {
    try {
      if (fs.existsSync(d) && fs.statSync(d).isDirectory()) return d;
    } catch {}
  }
  return null;
}

function pickFirstExistingFile(files) {
  for (const f of files) {
    try {
      if (fs.existsSync(f) && fs.statSync(f).isFile()) return f;
    } catch {}
  }
  return null;
}

function normTr(s) {
  return String(s || "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

function firstNonEmpty(...vals) {
  for (const v of vals) {
    const s = String(v || "").trim();
    if (s) return s;
  }
  return "";
}

function extractSignatureCandidate(obj = {}) {
  if (!obj || typeof obj !== "object") return "";

  return firstNonEmpty(
    obj?.imza?.dataUrl,
    obj?.imza?.url,
    obj?.imza?.value,
    obj?.imza?.base64,
    obj?.imza,
    obj?.paraf?.dataUrl,
    obj?.signature?.dataUrl,
    obj?.signature?.url,
    obj?.signature?.value,
    obj?.signature?.base64,
    obj?.signature,
    obj?.dataUrl,
    obj?.url,
    obj?.value,
    obj?.base64,
    obj?.image,
    obj?.imageUrl,
    obj?.imzaUrl,
    obj?.signedImage,
    obj?.src
  );
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
  return normalizeImageToDataUri(extractSignatureCandidate(roleRecord));
}

async function fetchFirmaImzalari(pdfData = {}) {
  const firmaId =
    pdfData?.firmaId ||
    pdfData?.firma?._id ||
    pdfData?.firma?.id ||
    "";

  if (!firmaId) {
    console.log("[ACIL_EKIP] firmaId bulunamadı");
    return {};
  }

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
    pdfData?.authToken ||
    pdfData?.token ||
    pdfData?.accessToken ||
    "";

  const headers = {};
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const urls = [
    `${apiBase}/api/firma/${firmaId}/imzalar`,
    `${apiBase}/firma/${firmaId}/imzalar`,
  ];

  for (const url of urls) {
    try {
      console.log("[ACIL_EKIP] firma imza endpoint deneniyor:", url);

      const res = await axios.get(url, {
        headers,
        timeout: 15000,
        validateStatus: () => true,
      });

      console.log("[ACIL_EKIP] firma imza endpoint status:", res.status);

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

      console.log(
        "[ACIL_EKIP] firma imza root keys:",
        Object.keys(root || {})
      );

      return {
        raw: root,
        isveren:
          root?.isveren ||
          root?.isverenVekili ||
          root?.isveren_vekili ||
          root?.isverenVekiliImza ||
          root?.isverenImza ||
          root?.imzaYetkilisi ||
          root?.yetkili ||
          null,

        isverenVekili:
          root?.isverenVekili ||
          root?.isveren_vekili ||
          root?.isverenVekiliImza ||
          root?.yetkili ||
          null,
      };
    } catch (err) {
      console.log(
        "[ACIL_EKIP] firma imza endpoint hata:",
        url,
        err?.message || err
      );
    }
  }

  return {};
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

function groupTeams(list = []) {
  const out = {
    yangin: [],
    kurtarma: [],
    koruma: [],
    ilkyardim: [],
    diger: [],
  };

  for (const p of list || []) {
    const ekip = normTr(p.ekip || p.ekipAdi || "");

    if (ekip.includes("yang")) out.yangin.push(p);
    else if (ekip.includes("kurt") || ekip.includes("tah")) out.kurtarma.push(p);
    else if (
      ekip.includes("koru") ||
      ekip.includes("guv") ||
      ekip.includes("guven")
    ) {
      out.koruma.push(p);
    } else if (ekip.includes("ilk")) {
      out.ilkyardim.push(p);
    } else {
      out.diger.push(p);
    }
  }

  return out;
}

function buildRows(list = []) {
  let i = 1;

  return (list || [])
    .map((p) => {
      const fullName =
        p.adSoyad ||
        p.adSoyadi ||
        p.ad_soyad ||
        p.isimSoyisim ||
        p.isim_soyisim ||
        p.fullName ||
        p.nameSurname ||
        `${p.ad || p.isim || ""} ${p.soyad || p.soyIsim || p.surname || ""}`.trim();

      const adSoyad = escapeHtml((fullName || "").toUpperCase());
      const gorev = escapeHtml(
        (p.ekipGorevi || p.gorev || p.unvan || "").toUpperCase()
      );
      const tel = escapeHtml(p.telefon || p.tel || p.iletisim || p.cep || "");
      const personelImza = getPersonelSignatureDataUrl(p);

      return `
<tr>
  <td class="col-no">${i++}</td>
  <td class="col-ad">${adSoyad}</td>
  <td class="col-gorev">${gorev}</td>
  <td class="col-tel">${tel}</td>
  <td class="col-imza">
    ${
      personelImza
        ? `<div class="personel-imza-wrap"><img src="${personelImza}" alt="İmza" /></div>`
        : ""
    }
  </td>
</tr>`;
    })
    .join("");
}

// -------------------------
// PDF
// -------------------------
async function createAcilEkipPdf(pdfData = {}) {
  const appRoot = path.resolve(__dirname, "..", "..");

  const templatesDir = pickFirstExistingDir([
    path.join(appRoot, "isg_prosedur_template", "templates", "acildurum"),
    path.join(appRoot, "isg_prosedur_template", "templates"),
  ]);

  if (!templatesDir) {
    throw new Error(
      "Şablon klasörü bulunamadı. Beklenen:\n" +
        path.join(appRoot, "isg_prosedur_template", "templates", "acildurum")
    );
  }

  const templatePath = pickFirstExistingFile([
    path.join(templatesDir, "acil_ekip.html"),
    path.join(
      appRoot,
      "isg_prosedur_template",
      "templates",
      "acildurum",
      "acil_ekip.html"
    ),
  ]);

  if (!templatePath) {
    throw new Error("acil_ekip.html bulunamadı. Aranan klasör: " + templatesDir);
  }

  const template = safeRead(templatePath);
  if (!template.trim()) {
    throw new Error("acil_ekip.html boş/okunamadı: " + templatePath);
  }

  const data = pdfData && typeof pdfData === "object" ? pdfData : {};

  data.firma = data.firma || {};
  data.tarihler = data.tarihler || {};
  data.kurumsal = data.kurumsal || {};
  data.oneriler = data.oneriler || {};
  data.acilEkip = data.acilEkip || {};
  data.kisiler = data.kisiler || {};
  data.isveren = data.isveren || {};
  data.imzalar = data.imzalar || {};

  data.isveren.adSoyad =
    data.isveren.adSoyad ||
    data.kisiler.isveren ||
    data.kisiler.isverenAdSoyad ||
    data.kisiler.isverenVekili ||
    data.firma.isverenAdSoyad ||
    "";

  let isverenImza =
    getRoleSignatureDataUrl(data?.imzalar?.isveren) ||
    getRoleSignatureDataUrl(data?.imzalar?.isverenVekili) ||
    normalizeImageToDataUri(data?.isveren?.imza) ||
    normalizeImageToDataUri(data?.isveren?.imzaDataUrl) ||
    normalizeImageToDataUri(data?.kisiler?.isverenImza) ||
    normalizeImageToDataUri(data?.kisiler?.isverenVekiliImza);

  console.log("[ACIL_EKIP] payload isveren imza var mı:", !!isverenImza);
  console.log(
    "[ACIL_EKIP] payload isveren imza önizleme:",
    isverenImza ? String(isverenImza).slice(0, 120) : "YOK"
  );

  if (!isverenImza) {
    const firmaImzalari = await fetchFirmaImzalari(data);

    console.log(
      "[ACIL_EKIP] firmaImzalari tam veri:",
      JSON.stringify(firmaImzalari || {}, null, 2)
    );

    isverenImza =
      getRoleSignatureDataUrl(firmaImzalari?.isveren) ||
      getRoleSignatureDataUrl(firmaImzalari?.isverenVekili) ||
      getRoleSignatureDataUrl(firmaImzalari?.raw?.isveren) ||
      getRoleSignatureDataUrl(firmaImzalari?.raw?.isverenVekili) ||
      getRoleSignatureDataUrl(firmaImzalari?.raw?.isveren_vekili) ||
      getRoleSignatureDataUrl(firmaImzalari?.raw?.isverenImza) ||
      getRoleSignatureDataUrl(firmaImzalari?.raw?.isverenVekiliImza) ||
      getRoleSignatureDataUrl(firmaImzalari?.raw?.imzaYetkilisi) ||
      getRoleSignatureDataUrl(firmaImzalari?.raw?.yetkili) ||
      normalizeImageToDataUri(firmaImzalari?.isveren?.imzaDataUrl) ||
      normalizeImageToDataUri(firmaImzalari?.isverenVekili?.imzaDataUrl) ||
      normalizeImageToDataUri(firmaImzalari?.isveren?.dataUrl) ||
      normalizeImageToDataUri(firmaImzalari?.isverenVekili?.dataUrl) ||
      normalizeImageToDataUri(firmaImzalari?.raw?.isveren?.dataUrl) ||
      normalizeImageToDataUri(firmaImzalari?.raw?.isverenVekili?.dataUrl) ||
      normalizeImageToDataUri(firmaImzalari?.raw?.isveren_vekili?.dataUrl) ||
      normalizeImageToDataUri(firmaImzalari?.raw?.isverenImza) ||
      normalizeImageToDataUri(firmaImzalari?.raw?.isverenVekiliImza) ||
      normalizeImageToDataUri(firmaImzalari?.raw?.imzaYetkilisi) ||
      normalizeImageToDataUri(firmaImzalari?.raw?.yetkili);

    console.log("[ACIL_EKIP] firmadan gelen isveren imza var mı:", !!isverenImza);
    console.log(
      "[ACIL_EKIP] firmadan gelen isveren imza önizleme:",
      isverenImza ? String(isverenImza).slice(0, 120) : "YOK"
    );
  }

  const normalizedIsverenImza = normalizeImageToDataUri(isverenImza);

  console.log(
    "[ACIL_EKIP] isverenImza raw:",
    isverenImza ? String(isverenImza).slice(0, 150) : "YOK"
  );
  console.log(
    "[ACIL_EKIP] normalizedIsverenImza:",
    normalizedIsverenImza ? String(normalizedIsverenImza).slice(0, 150) : "YOK"
  );

  data.isveren.imzaHtml = normalizedIsverenImza
    ? `<img src="${normalizedIsverenImza}" alt="İşveren İmza" />`
    : "";

  console.log("[ACIL_EKIP] data.isveren.adSoyad:", data.isveren.adSoyad || "YOK");
  console.log(
    "[ACIL_EKIP] data.isveren.imzaHtml dolu mu:",
    !!data.isveren.imzaHtml
  );

  const teams = Array.isArray(data?.acilEkip?.teams)
    ? data.acilEkip.teams
    : Array.isArray(data?.ekipler)
    ? data.ekipler
    : [];

  const g = groupTeams(teams);

  data.acilEkip.yanginRows = buildRows(g.yangin);
  data.acilEkip.kurtarmaRows = buildRows(g.kurtarma);
  data.acilEkip.korumaRows = buildRows(g.koruma);
  data.acilEkip.ilkyardimRows = buildRows(g.ilkyardim);

  data.acilEkip.yanginOneri =
    data.acilEkip.yanginOneri ?? data.oneriler.yangin ?? "";
  data.acilEkip.kurtarmaOneri =
    data.acilEkip.kurtarmaOneri ?? data.oneriler.kurtarma ?? "";
  data.acilEkip.korumaOneri =
    data.acilEkip.korumaOneri ?? data.oneriler.koruma ?? "";
  data.acilEkip.ilkyardimOneri =
    data.acilEkip.ilkyardimOneri ?? data.oneriler.ilkyardim ?? "";

  let html = fillVars(template, data);

  const isDemoUser = pdfData?.__isDemoUser === true || pdfData?.demo === true;

  if (isDemoUser) {
    html = injectDemoWatermark(html);
  }

  const options = {
    format: "A4",
    printBackground: true,
    margin: {
      top: "0mm",
      right: "0mm",
      bottom: "0mm",
      left: "0mm",
    },
    preferCSSPageSize: true,
  };

  const pdfBuffer = await pdf.generatePdf({ content: html }, options);

const outputDir = path.join(appRoot, "output");
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const fileName = `acil-ekip-${Date.now()}.pdf`;
const filePath = path.join(outputDir, fileName);

fs.writeFileSync(filePath, pdfBuffer);

return filePath;
}

module.exports = createAcilEkipPdf;