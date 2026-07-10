import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { API_BASE } from "../../config/api";
import { useNavigate } from "react-router-dom";


function authHeader() {
  const token = localStorage.getItem("token") || sessionStorage.getItem("token");
  if (!token) return {};               // <-- tam kritik satır
  return { Authorization: `Bearer ${token}` };
}


const RANGES = [
  { key: "1d", label: "Bugün" },
  { key: "7d", label: "7 Gün" },
  { key: "15d", label: "15 Gün" },
  { key: "30d", label: "30 Gün" },
];

export default function SuperDashboard() {
  const navigate = useNavigate();
  const [range, setRange] = useState("7d");
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailErr, setDetailErr] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const r = await axios.get(`${API_BASE}/super/overview?range=${range}`, { headers: authHeader() });
      console.log("overview:", r.data);
console.log("overview.kpis:", r.data?.kpis);

setData(r.data);
    } catch (e) {
      setErr(e?.response?.data?.message || "Overview alınamadı");
    } finally {
      setLoading(false);
    }
  }

 useEffect(() => {
  load();

  // 1) dashboard açıkken otomatik güncelle
  const t = setInterval(() => {
    load();
  }, 30000); // 30 sn

  // 2) kullanıcı sekmeye geri gelince anında güncelle
  const onFocus = () => load();
  window.addEventListener("focus", onFocus);

  return () => {
    clearInterval(t);
    window.removeEventListener("focus", onFocus);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [range]);

  const view = useMemo(() => normalize(data), [data]);

  async function openDrawer(userId) {
    setSelectedId(userId);
    setDrawerOpen(true);
    setDetail(null);
    setDetailErr("");
    setDetailLoading(true);
    try {
      const r = await axios.get(`${API_BASE}/super/users/${userId}`, { headers: authHeader() });
      setDetail(r.data);
    } catch (e) {
      setDetailErr(e?.response?.data?.message || "Kullanıcı detayı alınamadı");
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setSelectedId(null);
    setDetail(null);
    setDetailErr("");
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-2xl font-bold text-[#0a2b45]">Genel Bakış</div>
          <div className="mt-1 text-sm text-gray-500">
            Bireysel / ticari dağılım, aktivite grafikleri ve son kullanıcılar.
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-2xl border bg-white shadow-sm p-1">
            {RANGES.map((r) => (
              <RangePill key={r.key} value={r.key} current={range} onClick={setRange} label={r.label} />
            ))}
          </div>

          <button
            type="button"
            onClick={load}
            className="rounded-2xl border bg-white shadow-sm px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 active:scale-[0.99]"
            title="Verileri yenile"
          >
            Yenile
          </button>
        </div>
      </div>

      {/* Error */}
      {err ? (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
          <div className="font-semibold">Bir sorun oluştu</div>
          <div className="text-sm mt-1">{err}</div>
        </div>
      ) : null}

      {/* Loading */}
      {loading || !data ? (
        <div className="mt-6">
          <SkeletonDashboard />
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {/* KPI */}
          <div className="rounded-3xl border bg-white shadow-sm p-5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-base font-semibold text-gray-900">Özet</div>
                <div className="text-sm text-gray-500">
                  Seçilen aralık: <span className="font-semibold text-gray-700">{rangeLabel(range)}</span>
                </div>
              </div>
              <div className="text-xs text-gray-400">Kaynak: /super/overview</div>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <Card title="Toplam Bireysel Kullanıcı" value={view.users.bireysel.total} subtitle="Sistemdeki bireysel hesaplar" />
              <Card title="Toplam Ticari (OSGB/Kurumsal)" value={view.users.ticari.total} subtitle="Sistemdeki ticari hesaplar" />
              <Card title="Yeni Abonelik" value={view.kpis.newSubscriptions} subtitle={`${rangeLabel(range)} içinde`} />
              <Card title="İptal" value={view.kpis.cancellations} subtitle={`${rangeLabel(range)} içinde`} />
            </div>
          </div>

          {/* Status + Engagement */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 rounded-3xl border bg-white shadow-sm p-5">
              <div>
                <div className="text-base font-semibold text-gray-900">Kullanıcı Durumları</div>
                <div className="text-sm text-gray-500">Bireysel ve ticari kullanıcıların durum dağılımı.</div>
              </div>

              <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                <StatusBlock title="Bireysel" total={view.users.bireysel.total} status={view.users.bireysel.status} />
                <StatusBlock title="Ticari" total={view.users.ticari.total} status={view.users.ticari.status} />
              </div>
            </div>

            <div className="rounded-3xl border bg-white shadow-sm p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-semibold text-gray-900">Bireysel Aktivite</div>
                  <div className="text-sm text-gray-500">Giriş yapan / yapmayan dağılımı.</div>
                </div>
                <Badge tone="info">Aktif-Pasif</Badge>
              </div>

              <div className="mt-4 space-y-4">
                <StackRow label="Bugün" active={view.engagement.bireysel["1d"].active} passive={view.engagement.bireysel["1d"].passive} />
                <StackRow label="7 Gün" active={view.engagement.bireysel["7d"].active} passive={view.engagement.bireysel["7d"].passive} />
                <StackRow label="15 Gün" active={view.engagement.bireysel["15d"].active} passive={view.engagement.bireysel["15d"].passive} />
                <StackRow label="30 Gün" active={view.engagement.bireysel["30d"].active} passive={view.engagement.bireysel["30d"].passive} />
              </div>

              <div className="mt-5 rounded-2xl bg-gray-50 border p-3 text-xs text-gray-600">
                <div className="font-semibold text-gray-700">Tanım</div>
                <div className="mt-1">Aktif = ilgili süre içinde giriş yapan (lastLoginAt).</div>
              </div>
            </div>
          </div>

          {/* Recent Users + Activities */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Recent Users */}
           <div className="xl:col-span-2 rounded-3xl border bg-white shadow-sm p-4 md:p-5">
  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <div className="text-base font-semibold text-gray-900">Son Eklenen Kullanıcılar</div>
      <div className="text-sm text-gray-500">Sisteme en son kayıt olan hesaplar.</div>
    </div>
    <div className="text-xs text-gray-400">{view.recentUsers.length} kayıt</div>
  </div>

  {!view.recentUsers.length ? (
    <div className="mt-4 rounded-2xl border px-4 py-6 text-sm text-gray-500 text-center">
      Kayıt yok
    </div>
  ) : (
    <>
      {/* Mobil görünüm */}
      <div className="mt-4 space-y-3 md:hidden">
        {view.recentUsers.slice(0, 8).map((u) => (
          <div key={u._id} className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-900 truncate">
                  {u.fullName || "—"}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  {fmtDate(u.createdAt)}
                </div>
              </div>

              <button
                type="button"
                onClick={() => openDrawer(u._id)}
                className="shrink-0 text-xs font-semibold rounded-xl px-3 py-2 border border-[#0a2b45]/20 bg-[#0a2b45]/5 text-[#0a2b45] hover:bg-[#0a2b45]/10"
              >
                Denetle
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold rounded-full px-2.5 py-1 border border-gray-200 bg-gray-50 text-gray-700">
                {u.type || "—"}
              </span>
              {u.status ? (
                <span className="text-xs text-gray-500">{u.status}</span>
              ) : null}
            </div>

            <div className="mt-3 space-y-2 text-sm">
              <div>
                <div className="text-xs text-gray-500">Kurum / Email</div>
                <div className="text-gray-800 break-words">
                  {u.type === "ticari" ? (u.orgName || "—") : (u.email || "—")}
                </div>
              </div>

              {u.type === "ticari" ? (
                <div>
                  <div className="text-xs text-gray-500">Email</div>
                  <div className="text-gray-800 break-words">{u.email || "—"}</div>
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {/* Masaüstü görünüm */}
      <div className="mt-4 hidden md:block overflow-hidden rounded-2xl border">
        <div className="grid grid-cols-12 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-600">
          <div className="col-span-3">Tarih</div>
          <div className="col-span-3">Ad Soyad</div>
          <div className="col-span-2">Tür</div>
          <div className="col-span-3">Kurum / Email</div>
          <div className="col-span-1 text-right">İşlem</div>
        </div>

        <div className="divide-y">
          {view.recentUsers.slice(0, 8).map((u) => (
            <div key={u._id} className="grid grid-cols-12 px-4 py-3 text-sm hover:bg-gray-50">
              <div className="col-span-3 text-gray-600">{fmtDate(u.createdAt)}</div>
              <div className="col-span-3 text-gray-900 font-medium truncate">{u.fullName || "—"}</div>
              <div className="col-span-2">
                <span className="text-xs font-semibold rounded-full px-2.5 py-1 border border-gray-200 bg-gray-50 text-gray-700">
                  {u.type || "—"}
                </span>
                <span className="ml-2 text-xs text-gray-500">{u.status || ""}</span>
              </div>
              <div className="col-span-3 text-gray-700">
                <div className="truncate">{u.type === "ticari" ? (u.orgName || "—") : (u.email || "—")}</div>
                {u.type === "ticari" ? <div className="text-xs text-gray-500 truncate">{u.email || "—"}</div> : null}
              </div>
              <div className="col-span-1 text-right">
                <button
                  type="button"
                  onClick={() => openDrawer(u._id)}
                  className="text-xs font-semibold rounded-xl px-2.5 py-1 border border-[#0a2b45]/20 bg-[#0a2b45]/5 text-[#0a2b45] hover:bg-[#0a2b45]/10"
                >
                  Denetle
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )}
</div>

            {/* System Health (placeholder) */}
            <div className="rounded-3xl border bg-white shadow-sm p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-semibold text-gray-900">Sistem Sağlığı</div>
                  <div className="text-sm text-gray-500">Performans ve cron durumu.</div>
                </div>
                <Badge tone={healthTone(view.systemHealth)}>{healthLabel(view.systemHealth)}</Badge>
              </div>

              <div className="mt-4 space-y-3">
                <HealthRow label="API Yanıt (avg)" value={fmtMs(view.systemHealth.apiLatencyAvg)} />
                <HealthRow label="API Yanıt (p95)" value={fmtMs(view.systemHealth.apiLatencyP95)} />
                <HealthRow label="CPU" value={fmtPercent(view.systemHealth.cpu)} />
                <HealthRow label="RAM" value={fmtPercent(view.systemHealth.ram)} />
                <HealthRow label="Disk" value={fmtPercent(view.systemHealth.disk)} />
                <HealthRow label="Hata Oranı" value={fmtPercent(view.systemHealth.errorRate)} />
                <div className="pt-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">Cron / Job</div>
                    <span
                      className={[
                        "text-xs font-semibold rounded-full px-2.5 py-1 border",
                        view.systemHealth.cronStatus === "OK"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : view.systemHealth.cronStatus === "WARN"
                          ? "border-amber-200 bg-amber-50 text-amber-700"
                          : view.systemHealth.cronStatus
                          ? "border-red-200 bg-red-50 text-red-700"
                          : "border-gray-200 bg-gray-50 text-gray-700",
                      ].join(" ")}
                    >
                      {view.systemHealth.cronStatus || "—"}
                    </span>
                  </div>
                  {view.systemHealth.cronLastRun ? (
                    <div className="mt-1 text-xs text-gray-500">Son çalışma: {String(view.systemHealth.cronLastRun)}</div>
                  ) : (
                    <div className="mt-1 text-xs text-gray-400">Son çalışma bilgisi yok</div>
                  )}
                </div>
              </div>

              
            </div>
          </div>
        </div>
      )}

      {/* Drawer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={closeDrawer} />
          <div className="absolute right-0 top-0 h-full w-full sm:w-[560px] bg-white shadow-2xl">
            <div className="p-5 border-b flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-bold text-[#0a2b45]">Kullanıcı Denetimi</div>
                <div className="text-xs text-gray-500">ID: {selectedId || "—"}</div>
              </div>
              <button
                type="button"
                onClick={closeDrawer}
                className="rounded-xl border bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Kapat
              </button>
            </div>

            <div className="p-5">
              {detailErr ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
                  <div className="font-semibold">Hata</div>
                  <div className="text-sm mt-1">{detailErr}</div>
                </div>
              ) : detailLoading || !detail ? (
                <div className="space-y-3">
                  <div className="h-4 w-40 bg-gray-100 rounded-full" />
                  <div className="h-4 w-64 bg-gray-100 rounded-full" />
                  <div className="h-24 w-full bg-gray-50 border border-dashed rounded-2xl" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl border p-4">
                    <div className="text-sm text-gray-500">Ad Soyad</div>
                    <div className="text-base font-semibold text-gray-900">{detail.fullName || "—"}</div>

                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <InfoLine label="Email" value={detail.email || "—"} />
                      <InfoLine label="Tür" value={detail.type || "—"} />
                      <InfoLine label="Durum" value={detail.status || "—"} />
                      <InfoLine label="Rol" value={detail.role || "—"} />
                      <InfoLine label="Kurum" value={detail.orgName || "—"} />
                      <InfoLine label="TC" value={detail.tcMasked || "—"} />
                    </div>
                  </div>

                  {detail.org ? (
                    <div className="rounded-2xl border p-4">
                      <div className="text-sm font-semibold text-gray-900">Kurum Bilgisi</div>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <InfoLine label="Plan" value={detail.org.planCode || "—"} />
                        <InfoLine label="Durum" value={detail.org.lifecycleStatus || "—"} />
                        <InfoLine label="Pilot" value={fmtDate(detail.org.pilotEndAt)} />
                        <InfoLine label="Lisans" value={fmtDate(detail.org.licenseEndAt)} />
                      </div>
                    </div>
                  ) : null}

                  <div className="rounded-2xl border p-4">
                    <div className="text-sm font-semibold text-gray-900">Hızlı Aksiyon</div>
                    <div className="mt-3 text-sm text-gray-600">
                      Tüm aksiyonlar (bloke, kimlik güncelleme, süre uzatma, org update) zaten{" "}
                      <span className="font-semibold">Kullanıcılar</span> sayfasında var.
                    </div>
                    <div className="mt-3">
                     <button
  type="button"
  onClick={() => {
    closeDrawer();
    navigate("/super/kullanicilar");
  }}
  className="inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-semibold border border-[#0a2b45]/20 bg-[#0a2b45]/5 text-[#0a2b45] hover:bg-[#0a2b45]/10"
>
  Kullanıcılar sayfasına git
</button>

                    </div>
                  </div>

                  {detail.auditLogs?.length ? (
                    <div className="rounded-2xl border p-4">
                      <div className="text-sm font-semibold text-gray-900">Son Audit Log</div>
                      <div className="mt-3 space-y-2">
                        {detail.auditLogs.slice(0, 6).map((l) => (
                          <div key={l._id} className="rounded-xl bg-gray-50 border px-3 py-2 text-xs">
                            <div className="flex items-center justify-between">
                              <div className="font-semibold text-gray-800">{l.action}</div>
                              <div className="text-gray-500">{fmtDate(l.createdAt)}</div>
                            </div>
                            <div className="mt-1 text-gray-600 truncate">Sebep: {l.reason || "—"}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------ UI ------------------------------ */

function RangePill({ value, current, onClick, label }) {
  const active = value === current;
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      className={[
        "px-3 py-2 text-sm rounded-2xl transition",
        active ? "bg-[#0a2b45] text-white shadow-sm" : "text-gray-700 hover:bg-gray-50",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function Card({ title, value, subtitle }) {
  return (
    <div className="rounded-3xl border bg-white shadow-sm p-4">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="mt-1 text-3xl font-semibold text-gray-900">{fmt(value)}</div>
      {subtitle ? <div className="mt-2 text-sm text-gray-500">{subtitle}</div> : null}
      <div className="mt-4 h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full w-1/2 bg-[#0a2b45]/20" />
      </div>
    </div>
  );
}

function Badge({ tone = "neutral", children }) {
  const cls =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : tone === "danger"
      ? "border-red-200 bg-red-50 text-red-700"
      : tone === "info"
      ? "border-sky-200 bg-sky-50 text-sky-700"
      : "border-gray-200 bg-gray-50 text-gray-700";

  return <span className={["text-xs font-semibold rounded-full px-2.5 py-1 border", cls].join(" ")}>{children}</span>;
}

function StatusBlock({ title, total, status }) {
  const s = status || { aktif: 0, askida: 0, pasif: 0, blokeli: 0 };
  return (
    <div className="rounded-3xl border bg-white shadow-sm p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-gray-500">{title}</div>
          <div className="mt-1 text-2xl font-semibold text-gray-900">{fmt(total)}</div>
        </div>
        <Badge tone="neutral">Toplam</Badge>
      </div>

      <div className="mt-4 space-y-2">
        <MiniBar label="Aktif" value={s.aktif} tone="success" total={total} />
        <MiniBar label="Askıda" value={s.askida} tone="warning" total={total} />
        <MiniBar label="Pasif" value={s.pasif} tone="neutral" total={total} />
        <MiniBar label="Blokeli" value={s.blokeli} tone="danger" total={total} />
      </div>
    </div>
  );
}

function MiniBar({ label, value, total, tone }) {
  const v = toNum(value);
  const t = Math.max(1, toNum(total));
  const w = Math.round((v / t) * 100);
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <div className="text-gray-600">{label}</div>
        <div className="font-semibold text-gray-900">
          {fmt(v)} <span className="text-gray-500">(%{w})</span>
        </div>
      </div>
      <div className="mt-1 h-2 w-full rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full" style={{ width: `${w}%`, background: toneColor(tone) }} />
      </div>
    </div>
  );
}

function StackRow({ label, active, passive }) {
  const a = toNum(active);
  const p = toNum(passive);
  const t = a + p || 1;
  const ap = Math.round((a / t) * 100);
  const pp = 100 - ap;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-gray-800">{label}</div>
        <div className="text-xs text-gray-500">
          Aktif: <span className="font-semibold text-gray-700">{fmt(a)}</span> • Pasif:{" "}
          <span className="font-semibold text-gray-700">{fmt(p)}</span>
        </div>
      </div>
      <div className="mt-2 h-2 w-full rounded-full bg-gray-100 overflow-hidden flex">
        <div className="h-full" style={{ width: `${ap}%`, background: toneColor("success") }} />
        <div className="h-full" style={{ width: `${pp}%`, background: toneColor("neutral") }} />
      </div>
    </div>
  );
}

function HealthRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-sm text-gray-600">{label}</div>
      <div className="text-sm font-semibold text-gray-900">{value}</div>
    </div>
  );
}

function InfoLine({ label, value }) {
  return (
    <div className="rounded-xl bg-gray-50 border px-3 py-2">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm font-semibold text-gray-900 truncate">{String(value ?? "—")}</div>
    </div>
  );
}

function SkeletonDashboard() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border bg-white shadow-sm p-5">
        <div className="h-5 w-40 bg-gray-100 rounded-full" />
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-3xl border bg-white p-4">
              <div className="h-3 w-28 bg-gray-100 rounded-full" />
              <div className="mt-3 h-8 w-20 bg-gray-100 rounded-2xl" />
              <div className="mt-4 h-2 w-full bg-gray-100 rounded-full" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 rounded-3xl border bg-white shadow-sm p-5">
          <div className="h-5 w-44 bg-gray-100 rounded-full" />
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="rounded-3xl border bg-white p-4">
                <div className="h-3 w-28 bg-gray-100 rounded-full" />
                <div className="mt-4 h-28 w-full bg-gray-50 rounded-2xl border border-dashed" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-3xl border bg-white shadow-sm p-5">
          <div className="h-5 w-36 bg-gray-100 rounded-full" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-3 w-full bg-gray-100 rounded-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Data ------------------------------ */

function normalize(raw) {
  const safe = raw || {};
  return {
    users: {
      bireysel: {
        total: toNum(safe?.users?.bireysel?.total),
        status: fillStatus(safe?.users?.bireysel?.status),
      },
      ticari: {
        total: toNum(safe?.users?.ticari?.total),
        status: fillStatus(safe?.users?.ticari?.status),
      },
    },
    engagement: {
      bireysel: {
        "1d": fillEng(safe?.engagement?.bireysel?.["1d"]),
        "7d": fillEng(safe?.engagement?.bireysel?.["7d"]),
        "15d": fillEng(safe?.engagement?.bireysel?.["15d"]),
        "30d": fillEng(safe?.engagement?.bireysel?.["30d"]),
      },
    },
    kpis: {
  newSubscriptions: toNum(
    // 1) nested obj ihtimalleri
    safe?.kpis?.newSubscriptions?.count ??
    safe?.kpis?.newSubscriptions?.total ??
    safe?.kpis?.newSubscriptions?.value ??

    // 2) düz sayı ihtimalleri
    safe?.kpis?.newSubscriptions ??
    safe?.kpis?.newSubscriptionCount ??
    safe?.kpis?.newSubscriptionsCount ??
    safe?.kpis?.newSubscription ??
    safe?.kpis?.newPaidSubscriptions ??
    safe?.kpis?.newPaidSubscriptionCount ??

    // 3) bazı backend’ler kpis dışına koyuyor
    safe?.newSubscriptions ??
    safe?.newSubscriptionCount
  ),

  cancellations: toNum(
    safe?.kpis?.cancellations ??
    safe?.kpis?.cancellations?.count ??
    safe?.kpis?.cancellations?.total ??
    safe?.kpis?.cancellationCount ??
    safe?.kpis?.cancelledSubscriptions ??
    safe?.cancellations
  ),
},

    recentUsers: Array.isArray(safe?.recentUsers) ? safe.recentUsers : [],
    systemHealth: safe?.systemHealth || {},
    activities: Array.isArray(safe?.activities) ? safe.activities : [],
  };
}

function fillStatus(s) {
  const x = s || {};
  return {
    aktif: toNum(x.aktif),
    askida: toNum(x.askida),
    pasif: toNum(x.pasif),
    blokeli: toNum(x.blokeli),
  };
}
function fillEng(e) {
  const x = e || {};
  return { active: toNum(x.active), passive: toNum(x.passive) };
}

/* ------------------------------ Helpers ------------------------------ */

function toNum(v) {
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n : 0;
}
function fmt(v) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return new Intl.NumberFormat("tr-TR").format(v);
  return String(v);
}
function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("tr-TR");
  } catch {
    return "—";
  }
}
function fmtMs(v) {
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isFinite(n)) return "—";
  return `${new Intl.NumberFormat("tr-TR").format(Math.round(n))} ms`;
}
function fmtPercent(v) {
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isFinite(n)) return "—";
  const p = Math.max(0, Math.min(100, n));
  return `%${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 }).format(p)}`;
}
function rangeLabel(range) {
  if (range === "1d") return "Bugün";
  if (range === "7d") return "Son 7 Gün";
  if (range === "15d") return "Son 15 Gün";
  if (range === "30d") return "Son 30 Gün";
  return "Seçili Aralık";
}
function toneColor(tone) {
  if (tone === "success") return "#10b981";
  if (tone === "warning") return "#f59e0b";
  if (tone === "danger") return "#ef4444";
  if (tone === "info") return "#0ea5e9";
  return "#94a3b8";
}
function isNumber(v) {
  return typeof v === "number" && Number.isFinite(v);
}
function healthTone(h) {
  if (h?.cronStatus === "CRIT") return "danger";
  if (h?.cronStatus === "WARN") return "warning";
  if (h?.cronStatus === "OK") return "success";
  const er = isNumber(h?.errorRate) ? h.errorRate : 0;
  if (er >= 5) return "danger";
  if (er >= 2) return "warning";
  return "neutral";
}
function healthLabel(h) {
  const t = healthTone(h);
  if (t === "danger") return "Kritik";
  if (t === "warning") return "Dikkat";
  if (t === "success") return "İyi";
  return "Bilinmiyor";
}
