import React, { useEffect, useRef, useState, useMemo } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import { LogOut, Bell, ChevronDown, MessageCircle, Menu, X, User } from "lucide-react";
import HelpWidget from "./HelpWidget";

import { useFirmalar } from "../context/FirmaContext";
import { useNotifications } from "../context/NotificationContext.jsx";
import SubscriptionBanner from "./SubscriptionBanner";

/* ✅ JWT payload decode (role okumak için) */
const parseJwt = (token) => {
  try {
    if (!token) return null;
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;

    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
};

export default function PanelLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const [notifOpen, setNotifOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const { firmalar: firms, selectedFirm, setSelectedFirm, logout } = useFirmalar();

  const dropdownRef = useRef(null);
  const bellRef = useRef(null);
  const notifTimerRef = useRef(null);

  const notifCtx = useNotifications() || {};
  const {
    notifications: ctxNotifications = [],
    unreadCount: ctxUnreadCount = 0,
    loading: notifLoading = false,
    markAsRead = () => {},
    markAllAsRead = () => {},
    fetchLatestNotifications = () => {},
  } = notifCtx;

  const notifications = ctxNotifications;
  const unreadCount = ctxUnreadCount;

  const getFirmKey = (firma) =>
    String(
      firma?._id ||
        firma?.id ||
        firma?.firmaId ||
        firma?.sgkSicilNo ||
        firma?.sgkNo ||
        firma?.firmaAdi
    );

  const token =
    localStorage.getItem("token") || sessionStorage.getItem("token");
  const payload = parseJwt(token);

  const roleRaw = String(payload?.role || payload?.userRole || "").toUpperCase();

  const isTicariKullanici =
    roleRaw === "TICARI_USER" ||
    roleRaw === "TICARI_KULLANICI" ||
    roleRaw === "COMMERCIAL_USER" ||
    roleRaw === "CORPORATE_USER" ||
    roleRaw === "FIRM_USER";

  useEffect(() => {
    const t = localStorage.getItem("token") || sessionStorage.getItem("token");
    if (!t) return;

    const API_BASE =
      (import.meta?.env?.VITE_API_URL || "").trim().replace(/\/$/, "") ||
      "https://api.isgpanel.tr";

    const ALLOWED_WHEN_LOCKED = new Set([
      "/panel",
      "/panel/paket-abonelik",
      "/panel/kisisel-bilgiler",
      "/panel/kurumsal-kimlik",
      "/panel/guvenlik-giris",
    ]);

    const isExpiredByEnd = (endISO) => {
  if (!endISO) return false;

  const raw = String(endISO).trim();

  let end;

  // ✅ Sadece tarih geldiyse günü bitimine tamamla
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    end = new Date(`${raw}T23:59:59`);
  } else {
    end = new Date(raw);
  }

  if (Number.isNaN(end.getTime())) return false;

  return Date.now() > end.getTime();
};

    const isPaymentPendingByMe = (me) => {
      try {
        const statusRaw =
          me?.user?.subscription?.status ||
          me?.user?.subscriptionStatus ||
          me?.user?.subscription_state ||
          me?.subscription?.status ||
          me?.subscriptionStatus ||
          me?.subscription_state ||
          me?.user?.planStatus ||
          me?.planStatus ||
          me?.user?.organization?.subscription?.status ||
          me?.user?.organization?.subscriptionStatus ||
          me?.user?.organization?.subscription_state ||
          me?.organization?.subscription?.status ||
          me?.organization?.subscriptionStatus ||
          me?.organization?.subscription_state ||
          "";

        const normalized = String(statusRaw).toLowerCase().trim();

        if (
          [
            "pending",
            "inactive",
            "unpaid",
            "payment_required",
            "waiting_payment",
          ].includes(normalized)
        ) {
          return true;
        }

        const subscriptionEnd =
          me?.user?.subscriptionEnd ||
          me?.user?.subscriptionEndAt ||
          me?.subscriptionEnd ||
          me?.subscriptionEndAt ||
          me?.user?.organization?.subscriptionEnd ||
          me?.user?.organization?.subscriptionEndAt ||
          me?.organization?.subscriptionEnd ||
          me?.organization?.subscriptionEndAt ||
          null;

        if (!isTicariKullanici && !subscriptionEnd) {
          return true;
        }

        return false;
      } catch {
        return false;
      }
    };

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/me`, {
          headers: { Authorization: `Bearer ${t}` },
        });
        if (!res.ok) return;

        const me = await res.json();

        const status = String(me?.user?.status || me?.status || "").toLowerCase();
        localStorage.setItem("userStatus", status);

        const subscriptionEnd =
          me?.user?.subscriptionEnd ||
          me?.user?.subscriptionEndAt ||
          me?.subscriptionEnd ||
          me?.subscriptionEndAt ||
          null;

        const isExpired = isExpiredByEnd(subscriptionEnd);
        const isPaymentPending = !isTicariKullanici && isPaymentPendingByMe(me);

        localStorage.setItem("isSubscriptionExpired", String(isExpired));
        localStorage.setItem("isPaymentPending", String(isPaymentPending));

window.dispatchEvent(new Event("subscription:lock-changed"));     

        if (["blokeli", "pasif", "askida"].includes(status)) {
          if (location.pathname !== "/panel") {
            navigate("/panel", { replace: true });
          }
          return;
        }

        if (isPaymentPending) {
          const p = location.pathname || "/panel";
          if (p.startsWith("/panel") && !ALLOWED_WHEN_LOCKED.has(p)) {
            navigate("/panel/paket-abonelik", { replace: true });
            return;
          }
        }

        if (isExpired) {
          const p = location.pathname || "/panel";
          if (p.startsWith("/panel") && !ALLOWED_WHEN_LOCKED.has(p)) {
            navigate("/panel/paket-abonelik", { replace: true });
          }
        }
      } catch {}
    })();
  }, [navigate, location.pathname, isTicariKullanici]);

  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setUser({ ad: (parsed.ad || "").split(" ")[0] });
      } catch {
        setUser(null);
      }
    }
  }, []);

  useEffect(() => {
    setMobileSidebarOpen(false);

    const mainEl = document.querySelector("main");
    if (mainEl) {
      mainEl.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
      if (bellRef.current && !bellRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };

    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    const timer = setTimeout(() => {
      setMenuOpen(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, [menuOpen]);

  const handleLogout = () => {
    if (typeof logout === "function") logout();
    localStorage.removeItem("user");
    navigate("/giris", { replace: true });
  };

  const normalizeText = (t) => (t || "").toLocaleUpperCase("tr-TR");

  const safeFirms = Array.isArray(firms) ? firms : [];

  const filteredFirms = safeFirms
    .filter(
      (f) =>
        normalizeText(f?.firmaAdi).includes(normalizeText(search)) ||
        normalizeText(f?.sgkNo || f?.sgkSicilNo || "").includes(normalizeText(search))
    )
    .sort((a, b) => (a?.firmaAdi || "").localeCompare(b?.firmaAdi || "", "tr"));

  const sortedFirms = [...safeFirms].sort((a, b) =>
    (a?.firmaAdi || "").localeCompare(b?.firmaAdi || "", "tr")
  );

  const selectedFirmSafe = useMemo(() => {
    if (!selectedFirm) return null;
    const selKey = getFirmKey(selectedFirm);
    const exists = safeFirms.some((f) => getFirmKey(f) === selKey);
    return exists ? selectedFirm : null;
  }, [selectedFirm, safeFirms]);

  useEffect(() => {
    if (!Array.isArray(firms)) return;

    if (selectedFirm && !selectedFirmSafe) {
      setSelectedFirm(null);
    }

    if (safeFirms.length === 0 && selectedFirm) {
      setSelectedFirm(null);
    }
  }, [firms, safeFirms.length, selectedFirm, selectedFirmSafe, setSelectedFirm]);

  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter" && search.trim()) {
      const first = filteredFirms[0];
      if (first) setSelectedFirm(first);
      setSearch("");
    }
  };

  const handleNotificationClick = async (n) => {
    try {
      const isUnread = typeof n.status === "string" ? n.status === "unread" : !n.read;

      if (isUnread && n._id && typeof markAsRead === "function") {
        await markAsRead(n._id);
      }
      if (n.link) navigate(n.link);
      setNotifOpen(false);
    } catch (err) {
      console.error("Bildirim tıklama hatası:", err);
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
    <div className="flex flex-col md:flex-row h-screen bg-gray-100">
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      <div
        className={`fixed top-0 left-0 h-full z-50 transform transition-transform duration-300 md:hidden ${
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="relative h-full">
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(false)}
            className="absolute top-3 right-3 z-[60] p-2 rounded-md bg-white/10 text-white hover:bg-white/20"
            aria-label="Menüyü kapat"
          >
            <X className="h-5 w-5" />
          </button>

          <Sidebar
            mobileOpen={mobileSidebarOpen}
            setMobileOpen={setMobileSidebarOpen}
          />
        </div>
      </div>

      <div className="hidden md:block">
        <Sidebar
          mobileOpen={true}
          setMobileOpen={setMobileSidebarOpen}
        />
      </div>

      <div className="flex-1 flex flex-col w-full min-w-0">
        <header className="h-16 md:h-14 bg-white shadow flex items-center justify-between px-2 md:px-4 border-b gap-2 md:gap-3">
          {/* SOL TARAF */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden inline-flex items-center justify-center h-8 w-8 rounded-md border border-gray-200 text-[#042f4b] hover:bg-gray-50 shrink-0"
              aria-label="Menüyü aç"
            >
              <Menu className="h-4 w-4" />
            </button>

            {/* MOBİL LOGO */}
            <div className="md:hidden flex items-center">
              <img
                src="/isgpanel-logo.png"
                alt="İSG Panel"
                className="h-14 w-auto object-contain"
              />
            </div>

            {/* SADECE PC BAŞLIK */}
            <h1 className="hidden md:block text-sm md:text-base font-semibold text-[#042f4b] truncate">
              İş Sağlığı ve Güvenliği Paneli
            </h1>
          </div>

          {/* SAĞ TARAF */}
          <div className="flex items-center gap-1 md:gap-4 shrink-0">
            <div className="relative hidden md:block">
              <input
                type="text"
                placeholder="FİRMA ARA..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#042f4b] tracking-wide uppercase"
              />

              {search && (
                <div className="absolute z-50 bg-white border rounded shadow-lg w-full max-h-44 overflow-y-auto">
                  {filteredFirms.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-gray-500">Sonuç bulunamadı</div>
                  ) : (
                    filteredFirms.map((firma) => (
                      <button
                        key={getFirmKey(firma)}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100"
                        onClick={() => {
                          setSelectedFirm(firma);
                          setSearch("");
                        }}
                      >
                        <div className="truncate font-medium">{firma?.firmaAdi}</div>
                        {(firma?.sgkNo || firma?.sgkSicilNo) && (
                          <div className="text-[10px] text-gray-500">
                            SGK: {firma?.sgkNo || firma?.sgkSicilNo}
                          </div>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="relative w-24 md:w-56" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen((s) => !s)}
                className="w-full border border-gray-300 rounded px-2 md:px-2 py-1.5 md:py-1 text-left text-[11px] md:text-xs flex items-center justify-between hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-[#042f4b]"
              >
                <span className="truncate">{selectedFirmSafe?.firmaAdi || "Firmalar"}</span>
                <ChevronDown className="h-3.5 w-3.5 md:h-4 md:w-4 text-gray-500 shrink-0 ml-1" />
              </button>

              {dropdownOpen && (
                <div className="absolute mt-1 w-full bg-white border rounded shadow-lg z-50 max-h-52 overflow-y-auto">
                  {sortedFirms.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-gray-500">Kayıt bulunamadı</div>
                  ) : (
                    sortedFirms.map((firma) => (
                      <button
                        key={getFirmKey(firma)}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100"
                        onClick={() => {
                          setSelectedFirm(firma);
                          setDropdownOpen(false);
                        }}
                      >
                        {firma?.firmaAdi}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="relative" ref={bellRef}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setNotifOpen((s) => {
                    const next = !s;
                    if (next) fetchLatestNotifications();
                    return next;
                  });
                }}
                className="relative h-8 w-8 md:h-auto md:w-auto inline-flex items-center justify-center"
              >
                <Bell className="h-4 w-4 md:h-5 md:w-5 text-gray-600 hover:text-[#042f4b]" />
                <span className="absolute top-0 right-0 md:-top-1 md:-right-1 bg-red-500 text-white text-[9px] md:text-xs min-w-[14px] h-[14px] md:h-auto px-1 rounded-full flex items-center justify-center leading-none">
                  {unreadCount || 0}
                </span>
              </button>

              {notifOpen && (
                <div
                  className="absolute right-0 mt-2 w-[calc(100vw-24px)] max-w-80 bg-white border rounded shadow-lg z-50 max-h-72 overflow-y-auto"
                  onMouseEnter={handleNotifMouseEnter}
                  onMouseLeave={handleNotifMouseLeave}
                >
                  <div className="px-3 py-2 border-b flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#042f4b]">Bildirimler&Duyurular</span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (typeof markAllAsRead === "function") markAllAsRead();
                      }}
                      disabled={(unreadCount || 0) === 0}
                      className="text-[11px] text-emerald-600 hover:underline disabled:text-gray-400"
                      title={(unreadCount || 0) === 0 ? "Okunmamış bildirim yok" : "Tümünü okundu yap"}
                    >
                      Tümü okundu
                    </button>
                  </div>

                  {notifLoading ? (
                    <div className="px-3 py-3 text-xs text-gray-500">Yükleniyor...</div>
                  ) : notifications.length === 0 ? (
                    <div className="px-3 py-3 text-xs text-gray-500">Bildirim yok</div>
                  ) : (
                    <ul className="py-1 text-xs">
                      {notifications.map((n) => {
                        const isUnread =
                          typeof n.status === "string" ? n.status === "unread" : !n.read;

                        const timeText =
                          n.time ||
                          (n.createdAt ? new Date(n.createdAt).toLocaleString("tr-TR") : "");

                        return (
                          <li
                            key={n._id || n.id}
                            className="px-3 py-2 hover:bg-gray-50 flex gap-2 cursor-pointer"
                            onClick={() => handleNotificationClick(n)}
                          >
                            <span
                              className={`mt-1 h-2 w-2 rounded-full ${
                                isUnread ? "bg-red-500" : "bg-gray-300"
                              }`}
                            />
                            <div className="flex-1">
                              <div className="text-gray-800">{n.title}</div>
                              {n.message && (
                                <div className="text-[11px] text-gray-600 mt-0.5">
                                  {n.message}
                                </div>
                              )}
                              {timeText && (
                                <div className="text-[10px] text-gray-500 mt-0.5">
                                  {timeText}
                                </div>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => setMenuOpen((s) => !s)}
                className="flex items-center justify-center md:justify-start gap-1 md:gap-2 h-8 min-w-[32px] px-2 md:px-2 py-1 border rounded hover:bg-gray-100 text-[11px] md:text-xs"
              >
                <User className="h-4 w-4 md:hidden text-gray-700" />
                <span className="hidden md:inline font-medium text-gray-700">
                  {user?.ad || "Kullanıcı"}
                </span>
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white border rounded shadow-lg z-50">
                  <ul className="text-sm text-gray-700">
                    <li
                      onClick={() => {
                        navigate("/panel/kisisel-bilgiler");
                        setMenuOpen(false);
                      }}
                      className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                    >
                      Kişisel Bilgiler
                    </li>

                    <li
                      onClick={() => {
                        navigate("/panel/kurumsal-kimlik");
                        setMenuOpen(false);
                      }}
                      className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                    >
                      Kurumsal Kimlik
                    </li>

                    <li
                      onClick={() => {
                        navigate("/panel/guvenlik-giris");
                        setMenuOpen(false);
                      }}
                      className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                    >
                      Güvenlik ve Giriş
                    </li>

                    {(() => {
                      const expiredFlag = String(localStorage.getItem("isSubscriptionExpired") || "").toLowerCase();
                      const isExpired = expiredFlag === "true";

                      const lockedByTicari = isTicariKullanici && !isExpired;

                      return (
                        <li
                          onClick={() => {
                            if (lockedByTicari) return;
                            navigate("/panel/paket-abonelik");
                            setMenuOpen(false);
                          }}
                          className={`px-4 py-2 hover:bg-gray-100 ${
                            lockedByTicari
                              ? "opacity-50 cursor-not-allowed hover:bg-transparent"
                              : "cursor-pointer"
                          }`}
                          title={
                            lockedByTicari
                              ? "Bu alan firma yöneticisi (Admin) tarafından yönetilir."
                              : ""
                          }
                        >
                          Paket ve Abonelik Bilgileri
                          {lockedByTicari && (
                            <div className="text-[11px] text-gray-500 mt-1">
                              Admin tarafından yönetilir
                            </div>
                          )}
                        </li>
                      );
                    })()}

                    <li
                      onClick={() => {
                        handleLogout();
                        setMenuOpen(false);
                      }}
                      className="px-4 py-2 hover:bg-red-100 cursor-pointer flex items-center gap-2 text-red-600"
                    >
                      <LogOut className="h-4 w-4" /> Çıkış
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4">
          <SubscriptionBanner />
          <Outlet />
        </main>

        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          className="fixed bottom-6 right-6 z-[9999] h-12 w-12 rounded-full bg-[#0ea36e] text-white shadow-lg hover:opacity-95 active:scale-[0.99] flex items-center justify-center"
          title="Takıldın mı?"
          aria-label="Takıldın mı? Destek"
        >
          <MessageCircle className="h-6 w-6" />
        </button>

        <HelpWidget
          open={helpOpen}
          onClose={() => setHelpOpen(false)}
          context={{
            path: location.pathname,
            userName: user?.ad || "Kullanıcı",
            selectedFirmName: selectedFirmSafe?.firmaAdi || null,
          }}
        />

        <footer className="border-t bg-white text-center text-[11px] text-gray-500 py-3 leading-relaxed">
          © {new Date().getFullYear()} İSG Panel. Bu yazılım ve arayüzü 5846 sayılı Fikir ve
          Sanat Eserleri Kanunu kapsamında korunmaktadır. Tüm hakları saklıdır.
        </footer>
      </div>
    </div>
  );
}