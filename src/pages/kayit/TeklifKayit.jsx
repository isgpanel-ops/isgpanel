// src/pages/kayit/TeklifKayit.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";

import { Banknote, Building2, Clock, ShieldAlert } from "lucide-react";

/**
 * Public sayfa:
 * URL: /kayit/teklif/:token
 * API: GET /api/public/offer/:token
 */

const BRAND = "#0a2b45";

function cn(...a) {
  return a.filter(Boolean).join(" ");
}

function Button({ variant = "primary", className, children, ...props }) {
  const base =
    "inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed";
  const styles =
  variant === "primary"
    ? "text-white shadow-sm"
    : variant === "success"
    ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
    : variant === "ghost"
    ? "bg-transparent hover:bg-black/5 text-slate-800"
    : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-900";


  const styleProp = variant === "primary" ? { backgroundColor: BRAND } : undefined;

  return (
    <button {...props} style={styleProp} className={cn(base, styles, className)}>
      {children}
    </button>
  );
}

function Card({ className, children }) {
  return <div className={cn("bg-white border border-slate-200 rounded-2xl shadow-sm", className)}>{children}</div>;
}

function Pill({ tone = "neutral", children, icon }) {
  const base = "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium";
  const styles =
    tone === "good"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : tone === "warn"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : tone === "bad"
      ? "bg-red-50 text-red-700 border-red-200"
      : tone === "info"
      ? "bg-sky-50 text-sky-700 border-sky-200"
      : "bg-slate-50 text-slate-700 border-slate-200";
  return (
    <span className={cn(base, styles)}>
      {icon ? <span className="opacity-80">{icon}</span> : null}
      {children}
    </span>
  );
}

function currencyTRY(n) {
  const x = Number(n || 0);
  return x.toLocaleString("tr-TR", { style: "currency", currency: "TRY" });
}

function fmtDate(dt) {
  if (!dt) return "—";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" });
}

function statusLabel(s) {
  switch (String(s || "")) {
    case "created":
      return "Oluşturuldu";
    case "sent":
      return "Gönderildi";
    case "opened":
      return "Açıldı";
    case "registered":
      return "Kayıt Yapıldı";
    case "paid":
      return "Ödeme Alındı";
    case "active":
      return "Aktif";
    case "expired":
      return "Süresi Doldu";
    case "canceled":
      return "İptal";
    default:
      return s || "—";
  }
}

function statusTone(s) {
  switch (String(s || "")) {
    case "active":
    case "paid":
      return "good";
    case "registered":
    case "opened":
    case "sent":
      return "info";
    case "expired":
      return "warn";
    case "canceled":
      return "bad";
    default:
      return "neutral";
  }
}

export default function TeklifKayit() {
  const { token } = useParams();
  const navigate = useNavigate();


  const API_BASE =
    (typeof import.meta !== "undefined" && import.meta?.env?.VITE_API_URL) ||
    (typeof process !== "undefined" && process?.env?.REACT_APP_API_URL) ||
    "";

  const [loading, setLoading] = useState(true);
  const [offer, setOffer] = useState(null);
  const [err, setErr] = useState(null); // { code, detail }

  const offerMeta = useMemo(() => {
    if (!offer) return null;
    const expiresAt = offer.linkExpiresAt ? new Date(offer.linkExpiresAt) : null;

    const isExpired = expiresAt ? Date.now() > expiresAt.getTime() : false;
    return { expiresAt, isExpired };
  }, [offer]);

  useEffect(() => {
    let alive = true;

    async function run() {
      setLoading(true);
      setErr(null);
      setOffer(null);

      try {
        const res = await fetch(`${API_BASE}/api/public/offer/${token}`);

;
        const data = await res.json().catch(() => ({}));

        if (!alive) return;

        if (res.status === 410) {
          // EXPIRED
          setErr({ code: "EXPIRED", detail: data });
          setLoading(false);
          return;
        }

        if (!res.ok) {

          setErr({ code: data?.error || `HTTP_${res.status}`, detail: data });
          setLoading(false);
          return;
        }

        setOffer(data.offer || null);


      } catch (e) {
        if (!alive) return;
        setErr({ code: "NETWORK", detail: String(e?.message || e) });
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    if (token) run();
    else {
      setLoading(false);
      setErr({ code: "TOKEN_REQUIRED" });
    }

    return () => {
      alive = false;
    };
  }, [API_BASE, token]);

    return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto p-5 md:p-8">
        {/* Header */}

<div className="flex items-center justify-between mb-6">
  {/* Sol: Logo */}
  <img
    src="/isgpanel-logo.png"
    alt="İSG Panel"
    className="h-12 w-auto object-contain"
  />

  {/* Orta: Kurumsal Tekliftir */}
  <div className="flex-1 text-center">
  <div className="text-lg md:text-xl font-semibold text-slate-900 tracking-wide">
    Kurumsal Tekliftir
  </div>
</div>



  {/* Sağ: Ana sayfa */}
  <Link
    to="/"
    className="text-sm text-slate-500 hover:text-slate-700"
  >
    Ana sayfa
  </Link>
</div>

{/* İnce belge çizgisi */}
<div className="h-px bg-slate-200 mb-6" />


        {/* Card */}
        <Card className="overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex items-start justify-between gap-4">
            <div>
              <div className="text-lg font-semibold text-slate-900 flex items-center gap-2">
  <Building2 className="w-5 h-5" />
  {offer?.companyName
    ? `${offer.companyName} – Kurumsal Teklif`
    : "Kurumsal Teklif"}
</div>


              <div className="text-sm text-slate-500 mt-1">
                Teklif No:{" "}
                <span className="font-mono">
                  {(token || "—").slice(0, 10).toUpperCase()}
                </span>
              </div>
            </div>

            {offer?.status ? (
              <Pill tone={statusTone(offer.status)}>{statusLabel(offer.status)}</Pill>
            ) : null}
          </div>

          <div className="p-5">
            {loading ? (
              <div className="text-sm text-slate-600">Yükleniyor…</div>
            ) : err ? (
              <div className="rounded-2xl border border-slate-300 bg-slate-50 p-5">

                <div className="flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-amber-700 mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      Teklif görüntülenemedi ({err.code})
                    </div>

                    <div className="text-sm text-slate-600 mt-1">
                      {err.code === "EXPIRED"
                        ? "Bu teklif linkinin süresi dolmuş."
                        : err.code === "NOT_FOUND"
                        ? "Teklif bulunamadı."
                        : "Teklif bilgisi alınamadı."}
                    </div>

                    {err?.detail?.linkExpiresAt ? (
                      <div className="text-xs text-slate-500 mt-2">
                        Son geçerlilik: {fmtDate(err.detail.linkExpiresAt)}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : !offer ? (
              <div className="text-sm text-slate-600">Teklif verisi boş.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Kurum */}
               <div className="rounded-2xl border border-slate-200 bg-white p-5">
  <div className="text-sm text-slate-500">Kurum</div>

  <div className="text-base font-semibold text-slate-900 mt-1">
    {offer.companyName || "—"}
  </div>

  <div className="text-sm text-slate-500 mt-3">İletişim e-posta</div>

  <div className="text-base text-slate-800">
    {offer.email || "—"}
  </div>
</div>


                {/* Fiyat */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Banknote className="w-4 h-4" />
                    <span className="uppercase tracking-wide">Teklif Bedeli</span>

                  </div>

                 <div className="flex items-end gap-2 mt-1">
  <div className="text-2xl font-semibold text-slate-900">
    {currencyTRY(offer.priceTRY)}
  </div>

  <span className="mb-1 rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-xs text-slate-600">
    KDV: Dahil
  </span>
</div>


                  <div className="mt-3 flex flex-wrap gap-2">
                    <Pill tone="neutral" icon={<Clock className="w-4 h-4" />}>
                      Süre: {Number(offer.durationDays || 0)} gün
                    </Pill>

                    <Pill
                      tone={offerMeta?.isExpired ? "warn" : "info"}
                      icon={<Clock className="w-4 h-4" />}
                    >
                      Son: {fmtDate(offer.linkExpiresAt)}
                    </Pill>

                  </div>
                </div>

                {/* Teklif Koşulları */}
                <div className="absolute left-0 top-0 h-full w-1 bg-slate-300 rounded-l-2xl" />

                <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 relative">

                  <div className="text-xs font-medium text-slate-600">Teklif Koşulları</div>
                 <ul className="mt-2 space-y-2 text-sm text-slate-800">
  {(offer.note || "")
    .split("\n")
    .filter(Boolean)
    .map((line, i) => (
      <li key={i} className="flex items-start gap-2">
        <span className="mt-0.5 text-emerald-600">✓</span>
        <span className="leading-relaxed">{line}</span>
      </li>
    ))}
</ul>

                </div>

                {/* Alt satır + CTA */}
                <div className="md:col-span-2 flex items-end justify-between gap-3 pt-2">
                  <div className="text-xs text-slate-500">
                    Oluşturulma: {fmtDate(offer.createdAt)}
                  </div>

                  <div className="text-right">
                    <Button
  variant="success"
  onClick={() => navigate(`/kayit/register/kurumsal?token=${encodeURIComponent(token)}&fromOffer=1`)}
  disabled={offerMeta?.isExpired}
>
  Devam Et
</Button>


                    <div className="mt-2 text-[11px] text-slate-500">
                      Devam ederek teklif koşullarını kabul etmiş olursunuz.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Footer */}
        <div className="text-xs text-slate-500 mt-4">
          Bu sayfa sadece teklif doğrulama + görüntüleme içindir.
        </div>
      </div>
    </div>
  );
}

