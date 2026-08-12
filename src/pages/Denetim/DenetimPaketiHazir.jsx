import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, Copy, Mail, MessageCircle, QrCode, ShieldCheck } from "lucide-react";
import { API_BASE } from "../../config/api";

function authToken() {
  const activeEmail = localStorage.getItem("__isg_active_email_global") || "";
  return (
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    sessionStorage.getItem("authToken") ||
    localStorage.getItem(`isgpanel:${activeEmail}:token`) ||
    ""
  );
}

function authHeaders() {
  const token = authToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatDate(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("tr-TR");
  } catch {
    return "-";
  }
}

export default function DenetimPaketiHazir() {
  const { packageId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [auditPackage, setAuditPackage] = useState(location.state?.auditPackage || null);
  const [loading, setLoading] = useState(!location.state?.auditPackage);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (auditPackage || !packageId) return;
    let alive = true;
    setLoading(true);
    fetch(`${API_BASE}/api/audit-packages/${packageId}`, { headers: authHeaders() })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || "Denetim paketi getirilemedi.");
        return data;
      })
      .then((data) => {
        if (alive) setAuditPackage(data.auditPackage || data);
      })
      .catch((err) => {
        if (alive) setError(err.message || "Denetim paketi getirilemedi.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [auditPackage, packageId]);

  const publicUrl = useMemo(() => {
    if (!auditPackage?.publicToken) return "";
    return `${window.location.origin}/denetim/goruntule/${auditPackage.publicToken}`;
  }, [auditPackage?.publicToken]);

  const qrUrl = useMemo(() => {
    if (!publicUrl) return "";
    return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(publicUrl)}`;
  }, [publicUrl]);

  const shareText = useMemo(() => {
    if (!auditPackage) return "";
    return `${auditPackage.companyName || "Firma"} Dijital ISG Denetim Dosyasi\n\nDosya No: ${
      auditPackage.packageNumber || "-"
    }\n\nDenetim belgelerine asagidaki guvenli baglanti uzerinden ulasabilirsiniz:\n\n${publicUrl}`;
  }, [auditPackage, publicUrl]);

  const copyLink = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
    } catch {
      const input = document.createElement("input");
      input.value = publicUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (loading) {
    return <div className="p-6 text-sm text-slate-600">Denetim dosyasi yukleniyor...</div>;
  }

  if (error || !auditPackage) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error || "Denetim paketi bulunamadi."}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <ShieldCheck size={15} /> Denetim Dosyasi Hazir
          </div>
          <h1 className="text-2xl font-bold text-[#042f4b]">Denetim Dosyasi Hazir</h1>
          <p className="text-sm text-slate-500">Guvenli baglanti ve QR kod ile paylasabilirsiniz.</p>
        </div>
        <button className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold" onClick={() => navigate(-1)}>
          Geri Don
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-full bg-emerald-50 p-3 text-emerald-600">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#042f4b]">{auditPackage.companyName || "-"}</h2>
              <p className="text-sm text-slate-500">Dijital ISG Denetim Dosyasi</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Info label="Dosya No" value={auditPackage.packageNumber} />
            <Info label="Olusturulma" value={formatDate(auditPackage.createdAt)} />
            <Info label="Belge Sayisi" value={auditPackage.documentCount} />
            <Info label="Kategori Sayisi" value={auditPackage.categoryCount} />
            <Info label="Durum" value={auditPackage.status === "ACTIVE" ? "Aktif" : auditPackage.status} />
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2 font-bold text-[#042f4b]">
            <QrCode size={20} /> QR Kod ve Paylasim
          </div>
          <div className="flex flex-col items-center gap-4">
            {qrUrl && <img className="h-60 w-60 rounded-lg border border-slate-200 bg-white p-3" src={qrUrl} alt="Denetim QR kodu" />}
            <div className="flex w-full gap-2">
              <input className="min-w-0 flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm" value={publicUrl} readOnly />
              <button className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white" onClick={copyLink}>
                <Copy size={16} /> Kopyala
              </button>
            </div>
            {copied && <div className="w-full rounded-md border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-700">Denetim baglantisi kopyalandi.</div>}
            <div className="grid w-full gap-2 sm:grid-cols-2">
              <a className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white" href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer">
                <MessageCircle size={17} /> WhatsApp ile Gonder
              </a>
              <a className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-[#042f4b]" href={`mailto:?subject=${encodeURIComponent(`${auditPackage.companyName || "Firma"} - Dijital ISG Denetim Dosyasi`)}&body=${encodeURIComponent(shareText)}`}>
                <Mail size={17} /> E-posta ile Gonder
              </a>
            </div>
            <Link className="w-full rounded-md border border-slate-200 px-4 py-2 text-center text-sm font-semibold text-[#042f4b]" to={`/denetim/goruntule/${auditPackage.publicToken}`} target="_blank">
              Public Portali Ac
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 font-bold text-[#042f4b]">{value ?? "-"}</div>
    </div>
  );
}
