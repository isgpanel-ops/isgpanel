import React, { useEffect, useMemo, useState } from "react";
import { Package, BadgeTurkishLira, Users, CheckCircle2 } from "lucide-react";

function StatCard({ icon, title, value, sub }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-slate-500">{title}</div>
          <div className="mt-2 text-2xl font-bold text-slate-800">{value}</div>
          {sub ? <div className="mt-1 text-xs text-slate-400">{sub}</div> : null}
        </div>
        <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">{icon}</div>
      </div>
    </div>
  );
}

function BillingToggle({ period, setPeriod, showVatIncluded, setShowVatIncluded }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-4">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <span className={period === "monthly" ? "text-slate-900" : "text-slate-500"}>Aylık</span>
        <button
          type="button"
          onClick={() => setPeriod((p) => (p === "monthly" ? "yearly" : "monthly"))}
          className={`relative h-7 w-14 rounded-full transition ${
            period === "yearly" ? "bg-[#2563eb]" : "bg-slate-300"
          }`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
              period === "yearly" ? "left-8" : "left-1"
            }`}
          />
        </button>
        <span className={period === "yearly" ? "text-slate-900" : "text-slate-500"}>
          Yıllık <span className="text-emerald-600 font-semibold">(2 ay bizden)</span>
        </span>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <span>KDV Dahil Göster</span>
        <button
          type="button"
          onClick={() => setShowVatIncluded((v) => !v)}
          className={`relative h-7 w-14 rounded-full transition ${
            showVatIncluded ? "bg-[#2563eb]" : "bg-slate-300"
          }`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
              showVatIncluded ? "left-8" : "left-1"
            }`}
          />
        </button>
      </label>
    </div>
  );
}

function PlanCard({
  plan,
  displayPrice,
  displaySubText,
  yearlyBadge,
  onEdit,
  isPopular = false,
}) {
  return (
    <div
  className={`relative rounded-[22px] border bg-white p-5 shadow-sm transition min-w-0 ${
    isPopular ? "border-[#2563eb] shadow-md" : "border-slate-200"
  }`}
>
      {isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#2563eb] px-4 py-1 text-xs font-bold text-white shadow">
          En Popüler
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[16px] font-bold text-slate-900 leading-6">{plan.name}</h3>
          <p className="mt-1 text-sm italic text-slate-500">{plan.note}</p>
          <p className="mt-1 text-sm text-slate-600">{plan.maxUsers} kullanıcı</p>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            plan.active === false
              ? "bg-slate-100 text-slate-600"
              : "bg-emerald-100 text-emerald-700"
          }`}
        >
          {plan.active === false ? "Pasif" : "Aktif"}
        </span>
      </div>

      <div className="mt-6">
        <div className="text-[28px] font-extrabold tracking-tight text-[#0a2b45]">
  {displayPrice}
</div>
        <div className="mt-1 text-sm text-slate-500">{displaySubText}</div>
        {yearlyBadge ? (
          <div className="mt-2 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            10 ay ücret • 2 ay bizden
          </div>
        ) : null}
      </div>

      <ul className="mt-4 space-y-1.5 text-sm text-slate-700">
        <li>• Sınırsız firma</li>
        <li>• Tüm modüllere erişim</li>
        <li>• Hızlı kurulum & onboarding</li>
      </ul>

      <div className="mt-6 flex items-center gap-2">
        <button
          onClick={onEdit}
          className={`rounded-xl px-4 py-2 text-sm font-semibold text-white ${
            isPopular ? "bg-[#2563eb] hover:bg-[#1d4ed8]" : "bg-[#0a2b45] hover:opacity-90"
          }`}
        >
          Düzenle
        </button>
      </div>
    </div>
  );
}

export default function PaketYonetimi() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  const [editingPlan, setEditingPlan] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
  name: "",
  note: "",
  maxUsers: 1,
  monthlyPrice: 0,
  percentChange: 0,
  kdvRate: 0.2,
  active: true,
});

  const [period, setPeriod] = useState("monthly");
  const [showVatIncluded, setShowVatIncluded] = useState(true);

  const trCurrency = (n) =>
    new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      maximumFractionDigits: 0,
    }).format(Number(n || 0));

  const calcVatIncluded = (price, rate = 0.2) => Math.round(Number(price || 0) * (1 + Number(rate || 0.2)));
  const calcYearlyExVat = (monthly) => Number(monthly || 0) * 10;
  const calcYearlyIncVat = (monthly, rate = 0.2) =>
    Math.round(calcYearlyExVat(monthly) * (1 + Number(rate || 0.2)));

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const token = localStorage.getItem("token") || sessionStorage.getItem("token") || "";

        const res = await fetch("/api/super/plans", {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "Paketler alınamadı");

        if (!alive) return;

      const items = Array.isArray(data.items) ? data.items : [];

const allowedCodes = [
  "bireysel_standart",

  "ticari_5",
  "ticari_10",
  "ticari_15",
];

const filtered = items.filter((p) =>
  allowedCodes.includes(String(p.code || "").trim())
);

       const enriched = filtered.map((p) => ({
  ...p,
  note: p.note || "",
}));

        setPlans(enriched);
      } catch (e) {
        console.error("Paketler alınamadı:", e.message);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const activePlans = useMemo(() => plans.filter((p) => p.active !== false), [plans]);

  const minPrice = useMemo(() => {
    const nums = activePlans
      .map((p) =>
        showVatIncluded
          ? calcVatIncluded(p.monthlyPrice, p.kdvRate)
          : Number(p.monthlyPrice || 0)
      )
      .filter((n) => n > 0);
    return nums.length ? Math.min(...nums) : 0;
  }, [activePlans, showVatIncluded]);

  const maxUsersDisplay = useMemo(() => {
    if (!plans.length) return "0";
    const maxUsers = Math.max(...plans.map((p) => Number(p.maxUsers || 0)));
    return String(maxUsers);
  }, [plans]);

  const openEdit = (plan) => {
    setEditingPlan(plan);
 setForm({
  name: plan.name || "",
  note: plan.note || "",
  maxUsers: Number(plan.maxUsers || 1),
  monthlyPrice: Number(plan.monthlyPrice || 0),
  percentChange: 0,
  kdvRate: Number(plan.kdvRate ?? 0.2),
  active: plan.active !== false,
});
  };

  const closeEdit = () => {
    setEditingPlan(null);
    setSaving(false);
  };

  const savePlan = async () => {
    if (!editingPlan?.code) return;

    try {
      setSaving(true);

      const token = localStorage.getItem("token") || sessionStorage.getItem("token") || "";

      const res = await fetch(`/api/super/plans/${editingPlan.code}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: form.name,
          maxUsers: Number(form.maxUsers || 1),
          monthlyPrice: Number(form.monthlyPrice || 0),
          kdvRate: Number(form.kdvRate ?? 0.2),
          active: Boolean(form.active),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Paket güncellenemedi");

     setPlans((prev) =>
  prev.map((p) =>
    p.code === editingPlan.code
      ? {
          ...p,
          ...(data.item || {}),
          name: form.name,
          maxUsers: Number(form.maxUsers || 1),
          monthlyPrice: Number(form.monthlyPrice || 0),
          kdvRate: Number(form.kdvRate ?? 0.2),
          active: Boolean(form.active),
          note: form.note || p.note || "",
        }
      : p
  )
);

      closeEdit();
      alert("Paket güncellendi ✅");
    } catch (e) {
      alert(e.message || "Paket kaydedilemedi");
      setSaving(false);
    }
  };

  const getDisplayPrice = (plan) => {
    if (period === "yearly") {
      const yearly = showVatIncluded
        ? calcYearlyIncVat(plan.monthlyPrice, plan.kdvRate)
        : calcYearlyExVat(plan.monthlyPrice);
      return trCurrency(yearly);
    }

    const monthly = showVatIncluded
      ? calcVatIncluded(plan.monthlyPrice, plan.kdvRate)
      : Number(plan.monthlyPrice || 0);

    return trCurrency(monthly);
  };

  const getDisplaySubText = (plan) => {
    if (period === "yearly") {
      return showVatIncluded ? "Yıllık • KDV Dahil" : "Yıllık • KDV Hariç";
    }
    return showVatIncluded ? "Aylık • KDV Dahil" : "Aylık • KDV Hariç";
  };

  return (
    <>
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Paket Yönetimi</h1>
              <p className="mt-1 text-sm text-slate-500">
                Mevcut paketleri ve fiyatları buradan görüntüleyin ve yönetin.
              </p>
            </div>

            <BillingToggle
              period={period}
              setPeriod={setPeriod}
              showVatIncluded={showVatIncluded}
              setShowVatIncluded={setShowVatIncluded}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={<Package className="h-5 w-5" />}
              title="Toplam Paket"
              value={String(plans.length || 0)}
              sub="Sistemde kayıtlı planlar"
            />
            <StatCard
              icon={<BadgeTurkishLira className="h-5 w-5" />}
              title={period === "yearly" ? "Yıllık Başlangıç" : "Aylık Başlangıç"}
              value={trCurrency(minPrice)}
              sub={showVatIncluded ? "KDV dahil en düşük paket" : "KDV hariç en düşük paket"}
            />
            <StatCard
              icon={<Users className="h-5 w-5" />}
              title="En Yüksek Limit"
              value={maxUsersDisplay}
              sub="Mevcut en yüksek kullanıcı paketi"
            />
            <StatCard
              icon={<CheckCircle2 className="h-5 w-5" />}
              title="Aktif Paketler"
              value={String(activePlans.length || 0)}
              sub="Kullanıma açık planlar"
            />
          </div>

          <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Paket Listesi</h2>
                <p className="text-sm text-slate-500">
                  Tanıtım sitesi görünümüne yakın şekilde paketlerin fiyatlarını, KDV durumunu ve yıllık kampanyayı görüntüleyebilirsiniz.
                </p>
              </div>

              <div className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                Yıllık seçimde 10 ay ücret • 2 ay bizden
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {loading ? (
                <div className="text-sm text-slate-500">Paketler yükleniyor...</div>
              ) : (
                plans.map((plan) => (
                  <PlanCard
                    key={plan.code}
                    plan={plan}
                    displayPrice={getDisplayPrice(plan)}
                    displaySubText={getDisplaySubText(plan)}
                    yearlyBadge={period === "yearly"}
                    isPopular={plan.code === "ticari_4_5"}
                    onEdit={() => openEdit(plan)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {editingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Paket Düzenle</h3>
                <p className="mt-1 text-sm text-slate-500">{editingPlan.code}</p>
              </div>
              <button
                onClick={closeEdit}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
              >
                Kapat
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Paket Adı
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Maksimum Kullanıcı
                </label>
                <input
                  type="number"
                  min="1"
                  value={form.maxUsers}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, maxUsers: Number(e.target.value || 1) }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Aylık Fiyat
                </label>
                <input
                  type="number"
                  min="0"
                  value={form.monthlyPrice}
                  onChange={(e) =>
                    setForm((s) => ({
                      ...s,
                      monthlyPrice: Number(e.target.value || 0),
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />
              </div>

<div>
  <label className="mb-1 block text-sm font-medium text-slate-700">
    Değişim Yüzdesi (%)
  </label>
  <input
    type="number"
    step="0.01"
    value={form.percentChange}
    onChange={(e) =>
      setForm((s) => ({
        ...s,
        percentChange: Number(e.target.value || 0),
      }))
    }
    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
    placeholder="Örn: 10 veya -5"
  />
  <div className="mt-1 text-xs text-slate-500">
    Pozitif değer zam, negatif değer indirim/düşüş gösterir. Bu alan sadece hesap amaçlıdır.
  </div>
</div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  KDV Oranı
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.kdvRate}
                  onChange={(e) =>
                    setForm((s) => ({
                      ...s,
                      kdvRate: Number(e.target.value || 0),
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, active: e.target.checked }))
                  }
                />
                Aktif
              </label>

              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-700">
  {(() => {
    const monthlyBase = Number(form.monthlyPrice || 0);
    const percent = Number(form.percentChange || 0);
    const changedMonthly = Math.max(0, monthlyBase + (monthlyBase * percent) / 100);
    const diffAmount = changedMonthly - monthlyBase;

    const monthlyIncVat = Math.round(changedMonthly * (1 + Number(form.kdvRate || 0.2)));
    const yearlyExVat = Math.round(changedMonthly * 10);
    const yearlyIncVat = Math.round(yearlyExVat * (1 + Number(form.kdvRate || 0.2)));

    return (
      <>
        <div>
          <b>Mevcut Aylık Fiyat:</b> {trCurrency(monthlyBase)}
        </div>
        <div className="mt-1">
          <b>Değişim:</b>{" "}
          {percent > 0 ? `+%${percent}` : percent < 0 ? `%${percent}` : "%0"}{" "}
          ({diffAmount >= 0 ? "+" : ""}
          {trCurrency(diffAmount)})
        </div>
        <div className="mt-1">
          <b>Yeni Aylık KDV Hariç:</b> {trCurrency(changedMonthly)}
        </div>
        <div className="mt-1">
          <b>Yeni Aylık KDV Dahil:</b> {trCurrency(monthlyIncVat)}
        </div>
        <div className="mt-1">
          <b>Yeni Yıllık KDV Hariç:</b> {trCurrency(yearlyExVat)}
        </div>
        <div className="mt-1">
          <b>Yeni Yıllık KDV Dahil:</b> {trCurrency(yearlyIncVat)}
        </div>
      </>
    );
  })()}
</div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={closeEdit}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
              >
                Vazgeç
              </button>
              <button
                onClick={savePlan}
                disabled={saving}
                className="rounded-xl bg-[#0a2b45] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {saving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}