// src/pages/OdemeSonuc.jsx
import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import PLANS from "../data/plans";

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

export default function OdemeSonuc() {
  const query = useQuery();
  const navigate = useNavigate();

  const plan = query.get("plan"); // örn: bireysel, ticari-1-3
  const orgId = query.get("org"); // organizasyon id (şimdilik sadece bilgi)

  // ✅ panel içi ödeme işareti (panel=1 veya from=panel)
  const isPanelPayment = query.get("panel") === "1" || query.get("from") === "panel";

  // ✅ FIX: Yeni kayıt/ilk aktivasyon ise (org paramı varsa) login CTA görünsün
  const isFirstActivation = !!orgId;

  // ✅ Login butonu ne zaman görünsün?
  const showLoginCta = !isPanelPayment || isFirstActivation;

  // ✅ panel içi dönüş yolu (opsiyonel)
  const returnUrl =
    query.get("returnUrl") || (isPanelPayment ? "/ticari/admin/abonelik-odemeler" : null);

  const selectedPlan = plan ? PLANS[plan] : null;
  const isTicari = plan && (plan.includes("ticari") || plan === "prof-ozel");

  // ✅ ÖDEME SONUCU AÇILINCA: “aboneliği yenile” sinyali bırak
  useEffect(() => {
    try {
      localStorage.setItem("subscription_refetch_needed", "1");
    } catch {}

    try {
      window.dispatchEvent(new Event("subscription_refetch_needed"));
    } catch {}
  }, []);

  const handleGoLogin = () => {
    if (isTicari) {
      navigate("/login/kurumsal", { replace: true });
    } else {
      navigate("/login/uzman", { replace: true });
    }
  };

  const handleGoPanel = () => {
    navigate(returnUrl || "/", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md text-center">
        <h1 className="text-2xl font-semibold mb-2 text-emerald-600">Ödeme Başarılı</h1>

        {selectedPlan && (
          <p className="text-sm text-gray-700 mb-1">
            Paket: <span className="font-medium">{selectedPlan.label}</span>
          </p>
        )}

        {orgId && (
          <p className="text-xs text-gray-500 mb-4">
            Hesap No (Org ID): {orgId}
          </p>
        )}

        <p className="text-sm text-gray-600">
          {isPanelPayment
            ? isTicari
              ? "Kurumsal aboneliğiniz başarıyla güncellendi."
              : "Bireysel aboneliğiniz başarıyla güncellendi."
            : "Aboneliğiniz başarıyla aktifleştirildi. Şimdi panele giriş yaparak kullanmaya başlayabilirsiniz."}
        </p>

        {showLoginCta && (
          <div className="mt-6">
            <button
              onClick={handleGoLogin}
              className="w-full py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold mb-3"
            >
              Panele Giriş Yap
            </button>

            <button
              onClick={() => navigate("/", { replace: true })}
              className="w-full py-2 rounded-md border text-sm text-gray-700 hover:bg-gray-50"
            >
              Ana Sayfaya Dön
            </button>
          </div>
        )}
      </div>
    </div>
  );
}