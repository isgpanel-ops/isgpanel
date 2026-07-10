// src/utils/authHardReset.js
export function hardResetForAuth(email, token, user, redirectTo = "/panel") {
  const newEmail = (email || "").toLowerCase().trim();

  // ✅ helper
  const safeDecodeJwt = (jwtToken) => {
    try {
      if (!jwtToken) return {};
      const payload = jwtToken.split(".")[1];
      if (!payload) return {};
      return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    } catch {
      return {};
    }
  };

  const hasActiveSubscription = (u) => {
    try {
      const endISO =
        u?.subscriptionEnd ||
        u?.subscriptionEndAt ||
        u?.organization?.subscriptionEnd ||
        u?.organization?.subscriptionEndAt ||
        null;

      if (!endISO) return false;

      const end = new Date(endISO);
      if (Number.isNaN(end.getTime())) return false;

      return end.getTime() > Date.now();
    } catch {
      return false;
    }
  };

  // ✅ 0) Seçili firmayı koru
  let preservedSelectedFirm = null;
  try {
    preservedSelectedFirm =
      localStorage.getItem("isgpanel:selectedFirm") ||
      sessionStorage.getItem("isgpanel:selectedFirm") ||
      null;
  } catch {
    preservedSelectedFirm = null;
  }

  // ✅ 1) eski kilit/expired kalıntılarını temizle
  try {
    localStorage.removeItem("isSubscriptionExpired");
    sessionStorage.removeItem("isSubscriptionExpired");
  } catch {}

  // ✅ 2) aktif kullanıcı maili
  try {
    localStorage.setItem("__isg_active_email_global", newEmail);
  } catch {}
  try {
    sessionStorage.setItem("__isg_active_email_global", newEmail);
  } catch {}
  try {
    sessionStorage.setItem("activeUserEmail", newEmail);
  } catch {}

  // ✅ 3) token yaz
  if (token) {
    try {
      sessionStorage.setItem("token", token);
    } catch {}
    try {
      localStorage.setItem("token", token);
    } catch {}

    try {
      localStorage.setItem(`isgpanel:${newEmail}:token`, token);
    } catch {}
    try {
      sessionStorage.setItem(`isgpanel:${newEmail}:token`, token);
    } catch {}
  }

  // ✅ 4) user objesini güncel flaglerle normalize et
  if (user) {
    const jwtPayload = safeDecodeJwt(token);
    const activeSub = hasActiveSubscription(user);
    const userRole = (user?.role || "").toLowerCase().trim();
    const isTicariRole =
      userRole === "ticari_user" || userRole === "ticari_admin";

    const normalizedUser = {
      ...user,
      paymentPending: activeSub
        ? false
        : Boolean(jwtPayload?.paymentPending ?? user?.paymentPending),
      subscriptionLocked: activeSub
        ? false
        : Boolean(jwtPayload?.subscriptionLocked ?? user?.subscriptionLocked),
    };

    const u = JSON.stringify(normalizedUser);

    try {
      sessionStorage.setItem("user", u);
    } catch {}
    try {
      localStorage.setItem("user", u);
    } catch {}

    // ✅ SADECE ticari roller için ticari_user yaz
    if (isTicariRole) {
      try {
        sessionStorage.setItem("ticari_user", u);
      } catch {}
      try {
        localStorage.setItem("ticari_user", u);
      } catch {}
    } else {
      // ✅ bireysel / super_admin girişte eski ticari kalıntısını temizle
      try {
        sessionStorage.removeItem("ticari_user");
      } catch {}
      try {
        localStorage.removeItem("ticari_user");
      } catch {}
    }

    try {
      localStorage.setItem(`isgpanel:${newEmail}:user`, u);
    } catch {}
    try {
      sessionStorage.setItem(`isgpanel:${newEmail}:user`, u);
    } catch {}
  }

  // ✅ 5) namespace değişimi
  if (window.__setActiveUserEmail) {
    window.__setActiveUserEmail(newEmail);
  }

  // ✅ 6) seçili firmayı geri koy
  try {
    if (preservedSelectedFirm) {
      localStorage.setItem("isgpanel:selectedFirm", preservedSelectedFirm);
      sessionStorage.setItem("isgpanel:selectedFirm", preservedSelectedFirm);
    }
  } catch {}

  // ✅ 7) tüm ekranlara refresh sinyali
  try {
    window.dispatchEvent(new Event("token-changed"));
  } catch {}
  try {
    window.dispatchEvent(new Event("ticari_subscription_refresh"));
  } catch {}

  if (user?.role === "super_admin") {
    window.history.replaceState({}, "", redirectTo);
    window.dispatchEvent(new PopStateEvent("popstate"));
    return;
  }

  window.location.replace(redirectTo);
}