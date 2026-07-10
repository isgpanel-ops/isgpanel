import React, { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  LogOut,
  Bell,
  Menu,
  User,
} from "lucide-react";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";
import { useNotifications } from "../../context/NotificationContext";

const API_BASE =
  (import.meta?.env?.VITE_API_URL || "").trim().replace(/\/$/, "") ||
  "https://api.isgpanel.tr";

const upTR = (s) => (s || "").toLocaleUpperCase("tr-TR");

export default function AdminTopbar({ setMobileOpen }) {
  const [userOptions, setUserOptions] = useState([
    { value: "all", label: "Tüm Kullanıcılar" },
  ]);
  const [selectedValue, setSelectedValue] = useState("all");

  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const menuRef = useRef(null);
  const dropdownRef = useRef(null);
  const notifRef = useRef(null);
  const notifTimerRef = useRef(null);

  const navigate = useNavigate();
  const location = useLocation();

  const { notifications, fetchLatestNotifications, markAsRead } =
    useNotifications();

  const setUserParam = (value) => {
    const p = new URLSearchParams(location.search);
    p.set("u", value || "all");
    p.delete("q");
    navigate(`${location.pathname}?${p.toString()}`, { replace: true });
  };

  const isCommercialNotification = (n) => {
    const m = (n?.module || "").toString().toLowerCase();
    const k = (n?.key || "").toString().toLowerCase();

    if (m === "ticari") return true;
    if (m === "abonelik") return true;
    if (k.startsWith("corp_")) return true;
    if (m === "announcements") return true;
    if (k.startsWith("ann:")) return true;
    if (k.startsWith("panel_offer_")) return true;
    if (m === "genel") return true;

    return false;
  };

  const commercialList = (notifications || []).filter(isCommercialNotification);
  const commercialUnread = commercialList.filter(
    (x) => (x?.status || "unread") === "unread"
  ).length;

  useEffect(() => {
    if (notifOpen) {
      fetchLatestNotifications(100);
    }
  }, [notifOpen, fetchLatestNotifications]);

  useEffect(() => {
    const storedUser =
      localStorage.getItem("user") || sessionStorage.getItem("user");
    const currentUser = storedUser ? JSON.parse(storedUser) : null;
    const token =
      localStorage.getItem("token") || sessionStorage.getItem("token");

    const orgId =
      currentUser?.organization?._id ||
      currentUser?.organization ||
      currentUser?.organizationId ||
      null;

    if (!orgId) return;

    const fetchUsers = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/org/${orgId}/users`, {
          headers: { Authorization: token ? `Bearer ${token}` : "" },
        });

        const users = res.data.users || [];

        const sortedUsers = users
          .filter((u) => {
            const role = (u.role || "").toLowerCase();
            if (!role) return false;
            if (role.includes("admin")) return false;
            return role === "ticari_user";
          })
          .map((u) => ({
            value: (u._id || u.id)?.toString(),
            label: upTR(u.name || ""),
          }))
          .filter((u) => u.value)
          .sort((a, b) =>
            a.label.localeCompare(b.label, "tr", { sensitivity: "base" })
          );

        setUserOptions([
          { value: "all", label: "Tüm Kullanıcılar" },
          ...sortedUsers,
        ]);
      } catch (err) {
        console.error("TOPBAR USER LIST ERROR:", err);
        setUserOptions([{ value: "all", label: "Tüm Kullanıcılar" }]);
      }
    };

    fetchUsers();
  }, []);

  useEffect(() => {
    const p = new URLSearchParams(location.search);
    const u = (p.get("u") || "all").toString();
    setSelectedValue(u);
  }, [location.search]);

  useEffect(() => {
    if (!menuOpen) return;
    const t = setTimeout(() => setMenuOpen(false), 3000);
    return () => clearTimeout(t);
  }, [menuOpen]);

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };

    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, []);

  useEffect(() => {
    return () => {
      if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    navigate("/");
  };

  const goSubscriptionPage = () => {
    setMenuOpen(false);
    navigate("/ticari/admin/abonelik");
  };

  const path = location.pathname || "";

  const isFilterablePage =
    path === "/ticari/admin" ||
    path === "/ticari/admin/" ||
    path === "/ticari/admin/firmalar" ||
    path.startsWith("/ticari/admin/firmalar/") ||
    path === "/ticari/belgeler" ||
    path.startsWith("/ticari/belgeler/") ||
    path === "/ticari/admin/belgeler" ||
    path.startsWith("/ticari/admin/belgeler/");

  const currentSearch = new URLSearchParams(location.search).get("q") || "";

  const setSearchParam = (value) => {
    if (!isFilterablePage) return;

    const p = new URLSearchParams(location.search);
    p.set("u", selectedValue || "all");

    if (value?.trim()) {
      p.set("q", value.trim());
    } else {
      p.delete("q");
    }

    navigate(`${location.pathname}?${p.toString()}`, { replace: true });
  };

  const currentLabel =
    userOptions.find((o) => o.value === selectedValue)?.label ||
    "Tüm Kullanıcılar";

  const markAllRead = async () => {
    const unreadIds = commercialList
      .filter((x) => (x?.status || "unread") === "unread")
      .map((x) => x?._id || x?.id)
      .filter(Boolean);

    if (unreadIds.length === 0) return;

    for (const id of unreadIds) {
      // eslint-disable-next-line no-await-in-loop
      await markAsRead(id);
    }
  };

  const handleNotifMouseEnter = () => {
    if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
  };

  const handleNotifMouseLeave = () => {
    if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
    notifTimerRef.current = setTimeout(() => {
      setNotifOpen(false);
    }, 3000);
  };

  return (
    <>
      {/* MOBİL */}
      <header className="md:hidden h-[72px] bg-white shadow-sm flex items-center justify-between px-2 border-b gap-2">
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setMobileOpen && setMobileOpen(true)}
            className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-gray-200 text-[#042f4b] hover:bg-gray-50 shrink-0"
            aria-label="Menüyü aç"
          >
            <Menu className="h-4 w-4" />
          </button>

          <img
            src="/isgpanel-logo.png"
            alt="İSG Panel"
            className="h-14 w-auto object-contain"
          />
        </div>

        <div className="flex items-center gap-1 shrink-0 min-w-0">
          <div
            className="relative w-[120px] max-w-[120px] shrink-0"
            ref={dropdownRef}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDropdownOpen((v) => !v);
              }}
              className="h-8 w-full px-1.5 rounded-md border border-gray-200 bg-white flex items-center justify-between gap-1"
            >
              <span className="truncate text-[10.5px] text-gray-700">
                {currentLabel}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white border rounded-lg shadow-lg z-50 max-h-72 overflow-y-auto">
                {userOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setSelectedValue(option.value);
                      setUserParam(option.value);
                      setDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                      selectedValue === option.value
                        ? "bg-emerald-50 text-emerald-700"
                        : "text-gray-700"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative shrink-0" ref={notifRef}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setNotifOpen((v) => !v);
              }}
              className="relative h-8 w-8 shrink-0 flex items-center justify-center rounded-md border border-gray-200 bg-white"
              aria-label="Bildirimler"
            >
              <Bell className="h-4 w-4 text-[#042f4b]" />
              {commercialUnread > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-600 text-white text-[11px] font-semibold">
                  {commercialUnread > 9 ? "9+" : commercialUnread}
                </span>
              )}
            </button>

            {notifOpen && (
              <div
                className="absolute right-0 mt-2 w-[calc(100vw-24px)] max-w-80 bg-white border rounded-lg shadow-lg z-50"
                onMouseEnter={handleNotifMouseEnter}
                onMouseLeave={handleNotifMouseLeave}
              >
                <div className="flex items-center justify-between px-3 py-2 border-b">
                  <div className="text-xs font-semibold text-gray-800">
                    Bildirimler & Duyurular
                  </div>
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="text-[11px] text-emerald-700 hover:underline"
                  >
                    Tümünü okundu yap
                  </button>
                </div>

                <div className="max-h-[360px] overflow-y-auto">
                  {commercialList.length === 0 ? (
                    <div className="px-3 py-4 text-xs text-gray-500">
                      Ticari bildirim bulunamadı.
                    </div>
                  ) : (
                    commercialList.map((n) => {
                      const isUnread = (n?.status || "unread") === "unread";
                      const notifId = n?._id || n?.id;

                      return (
                        <button
                          key={notifId || n?.key}
                          type="button"
                          onClick={() => {
                            if (isUnread && notifId) markAsRead(notifId);
                          }}
                          className={`w-full text-left px-3 py-3 border-b hover:bg-gray-50 ${
                            isUnread ? "bg-emerald-50/40" : "bg-white"
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <span
                              className={`mt-1 h-2 w-2 rounded-full shrink-0 ${
                                isUnread ? "bg-red-500" : "bg-gray-300"
                              }`}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-gray-800 break-words">
                                {n?.title || "Bildirim"}
                              </div>
                              {n?.message && (
                                <div className="text-[11px] text-gray-600 mt-1 break-words">
                                  {n.message}
                                </div>
                              )}
                              {n?.createdAt && (
                                <div className="text-[10px] text-gray-500 mt-1">
                                  {new Date(n.createdAt).toLocaleString("tr-TR")}
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="relative shrink-0" ref={menuRef}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
              className="h-8 w-8 shrink-0 flex items-center justify-center rounded-md border border-gray-200 bg-white"
              aria-label="Kullanıcı menüsü"
            >
              <User className="h-4 w-4 text-[#042f4b]" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white border rounded-lg shadow-lg z-50 overflow-hidden">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate("/ticari/admin/kurumsal-kimlik");
                  }}
                  className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 text-gray-700"
                >
                  Kurumsal Kimlik
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate("/ticari/admin/guvenlik");
                  }}
                  className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 text-gray-700"
                >
                  Güvenlik
                </button>

                <button
                  type="button"
                  onClick={goSubscriptionPage}
                  className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 text-gray-700"
                >
                  Abonelik & Ödeme
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-3 text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Çıkış Yap
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* DESKTOP */}
<header className="hidden md:flex h-[54px] bg-white items-center justify-between px-4 border-b">
  <div className="flex items-center min-w-0 pr-3">
    <h1 className="text-[14px] font-semibold text-[#0a2b45] truncate">
      İş Sağlığı ve Güvenliği Paneli
    </h1>
  </div>

  <div className="flex items-center gap-4 shrink-0">
    <div className="relative w-[225px]" ref={dropdownRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setDropdownOpen((s) => !s);
        }}
        className="h-7 w-full border border-gray-300 rounded-md px-3 text-left text-[12px] bg-white flex items-center justify-between hover:bg-gray-50"
      >
        <span className="truncate">{currentLabel}</span>
        <ChevronDown className="h-4 w-4 text-gray-500" />
      </button>

      {dropdownOpen && (
        <div className="absolute right-0 mt-2 w-full bg-white border rounded-lg shadow-lg z-50 max-h-56 overflow-y-auto">
          {userOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setSelectedValue(opt.value);
                setDropdownOpen(false);
                setUserParam(opt.value);
              }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                selectedValue === opt.value
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-gray-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>

    <div className="relative" ref={notifRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
          setNotifOpen((s) => !s);
        }}
        className="relative h-7 w-7 flex items-center justify-center text-gray-700 hover:text-[#042f4b]"
        title="Bildirimler"
      >
        <Bell className="h-[18px] w-[18px]" />
        {commercialUnread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-semibold leading-none">
            {commercialUnread > 9 ? "9+" : commercialUnread}
          </span>
        )}
      </button>

      {notifOpen && (
        <div
          className="absolute right-0 mt-2 w-[380px] bg-white border rounded shadow-lg z-50"
          onMouseEnter={handleNotifMouseEnter}
          onMouseLeave={handleNotifMouseLeave}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <div className="text-sm font-semibold text-gray-800">
              Bildirimler & Duyurular
            </div>
            <button
              type="button"
              onClick={markAllRead}
              className="text-xs text-emerald-700 hover:underline"
            >
              Tümünü okundu yap
            </button>
          </div>

          <div className="max-h-[360px] overflow-y-auto">
            {commercialList.length === 0 ? (
              <div className="px-3 py-4 text-xs text-gray-500">
                Ticari bildirim bulunamadı.
              </div>
            ) : (
              commercialList.map((n) => {
                const isUnread = (n?.status || "unread") === "unread";
                const notifId = n?._id || n?.id;

                return (
                  <button
                    key={notifId || n?.key}
                    type="button"
                    onClick={() => {
                      if (isUnread && notifId) markAsRead(notifId);
                    }}
                    className={`w-full text-left px-3 py-3 border-b hover:bg-gray-50 ${
                      isUnread ? "bg-emerald-50/40" : "bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-xs font-semibold text-gray-800">
                        {n?.title || "Bildirim"}
                      </div>
                      {isUnread && (
                        <span className="text-[10px] px-2 py-[2px] rounded-full bg-emerald-600 text-white">
                          yeni
                        </span>
                      )}
                    </div>

                    {n?.message ? (
                      <div className="mt-1 text-xs text-gray-600 line-clamp-2">
                        {n.message}
                      </div>
                    ) : null}

                    <div className="mt-1 text-[11px] text-gray-400">
                      {n?.createdAt
                        ? new Date(n.createdAt).toLocaleString("tr-TR")
                        : ""}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>

    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen((s) => !s);
        }}
        className="h-7 px-3 border border-gray-300 rounded-md text-[12px] bg-white hover:bg-gray-50 flex items-center gap-2"
      >
        <span>Yönetici</span>
      </button>

      {menuOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white border rounded shadow-lg z-50">
          <ul className="text-sm text-gray-700">
            <li
              onClick={() => {
                navigate("/ticari/admin/kurumsal-kimlik");
                setMenuOpen(false);
              }}
              className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
            >
              Kurumsal Kimlik
            </li>

            <li
              onClick={() => {
                navigate("/ticari/admin/guvenlik");
                setMenuOpen(false);
              }}
              className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
            >
              Güvenlik ve Giriş
            </li>

            <li
              onClick={goSubscriptionPage}
              className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
            >
              Paket ve Abonelik Bilgileri
            </li>

            <li
              onClick={() => {
                handleLogout();
                setMenuOpen(false);
              }}
              className="px-4 py-2 hover:bg-red-100 cursor-pointer text-red-600 flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              Çıkış Yap
            </li>
          </ul>
        </div>
      )}
    </div>
  </div>
</header>
    </>
  );
}