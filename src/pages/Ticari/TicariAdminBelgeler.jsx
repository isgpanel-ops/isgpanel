import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";

import { CardBox, SectionTitle } from "../../components/ui";
import ConfirmModal from "../../components/ui/ConfirmModal";

const API_BASE =
  (import.meta?.env?.VITE_API_URL || "").trim().replace(/\/$/, "") ||
  "https://api.isgpanel.tr";

const LS_ACTIVE_TAB_KEY = "isgpanel:ticariAdminBelgelerActiveTab";
const LS_SEARCH_KEY = "isgpanel:ticariAdminBelgelerSearch";
const LS_SORT_KEY = "isgpanel:ticariAdminBelgelerSort";
const LS_PAGE_SIZE_KEY = "isgpanel:ticariAdminBelgelerPageSize";

const TAB_LABELS = {
  risk: "Risk Değerlendirme",
  acil: "Acil Durum",
  yillik: "Yıllık Planlar",
  egitim: "Eğitim & Sertifikalar",
  talimat: "Talimatlar & KKD",
  periyodik: "Periyodik & İş Hijyeni",
  defter: "Defter & Kurul",
};

const TAB_CATEGORY_MAP = {
  risk: "risk",
  acil: "acil",
  yillik: "yillik",
  egitim: "egitim",
  talimat: "talimat",
  periyodik: "periyodik-is-hijyeni",
  defter: "defter-kurul",
};

const pad2 = (n) => String(n).padStart(2, "0");
const toDisplayDate = (value) => {
  if (!value) return "";
  if (typeof value === "string") {
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(value)) return value;
    const iso = value.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      const [y, m, d] = iso.split("-");
      return `${d}.${m}.${y}`;
    }
  }
  try {
    const dt = value instanceof Date ? value : new Date(value);
    if (isNaN(dt)) return "";
    return `${pad2(dt.getDate())}.${pad2(dt.getMonth() + 1)}.${dt.getFullYear()}`;
  } catch {
    return "";
  }
};

const toIsoDate = (value) => {
  if (!value) return "";
  if (typeof value === "string") {
    const iso = value.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(value)) {
      const [d, m, y] = value.split(".");
      return `${y}-${m}-${d}`;
    }
  }
  try {
    const dt = value instanceof Date ? value : new Date(value);
    if (isNaN(dt)) return "";
    const y = dt.getFullYear();
    const m = pad2(dt.getMonth() + 1);
    const d = pad2(dt.getDate());
    return `${y}-${m}-${d}`;
  } catch {
    return "";
  }
};

const sanitizeFileName = (input) => {
  let out = (input ?? "").toString().trim();
  if (!out) return "belge";
  try {
    out = out.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  } catch {}
  out = out
    .replace(/[\\\/:*?"<>|]/g, "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.\s]+$/g, "")
    .trim();

  if (out.length > 180) out = out.slice(0, 180).trim();
  return out || "belge";
};

const buildDownloadFileName = ({ firmaAdi, tur, tarihStr }) => {
  const safeFirma = sanitizeFileName(firmaAdi || "Firma");
  const safeTur = sanitizeFileName(tur || "Belge");
  const safeTarih = sanitizeFileName(tarihStr || "tarih-yok");
  return `${safeFirma} - ${safeTur} - ${safeTarih}.pdf`;
};

const inferBelgeTuru = (doc) => {
  return (
    doc?.title ||
    doc?.subCategory ||
    doc?.belgeTuru ||
    doc?.tur ||
    (doc?.category ? String(doc.category) : "Belge")
  );
};

const getFirmName = (d) =>
  d?.firmaAdi ||
  d?.firmName ||
  d?.firma?.firmaAdi ||
  d?.firma?.name ||
  d?.companyName ||
  "";

const getFirmSgk = (d) =>
  d?.sgk ||
  d?.sgkNo ||
  d?.sicilNo ||
  d?.firmaSgk ||
  d?.firma?.sgk ||
  d?.firma?.sicilNo ||
  "";

const getStatus = (d) => d?.durum || d?.status || "";
const getId = (d) => d?.id || d?._id || d?.docId;

// ✅ Hazırlayan yakalama (backend hangi alanı gönderirse)
const getPreparedBy = (d) => {
  const createdByObj =
    d?.createdBy && typeof d.createdBy === "object" ? d.createdBy : null;

  const v =
    d?.hazirlayan ||
    d?.hazirlayanAdSoyad ||
    d?.preparedBy ||
    d?.preparedByName ||
    d?.createdByName ||
    d?.createdByFullName ||
    d?.createdByUserName ||
    d?.createdByUserFullName ||
    d?.olusturan ||
    d?.olusturanAdSoyad ||
    d?.userName ||
    d?.userFullName ||
   d?.adSoyad ||
d?.name ||
d?.fullName ||
d?.user?.name ||
d?.user?.fullName ||
    createdByObj?.name ||
    createdByObj?.fullName ||
    createdByObj?.adSoyad ||
    "";

  return (v ?? "").toString().trim();
};




function PreviewModal({ open, doc, onClose }) {
  if (!open || !doc) return null;

  const rawFileUrl =
  doc.fileUrl ||
  doc.url ||
  doc.pdfUrl ||
  doc.downloadUrl ||
  "";

let fileUrl = (rawFileUrl || "").trim();

if (fileUrl.startsWith("/")) {
  if (fileUrl.startsWith("/documents/")) {
    fileUrl = `/api${fileUrl}`;
  }

  if (fileUrl.startsWith("/api/documents/") && !fileUrl.includes("/download")) {
    fileUrl = `${fileUrl}/download`;
  }

  fileUrl = `${API_BASE}${fileUrl}`;
} else if (/^https?:\/\//i.test(fileUrl)) {
  fileUrl = fileUrl.replace(
    /^https?:\/\/api\.isgpanel\.tr\/documents\//i,
    `${API_BASE}/api/documents/`
  );

  if (fileUrl.includes("/api/documents/") && !fileUrl.includes("/download")) {
    fileUrl = `${fileUrl}/download`;
  }
}

const [blobUrl, setBlobUrl] = useState("");
const [loadingPreview, setLoadingPreview] = useState(false);

useEffect(() => {
  if (!open || !doc || !fileUrl) return;

  let active = true;
  let tempUrl = "";

  const loadPdf = async () => {
    try {
      setLoadingPreview(true);

      const token =
        localStorage.getItem("token") ||
        sessionStorage.getItem("token") ||
        "";

      const res = await fetch(fileUrl, {
        method: "GET",
        headers: token
          ? { Authorization: `Bearer ${token}` }
          : {},
      });

      if (!res.ok) {
        throw new Error("PDF alınamadı");
      }

      const blob = await res.blob();

      tempUrl = URL.createObjectURL(
        new Blob([blob], { type: "application/pdf" })
      );

      if (active) {
        setBlobUrl(tempUrl);
      }
    } catch (e) {
      console.error("PDF preview hatası:", e);
      if (active) setBlobUrl("");
    } finally {
      if (active) setLoadingPreview(false);
    }
  };

  loadPdf();

  return () => {
    active = false;

    if (tempUrl) {
      URL.revokeObjectURL(tempUrl);
    }
  };
}, [open, doc, fileUrl]);



  const prepared = getPreparedBy(doc);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-4xl rounded-2xl bg-white shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-900 truncate">
              {getFirmName(doc) ? `${getFirmName(doc)} · ` : ""}
              {inferBelgeTuru(doc)}
            </div>
            <div className="text-xs text-gray-500">
              {toDisplayDate(doc.tarih || doc.createdAt)}
              {prepared ? ` · Hazırlayan: ${prepared}` : ""}
              {getStatus(doc) ? ` · ${getStatus(doc)}` : ""}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded-lg border hover:bg-gray-50"
          >
            Kapat
          </button>
        </div>

        <div className="h-[70vh] bg-gray-50">
          {fileUrl ? (
            loadingPreview ? (
  <div className="h-full flex items-center justify-center text-sm text-gray-500">
    PDF yükleniyor...
  </div>
) : blobUrl ? (
  <iframe title="PDF Önizleme" src={blobUrl} className="w-full h-full" />
) : (
  <div className="h-full flex items-center justify-center text-sm text-red-500">
    PDF önizleme yüklenemedi.
  </div>
)
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-gray-500">
              Bu belge için kayıtlı PDF bulunamadı.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


export default function TicariAdminBelgeler() {
  const location = useLocation();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const selectedUserId = searchParams.get("u") || "all";

  const [activeTab, setActiveTab] = useState(() => localStorage.getItem(LS_ACTIVE_TAB_KEY) || "risk");
  const [searchText, setSearchText] = useState(() => localStorage.getItem(LS_SEARCH_KEY) || "");
  const [sortDir, setSortDir] = useState(() => localStorage.getItem(LS_SORT_KEY) || "asc");
  const [pageSize, setPageSize] = useState(() => {
    const saved = Number(localStorage.getItem(LS_PAGE_SIZE_KEY));
    return [10, 25, 50].includes(saved) ? saved : 10;
  });
  const [page, setPage] = useState(1);

  const [allDocs, setAllDocs] = useState([]);
  const [loading, setLoading] = useState(false);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);

  // ConfirmModal state (Firmalar UX)
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmData, setConfirmData] = useState({
    title: "",
    message: "",
    variant: "info",
    confirmText: "Tamam",
    cancelText: null,
    onConfirm: null,
    onCancel: null,
  });

  const openInfo = (title, message) => {
    setConfirmData({
      title,
      message,
      variant: "info",
      confirmText: "Tamam",
      cancelText: null,
      onConfirm: () => setConfirmOpen(false),
      onCancel: null,
    });
    setConfirmOpen(true);
  };

  const openConfirm = ({
    title,
    message,
    onConfirm,
    confirmText = "Tamam",
    cancelText = "İptal",
    variant = "warning",
  }) => {
    setConfirmData({
      title,
      message,
      variant,
      confirmText,
      cancelText,
      onConfirm: () => {
        setConfirmOpen(false);
        onConfirm?.();
      },
      onCancel: () => setConfirmOpen(false),
    });
    setConfirmOpen(true);
  };

  useEffect(() => localStorage.setItem(LS_ACTIVE_TAB_KEY, activeTab), [activeTab]);
  useEffect(() => localStorage.setItem(LS_SEARCH_KEY, searchText), [searchText]);
  useEffect(() => localStorage.setItem(LS_SORT_KEY, sortDir), [sortDir]);
  useEffect(() => localStorage.setItem(LS_PAGE_SIZE_KEY, String(pageSize)), [pageSize]);

  useEffect(() => {
    setPage(1);
  }, [activeTab, searchText, sortDir, pageSize, selectedUserId]);

  // ✅ TEK FETCH (çift useEffect kaldırıldı)
  useEffect(() => {
    const run = async () => {
      setAllDocs([]);

      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      if (!token) return;

      setLoading(true);
      try {
        const params =
          selectedUserId && selectedUserId !== "all" ? { userId: selectedUserId } : {};

        const res = await axios.get(`${API_BASE}/api/documents`, {
          headers: { Authorization: `Bearer ${token}` },
          params,
        });

        const data = res?.data;
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.documents)
          ? data.documents
          : [];

        setAllDocs(list);
      } catch (e) {
        console.error("Admin belgeler çekilemedi:", e);
        openInfo("Bilgilendirme", "Belgeler yüklenemedi.");
      } finally {
        setLoading(false);
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId]);

  const filtered = useMemo(() => {
    const catKey = TAB_CATEGORY_MAP[activeTab] || activeTab;
    const q = searchText.trim().toLowerCase();

    return (allDocs || [])
      .filter((d) => {
        // kullanıcı filtresi (ek güvence)
        if (selectedUserId && selectedUserId !== "all") {
          const u =
  d?.userId ||
  d?.createdByUserId ||   // ✅ EKLE
  d?.createdBy ||
  d?.ownerId ||
  d?.user ||
  d?.user?._id ||
  d?.user?.id;
          if (u && String(u) !== String(selectedUserId)) return false;
        }

        const cat = (d?.category || "").toString().toLowerCase();
        if (catKey && catKey !== "all" && cat !== catKey) return false;

        if (q) {
          const hay = `${getFirmName(d)} ${getFirmSgk(d)} ${inferBelgeTuru(d)} ${toDisplayDate(
            d?.tarih || d?.createdAt
          )} ${getPreparedBy(d)}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const af = (getFirmName(a) || "").toLocaleLowerCase("tr-TR");
        const bf = (getFirmName(b) || "").toLocaleLowerCase("tr-TR");
        const cmp = af.localeCompare(bf, "tr-TR");
        if (cmp !== 0) return sortDir === "asc" ? cmp : -cmp;

        const ai = toIsoDate(a?.tarih || a?.createdAt);
        const bi = toIsoDate(b?.tarih || b?.createdAt);
        if (ai && bi) return bi.localeCompare(ai);
        return 0;
      });
  }, [allDocs, activeTab, searchText, sortDir, selectedUserId]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const paged = filtered.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);

  const openPreview = (doc) => {
    setPreviewDoc(doc);
    setPreviewOpen(true);
  };

  const closePreview = () => {
    setPreviewOpen(false);
    setPreviewDoc(null);
  };

  const handleIndir = async (doc) => {
  const docId = getId(doc);
  if (!docId) {
    openInfo("Hata", "Belge ID bulunamadı.");
    return;
  }

  const token = localStorage.getItem("token") || sessionStorage.getItem("token");
  if (!token) {
    openInfo("Hata", "Token bulunamadı.");
    return;
  }

  const tur = inferBelgeTuru(doc);
  const tarihStr = toDisplayDate(doc?.tarih || doc?.createdAt) || "";
  const firmaAdi = getFirmName(doc) || "Firma";
  const downloadName = buildDownloadFileName({ firmaAdi, tur, tarihStr });

  try {
    const res = await fetch(`${API_BASE}/api/documents/${docId}/download`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error("PDF indirilemedi");

    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.style.display = "none";
    a.href = blobUrl;
    a.download = downloadName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 3000);
  } catch (e) {
    console.error("Admin indirme hatası:", e);
    openInfo("Hata", "Belge indirilemedi.");
  }
};

  const patchDoc = async (docId, payload) => {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    if (!token) return false;
    try {
      await axios.patch(`${API_BASE}/api/documents/${docId}`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return true;
    } catch (e) {
      console.error("Belge güncellenemedi:", e);
      openInfo("Bilgilendirme", "İşlem başarısız.");
      return false;
    }
  };

  const deleteDoc = async (docId) => {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    if (!token) return false;
    try {
      await axios.delete(`${API_BASE}/api/documents/${docId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return true;
    } catch (e) {
      console.error("Belge silinemedi:", e);
      openInfo("Bilgilendirme", "Silme işlemi başarısız.");
      return false;
    }
  };

  const handleArsivle = (doc) => {
    if (getStatus(doc) === "Arşivde") return;
    const id = getId(doc);
    if (!id) return;

    openConfirm({
      title: "Uyarı",
      message:
        "Bu belge arşive alınacak ve kilitlenecek. Arşivlenen belge üzerinde değişiklik yapılamaz. Devam edilsin mi?",
      confirmText: "Arşivle",
      cancelText: "İptal",
      variant: "warning",
      onConfirm: async () => {
        const ok = await patchDoc(id, { durum: "Arşivde" });
        if (!ok) return;
        setAllDocs((prev) =>
          prev.map((d) => (getId(d) === id ? { ...d, durum: "Arşivde" } : d))
        );
      },
    });
  };

  const handleGeriAl = (doc) => {
    if (getStatus(doc) !== "Arşivde") return;
    const id = getId(doc);
    if (!id) return;

    openConfirm({
      title: "Uyarı",
      message:
        "Bu belge arşivden geri alınacak. Geri alındıktan sonra silme işlemi yapılabilir. Devam edilsin mi?",
      confirmText: "Geri Al",
      cancelText: "İptal",
      variant: "warning",
      onConfirm: async () => {
        const ok = await patchDoc(id, { durum: "Hazır" });
        if (!ok) return;
        setAllDocs((prev) =>
          prev.map((d) => (getId(d) === id ? { ...d, durum: "Hazır" } : d))
        );
      },
    });
  };

  const handleSil = (doc) => {
    if (getStatus(doc) === "Arşivde") return; // önce geri al
    const id = getId(doc);
    if (!id) return;

    const firmaAdi = getFirmName(doc) || "Firma";
    const tur = inferBelgeTuru(doc);

    openConfirm({
      title: "Uyarı",
      message: `${firmaAdi} · ${tur} belgesini silmek istiyor musunuz?`,
      confirmText: "Sil",
      cancelText: "İptal",
      variant: "danger",
      onConfirm: async () => {
        const ok = await deleteDoc(id);
        if (!ok) return;
        setAllDocs((prev) => prev.filter((d) => getId(d) !== id));

// BURAYA YAPIŞTIR
try { localStorage.setItem("isgpanel:docs_refresh", String(Date.now())); } catch {}
try { window.dispatchEvent(new Event("ticari_docs_refresh")); } catch {}

openInfo("Bilgilendirme", "Belge silindi ✅");
      },
    });
  };

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-[#042f4b] mb-2">Belgeler (Admin)</h1>

      {/* Sekmeler */}
      <div className="flex gap-6 border-b mb-4 text-sm overflow-x-auto whitespace-nowrap pb-1">
        {Object.keys(TAB_LABELS).map((tab) => (
          <button
            key={tab}
            type="button"
            className={`pb-2 ${
              activeTab === tab
                ? "border-b-2 border-[#042f4b] font-semibold text-[#042f4b]"
                : "text-gray-500 hover:text-[#042f4b]"
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Kontrol barı */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="relative w-full max-w-[420px]">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path
                d="M10.5 18.5C14.9183 18.5 18.5 14.9183 18.5 10.5C18.5 6.08172 14.9183 2.5 10.5 2.5C6.08172 2.5 2.5 6.08172 2.5 10.5C2.5 14.9183 6.08172 18.5 10.5 18.5Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M21.5 21.5L17.2 17.2"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>

          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Firma / SGK / Hazırlayan ara..."
            className="w-full pl-8 pr-3 py-1.5 rounded-xl border bg-white text-sm outline-none focus:ring-2 focus:ring-[#042f4b]/20"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSortDir((p) => (p === "asc" ? "desc" : "asc"))}
            className="px-2.5 py-1.5 rounded-xl border bg-white text-sm hover:bg-gray-50"
            title="Sırala"
          >
            <span className="font-semibold">{sortDir === "asc" ? "A→Z" : "Z→A"}</span>
          </button>

          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="hidden sm:block">Göster:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="px-2.5 py-1.5 rounded-xl border bg-white text-sm outline-none"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
      </div>

      <CardBox className="p-0 overflow-hidden">
        <div className="p-4 border-b">
          <SectionTitle title={TAB_LABELS[activeTab]} subtitle={loading ? "Yükleniyor..." : `${total} belge`} />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left font-semibold px-4 py-3">Firma</th>
                <th className="text-left font-semibold px-4 py-3">Belge</th>
                <th className="text-left font-semibold px-4 py-3">Tarih</th>
                <th className="text-left font-semibold px-4 py-3">Hazırlayan</th>
                <th className="text-left font-semibold px-4 py-3">Durum</th>
                <th className="text-right font-semibold px-4 py-3">İşlemler</th>
              </tr>
            </thead>

            <tbody>
              {paged.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-gray-500" colSpan={6}>
                    {loading ? "Yükleniyor..." : "Kayıt bulunamadı."}
                  </td>
                </tr>
              ) : (
                paged.map((d) => {
                  const id = getId(d);
                  const firma = getFirmName(d);
                  const sgk = getFirmSgk(d);
                  const tur = inferBelgeTuru(d);
                  const tarih = toDisplayDate(d?.tarih || d?.createdAt);
                  const durum = getStatus(d);
                  const hazirlayan = getPreparedBy(d);

                  return (
                    <tr key={id || `${firma}-${tur}-${tarih}`} className="border-t">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{firma || "-"}</div>
                        {sgk ? <div className="text-xs text-gray-500">SGK: {sgk}</div> : null}
                      </td>

                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs">
                          {tur}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-gray-700">{tarih || "-"}</td>

                      <td className="px-4 py-3 text-gray-700">{hazirlayan || "-"}</td>

                      <td className="px-4 py-3">
                        {durum ? (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${
                              durum === "Arşivde"
                                ? "bg-indigo-100 text-indigo-700"
                                : "bg-emerald-100 text-emerald-700"
                            }`}
                          >
                            {durum}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openPreview(d)}
                            className="px-3 py-1.5 text-xs rounded-lg border hover:bg-gray-50"
                          >
                            Önizle
                          </button>

                          <button
                            type="button"
                            onClick={() => handleIndir(d)}
                            className="px-3 py-1.5 text-xs rounded-lg border hover:bg-gray-50"
                          >
                            İndir
                          </button>

                          {durum === "Arşivde" ? (
                            <button
                              type="button"
                              onClick={() => handleGeriAl(d)}
                              className="px-3 py-1.5 text-xs rounded-lg border hover:bg-gray-50"
                            >
                              Geri Al
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleArsivle(d)}
                              className="px-3 py-1.5 text-xs rounded-lg border hover:bg-gray-50"
                            >
                              Arşivle
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleSil(d)}
                            disabled={durum === "Arşivde"}
                            className={`px-3 py-1.5 text-xs rounded-lg border ${
                              durum === "Arşivde"
                                ? "opacity-40 cursor-not-allowed"
                                : "hover:bg-red-50 hover:border-red-200 hover:text-red-700"
                            }`}
                          >
                            Sil
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Sayfalama */}
        {totalPages > 1 ? (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-white text-sm">
            <div className="text-gray-600">Sayfa {pageSafe} / {totalPages}</div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pageSafe <= 1}
                className={`px-3 py-1.5 rounded-lg border ${
                  pageSafe <= 1 ? "opacity-40 cursor-not-allowed" : "hover:bg-gray-50"
                }`}
              >
                Önceki
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={pageSafe >= totalPages}
                className={`px-3 py-1.5 rounded-lg border ${
                  pageSafe >= totalPages ? "opacity-40 cursor-not-allowed" : "hover:bg-gray-50"
                }`}
              >
                Sonraki
              </button>
            </div>
          </div>
        ) : null}
      </CardBox>

      <PreviewModal open={previewOpen} doc={previewDoc} onClose={closePreview} />

      <ConfirmModal
        open={confirmOpen}
        title={confirmData.title}
        message={confirmData.message}
        variant={confirmData.variant}
        confirmText={confirmData.confirmText}
        cancelText={confirmData.cancelText}
        onConfirm={confirmData.onConfirm}
        onCancel={confirmData.onCancel}
      />
    </div>
  );
}
