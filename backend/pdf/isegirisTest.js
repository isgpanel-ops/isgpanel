const fs = require("fs");
const path = require("path");
const pdf = require("html-pdf-node");
const axios = require("axios");

const OUT_DIR = path.join(__dirname, "..", "temp_pdfs");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const TRANSPARENT_1PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO6qK3cAAAAASUVORK5CYII=";

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

function findProjectRoot() {
  const candidates = [
    path.resolve(__dirname, "..", ".."),
    path.resolve(__dirname, ".."),
    path.resolve(process.cwd()),
    "/var/www",
  ];

  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "isg_prosedur_template"))) {
      return dir;
    }
  }

  return "/var/www";
}

function templatePath() {
  return path.join(
    findProjectRoot(),
    "isg_prosedur_template",
    "templates",
    "egitim",
    "iseGirisTestFormu.html"
  );
}

function replaceAllMap(html, map) {
  Object.keys(map).forEach((k) => {
    html = html.split(k).join(map[k]);
  });
  return html;
}

function getPersonelTekImza(row) {
  const val =
    row?.personelImzasi ||
    row?.personelTekImza ||
    row?.imzalar?.personel?.dataUrl ||
    row?.imzalar?.genel?.dataUrl ||
    row?.imzalar?.teknik?.dataUrl ||
    row?.imzalar?.saglik?.dataUrl ||
    row?.imzalar?.iseOzelRiskler?.dataUrl ||
    row?.personelImzalari?.personel ||
    row?.personelImzalari?.genel ||
    row?.personelImzalari?.teknik ||
    row?.personelImzalari?.saglik ||
    row?.personelImzalari?.iseOzelRiskler ||
    "";

  return normalizeImageToDataUri(val);
}

function getTestSorulari(payload) {
  return Array.isArray(payload?.testSorulari) ? payload.testSorulari : [];
}

function getTestSonucu(personel, payload) {
  const p = parseMaybeJson(personel) || {};
  const pl = parseMaybeJson(payload) || {};
  const pp = parseMaybeJson(pl?.payload) || {};
  const kp0 = parseMaybeJson(pl?.katilimcilar?.[0]) || {};
  const ppkp0 = parseMaybeJson(pp?.katilimcilar?.[0]) || {};

  const candidates = [
    p?.testSonucu,
    kp0?.testSonucu,
    pl?.personel?.testSonucu,
    pl?.testSonucu,
    ppkp0?.testSonucu,
    pp?.personel?.testSonucu,
    pp?.testSonucu,
  ];

  const found = candidates.find(
    (x) => x && typeof x === "object" && !Array.isArray(x)
  );

  return found || {};
}

function hasAnswerData(obj) {
  if (!obj) return false;

  if (typeof obj === "string") {
    try {
      const parsed = JSON.parse(obj);
      return hasAnswerData(parsed);
    } catch {
      return false;
    }
  }

  if (Array.isArray(obj)) {
    return obj.length > 0;
  }

  return typeof obj === "object" && Object.keys(obj).length > 0;
}

function parseMaybeJson(value) {
  if (!value) return value;

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  return value;
}

function getCevaplar(personel, payload) {
  const p = parseMaybeJson(personel) || {};
  const pl = parseMaybeJson(payload) || {};
  const pp = parseMaybeJson(pl?.payload) || {};
  const kp0 = parseMaybeJson(pl?.katilimcilar?.[0]) || {};
  const ppkp0 = parseMaybeJson(pp?.katilimcilar?.[0]) || {};
  const item0 = parseMaybeJson(pl?.items?.[0]) || {};
  const itemPersonel = parseMaybeJson(item0?.personel) || {};

  const candidates = [
    p?.cevaplar,
    p?.testCevaplari,
    p?.cevapArray,
    p?.testCevapArray,
    p?.testSonucu?.cevaplar,
    p?.testSonucu?.cevapArray,
    p?.testSonucu?.testCevaplari,
    p?.testSonucu?.testCevapArray,

    pl?.cevaplar,
    pl?.testCevaplari,
    pl?.cevapArray,
    pl?.testCevapArray,
    pl?.testSonucu?.cevaplar,
    pl?.testSonucu?.cevapArray,

    pl?.personel?.cevaplar,
    pl?.personel?.testCevaplari,
    pl?.personel?.cevapArray,
    pl?.personel?.testCevapArray,
    pl?.personel?.testSonucu?.cevaplar,
    pl?.personel?.testSonucu?.cevapArray,

    kp0?.cevaplar,
    kp0?.testCevaplari,
    kp0?.cevapArray,
    kp0?.testCevapArray,
    kp0?.testSonucu?.cevaplar,
    kp0?.testSonucu?.cevapArray,

    pp?.cevaplar,
    pp?.testCevaplari,
    pp?.cevapArray,
    pp?.testCevapArray,
    pp?.testSonucu?.cevaplar,
    pp?.testSonucu?.cevapArray,

    ppkp0?.cevaplar,
    ppkp0?.testCevaplari,
    ppkp0?.cevapArray,
    ppkp0?.testCevapArray,
    ppkp0?.testSonucu?.cevaplar,
    ppkp0?.testSonucu?.cevapArray,

    itemPersonel?.cevaplar,
    itemPersonel?.testCevaplari,
    itemPersonel?.cevapArray,
    itemPersonel?.testCevapArray,
    itemPersonel?.testSonucu?.cevaplar,
    itemPersonel?.testSonucu?.cevapArray,
  ].map(parseMaybeJson);

  return candidates.find(hasAnswerData) || {};
}

function secenekHarf(index) {
  return ["A", "B", "C", "D", "E"][Number(index)] || "";
}

function normalizeGivenAnswer(value) {
  if (value === null || value === undefined || value === "") return "";

  const parsed = parseMaybeJson(value);

  if (typeof parsed === "object") {
    return (
      parsed?.cevap ??
      parsed?.answer ??
      parsed?.secenek ??
      parsed?.secenekIndex ??
      parsed?.value ??
      parsed?.index ??
      ""
    );
  }

  if (typeof parsed === "string") {
    const trimmed = parsed.trim().toUpperCase();

    if (["A", "B", "C", "D", "E"].includes(trimmed)) {
      return ["A", "B", "C", "D", "E"].indexOf(trimmed);
    }

    return trimmed;
  }

  return parsed;
}

function buildTestRows(sorular, cevaplar) {
  return sorular
    .map((soru, index) => {
     const verilenRaw =
  cevaplar?.[index] ??
  cevaplar?.[String(index)] ??
  cevaplar?.[index + 1] ??
  cevaplar?.[String(index + 1)] ??
  cevaplar?.[`soru_${index}`] ??
  cevaplar?.[`soru-${index}`] ??
  cevaplar?.[`soru_${index + 1}`] ??
  cevaplar?.[`soru-${index + 1}`];

      const verilen = normalizeGivenAnswer(verilenRaw);
      const dogru = soru?.dogru;

      const hasGiven = verilen !== "" && verilen !== null && verilen !== undefined;
      const isCorrect = hasGiven && Number(verilen) === Number(dogru);
      const puan = isCorrect ? 10 : 0;

      const options = (soru?.secenekler || [])
        .map((secenek, secIndex) => {
          const marked = hasGiven && Number(verilen) === Number(secIndex);
          const correct = Number(dogru) === Number(secIndex);

          return `
            <div class="${marked ? "marked" : ""}">
              ${secenekHarf(secIndex)}) ${safe(secenek)}
              ${marked ? " ●" : ""}
              ${correct ? " ✓" : ""}
            </div>
          `;
        })
        .join("");

      return `
        <tr>
          <td class="center bold">${index + 1}</td>
          <td class="question">${safe(soru?.soru)}</td>
          <td class="options">${options}</td>
          <td class="center bold">${hasGiven ? secenekHarf(verilen) : "-"}</td>
          <td class="center">
            ${
              isCorrect
                ? `<span class="correctIcon">✓</span>`
                : `<span class="wrongIcon">×</span>`
            }
          </td>
          <td class="center bold">${puan}</td>
        </tr>
      `;
    })
    .join("");
}

function calculateScoreFromAnswers(sorular, cevaplar, fallbackDogruSayisi = 0) {
  if (!Array.isArray(sorular) || sorular.length === 0) {
    return Number(fallbackDogruSayisi || 0);
  }

  if (!hasAnswerData(cevaplar)) {
    return Number(fallbackDogruSayisi || 0);
  }

  return sorular.reduce((total, soru, index) => {
    const verilenRaw =
  cevaplar?.[index] ??
  cevaplar?.[String(index)] ??
  cevaplar?.[index + 1] ??
  cevaplar?.[String(index + 1)] ??
  cevaplar?.[`soru_${index}`] ??
  cevaplar?.[`soru-${index}`] ??
  cevaplar?.[`soru_${index + 1}`] ??
  cevaplar?.[`soru-${index + 1}`];

    const verilen = normalizeGivenAnswer(verilenRaw);
    const hasGiven = verilen !== "" && verilen !== null && verilen !== undefined;

    return total + (hasGiven && Number(verilen) === Number(soru?.dogru) ? 1 : 0);
  }, 0);
}

async function createPdfBuffer(payload = {}) {
  const htmlPath = templatePath();

  if (!fs.existsSync(htmlPath)) {
    throw new Error(`Template bulunamadı: ${htmlPath}`);
  }

  const templateHtml = fs.readFileSync(htmlPath, "utf8");

 const personelList =
  Array.isArray(payload?.items) && payload.items.length > 0
    ? payload.items.map((item) => item?.personel || item)
    : Array.isArray(payload?.katilimcilar) && payload.katilimcilar.length > 0
    ? payload.katilimcilar
    : [payload?.personel || {}];

  const htmlPages = [];

  for (const personel of personelList) {
    let html = templateHtml;

    const kurumsal = payload?.kurumsal || {};
    const firma = payload?.firma || {};

    const logo = await resolveLogo(kurumsal, payload?.authToken);

    const sorular =
  Array.isArray(personel?.testSorulari) && personel.testSorulari.length
    ? personel.testSorulari
    : getTestSorulari(payload);

    const testSonucu = getTestSonucu(personel, payload);
const cevaplar = getCevaplar(personel, payload);


    const fallbackDogruSayisi = Number(
      testSonucu?.dogruSayisi ??
        personel?.testDogruSayisi ??
        payload?.testDogruSayisi ??
        payload?.personel?.testDogruSayisi ??
        0
    );

    const dogruSayisi = calculateScoreFromAnswers(
      sorular,
      cevaplar,
      fallbackDogruSayisi
    );

    const soruSayisi = Number(
      testSonucu?.soruSayisi ||
        personel?.testSoruSayisi ||
        payload?.testSoruSayisi ||
        payload?.personel?.testSoruSayisi ||
        sorular.length ||
        10
    );

    const yanlisSayisi = Math.max(soruSayisi - dogruSayisi, 0);
    const toplamPuan = dogruSayisi * 10;
    const basariOrani = soruSayisi
      ? Math.round((dogruSayisi / soruSayisi) * 100)
      : 0;

    const now = new Date();

    const map = {
      "%%LOGO_SRC%%": logo || TRANSPARENT_1PX,
      "%%FIRMA_ADI%%":
        safe(kurumsal?.firmaAdi) ||
        safe(firma?.firmaAdi) ||
        "",

      "%%AD_SOYAD%%": safe(personel?.adSoyad).toLocaleUpperCase("tr-TR"),
      "%%BITIS_TARIHI%%": formatDateTR(personel?.bitisTarihi || ""),
      "%%PERSONEL_IMZA%%": getPersonelTekImza(personel) || TRANSPARENT_1PX,

      "%%DOGRU_SAYISI%%": String(dogruSayisi),
      "%%YANLIS_SAYISI%%": String(yanlisSayisi),
      "%%TOPLAM_PUAN%%": String(toplamPuan),
      "%%BASARI_ORANI%%": String(basariOrani),

      "%%TEST_ROWS%%": buildTestRows(sorular, cevaplar),

      "%%TARIH%%": now.toLocaleDateString("tr-TR"),
      "%%SAAT%%": now.toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    html = replaceAllMap(html, map);

    htmlPages.push(`
  <div class="test-page">
    ${html.trim()}
  </div>
`);
  }

  const finalHtml = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
       <style>
  .test-page {
    break-after: page;
    page-break-after: always;
  }

  .test-page:last-child {
    break-after: auto;
    page-break-after: auto;
  }

  body {
    margin: 0;
    padding: 0;
  }
</style>
      </head>
      <body>
        ${htmlPages.join("")}
      </body>
    </html>
  `;

  return await pdf.generatePdf(
    { content: finalHtml },
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
}

async function createIsegirisTestPdf(payload) {
  const buffer = await createPdfBuffer(payload);

  const personel =
    Array.isArray(payload?.katilimcilar) && payload.katilimcilar.length > 1
      ? `toplu_${payload.katilimcilar.length}_kisi`
      : payload?.personel?.adSoyad ||
        payload?.katilimcilar?.[0]?.adSoyad ||
        "personel";

  const safeName = safe(personel)
    .replace(/[^\p{L}\p{N}\s._-]/gu, "")
    .trim()
    .replace(/\s+/g, "_");

  const file = `ise_giris_test_${safeName || "personel"}_${Date.now()}.pdf`;
  const out = path.join(OUT_DIR, file);

  fs.writeFileSync(out, buffer);
  return out;
}

module.exports = {
  createIsegirisTestPdf,
  createIseGirisTestPdf: createIsegirisTestPdf,
};