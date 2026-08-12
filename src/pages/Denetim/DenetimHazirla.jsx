import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CheckCircle2, ClipboardCheck, Eye, FileCheck, Search, ShieldCheck, X } from "lucide-react";
import { API_BASE } from "../../config/api";

function authToken() {
  const activeEmail = localStorage.getItem("__isg_active_email_global") || "";
  return (
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    sessionStorage.getItem("authToken") ||
    localStorage.getItem(`isgpanel:${activeEmail}:token`) ||
    ""
  );
}

function parseStored(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function normalizeCompany(company) {
  if (!company || typeof company !== "object") return null;
  const id = company.id || company._id || company.firmaId || company.companyId || company.sgkSicilNo || company.sgk;
  const name = company.name || company.firmaAdi || company.companyName || company.unvan || company.firma || "";
  if (!id && !name) return null;
  return { id: String(id || name), name: String(name || id) };
}

function storedCompany() {
  const activeEmail = localStorage.getItem("__isg_active_email_global") || "";
  const keys = [`isgpanel:${activeEmail}:selectedFirm`, "selectedFirm", "selectedFirma", "currentFirm", "firma"];
  for (const store of [localStorage, sessionStorage]) {
    for (const key of keys) {
      const found = normalizeCompany(parseStored(store.getItem(key)));
      if (found) return found;
    }
  }
  return null;
}

function headers() {
  const token = authToken();
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

function basePath(pathname) {
  if (pathname.startsWith("/ticari/admin")) return "/ticari/admin";
  if (pathname.startsWith("/ticari/user")) return "/ticari/user";
  return "/panel";
}

export default function DenetimHazirla() {
  const location = useLocation();
  const navigate = useNavigate();
  const company = normalizeCompany(location.state?.company) || storedCompany();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [categories, setCategories] = useState([]);
  const [packages, setPackages] = useState([]);
  const [selectedDocs, setSelectedDocs] = useState(new Set());
  const [detailCategory, setDetailCategory] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let ignore = false;
    async function load() {
      if (!company?.id) {
        setError("Denetim dosyası oluşturmak için önce firma seçiniz.");
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const params = new URLSearchParams({ companyId: company.id, companyName: company.name || "" });
        const res = await fetch(`${API_BASE}/api/audit-packages/prepare?${params}`, { headers: headers() });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "Belgeler alınamadı.");
        if (ignore) return;
        setCategories(data.categories || []);
        setPackages(data.packages || []);
        const defaults = new Set();
        (data.categories || []).forEach((cat) => {
          if (cat.selectedDefault) cat.documents.forEach((doc) => defaults.add(doc.id));
        });
        setSelectedDocs(defaults);
      } catch (err) {
        if (!ignore) setError(err.message || "Belgeler alınamadı.");
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [company?.id]);

  const docsById = useMemo(() => {
    const map = new Map();
    categories.forEach((cat) => cat.documents.forEach((doc) => map.set(doc.id, { ...doc, category: cat.name })));
    return map;
  }, [categories]);

  const filteredCategories = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    if (!q) return categories;
    return categories.filter((cat) => cat.name.toLocaleLowerCase("tr-TR").includes(q));
  }, [categories, query]);

  const selectedCategoryCount = categories.filter((cat) => cat.documents.some((doc) => selectedDocs.has(doc.id))).length;
  const totalDocCount = categories.reduce((sum, cat) => sum + cat.count, 0);

  function setCategory(cat, checked) {
    setSelectedDocs((prev) => {
      const next = new Set(prev);
      cat.documents.forEach((doc) => (checked ? next.add(doc.id) : next.delete(doc.id)));
      return next;
    });
  }

  function setDoc(id, checked) {
    setSelectedDocs((prev) => {
      const next = new Set(prev);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  }

  async function createPackage() {
    try {
      setCreating(true);
      const res = await fetch(`${API_BASE}/api/audit-packages`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          companyId: company.id,
          companyName: company.name,
          documentIds: [...selectedDocs],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Denetim dosyası oluşturulamadı.");
      navigate(`${basePath(location.pathname)}/denetim/paket/${data.id}`, { state: { auditPackage: data } });
    } catch (err) {
      setError(err.message || "Denetim dosyası oluşturulamadı.");
      setConfirmOpen(false);
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-7xl p-8 text-slate-600">Denetim belgeleri hazırlanıyor...</div>;
  }

  return (
    <div className="mx-auto max-w-7xl p-6 text-[#042f4b]">
      <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Denetime Hazırlan</h1>
          <p className="mt-1 text-sm text-slate-600">
            Firmanıza ait İSG belgelerini kontrol edin, denetim dosyanızı oluşturun ve güvenli bağlantı ile paylaşın.
          </p>
          <p className="mt-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
            <span className="font-semibold">Firma:</span> {company?.name || "-"}
          </p>
        </div>
        <button
          type="button"
          disabled={selectedDocs.size < 1}
          onClick={() => setConfirmOpen(true)}
          className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold shadow-sm ${
            selectedDocs.size < 1 ? "cursor-not-allowed bg-slate-200 text-slate-500" : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          <ShieldCheck size={17} />
          Denetim Dosyası Oluştur
        </button>
      </div>

      {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <SummaryCard icon={<FileCheck size={22} />} label="Toplam Belge" value={totalDocCount} />
        <SummaryCard icon={<CheckCircle2 size={22} />} label="Seçilen Belge" value={selectedDocs.size} />
        <SummaryCard icon={<ClipboardCheck size={22} />} label="Seçilen Kategori" value={selectedCategoryCount} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={17} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-md border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-400"
              placeholder="Kategori ara..."
            />
          </div>
          <div className="flex gap-2">
            <button
              className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
              onClick={() => setSelectedDocs(new Set(categories.flatMap((cat) => cat.documents.map((doc) => doc.id))))}
            >
              Tümünü Seç
            </button>
            <button
              className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
              onClick={() => setSelectedDocs(new Set())}
            >
              Seçimi Temizle
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredCategories.map((cat) => {
            const selectedCount = cat.documents.filter((doc) => selectedDocs.has(doc.id)).length;
            const allSelected = cat.count > 0 && selectedCount === cat.count;
            const someSelected = selectedCount > 0 && selectedCount < cat.count;
            return (
              <div key={cat.name} className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_120px_150px_130px] md:items-center">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    disabled={cat.count === 0}
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={(e) => setCategory(cat, e.target.checked)}
                    className="mt-1 h-4 w-4"
                  />
                  <span>
                    <span className="block font-semibold">{cat.name}</span>
                    <span className="text-xs text-slate-500">{cat.count} belge</span>
                  </span>
                </label>
                <span className="text-sm font-semibold">{selectedCount} seçili</span>
                <span className={`inline-flex w-fit rounded-full px-2 py-1 text-xs font-semibold ${cat.count ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                  {cat.count ? "Hazır" : "Belge bulunamadı"}
                </span>
                <button
                  disabled={cat.count === 0}
                  onClick={() => setDetailCategory(cat)}
                  className="inline-flex w-fit items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                >
                  <Eye size={16} />
                  Detayları Gör
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-bold">Denetim Dosyaları</h2>
        {packages.length === 0 ? (
          <p className="text-sm text-slate-500">Bu firma için oluşturulmuş denetim dosyası bulunamadı.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-3">Dosya No</th>
                  <th className="px-3 py-3">Oluşturulma Tarihi</th>
                  <th className="px-3 py-3">Belge Sayısı</th>
                  <th className="px-3 py-3">Kategori Sayısı</th>
                  <th className="px-3 py-3">Durum</th>
                  <th className="px-3 py-3 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {packages.map((pkg) => (
                  <tr key={pkg.id} className="border-t border-slate-100">
                    <td className="px-3 py-3 font-semibold">{pkg.packageNumber}</td>
                    <td className="px-3 py-3">{pkg.createdAtFormatted}</td>
                    <td className="px-3 py-3">{pkg.documentCount}</td>
                    <td className="px-3 py-3">{pkg.categoryCount}</td>
                    <td className="px-3 py-3">{pkg.statusLabel}</td>
                    <td className="px-3 py-3 text-right">
                      <button
                        onClick={() => navigate(`${basePath(location.pathname)}/denetim/paket/${pkg.id}`, { state: { auditPackage: pkg } })}
                        className="rounded-md border border-slate-200 px-3 py-2 font-semibold hover:bg-slate-50"
                      >
                        Görüntüle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detailCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[86vh] w-full max-w-4xl overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 p-4">
              <div>
                <h2 className="text-lg font-bold">{detailCategory.name}</h2>
                <p className="text-sm text-slate-500">{detailCategory.count} belge</p>
              </div>
              <button onClick={() => setDetailCategory(null)} className="rounded-md p-2 hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>
            <div className="max-h-[65vh] overflow-auto p-4">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-3"></th>
                    <th className="px-3 py-3">Belge adı</th>
                    <th className="px-3 py-3">Belge tarihi</th>
                    <th className="px-3 py-3">Revizyon</th>
                    <th className="px-3 py-3">İmza durumu</th>
                    <th className="px-3 py-3">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {detailCategory.documents.map((doc) => (
                    <tr key={doc.id} className="border-t border-slate-100">
                      <td className="px-3 py-3">
                        <input type="checkbox" checked={selectedDocs.has(doc.id)} onChange={(e) => setDoc(doc.id, e.target.checked)} />
                      </td>
                      <td className="px-3 py-3 font-semibold">{doc.title}</td>
                      <td className="px-3 py-3">{doc.date || "-"}</td>
                      <td className="px-3 py-3">{doc.revision || "-"}</td>
                      <td className="px-3 py-3">{doc.signatureStatus || "-"}</td>
                      <td className="px-3 py-3">{doc.status || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
            <h2 className="text-lg font-bold">Denetim Dosyası Oluşturulsun mu?</h2>
            <p className="mt-3 text-sm text-slate-600">
              {company?.name || "Seçili firma"} için {selectedDocs.size} belge içeren dijital denetim dosyası oluşturulacaktır.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button className="rounded-md border border-slate-200 px-4 py-2 font-semibold" onClick={() => setConfirmOpen(false)} disabled={creating}>
                Vazgeç
              </button>
              <button className="rounded-md bg-blue-600 px-4 py-2 font-semibold text-white" onClick={createPackage} disabled={creating}>
                {creating ? "Oluşturuluyor..." : "Dosyayı Oluştur"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ icon, label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 inline-flex rounded-full bg-blue-50 p-2 text-blue-600">{icon}</div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm text-slate-500">{label}</div>
    </div>
  );
}
