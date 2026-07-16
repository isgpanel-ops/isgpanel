import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  CheckCircle2,
  Clock3,
  FileCheck2,
  Hourglass,
  RefreshCw,
  Search,
  ShieldAlert,
  UserPlus,
} from "lucide-react";
import { API_BASE } from "../../config/api";

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
];

const statusOptions = [
  ["kontrol_edilmedi", "Kontrol Edilmedi"],
  ["atama_yok", "İSG-KATİP Ataması Yok"],
  ["profesyonel_onayi_bekliyor", "Profesyonel Onayı Bekliyor"],
  ["isveren_onayi_bekliyor", "İşveren Onayı Bekliyor"],
  ["atama_onaylandi", "Atama Onaylandı"],
];

const gorevTurleri = [
  { key: "is_guvenligi_uzmani", label: "İş Güvenliği Uzmanı", short: "Uzman" },
  { key: "isyeri_hekimi", label: "İşyeri Hekimi", short: "Hekim" },
  { key: "diger_saglik_personeli", label: "Diğer Sağlık Personeli", short: "DSP" },
];

function roleAwareStatusLabel(status, gorevShort = "Uzman") {
  if (status === "profesyonel_onayi_bekliyor") return `${gorevShort} Onayı Bekliyor`;
  if (status === "isveren_onayi_bekliyor") return "İşveren Onayı Bekliyor";
  if (status === "atama_onaylandi") return "Atama Onaylandı";
  if (status === "atama_yok") return "İSG-KATİP Ataması Yok";
  if (status === "atama_dustu" || status === "yeniden_atama_gerekli") return "Atama Düştü";
  return "Kontrol Edilmedi";
}

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

function fmtEmployeeCount(value) {
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? count.toLocaleString("tr-TR") : "-";
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

function hasValidTc(value) {
  return String(value || "").replace(/\D/g, "").length === 11;
}

function requestIsgKatipExtensionSync({ apiBase, token, gorevTuru }) {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Tarayıcı ortamı bulunamadı."));
      return;
    }

    const requestId = `isg-katip-sync-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const timer = window.setTimeout(() => {
      window.removeEventListener("message", handleMessage);
      reject(new Error("İSG-KATİP senkronizasyonu zaman aşımına uğradı. Çok sayfalı liste taranıyorsa İSG-KATİP sekmesini açık bırakıp tekrar deneyin."));
    }, 240000);

    function handleMessage(event) {
      if (event.source !== window) return;
      const message = event.data;
      if (
        !message ||
        message.source !== "ISG_PANEL_ISG_KATIP_EXTENSION" ||
        message.type !== "ISG_KATIP_SYNC_RESPONSE" ||
        message.requestId !== requestId
      ) {
        return;
      }

      window.clearTimeout(timer);
      window.removeEventListener("message", handleMessage);
      if (!message.response?.ok) {
        reject(new Error(message.response?.message || "İSG-KATİP senkronizasyonu başarısız."));
        return;
      }
      resolve(message.response.data || {});
    }

    window.addEventListener("message", handleMessage);
    window.postMessage(
      {
        source: "ISG_PANEL_PAGE",
        type: "ISG_KATIP_SYNC_REQUEST",
        requestId,
        apiBase: String(apiBase || "").replace(/\/$/, ""),
        token,
        gorevTuru,
      },
      window.location.origin
    );
  });
}

function requestIsgKatipExtensionJobRun({ apiBase, token, gorevTuru, firmaId }) {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Tarayıcı ortamı bulunamadı."));
      return;
    }

    const requestId = `isg-katip-job-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const timer = window.setTimeout(() => {
      window.removeEventListener("message", handleMessage);
      reject(new Error("İSG-KATİP eklentisi atama görevine cevap vermedi."));
    }, 90000);

    function handleMessage(event) {
      if (event.source !== window) return;
      const message = event.data;
      if (
        !message ||
        message.source !== "ISG_PANEL_ISG_KATIP_EXTENSION" ||
        message.type !== "ISG_KATIP_RUN_JOB_RESPONSE" ||
        message.requestId !== requestId
      ) {
        return;
      }

      window.clearTimeout(timer);
      window.removeEventListener("message", handleMessage);
      if (!message.response?.ok) {
        reject(new Error(message.response?.message || "İSG-KATİP atama otomasyonu başarısız."));
        return;
      }
      resolve(message.response.data || {});
    }

    window.addEventListener("message", handleMessage);
    window.postMessage(
      {
        source: "ISG_PANEL_PAGE",
        type: "ISG_KATIP_RUN_JOB_REQUEST",
        requestId,
        apiBase: String(apiBase || "").replace(/\/$/, ""),
        token,
        gorevTuru,
        firmaId,
      },
      window.location.origin
    );
  });
}

function approvalDaysLeft(item) {
  const startValue = item?.lastSyncAt || item?.baslangicTarihi || item?.updatedAt;
  const start = startValue ? new Date(startValue) : null;
  if (!start || Number.isNaN(start.getTime())) return null;
  const elapsed = Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, 5 - elapsed);
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
  const [savedPeople, setSavedPeople] = useState([]);
  const [gorevTuru, setGorevTuru] = useState("is_guvenligi_uzmani");
  const [activeTab, setActiveTab] = useState("atanmamis");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkUserId, setBulkUserId] = useState("");
  const [pendingUserId, setPendingUserId] = useState("");
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [manualAssigneeForm, setManualAssigneeForm] = useState({ adSoyad: "", tcKimlik: "" });

  const isUzmanMode = gorevTuru === "is_guvenligi_uzmani";
  const selectedGorevLabel = gorevTurleri.find((type) => type.key === gorevTuru)?.label || "-";
  const selectedGorevShort = gorevTurleri.find((type) => type.key === gorevTuru)?.short || "Uzman";

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
      setSavedPeople(Array.isArray(data?.savedPeople) ? data.savedPeople : []);
      setLastSyncAt(data?.lastSyncAt || null);
      setSelected((prev) => {
        const matchesTab = (item) => item.category === activeTab;
        if (prev && nextItems.some((item) => item.id === prev.id && matchesTab(item))) {
          return nextItems.find((item) => item.id === prev.id) || null;
        }
        return nextItems.find(matchesTab) || null;
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

  useEffect(() => {
    setSelectedIds([]);
    setBulkUserId("");
    setPeopleOpen(false);
  }, [activeTab, gorevTuru]);

  const visibleItems = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    return items
      .filter((item) => item.category === activeTab)
      .filter((item) => {
        if (!q) return true;
        return [item.firmaAdi, item.sgkNo, item.assignedUserName, item.assignedDisplayName]
          .join(" ")
          .toLocaleLowerCase("tr-TR")
          .includes(q);
      })
      .sort((a, b) =>
        String(a.firmaAdi || "").localeCompare(String(b.firmaAdi || ""), "tr-TR", {
          sensitivity: "base",
          numeric: true,
        })
      );
  }, [activeTab, items, query]);

  const selectedItems = useMemo(() => {
    const selectedSet = new Set(selectedIds);
    return visibleItems.filter((item) => selectedSet.has(item.id));
  }, [selectedIds, visibleItems]);

  const isBulkMode = selectedItems.length > 1;
  const selectedFirmaIds = isBulkMode
    ? selectedItems.map((item) => item.firmaId)
    : selected?.firmaId
    ? [selected.firmaId]
    : [];
  const isPanelAssignmentTab = activeTab === "atanmamis";
  const isKatipStartTab = activeTab === "atama_yok";
  const isStartTab = isPanelAssignmentTab || isKatipStartTab;
  const isApprovalTab = activeTab === "onay_bekleyen";
  const isActiveTab = activeTab === "aktif";
  const canEditAssignee = isPanelAssignmentTab || isKatipStartTab;
  const manualFormValid =
    manualAssigneeForm.adSoyad.trim() && hasValidTc(manualAssigneeForm.tcKimlik);
  const selectedBulkUser = candidateUsers.find((user) => user.id === bulkUserId);
  const bulkUzmanReady = bulkUserId
    ? Boolean(selectedBulkUser?.tcKimlikVar)
    : selectedItems.every((item) => item.assignedUserId && item.assignedUserTcKimlikVar !== false);
  const bulkManualReady = selectedItems.every((item) => item.assignedUserTcKimlikVar) || manualFormValid;
  const tabCount = (key) => counts[key] || 0;
  const isInActiveView = (item) => item.category === activeTab;
  const actionLabel = isPanelAssignmentTab ? "Panel Atamasını Kaydet" : "Atama Sürecini Başlat";
  const changeAssigneeLabel = isStartTab ? actionLabel : "Personeli Değiştir";

  useEffect(() => {
    if (!visibleItems.length) {
      setSelected(null);
      return;
    }
    if (!selected || !visibleItems.some((item) => item.id === selected.id)) {
      setSelected(visibleItems[0]);
    }
  }, [activeTab, selected, visibleItems]);

  useEffect(() => {
    setManualAssigneeForm({
      adSoyad: isBulkMode ? "" : selected?.manualAssigneeName || "",
      tcKimlik: isBulkMode ? "" : selected?.manualAssigneeTcKimlik || "",
    });
  }, [isBulkMode, selected?.id, selected?.manualAssigneeName, selected?.manualAssigneeTcKimlik, gorevTuru]);

  useEffect(() => {
    setPendingUserId(isBulkMode ? "" : selected?.assignedUserId || "");
  }, [isBulkMode, selected?.id, selected?.assignedUserId, gorevTuru]);

  const sync = async () => {
    setSaving(true);
    setError("");
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token") || "";
      if (!token) throw new Error("Panel oturumu bulunamadı. Tekrar giriş yapın.");
      const data = await requestIsgKatipExtensionSync({
        apiBase: API_BASE,
        token,
        gorevTuru,
      });
      setItems(Array.isArray(data?.items) ? data.items : []);
      setCounts(data?.counts || {});
      setCandidateUsers(Array.isArray(data?.candidateUsers) ? data.candidateUsers : []);
      setSavedPeople(Array.isArray(data?.savedPeople) ? data.savedPeople : []);
      setLastSyncAt(data?.lastSyncAt || new Date().toISOString());
    } catch (err) {
      setError(err?.message || err?.response?.data?.message || "Senkronizasyon çalıştırılamadı.");
    } finally {
      setSaving(false);
    }
  };

  const runQueuedExtensionJob = async (options = {}) => {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token") || "";
    if (!token) return;
    try {
      const result = await requestIsgKatipExtensionJobRun({
        apiBase: API_BASE,
        token,
        gorevTuru,
        firmaId: options.firmaId,
      });
      if (result?.job) await loadOverview();
    } catch (err) {
      setError(
        `${err?.message || "İSG-KATİP eklentisi otomatik atamayı tamamlayamadı."} Görev kuyrukta kaldı; İSG-KATİP oturumu açıkken tekrar deneyebilirsiniz.`
      );
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

  const updateBulkStatus = async (status) => {
    if (selectedFirmaIds.length === 0) return;
    setSaving(true);
    setError("");
    try {
      const { data } = await axios.patch(
        "/api/isg-katip/bulk/status",
        { isgKatipStatus: status, gorevTuru, firmaIds: selectedFirmaIds },
        { headers: tokenHeader() }
      );
      const nextItems = Array.isArray(data?.items) ? data.items : [];
      setItems(nextItems);
      setCounts(data?.counts || {});
      setCandidateUsers(Array.isArray(data?.candidateUsers) ? data.candidateUsers : []);
      setSavedPeople(Array.isArray(data?.savedPeople) ? data.savedPeople : []);
      setLastSyncAt(data?.lastSyncAt || lastSyncAt);
      setSelectedIds([]);
      setSelected(nextItems.find(isInActiveView) || null);
    } catch (err) {
      setError(err?.response?.data?.message || "Durum kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  const startAssignment = async (target = selected) => {
    if (!isBulkMode && !target?.firmaId) return;
    if (isBulkMode && selectedFirmaIds.length === 0) return;
    setSaving(true);
    setError("");
    try {
      const payload = {
        gorevTuru,
        ...(isUzmanMode ? { userId: bulkUserId || undefined } : {}),
        ...(!isUzmanMode && manualFormValid
          ? {
              adSoyad: manualAssigneeForm.adSoyad,
              tcKimlik: manualAssigneeForm.tcKimlik,
            }
          : {}),
      };
      const { data } = isBulkMode
        ? await axios.post(
            "/api/isg-katip/bulk/start",
            { ...payload, firmaIds: selectedFirmaIds },
            { headers: tokenHeader() }
          )
        : await axios.post(
            `/api/isg-katip/${target.firmaId}/start`,
            payload,
            { headers: tokenHeader() }
          );

      if (Array.isArray(data?.items)) {
        const nextItems = data.items;
        setItems(nextItems);
        setCounts(data?.counts || {});
        setCandidateUsers(Array.isArray(data?.candidateUsers) ? data.candidateUsers : []);
        setSavedPeople(Array.isArray(data?.savedPeople) ? data.savedPeople : []);
        setLastSyncAt(data?.lastSyncAt || lastSyncAt);
        setSelectedIds([]);
        setBulkUserId("");
        setSelected(nextItems.find((item) => item.id === selected?.id) || nextItems.find(isInActiveView) || null);
      } else {
        await loadOverview();
      }
      await runQueuedExtensionJob({ firmaId: isBulkMode ? undefined : target.firmaId });
    } catch (err) {
      setError(err?.response?.data?.message || "Atama süreci başlatılamadı.");
    } finally {
      setSaving(false);
    }
  };

  const assignUser = async (userId) => {
    if ((!selected?.firmaId && !isBulkMode) || !userId) return;
    setSaving(true);
    setError("");
    try {
      const { data } = isBulkMode
        ? await axios.post(
            "/api/isg-katip/bulk/assign-user",
            { userId, gorevTuru, firmaIds: selectedFirmaIds },
            { headers: tokenHeader() }
          )
        : await axios.post(
            `/api/isg-katip/${selected.firmaId}/assign-user`,
            { userId, gorevTuru },
            { headers: tokenHeader() }
          );
      const nextItems = Array.isArray(data?.items) ? data.items : [];
      setItems(nextItems);
      setCounts(data?.counts || {});
      setCandidateUsers(Array.isArray(data?.candidateUsers) ? data.candidateUsers : []);
      setSavedPeople(Array.isArray(data?.savedPeople) ? data.savedPeople : []);
      setLastSyncAt(data?.lastSyncAt || lastSyncAt);
      setBulkUserId("");
      setSelectedIds([]);
      setSelected(nextItems.find((item) => item.id === selected?.id) || nextItems.find(isInActiveView) || null);
    } catch (err) {
      setError(err?.response?.data?.message || "Kullanıcı ataması kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  const saveManualAssignee = async () => {
    if ((!selected?.firmaId && !isBulkMode) || isUzmanMode) return;
    setSaving(true);
    setError("");
    try {
      const payload = {
        gorevTuru,
        adSoyad: manualAssigneeForm.adSoyad,
        tcKimlik: manualAssigneeForm.tcKimlik,
      };
      const { data } = isBulkMode
        ? await axios.post(
            "/api/isg-katip/bulk/manual-assignee",
            { ...payload, firmaIds: selectedFirmaIds },
            { headers: tokenHeader() }
          )
        : await axios.post(
            `/api/isg-katip/${selected.firmaId}/manual-assignee`,
            payload,
            { headers: tokenHeader() }
          );
      const nextItems = Array.isArray(data?.items) ? data.items : [];
      setItems(nextItems);
      setCounts(data?.counts || {});
      setCandidateUsers(Array.isArray(data?.candidateUsers) ? data.candidateUsers : []);
      setSavedPeople(Array.isArray(data?.savedPeople) ? data.savedPeople : []);
      setLastSyncAt(data?.lastSyncAt || lastSyncAt);
      setSelectedIds([]);
      setSelected(nextItems.find((item) => item.id === selected?.id) || nextItems.find(isInActiveView) || null);
    } catch (err) {
      setError(err?.response?.data?.message || "Kişi bilgisi kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  const handleBulkPrimaryAction = () => {
    if (!isStartTab) {
      if (isUzmanMode) {
        assignUser(bulkUserId);
        return;
      }
      saveManualAssignee();
      return;
    }
    if (isPanelAssignmentTab) {
      if (isUzmanMode) {
        assignUser(bulkUserId);
        return;
      }
      saveManualAssignee();
      return;
    }
    startAssignment();
  };

  const handleSingleManualPrimaryAction = () => {
    if (!isStartTab) {
      saveManualAssignee();
      return;
    }
    if (isPanelAssignmentTab) {
      saveManualAssignee();
      return;
    }
    startAssignment(selected);
  };

  const handleSingleExpertPanelSave = () => {
    if (!pendingUserId) return;
    assignUser(pendingUserId);
  };

  const selectSavedPerson = (personId) => {
    const person = savedPeople.find((item) => item.id === personId);
    if (!person) return;
    setManualAssigneeForm({
      adSoyad: person.adSoyad || "",
      tcKimlik: person.tcKimlik || "",
    });
  };

  const deleteSavedPerson = async (personId) => {
    if (!personId) return;
    setSaving(true);
    setError("");
    try {
      const { data } = await axios.delete(`/api/isg-katip/people/${personId}`, {
        headers: tokenHeader(),
      });
      setSavedPeople(Array.isArray(data?.people) ? data.people : []);
    } catch (err) {
      setError(err?.response?.data?.message || "Kayıtlı kişi silinemedi.");
    } finally {
      setSaving(false);
    }
  };

  const startDisabled =
    saving ||
    !isKatipStartTab ||
    (isBulkMode
      ? selectedFirmaIds.length === 0 || (isUzmanMode ? !bulkUzmanReady : !bulkManualReady)
      : !selected ||
        (isUzmanMode
          ? !selected.assignedUserId || selected.assignedUserTcKimlikVar === false
          : !selected.assignedUserTcKimlikVar && !manualFormValid));

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

        <div className="grid gap-3 md:grid-cols-4">
          <StatCard title="Atanmamış Firmalar" value={tabCount("atanmamis")} sub="Kullanıcı atanmayı bekliyor" icon={ShieldAlert} tone="rose" active={activeTab === "atanmamis"} onClick={() => setActiveTab("atanmamis")} />
          <StatCard title="İSG-KATİP Ataması Yok" value={counts.atama_yok || 0} sub="Panelde atanmış, resmi atama yok" icon={FileCheck2} tone="amber" active={activeTab === "atama_yok"} onClick={() => setActiveTab("atama_yok")} />
          <StatCard title="Onay Bekleyenler" value={counts.onay_bekleyen || 0} sub={`${selectedGorevShort} veya işveren onayı`} icon={Hourglass} tone="blue" active={activeTab === "onay_bekleyen"} onClick={() => setActiveTab("onay_bekleyen")} />
          <StatCard title="Aktif Atamalar" value={counts.aktif || 0} sub="İSG-KATİP'te aktif sözleşme" icon={CheckCircle2} tone="emerald" active={activeTab === "aktif"} onClick={() => setActiveTab("aktif")} />
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
                  {tab.label} ({tabCount(tab.key)})
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
                {loading
                  ? "Yükleniyor..."
                  : selectedItems.length > 0
                  ? `${selectedItems.length} firma seçili`
                  : `Toplam ${visibleItems.length} kayıt`}
              </div>
            </div>

            <div className="max-h-[520px] overflow-auto">
              <table className="min-w-[1040px] w-full text-xs">
                <thead className="sticky top-0 bg-slate-50 text-slate-600 z-10">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold border-b w-10">
                      <input
                        type="checkbox"
                        checked={visibleItems.length > 0 && selectedItems.length === visibleItems.length}
                        onChange={(event) =>
                          setSelectedIds(event.target.checked ? visibleItems.map((item) => item.id) : [])
                        }
                      />
                    </th>
                    <th className="px-3 py-2 text-left font-semibold border-b">#</th>
                    <th className="px-3 py-2 text-left font-semibold border-b">Firma Adı</th>
                    <th className="px-3 py-2 text-left font-semibold border-b">SGK Sicil No</th>
                    <th className="px-3 py-2 text-left font-semibold border-b">Çalışan Sayısı</th>
                    <th className="px-3 py-2 text-left font-semibold border-b">Tehlike Sınıfı</th>
                    <th className="px-3 py-2 text-left font-semibold border-b">
                      {isUzmanMode ? "Atanan Kullanıcı" : "Kayıtlı Kişi"}
                    </th>
                    <th className="px-3 py-2 text-left font-semibold border-b">İSG-KATİP Durumu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {visibleItems.map((item, index) => (
                    <tr
                      key={item.id}
                      onClick={() => setSelected(item)}
                      className={`cursor-pointer hover:bg-slate-50 ${
                        selected?.id === item.id || selectedIds.includes(item.id) ? "bg-[#0a2b45]/5" : ""
                      }`}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(item.id)}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => {
                            setSelectedIds((prev) =>
                              event.target.checked
                                ? [...new Set([...prev, item.id])]
                                : prev.filter((id) => id !== item.id)
                            );
                          }}
                        />
                      </td>
                      <td className="px-3 py-2">{index + 1}</td>
                      <td className="px-3 py-2 font-medium text-slate-800">{item.firmaAdi}</td>
                      <td className="px-3 py-2 tabular-nums">{item.sgkNo || "-"}</td>
                      <td className="px-3 py-2 tabular-nums">{fmtEmployeeCount(item.calisanSayisi)}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${hazardClass(item.tehlike)}`}>
                          {item.tehlike || "-"}
                        </span>
                      </td>
                      <td className="px-3 py-2">{item.assignedUserName || "-"}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${statusClass(item.isgKatipStatus)}`}>
                          {roleAwareStatusLabel(item.isgKatipStatus, selectedGorevShort)}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!loading && visibleItems.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-8 text-center text-sm text-slate-500">
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
              <h3 className="text-sm font-semibold text-[#042f4b]">
                {isBulkMode ? "Toplu Firma Seçimi" : "Firma Detayı"}
              </h3>
              <p className="text-xs text-slate-500">
                {isBulkMode ? "Seçili firmalar için toplu işlem" : "Seçili firma ve atama bilgileri"}
              </p>
            </div>
            {isBulkMode ? (
              <div className="space-y-4 p-4 text-sm">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs font-semibold text-slate-700">
                    {selectedItems.length} firma seçildi
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selectedItems.slice(0, 6).map((item) => (
                      <span
                        key={item.id}
                        className="max-w-full truncate rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-700"
                        title={item.firmaAdi}
                      >
                        {item.firmaAdi}
                      </span>
                    ))}
                    {selectedItems.length > 6 && (
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-500">
                        +{selectedItems.length - 6} firma
                      </span>
                    )}
                  </div>
                </div>

                {isStartTab && (isUzmanMode ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-2 text-xs font-semibold text-slate-700">
                      Seçili Firmalar İçin Uzman
                    </div>
                    <select
                      value={bulkUserId}
                      onChange={(event) => setBulkUserId(event.target.value)}
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
                    {canEditAssignee && (
                      <button
                        type="button"
                        onClick={handleBulkPrimaryAction}
                        disabled={
                          isStartTab
                            ? isPanelAssignmentTab
                              ? saving || !bulkUserId
                              : startDisabled
                            : saving || !bulkUserId
                        }
                        className={`${btn.base} ${btn.primary} mt-2 w-full`}
                      >
                        {changeAssigneeLabel}
                      </button>
                    )}
                    {bulkUserId && selectedBulkUser && !selectedBulkUser.tcKimlikVar && (
                      <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 p-2 text-[11px] text-rose-700">
                        Seçilen uzmanın TC kimlik numarası kayıtlı olmalıdır.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-2 text-xs font-semibold text-slate-700">
                      Seçili Firmalar İçin {selectedGorevLabel}
                    </div>

                    {savedPeople.length > 0 && (
                      <div className="mb-2 rounded-lg border border-slate-200 bg-white">
                        <button
                          type="button"
                          onClick={() => setPeopleOpen((open) => !open)}
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-[11px] font-semibold text-slate-700"
                        >
                          Kayıtlı Kişiler ({savedPeople.length})
                          <span>{peopleOpen ? "Kapat" : "Aç"}</span>
                        </button>
                        {peopleOpen && (
                          <div className="max-h-44 space-y-1 overflow-auto border-t p-2">
                            {savedPeople.map((person) => (
                              <div
                                key={person.id}
                                className="flex items-center justify-between gap-2 rounded-md border border-slate-100 px-2 py-1"
                              >
                                <button
                                  type="button"
                                  onClick={() => selectSavedPerson(person.id)}
                                  className="min-w-0 flex-1 text-left"
                                >
                                  <span className="block truncate text-[11px] font-semibold text-slate-800">
                                    {person.adSoyad}
                                  </span>
                                  <span className="block text-[10px] text-slate-500">{person.tcKimlik}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteSavedPerson(person.id)}
                                  disabled={saving}
                                  className="rounded-md border border-rose-200 px-2 py-1 text-[10px] font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                                >
                                  Sil
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="space-y-2">
                      <input
                        value={manualAssigneeForm.adSoyad}
                        onChange={(event) =>
                          setManualAssigneeForm((form) => ({
                            ...form,
                            adSoyad: event.target.value.toLocaleUpperCase("tr-TR"),
                          }))
                        }
                        placeholder="AD SOYAD"
                        className={inputClass}
                      />
                      <input
                        value={manualAssigneeForm.tcKimlik}
                        onChange={(event) =>
                          setManualAssigneeForm((form) => ({
                            ...form,
                            tcKimlik: event.target.value.replace(/\D/g, "").slice(0, 11),
                          }))
                        }
                        inputMode="numeric"
                        maxLength={11}
                        placeholder="TC KİMLİK NO"
                        className={inputClass}
                      />
                      {canEditAssignee && (
                        <button
                          type="button"
                          onClick={handleBulkPrimaryAction}
                          disabled={
                            isStartTab
                              ? isPanelAssignmentTab
                                ? saving || !manualFormValid
                                : startDisabled
                              : saving || !manualFormValid
                          }
                          className={`${btn.base} ${btn.primary} w-full`}
                        >
                          {changeAssigneeLabel}
                        </button>
                      )}
                      {isStartTab && !bulkManualReady && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-700">
                          Seçili firmalar için kayıtlı kişi yoksa ad soyad ve 11 haneli TC kimlik girilmelidir.
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {isApprovalTab && (
                  <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-800">
                    Seçili firmalar onay sürecinde. {selectedGorevShort} ve işveren onayları İSG-KATİP senkronizasyonu ile güncellenir.
                  </div>
                )}

                {isActiveTab && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                    Seçili firmalarda profesyonel ve işveren onayı tamamlanmış görünüyor.
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className={`${btn.base} ${btn.ghost} w-full`}
                >
                  Seçimi Temizle
                </button>
              </div>
            ) : selected ? (
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
                    <div className="text-slate-500">Çalışan Sayısı</div>
                    <div className="mt-1 font-semibold text-slate-800">{fmtEmployeeCount(selected.calisanSayisi)}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">{isUzmanMode ? "Atanan Kullanıcı" : "Kayıtlı Kişi"}</div>
                    <div className="mt-1 font-semibold text-slate-800">
                      {selected.assignedDisplayName || selected.assignedUserName || "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Görev Türü</div>
                    <div className="mt-1 font-semibold text-slate-800">{selectedGorevLabel}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">TC Kimlik</div>
                    <div className={`mt-1 font-semibold ${selected.assignedUserTcKimlikVar ? "text-slate-800" : "text-rose-700"}`}>
                      {selected.assignedDisplayTcKimlik || selected.assignedUserTcKimlik || "Eksik"}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Sertifika</div>
                    <div className="mt-1 font-semibold text-slate-800">
                      {isUzmanMode ? (selected.assignedUserId ? (selected.assignedUserSertifikaNoVar ? "Kayıtlı" : "Eksik") : "-") : "Panel dışı"}
                    </div>
                  </div>
                </div>

                {canEditAssignee && (isUzmanMode ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-2 text-xs font-semibold text-slate-700">
                      Bu Görev İçin Kullanıcı Ata
                    </div>
                    <select
                      value={isPanelAssignmentTab || !isStartTab ? pendingUserId : selected.assignedUserId || ""}
                      onChange={(event) =>
                        isPanelAssignmentTab || !isStartTab
                          ? setPendingUserId(event.target.value)
                          : assignUser(event.target.value)
                      }
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
                    {(isPanelAssignmentTab || !isStartTab) && (
                      <button
                        type="button"
                        onClick={handleSingleExpertPanelSave}
                        disabled={saving || !pendingUserId}
                        className={`${btn.base} ${btn.primary} mt-2 w-full`}
                      >
                        {isStartTab ? "Panel Atamasını Kaydet" : "Personeli Değiştir"}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-2 text-xs font-semibold text-slate-700">
                      {selectedGorevLabel} Bilgisi
                    </div>
                    <div className="space-y-2">
                      {savedPeople.length > 0 && (
                        <div className="rounded-lg border border-slate-200 bg-white">
                          <button
                            type="button"
                            onClick={() => setPeopleOpen((open) => !open)}
                            className="flex w-full items-center justify-between px-3 py-2 text-left text-[11px] font-semibold text-slate-700"
                          >
                            Kayıtlı Kişiler ({savedPeople.length})
                            <span>{peopleOpen ? "Kapat" : "Aç"}</span>
                          </button>
                          {peopleOpen && (
                            <div className="max-h-44 space-y-1 overflow-auto border-t p-2">
                              {savedPeople.map((person) => (
                                <div
                                  key={person.id}
                                  className="flex items-center justify-between gap-2 rounded-md border border-slate-100 px-2 py-1"
                                >
                                  <button
                                    type="button"
                                    onClick={() => selectSavedPerson(person.id)}
                                    className="min-w-0 flex-1 text-left"
                                    title="Bu kişiyi forma aktar"
                                  >
                                    <span className="block truncate text-[11px] font-semibold text-slate-800">
                                      {person.adSoyad}
                                    </span>
                                    <span className="block text-[10px] text-slate-500">{person.tcKimlik}</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => deleteSavedPerson(person.id)}
                                    disabled={saving}
                                    className="rounded-md border border-rose-200 px-2 py-1 text-[10px] font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                                  >
                                    Sil
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      <input
                        value={manualAssigneeForm.adSoyad}
                        onChange={(event) =>
                          setManualAssigneeForm((form) => ({
                            ...form,
                            adSoyad: event.target.value.toLocaleUpperCase("tr-TR"),
                          }))
                        }
                        placeholder="AD SOYAD"
                        className={inputClass}
                      />
                      <input
                        value={manualAssigneeForm.tcKimlik}
                        onChange={(event) =>
                          setManualAssigneeForm((form) => ({
                            ...form,
                            tcKimlik: event.target.value.replace(/\D/g, "").slice(0, 11),
                          }))
                        }
                        inputMode="numeric"
                        maxLength={11}
                        placeholder="TC KİMLİK NO"
                        className={inputClass}
                      />
                      {canEditAssignee && (
                        <button
                          type="button"
                          onClick={handleSingleManualPrimaryAction}
                          disabled={
                            isStartTab
                              ? isPanelAssignmentTab
                                ? saving || !manualFormValid
                                : startDisabled
                              : saving || !manualFormValid
                          }
                          className={`${btn.base} ${btn.primary} w-full`}
                        >
                          {changeAssigneeLabel}
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {isApprovalTab && (
                  <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-slate-700">
                    <div className="mb-2 flex items-center gap-2 font-semibold text-sky-800">
                      <Clock3 className="h-4 w-4" />
                      Onay Süreci
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span>{selectedGorevShort} Onayı</span>
                        <span className={`font-semibold ${selected.isgKatipStatus === "isveren_onayi_bekliyor" ? "text-emerald-700" : "text-amber-700"}`}>
                          {selected.isgKatipStatus === "isveren_onayi_bekliyor" ? "Onayladı" : "Onay Bekliyor"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>İşveren Onayı</span>
                        <span className="font-semibold text-amber-700">Onay Bekliyor</span>
                      </div>
                      <div className="flex items-center justify-between border-t border-sky-100 pt-2">
                        <span>Kalan Süre</span>
                        <span className="font-semibold text-slate-900">
                          {approvalDaysLeft(selected) === null ? "5 gün" : `${approvalDaysLeft(selected)} gün`}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {isActiveTab && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                    <div className="mb-2 flex items-center gap-2 font-semibold">
                      <CheckCircle2 className="h-4 w-4" />
                      Aktif Atama
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span>{selectedGorevShort} Onayı</span>
                        <span className="font-semibold">Onayladı</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>İşveren Onayı</span>
                        <span className="font-semibold">Onayladı</span>
                      </div>
                    </div>
                  </div>
                )}

                {isKatipStartTab && isUzmanMode && (
                  <button
                    type="button"
                    onClick={() => startAssignment(selected)}
                    disabled={startDisabled}
                    className={`${btn.base} ${btn.dark} h-10 w-full`}
                  >
                    <UserPlus className="h-4 w-4" />
                    Atama Sürecini Başlat
                  </button>
                )}

                {isStartTab && isUzmanMode && !selected.assignedUserId && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                    Bu firma için önce iş güvenliği uzmanı seçilmelidir.
                  </div>
                )}

                {isStartTab && isUzmanMode && selected.assignedUserId && !selected.assignedUserTcKimlikVar && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                    Atama başlatmak için atanan kullanıcının kişisel bilgilerinde TC kimlik numarası kayıtlı olmalıdır.
                  </div>
                )}

                {isStartTab && !isUzmanMode && !selected.assignedUserTcKimlikVar && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                    Bu görev için ad soyad ve 11 haneli TC kimlik kaydedilmelidir.
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

