const path = require("path");
const fs = require("fs");
const Handlebars = require("handlebars");
const html_to_pdf = require("html-pdf-node");
const archiver = require("archiver");

/* =========================
   HELPERS (genel ile aynı)
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

const trToday = () => new Date().toLocaleDateString("tr-TR");
const PDF_DEBUG = safe(process.env.PDF_DEBUG) === "1";

/**
 * Panelden gelen tarihi yakala (genel ile aynı)
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
  ]
    .map(safe)
    .filter(Boolean);

  const raw = candidates[0] || "";
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${d}.${m}.${y}`;
  }

  return raw || trToday();
}

/* =========================
   TEMPLATE
   ========================= */
function getTemplateHtml() {
  const fileName = "insaat_talimat.html";

  const candidates = [
    path.join(__dirname, "..", "isg_prosedur_template", "templates", "talimat", fileName),
    path.join(__dirname, "..", "..", "isg_prosedur_template", "templates", "talimat", fileName),
    path.join(process.cwd(), "isg_prosedur_template", "templates", "talimat", fileName),
    path.join(process.cwd(), "templates", "talimat", fileName),
    path.join(process.cwd(), "backend", "isg_prosedur_template", "templates", "talimat", fileName),
  ];

  const tplPath = candidates.find((p) => fs.existsSync(p));

  if (!tplPath) {
    throw new Error(
      `insaat_talimat.html bulunamadı. Denenen yollar:\n- ${candidates.join("\n- ")}`
    );
  }

  return fs.readFileSync(tplPath, "utf-8");
}

/* =========================
   DEFAULT MADDELER (İNŞAAT)
   ========================= */
function defaultMaddelerInsaat() {
  return [
    "İmzalanan bu talimatta yazılı olan, bu talimatta olsun veya olmasın iş yeri ilan panosuna veya iş yerinin muhtelif kısımlarına asılmış bulunan ve asılacak olan İşçi Sağlığı ve İş Güvenliği Kuralları okunacak ve bu kurallara uyulacaktır.",
    "İşçi Sağlığı ve İş Güvenliği Kurulu tarafından zaman zaman tarafınıza bildirilecek yazılı ve sözlü kurallara uyulacak ve işveren tarafından planlanan süreli veya periyodik iç ve dış eğitimlere iştirak edilecektir.",
    "Şahsınıza verilen görevi size tarif edildiği şekilde yapın, kendi işinizden başka bir işe karışmayın.",
    "İş yerinin muhtelif yerlerine çeşitli maksatlarla asılmış bulunan güvenlik, sağlık, yasak, bilgilendirme, emredici, uyarıcı, ilk yardım, işaret, ışıklı, sesli, sembol vb. güvenlik ve sağlık işaretleri tek tek okunacak ve bu levhalardaki uyarılara mutlaka uyulacaktır.",
    "Güvenlik ve sağlık işaretlerinin yerleri, ilgili sorumluların haberleri ve izni olmadan değiştirilmeyecektir.",
    "İşin gereği olarak şahsınıza verilen kişisel koruyucuları örneğin baret, emniyet kemeri, iş eldiveni, bot, tulum, lastik çizme, gözlük vb. devamlı olarak kullanın. Bu malzemeleri eskitir, kırar veya kaybederseniz amirinize haber vererek ve izin alarak ambardan yenisini alınız. İşiniz gereği ve can güvenliğiniz için çok gerekli olan bu koruyucuları almadan iş başı yapmayın.",
    "Patlama, yanma ve parlama tehlikesi olan yerlere gerekli kontrol, havalandırma ve kaçak tespiti yapmadan girmeyin. Bu yerlerde patlayıcı ve yanıcı ortam oluşturacak alet, edevat ve malzemeler kullanmayın.",
    "Kimyasal maddeleri ilgili yönetmelik ve imalatçı firmaların kullanım talimatlarına uygun kullanın. Bu maddelerin aşındırıcı, tahriş edici, toksik, alerjik, kanserojen ve diğer tüm etkilerinden korunun.",
    "Düşme ve kayma tehlikesi olan ve 1.50 metreden daha yüksek kısımlarda çalışırken muhakkak surette güvenlik kemerinizi belinize takın ve halatı sağlam bir yere geçirdikten sonra kancayı taktıktan sonra çalışmaya başlayın.",
    "Şahsınıza verilen kişisel koruyucu malzemeleri iyi ve temiz bir şekilde kullanın, muhafaza edin.",
    "Şahsınıza verilen kişisel koruyucu malzemeleri kaybetmemek için gerektiğinde ambara teslim edin.",
    "Beraber çalıştığınız işçi arkadaşlarınızı ve iş yerinde çalışan diğer işçileri kazaya uğratmayacak şekilde çalışın.",
    "İş yerinde çalıştığınız sürece sivri uçları veya keskin kenarları bulunan malzeme ve artıkları gelişi güzel atmayın ve ortalıkta bulundurmayın.",
    "İş yerinde çalıştığınız sürece kazaya sebep olacak veya çalışanları tehlikeli durumlara düşürecek şekilde malzeme istif etmeyin ve araçları gelişigüzel yerlere bırakmayın.",
    "Cam, saç ve çimento harçlı levhalardan yapılmış veya eskimiş, yıpranmış, dayanıklılığı azalmış çatılarda çalışacağınız zaman ilk önce iş yeri ilgili ve sorumlularından çatı merdiveni temin edin, bunu kullanın ve buralarda tam güvenliği sağlamadıkça çalışmayın.",
    "İnşaat süresince betonarme merdiven ve sahanlıkların boşluk taraflarına ahşaptan sağlam şekilde korkuluk yapınız.",
    "İnşaatın veya işin yürütümü esnasında yapılan geçitlere sağlam şekilde korkuluk yapın ve bu korkulukları geçit sökülünceye kadar sökmeyin.",
    "Tavan ve döşemelerde çeşitli maksatlar için bırakılan boşluk ve deliklere (aydınlık, asansör boşluğu vb.) korkuluk yapın veya bu deliklerin üstlerini geçici bir süre için uygun şekilde kapatın. Korkuluk veya kapakları iş yeri ilgili sorumlularının haberi ve izni olmadan sökmeyin.",
    "İnşaatın kenarında, boşluk veya delik civarında korkuluk veya kapak yok ise bir nedenle gezmeyin, bulunmayın, oturmayın ve yatmayın.",
    "İş yeri sahası içinde hiçbir şekilde yatmayın ve uyumayın.",
    "İş yerinde şaka yapmayın.",
    "Yürürken önünüze bakın.",
    "Girilmesi yasaklanan yerlere girmeyin.",
    "Kuvvetli rüzgar olan kısımlarda yetkili ve sorumluların izni olmadan çalışmayın.",
    "İş yeri içinde veya civarında bulunan deniz, havuz, su birikintisi, dere, nehir gibi yerlere kati surette girmeyin. İş yeri sahası içinde bu gibi yerlerde çalışmanız gerekiyorsa iş yeri ilgili sorumlularının gerekli güvenlik tedbirlerini almasından sonra sadece işin gereği olarak girin.",
    "İş yerinden izinsiz ayrılmayın, iş yerinde misafir, hemşehri, akraba kabul etmeyin.",
    "Vukua gelecek herhangi bir iş kazasını iş yeri sorumlularına derhal haber verin.",

    "Yangın eğitimi ile ilgili iç ve dış eğitimlerin hepsine çalışanlar katılacaktır.",
    "Sigara içilmesi yasaklanan yerlerde sigara içmeyin, ateş yakmayın, açık alevli cihaz kullanmayın, kaynak yapmayın.",
    "İş yerinde meydana gelecek en küçük bir yangını derhal sorumlu ve ilgililere haber verin.",
    "Yağ, akaryakıt, boya veya organik tozlar gibi parlayıcı maddelerin yangınlarında ve alçak gerilim elektrik tesislerindeki yangınlarda su kullanmayın.",
    "Parlayıcı sıvılar, yağlar ve boyalardan doğacak yangınlarda içinde köpük, karbon dioksit, kuru kimyevi toz, bikarbonat tozu veya benzeri etkili maddeler bulunan yangın söndürme cihazlarını kullanın.",
    "Gerilim altındaki elektrik tesis ve cihazlarında çıkan yangınlarda karbondioksitli, bikarbonat tozlu veya benzeri etkili diğer tiplerde yangın söndürme cihazı kullanın.",

    "İskeleleri ve korkulukları kişileri ve cisimleri düşmekten koruyacak şekilde sağlam ve uygun malzemeden yapın. Çalışmaya başlamadan önce hareket ve oynama olup olmadığını kontrol edin.",
    "İskelelerde çalışmaya başlamadan önce kontrol edin. Herhangi bir arıza mevcut ise durumu sorumlu ve ilgililere haber verin ve arıza giderilince çalışmaya başlayın.",
    "İskelede herhangi bir nedenle kayganlık meydana gelmiş ise bunu giderin, sonra çalışın.",
    "İskeleler üzerinde moloz ve artıklar bırakmayın.",
    "İskelelerde korkuluksuz çalışmayın. Korkuluklarda bir trabzan, orta seviyede bir ara korkuluk ve tabanında eteklik bulunup bulunmadığını ve sağlamlığını kontrol edin.",
    "İskele demontajı sırasında alt tarafta hiçbir kimse bulundurulmayacaktır. Bu nedenle bir gözcü görevlendirin.",
    "İskele elemanları tek tek sökülecektir.",

    "Merdivenler ulaşım aracıdır, çalışma aracı değildir. Merdivenler üzerinde kesinlikle çalışma yapılmayacaktır.",
    "El merdivenleri kullanıldıkları yerlere, alt ve üst kısımları kaymayacak veya bu yerlerden kurtulmayacak şekilde yerleştirilecektir.",
    "Sabit merdivenler korkuluklu olacaktır.",

    "Makinaların kullanma talimatlarına uyun.",
    "Arızalı alet, cihaz, makine ve tezgah kullanmayın.",
    "Çalışan makineye el ile veya başka bir malzeme ile müdahale etmeyin. Makine çalışırken yağlama, tamirat veya bakım işlerine girişmeyin.",
    "Makine durdurulduktan sonra yapılacak yağlama, tamirat ve bakım sonucunda makineye ait koruyucuları muhakkak yerine takın. Koruyucuları olmayan makineyi çalıştırmayın veya kullanmayın. Makinenin çalıştırıldığı kısımdaki uyarı levhasına mutlaka uyun.",

    "İş makinelerini G sınıfı sürücü belgesi veya operatör belgesi olmadan kullanmayın. Her türlü arıza ve aksamayı derhal sorumlu ve ilgililere haber verin.",
    "Vinç, forklift ve benzeri iş makinelerinin hareket alanı içine girmeyin ve yaklaşmayın.",
    "İş makineleri üzerine kati surette binmeyin. Bu gibi makineler üzerinde operatörden başkası bulunamaz.",
    "Vinç kancasına takılacak çelik halat en az üç adet U klemensi ile bağlanacaktır.",
    "Kancanın sapandan kurtulmaması için mandal, kilitli mandal veya bağlama gibi uygun tertibat kullanılacaktır.",

    "İş yerinde azami sürat 10 km’dir. Kamyon damperleri kalkık şekilde kullanılmayacaktır.",
    "Araçların manevralarında muhakkak surette işaretçi kullanılacak ve bu kişi giriş, çıkış ve manevraları idare edecektir. İki araç veya makine arasında görünmeyi engelleyecek kör noktalarda çalışma yapılmayacaktır.",
    "Araçlar, gerekli güvenlik tedbirleri alınmadan sürücüsüz bırakılmayacaktır.",

    "Elektrik ile ilgili arızaları elektrikçiye veya elektrik servisine veyahut amirinize haber verin.",
    "Sorumlu ve selahiyetli elektrikçiden başkası elektrik işi ile ilgili olarak uğraşamaz. Yasak ve tehlikelidir.",
    "Pano veya tablaya müdahale edilmesi için pano veya tabla üzerine ya da çevresine hiçbir şey koymayın.",
    "Pano veya tabla çevresine su dökmek, su sıkmak kati surette yasaktır.",
    "İş yerinin muhtelif kısımlarında bulunan enerji nakil hattına herhangi bir nedenle yaklaşmayın ve dokunmayın. Ayrıca bu hatlara demir boru ve buna benzer malzemeleri yaklaştırmayın ve dokundurmayın. Ölüm tehlikesi vardır.",
    "Hat, motor, sigorta ve diğer bütün elektrik tesis ve tesisatlarında tehlike mevcuttur. Bu gibi yerlerde yapılacak işlemler, örneğin sigorta butonu değişmesi vb., ancak sorumlu ve selahiyetli kişiler tarafından gerilim olmadığı zaman yapılacaktır.",
    "Elektrik tesisatını, aydınlatma ve kuvvet tesislerini ancak sorumlu ve selahiyetli elektrikçi yapabilir. Bakım, onarım, lamba takılması veya değiştirilmesi, şalter ve buna benzer elemanların takılması veya değiştirilmesi de ancak sorumlu ve selahiyetli elektrikçi tarafından yapılabilir. Yetkisiz kimseler kati surette bu işlerle uğraşamazlar.",
    "Sorumlu ve selahiyetli kişiler tarafından kontrol edilmeyen topraklamayı kullanmayın. Topraklamaya dokunmayın.",
    "Şalteri devreden çıkarın, sonra fişi çekin veya sokun.",
    "Yer altındaki elektrik kablolarına boru veya kazık çakmak veyahut başka bir işlem yapmak kati surette yasaktır. Ölüm tehlikesi vardır.",
    "Elektrikli el aletlerini kullanmadan önce kontrol edin.",
    "Güvenlik topraklaması arızalı olan aleti kullanmayın.",
    "Dar ve rutubetli yerlerde küçük gerilimle (42 volt) çalışın.",
    "Hareketli ve döner kısımları korunmamış aleti kullanmayın.",
    "Elektrikli alet ile parlayıcı veya patlayıcı ortamda çalışmayın.",
    "Elektrikli tesislerde yapılacak çalışmalarda şalteri serbestçe açın, şalterin devreye girmemesi için gerekli güvenlik tedbirini alın, gerilim kontrolü yapın ve gerilim olmadığından emin olun, topraklayın ve kısa devre yapın, gerilim altındaki kısımların veya bölmelerin kapaklarını kapatın. İşiniz bittikten sonra gerilim verilebileceği zaman yukarıdaki işlemleri tersten yapın. Yukarıda açıklanan işlemleri yalnızca sorumlu ve selahiyetli elektrikçiler yapacaktır."
  ];
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

  const amac =
    safe(payload?.talimat?.amac) ||
    "Bu talimatın amacı, şantiyelerde inşaat sahası güvenliğinde yapılması gerekenleri tanımlamaktır.";

  const kapsam =
    safe(payload?.talimat?.kapsam) ||
    "Bu talimat tüm şantiye inşaat sahası çalışanlarını kapsar.";

  const maddeler =
    Array.isArray(payload?.talimat?.maddeler) && payload.talimat.maddeler.length
      ? payload.talimat.maddeler.map((x) => safe(x)).filter(Boolean)
      : defaultMaddelerInsaat();

  const tarihTR = resolveTarihTR(payload);

  if (PDF_DEBUG) {
    console.log("🧾 [PDF_DEBUG] insaat talimat tarih resolved:", tarihTR);
  }

 const personelImza =
  payload?.personel?.imzalar?.genel?.dataUrl ||
  payload?.personel?.personelImzalari?.personel ||
  payload?.personel?.personelImzasi ||
  payload?.personelImza ||
  "";

return {
  firmaAdi,
  amac,
  kapsam,
  maddeler,
  personelAdSoyad: personelAdSoyad || "-",
  personelTc: personelTc || "-",
  tarihTR,
  personelImza,
};
}

/* =========================
   PDF RENDER
   ========================= */
async function renderPdfBuffer(payload) {
  const tpl = getTemplateHtml();
  const html = Handlebars.compile(tpl)(buildTemplateData(payload));

  const file = { content: html };
  const options = {
  format: "A4",
  printBackground: true,
  preferCSSPageSize: true,
  margin: {
    top: "25mm",
    right: "25mm",
    bottom: "25mm",
    left: "25mm",
  },
};

  return await html_to_pdf.generatePdf(file, options);
}

/* =========================
   TEKLİ PDF
   POST /api/talimat/insaat/pdf
   ========================= */
async function insaatTalimatPdf(req, res) {
  try {
    const payload = req.body || {};
    const firmaAdi = payload?.firma?.firmaAdi || "firma";
    const adSoyad = payload?.personel?.adSoyad || "personel";

    const pdfBuffer = await renderPdfBuffer(payload);
    const filename = `${firmaAdi}_${adSoyad}_insaat_genel_talimat.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", safeContentDisposition(filename));
    return res.send(pdfBuffer);
  } catch (e) {
    console.error("insaatTalimatPdf hata:", e);
    return res.status(500).json({ ok: false, message: "İnşaat talimat PDF üretilemedi." });
  }
}

/* =========================
   BULK ZIP
   POST /api/talimat/insaat/pdf-bulk
   body: { firmaId, firma, items: [payload...] }
   ========================= */
async function insaatTalimatPdfBulk(req, res) {
  try {
    const body = req.body || {};
    const items = Array.isArray(body?.items) ? body.items : [];
    const firmaAdi = safe(body?.firma?.firmaAdi) || "firma";

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", safeContentDisposition(`${firmaAdi}_insaat_talimatlar.zip`));

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => {
      console.error("ZIP error:", err);
      try {
        res.status(500).end();
      } catch {}
    });

    archive.pipe(res);

    for (let i = 0; i < items.length; i++) {
      const p = items[i] || {};
      const adSoyad = safe(p?.personel?.adSoyad) || `personel_${i + 1}`;
      const pdfBuffer = await renderPdfBuffer(p);

      const entryName = `${firmaAdi}_${adSoyad}_insaat_genel_talimat.pdf`;
      archive.append(pdfBuffer, { name: toAsciiFileName(entryName) });
    }

    await archive.finalize();
  } catch (e) {
    console.error("insaatTalimatPdfBulk hata:", e);
    return res.status(500).json({ ok: false, message: "İnşaat talimat ZIP üretilemedi." });
  }
}

module.exports = {
  insaatTalimatPdf,
  insaatTalimatPdfBulk,
};