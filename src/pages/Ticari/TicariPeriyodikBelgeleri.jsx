import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";
import ConfirmModal from "@/components/ui/ConfirmModal";

const API_ROOT = (() => {
  const raw =
    (import.meta?.env?.VITE_API_URL && import.meta.env.VITE_API_URL.trim()) ||
    "https://api.isgpanel.tr/api";
  return raw.replace(/\/$/, "").replace(/\/api$/, "");
})();

const DOC_SCOPE = "ticari";
const CATEGORY = "periyodik-is-hijyeni";
const LS_ADMIN_USER_KEY = "isgpanel:adminSelectedUser";

const BELGE_TURLERI = [
  "Kaldırma Araçları",
  "Basınçlı Kaplar",
  "Makine Tezgah",
  "Elektrik Tesisatı",
  "İş Hijyen Ölçümleri",
];

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
    if (Number.isNaN(dt.getTime())) return "";
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
    if (Number.isNaN(dt.getTime())) return "";
    return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
  } catch {
    return "";
  }
};

const getDocYear = (doc) => {
  if (doc?.yil) return Number(doc.yil);
  if (doc?.year) return Number(doc.year);
  const iso = toIsoDate(doc?.tarih || doc?.createdAt);
  if (!iso) return undefined;
  return Number(iso.slice(0, 4));
};

const getPreparedBy = (doc) =>
  doc?.hazirlayan ||
  doc?.hazirlayanAdSoyad ||
  doc?.olusturan ||
  doc?.preparedBy ||
  doc?.preparedByName ||
  doc?.createdByName ||
  doc?.createdBy?.name ||
  doc?.createdBy?.fullName ||
  doc?.userName ||
  "";

const inferBelgeTuru = (doc) => {
  const raw = String(
    doc?.belgeTuru || doc?.tur || doc?.type || doc?.subCategory || ""
  ).toLowerCase();

  if (raw.includes("kaldirma") || raw.includes("kaldırma")) return "Kaldırma Araçları";
  if (raw.includes("basincli") || raw.includes("basınç")) return "Basınçlı Kaplar";
  if (raw.includes("makine")) return "Makine Tezgah";
  if (raw.includes("elektrik")) return "Elektrik Tesisatı";
  if (raw.includes("hijyen")) return "İş Hijyen Ölçümleri";

  const title = String(doc?.baslik || doc?.title || doc?.belgeAdi || "").toLowerCase();

  if (title.includes("kaldırma") || title.includes("kaldirma")) return "Kaldırma Araçları";
  if (title.includes("basınç") || title.includes("basinc")) return "Basınçlı Kaplar";
  if (title.includes("makine")) return "Makine Tezgah";
  if (title.includes("elektrik")) return "Elektrik Tesisatı";
  if (title.includes("hijyen")) return "İş Hijyen Ölçümleri";

  return doc?.belgeTuru || "Periyodik & İş Hijyeni";
};

const TYPE_BADGE_CLASS = (type) => {
  const t = String(type || "").toLowerCase();

  if (t.includes("kaldırma") || t.includes("kaldirma")) return "bg-blue-100 text-blue-700";
  if (t.includes("basınç") || t.includes("basinc")) return "bg-orange-100 text-orange-700";
  if (t.includes("makine")) return "bg-violet-100 text-violet-700";
  if (t.includes("elektrik")) return "bg-indigo-100 text-indigo-700";
  if (t.includes("hijyen")) return "bg-emerald-100 text-emerald-700";

  return "bg-gray-100 text-gray-700";
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
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.\s]+$/g, "")
    .trim();

  if (out.length > 180) out = out.slice(0, 180).trim();
  return out || "belge";
};

const buildDownloadFileName = ({ firmaAdi, tur, tarihStr }) => {
  return `${sanitizeFileName(firmaAdi || "Firma")} - ${sanitizeFileName(
    tur || "Belge"
  )} - ${sanitizeFileName(tarihStr || "tarih-yok")}.pdf`;
};

function getAuthHeader() {
  let token =
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    localStorage.getItem("authToken");

  if (!token) {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.endsWith(":token")) {
        const t = localStorage.getItem(k);
        if (t) {
          token = t;
          break;
        }
      }
    }
  }

  if (!token) return {};
  const t = String(token).trim();
  return { Authorization: /^bearer\s+/i.test(t) ? t : `Bearer ${t}` };
}

function normalizeFileUrl(url) {
  const s = String(url || "").trim();
  if (!s) return "";
  if (s.startsWith("blob:")) return s;
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("/uploads")) return `${API_ROOT}${s}`;
  if (s.startsWith("/")) return `${API_ROOT}${s}`;
  return `${API_ROOT}/${s}`;
}

const normalizeDoc = (d) => {
  const id = d?._id || d?.id || d?.documentId || "";
  const firmaId =
    d?.firmaId?._id ||
    d?.firmaId?.id ||
    d?.firma?._id ||
    d?.firma?.id ||
    d?.firmaId ||
    d?.firma ||
    "";

  const firmaAdi = d?.firmaAdi || d?.firma?.firmaAdi || d?.firma?.name || "";
  const fileUrl = normalizeFileUrl(
    d?.absoluteUrl || d?.fileUrl || d?.url || d?.pdfUrl || d?.downloadUrl || ""
  );

  return {
    id: String(id),
    firmaId: String(firmaId),
    firmaAdi,
    tarih: d?.tarih || d?.dateISO || d?.createdAt || "",
    createdAt: d?.createdAt || "",
    durum: d?.durum || d?.status || "Hazır",
    belgeTuru: d?.belgeTuru || d?.tur || d?.type || "",
    baslik:
      String(d?.baslik || d?.title || d?.belgeAdi || "")
        .replace(/^[^-–—]+[-–—]\s*/, "")
        .trim() || "Belge",
    hazirlayan: getPreparedBy(d),
    fileUrl,
    url: fileUrl,
    _raw: d,
  };
};

function PreviewModal({ open, doc, onClose }) {
  if (!open || !doc) return null;

  const fileUrl = doc.fileUrl || doc.url;
  const tur = inferBelgeTuru(doc);

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
              {tur}
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
          {fileUrl ? (
            <iframe title="PDF Önizleme" src={fileUrl} className="w-full h-full" />
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

async function fetchAssignedFirms(userId) {
  const headers = getAuthHeader();
  if (!headers.Authorization) return [];

  const res = await axios.get(`${API_ROOT}/api/firma`, { headers });
  const firms = Array.isArray(res.data) ? res.data : [];

  const filtered =
    !userId || userId === "all"
      ? firms
      : firms.filter((f) => String(f?.atanmisKullanici || "") === String(userId));

  return filtered
    .map((f) => ({
      id: String(f?._id || f?.id || ""),
      firmaAdi: f?.firmaAdi || f?.name || "",
    }))
    .filter((x) => x.id);
}

async function fetchDocsForFirmIds(firmIds, category) {
  const headers = getAuthHeader();
  if (!headers.Authorization) return [];
  if (!firmIds?.length) return [];

  const out = [];

  for (const firmId of firmIds) {
    try {
      const res = await axios.get(`${API_ROOT}/api/documents`, {
        headers,
        params: { firmaId: firmId, category, scope: DOC_SCOPE },
      });

      const list = res?.data?.documents || res?.data?.items || res?.data?.data || res?.data || [];
      if (Array.isArray(list)) out.push(...list);
    } catch (e) {
      console.error("fetchDocsForFirmIds error:", firmId, e);
    }
  }

  out.sort((a, b) => {
    const da = new Date(a?.tarih || a?.createdAt || 0).getTime();
    const db = new Date(b?.tarih || b?.createdAt || 0).getTime();
    return db - da;
  });

  return out;
}

async function updateDocumentStatus(docId, durum) {
  const headers = getAuthHeader();
  if (!headers.Authorization) throw new Error("AUTH_MISSING");

  const payload = { durum };

  try {
    await axios.patch(`${API_ROOT}/api/documents/${docId}`, payload, { headers });
    return true;
  } catch (_) {}

  try {
    await axios.put(`${API_ROOT}/api/documents/${docId}`, payload, { headers });
    return true;
  } catch (_) {}

  await axios.patch(`${API_ROOT}/api/admin/documents/${docId}`, payload, { headers });
  return true;
}

async function deleteDocumentById(docId) {
  const headers = getAuthHeader();
  if (!headers.Authorization) throw new Error("AUTH_MISSING");

  try {
    await axios.delete(`${API_ROOT}/api/documents/${docId}`, { headers });
    return true;
  } catch (_) {}

  await axios.delete(`${API_ROOT}/api/admin/documents/${docId}`, { headers });
  return true;
}

export default function TicariPeriyodikBelgeleri() {
  const location = useLocation();

  const [selectedUserId, setSelectedUserId] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    const u = (p.get("u") || "").trim();
    if (u) return u;
    return localStorage.getItem(LS_ADMIN_USER_KEY) || "all";
  });

  const [firms, setFirms] = useState([]);
  const [selectedFirmId, setSelectedFirmId] = useState("Tüm");

  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(false);

  const [yilFilter, setYilFilter] = useState("Tüm");
  const [belgeTurFilter, setBelgeTurFilter] = useState("Tüm");
  const [durumFilter, setDurumFilter] = useState("Tüm");
  const [search, setSearch] = useState("");

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);

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

  const loadDocs = async (firmList) => {
    setLoading(true);
    try {
      const firmIds = firmList.map((f) => f.id);
      const raw = await fetchDocsForFirmIds(firmIds, CATEGORY);
      setDocs(raw.map(normalizeDoc));
    } catch (e) {
      console.error("Periyodik belgeleri alınamadı:", e);
      setDocs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const p = new URLSearchParams(location.search);
    const u = (p.get("u") || "").trim();

    if (u) {
      setSelectedUserId(u);
      localStorage.setItem(LS_ADMIN_USER_KEY, u);
    } else {
      setSelectedUserId(localStorage.getItem(LS_ADMIN_USER_KEY) || "all");
    }
  }, [location.search]);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const list = await fetchAssignedFirms(selectedUserId);
        if (!alive) return;
        setFirms(list);
        await loadDocs(list);
      } catch (e) {
        console.error("fetchAssignedFirms error:", e);
        if (alive) {
          setFirms([]);
          setDocs([]);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [selectedUserId]);

  useEffect(() => {
    const h = async () => {
      await loadDocs(firms);
    };

    window.addEventListener("docs:lastChangeAt", h);
    window.addEventListener("ticari_docs_refresh", h);

    return () => {
      window.removeEventListener("docs:lastChangeAt", h);
      window.removeEventListener("ticari_docs_refresh", h);
    };
  }, [firms]);

  const uniqueYears = useMemo(() => {
    const years = Array.from(new Set(docs.map(getDocYear).filter((y) => Number.isFinite(y))));
    years.sort((a, b) => Number(b) - Number(a));
    return years;
  }, [docs]);

  const uniqueDurum = useMemo(() => {
    const durumlar = Array.from(new Set(docs.map((d) => d?.durum).filter(Boolean)));
    return durumlar.length ? durumlar : ["Hazır", "Arşivde"];
  }, [docs]);

  const filteredDocs = useMemo(() => {
    return docs
      .filter((d) => {
        if (selectedFirmId !== "Tüm" && d.firmaId !== selectedFirmId) return false;

        const year = getDocYear(d);
        if (yilFilter !== "Tüm" && String(year) !== String(yilFilter)) return false;

        const t = inferBelgeTuru(d);
        if (belgeTurFilter !== "Tüm" && t !== belgeTurFilter) return false;

        if (durumFilter !== "Tüm" && d.durum !== durumFilter) return false;

        if (search.trim()) {
          const q = search.trim().toLowerCase();
          const hay = `${d.firmaAdi || ""} ${d.baslik || ""} ${t} ${toDisplayDate(
            d.tarih || d.createdAt
          )} ${getPreparedBy(d)}`.toLowerCase();

          if (!hay.includes(q)) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const ai = toIsoDate(a.tarih || a.createdAt);
        const bi = toIsoDate(b.tarih || b.createdAt);
        if (ai && bi) return bi.localeCompare(ai);
        return 0;
      });
  }, [docs, selectedFirmId, yilFilter, belgeTurFilter, durumFilter, search]);

  const openPreview = (doc) => {
    setPreviewDoc(doc);
    setPreviewOpen(true);
  };

  const closePreview = () => {
    setPreviewOpen(false);
    setPreviewDoc(null);
  };

  const handleIndir = (doc) => {
    const fileUrl = doc.fileUrl || doc.url;
    if (!fileUrl) {
      openInfo("Bilgilendirme", "Bu belge için kayıtlı bir PDF URL'si yok.");
      return;
    }

    const tur = inferBelgeTuru(doc);
    const tarihStr = toDisplayDate(doc.tarih || doc.createdAt) || "";
    const firmaAdi = doc.firmaAdi || "Firma";
    const downloadName = buildDownloadFileName({ firmaAdi, tur, tarihStr });

    const a = document.createElement("a");
    a.href = fileUrl;
    a.download = downloadName;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    a.remove();
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
      onConfirm: async () => {
        try {
          await updateDocumentStatus(doc.id, "Arşivde");
          setDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, durum: "Arşivde" } : d)));
        } catch (e) {
          console.error(e);
          openInfo("Hata", "Belge arşivlenemedi.");
        }
      },
    });
  };

  const handleGeriAl = (doc) => {
    if (doc.durum !== "Arşivde") return;

    openConfirm({
      title: "Uyarı",
      message:
        "Bu belge arşivden geri alınacak. Geri alındıktan sonra silme işlemi yapılabilir. Devam edilsin mi?",
      confirmText: "Geri Al",
      cancelText: "İptal",
      variant: "warning",
      onConfirm: async () => {
        try {
          await updateDocumentStatus(doc.id, "Hazır");
          setDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, durum: "Hazır" } : d)));
        } catch (e) {
          console.error(e);
          openInfo("Hata", "Belge geri alınamadı.");
        }
      },
    });
  };

  const handleSil = (doc) => {
    if (doc.durum === "Arşivde") return;

    openConfirm({
      title: "Uyarı",
      message: `${doc.firmaAdi || "Firma"} · ${inferBelgeTuru(doc)} belgesini silmek istiyor musunuz?`,
      confirmText: "Sil",
      cancelText: "İptal",
      variant: "danger",
      onConfirm: async () => {
        try {
          await deleteDocumentById(doc.id);
          setDocs((prev) => prev.filter((d) => d.id !== doc.id));
          localStorage.setItem("docs:lastChangeAt", String(Date.now()));
          window.dispatchEvent(new Event("docs:lastChangeAt"));
          window.dispatchEvent(new Event("ticari_docs_refresh"));
          openInfo("Bilgilendirme", "Belge silindi ✅");
        } catch (e) {
          console.error(e);
          openInfo("Hata", "Belge silinemedi.");
        }
      },
    });
  };

  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="mb-3">
        <div className="text-sm font-semibold text-[#042f4b]">
          Periyodik & İş Hijyeni Belgeleri
        </div>
        <div className="text-xs text-gray-500">
          Periyodik kontrol ve iş hijyeni belgeleri burada listelenir.
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <select
          className="px-3 py-2 border rounded-lg text-sm bg-white min-w-[220px]"
          value={selectedFirmId}
          onChange={(e) => setSelectedFirmId(e.target.value)}
          disabled={loading}
        >
          <option value="Tüm">Tüm Firmalar</option>
          {firms.map((f) => (
            <option key={f.id} value={f.id}>
              {f.firmaAdi || f.id}
            </option>
          ))}
        </select>

        <input
          className="flex-1 min-w-[180px] px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#042f4b]"
          placeholder="Ara (firma / tür / tarih / hazırlayan)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className="px-3 py-2 border rounded-lg text-sm bg-white"
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
          className="px-3 py-2 border rounded-lg text-sm bg-white"
          value={belgeTurFilter}
          onChange={(e) => setBelgeTurFilter(e.target.value)}
        >
          <option value="Tüm">Tüm Türler</option>
          {BELGE_TURLERI.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <select
          className="px-3 py-2 border rounded-lg text-sm bg-white"
          value={durumFilter}
          onChange={(e) => setDurumFilter(e.target.value)}
        >
          <option value="Tüm">Tüm Durumlar</option>
          {uniqueDurum.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      <div className="border border-gray-100 rounded-xl overflow-hidden">
        <div className="max-h-[60vh] overflow-y-auto">
          <table className="min-w-full text-[12px]">
            <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2 text-left">Firma</th>
                <th className="px-3 py-2 text-left w-[280px]">Tür</th>
                <th className="px-3 py-2 text-left w-[130px]">Tarih</th>
                <th className="px-3 py-2 text-left w-[180px]">Hazırlayan</th>
                <th className="px-3 py-2 text-right w-[290px]">İşlemler</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-gray-400">
                    Yükleniyor…
                  </td>
                </tr>
              )}

              {!loading && filteredDocs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-gray-400">
                    Kayıtlı periyodik/iş hijyeni belgesi bulunamadı.
                  </td>
                </tr>
              )}

              {filteredDocs.map((doc) => {
                const type = inferBelgeTuru(doc);
                const isArchived = doc.durum === "Arşivde";
                const dateText = toDisplayDate(doc.tarih || doc.createdAt);
                const preparedBy = getPreparedBy(doc);

                return (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-900 font-medium truncate max-w-[280px]">
                      {doc.firmaAdi || "-"}
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

                    <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                      {dateText || "-"}
                    </td>

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

                        {!isArchived ? (
                          <button
                            type="button"
                            onClick={() => handleArsivle(doc)}
                            className="px-3 py-1 rounded-lg border text-[11px] text-gray-700 hover:bg-gray-100"
                          >
                            Arşivle
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleGeriAl(doc)}
                            className="px-3 py-1 rounded-lg border text-[11px] text-indigo-700 hover:bg-indigo-50"
                          >
                            Geri Al
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleSil(doc)}
                          disabled={isArchived}
                          className={
                            "px-3 py-1 rounded-lg border text-[11px] " +
                            (isArchived
                              ? "text-gray-300 bg-gray-50 cursor-not-allowed"
                              : "text-red-600 hover:bg-red-50")
                          }
                          title={isArchived ? "Arşivde silme yok: önce Geri Al" : "Sil"}
                        >
                          Sil
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

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