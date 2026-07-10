import React from "react";
import { useNavigate } from "react-router-dom";
import { FiBell, FiSettings, FiLogOut } from "react-icons/fi";
import { FaUserCircle } from "react-icons/fa";

const Navbar = ({ userName = "Uzman Adı", onLogout = () => {} }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    // 1) Token temizle
    try {
      localStorage.removeItem("token");
      sessionStorage.clear();
    } catch (e) {}

    // 2) Eğer dışarıda ekstra işlem varsa çalıştır (örn. state reset)
    // AMA yönlendirmeyi KESİNLİKLE dışarıya bırakmıyoruz
    try {
      onLogout();
    } catch (e) {}

    // 3) ✅ 3. resimdeki giriş seçim ekranı = "/" (Home)
    navigate("/", { replace: true });
  };

  return (
    <header className="w-full bg-white shadow-sm sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Sol: Logo */}
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="ISG Panel Logo"
              className="h-10 w-auto object-contain"
            />
            <div className="ml-3 hidden md:block">
              <h1 className="text-gray-700 font-semibold text-sm">
                İş Sağlığı ve Güvenliği Paneli
              </h1>
              <p className="text-xs text-gray-400">
                Genel durum ve özet göstergeler
              </p>
            </div>
          </div>

          {/* Sağ: ikonlar */}
          <div className="flex items-center gap-4">
            {/* Bildirim */}
            <button className="relative p-2 rounded hover:bg-gray-100">
              <FiBell className="text-xl text-gray-600" />
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                2
              </span>
            </button>

            {/* Ayarlar */}
            <button className="p-2 rounded hover:bg-gray-100">
              <FiSettings className="text-xl text-gray-600" />
            </button>

            {/* Kullanıcı */}
            <div className="flex items-center gap-2 border-l pl-4">
              <FaUserCircle className="text-2xl text-gray-600" />
              <div className="hidden sm:block text-right">
                <div className="text-sm font-medium text-gray-700">{userName}</div>
                <div className="text-xs text-gray-400">Uzman</div>
              </div>
            </div>

            {/* Çıkış */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 ml-2 text-sm text-red-600 hover:underline"
              title="Çıkış"
              type="button"
            >
              <FiLogOut /> <span className="hidden md:inline">Çıkış</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
