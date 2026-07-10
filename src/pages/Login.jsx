import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import axios from "axios";
import { FaUser, FaBuilding } from "react-icons/fa";
import { hardResetForAuth } from "../utils/authHardReset";
import { API_BASE } from "../config/api";

export default function Login() {
  const { role } = useParams(); // "uzman" veya "kurumsal"

  // ✅ Super Admin: sadece uzman giriş ekranında email hatırlama
  const rememberedSuperAdminEmail = (() => {
    try {
      return role === "uzman"
        ? localStorage.getItem("__isg_superadmin_email") || ""
        : "";
    } catch {
      return "";
    }
  })();

  const [username, setUsername] = useState(rememberedSuperAdminEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // ✅ NotificationContext getToken() bunu okuyor: localStorage/sessionStorage "token"
  const persistAuthBasics = (email, token, user) => {
    try {
      const e = (email || "").toLowerCase().trim();

      // token garantisi
     if (token) {
  localStorage.setItem("token", token);
  sessionStorage.setItem("token", token);

  // 🔥 KRİTİK FIX
  axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
}

      // user + aktif email (projende başka yerlerde kullanılıyor)
      if (user) {
        localStorage.setItem("user", JSON.stringify(user));
        sessionStorage.setItem("user", JSON.stringify(user));
      }
      if (e) {
        localStorage.setItem("__isg_active_email_global", e);
      }
    } catch {}
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!username || !password) {
      setError("⚠️ Lütfen tüm alanları doldurunuz!");
      return;
    }

    try {
      const res = await axios.post(`${API_BASE}/auth/login`, {
        email: username,
        password,
      });

      const user = res.data.user;
      const token = res.data.token;

      const email = user?.email || username;

      const userRole = (user?.role || "").toLowerCase();
const isTicari =
  userRole === "ticari_admin" ||
  userRole === "ticari_user" ||
  userRole === "isyeri_hekimi";

      // 🔴 SUPER ADMIN
      if (userRole === "super_admin") {
        if (role && role !== "uzman") {
          setError(
            "Super Admin yalnızca Bireysel Uzman Girişi ekranından giriş yapabilir."
          );
          return;
        }

        localStorage.removeItem("ticari_user");

        try {
          localStorage.setItem(
            "__isg_superadmin_email",
            (email || "").toLowerCase().trim()
          );
        } catch {}

        setError("");

        // ✅ GARANTİ: bildirimler token bulsun
        persistAuthBasics(email, token, user);

        hardResetForAuth(email, token, user, "/super");
        return;
      }

      // 🔵 Bireysel (uzman)
      if (role === "uzman") {
        if (isTicari) {
          setError(
            "Bu kullanıcı ticari hesaptır. Lütfen Kurumsal/OSGB Girişi ekranını kullanın."
          );
          return;
        }

        localStorage.removeItem("ticari_user");

        setError("");

        // ✅ GARANTİ: bildirimler token bulsun
        persistAuthBasics(email, token, user);

        hardResetForAuth(email, token, user, "/panel");
        return;
      }

      // 🟡 Kurumsal (ticari)
      if (!isTicari) {
        setError(
          "Bu kullanıcı bireysel hesaptır. Lütfen Bireysel Uzman Girişi ekranını kullanın."
        );
        return;
      }

      setError("");

      // ✅ Ticari admin
      if (userRole === "ticari_admin") {
        localStorage.removeItem("ticari_user");

        // ✅ GARANTİ: bildirimler token bulsun
        persistAuthBasics(email, token, user);

        hardResetForAuth(email, token, user, "/ticari/admin");
        return;
      }

    // ✅ Ticari user
if (userRole === "ticari_user") {
  const taggedUser = { ...user, loginSource: "corporate", assignedByAdmin: true };
  localStorage.setItem("ticari_user", JSON.stringify(taggedUser));

  // ✅ GARANTİ: bildirimler token bulsun
  persistAuthBasics(email, token, taggedUser);

  hardResetForAuth(email, token, taggedUser, "/panel");
  return;
}

// ✅ İşyeri hekimi
if (userRole === "isyeri_hekimi") {
  const taggedUser = { ...user, loginSource: "corporate", assignedByAdmin: true };
  localStorage.setItem("ticari_user", JSON.stringify(taggedUser));

  // ✅ GARANTİ: bildirimler token bulsun
  persistAuthBasics(email, token, taggedUser);

  hardResetForAuth(email, token, taggedUser, "/isyeri-hekimi");
  return;
}

setError("Bu kullanıcı rolü için yetkili panel bulunamadı.");
    } catch (err) {
      setError(err.response?.data?.message || "⚠️ Giriş hatası");
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8 text-center">

  <div className="flex justify-start mb-4">
    <button
      onClick={() => navigate("/")}
      className="w-9 h-9 flex items-center justify-center rounded-full bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition"
    >
      ←
    </button>
  </div>

  <img src="/logo-login.png" alt="İSG Panel" className="mx-auto h-20 mb-6" />

        <h2 className="text-xl font-bold mb-6">
          {role === "uzman" ? "Bireysel Uzman Girişi" : "Kurumsal/OSGB Girişi"}
        </h2>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Kullanıcı Adı / E-posta"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full border rounded-lg px-4 py-2"
          />

          <input
            type="password"
            placeholder="Şifre"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded-lg px-4 py-2"
          />

          <div className="flex justify-end -mt-2">
            <button
              type="button"
              onClick={() => navigate(`/forgot-password/${role}`)}
              className="text-xs text-blue-600 hover:underline"
            >
              Şifremi Unuttum
            </button>
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            className={`flex items-center justify-center gap-3 w-full h-10 rounded-lg ${
              role === "uzman" ? "bg-blue-600" : "bg-green-600"
            } text-white font-semibold shadow-md hover:opacity-90 transition`}
          >
            {role === "uzman" ? <FaUser /> : <FaBuilding />}
            Giriş Yap
          </button>
        </form>

        <p className="text-sm text-gray-600 mt-4">
          Hesabın yok mu?{" "}
          <span
            onClick={() => {
              if (role === "uzman") navigate("/register/uzman?plan=bireysel");
              else navigate("/register/kurumsal?plan=ticari-1-3");
            }}
            className={`cursor-pointer ${
              role === "uzman" ? "text-blue-600" : "text-green-600"
            } hover:underline`}
          >
            Kayıt Ol
          </span>
        </p>
      </div>
    </div>
  );
}