const path = require("path");
const fs = require("fs");
const Handlebars = require("handlebars");
const html_to_pdf = require("html-pdf-node");
const archiver = require("archiver");

/* =========================
   HELPERS
========================= */
const safe = (v) => (v ?? "").toString().trim();
const normalizeTC = (v) => safe(v).replace(/\D/g, "").slice(0, 11);

function toAsciiFileName(input = "") {
  return String(input)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/İ/g, "I")
    .replace(/ğ/g, "g")
    .replace(/Ğ/g, "G")
    .replace(/ş/g, "s")
    .replace(/Ş/g, "S")
    .replace(/ç/g, "c")
    .replace(/Ç/g, "C")
    .replace(/ö/g, "o")
    .replace(/Ö/g, "O")
    .replace(/ü/g, "u")
    .replace(/Ü/g, "U")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 180);
}

function safeContentDisposition(fileName) {
  return `attachment; filename="${toAsciiFileName(fileName || "dosya.pdf")}"`;
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

function isDemoMode(payload = {}) {
  if (payload?.demo === true) return true;
  if (payload?.__isDemoUser === true) return true;
  if (payload?.isDemo === true) return true;
  return String(process.env.DEMO_MODE || "").toLowerCase() === "true";
}

function buildLogoSrc(payload) {
  const k = payload?.kurumsal || {};
  const lb64 = safe(k.logoBase64 || k.logo || "");
  if (lb64.startsWith("data:image")) return lb64;

  const abs = safe(k.logoUrlAbs || "");
  if (abs) return abs;

  const url = safe(k.logoUrl || "");
  if (url) return url;

  return "";
}

function formatDateTR(value) {
  const raw = safe(value);
  if (!raw) return "";

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[3]}.${iso[2]}.${iso[1]}`;

  const dot = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (dot) return raw;

  const dt = new Date(raw);
  if (!Number.isNaN(dt.getTime())) {
    return dt.toLocaleDateString("tr-TR");
  }

  return raw;
}

function formatDateSlashTR(value) {
  return formatDateTR(value).replace(/\./g, "/");
}

function ensureDirSync(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function getPublicBaseUrl(req) {
  const envBase =
    safe(process.env.PUBLIC_BASE_URL) ||
    safe(process.env.APP_BASE_URL) ||
    safe(process.env.API_PUBLIC_URL) ||
    safe(process.env.BACKEND_PUBLIC_URL);

  if (envBase) return envBase.replace(/\/+$/, "");

  const protoHeader = safe(req.headers["x-forwarded-proto"]);
  const hostHeader = safe(req.headers["x-forwarded-host"]);
  const protocol =
    protoHeader ||
    req.protocol ||
    (req.secure ? "https" : "http");
  const host = hostHeader || req.get("host") || "";

  return `${protocol}://${host}`.replace(/\/+$/, "");
}

function writePersistedPdf(req, pdfBuffer, fileName) {
  const uploadsRoot = path.join(__dirname, "..", "..", "uploads");
  const targetDir = path.join(uploadsRoot, "kkd");
  ensureDirSync(targetDir);

  const cleanName = toAsciiFileName(fileName || `kkd_${Date.now()}.pdf`);
  const stampedName = `${Date.now()}_${cleanName}`;
  const absFilePath = path.join(targetDir, stampedName);

  fs.writeFileSync(absFilePath, pdfBuffer);

  const fileUrl = `/uploads/kkd/${stampedName}`;
  const absoluteUrl = `${getPublicBaseUrl(req)}${fileUrl}`;

  return {
    fileName: stampedName,
    filePath: absFilePath,
    fileUrl,
    absoluteUrl,
  };
}

/* =========================
   SABİT MALZEME LİSTESİ
========================= */
function getDefaultRows() {
  return [
    { no: 1, malzeme: "İŞ AYAKKABISI", standart: "TS EN ISO 20345-S3" },
    { no: 2, malzeme: "BARET", standart: "TS EN 397" },
    { no: 3, malzeme: "PARAŞÜT TİPİ EMNİYET KEMERİ", standart: "TS EN 361-358 CE0123" },
    { no: 4, malzeme: "PARÇA VE ÇAPAK GÖZLÜĞÜ (BUĞULANMAYAN)", standart: "TS EN 166" },
    { no: 5, malzeme: "İŞ ELDİVENİ SOĞUK", standart: "TS EN 388 / TS EN 511" },
    { no: 6, malzeme: "İŞ BOTU", standart: "TS EN ISO 20345-S3" },
    { no: 7, malzeme: "İŞ ELBİSESİ", standart: "TS EN 340, TS EN 373 TS EN 531, TS EN 532" },
    { no: 8, malzeme: "GENEL AMAÇLI NİTRİL ELDİVEN", standart: "TS EN 420" },
    { no: 9, malzeme: "İŞ ELDİVENİ (MAKANİK KORUMA)", standart: "TS 7305 EN 388" },
    { no: 10, malzeme: "ELEKTRİK ELDİVENİ", standart: "TS EN 50237" },
    { no: 11, malzeme: "KULAK KORUYUCULAR", standart: "TS EN 352-1/2/3" },
    { no: 12, malzeme: "MASKELER YARIM YÜZ VE ÇEYREK", standart: "TS EN 140-141-143-149-405" },
    { no: 13, malzeme: "REFLEKTÖRLÜ YELEK", standart: "" },
    { no: 14, malzeme: "GÜNLÜK CERRAHİ MASKE", standart: "TS EN 14683" },
    {
      no: 15,
      malzeme:
        "KAYNAKÇI ELDİVENİ, KAYNAK MASKESİ-GÖZLÜĞÜ, KAYNAK ÖNLÜĞÜ, ELBİSESİ-KOLLUĞU, TOZLUK",
      standart: "TS EN 12477/A1, EN 421, TS 6860 EN 175, EN 169",
    },
  ];
}

function normalizeNameKey(value) {
  return safe(value)
    .toLocaleUpperCase("tr-TR")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeRowNo(value) {
  const n = Number(String(value ?? "").replace(/[^\d]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function buildItemsMaps(payload) {
  const raw =
    payload?.kkd?.items ||
    payload?.items ||
    payload?.personel?.kkdItems ||
    [];

  const baseRows = getDefaultRows();
  const byNo = new Map();
  const byName = new Map();

  for (const item of raw) {
    const rowNo =
      normalizeRowNo(item?.no) ??
      normalizeRowNo(item?.siraNo) ??
      normalizeRowNo(item?.id);

    const normalized = {
      selected: !!item?.selected,
      adet: item?.selected ? safe(item?.adet || "1") : "",
    };

    if (rowNo) {
      byNo.set(rowNo, normalized);

      const matchedRow = baseRows.find((r) => Number(r.no) === Number(rowNo));
      if (matchedRow?.malzeme) {
        byName.set(normalizeNameKey(matchedRow.malzeme), normalized);
      }
    }

    const ad = normalizeNameKey(item?.ad);
    if (ad) {
      byName.set(ad, normalized);
    }
  }

  return { byNo, byName };
}

function buildRows(payload) {
  const baseRows = getDefaultRows();
  const { byNo, byName } = buildItemsMaps(payload);

  const personelImza =
    payload?.personel?.imzalar?.genel?.dataUrl ||
    payload?.personel?.personelImzalari?.personel ||
    payload?.personel?.personelImzasi ||
    payload?.personelImza ||
    "";

  return baseRows.map((row) => {
    const found =
      byNo.get(Number(row.no)) ||
      byName.get(normalizeNameKey(row.malzeme));

    const secili = !!found?.selected;

    return {
      ...row,
      adet: secili ? safe(found?.adet || "1") : "",
      imzaSrc: secili && personelImza ? personelImza : "",
    };
  });
}

/* =========================
   TEMPLATE
========================= */
function getTemplateHtml() {
  const tplPath = path.join(
    __dirname,
    "..",
    "..",
    "isg_prosedur_template",
    "templates",
    "talimat",
    "kkd_teslim_tutanagi.html"
  );

  if (!fs.existsSync(tplPath)) {
    throw new Error(`kkd_teslim_tutanagi.html bulunamadı: ${tplPath}`);
  }

  return fs.readFileSync(tplPath, "utf-8");
}

/* =========================
   TEMPLATE DATA
========================= */
function buildTemplateData(payload) {
  const firmaAdi =
    safe(payload?.firma?.firmaAdi) ||
    safe(payload?.kurumsal?.firmaAdi) ||
    "Firma";

  const personelAdSoyad = safe(payload?.personel?.adSoyad).toLocaleUpperCase("tr-TR");
  const personelTc = normalizeTC(payload?.personel?.tc);
  const tarihRaw =
    payload?.kkd?.tarih ||
    payload?.talimat?.tarihTR ||
    payload?.talimat?.tarih ||
    payload?.egitim?.bitisTR ||
    payload?.egitim?.bitisISO ||
    payload?.personel?.bitisTarihi ||
    payload?.tarih ||
    "";

  const tarihTR = formatDateTR(tarihRaw);
  const tarihSlash = formatDateSlashTR(tarihRaw);

  const isverenAdSoyad =
    safe(payload?.kisiler?.isveren) ||
    safe(payload?.isveren?.adSoyad) ||
    "";

  const isverenImza =
    payload?.imzalar?.isveren?.imza?.dataUrl ||
    payload?.imzalar?.isveren?.dataUrl ||
    payload?.isverenImza ||
    "";

  const personelImza =
    payload?.personel?.imzalar?.genel?.dataUrl ||
    payload?.personel?.personelImzalari?.personel ||
    payload?.personel?.personelImzasi ||
    payload?.personelImza ||
    "";

  return {
    logoSrc: buildLogoSrc(payload),

    firmaAdi,
    teslimAldimFirmaAdi: firmaAdi,
    teslimAldimTarih: tarihSlash || tarihTR,

    personelAdSoyad: personelAdSoyad || "-",
    personelTc: personelTc || "-",
    tarihTR: tarihTR || "-",

    isverenAdSoyad: isverenAdSoyad || "-",
    isverenImza,

    teslimAlanAdSoyad: personelAdSoyad || "-",
    teslimAlanTc: personelTc || "-",
    teslimAlanImza: personelImza,

    rows: buildRows(payload),
  };
}

/* =========================
   PDF RENDER
========================= */
async function renderPdfBuffer(payload) {
  const tpl = getTemplateHtml();
  let html = Handlebars.compile(tpl)(buildTemplateData(payload));

  if (isDemoMode(payload)) {
    html = injectDemoWatermark(html);
  }

  const file = { content: html };
  const options = {
    format: "A4",
    printBackground: true,
    margin: {
      top: "8mm",
      right: "8mm",
      bottom: "8mm",
      left: "8mm",
    },
  };

  return await html_to_pdf.generatePdf(file, options);
}

/* =========================
   TEKLİ PDF / PERSIST
========================= */
async function kkdTeslimTutanagiPdf(req, res) {
  try {
    const payload = req.body || {};
    const firmaAdi = payload?.firma?.firmaAdi || "firma";
    const adSoyad = payload?.personel?.adSoyad || "personel";

    const pdfBuffer = await renderPdfBuffer(payload);
    const filename = `${firmaAdi}_${adSoyad}_kkd_teslim_tutanagi.pdf`;

    if (payload?.persist === true) {
      const saved = writePersistedPdf(req, pdfBuffer, filename);

      return res.json({
        ok: true,
        persisted: true,
        fileName: saved.fileName,
        fileUrl: saved.fileUrl,
        absoluteUrl: saved.absoluteUrl,
      });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", safeContentDisposition(filename));
    return res.send(pdfBuffer);
  } catch (e) {
    console.error("kkdTeslimTutanagiPdf hata:", e);
    return res.status(500).json({ ok: false, message: e.message });
  }
}

/* =========================
   TOPLU ZIP
========================= */
async function kkdTeslimTutanagiPdfBulk(req, res) {
  try {
    const items = req.body?.items || [];
    if (!items.length) return res.status(400).send("items boş");

    const firmaAdi = req.body?.firma?.firmaAdi || "firma";
    const zipName = `${firmaAdi}_kkd_tutanaklari.zip`;

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", safeContentDisposition(zipName));

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => {
      console.error("KKD zip hata:", err);
      try {
        res.status(500).end();
      } catch {}
    });

    archive.pipe(res);

    for (let i = 0; i < items.length; i++) {
      const payload = items[i] || {};
      const pdf = await renderPdfBuffer(payload);
      const ad = payload?.personel?.adSoyad || `personel_${i + 1}`;
      archive.append(pdf, {
        name: `${toAsciiFileName(ad)}_kkd_teslim_tutanagi.pdf`,
      });
    }

    await archive.finalize();
  } catch (e) {
    console.error("kkdTeslimTutanagiPdfBulk hata:", e);
    return res.status(500).send("KKD ZIP üretilemedi");
  }
}

module.exports = {
  kkdTeslimTutanagiPdf,
  kkdTeslimTutanagiPdfBulk,
};