import React, { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";

const BRAND = "#0a2b45";
function cn(...a) { return a.filter(Boolean).join(" "); }

function Button({ variant="primary", className, children, ...props }) {
  const base="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed";
  const styles = variant==="primary"
    ? "text-white shadow-sm"
    : variant==="ghost"
    ? "bg-transparent hover:bg-black/5 text-slate-800"
    : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-900";
  const styleProp = variant==="primary" ? { backgroundColor: BRAND } : undefined;
  return <button {...props} style={styleProp} className={cn(base, styles, className)}>{children}</button>;
}

function Field({ label, ...props }) {
  return (
    <label className="block">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <input
        {...props}
        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-black/10"
      />
    </label>
  );
}

export default function TeklifBasvuru() {
  const { token } = useParams();
  const nav = useNavigate();

  const API_BASE =
    (typeof import.meta !== "undefined" && import.meta?.env?.VITE_API_URL) ||
    (typeof process !== "undefined" && process?.env?.REACT_APP_API_URL) ||
    "";

  const [loading, setLoading] = useState(true);
  const [offer, setOffer] = useState(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [companyTaxName, setCompanyTaxName] = useState("");
  const [companyTaxNo, setCompanyTaxNo] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // teklif bilgisi (ekranda gösterelim)
  useEffect(() => {
    let alive = true;
    async function run() {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/api/public/offer/${token}`);
        const data = await res.json().catch(() => ({}));
        if (!alive) return;

        if (!res.ok || !data?.ok) {
          setError(data?.error || `HTTP_${res.status}`);
          setOffer(null);
          return;
        }
        setOffer(data.offer);
      } catch (e) {
        if (!alive) return;
        setError("NETWORK");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }
    if (token) run();
    return () => { alive = false; };
  }, [API_BASE, token]);

  async function submit(e) {
    e.preventDefault();
    setError("");

    if (!fullName.trim()) return setError("Ad Soyad zorunlu");
    if (!email.trim()) return setError("E-posta zorunlu");

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/public/offer/${token}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          phone,
          companyTaxName,
          companyTaxNo,
          companyAddress,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 410) {
        setError("Teklifin süresi dolmuş.");
        return;
      }

      if (!res.ok || !data?.ok) {
        setError(data?.error || `HTTP_${res.status}`);
        return;
      }

      // ✅ sonraki adım ödeme olacak (bir sonraki mesajda yapacağız)
      const pgOrgId = offer?.pgOrgId;

if (!pgOrgId) {
  setError("Organizasyon UUID bulunamadı. Lütfen destek ile iletişime geçin.");
  return;
}

nav(`/odeme?plan=${offer?.planKey || ""}&org=${pgOrgId}`);


    } catch (e2) {
      setError("NETWORK");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto p-5 md:p-8">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold" style={{ backgroundColor: BRAND }}>
              İ
            </div>
            <div>
              <div className="text-lg font-semibold text-slate-900">Teklif Başvurusu</div>
              <div className="text-sm text-slate-500">Bilgilerini gir, kaydı başlatalım</div>
            </div>
          </div>
          <Link to={`/kayit/teklif/${token}`} className="text-sm text-slate-600 hover:underline">
            Geri
          </Link>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
          {loading ? (
            <div className="text-sm text-slate-600">Yükleniyor…</div>
          ) : error ? (
            <div className="text-sm text-red-700">{String(error)}</div>
          ) : (
            <>
              <div className="text-sm text-slate-700 mb-4">
                <div><span className="text-slate-500">Kurum:</span> <b>{offer?.companyName || "—"}</b></div>
                <div><span className="text-slate-500">Tutar:</span> <b>{Number(offer?.priceTRY || 0).toLocaleString("tr-TR")} ₺</b></div>
              </div>

              <form onSubmit={submit} className="grid grid-cols-1 gap-3">
                <Field label="Ad Soyad *" value={fullName} onChange={(e)=>setFullName(e.target.value)} />
                <Field label="E-posta *" value={email} onChange={(e)=>setEmail(e.target.value)} />
                <Field label="Telefon" value={phone} onChange={(e)=>setPhone(e.target.value)} />

                <div className="h-px bg-slate-100 my-2" />

                <Field label="Vergi Ünvanı" value={companyTaxName} onChange={(e)=>setCompanyTaxName(e.target.value)} />
                <Field label="Vergi No" value={companyTaxNo} onChange={(e)=>setCompanyTaxNo(e.target.value)} />
                <Field label="Adres" value={companyAddress} onChange={(e)=>setCompanyAddress(e.target.value)} />

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button type="button" variant="secondary" onClick={()=>nav(`/kayit/teklif/${token}`)}>
                    Vazgeç
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Gönderiliyor…" : "Kaydı Başlat"}
                  </Button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
