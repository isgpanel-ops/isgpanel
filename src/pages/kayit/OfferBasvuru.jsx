// src/pages/kayit/OfferBasvuru.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Building2, Banknote, Clock, ShieldAlert } from "lucide-react";

const BRAND = "#0a2b45";

const API_BASE =
  (typeof import.meta !== "undefined" && import.meta?.env?.VITE_API_URL) ||
  (typeof process !== "undefined" && process?.env?.REACT_APP_API_URL) ||
  "";

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

function cn(...a) {
  return a.filter(Boolean).join(" ");
}

function Card({ className, children }) {
  return <div className={cn("bg-white border border-slate-200 rounded-2xl shadow-sm", className)}>{children}</div>;
}

function Button({ className, disabled, children, ...props }) {
  return (
    <button
      {...props}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-sm",
        className
      )}
      style={{ backgroundColor: BRAND }}
    >
      {children}
    </button>
  );
}

export default function OfferBasvuru() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [offer, setOffer] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;

    async function loadOffer() {
      setLoading(true);
      setErr(null);
      setOffer(null);

      try {
        const res = await fetch(`${API_BASE}/api/public/offer/${token}`);
        const data = await res.json().catch(() => ({}));

        if (!alive) return;

        if (res.status === 410) {
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

    if (token) loadOffer();
    else {
      setLoading(false);
      setErr({ code: "TOKEN_REQUIRED" });
    }

    return () => {
      alive = false;
    };
  }, [token]);

  async function handleRegisterAndGoPay() {
    if (!token) return;
    setBusy(true);
    setErr(null);

    try {
      // Minimal payload: teklif zaten companyName/email içeriyor.
      const payload = {
        token,
        orgName: offer?.companyName || "",
        email: offer?.email || "",
      };

      const res = await fetch(`${API_BASE}/api/public/offer/${token}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr({ code: data?.error || `HTTP_${res.status}`, detail: data });
        setBusy(false);
        return;
      }

      const organizationId = data.organizationId;
      if (!organizationId) {
        setErr({ code: "ORG_ID_MISSING", detail: data });
        setBusy(false);
        return;
      }

      // Ödeme sayfasına geç (senin Odeme.jsx zaten plan+org paramı bekliyor)
      navigate(`/odeme?plan=kurumsal-teklif&org=${organizationId}`, { replace: true });
    } catch (e) {
      setErr({ code: "NETWORK", detail: String(e?.message || e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto p-5 md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold" style={{ backgroundColor: BRAND }}>
              İ
            </div>
            <div>
              <div className="text-lg font-semibold text-slate-900">İSG Panel • Abonelik</div>
              <div className="text-sm text-slate-500">Teklife göre abonelik başlatma</div>
            </div>
          </div>

          <Link to={`/kayit/teklif/${token || ""}`} className="text-sm text-slate-600 hover:underline">
            Teklife dön
          </Link>
        </div>

        <Card className="overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex items-start justify-between gap-4">
            <div>
              <div className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Abonelik Başlat
              </div>
              <div className="text-sm text-slate-500 mt-1">
                Token: <span className="font-mono">{token || "—"}</span>
              </div>
            </div>
          </div>

          <div className="p-5">
            {loading ? (
              <div className="text-sm text-slate-600">Yükleniyor…</div>
            ) : err ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-amber-700 mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      İşlem devam edemedi ({err.code})
                    </div>
                    <div className="text-sm text-slate-600 mt-1">
                      {err.code === "EXPIRED"
                        ? "Bu teklif linkinin süresi dolmuş."
                        : err.code === "TOKEN_REQUIRED"
                        ? "Token bulunamadı."
                        : "Bilgiler alınamadı."}
                    </div>
                    {err?.detail?.linkExpiresAt ? (
                      <div className="text-xs text-slate-500 mt-2">Son geçerlilik: {fmtDate(err.detail.linkExpiresAt)}</div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : !offer ? (
              <div className="text-sm text-slate-600">Teklif verisi boş.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Firma */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-xs text-slate-500">Kurum</div>
                  <div className="text-sm font-semibold text-slate-900 mt-1">{offer.companyName || "—"}</div>
                  <div className="text-xs text-slate-500 mt-2">İletişim e-posta</div>
                  <div className="text-sm text-slate-800">{offer.email || "—"}</div>
                </div>

                {/* Bedel */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Banknote className="w-4 h-4" />
                    Teklif Bedeli
                  </div>
                  <div className="text-2xl font-semibold text-slate-900 mt-1">{currencyTRY(offer.priceTRY)}</div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium bg-slate-50 text-slate-700 border-slate-200">
                      <Clock className="w-4 h-4 opacity-80" />
                      Süre: {Number(offer.durationDays || 0)} gün
                    </span>

                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium bg-sky-50 text-sky-700 border-sky-200">
                      <Clock className="w-4 h-4 opacity-80" />
                      Son: {fmtDate(offer.linkExpiresAt)}
                    </span>
                  </div>
                </div>

                {/* Not */}
                <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-xs text-slate-500">Not</div>
                  <div className="text-sm text-slate-800 mt-1 whitespace-pre-wrap">{offer.note || "—"}</div>
                </div>

                {/* CTA */}
                <div className="md:col-span-2 flex items-center justify-between gap-3 pt-2">
                  <div className="text-xs text-slate-500">
                    Devam ettiğinizde abonelik oluşturulur ve ödeme adımına geçersiniz.
                  </div>
                  <Button onClick={handleRegisterAndGoPay} disabled={busy}>
                    {busy ? "Hazırlanıyor..." : "Ödemeye Geç"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>

        <div className="text-xs text-slate-500 mt-4">
          Bu adım, teklif üzerinden abonelik başlatır ve ödeme ekranına yönlendirir.
        </div>
      </div>
    </div>
  );
}
