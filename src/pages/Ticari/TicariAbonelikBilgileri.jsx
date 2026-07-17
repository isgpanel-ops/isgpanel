// TicariAbonelikBilgileri.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";

// ✅ DOĞRUSU (LOCAL)
const todayISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const trCurrency = (n) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(Number(n || 0));

const KVKK_TEXT = (
  <>
    <p className="font-semibold">KVKK Aydınlatma Metni</p>
    <p className="text-xs text-slate-500 mt-1">Son güncelleme: 24.02.2026</p>

    <p className="mt-3 font-semibold">1. Veri Sorumlusu</p>
    <p className="mt-1">
      6698 sayılı Kişisel Verilerin Korunması Kanunu (“KVKK”) uyarınca, kişisel verileriniz; veri
      sorumlusu sıfatıyla Mehmet Arıkan (İSG Panel) tarafından işlenebilecektir.
    </p>

    <p className="mt-3 font-semibold">2. İşlenen Kişisel Veriler</p>
    <ul className="list-disc ml-5 mt-1 space-y-1">
      <li>Kimlik ve iletişim bilgileri (ad, soyad, e-posta, telefon)</li>
      <li>Firma ve görev bilgileri</li>
      <li>İSG eğitim, belge ve kayıt bilgileri</li>
      <li>Kullanıcı işlem ve işlem güvenliği kayıtları (log, IP, oturum, cihaz/çerez bilgileri)</li>
      <li>Finans ve ödeme bilgileri (fatura bilgileri, abonelik/paket bilgileri, ödeme işlem kayıtları)</li>
    </ul>

    <p className="mt-3 font-semibold">3. İşlenme Amaçları</p>
    <ul className="list-disc ml-5 mt-1 space-y-1">
      <li>İSG Panel (www.isgpanel.tr) yazılım hizmetinin sunulması</li>
      <li>Kullanıcı hesabı oluşturma ve yönetimi</li>
      <li>İSG süreçlerinin dijital takibi, kayıtların tutulması ve belge üretimi</li>
      <li>Destek taleplerinin yönetilmesi ve kullanıcı deneyiminin iyileştirilmesi</li>
      <li>Mevzuattan doğan yükümlülüklerin yerine getirilmesi</li>
      <li>Abonelik, ödeme ve finans süreçlerinin yürütülmesi</li>
      <li>Bilgi güvenliği süreçlerinin yürütülmesi ve suistimallerin önlenmesi</li>
    </ul>

    <p className="mt-3 font-semibold">4. Hukuki Sebepler</p>
    <p className="mt-1">
      Kişisel verileriniz KVKK m.5/2 kapsamında; sözleşmenin kurulması ve ifası (m.5/2-c), hukuki
      yükümlülüklerin yerine getirilmesi (m.5/2-ç), bir hakkın tesisi/kullanılması/korunması (m.5/2-e)
      ve veri sorumlusunun meşru menfaati (m.5/2-f) hukuki sebeplerine dayanılarak işlenmektedir.
    </p>
    <p className="mt-2 text-sm">
      Not: Kanun’da öngörülen haller dışında açık rıza gerektiren pazarlama/iletişim faaliyetleri
      yürütülmesi halinde ayrıca açık rızanız talep edilecektir.
    </p>

    <p className="mt-3 font-semibold">5. Aktarım</p>
    <p className="mt-1">
      Kişisel verileriniz; barındırma ve altyapı hizmeti alınan teknoloji sağlayıcılarına,
      ödeme/finans kuruluşlarına (örn. iyzico gibi ödeme hizmeti sağlayıcıları) ve yetkili kamu kurum
      ve kuruluşlarına KVKK’nın 8 ve 9. maddelerine uygun olarak aktarılabilecektir.
    </p>
    <p className="mt-2">
      Yurt dışına aktarım söz konusu olması halinde, KVKK m.9 kapsamındaki usul ve esaslara uygun
      hareket edilir.
    </p>

    <p className="mt-3 font-semibold">6. Saklama Süresi</p>
    <p className="mt-1">
      Kişisel verileriniz, hizmet ilişkisi süresince ve ilgili mevzuatta öngörülen süreler boyunca
      saklanır. Saklama süresi sonunda veriler; KVKK ve ilgili mevzuata uygun olarak silinir, yok
      edilir veya anonim hale getirilir.
    </p>

    <p className="mt-3 font-semibold">7. Haklarınız (KVKK m.11)</p>
    <ul className="list-disc ml-5 mt-1 space-y-1">
      <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme</li>
      <li>Kişisel verileriniz işlenmişse buna ilişkin bilgi talep etme</li>
      <li>İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme</li>
      <li>Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme</li>
      <li>Eksik veya yanlış işlenmişse düzeltilmesini isteme</li>
      <li>KVKK’da öngörülen şartlar çerçevesinde silinmesini veya yok edilmesini isteme</li>
      <li>Düzeltme/silme/yok etme işlemlerinin aktarılan üçüncü kişilere bildirilmesini isteme</li>
      <li>
        İşlenen verilerin münhasıran otomatik sistemler ile analiz edilmesi suretiyle aleyhinize bir
        sonucun ortaya çıkmasına itiraz etme
      </li>
      <li>Kanuna aykırı işlenmesi sebebiyle zarara uğramanız hâlinde zararın giderilmesini talep etme</li>
    </ul>

    <p className="mt-3 font-semibold">8. Başvuru</p>
    <p className="mt-1">
      KVKK kapsamındaki taleplerinizi <b>isgpanel@gmail.com</b> adresine e-posta göndererek
      iletebilirsiniz.
    </p>
    <p className="mt-2">
      Başvurunuzda; ad-soyad, başvuru konusu, iletişim bilgileriniz ve talebinize ilişkin açıklamaların
      yer alması önerilir.
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
      İşbu Üyelik Sözleşmesi (“Sözleşme”); Mehmet Arıkan (İSG Panel) (“Hizmet Sağlayıcı”) ile İSG Panel
      platformuna üye olan kullanıcı (“Kullanıcı”) arasında elektronik ortamda kurulmuş ve yürürlüğe
      girmiştir.
    </p>

    <p className="mt-3 font-semibold">2. Tanımlar</p>
    <ul className="list-disc ml-5 mt-1 space-y-1">
      <li>
        <b>Platform:</b> İSG Panel web sitesi ve/veya uygulaması.
      </li>
      <li>
        <b>Hizmet:</b> İSG süreçlerinin dijital takibi, doküman/belge yönetimi, raporlama, görev/hatırlatma
        ve benzeri SaaS modüllerinin sunulması.
      </li>
      <li>
        <b>Hesap:</b> Kullanıcı’nın Platform’a erişim sağladığı üyelik hesabı.
      </li>
      <li>
        <b>İçerik/Veri:</b> Kullanıcı’nın Platform’a yüklediği, oluşturduğu veya girdiği her türlü bilgi,
        doküman ve kayıt.
      </li>
      <li>
        <b>Plan/Paket:</b> Platform’un ücretli/ücretsiz kullanım kapsamını ve limitlerini belirleyen abonelik
        planı (kullanıcı sayısı, modül erişimi, depolama vb.).
      </li>
      <li>
        <b>Abonelik Dönemi:</b> Seçilen pakete göre aylık/yıllık kullanım süresi.
      </li>
    </ul>

    <p className="mt-3 font-semibold">3. Konu ve Kapsam</p>
    <p className="mt-1">
      Sözleşmenin konusu; Kullanıcı’nın Platform’a üye olarak Hizmet’ten yararlanmasına ve Hizmet
      Sağlayıcı’nın Hizmet’i sunmasına ilişkin şartların belirlenmesidir. Platform kapsamı, modüller,
      kullanım limitleri ve özellikler seçilen Plan/Paket’e göre değişiklik gösterebilir.
    </p>

    <p className="mt-3 font-semibold">4. Üyelik ve Hesap Güvenliği</p>
    <ul className="list-disc ml-5 mt-1 space-y-1">
      <li>Üyelik sırasında sağlanan bilgilerin doğru, güncel ve eksiksiz olması Kullanıcı’nın sorumluluğundadır.</li>
      <li>Hesap şifresi ve erişim bilgilerinin gizliliği Kullanıcı’ya aittir; üçüncü kişilerle paylaşılmamalıdır.</li>
      <li>Hesap üzerinden yapılan işlemler Kullanıcı tarafından yapılmış kabul edilir.</li>
      <li>Yetkisiz erişim şüphesi halinde Kullanıcı, Hizmet Sağlayıcı’yı gecikmeksizin bilgilendirmelidir.</li>
      <li>Hizmet Sağlayıcı güvenlik gerekçesiyle oturum sonlandırma, doğrulama, şifre yenileme gibi önlemler uygulayabilir.</li>
    </ul>

    <p className="mt-3 font-semibold">5. Hizmetin Sunulması</p>
    <ul className="list-disc ml-5 mt-1 space-y-1">
      <li>Hizmet “olduğu gibi” ve “mevcut haliyle” sunulur; kesintisiz ve hatasız çalışma taahhüt edilmez.</li>
      <li>Zorunlu bakım/iyileştirme çalışmaları nedeniyle geçici kesintiler yaşanabilir.</li>
      <li>Hizmet Sağlayıcı, hizmet kalitesini artırmak için arayüz/işleyişte makul değişiklikler yapabilir.</li>
    </ul>

    <p className="mt-3 font-semibold">6. Destek ve İletişim</p>
    <ul className="list-disc ml-5 mt-1 space-y-1">
      <li>Destek talepleri, Platform’da belirtilen destek kanalları üzerinden alınır (e-posta/form vb.).</li>
      <li>Hizmet Sağlayıcı, taleplere makul süre içinde dönüş sağlamayı hedefler; yoğunluk ve talep niteliğine göre süre değişebilir.</li>
      <li>Bakım/planlı kesintiler mümkün oldukça önceden duyurur.</li>
    </ul>

    <p className="mt-3 font-semibold">7. Kullanım Kuralları ve Yasaklı Eylemler</p>
    <ul className="list-disc ml-5 mt-1 space-y-1">
      <li>Hukuka, kamu düzenine ve üçüncü kişi haklarına aykırı içerik yüklenmesi/iletilmesi yasaktır.</li>
      <li>
        Platform’a yetkisiz erişim, zafiyet denemesi, veri kazıma (scraping), tersine mühendislik, saldırı (DDoS vb.) yasaktır.
      </li>
      <li>Virüs, zararlı yazılım, spam veya Platform’u kesintiye uğratacak eylemler gerçekleştirilemez.</li>
      <li>Platform’un marka, yazılım, tasarım ve içerik unsurları üzerindeki fikri mülkiyet hakları saklıdır.</li>
    </ul>

    <p className="mt-3 font-semibold">8. Fikri Mülkiyet ve Lisans</p>
    <p className="mt-1">
      Platform’a ilişkin yazılım, tasarım, arayüz, marka, logo ve tüm fikri mülkiyet unsurları Hizmet Sağlayıcı’ya aittir
      veya lisanslıdır. Kullanıcı’ya, yalnızca seçilen Plan/Paket kapsamında ve Sözleşme süresince Platform’u kullanmak üzere
      devredilemez, münhasır olmayan bir kullanım lisansı tanınır.
    </p>

    <p className="mt-3 font-semibold">9. Kullanıcı İçeriği (Veri) – Sahiplik, Yedekleme, Silme</p>
    <p className="mt-1">
      Kullanıcı, Platform’a yüklediği/girdiği İçerik/Veri üzerinde gerekli haklara sahip olduğunu; İçerik’in hukuka uygun
      olduğunu ve üçüncü kişilerin haklarını ihlal etmediğini kabul eder. Kullanıcı İçeriği’nin mülkiyeti Kullanıcı’da kalır.
      Hizmet Sağlayıcı, İçerik’i yalnızca Hizmet’in sunulması, güvenliğin sağlanması ve yasal yükümlülüklerin yerine getirilmesi
      amaçlarıyla işler.
    </p>
    <ul className="list-disc ml-5 mt-2 space-y-1">
      <li>Kullanıcı, kendi İçerik’ini ayrıca yedeklemekle yükümlüdür.</li>
      <li>Hizmet Sağlayıcı teknik gereklilikler doğrultusunda yedekleme/geri yükleme mekanizmaları kullanabilir; mutlak veri kaybını önleme garantisi vermez.</li>
      <li>Hesap kapatma/abonelik bitimi sonrası veri saklama ve silme süreçleri KVKK ve ilgili mevzuata göre yürütülür.</li>
    </ul>
    <p className="mt-2 text-sm">
      Not: Platform üzerinden oluşturulan çıktı/şablonlar bilgilendirme amaçlı olup, nihai mevzuat uyumu bakımından kontrol sorumluluğu Kullanıcı’ya aittir.
    </p>

    <p className="mt-3 font-semibold">10. Ücretlendirme, Ödeme, Fatura</p>
    <p className="mt-1">
      Ücretli paketlerde fiyatlar; dönem (aylık/yıllık), kapsam, kullanıcı limiti ve KDV dahil/haric bilgileri web sitesinde
      ve/veya ödeme ekranında gösterilir. Ödeme adımlarında gösterilen tutar ve koşullar esas alınır.
    </p>
    <ul className="list-disc ml-5 mt-2 space-y-1">
      <li>Ödemeler, Hizmet Sağlayıcı’nın çalıştığı ödeme hizmet sağlayıcıları aracılığıyla alınabilir.</li>
      <li>Fatura/e-arşiv/e-fatura süreçleri mevzuata uygun yürütülür; gerekli hallerde Kullanıcı’dan fatura bilgileri talep edilir.</li>
      <li>Kullanıcı, bankası/ödeme kuruluşu tarafından uygulanabilecek komisyon/masraf ve benzeri kesintilerden kendisinin sorumlu olabileceğini kabul eder.</li>
    </ul>

    <p className="mt-3 font-semibold">11. Abonelik Yenileme, Plan Değişikliği, İptal</p>
    <ul className="list-disc ml-5 mt-1 space-y-1">
      <li>Abonelik, seçilen dönemin bitimine kadar geçerlidir.</li>
      <li>Abonelik yenileme koşulları (otomatik yenileme olup olmadığı, yenileme bedeli ve yenileme tarihi) satın alma anında ve/veya panelde gösterilir.</li>
      <li>Kullanıcı, panel üzerinden plan/paket değişikliği yapabilir; ücret farkı ve uygulanma tarihi ekranda gösterilen kurallara göre uygulanır.</li>
      <li>Kullanıcı, aboneliğini yenilememe/iptal etme seçeneğini (varsa) panel üzerinden kullanabilir. İptal halinde, mevcut dönem sonuna kadar erişim devam edebilir (satın alma anındaki koşullara göre).</li>
    </ul>

    <p className="mt-3 font-semibold">12. Cayma Hakkı ve İade</p>
    <p className="mt-1">
      Kullanıcı’nın 6502 sayılı Kanun kapsamında “tüketici” olması halinde; cayma hakkı ve iade süreçleri “Mesafeli Satış Sözleşmesi”
      ve ilgili mevzuat hükümlerine tabidir. Dijital hizmetlerde ifaya başlanması gibi hallerde cayma hakkı istisnaları uygulanabilir.
    </p>

    <p className="mt-3 font-semibold">13. Askıya Alma / Fesih</p>
    <p className="mt-1">
      Kullanıcı dilediğinde hesabını kapatarak üyeliğini sonlandırabilir. Hizmet Sağlayıcı; sözleşmeye aykırılık, kötüye kullanım,
      hukuka aykırılık veya güvenlik riski hallerinde hesabı geçici olarak askıya alabilir veya feshedebilir. Mevzuattan doğan saklama
      yükümlülükleri saklıdır.
    </p>

    <p className="mt-3 font-semibold">14. Mücbir Sebep</p>
    <p className="mt-1">
      Tarafların kontrolü dışında gelişen; doğal afet, savaş, siber saldırı, altyapı/elektrik kesintisi, mevzuat değişikliği gibi mücbir
      sebepler nedeniyle edimlerin ifası engellenir veya gecikirse, taraflar sorumlu tutulamaz.
    </p>

    <p className="mt-3 font-semibold">15. Sorumluluğun Sınırlandırılması</p>
    <p className="mt-1">
      Hizmet Sağlayıcı; internet/altyapı kesintileri, üçüncü taraf hizmetlerinden kaynaklanan aksamalar ve teknik zorunluluklar nedeniyle
      doğabilecek erişim sorunlarından mevzuatın izin verdiği ölçüde sorumlu değildir. Dolaylı zararlar, kâr kaybı, iş kaybı, veri kaybı gibi
      sonuçlardan sorumluluk kabul edilmez.
    </p>

    <p className="mt-3 font-semibold">16. Değişiklikler</p>
    <p className="mt-1">
      Hizmet Sağlayıcı, mevzuat ve hizmet gereksinimleri doğrultusunda Sözleşme’de değişiklik yapabilir. Güncel metin Platform’da yayımlandığı
      tarihten itibaren geçerli olur.
    </p>

    <p className="mt-3 font-semibold">17. Uyuşmazlık</p>
    <p className="mt-1">
      Kullanıcı’nın tüketici olduğu uyuşmazlıklarda ilgili mevzuat gereği Tüketici Hakem Heyetleri / Tüketici Mahkemeleri yetkilidir.
      Tüketici olmayan Kullanıcılar bakımından Ankara Mahkemeleri ve İcra Daireleri yetkilidir.
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
      İşbu Mesafeli Satış Sözleşmesi (“Sözleşme”); aşağıda bilgileri bulunan Mehmet Arıkan (İSG Panel) (“Satıcı”) ile www.isgpanel.tr üzerinden
      dijital abonelik hizmeti satın alan kullanıcı (“Alıcı/Tüketici”) arasında elektronik ortamda kurulmuştur.
    </p>

    <p className="mt-3 font-semibold">2. Sözleşmenin Konusu</p>
    <p className="mt-1">
      Bu Sözleşme’nin konusu; Alıcı’nın, Satıcı tarafından sunulan İSG Panel yazılım hizmetine (“Hizmet”) ilişkin dijital abonelik satın alması ve
      kullanmasına dair tarafların hak ve yükümlülüklerinin belirlenmesidir.
    </p>

    <p className="mt-3 font-semibold">3. Hizmetin Niteliği</p>
    <p className="mt-1">
      Hizmet, fiziksel teslimat içermeyen, internet üzerinden erişim sağlanan yazılım hizmeti (SaaS) niteliğindedir. Hizmet kapsamı, modüller,
      kullanıcı limitleri ve özellikler satın alınan plan/pakete göre değişebilir.
    </p>

    <p className="mt-3 font-semibold">4. Sipariş, Ödeme ve Ödeme Kuruluşu</p>
    <p className="mt-1">
      Abonelik planı, dönem (aylık/yıllık), bedel ve KDV dahil/haric tutar ödeme ekranında açıkça gösterilir. Ödeme, Satıcı’nın anlaşmalı ödeme
      altyapısı sağlayıcısı (ör. iyzico) üzerinden tahsil edilebilir. Ödeme tamamlandığında abonelik Alıcı hesabına tanımlanır.
    </p>

    <p className="mt-3 font-semibold">5. Hizmete Erişim ve İfa Zamanı</p>
    <p className="mt-1">
      Hizmet, kullanıcı hesabı üzerinden çevrim içi olarak sunulur. Ödeme onayı ve aboneliğin aktive edilmesiyle birlikte hizmetin ifasına başlanmış sayılır.
    </p>

    <p className="mt-3 font-semibold">6. Teslimat ve İade Koşulları</p>
    <p className="mt-1">
      İSG Panel, fiziksel teslimat içermeyen dijital bir yazılım hizmetidir. Hizmet, ödeme işleminin tamamlanmasının ardından Alıcı hesabına anında tanımlanır
      ve elektronik ortamda erişime açılır. Fiziksel teslimat yapılmaz. Dijital hizmetlerde cayma hakkı, hizmetin ifasına başlanmasıyla birlikte mevzuat kapsamında
      sona erebilir.
    </p>

    <p className="mt-3 font-semibold">7. Cayma Hakkı</p>
    <p className="mt-1">
      Mesafeli sözleşmelerde tüketicinin cayma hakkı mevzuata tabidir. Ancak dijital hizmetlerde; ifaya Alıcı’nın açık onayıyla başlanması ve Alıcı’nın cayma hakkını
      kaybedeceğine ilişkin bilgilendirilmesi halinde, cayma hakkı istisnası doğabilir.
    </p>

    <p className="mt-3 font-semibold">8. Açık Onay ve Cayma İstisnası Beyanı</p>
    <p className="mt-1">
      Alıcı, ödeme sonrası aboneliğin aktive edilmesi ve hizmete erişimin başlatılmasının dijital hizmette ifaya başlama anlamına gelebileceğini ve mevzuat kapsamındaki
      koşullar oluştuğunda cayma hakkını kaybedebileceğini kabul eder.
    </p>

    <p className="mt-3 font-semibold">9. İptal, İade ve Mükerrer Ödeme</p>
    <ul className="list-disc ml-5 mt-1 space-y-1">
      <li>İptal/iade talepleri, hizmetin kullanım durumu ve mevzuat hükümleri kapsamında değerlendirilir.</li>
      <li>Teknik hata, mükerrer ödeme veya hizmetin sunulamaması gibi durumlarda iade yapılabilir.</li>
      <li>Ödeme iadesi, ödeme yöntemine/ödeme kuruluşu süreçlerine bağlı olarak belirli bir süre içinde gerçekleşebilir.</li>
    </ul>

    <p className="mt-3 font-semibold">10. Tarafların Yükümlülükleri</p>
    <p className="mt-1">
      Satıcı, hizmeti sözleşmeye uygun sunmakla; Alıcı ise doğru üyelik bilgileri sağlamak, hesabını korumak ve hizmeti hukuka uygun kullanmakla yükümlüdür.
    </p>

    <p className="mt-3 font-semibold">11. Sorumluluğun Sınırlandırılması</p>
    <p className="mt-1">
      Satıcı; internet kesintileri, altyapı sorunları, üçüncü taraf hizmet arızaları ve mücbir sebeplerden kaynaklanan erişim sorunlarından mevzuatın izin verdiği ölçüde
      sorumlu değildir. Dolaylı zararlar ve veri kayıplarından sorumluluk kabul edilmez.
    </p>

    <p className="mt-3 font-semibold">12. Fikri Mülkiyet</p>
    <p className="mt-1">
      İSG Panel yazılımı, tasarımı, markası ve tüm içerik unsurlarının fikri mülkiyet hakları Satıcı’ya aittir. Alıcı, hizmeti yalnızca kullanım amacıyla kullanabilir.
    </p>

    <p className="mt-3 font-semibold">13. Kişisel Veriler</p>
    <p className="mt-1">
      Alıcı’nın kişisel verileri Gizlilik Politikası ve KVKK aydınlatma metinleri kapsamında işlenir ve korunur.
    </p>

    <p className="mt-3 font-semibold">14. Sözleşme Değişiklikleri</p>
    <p className="mt-1">
      Satıcı, mevzuat veya hizmet gereksinimleri doğrultusunda sözleşme hükümlerinde değişiklik yapabilir. Güncel metin web sitesinde yayımlandığı tarihten itibaren geçerli olur.
    </p>

    <p className="mt-3 font-semibold">15. Uyuşmazlık</p>
    <p className="mt-1">
      Alıcı’nın tüketici olduğu uyuşmazlıklarda ilgili mevzuat gereği Tüketici Hakem Heyetleri / Tüketici Mahkemeleri yetkilidir. Tüketici olmayan işlemlerde Ankara Mahkemeleri ve İcra Daireleri yetkilidir.
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

// Basit kart markası tespiti (demo)
function detectBrand(num) {
  const n = (num || "").replace(/\s|-/g, "");
  if (/^4\d{6,}/.test(n)) return "VISA";
  if (/^5[1-5]\d{5,}/.test(n)) return "MASTERCARD";
  if (/^3[47]\d{5,}/.test(n)) return "AMEX";
  if (/^6(?:011|5)\d{4,}/.test(n)) return "DISC";
  return "CARD";
}

/**
 * ✅ ISO "YYYY-MM-DD" -> Date (LOCAL) güvenli parse
 * new Date("YYYY-MM-DD") timezone sapmasına yol açabildiği için kullanmıyoruz.
 */
function isoToLocalDate(iso, { hour = 0, minute = 0, second = 0, ms = 0 } = {}) {
  const [y, m, d] = (iso || "").split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, hour, minute, second, ms);
}

// tarih farkı (kalan gün) — ✅ timezone-safe
function diffDays(fromISO, toISO) {
  try {
    const a = isoToLocalDate(fromISO, { hour: 0, minute: 0, second: 0, ms: 0 });
    const b = isoToLocalDate(toISO, { hour: 0, minute: 0, second: 0, ms: 0 });
    if (!a || !b) return 0;

    const msDiff = b.getTime() - a.getTime();
    return Math.max(0, Math.ceil(msDiff / (1000 * 60 * 60 * 24)));
  } catch {
    return 0;
  }
}

// ✅ Tasarımı bozmadan saniyelik kalan süre (sadece HH:MM:SS)
const DAY_MS = 24 * 60 * 60 * 1000;

function getCountdown(endAt) {
  const end = endAt instanceof Date ? endAt : new Date(endAt);
  const now = new Date();

  let ms = end.getTime() - now.getTime();
  if (Number.isNaN(ms)) return { days: 0, hms: "00:00:00" };
  if (ms < 0) ms = 0;

  const days = Math.ceil(ms / DAY_MS);

  const remainAfterFullDays = ms % DAY_MS;
  const totalSeconds = Math.floor(remainAfterFullDays / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad2 = (n) => String(n).padStart(2, "0");
  return { days, hms: `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}` };
}

// ✅ ISO datetime + gün ekle (saat/dk/sn korunur)
function addDaysToIsoDateTime(isoDateTime, days) {
  const d = new Date(isoDateTime);
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString();
}

// ✅ addDaysISO — timezone-safe (iş kuralı: Aylık=30, Yıllık=365 korunur)
function addDaysISO(iso, days) {
  const base = iso ? isoToLocalDate(iso, { hour: 12 }) : isoToLocalDate(todayISO(), { hour: 12 });
  if (!base) return todayISO();

  base.setDate(base.getDate() + Number(days || 0));
  return base.toISOString().slice(0, 10);
}

const toTRUpper = (s) => String(s || "").toLocaleUpperCase("tr-TR");
const toDateOnly = (v) => (v ? String(v).slice(0, 10) : "");

// ✅ Word benzeri: ilk harf büyük, "." sonrası büyük
function sentenceCaseTR(text) {
  const s = String(text || "");
  if (!s.trim()) return s;

  // Baştaki ilk harfi büyüt
  let out = s.replace(/^\s*([a-zçğıöşü])/i, (m, ch) => m.replace(ch, ch.toLocaleUpperCase("tr-TR")));

  // Nokta/soru/ünlem sonrası gelen ilk harfi büyüt
  out = out.replace(/([.?!]\s*)([a-zçğıöşü])/gi, (m, sep, ch) => {
    return sep + ch.toLocaleUpperCase("tr-TR");
  });

  return out;
}

/**
 * Paket yükseltme farkı (kalan gün üzerinden)
 * - Aylık: 30 gün
 * - Yıllık: 365 gün
 */
function calculateUpgradeDiff({
  currentPlan,
  targetPlan,
  period,
  activePeriod,
  daysLeft,
  vatRate,
}) {
  const currentBaseDays = activePeriod === "Yıllık" ? 365 : 30;
  const targetBaseDays = period === "Yıllık" ? 365 : 30;

  const currentPrice =
    activePeriod === "Yıllık"
      ? currentPlan.yearlyExVat
      : currentPlan.monthlyExVat;

  const targetPrice =
    period === "Yıllık"
      ? targetPlan.yearlyExVat
      : targetPlan.monthlyExVat;

  if (currentPrice == null || targetPrice == null) return null;

  const dailyCurrent = Number(currentPrice) / currentBaseDays;
  const dailyTarget = Number(targetPrice) / targetBaseDays;

  const dailyDiff = dailyTarget - dailyCurrent;

  const diffExVat = Math.max(0, dailyDiff * Number(daysLeft || 0));
  const diffVat = diffExVat * vatRate;

  return {
    diffAmountExVat: Math.round(diffExVat),
    diffVat: Math.round(diffVat),
    diffTotal: Math.round(diffExVat + diffVat),
  };
}


/** =========================
 *  Auth + API
 *  ========================= */
const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token") || "";
function mapApiPlansToUi(apiPlans = []) {
  const byCode = Object.fromEntries(
    (Array.isArray(apiPlans) ? apiPlans : []).map((p) => [String(p.code || ""), p])
  );

 const getMonthly = (code, fallback = 0) => {
  const p = byCode?.[code] || byCode?.[code.replaceAll("-", "_")];
  return Number(p?.monthlyPrice || fallback || 0);
};

  return [
  {
    id: "ticari-5",
    name: "Ticari (Max 5 Kullanıcı)",
    note: "Küçük ve orta ekipler için",
    users: "En fazla 5 kullanıcı",
    monthlyExVat: getMonthly("ticari_5", 2000),
yearlyExVat: getMonthly("ticari_5", 2000) * 10,
    features: ["Sınırsız firma", "Tüm modüllere erişim", "Hızlı kurulum & onboarding"],
  },
  {
    id: "ticari-10",
    name: "Ticari (Max 10 Kullanıcı)",
    note: "Büyüyen ekipler için",
    users: "En fazla 10 kullanıcı",
    monthlyExVat: getMonthly("ticari_10", 3500),
yearlyExVat: getMonthly("ticari_10", 3500) * 10,
    features: ["Sınırsız firma", "Tüm modüllere erişim", "Hızlı kurulum & onboarding"],
  },
  {
    id: "ticari-15",
    name: "Ticari (Max 15 Kullanıcı)",
    note: "Geniş ekipler için",
    users: "En fazla 15 kullanıcı",
    monthlyExVat: getMonthly("ticari_15", 5000),
yearlyExVat: getMonthly("ticari_15", 5000) * 10,
    features: ["Sınırsız firma", "Tüm modüllere erişim", "Hızlı kurulum & onboarding"],
  },
  {
    id: "prof-ozel",
    name: "Kurumsal (15+ Kullanıcı)",
    note: "Büyük yapılar için özel teklif",
    users: "15+ kullanıcı",
    monthlyExVat: null,
    yearlyExVat: null,
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
 *  Card input helpers (kısıt + format)
 *  ========================= */
const digitsOnly = (v, maxLen) => {
  const s = String(v || "").replace(/\D/g, "");
  return typeof maxLen === "number" ? s.slice(0, maxLen) : s;
};

const formatCardNumber = (digits) => {
  const d = digitsOnly(digits, 16);
  return d.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
};

const formatExpiry = (digits) => {
  const d = digitsOnly(digits, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
};

/** =========================
 *  LOCAL ödeme yöntemi
 *  ========================= */
const PM_KEY = "ticari_payment_method";
function loadPaymentMethod() {
  try {
    const v = JSON.parse(localStorage.getItem(PM_KEY) || "null");
    if (!v) return null;
    return {
      brand: v.brand || v.paymentBrand || "CARD",
      last4: v.last4 || v.paymentLast4 || "",
      holder: v.holder || v.paymentHolder || "",
    };
  } catch {
    return null;
  }
}
function savePaymentMethod({ brand, last4, holder }) {
  try {
    localStorage.setItem(PM_KEY, JSON.stringify({ brand, last4, holder }));
  } catch {}
}

export default function TicariAbonelikBilgileri() {
  const VAT_RATE = 0.2;

  const getFirmFromStorage = () => {
    const keys = ["ticariKurumsalBilgiler", "kurumsalBilgiler", "firmaBilgileri", "firma"];
    for (const k of keys) {
      try {
        const v = JSON.parse(localStorage.getItem(k) || "null");
        if (v && (v.firmaAdi || v.unvan || v.title)) return v;
      } catch {}
    }
    return null;
  };

  // ✅ Saniyelik geri sayım için tick (tasarım bozulmadan re-render)
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Kurumsal Kimlik (mevcut yapı)
  const ticariKurumsal = useMemo(() => getFirmFromStorage(), []);

  // Kullanıcı (adı/email) (mevcut yapı)
  const userInfo = useMemo(() => {
    try {
      const u = JSON.parse(localStorage.getItem("user") || "null");
      return u || null;
    } catch {
      return null;
    }
  }, []);



  // ✅ Buton stilleri
  const BTN_GREEN =
    "bg-[#16a34a] hover:bg-[#15803d] text-white px-5 py-2.5 rounded-xl text-sm font-bold";
  const BTN_OUTLINE =
    "border border-gray-200 hover:bg-gray-50 px-5 py-2.5 rounded-xl text-sm font-semibold";
  const BTN_SECONDARY =
    "bg-[#16a34a] hover:bg-[#15803d] text-white px-5 py-2.5 rounded-xl text-sm font-semibold";
  const BTN_IYZICO =
    "bg-[#2f6fed] hover:bg-[#1e57c8] text-white px-5 py-2.5 rounded-xl text-sm font-bold";

  const STORAGE_KEY = "ticariAbonelikDates";

  const [state, setState] = useState({
    currentPlanId: "ticari-5",
    usersCount: 1,

    period: "Aylık",
    activePeriod: "Aylık",
    showVatIncluded: true,


    // ✅ backend timestamp (sayaç için)
    startAtISO: "",
    endAtISO: "",

    // ✅ UI date-only
    startDate: todayISO(),
    endDate: addDaysISO(todayISO(), 30),

    // ✅ prof-ozel için teklif tutarı (KDV DAHİL)
    amountTRY: 0,

    // ✅ kurumsal ek kullanıcı seçimi
    addUsersCount: 1,
    addUsersFlow: {
      active: false,
      ready: false,
      addUsersCount: 0,
    },

    paymentBrand: "VISA",
    paymentLast4: "1234",
    paymentHolder: "",

    coupon: "",
    invoices: [],

    upgrade: {
      targetPlanId: null,
      daysLeft: 0,
      diffAmountExVat: 0,
      diffVat: 0,
      diffTotal: 0,
      show: false,
    },

    upgradeFlow: {
      active: false,
      mode: null,
      targetPlanId: null,
    },

    renewFlow: { active: false },

// ✅ teklif reddedilirse geri dönmek için
preOfferPlanId: "",
preOfferUsersCount: 0,
preOfferPeriod: "Aylık",
  });

  // ✅ MODAL / FORM HOOK'LARI
  const [showCardModal, setShowCardModal] = useState(false);
  const iyzicoContainerRef = useRef(null);

  // ✅ iyzico state’leri
  const [showIyzicoModal, setShowIyzicoModal] = useState(false);
  const [iyzicoHtml, setIyzicoHtml] = useState("");
  const [iyzicoError, setIyzicoError] = useState("");
  const [iyzicoLoading, setIyzicoLoading] = useState(false);
  const [canPay, setCanPay] = useState(false);

  // ✅ iyzico HTML bas + scriptleri çalıştır
  useEffect(() => {
    if (!showIyzicoModal) return;
    if (!iyzicoHtml) return;
    if (iyzicoError) return;

    const el = iyzicoContainerRef.current;
    if (!el) return;

    el.innerHTML = iyzicoHtml;

    const scripts = Array.from(el.querySelectorAll("script"));
    scripts.forEach((oldScript) => {
      const s = document.createElement("script");
      Array.from(oldScript.attributes).forEach((attr) => {
        s.setAttribute(attr.name, attr.value);
      });
      s.text = oldScript.text || "";
      oldScript.parentNode?.replaceChild(s, oldScript);
    });

    return () => {
      el.innerHTML = "";
    };
  }, [showIyzicoModal, iyzicoHtml, iyzicoError]);

  const [cardForm, setCardForm] = useState({
    holder: "",
    number: "",
    exp: "",
    cvc: "",
  });

  // ✅ Özel teklif modalı
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerSending, setOfferSending] = useState(false);
  const [offerError, setOfferError] = useState("");

  // ✅ Kurumsal teklif
  const [offerData, setOfferData] = useState(null);
  const [offerLoading, setOfferLoading] = useState(false);
  const [offerFetchError, setOfferFetchError] = useState("");
  const [recentPayments, setRecentPayments] = useState([]);
  const [recentPaymentsLoading, setRecentPaymentsLoading] = useState(false);
  const [recentPaymentsError, setRecentPaymentsError] = useState("");

  const [orgUuid, setOrgUuid] = useState("");
  const [offerAccepted, setOfferAccepted] = useState(false);

  const [offerChecks, setOfferChecks] = useState({ kvkk: false, terms: false, sales: false });
  const [renewChecks, setRenewChecks] = useState({ kvkk: false, terms: false, sales: false });
  const [addUsersChecks, setAddUsersChecks] = useState({ kvkk: false, terms: false, sales: false });

  const [showContractModal, setShowContractModal] = useState(null); // "kvkk" | "terms" | "sales" | null

  const [isPilot, setIsPilot] = useState(false);
  const [offerForm, setOfferForm] = useState({
    companyName: "",
    fullName: "",
    email: "",
    usersCount: "",
    message: "",
  });

  /** ✅ FIX (SAYAÇ):
   * - endAtISO varsa onu kullan.
   * - endAtISO yoksa ama startAtISO varsa startAtISO + 30/365 gün üret (saat/dk/sn korunur).
   */
  const [hydrated, setHydrated] = useState(false);
const prevRef = useRef({ period: null, startDate: null });

const [plans, setPlans] = useState(() =>
  mapApiPlansToUi([
    { code: "ticari_5", monthlyPrice: 2000 },
    { code: "ticari_10", monthlyPrice: 3500 },
    { code: "ticari_15", monthlyPrice: 5000 },
  ])
);

  const fetchSubscriptionData = async () => {
  let sub = null;

  let resolvedPeriod = state.period;
  let resolvedStartDate = state.startDate;

  try {
    const res = await apiFetch("/api/subscription/me");
    sub = res.subscription || null;

    const normalizePlanId = (v) => {
      const x = String(v || "").trim();
      if (!x) return null;
      if (x === "kurumsal_ozel" || x === "kurumsal-ozel") return "prof-ozel";
      const y = x.split("_").join("-");
      if (["ticari-5", "ticari-10", "ticari-15", "prof-ozel"].includes(y)) return y;
      return null;
    };

    const pmLS = loadPaymentMethod();

    if (sub) {
      resolvedPeriod = sub.period || resolvedPeriod;

      const startISO = sub.startDate ? String(sub.startDate) : "";
      let endISO = sub.endDate ? String(sub.endDate) : "";

      if (!endISO && startISO) {
        const add = resolvedPeriod === "Yıllık" ? 365 : 30;
        endISO = addDaysToIsoDateTime(startISO, add);
      }

      const startDateOnly = toDateOnly(startISO) || resolvedStartDate;
      resolvedStartDate = startDateOnly;

      const u = Number(sub.usersCount || 1);

      const inferred =
  u <= 5 ? "ticari-5" :
  u <= 10 ? "ticari-10" :
  u <= 15 ? "ticari-15" :
  "prof-ozel";
      const apiPlan = normalizePlanId(sub.currentPlanId || sub.planCode);
      const effectivePlanId = apiPlan || inferred || "ticari-5";

      const pilotFlag = Boolean(
        sub?.isPilot || sub?.pilot || sub?.pilotActive || sub?.pilotToken || sub?.pilotEndDate || sub?.pilotEndAt
      );
      setIsPilot(pilotFlag);

      setState((s) => {
        const nextEndAtISO = endISO || s.endAtISO;

        const nextEndDateOnly =
          toDateOnly(nextEndAtISO) ||
          s.endDate ||
          (resolvedPeriod === "Yıllık" ? addDaysISO(startDateOnly, 365) : addDaysISO(startDateOnly, 30));

        return {
          ...s,
          currentPlanId: effectivePlanId,
          usersCount: u,
          period: sub.period || s.period,
          activePeriod: sub.period || s.activePeriod,
          showVatIncluded: typeof sub.showVatIncluded === "boolean" ? sub.showVatIncluded : s.showVatIncluded,
          autoRenew: typeof sub.autoRenew === "boolean" ? sub.autoRenew : s.autoRenew,
          startAtISO: startISO || s.startAtISO,
          endAtISO: nextEndAtISO,
          startDate: startDateOnly,
          endDate: nextEndDateOnly,
          paymentBrand: sub.paymentBrand || pmLS?.brand || s.paymentBrand,
          paymentLast4: sub.paymentLast4 || pmLS?.last4 || s.paymentLast4,
          paymentHolder: sub.paymentHolder || pmLS?.holder || s.paymentHolder,
          invoices: Array.isArray(sub.invoices) ? sub.invoices : s.invoices,
          amountTRY: Number(sub.amountTRY || sub.amountTRYIncVat || sub.amount || s.amountTRY || 0),
          upgrade: { ...s.upgrade, show: false, targetPlanId: null },
        };
      });
    }
  } catch (e) {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      setState((s) => ({
        ...s,
        currentPlanId: s.currentPlanId || "ticari-5",
        usersCount: s.usersCount || 1,
        startDate: parsed.startDate,
        endDate: parsed.endDate,
      }));
    }
    console.warn("Ticari abonelik API okunamadı:", e.message);
    } finally {
    const hasRealEnd =
      Boolean(sub?.endDate) ||
      Boolean(state.endAtISO);

    const fixedDates = {
      startDate: resolvedStartDate,
      endDate: hasRealEnd ? (toDateOnly(sub?.endDate) || toDateOnly(state.endAtISO) || "") : "",
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(fixedDates));
    prevRef.current = { period: resolvedPeriod, startDate: resolvedStartDate };
    setHydrated(true);
  }
};

useEffect(() => {
  fetchSubscriptionData();

  const handleFocus = () => fetchSubscriptionData();
  const handleVisible = () => {
    if (document.visibilityState === "visible") fetchSubscriptionData();
  };

  window.addEventListener("focus", handleFocus);
  document.addEventListener("visibilitychange", handleVisible);

  return () => {
    window.removeEventListener("focus", handleFocus);
    document.removeEventListener("visibilitychange", handleVisible);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

 const fetchOfferData = async () => {
  try {
    setOfferLoading(true);
    setOfferFetchError("");

    const me = await apiFetch("/api/auth/me");

    const org =
      me?.organization?.uuid ||
      me?.organization?._id ||
      me?.organizationUuid ||
      me?.orgUuid ||
      me?.user?.organization?.uuid ||
      me?.user?.organization?._id ||
      me?.user?.organizationUuid ||
      me?.user?.orgUuid ||
      me?.user?.organizationId ||
      me?.user?.organization ||
      "";

    const pilotFlag = Boolean(
      me?.isPilot ||
      me?.user?.isPilot ||
      me?.organization?.pilot ||
      me?.organization?.isPilot ||
      me?.organization?.pilotActive ||
      me?.organization?.pilotEndDate ||
      me?.organization?.pilotEndAt
    );

    setIsPilot(pilotFlag);
    setOrgUuid(org);

    const url = org
      ? `/api/offers/my?orgUuid=${encodeURIComponent(org)}`
      : "/api/offers/my";

    const res = await apiFetch(url);
    setOfferData(res?.offer ?? null);
  } catch (e) {
    setOfferFetchError(e.message || "Teklif okunamadı");
  } finally {
    setOfferLoading(false);
  }
};

useEffect(() => {
  fetchOfferData();

  const handleFocus = () => fetchOfferData();
  const handleVisible = () => {
    if (document.visibilityState === "visible") fetchOfferData();
  };

  window.addEventListener("focus", handleFocus);
  document.addEventListener("visibilitychange", handleVisible);

  return () => {
    window.removeEventListener("focus", handleFocus);
    document.removeEventListener("visibilitychange", handleVisible);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

useEffect(() => {
  let alive = true;

  (async () => {
    try {
      const res = await apiFetch("/api/plans");
      if (!alive) return;

      setPlans(mapApiPlansToUi(res));
    } catch (e) {
      console.warn("Planlar okunamadı:", e.message);
    }
  })();

  return () => {
    alive = false;
  };
}, []);


// ✅ Son Ödemeler (son 6, sadece başarılı) — orgUuid hazır olunca çek
useEffect(() => {
  let alive = true;

  // orgUuid yoksa boşuna istek atma (çoğu backend org filtresi ister)
  if (!orgUuid) return;

  (async () => {
    const pickItems = (res) => {
      const items =
        res?.payments ||
        res?.recentPayments ||
        res?.items ||
        res?.data ||
        res?.rows ||
        res?.results ||
        [];
      return Array.isArray(items) ? items : [];
    };

    const tryFetch = async (url) => {
      try {
        const res = await apiFetch(url);
        return pickItems(res);
      } catch {
        return null;
      }
    };

    // ✅ sadece başarılı filtre (backend farklı alanlarla dönebilir)
    const isSuccess = (p) => {
  // ✅ Backend /transactions/recent zaten sadece PAID döndürüyor.
  // Status alanı yoksa "başarılı" kabul et.
  const raw = p?.status ?? p?.paymentStatus ?? p?.state ?? p?.result;

  if (raw == null || String(raw).trim() === "") return true;

  const st = String(raw).toLowerCase();
  return (
    st === "success" ||
    st === "paid" ||
    st === "succeeded" ||
    st === "ok" ||
    st === "completed"
  );
};

    // ✅ tarihe göre sıralama (en yeni üstte)
    const getDateMs = (p) => {
      const raw =
        p?.createdAt ||
        p?.created_at ||
        p?.paidAt ||
        p?.paid_at ||
        p?.date ||
        p?.updatedAt ||
        p?.updated_at ||
        "";
      const t = raw ? new Date(raw).getTime() : 0;
      return Number.isFinite(t) ? t : 0;
    };

    try {
      setRecentPaymentsLoading(true);
      setRecentPaymentsError("");

      const oq = `orgUuid=${encodeURIComponent(orgUuid)}&status=success&limit=6`;

      // ✅ önce “en doğru” endpoint; sonra fallback
      const oq2 = `orgUuid=${encodeURIComponent(orgUuid)}&limit=6`; // status'u client-side zaten filtreliyorsun

const candidates = [
  `/api/billing/transactions/recent?${oq2}`,   // ✅ asıl beklenen
  `/api/billing/transactions?${oq2}`,
  `/api/billing/payments/recent?${oq2}`,
  `/api/billing/recent-payments?${oq2}`,
];

      let list = null;
      for (const u of candidates) {
        list = await tryFetch(u);
        if (list) break;
      }

      if (!alive) return;

      if (!list) {
        setRecentPayments([]);
        setRecentPaymentsError("");
        return;
      }

      // ✅ Client-side: sadece başarılı + en yeni 6
      const normalized = list
        .filter(isSuccess)
        .sort((a, b) => getDateMs(b) - getDateMs(a))
        .slice(0, 6);

      setRecentPayments(normalized);
    } catch (e) {
      if (!alive) return;
      setRecentPayments([]);
      setRecentPaymentsError(e?.message || "");
    } finally {
      if (!alive) return;
      setRecentPaymentsLoading(false);
    }
  })();

  return () => {
    alive = false;
  };
}, [orgUuid]);


  // ✅ SADECE kullanıcı period değiştirdiyse endDate güncelle
  useEffect(() => {
    if (!hydrated) return;

    const prev = prevRef.current;
    const periodChanged = prev.period !== state.period;

    if (periodChanged) {
      setState((s) => {
        if (s.endAtISO) {
          return { ...s, endDate: toDateOnly(s.endAtISO) || s.endDate };
        }

        return {
          ...s,
          endAtISO: "",
          endDate: s.period === "Yıllık" ? addDaysISO(s.startDate, 365) : addDaysISO(s.startDate, 30),
        };
      });
    }

    prevRef.current = { period: state.period, startDate: state.startDate };
  }, [state.period, hydrated]); // eslint-disable-line

  const currentPlan = useMemo(() => {
    if (!state.currentPlanId) return null;
    const normalized = state.currentPlanId.replaceAll("_", "-");
    return plans.find((p) => p.id === normalized) || null;
  }, [plans, state.currentPlanId]);


const selectedBillingPlan = useMemo(() => {
  if (state.upgrade?.show && state.upgrade?.targetPlanId) {
    return plans.find((p) => p.id === state.upgrade.targetPlanId) || currentPlan;
  }

  if (state.upgradeFlow?.active && state.upgradeFlow?.targetPlanId) {
    return plans.find((p) => p.id === state.upgradeFlow.targetPlanId) || currentPlan;
  }

  return currentPlan;
}, [
  plans,
  currentPlan,
  state.upgrade?.show,
  state.upgrade?.targetPlanId,
  state.upgradeFlow?.active,
  state.upgradeFlow?.targetPlanId,
]);

  // ✅ geri sayım (canlı) — saat/dk/sn korunur
const countdown = useMemo(() => {
  let endVal = state.endAtISO;

  // ✅ Pilot kullanıcı: backend bitişi aynen kullan
  if (isPilot && endVal) {
    return getCountdown(endVal);
  }

  // ✅ ödeme alınmamışsa fallback sayaç üretme
  if (!endVal) {
    return { days: 0, hms: "00:00:00" };
  }

  return getCountdown(endVal);
}, [isPilot, state.endAtISO, tick]);

  const daysLeft = countdown.days;

// ✅ Soru 2: Yenileme sadece son 3 gün kala
const RENEW_WINDOW_DAYS = 3;

// Abonelikte aktif dönem (backend'den geliyor): state.activePeriod
const isSamePeriod =
  (state.period === "Aylık" && state.activePeriod === "Aylık") ||
  (state.period === "Yıllık" && state.activePeriod === "Yıllık");
   // ✅ Dönem değişimi (UI render scope'unda lazım)
const isPeriodSwitch = state.period !== state.activePeriod;
// Yenileme butonu yalnız son 3 gün kala aktif
const canRenewNow = Number(daysLeft || 0) <= RENEW_WINDOW_DAYS;


// ✅ Period kilidi (Aylık/Yıllık seçimini kilitle)
const periodLocked = isSamePeriod && !state.upgradeFlow?.active && !canRenewNow;

  const exVatPrice = useMemo(() => {
    if (!currentPlan) return 0;

    const isUpgrade = Boolean(state.upgradeFlow?.active);
    const isPeriodSwitchLocal = state.period !== state.activePeriod;
    const isRenewFlow = Boolean(state.renewFlow?.active);

    // ✅ Pilotta mevcut paket uygunsa normal paket mantığı çalışsın
    // Sözleşme onaylanıp Devam Et sonrası aylık/yıllık fiyatlar görünsün.
    if (isSamePeriod && !isUpgrade && !isPeriodSwitchLocal) {
      // son 3 gün değilse ödeme butonu kapalı kalır ama fiyat görünür
      if (!isRenewFlow) return 0;
      return state.period === "Yıllık" ? currentPlan.yearlyExVat : currentPlan.monthlyExVat;
    }


    return state.period === "Yıllık" ? currentPlan.yearlyExVat : currentPlan.monthlyExVat;
  }, [
    currentPlan,
    state.period,
    state.activePeriod,
    state.upgradeFlow,
    state.renewFlow,
    daysLeft,
    isSamePeriod,
  ]);
  const vatAmount = useMemo(() => Math.round(exVatPrice * VAT_RATE), [exVatPrice]);
  const incVatPrice = useMemo(() => exVatPrice + vatAmount, [exVatPrice, vatAmount]);

  const firmName = ticariKurumsal?.firmaAdi || "—";
  const firmPhone = ticariKurumsal?.telefon || "";
  const firmMail = ticariKurumsal?.email || "";

  const ownerName = toTRUpper(userInfo?.name || userInfo?.adSoyad || "") || "—";
  const ownerEmail = userInfo?.email || "";

 const openOfferModal = () => {
  setOfferError("");

  const safeCompanyName =
    (
      ticariKurumsal?.firmaAdi ||
      ticariKurumsal?.unvan ||
      ticariKurumsal?.title ||
      ticariKurumsal?.companyName ||
      ""
    ).trim();

  const personalInfo = (() => {
  try {
    return (
      JSON.parse(localStorage.getItem("kisiselBilgiler") || "null") ||
      JSON.parse(localStorage.getItem("personalInfo") || "null") ||
      {}
    );
  } catch {
    return {};
  }
})();

const rawFullName =
  (
    userInfo?.name ||
    userInfo?.adSoyad ||
    userInfo?.fullName ||
    userInfo?.fullname ||
    userInfo?.firstName ||
    userInfo?.lastName
      ? `${userInfo?.firstName || ""} ${userInfo?.lastName || ""}`.trim()
      : "" ||
    personalInfo?.adSoyad ||
    personalInfo?.name ||
    personalInfo?.fullName ||
    ""
  ).trim();

  const looksLikeCompany =
    /osgb|ltd|limited|anonim|a\.ş|aş|şirket|holding|sanayi|ticaret/i.test(rawFullName);

  const safeFullName = looksLikeCompany ? "" : rawFullName;

  setOfferForm({
    companyName: safeCompanyName,
    fullName: safeFullName,
    email: ownerEmail || userInfo?.email || "",
    usersCount: "",
    message: "",
  });

  setShowOfferModal(true);
};

  const closeOfferModal = () => {
    setShowOfferModal(false);
    setOfferError("");
    setOfferSending(false);
  };

  const submitOfferRequest = async () => {
    try {
      setOfferError("");

      const users = Number(digitsOnly(offerForm.usersCount, 6) || 0);
      if (!users || users < 10) {
        setOfferError("Kullanıcı sayısı 10 ve üzeri olmalı.");
        return;
      }

      setOfferSending(true);

      await apiFetch("/api/support/teklif-al", {
        method: "POST",
        body: JSON.stringify({
          companyName: offerForm.companyName,
          name: offerForm.fullName,
          email: offerForm.email,
          users: users,
          message: offerForm.message,
          source: "panel",
        }),
      });

      alert("Talebiniz alınmıştır. En kısa sürede tarafınıza geri dönüş sağlanacaktır. ✅");
      closeOfferModal();
    } catch (e) {
      setOfferError(e.message || "Teklif talebi gönderilemedi");
    } finally {
      setOfferSending(false);
    }
  };

  const isOfferVatIncluded = (offer) => {
    if (!offer) return false;

    if (typeof offer.kdv_included === "boolean") return offer.kdv_included;
    if (typeof offer.vat_included === "boolean") return offer.vat_included;

    const note = String(offer.note || "").toLocaleLowerCase("tr-TR");
    if (note.includes("kdv") && note.includes("dahil")) return true;
    if (note.includes("kdv") && (note.includes("dahildir") || note.includes("dâhildir"))) return true;

    return false;
  };



  // ✅ Kullanıcı mevcut sabit paketin içindeyse teklif kartı görünmesin
  const fitsCurrentFixedPlan = useMemo(() => {
    const users = Number(state.usersCount || 0);
    const current = String(state.currentPlanId || "");

    if (current === "ticari-5") return users >= 1 && users <= 5;
if (current === "ticari-10") return users >= 6 && users <= 10;
if (current === "ticari-15") return users >= 11 && users <= 15;

    return false;
  }, [state.usersCount, state.currentPlanId]);

  // ✅ Sabit pakette ve kullanıcı sayısı 10'u geçmiyorsa teklif bilgisi gösterme
  const shouldHideOfferInfo = useMemo(() => {
    const current = String(state.currentPlanId || "");
    const isFixedPlan = ["ticari-5", "ticari-10", "ticari-15"].includes(current);
    return isFixedPlan && fitsCurrentFixedPlan && Number(state.usersCount || 0) <= 10;
  }, [state.currentPlanId, state.usersCount, fitsCurrentFixedPlan]);

  // ✅ Teklif istenebilir mi?
  const offerPriceTRY = useMemo(() => {
  return Number(
    offerData?.price_try ||
      offerData?.priceTRY ||
      offerData?.amountTRY ||
      offerData?.amount ||
      0
  );
}, [offerData]);

const offerUsersCount = useMemo(() => {
  return Number(offerData?.users_count || offerData?.usersCount || 0);
}, [offerData]);

const offerStatus = useMemo(() => {
  return String(offerData?.status || "").toLowerCase().trim();
}, [offerData]);

const hasValidPanelOffer = useMemo(() => {
  if (!offerData) return false;

  // ✅ sadece kullanıcıya gösterilecek bekleyen teklifler
  const allowedStatuses = ["sent", "opened", "registered"];

  return (
    allowedStatuses.includes(offerStatus) &&
    offerPriceTRY > 0 &&
    offerUsersCount >= 10
  );
}, [offerData, offerStatus, offerPriceTRY, offerUsersCount]);
const offerStatusLower = useMemo(() => {
  return String(offerData?.status || "").toLowerCase().trim();
}, [offerData?.status]);

const offerAcceptedButUnpaid = useMemo(() => {
  return offerStatusLower === "registered" || offerAccepted;
}, [offerStatusLower, offerAccepted]);

const offerPaidOrActive = useMemo(() => {
  return ["paid", "active"].includes(offerStatusLower);
}, [offerStatusLower]);

const offerAlreadyAccepted = useMemo(() => {
  return offerAcceptedButUnpaid || offerPaidOrActive;
}, [offerAcceptedButUnpaid, offerPaidOrActive]);

const showOfferInfoCard = useMemo(() => {
  if (offerPaidOrActive) return false;

  if (hasValidPanelOffer) return true;

  if (shouldHideOfferInfo) return false;

  if (isPilot && Number(state.usersCount || 0) >= 10) {
    return hasValidPanelOffer;
  }

  return Boolean(
    offerLoading ||
      offerFetchError ||
      (offerAcceptedButUnpaid && offerData && offerPriceTRY > 0)
  );
}, [
  offerPaidOrActive,
  hasValidPanelOffer,
  shouldHideOfferInfo,
  isPilot,
  state.usersCount,
  offerLoading,
  offerFetchError,
  offerAcceptedButUnpaid,
  offerData,
  offerPriceTRY,
]);

const showPreAcceptOfferCard = useMemo(() => {
  // ✅ sadece henüz kabul edilmemiş tekliflerde göster
  return showOfferInfoCard && !offerAcceptedButUnpaid && !offerPaidOrActive;
}, [showOfferInfoCard, offerAcceptedButUnpaid, offerPaidOrActive]);

const canRequestOffer = useMemo(() => {
  // ✅ gerçek teklif varsa yeniden teklif al butonu çıkmasın
  if (hasValidPanelOffer) return false;

  if (isPilot && state.currentPlanId === "prof-ozel") {
    return !showOfferInfoCard;
  }

  return !shouldHideOfferInfo;
}, [
  hasValidPanelOffer,
  isPilot,
  state.currentPlanId,
  showOfferInfoCard,
  shouldHideOfferInfo,
]);

 const acceptOfferAndContinue = async () => {
  if (!offerData) return;

  const offerUsers = Number(offerData.users_count || 0) || state.usersCount || 1;
  const offerPrice = Number(
    offerData.price_try ||
      offerData.priceTRY ||
      offerData.amountTRY ||
      offerData.amount ||
      0
  );

  if (offerPrice <= 0) {
    alert("Teklif tutarı bulunamadı.");
    return;
  }

  try {
    const offerId = offerData?.id || offerData?.offer_id;
    if (!offerId) {
      alert("Teklif ID bulunamadı.");
      return;
    }

    await apiFetch("/api/offers/accept", {
      method: "POST",
      body: JSON.stringify({
        offerId,
        orgUuid,
      }),
    });

    setOfferData((o) => (o ? { ...o, status: "registered" } : o));
  } catch (e) {
    alert(e.message || "Teklif kabul edilemedi");
    return;
  }

  setOfferAccepted(true);
  setCanPay(false);
  setRenewChecks({ kvkk: false, terms: false, sales: false });

  setState((s) => ({
    ...s,

    // ✅ reddette geri dönebilmek için mevcut paketi sakla
    preOfferPlanId: s.currentPlanId,
    preOfferUsersCount: s.usersCount,
    preOfferPeriod: s.activePeriod || s.period,

    currentPlanId: "prof-ozel",
    usersCount: offerUsers,
    amountTRY: offerPrice,
    renewFlow: { active: false },
    upgradeFlow: { active: false, mode: null, targetPlanId: null },
    addUsersFlow: { active: false, ready: false, addUsersCount: 0 },
  }));
};

// ✅ Teklif reddet
const rejectOfferAndStayCurrent = async () => {
  if (!offerData) return;

  try {
    const offerId = offerData?.id || offerData?.offer_id;

    await apiFetch("/api/offers/reject", {
      method: "POST",
      body: JSON.stringify({
        offerId,
        orgUuid,
      }),
    });

    setOfferData((o) => (o ? { ...o, status: "canceled" } : o));

    setOfferAccepted(false);
    setCanPay(false);
    setRenewChecks({ kvkk: false, terms: false, sales: false });

    setState((s) => ({
      ...s,
      currentPlanId: s.preOfferPlanId || s.currentPlanId,
      usersCount: Number(s.preOfferUsersCount || s.usersCount || 1),
      period: s.preOfferPeriod || s.period,
      activePeriod: s.preOfferPeriod || s.activePeriod,
      amountTRY: 0,
      renewFlow: { active: false },
      upgradeFlow: { active: false, mode: null, targetPlanId: null },
      addUsersFlow: { active: false, ready: false, addUsersCount: 0 },
    }));

    await fetchSubscriptionData();
    await fetchOfferData();
  } catch (e) {
    alert(e.message || "Teklif reddedilemedi");
  }
};

  const upgradeChecksOk = offerChecks.kvkk && offerChecks.terms && offerChecks.sales;

  const continueUpgradeFlow = () => {
    if (!(offerChecks.kvkk && offerChecks.terms && offerChecks.sales)) {
      alert("Devam etmek için sözleşmeleri onaylayınız.");
      return;
    }

    const targetId = state.upgrade?.targetPlanId;
    if (!targetId) {
      alert("Seçilen paket bulunamadı.");
      return;
    }

    const mode =
  state.currentPlanId && state.activePeriod
    ? "UPGRADE"
    : "NEW";

const carryOverDays =
  state.activePeriod
    ? Number(daysLeft || 0)
    : 0;


    setState((s) => ({
      ...s,
      upgradeFlow: {
        active: true,
        mode,
        targetPlanId: targetId,
      },
    }));
  };

    const continueRenewFlow = () => {
    if (!(renewChecks.kvkk && renewChecks.terms && renewChecks.sales)) {
      alert("Devam etmek için sözleşmeleri onaylayınız.");
      return;
    }

    setState((s) => ({
      ...s,
      renewFlow: { active: true },
    }));

    // ✅ Pilot dahil tüm akışlarda sözleşme sonrası fiyat ekranı açılsın
    setCanPay(true);
  };

  const startAddUsersFlow = () => {
    const c = Math.max(1, Number(state.addUsersCount || 1));

    setState((s) => ({
      ...s,
      addUsersFlow: { active: true, ready: false, addUsersCount: c },
    }));

    setAddUsersChecks({ kvkk: false, terms: false, sales: false });
  };

  const continueAddUsersFlow = () => {
  if (!(addUsersChecks.kvkk && addUsersChecks.terms && addUsersChecks.sales)) {
    alert("Devam etmek için sözleşmeleri onaylayınız.");
    return;
  }

  setState((s) => ({
    ...s,
    addUsersFlow: {
      ...s.addUsersFlow,
      active: true,
      ready: true,
      addUsersCount: Math.max(1, Number(s.addUsersFlow?.addUsersCount || s.addUsersCount || 1)),
    },
  }));

  setCanPay(true);
};

  // Paket yükseltme
  const changePlan = (planId) => {
    if (planId === "kurumsal_10_plus") {
      openOfferModal();
      return;
    }
    if (planId === state.currentPlanId) return;

    const targetPlan = plans.find((p) => p.id === planId);
    if (!targetPlan) return;

const diff = calculateUpgradeDiff({
  currentPlan,
  targetPlan,
  period: state.period,
  activePeriod: state.activePeriod,
  daysLeft,
  vatRate: VAT_RATE,
});

    if (!diff) {
      alert("Bu paket için yükseltme hesaplanamadı.");
      return;
    }

    setOfferChecks({ kvkk: false, terms: false, sales: false });

    setState((s) => ({
      ...s,
      upgrade: {
        targetPlanId: planId,
        daysLeft,
        diffAmountExVat: diff.diffAmountExVat,
        diffVat: diff.diffVat,
        diffTotal: diff.diffTotal,
        show: true,
      },
      upgradeFlow: { active: false, mode: null, targetPlanId: null },
      renewFlow: { active: false },
    }));
    setCanPay(false);
  };

  useEffect(() => {
    if (!state.upgrade?.show || !state.upgrade?.targetPlanId) return;

    const targetPlan = plans.find((p) => p.id === state.upgrade.targetPlanId);
    if (!targetPlan) return;

const diff = calculateUpgradeDiff({
  currentPlan,
  targetPlan,
  period: state.period,
  activePeriod: state.activePeriod,
  daysLeft,
  vatRate: VAT_RATE,
});


    if (!diff) return;

    setState((s) => ({
      ...s,
      upgrade: {
        ...s.upgrade,
        diffAmountExVat: diff.diffAmountExVat,
        diffVat: diff.diffVat,
        diffTotal: diff.diffTotal,
      },
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.period]);

  // ✅ Gerçek iyzico init + modal aç (popup)
  const iyzicoOde = async ({ type = "NEW", amount, addUsersCount, carryOverDays = 0, isRenewal = false } = {}) => {
    try {
      setIyzicoError("");
      setIyzicoLoading(true);

      if (!orgUuid) {
        throw new Error("Organizasyon bulunamadı. Lütfen sayfayı yenileyip tekrar deneyin.");
      }

    const payload = {
  currentPlanId: state.currentPlanId,
  usersCount: state.usersCount,
  period: state.period,
  type,
  orgUuid: orgUuid || undefined,
  carryOverDays: Number(arguments?.[0]?.carryOverDays || 0),
  isRenewal: Boolean(arguments?.[0]?.isRenewal),

  // ✅ Yıllık geçiş + paket değişimi (upgradeFlow NEW) için hedef paket mutlaka gitmeli
  ...(state.upgradeFlow?.active && state.upgradeFlow?.targetPlanId
    ? { targetPlanId: state.upgradeFlow.targetPlanId }
    : {}),
};

if (type === "OFFER") {
  // ✅ Özel teklif mahsuplaşması:
  // Teklif tam dönem fiyatıdır.
  // Mevcut paketin kalan kullanılmamış değeri teklif tutarından düşülür.

  const offerFullAmount = Number(amount || selectedOfferPrice || state.amountTRY || 0);

  const safeDaysLeft = Math.max(0, Number(daysLeft || 0));

  const currentBaseDays =
    state.activePeriod === "Yıllık" ? 365 : 30;

  const currentExVat =
    state.activePeriod === "Yıllık"
      ? Number(currentPlan?.yearlyExVat || 0)
      : Number(currentPlan?.monthlyExVat || 0);

  const currentIncVat =
    Math.round(currentExVat + currentExVat * VAT_RATE);

  const currentCredit =
    currentBaseDays > 0
      ? Math.round(currentIncVat * (safeDaysLeft / currentBaseDays))
      : 0;

  const proratedOfferAmount = Math.max(
    0,
    Math.round(offerFullAmount - currentCredit)
  );

  payload.amount = proratedOfferAmount;
  payload.offerFullAmount = offerFullAmount;
  payload.offerCurrentCredit = currentCredit;
  payload.offerProrated = true;
  payload.carryOverDays = safeDaysLeft;

  const offerId = offerData?.id || offerData?.offer_id;
  const offerToken = offerData?.token;

  if (offerId) payload.offerId = offerId;
  if (offerToken) payload.offerToken = offerToken;
}

      const addC = Number(addUsersCount || 0);
      if (addC > 0) {
        payload.addUsersCount = addC;
        payload.addUsersMode = "WITH_PLAN";
      }

      if (type === "ADD_USERS") {
  payload.amount = Number(amount || 0);
  payload.addUsersCount = Number(addUsersCount || state.addUsersCount || 1);

  // ✅ mevcut abonelik süresi bozulmadan devam etsin
  payload.keepExistingEndAt = true;
  payload.currentEndAtISO = state.endAtISO || "";
  payload.currentStartAtISO = state.startAtISO || "";
  payload.activePeriod = state.activePeriod;
}


if (type === "UPGRADE" && state.upgrade?.targetPlanId) {
  payload.targetPlanId = state.upgrade.targetPlanId;
}

// ✅ GENEL FIX: NEW (özellikle Yıllık geçiş / paket değişimi) için de amount gönder.
// Backend zaten amount'u "max paket ücreti" ile kısıtlıyor (billing.js).
if (payload.amount == null) {
  const a = Number(amount || 0);
  if (Number.isFinite(a) && a > 0) {
    payload.amount = Math.round(a); // KDV DAHİL (summaryTotal)
  }
}

const finalAmount =
  state.currentPlanId === "prof-ozel" && Number(state.amountTRY || 0) > 0
    ? state.period === "Yıllık"
      ? Math.round(Number(state.amountTRY) * 10)
      : Math.round(Number(state.amountTRY))
    : Math.round(payload.amount || payload.amountTRY || incVatPrice || 0);

const params = new URLSearchParams({
  plan: payload.targetPlanId || payload.planCode || payload.planId || state.currentPlanId,
  period: state.period,
  org: orgUuid || "",
  agreements: "1",
  type: payload.type || "NEW",
  users: String(state.usersCount || 1),
  amount: String(Math.round(payload.amount || payload.amountTRY || incVatPrice || 0)),
  carryOverDays: String(Number(payload.carryOverDays || 0)),
  isRenewal: payload.isRenewal ? "1" : "0",
});
window.location.href = `/odeme?${params.toString()}`;
return;
    } catch (e) {
      setIyzicoError(e.message || "iyzico başlatılamadı");
      setShowIyzicoModal(true);
    } finally {
      setIyzicoLoading(false);
    }
  };

  /** =========================
   *  UI helpers
   *  ========================= */
  const emphasizedPrice = (exPrice) => {
    const ex = Number(exPrice || 0);
    const inc = ex + Math.round(ex * VAT_RATE);
    return state.showVatIncluded ? trCurrency(inc) : trCurrency(ex);
  };

  const badge = useMemo(() => {
    if (state.currentPlanId === "prof-ozel")
      return { text: "Özel", cls: "bg-purple-100 text-purple-800 border-purple-200" };
    if (state.period === "Yıllık")
      return { text: "Kampanya", cls: "bg-green-100 text-green-800 border-green-200" };
    return { text: "Aktif", cls: "bg-blue-50 text-blue-700 border-blue-200" };
  }, [state.currentPlanId, state.period]);

 const isProfOzelActive = useMemo(() => {
  return state.currentPlanId === "prof-ozel" && Number(state.amountTRY || 0) > 0;
}, [state.currentPlanId, state.amountTRY]);

const offerAdminNote = useMemo(() => {
  return String(
    offerData?.note ||
      offerData?.admin_note ||
      offerData?.adminNote ||
      ""
  ).trim();
}, [offerData]);

const selectedOfferPrice = useMemo(() => {
  const monthlyIncVat = Number(state.amountTRY || 0);
  if (monthlyIncVat <= 0) return 0;

  if (state.period === "Yıllık") {
    return Math.round(monthlyIncVat * 10);
  }

  return monthlyIncVat;
}, [state.amountTRY, state.period]);

const selectedOfferExVat = useMemo(() => {
  return Math.round(Number(selectedOfferPrice || 0) / (1 + VAT_RATE));
}, [selectedOfferPrice, VAT_RATE]);

const selectedOfferVat = useMemo(() => {
  return Number(selectedOfferPrice || 0) - Number(selectedOfferExVat || 0);
}, [selectedOfferPrice, selectedOfferExVat]);

  // ✅ Tekliften kişi başı baz tutar (TRY) çek
  const getOfferPerUserBaseTRY = (offer, fallbackUsersCount) => {
  // ✅ önce teklif üzerindeki gerçek kullanıcı sayısını baz al
  const offerUsers = Math.max(
    1,
    Number(
      offer?.users_count ||
      offer?.usersCount ||
      fallbackUsersCount ||
      1
    )
  );

  // ✅ backend kişi başı fiyat verdiyse direkt onu kullan
  const perUserDirect = Number(
    offer?.per_user_price_try ||
    offer?.perUserPriceTRY ||
    offer?.per_user_try ||
    offer?.perUserTRY ||
    0
  );

  if (perUserDirect > 0) return perUserDirect;

  // ✅ toplam teklif tutarı / teklif kullanıcı sayısı
  const totalOfferPrice = Number(
    offer?.price_try ||
    offer?.priceTRY ||
    offer?.amountTRY ||
    offer?.amount ||
    0
  );

  if (totalOfferPrice > 0 && offerUsers > 0) {
    return totalOfferPrice / offerUsers;
  }

  return 0;
};

  const planTitle = useMemo(() => currentPlan?.name || "Paket Bilgisi Yok", [currentPlan]);

  const planMeta = useMemo(() => {
    const addNow =
      state.currentPlanId === "prof-ozel" && state.addUsersFlow?.active
        ? Number(state.addUsersFlow.addUsersCount || 0)
        : 0;

    const usersText =
      state.currentPlanId === "prof-ozel"
        ? addNow > 0
          ? `${state.usersCount} + ${addNow} kullanıcı`
          : `${state.usersCount} kullanıcı (teklifli)`
        : currentPlan?.users || `${state.usersCount} kullanıcı`;

    const periodText = state.period === "Yıllık" ? "Yıllık" : "Aylık";
    return `${usersText} • ${periodText}`;
  }, [state.currentPlanId, state.usersCount, state.addUsersFlow?.active, state.addUsersFlow?.addUsersCount, currentPlan, state.period]);

  // ✅ ÖDEME ÖZETİ HESABI (upgradeFlow)
  const upgradeTargetPlan = useMemo(() => {
    const id = state.upgradeFlow?.targetPlanId;
    return id ? plans.find((p) => p.id === id) : null;
  }, [state.upgradeFlow?.targetPlanId, plans]);

const payExVat = useMemo(() => {
  // ✅ Normal ödeme / yenileme
  if (!state.upgradeFlow?.active) {
    return Math.round(Number(exVatPrice || 0));
  }

  const targetPlan = upgradeTargetPlan || selectedBillingPlan;
  if (!targetPlan) return 0;

  const targetPrice =
    state.period === "Yıllık"
      ? Number(targetPlan.yearlyExVat || 0)
      : Number(targetPlan.monthlyExVat || 0);

  const currentPrice =
    state.activePeriod === "Yıllık"
      ? Number(currentPlan?.yearlyExVat || 0)
      : Number(currentPlan?.monthlyExVat || 0);

  const currentBaseDays = state.activePeriod === "Yıllık" ? 365 : 30;
  const targetBaseDays = state.period === "Yıllık" ? 365 : 30;
  const safeDaysLeft = Math.max(0, Number(daysLeft || 0));

  // ✅ Aynı dönem paket yükseltme
  if (state.period === state.activePeriod) {
    const dailyTarget = targetPrice / targetBaseDays;
    const dailyCurrent = currentPrice / currentBaseDays;

    return Math.max(
      0,
      Math.round((dailyTarget - dailyCurrent) * safeDaysLeft)
    );
  }

  // ✅ Aylık → Yıllık / yıllık dönem değişimi
  const currentCredit =
    currentBaseDays > 0
      ? currentPrice * (safeDaysLeft / currentBaseDays)
      : 0;

  return Math.max(0, Math.round(targetPrice - currentCredit));
}, [
  state.upgradeFlow?.active,
  state.period,
  state.activePeriod,
  exVatPrice,
  upgradeTargetPlan,
  selectedBillingPlan,
  currentPlan,
  daysLeft,
]);

const payVat = useMemo(() => {
  return Math.round(Number(payExVat || 0) * VAT_RATE);
}, [payExVat, VAT_RATE]);

const payTotal = useMemo(() => {
  return Math.round(Number(payExVat || 0) + Number(payVat || 0));
}, [payExVat, payVat]);

const shouldUseProratedPay =
  state.period === "Yıllık" &&
  state.activePeriod === "Aylık" &&
  Number(daysLeft || 0) > 0;

const summaryExVat =
  state.upgradeFlow?.active || shouldUseProratedPay ? payExVat : exVatPrice;

const summaryVat =
  state.upgradeFlow?.active || shouldUseProratedPay ? payVat : vatAmount;

const summaryTotal =
  state.upgradeFlow?.active || shouldUseProratedPay ? payTotal : incVatPrice;
  // ✅ Ek kullanıcı ücreti (ready olunca hesap)
const addUsersPay = useMemo(() => {
  if (state.currentPlanId !== "prof-ozel") return null;
  if (!state.addUsersFlow?.ready) return null;

  const addCount = Math.max(1, Number(state.addUsersFlow?.addUsersCount || 0));
  if (addCount <= 0) return null;

  const totalDays = state.period === "Yıllık" ? 365 : 30;
  const safeDaysLeft = Math.max(0, Number(daysLeft || 0));
  const ratio = totalDays > 0 ? safeDaysLeft / totalDays : 0;

  // ✅ kişi başı teklif = teklif toplamı / teklif kullanıcı sayısı
  const perUserBaseTRY = getOfferPerUserBaseTRY(
    offerData,
    Number(offerData?.users_count || offerData?.usersCount || state.usersCount || 1)
  );

  if (perUserBaseTRY <= 0) return null;

  const vatIncluded = isOfferVatIncluded(offerData);

  // ✅ kişi başı KDV hariç baz
  const perUserExVat = vatIncluded
    ? perUserBaseTRY / (1 + VAT_RATE)
    : perUserBaseTRY;

  // ✅ sadece eklenecek kullanıcı sayısı kadar hesapla
  const periodMultiplier = state.period === "Yıllık" ? 10 : 1;
const ex = Math.round(perUserExVat * periodMultiplier * addCount * ratio);
  const vat = Math.round(ex * VAT_RATE);
  const total = ex + vat;

  return {
    addCount,
    ratio,
    safeDaysLeft,
    perUserBaseTRY,
    perUserExVat,
    ex,
    vat,
    total,
  };
}, [state.currentPlanId, state.addUsersFlow, state.activePeriod, daysLeft, offerData, state.usersCount, VAT_RATE]);


return (
    <div className="max-w-5xl mx-auto mt-6 space-y-6">
      {/* Header */}
      <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-[#0a2b45] to-[#0f4c81] text-white">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold">💳 Ticari Abonelik & Ödemeler</h2>
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${badge.cls}`}>
                  {badge.text}
                </span>
              </div>
              <p className="text-white/80 text-sm mt-1">
                Abonelik işlemleriniz güvenli ödeme altyapısı üzerinden yürütülür. Kart bilgileri sistemde saklanmaz.
              </p>
            </div>

            <div className="md:text-right">
              <div className="text-white/70 text-xs">Kalan Süre</div>
              <div className="text-2xl font-extrabold leading-tight">
  {state.endAtISO ? `${daysLeft} gün` : "—"}
</div>
<div className="text-white/80 text-xs mt-1">
  Bitiş: <span className="font-semibold">{state.endAtISO ? toDateOnly(state.endDate) : "—"}</span>
  {state.endAtISO ? (
    <span className="ml-2 text-[11px] text-white/70 tabular-nums">{countdown.hms}</span>
  ) : null}
</div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl bg-white/10 border border-white/15 p-3">
              <div className="text-[11px] text-white/70">Paket</div>
              <div className="font-semibold">{planTitle}</div>
              <div className="text-xs text-white/70">{planMeta}</div>
            </div>
            <div className="rounded-xl bg-white/10 border border-white/15 p-3">
              <div className="text-[11px] text-white/70">Başlangıç</div>
              <div className="font-semibold">{state.startDate}</div>
              <div className="text-xs text-white/70">
  {state.endAtISO ? "Abonelik aktif" : "Ödeme bekleniyor"}
</div>
            </div>
            <div className="rounded-xl bg-white/10 border border-white/15 p-3">
              <div className="text-[11px] text-white/70">Firma</div>
              <div className="font-semibold">{firmName}</div>
              <div className="text-xs text-white/70">{[firmPhone, firmMail].filter(Boolean).join(" • ") || "—"}</div>
            </div>
          </div>
        </div>


        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Owner cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border bg-white p-4">
              <div className="text-xs text-gray-500">Abonelik Sahibi</div>
              <div className="text-sm font-semibold text-gray-800 mt-1">{ownerName}</div>
              <div className="text-xs text-gray-600">{ownerEmail || "—"}</div>
            </div>
            <div className="rounded-2xl border bg-white p-4">
              <div className="text-xs text-gray-500">Firma</div>
              <div className="text-sm font-semibold text-gray-800 mt-1">{firmName}</div>
              <div className="text-xs text-gray-600">{[firmPhone, firmMail].filter(Boolean).join(" • ") || "—"}</div>
            </div>
            <div className="rounded-2xl border bg-white p-4">
              <div className="text-xs text-gray-500">Yenileme</div>
              <div className="text-sm font-semibold text-gray-800 mt-1">
                {state.autoRenew ? "Otomatik Yenileme Açık" : "Otomatik Yenileme Kapalı"}
              </div>
              <div className="text-xs text-gray-600 mt-1">Bitiş: {state.endDate}</div>
            </div>
          </div>

          {/* Main grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Plan card */}
            <div className="rounded-2xl border bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs text-gray-500">Paket</div>
                  <div className="text-lg font-bold text-[#0a2b45] mt-1">{planTitle}</div>
                  <div className="text-sm text-gray-600 mt-1 italic">{currentPlan?.note || ""}</div>
                  <div className="text-sm text-gray-700 mt-2">
                    {state.currentPlanId === "prof-ozel" ? (
                      state.addUsersFlow?.active && Number(state.addUsersFlow.addUsersCount || 0) > 0 ? (
                        <span>
                          {state.usersCount} + {Number(state.addUsersFlow.addUsersCount || 0)} kullanıcı
                        </span>
                      ) : (
                        <span>{state.usersCount} kullanıcı (teklifli)</span>
                      )
                    ) : (
                      <span>{currentPlan?.users || ""}</span>
                    )}
                  </div>
                </div>

                {state.period === "Yıllık" && (
                  <div className="px-3 py-1.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
                    🎁 2 ay bizden
                  </div>
                )}
              </div>

                                        {/* Kurumsal Teklif */}
              {showPreAcceptOfferCard && hasValidPanelOffer && (
                <div className="rounded-2xl border bg-white p-5 mt-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs text-gray-500">Kurumsal Teklif</div>
                      <div className="text-lg font-bold text-[#0a2b45] mt-1">Teklif Bilgisi</div>
                      <div className="text-xs text-gray-500 mt-1">Kurumunuza tanımlı en güncel teklif</div>
                    </div>

                    {offerData &&
                      (() => {
                        const st = String(offerData?.status || "").toLowerCase();
                        const isAccepted = ["registered", "paid", "active"].includes(st) || offerAccepted;
                        const isExpired = ["expired", "canceled"].includes(st);

                        if (isExpired) {
                          return (
                            <span className="px-3 py-1 rounded-full text-xs font-semibold border bg-red-100 text-red-700 border-red-200">
                              Süresi Doldu / İptal
                            </span>
                          );
                        }

                        if (isAccepted) {
                          return (
                            <span className="px-3 py-1 rounded-full text-xs font-semibold border bg-emerald-100 text-emerald-800 border-emerald-200 inline-flex items-center gap-2">
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-600 text-white text-[12px] leading-none">
                                ✓
                              </span>
                              <span>Kabul Edildi</span>
                            </span>
                          );
                        }

                        return (
                          <span className="px-3 py-1 rounded-full text-xs font-semibold border bg-yellow-100 text-yellow-700 border-yellow-200">
                            Süreçte
                          </span>
                        );
                      })()}
                  </div>

                  <div className="mt-4">
                    {offerLoading ? (
                      <div className="text-sm text-gray-500">Yükleniyor…</div>
                    ) : offerFetchError ? (
                      <div className="text-sm text-red-600">{offerFetchError}</div>
                    ) : !offerData ? (
                      <div className="text-sm text-gray-600">Kurumsal teklif bulunamadı.</div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div>
                          <div className="text-gray-500 text-xs">Firma</div>
                          <div className="font-semibold">{offerData.company_name || "—"}</div>
                        </div>

                        <div>
                          <div className="text-gray-500 text-xs">Kullanıcı</div>
                          <div className="font-semibold">{offerData.users_count || "—"}</div>
                        </div>

                        <div>
                          <div className="text-gray-500 text-xs">Teklif Tutarı</div>
                          <div className="font-semibold">
                            {offerData.price_try ? trCurrency(offerData.price_try) : "—"}
                          </div>

                          {(() => {
                            const st = String(offerData?.status || "").toLowerCase();
                            const isExpired = ["expired", "canceled"].includes(st);
                            const isAccepted = ["registered", "paid", "active"].includes(st) || offerAccepted;

                            return (
                              <div className="mt-4 space-y-3">



<div className="mt-4 flex flex-col sm:flex-row gap-2">
  <button
    type="button"
    onClick={acceptOfferAndContinue}
    className={`${BTN_GREEN} w-full sm:w-auto`}
    disabled={
      isAccepted ||
      isExpired ||
      Number(
        offerData?.price_try ||
          offerData?.priceTRY ||
          offerData?.amountTRY ||
          offerData?.amount ||
          0
      ) <= 0
    }
  >
    {isAccepted
      ? "Teklif Kabul Edildi"
      : Number(
          offerData?.price_try ||
            offerData?.priceTRY ||
            offerData?.amountTRY ||
            offerData?.amount ||
            0
        ) <= 0
      ? "Teklif Tutarı Eksik"
      : "Teklifi Kabul Et"}
  </button>

  {!isExpired && !offerPaidOrActive && (
    <button
      type="button"
      onClick={rejectOfferAndStayCurrent}
      className={`${BTN_OUTLINE} w-full sm:w-auto`}
    >
      Reddet
    </button>
  )}

  {isExpired && (
    <div className="text-xs text-red-600 self-center">
      Bu teklifin süresi dolmuş/iptal edilmiş.
    </div>
  )}
</div>
                              </div>
                            );
                          })()}
                        </div>

                        <div>
                          <div className="text-gray-500 text-xs">Süre</div>
                          <div className="font-semibold">
                            {offerData.duration_days ? `${offerData.duration_days} gün` : "—"}
                          </div>
                        </div>

                        <div>
                          <div className="text-gray-500 text-xs">Link Geçerlilik</div>
                          <div className="font-semibold">
                            {offerData.link_expires_at
                              ? new Date(offerData.link_expires_at).toLocaleDateString("tr-TR")
                              : "—"}
                          </div>
                        </div>

                        <div className="md:col-span-2">
                          <div className="text-gray-500 text-xs">Not</div>
                          <div className="text-gray-700">{offerData.note || "—"}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ✅ Paket Yükseltme Paneli */}
              {state.currentPlanId !== "prof-ozel" && state.upgrade?.show && (
                <div className="rounded-2xl border bg-white p-5 mb-5 mt-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs text-gray-500">Paket Yükseltme</div>
                      <div className="text-lg font-bold text-[#0a2b45] mt-1">Seçilen Paket</div>
                      <div className="text-xs text-gray-500 mt-1">
  Paket yükseltmede ücret, hedef paket fiyatına göre hesaplanır. Yıllık pakete geçişte mevcut paketin kalan süresi mahsup edilir.
</div>
                    </div>

                    <span className="px-3 py-1 rounded-full text-xs font-semibold border bg-yellow-100 text-yellow-700 border-yellow-200">
                      Süreçte
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-gray-500 text-xs">Paket</div>
                      <div className="font-semibold">
                        {plans.find((p) => p.id === state.upgrade.targetPlanId)?.name || "—"}
                      </div>
                    </div>

                    <div>
                      <div className="text-gray-500 text-xs">Kalan Gün</div>
                      <div className="font-semibold">{daysLeft} gün</div>
                    </div>
                  </div>

                  {/* Sözleşme Onayları */}
                  <div className="mt-4 space-y-3 text-sm text-gray-800">
                    {/* KVKK */}
                    <div className="flex flex-col">
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={offerChecks.kvkk}
                          onChange={(e) => setOfferChecks((c) => ({ ...c, kvkk: e.target.checked }))}
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
                          checked={offerChecks.terms}
                          onChange={(e) => setOfferChecks((c) => ({ ...c, terms: e.target.checked }))}
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
                          checked={offerChecks.sales}
                          onChange={(e) => setOfferChecks((c) => ({ ...c, sales: e.target.checked }))}
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
                      onClick={() => {
                        continueUpgradeFlow();
                        setCanPay(true);
                      }}
                      className={`${BTN_GREEN} w-full sm:w-auto`}
                      disabled={!upgradeChecksOk}
                    >
                      Devam Et
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setState((s) => ({
                          ...s,
                          upgrade: { ...s.upgrade, show: false, targetPlanId: null },
                          upgradeFlow: { active: false, mode: null, targetPlanId: null },
                        }));
                        setOfferChecks({ kvkk: false, terms: false, sales: false });
                        setCanPay(false);
                      }}
                      className={`${BTN_OUTLINE} w-full sm:w-auto`}
                    >
                      Vazgeç
                    </button>
                  </div>
                </div>
              )}

              {/* ✅ Kurumsal Ek Kullanıcı sözleşmeleri */}
              {state.currentPlanId === "prof-ozel" && state.addUsersFlow?.active && (
  <div className="mt-5 rounded-2xl border bg-white p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs text-gray-500">Kurumsal Ek Kullanıcı</div>
                      <div className="text-lg font-bold text-[#0a2b45] mt-1">Sözleşmeler</div>
                     <div className="text-xs text-gray-500 mt-1">
  Ek kullanıcı ücreti, teklif fiyatına göre kişi başı ve kalan gün oranlı hesaplanır.
  Mevcut abonelik süresi değişmez.
</div>
                    </div>

                    <span className="px-3 py-1 rounded-full text-xs font-semibold border bg-yellow-100 text-yellow-700 border-yellow-200">
                      Süreçte
                    </span>
                  </div>

                  <div className="mt-4 space-y-3 text-sm text-gray-800">
                    {/* KVKK */}
                    <div className="flex flex-col">
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={addUsersChecks.kvkk}
                          onChange={(e) => setAddUsersChecks((c) => ({ ...c, kvkk: e.target.checked }))}
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
                          checked={addUsersChecks.terms}
                          onChange={(e) => setAddUsersChecks((c) => ({ ...c, terms: e.target.checked }))}
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
                          checked={addUsersChecks.sales}
                          onChange={(e) => setAddUsersChecks((c) => ({ ...c, sales: e.target.checked }))}
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

                  <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-end">
                   <button
  type="button"
  onClick={continueAddUsersFlow}
  className={`${BTN_GREEN} w-full sm:w-auto`}
  disabled={!(addUsersChecks.kvkk && addUsersChecks.terms && addUsersChecks.sales)}
>
  Devam Et
</button>

                    <button
                      type="button"
                      onClick={() => {
                        setState((s) => ({
                          ...s,
                          addUsersFlow: { active: false, ready: false, addUsersCount: 0 },
                        }));
                        setAddUsersChecks({ kvkk: false, terms: false, sales: false });
                        setCanPay(false);
                      }}
                      className={`${BTN_OUTLINE} w-full sm:w-auto`}
                    >
                      Vazgeç
                    </button>
                  </div>
                </div>
              )}

                           {/* ✅ Paket Yenileme (Pilotta mevcut paket uygunsa teklif yokmuş gibi davran) */}
              {state.currentPlanId !== "prof-ozel" &&
                !state.upgrade?.show &&
                !((offerData && !offerAlreadyAccepted) && !shouldHideOfferInfo) && (
                <div className="mt-5 rounded-2xl border bg-white p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs text-gray-500">Paket Yenileme</div>
                      <div className="text-lg font-bold text-[#0a2b45] mt-1">Sözleşmeler</div>
                      <div className="text-xs text-gray-500 mt-1">
                        Ödemeye geçmek için sözleşmeleri onaylayıp devam edin.
                      </div>
                    </div>

                    <span className="px-3 py-1 rounded-full text-xs font-semibold border bg-yellow-100 text-yellow-700 border-yellow-200">
                      Süreçte
                    </span>
                  </div>

                  <div className="mt-4 space-y-3 text-sm text-gray-800">
                    {/* KVKK */}
                    <div className="flex flex-col">
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={renewChecks.kvkk}
                          onChange={(e) => setRenewChecks((c) => ({ ...c, kvkk: e.target.checked }))}
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
                          checked={renewChecks.terms}
                          onChange={(e) => setRenewChecks((c) => ({ ...c, terms: e.target.checked }))}
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
                          checked={renewChecks.sales}
                          onChange={(e) => setRenewChecks((c) => ({ ...c, sales: e.target.checked }))}
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
                      onClick={continueRenewFlow}
                      className={`${BTN_GREEN} w-full sm:w-auto`}
                      disabled={!(renewChecks.kvkk && renewChecks.terms && renewChecks.sales)}
                    >
                      Devam Et
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setState((s) => ({ ...s, renewFlow: { active: false } }));
                        setRenewChecks({ kvkk: false, terms: false, sales: false });
                        setCanPay(false);
                      }}
                      className={`${BTN_OUTLINE} w-full sm:w-auto`}
                    >
                      Vazgeç
                    </button>
                  </div>
                </div>
              )}

              {/* Period + VAT toggle */}

<div className="mt-5">
  <div className="text-sm font-medium text-gray-700">Faturalandırma</div>

{state.currentPlanId === "prof-ozel" &&
  offerAlreadyAccepted &&
  !state.addUsersFlow?.active && (
    <div className="mt-5 rounded-2xl border bg-white p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-gray-500">Paket İşlemi</div>
          <div className="text-lg font-bold text-[#0a2b45] mt-1">Sözleşmeler</div>
          <div className="text-xs text-gray-500 mt-1">
            Ödemeye geçmek için sözleşmeleri onaylayıp devam edin.
          </div>
        </div>

        <span className="px-3 py-1 rounded-full text-xs font-semibold border bg-yellow-100 text-yellow-700 border-yellow-200">
          Süreçte
        </span>
      </div>

      <div className="mt-4 space-y-3 text-sm text-gray-800">
        <div className="flex flex-col">
          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={renewChecks.kvkk}
              onChange={(e) => setRenewChecks((c) => ({ ...c, kvkk: e.target.checked }))}
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

        <div className="flex flex-col">
          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={renewChecks.terms}
              onChange={(e) => setRenewChecks((c) => ({ ...c, terms: e.target.checked }))}
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

        <div className="flex flex-col">
          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={renewChecks.sales}
              onChange={(e) => setRenewChecks((c) => ({ ...c, sales: e.target.checked }))}
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
  onClick={() => {
    if (!(renewChecks.kvkk && renewChecks.terms && renewChecks.sales)) {
      alert("Devam etmek için sözleşmeleri onaylayınız.");
      return;
    }
    setCanPay(true);
  }}
  className={`${BTN_GREEN} w-full sm:w-auto`}
  disabled={!(renewChecks.kvkk && renewChecks.terms && renewChecks.sales)}
>
  Devam Et
</button>

        <button
          type="button"
          onClick={() => {
            setRenewChecks({ kvkk: false, terms: false, sales: false });
            setCanPay(false);
          }}
          className={`${BTN_OUTLINE} w-full sm:w-auto`}
        >
          Vazgeç
        </button>
      </div>
    </div>
  )}
  {(() => {
    const offerVatLocked =
  state.currentPlanId === "prof-ozel" || (offerAlreadyAccepted && isOfferVatIncluded(offerData));
    return (
      <>
        <div className="mt-2 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
  <select
    value={state.period}
    onChange={(e) => setState((s) => ({ ...s, period: e.target.value }))}
    className="w-full sm:w-64 border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-400"
    disabled={state.addUsersFlow?.active}
  >
    <option
      value="Aylık"
      disabled={
        state.addUsersFlow?.active
          ? state.activePeriod !== "Aylık"
          : state.activePeriod === "Yıllık" &&
            Number(daysLeft || 0) > 3 &&
            !state.upgradeFlow?.active
      }
    >
      Aylık
    </option>

    <option
      value="Yıllık"
      disabled={state.addUsersFlow?.active ? state.activePeriod !== "Yıllık" : false}
    >
      Yıllık
    </option>
  </select>

  <label className="flex items-center gap-2 text-sm text-gray-700">
    <input
      type="checkbox"
      checked={offerVatLocked ? true : state.showVatIncluded}
      onChange={(e) =>
        !offerVatLocked && setState((s) => ({ ...s, showVatIncluded: e.target.checked }))
      }
      disabled={offerVatLocked}
      className="h-4 w-4"
    />
    KDV Dahil Göster
    {offerVatLocked && (
      <span className="text-xs text-gray-500 ml-2">(Teklif tutarı KDV dahildir)</span>
    )}
  </label>
</div>

       <div className="text-xs text-gray-500 mt-1">
  {state.addUsersFlow?.active
    ? `Ek kullanıcı alımında dönem kilitlidir. Aktif paket: ${state.activePeriod}.`
    : state.activePeriod === "Yıllık" && Number(daysLeft || 0) > 3
    ? "Yıllık paket aktifken Aylık seçeneği son 3 güne kadar kapalıdır."
    : state.period === "Yıllık"
    ? "Yıllığa geçişte kalan gün otomatik eklenir. (kalan gün / 30)."
    : "Aylık abonelik mevcut dönem sonunda yenilenir."}
</div>

        <div className="mt-5">
          <div className="text-sm font-medium text-gray-700">Özellikler</div>
          <ul className="mt-2 text-sm text-gray-700 space-y-1">
            {(currentPlan?.features || []).map((f, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-gray-400" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </>
    );
  })()}
</div>
</div>

            {/* Payment card */}
            <div className="rounded-2xl border bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs text-gray-500">Ödeme</div>
                  <div className="text-lg font-bold text-[#0a2b45] mt-1">Ödeme Özeti</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Ödeme işlemleri iyzico üzerinden güvenli şekilde gerçekleştirilir.
                  </div>
                </div>
                              <div className="flex items-center gap-2">
                  {isPilot && canRequestOffer && (
                    <button type="button" onClick={openOfferModal} className={BTN_OUTLINE}>
                      Teklif Al
                    </button>
                  )}
                </div>
              </div>

              {/* Amount box */}
              <div className="mt-5 rounded-2xl border bg-gray-50 p-4">
                <div className="text-sm font-semibold text-gray-800">Ödenecek Tutar</div>

{state.currentPlanId === "prof-ozel" ? (
  (() => {
    // teklif hiç yoksa
    if (!hasValidPanelOffer && Number(state.amountTRY || 0) <= 0) {
      return (
        <div className="mt-2 text-sm text-gray-700">
          {isPilot
            ? "Henüz panele gönderilmiş bir teklif yok. Önce Teklif Al ile talep oluşturun."
            : "Teklif tanımlı değil."}
          <div className="mt-3">
            <button type="button" onClick={openOfferModal} className={BTN_GREEN}>
              Teklif Al
            </button>
          </div>
        </div>
      );
    }

    // teklif var ama henüz kabul edilmedi
    if (hasValidPanelOffer && !offerAlreadyAccepted) {
      return (
        <div className="mt-2 text-sm text-gray-700">
          Teklifinizi kabul ederek devam ediniz.
        </div>
      );
    }

    // ✅ sözleşme onayı öncesi: rakamlar 0
    const rawMonthlyIncVat = Number(state.amountTRY || offerPriceTRY || 0);
    const monthlyIncVat = canPay ? rawMonthlyIncVat : 0;
    const yearlyIncVat = canPay ? Math.round(rawMonthlyIncVat * 10) : 0;

    const samePeriod =
  (state.period === "Aylık" && state.activePeriod === "Aylık") ||
  (state.period === "Yıllık" && state.activePeriod === "Yıllık");

// ✅ teklif kabul edildi ama ödeme tamamlanmadıysa bu yenileme değildir
const isOfferTransitionPayment =
  state.currentPlanId === "prof-ozel" &&
  offerAcceptedButUnpaid &&
  !state.addUsersFlow?.ready;

const onlyRenewWindowBlocked =
  samePeriod &&
  !isOfferTransitionPayment &&
  !state.addUsersFlow?.ready &&
  !canRenewNow;

    const isAddUsersMode = Boolean(state.addUsersFlow?.active);

const preOfferPlan = plans.find((p) => p.id === state.preOfferPlanId) || null;
const creditPeriod = state.preOfferPeriod || state.activePeriod;
const creditBaseDays = creditPeriod === "Yıllık" ? 365 : 30;

// ✅ Kalan süre mahsubu:
// 1) Normal paketten özel teklife geçişte eski paketin fiyatı baz alınır.
// 2) Zaten özel teklifte aylıktan yıllığa geçişte mevcut teklifin aylık tutarı baz alınır.
const creditSourceIncVat = (() => {
  if (preOfferPlan) {
    const exVat =
      creditPeriod === "Yıllık"
        ? Number(preOfferPlan.yearlyExVat || 0)
        : Number(preOfferPlan.monthlyExVat || 0);

    return Math.round(exVat * (1 + VAT_RATE));
  }

  if (state.currentPlanId === "prof-ozel") {
    const monthlyOfferIncVat = Number(state.amountTRY || offerPriceTRY || 0);

    if (creditPeriod === "Yıllık") {
      return Math.round(monthlyOfferIncVat * 10);
    }

    return Math.round(monthlyOfferIncVat);
  }

  return 0;
})();


const currentCredit = 0;

const monthlyBaseIncVat = monthlyIncVat;
const yearlyBaseIncVat = yearlyIncVat;

const selectedBaseIncVat =
  state.period === "Yıllık" ? yearlyBaseIncVat : monthlyBaseIncVat;

const selectedPayableIncVat =
  !canPay
    ? 0
    : isAddUsersMode
    ? Number(addUsersPay?.total || 0)
    : Math.max(0, Number(selectedBaseIncVat || 0) - Number(currentCredit || 0));
const selectedPayableExVat =
  isAddUsersMode
    ? Number(addUsersPay?.ex || 0)
    : Math.round(selectedPayableIncVat / (1 + VAT_RATE));

const selectedPayableVat =
  isAddUsersMode
    ? Number(addUsersPay?.vat || 0)
    : selectedPayableIncVat - selectedPayableExVat;

const totalPayable = isAddUsersMode
  ? Number(addUsersPay?.total || 0)
  : selectedPayableIncVat;

    return (
      <div className="mt-3 space-y-2 text-sm text-gray-700">
       <div className="rounded-xl border bg-gray-50 p-3 space-y-2">

  <div className="flex justify-between">
    <span>Seçilen Dönem</span>
    <span className="font-medium">{state.period}</span>
  </div>

 {state.addUsersFlow?.active && addUsersPay && (
  <div className="flex justify-between">
    <span>Ek Kullanıcı</span>
    <span className="font-medium">+{addUsersPay.addCount}</span>
  </div>
)}

  {!state.addUsersFlow?.active && (
    <div className="flex justify-between">
      <span>Paket Tutarı</span>
      <span className="font-medium">
        {trCurrency(state.period === "Yıllık" ? yearlyIncVat : monthlyIncVat)}
      </span>
    </div>
  )}

          {canPay && !isPilot && !state.addUsersFlow?.active && Number(currentCredit || 0) > 0 && (
  <div className="flex justify-between text-emerald-700">
    <span>Mevcut Paket Mahsubu</span>
    <span className="font-medium">- {trCurrency(currentCredit)}</span>
  </div>
)}

          <div className="flex justify-between">
            <span>KDV Hariç</span>
            <span className="font-medium">
  {state.addUsersFlow?.active
    ? trCurrency(addUsersPay?.ex || 0)
    : trCurrency(selectedPayableExVat)}
</span>
          </div>

          <div className="flex justify-between">
            <span>KDV (%20)</span>
            <span className="font-medium">
  {state.addUsersFlow?.active
    ? trCurrency(addUsersPay?.vat || 0)
    : trCurrency(selectedPayableVat)}
</span>
          </div>

          <div className="flex justify-between border-t pt-2">
            <span className="font-semibold">KDV Dahil Toplam</span>
            <span className="font-semibold">{trCurrency(totalPayable)}</span>
          </div>
        </div>

       <div className="text-xs text-gray-500 pt-1">
  {state.addUsersFlow?.active
    ? "Ek kullanıcı ücreti, teklif fiyatına göre kişi başı ve kalan gün oranlı hesaplanır. Mevcut abonelik süresi değişmez."
    : state.period === "Yıllık"
    ? !isPilot
      ? "Yıllık ücretlendirme uygulanır. Erken ödeme yapılırsa kalan süre yeni döneme eklenir."
      : "Pilottan pakete geçişte mahsup uygulanmaz."
    : "Aylık ücretlendirme uygulanır. Erken ödeme yapılırsa kalan süre yeni döneme eklenir."}
</div>

        <div className="mt-4 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => {
              const isAddUsersPayment =
  state.addUsersFlow?.active &&
  state.addUsersFlow?.ready &&
  addUsersPay &&
  addUsersPay.total > 0;

iyzicoOde({
  type: isAddUsersPayment ? "ADD_USERS" : "NEW",

  amount: isAddUsersPayment ? addUsersPay.total : totalPayable,
  addUsersCount: isAddUsersPayment ? addUsersPay.addCount : 0,
  carryOverDays: isAddUsersPayment ? Number(daysLeft || 0) : 0,
  isRenewal: false,
});
            }}
            className={`${BTN_IYZICO} w-full flex items-center justify-center`}
            disabled={
  !canPay ||
  iyzicoLoading ||
  totalPayable <= 0 ||
  onlyRenewWindowBlocked ||
  (state.addUsersFlow?.active && !state.addUsersFlow?.ready)
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

          {samePeriod && !canRenewNow && (
            <div className="text-xs text-gray-500 mt-3 text-center">
              Yenileme ödemesi, bitiş tarihine <b>son 3 gün</b> kala açılır. (Kalan: {daysLeft} gün)
            </div>
          )}

          {!canPay && (
            <div className="text-xs text-gray-500 mt-2 text-center">
              Ödeme yapabilmek için soldaki sözleşmeleri onaylayıp <b>Devam Et</b> butonuna basmanız gerekir.
            </div>
          )}
        </div>
      </div>
    );
  })()
) : !hydrated ? (
                  <div className="mt-2 text-sm text-gray-500">Yükleniyor…</div>
                ) : !currentPlan || currentPlan.monthlyExVat == null ? (
                  <div className="mt-2 text-sm text-gray-700">
                    Bu paket teklif üzerinedir. Lütfen teklif talebi oluşturunuz.
                  </div>
                ) : (
                  <div className="mt-3 space-y-2 text-sm text-gray-700">
                   {addUsersPay ? (
  <>
    <div className="flex justify-between">
      <span>Ek Kullanıcı</span>
      <span className="font-medium">+{addUsersPay.addCount} kişi</span>
    </div>

    <div className="flex justify-between">
      <span>Kişi Başı Ücret</span>
      <span className="font-medium">{trCurrency(addUsersPay.perUserBaseTRY)}</span>
    </div>

    <div className="flex justify-between">
      <span>Kalan Gün Oranı</span>
      <span className="font-medium">%{Math.round((addUsersPay.ratio || 0) * 100)}</span>
    </div>

    <div className="flex justify-between">
      <span>KDV Hariç</span>
      <span className="font-medium">{trCurrency(addUsersPay.ex)}</span>
    </div>

    <div className="flex justify-between">
      <span>KDV (%20)</span>
      <span className="font-medium">{trCurrency(addUsersPay.vat)}</span>
    </div>

    <div className="flex justify-between border-t pt-2">
      <span className="font-semibold">KDV Dahil Toplam</span>
      <span className="font-semibold">{trCurrency(addUsersPay.total)}</span>
    </div>
  </>
) : (
  <>
    <div className="flex justify-between">
      <span>KDV Hariç</span>
      <span className="font-medium">{trCurrency(summaryExVat)}</span>
    </div>

    <div className="flex justify-between">
      <span>KDV (%20)</span>
      <span className="font-medium">{trCurrency(summaryVat)}</span>
    </div>

    <div className="flex justify-between border-t pt-2">
      <span className="font-semibold">KDV Dahil Toplam</span>
      <span className="font-semibold">{trCurrency(summaryTotal)}</span>
    </div>
  </>
)}
                                       <div className="text-xs text-gray-500 pt-1">
                     {state.period === "Yıllık"
  ? "Yıllık ücretlendirme uygulanır. Erken ödeme yapılırsa kalan süre yeni döneme eklenir."
  : "Aylık ücretlendirme uygulanır. Erken ödeme yapılırsa kalan süre yeni döneme eklenir."}
                    </div>

                    <div className="mt-4 flex flex-col gap-3">
                      {state.period === "Yıllık" ? (
                        <button
                          type="button"
                          onClick={() => {
  const t =
    state.upgradeFlow?.active && state.upgradeFlow.mode === "UPGRADE" ? "UPGRADE" : "NEW";

  // ✅ Ödeme Özeti ile birebir aynı tutar iyzico'ya gitsin
    iyzicoOde({
    type: t,
    amount: summaryTotal,
   carryOverDays: Number(daysLeft || 0),
isRenewal: Number(daysLeft || 0) > 0,
  });
}}
                          className={`${BTN_IYZICO} w-full flex items-center justify-center`}
                          disabled={
  !canPay ||
  iyzicoLoading ||
  // ✅ Soru 2: Yenileme yalnız son 3 gün
  (!isPeriodSwitch && isSamePeriod && !state.upgradeFlow?.active && !canRenewNow)
}
                        >
                          {iyzicoLoading ? "Başlatılıyor..." : "Yıllığa Geçiş İçin Devam Et"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            const t =
                              state.upgradeFlow?.active && state.upgradeFlow.mode === "UPGRADE" ? "UPGRADE" : "NEW";
                                                        iyzicoOde({
                              type: t,
                              amount: summaryTotal,
                              // ✅ Pilot dahil erken yenilemede kalan gün yeni döneme eklenecek
                              carryOverDays: Number(daysLeft || 0),
isRenewal: Number(daysLeft || 0) > 0,
                            });
                          }}
                          className={`${BTN_IYZICO} w-full flex items-center justify-center`}
                          disabled={
  !canPay ||
  iyzicoLoading ||
  // ✅ Soru 2: Yenileme yalnız son 3 gün
  (!isPeriodSwitch && isSamePeriod && !state.upgradeFlow?.active && !canRenewNow)
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
                      )}
                       {isSamePeriod && !state.upgradeFlow?.active && !canRenewNow && (
  <div className="text-xs text-gray-500 mt-3 text-center">
    Yenileme ödemesi, bitiş tarihine <b>son 3 gün</b> kala açılır. (Kalan: {daysLeft} gün)
  </div>
)}
                      {!canPay && (
                        <div className="text-xs text-gray-500 mt-3 text-center">
                          Ödeme yapabilmek için soldaki sözleşmeleri onaylayıp <b>Devam Et</b> butonuna basmanız gerekir.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Son Ödemeler */}
              <div className="mt-5">
                <div className="text-sm font-semibold text-gray-800">Son Ödemeler</div>

                <div className="mt-2 rounded-2xl border p-4 bg-white">
                  {recentPaymentsLoading ? (
                    <div className="text-sm text-gray-500">Yükleniyor…</div>
                  ) : recentPaymentsError ? (
                    <div className="text-sm text-red-600">{recentPaymentsError}</div>
                  ) : recentPayments.length === 0 ? (
                    <div className="text-sm text-gray-600">Henüz ödeme işlemi bulunmuyor.</div>
                  ) : (
                    <div className="space-y-2">
                      {recentPayments.slice(0, 6).map((p, idx) => {
                        const type = String(p?.type || p?.paymentType || "").toUpperCase();
const amount = Number(p?.amountTRY ?? p?.amount ?? p?.price_try ?? 0);

const periodRaw = String(p?.period || p?.billingPeriod || "").toLocaleLowerCase("tr-TR");
const isYearly =
  periodRaw === "yıllık" ||
  periodRaw === "yillik" ||
  periodRaw === "yearly" ||
  periodRaw === "annual";

const planFrom = String(p?.planFrom || p?.plan_from || "").trim();
const planTo = String(p?.planTo || p?.plan_to || "").trim();
const isFirstSubscription = !planFrom && !!planTo;

const typeLabel =
  type === "UPGRADE"
    ? "Paket Yükseltme"
    : type === "ADD_USERS"
    ? "Ek Kullanıcı"
    : type === "NEW"
    ? isFirstSubscription
      ? "Yeni Abonelik"
      : isYearly
      ? "Yıllık Abonelik"
      : "Aylık Abonelik"
    : type === "OFFER"
    ? isFirstSubscription
      ? "Yeni Abonelik"
      : isYearly
      ? "Yıllık Abonelik"
      : "Aylık Abonelik"
    : type || "Ödeme";

                        const dtRaw =
                          p?.createdAt || p?.created_at || p?.paidAt || p?.paid_at || p?.date || "";
                        const dt = dtRaw ? new Date(dtRaw).toLocaleString("tr-TR") : "—";

                        return (
                          <div
                            key={p?.id || p?.paymentId || idx}
                            className="flex items-center justify-between gap-3 text-sm"
                          >
                            <div className="min-w-0">
                              <div className="font-semibold text-gray-800 truncate">{typeLabel}</div>
                              <div className="text-xs text-gray-500">{dt}</div>
                            </div>

                            <div className="flex items-center gap-2">
                              <div className="font-semibold text-gray-900 tabular-nums">{trCurrency(amount)}</div>
                              <span className="px-2 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                Başarılı
                              </span>
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

{/* Paket Yükseltme Seçenekleri / Kurumsal Ek Kullanıcı */}
{state.currentPlanId !== "prof-ozel" ? (
  <div className="border rounded p-5 bg-white">
    <div className="flex items-center justify-between">
      <div>
        <div className="text-sm font-semibold text-gray-900">Paket Yükseltme Seçenekleri</div>
        <div className="text-xs text-gray-500 mt-1">
          Mevcut paketinizi yükseltebilir veya ihtiyaçlarınıza göre değiştirebilirsiniz.
        </div>
      </div>
      <div className="text-xs text-gray-600">
        Görüntüleme:{" "}
        <span className="font-semibold">{state.showVatIncluded ? "KDV Dahil" : "KDV Hariç"}</span>
      </div>
    </div>

    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {plans.map((p) => {
        const isCurrent = p.id === state.currentPlanId;
        const ex = state.period === "Yıllık" ? p.yearlyExVat : p.monthlyExVat;
        const isOffer = ex == null;

        // ✅ Yıllık pakette teklif alma kapalı
        const offerDisabled = isOffer && state.period === "Yıllık";

        const btnClass =
          "w-full px-4 py-2 rounded text-sm font-semibold text-white " +
          (isOffer
            ? offerDisabled
              ? "bg-blue-300 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700"
            : "bg-green-600 hover:bg-green-700");

        return (
          <div
            key={p.id}
            className={`border rounded-xl p-4 ${isCurrent ? "bg-gray-50" : "bg-white"}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="font-semibold text-gray-900">{p.name}</div>
              {p.badge ? (
                <span className="text-[11px] px-2 py-1 rounded-full bg-blue-600 text-white">
                  {p.badge}
                </span>
              ) : null}
            </div>

            <div className="text-xs text-gray-600 italic mt-1">{p.note}</div>
            <div className="text-xs text-gray-700 mt-1">{p.users}</div>

            <div className="mt-3 text-2xl font-extrabold text-gray-900">
              {isOffer ? "Teklif Üzerine" : emphasizedPrice(ex)}
            </div>

            {!isOffer && (
              <div className="text-xs text-gray-500">
                {state.period} • {state.showVatIncluded ? "KDV Dahil" : "KDV Hariç"}
              </div>
            )}

            <ul className="mt-3 space-y-1 text-xs text-gray-700">
              {p.features.slice(0, 3).map((f, i) => (
                <li key={i}>• {f}</li>
              ))}
            </ul>

            <div className="mt-4">
              {isCurrent ? (
                <button
                  type="button"
                  disabled
                  className="w-full px-4 py-2 rounded text-sm font-semibold bg-gray-200 text-gray-700 cursor-not-allowed"
                >
                  Mevcut Paket
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={offerDisabled}
                    onClick={() => {
                      if (isOffer) {
                        if (offerDisabled) return;
                        openOfferModal();
                      } else {
                        changePlan(p.id);
                      }
                    }}
                    className={btnClass}
                  >
                    {isOffer ? "Teklif Al" : "Yükselt / Değiştir"}
                  </button>

                  {offerDisabled && (
                    <div className="mt-2 text-[11px] text-gray-500">
                      Yıllık pakette özel teklif alınmaz. Aylık seçiniz.
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  </div>
) : (
  <div className="rounded-2xl border bg-white p-5">
    {(() => {
     const isYearlyActive = state.activePeriod === "Yıllık";
const isMonthlyActive = state.activePeriod === "Aylık";

// ✅ Ek kullanıcıda dönem aktif pakete kilitli
const addUsersPeriodLocked = state.currentPlanId === "prof-ozel";

// ✅ Yıllık pakete geçiş ekranındayken ek kullanıcı alınmaz
const blockAddUsers =
  state.currentPlanId === "prof-ozel" &&
  state.period !== state.activePeriod;
      return (
        <>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-900">
                Kurumsal Ek Kullanıcı
              </div>
             <div className="text-xs text-gray-500 mt-1">
  Ek kullanıcı alımında dönem, aktif paket dönemi ile aynıdır:
  <span className="font-semibold"> {state.activePeriod}</span>
</div>
            </div>
            <div className="text-xs text-gray-600">
              Mevcut: <span className="font-semibold">{state.usersCount}</span> kullanıcı
            </div>
          </div>

          {blockAddUsers && (
  <div className="mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
    Paket dönemi değiştirirken <b>ek kullanıcı</b> eklenemez.
    Önce mevcut paketi <b>{state.period}</b> olarak tamamlayın, ardından ek kullanıcı ekleyin.
  </div>
)}

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
            <div>
              <div className="text-sm font-medium text-gray-700">
                Eklemek istediğin kullanıcı
              </div>
             <input
  type="number"
  min={1}
  value={state.addUsersCount}
  disabled={blockAddUsers}
  onChange={(e) =>
    setState((s) => ({
      ...s,
      addUsersCount: Math.max(1, Number(e.target.value || 1)),
    }))
  }
  className="mt-2 w-full border rounded-xl px-3 py-2.5 text-sm"
/>

<div className="mt-2 text-xs text-gray-500">
  Bu işlem <b>{state.activePeriod}</b> dönemine göre hesaplanır.
</div>
            </div>

            <div className="rounded-2xl border bg-gray-50 p-4">
              <div className="text-xs text-gray-500">Yeni Limit</div>
              <div className="text-lg font-bold text-[#0a2b45]">
                {state.usersCount + Number(state.addUsersCount || 1)} kullanıcı
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
           <button
  type="button"
  className={`${BTN_GREEN} ${blockAddUsers ? "opacity-50 cursor-not-allowed" : ""}`}
  onClick={() => {
    if (blockAddUsers) return;
    startAddUsersFlow();
  }}
  disabled={blockAddUsers}
>
  Kullanıcı Ekle
</button>

            {state.addUsersFlow?.active && (
              <button
                type="button"
                className={BTN_OUTLINE}
                onClick={() => {
                  setState((s) => ({
                    ...s,
                    addUsersFlow: { active: false, ready: false, addUsersCount: 0 },
                  }));
                  setAddUsersChecks({ kvkk: false, terms: false, sales: false });
                  setCanPay(false);
                }}
              >
                Vazgeç
              </button>
            )}
          </div>
        </>
      );
    })()}
  </div>
)}
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
              <div className="border rounded-xl p-3 bg-red-50 text-sm text-red-700">{iyzicoError}</div>
            ) : (
              <div className="min-h-[260px]">
                <div ref={iyzicoContainerRef} />
              </div>
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

      {/* ✅ Özel Teklif Modal */}
      {showOfferModal && (
        <div className="fixed inset-0 z-[120] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-gray-800">Teklif Al</h4>
              <button onClick={closeOfferModal} className="text-gray-500 hover:text-gray-700" type="button">
                ✕
              </button>
            </div>

            {offerError ? (
              <div className="mb-3 border rounded-xl p-3 bg-red-50 text-sm text-red-700">{offerError}</div>
            ) : null}

            <div className="space-y-3">
              <input
                type="text"
                value={offerForm.companyName}
                readOnly
                className="w-full border rounded-xl px-3 py-2.5 text-sm bg-gray-50"
                placeholder="Kurum Adı"
              />

              <input
  type="text"
  value={offerForm.fullName}
  onChange={(e) =>
    setOfferForm((s) => ({
      ...s,
      fullName: e.target.value.toLocaleUpperCase("tr-TR"),
    }))
  }
  placeholder="Ad Soyad"
  className="w-full border rounded-xl px-3 py-2.5 text-sm bg-white"
  style={{ lineHeight: "1.5rem" }}
/>

              <input
                type="email"
                value={offerForm.email}
                readOnly
                className="w-full border rounded-xl px-3 py-2.5 text-sm bg-gray-50"
                placeholder="E-posta"
              />

              <input
                inputMode="numeric"
                value={offerForm.usersCount}
                onChange={(e) =>
                  setOfferForm((f) => ({
                    ...f,
                    usersCount: digitsOnly(e.target.value, 6),
                  }))
                }
                className="w-full border rounded-xl px-3 py-2.5 text-sm"
                placeholder="Kullanıcı Sayısı (15+)"
              />

              <textarea
                rows={4}
                value={offerForm.message}
                onChange={(e) =>
                  setOfferForm((f) => ({
                    ...f,
                    message: sentenceCaseTR(e.target.value),
                  }))
                }
                className="w-full border rounded-xl px-3 py-2.5 text-sm"
                placeholder="Mesajınız"
              />
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button type="button" onClick={closeOfferModal} className={BTN_OUTLINE} disabled={offerSending}>
                Vazgeç
              </button>
              <button type="button" onClick={submitOfferRequest} className={BTN_GREEN} disabled={offerSending}>
                {offerSending ? "Gönderiliyor..." : "Gönder"}
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
