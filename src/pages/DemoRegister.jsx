import { useState } from "react";
import axios from "axios";
import { API_BASE } from "../config/api";

/* ================= MODAL ================= */
function Modal({ open, title, children, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-white rounded-xl shadow-xl">
          <div className="flex justify-between items-center px-5 py-3 border-b">
            <h3 className="font-semibold">{title}</h3>
            <button
              onClick={onClose}
              className="text-blue-600 hover:text-blue-700 font-semibold"
            >
              Kapat
            </button>
          </div>

          <div className="px-5 py-4 max-h-[70vh] overflow-auto text-sm leading-6">
            {children}
          </div>

          <div className="px-5 py-3 border-t text-right">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-md bg-blue-600 text-white font-semibold hover:bg-blue-700"
            >
              Kapat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================= KVKK ================= */
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

/* ================= TERMS ================= */
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
      <li>Bakım/planlı kesintiler mümkün oldukça önceden duyurulur.</li>
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

/* ================= DEMO ================= */
const formatName = (v) =>
  v.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());

const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;

export default function DemoRegister() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  const [acceptKvkk, setAcceptKvkk] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  const [modal, setModal] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    if (!acceptKvkk || !acceptTerms) {
      setError("KVKK ve Kullanım Koşullarını onaylamalısınız.");
      return;
    }

    if (!name || !email || !password || !password2) {
      setError("Lütfen tüm alanları doldurun.");
      return;
    }

    if (password !== password2) {
      setError("Şifreler uyuşmuyor.");
      return;
    }

    if (!PASSWORD_REGEX.test(password)) {
      setError("Şifre kuralı hatalı.");
      return;
    }

    try {
      setLoading(true);
      const res = await axios.post(`${API_BASE}/auth/demo/register`, {
        name: formatName(name).trim(),
        email: email.trim().toLowerCase(),
        password,
      });

      const token = res.data?.token;
      if (!token) return setError("Token yok");

      window.location.href = `/demo-landing?token=${encodeURIComponent(token)}`;
    } catch (e) {
      setError(e.response?.data?.message || "Demo hata");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8">
        <img src="/logo-login.png" alt="İSG Panel" className="mx-auto h-16 mb-4" />

        <h2 className="text-xl font-bold text-center mb-2">Demo Başlat</h2>

        <p className="text-xs text-gray-600 text-center mb-6">
          15 gün ücretsiz demo. Ödeme alınmaz.
        </p>

        {error && <div className="mb-3 text-sm text-red-600">{error}</div>}

        <form onSubmit={submit} className="space-y-3">
          <input
            className="w-full border rounded-lg px-4 py-2"
            placeholder="Ad Soyad"
            value={name}
            onChange={(e) => setName(formatName(e.target.value))}
          />

          <input
            className="w-full border rounded-lg px-4 py-2"
            placeholder="E-posta"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            className="w-full border rounded-lg px-4 py-2"
            placeholder="Şifre"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <input
            type="password"
            className="w-full border rounded-lg px-4 py-2"
            placeholder="Şifre Tekrar"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
          />

          {/* KVKK + TERMS */}
          <div className="bg-slate-50 border rounded-lg p-3 text-sm">
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={acceptKvkk}
                onChange={(e) => setAcceptKvkk(e.target.checked)}
              />
              <label>
                KVKK Aydınlatma Metni’ni kabul ediyorum
                <button
                  type="button"
                  onClick={() => setModal("kvkk")}
                  className="ml-2 text-emerald-600 font-semibold"
                >
                  Metni Gör
                </button>
              </label>
            </div>

            <div className="flex items-start gap-2 mt-2">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
              />
              <label>
                Kullanım Koşulları’nı kabul ediyorum
                <button
                  type="button"
                  onClick={() => setModal("terms")}
                  className="ml-2 text-emerald-600 font-semibold"
                >
                  Metni Gör
                </button>
              </label>
            </div>
          </div>

          <button
            disabled={loading}
            className="w-full h-10 rounded-lg bg-emerald-600 text-white font-semibold"
          >
            {loading ? "Oluşturuluyor..." : "Demoyu Başlat"}
          </button>
        </form>
      </div>

      {/* KVKK MODAL */}
      <Modal
        open={modal === "kvkk"}
        title="KVKK Aydınlatma Metni"
        onClose={() => setModal(null)}
      >
        {KVKK_TEXT}
      </Modal>

      {/* TERMS MODAL */}
      <Modal
        open={modal === "terms"}
        title="Kullanım Koşulları"
        onClose={() => setModal(null)}
      >
        {TERMS_TEXT}
      </Modal>
    </div>
  );
}