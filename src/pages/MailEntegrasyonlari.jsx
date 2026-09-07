import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CheckCircle2, ChevronRight, Mail, Settings2, ShieldCheck, X } from "lucide-react";
import { API_BASE } from "../config/api";
import IsgFaturaEntegrasyon from "./Ticari/IsgFaturaEntegrasyon";

const API = `${API_BASE.endsWith("/api") ? API_BASE : `${API_BASE}/api`}/mail-integrations`;
const providers = [
  { id: "gmail", name: "Gmail", description: "Google hesabınızı seçerek güvenli bağlantı kurun.", color: "bg-red-50 text-red-600", host: "smtp.gmail.com", port: 465, secure: true, passwordHint: "Google hesabınız için oluşturduğunuz uygulama parolasını girin." },
  { id: "zoho", name: "Zoho Mail", description: "Zoho hesabınızı seçerek belge paylaşımlarına bağlayın.", color: "bg-amber-50 text-amber-700", host: "smtp.zoho.com", port: 465, secure: true, passwordHint: "Zoho Mail uygulama parolanızı girin." },
  { id: "microsoft", name: "Microsoft 365", description: "Microsoft hesabınızla belge paylaşımlarına bağlantı kurun.", color: "bg-blue-50 text-blue-700", host: "smtp.office365.com", port: 587, secure: false, passwordHint: "Microsoft hesabınızın uygulama parolasını girin." },
];

function headers() {
  const token = localStorage.getItem("token") || sessionStorage.getItem("token") || localStorage.getItem("authToken") || "";
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function PageTitle({ admin = false }) {
  return <div className={admin ? "mb-4" : "mb-5"}>
    <div className="flex items-center gap-2"><Settings2 size={20} aria-hidden="true" /><h1 className="text-lg font-bold">{admin ? "Entegrasyonlar" : "E-posta Entegrasyonları"}</h1></div>
    <p className="mt-1 text-xs text-slate-500">Belge paylaşımında <strong>E-posta ile Gönder</strong> seçildiğinde bağlantı kurduğunuz hesap otomatik gönderici olarak kullanılır.</p>
  </div>;
}

function ManualConnectionDialog({ provider, onClose, onSaved }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(event) {
    event.preventDefault();
    try {
      setSaving(true);
      setError("");
      const response = await fetch(`${API}/me`, { method: "PUT", headers: headers(), body: JSON.stringify({ provider: provider.id, email, password, host: provider.host, port: provider.port, secure: provider.secure }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "E-posta hesabı bağlanamadı.");
      onSaved(data.integration);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-label={`${provider.name} hesabını bağla`}>
    <form onSubmit={save} className="w-full max-w-md rounded bg-white p-6 shadow-xl">
      <div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-bold">{provider.name} Hesabını Bağla</h2><p className="mt-1 text-xs text-slate-500">{provider.passwordHint}</p></div><button type="button" onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Pencereyi kapat"><X size={19} /></button></div>
      {error && <div className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
      <label className="mt-5 block text-sm font-medium">E-posta adresi<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" placeholder="ornek@firma.com" /></label>
      <label className="mt-4 block text-sm font-medium">Uygulama parolası<input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" autoComplete="new-password" /></label>
      <p className="mt-3 text-xs text-slate-500">Bu parola yalnızca şifreli olarak saklanır ve belge paylaşım e-postalarını göndermek için kullanılır.</p>
      <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded border border-slate-300 px-4 py-2 text-sm font-medium">Vazgeç</button><button disabled={saving} className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Bağlanıyor..." : "Hesabı Bağla"}</button></div>
    </form>
  </div>;
}

function MailConnectionPanel() {
  const [integration, setIntegration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState("");
  const [error, setError] = useState("");
  const [manualProvider, setManualProvider] = useState(null);
  async function load() {
    const response = await fetch(`${API}/me`, { headers: headers() });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Entegrasyon bilgisi alınamadı.");
    setIntegration(data.integration || null);
    setLoading(false);
  }
  useEffect(() => { load().catch((err) => { setError(err.message); setLoading(false); }); }, []);
  async function connect(providerId) {
    try {
      setError("");
      setConnecting(providerId);
      const response = await fetch(`${API}/oauth/${providerId}/start`, { method: "POST", headers: headers() });
      const data = await response.json();
      if (!response.ok) {
        if (data.code === "OAUTH_NOT_CONFIGURED") { setManualProvider(providers.find((provider) => provider.id === providerId)); return; }
        throw new Error(data.message || "Bağlantı başlatılamadı.");
      }
      const popup = window.open(data.url, "mailIntegration", "width=560,height=720");
      if (!popup) throw new Error("Bağlantı penceresi engellendi. Tarayıcınızdan açılır pencereye izin veriniz.");
      const timer = window.setInterval(() => { if (popup.closed) { window.clearInterval(timer); setConnecting(""); load().catch(() => null); } }, 700);
    } catch (err) {
      setError(err.message);
    } finally {
      setConnecting("");
    }
  }
  if (loading) return <div className="p-6 text-xs text-slate-500">Entegrasyonlar yükleniyor...</div>;
  return <>
    {error && <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
    {integration && <div className="mb-4 flex items-center gap-2 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700"><CheckCircle2 size={14} /><span><strong>{integration.email}</strong> hesabı bağlı; belge paylaşımında otomatik gönderici olarak kullanılacak.</span></div>}
    <section className="overflow-hidden rounded border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 p-6"><h2 className="text-lg font-bold">E-posta Hesabı Bağla</h2><p className="mt-1 text-xs text-slate-500">Sağlayıcınızı seçin; hazır OAuth bağlantısı yoksa uygulama parolanızla hesabınızı bağlayın.</p></div><div className="divide-y divide-slate-100">{providers.map((provider) => <button key={provider.id} type="button" onClick={() => connect(provider.id)} disabled={Boolean(connecting)} className="flex w-full items-center gap-3 px-6 py-4 text-left transition hover:bg-slate-50 disabled:opacity-60"><span className={`flex h-9 w-9 items-center justify-center rounded ${provider.color}`}><Mail size={18} /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{provider.name}</span><span className="mt-0.5 block text-xs text-slate-500">{provider.description}</span></span><span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600">{connecting === provider.id ? "Bağlanıyor..." : "Bağlantı Kur"}<ChevronRight size={15} /></span></button>)}</div></section>
    <p className="mt-3 flex items-start gap-2 text-xs text-slate-500"><ShieldCheck size={14} className="mt-0.5 shrink-0" />İzin ve uygulama parolası bilgileri şifreli olarak saklanır. İSG Panel e-posta parolanızı görmez veya saklamaz.</p>
    {manualProvider && <ManualConnectionDialog provider={manualProvider} onClose={() => setManualProvider(null)} onSaved={(savedIntegration) => { setIntegration(savedIntegration); setManualProvider(null); }} />}
  </>;
}

export default function MailEntegrasyonlari() {
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = location.pathname.startsWith("/ticari/admin");
  const tab = new URLSearchParams(location.search).get("tab") === "fatura" ? "fatura" : "mail";
  const setTab = (next) => navigate(`${location.pathname}?tab=${next}`, { replace: true });
  if (isAdmin) return <main className="p-3 text-[#042f4b] sm:p-4 md:p-6"><div className="mx-auto max-w-6xl"><PageTitle admin /><div className="mb-4 flex border-b border-slate-200"><button onClick={() => setTab("mail")} className={`px-4 py-2 text-sm font-medium ${tab === "mail" ? "border-b-2 border-[#042f4b] text-[#042f4b]" : "text-slate-500"}`}>E-posta Entegrasyonları</button><button onClick={() => setTab("fatura")} className={`px-4 py-2 text-sm font-medium ${tab === "fatura" ? "border-b-2 border-[#042f4b] text-[#042f4b]" : "text-slate-500"}`}>İSG Fatura Entegrasyonu</button></div>{tab === "mail" ? <div className="mx-auto max-w-2xl"><MailConnectionPanel /></div> : <IsgFaturaEntegrasyon />}</div></main>;
  return <main className="p-3 text-[#042f4b] sm:p-4 md:p-6"><section className="mx-auto mt-6 max-w-2xl rounded bg-white p-6 shadow-md"><PageTitle /><MailConnectionPanel /></section></main>;
}
