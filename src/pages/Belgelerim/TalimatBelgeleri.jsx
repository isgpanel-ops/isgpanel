import React, { useContext, useEffect, useMemo, useState } from "react";
import { FirmaContext } from "../../context/FirmaContext";
import { CardBox, SectionTitle } from "../../components/ui";
import ConfirmModal from "../../components/ui/ConfirmModal";

const TALIMAT_DOCS_KEY = "belgelerim_talimat_listesi";

// Talimatlar için türler
const TALIMAT_TURLER = ["Genel Talimatlar", "KKD", "Öneri Talimatı"];

const TYPE_BADGE_CLASS = (label) => {
  const l = String(label || "").toLowerCase();

  // ALT TÜRLER
  // ÖNCE spesifik olanlar
if (l.includes("inşaat") || l.includes("insaat")) return "bg-orange-100 text-orange-700";
if (l.includes("elektrik")) return "bg-indigo-100 text-indigo-700";
if (l.includes("yangın") || l.includes("yangin")) return "bg-red-100 text-red-700";

// SONRA ana türler
if (l.includes("kkd")) return "bg-cyan-100 text-cyan-700";
if (l.includes("öneri") || l.includes("oneri")) return "bg-amber-100 text-amber-800";

// EN SON genel
if (l === "genel talimatlar") return "bg-blue-100 text-blue-700";
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

/* ===================== PERSONEL ADI (EĞİTİM'DEKİ GİBİ SAĞLAM) ===================== */
const normalizeTR = (s) => String(s || "").toLowerCase().trim();

const pickFirst = (...vals) => {
  for (const v of vals) {
    const s = String(v ?? "").trim();
    if (s) return s;
  }
  return "";
};

const STOP_WORDS = [
  "talimat",
  "genel",
  "i̇ş",
  "is",
  "sağlığı",
  "sagligi",
  "güvenliği",
  "guvenligi",
  "prosedür",
  "prosedur",
  "form",
  "formu",
  "ek",
  "pdf",
];

const looksLikeDocTitle = (s) => {
  const low = normalizeTR(s);
  return STOP_WORDS.some((w) => low.includes(w));
};

const extractNameFromTitle = (t) => {
  const s = String(t || "").trim();
  if (!s) return "";

  const left = s.split("-")[0].trim();
  if (left && left.length <= 50) {
    const w = left.split(/\s+/).filter(Boolean);
    if (w.length >= 2 && w.length <= 4 && !looksLikeDocTitle(left)) return left;
  }

  const candidates = s
    .replace(/[(){}\[\],;:_]/g, " ")
    .split("-")
    .map((x) => x.trim())
    .filter(Boolean);

  for (const c of candidates) {
    if (!c || c.length > 60) continue;
    const w = c.split(/\s+/).filter(Boolean);
    if (w.length >= 2 && w.length <= 4 && !looksLikeDocTitle(c)) return c;
  }

  return "";
};

const extractNameFromFile = (doc) => {
  const cand = pickFirst(doc?.fileName, doc?.file_name, doc?.fileUrl, doc?.file_url, doc?.url);
  const s = String(cand || "").trim();
  if (!s) return "";

  const last = s.includes("/") ? s.split("/").pop() : s;

  let clean = last;
  try {
    clean = decodeURIComponent(last);
  } catch {}

  clean = clean.replace(/\.(pdf|docx?|xlsx?)$/i, "");
  return extractNameFromTitle(clean) || "";
};

const cleanName = (s) => {
  const x = String(s || "").trim();
  if (!x) return "";
  if (looksLikeDocTitle(x)) return "";
  return x;
};

const getPersonelAdSoyad = (doc) => {
  const direct = pickFirst(
    doc?.personName,
    doc?.personelAdSoyad,
    doc?.adSoyad,
    doc?.fullName,
    doc?.fullname,
    doc?.nameSurname,
    doc?.calisanAdSoyad,

    doc?.personel?.adSoyad,
    doc?.kisi?.adSoyad,
    doc?.person?.fullName,
    doc?.employee?.fullName,

    doc?.data?.personelAdSoyad,
    doc?.payload?.personelAdSoyad,
    doc?.meta?.personel?.adSoyad
  );

  const cleaned = cleanName(direct);
  if (cleaned) return cleaned;

  const t1 = cleanName(extractNameFromTitle(doc?.title || doc?.baslik));
  if (t1) return t1;

  const t2 = cleanName(extractNameFromFile(doc));
  if (t2) return t2;

  const prepared = cleanName(getPreparedBy(doc));
  if (prepared) return prepared;

  return "";
};

/* ===================== TÜR / ALT TÜR ===================== */

const mapTalimatBaseTur = (val) => {
  const v = normalizeTR(val);
  if (!v) return "";

  if (v === "talimat" || v === "instructions" || v === "instruction") return "";

  if (
    v.includes("kkd") ||
    v.includes("kişisel koruyucu donanım") ||
    v.includes("kisisel koruyucu donanim")
  ) {
    return "KKD";
  }

  if (v.includes("oneri_talimat") || v.includes("öneri") || v.includes("oneri")) {
    return "Öneri Talimatı";
  }

  if (
    v.includes("genel talimatlar") ||
    v === "genel talimat" ||
    (v.includes("genel") && v.includes("talimat"))
  ) {
    return "Genel Talimatlar";
  }

  return "";
};

const inferAltTurLabel = (doc) => {
  const raw = pickFirst(
    doc?.subCategory,
    doc?.sub_category,
    doc?.tur,
    doc?.kategori,
    doc?.belgeTuruAlt,
    doc?.belge_turu_alt,
    doc?.data?.subCategory,
    doc?.payload?.subCategory
  );

  const s = String(raw || "").trim();
  if (!s) return "";

  const low = normalizeTR(s);
  if (
    low === "talimat" ||
    low === "genel talimatlar" ||
    low === "öneri talimatı" ||
    low === "oneri talimati" ||
    low === "kkd"
  ) {
    return "";
  }

  return s;
};

const inferTur = (doc) => {
  const raw =
    doc?.belgeTuru ||
    doc?.belge_turu ||
    doc?.typeLabel ||
    doc?.docType ||
    doc?.documentType ||
    doc?.title ||
    doc?.baslik ||
    doc?.data?.belgeTuru ||
    doc?.payload?.belgeTuru ||
    "";

  const mapped = mapTalimatBaseTur(raw);
  if (mapped) return mapped;

  const fileHint = pickFirst(doc?.fileName, doc?.file_name, doc?.fileUrl, doc?.file_url, doc?.url);
  const mapped2 = mapTalimatBaseTur(fileHint);
  if (mapped2) return mapped2;

  if (normalizeTR(doc?.belgeTuru).includes("genel")) return "Genel Talimatlar";

  return "Genel Talimatlar";
};

const getTypeLabel = (doc) => {
  const base = inferTur(doc);
  const alt = inferAltTurLabel(doc);

  if (!alt) return base;

  const altNorm = String(alt || "").toLowerCase().trim();

  if (
    altNorm === "genel talimat" ||
    altNorm === "kkd" ||
    altNorm === "öneri talimatı" ||
    altNorm === "oneri talimati"
  ) {
    return base;
  }

  return alt;
};

/* ===================== İNDİR DOSYA ADI ===================== */
const sanitizeFileName = (s) =>
  (s || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const buildDownloadName = (doc) => {
  const personel = sanitizeFileName(getPersonelAdSoyad(doc) || "Personel");
  const tur = sanitizeFileName(getTypeLabel(doc) || "Talimat");
  const tarih = sanitizeFileName(toDisplayDate(doc.tarih || doc.createdAt));
  return `${personel} - ${tur} - ${tarih}.pdf`;
};

/* ================== ROLE + TOKEN HELPERS ================== */
const API_BASE =
  (import.meta.env.VITE_API_URL || "").trim().replace(/\/$/, "") ||
  "https://api.isgpanel.tr/api";

const getRoleFromStorage = () => {
  try {
    const activeEmail = localStorage.getItem("__isg_active_email_global");
    const u1 = activeEmail ? localStorage.getItem(`isgpanel:${activeEmail}:user`) : null;
    const u2 = localStorage.getItem("user") || sessionStorage.getItem("user");
    const u = JSON.parse(u1 || u2 || "null");
    return String(u?.role || "").toLowerCase().trim();
  } catch {
    return "";
  }
};

const isAdminRole = (r) =>
  r === "ticari_admin" || r === "admin" || r === "super_admin" || r === "superadmin";

const isBireyselRole = (r) => r === "bireysel";
const isTicariRole = (r) => String(r || "").startsWith("ticari");

function getAuthToken() {
  try {
    const activeEmail = localStorage.getItem("__isg_active_email_global");
    const u1 = activeEmail ? localStorage.getItem(`isgpanel:${activeEmail}:user`) : null;
    const u2 = localStorage.getItem("user") || sessionStorage.getItem("user");
    const u = JSON.parse(u1 || u2 || "null");

    const direct = u?.token || u?.accessToken || u?.jwt || u?.authToken;
    if (direct) return direct;

    return (
      localStorage.getItem("token") ||
      localStorage.getItem("accessToken") ||
      localStorage.getItem("jwt") ||
      localStorage.getItem("authToken")
    );
  } catch {
    return null;
  }
}

/* ================= PREVIEW MODAL ================= */

function PreviewModal({ open, doc, onClose }) {
  if (!open || !doc) return null;

  const fileUrl = doc.__previewUrl || "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-4xl rounded-2xl bg-white shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <div className="text-sm font-semibold truncate">
            {getPersonelAdSoyad(doc) || "PERSONEL"} · {getTypeLabel(doc)}
          </div>

          <button
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

/* ================= ANA SAYFA ================= */
export default function TalimatBelgeleri() {
  const { selectedFirm } = useContext(FirmaContext);

  const [docs, setDocs] = useState([]);
  const [yilFilter, setYilFilter] = useState("Tüm");
  const [turFilter, setTurFilter] = useState("Tüm");
  const [durumFilter, setDurumFilter] = useState("Tüm");
  const [search, setSearch] = useState("");

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState("");

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
    });
    setConfirmOpen(true);
  };

  const openConfirm = ({ title, message, onConfirm, confirmText, cancelText, variant = "warning" }) => {
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

const getDocId = (doc) => doc?._id || doc?.id || doc?.documentId || doc?.serverId || "";

const getDocFileUrl = (doc) =>
  doc?.absoluteUrl ||
  doc?.fileUrl ||
  doc?.url ||
  doc?.pdfUrl ||
  doc?.downloadUrl ||
  "";

const normalizeFileUrl = (url) => {
  const s = String(url || "").trim();
  if (!s) return "";
  if (s.startsWith("blob:")) return s;
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("/uploads")) return `https://api.isgpanel.tr${s}`;
  if (s.startsWith("/")) return `${API_BASE}${s}`;
  return `${API_BASE}/${s}`;
};

const getDownloadUrl = (doc) => {
  const directUrl = normalizeFileUrl(getDocFileUrl(doc));

  if (directUrl) return directUrl;

  const docId = getDocId(doc);
  if (docId && /^[a-f\d]{24}$/i.test(String(docId))) {
    return `${API_BASE}/documents/${docId}/download`;
  }

  return "";
};

const getPdfBlob = async (doc) => {
  const token = getAuthToken();
  const url = getDownloadUrl(doc);

  if (!url) throw new Error("PDF URL bulunamadı.");

  const res = await fetch(url, {
    headers: token && !String(url).startsWith("blob:")
      ? { Authorization: `Bearer ${token}` }
      : {},
  });

  if (!res.ok) {
    throw new Error("PDF alınamadı.");
  }

  const blob = await res.blob();

const contentType = String(res.headers.get("content-type") || "").toLowerCase();

if (!blob || blob.size === 0) {
  throw new Error("PDF boş geldi.");
}

if (contentType && !contentType.includes("pdf")) {
  throw new Error("PDF yerine farklı içerik geldi.");
}

return blob;
};

const openPreview = async (doc) => {
  try {
    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl);
    }

    const blob = await getPdfBlob(doc);
    const blobUrl = URL.createObjectURL(blob);

    setPreviewBlobUrl(blobUrl);
    setPreviewDoc({ ...doc, __previewUrl: blobUrl });
    setPreviewOpen(true);
  } catch (e) {
    console.error("Talimat önizleme hatası:", e);
    openInfo("Hata", "Belge önizlenemedi.");
  }
};

 const fetchDocs = async () => {
  const token = getAuthToken();

  let serverList = [];
  let localList = [];

  try {
    if (token) {
      const res = await fetch(`${API_BASE}/documents`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();

        serverList = Array.isArray(data)
          ? data
          : Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data?.documents)
          ? data.documents
          : Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data?.payload)
          ? data.payload
          : Array.isArray(data?.payload?.items)
          ? data.payload.items
          : Array.isArray(data?.payload?.documents)
          ? data.payload.documents
          : [];
      }
    }
  } catch (e) {
    console.error("Server talimat belgeleri çekilemedi:", e);
  }

  try {
    const raw = localStorage.getItem(TALIMAT_DOCS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    localList = Array.isArray(parsed) ? parsed : [];
  } catch {
    localList = [];
  }

  const role = getRoleFromStorage();

const allList = [
  ...serverList.map((d) => ({ ...d, __source: "server" })),
  ...localList.map((d) => ({ ...d, __source: "local" })),
];

  const talimat = allList.filter((d) => {
    const c = String(d?.category || "").toLowerCase();
    const belgeTuru = String(d?.belgeTuru || "").toLowerCase();
    const title = String(d?.title || d?.baslik || "").toLowerCase();
    const sub = String(d?.subCategory || d?.tur || d?.kategori || "").toLowerCase();

    return (
      c === "talimat" ||
      c === "kkd" ||
      belgeTuru.includes("talimat") ||
      belgeTuru.includes("kkd") ||
      title.includes("talimat") ||
      title.includes("kkd") ||
      sub.includes("talimat") ||
      sub.includes("kkd")
    );
  });

  setDocs(talimat);
};

 useEffect(() => {
  fetchDocs();

  const h = () => fetchDocs();

  window.addEventListener("ticari_docs_refresh", h);
  window.addEventListener("docs:lastChangeAt", h);

  return () => {
    window.removeEventListener("ticari_docs_refresh", h);
    window.removeEventListener("docs:lastChangeAt", h);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [selectedFirm?.id]);

  const persist = (next) => {
    setDocs(next);

    const role = getRoleFromStorage();
    if (!isBireyselRole(role)) return;

    try {
      localStorage.setItem(TALIMAT_DOCS_KEY, JSON.stringify(next));
    } catch {}
  };

  const uniqueYears = useMemo(() => {
    const years = Array.from(new Set(docs.map(getDocYear).filter(Boolean)));
    years.sort((a, b) => b - a);
    return years;
  }, [docs]);

  const uniqueDurum = useMemo(() => {
    const d = Array.from(new Set(docs.map((x) => x?.durum).filter(Boolean)));
    return d.length ? d : ["Hazır", "Arşivde"];
  }, [docs]);

  const uniqueTur = useMemo(() => {
    const t = Array.from(new Set(docs.map(inferTur).filter(Boolean)));
    const merged = Array.from(new Set([...TALIMAT_TURLER, ...t]));
    return merged;
  }, [docs]);

 const filteredDocs = useMemo(() => {
  return docs
    .filter((d) => {
      const activeFirmId = String(
        selectedFirm?.id || selectedFirm?._id || ""
      ).trim();

      const docFirmId = String(
        d?.firmaId?._id ||
        d?.firmaId?.id ||
        d?.firma?._id ||
        d?.firma?.id ||
        d?.firmaId ||
        d?.firma ||
        ""
      ).trim();

      if (activeFirmId) {
  if (!docFirmId) return false;
  if (docFirmId !== activeFirmId) return false;
}

      if (yilFilter !== "Tüm" && String(getDocYear(d)) !== String(yilFilter)) return false;
      if (turFilter !== "Tüm" && inferTur(d) !== turFilter) return false;
      if (durumFilter !== "Tüm" && d.durum !== durumFilter) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = `${getPersonelAdSoyad(d)} ${getTypeLabel(d)} ${toDisplayDate(
          d.tarih || d.createdAt
        )} ${getPreparedBy(d)}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    })
    .sort((a, b) =>
      (toIsoDate(b.tarih || b.createdAt) || "").localeCompare(
        toIsoDate(a.tarih || a.createdAt) || ""
      )
    );
}, [docs, selectedFirm, yilFilter, turFilter, durumFilter, search]);

 const handleIndir = async (doc) => {
  try {
    const blob = await getPdfBlob(doc);
    const blobUrl = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = buildDownloadName(doc);
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => {
      try {
        URL.revokeObjectURL(blobUrl);
      } catch {}
    }, 1500);
  } catch (e) {
    console.error("Talimat indirme hatası:", e);
    openInfo("Bilgilendirme", "Bu belge indirilemedi.");
  }
};

  const handleArsivle = (doc) => {
    if (doc.durum === "Arşivde") return;
    openConfirm({
      title: "Uyarı",
      message: "Bu belge arşive alınacak. Devam edilsin mi?",
      confirmText: "Arşivle",
      cancelText: "İptal",
      onConfirm: () => persist(docs.map((d) => (d.id === doc.id ? { ...d, durum: "Arşivde" } : d))),
    });
  };

  const handleGeriAl = (doc) => {
    if (doc.durum !== "Arşivde") return;
    openConfirm({
      title: "Uyarı",
      message: "Bu belge arşivden geri alınacak. Devam edilsin mi?",
      confirmText: "Geri Al",
      cancelText: "İptal",
      onConfirm: () => persist(docs.map((d) => (d.id === doc.id ? { ...d, durum: "Hazır" } : d))),
    });
  };

 const handleSil = (doc) => {
  if (doc.durum === "Arşivde") return;

  const role = getRoleFromStorage();
  const isTicariUser = isTicariRole(role) && !isAdminRole(role);
  if (isTicariUser) return;

  openConfirm({
    title: "Uyarı",
    message: "Bu talimat belgesini silmek istiyor musunuz?",
    confirmText: "Sil",
    cancelText: "İptal",
    variant: "danger",
    onConfirm: async () => {
      const isLocalDoc = doc.__source === "local" || !doc._id;

      if (isLocalDoc) {
        const targetId = doc.id;

        try {
          const raw = localStorage.getItem(TALIMAT_DOCS_KEY);
          const list = raw ? JSON.parse(raw) : [];

          const next = Array.isArray(list)
            ? list.filter((d) => String(d.id) !== String(targetId))
            : [];

          localStorage.setItem(TALIMAT_DOCS_KEY, JSON.stringify(next));
          setDocs((prev) => prev.filter((d) => String(d.id) !== String(targetId)));

          openInfo("Bilgilendirme", "Belge silindi ✅");
        } catch (e) {
          console.error("Local silme hatası:", e);
          openInfo("Hata", "Belge silinirken hata oluştu.");
        }

        return;
      }

      const token = getAuthToken();
      const docId = doc._id;

      if (!token || !docId) {
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

        // Önce localStorage içindeki eski kopyayı da temizle
try {
  const raw = localStorage.getItem(TALIMAT_DOCS_KEY);
  const list = raw ? JSON.parse(raw) : [];

  const next = Array.isArray(list)
    ? list.filter((d) => {
        const samePerson =
          String(d.personelAdSoyad || d.adSoyad || "").toLocaleUpperCase("tr-TR") ===
          String(doc.personelAdSoyad || doc.personName || doc.adSoyad || "").toLocaleUpperCase("tr-TR");

        const sameTitle =
          String(d.baslik || d.title || "") === String(doc.baslik || doc.title || "");

        return !(samePerson && sameTitle);
      })
    : [];

  localStorage.setItem(TALIMAT_DOCS_KEY, JSON.stringify(next));
} catch {}

// Sonra ekrandan kaldır
setDocs((prev) =>
  prev.filter((d) => {
    const sameServer = String(d._id || "") === String(docId);

    const samePerson =
      String(d.personelAdSoyad || d.personName || d.adSoyad || "").toLocaleUpperCase("tr-TR") ===
      String(doc.personelAdSoyad || doc.personName || doc.adSoyad || "").toLocaleUpperCase("tr-TR");

    const sameTitle =
      String(d.baslik || d.title || "") === String(doc.baslik || doc.title || "");

    return !sameServer && !(samePerson && sameTitle);
  })
);

        try {
          localStorage.setItem("docs:lastChangeAt", String(Date.now()));
        } catch {}

        window.dispatchEvent(new Event("docs:lastChangeAt"));
        window.dispatchEvent(new Event("ticari_docs_refresh"));

        openInfo("Bilgilendirme", "Belge silindi ✅");
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
          title="Talimat & KKD Belgeleri"
          subtitle="Belgeleri görmek için lütfen sağ üstten bir firma seçiniz."
        />
      </CardBox>
    );
  }

  return (
    <CardBox className="flex flex-col gap-4">
      <SectionTitle
        title="Talimat & KKD Belgeleri"
        subtitle={`${selectedFirm.firmaAdi} firmasına ait talimat ve KKD belgeleri burada listelenir.`}
      />

      <div className="flex flex-col sm:flex-row flex-wrap gap-2">
        <input
          className="w-full sm:flex-1 min-w-[140px] px-3 py-2 border rounded-lg text-sm"
          placeholder="Ara (personel / tür / tarih / hazırlayan)"
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
          {uniqueTur.map((t) => (
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
        {/* MOBİL KART GÖRÜNÜM */}
        <div className="block md:hidden">
          {filteredDocs.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">
              Kayıt bulunamadı.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredDocs.map((doc) => {
                const label = getTypeLabel(doc);
                const isArchived = doc.durum === "Arşivde";

                const role = getRoleFromStorage();
                const isTicariUser = isTicariRole(role) && !isAdminRole(role);

                return (
                  <div key={doc.id || doc._id} className="p-4 space-y-3">
                    <div className="text-sm font-semibold text-gray-900 break-words">
                      {getPersonelAdSoyad(doc) || "-"}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${TYPE_BADGE_CLASS(label)}`}
                      >
                        {label}
                      </span>

                      {doc.durum && (
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${STATUS_BADGE_CLASS(doc.durum)}`}
                        >
                          {doc.durum}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-1 text-xs text-gray-600">
                      <div>
                        <span className="font-medium text-gray-800">Tarih:</span>{" "}
                        {toDisplayDate(doc.tarih || doc.createdAt) || "-"}
                      </div>
                      <div>
                        <span className="font-medium text-gray-800">Hazırlayan:</span>{" "}
                        {getPreparedBy(doc) || "-"}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                       onClick={() => openPreview(doc)}
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

                      {!isArchived && (
                        <button
                          onClick={() => handleArsivle(doc)}
                          className="flex-1 min-w-[110px] px-3 py-2 rounded-lg border text-xs"
                        >
                          Arşivle
                        </button>
                      )}

                      {isArchived && (
                        <button
                          onClick={() => handleGeriAl(doc)}
                          className="flex-1 min-w-[110px] px-3 py-2 rounded-lg border text-xs text-indigo-700"
                        >
                          Geri Al
                        </button>
                      )}

                      {isTicariUser ? null : (
                        <button
                          onClick={() => handleSil(doc)}
                          disabled={isArchived}
                          className={`flex-1 min-w-[110px] px-3 py-2 rounded-lg border text-xs ${
                            isArchived ? "text-gray-300 bg-gray-50 cursor-not-allowed" : "text-red-600"
                          }`}
                          title={isArchived ? "Arşivde silme yok: önce Geri Al" : "Sil"}
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

        {/* DESKTOP TABLO */}
        <div className="hidden md:block">
          <div className="max-h-[60vh] overflow-auto">
            <table className="min-w-[700px] w-full text-[12px]">
              <thead className="bg-gray-50 text-[11px] uppercase text-gray-500 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left">Personel</th>
                  <th className="px-3 py-2 text-left">Tür</th>
                  <th className="px-3 py-2 text-left">Tarih</th>
                  <th className="px-3 py-2 text-left">Hazırlayan</th>
                  <th className="px-3 py-2 text-right">İşlemler</th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {filteredDocs.map((doc) => {
                  const label = getTypeLabel(doc);
                  const isArchived = doc.durum === "Arşivde";

                  const role = getRoleFromStorage();
                  const isTicariUser = isTicariRole(role) && !isAdminRole(role);

                  return (
                    <tr key={doc.id || doc._id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium truncate max-w-[140px] sm:max-w-[220px]">
                        {getPersonelAdSoyad(doc) || "-"}
                      </td>

                      <td className="px-3 py-2 truncate max-w-[120px] sm:max-w-[200px]">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${TYPE_BADGE_CLASS(label)}`}
                        >
                          {label}
                        </span>
                      </td>

                      <td className="px-3 py-2 truncate max-w-[120px] sm:max-w-[200px]">
                        {toDisplayDate(doc.tarih || doc.createdAt)}
                      </td>

                      <td className="px-3 py-2 truncate max-w-[120px] sm:max-w-[200px]">
                        {getPreparedBy(doc) || "-"}
                      </td>

                      <td className="px-3 py-2 text-right">
                        <div className="flex flex-wrap sm:flex-nowrap justify-end gap-2">
                          <button
                            onClick={() => openPreview(doc)}
                            className="px-2 sm:px-3 py-1 border rounded text-[10px] sm:text-[11px] whitespace-nowrap"
                          >
                            Önizle
                          </button>

                          <button
                            onClick={() => handleIndir(doc)}
                            className="px-2 sm:px-3 py-1 border rounded text-[10px] sm:text-[11px] whitespace-nowrap"
                          >
                            İndir
                          </button>

                          {!isArchived && (
                            <button
                              onClick={() => handleArsivle(doc)}
                              className="px-2 sm:px-3 py-1 border rounded text-[10px] sm:text-[11px] whitespace-nowrap"
                            >
                              Arşivle
                            </button>
                          )}

                          {isArchived && (
                            <button
                              onClick={() => handleGeriAl(doc)}
                              className="px-2 sm:px-3 py-1 border rounded text-[10px] sm:text-[11px] whitespace-nowrap text-indigo-700"
                            >
                              Geri Al
                            </button>
                          )}

                          {isTicariUser ? null : (
                            <button
                              onClick={() => handleSil(doc)}
                              disabled={isArchived}
                              className={`px-2 sm:px-3 py-1 border rounded text-[10px] sm:text-[11px] whitespace-nowrap ${
                                isArchived ? "text-gray-300" : "text-red-600"
                              }`}
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

                {filteredDocs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-gray-400">
                      Kayıt bulunamadı.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <PreviewModal
  open={previewOpen}
  doc={previewDoc}
  onClose={() => {
    setPreviewOpen(false);
    setPreviewDoc(null);

    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl);
      setPreviewBlobUrl("");
    }
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
        onCancel={confirmData.onCancel}
      />
    </CardBox>
  );
}