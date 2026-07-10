import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  FaBuilding,
  FaUsers,
  FaClipboardList,
  FaBoxOpen,
  FaSignOutAlt,
} from "react-icons/fa";
import { useEffect, useState } from "react";

const menuItems = [
  {
    key: "firmalar",
    label: "Tüm Firmalar",
    icon: <FaBuilding className="text-sm" />,
    path: "/ticari/admin/firmalar",
  },
  {
    key: "askidaki-firmalar",
    label: "Askıdaki Firmalar",
    icon: <FaBoxOpen className="text-sm" />,
    path: "/ticari/admin/askidaki-firmalar",
  },
  {
    key: "kullanicilar",
    label: "Kullanıcılar",
    icon: <FaUsers className="text-sm" />,
    path: "/ticari/admin/kullanicilar",
  },
  {
    key: "paketim",
    label: "Paketim",
    icon: <FaClipboardList className="text-sm" />,
    path: "/ticari/admin/paketim",
  },
];

export default function TicariAdminPanel() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Login sonrasında localStorage'a kaydedilen user bilgisini alıyoruz
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
    navigate("/"); // Ana giriş ekranın
  };

  const orgName =
    user?.organization?.name ||
    user?.companyName || // eski format desteği
    user?.osgbAdi ||
    "OSGB Adı";

  const planCode =
    user?.organization?.planCode ||
    user?.planCode ||
    user?.paket ||
    "ticari-1-3";

  const subscriptionEnd = user?.organization?.subscriptionEnd || user?.subscriptionEnd;

  const adminName =
    user?.name ||
    user?.fullName ||
    user?.adSoyad ||
    "Admin Kullanıcı";

  return (
    <div className="min-h-screen flex bg-slate-100">
      {/* SOL MENÜ */}
      <aside className="w-64 bg-white shadow-xl flex flex-col">
        <div className="px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <img src="/logo-login.png" alt="İSG Panel" className="h-10" />
          </div>
          <div className="mt-3">
            <p className="text-xs text-slate-500">Ticari OSGB Admin Paneli</p>
            <p className="text-sm font-semibold text-slate-800 truncate">
              {orgName}
            </p>
            <p className="text-xs text-emerald-600 font-medium mt-1 truncate">
              Paket: {planCode}
              {subscriptionEnd && (
                <span className="text-[10px] text-slate-500 ml-1">
                  — Bitiş:{" "}
                  {new Date(subscriptionEnd).toLocaleDateString("tr-TR")}
                </span>
              )}
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
              {orgName}
            </h1>
            <p className="text-[11px] text-slate-500">
              Admin olarak tüm firmaları ve kullanıcıları yönetebilirsiniz.
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Aktif Kullanıcı</p>
            <p className="text-sm font-semibold text-slate-800">
              {adminName}
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
