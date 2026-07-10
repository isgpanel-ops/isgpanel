import { useEffect, useState } from "react";
import { useNotifications } from "../../context/NotificationContext";
import { useNavigate } from "react-router-dom";
import { FiBell } from "react-icons/fi";

export default function NotificationBell() {
  const {
    notifications,
    unreadCount,
    loading,
    fetchLatestNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

useEffect(() => {
  async function onPanelOfferRefresh() {
    // panel teklif gönderilince bildirimleri yenile
    await fetchLatestNotifications();
  }

  window.addEventListener("super_inbox_refresh", onPanelOfferRefresh);
  return () =>
    window.removeEventListener("super_inbox_refresh", onPanelOfferRefresh);
}, [fetchLatestNotifications]);

  const toggleOpen = async () => {
    const newState = !open;
    setOpen(newState);
    if (newState) {
      await fetchLatestNotifications();
    }
  };

  const handleClickNotification = async (notif) => {
    if (notif.status === "unread") {
      await markAsRead(notif._id);
    }
    if (notif.link) {
      navigate(notif.link);
    }
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={toggleOpen}
        className="relative flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 transition"
      >
        <FiBell className="text-gray-700 w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 px-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[11px] font-semibold">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg border z-50">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <span className="text-sm font-semibold text-[#0a2b45]">
              Bildirimler
            </span>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-[11px] text-blue-600 hover:underline"
              >
                Tümünü okundu işaretle
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading && (
              <div className="px-3 py-3 text-xs text-gray-500">
                Yükleniyor...
              </div>
            )}

            {!loading && notifications.length === 0 && (
              <div className="px-3 py-3 text-xs text-gray-500">
                Yeni bildiriminiz yok.
              </div>
            )}

            {!loading &&
              notifications.map((notif) => (
                <button
                  key={notif._id}
                  onClick={() => handleClickNotification(notif)}
                  className={`w-full text-left px-3 py-2 text-xs border-b last:border-b-0 hover:bg-gray-50 flex gap-2 ${
                    notif.status === "unread" ? "bg-blue-50" : ""
                  }`}
                >
                  <div
                    className={`w-1 rounded-full mt-0.5 ${
                      notif.severity === "critical"
                        ? "bg-red-500"
                        : notif.severity === "warning"
                        ? "bg-yellow-500"
                        : "bg-green-500"
                    }`}
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-[12px] text-gray-800">
                      {notif.title}
                    </div>
                    <div className="text-[11px] text-gray-600">
                      {notif.message}
                    </div>
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      {new Date(notif.createdAt).toLocaleString("tr-TR")}
                    </div>
                  </div>
                </button>
              ))}
          </div>

          <div className="px-3 py-2 text-[11px] text-right border-t">
            {/* İstersen ayrı Bildirimler sayfasına yönlendirebilirsin */}
            {/* <button
              onClick={() => {
                navigate("/bildirimler");
                setOpen(false);
              }}
              className="text-blue-600 hover:underline"
            >
              Tüm bildirimleri gör
            </button> */}
          </div>
        </div>
      )}
    </div>
  );
}
