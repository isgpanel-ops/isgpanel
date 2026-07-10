// src/components/WelcomeNotificationBoot.jsx
import { useEffect } from "react";
import axios from "axios";

function getToken() {
  const activeEmail = localStorage.getItem("__isg_active_email_global");
  const scopedToken = activeEmail ? localStorage.getItem(`isgpanel:${activeEmail}:token`) : null;

  return (
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    sessionStorage.getItem("accessToken") ||
    localStorage.getItem("authToken") ||
    sessionStorage.getItem("authToken") ||
    scopedToken ||
    ""
  );
}

// Basit “eksik var mı” heuristiği (senin sayfalarına göre geliştiririz)
function isProfileComplete() {
  try {
    const u = JSON.parse(localStorage.getItem("user") || sessionStorage.getItem("user") || "null");
    // minimum kontrol (istersen alanları artırırız)
    return !!(u && (u.name || u.adSoyad || u.email));
  } catch {
    return false;
  }
}

function isCorporateComplete() {
  try {
    // sende kurumsal kimlik nerede tutuluyor bilmiyoruz; örnek localStorage anahtarı
    const k = JSON.parse(localStorage.getItem("kurumsalKimlik") || "null");
    return !!(k && (k.firmaAdi || k.logoUrl || k.logoBase64));
  } catch {
    return false;
  }
}

export default function WelcomeNotificationBoot() {
  useEffect(() => {
    
const API_BASE =
  (import.meta?.env?.VITE_API_URL || "").trim().replace(/\/$/, "") ||
  "https://api.isgpanel.tr";

    const token = getToken();
    if (!token) return;

    const profileComplete = isProfileComplete();
    const corporateComplete = isCorporateComplete();

    axios
      .post(
        `${API_BASE}/api/notifications/welcome-check`,
        { profileComplete, corporateComplete },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      .catch(() => {});
  }, []);

  return null;
}
