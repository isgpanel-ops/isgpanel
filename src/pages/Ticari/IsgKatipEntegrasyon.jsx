import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Hourglass,
  RefreshCw,
  Search,
  ShieldAlert,
  UserPlus,
} from "lucide-react";

const tabs = [
  { key: "atanmamis", label: "Atanmamış Firmalar" },
  { key: "atama_yok", label: "İSG-KATİP Ataması Olmayanlar" },
  { key: "onay_bekleyen", label: "Onay Bekleyenler" },
  { key: "aktif", label: "Aktif Atamalar" },
  { key: "dusen", label: "Düşen Atamalar" },
];

const statusOptions = [
  ["kontrol_edilmedi", "Kontrol Edilmedi"],
  ["atama_yok", "İSG-KATİP Ataması Yok"],
  ["profesyonel_onayi_bekliyor", "Profesyonel Onayı Bekliyor"],
  ["isveren_onayi_bekliyor", "İşveren Onayı Bekliyor"],
  ["atama_onaylandi", "Atama Onaylandı"],
  ["atama_dustu", "Atama Düştü"],
  ["yeniden_atama_gerekli", "Yeniden Atama Gerekli"],
];

function tokenHeader() {
  const token = localStorage.getItem("token") || sessionStorage.getItem("token") || "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function fmtDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("tr-TR");
}

function fmtDateTime(value) {
  if (!value) return "Henüz yok";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Henüz yok";
  return date.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusClass(status) {
  if (status === "atama_onaylandi") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "atama_dustu" || status === "yeniden_atama_gerekli") return "bg-rose-50 text-rose-700 border-rose-200";
  if (status === "profesyonel_onayi_bekliyor" || status === "isveren_onayi_bekliyor") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-slate-50 text-slate-600 border-slate-200";
}

function hazardClass(value) {
  const v = String(value || "").toLocaleLowerCase("tr-TR");
  if (v.includes("çok")) return "bg-rose-50 text-rose-700 border-rose-200";
  if (v.includes("az")) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

function StatCard({ title, value, sub, icon: Icon, tone, active, onClick }) {
  const tones = {
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    blue: "border-sky-200 bg-sky-50 text-sky-700",
    slate: "border-slate-200 bg-white text-slate-700",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[92px] rounded-lg border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        tones[tone] || tones.slate
      } ${active ? "ring-2 ring-[#0a2b45]/20" : ""}`}
    >
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/70">
          <Icon className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block text-xs font-semibold">{title}</span>
          <span className="mt-1 block text-2xl font-bold text-slate-900">{value}</span>
          <span className="mt-1 block text-[11px] text-slate-600">{sub}</span>
        </span>
      </div>
    </button>
  );
}

export default function IsgKatipEntegrasyon() {
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({});
  const [activeTab, setActiveTab] = useState("atanmamis");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadOverview = async () => {
    setError("");
    setLoading(true);
    try {
      const { data } = await axios.get("/api/isg-katip/overview", {
        headers: tokenHeader(),
      });
      setItems(Array.isArray(data?.items) ? data.items : []);
      setCounts(data?.counts || {});
      setLastSyncAt(data?.lastSyncAt || null);
      const first = (data?.items || []).find((item) => item.category === activeTab) || data?.items?.[0] || null;
      setSelected((prev) => {
        if (!prev) return first;
        return (data?.items || []).find((item) => item.id === prev.id) || first;
      });
    } catch (err) {
      setError(err?.response?.data?.message || "İSG-KATİP verileri alınamadı.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleItems = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    return items
      .filter((item) => item.category === activeTab)
      .filter((item) => {
        if (!q) return true;
        return [item.firmaAdi, item.sgkNo, item.assignedUserName]
          .join(" ")
          .toLocaleLowerCase("tr-TR")
          .includes(q);
      });
  }, [activeTab, items, query]);

  useEffect(() => {
    if (!visibleItems.length) return;
    if (!selected || !visibleItems.some((item) => item.id === selected.id)) {
      setSelected(visibleItems[0]);
    }
  }, [selected, visibleItems]);

  const sync = async () => {
    setSaving(true);
    setError("");
    try {
      const { data } = await axios.post("/api/isg-katip/sync", {}, { headers: tokenHeader() });
      setItems(Array.isArray(data?.items) ? data.items : []);
      setCounts(data?.counts || {});
      setLastSyncAt(data?.lastSyncAt || new Date().toISOString());
    } catch (err) {
      setError(err?.response?.data?.message || "Senkronizasyon çalıştırılamadı.");
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (status) => {
    if (!selected?.firmaId) return;
    setSaving(true);
    setError("");
    try {
      await axios.patch(
        `/api/isg-katip/${selected.firmaId}/status`,
        { isgKatipStatus: status },
        { headers: tokenHeader() }
      );
      await loadOverview();
    } catch (err) {
      setError(err?.response?.data?.message || "Durum kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  const startAssignment = async (target = selected) => {
    if (!target?.firmaId) return;
    setSaving(true);
    setError("");
    try {
      await axios.post(`/api/isg-katip/${target.firmaId}/start`, {}, { headers: tokenHeader() });
      await loadOverview();
    } catch (err) {
      setError(err?.response?.data?.message || "Atama süreci başlatılamadı.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-[1500px] space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#0a2b45]">Atama Yönetimi</h1>
            <p className="mt-1 text-sm text-slate-500">
              Panel kullanıcı atamaları ve İSG-KATİP sözleşme durumları tek merkezde takip edilir.
            </p>
          </div>
          <div className="rounded-lg border border-sky-200 bg-white p-3 shadow-sm">
            <div className="text-xs font-semibold text-[#0a2b45]">İSG-KATİP Senkronizasyonu</div>
            <div className="mt-1 text-[11px] text-slate-500">Son kontrol: {fmtDateTime(lastSyncAt)}</div>
            <button
              type="button"
              onClick={sync}
              disabled={saving}
              className="mt-2 inline-flex h-9 items-center gap-2 rounded-md bg-[#0a2b45] px-4 text-xs font-semibold text-white hover:bg-[#123b5d] disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${saving ? "animate-spin" : ""}`} />
              Senkronize Et
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-5">
          <StatCard title="Atanmamış Firmalar" value={counts.atanmamis || 0} sub="Kullanıcı atanmayı bekliyor" icon={ShieldAlert} tone="rose" active={activeTab === "atanmamis"} onClick={() => setActiveTab("atanmamis")} />
          <StatCard title="İSG-KATİP Ataması Yok" value={counts.atama_yok || 0} sub="Panelde atanmış, resmi atama yok" icon={FileCheck2} tone="amber" active={activeTab === "atama_yok"} onClick={() => setActiveTab("atama_yok")} />
          <StatCard title="Onay Bekleyenler" value={counts.onay_bekleyen || 0} sub="Profesyonel veya işveren onayı" icon={Hourglass} tone="blue" active={activeTab === "onay_bekleyen"} onClick={() => setActiveTab("onay_bekleyen")} />
          <StatCard title="Aktif Atamalar" value={counts.aktif || 0} sub="İSG-KATİP'te aktif sözleşme" icon={CheckCircle2} tone="emerald" active={activeTab === "aktif"} onClick={() => setActiveTab("aktif")} />
          <StatCard title="Düşen Atamalar" value={counts.dusen || 0} sub="Yeniden işlem gerekli" icon={AlertTriangle} tone="rose" active={activeTab === "dusen"} onClick={() => setActiveTab("dusen")} />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap border-b bg-slate-50">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`border-r px-4 py-3 text-xs font-semibold transition ${
                    activeTab === tab.key
                      ? "bg-white text-[#0a2b45] shadow-[inset_0_-2px_0_#0a2b45]"
                      : "text-slate-500 hover:bg-white"
                  }`}
                >
                  {tab.label} ({counts[tab.key] || 0})
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-3 border-b p-3 md:flex-row md:items-center md:justify-between">
              <div className="relative w-full md:max-w-sm">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Firma, SGK Sicil No veya kullanıcı ara..."
                  className="h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-[#0a2b45]"
                />
              </div>
              <div className="text-xs text-slate-500">
                {loading ? "Yükleniyor..." : `Toplam ${visibleItems.length} kayıt`}
              </div>
            </div>

            <div className="max-h-[520px] overflow-auto">
              <table className="min-w-[920px] w-full text-xs">
                <thead className="sticky top-0 bg-white text-slate-500 shadow-sm">
                  <tr>
                    <th className="px-3 py-3 text-left font-semibold">#</th>
                    <th className="px-3 py-3 text-left font-semibold">Firma Adı</th>
                    <th className="px-3 py-3 text-left font-semibold">SGK Sicil No</th>
                    <th className="px-3 py-3 text-left font-semibold">Tehlike Sınıfı</th>
                    <th className="px-3 py-3 text-left font-semibold">Atanan Kullanıcı</th>
                    <th className="px-3 py-3 text-left font-semibold">İSG-KATİP Durumu</th>
                    <th className="px-3 py-3 text-right font-semibold">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleItems.map((item, index) => (
                    <tr
                      key={item.id}
                      onClick={() => setSelected(item)}
                      className={`cursor-pointer hover:bg-slate-50 ${
                        selected?.id === item.id ? "bg-sky-50/70" : ""
                      }`}
                    >
                      <td className="px-3 py-3 text-slate-500">{index + 1}</td>
                      <td className="px-3 py-3 font-semibold text-slate-800">{item.firmaAdi}</td>
                      <td className="px-3 py-3 tabular-nums text-slate-600">{item.sgkNo || "-"}</td>
                      <td className="px-3 py-3">
                        <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${hazardClass(item.tehlike)}`}>
                          {item.tehlike || "-"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{item.assignedUserName || "-"}</td>
                      <td className="px-3 py-3">
                        <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${statusClass(item.isgKatipStatus)}`}>
                          {item.isgKatipStatusLabel}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelected(item);
                            startAssignment(item);
                          }}
                          disabled={saving || !item.assignedUserId}
                          className="inline-flex h-8 items-center gap-1 rounded-md bg-emerald-600 px-3 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          Başlat
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!loading && visibleItems.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-500">
                        Bu kategoride kayıt bulunamadı.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b px-4 py-3">
              <h2 className="text-sm font-bold text-[#0a2b45]">Firma Detayı</h2>
              <p className="text-xs text-slate-500">Seçili firma ve atama bilgileri</p>
            </div>
            {selected ? (
              <div className="space-y-4 p-4 text-sm">
                <div>
                  <div className="font-bold text-slate-900">{selected.firmaAdi}</div>
                  <div className="mt-1 text-xs text-slate-500">SGK Sicil No: {selected.sgkNo || "-"}</div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-slate-500">Tehlike</div>
                    <div className="mt-1 font-semibold text-slate-800">{selected.tehlike || "-"}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Hazırlama</div>
                    <div className="mt-1 font-semibold text-slate-800">{fmtDate(selected.hazirlama)}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Geçerlilik</div>
                    <div className="mt-1 font-semibold text-slate-800">{fmtDate(selected.gecerlilik)}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Atanan Kullanıcı</div>
                    <div className="mt-1 font-semibold text-slate-800">{selected.assignedUserName || "-"}</div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <Clock3 className="h-4 w-4" />
                    İSG-KATİP Durumu
                  </div>
                  <select
                    value={selected.isgKatipStatus || "kontrol_edilmedi"}
                    onChange={(event) => updateStatus(event.target.value)}
                    disabled={saving}
                    className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs outline-none focus:border-[#0a2b45]"
                  >
                    {statusOptions.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={startAssignment}
                  disabled={saving || !selected.assignedUserId}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#0a2b45] text-sm font-semibold text-white hover:bg-[#123b5d] disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <UserPlus className="h-4 w-4" />
                  Atama Sürecini Başlat
                </button>

                {!selected.assignedUserId && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                    Bu firma için önce panel kullanıcısı atanmalıdır.
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 text-sm text-slate-500">Detay için listeden firma seçin.</div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
