import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  Home,
  FolderOpen,
  Building2,
  ClipboardList,
  FileCheck2,
  Users,
  CreditCard,
} from "lucide-react";

function readTokenFlags() {
  try {
    const t = localStorage.getItem("token") || sessionStorage.getItem("token");
    if (!t) {
      return {
        status: "",
        paymentPending: false,
        subscriptionLocked: false,
      };
    }

    const p = JSON.parse(
      atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
    );

    return {
      status: String(p?.status || "").toLowerCase(),
      paymentPending: p?.paymentPending === true,
      subscriptionLocked: p?.subscriptionLocked === true,
    };
  } catch {
    return {
      status: "",
      paymentPending: false,
      subscriptionLocked: false,
    };
  }
}

function getStoredUserSafe() {
  try {
    const raw =
      localStorage.getItem("user") ||
      sessionStorage.getItem("user") ||
      "null";
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function hasActiveSubscription(user) {
  try {
    const endISO =
      user?.subscriptionEnd ||
      user?.subscriptionEndAt ||
      user?.organization?.subscriptionEnd ||
      user?.organization?.subscriptionEndAt ||
      null;

    if (!endISO) return false;

    const end = new Date(endISO);
    if (Number.isNaN(end.getTime())) return false;

    return end.getTime() > Date.now();
  } catch {
    return false;
  }
}

export default function AdminSidebar({
  mobileOpen = false,
  setMobileOpen,
}) {
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const refresh = () => setRefreshKey((x) => x + 1);

    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("ticari_subscription_refresh", refresh);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("ticari_subscription_refresh", refresh);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const navItems = [
    { name: "Ana Sayfa", path: "/ticari/admin", icon: Home },
    {
      name: "Abonelik & Ödeme",
      path: "/ticari/admin/abonelik",
      icon: CreditCard,
    },
    { name: "Belgeler", path: "/ticari/admin/belgeler", icon: FolderOpen },
    { name: "Firmalar", path: "/ticari/admin/firmalar", icon: Building2 },
    {
      name: "Atama Bekleyen Firmalar",
      path: "/ticari/admin/atama-bekleyen",
      icon: ClipboardList,
    },
    {
      name: "Atama Yönetimi",
      path: "/ticari/admin/atama-yonetimi",
      icon: FileCheck2,
    },
    {
      name: "Kullanıcı Listesi",
      path: "/ticari/admin/kullanicilar",
      icon: Users,
    },
  ];

  const { status, paymentPending, subscriptionLocked } = readTokenFlags();
  const user = getStoredUserSafe();

  const isLimited = ["blokeli", "pasif", "askida"].includes(status);

  const expiredFlag = String(
    localStorage.getItem("isSubscriptionExpired") || ""
  ).toLowerCase();
  const isExpired = expiredFlag === "true";

  const activeSub = hasActiveSubscription(user);

  const isPendingPayment =
    !activeSub && (paymentPending || subscriptionLocked);

  const hideSubscriptionMenu =
    activeSub && !isExpired && !isPendingPayment && !isLimited;

  const filteredNavItems = isLimited
    ? navItems.filter((i) => i.path === "/ticari/admin")
    : isPendingPayment
    ? navItems.filter(
        (i) =>
          i.path === "/ticari/admin" ||
          i.path === "/ticari/admin/abonelik"
      )
    : isExpired
    ? navItems.filter(
        (i) =>
          i.path === "/ticari/admin" ||
          i.path === "/ticari/admin/abonelik"
      )
    : hideSubscriptionMenu
    ? navItems.filter((i) => i.path !== "/ticari/admin/abonelik")
    : navItems;

  return (
    <aside
      key={refreshKey}
      className={`bg-[#072039] text-white flex flex-col w-64 min-h-screen fixed md:static top-0 left-0 z-50 transform transition-transform duration-300 ${
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      } md:translate-x-0`}
    >
      <div className="flex items-center justify-center py-5 border-b border-white/20 px-4">
        <img
          src="/logo-panel.png"
          alt="Logo"
          className="h-16 w-auto object-contain"
        />
      </div>

      <nav className="flex-1 mt-4">
        <ul className="space-y-1 px-2 pb-4">
          {filteredNavItems.map((item) => (
            <li key={item.name}>
              <NavLink
                to={item.path}
                end={item.path === "/ticari/admin"}
                onClick={() => setMobileOpen && setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? "bg-emerald-600 text-white"
                      : "text-gray-200 hover:bg-emerald-700 hover:text-white"
                  }`
                }
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span className="text-sm font-medium">{item.name}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}


