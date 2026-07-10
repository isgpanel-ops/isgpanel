import React, { useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { FirmaContext } from "../../context/FirmaContext";
import { CardBox, SectionTitle } from "../../components/ui";
import ConfirmModal from "../../components/ui/ConfirmModal";

/* ---------------- helpers ---------------- */
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
    if (Number.isNaN(dt.getTime())) return String(value);
    return `${pad2(dt.getDate())}.${pad2(dt.getMonth() + 1)}.${dt.getFullYear()}`;
  } catch {
    return String(value);
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
    if (Number.isNaN(dt.getTime())) return "";
    return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
  } catch {
    return "";
  }
};

const getPreparedBy = (doc) =>
  doc?.hazirlayan ||
  doc?.hazirlayanAdSoyad ||
  doc?.olusturan ||
  doc?.preparedBy ||
  doc?.createdBy ||
  doc?.createdByName ||
  doc?.createdByUserName ||
  doc?.createdByUser?.name ||
  doc?.userName ||
  "";

const inferBelgeTuru = (doc) => {
  const raw = doc?.belgeTuru || doc?.tur || doc?.type || doc?.kategori || doc?.category || "";
  if (raw) return raw;

  const title = (doc?.baslik || doc?.title || "").toLowerCase();
  if (title.includes("prosed")) return "Risk Değerlendirme Prosedürü";
  if (title.includes("ekip")) return "Risk Değerlendirme Ekibi";
  if (title.includes("döf") || title.includes("dof")) return "DÖF";
  return "Risk Değerlendirmesi";
};

const TYPE_BADGE_CLASS = (type) => {
  switch (type) {
    case "Risk Değerlendirme Prosedürü":
      return "bg-gray-100 text-gray-700";
    case "Risk Değerlendirmesi":
      return "bg-blue-100 text-blue-700";
    case "Risk Değerlendirme Ekibi":
      return "bg-purple-100 text-purple-700";
    case "DÖF":
      return "bg-orange-100 text-orange-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
};

const STATUS_BADGE_CLASS = (durum) => {
  switch (durum) {
    case "Arşivde":
      return "bg-indigo-100 text-indigo-700";
    case "Hazır":
      return "bg-emerald-100 text-emerald-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
};

const sanitizeFileName = (input) => {
  const s = String(input ?? "").trim();
  if (!s) return "belge";
  const trMap = {
    ç: "c",
    Ç: "C",
    ğ: "g",
    Ğ: "G",
    ı: "i",
    I: "I",
    İ: "I",
    ö: "o",
    Ö: "O",
    ş: "s",
    Ş: "S",
    ü: "u",
    Ü: "U",
  };

  let out = s.replace(/[çÇğĞıİöÖşŞüÜ]/g, (m) => trMap[m] || m);

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

const toAbsoluteFileUrl = (input, apiBase) => {
  const raw = String(input || "").trim();
  if (!raw) return "";

  if (
    raw.startsWith("http://") ||
    raw.startsWith("https://") ||
    raw.startsWith("blob:") ||
    raw.startsWith("data:")
  ) {
    return raw;
  }

  if (raw.startsWith("/uploads")) {
    return `https://api.isgpanel.tr${raw}`;
  }

  return `${apiBase}${raw.startsWith("/") ? "" : "/"}${raw}`;
};

function getAuthToken() {
  try {
    const u = JSON.parse(localStorage.getItem("user") || "null");
    const direct = u?.token || u?.accessToken || u?.jwt || u?.authToken;
    if (direct) return direct;

    const email = u?.email || u?.mail || localStorage.getItem("userEmail");
    if (email) {
      const key = `isgpanel:${email}:token`;
      const t = localStorage.getItem(key);
      if (t) return t;
    }

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.endsWith(":token")) {
        const t = localStorage.getItem(k);
        if (t) return t;
      }
    }
  } catch {}
  return null;
}

/* ---------------- Preview ---------------- */
function PreviewModal({ open, doc, onClose, apiBase }) {
  const [blobUrl, setBlobUrl] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    if (!open || !doc) return;

    let alive = true;
    let tempUrl = "";

    const loadPreview = async () => {
      const docId = doc.id || doc._id;
      const token = getAuthToken();

      if (!docId || !token) return;

      try {
        setLoadingPreview(true);

        const res = await axios.get(`${apiBase}/api/documents/${docId}/download`, {
          responseType: "blob",
          headers: { Authorization: `Bearer ${token}` },
        });

        const pdfBlob = new Blob([res.data], { type: "application/pdf" });
        tempUrl = URL.createObjectURL(pdfBlob);

        if (alive) {
          setBlobUrl(tempUrl);
        }
      } catch (e) {
        console.error("PDF önizleme yüklenemedi:", e);
        if (alive) setBlobUrl("");
      } finally {
        if (alive) setLoadingPreview(false);
      }
    };

    loadPreview();

    return () => {
      alive = false;
      if (tempUrl) URL.revokeObjectURL(tempUrl);
      setBlobUrl("");
    };
  }, [open, doc, apiBase]);

  if (!open || !doc) return null;

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
              {doc.firmaAdi || ""} {doc.firmaAdi ? "· " : ""}
              {inferBelgeTuru(doc)}
            </div>

            <div className="text-xs text-gray-500">
              {toDisplayDate(doc.tarih || doc.createdAt)}
              {getPreparedBy(doc) ? ` · Hazırlayan: ${getPreparedBy(doc)}` : ""}
              {doc.durum ? ` · ${doc.durum}` : ""}
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
          {loadingPreview && (
            <div className="h-full flex items-center justify-center text-sm text-gray-500">
              PDF yükleniyor...
            </div>
          )}

          {!loadingPreview && blobUrl && (
            <iframe title="PDF Önizleme" src={blobUrl} className="w-full h-full" />
          )}

          {!loadingPreview && !blobUrl && (
            <div className="h-full flex items-center justify-center text-sm text-gray-500">
              Bu belge için kayıtlı PDF bulunamadı.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Component ---------------- */
export default function TicariRiskBelgeleri({ searchText = "", sortDir = "asc", pageSize = 10 }) {
  const { selectedFirm } = useContext(FirmaContext);
  const API_BASE =
  (import.meta.env.VITE_API_URL || "https://api.isgpanel.tr/api")
    .trim()
    .replace(/\/$/, "");
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState(""); // tablo içi arama (hazırlayan/tür/tarih vs.)
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);

  // pagination
  const [page, setPage] = useState(1);

  // confirm/info
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

 function getRoleFromStorage() {
  try {
    const u = JSON.parse(localStorage.getItem("user") || "null");
    return String(u?.role || "").toLowerCase().trim();
  } catch {
    return "";
  }
}

const statusToDurum = (status) => {
  if (status === "arsiv") return "Arşivde";
  if (status === "hazir") return "Hazır";
  return "";
};

const fetchDocs = async () => {
  const token = getAuthToken();
  if (!token) return;

  try {
    setLoading(true);

    const role = getRoleFromStorage();
    const isAdmin = role === "ticari_admin";

    const url = isAdmin
      ? `${API_BASE}/api/documents`
      : `${API_BASE}/api/documents/assigned`;

    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
      params: { category: "risk" },
    });

    const list = Array.isArray(res.data) ? res.data : res.data?.items || [];

    const normalized = list.map((d) => ({
      ...d,
      durum: d.durum || statusToDurum(d.status),
    }));

    setDocs(normalized);
    setPage(1);
  } catch (e) {
    console.error("Ticari risk belgeleri çekilemedi:", e);
  } finally {
    setLoading(false);
  }
};

useEffect(() => {
  fetchDocs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [API_BASE, selectedFirm?.id]);

useEffect(() => {
  const onRefresh = () => fetchDocs();
  window.addEventListener("ticari_docs_refresh", onRefresh);
  return () => window.removeEventListener("ticari_docs_refresh", onRefresh);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [API_BASE, selectedFirm?.id]);
useEffect(() => {
  const onStorage = (e) => {
    if (e.key === "isgpanel:docs_refresh") fetchDocs();
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [API_BASE, selectedFirm?.id]);


  const openPreview = (doc) => {
    setPreviewDoc(doc);
    setPreviewOpen(true);
  };

  const closePreview = () => {
    setPreviewOpen(false);
    setPreviewDoc(null);
  };

const handleIndir = async (doc) => {
  const docId = doc.id || doc._id;
  if (!docId) {
    openInfo("Hata", "Belge ID bulunamadı.");
    return;
  }

  const token = getAuthToken();
  if (!token) {
    openInfo("Hata", "Token bulunamadı.");
    return;
  }

  const tur = inferBelgeTuru(doc);
  const tarihStr = toDisplayDate(doc.tarih || doc.createdAt) || "";
  const firmaAdi = doc.firmaAdi || selectedFirm?.firmaAdi || "Firma";
  const downloadName = buildDownloadFileName({ firmaAdi, tur, tarihStr });

  try {
    const res = await axios.get(`${API_BASE}/api/documents/${docId}/download`, {
      responseType: "blob",
      headers: { Authorization: `Bearer ${token}` },
    });

    const pdfBlob = new Blob([res.data], { type: "application/pdf" });

    if (window.navigator && window.navigator.msSaveOrOpenBlob) {
      window.navigator.msSaveOrOpenBlob(pdfBlob, downloadName);
      return;
    }

    const blobUrl = window.URL.createObjectURL(pdfBlob);
    const link = document.createElement("a");
    link.style.display = "none";
    link.href = blobUrl;
    link.download = downloadName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      window.URL.revokeObjectURL(blobUrl);
    }, 3000);
  } catch (e) {
    console.error("Ticari admin indirme hatası:", e);
    openInfo("Hata", "Belge indirilemedi.");
  }
};

  const patchDurum = async (doc, nextDurum) => {
    const token = getAuthToken();
    if (!token) return;

    try {
      // Not: endpoint sende farklıysa burayı değiştirirsin.
      const status = nextDurum === "Arşivde" ? "arsiv" : "hazir";

await axios.patch(
  `${API_BASE}/api/documents/${doc.id || doc._id}/status`,
  { status },
  { headers: { Authorization: `Bearer ${token}` } }
);

      setDocs((prev) =>
        prev.map((d) => ((d.id || d._id) === (doc.id || doc._id) ? { ...d, durum: nextDurum } : d))
      );
    } catch (e) {
      console.error("Arşiv durumu güncellenemedi:", e);
      openInfo("Hata", "Arşiv durumu güncellenemedi.");
    }
  };

  const handleArsivle = (doc) => {
    if (doc.durum === "Arşivde") return;

    openConfirm({
      title: "Uyarı",
      message:
        "Bu belge arşive alınacak ve kilitlenecek. Arşivlenen belge üzerinde değişiklik yapılamaz. Devam edilsin mi?",
      confirmText: "Arşivle",
      cancelText: "İptal",
      variant: "warning",
      onConfirm: () => patchDurum(doc, "Arşivde"),
    });
  };

  const handleGeriAl = (doc) => {
    if (doc.durum !== "Arşivde") return;

    openConfirm({
      title: "Uyarı",
      message: "Bu belge arşivden geri alınacak. Devam edilsin mi?",
      confirmText: "Geri Al",
      cancelText: "İptal",
      variant: "warning",
      onConfirm: () => patchDurum(doc, "Hazır"),
    });
  };

  // ✅ üst arama (Firma/SGK) + A-Z sıralama
  const firmFiltered = useMemo(() => {
    const q = (searchText || "").trim().toLowerCase();
    let list = docs;

    if (q) {
      list = list.filter((d) => {
        const hay = `${d.firmaAdi || ""} ${d.sgkSicilNo || d.sgk || ""}`.toLowerCase();
        return hay.includes(q);
      });
    }

    list = [...list].sort((a, b) => {
      const aa = (a.firmaAdi || "").toLocaleLowerCase("tr-TR");
      const bb = (b.firmaAdi || "").toLocaleLowerCase("tr-TR");
      return sortDir === "desc" ? bb.localeCompare(aa, "tr") : aa.localeCompare(bb, "tr");
    });

    return list;
  }, [docs, searchText, sortDir]);

  // ✅ tablo içi filtre (tür/tarih/hazırlayan)
  const filteredDocs = useMemo(() => {
    const q = (search || "").trim().toLowerCase();
    if (!q) return firmFiltered;

    return firmFiltered.filter((d) => {
      const t = inferBelgeTuru(d);
      const hay = `${d.firmaAdi || ""} ${t} ${toDisplayDate(d.tarih || d.createdAt)} ${getPreparedBy(
        d
      )}`.toLowerCase();
      return hay.includes(q);
    });
  }, [firmFiltered, search]);

  const total = filteredDocs.length;
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredDocs.slice(start, start + pageSize);
  }, [filteredDocs, safePage, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [searchText, sortDir, pageSize, search]);

 // selectedFirm yoksa da assigned liste görünsün
// (firma seçimi sadece filtreleme için kullanılsın)

  return (
    <CardBox className="flex flex-col gap-4">
      <SectionTitle
  title="Risk Değerlendirme Belgeleri"
  subtitle={
    selectedFirm?.firmaAdi
      ? `${selectedFirm.firmaAdi} firmasına ait belgeler burada listelenir.`
      : "Atandığınız firmalara ait belgeler burada listelenir."
  }
/>

      {/* tablo içi arama */}
      <div className="flex flex-wrap gap-2">
        <input
          className="flex-1 min-w-[220px] px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#042f4b]/20"
          placeholder="Ara (tür / tarih / hazırlayan)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="border border-gray-100 rounded-xl overflow-hidden">
        <div className="max-h-[60vh] overflow-y-auto">
          <table className="min-w-full text-[12px]">
            <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2 text-left">Firma</th>
                <th className="px-3 py-2 text-left w-[260px]">Tür</th>
                <th className="px-3 py-2 text-left w-[130px]">Tarih</th>
                <th className="px-3 py-2 text-left w-[180px]">Hazırlayan</th>
                <th className="px-3 py-2 text-right w-[260px]">İşlemler</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-gray-400">
                    Yükleniyor...
                  </td>
                </tr>
              )}

              {!loading && filteredDocs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-gray-400">
                    Kayıtlı risk belgesi bulunamadı.
                  </td>
                </tr>
              )}

              {!loading &&
                pageItems.map((doc) => {
                  const type = inferBelgeTuru(doc);
                  const isArchived = doc.durum === "Arşivde";
                  const dateText = toDisplayDate(doc.tarih || doc.createdAt);
                  const preparedBy = getPreparedBy(doc);

                  return (
                    <tr key={doc.id || doc._id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-900 font-medium truncate max-w-[280px]">
                        {doc.firmaAdi || selectedFirm?.firmaAdi || "-"}
                      </td>

                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={
                              "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold " +
                              TYPE_BADGE_CLASS(type)
                            }
                          >
                            {type}
                          </span>

                          {doc.durum ? (
                            <span
                              className={
                                "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold " +
                                STATUS_BADGE_CLASS(doc.durum)
                              }
                            >
                              {doc.durum}
                            </span>
                          ) : null}
                        </div>
                      </td>

                      <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{dateText || "-"}</td>

                      <td className="px-3 py-2 text-gray-700 truncate max-w-[200px]">
                        {preparedBy || "-"}
                      </td>

                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openPreview(doc)}
                            className="px-3 py-1 rounded-lg border text-[11px] text-gray-700 hover:bg-gray-100"
                          >
                            Önizle
                          </button>

                          <button
                            type="button"
                            onClick={() => handleIndir(doc)}
                            className="px-3 py-1 rounded-lg border text-[11px] text-gray-700 hover:bg-gray-100"
                          >
                            İndir
                          </button>

                          {!isArchived && (
                            <button
                              type="button"
                              onClick={() => handleArsivle(doc)}
                              className="px-3 py-1 rounded-lg border text-[11px] text-gray-700 hover:bg-gray-100"
                              title="Arşivle"
                            >
                              Arşivle
                            </button>
                          )}

                          {isArchived && (
                            <button
                              type="button"
                              onClick={() => handleGeriAl(doc)}
                              className="px-3 py-1 rounded-lg border text-[11px] text-indigo-700 hover:bg-indigo-50"
                              title="Geri Al"
                            >
                              Geri Al
                            </button>
                          )}

                          {/* ❌ Sil butonu YOK */}
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* pagination */}
        <div className="flex items-center justify-between px-3 py-2 border-t bg-white text-[12px]">
          <div className="text-gray-600">
            {total === 0 ? "0" : (safePage - 1) * pageSize + 1}-
            {Math.min(safePage * pageSize, total)} / {total}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-2.5 py-1.5 rounded-lg border text-[11px] disabled:opacity-40"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
            >
              Önceki
            </button>
            <div className="text-gray-600">
              {safePage} / {totalPages}
            </div>
            <button
              type="button"
              className="px-2.5 py-1.5 rounded-lg border text-[11px] disabled:opacity-40"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
            >
              Sonraki
            </button>
          </div>
        </div>
      </div>

      <PreviewModal open={previewOpen} doc={previewDoc} onClose={closePreview} apiBase={API_BASE} />

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
    </CardBox>
  );
}
