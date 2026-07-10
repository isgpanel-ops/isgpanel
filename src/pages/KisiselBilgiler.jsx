import React, { useEffect, useMemo, useState } from "react";
import { PrimaryButton } from "../components/ui";

// ✅ Senin panelinde token farklı anahtarlarda olabilir: hepsini dener
function getToken() {
  const t1 = localStorage.getItem("token");
  if (t1) return t1;

  const activeEmail = localStorage.getItem("__isg_active_email_global");
  if (activeEmail) {
    const t2 = localStorage.getItem(`isgpanel:${activeEmail}:token`);
    if (t2) return t2;

    // bazı projelerde token user objesinde tutuluyor
    try {
      const u = JSON.parse(localStorage.getItem(`isgpanel:${activeEmail}:user`));
      if (u?.token) return u.token;
      if (u?.accessToken) return u.accessToken;
    } catch {}
  }

  // Son çare: localStorage'da :token ile biten ilk anahtar
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.endsWith(":token")) {
      const t = localStorage.getItem(k);
      if (t) return t;
    }
  }

  return "";
}

export default function KisiselBilgiler() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const SABIT_MESLEK = "İŞ GÜVENLİĞİ UZMANI";

const [formData, setFormData] = useState({
  adSoyad: "",
  tcKimlik: "",
  dogumTarihi: "",
  telefon: "",
  email: "",
  adres: "",
  sehir: "",
  ilce: "",
  meslek: SABIT_MESLEK,
  sertifikaSinifi: "",
  sertifikaNo: "",
});

  const [me, setMe] = useState(null);
  const isAssignedTicariUser = useMemo(() => me?.role === "ticari_user", [me]);

  // ✅ Ad Soyad & Email bu ekranda kilitli (resimdeki davranış)
  const isAdSoyadLocked = true;
  const isEmailLocked = true;

  const uppercaseFields = ["adres", "sehir", "ilce", "meslek"];

 const handleChange = (e) => {
  let { name, value } = e.target;

  // Ad Soyad + Email + Meslek kilitli
  if (name === "adSoyad" || name === "email" || name === "meslek") return;

  if (uppercaseFields.includes(name)) value = value.toLocaleUpperCase("tr-TR");

  if (name === "sertifikaNo" && value) {
    if (!value.startsWith("İGU-")) value = "İGU-" + value.replace(/^İGU-/, "");
  }

  setFormData((p) => ({ ...p, [name]: value }));
};

  // ✅ Sayfa açılışında:
  // 1) /me ile AdSoyad+Email otomatik doldur
  // 2) /api/profile/personal ile kişisel alanları (tc/telefon/adres/meslek/sertifika...) çek
  useEffect(() => {
    const init = async () => {
      try {
        const token = getToken();
        if (!token) {
          setLoading(false);
          return;
        }

        // 1) ME
        const meRes = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!meRes.ok) {
          console.error("ME başarısız:", await meRes.text());
          setLoading(false);
          return;
        }

        const meJson = await meRes.json();
        setMe(meJson);

        const upperName = (meJson?.name || "").toLocaleUpperCase("tr-TR");

        setFormData((p) => ({
          ...p,
          adSoyad: upperName || p.adSoyad,
          email: meJson?.email || p.email,
        }));

        if (upperName) {
          localStorage.setItem("kullaniciAdSoyad", upperName);
          window.dispatchEvent(new Event("storage"));
        }

        // 2) PERSONAL
        const pRes = await fetch("/api/profile/personal", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (pRes.ok) {
          const personal = await pRes.json();

          setFormData((p) => ({
  ...p,
  tcKimlik: personal?.tcKimlik || "",
  dogumTarihi: personal?.dogumTarihi || "",
  telefon: personal?.telefon || "",
  adres: personal?.adres || "",
  sehir: personal?.sehir || "",
  ilce: personal?.ilce || "",
  meslek: SABIT_MESLEK,
  sertifikaSinifi: personal?.sertifikaSinifi || "",
  sertifikaNo: personal?.sertifikaNo || "",
}));

          // İstersen diğer ekranlar kullansın diye:
          localStorage.setItem("kisiselBilgiler", JSON.stringify({
  adSoyad: upperName,
  tcKimlik: personal?.tcKimlik || "",
  dogumTarihi: personal?.dogumTarihi || "",
  telefon: personal?.telefon || "",
  email: meJson?.email || "",
  adres: personal?.adres || "",
  sehir: personal?.sehir || "",
  ilce: personal?.ilce || "",
  meslek: SABIT_MESLEK,
  sertifikaSinifi: personal?.sertifikaSinifi || "",
  sertifikaNo: personal?.sertifikaNo || "",
}));
        } else {
          console.warn("PERSONAL GET başarısız:", await pRes.text());
        }
      } catch (e) {
        console.error("init hata:", e);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  // ✅ Artık gerçekten Mongo'ya kaydet
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setSaving(true);
      const token = getToken();
      if (!token) {
        alert("Token bulunamadı. Lütfen çıkış yapıp tekrar giriş yap.");
        return;
      }

     const payload = {
  tcKimlik: formData.tcKimlik,
  dogumTarihi: formData.dogumTarihi,
  telefon: formData.telefon,
  adres: formData.adres,
  sehir: formData.sehir,
  ilce: formData.ilce,
  meslek: SABIT_MESLEK,
  sertifikaSinifi: formData.sertifikaSinifi,
  sertifikaNo: formData.sertifikaNo,
};

      const res = await fetch("/api/profile/personal", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text();
        console.error("PERSONAL PUT başarısız:", txt);
        alert("Kaydetme başarısız ❌");
        return;
      }

      const json = await res.json();
      // json.personal döndürüyor senin backend
      const personal = json?.personal || {};

      // diğer ekranlar için localStorage (istersen kaldırırız)
      const upperName = (formData.adSoyad || "").toLocaleUpperCase("tr-TR");
     localStorage.setItem("kisiselBilgiler", JSON.stringify({
  ...formData,
  adSoyad: upperName,
  tcKimlik: personal.tcKimlik ?? formData.tcKimlik,
  dogumTarihi: personal.dogumTarihi ?? formData.dogumTarihi,
  telefon: personal.telefon ?? formData.telefon,
  adres: personal.adres ?? formData.adres,
  sehir: personal.sehir ?? formData.sehir,
  ilce: personal.ilce ?? formData.ilce,
  meslek: SABIT_MESLEK,
  sertifikaSinifi: personal.sertifikaSinifi ?? formData.sertifikaSinifi,
  sertifikaNo: personal.sertifikaNo ?? formData.sertifikaNo,
}));

      alert("Kaydedildi ✅ ");
    } catch (e) {
      console.error("Kaydet hata:", e);
      alert("Kaydetme sırasında hata oluştu ❌");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-4">Yükleniyor...</div>;

  // ✅ Bireysel kullanıcı için destek mail linki
  const supportMail = "destek@isgpanel.tr";
  const supportSubject = encodeURIComponent("Kişisel Bilgiler - Bilgi Güncelleme Talebi");
  const supportBody = encodeURIComponent(
    `Merhaba,\n\nKişisel Bilgiler ekranında bazı alanlar kullanıcı tarafından güncellenememektedir.\nGüncelleme talebimin değerlendirilmesini rica ederim.\n\nAd Soyad: ${formData.adSoyad || "-"}\nE-posta: ${formData.email || "-"}\n\nTeşekkürler.`
  );

  // ✅ Ortak input class (resimdeki görünüm)
  const inputBase =
    "mt-1 w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-[#042f4b]";
  const inputDisabled = "bg-gray-100 cursor-not-allowed";

  return (
    <div className="bg-white shadow-md rounded p-6 max-w-2xl mx-auto mt-6">
      <h2 className="text-lg font-bold text-[#042f4b] mb-1">👤 Kişisel Bilgiler</h2>
      <p className="text-xs text-gray-500 mb-4">
        Bu sayfadaki bilgiler, resmî evraklarda (Risk Değerlendirme Prosedürü vb.)
        otomatik olarak kullanılacaktır.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Ad Soyad */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Ad Soyad</label>
          <input
            type="text"
            name="adSoyad"
            value={formData.adSoyad}
            onChange={handleChange}
            disabled={isAdSoyadLocked}
            className={`${inputBase} ${inputDisabled}`}
          />

          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            {isAssignedTicariUser ? (
              <p className="text-xs text-gray-500">
                Bu alan, kurumsal süreç kapsamında Kurumsal Yönetici (Admin) tarafından güncellenir.
              </p>
            ) : (
              <>
                <p className="text-xs text-gray-500">
                  Bu alan, doğrulama ve belge bütünlüğü kapsamında kullanıcı tarafından güncellenemez.
                  Güncellemeler Destek Ekibi tarafından yapılır.
                </p>
                <span className="text-gray-300 text-xs">•</span>
                <a
                  href={`mailto:${supportMail}?subject=${supportSubject}&body=${supportBody}`}
                  className="text-xs text-[#042f4b] underline hover:opacity-80"
                >
                  Destek Ekibine e-posta gönder
                </a>
              </>
            )}
          </div>
        </div>

        {/* TC Kimlik */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            TC Kimlik No 
          </label>
          <input
            type="text"
            name="tcKimlik"
            value={formData.tcKimlik}
            onChange={handleChange}
            className={inputBase}
          />
        </div>

        {/* Doğum Tarihi */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Doğum Tarihi</label>
          <input
            type="date"
            name="dogumTarihi"
            value={formData.dogumTarihi}
            onChange={handleChange}
            className={inputBase}
          />
        </div>

        {/* Telefon */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Telefon Numarası</label>
          <input
            type="tel"
            name="telefon"
            value={formData.telefon}
            onChange={handleChange}
            placeholder="+90 5xx xxx xx xx"
            className={inputBase}
          />
        </div>

        {/* E-posta */}
        <div>
          <label className="block text-sm font-medium text-gray-700">E-posta</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            disabled={isEmailLocked}
            className={`${inputBase} ${inputDisabled}`}
          />

          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            {isAssignedTicariUser ? (
              <p className="text-xs text-gray-500">
                Bu alan, kurumsal süreç kapsamında Kurumsal Yönetici (Admin) tarafından güncellenir.
              </p>
            ) : (
              <>
                <p className="text-xs text-gray-500">
                  Bu alan, doğrulama ve belge bütünlüğü kapsamında kullanıcı tarafından güncellenemez.
                  Güncellemeler Destek Ekibi tarafından yapılır.
                </p>
                <span className="text-gray-300 text-xs">•</span>
                <a
                  href={`mailto:${supportMail}?subject=${supportSubject}&body=${supportBody}`}
                  className="text-xs text-[#042f4b] underline hover:opacity-80"
                >
                  Destek Ekibine e-posta gönder
                </a>
              </>
            )}
          </div>
        </div>

        {/* Adres */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Adres</label>
          <input
            type="text"
            name="adres"
            value={formData.adres}
            onChange={handleChange}
            className={inputBase}
          />
        </div>

        {/* Şehir */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Şehir</label>
          <input
            type="text"
            name="sehir"
            value={formData.sehir}
            onChange={handleChange}
            className={inputBase}
          />
        </div>

        {/* İlçe */}
        <div>
          <label className="block text-sm font-medium text-gray-700">İlçe</label>
          <input
            type="text"
            name="ilce"
            value={formData.ilce}
            onChange={handleChange}
            className={inputBase}
          />
        </div>

        <div className="pt-2">
          <h3 className="text-sm font-semibold text-[#042f4b] flex items-center gap-2">
            <span className="text-[#042f4b]">◆</span> Mesleki Bilgiler
          </h3>
        </div>

        {/* Meslek / Ünvan */}
       <div>
  <label className="block text-sm font-medium text-gray-700">Meslek / Ünvan</label>
  <input
    type="text"
    name="meslek"
    value={SABIT_MESLEK}
    readOnly
    disabled
    className={`${inputBase} ${inputDisabled}`}
  />
</div>

        {/* Sertifika Sınıfı */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Sertifika Sınıfı</label>
          <select
            name="sertifikaSinifi"
            value={formData.sertifikaSinifi}
            onChange={handleChange}
            className={inputBase}
          >
            <option value="">Seçiniz</option>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
          </select>
        </div>

        {/* Sertifika No / Belge No */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Sertifika No / Belge No
          </label>
          <input
            type="text"
            name="sertifikaNo"
            value={formData.sertifikaNo}
            onChange={handleChange}
            placeholder="örn. İGU-12345"
            className={inputBase}
          />
        </div>

        {/* Kaydet */}
        <div className="pt-2">
          <PrimaryButton
            type="submit"
            size="sm"
            variant="green"
            disabled={saving}
            className="px-4 py-2 mt-2"
          >
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
}
