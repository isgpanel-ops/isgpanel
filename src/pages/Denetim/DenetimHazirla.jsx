import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CheckCircle2, ClipboardCheck, Copy, Eye, FileCheck, Search, ShieldCheck, Trash2, X } from "lucide-react";
import { API_BASE } from "../../config/api";
import { useFirmalar } from "../../context/FirmaContext";
import ConfirmModal from "../../components/ui/ConfirmModal";

const AUDIT_API_BASE = API_BASE.endsWith("/api") ? API_BASE : `${API_BASE}/api`;
const panelButton = "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a2b45] disabled:cursor-not-allowed disabled:opacity-60";
const ghostButton = `${panelButton} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`;
const primaryButton = `${panelButton} bg-[#2563eb] text-white hover:bg-[#1d4ed8]`;
const upperTR = (value = "") => String(value).toLocaleUpperCase("tr-TR");

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
  const keys = [
    "isgpanel:selectedFirm",
    `isgpanel:${activeEmail}:selectedFirm`,
    `isgpanel:${activeEmail}:selectedFirma`,
    "selectedFirm",
    "selectedFirma",
    "currentFirm",
    "currentFirma",
    "firma",
  ];
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

async function readApiJson(response, fallbackMessage) {
  const raw = await response.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    if (response.status === 404) {
      throw new Error("Belge Paylaşımı servisi canlı sunucuda henüz güncel değil. Lütfen backend yayınının tamamlanmasını bekleyiniz.");
    }
    throw new Error(fallbackMessage);
  }
  if (!response.ok) throw new Error(data?.message || fallbackMessage);
  return data;
}

function basePath(pathname) {
  if (pathname.startsWith("/ticari/admin")) return "/ticari/admin";
  if (pathname.startsWith("/ticari/user")) return "/ticari/user";
  if (pathname.startsWith("/ticari/belgeler")) return "/ticari/belgeler";
  return "/panel";
}

function localDateTimeValue(date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default function DenetimHazirla() {
  const location = useLocation();
  const navigate = useNavigate();
  const { selectedFirm } = useFirmalar();
  const company = normalizeCompany(selectedFirm) || normalizeCompany(location.state?.company) || storedCompany();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [categories, setCategories] = useState([]);
  const [packages, setPackages] = useState([]);
  const [selectedDocs, setSelectedDocs] = useState(new Set());
  const [detailCategory, setDetailCategory] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientType, setRecipientType] = useState("INSPECTOR");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [note, setNote] = useState("");
  const [accessType, setAccessType] = useState("TIMED");
  const [expiresAt, setExpiresAt] = useState(() => localDateTimeValue(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)));
  const [password, setPassword] = useState("");
  const [allowDownload, setAllowDownload] = useState(true);

  useEffect(() => {
    let ignore = false;
    async function load() {
      if (!company?.id) {
        setError("Denetim dosyası oluşturmak için önce firma seçiniz.");
        setLoading(false);
        return;
      }
      try {
        setError("");
        setLoading(true);
        const params = new URLSearchParams({ companyId: company.id, companyName: company.name || "" });
        const res = await fetch(`${AUDIT_API_BASE}/audit-packages/prepare?${params}`, { headers: headers() });
        const data = await readApiJson(res, "Belgeler alınamadı.");
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

  async function deletePackage(id) {
    const res = await fetch(`${AUDIT_API_BASE}/audit-packages/${id}`, { method: "DELETE", headers: headers() });
    if (!res.ok) return setError("Paylaşım silinemedi.");
    setPackages((prev) => prev.filter((pkg) => pkg.id !== id));
  }

  async function createPackage() {
    try {
      setCreating(true);
      const res = await fetch(`${AUDIT_API_BASE}/audit-packages`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          companyId: company.id,
          companyName: company.name,
          documentIds: [...selectedDocs],
          recipientName: recipientName.trim(),
          recipientType,
          recipientEmail: recipientEmail.trim(),
          note: note.trim(),
          accessType,
          expiresAt: accessType === "TIMED" ? new Date(expiresAt).toISOString() : null,
          password,
          allowDownload,
        }),
      });
      const data = await readApiJson(res, "Belge paylaşımı oluşturulamadı.");
      navigate(`${basePath(location.pathname)}/denetim/paket/${data.package?.id}`, { state: { auditPackage: data.package } });
    } catch (err) {
      setError(err.message || "Denetim dosyası oluşturulamadı.");
      setConfirmAction(null);
    } finally {
      setCreating(false);
    }
  }

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail.trim());
  const expiryValid = accessType !== "TIMED" || (expiresAt && new Date(expiresAt).getTime() > Date.now());
  const canCreate = selectedDocs.size > 0 && recipientName.trim() && emailValid && expiryValid;

  if (loading) {
    return <div className="mx-auto max-w-7xl p-8 text-slate-600">Denetim belgeleri hazırlanıyor...</div>;
  }

  return (
    <div className="p-3 text-[#042f4b] sm:p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold sm:text-xl">Belge Paylaşımı</h1>
          <p className="mt-1 text-xs text-slate-500">
            Firmanıza ait İSG belgelerini seçin, güvenli paylaşım paketinizi oluşturun ve bağlantı ile paylaşın.
          </p>
          <p className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs">
            <span className="font-semibold">Firma:</span> {company?.name || "-"}
          </p>
        </div>
        <button
          type="button"
          disabled={!canCreate}
          onClick={() => setConfirmAction({ type: "create" })}
          className={`${panelButton} ${
            !canCreate ? "bg-slate-200 text-slate-500" : "bg-[#2563eb] text-white hover:bg-[#1d4ed8]"
          }`}
        >
          <ShieldCheck size={14} />
          Paylaşım Oluştur
        </button>
      </div>

      {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <section className="mb-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-bold">Paylaşım Bilgileri</h2>
        <p className="mb-3 mt-1 text-xs text-slate-500">Bağlantının gönderileceği kişiyi ve erişim kurallarını belirleyin.</p>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <label className="text-xs font-medium text-slate-700">Alıcı adı<input value={recipientName} onChange={(e) => setRecipientName(upperTR(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-normal" placeholder="AD SOYAD" /></label>
          <label className="text-xs font-medium text-slate-700">Alıcı türü<select value={recipientType} onChange={(e) => setRecipientType(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-normal"><option value="INSPECTOR">Müfettiş</option><option value="EMPLOYER">İşveren</option><option value="HR">İnsan Kaynakları</option><option value="COMPANY_REPRESENTATIVE">Firma Yetkilisi</option><option value="OHS_PROFESSIONAL">İSG Profesyoneli</option><option value="OTHER">Diğer</option></select></label>
          <label className="text-xs font-medium text-slate-700">E-posta adresi<input type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-normal" placeholder="ornek@firma.com" /></label>
          <label className="text-xs font-medium text-slate-700">Erişim türü<select value={accessType} onChange={(e) => setAccessType(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-normal"><option value="TIMED">Süreli</option><option value="UNLIMITED">Süresiz</option></select></label>
          {accessType === "TIMED" && <label className="text-xs font-medium text-slate-700">Son erişim zamanı<input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-normal" /></label>}
          <label className="text-xs font-medium text-slate-700">Erişim şifresi (isteğe bağlı)<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-normal" placeholder="Şifresiz paylaşmak için boş bırakın" /></label>
        </div>
        <label className="mt-3 block text-xs font-medium text-slate-700">Not (isteğe bağlı)<textarea value={note} onChange={(e) => setNote(upperTR(e.target.value))} rows={2} className="mt-1 w-full resize-y rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-normal" /></label>
        <label className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-slate-700"><input type="checkbox" checked={allowDownload} onChange={(e) => setAllowDownload(e.target.checked)} />Belgelerin indirilmesine izin ver</label>
        {!emailValid && recipientEmail && <p className="mt-2 text-xs text-red-600">Geçerli bir e-posta adresi giriniz.</p>}
        {!expiryValid && <p className="mt-2 text-xs text-red-600">Erişim bitiş zamanı gelecekte olmalıdır.</p>}
      </section>

      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <SummaryCard icon={<FileCheck size={22} />} label="Toplam Belge" value={totalDocCount} />
        <SummaryCard icon={<CheckCircle2 size={22} />} label="Seçilen Belge" value={selectedDocs.size} />
        <SummaryCard icon={<ClipboardCheck size={22} />} label="Seçilen Kategori" value={selectedCategoryCount} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-200 p-3 md:flex-row md:items-center md:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={17} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-300 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-[#0a2b45]"
              placeholder="Kategori ara..."
            />
          </div>
          <div className="flex gap-2">
            <button
              className={ghostButton}
              onClick={() => setSelectedDocs(new Set(categories.flatMap((cat) => cat.documents.map((doc) => doc.id))))}
            >
              Tümünü Seç
            </button>
            <button
              className={ghostButton}
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
              <div key={cat.name} className="grid gap-2 px-3 py-2.5 md:grid-cols-[minmax(0,1fr)_92px_112px_118px] md:items-center">
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
                    <span className="block text-xs font-medium">{cat.name}</span>
                    <span className="text-xs text-slate-500">{cat.count} belge</span>
                  </span>
                </label>
                <span className="text-xs font-semibold">{selectedCount} seçili</span>
                <span className={`inline-flex w-fit rounded-full px-2 py-1 text-xs font-semibold ${cat.count ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                  {cat.count ? "Hazır" : "Belge bulunamadı"}
                </span>
                <button
                  disabled={cat.count === 0}
                  onClick={() => setDetailCategory(cat)}
                  className={`${ghostButton} w-fit disabled:text-slate-400`}
                >
                  <Eye size={14} />
                  Detayları Gör
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <h2 className="mb-3 text-base font-bold">Paylaşım Geçmişi</h2>
        {packages.length === 0 ? (
          <p className="text-sm text-slate-500">Bu firma için oluşturulmuş paylaşım bulunamadı.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-3">Dosya No</th>
                  <th className="px-3 py-3">Paylaşılan Kişi</th>
                  <th className="px-3 py-3">Alıcı Türü</th>
                  <th className="px-3 py-3">Oluşturulma Tarihi</th>
                  <th className="px-3 py-3">Belge Sayısı</th>
                  <th className="px-3 py-3">Kategori Sayısı</th>
                  <th className="px-3 py-3">Durum</th>
                  <th className="px-3 py-3">Son Erişim</th>
                  <th className="px-3 py-3 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {packages.map((pkg) => (
                  <tr key={pkg.id} className="border-t border-slate-100">
                    <td className="px-3 py-3 font-medium">{pkg.packageNumber}</td>
                    <td className="px-3 py-3">{pkg.recipientName || "-"}</td>
                    <td className="px-3 py-3">{{ INSPECTOR: "Müfettiş", EMPLOYER: "İşveren", HR: "İnsan Kaynakları", COMPANY_REPRESENTATIVE: "Firma Yetkilisi", OHS_PROFESSIONAL: "İSG Profesyoneli", OTHER: "Diğer" }[pkg.recipientType] || "-"}</td>
                    <td className="px-3 py-3">{pkg.createdAt ? new Date(pkg.createdAt).toLocaleString("tr-TR") : "-"}</td>
                    <td className="px-3 py-3">{pkg.documentCount}</td>
                    <td className="px-3 py-3">{pkg.categoryCount}</td>
                    <td className="px-3 py-3">{pkg.status === "ACTIVE" ? "Aktif" : pkg.status || "-"}</td>
                    <td className="px-3 py-3">{pkg.lastAccessAt ? new Date(pkg.lastAccessAt).toLocaleString("tr-TR") : "Henüz açılmadı"}</td>
                    <td className="px-3 py-3 text-right">
                      <button
                        onClick={() => navigate(`${basePath(location.pathname)}/denetim/paket/${pkg.id}`, { state: { auditPackage: pkg } })}
                        className={ghostButton}
                      >
                        <Eye size={14} /> Detay
                      </button>
                      <button title="Linki kopyala" onClick={() => navigator.clipboard.writeText(pkg.publicUrl)} className={`ml-2 ${ghostButton} !px-2`}><Copy size={14} /></button>
                      <button title="Sil" onClick={() => setConfirmAction({ type: "delete", id: pkg.id })} className={`ml-2 ${panelButton} border border-rose-200 bg-white text-rose-600 hover:bg-rose-50`}><Trash2 size={14} /> Sil</button>
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
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2"></th>
                    <th className="px-3 py-2">Belge adı</th>
                    <th className="px-3 py-2">Belge tarihi</th>
                    <th className="px-3 py-2">Hazırlayan</th>
                    <th className="px-3 py-2">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {detailCategory.documents.map((doc) => (
                    <tr key={doc.id} className="border-t border-slate-100">
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={selectedDocs.has(doc.id)} onChange={(e) => setDoc(doc.id, e.target.checked)} />
                      </td>
                      <td className="px-3 py-2 font-medium">{doc.title}</td>
                      <td className="px-3 py-2">{doc.tarih ? new Date(doc.tarih).toLocaleDateString("tr-TR") : "-"}</td>
                      <td className="px-3 py-2">{doc.hazirlayan ? upperTR(doc.hazirlayan) : "-"}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium ${String(doc.status || "hazir").toLowerCase().includes("arsiv") ? "bg-slate-100 text-slate-600" : "bg-emerald-50 text-emerald-700"}`}>
                          <CheckCircle2 size={12} />
                          {String(doc.status || "hazir").toLowerCase().includes("arsiv") ? "Arşiv" : "Hazır"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(confirmAction)}
        title={confirmAction?.type === "delete" ? "Uyarı" : "Belge Paylaşımı Oluşturulsun mu?"}
        message={confirmAction?.type === "delete"
          ? "Bu paylaşım ve bağlantısı kalıcı olarak silinsin mi?"
          : `${company?.name || "Seçili firma"} için ${selectedDocs.size} belge içeren belge paylaşımı oluşturulacaktır.`}
        variant={confirmAction?.type === "delete" ? "warning" : "info"}
        confirmText={confirmAction?.type === "delete" ? "Sil" : (creating ? "Oluşturuluyor..." : "Oluştur")}
        cancelText="İptal"
        onCancel={() => !creating && setConfirmAction(null)}
        onConfirm={() => confirmAction?.type === "delete" ? deletePackage(confirmAction.id) : createPackage()}
      />
    </div>
  );
}

function SummaryCard({ icon, label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-2 inline-flex rounded-full bg-blue-50 p-2 text-blue-600">{icon}</div>
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
