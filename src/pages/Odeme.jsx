// src/pages/Odeme.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import PLANS from "../data/plans";

const API_BASE = "https://api.isgpanel.tr";
const KDV_ORANI = 0.20;

function getToken() {
  return localStorage.getItem("token") || sessionStorage.getItem("token") || "";
}

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

function toTitleCaseTR(value) {
  return String(value || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/(^|\s|\.|,|-|\/)\S/g, (letter) =>
      letter.toLocaleUpperCase("tr-TR")
    );
}

function onlyDigits(value, max) {
  return String(value || "").replace(/\D/g, "").slice(0, max);
}

export default function Odeme() {
  const query = useQuery();
  const navigate = useNavigate();

  const plan = query.get("plan");
  const period = query.get("period") || "Aylık";
  const agreementsOk = query.get("agreements") === "1";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [billingInfo, setBillingInfo] = useState({
    type: "kurumsal",
    title: "",
    taxNumber: "",
    taxOffice: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    district: "",
  });

  const [iyzicoFormHtml, setIyzicoFormHtml] = useState("");

  const [checkout, setCheckout] = useState(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");

  const orgUuid = query.get("org");
  const offerTokenRaw = query.get("token");
  const offerToken =
    offerTokenRaw && offerTokenRaw.trim() ? offerTokenRaw.trim() : null;

  const usersQ = query.get("users");
  const usersCountResolved = Number(usersQ || checkout?.usersCount || 0);

  const amountQ = Number(query.get("amount") || 0);
  const carryOverDaysQ = Number(query.get("carryOverDays") || 0);

  const isUUID = (s) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      String(s || "")
    );

  const selectedPlan = plan ? PLANS[plan] : null;
  const isOfferFlow = plan === "prof-ozel" || !!offerToken;

  const baseMonthly = Number(selectedPlan?.price || 0);

  const priceTRY =
    amountQ > 0
      ? amountQ
      : isOfferFlow
      ? Number(checkout?.amountTRY || 0)
      : period === "Yıllık"
      ? baseMonthly * 10
      : baseMonthly;

  const displayPriceTRY =
    amountQ > 0 || isOfferFlow
      ? Math.round(priceTRY)
      : Math.round(priceTRY * (1 + KDV_ORANI));

  const planLabel = useMemo(() => {
    if (selectedPlan?.label) return selectedPlan.label;
    if (plan === "kurumsal") return "Kurumsal Paket";
    if (plan) return `Seçili Paket: ${plan}`;
    return "Seçili Paket";
  }, [selectedPlan, plan]);

  useEffect(() => {
    (async () => {
      if (!isOfferFlow) {
        setCheckoutLoading(false);
        setCheckoutError("");
        setCheckout({ amountTRY: 0, usersCount: 0 });
        return;
      }

      try {
        setCheckoutLoading(true);
        setCheckoutError("");

        const res = await axios.get(
          `${API_BASE}/api/checkout/${orgUuid}${
            offerToken ? `?token=${encodeURIComponent(offerToken)}` : ""
          }`,
          { headers: { Authorization: `Bearer ${getToken()}` } }
        );

        setCheckout(res.data);
      } catch (e) {
        console.error("CHECKOUT ERROR:", e?.response?.status, e?.response?.data);
        setCheckoutError(
          e?.response?.data?.message || "❌ Teklif tutarı alınamadı."
        );
      } finally {
        setCheckoutLoading(false);
      }
    })();
  }, [orgUuid, offerToken, isOfferFlow]);

  const updateBilling = (key, value) => {
    let nextValue = value;

    if (["title", "taxOffice", "address", "city", "district"].includes(key)) {
      nextValue = toTitleCaseTR(value);
    }

    if (key === "taxNumber") {
      nextValue =
        billingInfo.type === "kurumsal"
          ? onlyDigits(value, 10)
          : onlyDigits(value, 11);
    }

    if (key === "phone") {
      nextValue = onlyDigits(value, 11);
    }

    setBillingInfo((prev) => ({
      ...prev,
      [key]: nextValue,
    }));
  };

  const changeBillingType = (type) => {
    setBillingInfo((prev) => ({
      ...prev,
      type,
      title: "",
      taxNumber: "",
      taxOffice: type === "kurumsal" ? prev.taxOffice : "",
    }));
  };

  const billingRequiredOk = () => {
    const b = billingInfo || {};

    if (!b.title?.trim()) return false;
    if (!b.taxNumber?.trim()) return false;
    if (!b.email?.trim()) return false;
    if (!b.phone?.trim()) return false;
    if (!b.address?.trim()) return false;
    if (!b.city?.trim()) return false;
    if (!b.district?.trim()) return false;

    if (b.type === "kurumsal") {
      if (!b.taxOffice?.trim()) return false;
      if (String(b.taxNumber).length !== 10) return false;
    }

    if (b.type === "bireysel") {
      if (String(b.taxNumber).length !== 11) return false;
    }

    if (String(b.phone).length < 10 || String(b.phone).length > 11) {
      return false;
    }

    return true;
  };

  const handlePayment = async () => {
    try {
      setLoading(true);
      setError("");
      setIyzicoFormHtml("");

      const typeQ = (query.get("type") || "").toUpperCase();
      const resolvedType =
        typeQ === "NEW" ||
        typeQ === "UPGRADE" ||
        typeQ === "ADD_USERS" ||
        typeQ === "OFFER"
          ? typeQ
          : isOfferFlow
          ? "OFFER"
          : "NEW";

      const res = await axios.post(
        `${API_BASE}/api/billing/iyzico/init`,
        {
          type: resolvedType,
          organizationId: orgUuid,
          planCode: plan,
          period,
          token: offerToken || null,
          usersCount: usersCountResolved,
          amount: Number(displayPriceTRY || 0),
          carryOverDays: carryOverDaysQ,
          isRenewal: carryOverDaysQ > 0,
          billingInfo: {
            ...billingInfo,
            type: String(billingInfo.type || "kurumsal").toLowerCase(),
          },
        },
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );

      if (res.data?.paymentPageUrl) {
        window.location.href = res.data.paymentPageUrl;
        return;
      }

      if (res.data?.checkoutFormContent) {
        setIyzicoFormHtml(res.data.checkoutFormContent);
        return;
      }

      throw new Error("İyzico başlatılamadı (checkout içeriği gelmedi).");
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Ödeme başlatılamadı."
      );
    } finally {
      setLoading(false);
    }
  };

  const canPay =
    agreementsOk &&
    billingRequiredOk() &&
    !loading &&
    !checkoutLoading &&
    !checkoutError &&
    priceTRY > 0;

  if (!orgUuid) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl bg-white shadow-lg border border-red-100 p-5 text-center">
          <div className="text-red-600 font-semibold">
            ❌ Hatalı yönlendirme. org parametresi zorunludur.
          </div>
        </div>
      </div>
    );
  }

  if (!isUUID(orgUuid)) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl bg-white shadow-lg border border-red-100 p-5 text-center">
          <div className="text-red-600 font-semibold">
            ❌ Hatalı yönlendirme. org parametresi UUID olmalı.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-emerald-50 px-4 py-6">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-5 text-center">
          <div className="inline-flex items-center justify-center rounded-full bg-emerald-100 text-emerald-700 px-3 py-1 text-[11px] font-bold mb-2">
            Güvenli Ödeme
          </div>

          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900">
            Ödeme İşlemi
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Aboneliğinizi tamamlamak için fatura bilgilerinizi eksiksiz giriniz.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_370px] gap-5 items-start">
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-4 md:p-6">
            <div className="mb-4 border-b border-slate-200 pb-4">
              <h2 className="text-lg font-bold text-slate-900">
                Fatura Bilgileri
              </h2>

              <p className="text-xs text-slate-500 mt-1">
                Faturanız aşağıdaki bilgiler esas alınarak düzenlenecektir.
              </p>
            </div>

            <form className="space-y-3 text-left">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Fatura Tipi *
                </label>

                <select
                  value={billingInfo.type}
                  onChange={(e) => changeBillingType(e.target.value)}
                  className="w-full h-10 rounded-lg border border-slate-300 px-3 bg-white text-sm text-slate-800 outline-none transition focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="kurumsal">Kurumsal</option>
                  <option value="bireysel">Bireysel</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  {billingInfo.type === "kurumsal"
                    ? "Firma Ünvanı *"
                    : "Ad Soyad *"}
                </label>

                <input
                  type="text"
                  placeholder={
                    billingInfo.type === "kurumsal"
                      ? "Örn: ISG Panel Yazılım Ltd. Şti."
                      : "Ad Soyad"
                  }
                  value={billingInfo.title}
                  onChange={(e) => updateBilling("title", e.target.value)}
                  className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-800 outline-none transition focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              <div
                className={
                  billingInfo.type === "kurumsal"
                    ? "grid grid-cols-1 md:grid-cols-2 gap-3"
                    : "grid grid-cols-1 gap-3"
                }
              >
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    {billingInfo.type === "kurumsal"
                      ? "Vergi Numarası *"
                      : "T.C. Kimlik Numarası *"}
                  </label>

                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={billingInfo.type === "kurumsal" ? 10 : 11}
                    placeholder={
                      billingInfo.type === "kurumsal"
                        ? "10 haneli vergi no"
                        : "11 haneli T.C. kimlik no"
                    }
                    value={billingInfo.taxNumber}
                    onChange={(e) => updateBilling("taxNumber", e.target.value)}
                    className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-800 outline-none transition focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>

                {billingInfo.type === "kurumsal" && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      Vergi Dairesi *
                    </label>

                    <input
                      type="text"
                      placeholder="Vergi dairesi"
                      value={billingInfo.taxOffice}
                      onChange={(e) =>
                        updateBilling("taxOffice", e.target.value)
                      }
                      className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-800 outline-none transition focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Fatura E-posta Adresi *
                  </label>

                  <input
                    type="email"
                    placeholder="ornek@firma.com"
                    value={billingInfo.email}
                    onChange={(e) => updateBilling("email", e.target.value)}
                    className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-800 outline-none transition focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Yetkili Telefon Numarası *
                  </label>

                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={11}
                    placeholder="05XXXXXXXXX"
                    value={billingInfo.phone}
                    onChange={(e) => updateBilling("phone", e.target.value)}
                    className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-800 outline-none transition focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Fatura Adresi *
                </label>

                <textarea
                  placeholder="Mahalle, cadde, sokak, bina no, daire no"
                  value={billingInfo.address}
                  onChange={(e) => updateBilling("address", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 min-h-[76px] text-sm text-slate-800 outline-none transition focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    İl *
                  </label>

                  <input
                    type="text"
                    placeholder="İl"
                    value={billingInfo.city}
                    onChange={(e) => updateBilling("city", e.target.value)}
                    className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-800 outline-none transition focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    İlçe *
                  </label>

                  <input
                    type="text"
                    placeholder="İlçe"
                    value={billingInfo.district}
                    onChange={(e) => updateBilling("district", e.target.value)}
                    className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-800 outline-none transition focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              </div>
            </form>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-4 md:p-5 lg:sticky lg:top-5">
            <h2 className="text-base font-bold text-slate-900 mb-3">
              Ödeme Özeti
            </h2>

            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 mb-3">
              <p className="text-xs text-slate-500">Seçili Paket</p>

              <p className="font-bold text-slate-900 mt-1 text-sm">
                {planLabel}
              </p>

              <p className="text-xs text-slate-500 mt-1">
                Dönem: {period}
              </p>
            </div>

            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 mb-4">
              {checkoutLoading ? (
                <p className="text-slate-600 text-sm">Tutar alınıyor...</p>
              ) : checkoutError ? (
                <p className="text-red-600 text-sm">{checkoutError}</p>
              ) : (
                <>
                  <p className="text-xs text-emerald-700 font-semibold">
                    Ödenecek Tutar
                  </p>

                  <p className="text-3xl font-extrabold text-emerald-700 mt-1">
                    {displayPriceTRY.toLocaleString("tr-TR")} TL
                  </p>

                  <p className="text-xs text-slate-500 mt-2">
                    {isOfferFlow
                      ? "Teklif tutarı üzerinden hesaplanmıştır."
                      : `KDV dahil ${
                          period === "Yıllık" ? "1 yıllık" : "1 aylık"
                        } abonelik.`}
                  </p>
                </>
              )}
            </div>

            {!agreementsOk && (
              <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs p-3 mb-3">
                Sözleşmeler onaylanmadan ödeme yapılamaz. Lütfen kayıt adımını
                tamamlayın.
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs p-3 mb-3">
                {error}
              </div>
            )}

            <button
              onClick={handlePayment}
              disabled={!canPay}
              className="flex items-center justify-center gap-2 w-full h-10 rounded-lg bg-emerald-600 text-white text-sm font-bold shadow-md hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Yönlendiriliyor..." : "Güvenli Ödemeye Geç"}
            </button>

            <p className="text-[11px] text-slate-500 text-center mt-3 leading-relaxed">
              Kart bilgileriniz İSG Panel tarafından saklanmaz. Ödeme işlemi
              güvenli ödeme altyapısı üzerinden tamamlanır.
            </p>

            {iyzicoFormHtml && (
              <div
                className="mt-4"
                dangerouslySetInnerHTML={{ __html: iyzicoFormHtml }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}