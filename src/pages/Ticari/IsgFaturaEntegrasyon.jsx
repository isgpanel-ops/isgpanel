import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  ArrowRightLeft,
  Building2,
  CheckCircle2,
  Clock3,
  Copy,
  Link2,
  RefreshCw,
  ShieldCheck,
  Unplug,
  Users,
} from "lucide-react";
import { API_BASE } from "../../config/api";

function tokenHeader() {
  const token = localStorage.getItem("token") || sessionStorage.getItem("token") || "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatDate(value) {
  if (!value) return "Henüz senkronizasyon yapılmadı";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Henüz senkronizasyon yapılmadı";
  return date.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function secondsLeft(expiresAt) {
  if (!expiresAt) return 0;
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

export default function IsgFaturaEntegrasyon() {
  const [status, setStatus] = useState(null);
  const [pairing, setPairing] = useState(null);
  const [remaining, setRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const codeDisplay = useMemo(() => {
    const code = String(pairing?.code || "");
    return code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : "— — —";
  }, [pairing]);

  async function loadStatus() {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/isg-fatura-integration/status`, {
        headers: tokenHeader(),
      });
      setStatus(response.data);
      setMessage(null);
    } catch (error) {
      setMessage({
        type: "error",
        text: error?.response?.data?.message || "Entegrasyon durumu alınamadı.",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStatus();
  }, []);

  useEffect(() => {
    if (!pairing?.expiresAt) return undefined;
    const update = () => setRemaining(secondsLeft(pairing.expiresAt));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [pairing?.expiresAt]);

  async function createCode() {
    try {
      setActionLoading(true);
      const response = await axios.post(
        `${API_BASE}/isg-fatura-integration/pairing-code`,
        {},
        { headers: tokenHeader() }
      );
      setPairing(response.data);
      setRemaining(secondsLeft(response.data.expiresAt));
      setMessage({ type: "success", text: "Tek kullanımlık bağlantı kodu oluşturuldu." });
    } catch (error) {
      setMessage({
        type: "error",
        text: error?.response?.data?.message || "Bağlantı kodu oluşturulamadı.",
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function copyCode() {
    if (!pairing?.code || remaining <= 0) return;
    await navigator.clipboard.writeText(pairing.code);
    setMessage({ type: "success", text: "Bağlantı kodu panoya kopyalandı." });
  }

  async function revokeConnection() {
    if (!window.confirm("İSG Fatura bağlantısı kaldırılsın mı? Kişi sayısı senkronizasyonu duracaktır.")) return;
    try {
      setActionLoading(true);
      await axios.delete(`${API_BASE}/isg-fatura-integration/connection`, {
        headers: tokenHeader(),
      });
      setPairing(null);
      await loadStatus();
      setMessage({ type: "success", text: "İSG Fatura bağlantısı kaldırıldı." });
    } catch (error) {
      setMessage({ type: "error", text: error?.response?.data?.message || "Bağlantı kaldırılamadı." });
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">
              <ArrowRightLeft className="h-4 w-4" /> Kurumsal Entegrasyon
            </div>
            <h1 className="text-2xl font-bold text-slate-900">İSG Fatura Bağlantısı</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Firma bilgilerinizi ilk aktarımda paylaşın, güncel çalışan sayılarını düzenli olarak İSG Fatura ile eşitleyin.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 self-start rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
            <ShieldCheck className="h-4 w-4" /> Ticari Kurumsal · Ticari Admin
          </div>
        </header>

        {message && (
          <div className={`rounded-xl border px-4 py-3 text-sm ${message.type === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
            {message.text}
          </div>
        )}

        <section className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#0a2b45] text-white">
                    <Link2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-red-600">İSG Fatura</p>
                    <h2 className="mt-1 font-semibold text-slate-900">Kurumsal hesap bağlantısı</h2>
                  </div>
                </div>
                {loading ? (
                  <span className="text-xs text-slate-400">Kontrol ediliyor…</span>
                ) : status?.connected ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" /> Bağlı
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                    <Unplug className="h-4 w-4" /> Bağlı değil
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-5 p-5">
              {status?.connected ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs text-emerald-700">Bağlı İSG Fatura hesabı</p>
                      <p className="mt-1 font-semibold text-slate-900">{status.connection?.faturaAccountName || "İSG Fatura"}</p>
                      <p className="mt-1 text-xs text-slate-500">Son senkronizasyon: {formatDate(status.connection?.lastSyncAt)}</p>
                    </div>
                    <button onClick={revokeConnection} disabled={actionLoading} className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">
                      <Unplug className="h-4 w-4" /> Bağlantıyı Kaldır
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">1. Tek kullanımlık kod oluşturun</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">Bu kodu İSG Fatura uygulamasındaki Yönetici → Entegrasyon ekranına girin.</p>
                  </div>
                  <div className="rounded-2xl bg-[#0a2b45] p-5 text-white">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs text-slate-300">BAĞLANTI KODU</p>
                        <p className="mt-2 font-mono text-3xl font-bold tracking-[0.18em]">{remaining > 0 ? codeDisplay : "— — —"}</p>
                      </div>
                      {remaining > 0 && (
                        <button onClick={copyCode} className="grid h-10 w-10 place-items-center rounded-lg bg-white/10 hover:bg-white/20" title="Kodu kopyala">
                          <Copy className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
                      <span className="inline-flex items-center gap-2 text-xs text-slate-300">
                        <Clock3 className="h-4 w-4" /> {remaining > 0 ? `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")} içinde geçerli` : "Yeni kod oluşturun"}
                      </span>
                      <button onClick={createCode} disabled={actionLoading} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                        <RefreshCw className={`h-4 w-4 ${actionLoading ? "animate-spin" : ""}`} /> {pairing ? "Yeni Kod" : "Kod Oluştur"}
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">Kod 5 dakika geçerlidir, yalnızca bir kez kullanılabilir ve başka bir İSG Fatura hesabıyla paylaşılamaz.</p>
                </>
              )}
            </div>
          </div>

          <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-900">Bağlantı kapsamı</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">İSG Fatura yalnızca faturalama için gereken alanları okuyabilir.</p>
            <div className="mt-5 space-y-3">
              {[
                [Building2, "İlk firma aktarımı", "Firma adı, adres ve tehlike sınıfı"],
                [Users, "Güncel çalışan sayısı", "İlk aktarım ve düzenli senkronizasyon"],
                [ShieldCheck, "Salt okunur erişim", "İSG Panel verilerini değiştiremez veya silemez"],
              ].map(([Icon, title, text]) => (
                <div key={title} className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-[#0a2b45] shadow-sm"><Icon className="h-4 w-4" /></div>
                  <div><p className="text-xs font-semibold text-slate-800">{title}</p><p className="mt-1 text-[11px] leading-4 text-slate-500">{text}</p></div>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-5 text-amber-800">
              Bu özellik bireysel ve Ticari Kullanıcı hesaplarında bulunmaz. Bağlantı yalnızca aktif Ticari Kurumsal abonelikte çalışır.
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}
