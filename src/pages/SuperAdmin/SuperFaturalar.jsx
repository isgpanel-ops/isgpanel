import React, { useEffect, useMemo, useState } from "react";
import {
  Receipt,
  Search,
  Eye,
  FileText,
  CheckCircle2,
  Clock3,
  CalendarDays,
  TrendingUp,
  Wallet,
  Filter,
  RefreshCcw,
} from "lucide-react";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "https://app.isgpanel.tr/api";


const MONTHS = [
  { value: "all", label: "Tüm Aylar" },
  { value: "0", label: "Ocak" },
  { value: "1", label: "Şubat" },
  { value: "2", label: "Mart" },
  { value: "3", label: "Nisan" },
  { value: "4", label: "Mayıs" },
  { value: "5", label: "Haziran" },
  { value: "6", label: "Temmuz" },
  { value: "7", label: "Ağustos" },
  { value: "8", label: "Eylül" },
  { value: "9", label: "Ekim" },
  { value: "10", label: "Kasım" },
  { value: "11", label: "Aralık" },
];

const fmtTRY = (n) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(Number(n || 0));

const fmtDate = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("tr-TR");
};

const getVatIncluded = (r) => Number(r.amount || 0);
const getVat = (r) => Number(r.vat || 0);
const getVatExcluded = (r) => Math.max(0, getVatIncluded(r) - getVat(r));

export default function SuperFaturalar() {
  const now = new Date();

  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState(String(now.getMonth()));
  const [yearFilter, setYearFilter] = useState(String(now.getFullYear()));
  const [selected, setSelected] = useState(null);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadInvoices() {
    try {
      setLoading(true);
      setError("");

      const token = localStorage.getItem("token");

      const res = await fetch(`${API_BASE}/super/invoices`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.message || "Faturalar alınamadı.");
      }

      setRows(Array.isArray(json.rows) ? json.rows : []);
    } catch (e) {
      setError(e.message || "Faturalar alınamadı.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInvoices();
  }, []);

  async function updateInvoiceStatus(id, invoiceStatus) {
    try {
      setActionLoading(true);

      const token = localStorage.getItem("token");

      const res = await fetch(`${API_BASE}/super/invoices/${id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ invoiceStatus }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.message || "Durum güncellenemedi.");
      }

      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, invoiceStatus } : r))
      );

      setSelected((prev) => (prev ? { ...prev, invoiceStatus } : prev));
      await loadInvoices();
    } catch (e) {
      alert(e.message || "Durum güncellenemedi.");
    } finally {
      setActionLoading(false);
    }
  }

async function openInvoicePdf(row) {
  try {
    const token = localStorage.getItem("token");

    const res = await fetch(
      `${API_BASE}/super/invoices/${row.id}/pdf`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!res.ok) {
      const msg = await res.text();

      alert(msg || "PDF açılamadı.");
      return;
    }

    const blob = await res.blob();

    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");

    a.href = url;

    a.download = `${(row.title || "fatura")
      .replace(/[^a-zA-Z0-9ğüşöçıİĞÜŞÖÇ]/g, "_")}-fatura.pdf`;

    document.body.appendChild(a);

    a.click();

    a.remove();

    window.URL.revokeObjectURL(url);
  } catch (e) {
    alert(e.message || "PDF açılamadı.");
  }
}

  const availableYears = useMemo(() => {
    const years = rows
      .map((r) => {
        const d = new Date(r.paidAt);
        return Number.isNaN(d.getTime()) ? null : d.getFullYear();
      })
      .filter(Boolean);

    const unique = Array.from(new Set([...years, now.getFullYear()])).sort(
      (a, b) => b - a
    );

    return unique;
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const text = `${r.title || ""} ${r.planCode || ""} ${r.email || ""} ${
        r.taxNumber || ""
      }`.toLowerCase();

      const d = new Date(r.paidAt);
      const paidYear = Number.isNaN(d.getTime()) ? "" : String(d.getFullYear());
      const paidMonth = Number.isNaN(d.getTime()) ? "" : String(d.getMonth());

      const okSearch = text.includes(search.toLowerCase());
      const okPeriod = periodFilter === "all" || r.period === periodFilter;
      const okStatus =
        statusFilter === "all" || r.invoiceStatus === statusFilter;
      const okYear = yearFilter === "all" || paidYear === yearFilter;
      const okMonth = monthFilter === "all" || paidMonth === monthFilter;

      return okSearch && okPeriod && okStatus && okYear && okMonth;
    });
  }, [rows, search, periodFilter, statusFilter, yearFilter, monthFilter]);

  const selectedYearRows = useMemo(() => {
    return rows.filter((r) => {
      const d = new Date(r.paidAt);
      if (Number.isNaN(d.getTime())) return false;
      return yearFilter === "all" || String(d.getFullYear()) === yearFilter;
    });
  }, [rows, yearFilter]);

  const selectedMonthRows = useMemo(() => {
    return selectedYearRows.filter((r) => {
      const d = new Date(r.paidAt);
      if (Number.isNaN(d.getTime())) return false;
      return monthFilter === "all" || String(d.getMonth()) === monthFilter;
    });
  }, [selectedYearRows, monthFilter]);

  const totalVatIncluded = rows.reduce((a, b) => a + getVatIncluded(b), 0);
  const totalVatExcluded = rows.reduce((a, b) => a + getVatExcluded(b), 0);
  const totalVat = rows.reduce((a, b) => a + getVat(b), 0);

  const monthVatIncluded = selectedMonthRows.reduce(
    (a, b) => a + getVatIncluded(b),
    0
  );
  const monthVatExcluded = selectedMonthRows.reduce(
    (a, b) => a + getVatExcluded(b),
    0
  );
  const monthVat = selectedMonthRows.reduce((a, b) => a + getVat(b), 0);

  const yearVatIncluded = selectedYearRows.reduce(
    (a, b) => a + getVatIncluded(b),
    0
  );
  const yearVatExcluded = selectedYearRows.reduce(
    (a, b) => a + getVatExcluded(b),
    0
  );
  const yearVat = selectedYearRows.reduce((a, b) => a + getVat(b), 0);

  const waitingCount = rows.filter(
    (x) => x.invoiceStatus === "READY_TO_INVOICE"
  ).length;

  const selectedMonthLabel =
    monthFilter === "all"
      ? "Tüm aylar"
      : MONTHS.find((m) => m.value === monthFilter)?.label || "Seçili ay";

  const selectedYearLabel = yearFilter === "all" ? "Tüm yıllar" : yearFilter;

  return (
    <div className="p-4 md:p-6">
      <div className="rounded-[28px] border bg-white shadow-sm p-5 md:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#0a2b45]/10 flex items-center justify-center shrink-0">
              <Receipt className="w-6 h-6 text-[#0a2b45]" />
            </div>

            <div>
              <h1 className="text-2xl font-bold text-[#0a2b45]">Faturalar</h1>
              <p className="text-sm text-gray-500 mt-1">
                Ödemeler, fatura bilgileri, taslaklar ve KDV dahil/hariç ciro takibi.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full xl:w-auto">
            <button
              onClick={loadInvoices}
              className="h-11 rounded-2xl border px-4 text-sm font-semibold text-[#0a2b45] hover:bg-[#0a2b45]/5 inline-flex items-center justify-center gap-2"
            >
              <RefreshCcw className="w-4 h-4" />
              Yenile
            </button>

            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Firma, paket, e-posta veya vergi no ara..."
                className="w-full h-11 rounded-2xl border border-gray-200 bg-gray-50 pl-11 pr-4 text-sm outline-none focus:border-[#0a2b45]"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-[28px] border bg-white shadow-sm p-4 md:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-base font-bold text-gray-900">
              Ciro Dönemi Seçimi
            </div>
            <div className="text-sm text-gray-500">
              Ay ve yıl seçerek KDV dahil/hariç ciroyu net görebilirsin.
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full lg:w-auto">
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="h-11 rounded-2xl border bg-white px-3 text-sm"
            >
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>

            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="h-11 rounded-2xl border bg-white px-3 text-sm"
            >
              <option value="all">Tüm Yıllar</option>
              {availableYears.map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          icon={<Wallet className="w-5 h-5" />}
          title="Toplam Tahsilat"
          value={fmtTRY(totalVatIncluded)}
          note={`KDV hariç: ${fmtTRY(totalVatExcluded)} • KDV: ${fmtTRY(totalVat)}`}
        />
        <StatCard
          icon={<CalendarDays className="w-5 h-5" />}
          title={`${selectedMonthLabel} Ciro`}
          value={fmtTRY(monthVatIncluded)}
          note={`KDV dahil • Hariç: ${fmtTRY(monthVatExcluded)} • KDV: ${fmtTRY(monthVat)}`}
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5" />}
          title={`${selectedYearLabel} Ciro`}
          value={fmtTRY(yearVatIncluded)}
          note={`KDV dahil • Hariç: ${fmtTRY(yearVatExcluded)} • KDV: ${fmtTRY(yearVat)}`}
        />
        <StatCard
          icon={<Clock3 className="w-5 h-5" />}
          title="Fatura Bekleyen"
          value={waitingCount}
          note="Taslak oluşturulabilir ödeme sayısı"
        />
      </div>

      <div className="mt-5 rounded-[28px] border bg-white shadow-sm p-4 md:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between mb-4">
          <div>
            <div className="text-base font-bold text-gray-900">
              Ödeme ve Fatura Kayıtları
            </div>
            <div className="text-sm text-gray-500">
              PaymentSession kayıtlarından gelen gerçek ödeme ve fatura bilgileri.
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
              className="h-10 rounded-2xl border bg-white px-3 text-sm"
            >
              <option value="all">Tüm Dönemler</option>
              <option value="Aylık">Aylık</option>
              <option value="Yıllık">Yıllık</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 rounded-2xl border bg-white px-3 text-sm"
            >
              <option value="all">Tüm Durumlar</option>
              <option value="READY_TO_INVOICE">Fatura Bekleyen</option>
              <option value="INVOICE_DRAFT">Taslak</option>
              <option value="OFFICIAL_ISSUED">Faturalandı</option>
            </select>
          </div>
        </div>

        {loading && (
          <div className="rounded-2xl border bg-gray-50 p-6 text-sm text-gray-500">
            Fatura kayıtları yükleniyor...
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="rounded-2xl border bg-gray-50 p-6 text-sm text-gray-500">
            Seçilen filtrelere uygun fatura kaydı bulunamadı.
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <>
            <div className="hidden lg:block overflow-hidden rounded-2xl border">
              <div className="grid grid-cols-12 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-600">
                <div className="col-span-2">Tarih</div>
                <div className="col-span-3">Müşteri</div>
                <div className="col-span-2">Paket</div>
                <div className="col-span-1">Dönem</div>
                <div className="col-span-1 text-right">KDV Dahil</div>
                <div className="col-span-2 text-center">Durum</div>
                <div className="col-span-1 text-right">İşlem</div>
              </div>

              <div className="divide-y">
                {filtered.map((r) => (
                  <div
                    key={r.id}
                    className="grid grid-cols-12 px-4 py-3 text-sm hover:bg-gray-50 items-center"
                  >
                    <div className="col-span-2 text-gray-600">
                      {fmtDate(r.paidAt)}
                    </div>

                    <div className="col-span-3 min-w-0">
                      <div className="font-semibold text-gray-900 truncate">
                        {r.title || "—"}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {r.email || "—"}
                      </div>
                    </div>

                    <div className="col-span-2">
                      <div className="font-medium text-gray-800">
                        {r.planCode}
                      </div>
                    </div>

                    <div className="col-span-1 text-gray-700">{r.period}</div>

                    <div className="col-span-1 text-right">
                      <div className="font-bold text-gray-900">
                        {fmtTRY(getVatIncluded(r))}
                      </div>
                      <div className="text-[11px] text-gray-400">
                        Hariç: {fmtTRY(getVatExcluded(r))}
                      </div>
                    </div>

                    <div className="col-span-2 flex justify-center">
                      <StatusBadge status={r.invoiceStatus} />
                    </div>

                    <div className="col-span-1 flex justify-end">
                      <button
                        onClick={() => setSelected(r)}
                        className="inline-flex items-center justify-center rounded-xl border px-3 py-2 text-xs font-semibold text-[#0a2b45] hover:bg-[#0a2b45]/5"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:hidden space-y-3">
              {filtered.map((r) => (
                <div
                  key={r.id}
                  className="rounded-2xl border bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-bold text-gray-900">{r.title}</div>
                      <div className="text-xs text-gray-500 mt-1">{r.email}</div>
                    </div>
                    <StatusBadge status={r.invoiceStatus} />
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <Info label="Paket" value={r.planCode} />
                    <Info label="Dönem" value={r.period} />
                    <Info label="KDV Dahil" value={fmtTRY(getVatIncluded(r))} />
                    <Info label="KDV Hariç" value={fmtTRY(getVatExcluded(r))} />
                    <Info label="KDV" value={fmtTRY(getVat(r))} />
                    <Info label="Tarih" value={fmtDate(r.paidAt)} />
                  </div>

                  <button
                    onClick={() => setSelected(r)}
                    className="mt-3 w-full h-10 rounded-xl border text-sm font-semibold text-[#0a2b45] hover:bg-[#0a2b45]/5"
                  >
                    Detay Gör
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {selected && (

<InvoiceModal
  row={selected}
  actionLoading={actionLoading}
  onClose={() => setSelected(null)}
  onStatusChange={updateInvoiceStatus}
  onPdfOpen={openInvoicePdf}
/>

      )}
    </div>
  );
}

function StatCard({ icon, title, value, note }) {
  return (
    <div className="rounded-[24px] border bg-white shadow-sm p-5">
      <div className="flex items-center justify-between">
        <div className="w-11 h-11 rounded-2xl bg-[#0a2b45]/10 text-[#0a2b45] flex items-center justify-center">
          {icon}
        </div>
        <Filter className="w-4 h-4 text-gray-300" />
      </div>
      <div className="mt-4 text-sm text-gray-500">{title}</div>
      <div className="mt-1 text-2xl font-extrabold text-gray-900">{value}</div>
      <div className="mt-2 text-xs text-gray-400 leading-relaxed">{note}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  if (status === "OFFICIAL_ISSUED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        <CheckCircle2 className="w-3.5 h-3.5" /> Faturalandı
      </span>
    );
  }

  if (status === "INVOICE_DRAFT") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
        <FileText className="w-3.5 h-3.5" /> Taslak
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
      <Clock3 className="w-3.5 h-3.5" /> Bekliyor
    </span>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-xl bg-gray-50 border px-3 py-2">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm font-semibold text-gray-900 break-words">
        {value || "—"}
      </div>
    </div>
  );
}

function InvoiceModal({
  row,
  onClose,
  onStatusChange,
  onPdfOpen,
  actionLoading,
}) {

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="absolute right-0 top-0 h-full w-full sm:w-[620px] bg-white shadow-2xl overflow-y-auto">
        <div className="p-5 border-b flex items-start justify-between gap-3">
          <div>
            <div className="text-xl font-bold text-[#0a2b45]">
              Fatura Detayı
            </div>
            <div className="text-xs text-gray-500 mt-1">
              KDV dahil/hariç ödeme ve fatura bilgileri
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl border px-3 py-2 text-sm font-semibold hover:bg-gray-50"
          >
            Kapat
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-2xl border p-4">
            <div className="text-sm font-bold text-gray-900 mb-3">
              Müşteri Bilgileri
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Info label="Fatura Tipi" value={row.type} />
              <Info label="Ünvan / Ad Soyad" value={row.title} />
              <Info label="Vergi / TC No" value={row.taxNumber} />
              <Info label="Vergi Dairesi" value={row.taxOffice || "—"} />
              <Info label="E-posta" value={row.email} />
              <Info label="Telefon" value={row.phone} />
              <Info label="İl" value={row.city} />
              <Info label="İlçe" value={row.district} />
            </div>

            <div className="mt-3">
              <Info label="Adres" value={row.address} />
            </div>
          </div>

          <div className="rounded-2xl border p-4">
            <div className="text-sm font-bold text-gray-900 mb-3">
              Paket ve Ödeme
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Info label="Paket" value={row.planCode} />
              <Info label="Dönem" value={row.period} />
              <Info label="KDV Hariç Tutar" value={fmtTRY(getVatExcluded(row))} />
              <Info label="KDV" value={fmtTRY(getVat(row))} />
              <Info
                label="KDV Dahil Ödenen Tutar"
                value={fmtTRY(getVatIncluded(row))}
              />
              <Info label="Ödeme Tarihi" value={fmtDate(row.paidAt)} />
              <Info label="Fatura Durumu" value={statusText(row.invoiceStatus)} />
              <Info label="Ödeme ID" value={row.paymentSessionId || row.id} />
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="text-sm font-bold text-amber-800">
              Tutar kontrolü
            </div>
            <div className="text-xs text-amber-700 mt-1 leading-relaxed">
              Bu ekranda ana tutar <b>KDV dahil tahsilat</b> olarak gösterilir.
              KDV hariç tutar ve KDV ayrıca ayrılmıştır.
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              disabled={actionLoading}
              onClick={() => onStatusChange(row.id, "INVOICE_DRAFT")}
              className="h-11 rounded-xl bg-[#0a2b45] text-white text-sm font-bold disabled:opacity-60"
            >
              Taslak Oluştur
            </button>


<button
  onClick={() => onPdfOpen(row)}
  className="h-11 rounded-xl border text-sm font-bold text-[#0a2b45] hover:bg-[#0a2b45]/5"
>
  PDF İndir
</button>

            <button
              disabled={actionLoading}
              onClick={() => onStatusChange(row.id, "OFFICIAL_ISSUED")}
              className="h-11 rounded-xl border text-sm font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
            >
              Faturalandı
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function statusText(status) {
  if (status === "OFFICIAL_ISSUED") return "Faturalaştırıldı";
  if (status === "INVOICE_DRAFT") return "Taslak";
  if (status === "READY_TO_INVOICE") return "Fatura Bekleyen";
  if (status === "WAITING_BILLING_INFO") return "Fatura Bilgisi Bekleniyor";
  if (status === "INVOICE_FAILED") return "Fatura Hatalı";
  return status || "—";
}