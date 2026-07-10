import React, { useContext, useEffect, useMemo, useState } from "react";
import { FirmaContext } from "../../context/FirmaContext";
import { CardBox, SectionTitle } from "../../components/ui";
import ConfirmModal from "../../components/ui/ConfirmModal";

const ACIL_DOCS_KEY = "belgelerim_acil_listesi";

const API_BASE =
  (import.meta.env.VITE_API_URL || "").trim().replace(/\/$/, "") ||
  "https://api.isgpanel.tr/api";

// Acil Durum Belgeleri sekmesi için sabit türler
const ACIL_BELGE_TURLERI = ["Acil Durum Planı", "Acil Ekip"];

const TYPE_BADGE_CLASS = (type) => {
  switch (type) {
    case "Acil Durum Planı":
      return "bg-sky-100 text-sky-700";
    case "Acil Ekip":
      return "bg-fuchsia-100 text-fuchsia-700";
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

const inferBelgeTuru = (doc) => {
  const raw =
    doc?.belgeTuru ||
    doc?.tur ||
    doc?.type ||
    doc?.kategori ||
    doc?.category ||
    "";

  if (ACIL_BELGE_TURLERI.includes(raw)) return raw;

  const title = (doc?.baslik || doc?.title || "").toLowerCase();
  if (title.includes("ekip")) return "Acil Ekip";
  if (title.includes("plan")) return "Acil Durum Planı";
  if (title.includes("acil")) return "Acil Durum Planı";

  return "Acil Durum Planı";
};

const getDocYear = (doc) => {
  if (doc?.yil) return Number(doc.yil);
  const iso = toIsoDate(doc?.tarih || doc?.createdAt);
  if (!iso) return undefined;
  return Number(iso.slice(0, 4));
};

const getPreparedBy = (doc) =>
  doc?.hazirlayan ||
  doc?.olusturan ||
  doc?.preparedBy ||
  doc?.createdBy ||
  doc?.userName ||
  "";

const getDocDurum = (doc) => {
  const durum = String(doc?.durum || "").trim();
  if (durum) return durum;

  const status = String(doc?.status || "").toLowerCase().trim();
  if (status === "arsiv" || status === "arsivde" || status === "archive" || status === "archived") {
    return "Arşivde";
  }

  return "Hazır";
};

const isDocArchived = (doc) => getDocDurum(doc) === "Arşivde";

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
  const safeFirma = sanitizeFileName(firmaAdi || "Firma");
  const safeTur = sanitizeFileName(tur || "Belge");
  const safeTarih = sanitizeFileName(tarihStr || "tarih-yok");
  return `${safeFirma} - ${safeTur} - ${safeTarih}.pdf`;
};

const getStoredUser = () => {
  try {
    const activeEmail = localStorage.getItem("__isg_active_email_global");
    const u1 = activeEmail
      ? localStorage.getItem(`isgpanel:${activeEmail}:user`)
      : null;
    const u2 = localStorage.getItem("user") || sessionStorage.getItem("user");
    return JSON.parse(u1 || u2 || "null");
  } catch {
    return null;
  }
};

const getRoleFromStorage = () => {
  try {
    const u = getStoredUser();
    return String(u?.role || "").toLowerCase().trim();
  } catch {
    return "";
  }
};

const isAdminRole = (role) =>
  role === "ticari_admin" || role === "admin" || role === "super_admin" || role === "superadmin";

const isTicariRole = (role) => String(role || "").startsWith("ticari");
const isDemoUser = () => !!getStoredUser()?.demo;

function getAuthToken() {
  try {
    const u = JSON.parse(localStorage.getItem("user") || "null");
    const direct = u?.token || u?.accessToken || u?.jwt || u?.authToken;
    if (direct) return direct;

    const t =
      localStorage.getItem("token") ||
      localStorage.getItem("jwt") ||
      localStorage.getItem("accessToken") ||
      localStorage.getItem("authToken");
    if (t) return t;

    const email = u?.email || u?.mail || localStorage.getItem("userEmail");
    if (email) {
      const key = `isgpanel:${email}:token`;
      const tk = localStorage.getItem(key);
      if (tk) return tk;
    }
  } catch {}
  return null;
}

const toAbsoluteFileUrl = (input) => {
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

  if (raw.includes("/documents")) {
    return `${API_BASE}${raw.startsWith("/") ? "" : "/"}${raw}/download`;
  }

  return `${API_BASE}${raw.startsWith("/") ? "" : "/"}${raw}`;
};

function PreviewModal({ open, doc, onClose }) {
  if (!open || !doc) return null;

  const rawFileUrl =
    doc?.absoluteUrl ||
    doc?.fileUrl ||
    doc?.url ||
    doc?.pdfUrl ||
    doc?.downloadUrl ||
    doc?.data?.absoluteUrl ||
    doc?.data?.fileUrl ||
    "";

  const fileUrl = toAbsoluteFileUrl(rawFileUrl);
  const token = getAuthToken();

  const previewUrl =
    fileUrl && fileUrl.includes("/documents/") && token
      ? `${fileUrl}${fileUrl.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`
      : fileUrl;

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

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs rounded-lg border hover:bg-gray-50"
            >
              Kapat
            </button>
          </div>
        </div>

        <div className="h-[70vh] bg-gray-50">
          {previewUrl ? (
            <iframe
              title="PDF Önizleme"
              src={previewUrl}
              className="w-full h-full"
            />
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

export default function AcilDurumBelgeleri() {
  const { selectedFirm } = useContext(FirmaContext);

  const [docs, setDocs] = useState([]);
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

  const persist = (next) => {
    setDocs(next);
    try {
      localStorage.setItem(ACIL_DOCS_KEY, JSON.stringify(next));
    } catch {}
  };

  const buildDocGroupKey = (doc) => {
    const uniqueKey = String(doc?.uniqueKey || "").trim();
    if (uniqueKey) return `uk:${uniqueKey}`;

    return [
      String(doc?.organizationId || "").trim(),
      String(doc?.createdByUserId || "").trim(),
      String(doc?.firmaId || "").trim(),
      String(doc?.category || doc?.kategori || "").trim().toLowerCase(),
      String(doc?.subCategory || "").trim().toLowerCase(),
      String(doc?.title || doc?.baslik || "").trim().toLowerCase(),
      String(doc?.tarih || "").trim(),
      String(doc?.fileUrl || "").trim(),
    ].join("|");
  };

  const dedupeDocs = (items) => {
    const map = new Map();

    for (const doc of items || []) {
      const key = buildDocGroupKey(doc);
      const existing = map.get(key);

      if (!existing) {
        map.set(key, doc);
        continue;
      }

      const existingTime = new Date(existing?.createdAt || 0).getTime();
      const currentTime = new Date(doc?.createdAt || 0).getTime();

      if (currentTime > existingTime) {
        map.set(key, doc);
      }
    }

    return Array.from(map.values());
  };

  const fetchDocs = async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE}/documents`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("Acil belgeler fetch hatası:", {
          status: res.status,
          body: text,
        });
        return;
      }

      const data = await res.json().catch(() => null);
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.documents)
        ? data.documents
        : Array.isArray(data?.data)
        ? data.data
        : [];

      const acil = list.filter((d) => {
        const category = String(d?.category || d?.kategori || "").toLowerCase();
        const tur = String(d?.belgeTuru || d?.tur || d?.type || "").toLowerCase();
        const title = String(d?.baslik || d?.title || "").toLowerCase();

        return (
          category === "acil" ||
          category.includes("acil") ||
          tur.includes("acil durum") ||
          title.includes("acil durum")
        );
      });

      const deduped = dedupeDocs(acil).map((doc) => ({
        ...doc,
        durum: getDocDurum(doc),
        status: String(doc?.status || "").trim() || (getDocDurum(doc) === "Arşivde" ? "arsiv" : "hazir"),
      }));
      setDocs(deduped);
    } catch (e) {
      console.error("Server acil belgeler çekilemedi:", e);
    }
  };

  useEffect(() => {
    fetchDocs();

    const refreshDocs = () => {
      fetchDocs();
    };

    window.addEventListener("ticari_docs_refresh", refreshDocs);
    window.addEventListener("documentsUpdated", refreshDocs);
    window.addEventListener("belgelerimUpdated", refreshDocs);

    return () => {
      window.removeEventListener("ticari_docs_refresh", refreshDocs);
      window.removeEventListener("documentsUpdated", refreshDocs);
      window.removeEventListener("belgelerimUpdated", refreshDocs);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFirm?.id, selectedFirm?._id]);

  const uniqueYears = useMemo(() => {
    const years = Array.from(
      new Set(docs.map(getDocYear).filter((y) => Number.isFinite(y)))
    );
    years.sort((a, b) => Number(b) - Number(a));
    return years;
  }, [docs]);

  const uniqueDurum = useMemo(() => {
    const durumlar = Array.from(new Set(docs.map(getDocDurum).filter(Boolean)));
    if (durumlar.length === 0) return ["Hazır", "Arşivde"];
    return durumlar;
  }, [docs]);

  const filteredDocs = useMemo(() => {
    return docs
      .filter((d) => {
        const currentFirmId = String(selectedFirm?.id || selectedFirm?._id || "");
        const docFirmId = String(d.firmaId || d?.firma?._id || d?.firmaId?._id || "");

        if (currentFirmId && docFirmId && docFirmId !== currentFirmId) return false;

        const year = getDocYear(d);
        if (yilFilter !== "Tüm" && String(year) !== String(yilFilter)) return false;

        const t = inferBelgeTuru(d);
        if (belgeTurFilter !== "Tüm" && t !== belgeTurFilter) return false;

        if (durumFilter !== "Tüm" && getDocDurum(d) !== durumFilter) return false;

        if (search.trim()) {
          const q = search.trim().toLowerCase();
          const hay = `${d.firmaAdi || ""} ${t} ${toDisplayDate(
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
  }, [docs, selectedFirm, yilFilter, belgeTurFilter, durumFilter, search]);

  const openPreview = (doc) => {
    setPreviewDoc(doc);
    setPreviewOpen(true);
  };

  const closePreview = () => {
    setPreviewOpen(false);
    setPreviewDoc(null);
  };

  const handleIndir = async (doc) => {
    try {
      const token = getAuthToken();

      const fileUrlRaw =
        doc?.absoluteUrl ||
        doc?.fileUrl ||
        doc?.url ||
        doc?.pdfUrl ||
        doc?.downloadUrl ||
        doc?.data?.absoluteUrl ||
        doc?.data?.fileUrl ||
        "";

      if (!fileUrlRaw) {
        openInfo("Bilgilendirme", "Bu belge için kayıtlı PDF bulunamadı.");
        return;
      }

      const tur = inferBelgeTuru(doc);
      const tarihStr = toDisplayDate(doc?.tarih || doc?.createdAt) || "";
      const firmaAdi = doc?.firmaAdi || selectedFirm?.firmaAdi || "Firma";
      const downloadName = buildDownloadFileName({ firmaAdi, tur, tarihStr });

      const absolute = toAbsoluteFileUrl(fileUrlRaw);
      const res = await fetch(absolute, {
        method: "GET",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("PDF indirme server hata:", res.status, text);
        openInfo("Hata", `PDF indirilemedi. (${res.status})`);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(() => {
        try {
          URL.revokeObjectURL(url);
        } catch {}
      }, 5000);
    } catch (e) {
      console.error("PDF indirme hata:", e);
      openInfo("Hata", "PDF indirirken hata oluştu.");
    }
  };

  const handleArsivle = (doc) => {
    if (isDocArchived(doc)) return;

    const targetId = String(doc.id || doc._id || "");
    if (!targetId) {
      openInfo("Hata", "Belge ID bulunamadı.");
      return;
    }

    openConfirm({
      title: "Uyarı",
      message:
        "Bu belge arşivlenecek. Arşivlenen belge üzerinde değişiklik yapılamaz. Devam edilsin mi?",
      confirmText: "Arşivle",
      cancelText: "İptal",
      variant: "warning",
      onConfirm: async () => {
        try {
          const token = getAuthToken();
          if (!token) {
            openInfo("Hata", "Token bulunamadı.");
            return;
          }

          const res = await fetch(`${API_BASE}/documents/${targetId}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ durum: "Arşivde", status: "arsiv" }),
          });

          const raw = await res.text().catch(() => "");
          let payload = {};
          try {
            payload = raw ? JSON.parse(raw) : {};
          } catch {
            payload = {};
          }

          if (!res.ok) {
            openInfo("Hata", payload?.message || "Belge arşivlenemedi.");
            return;
          }

          await fetchDocs();
          openInfo("Bilgilendirme", "Belge arşivlendi ✅");
        } catch (err) {
          console.error("Belge arşivleme hatası:", err);
          openInfo("Hata", "Belge arşivlenirken bir hata oluştu.");
        }
      },
    });
  };

  const handleGeriAl = (doc) => {
    const isArchived = isDocArchived(doc);
    if (!isArchived) return;

    const targetId = String(doc.id || doc._id || "");
    if (!targetId) {
      openInfo("Hata", "Belge ID bulunamadı.");
      return;
    }

    openConfirm({
      title: "Uyarı",
      message:
        "Bu belge arşivden geri alınacak. Geri alındıktan sonra silme işlemi yapılabilir. Devam edilsin mi?",
      confirmText: "Geri Al",
      cancelText: "İptal",
      variant: "warning",
      onConfirm: async () => {
        try {
          const token = getAuthToken();
          if (!token) {
            openInfo("Hata", "Token bulunamadı.");
            return;
          }

          const res = await fetch(`${API_BASE}/documents/${targetId}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ durum: "Hazır", status: "hazir" }),
          });

          const raw = await res.text().catch(() => "");
          let payload = {};
          try {
            payload = raw ? JSON.parse(raw) : {};
          } catch {
            payload = {};
          }

          if (!res.ok) {
            openInfo("Hata", payload?.message || "Belge geri alınamadı.");
            return;
          }

          await fetchDocs();
          openInfo("Bilgilendirme", "Belge arşivden çıkarıldı ✅");
        } catch (err) {
          console.error("Belge geri alma hatası:", err);
          openInfo("Hata", "Belge geri alınırken bir hata oluştu.");
        }
      },
    });
  };

  const handleSil = (doc) => {
    const isArchived = isDocArchived(doc);
    if (isArchived) return;

    const role = getRoleFromStorage();
    const isTicariUser = isTicariRole(role) && !isAdminRole(role);
    if (isTicariUser) return;

    const firmaAdi = doc.firmaAdi || selectedFirm?.firmaAdi || "Firma";
    const tur = inferBelgeTuru(doc);

    openConfirm({
      title: "Uyarı",
      message: `${firmaAdi} · ${tur} belgesini silmek istiyor musunuz?`,
      confirmText: "Sil",
      cancelText: "İptal",
      variant: "danger",
      onConfirm: async () => {
        const targetId = String(doc.id || doc._id || "");
        if (!targetId) {
          openInfo("Hata", "Belge ID bulunamadı.");
          return;
        }

        const token = getAuthToken();
        if (!token) {
          openInfo("Hata", "Token bulunamadı.");
          return;
        }

        try {
          const res = await fetch(`${API_BASE}/documents/${targetId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });

          const raw = await res.text().catch(() => "");
          let payload = {};

          try {
            payload = raw ? JSON.parse(raw) : {};
          } catch {
            payload = {};
          }

          if (!res.ok) {
            openInfo("Hata", payload?.message || "Belge silinemedi.");
            return;
          }

          await fetchDocs();

          window.dispatchEvent(new Event("ticari_docs_refresh"));
          window.dispatchEvent(new Event("documentsUpdated"));
          window.dispatchEvent(new Event("belgelerimUpdated"));

          const deletedCount = Number(payload?.deletedCount || 0);

          openInfo(
            "Bilgilendirme",
            deletedCount > 1
              ? `Belge ve tekrar eden kayıtları silindi ✅ (${deletedCount})`
              : "Belge silindi ✅"
          );
        } catch (e) {
          console.error("Server silme hatası:", e);
          openInfo("Hata", "Belge silinirken hata oluştu.");
        }
      },
    });
  };

  if (!selectedFirm) {
    return (
      <CardBox>
        <SectionTitle
          title="Acil Durum Belgeleri"
          subtitle="Belgeleri görmek için lütfen sağ üstten bir firma seçiniz."
        />
      </CardBox>
    );
  }

  return (
    <CardBox className="flex flex-col gap-4">
      <SectionTitle
        title="Acil Durum Belgeleri"
        subtitle={`${selectedFirm.firmaAdi} firmasına ait acil durum planı ve acil ekip belgeleri burada listelenir.`}
      />

      <div className="flex flex-col sm:flex-row flex-wrap gap-2">
        <input
          className="w-full sm:flex-1 min-w-[140px] px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#042f4b]"
          placeholder="Ara (firma / tür / tarih / hazırlayan)"
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
          value={belgeTurFilter}
          onChange={(e) => setBelgeTurFilter(e.target.value)}
        >
          <option value="Tüm">Tüm Türler</option>
          {ACIL_BELGE_TURLERI.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <select
          className="w-full sm:w-auto px-3 py-2 border rounded-lg text-sm bg-white"
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
  <div className="hidden md:block max-h-[60vh] overflow-auto">
    <table className="min-w-[700px] w-full text-[12px]">
      <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase sticky top-0 z-10">
        <tr>
          <th className="px-3 py-2 text-left">Firma</th>
          <th className="px-3 py-2 text-left w-[260px]">Tür</th>
          <th className="px-3 py-2 text-left w-[130px]">Tarih</th>
          <th className="px-3 py-2 text-left w-[180px]">Hazırlayan</th>
          <th className="px-3 py-2 text-right w-[290px]">İşlemler</th>
        </tr>
      </thead>

      <tbody className="divide-y divide-gray-100">
        {filteredDocs.length === 0 && (
          <tr>
            <td colSpan={5} className="px-3 py-6 text-center text-gray-400">
              {selectedFirm.firmaAdi} için kayıtlı acil durum belgesi bulunamadı.
            </td>
          </tr>
        )}

        {filteredDocs.map((doc) => {
          const type = inferBelgeTuru(doc);
          const durum = getDocDurum(doc);
          const isArchived = isDocArchived(doc);
          const dateText = toDisplayDate(doc.tarih || doc.createdAt);
          const preparedBy = getPreparedBy(doc);
          const rowKey =
            doc.id ||
            doc._id ||
            `${doc.firmaId}-${doc.createdAt || doc.tarih}-${type}`;

          return (
            <tr key={rowKey} className="hover:bg-gray-50">
              <td className="px-3 py-2 text-gray-900 font-medium truncate max-w-[160px] sm:max-w-[280px]">
                {doc.firmaAdi || selectedFirm.firmaAdi}
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

                  {durum ? (
                    <span
                      className={
                        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold " +
                        STATUS_BADGE_CLASS(durum)
                      }
                    >
                      {durum}
                    </span>
                  ) : null}
                </div>
              </td>

              <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                {dateText || "-"}
              </td>

              <td className="px-3 py-2 text-gray-700 truncate max-w-[120px] sm:max-w-[200px]">
                {preparedBy || "-"}
              </td>

              <td className="px-3 py-2">
                <div className="flex flex-wrap sm:flex-nowrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => openPreview(doc)}
                    className="px-2 sm:px-3 py-1 rounded-lg border text-[10px] sm:text-[11px] whitespace-nowrap text-gray-700 hover:bg-gray-100"
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
                      title="Arşivle (kilitle)"
                    >
                      Arşivle
                    </button>
                  )}

                  {isArchived && (
                    <button
                      type="button"
                      onClick={() => handleGeriAl(doc)}
                      className="px-3 py-1 rounded-lg border text-[11px] text-indigo-700 hover:bg-indigo-50"
                      title="Arşivden geri al"
                    >
                      Geri Al
                    </button>
                  )}

                  {(() => {
                    const role = getRoleFromStorage();
                    const demoUser = isDemoUser();
                    const isTicariUser = isTicariRole(role) && !isAdminRole(role) && !demoUser;

                    if (isTicariUser) return null;

                    return (
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
                    );
                  })()}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>

  <div className="md:hidden flex flex-col gap-3 p-3 bg-gray-50">
    {filteredDocs.length === 0 ? (
      <div className="rounded-lg border border-dashed border-gray-200 bg-white px-3 py-6 text-center text-sm text-gray-400">
        {selectedFirm.firmaAdi} için kayıtlı acil durum belgesi bulunamadı.
      </div>
    ) : (
      filteredDocs.map((doc) => {
        const type = inferBelgeTuru(doc);
        const durum = getDocDurum(doc);
        const isArchived = isDocArchived(doc);
        const dateText = toDisplayDate(doc.tarih || doc.createdAt);
        const preparedBy = getPreparedBy(doc);
        const rowKey =
          doc.id ||
          doc._id ||
          `${doc.firmaId}-${doc.createdAt || doc.tarih}-${type}`;

        return (
          <div
            key={rowKey}
            className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-900 break-words">
                  {doc.firmaAdi || selectedFirm.firmaAdi}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  {dateText || "-"}
                </div>
              </div>

              {durum ? (
                <span
                  className={
                    "inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold " +
                    STATUS_BADGE_CLASS(durum)
                  }
                >
                  {durum}
                </span>
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <span
                className={
                  "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold " +
                  TYPE_BADGE_CLASS(type)
                }
              >
                {type}
              </span>
            </div>

            <div className="mt-3 space-y-1 text-xs text-gray-600">
              <div>
                <span className="font-medium text-gray-700">Hazırlayan:</span>{" "}
                {preparedBy || "-"}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => openPreview(doc)}
                className="flex-1 min-w-[110px] px-3 py-2 rounded-lg border text-xs text-gray-700 hover:bg-gray-100"
              >
                Önizle
              </button>

              <button
                type="button"
                onClick={() => handleIndir(doc)}
                className="flex-1 min-w-[110px] px-3 py-2 rounded-lg border text-xs text-gray-700 hover:bg-gray-100"
              >
                İndir
              </button>

              {!isArchived && (
                <button
                  type="button"
                  onClick={() => handleArsivle(doc)}
                  className="flex-1 min-w-[110px] px-3 py-2 rounded-lg border text-xs text-gray-700 hover:bg-gray-100"
                  title="Arşivle (kilitle)"
                >
                  Arşivle
                </button>
              )}

              {isArchived && (
                <button
                  type="button"
                  onClick={() => handleGeriAl(doc)}
                  className="flex-1 min-w-[110px] px-3 py-2 rounded-lg border text-xs text-indigo-700 hover:bg-indigo-50"
                  title="Arşivden geri al"
                >
                  Geri Al
                </button>
              )}

              {(() => {
                const role = getRoleFromStorage();
                const demoUser = isDemoUser();
                const isTicariUser = isTicariRole(role) && !isAdminRole(role) && !demoUser;

                if (isTicariUser) return null;

                return (
                  <button
                    type="button"
                    onClick={() => handleSil(doc)}
                    disabled={isArchived}
                    className={
                      "flex-1 min-w-[110px] px-3 py-2 rounded-lg border text-xs " +
                      (isArchived
                        ? "text-gray-300 bg-gray-50 cursor-not-allowed"
                        : "text-red-600 hover:bg-red-50")
                    }
                    title={isArchived ? "Arşivde silme yok: önce Geri Al" : "Sil"}
                  >
                    Sil
                  </button>
                );
              })()}
            </div>
          </div>
        );
      })
    )}
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
    </CardBox>
  );
}
