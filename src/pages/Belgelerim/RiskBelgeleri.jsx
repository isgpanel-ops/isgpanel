import React, { useContext, useEffect, useMemo, useState } from "react";
import { FirmaContext } from "../../context/FirmaContext";
import { CardBox, SectionTitle } from "../../components/ui";
import ConfirmModal from "../../components/ui/ConfirmModal";

/* =========================
   ✅ HELPERS (COMPONENT DIŞI)
   ========================= */
const API_BASE =
  (import.meta.env.VITE_API_URL || "").trim().replace(/\/$/, "") ||
  "https://api.isgpanel.tr/api";

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
  role === "ticari_admin" ||
  role === "admin" ||
  role === "super_admin" ||
  role === "superadmin";

const isBireyselRole = (role) => role === "bireysel";
const isTicariRole = (role) => String(role || "").startsWith("ticari");
const isDemoUser = () => {
  try {
    const u = getStoredUser();
    return !!u?.demo;
  } catch {
    return false;
  }
};

function getAuthToken() {
  try {
    const u = getStoredUser();

    const direct = u?.token || u?.accessToken || u?.jwt || u?.authToken;
    if (direct) return direct;

    return (
      localStorage.getItem("token") ||
      localStorage.getItem("jwt") ||
      localStorage.getItem("accessToken") ||
      localStorage.getItem("authToken") ||
      null
    );
  } catch {
    return null;
  }
}

/* =========================
   Görsel yardımcılar
   ========================= */

const RISK_BELGE_TURLERI = [
  "Risk Değerlendirme Prosedürü",
  "Risk Değerlendirmesi",
  "Risk Değerlendirme Ekibi",
  "DÖF",
];

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

const getBadgeLabel = (type) => {
  switch (type) {
    case "Risk Değerlendirme Prosedürü":
      return "Risk (Prosedür)";
    case "Risk Değerlendirmesi":
      return "Risk (Değerlendirme)";
    case "Risk Değerlendirme Ekibi":
      return "Risk (Ekip)";
    case "DÖF":
      return "Risk (DÖF)";
    default:
      return "Risk";
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
  const sc = String(doc?.subCategory || doc?.sub_category || "")
    .toLowerCase()
    .trim();

  if (sc === "ekip") return "Risk Değerlendirme Ekibi";
  if (sc === "prosedur") return "Risk Değerlendirme Prosedürü";
  if (sc === "dof" || sc === "döf") return "DÖF";
  if (sc === "degerlendirme" || sc === "risk") return "Risk Değerlendirmesi";

  const raw =
    doc?.belgeTuru ||
    doc?.tur ||
    doc?.type ||
    doc?.kategori ||
    doc?.category ||
    "";

  if (RISK_BELGE_TURLERI.includes(raw)) return raw;

  const title = (doc?.baslik || doc?.title || "").toLowerCase();
  if (title.includes("prosed")) return "Risk Değerlendirme Prosedürü";
  if (title.includes("ekip")) return "Risk Değerlendirme Ekibi";
  if (title.includes("döf") || title.includes("dof")) return "DÖF";
  if (title.includes("risk")) return "Risk Değerlendirmesi";

  return "Risk Değerlendirmesi";
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

const normalizeFirmaId = (value) => {
  if (!value) return "";

  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }

  if (typeof value === "object") {
    return String(
      value?._id ||
        value?.id ||
        value?.firmaId ||
        value?.firma?._id ||
        value?.firma?.id ||
        ""
    ).trim();
  }

  return "";
};

function PreviewModal({ open, doc, onClose }) {
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    if (!open || !doc) return;

    let objectUrl = "";
    let cancelled = false;

    const loadPdfPreview = async () => {
      try {
        const token = getAuthToken();
        const docId = doc?.id || doc?._id || "";

        const rawFileUrl =
          doc.fileUrl ||
          doc.url ||
          doc.pdfUrl ||
          doc.downloadUrl ||
          "";

        const directFileUrl = toAbsoluteFileUrl(rawFileUrl);

        const url = directFileUrl || (docId ? `${API_BASE}/documents/${docId}/download` : "");

        if (!url) {
          setPreviewUrl("");
          return;
        }

        const res = await fetch(url, {
          method: "GET",
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (!res.ok) throw new Error("PDF önizleme alınamadı");

        const blob = await res.blob();
        objectUrl = URL.createObjectURL(
          new Blob([blob], { type: "application/pdf" })
        );

        if (!cancelled) {
          setPreviewUrl(objectUrl);
        }
      } catch (err) {
        console.error("PDF önizleme hatası:", err);
        if (!cancelled) setPreviewUrl("");
      }
    };

    loadPdfPreview();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, doc]);

  if (!open || !doc) return null;

  const durumText =
    doc.durum ||
    (doc.status === "arsiv" ? "Arşivde" : doc.status === "hazir" ? "Hazır" : "");

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
              {durumText ? ` · ${durumText}` : ""}
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
          {previewUrl ? (
            <iframe title="PDF Önizleme" src={previewUrl} className="w-full h-full" />
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-gray-500">
              Bu belge için PDF önizleme açılamadı.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RiskBelgeleri() {
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

  const fetchDocs = async () => {
    const token = getAuthToken();
    if (!token) {
      setDocs([]);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/documents`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("Server risk belgeleri çekilemedi:", text);
        setDocs([]);
        return;
      }

      const data = await res.json();
      const list = Array.isArray(data) ? data : data?.items || [];

      const riskList = list.filter((d) => {
        const category = String(d?.category || "").toLowerCase().trim();
        const subCategory = String(d?.subCategory || d?.sub_category || "")
          .toLowerCase()
          .trim();
        const title = String(d?.title || d?.baslik || "")
          .toLowerCase()
          .trim();

        return (
          category === "risk" ||
          category === "risk değerlendirmesi" ||
          category === "risk_degerlendirmesi" ||
          subCategory === "risk" ||
          subCategory === "degerlendirme" ||
          subCategory === "prosedur" ||
          subCategory === "ekip" ||
          subCategory === "dof" ||
          subCategory === "döf" ||
          title.includes("risk")
        );
      });

      setDocs(riskList);
    } catch (e) {
      console.error("Server risk belgeleri çekilemedi:", e);
      setDocs([]);
    }
  };

  useEffect(() => {
    fetchDocs();

    const onRefresh = () => fetchDocs();
    window.addEventListener("ticari_docs_refresh", onRefresh);

    return () => {
      window.removeEventListener("ticari_docs_refresh", onRefresh);
    };
  }, [selectedFirm?.id, selectedFirm?._id]);

  const updateDocStatusOnServer = async (doc, nextStatus) => {
    const token = getAuthToken();
    if (!token) {
      openInfo("Hata", "Token bulunamadı.");
      return false;
    }

    const docId = doc.id || doc._id;
    if (!docId) {
      openInfo("Hata", "Belge ID bulunamadı.");
      return false;
    }

    try {
      const res = await fetch(`${API_BASE}/documents/${docId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          durum: nextStatus === "arsiv" ? "Arşivde" : "Hazır",
          status: nextStatus,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        openInfo("Hata", `Belge durumu güncellenemedi.\n${text.slice(0, 200)}`);
        return false;
      }

      setDocs((prev) =>
        prev.map((d) =>
          String(d.id || d._id) === String(docId)
            ? {
                ...d,
                durum: nextStatus === "arsiv" ? "Arşivde" : "Hazır",
                status: nextStatus,
              }
            : d
        )
      );

      window.dispatchEvent(new Event("ticari_docs_refresh"));
      return true;
    } catch (e) {
      console.error("Belge durum güncelleme hatası:", e);
      openInfo("Hata", "Belge durumu güncellenirken hata oluştu.");
      return false;
    }
  };

  const uniqueYears = useMemo(() => {
    const years = Array.from(
      new Set(docs.map(getDocYear).filter((y) => Number.isFinite(y)))
    );
    years.sort((a, b) => Number(b) - Number(a));
    return years;
  }, [docs]);

  const uniqueDurum = useMemo(() => {
    const durumlar = Array.from(
      new Set(
        docs
          .map((d) =>
            d?.durum || (d?.status === "arsiv" ? "Arşivde" : d?.status === "hazir" ? "Hazır" : "")
          )
          .filter(Boolean)
      )
    );

    if (durumlar.length === 0) return ["Hazır", "Arşivde"];
    return durumlar;
  }, [docs]);

  const filteredDocs = useMemo(() => {
    return docs
      .filter((d) => {
        const activeFirmId = normalizeFirmaId(selectedFirm);
        const docFirmaIdStr = normalizeFirmaId(
          d?.firmaId ||
            d?.firma ||
            d?.firmaRef ||
            d?.firmaBilgisi ||
            d
        );

        if (activeFirmId && docFirmaIdStr && docFirmaIdStr !== activeFirmId) {
          return false;
        }

        const year = getDocYear(d);
        if (yilFilter !== "Tüm" && String(year) !== String(yilFilter)) return false;

        const t = inferBelgeTuru(d);
        if (belgeTurFilter !== "Tüm" && t !== belgeTurFilter) return false;

        const durumValue =
          d.durum || (d.status === "arsiv" ? "Arşivde" : d.status === "hazir" ? "Hazır" : "");

        if (durumFilter !== "Tüm" && durumValue !== durumFilter) return false;

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
    const tur = inferBelgeTuru(doc);
    const tarihStr = toDisplayDate(doc.tarih || doc.createdAt) || "";
    const firmaAdi = doc.firmaAdi || selectedFirm?.firmaAdi || "Firma";
    const downloadName = buildDownloadFileName({ firmaAdi, tur, tarihStr });

    try {
      let res;

      const rawFileUrl =
        doc.fileUrl ||
        doc.url ||
        doc.pdfUrl ||
        doc.downloadUrl ||
        "";

      const directFileUrl = toAbsoluteFileUrl(rawFileUrl);

      if (directFileUrl) {
        res = await fetch(directFileUrl, { method: "GET" });
      } else {
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

        res = await fetch(`${API_BASE}/documents/${docId}/download`, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      if (!res.ok) throw new Error("PDF indirilemedi");

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.style.display = "none";
      link.href = blobUrl;
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 3000);
    } catch (e) {
      console.error("İndirme hatası:", e);
      openInfo("Hata", "Belge indirilemedi.");
    }
  };

  const handleArsivle = (doc) => {
    const durumText =
      doc.durum || (doc.status === "arsiv" ? "Arşivde" : doc.status === "hazir" ? "Hazır" : "");

    if (durumText === "Arşivde") return;

    openConfirm({
      title: "Uyarı",
      message:
        "Bu belge arşive alınacak ve kilitlenecek. Arşivlenen belge üzerinde değişiklik yapılamaz. Devam edilsin mi?",
      confirmText: "Arşivle",
      cancelText: "İptal",
      variant: "warning",
      onConfirm: async () => {
        await updateDocStatusOnServer(doc, "arsiv");
      },
    });
  };

  const handleGeriAl = (doc) => {
    const durumText =
      doc.durum || (doc.status === "arsiv" ? "Arşivde" : doc.status === "hazir" ? "Hazır" : "");

    if (durumText !== "Arşivde") return;

    openConfirm({
      title: "Uyarı",
      message:
        "Bu belge arşivden geri alınacak. Geri alındıktan sonra silme işlemi yapılabilir. Devam edilsin mi?",
      confirmText: "Geri Al",
      cancelText: "İptal",
      variant: "warning",
      onConfirm: async () => {
        await updateDocStatusOnServer(doc, "hazir");
      },
    });
  };

  const handleSil = (doc) => {
    const durumText =
      doc.durum || (doc.status === "arsiv" ? "Arşivde" : doc.status === "hazir" ? "Hazır" : "");

    if (durumText === "Arşivde") return;

    const roleNow = getRoleFromStorage();
    const demoUserNow = isDemoUser();
    const isTicariUser =
      isTicariRole(roleNow) &&
      !isAdminRole(roleNow) &&
      !demoUserNow;

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
        const token = getAuthToken();
        if (!token) {
          openInfo("Hata", "Token bulunamadı.");
          return;
        }

        const docId = doc.id || doc._id;
        if (!docId) {
          openInfo("Hata", "Belge ID bulunamadı.");
          return;
        }

        try {
          const res = await fetch(`${API_BASE}/documents/${docId}`, {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (!res.ok) {
            const text = await res.text();
            openInfo("Hata", `Server silme başarısız.\n${text.slice(0, 200)}`);
            return;
          }

          setDocs((prev) =>
            prev.filter((d) => String(d.id || d._id) !== String(docId))
          );

          openInfo("Bilgilendirme", "Belge silindi ✅");
          window.dispatchEvent(new Event("ticari_docs_refresh"));
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
          title="Risk Değerlendirme Belgeleri"
          subtitle="Belgeleri görmek için lütfen sağ üstten bir firma seçiniz."
        />
      </CardBox>
    );
  }

  return (
    <CardBox className="flex flex-col gap-4">
      <SectionTitle
        title="Risk Değerlendirme Belgeleri"
        subtitle={`${selectedFirm.firmaAdi} firmasına ait prosedür, risk değerlendirmesi, ekip ve DÖF belgeleri burada listelenir.`}
      />

      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
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
          {RISK_BELGE_TURLERI.map((t) => (
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
        <div className="block md:hidden">
          {filteredDocs.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">
              {selectedFirm.firmaAdi} için kayıtlı risk belgesi bulunamadı.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredDocs.map((doc) => {
                const type = inferBelgeTuru(doc);
                const durumText =
                  doc.durum || (doc.status === "arsiv" ? "Arşivde" : doc.status === "hazir" ? "Hazır" : "");
                const isArchived = durumText === "Arşivde";
                const dateText = toDisplayDate(doc.tarih || doc.createdAt);
                const preparedBy = getPreparedBy(doc);

                return (
                  <div
                    key={
                      doc._id ||
                      doc.id ||
                      `${doc.firmaId || "x"}-${doc.createdAt || doc.tarih || "t"}-${inferBelgeTuru(doc)}`
                    }
                    className="p-4 space-y-3"
                  >
                    <div>
                      <div className="text-sm font-semibold text-gray-900 break-words">
                        {doc.firmaAdi || selectedFirm.firmaAdi}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span
                          className={
                            "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold " +
                            TYPE_BADGE_CLASS(type)
                          }
                        >
                          {getBadgeLabel(type)}
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

                      {(() => {
                        const role = getRoleFromStorage();
                        const demoUser = isDemoUser();
                        const isTicariUser =
                          isTicariRole(role) && !isAdminRole(role) && !demoUser;

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
                          >
                            Sil
                          </button>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="hidden md:block">
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="min-w-full text-[12px]">
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
                      {selectedFirm.firmaAdi} için kayıtlı risk belgesi bulunamadı.
                    </td>
                  </tr>
                )}

                {filteredDocs.map((doc) => {
                  const type = inferBelgeTuru(doc);
                  const durumText =
                    doc.durum || (doc.status === "arsiv" ? "Arşivde" : doc.status === "hazir" ? "Hazır" : "");
                  const isArchived = durumText === "Arşivde";
                  const dateText = toDisplayDate(doc.tarih || doc.createdAt);
                  const preparedBy = getPreparedBy(doc);

                  return (
                    <tr
                      key={
                        doc._id ||
                        doc.id ||
                        `${doc.firmaId || "x"}-${doc.createdAt || doc.tarih || "t"}-${inferBelgeTuru(doc)}`
                      }
                      className="hover:bg-gray-50"
                    >
                      <td className="px-3 py-2 text-gray-900 font-medium truncate max-w-[280px]">
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
                            {getBadgeLabel(type)}
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
                            title="Önizle"
                          >
                            Önizle
                          </button>

                          <button
                            type="button"
                            onClick={() => handleIndir(doc)}
                            className="px-3 py-1 rounded-lg border text-[11px] text-gray-700 hover:bg-gray-100"
                            title="İndir"
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
                            const isTicariUser =
                              isTicariRole(role) && !isAdminRole(role) && !demoUser;

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