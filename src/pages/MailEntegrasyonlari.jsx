import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CheckCircle2, ChevronRight, Mail, ShieldCheck } from "lucide-react";
import { API_BASE } from "../config/api";
import IsgFaturaEntegrasyon from "./Ticari/IsgFaturaEntegrasyon";

const API = `${API_BASE.endsWith("/api") ? API_BASE : `${API_BASE}/api`}/mail-integrations`;
const providers = [
  { id: "gmail", name: "Gmail", description: "Google hesabınızı seçerek güvenli bağlantı kurun.", color: "bg-red-50 text-red-600" },
  { id: "zoho", name: "Zoho Mail", description: "Zoho hesabınızı seçerek belge paylaşımlarına bağlayın.", color: "bg-amber-50 text-amber-700" },
  { id: "microsoft", name: "Microsoft 365", description: "Microsoft hesabınızı seçerek bağlantı kurun.", color: "bg-blue-50 text-blue-700" },
];
function headers() { const token = localStorage.getItem("token") || sessionStorage.getItem("token") || localStorage.getItem("authToken") || ""; return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }; }

function MailConnectionPanel() {
  const [integration, setIntegration] = useState(null); const [loading, setLoading] = useState(true); const [connecting, setConnecting] = useState(""); const [error, setError] = useState("");
  async function load() { const response = await fetch(`${API}/me`, { headers: headers() }); const data = await response.json(); if (!response.ok) throw new Error(data.message || "Entegrasyon bilgisi alınamadı."); setIntegration(data.integration || null); setLoading(false); }
  useEffect(() => { load().catch((err) => { setError(err.message); setLoading(false); }); }, []);
  async function connect(provider) { try { setError(""); setConnecting(provider); const response = await fetch(`${API}/oauth/${provider}/start`, { method: "POST", headers: headers() }); const data = await response.json(); if (!response.ok) throw new Error(data.message || "Bağlantı başlatılamadı."); const popup = window.open(data.url, "mailIntegration", "width=560,height=720"); if (!popup) throw new Error("Bağlantı penceresi engellendi. Tarayıcınızdan açılır pencereye izin veriniz."); const timer = window.setInterval(() => { if (popup.closed) { window.clearInterval(timer); setConnecting(""); load().catch(() => null); } }, 700); } catch (err) { setError(err.message); setConnecting(""); } }
  if (loading) return <div className="p-6 text-xs text-slate-500">Entegrasyonlar yükleniyor...</div>;
  return <>{error && <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}{integration && <div className="mb-4 flex items-center gap-2 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700"><CheckCircle2 size={14}/><span><strong>{integration.email}</strong> hesabı bağlı; belge paylaşımında otomatik gönderici olarak kullanılacak.</span></div>}<section className="overflow-hidden rounded border border-slate-200 bg-white shadow-md"><div className="border-b border-slate-200 p-6"><h2 className="text-lg font-bold">E-posta Hesabı Bağla</h2><p className="mt-1 text-xs text-slate-500">Sağlayıcınızı seçin; açılan güvenli pencerede e-posta hesabınıza izin verin.</p></div><div className="divide-y divide-slate-100">{providers.map((provider) => <button key={provider.id} type="button" onClick={() => connect(provider.id)} disabled={Boolean(connecting)} className="flex w-full items-center gap-3 px-6 py-4 text-left transition hover:bg-slate-50 disabled:opacity-60"><span className={`flex h-9 w-9 items-center justify-center rounded ${provider.color}`}><Mail size={18}/></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{provider.name}</span><span className="mt-0.5 block text-xs text-slate-500">{provider.description}</span></span><span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600">{connecting === provider.id ? "Bağlanıyor..." : "Bağlantı Kur"}<ChevronRight size={15}/></span></button>)}</div></section><p className="mt-3 flex items-start gap-2 text-xs text-slate-500"><ShieldCheck size={14} className="mt-0.5 shrink-0"/>İzin bilgileri şifreli olarak saklanır. İSG Panel e-posta parolanızı görmez veya saklamaz.</p></>;
}

export default function MailEntegrasyonlari() {
  const location = useLocation(); const navigate = useNavigate();
  const isAdmin = location.pathname.startsWith("/ticari/admin");
  const tab = new URLSearchParams(location.search).get("tab") === "fatura" ? "fatura" : "mail";
  const setTab = (next) => navigate(`${location.pathname}?tab=${next}`, { replace: true });
  if (isAdmin) return <main className="p-3 text-[#042f4b] sm:p-4 md:p-6"><div className="mx-auto max-w-6xl"><h1 className="mb-1 text-xl font-bold">Entegrasyonlar</h1><p className="mb-4 text-xs text-slate-500">E-posta gönderim ve İSG Fatura bağlantılarınızı tek yerden yönetin.</p><div className="mb-4 flex border-b border-slate-200"><button onClick={() => setTab("mail")} className={`px-4 py-2 text-sm font-medium ${tab === "mail" ? "border-b-2 border-[#042f4b] text-[#042f4b]" : "text-slate-500"}`}>E-posta Entegrasyonları</button><button onClick={() => setTab("fatura")} className={`px-4 py-2 text-sm font-medium ${tab === "fatura" ? "border-b-2 border-[#042f4b] text-[#042f4b]" : "text-slate-500"}`}>İSG Fatura Entegrasyonu</button></div>{tab === "mail" ? <div className="mx-auto max-w-3xl"><MailConnectionPanel /></div> : <IsgFaturaEntegrasyon />}</div></main>;
  return <main className="p-3 text-[#042f4b] sm:p-4 md:p-6"><div className="mx-auto mt-6 max-w-2xl"><div className="mb-4"><h1 className="text-lg font-bold">E-posta Entegrasyonları</h1><p className="mt-1 text-xs text-slate-500">Belge paylaşımında <strong>E-posta ile Gönder</strong> seçildiğinde bağlantı kurduğunuz hesap otomatik gönderici olarak kullanılır.</p></div><MailConnectionPanel /></div></main>;
}
