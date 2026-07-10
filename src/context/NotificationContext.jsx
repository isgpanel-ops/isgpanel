import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";

const NotificationContext = createContext(null);

function getToken() {
  return localStorage.getItem("token") || sessionStorage.getItem("token") || "";
}

export default function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const API_BASE =
    (import.meta?.env?.VITE_API_URL || "").trim().replace(/\/$/, "") ||
    "https://api.isgpanel.tr";

  const api = useMemo(() => {
    const instance = axios.create({
      baseURL: API_BASE,
    });

    instance.interceptors.request.use((config) => {
      const token = getToken();
      if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    return instance;
  }, [API_BASE]);

  const recomputeUnread = (list) => {
    setUnreadCount((list || []).filter((n) => n.status === "unread").length);
  };

  const fetchUnreadCount = async () => {
    try {
      const res = await api.get(`/api/notifications/unread-count`);
      setUnreadCount(res.data?.count || 0);
    } catch (err) {
      if (err?.response?.status === 401) {
        setUnreadCount(0);
        return;
      }
      console.error("Unread count error:", err);
    }
  };

  const fetchLatestNotifications = async (limit = 30) => {
    try {
      setLoading(true);
      const res = await api.get(`/api/notifications?limit=${limit}`);

      const raw = res.data;
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.notifications)
          ? raw.notifications
          : Array.isArray(raw?.data)
            ? raw.data
            : [];

      setNotifications(list);
      recomputeUnread(list);
    } catch (err) {
      if (err?.response?.status === 401) {
        setNotifications([]);
        setUnreadCount(0);
        return;
      }
      console.error("Fetch notifications error:", err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id) => {
    const sid = String(id || "");
    if (!sid) return;

    try {
      await api.patch(`/api/notifications/${sid}/read`);
      setNotifications((prev) => {
        const updated = (prev || []).map((n) => {
          const nid = String(n?._id || n?.id || "");
          return nid === sid ? { ...n, status: "read" } : n;
        });
        recomputeUnread(updated);
        return updated;
      });
    } catch (err) {
      console.error("Mark as read error:", err?.response?.status, err?.response?.data || err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.patch(`/api/notifications/read-all`);
      setNotifications((prev) => {
        const updated = (prev || []).map((n) => ({ ...n, status: "read" }));
        return updated;
      });
      setUnreadCount(0);
    } catch (err) {
      console.error("Mark all error:", err);
    }
  };

  useEffect(() => {
    const pathname = window.location.pathname || "";

    const isPublicAuthPage =
      pathname.startsWith("/login") ||
      pathname.startsWith("/register") ||
      pathname.startsWith("/forgot-password") ||
      pathname.startsWith("/reset-password");

    if (isPublicAuthPage) return;

    const token = getToken();
    if (!token) return;

    let payload = null;
    try {
      const tokenParts = token.split(".");
      if (tokenParts.length < 2) return;

      payload = JSON.parse(
        atob(tokenParts[1].replace(/-/g, "+").replace(/_/g, "/"))
      );
    } catch {
      return;
    }

    if (payload?.status === "blokeli") return;
    if (!payload?.id && !payload?.email) return;

    fetchLatestNotifications();
    fetchUnreadCount();

    const interval = setInterval(() => {
      fetchLatestNotifications();
      fetchUnreadCount();
    }, 15 * 1000);

    return () => clearInterval(interval);
  }, []);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      loading,
      fetchLatestNotifications,
      fetchUnreadCount,
      markAsRead,
      markAllAsRead,
    }),
    [notifications, unreadCount, loading]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within <NotificationProvider />");
  return ctx;
}