import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { FaBuilding, FaSignOutAlt, FaFolderOpen } from "react-icons/fa";
import { useEffect, useState } from "react";

const menuItems = [
  {
    key: "firmalarim",
    label: "Firmalarım",
    icon: <FaBuilding className="text-sm" />,
    path: "/ticari/firmalarim",
  },
  {
    key: "belgelerim",
    label: "Belgelerim",
    icon: <FaFolderOpen className="text-sm" />,
    path: "/ticari/belgelerim",
  },
  // İleride buraya Risk, Acil Durum vb. modül linkleri ekleyebiliriz
];

export default function TicariUserPanel() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Login sonrasında localStorage'a kaydedilen kullanıcıyı alıyoruz
    const stored = localStorage.getItem("user");
    if (stored) {
      try {
        const u = JSON.parse(stored);
        setUser(u);
      } catch (e) {
        console.error("Kullanıcı bilgisi okunamadı:", e);
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/");
  };

  // İsim ve OSGB adını login'den gelen user formatına göre normalize edelim
  const userName =
    (
      user?.name ||
      user?.fullName ||
      user?.adSoyad ||
      "Kullanıcı Adı"
    ).toLocaleUpperCase("tr-TR");

  const orgName =
    user?.organization?.name ||
    user?.companyName ||
    user?.osgbAdi ||
    "OSGB Adı";

  return (
    <div className="min-h-screen flex bg-slate-100">
      {/* SOL MENÜ */}
      <aside className="w-64 bg-white shadow-xl flex flex-col">
        <div className="px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <img src="/logo-login.png" alt="İSG Panel" className="h-10" />
          </div>
          <div className="mt-3">
            <p className="text-xs text-slate-500">Ticari Kullanıcı Paneli</p>
            <p className="text-sm font-semibold text-slate-800 truncate">
              {userName}
            </p>
            <p className="text-xs text-emerald-600 font-medium mt-1 truncate">
              OSGB: {orgName}
            </p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {menuItems.map((item) => (
            <NavLink
              key={item.key}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition ${
                  isActive
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                    : "text-slate-600 hover:bg-slate-50"
                }`
              }
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-slate-100">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg py-2 transition"
          >
            <FaSignOutAlt />
            Çıkış Yap
          </button>
          <p className="mt-3 text-[11px] text-slate-400 text-center">
            © 2025 İSG Panel — Tüm Hakları Saklıdır
          </p>
        </div>
      </aside>

      {/* SAĞ İÇERİK */}
      <main className="flex-1 flex flex-col">
        {/* ÜST BAR */}
        <div className="h-14 bg-white shadow-sm flex items-center justify-between px-6">
          <div>
            <h1 className="text-sm font-semibold text-slate-800">
              Hoş geldin, {userName}
            </h1>
            <p className="text-[11px] text-slate-500">
              OSGB&apos;ne atanmış firmalar üzerinde işlem yapabilirsin.
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Hesap Türü</p>
            <p className="text-sm font-semibold text-slate-800">
              Ticari Kullanıcı
            </p>
          </div>
        </div>

        {/* SAYFA İÇERİĞİ */}
        <div className="flex-1 p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
