// AdminLayout.jsx  ✅ (mevcut yapıyı koruyarak) TAM KOD
import React, { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";

import AdminSidebar from "./AdminSidebar";
import AdminTopbar from "./AdminTopbar";
import SubscriptionBanner from "../SubscriptionBanner";

// ✅ EKLENDİ: Bildirim context'i Admin panelde çalışsın
import NotificationProvider from "../../context/NotificationContext";

function readStatus() {
  try {
    const t = localStorage.getItem("token") || sessionStorage.getItem("token");
    if (!t) return "";
    const p = JSON.parse(
      atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
    );
    return String(p?.status || "").toLowerCase();
  } catch {
    return "";
  }
}

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  // ✅ MOBİL SIDEBAR STATE
  const [mobileOpen, setMobileOpen] = useState(false);

  // ✅ API’den abonelik expired state’i
  const [expired, setExpired] = useState(false);

  // ✅ 0) Açılışta /api/subscription/me ile expired çek
  useEffect(() => {
    let cancelled = false;

    async function fetchExpired() {
      try {
        const t =
          localStorage.getItem("token") || sessionStorage.getItem("token");
        if (!t) return;

        const { data } = await axios.get("/api/subscription/me", {
          headers: { Authorization: `Bearer ${t}` },
        });

        const isExpired =
          Boolean(data?.subscription?.isExpired) ||
          Boolean(data?.isSubscriptionExpired);

        if (!cancelled) setExpired(isExpired);

        try {
          localStorage.setItem(
            "isSubscriptionExpired",
            isExpired ? "true" : "false"
          );
        } catch (_) {}
      } catch (e) {
        // sessiz geç
      }
    }

    fetchExpired();
    return () => {
      cancelled = true;
    };
  }, []);

  // ✅ Sayfa değişince main'i en üste al
  useEffect(() => {
    const mainEl = document.querySelector("main");
    if (mainEl) mainEl.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname]);

  // ✅ Mobilde route değişince sidebar kapansın
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, location.search]);

  // 🔒 ADMIN KİLİT
  useEffect(() => {
    const status = readStatus();
    const isLimited = ["blokeli", "pasif", "askida"].includes(status);
    const isExpired = expired === true;

    const allowedPaths = [
      "/ticari/admin",
      "/ticari/admin/kurumsal-kimlik",
      "/ticari/admin/guvenlik",
      "/ticari/admin/abonelik",
    ];

    const isAllowedPath = allowedPaths.some(
      (p) => location.pathname === p || location.pathname.startsWith(`${p}/`)
    );

    if ((isLimited || isExpired) && !isAllowedPath) {
      navigate("/ticari/admin", { replace: true });
    }
  }, [location.pathname, navigate, expired]);

  // ✅ Son kalınan sayfayı hatırla
  useEffect(() => {
    try {
      const full = location.pathname + location.search;
      localStorage.setItem("admin:lastPath", full);
    } catch (_) {}
  }, [location.pathname, location.search]);

  // ✅ Kök sayfaya gelince son sekmeye yönlendir
  useEffect(() => {
    const status = readStatus();
    const isLimited = ["blokeli", "pasif", "askida"].includes(status);

    if (isLimited || expired) return;

    try {
      const last = localStorage.getItem("admin:lastPath");
      const current = location.pathname + location.search;

      const roots = new Set([
        "/admin",
        "/admin/",
        "/ticari",
        "/ticari/",
        "/ticari/admin",
        "/ticari/admin/",
      ]);

      if (roots.has(location.pathname) && last && last !== current) {
        navigate(last, { replace: true });
      }
    } catch (_) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expired]);

  return (
    <NotificationProvider>
      <div className="flex h-screen bg-gray-100 overflow-hidden">
        {mobileOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-40 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        <AdminSidebar
          mobileOpen={mobileOpen}
          setMobileOpen={setMobileOpen}
        />

        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          {/* ✅ TEK TOPBAR */}
          <AdminTopbar setMobileOpen={setMobileOpen} />

          <main className="flex-1 overflow-y-auto min-h-0">
            <SubscriptionBanner />
            <Outlet />
          </main>

          <footer className="border-t bg-white text-center text-[11px] text-gray-500 py-3 leading-relaxed">
            © {new Date().getFullYear()} İSG Panel. Bu yazılım ve arayüzü 5846
            sayılı Fikir ve Sanat Eserleri Kanunu kapsamında korunmaktadır. Tüm
            hakları saklıdır.
          </footer>
        </div>
      </div>
    </NotificationProvider>
  );
}