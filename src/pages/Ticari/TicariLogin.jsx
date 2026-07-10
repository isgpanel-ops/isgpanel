import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { hardResetForAuth } from "../utils/authHardReset";
import { API_BASE } from "../../config/api";

export default function TicariLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Lütfen email ve şifre girin.");
      return;
    }

    try {
      setLoading(true);

      const res = await axios.post(`${API_BASE}/auth/login`, {
        email,
        password,
      });

    const { token, user } = res.data;

// ✅ token'ı geçici yaz ki /auth/me doğru kullanıcıyı dönsün
localStorage.setItem("token", token);
sessionStorage.setItem("token", token);

// ✅ login response yerine canlı /me verisini çek
let liveMe = null;
try {
  const meRes = await axios.get(`${API_BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  liveMe = meRes?.data?.user || meRes?.data || null;
} catch (meErr) {
  console.warn("LOGIN sonrası /auth/me okunamadı, login user kullanılacak:", meErr);
}

const baseUser = liveMe || user;

const taggedUser = {
  ...baseUser,
  loginSource: "corporate",
  assignedByAdmin: baseUser?.role === "ticari_user",
};

// ✅ tüm eski pending/expired kalıntılarını temizle
localStorage.removeItem("isSubscriptionExpired");
sessionStorage.removeItem("isSubscriptionExpired");

localStorage.setItem("ticari_user", JSON.stringify(taggedUser));
localStorage.setItem("user", JSON.stringify(taggedUser));
sessionStorage.setItem("user", JSON.stringify(taggedUser));

if (taggedUser.role === "ticari_admin") {
  hardResetForAuth(email, token, taggedUser, "/ticari/admin");
} else if (taggedUser.role === "ticari_user") {
  hardResetForAuth(email, token, taggedUser, "/panel");
} else if (taggedUser.role === "isyeri_hekimi") {
  hardResetForAuth(email, token, taggedUser, "/isyeri-hekimi");
} else {
  setError("Bu giriş tipi için yetkiniz bulunmamaktadır.");
}
    } catch (err) {
      console.error("LOGIN HATA:", err);
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Giriş yapılırken bir hata oluştu."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6">
        <div className="flex flex-col items-center mb-4">
          <img src="/logo-login.png" alt="İSG Panel" className="h-12 mb-2" />
          <h1 className="text-lg font-semibold text-slate-800">Ticari Giriş</h1>
          <p className="text-xs text-slate-500 mt-1">
            OSGB / Ticari kullanıcı hesabınız ile giriş yapın.
          </p>
        </div>

        {error && (
          <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Email
            </label>
            <input
              type="email"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0a2b45]"
              placeholder="ornek@osgb.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Şifre
            </label>
            <input
              type="password"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0a2b45]"
              placeholder="Şifreniz"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 rounded-lg bg-[#0a2b45] text-white text-sm font-semibold py-2.5 hover:bg-[#073252] transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
          </button>
        </form>

<div className="text-right mt-2">
  <a
    href="/forgot-password"
    className="text-xs text-[#0a2b45] hover:underline"
  >
    Şifremi unuttum?
  </a>
</div>

        <p className="mt-4 text-[11px] text-slate-400 text-center">
          © 2025 İSG Panel – Ticari Giriş
        </p>
      </div>
    </div>
  );
}
