import React, { useContext, useEffect, useMemo, useState } from "react";
import { FirmaContext } from "../../context/FirmaContext";
import { CardBox, SectionTitle } from "../../components/ui";
import ConfirmModal from "../../components/ui/ConfirmModal";

const API_BASE =
  (import.meta.env.VITE_API_URL || "").trim().replace(/\/$/, "") ||
  "https://api.isgpanel.tr/api";

function getAuthToken() {
  return (
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    localStorage.getItem("authToken") ||
    ""
  );
}

function getRoleFromStorage() {
  try {
    const activeEmail = localStorage.getItem("__isg_active_email_global");
    const u1 = activeEmail
      ? localStorage.getItem(`isgpanel:${activeEmail}:user`)
      : null;
    const u2 = localStorage.getItem("user") || sessionStorage.getItem("user");
    const u = JSON.parse(u1 || u2 || "null");
    return String(u?.role || "").toLowerCase().trim();
  } catch {
    return "";
  }
}

const isAdminRole = (r) =>
  r === "ticari_admin" ||
  r === "admin" ||
  r === "super_admin" ||
  r === "superadmin";

const isTicariRole = (r) => String(r || "").startsWith("ticari");

const pad2 = (n) => String(n).padStart(2, "0");

function toDisplayDate(value) {
  if (!value) return "-";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
  } catch {
    return String(value);
  }
}

function getDocId(doc) {
  return doc?._id || doc?.id || doc?.documentId || "";
}

function getFirmId(doc) {
  return String(
    doc?.firmaId?._id ||
      doc?.firmaId?.id ||
      doc?.firma?._id ||
      doc?.firma?.id ||
      doc?.firmaId ||
      doc?.firma ||
      ""
  ).trim();
}

function getDocYear(doc) {
  return doc?.year || doc?.yil || "";
}

function getPreparedBy(doc) {
  return doc?.hazirlayan || doc?.createdBy || doc?.olusturan || "-";
}


  function getTypeLabel(doc) {
  const sub = String(doc?.subCategory || "").toLowerCase();

  if (sub.includes("kaldirma")) return "Kaldırma Araçları";
  if (sub.includes("basincli")) return "Basınçlı Kaplar";
  if (sub.includes("makine")) return "Makine Tezgah";
  if (sub.includes("elektrik")) return "Elektrik Tesisatı";
  if (sub.includes("hijyen")) return "İş Hijyen Ölçümleri";

  return doc?.belgeTuru || "Periyodik & İş Hijyeni";
}

function getFileUrl(doc) {
  return doc?.absoluteUrl || doc?.fileUrl || doc?.url || "";
}

function normalizeFileUrl(url) {
  const s = String(url || "").trim();
  if (!s) return "";
  if (s.startsWith("blob:")) return s;
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("/uploads")) return `https://api.isgpanel.tr${s}`;
  if (s.startsWith("/")) return `${API_BASE}${s}`;
  return `${API_BASE}/${s}`;
}

function getDownloadUrl(doc) {
  const direct = normalizeFileUrl(getFileUrl(doc));
  if (direct) return direct;

  const id = getDocId(doc);
  if (id) return `${API_BASE}/documents/${id}/download`;

  return "";
}

async function fetchDocumentBlob(doc) {
  const url = getDownloadUrl(doc);
  const token = getAuthToken();

  if (!url) {
    throw new Error("Dosya URL bulunamadı.");
  }

  const res = await fetch(url, {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    throw new Error("Dosya alınamadı.");
  }

  const blob = await res.blob();

  if (!blob || blob.size === 0) {
    throw new Error("Boş dosya.");
  }

  return blob;
}

function badgeClass(label) {
  const l = String(label || "").toLowerCase();

  if (l.includes("kaldırma") || l.includes("kaldirma"))
    return "bg-blue-100 text-blue-700";
  if (l.includes("basınç") || l.includes("basinc"))
    return "bg-orange-100 text-orange-700";
  if (l.includes("makine"))
    return "bg-violet-100 text-violet-700";
  if (l.includes("elektrik"))
    return "bg-indigo-100 text-indigo-700";
  if (l.includes("hijyen"))
    return "bg-emerald-100 text-emerald-700";

  return "bg-gray-100 text-gray-700";
}

function statusBadgeClass(durum) {
  switch (durum) {
    case "Arşivde":
      return "bg-indigo-100 text-indigo-700";

    case "Hazır":
      return "bg-emerald-100 text-emerald-700";

    default:
      return "bg-gray-100 text-gray-700";
  }
}

function buildDownloadName(doc) {
  return `${doc?.title || getTypeLabel(doc) || "Belge"}.pdf`
    .replace(/[\\/:*?"<>|]/g, "")
    .trim();
}

function PreviewModal({ open, url, title, onClose }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-4xl rounded-2xl bg-white shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <div className="text-sm font-semibold truncate">{title}</div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded-lg border hover:bg-gray-50"
          >
            Kapat
          </button>
        </div>

        <div className="h-[70vh] bg-gray-50">
          {url ? (
            <iframe title="PDF Önizleme" src={url} className="w-full h-full" />
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-gray-500">
              Bu belge için dosya bulunamadı.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DefterKurulBelgeleri() {
  const { selectedFirm } = useContext(FirmaContext);

  const [docs, setDocs] = useState([]);
  const [search, setSearch] = useState("");
  const [yilFilter, setYilFilter] = useState("Tüm");
  const [turFilter, setTurFilter] = useState("Tüm");

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewTitle, setPreviewTitle] = useState("");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmData, setConfirmData] = useState({
    title: "",
    message: "",
    variant: "info",
    confirmText: "Tamam",
    cancelText: null,
    onConfirm: null,
  });

  const openInfo = (title, message) => {
    setConfirmData({
      title,
      message,
      variant: "info",
      confirmText: "Tamam",
      cancelText: null,
      onConfirm: () => setConfirmOpen(false),
    });
    setConfirmOpen(true);
  };

  const openConfirm = ({ title, message, onConfirm }) => {
    setConfirmData({
      title,
      message,
      variant: "danger",
      confirmText: "Sil",
      cancelText: "İptal",
      onConfirm: () => {
        setConfirmOpen(false);
        onConfirm?.();
      },
    });
    setConfirmOpen(true);
  };

  async function fetchDocs() {
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE}/documents`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) throw new Error("Belgeler alınamadı.");

      const data = await res.json();

      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.documents)
        ? data.documents
        : Array.isArray(data?.data)
        ? data.data
        : [];

     setDocs(
  list.filter(
    (d) =>
      String(d?.category || "").toLowerCase() === "periyodik-is-hijyeni"
  )
);
    } catch (e) {
      console.error("Defter & Kurul belgeleri alınamadı:", e);
      setDocs([]);
    }
  }

  useEffect(() => {
    fetchDocs();

    const h = () => fetchDocs();
    window.addEventListener("docs:lastChangeAt", h);
    window.addEventListener("ticari_docs_refresh", h);

    return () => {
      window.removeEventListener("docs:lastChangeAt", h);
      window.removeEventListener("ticari_docs_refresh", h);
    };
  }, [selectedFirm?.id, selectedFirm?._id]);

  const uniqueYears = useMemo(() => {
    const years = Array.from(new Set(docs.map(getDocYear).filter(Boolean)));
    return years.sort((a, b) => Number(b) - Number(a));
  }, [docs]);

  const uniqueTypes = useMemo(() => {
    return Array.from(new Set(docs.map(getTypeLabel).filter(Boolean)));
  }, [docs]);

  const filteredDocs = useMemo(() => {
    const activeFirmId = String(selectedFirm?.id || selectedFirm?._id || "").trim();

    return docs
      .filter((d) => {
        if (activeFirmId && getFirmId(d) !== activeFirmId) return false;
        if (yilFilter !== "Tüm" && String(getDocYear(d)) !== String(yilFilter))
          return false;
        if (turFilter !== "Tüm" && getTypeLabel(d) !== turFilter) return false;

        if (search.trim()) {
          const q = search.toLowerCase();
          const hay = `${d?.title || ""} ${getTypeLabel(d)} ${getPreparedBy(
            d
          )} ${d?.firmaAdi || ""}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }

        return true;
      })
      .sort(
        (a, b) =>
          new Date(b?.createdAt || b?.dateISO || 0) -
          new Date(a?.createdAt || a?.dateISO || 0)
      );
  }, [docs, selectedFirm, yilFilter, turFilter, search]);

 async function handleIndir(doc) {
  try {
    const blob = await fetchDocumentBlob(doc);
    const blobUrl = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = buildDownloadName(doc);

    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(blobUrl), 3000);
  } catch (e) {
    console.error("İndirme hatası:", e);
    openInfo("Hata", "Belge indirilemedi.");
  }
}

 async function handlePreview(doc) {
  try {
    const blob = await fetchDocumentBlob(doc);
    const blobUrl = URL.createObjectURL(blob);

    setPreviewUrl(blobUrl);
    setPreviewTitle(doc?.title || getTypeLabel(doc));
    setPreviewOpen(true);
  } catch (e) {
    console.error("Önizleme hatası:", e);
    openInfo("Hata", "Belge önizlenemedi.");
  }
}

async function handleArsivle(doc) {
  const isArchived =
    doc?.durum === "Arşivde" ||
    doc?.status === "arsiv";

  if (isArchived) return;

  const id = getDocId(doc);

  if (!id) {
    openInfo("Hata", "Belge ID bulunamadı.");
    return;
  }

  setConfirmData({
    title: "Uyarı",
    message:
      "Bu belge arşivlenecek. Arşivlenen belge üzerinde değişiklik yapılamaz. Devam edilsin mi?",
    variant: "warning",
    confirmText: "Arşivle",
    cancelText: "İptal",

    onConfirm: async () => {
      try {
        setConfirmOpen(false);

        const token = getAuthToken();

        const res = await fetch(`${API_BASE}/documents/${id}`, {
          method: "PATCH",

          headers: {
            "Content-Type": "application/json",
            ...(token
              ? { Authorization: `Bearer ${token}` }
              : {}),
          },

          body: JSON.stringify({
            durum: "Arşivde",
          }),
        });

        const raw = await res.text().catch(() => "");

        let payload = {};

        try {
          payload = raw ? JSON.parse(raw) : {};
        } catch {}

        if (!res.ok) {
          openInfo(
            "Hata",
            payload?.message || "Belge arşivlenemedi."
          );
          return;
        }

        await fetchDocs();

        openInfo(
          "Bilgilendirme",
          "Belge arşivlendi ✅"
        );
      } catch (e) {
        console.error(e);

        openInfo(
          "Hata",
          "Belge arşivlenirken hata oluştu."
        );
      }
    },

    onCancel: () => setConfirmOpen(false),
  });

  setConfirmOpen(true);
}

async function handleGeriAl(doc) {
  const isArchived =
    doc?.durum === "Arşivde" ||
    doc?.status === "arsiv";

  if (!isArchived) return;

  const id = getDocId(doc);

  if (!id) {
    openInfo("Hata", "Belge ID bulunamadı.");
    return;
  }

  setConfirmData({
    title: "Uyarı",
    message:
      "Bu belge arşivden geri alınacak. Devam edilsin mi?",

    variant: "warning",
    confirmText: "Geri Al",
    cancelText: "İptal",

    onConfirm: async () => {
      try {
        setConfirmOpen(false);

        const token = getAuthToken();

        const res = await fetch(`${API_BASE}/documents/${id}`, {
          method: "PATCH",

          headers: {
            "Content-Type": "application/json",
            ...(token
              ? { Authorization: `Bearer ${token}` }
              : {}),
          },

          body: JSON.stringify({
            durum: "Hazır",
          }),
        });

        const raw = await res.text().catch(() => "");

        let payload = {};

        try {
          payload = raw ? JSON.parse(raw) : {};
        } catch {}

        if (!res.ok) {
          openInfo(
            "Hata",
            payload?.message || "Belge geri alınamadı."
          );
          return;
        }

        await fetchDocs();

        openInfo(
          "Bilgilendirme",
          "Belge arşivden çıkarıldı ✅"
        );
      } catch (e) {
        console.error(e);

        openInfo(
          "Hata",
          "Belge geri alınırken hata oluştu."
        );
      }
    },

    onCancel: () => setConfirmOpen(false),
  });

  setConfirmOpen(true);
}

  function handleSil(doc) {
    const role = getRoleFromStorage();
    const isTicariUser = isTicariRole(role) && !isAdminRole(role);
    if (isTicariUser) return;

    openConfirm({
      title: "Uyarı",
      message: "Bu belge silinsin mi?",
      onConfirm: async () => {
        try {
          const token = getAuthToken();
          const id = getDocId(doc);

          const res = await fetch(`${API_BASE}/documents/${id}`, {
            method: "DELETE",
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });

          if (!res.ok) throw new Error("Silme başarısız.");

          setDocs((prev) => prev.filter((d) => String(getDocId(d)) !== String(id)));

          localStorage.setItem("docs:lastChangeAt", String(Date.now()));
          window.dispatchEvent(new Event("docs:lastChangeAt"));
          window.dispatchEvent(new Event("ticari_docs_refresh"));

          openInfo("Bilgilendirme", "Belge silindi ✅");
        } catch {
          openInfo("Hata", "Belge silinemedi.");
        }
      },
    });
  }

  if (!selectedFirm) {
    return (
      <CardBox>
        <SectionTitle
          title="Defter & Kurul Belgeleri"
          subtitle="Belgeleri görmek için lütfen sağ üstten bir firma seçiniz."
        />
      </CardBox>
    );
  }

  const role = getRoleFromStorage();
  const isTicariUser = isTicariRole(role) && !isAdminRole(role);

  return (
    <CardBox className="flex flex-col gap-4">
      <SectionTitle
  title="Periyodik & İş Hijyeni Belgeleri"
  subtitle="Belgeleri görmek için lütfen sağ üstten bir firma seçiniz."
/>

      <div className="flex flex-col sm:flex-row flex-wrap gap-2">
        <input
          className="w-full sm:flex-1 min-w-[140px] px-3 py-2 border rounded-lg text-sm"
          placeholder="Ara (başlık / tür / hazırlayan)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className="w-full sm:w-auto px-3 py-2 border rounded-lg text-sm bg-white"
          value={yilFilter}
          onChange={(e) => setYilFilter(e.target.value)}
        >
          <option value="Tüm">Tüm Yıllar</option>
          {uniqueYears.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>

        <select
          className="w-full sm:w-auto px-3 py-2 border rounded-lg text-sm bg-white"
          value={turFilter}
          onChange={(e) => setTurFilter(e.target.value)}
        >
          <option value="Tüm">Tüm Türler</option>
          {uniqueTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className="border border-gray-100 rounded-xl overflow-hidden">
        <div className="block md:hidden">
          {filteredDocs.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">
              Kayıt bulunamadı.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredDocs.map((doc) => {
                const label = getTypeLabel(doc);

const isArchived =
  doc?.durum === "Arşivde" ||
  doc?.status === "arsiv";

                return (
                  <div key={getDocId(doc)} className="p-4 space-y-3">
                    <div className="text-sm font-semibold text-gray-900 break-words">
                      {doc.title || "-"}
                    </div>

                    <span
                      className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold ${badgeClass(label)}`}
                    >
                      {label}
                    </span>

                    <div className="grid grid-cols-1 gap-1 text-xs text-gray-600">
                      <div>
                        <span className="font-medium text-gray-800">Yıl:</span>{" "}
                        {getDocYear(doc) || "-"}
                      </div>
                      <div>
                        <span className="font-medium text-gray-800">Tarih:</span>{" "}
                        {doc.tarih || toDisplayDate(doc.createdAt)}
                      </div>
                      <div>
                        <span className="font-medium text-gray-800">
                          Hazırlayan:
                        </span>{" "}
                        {getPreparedBy(doc)}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handlePreview(doc)}
                        className="flex-1 min-w-[110px] px-3 py-2 rounded-lg border text-xs"
                      >
                        Önizle
                      </button>

                      <button
                        onClick={() => handleIndir(doc)}
                        className="flex-1 min-w-[110px] px-3 py-2 rounded-lg border text-xs"
                      >
                        İndir
                      </button>

                      {!isTicariUser && (
                        <button
                          onClick={() => handleSil(doc)}
                          className="flex-1 min-w-[110px] px-3 py-2 rounded-lg border text-xs text-red-600"
                        >
                          Sil
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="hidden md:block max-h-[60vh] overflow-auto">
          <table className="min-w-[760px] w-full text-[12px]">
            <thead className="bg-gray-50 text-[11px] uppercase text-gray-500 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left">Belge</th>
                <th className="px-3 py-2 text-left">Tür</th>
                <th className="px-3 py-2 text-left">Yıl</th>
                <th className="px-3 py-2 text-left">Hazırlayan</th>
                <th className="px-3 py-2 text-right">İşlemler</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-gray-400">
                    Kayıt bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredDocs.map((doc) => {
                  const label = getTypeLabel(doc);

const isArchived =
  doc?.durum === "Arşivde" ||
  doc?.status === "arsiv";

                  return (
                    <tr key={getDocId(doc)} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium truncate max-w-[260px]">
                        {doc.title || "-"}
                      </td>

                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
  <span
    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${badgeClass(label)}`}
  >
    {label}
  </span>

  {doc?.durum && (
    <span
      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${statusBadgeClass(doc.durum)}`}
    >
      {doc.durum}
    </span>
  )}
</div>
                      </td>

                      <td className="px-3 py-2">{getDocYear(doc) || "-"}</td>

                      <td className="px-3 py-2 truncate max-w-[180px]">
                        {getPreparedBy(doc)}
                      </td>

                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handlePreview(doc)}
                            className="px-3 py-1 border rounded text-[11px]"
                          >
                            Önizle
                          </button>

                          <button
                            onClick={() => handleIndir(doc)}
                            className="px-3 py-1 border rounded text-[11px]"
                          >
                            İndir
                          </button>

{!isArchived && (
  <button
    onClick={() => handleArsivle(doc)}
    className="px-3 py-1 border rounded text-[11px]"
  >
    Arşivle
  </button>
)}

{isArchived && (
  <button
    onClick={() => handleGeriAl(doc)}
    className="px-3 py-1 border rounded text-[11px] text-indigo-700"
  >
    Geri Al
  </button>
)}

                          {!isTicariUser && (
                            <button
  onClick={() => handleSil(doc)}
  disabled={isArchived}
  className={
    "px-3 py-1 border rounded text-[11px] " +
    (isArchived
      ? "text-gray-300 bg-gray-50 cursor-not-allowed"
      : "text-red-600")
  }
>
  Sil
</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PreviewModal
        open={previewOpen}
        url={previewUrl}
        title={previewTitle}
        onClose={() => {
          setPreviewOpen(false);
          setPreviewUrl("");
          setPreviewTitle("");
        }}
      />

      <ConfirmModal
        open={confirmOpen}
        title={confirmData.title}
        message={confirmData.message}
        variant={confirmData.variant}
        confirmText={confirmData.confirmText}
        cancelText={confirmData.cancelText}
        onConfirm={confirmData.onConfirm}
        onCancel={() => setConfirmOpen(false)}
      />
    </CardBox>
  );
}