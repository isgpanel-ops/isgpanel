// src/components/SubscriptionBanner.jsx
import React, { useEffect, useState } from "react";

const PLAN_LABELS = {
  bireysel: "Bireysel Uzman Paketi",
  "ticari-1-3": "Ticari 1-3 Kullanıcı Paketi",
  "ticari-4-5": "Ticari 4-5 Kullanıcı Paketi",
  "ticari-6-10": "Ticari 6-10 Kullanıcı Paketi",
  "ticari-10-15": "Ticari 11-15 Kullanıcı Paketi",
  "ticari-15-20": "Ticari 16-20 Kullanıcı Paketi",
  "ticari-20-25": "Ticari 21-25 Kullanıcı Paketi",
};

function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

function getAuthToken() {
  try {
    return (
      localStorage.getItem("token") ||
      localStorage.getItem("jwt") ||
      localStorage.getItem("accessToken") ||
      localStorage.getItem("authToken")
    );
  } catch {
    return null;
  }
}

function getDaysLeft(subscriptionEnd) {
  if (!subscriptionEnd) return null;

  const end = new Date(subscriptionEnd);
  const today = new Date();

  if (isNaN(end.getTime())) return null;

  end.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  return Math.ceil((end - today) / (1000 * 60 * 60 * 24));
}

function getSubscriptionEnd(user) {
  return (
    user?.subscriptionEnd ||
    user?.subscriptionEndDate ||
    user?.subscriptionExpiresAt ||
    user?.organization?.subscriptionEnd ||
    user?.organization?.subscriptionEndDate ||
    user?.organization?.subscriptionExpiresAt ||
    null
  );
}

export default function SubscriptionBanner() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const localUser =
      readJson("user") ||
      readJson("ticari_user") ||
      readJson("bireysel_user") ||
      readJson("auth_user") ||
      readJson("currentUser");

    setUser(localUser);

    const token = getAuthToken();
    if (!token) return;

    const API_BASE =
      (import.meta.env.VITE_API_URL || "https://api.isgpanel.tr/api")
        .trim()
        .replace(/\/$/, "");

    fetch(`${API_BASE}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;

        const freshUser = data.user || data;
        setUser(freshUser);

        try {
          localStorage.setItem("user", JSON.stringify(freshUser));
        } catch {}
      })
      .catch(() => {});
  }, []);

  if (!user) return null;

  const planCode =
    user.planCode ||
    user.organization?.planCode ||
    "bireysel";

  const subscriptionEnd = getSubscriptionEnd(user);
  const daysLeft = getDaysLeft(subscriptionEnd);
  const planLabel = PLAN_LABELS[planCode] || "Abonelik Paketi";

  try {
    if (typeof daysLeft === "number") {
      localStorage.setItem(
        "isSubscriptionExpired",
        daysLeft <= 0 ? "true" : "false"
      );
    }
  } catch {}

  if (daysLeft === null) {
    return (
      <div className="mb-3 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-2 text-xs text-yellow-800">
        <span className="font-semibold">{planLabel}</span> için abonelik
        tarihiniz henüz tanımlanmamış görünüyor. Ödeme tamamlandıktan sonra
        abonelik bilgileriniz burada görünecektir.
      </div>
    );
  }

  let bg = "";
  let border = "";
  let text = "";
  let message = "";

  if (daysLeft <= 0) {
    bg = "bg-red-50";
    border = "border-red-300";
    text = "text-red-800";
    message = "Abonelik süreniz sona ermiştir. Lütfen aboneliğinizi yenileyin.";
  } else if (daysLeft <= 3) {
    bg = "bg-red-50";
    border = "border-red-300";
    text = "text-red-800";
    message = `Aboneliğinizin bitmesine ${daysLeft} gün kaldı. Hizmet kesintisi yaşamamak için yenileyin.`;
  } else if (daysLeft <= 5) {
    bg = "bg-amber-50";
    border = "border-amber-300";
    text = "text-amber-800";
    message = `Aboneliğinizin bitmesine ${daysLeft} gün kaldı.`;
  } else {
    return null;
  }

  return (
    <div
      className={`mb-3 rounded-lg border px-4 py-2 text-xs ${bg} ${border} ${text}`}
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="font-semibold">{planLabel}</span>
          {subscriptionEnd && (
            <span className="ml-1">
              — Bitiş Tarihi:{" "}
              {new Date(subscriptionEnd).toLocaleDateString("tr-TR")}
            </span>
          )}
        </div>

        <div className="font-medium sm:text-right">{message}</div>
      </div>
    </div>
  );
}