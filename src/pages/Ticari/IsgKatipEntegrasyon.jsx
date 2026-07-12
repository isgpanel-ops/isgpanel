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

const brand = {
  primary: "#0a2b45",
  ring: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#0a2b45]",
};

const btn = {
  base: `inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition shadow-sm disabled:opacity-60 disabled:cursor-not-allowed ${brand.ring}`,
  primary: "bg-[#2563eb] text-white hover:bg-[#1d4ed8]",
  ghost: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50",
  success: "bg-[#16a34a] text-white hover:bg-[#15803d]",
  dark: "bg-[#2563eb] text-white hover:bg-[#1d4ed8]",
};

const inputClass = `w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs shadow-sm placeholder:text-slate-400 focus:border-[#0a2b45] ${brand.ring}`;

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

const gorevTurleri = [
  { key: "is_guvenligi_uzmani", label: "İş Güvenliği Uzmanı", short: "Uzman" },
  { key: "isyeri_hekimi", label: "İşyeri Hekimi", short: "Hekim" },
  { key: "diger_saglik_personeli", label: "Diğer Sağlık Personeli", short: "DSP" },
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
    rose: "border-rose-200 bg-rose-50/60 text-rose-700",
    amber: "border-amber-200 bg-amber-50/70 text-amber-700",
    emerald: "border-emerald-200 bg-emerald-50/70 text-emerald-700",
    blue: "border-sky-200 bg-sky-50/70 text-sky-700",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[78px] rounded-lg border p-3 text-left shadow-sm transition hover:bg-white ${
        tones[tone]
      } ${active ? "ring-2 ring-[#0a2b45]/20" : ""}`}
    >
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white">
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block text-[11px] font-semibold">{title}</span>
          <span className="block text-xl font-bold text-slate-900">{value}</span>
          <span className="block truncate text-[10px] text-slate-600">{sub}</span>
        </span>
      </div>
    </button>
  );
}

export default function IsgKatipEntegrasyon() {
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({});
  const [candidateUsers, setCandidateUsers] = useState([]);
  const [gorevTuru, setGorevTuru] = useState("is_guvenligi_uzmani");
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
        params: { gorevTuru },
      });
      const nextItems = Array.isArray(data?.items) ? data.items : [];
      setItems(nextItems);
      setCounts(data?.counts || {});
      setCandidateUsers(Array.isArray(data?.candidateUsers) ? data.candidateUsers : []);
      setLastSyncAt(data?.lastSyncAt || null);
      setSelected((prev) => {
        if (prev && nextItems.some((item) => item.id === prev.id && item.category === activeTab)) {
          return nextItems.find((item) => item.id === prev.id) || null;
        }
        return nextItems.find((item) => item.category === activeTab) || null;
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
  }, [gorevTuru]);

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
    if (!visibleItems.length) {
      setSelected(null);
      return;
    }
    if (!selected || !visibleItems.some((item) => item.id === selected.id)) {
      setSelected(visibleItems[0]);
    }
  }, [activeTab, selected, visibleItems]);

  const sync = async () => {
    setSaving(true);
    setError("");
    try {
      const { data } = await axios.post(
        "/api/isg-katip/sync",
        { gorevTuru },
        { headers: tokenHeader() }
      );
      setItems(Array.isArray(data?.items) ? data.items : []);
      setCounts(data?.counts || {});
      setCandidateUsers(Array.isArray(data?.candidateUsers) ? data.candidateUsers : []);
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
        { isgKatipStatus: status, gorevTuru },
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
      await axios.post(
        `/api/isg-katip/${target.firmaId}/start`,
        { gorevTuru },
        { headers: tokenHeader() }
      );
      await loadOverview();
    } catch (err) {
      setError(err?.response?.data?.message || "Atama süreci başlatılamadı.");
    } finally {
      setSaving(false);
    }
  };

  const assignUser = async (userId) => {
    if (!selected?.firmaId || !userId) return;
    setSaving(true);
    setError("");
    try {
      const { data } = await axios.post(
        `/api/isg-katip/${selected.firmaId}/assign-user`,
        { userId, gorevTuru },
        { headers: tokenHeader() }
      );
      const nextItems = Array.isArray(data?.items) ? data.items : [];
      setItems(nextItems);
      setCounts(data?.counts || {});
      setCandidateUsers(Array.isArray(data?.candidateUsers) ? data.candidateUsers : []);
      setLastSyncAt(data?.lastSyncAt || lastSyncAt);
      setSelected(nextItems.find((item) => item.id === selected.id) || null);
    } catch (err) {
      setError(err?.response?.data?.message || "Kullanıcı ataması kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  const startDisabled =
    saving ||
    !selected?.assignedUserId ||
    selected?.assignedUserTcKimlikVar === false;

  return (
    <div className="p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#042f4b] mb-1">Atama Yönetimi</h2>
            <p className="text-slate-500 text-xs">
              Panel kullanıcı atamalarını ve İSG-KATİP sözleşme durumlarını takip edin.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden md:block text-right text-[11px] text-slate-500">
              <div className="font-semibold text-slate-700">İSG-KATİP Senkronizasyonu</div>
              <div>Son kontrol: {fmtDateTime(lastSyncAt)}</div>
            </div>
            <button type="button" onClick={sync} disabled={saving} className={`${btn.base} ${btn.dark}`}>
              <RefreshCw className={`h-3.5 w-3.5 ${saving ? "animate-spin" : ""}`} />
              Senkronize Et
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
          <span className="px-2 text-xs font-semibold text-slate-600">Görev Türü</span>
          {gorevTurleri.map((type) => (
            <button
              key={type.key}
              type="button"
              onClick={() => {
                setGorevTuru(type.key);
                setActiveTab("atanmamis");
              }}
              className={`${btn.base} ${
                gorevTuru === type.key ? btn.primary : btn.ghost
              }`}
              title={type.label}
            >
              {type.short}
            </button>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-5">
          <StatCard title="Atanmamış Firmalar" value={counts.atanmamis || 0} sub="Kullanıcı atanmayı bekliyor" icon={ShieldAlert} tone="rose" active={activeTab === "atanmamis"} onClick={() => setActiveTab("atanmamis")} />
          <StatCard title="İSG-KATİP Ataması Yok" value={counts.atama_yok || 0} sub="Panelde atanmış, resmi atama yok" icon={FileCheck2} tone="amber" active={activeTab === "atama_yok"} onClick={() => setActiveTab("atama_yok")} />
          <StatCard title="Onay Bekleyenler" value={counts.onay_bekleyen || 0} sub="Profesyonel veya işveren onayı" icon={Hourglass} tone="blue" active={activeTab === "onay_bekleyen"} onClick={() => setActiveTab("onay_bekleyen")} />
          <StatCard title="Aktif Atamalar" value={counts.aktif || 0} sub="İSG-KATİP'te aktif sözleşme" icon={CheckCircle2} tone="emerald" active={activeTab === "aktif"} onClick={() => setActiveTab("aktif")} />
          <StatCard title="Düşen Atamalar" value={counts.dusen || 0} sub="Yeniden işlem gerekli" icon={AlertTriangle} tone="rose" active={activeTab === "dusen"} onClick={() => setActiveTab("dusen")} />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow">
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
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Firma, SGK Sicil No veya kullanıcı ara..."
                  className={`${inputClass} pl-8`}
                />
              </div>
              <div className="text-xs text-slate-500">
                {loading ? "Yükleniyor..." : `Toplam ${visibleItems.length} kayıt`}
              </div>
            </div>

            <div className="max-h-[520px] overflow-auto">
              <table className="min-w-[920px] w-full text-xs">
                <thead className="sticky top-0 bg-slate-50 text-slate-600 z-10">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold border-b">#</th>
                    <th className="px-3 py-2 text-left font-semibold border-b">Firma Adı</th>
                    <th className="px-3 py-2 text-left font-semibold border-b">SGK Sicil No</th>
                    <th className="px-3 py-2 text-left font-semibold border-b">Tehlike Sınıfı</th>
                    <th className="px-3 py-2 text-left font-semibold border-b">Atanan Kullanıcı</th>
                    <th className="px-3 py-2 text-left font-semibold border-b">İSG-KATİP Durumu</th>
                    <th className="px-3 py-2 text-right font-semibold border-b">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {visibleItems.map((item, index) => (
                    <tr
                      key={item.id}
                      onClick={() => setSelected(item)}
                      className={`cursor-pointer hover:bg-slate-50 ${
                        selected?.id === item.id ? "bg-[#0a2b45]/5" : ""
                      }`}
                    >
                      <td className="px-3 py-2">{index + 1}</td>
                      <td className="px-3 py-2 font-medium text-slate-800">{item.firmaAdi}</td>
                      <td className="px-3 py-2 tabular-nums">{item.sgkNo || "-"}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${hazardClass(item.tehlike)}`}>
                          {item.tehlike || "-"}
                        </span>
                      </td>
                      <td className="px-3 py-2">{item.assignedUserName || "-"}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${statusClass(item.isgKatipStatus)}`}>
                          {item.isgKatipStatusLabel}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelected(item);
                            startAssignment(item);
                          }}
                          disabled={saving || !item.assignedUserId || item.assignedUserTcKimlikVar === false}
                          className={`${btn.base} ${btn.success} !px-2`}
                          title={!item.assignedUserTcKimlikVar ? "Atanan kullanıcının TC kimlik numarası eksik" : "Atama sürecini başlat"}
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

          <aside className="rounded-xl border border-slate-200 bg-white shadow">
            <div className="border-b px-4 py-3">
              <h3 className="text-sm font-semibold text-[#042f4b]">Firma Detayı</h3>
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
                  <div>
                    <div className="text-slate-500">Görev Türü</div>
                    <div className="mt-1 font-semibold text-slate-800">
                      {gorevTurleri.find((type) => type.key === gorevTuru)?.label || "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">TC Kimlik</div>
                    <div className={`mt-1 font-semibold ${selected.assignedUserTcKimlikVar ? "text-slate-800" : "text-rose-700"}`}>
                      {selected.assignedUserId ? (selected.assignedUserTcKimlik || "Eksik") : "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Sertifika</div>
                    <div className="mt-1 font-semibold text-slate-800">
                      {selected.assignedUserId ? (selected.assignedUserSertifikaNoVar ? "Kayıtlı" : "Eksik") : "-"}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 text-xs font-semibold text-slate-700">
                    Bu Görev İçin Kullanıcı Ata
                  </div>
                  <select
                    value={selected.assignedUserId || ""}
                    onChange={(event) => assignUser(event.target.value)}
                    disabled={saving || candidateUsers.length === 0}
                    className={inputClass}
                  >
                    <option value="">
                      {candidateUsers.length === 0 ? "Uygun kullanıcı yok" : "Kullanıcı seçiniz"}
                    </option>
                    {candidateUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} {user.tcKimlik ? `- ${user.tcKimlik}` : ""}
                      </option>
                    ))}
                  </select>
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
                    className={inputClass}
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
                  onClick={() => startAssignment(selected)}
                  disabled={startDisabled}
                  className={`${btn.base} ${btn.dark} h-10 w-full`}
                >
                  <UserPlus className="h-4 w-4" />
                  Atama Sürecini Başlat
                </button>

                {!selected.assignedUserId && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                    Bu firma için önce geçerli bir ticari kullanıcı atanmalıdır.
                  </div>
                )}

                {selected.assignedUserId && !selected.assignedUserTcKimlikVar && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                    Atama başlatmak için atanan kullanıcının kişisel bilgilerinde TC kimlik numarası kayıtlı olmalıdır.
                  </div>
                )}

                {selected.panelAssignmentProblem && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                    {selected.panelAssignmentProblem}
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

