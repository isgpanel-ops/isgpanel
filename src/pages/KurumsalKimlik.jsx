import React, { useEffect, useMemo, useState } from "react";
import { PrimaryButton } from "../components/ui";

/* =========================
   ✅ HER DURUMDA token bulur (mevcut yapını koruyor)
========================= */
function getToken() {
  const t1 = localStorage.getItem("token");
  if (t1) return t1;

  const activeEmail = localStorage.getItem("__isg_active_email_global");
  if (activeEmail) {
    const t2 = localStorage.getItem(`isgpanel:${activeEmail}:token`);
    if (t2) return t2;

    try {
      const u = JSON.parse(localStorage.getItem(`isgpanel:${activeEmail}:user`));
      if (u?.token) return u.token;
      if (u?.accessToken) return u.accessToken;
    } catch {}
  }

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith("isgpanel:") && k.endsWith(":token")) {
        const v = localStorage.getItem(k);
        if (v) return v;
      }
    }
  } catch {}

  const t3 = localStorage.getItem("accessToken");
  if (t3) return t3;

  const t4 = localStorage.getItem("authToken");
  if (t4) return t4;

  return "";
}

/* =========================
   ✅ QuotaExceededError güvenli yazma + logo(base64) kırpma
========================= */
function stripHeavyLogo(obj) {
  // localStorage'a base64 logo yazmak kotayı patlatır.
  // Önizleme için state'te kalsın ama cache'e girmesin.
  if (!obj || typeof obj !== "object") return obj;

  const cloned = { ...obj };

  // base64 ise at
  if (typeof cloned.logo === "string" && cloned.logo.startsWith("data:image")) {
    delete cloned.logo;
  }

  // bazen yanlışlıkla logoBase64 gibi alanlar da olabiliyor
  if (typeof cloned.logoBase64 === "string") delete cloned.logoBase64;

  return cloned;
}

function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    if (e?.name === "QuotaExceededError") {
      console.warn("localStorage kota dolu. Ağır veriler cache'e yazılamadı:", key);
      // Burada istersen küçük temizlik yapılabilir ama mevcut davranışı bozmamak için
      // sadece yazmayı pas geçiyoruz (uygulama çökmesin).
      return false;
    }
    console.error("localStorage setItem hata:", e);
    return false;
  }
}

function safeSetJSON(key, obj) {
  const light = stripHeavyLogo(obj);
  return safeSetItem(key, JSON.stringify(light));
}

export default function KurumsalKimlik() {
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);

  // ✅ Logo dosyasını sakla (backend’e upload için)
  const [selectedLogoFile, setSelectedLogoFile] = useState(null);

  const [formData, setFormData] = useState({
    firmaAdi: "",
    adres: "",
    telefon: "+90 ",
    email: "",
    web: "",
    logo: "", // base64 (SADECE preview için) ✅ localStorage'a yazmayacağız
    logoUrl: "", // ✅ sunucudaki logo yolu
  });

  const activeEmail = localStorage.getItem("__isg_active_email_global");
  let localUser = null;
  try {
    localUser = JSON.parse(localStorage.getItem(`isgpanel:${activeEmail}:user`));
  } catch {}

  const roleLower = useMemo(() => {
    return (me?.role || localUser?.role || "").toString().toLowerCase();
  }, [me?.role, localUser?.role]);

  const isReadOnly = roleLower === "ticari_user";

  const uppercaseFields = ["firmaAdi", "adres"];
  const inputBase =
    "mt-1 w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-[#042f4b]";
  const inputDisabled = "bg-gray-100 cursor-not-allowed";

  const handleChange = (e) => {
    if (isReadOnly) return;
    let { name, value } = e.target;
    if (uppercaseFields.includes(name)) value = value.toLocaleUpperCase("tr-TR");
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleLogoChange = (e) => {
    if (isReadOnly) return;

    const file = e.target.files?.[0];
    if (!file) return;

    // ✅ 1) Dosyayı sakla (kaydet’e basınca backend’e upload edeceğiz)
    setSelectedLogoFile(file);

    // ✅ 2) Anında önizleme (base64) - SADECE state
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData((prev) => ({ ...prev, logo: String(reader.result || "") }));
    };
    reader.readAsDataURL(file);
  };

  const cacheKey = useMemo(() => {
    const org = me?.organizationId || me?.organization || "";
    const uid = me?._id || me?.id || "";
    const r = roleLower || "unknown";
    return `kurumsalBilgiler:${r}:${org}:${uid}`;
  }, [me?.organizationId, me?.organization, me?._id, me?.id, roleLower]);

  useEffect(() => {
    const controller = new AbortController();

    const init = async () => {
      try {
        setLoading(true);

        // ✅ 1) Önce cacheKey'den oku (mevcut davranış)
        const saved = localStorage.getItem(cacheKey);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            // cache'ten gelen veride logo(base64) yok (biz artık yazmıyoruz),
            // ama eski cache'lerde varsa yine de state'e alırken sorun yok.
            setFormData((prev) => ({ ...prev, ...parsed }));
          } catch {}
        } else {
          // ✅ 2) Eğer cacheKey boşsa, eski ekranların kullandığı global key'den de dene
          const globalSaved = localStorage.getItem("kurumsalBilgiler");
          if (globalSaved) {
            try {
              const parsed = JSON.parse(globalSaved);
              setFormData((prev) => ({ ...prev, ...parsed }));
            } catch {}
          }
        }

        const token = getToken();
        if (!token) {
          console.warn("KurumsalKimlik: token bulunamadı.");
          return;
        }

        try {
          const meRes = await fetch("/api/auth/me", {
            signal: controller.signal,
            headers: {
              Authorization: `Bearer ${token}`,
              "Cache-Control": "no-cache",
            },
            cache: "no-store",
          });
          if (meRes.ok) {
            const meJson = await meRes.json();
            setMe(meJson);
          }
        } catch {}

        const res = await fetch("/api/kurumsal-kimlik", {
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${token}`,
            "Cache-Control": "no-cache",
          },
          cache: "no-store",
        });

        if (!res.ok) {
          console.error("Kurumsal kimlik alınamadı:", await res.text());
          return;
        }

        const data = await res.json();

        setFormData((prev) => {
          const next = {
            ...prev,
            firmaAdi: (data.firmaAdi || "").toLocaleUpperCase("tr-TR"),
            adres: (data.adres || "").toLocaleUpperCase("tr-TR"),
            telefon: data.telefon || "+90 ",
            email: data.email || "",
            web: data.web || "",
            // ✅ logo (base64) backend'den geliyorsa preview için alabiliriz,
            // ama cache'e yazmayacağız.
            logo: data.logo || prev.logo || "",
            logoUrl: data.logoUrl || "",
          };

          // ✅ cacheKey cache (base64 logo hariç)
          safeSetJSON(cacheKey, next);

          // ✅ eski ekranlar "kurumsalBilgiler" okuyorsa güncel kalsın (base64 hariç)
          safeSetJSON("kurumsalBilgiler", next);

          return next;
        });
      } catch (e) {
        if (e?.name !== "AbortError") console.error("KurumsalKimlik init hata:", e);
      } finally {
        setLoading(false);
      }
    };

    init();
    return () => controller.abort();
  }, [cacheKey]);

  // ✅ Kaydet sırasında logo dosyasını backend’e yükle ve logoUrl al
  async function uploadLogoIfNeeded(token) {
    if (!selectedLogoFile) return "";

    const fd = new FormData();
    fd.append("logo", selectedLogoFile);

    const up = await fetch("/api/kurumsal-kimlik/logo", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Cache-Control": "no-cache",
      },
      cache: "no-store",
      body: fd,
    });

    if (!up.ok) {
      console.error("Logo upload hata:", await up.text());
      return "";
    }

    const upJson = await up.json();
    return upJson?.logoUrl || upJson?.doc?.logoUrl || "";
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isReadOnly) return;

    try {
      const token = getToken();
      if (!token) return alert("Token bulunamadı. Lütfen tekrar giriş yap.");

      // ✅ 1) Eğer logo seçildiyse önce dosyayı yükle
      const uploadedLogoUrl = await uploadLogoIfNeeded(token);

      // ✅ 2) PUT payload (logoUrl güncellenmiş)
      // NOT: backend'e logo(base64) göndermek zorunda değilsen göndermeyelim.
      // Mevcut yapını bozmamak için formData'yı koruyoruz ama istersek logo'yu çıkarabiliriz.
      const payload = {
        ...formData,
        logoUrl: uploadedLogoUrl || formData.logoUrl || "",
      };

      const res = await fetch("/api/kurumsal-kimlik", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Cache-Control": "no-cache",
        },
        cache: "no-store",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        console.error("Kurumsal kimlik kaydet hata:", await res.text());
        return alert("Kaydetme sırasında hata oluştu.");
      }

      // ✅ state güncelle (preview kalsın)
      setFormData(payload);

      // ✅ cache'e base64 girmesin (logo hariç)
      safeSetJSON(cacheKey, payload);
      safeSetJSON("kurumsalBilgiler", payload);

      // ✅ Aynı sekmede bile dinleyenler güncellensin
      window.dispatchEvent(new Event("kurumsalBilgilerUpdated"));

      // ✅ seçili dosyayı sıfırla (yeniden upload etmesin)
      setSelectedLogoFile(null);

      alert("Kurumsal Bilgiler kaydedildi ✅");
    } catch (err) {
      console.error("KurumsalKimlik kaydet exception:", err);
      alert("Kaydetme sırasında hata oluştu.");
    }
  };

  if (loading) return <div className="p-4">Yükleniyor...</div>;

  // ✅ gösterimde iki kaynağı da destekle
  const logoSrc =
  (formData.logo && formData.logo.startsWith("data:image"))
    ? formData.logo
    : "";

  return (
    <div className="bg-white shadow-md rounded p-6 max-w-2xl mx-auto mt-6">
      <h2 className="text-lg font-bold text-[#042f4b] mb-4">🏢 Kurumsal Kimlik</h2>

      {isReadOnly && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Bu alan, kurumsal süreç kapsamında yönetildiği için görüntülenebilir ancak değiştirilemez.
        </div>
      )}

      {logoSrc && (
        <div className="mb-4 flex justify-center">
          <img src={logoSrc} alt="Logo" className="h-20 object-contain border p-1" />
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Firma Adı</label>
          <input
            type="text"
            name="firmaAdi"
            value={formData.firmaAdi}
            onChange={handleChange}
            disabled={isReadOnly}
            className={`${inputBase} ${isReadOnly ? inputDisabled : ""}`}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Firma Adresi</label>
          <input
            type="text"
            name="adres"
            value={formData.adres}
            onChange={handleChange}
            disabled={isReadOnly}
            className={`${inputBase} ${isReadOnly ? inputDisabled : ""}`}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Telefon</label>
          <input
            type="tel"
            name="telefon"
            value={formData.telefon}
            onChange={handleChange}
            disabled={isReadOnly}
            className={`${inputBase} ${isReadOnly ? inputDisabled : ""}`}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">E-posta</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            disabled={isReadOnly}
            className={`${inputBase} ${isReadOnly ? inputDisabled : ""}`}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Web Sitesi</label>
          <input
            type="text"
            name="web"
            value={formData.web}
            onChange={handleChange}
            disabled={isReadOnly}
            className={`${inputBase} ${isReadOnly ? inputDisabled : ""}`}
          />
        </div>

        {!isReadOnly && (
          <div>
            <label className="block text-sm font-medium text-gray-700">Logo Yükle</label>
            <input type="file" accept="image/*" onChange={handleLogoChange} />
            <div className="text-[11px] text-gray-500 mt-1">
              Not: Logo önizleme için geçici tutulur. Kaydet&apos;e basınca logo dosya olarak yüklenir (logoUrl) ve tüm kullanıcılar aynı logoyu görür.
            </div>
          </div>
        )}

        {!isReadOnly && (
          <div className="pt-2">
            <PrimaryButton type="submit" size="sm" variant="green" className="px-4 py-2 mt-2">
              Kaydet
            </PrimaryButton>
          </div>
        )}
      </form>
    </div>
  );
}
