const path = require("path");
const fs = require("fs");
const Handlebars = require("handlebars");
const html_to_pdf = require("html-pdf-node");
const archiver = require("archiver");
const crypto = require("crypto");
const QRCode = require("qrcode");
const PdfJob =
  require("../models/PdfJob");

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
  return String(process.env.DEMO_MODE || "").toLowerCase() === "true";
}

const trToday = () => new Date().toLocaleDateString("tr-TR");
async function buildVerificationData(
  payload = {}
) {
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

// ✅ İsteğe bağlı debug log (ENV ile aç/kapat)
// Windows: set PDF_DEBUG=1
const PDF_DEBUG = safe(process.env.PDF_DEBUG) === "1";

/**
 * ✅ Panelden gelen tarihi yakala
 * (Hangi isimle gelirse gelsin)
 *
 * Öncelik sırası:
 * - payload.talimat.tarihTR
 * - payload.talimat.tarih
 * - payload.talimat.egitimTarihi
 * - payload.talimat.tarihValue
 * - payload.talimat.date
 * - payload.tarihTR
 * - payload.tarih
 * - payload.egitimTarihi
 * - fallback: bugünün tarihi
 */
function resolveTarihTR(payload) {
  const candidates = [
    payload?.talimat?.tarihTR,
    payload?.talimat?.tarih,
    payload?.talimat?.egitimTarihi,
    payload?.talimat?.tarihValue,
    payload?.talimat?.date,
    payload?.tarihTR,
    payload?.tarih,
    payload?.egitimTarihi,
  ].map(safe).filter(Boolean);

  // Eğer panel ISO gönderirse (YYYY-MM-DD) TR’ye çevir
  const raw = candidates[0] || "";
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${d}.${m}.${y}`;
  }

  return raw || trToday();
}

/* =========================
   LOGO
   ========================= */
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

/* =========================
   TEMPLATE
   ========================= */
function getTemplateHtml() {
  // ✅ Şablon: isgpanel/isg_prosedur_template/templates/talimat/genel_talimat.html
  const tplPath = path.join(
    __dirname,
    "..",
    "..",
    "isg_prosedur_template",
    "templates",
    "talimat",
    "genel_talimat.html"
  );

  if (!fs.existsSync(tplPath)) {
    throw new Error(`genel_talimat.html bulunamadı: ${tplPath}`);
  }

  return fs.readFileSync(tplPath, "utf-8");
}

/* =========================
   MADDELER (TAM LİSTE)
   ========================= */
function defaultMaddeler() {
  return [
    "Çalışmaya başlamadan önce gerekli güvenlik önlemlerini alın.",
    "İşe başlamadan önce kullandığınız araçları daima kontrol edin.",
    "Daima işinize uygun araç ve gereç kullanın.",
    "Çalışma ortamında meydana gelen aksaklık, tezgah arızaları gibi olumsuzlukları amirinize zaman kaybetmeden bildirin.",
    "Tezgah ve elektrik arızalarına müdahale etmeyin.",
    "Tezgah üzerindeki tüm anahtar, düğme ve kumanda kollarının tam olarak görevlerini öğrenin.",
    "Amirlerinizin sözlü uyarılarına daima riayet edin.",
    "Amiriniz tarafından verilen talimatları uygulayın ve bunlar dışında kendiliğinizden iş yapmayın.",
    "Zorunlu olmadıkça görev yerinizi terk etmeyin. Zorunlu hallerde ancak amirlerinizin izni ile görev yerinden ayrılın.",
    "Vardiya değişimlerinde tezgah ve makinelerdeki değişiklikleri işe başlayacak olan iş arkadaşınıza bildirmeyi unutmayın.",
    "Yasaklanmış yerlere girmeyin.",
    "İş bitiminde zorunlu olarak kilitli kalması gereken yerlerin dışındaki kapıları kilitlemeyin.",
    "Çalışırken üzerinizde yüzük, künye, kol saati ve anahtarlık bulundurmayın. Takılıp iş kazası geçirmenize sebep olabilir.",
    "Çalışma ortamınızın çeşitli yerlerinde asılı bulunan iş sağlığı ve güvenliği ile ilgili uyarı levhalarına riayet edin.",
    "Kendi güvenliğiniz ve birlikte çalıştığınız arkadaşlarınızın güvenliği için daima dikkatli ve sorumlu hareket edin.",
    "Daima işinize uygun kişisel koruyucu donanım kullanın.",
    "Çalıştığınız tezgah tamamen durmadan kesinlikle başka işlerle uğraşmayın ve başından ayrılmayın.",
    "Tezgah tamamen durmadan tezgah üzerinde ölçü almaya veya yüzey kalitesini kontrol etmeye kalkışmayın.",
    "Çalışırken tezgahlara yaslanmayın.",
    "Talaşları uygun bir fırça ile temizleyin, elinizi sürmeyin.",
    "Uzun, geniş, sarkık ve saçaklı elbiseler iş kazalarına sebep olabilir dikkat ediniz.",
    "Ölçü aletlerini kesici takımların üzerine koymayın, bir düzen içerisinde çalışın.",
    "Çalışmakta olan bir tezgahı tamir etmeye ve temizlemeye kalkmayın.",
    "Tezgahı çalıştırmadan önce işin ve kesici takımın güvenli olarak bağlandığına emin olun.",
    "Koruyucu ve güvenlik amacıyla yapılmış araçlara zarar vermeyin.",
    "Güvenli kullanım konusunda eğitim almadığınız araçları ve maddeleri asla kullanmayın.",
    "Araç ve maddeleri kullanmadan önce uyarılara dikkat edin. Şüphelendiğiniz durumlarda daima yetkililere sorun.",
    "Çalıştığınız alanı daima temiz ve tertipli tutun.",
    "Elektrikli araçlara daima bakım yapın.",
    "Daima güvenli olarak inin veya çıkın. Asla atlamayın.",
    "Dikkat ve konsantrasyon gerektiren işlerde çalışanları asla rahatsız etmeyin ve dikkatleri dağıtmayın.",
    "Çalışırken şaka yapmaktan ve gereksiz konuşmalardan kaçının.",
    "İşyerinde asla el şakası yapmayın.",
    "İşyerine asla uykulu veya içkili gelmeyin.",
    "İşyerinde asla koşmayın. Canlı yürüyün.",
    "İş kazalarını zamanında amirinize bildirin. Kendi başınıza tedavi olmaya çalışmayın.",
    "Malzemeleri daima güvenli bir şekilde taşıyın.",
    "Malzeme artıklarını yerlere atmayın ve istiflemede tehlikeli olabilecek düzenlemelerden kaçının.",
    "Zeminlerdeki çukur ve açıklıklara karşı dikkatli olun.",
    "Görevli değilseniz malzeme yükleme ve aktarma alanlarında bulunmayınız.",
    "Ağır malzemeleri tek başınıza kaldırmayın ve taşımayın. Ağır yükler için yardım isteyin.",
    "İşiniz bittiğinde kullandığınız malzemeleri daima düzenli ve güvenli olarak bırakın.",
  ];
}

/* =========================
   TEMPLATE DATA (✅ mevcut yapı korunuyor + tarih panelden)
   ========================= */
function buildTemplateData(payload) {
  const firmaAdi =
    safe(payload?.firma?.firmaAdi) ||
    safe(payload?.kurumsal?.firmaAdi) ||
    "Firma";

  const personelAdSoyad = safe(payload?.personel?.adSoyad).toLocaleUpperCase("tr-TR");
  const personelTc = normalizeTC(payload?.personel?.tc);

  const amac =
    safe(payload?.talimat?.amac) ||
    "Bu talimatın amacı genel çalışma talimatlarını tanımlamaktır.";

  const kapsam =
    safe(payload?.talimat?.kapsam) ||
    "Bu talimat tüm çalışanları kapsar.";

  const maddeler =
    Array.isArray(payload?.talimat?.maddeler) && payload.talimat.maddeler.length
      ? payload.talimat.maddeler.map((x) => safe(x)).filter(Boolean)
      : defaultMaddeler();

  const tarihTR = resolveTarihTR(payload); // ✅ Panelden gelirse onu basar

  if (PDF_DEBUG) {
    console.log("🧾 [PDF_DEBUG] talimat.tarih adayları:", {
      talimat_tarihTR: payload?.talimat?.tarihTR,
      talimat_tarih: payload?.talimat?.tarih,
      talimat_egitimTarihi: payload?.talimat?.egitimTarihi,
      root_tarihTR: payload?.tarihTR,
      root_tarih: payload?.tarih,
      resolved: tarihTR,
    });
  }

 const personelImza =
  payload?.personel?.imzalar?.genel?.dataUrl ||   // 🔥 BURASI
  payload?.personel?.personelImzalari?.personel ||
  payload?.personel?.personelImzasi ||
  payload?.personelImza ||
  "";

return {
  firmaAdi,
  logoSrc: buildLogoSrc(payload),

  amac,
  kapsam,
  maddeler,

  personelAdSoyad: personelAdSoyad || "-",
  personelTc: personelTc || "-",
  tarihTR,

  // 🔥 EKLEDİK
  personelImza,
};

}

/* =========================
   PDF RENDER
   ========================= */
async function renderPdfBuffer(payload) {
  const tpl = getTemplateHtml();
  const verification =
  await buildVerificationData(
    payload
  );

const templateData =
  buildTemplateData(payload);

templateData.verifyQr =
  verification.verifyQr;

templateData.verificationCode =
  verification.verificationCode;

let html = Handlebars.compile(tpl)(
  templateData
);

  const file = { content: html };
  const options = { format: "A4", printBackground: true };

  return await html_to_pdf.generatePdf(file, options);
}




/* =========================
   TEKLİ PDF
   POST /api/talimat/pdf
   ========================= */
async function genelTalimatPdf(req, res) {
  try {
    const payload = req.body || {};

const verificationCode =
  payload?.verificationCode ||
  crypto.randomBytes(5)
    .toString("hex")
    .toUpperCase();

payload.verificationCode =
  verificationCode;

    if (PDF_DEBUG) {
      console.log("🧾 [PDF_DEBUG] /api/talimat/pdf payload.talimat:", payload?.talimat);
    }

    const firmaAdi = payload?.firma?.firmaAdi || "firma";
    const adSoyad = payload?.personel?.adSoyad || "personel";

await PdfJob.create({
  type: "genel-talimat",

  status: "queued",

  verificationCode,

 data: {
  firma: payload?.firma || {},

  personel: payload?.personel || {},

  katilimcilar: [
    {
      ...(payload?.personel || {}),

      personelFoto:
        payload?.personel?.personelFoto ||
        payload?.personel?.personelFotoDataUrl ||
        payload?.personel?.foto ||
        "",

      egitimTarihi:
        payload?.talimat?.tarih ||
        payload?.talimat?.tarihTR ||
        payload?.tarih ||
        payload?.tarihTR ||
        "",
    },
  ],

  firmaAdi:
    payload?.firma?.firmaAdi || "",
},
});

    const pdfBuffer = await renderPdfBuffer(payload);
    const filename = `${firmaAdi}_${adSoyad}_genel_talimat.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", safeContentDisposition(filename));
    return res.send(pdfBuffer);
  } catch (e) {
    console.error("genelTalimatPdf hata:", e);
    return res.status(500).json({ ok: false, message: e.message });
  }
}

/* =========================
   TOPLU ZIP
   POST /api/talimat/pdf-bulk
   body: { firma, kurumsal, items:[payload1,payload2,...] }
   ✅ Her item kendi payload'ı ile render edildiği için tarih ayrı ayrı olur
   ========================= */
async function genelTalimatPdfBulk(req, res) {
  try {
    const items = req.body?.items || [];
    if (!items.length) return res.status(400).send("items boş");

    if (PDF_DEBUG) {
      console.log("🧾 [PDF_DEBUG] /api/talimat/pdf-bulk ilk item talimat:", items?.[0]?.talimat);
    }

    const firmaAdi = req.body?.firma?.firmaAdi || "firma";
    const zipName = `${firmaAdi}_genel_talimatlar.zip`;

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", safeContentDisposition(zipName));

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => {
      console.error("zip hata:", err);
      res.status(500).end();
    });

    archive.pipe(res);

    for (let i = 0; i < items.length; i++) {
      const p = items[i] || {};
      const pdf = await renderPdfBuffer(p);

      const ad = p?.personel?.adSoyad || `personel_${i + 1}`;
      archive.append(pdf, { name: `${toAsciiFileName(ad)}_genel_talimat.pdf` });
    }

    await archive.finalize();
  } catch (e) {
    console.error("genelTalimatPdfBulk hata:", e);
    return res.status(500).send("ZIP üretilemedi");
  }
}

module.exports = {
  genelTalimatPdf,
  genelTalimatPdfBulk,
};
