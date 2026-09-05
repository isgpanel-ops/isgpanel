import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { CheckCircle2, Copy, ExternalLink, Mail, QrCode } from "lucide-react";
import { API_BASE } from "../../config/api";

const AUDIT_API_BASE = API_BASE.endsWith("/api") ? API_BASE : `${API_BASE}/api`;

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
  const [newDocumentCount, setNewDocumentCount] = useState(null);
  const [newDocuments, setNewDocuments] = useState([]);
  const [addingNewDocuments, setAddingNewDocuments] = useState(false);

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

  useEffect(() => {
    if (!packageId) return;
    fetch(`${AUDIT_API_BASE}/audit-packages/${packageId}/new-documents`, { headers: authHeaders() })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { setNewDocumentCount(data?.count ?? null); setNewDocuments(data?.categories?.flatMap((item) => item.documents || []) || []); })
      .catch(() => setNewDocumentCount(null));
  }, [packageId]);

  const publicUrl = useMemo(() => auditPackage?.publicUrl || (auditPackage?.publicToken
    ? `${window.location.origin}/denetim/goruntule/${auditPackage.publicToken}` : ""), [auditPackage]);
  const qrUrl = auditPackage?.qrCodeDataUrl || "";
  const mailSubject = `${auditPackage?.companyName || "Firma"} - İSG Belge Paylaşımı`;
  const mailBody = `${auditPackage?.companyName || "Firma"} için hazırlanan İSG belgelerine aşağıdaki güvenli bağlantıdan ulaşabilirsiniz.\n\nDosya No: ${auditPackage?.packageNumber || "-"}\n\n${publicUrl}`;

  async function copyLink() {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  async function addAllNewDocuments() {
    if (!newDocuments.length) return;
    setAddingNewDocuments(true);
    try {
      const response = await fetch(`${AUDIT_API_BASE}/audit-packages/${packageId}/documents`, { method: "POST", headers: { ...authHeaders(), "Content-Type": "application/json" }, body: JSON.stringify({ documentIds: newDocuments.map((doc) => doc.id) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Yeni belgeler eklenemedi.");
      setAuditPackage(data.package); setNewDocuments([]); setNewDocumentCount(0);
    } catch (err) { setError(err.message); } finally { setAddingNewDocuments(false); }
  }

  if (loading) return <div className="p-6 text-sm text-slate-600">Belge paylaşımı yükleniyor...</div>;
  if (error || !auditPackage) return <div className="p-6"><div className="rounded border border-red-200 bg-red-50 p-4 text-red-700">{error || "Belge paylaşımı bulunamadı."}</div></div>;

  return (
    <main className="mx-auto w-full max-w-6xl p-6">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700"><CheckCircle2 size={16} /> Belge Paylaşımı Hazır</div>
          <h1 className="text-2xl font-bold text-slate-900">{auditPackage.companyName}</h1>
          <p className="mt-1 text-sm text-slate-500">Seçilen belgeler sabit bir paket olarak güvenli bağlantıya bağlandı.</p>
          {newDocumentCount > 0 && <div className="mt-3 flex items-center justify-between gap-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"><span>Bu paylaşım oluşturulduktan sonra {newDocumentCount} yeni belge eklendi.</span><button onClick={addAllNewDocuments} disabled={addingNewDocuments} className="rounded border border-amber-300 bg-white px-3 py-1 font-semibold">{addingNewDocuments ? "Ekleniyor..." : "Yeni Belgeleri İncele ve Ekle"}</button></div>}
        </div>
        <Link to={`${basePath(location.pathname)}/denetim/hazirla`} className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Yeni Paylaşım</Link>
      </header>

      <section className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="rounded border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-slate-900">Paylaşım Bilgileri</h2>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
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

          <div className="mt-6">
            <label className="mb-2 block text-sm font-semibold text-slate-700">Güvenli paylaşım bağlantısı</label>
            <div className="flex gap-2"><input readOnly value={publicUrl} className="min-w-0 flex-1 rounded border border-slate-300 px-3 py-2 text-sm" /><button onClick={copyLink} className="inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white"><Copy size={16} /> {copied ? "Kopyalandı" : "Linki Kopyala"}</button></div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <a href={`mailto:${encodeURIComponent(auditPackage.recipientEmail || "")}?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`} className="inline-flex items-center gap-2 rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"><Mail size={16} /> E-posta ile Gönder</a>
            <a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"><ExternalLink size={16} /> Paylaşımı Aç</a>
          </div>
        </div>

        <aside className="rounded border border-slate-200 bg-white p-5 text-center shadow-sm">
          <div className="mb-3 flex items-center justify-center gap-2 font-bold text-slate-900"><QrCode size={18} /> QR Kod</div>
          {qrUrl ? <img src={qrUrl} alt="Belge paylaşımı QR kodu" className="mx-auto h-60 w-60 border border-slate-200 p-2" /> : <div className="mx-auto grid h-60 w-60 place-items-center border border-slate-200 text-sm text-slate-500">QR kod hazırlanamadı.</div>}
          <p className="mt-3 text-xs leading-5 text-slate-500">QR kod okutulduğunda yalnızca bu paylaşım paketine eklenen belgeler açılır.</p>
        </aside>
      </section>
    </main>
  );
}

function Info({ label, value }) {
  return <div><dt className="text-xs font-semibold uppercase text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-semibold text-slate-900">{value || "-"}</dd></div>;
}
