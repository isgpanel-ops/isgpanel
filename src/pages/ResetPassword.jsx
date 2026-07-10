import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import axios from "axios";
import { FaLock, FaArrowLeft, FaCheckCircle } from "react-icons/fa";
import { API_BASE } from "../config/api";

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

useEffect(() => {
  if (!token) {
    setError("Şifre sıfırlama bağlantısı geçersiz.");
  }
}, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!password || !password2) {
      setError("Lütfen tüm alanları doldurun.");
      return;
    }

   if (password !== password2) {
  setError("Şifreler birbiriyle uyuşmuyor.");
  return;
}

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;
if (!PASSWORD_REGEX.test(password)) {
  setError(
    "Şifre en az 8 karakter, 1 büyük harf, 1 küçük harf ve 1 özel karakter içermelidir."
  );
  return;
}

    if (!token) {
  setError("Şifre sıfırlama bağlantısı geçersiz.");
  return;
}

try {
  setLoading(true);

  const res = await axios.post(`${API_BASE}/auth/reset-password`, {
    token,
    password,
  });

      setSuccess(res?.data?.message || "Şifreniz başarıyla güncellendi.");
      setPassword("");
      setPassword2("");
    } catch (err) {
      setError(
        err?.response?.data?.message || "Şifre güncellenemedi."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8 text-center">
        <img src="/logo-login.png" alt="İSG Panel" className="mx-auto h-20 mb-6" />

        <h2 className="text-xl font-bold mb-2">Yeni Şifre Oluştur</h2>
        <p className="text-sm text-gray-500 mb-6">
          Lütfen yeni şifrenizi belirleyin.
        </p>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="relative">
            <input
              type="password"
              placeholder="Yeni şifre"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded-lg px-4 py-2 pl-10"
            />
            <FaLock className="absolute left-3 top-3 text-gray-400" />
          </div>

          <div className="relative">
            <input
              type="password"
              placeholder="Yeni şifre tekrar"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              className="w-full border rounded-lg px-4 py-2 pl-10"
            />
            <FaLock className="absolute left-3 top-3 text-gray-400" />
          </div>

<p className="text-xs text-gray-500 text-left">
  Şifre en az 8 karakter, 1 büyük harf, 1 küçük harf ve 1 özel karakter içermelidir.
</p>

          {error && <p className="text-red-600 text-sm">{error}</p>}
          {success && (
            <p className="text-green-600 text-sm flex items-center justify-center gap-2">
              <FaCheckCircle />
              {success}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-3 w-full h-10 rounded-lg bg-[#0a2b45] text-white font-semibold shadow-md hover:opacity-90 transition disabled:opacity-60"
          >
            {loading ? "Güncelleniyor..." : "Şifreyi Güncelle"}
          </button>

          <button
            type="button"
            onClick={() => navigate("/login/uzman")}
            className="flex items-center justify-center gap-2 w-full h-10 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition"
          >
            <FaArrowLeft />
            Girişe Dön
          </button>
        </form>
      </div>
    </div>
  );
}