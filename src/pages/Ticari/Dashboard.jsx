import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FaBuilding,
  FaExclamationTriangle,
  FaChartLine,
  FaCalendarAlt,
  FaTimesCircle,
} from "react-icons/fa";
import { HiEye, HiX } from "react-icons/hi";
import { motion } from "framer-motion";
import { useLocation } from "react-router-dom";
import { Card, CardHeader, CardContent } from "../../components/ui/card";
import axios from "axios";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area,
} from "recharts";

const API_BASE =
  (import.meta?.env?.VITE_API_URL || "").trim().replace(/\/$/, "") ||
  "https://api.isgpanel.tr";

const firmIdOf = (f) => (f?._id || f?.id || f?.firmaId || "").toString();
const sgkOf = (f) => f?.sgkNo || f?.sgkSicilNo || "-";

const formatTR = (d) =>
  d && !Number.isNaN(new Date(d).getTime())
    ? new Date(d).toLocaleDateString("tr-TR")
    : "-";

const formatDateTimeTR = (d) =>
  d && !Number.isNaN(new Date(d).getTime())
    ? new Date(d).toLocaleString("tr-TR")
    : "-";

const getKalanGunColor = (kalanGun) => {
  if (kalanGun < 0) return "text-red-700";
  if (kalanGun <= 7) return "text-red-600";
  if (kalanGun <= 30) return "text-orange-500";
  return "text-amber-600";
};

const toDateSafe = (value) => {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  const text = String(value).trim();

  const trMatch = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (trMatch) {
    const d = new Date(Number(trMatch[3]), Number(trMatch[2]) - 1, Number(trMatch[1]));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const d = new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(text);
  return Number.isNaN(d.getTime()) ? null : d;
};

const diffDays = (date) => {
  const d = toDateSafe(date);
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

const getDocStatus = (dateValue) => {
  const d = toDateSafe(dateValue);

  if (!d) {
    return { key: "missing", label: "Yok", icon: "❌", color: "text-slate-500", kalanGun: null };
  }

  const kalanGun = diffDays(dateValue);

  if (kalanGun < 0) {
    return { key: "expired", label: "Süresi Dolmuş", icon: "⏰", color: "text-red-600", kalanGun };
  }

  if (kalanGun <= 30) {
    return { key: "upcoming", label: "Yaklaşıyor", icon: "⚠️", color: "text-amber-500", kalanGun };
  }

  return { key: "valid", label: "Güncel", icon: "✅", color: "text-emerald-600", kalanGun };
};

const getOverallStatus = (docs, firma = {}) => {
  const values = Object.values(docs);

  if (values.some((x) => x.key === "expired") || firma?.egitimKisiDurumu?.gecmis > 0) {
    return { key: "critical", label: "Kritik", icon: "🔴", color: "text-red-600" };
  }

  if (
    values.some((x) => x.key === "missing" || x.key === "upcoming") ||
    firma?.egitimKisiDurumu?.yaklasan > 0
  ) {
    return { key: "warning", label: "Eksik Var", icon: "🟡", color: "text-amber-500" };
  }

  return { key: "complete", label: "Hepsi Tamam", icon: "🟢", color: "text-emerald-600" };
};

const normalizeBackendStatus = (status) => {
  if (!status || !status.key) return null;

  const base = {
    missing: { key: "missing", label: "Yok", icon: "❌", color: "text-slate-500", kalanGun: null },
    expired: {
      key: "expired",
      label: "Süresi Dolmuş",
      icon: "⏰",
      color: "text-red-600",
      kalanGun: status.kalanGun ?? null,
    },
    upcoming: {
      key: "upcoming",
      label: "Yaklaşıyor",
      icon: "⚠️",
      color: "text-amber-500",
      kalanGun: status.kalanGun ?? null,
    },
    valid: {
      key: "valid",
      label: status.label || "Güncel",
      icon: "✅",
      color: "text-emerald-600",
      kalanGun: status.kalanGun ?? null,
    },
  };

  return base[status.key] || null;
};

const normalizeFirmStatus = (firma) => {
  const backendDocs = firma?.dashboardDocStatus || {};

  const docs = {
    risk:
      normalizeBackendStatus(backendDocs.risk) ||
      getDocStatus(
        firma?.riskGecerlilik ||
          firma?.riskDegerlendirmeGecerlilik ||
          firma?.riskValidUntil ||
          firma?.gecerlilik
      ),
    acil:
      normalizeBackendStatus(backendDocs.acil) ||
      getDocStatus(
        firma?.acilDurumGecerlilik ||
          firma?.acilEylemPlaniGecerlilik ||
          firma?.acilValidUntil
      ),
    yillik:
      normalizeBackendStatus(backendDocs.yillik) ||
      getDocStatus(
        firma?.yillikPlanGecerlilik ||
          firma?.yillikCalismaPlaniGecerlilik ||
          firma?.yillikValidUntil
      ),
    egitim:
      normalizeBackendStatus(backendDocs.egitim) ||
      getDocStatus(
        firma?.egitimGecerlilik ||
          firma?.egitimPlaniGecerlilik ||
          firma?.egitimValidUntil
      ),
    defter:
      normalizeBackendStatus(backendDocs.defter) || {
        key: "missing",
        label: "Yok",
        icon: "❌",
        color: "text-slate-500",
        kalanGun: null,
      },
  };

  return {
    ...firma,
    _normalizedDocs: docs,
    _overallStatus: getOverallStatus(docs, firma),
  };
};

const statusCell = (status) => {
  const styles = {
    valid: "bg-emerald-100 text-emerald-700 border-emerald-400",
    missing: "bg-red-100 text-red-700 border-red-400",
    expired: "bg-red-200 text-red-800 border-red-500",
    upcoming: "bg-amber-100 text-amber-700 border-amber-400",
  };

  const symbols = {
    valid: "✓",
    missing: "×",
    expired: "!",
    upcoming: "!",
  };

  return (
    <span
      className={`inline-flex h-7 w-7 items-center justify-center rounded-full border text-sm font-bold ${
        styles[status?.key] || "bg-slate-50 text-slate-500 border-slate-200"
      }`}
      title={status?.label || ""}
    >
      {symbols[status?.key] || "-"}
    </span>
  );
};

const filterLabels = {
  all: "Tümü",
  "eksik-evrak": "Eksik Evraklı",
  "suresi-dolan": "Süresi Dolan",
  yaklasan: "Yaklaşan Süreli",
  tamam: "Tamamlanan",
  kritik: "Kritik",
  "risk-eksik": "Risk Eksik",
  "acil-eksik": "Acil Durum Eksik",
  "yillik-eksik": "Yıllık Plan Eksik",
  "egitim-eksik": "Eğitim Eksik",
  "defter-eksik": "Defter Eksik",
};

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [firmalar, setFirmalar] = useState([]);
  const [detail, setDetail] = useState(null);

  const location = useLocation();
  const selectedUser = new URLSearchParams(location.search).get("u") || "all";

  const [activeFilter, setActiveFilter] = useState("all");
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailInnerFilter, setDetailInnerFilter] = useState("all");
  const [orgName, setOrgName] = useState("Ticari Müşteri");

  const [summary, setSummary] = useState({
    toplamFirma: 0,
    atananFirmalar: 0,
    atamaBekleyenFirmalar: 0,
    aktifKullanici: 0,
    kullaniciLimit: null,
    kalanKoltuk: null,
    tamamlananFirmalar: 0,
    hicIslemYapilmayanFirmalar: 0,
    kismiTamamFirmalar: 0,
    askidaFirmalar: 0,
  });

  const [expiredDocs, setExpiredDocs] = useState([]);
  const [upcomingDocs, setUpcomingDocs] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);

  const [installReady, setInstallReady] = useState(false);
  const deferredPromptRef = useRef(null);

  useEffect(() => {
    try {
      const rawUser = localStorage.getItem("user");
      if (!rawUser) return;

      const user = JSON.parse(rawUser);
      const org =
        user.organization && typeof user.organization === "object"
          ? user.organization
          : null;

      const possibleOrgName = org?.name || user.companyName || user.orgName || null;

      if (possibleOrgName) {
        setOrgName(possibleOrgName);
        return;
      }

      const storedName =
        localStorage.getItem("kullaniciAdSoyad") ||
        localStorage.getItem("user_name") ||
        localStorage.getItem("userName");

      if (storedName) setOrgName(storedName);
    } catch (e) {
      console.error("Organizasyon adı çözümlenemedi:", e);
    }
  }, []);

  const fetchDashboard = async () => {
    try {
      setErrorText("");

      const token = localStorage.getItem("token");
      if (!token) throw new Error("Token bulunamadı. Lütfen yeniden giriş yapın.");

      const dashboardRes = await axios.get(`${API_BASE}/api/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = dashboardRes?.data || {};

      setFirmalar(Array.isArray(data.firms) ? data.firms : []);
      setSummary(data.summary || {});
      setExpiredDocs(Array.isArray(data.expiredDocs) ? data.expiredDocs : []);
      setUpcomingDocs(Array.isArray(data.upcomingDocs) ? data.upcomingDocs : []);
      setRecentActivities(
        Array.isArray(data.recentActivities) ? data.recentActivities : []
      );
    } catch (e) {
      console.error("Dashboard verileri alınamadı:", e);
      setErrorText(
        e?.response?.data?.message ||
          e?.message ||
          "Dashboard verileri alınamadı."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();

    const refetch = () => fetchDashboard();

    window.addEventListener("ticari_docs_refresh", refetch);
    window.addEventListener("storage", refetch);

    return () => {
      window.removeEventListener("ticari_docs_refresh", refetch);
      window.removeEventListener("storage", refetch);
    };
  }, []);

  useEffect(() => {
    const onBeforeInstallPrompt = (e) => {
      e.preventDefault();
      deferredPromptRef.current = e;
      setInstallReady(true);
    };

    const onAppInstalled = () => {
      deferredPromptRef.current = null;
      setInstallReady(false);
      localStorage.setItem("pwa_installed", "1");
    };

    const alreadyInstalled =
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      window.navigator.standalone === true ||
      localStorage.getItem("pwa_installed") === "1";

    if (alreadyInstalled) setInstallReady(false);

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const handleInstallApp = async () => {
    try {
      if (!deferredPromptRef.current) return;

      deferredPromptRef.current.prompt();
      const choiceResult = await deferredPromptRef.current.userChoice;

      if (choiceResult?.outcome === "accepted") setInstallReady(false);

      deferredPromptRef.current = null;
    } catch (err) {
      console.error("PWA yükleme hatası:", err);
    }
  };

  const normalizedFirmalar = useMemo(() => {
    return firmalar.map(normalizeFirmStatus);
  }, [firmalar]);

  const filteredByUser = useMemo(() => {
    if (selectedUser === "all") return normalizedFirmalar;

    return normalizedFirmalar.filter((firma) => {
      const uid =
        firma?.atanmisKullaniciId ||
        firma?.atananKullaniciId ||
        firma?.atanmisUzmanId ||
        "";
      return String(uid) === String(selectedUser);
    });
  }, [normalizedFirmalar, selectedUser]);

  const filteredFirmalar = useMemo(() => {
    switch (activeFilter) {
      case "eksik-evrak":
        return filteredByUser.filter((f) =>
          Object.values(f._normalizedDocs).some((x) => x.key === "missing")
        );
      case "suresi-dolan":
        return filteredByUser.filter((f) =>
          Object.values(f._normalizedDocs).some((x) => x.key === "expired")
        );
      case "yaklasan":
        return filteredByUser.filter((f) =>
          Object.values(f._normalizedDocs).some((x) => x.key === "upcoming")
        );
      case "tamam":
        return filteredByUser.filter((f) => f._overallStatus.key === "complete");
      case "kritik":
        return filteredByUser.filter((f) => f._overallStatus.key === "critical");
      case "risk-eksik":
        return filteredByUser.filter((f) => f._normalizedDocs.risk.key !== "valid");
      case "acil-eksik":
        return filteredByUser.filter((f) => f._normalizedDocs.acil.key !== "valid");
      case "yillik-eksik":
        return filteredByUser.filter((f) => f._normalizedDocs.yillik.key !== "valid");
      case "egitim-eksik":
        return filteredByUser.filter((f) => f._normalizedDocs.egitim.key !== "valid");
      case "defter-eksik":
        return filteredByUser.filter((f) => f._normalizedDocs.defter.key !== "valid");
      default:
        return filteredByUser;
    }
  }, [filteredByUser, activeFilter]);

  const detailFilteredFirmalar = useMemo(() => {
    switch (detailInnerFilter) {
      case "eksik":
        return filteredFirmalar.filter((f) =>
          Object.values(f._normalizedDocs).some((x) => x.key === "missing")
        );
      case "expired":
        return filteredFirmalar.filter((f) =>
          Object.values(f._normalizedDocs).some((x) => x.key === "expired")
        );
      case "critical":
        return filteredFirmalar.filter((f) => f._overallStatus.key === "critical");
      default:
        return filteredFirmalar;
    }
  }, [filteredFirmalar, detailInnerFilter]);

  const kpiData = useMemo(() => {
    const toplam = filteredByUser.length;
    const eksikEvrakli = filteredByUser.filter((f) =>
      Object.values(f._normalizedDocs).some((x) => x.key === "missing")
    ).length;
    const suresiDolan = filteredByUser.filter((f) =>
      Object.values(f._normalizedDocs).some((x) => x.key === "expired")
    ).length;
    const yaklasan = filteredByUser.filter((f) =>
      Object.values(f._normalizedDocs).some((x) => x.key === "upcoming")
    ).length;

    return { toplam, eksikEvrakli, suresiDolan, yaklasan };
  }, [filteredByUser]);

  const pieData = useMemo(() => {
    const tamam = filteredByUser.filter((f) => f._overallStatus.key === "complete").length;
    const eksik = filteredByUser.filter((f) =>
      Object.values(f._normalizedDocs).some((x) => x.key === "missing")
    ).length;
    const expired = filteredByUser.filter((f) =>
      Object.values(f._normalizedDocs).some((x) => x.key === "expired")
    ).length;
    const upcoming = filteredByUser.filter((f) =>
      Object.values(f._normalizedDocs).some((x) => x.key === "upcoming")
    ).length;

    return [
      { name: "Tamam", value: tamam, filterKey: "tamam" },
      { name: "Eksik", value: eksik, filterKey: "eksik-evrak" },
      { name: "Süresi Dolmuş", value: expired, filterKey: "suresi-dolan" },
      { name: "Yaklaşan", value: upcoming, filterKey: "yaklasan" },
    ];
  }, [filteredByUser]);

  const barData = useMemo(() => {
    return [
      {
        name: "Risk",
        value: filteredByUser.filter((f) => f._normalizedDocs.risk.key !== "valid").length,
        filterKey: "risk-eksik",
      },
      {
        name: "Acil",
        value: filteredByUser.filter((f) => f._normalizedDocs.acil.key !== "valid").length,
        filterKey: "acil-eksik",
      },
      {
        name: "Yıllık",
        value: filteredByUser.filter((f) => f._normalizedDocs.yillik.key !== "valid").length,
        filterKey: "yillik-eksik",
      },
      {
        name: "Eğitim",
        value: filteredByUser.filter((f) => f._normalizedDocs.egitim.key !== "valid").length,
        filterKey: "egitim-eksik",
      },
      {
        name: "Defter",
        value: filteredByUser.filter((f) => f._normalizedDocs.defter.key !== "valid").length,
        filterKey: "defter-eksik",
      },
    ];
  }, [filteredByUser]);

  const lineData = useMemo(() => {
    const monthMap = {};

    recentActivities.forEach((item) => {
      const d = toDateSafe(item?.date);
      if (!d) return;

      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthMap[key] = (monthMap[key] || 0) + 1;
    });

    return Object.entries(monthMap).map(([month, count]) => ({ month, count }));
  }, [recentActivities]);

  const openFilterPanel = (filterKey) => {
    setActiveFilter(filterKey);
    setDetailInnerFilter("all");
    setDetailOpen(true);
    setDetail(null);
  };

  return (
    <div className="p-3 md:p-6 space-y-5 md:space-y-8 pb-24 md:pb-6">
      <motion.div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0a2b45] via-[#0d3756] to-[#0f3d5c] text-white p-4 md:p-5 shadow-lg border border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_30%)] pointer-events-none" />

        <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="max-w-3xl">
            <div className="inline-flex items-center rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-medium tracking-wide text-white/90 mb-1.5">
              TİCARİ YÖNETİM GÖSTERGE PANELİ
            </div>

            <h1 className="text-xl md:text-2xl font-bold leading-tight">
              Hoş geldiniz, {orgName}
            </h1>

            <p className="mt-1 text-sm text-white/80 leading-5">
              Firma, evrak, geçerlilik ve eksik süreçleri tek ekranda izleyin.
              Kartlara ve grafiklere tıklayarak analiz edin.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start lg:self-center">
            {installReady && (
              <button
                onClick={handleInstallApp}
                className="px-3 py-1.5 rounded-lg bg-white text-[#0a2b45] font-semibold text-xs hover:bg-slate-100 transition"
              >
                Uygulamayı İndir
              </button>
            )}

            <div className="h-10 w-10 rounded-lg bg-white/10 flex items-center justify-center">
              <FaChartLine className="text-white text-lg" />
            </div>
          </div>
        </div>
      </motion.div>

      {errorText ? (
        <div className="border border-red-200 bg-red-50 text-red-700 rounded p-3 text-sm">
          {errorText}
        </div>
      ) : null}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-6">
        {[
          {
            title: "Toplam Firma",
            value: kpiData.toplam,
            desc: "Tüm firmalar",
            icon: <FaBuilding className="text-blue-600 text-xl" />,
            color: "text-blue-600",
            filterKey: "all",
          },
          {
            title: "Eksik Evraklı",
            value: kpiData.eksikEvrakli,
            desc: "En az 1 eksik",
            icon: <FaExclamationTriangle className="text-amber-500 text-xl" />,
            color: "text-amber-500",
            filterKey: "eksik-evrak",
          },
          {
            title: "Süresi Dolan",
            value: kpiData.suresiDolan,
            desc: "Süresi geçmiş",
            icon: <FaTimesCircle className="text-red-600 text-xl" />,
            color: "text-red-600",
            filterKey: "suresi-dolan",
          },
          {
            title: "Yaklaşan Süreli",
            value: kpiData.yaklasan,
            desc: "30 gün içinde",
            icon: <FaCalendarAlt className="text-sky-600 text-xl" />,
            color: "text-sky-600",
            filterKey: "yaklasan",
          },
        ].map((item, idx) => (
          <button
            type="button"
            key={idx}
            onClick={() => openFilterPanel(item.filterKey)}
            className="text-left"
          >
            <Card className="group relative overflow-hidden rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition duration-200 border border-slate-200 bg-white h-full">
              <div
                className={`absolute top-0 left-0 h-1.5 w-full ${
                  item.filterKey === "all"
                    ? "bg-blue-500"
                    : item.filterKey === "eksik-evrak"
                    ? "bg-amber-500"
                    : item.filterKey === "suresi-dolan"
                    ? "bg-red-500"
                    : "bg-sky-500"
                }`}
              />

              <CardHeader
                className={`flex items-center justify-between gap-2 pb-2 px-3 py-3 md:px-6 md:py-6 ${item.color}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-9 w-9 md:h-10 md:w-10 rounded-xl bg-slate-50 border flex items-center justify-center shrink-0">
                    {item.icon}
                  </div>
                  <span className="font-semibold text-sm md:text-[15px] text-slate-800 leading-tight">
                    {item.title}
                  </span>
                </div>
              </CardHeader>

              <CardContent className="pt-0 px-3 pb-4 md:px-6 md:pb-6">
                <h3 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
                  {loading ? "-" : item.value}
                </h3>
                <p className="mt-1 md:mt-2 text-xs md:text-sm text-slate-500 leading-4 md:leading-5 min-h-[34px] md:min-h-[40px]">
                  {item.desc}
                </p>
                <div className="hidden md:block mt-4 text-xs font-medium text-slate-400 group-hover:text-slate-600 transition">
                  Detayı görüntülemek için tıklayın
                </div>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-6 items-stretch">
        <Card className="hidden xl:block shadow-md rounded-2xl border border-slate-200">
          <CardHeader className="pb-2">
            <div className="font-semibold text-slate-800">Genel Durum Dağılımı</div>
            <div className="text-xs text-slate-500 mt-1">
              Firmaların genel uygunluk, eksik ve kritik dağılımı
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={100}
                    onClick={(data) =>
                      data?.filterKey && openFilterPanel(data.filterKey)
                    }
                  >
                    {pieData.map((_, index) => (
                      <Cell
                        key={index}
                        fill={
                          ["#16a34a", "#f59e0b", "#dc2626", "#0ea5e9"][
                            index % 4
                          ]
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md rounded-2xl border border-slate-200">
          <CardHeader className="pb-2">
            <div className="font-semibold text-slate-800">
              Belge Bazlı Eksik / Problemli Durumlar
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Hangi belge grubunda daha fazla aksiyon gerektiğini gösterir
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            <div className="h-[220px] md:h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar
                    dataKey="value"
                    radius={[8, 8, 0, 0]}
                    onClick={(data) =>
                      data?.filterKey && openFilterPanel(data.filterKey)
                    }
                  >
                    {barData.map((_, index) => (
                      <Cell
                        key={index}
                        fill={
                          ["#2563eb", "#f59e0b", "#7c3aed", "#16a34a", "#0e7490"][
                            index % 5
                          ]
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {barData.map((item, index) => {
                const colors = [
                  "bg-blue-600",
                  "bg-amber-500",
                  "bg-violet-600",
                  "bg-emerald-600",
                  "bg-cyan-700",
                ];

                return (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => openFilterPanel(item.filterKey)}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left hover:bg-slate-100 transition"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`h-3 w-3 rounded-full ${colors[index]}`} />
                      <span className="text-xs font-medium text-slate-700 truncate">
                        {item.name}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-slate-900">
                      {item.value}
                    </span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="hidden xl:block shadow-md rounded-2xl border border-slate-200">
          <CardHeader className="pb-2">
            <div className="font-semibold text-slate-800">
              Aylık Yapılan İşlem Sayısı
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Son işlemlerin aylara göre hareket yoğunluğu
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={lineData}>
                  <defs>
                    <linearGradient id="islemGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0f4a68" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#0f4a68" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="count"
                    name="İşlem"
                    stroke="#0f4a68"
                    strokeWidth={3}
                    fill="url(#islemGradient)"
                    dot={{ r: 5 }}
                    activeDot={{ r: 7 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-2 gap-3 md:gap-6">
        <Card className="shadow-md">
          <CardHeader className="flex items-center gap-2 text-red-700 px-3 py-3 md:px-6 md:py-6">
            <FaTimesCircle className="text-red-600 text-xl" />
            <span className="font-semibold text-sm md:text-base">
              Süresi Geçen Evraklar
            </span>
          </CardHeader>
          <CardContent className="px-3 pb-4 md:px-6 md:pb-6">
            {expiredDocs.length === 0 ? (
              <p className="text-xs md:text-sm text-gray-500">
                Süresi geçmiş evrak bulunmamaktadır.
              </p>
            ) : (
              <div className="max-h-[335px] overflow-y-auto pr-1 space-y-2">
                {expiredDocs.map((f, idx) => (
                  <div
                    key={`${f.firmaId}-${idx}`}
                    className="flex flex-col md:flex-row md:items-center md:justify-between border rounded px-3 py-2 text-xs md:text-sm gap-1"
                  >
                    <div>
                      <div className="font-medium">{f.firmaAdi}</div>
                      <div className="text-xs text-gray-500">
                        {f.belgeTuru} • Geçerlilik: {formatTR(f.gecerlilik)}
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-red-700">
                      {Math.abs(f.kalanGun)} gün geçti
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardHeader className="flex items-center gap-2 text-slate-800 px-3 py-3 md:px-6 md:py-6">
            <FaCalendarAlt className="text-slate-700 text-xl" />
            <span className="font-semibold text-sm md:text-base">
              Yaklaşan Evraklar
            </span>
          </CardHeader>
          <CardContent className="px-3 pb-4 md:px-6 md:pb-6">
            {upcomingDocs.length === 0 ? (
              <p className="text-xs md:text-sm text-gray-500">
                60 gün içinde süresi dolacak evrak bulunmuyor.
              </p>
            ) : (
              <div className="max-h-[335px] overflow-y-auto pr-1 space-y-2">
                {upcomingDocs.map((f, idx) => (
                  <div
                    key={`${f.firmaId}-${idx}`}
                    className="flex flex-col md:flex-row md:items-center md:justify-between border rounded px-3 py-2 text-xs md:text-sm gap-1"
                  >
                    <div>
                      <div className="font-medium">{f.firmaAdi}</div>
                      <div className="text-xs text-gray-500">
                        {f.belgeTuru} • Geçerlilik: {formatTR(f.gecerlilik)}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-xs font-semibold ${getKalanGunColor(
                          f.kalanGun
                        )}`}
                      >
                        {f.kalanGun} gün kaldı
                      </span>
                      <button
                        className="p-1 rounded-full hover:bg-gray-100"
                        onClick={() => {
                          const found = normalizedFirmalar.find(
                            (x) => firmIdOf(x) === String(f.firmaId)
                          );
                          if (found) {
                            setDetail(found);
                            setActiveFilter("yaklasan");
                            setDetailOpen(true);
                          }
                        }}
                      >
                        <HiEye className="text-gray-600" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-md col-span-2 lg:col-span-2">
          <CardHeader className="text-slate-800 font-semibold">
            Son İşlemler
          </CardHeader>
          <CardContent>
            {recentActivities.length === 0 ? (
              <p className="text-sm text-gray-500">Kayıtlı işlem bulunamadı.</p>
            ) : (
              <div className="max-h-[320px] overflow-y-auto pr-1">
                <ul className="space-y-2 text-sm">
                  {recentActivities.map((islem, idx) => (
                    <li
                      key={idx}
                      className="border rounded px-3 py-2 flex flex-col md:flex-row md:justify-between gap-1 md:gap-2 hover:bg-slate-50 transition"
                    >
                      <div>
                        <div className="font-medium">{islem.title}</div>
                        {islem.description && (
                          <div className="text-xs text-gray-500">
                            {islem.description}
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 md:text-right whitespace-nowrap">
                        {formatDateTimeTR(islem.date)}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border border-slate-200 shadow-sm bg-white">
        <CardContent className="p-4 md:p-5">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-slate-800">
                Canlı Filtre Özeti
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Seçili filtreye göre anlık özet görünümü
              </div>
            </div>

            <div className="grid grid-cols-2 md:flex md:flex-wrap gap-3">
              <div className="px-4 py-3 rounded-xl bg-slate-50 border min-w-0 md:min-w-[150px]">
                <div className="text-xs text-slate-500">Görünen Firma</div>
                <div className="text-2xl font-bold text-slate-900">
                  {filteredFirmalar.length}
                </div>
              </div>

              <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-100 min-w-0 md:min-w-[150px]">
                <div className="text-xs text-red-500">Kritik Firma</div>
                <div className="text-2xl font-bold text-red-600">
                  {
                    filteredFirmalar.filter(
                      (f) => f._overallStatus.key === "critical"
                    ).length
                  }
                </div>
              </div>

              <div className="px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-100 min-w-0 md:min-w-[150px]">
                <div className="text-xs text-emerald-500">Tamam Firma</div>
                <div className="text-2xl font-bold text-emerald-600">
                  {
                    filteredFirmalar.filter(
                      (f) => f._overallStatus.key === "complete"
                    ).length
                  }
                </div>
              </div>

              <div className="px-4 py-3 rounded-xl bg-blue-50 border border-blue-100 min-w-0 md:min-w-[180px]">
                <div className="text-xs text-blue-500">Aktif Filtre</div>
                <div className="text-lg font-semibold text-blue-700 break-words">
                  {filterLabels[activeFilter] || "Tümü"}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {detailOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/45 backdrop-blur-[2px]">
          <div className="h-screen w-full max-w-[980px] bg-slate-50 shadow-2xl overflow-hidden flex flex-col border-l border-slate-200">
            <div className="px-4 py-3 border-b bg-gradient-to-r from-[#06263d] via-[#0a3554] to-[#0f4a68] text-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-lg">
                    Firma Detay Analiz Paneli
                  </h3>
                  <p className="text-xs text-slate-200 mt-1">
                    Aktif filtre: {filterLabels[activeFilter] || "Tümü"} • Toplam
                    firma: {detailFilteredFirmalar.length}
                  </p>
                </div>

                <button
                  onClick={() => {
                    setDetailOpen(false);
                    setDetail(null);
                  }}
                  className="p-2 rounded-lg hover:bg-white/10 transition"
                >
                  <HiX />
                </button>
              </div>
            </div>

            <div className="px-4 py-3 border-b bg-white flex flex-wrap gap-2">
              {[
                ["all", "Tümü"],
                ["eksik", "Sadece Eksikler"],
                ["expired", "Sadece Süresi Dolanlar"],
                ["critical", "Sadece Kritik Firmalar"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setDetailInnerFilter(key)}
                  className={`px-3 py-2 rounded-lg border text-sm ${
                    detailInnerFilter === key ? "bg-slate-900 text-white" : "bg-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4">
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-[#eef6f8]/95 backdrop-blur">
                    <tr className="text-left text-slate-700">
                      <th className="px-4 py-2.5 font-semibold min-w-[240px]">
                        Firma
                      </th>
                      <th className="px-3 py-2.5 font-semibold text-center w-[78px]">
                        Risk
                      </th>
                      <th className="px-3 py-2.5 font-semibold text-center w-[78px]">
                        Acil
                      </th>
                      <th className="px-3 py-2.5 font-semibold text-center w-[78px]">
                        Yıllık
                      </th>
                      <th className="px-3 py-2.5 font-semibold text-center w-[78px]">
                        Eğitim
                      </th>
                      <th className="px-3 py-2.5 font-semibold text-center w-[78px]">
                        Defter
                      </th>
                      <th className="px-4 py-3 font-semibold min-w-[170px]">
                        Genel Durum
                      </th>
                      <th className="px-4 py-3 font-semibold text-right min-w-[130px]">
                        İşlem
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {detailFilteredFirmalar.map((firma) => (
                      <tr key={firmIdOf(firma)} className="hover:bg-[#f3faf9] transition">
                        <td className="px-4 py-2.5 align-middle">
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-800">
                              {firma.firmaAdi || "-"}
                            </span>
                            <span className="text-xs text-slate-500 mt-1">
                              {firma.atanmisKullaniciAdSoyad || "Atanmamış kullanıcı"}
                            </span>
                          </div>
                        </td>

                        <td className="px-3 py-2.5 text-center align-middle">
                          {statusCell(firma._normalizedDocs.risk)}
                        </td>
                        <td className="px-3 py-2.5 text-center align-middle">
                          {statusCell(firma._normalizedDocs.acil)}
                        </td>
                        <td className="px-3 py-2.5 text-center align-middle">
                          {statusCell(firma._normalizedDocs.yillik)}
                        </td>
                        <td className="px-3 py-2.5 text-center align-middle">
                          {statusCell(firma._normalizedDocs.egitim)}
                        </td>
                        <td className="px-3 py-2.5 text-center align-middle">
                          {statusCell(firma._normalizedDocs.defter)}
                        </td>

                        <td className="px-4 py-2.5 align-middle">
                          <span
                            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                              firma._overallStatus.key === "critical"
                                ? "bg-red-50 text-red-600 border border-red-100"
                                : firma._overallStatus.key === "warning"
                                ? "bg-amber-50 text-amber-600 border border-amber-100"
                                : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                            }`}
                          >
                            <span>{firma._overallStatus.icon}</span>
                            <span>{firma._overallStatus.label}</span>
                          </span>
                        </td>

                        <td className="px-4 py-3 text-right align-middle">
                          <button
                            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-medium transition"
                            onClick={() => setDetail(firma)}
                          >
                            <HiEye className="text-base" />
                            İncele
                          </button>
                        </td>
                      </tr>
                    ))}

                    {detailFilteredFirmalar.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center">
                          <div className="flex flex-col items-center justify-center gap-2 text-slate-500">
                            <div className="text-3xl">📂</div>
                            <div className="font-medium text-slate-700">
                              Kayıt bulunamadı
                            </div>
                            <div className="text-sm text-slate-500">
                              Bu filtre kriterine uygun firma listesi bulunmuyor.
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {detail && (
                <div className="mt-3 rounded-xl border border-slate-200 p-3 bg-white shadow-sm">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                    <div>
                      <h4 className="font-semibold text-slate-800 text-base md:text-lg">
                        Firma Detayı - {detail.firmaAdi}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Seçilen firmaya ait belge ve durum özeti
                      </p>
                    </div>

                    <button
                      onClick={() => setDetail(null)}
                      className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-medium transition self-start"
                    >
                      Kapat
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 text-sm">
                    <div className="rounded-xl border bg-white p-3">
                      <div className="text-xs text-slate-500 mb-1">SGK</div>
                      <div className="font-semibold text-slate-800">
                        {sgkOf(detail)}
                      </div>
                    </div>

                    <div className="rounded-xl border bg-white p-3">
                      <div className="text-xs text-slate-500 mb-1">NACE</div>
                      <div className="font-semibold text-slate-800">
                        {detail.nace || "-"}
                      </div>
                    </div>

                    <div className="rounded-xl border bg-white p-3">
                      <div className="text-xs text-slate-500 mb-1">Tehlike</div>
                      <div className="font-semibold text-slate-800">
                        {detail.tehlike || "-"}
                      </div>
                    </div>

                    <div className="rounded-xl border bg-white p-3">
                      <div className="text-xs text-slate-500 mb-1">Kullanıcı</div>
                      <div className="font-semibold text-slate-800">
                        {detail.atanmisKullaniciAdSoyad || "-"}
                      </div>
                    </div>

                    {["risk", "acil", "yillik", "egitim", "defter"].map((key) => (
                      <div key={key} className="rounded-lg bg-white border p-3">
                        <div className="text-slate-500 mb-1 capitalize">{key}</div>
                        <div className={detail._normalizedDocs[key].color}>
                          {detail._normalizedDocs[key].icon}{" "}
                          {detail._normalizedDocs[key].label}
                        </div>
                      </div>
                    ))}

                    <div className="md:col-span-2 xl:col-span-4 rounded-xl border bg-white p-3">
                      <div className="text-xs text-slate-500 mb-1">Adres</div>
                      <div className="font-medium text-slate-800">
                        {detail.adres || "-"}
                      </div>
                    </div>

                    <div className="md:col-span-2 xl:col-span-4 rounded-xl border bg-white p-3">
                      <div className="text-xs text-slate-500 mb-1">Faaliyet</div>
                      <div className="font-medium text-slate-800">
                        {detail.faaliyet || "-"}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}