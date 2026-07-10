import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import axios from "axios";
import { FaEnvelope, FaArrowLeft, FaUser, FaBuilding } from "react-icons/fa";
import { API_BASE } from "../config/api";

export default function ForgotPassword() {
  const { role } = useParams(); // uzman | kurumsal
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isUzman = role === "uzman";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!email) {
      setError("Lütfen e-posta adresinizi girin.");
      return;
    }

    try {
      setLoading(true);

      const res = await axios.post(`${API_BASE}/auth/forgot-password`, {
        email,
      });

      setSuccess(
        res?.data?.message ||
          "Eğer bu e-posta sistemde kayıtlıysa şifre sıfırlama bağlantısı gönderildi."
      );
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Şifre sıfırlama maili gönderilemedi."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8 text-center">
        <img src="/logo-login.png" alt="İSG Panel" className="mx-auto h-20 mb-6" />

        <h2 className="text-xl font-bold mb-2">
          Şifremi Unuttum
        </h2>

        <p className="text-sm text-gray-500 mb-6">
          {isUzman
            ? "Bireysel uzman hesabınız için kayıtlı e-posta adresinizi girin."
            : "Kurumsal / OSGB hesabınız için kayıtlı e-posta adresinizi girin."}
        </p>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="relative">
            <input
              type="email"
              placeholder="E-posta adresiniz"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border rounded-lg px-4 py-2 pl-10"
            />
            <FaEnvelope className="absolute left-3 top-3 text-gray-400" />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}
          {success && <p className="text-green-600 text-sm">{success}</p>}

          <button
            type="submit"
            disabled={loading}
            className={`flex items-center justify-center gap-3 w-full h-10 rounded-lg ${
              isUzman ? "bg-blue-600" : "bg-green-600"
            } text-white font-semibold shadow-md hover:opacity-90 transition disabled:opacity-60`}
          >
            {isUzman ? <FaUser /> : <FaBuilding />}
            {loading ? "Gönderiliyor..." : "Şifre Sıfırlama Linki Gönder"}
          </button>

          <button
            type="button"
            onClick={() => navigate(`/login/${role}`)}
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