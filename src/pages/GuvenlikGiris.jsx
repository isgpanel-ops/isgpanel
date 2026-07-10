import React, { useEffect, useMemo, useState } from "react";

/** Token helper (sende token key farklıysa sadece burayı değiştir) */
function getToken() {
  return localStorage.getItem("token") || "";
}

/**
 * API Base URL:
 * - Vite: .env -> VITE_API_URL=http://localhost:5000
 * - Boşsa aynı origin / proxy üzerinden gider (örn nginx veya vite proxy)
 */
function getApiBase() {
  const base = (import.meta?.env?.VITE_API_URL || "").trim();
  // Sonunda "/" varsa kırpalım: http://localhost:5000/
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

/** Güvenli JSON parse: boş body / non-json durumlarında patlamasın */
async function safeParseJson(res) {
  const text = await res.text().catch(() => "");
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    // JSON değilse text’i saklayalım
    return { _raw: text };
  }
}

/** Basit ama sağlam API helper */
async function apiFetch(path, options = {}, signal) {
  const token = getToken();
  const base = getApiBase();
  const url = path.startsWith("http") ? path : `${base}${path}`;

  const headers = {
    ...(options.headers || {}),
  };

  // Body varsa json kabul edelim; yoksa Content-Type basmayalım (GET/empty body)
  const hasBody = options.body !== undefined && options.body !== null;
  if (hasBody && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    ...options,
    headers,
    signal,
  });

  const data = await safeParseJson(res);

  if (!res.ok) {
    // Backend farklı formatta dönebilir: message/error/detail...
    const msg =
      data?.message ||
      data?.error ||
      data?.detail ||
      (typeof data?._raw === "string" && data._raw.trim()
        ? data._raw
        : null) ||
      `İşlem başarısız (HTTP ${res.status})`;

    // 401 ise token geçersiz/expired olabilir
    if (res.status === 401) {
      throw new Error("Oturum süresi dolmuş olabilir. Lütfen yeniden giriş yapınız.");
    }
    throw new Error(msg);
  }

  return data;
}

export default function GuvenlikGiris() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [errorText, setErrorText] = useState("");

  const [ayar, setAyar] = useState({
    email: "",
    twofa: false,
    newLoginAlert: true,
    devices: [],
    role: "",
    userType: "",
  });

  const [pwdForm, setPwdForm] = useState({
    current: "",
    next: "",
    next2: "",
  });

  const hasToken = useMemo(() => !!getToken(), []);

  useEffect(() => {
    const ac = new AbortController();
    let mounted = true;

    (async () => {
      try {
        setErrorText("");
        setLoading(true);

        // Token yoksa backend genelde 401 döner; kullanıcıya net söyleyelim
        if (!getToken()) {
          throw new Error("Giriş anahtarı (token) bulunamadı. Lütfen çıkış yapıp tekrar giriş yapınız.");
        }

        const me = await apiFetch("/api/guvenlik-giris/me", { method: "GET" }, ac.signal);

        if (!mounted) return;

        setAyar((prev) => ({
          ...prev,
          email: me.email || "",
          twofa: !!me.twofa,
          newLoginAlert: me.newLoginAlert !== false,
          devices: Array.isArray(me.devices) ? me.devices : [],
          role: me.role || "",
          userType: me.userType || "",
        }));
      } catch (e) {
        if (!mounted) return;
        const msg = e?.message || "İşlem başarısız";
        setErrorText(msg);
        // Eski davranışı da koruyalım ama sadece gerçek hata olduğunda
        alert(msg);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      ac.abort();
    };
  }, []);

  const kaydet = async () => {
    try {
      setErrorText("");
      setSaving(true);

      await apiFetch(
        "/api/guvenlik-giris/settings",
        {
          method: "PUT",
          body: JSON.stringify({
            twofa: ayar.twofa,
            newLoginAlert: ayar.newLoginAlert,
          }),
        }
      );

      alert("Güvenlik ayarlarınız başarıyla kaydedilmiştir.");
    } catch (e) {
      const msg = e?.message || "İşlem başarısız";
      setErrorText(msg);
      alert(msg);
    } finally {
      setSaving(false);
    }
  };

  const sifreDegistir = async (e) => {
    e.preventDefault();

    if (!pwdForm.current || !pwdForm.next || !pwdForm.next2) {
      alert("Lütfen tüm şifre alanlarını doldurunuz.");
      return;
    }
    if (pwdForm.next !== pwdForm.next2) {
      alert("Yeni şifre alanları birbiriyle eşleşmemektedir.");
      return;
    }

const passwordRule =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;

if (!passwordRule.test(pwdForm.next)) {
  alert(
    "Yeni şifre en az 8 karakter olmalı; en az 1 küçük harf, 1 büyük harf ve 1 özel karakter içermelidir."
  );
  return;
}

    try {
      setErrorText("");
      setSaving(true);

      await apiFetch(
        "/api/guvenlik-giris/change-password",
        {
          method: "POST",
          body: JSON.stringify({
            currentPassword: pwdForm.current,
            newPassword: pwdForm.next,
            newPassword2: pwdForm.next2,
          }),
        }
      );

      setPwdForm({ current: "", next: "", next2: "" });
      alert("Şifreniz başarıyla güncellenmiştir.");
    } catch (e2) {
      const msg = e2?.message || "İşlem başarısız";
      setErrorText(msg);
      alert(msg);
    } finally {
      setSaving(false);
    }
  };

  const tumOturumlariKapat = async () => {
    try {
      setErrorText("");
      setSaving(true);

      await apiFetch("/api/guvenlik-giris/logout-all", { method: "POST" });

      // Backend liste döndürmüyorsa da UI temizlensin
      setAyar((a) => ({ ...a, devices: [] }));
      alert("Tüm aktif oturumlar güvenli şekilde sonlandırılmıştır.");
    } catch (e) {
      const msg = e?.message || "İşlem başarısız";
      setErrorText(msg);
      alert(msg);
    } finally {
      setSaving(false);
    }
  };

  const destekMailGonder = () => {
    const to = "destek@isgpanel.tr";
    const subject = encodeURIComponent("E-posta güncelleme talebi");
    const body = encodeURIComponent(
      `Merhaba Destek Ekibi,\n\n` +
        `Hesabımın e-posta adresinin güncellenmesini rica ederim.\n\n` +
        `Mevcut e-posta: ${ayar.email}\n` +
        `Rol: ${ayar.role || "-"}\n` +
        `Kullanıcı Tipi: ${ayar.userType || "-"}\n\n` +
        `Teşekkürler.`
    );
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
  };

  const disabledAll = loading || saving;

  return (
    <div className="bg-white shadow-md rounded p-6 max-w-3xl mx-auto mt-6 space-y-6">
      <h2 className="text-lg font-bold text-[#0a2b45]">
        🔐 Güvenlik ve Giriş Ayarları
      </h2>

      {/* Hata bandı (tasarımı bozmadan) */}
      {errorText ? (
        <div className="border border-red-200 bg-red-50 text-red-700 rounded p-3 text-sm">
          {errorText}
        </div>
      ) : null}

      {/* Token uyarısı (opsiyonel ama net) */}
      {!hasToken ? (
        <div className="border border-yellow-200 bg-yellow-50 text-yellow-800 rounded p-3 text-sm">
          Giriş anahtarı (token) bulunamadı. İşlemler başarısız olur. Lütfen yeniden giriş yapın.
        </div>
      ) : null}

      {/* Hesap */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Hesap Bilgileri</h3>

        {/* Hesap bilgileri görünsün ama kilitli olsun ✅ */}
        <input
          type="email"
          value={ayar.email}
          readOnly
          disabled
          className="w-full border rounded px-3 py-2 text-sm bg-gray-100 text-gray-600 cursor-not-allowed"
        />

        <div className="border rounded p-3 bg-gray-50">
          <div className="text-xs text-gray-600">
            Bu alan, doğrulama ve belge bütünlüğü kapsamında kullanıcı tarafından güncellenemez.
            Güncellemeler Destek Ekibi tarafından yapılır.
          </div>
          <button
            type="button"
            onClick={destekMailGonder}
            className="mt-2 text-xs font-semibold text-blue-600 hover:underline"
          >
            ▶ Destek Ekibine e-posta gönder
          </button>
        </div>
      </section>

      {/* Şifre */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Şifre İşlemleri</h3>

        <form onSubmit={sifreDegistir} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="password"
            placeholder="Mevcut Şifre"
            value={pwdForm.current}
            onChange={(e) => setPwdForm((f) => ({ ...f, current: e.target.value }))}
            className="border rounded px-3 py-2 text-sm"
            disabled={disabledAll}
          />
          <input
            type="password"
            placeholder="Yeni Şifre"
            value={pwdForm.next}
            onChange={(e) => setPwdForm((f) => ({ ...f, next: e.target.value }))}
            className="border rounded px-3 py-2 text-sm"
            disabled={disabledAll}
          />
          <input
            type="password"
            placeholder="Yeni Şifre (Tekrar)"
            value={pwdForm.next2}
            onChange={(e) => setPwdForm((f) => ({ ...f, next2: e.target.value }))}
            className="border rounded px-3 py-2 text-sm"
            disabled={disabledAll}
          />

<div className="md:col-span-3 text-xs text-gray-500">
Şifreniz en az 8 karakter olmalı; en az 1 küçük harf, 1 büyük harf ve 1 özel karakter içermelidir.
</div>

          <div className="md:col-span-3">
            <button
              type="submit"
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded text-sm font-medium disabled:opacity-60"
              disabled={disabledAll}
            >
              {saving ? "Güncelleniyor..." : "Şifreyi Güncelle"}
            </button>
          </div>
        </form>
      </section>

      {/* Ek güvenlik */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Ek Güvenlik Seçenekleri</h3>

        <div className="flex justify-between items-center border rounded p-3">
          <div>
            <div className="font-medium text-sm">2 Adımlı Doğrulama</div>
            <div className="text-xs text-gray-600">Hesabınıza ek güvenlik katmanı ekler.</div>
          </div>
          <input
            type="checkbox"
            checked={ayar.twofa}
            onChange={(e) => setAyar((a) => ({ ...a, twofa: e.target.checked }))}
            className="h-5 w-5"
            disabled={disabledAll}
          />
        </div>

        <div className="flex justify-between items-center border rounded p-3">
          <div>
            <div className="font-medium text-sm">Yeni Oturum Bildirimi</div>
            <div className="text-xs text-gray-600">
              Tanınmayan cihaz girişlerinde e-posta bildirimi alırsınız.
            </div>
          </div>
          <input
            type="checkbox"
            checked={ayar.newLoginAlert}
            onChange={(e) => setAyar((a) => ({ ...a, newLoginAlert: e.target.checked }))}
            className="h-5 w-5"
            disabled={disabledAll}
          />
        </div>
      </section>

      {/* Oturumlar */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Aktif Oturumlar</h3>

        {ayar.devices.length === 0 ? (
          <div className="text-sm text-gray-600 border rounded p-3">
            Kayıtlı aktif oturum bulunmamaktadır.
          </div>
        ) : (
          <ul className="border rounded divide-y">
            {ayar.devices.map((d, idx) => (
              <li
                key={d?.id || d?._id || d?.deviceId || `${d?.name || "device"}-${idx}`}
                className="p-3 text-sm flex justify-between"
              >
                <span>{d?.name || d?.ad || "Cihaz"}</span>
                <span className="text-gray-500">
                  {d?.lastSeenAt
                    ? new Date(d.lastSeenAt).toLocaleString("tr-TR")
                    : d?.tarih || ""}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={tumOturumlariKapat}
            className="bg-blue-500 hover:bg-blue-600 text-white px-5 py-2 rounded text-sm disabled:opacity-60"
            disabled={disabledAll}
          >
            {saving ? "İşleniyor..." : "Tüm Oturumları Kapat"}
          </button>

          <button
            onClick={kaydet}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded text-sm font-medium disabled:opacity-60"
            disabled={disabledAll}
          >
            {saving ? "Kaydediliyor..." : "Ayarları Kaydet"}
          </button>
        </div>
      </section>
    </div>
  );
}
