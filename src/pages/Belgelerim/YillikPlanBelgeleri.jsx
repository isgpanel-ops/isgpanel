import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { FirmaContext } from "../../context/FirmaContext";
import { CardBox, SectionTitle } from "../../components/ui";
import ConfirmModal from "../../components/ui/ConfirmModal";

const DOCS_SYNC_KEY = "docs:lastChangeAt";
const YILLIK_TURLER = ["YEP", "YÇP", "YDR"];

const TYPE_BADGE_CLASS = (type) => {
  switch (type) {
    case "YEP":
      return "bg-amber-100 text-amber-800";
    case "YÇP":
      return "bg-lime-100 text-lime-800";
    case "YDR":
      return "bg-cyan-100 text-cyan-800";
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

const inferTur = (doc) => {
  const raw = String(
    doc?.belgeTuru ||
    doc?.tur ||
    doc?.type ||
    ""
  ).toUpperCase().trim();

  if (raw === "YEP") return "YEP";
  if (raw === "YÇP" || raw === "YCP") return "YÇP";
  if (raw === "YDR") return "YDR";

  const title = String(doc?.baslik || doc?.title || "").toUpperCase();
  if (title.includes("YEP")) return "YEP";
  if (title.includes("YÇP") || title.includes("YCP")) return "YÇP";
  if (title.includes("YDR")) return "YDR";

  return "";
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
  doc?.olusturan ||
  doc?.preparedBy ||
  doc?.createdBy ||
  doc?.personName ||
  doc?.userName ||
  "";

const getYillikTypeLabel = (_firmaAdi, type) => `Yıllık Planlar (${type})`;

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

const extractMaybeUrl = (doc) => {
  return (
    doc?.absoluteUrl ||
    doc?.fileUrl ||
    doc?.url ||
    doc?.pdfUrl ||
    doc?.pdfURL ||
    doc?.downloadUrl ||
    doc?.downloadURL ||
    doc?.dosyaUrl ||
    doc?.dosyaURL ||
    doc?.blobUrl ||
    doc?.blobURL ||
    doc?.pdf?.url ||
    ""
  );
};

const extractMaybeBase64 = (doc) => {
  return (
    doc?.pdfBase64 ||
    doc?.base64 ||
    doc?.pdfData ||
    doc?.pdfContent ||
    ""
  );
};

const isProbablyDataUrl = (s) =>
  typeof s === "string" && s.trim().startsWith("data:application/pdf");

const isProbablyBase64 = (s) => {
  if (typeof s !== "string") return false;
  const t = s.trim();
  if (!t) return false;
  if (isProbablyDataUrl(t)) return false;
  return t.length > 200 && /^[A-Za-z0-9+/=\s]+$/.test(t);
};

const getRoleFromStorage = () => {
  try {
    const activeEmail = localStorage.getItem("__isg_active_email_global");
    const userRaw =
      (activeEmail && localStorage.getItem(`isgpanel:${activeEmail}:user`)) ||
      localStorage.getItem("user") ||
      sessionStorage.getItem("user");

    const u = JSON.parse(userRaw || "null");
    return String(u?.role || "").toLowerCase().trim();
  } catch {
    return "";
  }
};

const isAdminRole = (role) =>
  role === "ticari_admin" ||
  role === "admin" ||
  role === "super_admin" ||
  role === "superadmin";

const isBireyselRole = (role) => role === "bireysel";
const isTicariRole = (role) => role.startsWith("ticari");

function getAuthToken() {
  try {
    const direct =
      localStorage.getItem("token") ||
      localStorage.getItem("jwt") ||
      localStorage.getItem("accessToken") ||
      localStorage.getItem("authToken") ||
      sessionStorage.getItem("token") ||
      sessionStorage.getItem("jwt") ||
      sessionStorage.getItem("accessToken") ||
      sessionStorage.getItem("authToken");

    if (direct) return direct;

    const activeEmail = localStorage.getItem("__isg_active_email_global");
    const userRaw =
      (activeEmail && localStorage.getItem(`isgpanel:${activeEmail}:user`)) ||
      localStorage.getItem("user") ||
      sessionStorage.getItem("user");

    const u = JSON.parse(userRaw || "null");

    const fromUser = u?.token || u?.accessToken || u?.jwt || u?.authToken;
    if (fromUser) return fromUser;

    const email = u?.email || u?.mail || activeEmail || localStorage.getItem("userEmail");
    if (email) {
      const tk = localStorage.getItem(`isgpanel:${email}:token`);
      if (tk) return tk;
    }

    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && k.endsWith(":token")) {
        const tk = localStorage.getItem(k);
        if (tk) return tk;
      }
    }
  } catch {}

  return null;
}

function PreviewModal({ open, doc, onClose, resolvePdfUrl }) {
  if (!open || !doc) return null;

  const fileUrl = resolvePdfUrl(doc);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-5xl rounded-2xl bg-white shadow-xl overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-900 truncate">
              {doc.firmaAdi || ""} {doc.firmaAdi ? "· " : ""}
              {inferTur(doc)}
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

export default function YillikPlanBelgeleri() {
  const { selectedFirm } = useContext(FirmaContext);

  const API_BASE =
    (import.meta.env.VITE_API_URL || import.meta.env.VITE_API || "")
      .trim()
      .replace(/\/+$/, "") || "https://api.isgpanel.tr/api";

  const [docs, setDocs] = useState([]);
  const [yilFilter, setYilFilter] = useState("Tüm");
  const [turFilter, setTurFilter] = useState("Tüm");
  const [durumFilter, setDurumFilter] = useState("Tüm");
  const [search, setSearch] = useState("");

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);

  const blobUrlCacheRef = useRef(new Map());

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

  const toAbsoluteUrl = (url) => {
    if (!url) return "";
    if (typeof url === "object") {
      url = url?.url || url?.path || "";
    }

    const value = String(url || "").trim();
    if (!value) return "";
    if (value.startsWith("data:")) return value;
    if (value.startsWith("blob:")) return value;
    if (value.startsWith("http://") || value.startsWith("https://")) return value;

    if (value.startsWith("/uploads")) {
      return `https://api.isgpanel.tr${value}`;
    }

    return `${API_BASE}${value.startsWith("/") ? "" : "/"}${value}`;
  };

  const fetchDocs = async () => {
    const token = getAuthToken();
    if (!token) {
      setDocs([]);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/documents`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("Yıllık belgeler alınamadı:", text);
        setDocs([]);
        return;
      }

      const data = await res.json();
      const list = Array.isArray(data) ? data : data?.items || data?.documents || [];

      const selectedFirmId = String(selectedFirm?.id || selectedFirm?._id || "");
const yearly = list.filter((d) => {
  const category = String(d?.category || "").toLowerCase().trim();
  const belgeTuru = String(
    d?.belgeTuru || d?.type || d?.tur || ""
  ).toUpperCase().trim();

  const firmaId = String(
    d?.firmaId ||
      d?.companyId ||
      d?.firma?._id ||
      d?.firma?.id ||
      ""
  );

  const inferredType = inferTur(d);

  const isValidExplicitType =
    belgeTuru === "YEP" ||
    belgeTuru === "YÇP" ||
    belgeTuru === "YCP" ||
    belgeTuru === "YDR";

  const isValidInferredType =
    inferredType === "YEP" ||
    inferredType === "YÇP" ||
    inferredType === "YDR";

  const firmMatch = !selectedFirmId || firmaId === selectedFirmId;

  return firmMatch && (
  category === "yillik" &&
  (isValidExplicitType || isValidInferredType)
);
});

      setDocs(yearly);
    } catch (e) {
      console.error("Server yıllık belgeler çekilemedi:", e);
      setDocs([]);
    }
  };

  useEffect(() => {
    fetchDocs();

    const handleRefresh = () => fetchDocs();
    window.addEventListener(DOCS_SYNC_KEY, handleRefresh);

    return () => {
      window.removeEventListener(DOCS_SYNC_KEY, handleRefresh);
      try {
        for (const url of blobUrlCacheRef.current.values()) {
          URL.revokeObjectURL(url);
        }
        blobUrlCacheRef.current.clear();
      } catch {}
    };
  }, [API_BASE, selectedFirm?.id, selectedFirm?._id]);

  const uniqueYears = useMemo(() => {
    const years = Array.from(new Set(docs.map(getDocYear).filter((y) => Number.isFinite(y))));
    years.sort((a, b) => Number(b) - Number(a));
    return years;
  }, [docs]);

  const uniqueDurum = useMemo(() => {
    const durumlar = Array.from(
      new Set(
        docs
          .map((d) => d?.durum || (d?.status === "arsivde" ? "Arşivde" : d?.status === "hazir" ? "Hazır" : ""))
          .filter(Boolean)
      )
    );
    if (durumlar.length === 0) return ["Hazır", "Arşivde"];
    return durumlar;
  }, [docs]);

  const filteredDocs = useMemo(() => {
    const selectedFirmId = String(selectedFirm?.id || selectedFirm?._id || "");

    return docs
      .filter((d) => {
        const firmaId = String(d?.firmaId || d?.companyId || d?.firma?._id || d?.firma?.id || "");
        if (selectedFirmId && firmaId !== selectedFirmId) return false;

        const year = getDocYear(d);
        if (yilFilter !== "Tüm" && String(year) !== String(yilFilter)) return false;

        const t = inferTur(d);
        if (turFilter !== "Tüm" && t !== turFilter) return false;

        const durum = d?.durum || (d?.status === "arsivde" ? "Arşivde" : d?.status === "hazir" ? "Hazır" : "");
        if (durumFilter !== "Tüm" && durum !== durumFilter) return false;

        if (search.trim()) {
          const q = search.trim().toLowerCase();
          const firmaName = d?.firmaAdi || d?.firma?.firmaAdi || selectedFirm?.firmaAdi || "";
          const hay = `${firmaName} ${t} ${toDisplayDate(d?.tarih || d?.createdAt)} ${getPreparedBy(d)} ${durum}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const ai = toIsoDate(a?.tarih || a?.createdAt);
        const bi = toIsoDate(b?.tarih || b?.createdAt);
        if (ai && bi) return bi.localeCompare(ai);
        return 0;
      });
  }, [docs, selectedFirm, yilFilter, turFilter, durumFilter, search]);

  const resolvePdfUrl = (doc) => {
    const direct = extractMaybeUrl(doc);
    if (direct) return toAbsoluteUrl(direct);

    const maybeBase = extractMaybeBase64(doc);
    if (isProbablyDataUrl(maybeBase)) return maybeBase;

    const id =
      doc?.id ||
      doc?._id ||
      `${doc?.firmaId || ""}_${doc?.tarih || doc?.createdAt || ""}_${inferTur(doc)}`;

    if (!id) return "";

    if (blobUrlCacheRef.current.has(id)) {
      return blobUrlCacheRef.current.get(id);
    }

    if (!isProbablyBase64(maybeBase)) return "";

    try {
      const clean = maybeBase.replace(/\s/g, "");
      const byteChars = atob(clean);
      const byteNumbers = new Array(byteChars.length);

      for (let i = 0; i < byteChars.length; i += 1) {
        byteNumbers[i] = byteChars.charCodeAt(i);
      }

      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/pdf" });
      const blobUrl = URL.createObjectURL(blob);
      blobUrlCacheRef.current.set(id, blobUrl);
      return blobUrl;
    } catch (e) {
      console.error("PDF base64 çözümlenemedi:", e);
      return "";
    }
  };

  const openPreview = (doc) => {
    setPreviewDoc(doc);
    setPreviewOpen(true);
  };

  const closePreview = () => {
    setPreviewOpen(false);
    setPreviewDoc(null);
  };

  const handleIndir = (doc) => {
    const fileUrl = resolvePdfUrl(doc);
    if (!fileUrl) {
      openInfo("Bilgilendirme", "Bu belge için kayıtlı bir PDF URL'si yok.");
      return;
    }

    const tur = inferTur(doc);
    const tarihStr = toDisplayDate(doc?.tarih || doc?.createdAt) || "";
    const firmaAdi = doc?.firmaAdi || doc?.firma?.firmaAdi || selectedFirm?.firmaAdi || "Firma";

    const downloadName = buildDownloadFileName({
      firmaAdi,
      tur,
      tarihStr,
    });

    const a = document.createElement("a");
    a.href = fileUrl;
    a.download = downloadName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleArsivle = (doc) => {
    if ((doc?.durum || "").toLowerCase() === "arşivde" || doc?.status === "arsivde") return;

    openConfirm({
      title: "Uyarı",
      message:
        "Bu belge arşive alınacak ve kilitlenecek. Arşivlenen belge üzerinde değişiklik yapılamaz. Devam edilsin mi?",
      confirmText: "Arşivle",
      cancelText: "İptal",
      variant: "warning",
      onConfirm: async () => {
        const token = getAuthToken();
        const docId = doc?.id || doc?._id;

        if (!token || !docId) {
          openInfo("Hata", "Belge bilgisi eksik.");
          return;
        }

        try {
          const res = await fetch(`${API_BASE}/documents/${docId}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ durum: "Arşivde", status: "arsivde" }),
          });

          if (!res.ok) {
            const text = await res.text();
            openInfo("Hata", `Belge arşivlenemedi.\n${text.slice(0, 200)}`);
            return;
          }

          setDocs((prev) =>
            prev.map((d) =>
              String(d?.id || d?._id) === String(docId)
                ? { ...d, durum: "Arşivde", status: "arsivde" }
                : d
            )
          );

          try {
            localStorage.setItem(DOCS_SYNC_KEY, String(Date.now()));
          } catch {}
          window.dispatchEvent(new Event(DOCS_SYNC_KEY));
        } catch (e) {
          console.error("Arşivleme hatası:", e);
          openInfo("Hata", "Belge arşivlenirken hata oluştu.");
        }
      },
    });
  };

  const handleGeriAl = (doc) => {
    if ((doc?.durum || "").toLowerCase() !== "arşivde" && doc?.status !== "arsivde") return;

    openConfirm({
      title: "Uyarı",
      message:
        "Bu belge arşivden geri alınacak. Geri alındıktan sonra silme işlemi yapılabilir. Devam edilsin mi?",
      confirmText: "Geri Al",
      cancelText: "İptal",
      variant: "warning",
      onConfirm: async () => {
        const token = getAuthToken();
        const docId = doc?.id || doc?._id;

        if (!token || !docId) {
          openInfo("Hata", "Belge bilgisi eksik.");
          return;
        }

        try {
          const res = await fetch(`${API_BASE}/documents/${docId}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ durum: "Hazır", status: "hazir" }),
          });

          if (!res.ok) {
            const text = await res.text();
            openInfo("Hata", `Belge geri alınamadı.\n${text.slice(0, 200)}`);
            return;
          }

          setDocs((prev) =>
            prev.map((d) =>
              String(d?.id || d?._id) === String(docId)
                ? { ...d, durum: "Hazır", status: "hazir" }
                : d
            )
          );

          try {
            localStorage.setItem(DOCS_SYNC_KEY, String(Date.now()));
          } catch {}
          window.dispatchEvent(new Event(DOCS_SYNC_KEY));
        } catch (e) {
          console.error("Geri alma hatası:", e);
          openInfo("Hata", "Belge geri alınırken hata oluştu.");
        }
      },
    });
  };

  const handleSil = (doc) => {
    const isArchived = (doc?.durum || "").toLowerCase() === "arşivde" || doc?.status === "arsivde";
    if (isArchived) return;

    const role = getRoleFromStorage();
    const isTicariUser = isTicariRole(role) && !isAdminRole(role);
    if (isTicariUser) return;

    const firmaAdi = doc?.firmaAdi || doc?.firma?.firmaAdi || selectedFirm?.firmaAdi || "Firma";
    const tur = inferTur(doc);

    openConfirm({
      title: "Uyarı",
      message: `${firmaAdi} · ${tur} belgesini silmek istiyor musunuz?`,
      confirmText: "Sil",
      cancelText: "İptal",
      variant: "danger",
      onConfirm: async () => {
        const token = getAuthToken();
        if (!token) {
          openInfo("Hata", "Token bulunamadı.");
          return;
        }

        const docId = doc?.id || doc?._id;
        if (!docId) {
          openInfo("Hata", "Belge ID bulunamadı.");
          return;
        }

        try {
          const res = await fetch(`${API_BASE}/documents/${docId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });

          if (!res.ok) {
            const text = await res.text();
            openInfo("Hata", `Server silme başarısız.\n${text.slice(0, 200)}`);
            return;
          }

          setDocs((prev) => prev.filter((d) => String(d?.id || d?._id) !== String(docId)));
          openInfo("Bilgilendirme", "Belge silindi");

          try {
            localStorage.setItem(DOCS_SYNC_KEY, String(Date.now()));
          } catch {}
          window.dispatchEvent(new Event(DOCS_SYNC_KEY));
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
          title="Yıllık Plan Belgeleri"
          subtitle="Belgeleri görmek için lütfen sağ üstten bir firma seçiniz."
        />
      </CardBox>
    );
  }

  return (
    <CardBox className="flex flex-col gap-4">
      <SectionTitle
        title="Yıllık Plan Belgeleri"
        subtitle={`${selectedFirm.firmaAdi} firmasına ait YEP, YÇP ve YDR belgeleri burada listelenir.`}
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
          value={turFilter}
          onChange={(e) => setTurFilter(e.target.value)}
        >
          <option value="Tüm">Tüm Türler</option>
          {YILLIK_TURLER.map((t) => (
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
        <div className="block md:hidden">
          {filteredDocs.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">
              {selectedFirm.firmaAdi} için kayıtlı yıllık plan belgesi bulunamadı.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredDocs.map((doc) => {
                const type = inferTur(doc) || "-";
                const durumText =
                  doc?.durum || (doc?.status === "arsivde" ? "Arşivde" : doc?.status === "hazir" ? "Hazır" : "");
                const isArchived =
                  (doc?.durum || "").toLowerCase() === "arşivde" || doc?.status === "arsivde";
                const dateText = toDisplayDate(doc?.tarih || doc?.createdAt);
                const preparedBy = getPreparedBy(doc);
                const firmaName = doc?.firmaAdi || doc?.firma?.firmaAdi || selectedFirm?.firmaAdi;
                const role = getRoleFromStorage();
                const isTicariUser = isTicariRole(role) && !isAdminRole(role);

                return (
                  <div key={doc?.id || doc?._id} className="p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-900 break-words">
                        {firmaName}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2">
                        <span
                          className={
                            "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold " +
                            TYPE_BADGE_CLASS(type)
                          }
                        >
                          {getYillikTypeLabel(firmaName, type)}
                        </span>

                        {durumText ? (
                          <span
                            className={
                              "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold " +
                              STATUS_BADGE_CLASS(durumText)
                            }
                          >
                            {durumText}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 text-xs text-gray-600">
                      <div>
                        <span className="font-medium text-gray-800">Tarih:</span> {dateText || "-"}
                      </div>
                      <div>
                        <span className="font-medium text-gray-800">Hazırlayan:</span> {preparedBy || "-"}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
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
                        >
                          Arşivle
                        </button>
                      )}

                      {isArchived && (
                        <button
                          type="button"
                          onClick={() => handleGeriAl(doc)}
                          className="flex-1 min-w-[110px] px-3 py-2 rounded-lg border text-xs text-indigo-700 hover:bg-indigo-50"
                        >
                          Geri Al
                        </button>
                      )}

                      {!isTicariUser && (
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

        <div className="hidden md:block">
          <div className="max-h-[60vh] overflow-auto">
            <table className="min-w-[700px] w-full text-[12px]">
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
                {filteredDocs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-gray-400">
                      {selectedFirm.firmaAdi} için kayıtlı yıllık plan belgesi bulunamadı.
                    </td>
                  </tr>
                )}

                {filteredDocs.map((doc) => {
                  const type = inferTur(doc) || "-";
                  const isArchived =
                    (doc?.durum || "").toLowerCase() === "arşivde" || doc?.status === "arsivde";
                  const dateText = toDisplayDate(doc?.tarih || doc?.createdAt);
                  const preparedBy = getPreparedBy(doc);
                  const firmaName = doc?.firmaAdi || doc?.firma?.firmaAdi || selectedFirm?.firmaAdi;
                  const role = getRoleFromStorage();
                  const isTicariUser = isTicariRole(role) && !isAdminRole(role);

                  return (
                    <tr key={doc?.id || doc?._id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-900 font-medium truncate max-w-[160px] sm:max-w-[280px]">
                        {firmaName}
                      </td>

                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={
                              "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold " +
                              TYPE_BADGE_CLASS(type)
                            }
                          >
                            {getYillikTypeLabel(firmaName, type)}
                          </span>

                          {(doc?.durum || doc?.status) && (
                            <span
                              className={
                                "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold " +
                                STATUS_BADGE_CLASS(
                                  doc?.durum || (doc?.status === "arsivde" ? "Arşivde" : "Hazır")
                                )
                              }
                            >
                              {doc?.durum || (doc?.status === "arsivde" ? "Arşivde" : "Hazır")}
                            </span>
                          )}
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
                            className="px-3 py-1 rounded-lg border text-[11px] text-gray-700 hover:bg-gray-100"
                          >
                            Önizle
                          </button>

                          <button
                            type="button"
                            onClick={() => handleIndir(doc)}
                            className="px-2 sm:px-3 py-1 rounded-lg border text-[10px] sm:text-[11px] whitespace-nowrap text-gray-700 hover:bg-gray-100"
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

                          {!isTicariUser && (
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
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <PreviewModal
        open={previewOpen}
        doc={previewDoc}
        onClose={closePreview}
        resolvePdfUrl={resolvePdfUrl}
      />

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