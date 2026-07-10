// Register.jsx  ✅ Sözleşme checkbox + popup (modal) eklendi
// Not: KVKK / Kullanım / Satış metinlerini aşağıdaki PLACEHOLDER alanlara yapıştır.

import React, { useState, useMemo, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import axios from "axios";
import { API_BASE } from "../config/api";

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

/* -----------------------------------------
   TÜRKÇE KARAKTER DESTEKLİ İSİM FORMATLAMA
--------------------------------------------*/
function formatTitle(value) {
  if (value === "") return "";
  return value
    .split(" ")
    .map((word) => {
      if (!word) return "";
      return (
        word.charAt(0).toLocaleUpperCase("tr-TR") +
        word.slice(1).toLocaleLowerCase("tr-TR")
      );
    })
    .join(" ");
}

// Paket adları
const PLAN_LABELS = {
  bireysel_standart: "Bireysel Uzman Paketi",

  ticari_5: "Ticari (Max 5 Kullanıcı)",
  ticari_10: "Ticari (Max 10 Kullanıcı)",
  ticari_15: "Ticari (Max 15 Kullanıcı)",

  "prof-ozel": "Özel Teklif",
};

// 🔐 Şifre kuralı
const passwordRule = /^(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;

/* -----------------------------------------
   ✅ Basit Modal (Popup)
--------------------------------------------*/
function Modal({ open, title, children, onClose }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="absolute inset-0 flex items-center justify-center px-4">
        <div className="w-full max-w-2xl bg-white rounded-xl shadow-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-500 hover:text-slate-700 text-sm font-semibold"
            >
              Kapat
            </button>
          </div>

          <div className="px-5 py-4 max-h-[70vh] overflow-auto text-sm text-slate-700 leading-6">
            {children}
          </div>

          <div className="px-5 py-4 border-t flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
            >
              Kapat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Register() {
  const navigate = useNavigate();
  const { role } = useParams();
  const query = useQuery();

  // query'den ilk değerler
const qName = query.get("contactName") || query.get("name") || "";
const qCompany = query.get("companyName") || query.get("company") || "";
const qEmail = query.get("email") || "";

// ✅ ilk açılışta otomatik doldur (offer gelirse zaten overwrite edecek)
const [name, setName] = useState(() => formatTitle(qName));
const [companyName, setCompanyName] = useState(() => formatTitle(qCompany));
const [email, setEmail] = useState(() => qEmail);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const queryPlan = query.get("plan");
  const token = query.get("token"); // teklif tokenı (offer)
const fromOffer = query.get("fromOffer") === "1";

// ✅ token ile direkt register açılırsa önce teklif sayfasına gönder
useEffect(() => {
  if (token && !fromOffer) {
    navigate(`/kayit/teklif/${encodeURIComponent(token)}`, { replace: true });
  }
}, [token, fromOffer, navigate]);
const pilotToken = query.get("pilotToken"); // ✅ pilot tokenı
  const period = query.get("period") || "Aylık"; // "Aylık" | "Yıllık"
  
  const usersFromQuery = query.get("users"); // ör: 3 / 5 / 10
  const isDemo = query.get("demo") === "1";

 // const fromOffer = query.get("fromOffer") === "1"; 

const [offer, setOffer] = useState(null);
// const [offerSeen, setOfferSeen] = useState(false);
  // ✅ Sözleşme checkbox'ları
  const [acceptKvkk, setAcceptKvkk] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptSales, setAcceptSales] = useState(false);



  // ✅ Modal state
  const [modalKey, setModalKey] = useState(null); // "kvkk" | "terms" | "sales" | null

  useEffect(() => {
  (async () => {
    // ✅ Pilot linkinde offer endpoint'ine gitme
    if (!token) return;
// sadece gerçek pilot linklerinde skip et
if (pilotToken) return;

    try {
      const res = await axios.get(`${API_BASE}/public/offer/${token}`);
      const ofr = res.data?.offer || null;
      setOffer(ofr);

      if (ofr?.companyName) setCompanyName((prev) => prev || ofr.companyName);

      if (ofr?.contactName || ofr?.authorizedPerson || ofr?.name) {
        const v = ofr.contactName || ofr.authorizedPerson || ofr.name;
        setName((prev) => prev || v);
      }

      if (ofr?.email) setEmail((prev) => prev || ofr.email);
    } catch (e) {
      console.error("OFFER LOAD ERROR:", e);
      // ✅ teklif token'ı invalid ise offer'ı "yüklendi ama yok" olarak işaretle
      setOffer(false);
    }
  })();
}, [token, query]);
 

  // ✅ 10+ teklif: aralığa map yok, tekli "prof-ozel"
  const isOfferSpecial = useMemo(() => {
    const n = Number(offer?.usersCount);
    return Boolean(token) && Number.isFinite(n) && n >= 11;
  }, [token, offer]);

 const offerPlanCode = useMemo(() => {
  if (!token) return null;

  const n = Number(offer?.usersCount);
  if (!n) return null;

 if (n <= 5) return "ticari_5";
if (n <= 10) return "ticari_10";
if (n <= 15) return "ticari_15";
  return "prof-ozel";
}, [token, offer]);

  const planCode = useMemo(() => {
    if (role === "uzman") {
      if (queryPlan && PLAN_LABELS[queryPlan]) return queryPlan;
      return "bireysel_standart";
    }
    if (role === "kurumsal") {
      if (queryPlan && PLAN_LABELS[queryPlan]) return queryPlan;
      return "ticari-5";
    }
    return "bireysel_standart";
  }, [role, queryPlan]);

  const planFromUsersQuery = useMemo(() => {
    if (role !== "kurumsal") return null;

    const n = Number(usersFromQuery);
    if (!Number.isFinite(n) || n <= 0) return null;

   if (n <= 5) return "ticari_5";
if (n <= 10) return "ticari_10";
if (n <= 15) return "ticari_15";
return "prof-ozel";
  }, [role, usersFromQuery]);

  const effectivePlanCode = useMemo(() => {
    if (isOfferSpecial) return "prof-ozel";
    if (planCode === "bireysel_standart") return "bireysel_standart";
    return offerPlanCode || planFromUsersQuery || planCode;
  }, [isOfferSpecial, planCode, offerPlanCode, planFromUsersQuery]);

  const planLabel = useMemo(() => {
    if (token && offer?.usersCount) {
      const n = Number(offer.usersCount);
     if (Number.isFinite(n) && n >= 11) {
  return `Kurumsal ${n} Kullanıcı - Özel Teklif`;
}
      return `Kurumsal ${n} Kullanıcı Paketi`;
    }
    return PLAN_LABELS[effectivePlanCode] || "Seçili Paket";
  }, [token, offer, effectivePlanCode]);

  const isKurumsal = role === "kurumsal";

  // ✅ Pilot tespiti (backend alanına göre çalışır + query fallback)
const isPilot = useMemo(() => {
  const kind = String(offer?.kind || offer?.type || "").toLowerCase();
  return kind === "pilot" || offer?.isPilot === true || Boolean(pilotToken);
}, [offer, query, pilotToken]);


useEffect(() => {
  if (isPilot) setAcceptSales(false);
}, [isPilot]);

// ✅ Para alınacaksa satış zorunlu; pilotta zorunlu değil
const mustSales = !isPilot;

// ✅ Onay kuralı
const isAgreementsOk =
  acceptKvkk && acceptTerms && (!mustSales || acceptSales);
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

   if (!isAgreementsOk) {
  setError(
    mustSales
      ? "Devam etmek için KVKK, Kullanım Koşulları ve Satış/Ödeme Sözleşmesini onaylamalısınız."
      : "Devam etmek için KVKK ve Kullanım Koşullarını onaylamalısınız."
  );
// ✅ token var ama offer henüz gelmediyse loading ekranı göster
if (token && offer === null) {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-6">
        <h1 className="text-lg font-semibold text-slate-900">Teklif yükleniyor…</h1>
        <p className="text-sm text-slate-600 mt-2">Lütfen bekleyin.</p>
      </div>
    </div>
  );
}

  return;
}

    if (!name || !email || !password || !passwordConfirm) {
      setError("Lütfen gerekli tüm alanları doldurun.");
      return;
    }

    if (isKurumsal && !companyName) {
      setError("Kurumsal kayıt için firma adını girmeniz gereklidir.");
      return;
    }

    if (!passwordRule.test(password)) {
      setError(
        "Şifre en az 8 karakter olmalı, en az 1 büyük harf ve 1 özel karakter içermelidir."
      );
      return;
    }

    if (password !== passwordConfirm) {
      setError("Şifreler uyuşmuyor.");
      return;
    }

    try {
      setLoading(true);

      const body = {
  name,
  email,
  password,
  planCode: effectivePlanCode,
  // ✅ pilotta offerToken yok
  offerToken: isPilot ? null : (token || null),
  demo: isDemo,
  pilot: isPilot ? true : undefined,
  pilotToken: isPilot ? (pilotToken || null) : undefined,
};

      const qUsersN = Number(usersFromQuery);

if (token && offer?.usersCount) {
  body.offerUsersCount = Number(offer.usersCount);
} else if (isKurumsal && Number.isFinite(qUsersN) && qUsersN > 0) {
  // ✅ token yoksa da kullanıcı sayısını gönder (10+ özel teklif dahil)
  body.offerUsersCount = qUsersN;
}
      if (isKurumsal) {
        body.companyName = companyName;
      }

            const res = await axios.post(`${API_BASE}/auth/register`, body);
      const orgUuid = res.data?.organization?.uuid;

      // ✅ DEMO: direkt login
      if (isDemo) {
        navigate(isKurumsal ? "/login/kurumsal" : "/login/uzman", { replace: true });
        return;
      }

      // ✅ PILOT: ödeme yok → direkt login
      if (isPilot) {
        navigate(isKurumsal ? "/login/kurumsal" : "/login/uzman", { replace: true });
        return;
      }

      if (!orgUuid) {
        setError("Kayıt başarılı ama org UUID gelmedi. /auth/register response kontrol.");
        return;
      }

      const qUsersN2 = Number(usersFromQuery);
const usersQ =
  (token && offer?.usersCount)
    ? `&users=${encodeURIComponent(String(offer.usersCount))}`
    : (Number.isFinite(qUsersN2) && qUsersN2 > 0)
      ? `&users=${encodeURIComponent(String(qUsersN2))}`
      : "";
      const periodQ = `&period=${encodeURIComponent(period)}`;

     const tokenQ = token ? `&token=${encodeURIComponent(token)}` : "";

navigate(
  `/odeme?plan=${encodeURIComponent(effectivePlanCode)}&org=${encodeURIComponent(
    orgUuid
  )}${tokenQ}${periodQ}${usersQ}&agreements=1`,
  { replace: true }
);
    } catch (err) {
      console.error("REGISTER ERROR:", err);
      setError(err.response?.data?.message || "Kayıt işlemi sırasında bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Metinler (PLACEHOLDER) — sen sözleşmeleri gönderince buraya yapıştıracağız
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

  const modalTitle =
    modalKey === "kvkk"
      ? "KVKK Aydınlatma Metni"
      : modalKey === "terms"
      ? "Kullanım Koşulları"
      : modalKey === "sales"
      ? "Satış / Ödeme Sözleşmesi"
      : "";

  const modalBody =
  modalKey === "kvkk"
    ? KVKK_TEXT
    : modalKey === "terms"
    ? TERMS_TEXT
    : mustSales
    ? SALES_TEXT
    : TERMS_TEXT; // pilotta sales açılmaya çalışırsa boşa düşmesin

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-6">
        <h1 className="text-2xl font-semibold mb-2 text-center">
          {isKurumsal ? "Kurumsal Kayıt" : "Bireysel Uzman Kayıt"}
        </h1>

        <p className="text-sm text-gray-600 mb-4 text-center">
          Seçili Paket: <span className="font-medium">{planLabel}</span>
        </p>

        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Ad Soyad */}
          <div>
            <label className="block text-sm font-medium mb-1">Ad Soyad</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(formatTitle(e.target.value))}
              className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
              placeholder="Ad ve Soyad"
            />
          </div>

          {/* Firma Adı */}
          {isKurumsal && (
            <div>
              <label className="block text-sm font-medium mb-1">Firma Adı</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(formatTitle(e.target.value))}
                className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
                placeholder="Firma Adı"
              />
            </div>
          )}

          {/* E-posta */}
          <div>
            <label className="block text-sm font-medium mb-1">E-posta</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
              placeholder="ornek@isgpanel.com"
            />
          </div>

          {/* Şifre */}
          <div>
            <label className="block text-sm font-medium mb-1">Şifre</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
              placeholder="En az 8 karakter, 1 büyük harf, 1 özel karakter"
            />
          </div>

          {/* Şifre Tekrar */}
          <div>
            <label className="block text-sm font-medium mb-1">Şifre (Tekrar)</label>
            <input
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
              placeholder="Şifreyi tekrar girin"
            />
          </div>

          {/* ✅ Sözleşmeler */}
          <div className="mt-2 rounded-lg border bg-slate-50 p-3">
            <p className="text-sm font-semibold text-slate-800 mb-2">
              Sözleşmeler ve Onaylar
            </p>

            {/* KVKK */}
            <div className="flex items-start gap-2 py-1">
              <input
                id="acc_kvkk"
                type="checkbox"
                checked={acceptKvkk}
                onChange={(e) => setAcceptKvkk(e.target.checked)}
                className="mt-1"
              />
              <label htmlFor="acc_kvkk" className="text-sm text-slate-700 flex-1">
                KVKK Aydınlatma Metni’ni okudum ve kabul ediyorum.
                <button
                  type="button"
                  onClick={() => setModalKey("kvkk")}
                  className="ml-2 text-emerald-700 hover:underline font-semibold"
                >
                  Metni Gör
                </button>
              </label>
            </div>

            {/* Kullanım */}
            <div className="flex items-start gap-2 py-1">
              <input
                id="acc_terms"
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="mt-1"
              />
              <label htmlFor="acc_terms" className="text-sm text-slate-700 flex-1">
                Kullanım Koşulları’nı okudum ve kabul ediyorum.
                <button
                  type="button"
                  onClick={() => setModalKey("terms")}
                  className="ml-2 text-emerald-700 hover:underline font-semibold"
                >
                  Metni Gör
                </button>
              </label>
            </div>

            {/* Satış (pilotta gösterme) */}
{mustSales && (
  <div className="flex items-start gap-2 py-1">
    <input
      id="acc_sales"
      type="checkbox"
      checked={acceptSales}
      onChange={(e) => setAcceptSales(e.target.checked)}
      className="mt-1"
    />
    <label htmlFor="acc_sales" className="text-sm text-slate-700 flex-1">
      Satış / Ödeme Sözleşmesi’ni okudum ve kabul ediyorum.
      <button
        type="button"
        onClick={() => setModalKey("sales")}
        className="ml-2 text-emerald-700 hover:underline font-semibold"
      >
        Metni Gör
      </button>
    </label>
  </div>
)}

<p className="text-xs text-slate-500 mt-2">
  {mustSales
    ? "Devam etmek için tüm onaylar zorunludur."
    : "Pilot kullanımda Satış/Ödeme Sözleşmesi zorunlu değildir."}
</p>
</div>
          <button
            type="submit"
            disabled={loading || !isAgreementsOk}
            className="w-full mt-2 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-md text-sm font-semibold disabled:opacity-60"
          >
            {loading ? "Kayıt yapılıyor..." : "Kaydı Tamamla"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-gray-500">
          Zaten hesabınız var mı?{" "}
          <button
            onClick={() => navigate(isKurumsal ? "/login/kurumsal" : "/login/uzman")}
            className="text-emerald-600 hover:underline"
          >
            Giriş Yap
          </button>
        </p>
      </div>

      {/* ✅ Popup */}
      <Modal
        open={Boolean(modalKey)}
        title={modalTitle}
        onClose={() => setModalKey(null)}
      >
        {modalBody}
      </Modal>
    </div>
  );
}