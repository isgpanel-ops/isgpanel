const fs = require("fs");
const path = require("path");
const Handlebars = require("handlebars");
const { htmlFileToPdf } = require("./riskdegerlendirmesi.playwright");

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function safeName(value) {
  return String(value || "firma")
    .replace(/[^\w\d-_]+/g, "_")
    .slice(0, 40);
}

function asText(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  if (value === null || value === undefined) return "";
  return String(value);
}

function riskClass(value) {
  const n = Number(value);
  if (n >= 16) return "risk-high";
  if (n >= 12) return "risk-medium";
  if (n >= 6) return "risk-low";
  return "";
}

function buildPages(rows = [], startPageNo = 1, pageSize = 12) {
  const cleanRows = Array.isArray(rows) ? rows : [];
  const pages = [];

  for (let i = 0; i < cleanRows.length; i += pageSize) {
    const pageRows = cleanRows.slice(i, i + pageSize);

    pages.push({
      pageNo: Number(startPageNo || 1) + pages.length,
      rows: pageRows.map((r, idx) => ({
        no: r.no || i + idx + 1,
        bolum: asText(r.bolum),
        faaliyet: asText(r.faaliyet),
        tehlike: asText(r.tehlike),
        risk: asText(r.risk),
        sonuc: asText(r.sonuc),
        etkiAlaniText: asText(r.etkiAlani || r.etkiAlaniText),
        olasilik: asText(r.olasilik),
        siddet: asText(r.siddet),
        rds: asText(r.rds),
        rdsClass: riskClass(r.rds),
        riskTanimi: asText(r.riskTanimi),
        onlem: asText(r.onlem || r.onlemler),
        mevcutDurumText: asText(r.mevcutDurum || r.mevcutDurumText),
        sorumluText: asText(r.sorumlu || r.sorumluText),
        termin: asText(r.termin),
        sonO: asText(r.sonO || r.olasilikSon),
        sonS: asText(r.sonS || r.siddetSon),
        sonRds: asText(r.sonRds || r.rdsSon),
        sonRdsClass: riskClass(r.sonRds || r.rdsSon),
      })),
    });
  }

  if (!pages.length) {
    pages.push({
      pageNo: Number(startPageNo || 1),
      rows: [],
    });
  }

  return pages;
}

function buildHtmlFromPayload(payload = {}) {
  const templatePath = path.join(
    process.cwd(),
    "isg_prosedur_template",
    "templates",
    "riskdegerlendirmesi",
    "riskdegerlendirmesi.html"
  );

  const htmlRaw = fs.readFileSync(templatePath, "utf8");
  const compile = Handlebars.compile(htmlRaw);

  const data = {
    firmaAdi: asText(payload.firmaAdi || payload.firma?.firmaAdi),
    kurumsalLogo: asText(payload.logoUrl || payload.logo || payload.kurumsalLogo),
    hazirlamaTarihi: asText(
      payload.hazirlamaTarihi ||
        payload.hazirlama ||
        new Date().toLocaleDateString("tr-TR")
    ),
    gecerlilikTarihi: asText(payload.gecerlilikTarihi || payload.gecerlilik),
    revizyonNo: asText(payload.revNo || payload.revizyonNo),
    tehlikeSinifi: asText(payload.tehlikeSinifi || payload.tehlike),
    sgkSicilNo: asText(payload.sgkSicilNo),

    imzaKisileri6: Array.isArray(payload.imzaKisileri6)
      ? payload.imzaKisileri6
      : [],

    pages: buildPages(payload.rows, payload.pageNo || 1, payload.pageSize || 12),
  };

  return compile(data);
}

async function createRiskDegerlendirmesiPdf(payload = {}) {
  const outDir = path.join(process.cwd(), "backend", "pdf", "output");
  ensureDir(outDir);

  const firma = safeName(payload.firmaAdi);
  const stamp = Date.now();

  const htmlPath = path.join(outDir, `risk_${firma}_${stamp}.html`);
  const pdfPath = path.join(outDir, `risk_${firma}_${stamp}.pdf`);

  const html = buildHtmlFromPayload(payload);

  if (!html || typeof html !== "string") {
    throw new Error("Risk HTML üretilemedi: buildHtmlFromPayload boş döndü");
  }

  fs.writeFileSync(htmlPath, html, "utf8");

  await htmlFileToPdf(htmlPath, pdfPath, payload);

  return pdfPath;
}

module.exports = createRiskDegerlendirmesiPdf;