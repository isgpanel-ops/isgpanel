import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bell, User, ChevronDown, Menu } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useNotifications } from "./context/NotificationContext.jsx";
import ConfirmModal from "./components/ui/ConfirmModal";

// ✅ tek doğru route haritası
const ROUTES = {
  firmalar: "/panel/firmalar",
  egitim: "/panel/egitim",
  yillikPlanlar: "/panel/yillik-planlar",
  kisiselBilgiler: "/panel/kisisel-bilgiler",
};

function normalizeLink(raw) {
  const link = (raw || "").trim();
  if (!link) return "";

  // zaten /panel/... ise dokunma
  if (link.startsWith("/panel/")) return link;

  // kısa alias kabul et
  if (link === "/firmalar" || link === "firmalar") return ROUTES.firmalar;
  if (link === "/egitim" || link === "egitim") return ROUTES.egitim;
  if (link === "/yillik-planlar" || link === "yillik-planlar") return ROUTES.yillikPlanlar;
  if (link === "/kisisel-bilgiler" || link === "kisisel-bilgiler") return ROUTES.kisiselBilgiler;

  // /panel’siz ama slash’li geldiyse panel’e tak
  if (link.startsWith("/")) return `/panel${link}`;

  return "";
}

function resolveNotifId(n) {
  // backend farklı isimlerde dönebiliyor: _id, id, notificationId...
  return n?._id || n?.id || n?.notificationId || null;
}

function resolveCreatedAt(n) {
  return n?.createdAt || n?.date || n?.created_at || null;
}

function resolveRead(n) {
  // status: "unread" / "read" / ...
  if (typeof n?.status === "string") return n.status !== "unread";
  // boolean alanlar: read / isRead
  if (typeof n?.read === "boolean") return n.read;
  if (typeof n?.isRead === "boolean") return n.isRead;
  // fallback: okunmamış varsay
  return false;
}

export default function Topbar({
  title = "İSG Panel",
  subtitle = "",
  onMenuClick,
}) {
  const navigate = useNavigate();

  const bellRef = useRef(null);
  const userRef = useRef(null);

  const [openBell, setOpenBell] = useState(false);
  const [openUser, setOpenUser] = useState(false);

  // ✅ 3 sn mouse-leave auto-close timer’ları
  const bellTimerRef = useRef(null);
  const userTimerRef = useRef(null);

  // ✅ popup state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalPayload, setModalPayload] = useState({
    title: "Bilgilendirme",
    message: "",
    link: "",
    variant: "info",
    notifId: null,
  });

  const {
    notifications,
    unreadCount,
    loading,
    fetchLatestNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  const uiNotifications = useMemo(() => {
    return (notifications || [])
      .map((n) => {
        const resolvedId = resolveNotifId(n);
        const titleText = n?.title || "Bildirim";
        const isWelcome =
          (n?.key && String(n.key).startsWith("welcome:")) ||
          String(titleText).toLowerCase().includes("hoş geldiniz");

        const messageText = isWelcome
          ? "Paneli tam verimli kullanabilmek için kişisel bilgileriniz ve kurumsal bilgilerinizi doldurunuz."
          : n?.message || "";

        const createdAt = resolveCreatedAt(n);
        const timeText = createdAt ? new Date(createdAt).toLocaleString("tr-TR") : "";

        return {
          id: resolvedId,
          title: titleText,
          message: messageText,
          time: timeText,
          read: resolveRead(n),
          severity: n?.severity || "info",
          link: normalizeLink(n?.link),
          raw: n,
        };
      })
      .filter((n) => !!n.id);
  }, [notifications]);

  const safeUnreadCount = useMemo(() => {
    if (typeof unreadCount === "number") return unreadCount;
    return uiNotifications.filter((n) => !n.read).length;
  }, [unreadCount, uiNotifications]);

  // ✅ Bildirim menüsü açılınca tazele (+ açıkken periyodik refresh)
  useEffect(() => {
    let intervalId = null;

    if (openBell) {
      fetchLatestNotifications?.();

      intervalId = setInterval(() => {
        fetchLatestNotifications?.();
      }, 30000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openBell]);

  // ✅ dışarı tıklayınca kapat
  useEffect(() => {
    function handleClickOutside(e) {
      if (bellRef.current && !bellRef.current.contains(e.target)) setOpenBell(false);
      if (userRef.current && !userRef.current.contains(e.target)) setOpenUser(false);
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    navigate("/giris");
  };

  const openPopup = (n) => {
    setModalPayload({
      title: n.title,
      message: n.message,
      link: "",
      variant: n.severity === "critical" ? "warning" : "info",
      notifId: n.id,
    });
    setModalOpen(true);
  };

  const onNotifClick = async (n) => {
    if (bellTimerRef.current) clearTimeout(bellTimerRef.current);

    if (!n.read && n.id) {
      try {
        await markAsRead?.(n.id);
      } catch (err) {}
    }

    setOpenBell(false);

    if (n.link) {
      navigate(n.link);
    } else {
      localStorage.setItem(`notifPopupShown:${n.id}`, "1");
      openPopup(n);
    }
  };

  // ✅ Tümü okundu
  const handleMarkAllRead = async (e) => {
    e.stopPropagation();
    if (bellTimerRef.current) clearTimeout(bellTimerRef.current);
    try {
      await markAllAsRead?.();
    } catch (err) {}
  };

  const closeModal = async () => {
    if (modalPayload?.notifId) {
      try {
        await markAsRead?.(modalPayload.notifId);
      } catch (err) {}
    }
    setModalOpen(false);
    setModalPayload({
      title: "Bilgilendirme",
      message: "",
      link: "",
      variant: "info",
      notifId: null,
    });
  };

  return (
    <>
      <div className="w-full bg-white border-b px-3 md:px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            type="button"
            onClick={onMenuClick}
            className="md:hidden inline-flex items-center justify-center p-2 rounded-md border border-gray-200 text-[#042f4b] hover:bg-gray-50 shrink-0"
            title="Menü"
            aria-label="Menüyü aç"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex flex-col min-w-0 flex-1">
            <div className="text-base md:text-lg font-semibold text-gray-800 truncate">
              {title}
            </div>
            {subtitle && (
              <div className="text-[11px] md:text-xs text-gray-500 truncate">
                {subtitle}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          {/* 🔔 Bildirimler */}
          <div className="relative" ref={bellRef}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpenBell((s) => !s);
                setOpenUser(false);
              }}
              className="relative p-2 rounded hover:bg-gray-100 shrink-0"
              title="Bildirimler"
            >
              <Bell className="w-5 h-5 text-gray-700" />
              {safeUnreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] min-w-[16px] h-[16px] px-1 rounded-full flex items-center justify-center">
                  {safeUnreadCount > 99 ? "99+" : safeUnreadCount}
                </span>
              )}
            </button>

            {openBell && (
  <div
    className="fixed md:absolute top-16 right-3 md:top-auto md:right-0 left-3 md:left-auto mt-0 md:mt-2 w-auto md:w-[420px] bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-[70vh] overflow-hidden"
    onClick={(e) => e.stopPropagation()}
    onMouseEnter={() => {
      if (bellTimerRef.current) clearTimeout(bellTimerRef.current);
    }}
    onMouseLeave={() => {
      if (bellTimerRef.current) clearTimeout(bellTimerRef.current);
      bellTimerRef.current = setTimeout(() => setOpenBell(false), 3000);
    }}
  >
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                  <div className="text-sm font-semibold text-gray-800">Bildirimler</div>

                  <button
                    type="button"
                    className="text-sm text-emerald-600 hover:underline disabled:text-gray-400"
                    disabled={uiNotifications.length === 0 || safeUnreadCount === 0}
                    onClick={handleMarkAllRead}
                    title={safeUnreadCount === 0 ? "Okunmamış bildirim yok" : "Tümünü okundu işaretle"}
                  >
                    Tümü okundu
                  </button>
                </div>

                <div className="max-h-[60vh] overflow-y-auto">
                  {loading ? (
                    <div className="px-4 py-4 text-sm text-gray-500">Yükleniyor...</div>
                  ) : uiNotifications.length === 0 ? (
                    <div className="px-4 py-4 text-sm text-gray-500">Bildirim bulunmuyor.</div>
                  ) : (
                    uiNotifications.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onNotifClick(n);
                        }}
                        className="w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50"
                      >
                        <div className="text-sm font-semibold text-gray-800">{n.title}</div>

                        {n.message ? (
                          <div className="mt-1 text-sm text-gray-600">{n.message}</div>
                        ) : null}

                        {n.time ? (
                          <div className="mt-1 text-xs text-gray-400">{n.time}</div>
                        ) : null}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 👤 Kullanıcı */}
          <div className="relative" ref={userRef}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpenUser((s) => !s);
                setOpenBell(false);
              }}
              className="flex items-center gap-1 md:gap-2 px-2 py-1 rounded hover:bg-gray-100 shrink-0"
              title="Hesap"
            >
              <User className="w-5 h-5 text-gray-700" />
              <ChevronDown className="w-4 h-4 text-gray-500" />
            </button>

            {openUser && (
              <div
                className="absolute right-0 mt-2 w-48 md:w-56 bg-white border shadow-lg rounded z-50"
                onClick={(e) => e.stopPropagation()}
                onMouseEnter={() => {
                  if (userTimerRef.current) clearTimeout(userTimerRef.current);
                }}
                onMouseLeave={() => {
                  if (userTimerRef.current) clearTimeout(userTimerRef.current);
                  userTimerRef.current = setTimeout(() => setOpenUser(false), 3000);
                }}
              >
                <button
                  type="button"
                  className="w-full px-3 py-2 text-sm hover:bg-gray-50 text-left"
                  onClick={() => navigate("/panel/kisisel-bilgiler")}
                >
                  Profil
                </button>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-sm hover:bg-gray-50 text-left text-red-600"
                  onClick={handleLogout}
                >
                  Çıkış Yap
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        open={modalOpen}
        title={modalPayload.title}
        message={modalPayload.message}
        variant={modalPayload.variant}
        confirmText="Tamam"
        cancelText=""
        onConfirm={closeModal}
        onCancel={closeModal}
      />
    </>
  );
}