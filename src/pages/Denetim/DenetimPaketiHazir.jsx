import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { CheckCircle2, Copy, ExternalLink, Mail } from "lucide-react";
import { API_BASE } from "../../config/api";

const AUDIT_API_BASE = API_BASE.endsWith("/api") ? API_BASE : `${API_BASE}/api`;
const panelButton = "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a2b45]";
const ghostButton = `${panelButton} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`;
const primaryButton = `${panelButton} bg-[#2563eb] text-white hover:bg-[#1d4ed8]`;

function authHeaders() {
  const activeEmail = localStorage.getItem("__isg_active_email_global") || "";
  const token = localStorage.getItem("token") || sessionStorage.getItem("token") ||
    localStorage.getItem("authToken") || sessionStorage.getItem("authToken") ||
    localStorage.getItem(`isgpanel:${activeEmail}:token`) || "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString("tr-TR") : "-";
}

const recipientLabels = { INSPECTOR: "Müfettiş", EMPLOYER: "İşveren", HR: "İnsan Kaynakları", OTHER: "Diğer" };

function basePath(pathname) {
  if (pathname.startsWith("/ticari/admin")) return "/ticari/admin";
  if (pathname.startsWith("/ticari/user")) return "/ticari/user";
  if (pathname.startsWith("/ticari/belgeler")) return "/ticari/belgeler";
  return "/panel";
}

export default function DenetimPaketiHazir() {
  const { packageId } = useParams();
  const location = useLocation();
  const [auditPackage, setAuditPackage] = useState(location.state?.auditPackage || null);
  const [loading, setLoading] = useState(!location.state?.auditPackage);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  useEffect(() => {
    if (!packageId) return;
    let cancelled = false;
    fetch(`${AUDIT_API_BASE}/audit-packages/${packageId}`, { headers: authHeaders() })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || "Belge paylaşımı getirilemedi.");
        return data.package || data;
      })
      .then((data) => { if (!cancelled) setAuditPackage(data); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [packageId]);

  const publicUrl = useMemo(() => auditPackage?.publicUrl || (auditPackage?.publicToken
    ? `${window.location.origin}/denetim/goruntule/${auditPackage.publicToken}` : ""), [auditPackage]);

  async function copyLink() {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  async function sendEmail() {
    if (!packageId) return;
    try {
      setSendingEmail(true); setError("");
      const response = await fetch(`${AUDIT_API_BASE}/audit-packages/${packageId}/send-email`, { method: "POST", headers: { ...authHeaders(), "Content-Type": "application/json" } });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "E-posta gönderilemedi.");
      setAuditPackage(data.package || data);
    } catch (err) { setError(err.message); } finally { setSendingEmail(false); }
  }

  if (loading) return <div className="p-3 text-xs text-slate-600 sm:p-4 md:p-6">Belge paylaşımı yükleniyor...</div>;
  if (!auditPackage) return <div className="p-3 sm:p-4 md:p-6"><div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error || "Belge paylaşımı bulunamadı."}</div></div>;

  return (
    <main className="p-3 sm:p-4 md:p-6">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700"><CheckCircle2 size={14} /> Belge Paylaşımı Hazır</div>
          <h1 className="text-lg font-bold text-[#042f4b] sm:text-xl">{auditPackage.companyName}</h1>
          <p className="mt-1 text-xs text-slate-500">Seçilen belgeler sabit bir paket olarak güvenli bağlantıya bağlandı.</p>
          <p className="mt-2 text-xs text-slate-500">Yeni eklenen firma belgeleri, bu bağlantının içeriğine otomatik olarak eklenir.</p>
        </div>
        <Link to={`${basePath(location.pathname)}/belge-paylasimi`} className={primaryButton}>Yeni Paylaşım</Link>
      </header>

      <section>
        {error && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-base font-bold text-[#042f4b]">Paylaşım Bilgileri</h2>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Info label="Dosya No" value={auditPackage.packageNumber} />
            <Info label="Oluşturulma" value={formatDate(auditPackage.createdAt)} />
            <Info label="Alıcı" value={auditPackage.recipientName} />
            <Info label="Alıcı Türü" value={recipientLabels[auditPackage.recipientType] || auditPackage.recipientType} />
            <Info label="E-posta" value={auditPackage.recipientEmail} />
            <Info label="Belge / Kategori" value={`${auditPackage.documentCount || 0} belge / ${auditPackage.categoryCount || 0} kategori`} />
            <Info label="Erişim" value={auditPackage.accessType === "UNLIMITED" ? "Süresiz" : formatDate(auditPackage.expiresAt)} />
            <Info label="İndirme Yetkisi" value={auditPackage.allowDownload ? "Açık" : "Kapalı"} />
            <Info label="Şifre Koruması" value={auditPackage.requiresPassword ? "Var" : "Yok"} />
            <Info label="E-posta Durumu" value={auditPackage.emailSentAt ? `Gönderildi (${formatDate(auditPackage.emailSentAt)})` : "Gönderilemedi veya bekliyor"} />
          </dl>

          <div className="mt-5">
            <label className="mb-1 block text-xs font-medium text-slate-700">Güvenli paylaşım bağlantısı</label>
            <div className="flex gap-2"><input readOnly value={publicUrl} className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs" /><button onClick={copyLink} className={primaryButton}><Copy size={14} /> {copied ? "Kopyalandı" : "Linki Kopyala"}</button></div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={sendEmail} disabled={sendingEmail} className={ghostButton}><Mail size={14} /> {sendingEmail ? "Gönderiliyor..." : "E-posta ile Gönder"}</button>
            <a href={publicUrl} target="_blank" rel="noreferrer" className={ghostButton}><ExternalLink size={14} /> Paylaşımı Aç</a>
          </div>
        </div>

      </section>
    </main>
  );
}

function Info({ label, value }) {
  return <div><dt className="text-[11px] font-medium uppercase text-slate-500">{label}</dt><dd className="mt-1 break-words text-xs font-semibold text-slate-900">{value || "-"}</dd></div>;
}
