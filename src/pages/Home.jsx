import { Link } from "react-router-dom";
import { FaUser, FaBuilding } from "react-icons/fa";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl px-10 py-8 text-center">
        {/* Logo */}
        <img src="/logo-login.png" alt="İSG Panel" className="mx-auto h-28 mb-8" />

        {/* Giriş butonları (dengeli boyut) */}
        <div className="space-y-4">
          <Link
            to="/login/uzman"
            className="flex items-center justify-center gap-3 w-full h-10 rounded-lg bg-blue-600 text-white font-semibold shadow-md hover:bg-blue-700 transition text-sm md:text-base"
          >
            <FaUser className="text-base" />
            Bireysel Uzman Girişi
          </Link>

          <Link
            to="/login/osgb"
            className="flex items-center justify-center gap-3 w-full h-10 rounded-lg bg-green-600 text-white font-semibold shadow-md hover:bg-green-700 transition text-sm md:text-base"
          >
            <FaBuilding className="text-base" />
            Kurumsal/OSGB Girişi
          </Link>
        </div>

        <p className="text-xs text-gray-500 mt-8">
          © 2026 İSG Panel — Tüm Hakları Saklıdır
        </p>
      </div>
    </div>
  );
}
