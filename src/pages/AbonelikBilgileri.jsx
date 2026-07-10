// AbonelikBilgileri.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";

/** =========================
 *  Helpers (timezone-safe)
 *  ========================= */
const VAT_RATE = 0.2;
const DAY_MS = 24 * 60 * 60 * 1000;

const trCurrency = (n) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(Number(n || 0));

// ✅ Ticari ile aynı format: tarih+saat
const fmtDateTimeTR = (d) => {
  const x = new Date(d);
  if (!d || isNaN(x)) return "-";
  return x.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// ✅ Type label (ticari uyumlu)
const typeLabel = (t) => {
  const x = String(t || "").toUpperCase();
  if (x === "UPGRADE") return "Paket Yükseltme";
  if (x === "ADD_USERS") return "Ek Kullanıcı";
  if (x === "OFFER") return "Teklif";
  if (x === "NEW") return "Yeni Satın Alma";
  return x || "-";
};

const todayISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const toDateOnly = (v) => (v ? String(v).slice(0, 10) : "");

function safeParseDate(v) {
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

// "YYYY-MM-DD" -> local date (no timezone drift)
function isoDateToLocalNoon(iso) {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

// dateTime -> keep exact time (if provided), else use local noon
function addDaysToIsoDateTime(isoDateTime, days) {
  const base = safeParseDate(isoDateTime) || isoDateToLocalNoon(todayISO());
  if (!base) return new Date().toISOString();
  base.setDate(base.getDate() + Number(days || 0));
  return base.toISOString();
}

function getCountdown(endAt) {
  const end =
    safeParseDate(endAt) ||
    safeParseDate(`${toDateOnly(endAt)}T23:59:59`);

  const now = new Date();

  let ms = end ? end.getTime() - now.getTime() : 0;

  if (ms <= 0) {
    return {
      days: 0,
      hms: "00:00:00",
    };
  }

  // ✅ Artık yanlış şekilde 1 gün göstermeyecek
  const days = Math.floor(ms / DAY_MS);

  const remainMs = ms % DAY_MS;

  const totalSeconds = Math.floor(remainMs / 1000);

  const hours = Math.floor(totalSeconds / 3600);

  const minutes = Math.floor((totalSeconds % 3600) / 60);

  const seconds = totalSeconds % 60;

  const pad2 = (n) => String(n).padStart(2, "0");

  return {
    days,
    hms: `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`,
  };
}

const getToken = () => {
  // farklı ekranlarda farklı key kullanmış olabilirsin → hepsine tolerans
  const candidates = [
    localStorage.getItem("token"),
    sessionStorage.getItem("token"),
    localStorage.getItem("accessToken"),
    sessionStorage.getItem("accessToken"),
    localStorage.getItem("authToken"),
    sessionStorage.getItem("authToken"),
    localStorage.getItem("jwt"),
    sessionStorage.getItem("jwt"),
  ].filter(Boolean);

  let t = candidates[0] || "";
  // bazen "Bearer xxx" kaydedilmiş olabiliyor → düzelt
  if (t.startsWith("Bearer ")) t = t.slice(7);
  return t;
};
function mapIndividualPlans(apiPlans = []) {
  const byCode = Object.fromEntries(
    (Array.isArray(apiPlans) ? apiPlans : []).map((p) => [String(p.code || ""), p])
  );

  const monthly = Number(byCode?.bireysel_standart?.monthlyPrice || 300);

  return [
    {
      id: "bireysel_standart",
      name: "Bireysel Paket",
      note: "Tek uzmanlar için ideal • 1 kullanıcı",
      users: 1,
      monthlyExVat: monthly,
      yearlyExVat: monthly * 10,
      features: ["Sınırsız firma", "Tüm modüllere erişim", "Hızlı kurulum & onboarding"],
    },
  ];
}

async function apiFetch(url, options = {}) {
  const token = getToken();
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Hata");
  return data;
}

/** =========================
 *  Sözleşme metinleri
 *  ========================= */
const KVKK_TEXT = (
  <>
    <p className="font-semibold">KVKK Aydınlatma Metni</p>
    <p className="text-xs text-slate-500 mt-1">Son güncelleme: 24.02.2026</p>

    <p className="mt-3 font-semibold">1. Veri Sorumlusu</p>
    <p className="mt-1">
      6698 sayılı Kişisel Verilerin Korunması Kanunu (“KVKK”) uyarınca, kişisel
      verileriniz; veri sorumlusu sıfatıyla Mehmet Arıkan (İSG Panel) tarafından
      işlenebilecektir.
    </p>

    <p className="mt-3 font-semibold">2. İşlenen Kişisel Veriler</p>
    <ul className="list-disc ml-5 mt-1 space-y-1">
      <li>Kimlik ve iletişim bilgileri (ad, soyad, e-posta, telefon)</li>
      <li>Firma ve görev bilgileri</li>
      <li>İSG eğitim, belge ve kayıt bilgileri</li>
      <li>
        Kullanıcı işlem ve işlem güvenliği kayıtları (log, IP, oturum,
        cihaz/çerez bilgileri)
      </li>
      <li>
        Finans ve ödeme bilgileri (fatura bilgileri, abonelik/paket bilgileri,
        ödeme işlem kayıtları)
      </li>
    </ul>

    <p className="mt-3 font-semibold">3. İşlenme Amaçları</p>
    <ul className="list-disc ml-5 mt-1 space-y-1">
      <li>İSG Panel (www.isgpanel.tr) yazılım hizmetinin sunulması</li>
      <li>Kullanıcı hesabı oluşturma ve yönetimi</li>
      <li>
        İSG süreçlerinin dijital takibi, kayıtların tutulması ve belge üretimi
      </li>
      <li>
        Destek taleplerinin yönetilmesi ve kullanıcı deneyiminin iyileştirilmesi
      </li>
      <li>Mevzuattan doğan yükümlülüklerin yerine getirilmesi</li>
      <li>Abonelik, ödeme ve finans süreçlerinin yürütülmesi</li>
      <li>
        Bilgi güvenliği süreçlerinin yürütülmesi ve suistimallerin önlenmesi
      </li>
    </ul>

    <p className="mt-3 font-semibold">4. Hukuki Sebepler</p>
    <p className="mt-1">
      Kişisel verileriniz KVKK m.5/2 kapsamında; sözleşmenin kurulması ve ifası
      (m.5/2-c), hukuki yükümlülüklerin yerine getirilmesi (m.5/2-ç), bir hakkın
      tesisi/kullanılması/korunması (m.5/2-e) ve veri sorumlusunun meşru
      menfaati (m.5/2-f) hukuki sebeplerine dayanılarak işlenmektedir.
    </p>
    <p className="mt-2 text-sm">
      Not: Kanun’da öngörülen haller dışında açık rıza gerektiren
      pazarlama/iletişim faaliyetleri yürütülmesi halinde ayrıca açık rızanız
      talep edilecektir.
    </p>

    <p className="mt-3 font-semibold">5. Aktarım</p>
    <p className="mt-1">
      Kişisel verileriniz; barındırma ve altyapı hizmeti alınan teknoloji
      sağlayıcılarına, ödeme/finans kuruluşlarına (örn. iyzico gibi ödeme
      hizmeti sağlayıcıları) ve yetkili kamu kurum ve kuruluşlarına KVKK’nın 8
      ve 9. maddelerine uygun olarak aktarılabilecektir.
    </p>
    <p className="mt-2">
      Yurt dışına aktarım söz konusu olması halinde, KVKK m.9 kapsamındaki usul
      ve esaslara uygun hareket edilir.
    </p>

    <p className="mt-3 font-semibold">6. Saklama Süresi</p>
    <p className="mt-1">
      Kişisel verileriniz, hizmet ilişkisi süresince ve ilgili mevzuatta
      öngörülen süreler boyunca saklanır. Saklama süresi sonunda veriler; KVKK ve
      ilgili mevzuata uygun olarak silinir, yok edilir veya anonim hale
      getirilir.
    </p>

    <p className="mt-3 font-semibold">7. Haklarınız (KVKK m.11)</p>
    <ul className="list-disc ml-5 mt-1 space-y-1">
      <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme</li>
      <li>Kişisel verileriniz işlenmişse buna ilişkin bilgi talep etme</li>
      <li>
        İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme
      </li>
      <li>Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme</li>
      <li>Eksik veya yanlış işlenmişse düzeltilmesini isteme</li>
      <li>
        KVKK’da öngörülen şartlar çerçevesinde silinmesini veya yok edilmesini
        isteme
      </li>
      <li>
        Düzeltme/silme/yok etme işlemlerinin aktarılan üçüncü kişilere
        bildirilmesini isteme
      </li>
      <li>
        İşlenen verilerin münhasıran otomatik sistemler ile analiz edilmesi
        suretiyle aleyhinize bir sonucun ortaya çıkmasına itiraz etme
      </li>
      <li>
        Kanuna aykırı işlenmesi sebebiyle zarara uğramanız hâlinde zararın
        giderilmesini talep etme
      </li>
    </ul>

    <p className="mt-3 font-semibold">8. Başvuru</p>
    <p className="mt-1">
      KVKK kapsamındaki taleplerinizi{" "}
      <b>isgpanel@gmail.com</b> adresine e-posta göndererek iletebilirsiniz.
    </p>
    <p className="mt-2">
      Başvurunuzda; ad-soyad, başvuru konusu, iletişim bilgileriniz ve
      talebinize ilişkin açıklamaların yer alması önerilir.
    </p>

    <p className="mt-4 font-semibold">Veri Sorumlusu</p>
    <p className="mt-1">
      Mehmet Arıkan (İSG Panel)
      <br />
      Web: www.isgpanel.tr
      <br />
      E-posta: isgpanel@gmail.com
      <br />
      Adres: Bağlarbaşı Mah. 431 Cad. No:63 Daire 15 Keçiören / Ankara
    </p>
  </>
);

const TERMS_TEXT = (
  <>
    <p className="font-semibold">Üyelik Sözleşmesi / Kullanım Koşulları</p>
    <p className="text-xs text-slate-500 mt-1">Son güncelleme: 24.02.2026</p>

    <p className="mt-3 font-semibold">1. Taraflar</p>
    <p className="mt-1">
      İşbu Üyelik Sözleşmesi (“Sözleşme”); Mehmet Arıkan (İSG Panel) (“Hizmet
      Sağlayıcı”) ile İSG Panel platformuna üye olan kullanıcı (“Kullanıcı”)
      arasında elektronik ortamda kurulmuş ve yürürlüğe girmiştir.
    </p>

    <p className="mt-3 font-semibold">2. Tanımlar</p>
    <ul className="list-disc ml-5 mt-1 space-y-1">
      <li>
        <b>Platform:</b> İSG Panel web sitesi ve/veya uygulaması.
      </li>
      <li>
        <b>Hizmet:</b> İSG süreçlerinin dijital takibi, doküman/belge yönetimi,
        raporlama, görev/hatırlatma ve benzeri SaaS modüllerinin sunulması.
      </li>
      <li>
        <b>Hesap:</b> Kullanıcı’nın Platform’a erişim sağladığı üyelik hesabı.
      </li>
      <li>
        <b>İçerik/Veri:</b> Kullanıcı’nın Platform’a yüklediği, oluşturduğu veya
        girdiği her türlü bilgi, doküman ve kayıt.
      </li>
      <li>
        <b>Plan/Paket:</b> Platform’un ücretli/ücretsiz kullanım kapsamını ve
        limitlerini belirleyen abonelik planı (kullanıcı sayısı, modül erişimi,
        depolama vb.).
      </li>
      <li>
        <b>Abonelik Dönemi:</b> Seçilen pakete göre aylık/yıllık kullanım süresi.
      </li>
    </ul>

    <p className="mt-3 font-semibold">3. Konu ve Kapsam</p>
    <p className="mt-1">
      Sözleşmenin konusu; Kullanıcı’nın Platform’a üye olarak Hizmet’ten
      yararlanmasına ve Hizmet Sağlayıcı’nın Hizmet’i sunmasına ilişkin şartların
      belirlenmesidir. Platform kapsamı, modüller, kullanım limitleri ve
      özellikler seçilen Plan/Paket’e göre değişiklik gösterebilir.
    </p>

    <p className="mt-3 font-semibold">4. Üyelik ve Hesap Güvenliği</p>
    <ul className="list-disc ml-5 mt-1 space-y-1">
      <li>
        Üyelik sırasında sağlanan bilgilerin doğru, güncel ve eksiksiz olması
        Kullanıcı’nın sorumluluğundadır.
      </li>
      <li>
        Hesap şifresi ve erişim bilgilerinin gizliliği Kullanıcı’ya aittir;
        üçüncü kişilerle paylaşılmamalıdır.
      </li>
      <li>Hesap üzerinden yapılan işlemler Kullanıcı tarafından yapılmış kabul edilir.</li>
      <li>
        Yetkisiz erişim şüphesi halinde Kullanıcı, Hizmet Sağlayıcı’yı
        gecikmeksizin bilgilendirmelidir.
      </li>
      <li>
        Hizmet Sağlayıcı güvenlik gerekçesiyle oturum sonlandırma, doğrulama,
        şifre yenileme gibi önlemler uygulayabilir.
      </li>
    </ul>

    <p className="mt-3 font-semibold">5. Hizmetin Sunulması</p>
    <ul className="list-disc ml-5 mt-1 space-y-1">
      <li>
        Hizmet “olduğu gibi” ve “mevcut haliyle” sunulur; kesintisiz ve hatasız
        çalışma taahhüt edilmez.
      </li>
      <li>Zorunlu bakım/iyileştirme çalışmaları nedeniyle geçici kesintiler yaşanabilir.</li>
      <li>
        Hizmet Sağlayıcı, hizmet kalitesini artırmak için arayüz/işleyişte makul
        değişiklikler yapabilir.
      </li>
    </ul>

    <p className="mt-3 font-semibold">6. Destek ve İletişim</p>
    <ul className="list-disc ml-5 mt-1 space-y-1">
      <li>Destek talepleri, Platform’da belirtilen destek kanalları üzerinden alınır (e-posta/form vb.).</li>
      <li>
        Hizmet Sağlayıcı, taleplere makul süre içinde dönüş sağlamayı hedefler;
        yoğunluk ve talep niteliğine göre süre değişebilir.
      </li>
      <li>Bakım/planlı kesintiler mümkün oldukça önceden duyurur.</li>
    </ul>

    <p className="mt-3 font-semibold">7. Kullanım Kuralları ve Yasaklı Eylemler</p>
    <ul className="list-disc ml-5 mt-1 space-y-1">
      <li>Hukuka, kamu düzenine ve üçüncü kişi haklarına aykırı içerik yüklenmesi/iletilmesi yasaktır.</li>
      <li>
        Platform’a yetkisiz erişim, zafiyet denemesi, veri kazıma (scraping),
        tersine mühendislik, saldırı (DDoS vb.) yasaktır.
      </li>
      <li>Virüs, zararlı yazılım, spam veya Platform’u kesintiye uğratacak eylemler gerçekleştirilemez.</li>
      <li>Platform’un marka, yazılım, tasarım ve içerik unsurları üzerindeki fikri mülkiyet hakları saklıdır.</li>
    </ul>

    <p className="mt-3 font-semibold">8. Fikri Mülkiyet ve Lisans</p>
    <p className="mt-1">
      Platform’a ilişkin yazılım, tasarım, arayüz, marka, logo ve tüm fikri
      mülkiyet unsurları Hizmet Sağlayıcı’ya aittir veya lisanslıdır.
      Kullanıcı’ya, yalnızca seçilen Plan/Paket kapsamında ve Sözleşme süresince
      Platform’u kullanmak üzere devredilemez, münhasır olmayan bir kullanım
      lisansı tanınır.
    </p>

    <p className="mt-3 font-semibold">9. Kullanıcı İçeriği (Veri) – Sahiplik, Yedekleme, Silme</p>
    <p className="mt-1">
      Kullanıcı, Platform’a yüklediği/girdiği İçerik/Veri üzerinde gerekli
      haklara sahip olduğunu; İçerik’in hukuka uygun olduğunu ve üçüncü kişilerin
      haklarını ihlal etmediğini kabul eder. Kullanıcı İçeriği’nin mülkiyeti
      Kullanıcı’da kalır. Hizmet Sağlayıcı, İçerik’i yalnızca Hizmet’in
      sunulması, güvenliğin sağlanması ve yasal yükümlülüklerin yerine
      getirilmesi amaçlarıyla işler.
    </p>
    <ul className="list-disc ml-5 mt-2 space-y-1">
      <li>Kullanıcı, kendi İçerik’ini ayrıca yedeklemekle yükümlüdür.</li>
      <li>
        Hizmet Sağlayıcı teknik gereklilikler doğrultusunda yedekleme/geri
        yükleme mekanizmaları kullanabilir; mutlak veri kaybını önleme garantisi
        vermez.
      </li>
      <li>
        Hesap kapatma/abonelik bitimi sonrası veri saklama ve silme süreçleri
        KVKK ve ilgili mevzuata göre yürütülür.
      </li>
    </ul>
    <p className="mt-2 text-sm">
      Not: Platform üzerinden oluşturulan çıktı/şablonlar bilgilendirme amaçlı
      olup, nihai mevzuat uyumu bakımından kontrol sorumluluğu Kullanıcı’ya
      aittir.
    </p>

    <p className="mt-3 font-semibold">10. Ücretlendirme, Ödeme, Fatura</p>
    <p className="mt-1">
      Ücretli paketlerde fiyatlar; dönem (aylık/yıllık), kapsam, kullanıcı limiti
      ve KDV dahil/haric bilgileri web sitesinde ve/veya ödeme ekranında
      gösterilir. Ödeme adımlarında gösterilen tutar ve koşullar esas alınır.
    </p>
    <ul className="list-disc ml-5 mt-2 space-y-1">
      <li>Ödemeler, Hizmet Sağlayıcı’nın çalıştığı ödeme hizmet sağlayıcıları aracılığıyla alınabilir.</li>
      <li>Fatura/e-arşiv/e-fatura süreçleri mevzuata uygun yürütülür; gerekli hallerde Kullanıcı’dan fatura bilgileri talep edilir.</li>
      <li>Kullanıcı, bankası/ödeme kuruluşu tarafından uygulanabilecek komisyon/masraf ve benzeri kesintilerden kendisinin sorumlu olabileceğini kabul eder.</li>
    </ul>

    <p className="mt-3 font-semibold">11. Abonelik Yenileme, Plan Değişikliği, İptal</p>
    <ul className="list-disc ml-5 mt-1 space-y-1">
      <li>Abonelik, seçilen dönemin bitimine kadar geçerlidir.</li>
      <li>
        Abonelik yenileme koşulları (otomatik yenileme olup olmadığı, yenileme
        bedeli ve yenileme tarihi) satın alma anında ve/veya panelde gösterilir.
      </li>
      <li>
        Kullanıcı, panel üzerinden plan/paket değişikliği yapabilir; ücret farkı
        ve uygulanma tarihi ekranda gösterilen kurallara göre uygulanır.
      </li>
      <li>
        Kullanıcı, aboneliğini yenilememe/iptal etme seçeneğini (varsa) panel
        üzerinden kullanabilir. İptal halinde, mevcut dönem sonuna kadar erişim
        devam edebilir (satın alma anındaki koşullara göre).
      </li>
    </ul>

    <p className="mt-3 font-semibold">12. Cayma Hakkı ve İade</p>
    <p className="mt-1">
      Kullanıcı’nın 6502 sayılı Kanun kapsamında “tüketici” olması halinde; cayma
      hakkı ve iade süreçleri “Mesafeli Satış Sözleşmesi” ve ilgili mevzuat
      hükümlerine tabidir. Dijital hizmetlerde ifaya başlanması gibi hallerde
      cayma hakkı istisnaları uygulanabilir.
    </p>

    <p className="mt-3 font-semibold">13. Askıya Alma / Fesih</p>
    <p className="mt-1">
      Kullanıcı dilediğinde hesabını kapatarak üyeliğini sonlandırabilir. Hizmet
      Sağlayıcı; sözleşmeye aykırılık, kötüye kullanım, hukuka aykırılık veya
      güvenlik riski hallerinde hesabı geçici olarak askıya alabilir veya
      feshedebilir. Mevzuattan doğan saklama yükümlülükleri saklıdır.
    </p>

    <p className="mt-3 font-semibold">14. Mücbir Sebep</p>
    <p className="mt-1">
      Tarafların kontrolü dışında gelişen; doğal afet, savaş, siber saldırı,
      altyapı/elektrik kesintisi, mevzuat değişikliği gibi mücbir sebepler
      nedeniyle edimlerin ifası engellenir veya gecikirse, taraflar sorumlu
      tutulamaz.
    </p>

    <p className="mt-3 font-semibold">15. Sorumluluğun Sınırlandırılması</p>
    <p className="mt-1">
      Hizmet Sağlayıcı; internet/altyapı kesintileri, üçüncü taraf hizmetlerinden
      kaynaklanan aksamalar ve teknik zorunluluklar nedeniyle doğabilecek erişim
      sorunlarından mevzuatın izin verdiği ölçüde sorumlu değildir. Dolaylı
      zararlar, kâr kaybı, iş kaybı, veri kaybı gibi sonuçlardan sorumluluk kabul
      edilmez.
    </p>

    <p className="mt-3 font-semibold">16. Değişiklikler</p>
    <p className="mt-1">
      Hizmet Sağlayıcı, mevzuat ve hizmet gereksinimleri doğrultusunda
      Sözleşme’de değişiklik yapabilir. Güncel metin Platform’da yayımlandığı
      tarihten itibaren geçerli olur.
    </p>

    <p className="mt-3 font-semibold">17. Uyuşmazlık</p>
    <p className="mt-1">
      Kullanıcı’nın tüketici olduğu uyuşmazlıklarda ilgili mevzuat gereği
      Tüketici Hakem Heyetleri / Tüketici Mahkemeleri yetkilidir. Tüketici olmayan
      Kullanıcılar bakımından Ankara Mahkemeleri ve İcra Daireleri yetkilidir.
    </p>

    <p className="mt-4 font-semibold">Hizmet Sağlayıcı</p>
    <p className="mt-1">
      Mehmet Arıkan (İSG Panel)
      <br />
      Adres: Bağlarbaşı Mah. 431 Cad. No:63 Daire 15 Keçiören / Ankara
      <br />
      E-posta: isgpanel@gmail.com
      <br />
      Web: www.isgpanel.tr
    </p>
  </>
);

const SALES_TEXT = (
  <>
    <p className="font-semibold">Mesafeli Satış Sözleşmesi (Dijital Abonelik)</p>
    <p className="text-xs text-slate-500 mt-1">Son güncelleme: 24.02.2026</p>

    <p className="mt-3 font-semibold">1. Taraflar</p>
    <p className="mt-1">
      İşbu Mesafeli Satış Sözleşmesi (“Sözleşme”); aşağıda bilgileri bulunan
      Mehmet Arıkan (İSG Panel) (“Satıcı”) ile www.isgpanel.tr üzerinden dijital
      abonelik hizmeti satın alan kullanıcı (“Alıcı/Tüketici”) arasında
      elektronik ortamda kurulmuştur.
    </p>

    <p className="mt-3 font-semibold">2. Sözleşmenin Konusu</p>
    <p className="mt-1">
      Bu Sözleşme’nin konusu; Alıcı’nın, Satıcı tarafından sunulan İSG Panel
      yazılım hizmetine (“Hizmet”) ilişkin dijital abonelik satın alması ve
      kullanmasına dair tarafların hak ve yükümlülüklerinin belirlenmesidir.
    </p>

    <p className="mt-3 font-semibold">3. Hizmetin Niteliği</p>
    <p className="mt-1">
      Hizmet, fiziksel teslimat içermeyen, internet üzerinden erişim sağlanan
      yazılım hizmeti (SaaS) niteliğindedir. Hizmet kapsamı, modüller, kullanıcı
      limitleri ve özellikler satın alınan plan/pakete göre değişebilir.
    </p>

    <p className="mt-3 font-semibold">4. Sipariş, Ödeme ve Ödeme Kuruluşu</p>
    <p className="mt-1">
      Abonelik planı, dönem (aylık/yıllık), bedel ve KDV dahil/haric tutar ödeme
      ekranında açıkça gösterilir. Ödeme, Satıcı’nın anlaşmalı ödeme altyapısı
      sağlayıcısı (ör. iyzico) üzerinden tahsil edilebilir. Ödeme tamamlandığında
      abonelik Alıcı hesabına tanımlanır.
    </p>

    <p className="mt-3 font-semibold">5. Hizmete Erişim ve İfa Zamanı</p>
    <p className="mt-1">
      Hizmet, kullanıcı hesabı üzerinden çevrim içi olarak sunulur. Ödeme onayı
      ve aboneliğin aktive edilmesiyle birlikte hizmetin ifasına başlanmış
      sayılır.
    </p>

    <p className="mt-3 font-semibold">6. Teslimat ve İade Koşulları</p>
    <p className="mt-1">
      İSG Panel, fiziksel teslimat içermeyen dijital bir yazılım hizmetidir.
      Hizmet, ödeme işleminin tamamlanmasının ardından Alıcı hesabına anında
      tanımlanır ve elektronik ortamda erişime açılır. Fiziksel teslimat
      yapılmaz. Dijital hizmetlerde cayma hakkı, hizmetin ifasına başlanmasıyla
      birlikte mevzuat kapsamında sona erebilir.
    </p>

    <p className="mt-3 font-semibold">7. Cayma Hakkı</p>
    <p className="mt-1">
      Mesafeli sözleşmelerde tüketicinin cayma hakkı mevzuata tabidir. Ancak
      dijital hizmetlerde; ifaya Alıcı’nın açık onayıyla başlanması ve Alıcı’nın
      cayma hakkını kaybedeceğine ilişkin bilgilendirilmesi halinde, cayma hakkı
      istisnası doğabilir.
    </p>

    <p className="mt-3 font-semibold">8. Açık Onay ve Cayma İstisnası Beyanı</p>
    <p className="mt-1">
      Alıcı, ödeme sonrası aboneliğin aktive edilmesi ve hizmete erişimin
      başlatılmasının dijital hizmette ifaya başlama anlamına gelebileceğini ve
      mevzuat kapsamındaki koşullar oluştuğunda cayma hakkını kaybedebileceğini
      kabul eder.
    </p>

    <p className="mt-3 font-semibold">9. İptal, İade ve Mükerrer Ödeme</p>
    <ul className="list-disc ml-5 mt-1 space-y-1">
      <li>
        İptal/iade talepleri, hizmetin kullanım durumu ve mevzuat hükümleri
        kapsamında değerlendirilir.
      </li>
      <li>
        Teknik hata, mükerrer ödeme veya hizmetin sunulamaması gibi durumlarda
        iade yapılabilir.
      </li>
      <li>
        Ödeme iadesi, ödeme yöntemine/ödeme kuruluşu süreçlerine bağlı olarak
        belirli bir süre içinde gerçekleşebilir.
      </li>
    </ul>

    <p className="mt-3 font-semibold">10. Tarafların Yükümlülükleri</p>
    <p className="mt-1">
      Satıcı, hizmeti sözleşmeye uygun sunmakla; Alıcı ise doğru üyelik bilgileri
      sağlamak, hesabını korumak ve hizmeti hukuka uygun kullanmakla yükümlüdür.
    </p>

    <p className="mt-3 font-semibold">11. Sorumluluğun Sınırlandırılması</p>
    <p className="mt-1">
      Satıcı; internet kesintileri, altyapı sorunları, üçüncü taraf hizmet
      arızaları ve mücbir sebeplerden kaynaklanan erişim sorunlarından mevzuatın
      izin verdiği ölçüde sorumlu değildir. Dolaylı zararlar ve veri
      kayıplarından sorumluluk kabul edilmez.
    </p>

    <p className="mt-3 font-semibold">12. Fikri Mülkiyet</p>
    <p className="mt-1">
      İSG Panel yazılımı, tasarımı, markası ve tüm içerik unsurlarının fikri
      mülkiyet hakları Satıcı’ya aittir. Alıcı, hizmeti yalnızca kullanım amacıyla
      kullanabilir.
    </p>

    <p className="mt-3 font-semibold">13. Kişisel Veriler</p>
    <p className="mt-1">
      Alıcı’nın kişisel verileri Gizlilik Politikası ve KVKK aydınlatma metinleri
      kapsamında işlenir ve korunur.
    </p>

    <p className="mt-3 font-semibold">14. Sözleşme Değişiklikleri</p>
    <p className="mt-1">
      Satıcı, mevzuat veya hizmet gereklilikleri doğrultusunda sözleşme
      hükümlerinde değişiklik yapabilir. Güncel metin web sitesinde yayımlandığı
      tarihten itibaren geçerli olur.
    </p>

    <p className="mt-3 font-semibold">15. Uyuşmazlık</p>
    <p className="mt-1">
      Alıcı’nın tüketici olduğu uyuşmazlıklarda ilgili mevzuat gereği Tüketici
      Hakem Heyetleri / Tüketici Mahkemeleri yetkilidir. Tüketici olmayan
      işlemlerde Ankara Mahkemeleri ve İcra Daireleri yetkilidir.
    </p>

    <p className="mt-4 font-semibold">Satıcı</p>
    <p className="mt-1">
      Mehmet Arıkan (İSG Panel)
      <br />
      Adres: Bağlarbaşı Mah. 431 Cad. No:63 Daire 15 Keçiören / Ankara
      <br />
      E-posta: isgpanel@gmail.com
      <br />
      Web: www.isgpanel.tr
    </p>
  </>
);

export default function AbonelikBilgileri() {
  /** =========================
   *  UI constants
   *  ========================= */
  const BTN_GREEN =
    "bg-[#16a34a] hover:bg-[#15803d] text-white px-5 py-2.5 rounded-xl text-sm font-bold";
  const BTN_OUTLINE =
    "border border-gray-200 hover:bg-gray-50 px-5 py-2.5 rounded-xl text-sm font-semibold";
  const BTN_IYZICO =
    "bg-[#2f6fed] hover:bg-[#1e57c8] text-white px-5 py-2.5 rounded-xl text-sm font-bold";

  /** =========================
   *  State
   *  ========================= */
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  

  

const [state, setState] = useState({
  // subscription
  currentPlanId: "bireysel_standart",
  usersCount: 1,
  period: "Aylık",
  showVatIncluded: true,

  // timestamps
  startAtISO: "",
  endAtISO: "",

  // ui dates
  startDate: "",
  endDate: "",
});

  const [me, setMe] = useState(null);
  const [sub, setSub] = useState(null);
  const [hydrated, setHydrated] = useState(false);
  // ✅ Son Ödemeler (ticari gibi)
const [recentPayments, setRecentPayments] = useState([]);
const [paymentsLoading, setPaymentsLoading] = useState(false);
const [paymentsError, setPaymentsError] = useState("");
const [plans, setPlans] = useState(() =>
  mapIndividualPlans([{ code: "bireysel_standart", monthlyPrice: 300 }])
);

  // iyzico
  const [showIyzicoModal, setShowIyzicoModal] = useState(false);
  const [iyzicoHtml, setIyzicoHtml] = useState("");
  const [iyzicoError, setIyzicoError] = useState("");
  const [iyzicoLoading, setIyzicoLoading] = useState(false);
  
  // contracts flow (SOL TARAF)
  const [contractChecks, setContractChecks] = useState({ kvkk: false, terms: false, sales: false });
  const [contractsConfirmed, setContractsConfirmed] = useState(false);
  const [showContractModal, setShowContractModal] = useState(null); // "kvkk" | "terms" | "sales" | null

  const contractsOk = contractChecks.kvkk && contractChecks.terms && contractChecks.sales;

  // avoid period overwrite after hydrate
  const prevRef = useRef({ period: null });

  /** =========================
   *  Hydrate: /me + /subscription/me
   *  ========================= */
 const hydrateSubscription = async () => {
  try {
    const meRes = await apiFetch("/api/auth/me");
    setMe(meRes);

    const subRes = await apiFetch("/api/subscription/me");
    const s = subRes?.subscription || subRes || null;
    setSub(s);

    const planIdRaw = String(s?.currentPlanId || s?.planCode || "bireysel_standart");
    const planId = planIdRaw;
    const period = s?.period === "Yıllık" ? "Yıllık" : "Aylık";
    const startISO = String(s?.startDate || s?.startAt || "");
    const endISO = String(s?.endDate || s?.endAt || "");

    const isDemoUser = Boolean(
      meRes?.isDemo ||
      meRes?.user?.isDemo ||
      meRes?.user?.demo ||
      s?.isDemo ||
      s?.demo ||
      planId === "demo"
    );

    const demoEndISO =
      String(
        s?.demoEnd ||
        s?.demoEndAt ||
        s?.demo_end ||
        meRes?.demoEnd ||
        meRes?.demoEndAt ||
        meRes?.user?.demoEnd ||
        meRes?.user?.demoEndAt ||
        ""
      ) || "";

    const rawEnd = isDemoUser ? (endISO || demoEndISO) : endISO;
    const fixedEndISO =
      rawEnd && String(rawEnd).length === 10 ? `${rawEnd}T23:59:59` : rawEnd;

    const startDateOnly2 = toDateOnly(startISO) || todayISO();
    const endDateOnly2 = isDemoUser
      ? (
          toDateOnly(fixedEndISO) ||
          toDateOnly(addDaysToIsoDateTime(`${startDateOnly2}T12:00:00`, 15))
        )
      : (
          toDateOnly(fixedEndISO) || ""
        );

    setState((st) => ({
      ...st,
      currentPlanId: isDemoUser ? "demo" : (planId || "bireysel_standart"),
      period,
      startAtISO: startISO,
      endAtISO: fixedEndISO || "",
      startDate: startDateOnly2,
      endDate: endDateOnly2,
    }));

    prevRef.current.period = period;
  } catch (e) {
    console.warn("Hydrate error:", e?.message);
  } finally {
    setHydrated(true);
  }
};

useEffect(() => {
  hydrateSubscription();
}, []);

useEffect(() => {
  const onFocus = () => hydrateSubscription();
  const onVisible = () => {
    if (document.visibilityState === "visible") hydrateSubscription();
  };

  window.addEventListener("focus", onFocus);
  document.addEventListener("visibilitychange", onVisible);

  return () => {
    window.removeEventListener("focus", onFocus);
    document.removeEventListener("visibilitychange", onVisible);
  };
}, []);

useEffect(() => {
  let alive = true;

  (async () => {
    try {
      const res = await apiFetch("/api/plans");
      if (!alive) return;
      setPlans(mapIndividualPlans(res));
    } catch (e) {
      console.warn("Bireysel planlar okunamadı:", e?.message);
    }
  })();

  return () => {
    alive = false;
  };
}, []);

useEffect(() => {
  if (!hydrated) return;

  (async () => {
    setPaymentsLoading(true);
    setPaymentsError("");
    try {
      // Backend farklı isimle sunabilir diye 2 endpoint deniyoruz (ilk çalışan kullanılır)
      const tryFetch = async (url) => {
        try {
          return await apiFetch(url);
        } catch {
          return null;
        }
      };

      const r1 = await tryFetch("/api/billing/transactions/recent");
const r2 = null;
      const raw = r1?.items || r1?.payments || [];
      const list = Array.isArray(raw) ? raw : [];

      // sadece başarılı + son 6
      const okList = list
        .filter((p) => String(p?.status || p?.paymentStatus || "success").toLowerCase() === "success")
        .slice(0, 6);

      setRecentPayments(okList);
    } catch (e) {
      setPaymentsError(e?.message || "Son ödemeler alınamadı");
      setRecentPayments([]);
    } finally {
      setPaymentsLoading(false);
    }
  })();
}, [hydrated, sub?.endDate, sub?.endAt, me?.user?.demo, me?.demo]);0

  // period changed: only if not locked by endAtISO (keep real endAt)
  useEffect(() => {
  if (!hydrated) return;
  const prev = prevRef.current;
  const changed = prev.period !== state.period;

  if (changed) {
    setState((s) => {
      // gerçek abonelik bitişi varsa onu koru
      if (s.endAtISO) {
        return { ...s, endDate: toDateOnly(s.endAtISO) || s.endDate };
      }

      // demo kullanıcıda period değişince fallback hesap yapılabilir
      if (s.currentPlanId === "demo") {
        const start = s.startDate || todayISO();
        const end =
          s.period === "Yıllık"
            ? toDateOnly(addDaysToIsoDateTime(`${start}T12:00:00`, 365))
            : toDateOnly(addDaysToIsoDateTime(`${start}T12:00:00`, 15));
        return { ...s, endDate: end };
      }

      // ödeme yapılmamış / gerçek endAt yoksa sahte 30-365 üretme
      return { ...s, endDate: "" };
    });
  }

  prevRef.current.period = state.period;
}, [state.period, hydrated]);

  /** =========================
   *  Derived
   *  ========================= */
  const currentPlan = useMemo(
    () => plans.find((p) => p.id === state.currentPlanId) || plans[0],
    [plans, state.currentPlanId]
  );

 const countdown = useMemo(() => {
  const endVal =
    state.endAtISO ||
    (state.endDate ? `${state.endDate}T23:59:59` : "");

  if (!endVal) return { days: 0, hms: "00:00:00" };

  return getCountdown(endVal);
}, [state.endAtISO, state.endDate, tick]);

 const daysLeft = countdown.days;

// ✅ Mevcut abonelik (backend'den gelen gerçek değerler)
const currentPeriod = useMemo(() => {
  if (!sub?.startDate && !sub?.endDate) return state.period || "Aylık";
  return sub?.period === "Yıllık" ? "Yıllık" : "Aylık";
}, [sub, state.period]);
const isDemoUser = useMemo(() => state.currentPlanId === "demo", [state.currentPlanId]);
const isYearlyLocked = useMemo(() => currentPeriod === "Yıllık" && !isDemoUser, [currentPeriod, isDemoUser]);
// kalan gün (yenileme kuralı için)
const canRenewNow = useMemo(() => daysLeft <= 3, [daysLeft]);

// ✅ Senaryo tespiti
const scenario = useMemo(() => {
  if (isDemoUser) return "NEW";
  if (currentPeriod === "Yıllık") return "YEARLY_LOCKED";
  if (currentPeriod === "Aylık" && state.period === "Yıllık") return "MONTHLY_TO_YEARLY";
  if (currentPeriod === state.period) return "RENEW_SAME_PERIOD";
  return "OTHER";
}, [isDemoUser, currentPeriod, state.period]);

// ✅ Ödeme butonu aktiflik kuralı
const canPayNow = useMemo(() => {
  if (!contractsConfirmed) return false;

  if (scenario === "NEW") return true;
  if (scenario === "MONTHLY_TO_YEARLY") return true;
  if (scenario === "RENEW_SAME_PERIOD") return canRenewNow;
  if (scenario === "YEARLY_LOCKED") return canRenewNow;

  return false;
}, [contractsConfirmed, scenario, canRenewNow]);
// seçilen plan/period fiyatları (KDV hariç)
const selectedExVat = useMemo(() => {
  return Number(state.period === "Yıllık" ? currentPlan.yearlyExVat : currentPlan.monthlyExVat) || 0;
}, [state.period, currentPlan]);

const currentExVat = useMemo(() => {
  return Number(currentPeriod === "Yıllık" ? currentPlan.yearlyExVat : currentPlan.monthlyExVat) || 0;
}, [currentPeriod, currentPlan]);

// ✅ Prorate kredi: kalan gün * (mevcut dönem fiyatı / dönem gün sayısı)
const prorateCreditExVat = useMemo(() => {
  if (isDemoUser) return 0;
  const totalDays = currentPeriod === "Yıllık" ? 365 : 30;
  const remain = Math.max(0, Number(daysLeft || 0));
  const credit = (currentExVat * remain) / totalDays;
  return Math.max(0, Math.round(credit));
}, [isDemoUser, currentPeriod, currentExVat, daysLeft]);

// ✅ Ödenecek tutar (KDV hariç) — kurallar:
// - aynı dönem: 0
// - aylık->yıllık: (yıllık - kredi) görünsün
// - yıllık pakette her durumda 0
const payExVat = useMemo(() => {
  if (scenario === "NEW") return selectedExVat;

  // yıllık aktif kullanıcıda normalde 0,
  // ama süre bittiyse yıllık yenileme fiyatı görünmeli
  if (scenario === "YEARLY_LOCKED") {
  return daysLeft <= 3 ? selectedExVat : 0;
}

  if (scenario === "MONTHLY_TO_YEARLY") {
    return Math.max(0, Math.round(selectedExVat - prorateCreditExVat));
  }

  // aynı dönem yenileme:
  // süre devam ediyorsa 0,
  // süre bittiyse seçili dönemin normal fiyatı görünmeli
  if (scenario === "RENEW_SAME_PERIOD") {
  return daysLeft <= 3 ? selectedExVat : 0;
}

  return 0;
}, [scenario, selectedExVat, prorateCreditExVat, daysLeft]);
const payVat = useMemo(() => Math.round(payExVat * VAT_RATE), [payExVat]);
const payIncVat = useMemo(() => payExVat + payVat, [payExVat, payVat]);

const summaryExVat = state.showVatIncluded ? Math.round(payIncVat / (1 + VAT_RATE)) : payExVat;
const summaryVat = state.showVatIncluded ? payIncVat - summaryExVat : payVat;
const summaryTotal = state.showVatIncluded ? payIncVat : payExVat;

  const badge = useMemo(() => {
  if (state.currentPlanId === "demo") {
    return { text: "DEMO", cls: "bg-yellow-100 text-yellow-800 border-yellow-200" };
  }
  if (currentPeriod === "Yıllık") {
    return { text: "Kampanya", cls: "bg-green-100 text-green-800 border-green-200" };
  }
  return { text: "Aktif", cls: "bg-blue-50 text-blue-700 border-blue-200" };
}, [state.currentPlanId, currentPeriod]);

  /** =========================
   *  Actions
   *  ========================= */
  const kaydet = async () => {
    try {
      await apiFetch("/api/subscription/update", {
        method: "PUT",
        body: JSON.stringify({
          currentPlanId: state.currentPlanId,
          usersCount: state.usersCount,
          period: state.period,
          showVatIncluded: state.showVatIncluded,
          autoRenew: state.autoRenew,
        }),
      });
      alert("Ayarlar kaydedildi ✅");
    } catch (e) {
      alert(e?.message || "Kaydetme sırasında hata oluştu");
    }
  };

  // Demo -> normal paket geçişi: plan seçtiriyoruz (sol karttan)
  

  // SOL: sözleşmeler tamam -> devam
  const continueAfterContracts = () => {
    if (!contractsOk) {
      alert("Devam etmek için sözleşmeleri onaylayınız.");
      return;
    }
    setContractsConfirmed(true);
  };

  // ✅ iyzico readiness check (env/client)
const checkIyzicoReady = async () => {
  try {
    const info = await apiFetch("/api/billing/iyzico/api-info");
    // beklenen: { ok:true, hasKeys:true/false, clientReady:true/false, env:"development" }
    if (!info?.hasKeys || !info?.clientReady) {
      return {
        ok: false,
        message:
          "Ödeme altyapısı aktif değil. (IYZICO env eksik / client hazır değil)",
        info,
      };
    }
    return { ok: true, info };
  } catch (e) {
    return { ok: false, message: e?.message || "iyzico api-info alınamadı" };
  }
};

// iyzico
const iyzicoOde = async () => {
  try {
    if (!contractsConfirmed) {
      alert("Ödeme için önce sözleşmeleri onaylayıp Devam Et demelisiniz.");
      return;
    }

    setIyzicoError("");
    setIyzicoLoading(true);

    // ✅ 1) önce altyapı kontrolü
    const ready = await checkIyzicoReady();
    if (!ready.ok) {
      throw new Error(ready.message || "iyzico hazır değil");
    }

   // ✅ 2) payload (KDV DAHİL net tutarı backend'e taşı → iyzico ile birebir aynı olur)
const isYearly = String(state.period || "").toLowerCase().includes("yıl");
const payableIncVat = Number(payIncVat || 0); // ✅ her zaman KDV DAHİL (tahsilat kuralı)

// güvenlik: 0₺ ise iyzico başlatma (yenileme ekranında 0 gösteriyoruz zaten)
if (!(payableIncVat > 0)) {
  alert("Bu işlem için ödeme gerekmiyor (0 ₺).");
  return;
}

const planId = (state.currentPlanId === "demo" ? "bireysel_standart" : state.currentPlanId) || "bireysel_standart";

const payload = {
  // backend /billing.js planId/currentPlanId/planCode okuyor → hepsini verelim (tek seferde kesin)
  planId,
  currentPlanId: planId,
  planCode: planId,

  usersCount: state.usersCount,
  period: state.period,
  months: isYearly ? 12 : 1,

  // ✅ kritik: backend amount override alanları
  amount: Math.round(payableIncVat),
  amountTRY: Math.round(payableIncVat),
  payableTRY: Math.round(payableIncVat),
  expectedAmountTRY: Math.round(payableIncVat),

  showVatIncluded: state.showVatIncluded,
  type: scenario === "NEW" ? "NEW" : "UPGRADE",
};

    // ✅ 3) Artık direkt iyzico açma.
// ✅ Önce Odeme.jsx sayfasına gönder → fatura bilgileri alınsın → sonra iyzico açılsın.
const params = new URLSearchParams({
  plan: planId,
  period: state.period,
  org: me?.organizationUuid || me?.organizationId || me?.user?.organizationUuid || "",
  agreements: "1",
  type: scenario === "NEW" ? "NEW" : "UPGRADE",
  users: String(state.usersCount || 1),
  amount: String(Math.round(payableIncVat)),
});

window.location.href = `/odeme?${params.toString()}`;
return;

  } catch (e) {
    // ✅ Daha açıklayıcı mesaj
    const msg = String(e?.message || "iyzico başlatılamadı");

    // Bu hata sende geliyor: "api bilgileri bulunamadı"
    // Genelde iyzico tarafı KEY/SECRET/BASE_URL (sandbox/prod) uyuşmazlığı veya yanlış bilgilerde döner.
    const hint =
      msg.toLowerCase().includes("api bilgileri bulunamadı")
        ? "\n\nNot: Bu hata genelde IYZICO_API_KEY / IYZICO_SECRET_KEY veya IYZICO_BASE_URL (sandbox/prod) uyumsuz olduğunda gelir."
        : "";

    setIyzicoError(msg + hint);
    setShowIyzicoModal(true);
  } finally {
    setIyzicoLoading(false);
  }
};

  return (
    <div className="max-w-6xl mx-auto mt-6 space-y-6">
      {/* Header */}
      <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-[#0a2b45] to-[#0f4c81] text-white">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold">💳 Abonelik & Ödemeler</h2>
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${badge.cls}`}>
                  {badge.text}
                </span>
              </div>
              <p className="text-white/80 text-sm mt-1">
                Abonelik işlemlerinizi buradan yönetebilirsiniz. Ödeme işlemleri iyzico üzerinden güvenli şekilde gerçekleştirilir.
              </p>
            </div>

            <div className="md:text-right">
              <div className="text-white/70 text-xs">Kalan Süre</div>
              <div className="text-2xl font-extrabold leading-tight">{daysLeft} gün</div>
              <div className="text-white/80 text-xs mt-1">
  Bitiş: <span className="font-semibold">{state.endDate ? toDateOnly(state.endDate) : "-"}</span>
  <span className="ml-2 text-[11px] text-white/70 tabular-nums">{countdown.hms}</span>
</div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* Main grid: SOL (Paket+Sözleşme+Faturalandırma) | SAĞ (Ödeme aynen) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* SOL */}
            <div className="rounded-2xl border bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs text-gray-500">Paket</div>
                  <div className="text-lg font-bold text-[#0a2b45] mt-1">{currentPlan.name}</div>
                  <div className="text-sm text-gray-600 mt-1 italic">{currentPlan.note}</div>
                </div>

               {(currentPeriod === "Yıllık" || state.period === "Yıllık") && (
  <div className="px-3 py-1.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
    🎁 2 ay bizden
  </div>
)}
              </div>

                          

              {/* ✅ SÖZLEŞMELER: Faturalandırmanın ÜSTÜ (istediğin yer) */}
              <div className="mt-5 rounded-2xl border bg-white p-5">
                <div className="flex items-start justify-between">
                  <div>
                   <div className="text-lg font-bold text-[#0a2b45]">Sözleşmeler ve Onaylar</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Devam edince sağdaki ödeme alanı aynen kalır, iyzico ile ödeme açılır.
                    </div>
                  </div>

                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                      contractsConfirmed
                        ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                        : "bg-yellow-100 text-yellow-700 border-yellow-200"
                    }`}
                  >
                    {contractsConfirmed ? "Hazır" : "Süreçte"}
                  </span>
                </div>

                <div className="mt-4 space-y-3 text-sm text-gray-800">
                  {/* KVKK */}
                  <div className="flex flex-col">
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={contractChecks.kvkk}
                        onChange={(e) =>
                          setContractChecks((c) => ({ ...c, kvkk: e.target.checked }))
                        }
                      />
                      <div className="leading-snug">KVKK Aydınlatma Metni</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowContractModal("kvkk")}
                      className="ml-6 text-emerald-700 hover:text-emerald-800 underline text-sm font-semibold w-fit"
                    >
                      Metni Gör
                    </button>
                  </div>

                  {/* TERMS */}
                  <div className="flex flex-col">
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={contractChecks.terms}
                        onChange={(e) =>
                          setContractChecks((c) => ({ ...c, terms: e.target.checked }))
                        }
                      />
                      <div className="leading-snug">Kullanım Koşulları</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowContractModal("terms")}
                      className="ml-6 text-emerald-700 hover:text-emerald-800 underline text-sm font-semibold w-fit"
                    >
                      Metni Gör
                    </button>
                  </div>

                  {/* SALES */}
                  <div className="flex flex-col">
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={contractChecks.sales}
                        onChange={(e) =>
                          setContractChecks((c) => ({ ...c, sales: e.target.checked }))
                        }
                      />
                      <div className="leading-snug">Satış / Ödeme Sözleşmesi</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowContractModal("sales")}
                      className="ml-6 text-emerald-700 hover:text-emerald-800 underline text-sm font-semibold w-fit"
                    >
                      Metni Gör
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={continueAfterContracts}
                    className={`${BTN_GREEN} w-full sm:w-auto`}
                    disabled={!contractsOk}
                  >
                    Devam Et
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setContractsConfirmed(false);
                      setContractChecks({ kvkk: false, terms: false, sales: false });
                    }}
                    className={`${BTN_OUTLINE} w-full sm:w-auto`}
                  >
                    Vazgeç
                  </button>
                </div>
              </div>

              {/* Faturalandırma (SÖZLEŞMELERİN ALTINDA) */}
              <div className="mt-5">
                <div className="text-sm font-medium text-gray-700">Faturalandırma Dönemi</div>

                <div className="mt-2 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                  

<select
  value={isYearlyLocked ? "Yıllık" : state.period}
  onChange={(e) => setState((s) => ({ ...s, period: e.target.value }))}
  disabled={isYearlyLocked}
  className={`w-full sm:w-64 border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-400 ${
    isYearlyLocked ? "bg-gray-100 text-gray-600 cursor-not-allowed" : ""
  }`}
>
  <option>Aylık</option>
  <option>Yıllık</option>
</select>

                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={state.showVatIncluded}
                      onChange={(e) => setState((s) => ({ ...s, showVatIncluded: e.target.checked }))}
                      className="h-4 w-4"
                    />
                    KDV Dahil Göster
                  </label>
                </div>

                <div className="text-xs text-gray-500 mt-1">
                  {(isYearlyLocked ? "Yıllık" : state.period) === "Yıllık"
  ? "Yıllıkta 10 ay ücret / 2 ay bizden kampanyası uygulanır."
  : "Aylık ücretlendirme uygulanır."}
                </div>
              </div>

              {/* Özellikler */}
              <div className="mt-5">
                <div className="text-sm font-medium text-gray-700">Özellikler</div>
                <ul className="mt-2 text-sm text-gray-700 space-y-1">
                  {(currentPlan.features || []).map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-gray-400" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              
            </div>

            {/* SAĞ (Ödeme aynen kalır; sadece buton sözleşme sonrası aktif) */}
            <div className="rounded-2xl border bg-white p-5">
              <div className="flex items-start justify-between gap-4">
  <div>
    <div className="text-xs text-gray-500">Ödeme</div>
    <div className="text-lg font-bold text-[#0a2b45] mt-1">Ödeme Özeti</div>
    <div className="text-xs text-gray-500 mt-1">
      Ödeme işlemleri iyzico üzerinden güvenli şekilde gerçekleştirilir.
    </div>
  </div>

 </div>

              <div className="mt-5 rounded-2xl border bg-gray-50 p-4">
                <div className="text-sm font-semibold text-gray-800">Ödenecek Tutar</div>

                <div className="mt-3 space-y-2 text-sm text-gray-700">
                  <div className="flex justify-between">
                    <span>KDV Hariç</span>
                    <span className="font-medium">{trCurrency(summaryExVat)}</span>
                  </div>

                  <div className="flex justify-between">
                    <span>KDV (%20)</span>
                    <span className="font-medium">{trCurrency(summaryVat)}</span>
                  </div>

                  <div className="flex justify-between border-t pt-2">
                    <span className="font-semibold">{state.showVatIncluded ? "KDV Dahil Toplam" : "Toplam"}</span>
                    <span className="font-semibold">{trCurrency(summaryTotal)}</span>
                  </div>

                  <div className="text-xs text-gray-500 pt-1">
  {daysLeft <= 0
    ? state.period === "Yıllık"
      ? "Süresi biten abonelik için yıllık yenileme ücreti gösterilmektedir."
      : "Süresi biten abonelik için aylık yenileme ücreti gösterilmektedir."
    : state.period === "Yıllık"
    ? "Yıllık ücretlendirme (10 ay ücret / 2 ay bizden)."
    : "Aylık ücretlendirme."}
</div>
{scenario === "MONTHLY_TO_YEARLY" && !isDemoUser && (
  <div className="mt-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl p-2">
    <b>Kalan süre indirimi:</b> Mevcut aboneliğinizde kalan <b>{daysLeft} gün</b> için hesaplanan tutar
    (<b>{trCurrency(prorateCreditExVat)}</b> KDV hariç) ödeme tutarından düşülür ve sadece fark ücret tahsil edilir.
  </div>
)}

{(scenario === "RENEW_SAME_PERIOD" || scenario === "YEARLY_LOCKED") && daysLeft > 3 && (
  <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl p-2">
    Yenileme ödemesi, bitiş tarihine <b>son 3 gün</b> kala açılır. (Kalan: <b>{daysLeft} gün</b>)
  </div>
)}

<div className="mt-4 flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={iyzicoOde}
                      className={`${BTN_IYZICO} w-full flex items-center justify-center`}
                      disabled={iyzicoLoading || !canPayNow}
title={
  !contractsConfirmed
    ? "Önce sözleşmeleri onaylayıp Devam Et demelisiniz."
    : !canPayNow
    ? "Yenileme ödemesi sadece bitişe son 3 gün kala açılır."
    : ""
}
                     
                    >
                      {iyzicoLoading ? (
                        "Başlatılıyor..."
                      ) : (
                        <img
                          src="/iyzico-pay.png"
                          alt="iyzico ile öde"
                          className="h-5 sm:h-6 w-auto block"
                          draggable={false}
                        />
                      )}
                    </button>

                   

  {!contractsConfirmed && (
    <div className="text-xs text-gray-500 text-center">
      Ödeme yapabilmek için soldaki sözleşmeleri onaylayıp <b>Devam Et</b> butonuna basmanız gerekir.
    </div>
  )}
</div>
                </div>
              </div>

            {/* ✅ Son Ödemeler (ticari gibi) */}
<div className="mt-5">
  <div className="text-sm font-semibold text-gray-800">Son Ödemeler</div>

  <div className="mt-2 rounded-2xl border bg-white overflow-hidden">
    {paymentsLoading ? (
      <div className="p-4 text-sm text-gray-600">Yükleniyor...</div>
    ) : paymentsError ? (
      <div className="p-4 text-sm text-red-600">{paymentsError}</div>
    ) : (recentPayments || []).length === 0 ? (
      <div className="p-4 text-sm text-gray-600">Henüz başarılı ödeme kaydı bulunmuyor.</div>
    ) : (
      <div className="divide-y">
        {(recentPayments || []).slice(0, 6).map((p, i) => {
          const rawType = String(p?.type || p?.paymentType || "PAYMENT").toUpperCase();
          const typeLabel =
            rawType === "UPGRADE"
              ? "Paket Yükseltme"
              : rawType === "ADD_USERS"
              ? "Ek Kullanıcı"
              : rawType === "OFFER"
              ? "Teklif"
              : rawType === "NEW"
              ? "Yeni Satın Alma"
              : rawType;

          const dt = p?.date || p?.createdAt || p?.created_at || p?.paidAt || p?.paid_at;
          const dtText = dt
            ? new Date(dt).toLocaleString("tr-TR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "-";

          const amount = Number(p?.amountTRY ?? p?.amount ?? p?.price_try ?? 0);
         const payPeriodRaw = String(p?.period || p?.billingPeriod || p?.planPeriod || "").toLowerCase();

// bireysel aylık KDV dahil baz tutar (frontend planından)
const monthlyIncVat = Math.round(Number(currentPlan?.monthlyExVat || 0) * (1 + VAT_RATE));

// period varsa onu kullan, yoksa tutardan tahmin et
const isYearlyPay =
  payPeriodRaw.includes("yıl") ||
  payPeriodRaw.includes("year") ||
  (monthlyIncVat > 0 && amount >= monthlyIncVat * 5); // ✅ yıllık ≈ 10x, güvenli eşik

const planLabel = isYearlyPay ? "Bireysel Yıllık Paket" : "Bireysel Aylık Paket";
          return (
            <div
  key={p?.id || p?._id || i}
  className="px-4 py-3 flex items-center justify-between gap-3"
>
  <div className="min-w-0 flex items-center gap-2">
    <span className="text-sm font-semibold text-gray-800 truncate">
      {planLabel}
    </span>

    <span className="text-[11px] px-2 py-0.5 rounded-full border bg-gray-50 text-gray-600 whitespace-nowrap">
      {typeLabel}
    </span>

    <span className="text-xs text-gray-500 whitespace-nowrap">
      {dtText}
    </span>
  </div>

  <div className="text-sm font-bold text-gray-900 whitespace-nowrap">
    {trCurrency(amount)}
  </div>
</div>
          );
        })}
      </div>
    )}
  </div>
</div>

             
            </div>
          </div>
        </div>
      </div>

      {/* ✅ iyzico Checkout Modal */}
      {showIyzicoModal && (
        <div className="fixed inset-0 z-[110] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-gray-800">iyzico Ödeme</h4>
              <button
                onClick={() => {
                  setShowIyzicoModal(false);
                  setIyzicoHtml("");
                  setIyzicoError("");
                }}
                className="text-gray-500 hover:text-gray-700"
                type="button"
              >
                ✕
              </button>
            </div>

           {iyzicoError ? (
  <div className="border rounded-xl p-3 bg-red-50 text-sm text-red-700">
    {iyzicoError}
  </div>
) : (
  <iframe
  title="iyzico-checkout"
  className="w-full min-h-[650px] border-0 rounded-xl"
  style={{ transform: "scale(1.1)", transformOrigin: "top center" }}
  srcDoc={iyzicoHtml || "<div></div>"}
  sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-top-navigation-by-user-activation"
/>
)}

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  setShowIyzicoModal(false);
                  setIyzicoHtml("");
                  setIyzicoError("");
                }}
                className={BTN_OUTLINE}
                type="button"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}


          {/* ✅ Sözleşme Modal */}
      {showContractModal && (
        <div className="fixed inset-0 z-[130] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-gray-800">
                {showContractModal === "kvkk" && "KVKK Aydınlatma Metni"}
                {showContractModal === "terms" && "Kullanım Koşulları"}
                {showContractModal === "sales" && "Satış / Ödeme Sözleşmesi"}
              </h4>

              <button
                type="button"
                onClick={() => setShowContractModal(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="text-sm text-gray-700 whitespace-pre-line max-h-[65vh] overflow-y-auto pr-1">
              {showContractModal === "kvkk" && KVKK_TEXT}
              {showContractModal === "terms" && TERMS_TEXT}
              {showContractModal === "sales" && SALES_TEXT}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}