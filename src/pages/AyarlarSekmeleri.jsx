import React, { useMemo, useState } from "react";

import GuvenlikGiris from "./GuvenlikGiris";
import AbonelikBilgileri from "./AbonelikBilgileri";
import TicariAbonelikBilgileri from "./Ticari/TicariAbonelikBilgileri";

const getToken = () => localStorage.getItem("token");

// ✅ JWT payload decode (kütüphane yok)
function decodeJwtPayload(token) {
  try {
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

export default function AyarlarSekmeleri() {
  const [activeTab, setActiveTab] = useState("guvenlik");

  // ✅ Rolü token’dan oku
  const role = useMemo(() => {
    const payload = decodeJwtPayload(getToken());
    return payload?.role || payload?.userRole || "";
  }, []);

  // 🔧 Senin backend role isimlerin farklıysa buraya ekleyebilirsin
  const isTicariAdmin =
    role === "TICARI_ADMIN" || role === "CORPORATE_ADMIN" || role === "corporate_admin";

  const isTicariKullanici =
    role === "TICARI_KULLANICI" || role === "CORPORATE_USER" || role === "corporate_user";

  const isBireysel = !isTicariAdmin && !isTicariKullanici;

  // ✅ KURAL: Ticari kullanıcı abonelik sekmesine giremez
  const abonelikDisabled = isTicariKullanici;

  const tabs = [
    { key: "guvenlik", label: "Güvenlik & Giriş", disabled: false },
    {
      key: "abonelik",
      label: "Paket & Abonelik",
      disabled: abonelikDisabled,
      disabledHint: "Bu alan firma yöneticisi (Admin) tarafından yönetilir.",
    },
  ];

  return (
    <div className="space-y-4">
      {/* SEKME BAR */}
      <div className="flex gap-1 border-b">
        {tabs.map((t) => {
          const isActive = activeTab === t.key;

          return (
            <button
              key={t.key}
              type="button"
              disabled={t.disabled}
              title={t.disabled ? t.disabledHint : ""}
              onClick={() => {
                if (t.disabled) return; // ✅ TIKLANAMAZ
                setActiveTab(t.key);
              }}
              className={[
                "px-4 py-2 text-sm font-medium rounded-t border",
                isActive ? "bg-white border-b-0" : "bg-gray-100",
                t.disabled
                  ? "text-gray-400 cursor-not-allowed opacity-70"
                  : "text-gray-700 hover:bg-gray-200",
              ].join(" ")}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* İÇERİK */}
      <div className="bg-white p-4 border rounded-b">
        {activeTab === "guvenlik" && <GuvenlikGiris />}

        {activeTab === "abonelik" && (
          <>
            {/* ✅ Ticari kullanıcı URL ile zorlasa bile içerik açılmasın */}
            {isTicariKullanici ? (
              <div className="border rounded-lg p-4 bg-gray-50 text-sm text-gray-700">
                <div className="font-semibold text-[#0a2b45]">🔒 Paket & Abonelik</div>
                <div className="mt-2">
                  Bu alan görüntülenebilir değildir.
                  <br />
                  Paket ve abonelik işlemleri firma yöneticisi (Admin) tarafından yapılır.
                </div>
              </div>
            ) : isTicariAdmin ? (
              <TicariAbonelikBilgileri />
            ) : (
              <AbonelikBilgileri readOnly={false} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
