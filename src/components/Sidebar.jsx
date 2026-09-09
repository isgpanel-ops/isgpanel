import React, { useMemo } from "react";
import { NavLink } from "react-router-dom";
import {
  Home,
  FolderOpen,
  Building2,
  ShieldCheck,
  FileWarning,
  CalendarDays,
  GraduationCap,
  BookOpen,
  CreditCard,
  ClipboardList,
  FlaskConical,
  Share2,
  Stethoscope,
  HeartPulse,
} from "lucide-react";

/* 🔐 JWT payload decode */
function decodeJwtPayload(token) {
  try {
    if (!token) return null;
    const base64 = token.split(".")[1];
    return JSON.parse(atob(base64.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

export default function Sidebar({ mobileOpen = false, setMobileOpen }) {
  const { role } = useMemo(() => {
    const token =
      localStorage.getItem("token") || sessionStorage.getItem("token");

    const payload = decodeJwtPayload(token) || {};

    return {
      role: String(payload?.role || payload?.userRole || "").toUpperCase(),
    };
  }, []);

  const status = String(
    localStorage.getItem("userStatus") || ""
  ).toLowerCase();

  const isLimited = ["blokeli", "pasif", "askida"].includes(status);

  const isTicariKullanici =
    role === "TICARI_USER" ||
    role === "TICARI_KULLANICI" ||
    role === "COMMERCIAL_USER" ||
    role === "CORPORATE_USER" ||
    role === "FIRM_USER" ||
    role === "ISYERI_HEKIMI";

  const isIsyeriHekimi = role === "ISYERI_HEKIMI";

  const readLockFlags = () => ({
  expired: String(localStorage.getItem("isSubscriptionExpired") || "").toLowerCase() === "true",
  paymentPending: String(localStorage.getItem("isPaymentPending") || "").toLowerCase() === "true",
});

const [lockFlags, setLockFlags] = React.useState(readLockFlags);

React.useEffect(() => {
  const refresh = () => setLockFlags(readLockFlags());

  window.addEventListener("storage", refresh);
  window.addEventListener("subscription:lock-changed", refresh);

  refresh();

  return () => {
    window.removeEventListener("storage", refresh);
    window.removeEventListener("subscription:lock-changed", refresh);
  };
}, []);

const isExpired = !isLimited && lockFlags.expired;

const isPaymentPending =
  !isLimited &&
  !isTicariKullanici &&
  lockFlags.paymentPending;

  const uzmanNavItems = [
    { name: "Ana Sayfa", path: "/panel", icon: Home },

    {
      name: "Belgelerim",
      path: "/panel/belgelerim",
      icon: FolderOpen,
    },

    {
      name: "Belge Paylaşımı",
      path: "/panel/belge-paylasimi",
      icon: Share2,
    },

    {
      name: "Firmalarım",
      path: "/panel/firmalar",
      icon: Building2,
    },

    {
      name: "Risk Değerlendirme",
      path: "/panel/risk-degerlendirme",
      icon: ShieldCheck,
    },

    {
      name: "Acil Durum Planı",
      path: "/panel/acil-durum",
      icon: FileWarning,
    },

    {
      name: "Yıllık Planlar",
      path: "/panel/yillik-planlar",
      icon: CalendarDays,
    },

    {
      name: "Eğitim & Sertifikalar",
      path: "/panel/egitim",
      icon: GraduationCap,
    },

    {
      name: "Talimatlar & KKD",
      path: "/panel/talimatlar",
      icon: BookOpen,
    },

    {
      name: "Defter & Kurul",
      path: "/panel/defter-kurul",
      icon: ClipboardList,
    },

    {
      name: "Periyodik & İş Hijyen Raporları",
      path: "/panel/periyodik-is-hijyen",
      icon: FlaskConical,
    },
  ];

  const hekimNavItems = [
    { name: "Ana Sayfa", path: "/isyeri-hekimi", icon: Home },
    { name: "Belgelerim", path: "/isyeri-hekimi/belgelerim", icon: FolderOpen },
    { name: "Belge Paylaşımı", path: "/isyeri-hekimi/belge-paylasimi", icon: Share2 },
    { name: "Firmalarım", path: "/isyeri-hekimi/firmalar", icon: Building2 },
    { name: "Ek-2", path: "/isyeri-hekimi/ek-2", icon: Stethoscope },
    { name: "Tetkikler", path: "/isyeri-hekimi/tetkikler", icon: HeartPulse },
  ];

  const navItems = isIsyeriHekimi ? hekimNavItems : uzmanNavItems;

  const paymentNavItem = {
    name: "Abonelik / Ödeme",
    path: isIsyeriHekimi ? "/isyeri-hekimi/paket-abonelik" : "/panel/paket-abonelik",
    icon: CreditCard,
  };

  let filteredNavItems = navItems;

  if (isLimited) {
    filteredNavItems = navItems.filter(
      (i) => i.path === (isIsyeriHekimi ? "/isyeri-hekimi" : "/panel")
    );
  } else if (isExpired) {
    filteredNavItems = [
      ...navItems.filter((i) => i.path === (isIsyeriHekimi ? "/isyeri-hekimi" : "/panel")),
      paymentNavItem,
    ];
  } else if (isPaymentPending) {
    filteredNavItems = [
      ...navItems.filter((i) => i.path === (isIsyeriHekimi ? "/isyeri-hekimi" : "/panel")),
      paymentNavItem,
    ];
  }

  return (
    <aside
      className={`bg-[#072039] text-white flex flex-col w-64 min-h-screen fixed md:static top-0 left-0 z-50 transform transition-transform duration-300 ${
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      } md:translate-x-0`}
    >
      {/* MOBİL + PC LOGO */}
      <div className="flex items-center justify-center py-5 border-b border-white/20 px-4">
        <img
          src="/logo-panel.png"
          alt="İSG Panel Logo"
          className="h-16 w-auto object-contain"
        />
      </div>

      <nav className="flex-1 mt-4">
        <ul className="space-y-1 px-2 pb-4">
          {filteredNavItems.map((item) => (
            <li key={item.name}>
              <NavLink
                to={item.path}
                end={item.path === "/panel" || item.path === "/isyeri-hekimi"}
                onClick={() =>
                  setMobileOpen && setMobileOpen(false)
                }
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? "bg-emerald-600 text-white"
                      : "text-gray-200 hover:bg-emerald-700 hover:text-white"
                  }`
                }
              >
                <item.icon className="h-5 w-5 shrink-0" />

                <span className="text-sm font-medium">
                  {item.name}
                </span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
