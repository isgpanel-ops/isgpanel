// src/pages/super/SistemDurumu.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Server,
  Cpu,
  MemoryStick,
  HardDrive,
  Gauge,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  PlugZap,
  Wrench,
  Terminal,
  CircleDot,
  Timer,
  Info,
} from "lucide-react";

/**
 * ✅ Süper Admin > Sistem Durumu
 * Amaç: Performans ve altyapı takibi
 * - API servis sağlıkları
 * - CPU/RAM/Disk doluluk
 * - Hata oranı
 * - Cron/Job durumu
 *
 * Şu an mock data + otomatik yenileme var.
 * Backend bağlayınca: fetch(...) ile gerçek metrikleri doldur.
 */

const BRAND = "#0a2b45";

function cn(...a) {
  return a.filter(Boolean).join(" ");
}

function pad2(n) {
  return n < 10 ? `0${n}` : `${n}`;
}
function formatTime(ts) {
  const d = new Date(ts);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}
function clampPct(x) {
  return Math.max(0, Math.min(100, x));
}
function fmtMs(x) {
  if (x < 1000) return `${Math.round(x)} ms`;
  return `${(x / 1000).toFixed(2)} s`;
}
function fmtPct(x) {
  return `${x.toFixed(2)}%`;
}
function fmtBytesGB(gb) {
  return `${gb.toFixed(1)} GB`;
}

function getDiskPct(infra = {}) {
  const diskPctFromApi = Number(infra?.diskPct || 0);
  if (diskPctFromApi > 0) return diskPctFromApi;

  const total = Number(infra?.diskTotalGB || 0);
  const used = Number(infra?.diskUsedGB || 0);
  if (total <= 0) return 0;

  return (used / total) * 100;
}

function getExternalStoragePct(infra = {}) {
  const total = Number(infra?.externalStorageTotalGB || 0);
  const used = Number(infra?.externalStorageUsedGB || 0);

  if (total <= 0) return 0;

  return (used / total) * 100;
}

function fmtDurationSec(s) {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m}m`;
}

function Badge({ tone = "neutral", children, icon }) {
  const base =
    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium";
  const styles =
    tone === "good"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : tone === "warn"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : tone === "bad"
      ? "bg-red-50 text-red-700 border-red-200"
      : tone === "info"
      ? "bg-sky-50 text-sky-700 border-sky-200"
      : "bg-slate-50 text-slate-700 border-slate-200";
  return (
    <span className={cn(base, styles)}>
      {icon ? <span className="opacity-80">{icon}</span> : null}
      {children}
    </span>
  );
}

function Button({ variant = "primary", className, children, ...props }) {
  const base =
    "inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed";
  const styles =
    variant === "primary"
      ? "text-white shadow-sm"
      : variant === "ghost"
      ? "bg-transparent hover:bg-black/5 text-slate-800"
      : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-900";
  const styleProp =
    variant === "primary" ? { backgroundColor: BRAND } : undefined;

  return (
    <button
      {...props}
      style={styleProp}
      className={cn(base, styles, className)}
    >
      {children}
    </button>
  );
}

function Card({ className, children }) {
  return (
    <div
      className={cn(
        "bg-white border border-slate-200 rounded-2xl shadow-sm",
        className
      )}
    >
      {children}
    </div>
  );
}

function CardHeader({ title, subtitle, right }) {
  return (
    <div className="p-5 border-b border-slate-200 flex items-start justify-between gap-4">
      <div>
        <div className="text-lg font-semibold text-slate-900">{title}</div>
        {subtitle ? (
          <div className="text-sm text-slate-500 mt-1">{subtitle}</div>
        ) : null}
      </div>
      {right}
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-slate-200 my-3" />;
}

function ProgressBar({ value, labelLeft, labelRight, tone }) {
  const v = clampPct(value);
  const barTone =
    tone === "good"
      ? "bg-emerald-500"
      : tone === "warn"
      ? "bg-amber-500"
      : tone === "bad"
      ? "bg-red-500"
      : "bg-slate-800";

  return (
    <div>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{labelLeft}</span>
        <span className="font-medium text-slate-700">{labelRight}</span>
      </div>
      <div className="mt-1 w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={cn("h-full rounded-full", barTone)}
          style={{ width: `${v}%` }}
        />
      </div>
    </div>
  );
}

function Sparkline({ points, height = 36 }) {
  // points: array of numbers 0..100 or any positive
  const w = 160;
  const h = height;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = Math.max(max - min, 1);

  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * (w - 2) + 1;
      const y = h - ((p - min) / range) * (h - 2) - 1;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

// ---------------- Mock generator ----------------
function randBetween(min, max) {
  return Math.random() * (max - min) + min;
}
function jitter(value, amount, min = 0, max = 100) {
  return clampPct(value + randBetween(-amount, amount));
}
function statusFromLatencyAndErrors(latencyMs, errorPct) {
  if (errorPct >= 2 || latencyMs >= 1500) return "down";
  if (errorPct >= 0.7 || latencyMs >= 800) return "degraded";
  return "up";
}
function toneFromPct(pct, kind) {
  // kind: "util" -> lower better, "error" -> lower better
  if (kind === "error") {
    if (pct >= 2) return "bad";
    if (pct >= 0.7) return "warn";
    return "good";
  }
  // utilization
  if (pct >= 90) return "bad";
  if (pct >= 75) return "warn";
  return "good";
}

function getInfraHealth(infra = {}, api = [], jobs = []) {
  const cpu = Number(infra?.cpuPct || 0);
  const disk =
    Number(infra?.diskPct || 0) > 0
      ? Number(infra.diskPct)
      : Number(infra?.diskTotalGB || 0) > 0
      ? (Number(infra?.diskUsedGB || 0) / Number(infra?.diskTotalGB || 1)) * 100
      : 0;

  const ramPct =
    Number(infra?.ramTotalGB || 0) > 0
      ? (Number(infra?.ramUsedGB || 0) / Number(infra?.ramTotalGB || 1)) * 100
      : 0;

  const hasDownApi = api.some((x) => x.status === "down");
  const hasBadJob = jobs.some(
    (x) =>
      x.status === "failed" ||
      x.status === "error" ||
      x.result === "failed" ||
      x.result === "error"
  );

  if (hasDownApi || hasBadJob || cpu >= 90 || disk >= 90 || ramPct >= 90) {
    return "bad";
  }

  if (cpu >= 70 || disk >= 75 || ramPct >= 75) {
    return "warn";
  }

  return "good";
}

function createInitialState() {
  const now = Date.now();

  const api = [
    {
      id: "api_main",
      name: "API",
      endpoint: "/health",
      latencyMs: 180,
      errorRatePct: 0.08,
      uptime24hPct: 99.96,
      lastCheckedAt: now,
    },
    {
      id: "api_pdf",
      name: "PDF Service",
      endpoint: "/pdf/health",
      latencyMs: 420,
      errorRatePct: 0.25,
      uptime24hPct: 99.88,
      lastCheckedAt: now,
    },
    {
      id: "api_db",
      name: "DB",
      endpoint: "postgres",
      latencyMs: 65,
      errorRatePct: 0.02,
      uptime24hPct: 99.99,
      lastCheckedAt: now,
    },
    {
      id: "api_storage",
      name: "Storage",
      endpoint: "s3/minio",
      latencyMs: 120,
      errorRatePct: 0.12,
      uptime24hPct: 99.92,
      lastCheckedAt: now,
    },
  ].map((s) => ({
    ...s,
    status: statusFromLatencyAndErrors(s.latencyMs, s.errorRatePct),
  }));

  const infra = {
    cpuPct: 34,
    ramUsedGB: 6.7,
    ramTotalGB: 16,
    diskUsedGB: 78.2,
    diskTotalGB: 120,
    loadAvg: 0.92,
    lastUpdatedAt: now,
  };

  const errors = {
    errorRatePct: 0.18,
    p95LatencyMs: 420,
    reqPerMin: 1280,
    history: Array.from({ length: 24 }, (_, i) => 0.1 + Math.sin(i / 2) * 0.05),
    lastUpdatedAt: now,
  };

  const jobs = [
    {
      id: "job_birthday",
      name: "Birthday Campaign",
      schedule: "Daily 09:00",
      lastRunAt: now - 1000 * 60 * 60 * 24,
      durationSec: 12,
      result: "success",
      nextRunAt: now + 1000 * 60 * 60 * 10,
      notes: "Doğum günü bildirimleri",
    },
    {
      id: "job_doc_expiry",
      name: "Document Expiry Alerts",
      schedule: "Every 1h",
      lastRunAt: now - 1000 * 60 * 28,
      durationSec: 9,
      result: "success",
      nextRunAt: now + 1000 * 60 * 32,
      notes: "Evrak tarih uyarıları",
    },
    {
      id: "job_cleanup",
      name: "Cleanup / Temp Files",
      schedule: "Daily 03:30",
      lastRunAt: now - 1000 * 60 * 60 * 7,
      durationSec: 35,
      result: "warn",
      nextRunAt: now + 1000 * 60 * 60 * 20,
      notes: "Bazı geçici dosyalar kilitliydi",
    },
    {
      id: "job_reports",
      name: "Daily Metrics Snapshot",
      schedule: "Daily 00:10",
      lastRunAt: now - 1000 * 60 * 60 * 22,
      durationSec: 18,
      result: "failed",
      nextRunAt: now + 1000 * 60 * 60 * 2,
      notes: "DB timeout (p95 yükseldiğinde olur)",
    },
  ];

  return { api, infra, errors, jobs };
}

export default function SistemDurumu() {

  const API_BASE =
  (import.meta.env.VITE_API_URL || "").trim().replace(/\/$/, "") ||
  "https://api.isgpanel.tr/api";

  const [data, setData] = useState(() => createInitialState());
const [autoRefresh, setAutoRefresh] = useState(true);
const [refreshEverySec, setRefreshEverySec] = useState(15);
const [selectedServiceId, setSelectedServiceId] = useState(
  () => createInitialState().api[0]?.id || null
);
const [selectedJobId, setSelectedJobId] = useState(
  () => createInitialState().jobs[0]?.id || null
);

const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);

const DISK_MIGRATION_THRESHOLD = 80;
const DOCUMENT_MIGRATION_BATCH_LIMIT = 25;

const [storageMoving, setStorageMoving] = useState(false);
const [storageMoveResult, setStorageMoveResult] = useState(null);

  // Ensure selections exist
  useEffect(() => {
  const hasSelectedService = data.api.some((x) => x.id === selectedServiceId);
  const hasSelectedJob = data.jobs.some((x) => x.id === selectedJobId);

  if (!hasSelectedService) {
    setSelectedServiceId(data.api[0]?.id || null);
  }

  if (!hasSelectedJob) {
    setSelectedJobId(data.jobs[0]?.id || null);
  }
}, [data.api, data.jobs, selectedServiceId, selectedJobId]);

// ✅ Sayfa ilk açılınca 1 kere backend'den çek
useEffect(() => {
  loadStatus();
}, []);


  const selectedService = useMemo(
    () => data.api.find((x) => x.id === selectedServiceId) || null,
    [data.api, selectedServiceId]
  );
  const selectedJob = useMemo(
    () => data.jobs.find((x) => x.id === selectedJobId) || null,
    [data.jobs, selectedJobId]
  );

  
const derived = useMemo(() => {
  const up = data.api.filter((s) => s.status === "up").length;
  const degraded = data.api.filter((s) => s.status === "degraded").length;
  const down = data.api.filter((s) => s.status === "down").length;

  const ramPct =
    Number(data.infra?.ramTotalGB || 0) > 0
      ? (Number(data.infra?.ramUsedGB || 0) / Number(data.infra?.ramTotalGB || 1)) * 100
      : 0;

  const diskPct =
    Number(data.infra?.diskPct || 0) > 0
      ? Number(data.infra.diskPct)
      : Number(data.infra?.diskTotalGB || 0) > 0
      ? (Number(data.infra?.diskUsedGB || 0) / Number(data.infra?.diskTotalGB || 1)) * 100
      : 0;

  const externalStoragePct = getExternalStoragePct(data.infra);

  const cpuTone = toneFromPct(Number(data.infra?.cpuPct || 0), "util");
  const ramTone = toneFromPct(ramPct, "util");
  const diskTone = toneFromPct(diskPct, "util");
  const externalStorageTone = toneFromPct(externalStoragePct, "util");
  const errTone = toneFromPct(Number(data.errors?.errorRatePct || 0), "error");

  const failedJobs = data.jobs.filter(
    (j) =>
      j.result === "failed" ||
      j.result === "error" ||
      j.status === "failed" ||
      j.status === "error"
  ).length;

  const health = getInfraHealth(data.infra, data.api, data.jobs);

  return {
    up,
    degraded,
    down,
    cpuTone,
    ramPct,
    ramTone,
    diskPct,
    diskTone,
    externalStoragePct,
    externalStorageTone,
    errTone,
    health,
    failedJobs,
    hasExternalStorage:
      Number(data.infra?.externalStorageTotalGB || 0) > 0,
    isDiskAboveMigrationThreshold: diskPct >= DISK_MIGRATION_THRESHOLD,
  };
}, [data]);


async function loadStatus() {
  setLoading(true);
  setError(null);

  try {
    const token =
      localStorage.getItem("token") ||
      localStorage.getItem("jwt") ||
      localStorage.getItem("accessToken") ||
      localStorage.getItem("authToken") ||
      sessionStorage.getItem("token") ||
      sessionStorage.getItem("jwt") ||
      sessionStorage.getItem("accessToken") ||
      sessionStorage.getItem("authToken") ||
      "";

    const res = await fetch(`${API_BASE}/super/system-status`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!res.ok) {
      throw new Error(`API Hatası: ${res.status}`);
    }

    const json = await res.json();

    setData({
      api: Array.isArray(json?.api) ? json.api : [],
     infra: json?.infra || {
  cpuPct: 0,
  ramUsedGB: 0,
  ramTotalGB: 1,
  diskUsedGB: 0,
  diskTotalGB: 1,
  externalStorageUsedGB: 0,
  externalStorageTotalGB: 0,
  loadAvg: 0,
  lastUpdatedAt: Date.now(),
},
      errors: json?.errors || {
        errorRatePct: 0,
        p95LatencyMs: 0,
        reqPerMin: 0,
        history: [],
        lastUpdatedAt: Date.now(),
      },
      jobs: Array.isArray(json?.jobs) ? json.jobs : [],
    });
  } catch (e) {
    setError(e?.message || "Veri çekilemedi");
  } finally {
    setLoading(false);
  }
}

async function handleMoveDocumentsToExternalStorage() {
  const diskPct = getDiskPct(data?.infra);

  if (diskPct < DISK_MIGRATION_THRESHOLD) {
    setStorageMoveResult({
      ok: false,
      message: `Disk kullanımı henüz %${DISK_MIGRATION_THRESHOLD} seviyesine ulaşmadı. Mevcut oran: %${Math.round(diskPct)}.`,
    });
    return;
  }

  setStorageMoving(true);
  setStorageMoveResult(null);

  try {
    const token =
      localStorage.getItem("token") ||
      localStorage.getItem("jwt") ||
      localStorage.getItem("accessToken") ||
      localStorage.getItem("authToken") ||
      sessionStorage.getItem("token") ||
      sessionStorage.getItem("jwt") ||
      sessionStorage.getItem("accessToken") ||
      sessionStorage.getItem("authToken") ||
      "";

    const res = await fetch(`${API_BASE}/super/storage/migrate-documents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        onlyIfDiskAbovePct: DISK_MIGRATION_THRESHOLD,
        limit: DOCUMENT_MIGRATION_BATCH_LIMIT,
      }),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(json?.message || `Taşıma işlemi başarısız: ${res.status}`);
    }

    setStorageMoveResult({
      ok: true,
      message:
        json?.message || "Belgeler harici depoya başarıyla taşındı.",
      movedCount: Number(json?.movedCount || 0),
      skippedCount: Number(json?.skippedCount || 0),
      failedCount: Number(json?.failedCount || 0),
      beforeDiskPct:
        typeof json?.beforeDiskPct === "number" ? json.beforeDiskPct : null,
      afterDiskPct:
        typeof json?.afterDiskPct === "number" ? json.afterDiskPct : null,
    });

    await loadStatus();
  } catch (e) {
    const networkMessage =
      e?.name === "TypeError" && String(e?.message || "").includes("fetch")
        ? `API baglantisi kurulamadi. Adres: ${API_BASE}`
        : null;
    setStorageMoveResult({
      ok: false,
      message: networkMessage || e?.message || "Taşıma işlemi sırasında hata oluştu.",
    });
  } finally {
    setStorageMoving(false);
  }
}


  function simulateRefresh() {
    setData((prev) => {
      const now = Date.now();

      // Infra jitter
      const cpu = jitter(prev.infra.cpuPct, 6, 0, 100);
      const ramUsed = Math.max(
        0,
        Math.min(prev.infra.ramTotalGB, prev.infra.ramUsedGB + randBetween(-0.4, 0.5))
      );
      const diskUsed = Math.max(
        0,
        Math.min(prev.infra.diskTotalGB, prev.infra.diskUsedGB + randBetween(-0.3, 0.6))
      );

      // Errors jitter (keep small)
      const errorRate = Math.max(0, prev.errors.errorRatePct + randBetween(-0.08, 0.12));
      const p95 = Math.max(50, prev.errors.p95LatencyMs + randBetween(-80, 140));
      const rpm = Math.max(0, prev.errors.reqPerMin + randBetween(-220, 260));
      const nextHistory = [...prev.errors.history.slice(1), errorRate];

      // Services jitter
      const api = prev.api.map((s) => {
        const latency = Math.max(30, s.latencyMs + randBetween(-60, 120));
        const err = Math.max(0, s.errorRatePct + randBetween(-0.08, 0.15));
        const status = statusFromLatencyAndErrors(latency, err);
        return {
          ...s,
          latencyMs: latency,
          errorRatePct: err,
          status,
          lastCheckedAt: now,
        };
      });

      // Jobs: occasionally flip a warn->success or success->warn (rare)
      const jobs = prev.jobs.map((j) => {
        let result = j.result;
        if (Math.random() < 0.06) {
          result = result === "failed" ? "warn" : result === "warn" ? "success" : "warn";
        }
        return { ...j, result };
      });

      return {
        api,
        infra: { ...prev.infra, cpuPct: cpu, ramUsedGB: ramUsed, diskUsedGB: diskUsed, lastUpdatedAt: now },
        errors: { ...prev.errors, errorRatePct: errorRate, p95LatencyMs: p95, reqPerMin: rpm, history: nextHistory, lastUpdatedAt: now },
        jobs,
      };
    });
  }

  // Auto refresh timer
  useEffect(() => {
    if (!autoRefresh) return;
    const ms = Math.max(5, refreshEverySec) * 1000;
    const t = setInterval(loadStatus, ms);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, refreshEverySec]);

  return (
    <div className="p-3 md:p-6 bg-slate-50 min-h-[calc(100vh-0px)]">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-2xl font-semibold text-slate-900">Sistem Durumu</div>
          <div className="text-sm text-slate-500 mt-1">
            Performans, altyapı metrikleri, hata oranı ve cron/job durumları.
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {derived.health === "good" ? (
              <Badge tone="good" icon={<CheckCircle2 className="w-4 h-4" />}>
                Sistem Sağlıklı
              </Badge>
            ) : derived.health === "warn" ? (
              <Badge tone="warn" icon={<AlertTriangle className="w-4 h-4" />}>
                Kısmi Sorunlar
              </Badge>
            ) : (
              <Badge tone="bad" icon={<XCircle className="w-4 h-4" />}>
                Kritik Sorun
              </Badge>
            )}

            <Badge tone="neutral" icon={<Clock className="w-4 h-4" />}>
              Son güncelleme: {formatTime(data.infra.lastUpdatedAt)}
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            onClick={loadStatus}
            title="Verileri yenile"
          >
            <RefreshCw className="w-4 h-4" />
            Yenile
          </Button>

          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200">
            <label className="text-sm text-slate-700 flex items-center gap-2">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              Otomatik
            </label>
            <div className="w-px h-5 bg-slate-200" />
            <select
              value={refreshEverySec}
              onChange={(e) => setRefreshEverySec(Number(e.target.value))}
              className="text-sm outline-none bg-transparent"
              disabled={!autoRefresh}
            >
              <option value={10}>10 sn</option>
              <option value={15}>15 sn</option>
              <option value={30}>30 sn</option>
              <option value={60}>60 sn</option>
            </select>
          </div>
        </div>
      </div>

{error ? (
  <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
    {error}
  </div>
) : null}

{loading ? (
  <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
    Sistem durumu yükleniyor...
  </div>
) : null}


      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-5">
        <Kpi
          icon={<Server className="w-5 h-5" />}
          label="Servis Sağlığı"
          value={`${derived.up}/${data.api.length}`}
          hint={derived.down > 0 ? `${derived.down} down` : derived.degraded > 0 ? `${derived.degraded} degraded` : "Tümü çalışıyor"}
          tone={derived.down > 0 ? "bad" : derived.degraded > 0 ? "warn" : "good"}
        />
        <Kpi
          icon={<Gauge className="w-5 h-5" />}
          label="Hata Oranı"
          value={fmtPct(data.errors.errorRatePct)}
          hint={`p95: ${fmtMs(data.errors.p95LatencyMs)}`}
          tone={derived.errTone}
        />
        <Kpi
          icon={<Cpu className="w-5 h-5" />}
          label="CPU Kullanımı"
          value={`${Math.round(data.infra.cpuPct)}%`}
          hint={`Load: ${data.infra.loadAvg.toFixed(2)}`}
          tone={derived.cpuTone}
        />
        <Kpi
  icon={<Timer className="w-5 h-5" />}
  label="Başarısız Job"
  value={`${derived.failedJobs}`}
  hint={derived.failedJobs ? "İnceleme gerekli" : "Sorun yok"}
  tone={derived.failedJobs > 0 ? "bad" : "good"}
/>
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-4 mt-4">
        {/* LEFT */}
        <div className="space-y-4">
          {/* Infrastructure */}
          <Card className="overflow-hidden">
            <CardHeader
  title="Altyapı Kullanımı"
  subtitle="CPU / RAM / Disk doluluk"
  right={
    <div className="flex flex-wrap items-center gap-2 justify-end">
      <Badge tone="info" icon={<Info className="w-4 h-4" />}>
        Canlı metrik
      </Badge>

    <Button
  variant={derived.isDiskAboveMigrationThreshold ? "primary" : "secondary"}
  onClick={handleMoveDocumentsToExternalStorage}
  disabled={
  storageMoving ||
  !derived.isDiskAboveMigrationThreshold ||
  !derived.hasExternalStorage
}
  title="Disk doluluğu yüksekse belgeleri Hetzner harici depoya taşı"
>
  <HardDrive className="w-4 h-4" />
  {storageMoving
  ? "Taşınıyor..."
  : derived.hasExternalStorage
  ? "Harici Depoya Taşı"
  : "Harici Depo Yok"}
</Button>
    </div>
  }
/>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <InfraTile
                icon={<Cpu className="w-4 h-4" />}
                title="CPU"
                main={`${Math.round(data.infra.cpuPct)}%`}
                sub="Anlık kullanım"
                bar={
                  <ProgressBar
  value={data.infra.cpuPct}
  labelLeft="0%"
  labelRight={`${Math.round(data.infra.cpuPct)}%`}
  tone={derived.cpuTone}
/>
                }
              />
              <InfraTile
                icon={<MemoryStick className="w-4 h-4" />}
                title="RAM"
                main={`${fmtBytesGB(data.infra.ramUsedGB)} / ${fmtBytesGB(data.infra.ramTotalGB)}`}
                sub="Kullanılan / toplam"
                bar={
                  <ProgressBar
  value={derived.ramPct}
  labelLeft="0%"
  labelRight={`${Math.round(derived.ramPct)}%`}
  tone={derived.ramTone}
/>
                }
              />
              <InfraTile
  icon={<HardDrive className="w-4 h-4" />}
  title="Disk"
  main={`${fmtBytesGB(data.infra.diskUsedGB)} / ${fmtBytesGB(data.infra.diskTotalGB)}`}
  sub={
    derived.isDiskAboveMigrationThreshold
      ? "Eşik aşıldı • Harici depoya taşıma önerilir"
      : "Kullanılan / toplam"
  }
  bar={
    <ProgressBar
      value={derived.diskPct}
      labelLeft="0%"
      labelRight={`${Math.round(derived.diskPct)}%`}
      tone={derived.diskTone}
    />
  }
/>

<InfraTile
  icon={<HardDrive className="w-4 h-4" />}
  title="Harici Depo"
  main={
    derived.hasExternalStorage
      ? `${fmtBytesGB(Number(data.infra.externalStorageUsedGB || 0))} / ${fmtBytesGB(Number(data.infra.externalStorageTotalGB || 0))}`
      : "Bağlı değil"
  }
  sub={
    derived.hasExternalStorage
      ? "Storage Box kullanımı"
      : "Harici depo verisi bekleniyor"
  }
  bar={
    <ProgressBar
      value={derived.externalStoragePct}
      labelLeft="0%"
      labelRight={
        derived.hasExternalStorage
          ? `${Math.round(derived.externalStoragePct)}%`
          : "0%"
      }
      tone={derived.externalStorageTone}
    />
  }
/>
            </div>

{storageMoveResult ? (
  <div className="px-4 pb-4">
    <div
      className={cn(
        "rounded-2xl border px-4 py-3 text-sm",
        storageMoveResult.ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-red-200 bg-red-50 text-red-700"
      )}
    >
      <div className="font-medium">{storageMoveResult.message}</div>

      {storageMoveResult.ok ? (
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <Badge tone="good">Taşınan: {storageMoveResult.movedCount ?? 0}</Badge>
          <Badge tone="neutral">Atlanan: {storageMoveResult.skippedCount ?? 0}</Badge>
          <Badge tone="bad">Hatalı: {storageMoveResult.failedCount ?? 0}</Badge>

          {typeof storageMoveResult.beforeDiskPct === "number" ? (
            <Badge tone="warn">
              Önce: %{Math.round(storageMoveResult.beforeDiskPct)}
            </Badge>
          ) : null}

          {typeof storageMoveResult.afterDiskPct === "number" ? (
            <Badge tone="good">
              Sonra: %{Math.round(storageMoveResult.afterDiskPct)}
            </Badge>
          ) : null}
        </div>
      ) : null}
    </div>
  </div>
) : null}


          </Card>

          {/* Services */}
          <Card className="overflow-hidden">
            <CardHeader
              title="Servisler"
              subtitle="API, DB, PDF, Storage sağlık kontrolleri"
              right={
                <div className="flex items-center gap-2">
                  <Badge tone={derived.down ? "bad" : derived.degraded ? "warn" : "good"} icon={<CircleDot className="w-4 h-4" />}>
                    Up: {derived.up} • Degraded: {derived.degraded} • Down: {derived.down}
                  </Badge>
                </div>
              }
            />
            <div className="p-4">
              <div className="flex flex-col gap-2">
                {data.api.map((s) => (
                  <ServiceRow
                    key={s.id}
                    item={s}
                    active={s.id === selectedServiceId}
                    onClick={() => setSelectedServiceId(s.id)}
                  />
                ))}
              </div>
            </div>
          </Card>

          {/* Cron/Jobs */}
          <Card className="overflow-hidden">
            <CardHeader
              title="Cron / Job Durumu"
              subtitle="Planlanan işler ve son çalıştırma sonuçları"
              right={
                <Badge
                  tone={derived.failedJobs ? "bad" : "good"}
                  icon={derived.failedJobs ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                >
                  {derived.failedJobs ? `${derived.failedJobs} failed` : "Tümü başarılı"}
                </Badge>
              }
            />
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {data.jobs.map((j) => (
                  <JobRow
                    key={j.id}
                    item={j}
                    active={j.id === selectedJobId}
                    onClick={() => setSelectedJobId(j.id)}
                  />
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* RIGHT: Details */}
        <Card className="overflow-hidden">
          <CardHeader
            title="Detay"
            subtitle="Seçili servis ve job ayrıntıları"
            right={
              <Button
                variant="secondary"
                onClick={() => alert("İleride: log ekranına git / issue aç")}
              >
                <Terminal className="w-4 h-4" />
                Log / Debug
              </Button>
            }
          />
          <div className="p-4 space-y-4">
            {/* Error panel */}
            <Card className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <Gauge className="w-4 h-4" />
                    Hata & Gecikme
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Son 24 örnek 
                  </div>
                </div>

                <Badge tone={toneFromPct(data.errors.errorRatePct, "error")} icon={<AlertTriangle className="w-4 h-4" />}>
                  {fmtPct(data.errors.errorRatePct)}
                </Badge>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <div className="text-sm text-slate-700">
                  p95: <span className="font-semibold">{fmtMs(data.errors.p95LatencyMs)}</span>
                  <span className="text-slate-400"> • </span>
                  RPM: <span className="font-semibold">{Math.round(data.errors.reqPerMin)}</span>
                </div>
                <div className="text-slate-700">
                  <Sparkline points={data.errors.history.map((x) => x * 20)} />
                </div>
              </div>

              <div className="mt-3">
                <ProgressBar
                  value={Math.min(100, data.errors.errorRatePct * 20)}
                  labelLeft="0%"
                  labelRight={`Hata seviyesi (ölçekli): ${Math.min(100, data.errors.errorRatePct * 20).toFixed(0)}%`}
                  tone={toneFromPct(data.errors.errorRatePct, "error")}
                />
              </div>
            </Card>

            {/* Selected service */}
            <Card className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <PlugZap className="w-4 h-4" />
                    Seçili Servis
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Sağlık kontrolü & metrikler
                  </div>
                </div>
                {selectedService ? (
                  <Badge
                    tone={
                      selectedService.status === "up"
                        ? "good"
                        : selectedService.status === "degraded"
                        ? "warn"
                        : "bad"
                    }
                    icon={
                      selectedService.status === "up" ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : selectedService.status === "degraded" ? (
                        <AlertTriangle className="w-4 h-4" />
                      ) : (
                        <XCircle className="w-4 h-4" />
                      )
                    }
                  >
                    {selectedService.status === "up"
                      ? "Up"
                      : selectedService.status === "degraded"
                      ? "Degraded"
                      : "Down"}
                  </Badge>
                ) : null}
              </div>

              {!selectedService ? (
                <div className="text-sm text-slate-500 mt-3">Servis seçilmedi.</div>
              ) : (
                <>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Meta label="Servis">{selectedService.name}</Meta>
                    <Meta label="Endpoint">{selectedService.endpoint}</Meta>
                    <Meta label="Latency">{fmtMs(selectedService.latencyMs)}</Meta>
                    <Meta label="Error Rate">{fmtPct(selectedService.errorRatePct)}</Meta>
                    <Meta label="Uptime (24h)">{fmtPct(selectedService.uptime24hPct)}</Meta>
                    <Meta label="Son kontrol">{formatTime(selectedService.lastCheckedAt)}</Meta>
                  </div>

                  <Divider />

                  <ProgressBar
                    value={Math.min(100, (selectedService.latencyMs / 2000) * 100)}
                    labelLeft="Latency"
                    labelRight={`p: ${fmtMs(selectedService.latencyMs)}`}
                    tone={selectedService.latencyMs >= 1500 ? "bad" : selectedService.latencyMs >= 800 ? "warn" : "good"}
                  />
                  <div className="mt-3">
                    <ProgressBar
                      value={Math.min(100, selectedService.errorRatePct * 20)}
                      labelLeft="Error"
                      labelRight={`${fmtPct(selectedService.errorRatePct)}`}
                      tone={toneFromPct(selectedService.errorRatePct, "error")}
                    />
                  </div>
                </>
              )}
            </Card>

            {/* Selected job */}
            <Card className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <Wrench className="w-4 h-4" />
                    Seçili Job
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Son çalışma ve plan bilgisi
                  </div>
                </div>
                {selectedJob ? (
                  <Badge
                    tone={
  (selectedJob.result || selectedJob.status) === "success"
    ? "good"
    : (selectedJob.result || selectedJob.status) === "warn"
    ? "warn"
    : "bad"
}
icon={
  (selectedJob.result || selectedJob.status) === "success" ? (
    <CheckCircle2 className="w-4 h-4" />
  ) : (selectedJob.result || selectedJob.status) === "warn" ? (
    <AlertTriangle className="w-4 h-4" />
  ) : (
    <XCircle className="w-4 h-4" />
  )
}
>
  {selectedJob.result || selectedJob.status || "unknown"}
                  </Badge>
                ) : null}
              </div>

              {!selectedJob ? (
                <div className="text-sm text-slate-500 mt-3">Job seçilmedi.</div>
              ) : (
                <>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Meta label="Job">{selectedJob.name}</Meta>
                    <Meta label="Schedule">{selectedJob.schedule}</Meta>
                    <Meta label="Last Run">{formatTime(selectedJob.lastRunAt)}</Meta>
                    <Meta label="Duration">{fmtDurationSec(selectedJob.durationSec)}</Meta>
                    <Meta label="Next Run">{formatTime(selectedJob.nextRunAt)}</Meta>
                    <Meta label="Not">{selectedJob.notes}</Meta>
                  </div>
                </>
              )}
            </Card>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ---------------- UI Subcomponents ----------------
function Kpi({ icon, label, value, hint, tone }) {
  const toneBadge =
    tone === "good" ? "good" : tone === "warn" ? "warn" : tone === "bad" ? "bad" : "neutral";
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-700">
          {icon}
        </div>
        <Badge tone={toneBadge}>{value}</Badge>
      </div>
      <div className="mt-3 text-sm font-medium text-slate-800">{label}</div>
      <div className="text-xs text-slate-500 mt-1">{hint}</div>
    </Card>
  );
}

function InfraTile({ icon, title, main, sub, bar }) {
  return (
    <div className="p-4 rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <span className="w-8 h-8 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-700">
            {icon}
          </span>
          {title}
        </div>
        <span className="text-xs text-slate-500">{sub}</span>
      </div>
      <div className="mt-3 text-base font-semibold text-slate-900">{main}</div>
      <div className="mt-3">{bar}</div>
    </div>
  );
}

function ServiceRow({ item, active, onClick }) {
  const tone =
    item.status === "up" ? "good" : item.status === "degraded" ? "warn" : "bad";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left p-3 rounded-2xl border transition shadow-sm",
        active
          ? "border-slate-900 bg-slate-50"
          : "border-slate-200 bg-white hover:bg-slate-50"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="w-9 h-9 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-700">
              <Server className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900 truncate">
                {item.name}
              </div>
              <div className="text-xs text-slate-500 truncate">
                {item.endpoint}
              </div>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            <Badge
              tone={tone}
              icon={
                item.status === "up" ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : item.status === "degraded" ? (
                  <AlertTriangle className="w-4 h-4" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )
              }
            >
              {item.status}
            </Badge>
            <Badge tone="neutral" icon={<Gauge className="w-4 h-4" />}>
              {fmtMs(item.latencyMs)}
            </Badge>
            <Badge
              tone={toneFromPct(item.errorRatePct, "error")}
              icon={<AlertTriangle className="w-4 h-4" />}
            >
              {fmtPct(item.errorRatePct)}
            </Badge>
            <Badge tone="info" icon={<Activity className="w-4 h-4" />}>
              24h {fmtPct(item.uptime24hPct)}
            </Badge>
          </div>
        </div>

        <div className="text-xs text-slate-500 flex items-center gap-1">
          <Clock className="w-4 h-4" />
          {formatTime(item.lastCheckedAt)}
        </div>
      </div>
    </button>
  );
}

function JobRow({ item, active, onClick }) {
  const tone =
    item.result === "success" ? "good" : item.result === "warn" ? "warn" : "bad";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left p-3 rounded-2xl border transition shadow-sm",
        active
          ? "border-slate-900 bg-slate-50"
          : "border-slate-200 bg-white hover:bg-slate-50"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="w-9 h-9 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-700">
              <Wrench className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900 truncate">
                {item.name}
              </div>
              <div className="text-xs text-slate-500 truncate">
                {item.schedule}
              </div>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            <Badge
              tone={tone}
              icon={
                item.result === "success" ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : item.result === "warn" ? (
                  <AlertTriangle className="w-4 h-4" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )
              }
            >
              {item.result}
            </Badge>
            <Badge tone="neutral" icon={<Clock className="w-4 h-4" />}>
              Son: {formatTime(item.lastRunAt)}
            </Badge>
            <Badge tone="neutral" icon={<Timer className="w-4 h-4" />}>
              {fmtDurationSec(item.durationSec)}
            </Badge>
          </div>
        </div>

        <div className="text-xs text-slate-500 flex items-center gap-1">
          <Clock className="w-4 h-4" />
          Next: {formatTime(item.nextRunAt)}
        </div>
      </div>
    </button>
  );
}

function Meta({ label, children }) {
  return (
    <div className="p-3 rounded-2xl border border-slate-200 bg-white">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-sm font-semibold text-slate-900 mt-1 break-words">
        {children}
      </div>
    </div>
  );
}
