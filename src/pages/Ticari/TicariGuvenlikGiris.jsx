import React, { useEffect, useState } from "react";

function getToken() {
  return localStorage.getItem("token") || "";
}

async function apiFetch(url, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.message || "İşlem başarısız";
    throw new Error(msg);
  }
  return data;
}

export default function TicariGuvenlikGiris() {
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const me = await apiFetch("/api/guvenlik-giris/me", { method: "GET" });

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
        alert(e.message);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const kaydet = async () => {
    try {
      await apiFetch("/api/guvenlik-giris/settings", {
        method: "PUT",
        body: JSON.stringify({
          twofa: ayar.twofa,
          newLoginAlert: ayar.newLoginAlert,
        }),
      });
      alert("Güvenlik ve giriş ayarlarınız kaydedilmiştir.");
    } catch (e) {
      alert(e.message);
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
      await apiFetch("/api/guvenlik-giris/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: pwdForm.current,
          newPassword: pwdForm.next,
          newPassword2: pwdForm.next2,
        }),
      });

      setPwdForm({ current: "", next: "", next2: "" });
      alert("Şifreniz başarıyla güncellenmiştir.");
    } catch (e2) {
      alert(e2.message);
    }
  };

  const tumOturumlariKapat = async () => {
    try {
      await apiFetch("/api/guvenlik-giris/logout-all", { method: "POST" });
      setAyar((a) => ({ ...a, devices: [] }));
      alert("Tüm aktif oturumlar güvenli şekilde sonlandırılmıştır.");
    } catch (e) {
      alert(e.message);
    }
  };

  const destekMailGonder = () => {
    const to = "destek@isgpanel.tr";
    const subject = encodeURIComponent("Kurumsal hesap e-posta güncelleme talebi");
    const body = encodeURIComponent(
      `Merhaba Destek Ekibi,\n\n` +
        `Kurumsal hesabımın e-posta adresinin güncellenmesini rica ederim.\n\n` +
        `Mevcut e-posta: ${ayar.email}\n` +
        `Rol: ${ayar.role || "-"}\n` +
        `Kullanıcı Tipi: ${ayar.userType || "-"}\n\n` +
        `Teşekkürler.`
    );
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
  };

  const isCorporateUser = ayar.role === "CORPORATE_USER";

  return (
    <div className="bg-white shadow-md rounded p-6 max-w-3xl mx-auto mt-6 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[#0a2b45]">🔐 Güvenlik ve Giriş (Ticari)</h2>
        <p className="text-xs text-gray-500 mt-1">
          Bu alandaki ayarlar, hesabınızın güvenliği ve oturum yönetimi için kullanılır.
        </p>
      </div>

      {/* Hesap */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Hesap Bilgileri</h3>

        <input
          type="email"
          value={ayar.email}
          readOnly
          disabled
          className="w-full border rounded px-3 py-2 text-sm bg-gray-100 text-gray-600 cursor-not-allowed"
        />

        {/* ✅ Rol bazlı bilgi notu */}
        {isCorporateUser ? (
          <div className="border rounded p-3 bg-gray-50">
            <div className="text-xs text-gray-600">
              Bu alan kullanıcı tarafından güncellenemez.
              <br />
              E-posta adresi firma yöneticisi (Admin) tarafından güncellenir.
            </div>
          </div>
        ) : (
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
        )}
      </section>

      {/* Şifre Değiştir */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Şifre İşlemleri</h3>

        <form onSubmit={sifreDegistir} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="password"
            placeholder="Mevcut Şifre"
            value={pwdForm.current}
            onChange={(e) => setPwdForm((f) => ({ ...f, current: e.target.value }))}
            className="border rounded px-3 py-2 text-sm"
            disabled={loading}
          />
          <input
            type="password"
            placeholder="Yeni Şifre"
            value={pwdForm.next}
            onChange={(e) => setPwdForm((f) => ({ ...f, next: e.target.value }))}
            className="border rounded px-3 py-2 text-sm"
            disabled={loading}
          />
          <input
            type="password"
            placeholder="Yeni Şifre (Tekrar)"
            value={pwdForm.next2}
            onChange={(e) => setPwdForm((f) => ({ ...f, next2: e.target.value }))}
            className="border rounded px-3 py-2 text-sm"
            disabled={loading}
          />

         <div className="md:col-span-3 text-xs text-gray-500">
  Şifreniz en az 8 karakter olmalı; en az 1 küçük harf, 1 büyük harf ve 1 özel karakter içermelidir.
</div>

          <div className="md:col-span-3 flex justify-end">
            <button
              type="submit"
              className="bg-green-600 hover:bg-green-700 text-white px-8 py-2 rounded text-sm font-semibold disabled:opacity-60"
              disabled={loading}
            >
              Şifreyi Güncelle
            </button>
          </div>
        </form>
      </section>

      {/* Ek güvenlik */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Ek Güvenlik</h3>

        <div className="flex justify-between items-center border rounded p-3">
          <div>
            <div className="font-medium text-sm">2 Adımlı Doğrulama</div>
            <div className="text-xs text-gray-600">
              Hesabınıza ek güvenlik katmanı ekler.
            </div>
          </div>
          <input
            type="checkbox"
            checked={ayar.twofa}
            onChange={(e) => setAyar((a) => ({ ...a, twofa: e.target.checked }))}
            className="h-5 w-5"
            disabled={loading}
          />
        </div>

        <div className="flex justify-between items-center border rounded p-3">
          <div>
            <div className="font-medium text-sm">Yeni Oturum Bildirimi</div>
            <div className="text-xs text-gray-600">
              Tanınmayan cihaz girişlerinde bilgilendirme alırsınız.
            </div>
          </div>
          <input
            type="checkbox"
            checked={ayar.newLoginAlert}
            onChange={(e) => setAyar((a) => ({ ...a, newLoginAlert: e.target.checked }))}
            className="h-5 w-5"
            disabled={loading}
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
            {ayar.devices.map((d) => (
              <li key={d.id} className="p-3 text-sm flex justify-between">
                <span>{d.name || d.ad || "Cihaz"}</span>
                <span className="text-gray-500">
                  {d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString("tr-TR") : d.tarih || ""}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={tumOturumlariKapat}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded text-sm font-medium disabled:opacity-60"
            disabled={loading}
          >
            Tüm Oturumları Kapat
          </button>

          <button
            type="button"
            onClick={kaydet}
            className="bg-green-600 hover:bg-green-700 text-white px-8 py-2 rounded text-sm font-semibold disabled:opacity-60"
            disabled={loading}
          >
            Ayarları Kaydet
          </button>
        </div>
      </section>
    </div>
  );
}
