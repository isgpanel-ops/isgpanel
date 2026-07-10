import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { FirmaContext } from "../../context/FirmaContext";
import { CardBox, SectionTitle } from "../../components/ui";
import ConfirmModal from "../../components/ui/ConfirmModal";

const DOCS_SYNC_KEY = "docs:lastChangeAt";
const EGITIM_DOCS_KEY = "belgelerim_egitim_listesi";

const EGITIM_TURLER = [
  "İşe Giriş",
  "Yüksekte Çalışma",
  "Çalışan Temsilcisi",
  "Destek Elemanı",
  "Acil Ekip",
];

const TYPE_BADGE_CLASS = (type) => {
  switch (type) {
    case "İşe Giriş":
      return "bg-blue-100 text-blue-700";
    case "Yüksekte Çalışma":
      return "bg-amber-100 text-amber-800";
    case "Çalışan Temsilcisi":
      return "bg-purple-100 text-purple-700";
    case "Destek Elemanı":
      return "bg-emerald-100 text-emerald-700";
    case "Acil Ekip":
      return "bg-rose-100 text-rose-700";
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

const normalizeTur = (s) => String(s || "").toLowerCase().trim();

const TUR_ALIASES = [
  ["işe giriş", "İşe Giriş"],
  ["ise giris", "İşe Giriş"],
  ["yüksekte çalışma", "Yüksekte Çalışma"],
  ["yuksekte calisma", "Yüksekte Çalışma"],
  ["çalışan temsilcisi", "Çalışan Temsilcisi"],
  ["calisan temsilcisi", "Çalışan Temsilcisi"],
  ["destek elemanı", "Destek Elemanı"],
  ["destek elemani", "Destek Elemanı"],
  ["acil ekip", "Acil Ekip"],
];

const mapTur = (val) => {
  const v = normalizeTur(val);
  if (!v) return "";

  const isDestekAtamaFormu =
    (v.includes("destek elemanı") || v.includes("destek elemani")) &&
    v.includes("atama formu");

  if (isDestekAtamaFormu) return "Destek Elemanı";

  if (
    v.includes("acil durum ekip formu") ||
    v.includes("acil durum ekip") ||
    v.includes("toplu acil ekip") ||
    v.includes("acil ekip") ||
    /^acil\b/.test(v)
  ) {
    return "Acil Ekip";
  }

  if (
    v.includes("çalışan temsilcisi") ||
    v.includes("calisan temsilcisi") ||
    v.includes("temsil")
  ) {
    return "Çalışan Temsilcisi";
  }

  if (v.includes("destek elemanı") || v.includes("destek elemani")) {
    return "Destek Elemanı";
  }

  for (const [k, out] of TUR_ALIASES) {
    if (v.includes(k)) return out;
  }

  return "";
};

const inferTur = (doc) => {
  const raw =
    doc?.belgeTuru ||
    doc?.belge_turu ||
    doc?.trainingType ||
    doc?.type ||
    doc?.subCategory ||
    doc?.sub_category ||
    "";

  const title = normalizeTur(doc?.baslik || doc?.title || "");
  const alt = normalizeTur(doc?.tur || doc?.kategori || doc?.belgeTuruAlt || "");

  const allTypeText = normalizeTur(
    [
      doc?.belgeTuru,
      doc?.belge_turu,
      doc?.trainingType,
      doc?.type,
      doc?.subCategory,
      doc?.sub_category,
      doc?.tur,
      doc?.kategori,
      doc?.belgeTuruAlt,
      doc?.belge_turu_alt,
      doc?.belgeAlt,
      doc?.docTypeAlt,
      doc?.documentTypeAlt,
      doc?.title,
      doc?.baslik,
    ]
      .filter(Boolean)
      .join(" | ")
  );

  const hasExplicitDestekAtama =
    (allTypeText.includes("destek elemanı") || allTypeText.includes("destek elemani")) &&
    allTypeText.includes("atama formu");

  if (hasExplicitDestekAtama) return "Destek Elemanı";

  const mapped = mapTur(raw);
  if (mapped) return mapped;

  const mapped2 = mapTur(title);
  if (mapped2) return mapped2;

  const mapped3 = mapTur(alt);
  if (mapped3) return mapped3;

  return "";
};

const API_BASE =
  (import.meta.env.VITE_API_URL || "").trim().replace(/\/+$/, "") ||
  "https://api.isgpanel.tr/api";

const getStoredUser = () => {
  try {
    const activeEmail = localStorage.getItem("__isg_active_email_global");
    const u1 = activeEmail ? localStorage.getItem(`isgpanel:${activeEmail}:user`) : null;
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

const isAdminRole = (r) =>
  r === "ticari_admin" || r === "admin" || r === "super_admin" || r === "superadmin";

const isTicariRole = (r) => String(r || "").startsWith("ticari");

function getAuthToken() {
  try {
    const u = getStoredUser();

    const direct = u?.token || u?.accessToken || u?.jwt || u?.authToken;
    if (direct) return direct;

    return (
      localStorage.getItem("token") ||
      localStorage.getItem("accessToken") ||
      localStorage.getItem("jwt") ||
      localStorage.getItem("authToken") ||
      sessionStorage.getItem("token") ||
      sessionStorage.getItem("accessToken") ||
      sessionStorage.getItem("jwt") ||
      sessionStorage.getItem("authToken") ||
      null
    );
  } catch {
    return null;
  }
}

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

const normalizeDocumentUrl = (raw) => {
  const s = String(raw || "").trim();
  if (!s) return "";

  if (s.startsWith("data:")) return s;
  if (s.startsWith("blob:")) return s;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("//")) return `${window.location.protocol}${s}`;

  if (s.startsWith("/uploads")) {
    return `https://api.isgpanel.tr${s}`;
  }

  if (s.startsWith("/documents/") && !s.endsWith("/download")) {
    return `${API_BASE}${s}/download`;
  }

  if (s.includes("/documents/") && !s.endsWith("/download")) {
    return `${API_BASE}${s.startsWith("/") ? "" : "/"}${s}/download`;
  }

  if (s.startsWith("/")) {
    return `${API_BASE}${s}`;
  }

  return `${API_BASE}/${s}`;
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
    doc?.path ||
    doc?.filePath ||
    doc?.pdfPath ||
    doc?.documentPath ||
    doc?.dosyaPath ||
    doc?.file?.url ||
    doc?.file?.path ||
    doc?.pdf?.url ||
    doc?.pdf?.path ||
    doc?.links?.download ||
    doc?.links?.preview ||
    doc?.document?.url ||
    doc?.document?.path ||
    doc?.evrakUrl ||
    doc?.evrakPath ||
    doc?.blobUrl ||
    ""
  );
};

const extractMaybeBase64 = (doc) => {
  return (
    doc?.pdfBase64 ||
    doc?.base64 ||
    doc?.pdfData ||
    doc?.pdfContent ||
    doc?.data?.pdfBase64 ||
    doc?.payload?.pdfBase64 ||
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

const inferAltTurLabel = (doc) => {
  const rawAll = normalizeTur(
  [
    doc?.type,
    doc?.belgeTuru,
    doc?.belge_turu,
    doc?.subCategory,
    doc?.sub_category,
    doc?.title,
    doc?.baslik,
    doc?.tur,
    doc?.kategori,
    doc?.belgeTuruAlt,
    doc?.belge_turu_alt,

    doc?.fileName,
    doc?.file_name,
    doc?.fileUrl,
    doc?.url,
    doc?.path,
  ]
    .filter(Boolean)
    .join(" ")
);

if (
  rawAll.includes("ise-baslama") ||
  rawAll.includes("ise_baslama") ||
  rawAll.includes("ise baslama") ||
  rawAll.includes("işe başlama")
) {
  return "İşe Başlama Formu";
}

  if (
    rawAll.includes("isegiris-test") ||
    rawAll.includes("işe giriş test") ||
    rawAll.includes("ise giris test") ||
    rawAll.includes("test sonuç") ||
    rawAll.includes("test sonuc") ||
    rawAll.includes("test")
  ) {
    return "Test";
  }

  const t = normalizeTur(
    doc?.belgeTuruAlt ||
      doc?.belge_turu_alt ||
      doc?.belgeAlt ||
      doc?.tur ||
      doc?.kategori ||
      doc?.docTypeAlt ||
      doc?.documentTypeAlt ||
      ""
  );

 if (t.includes("katılım") || t.includes("katilim")) return "Katılım Formu";

if (
  t.includes("işe başlama") ||
  t.includes("ise baslama")
) {
  return "İşe Başlama Formu";
}

if (t.includes("test")) return "Test";

if (t.includes("sertifika")) return "Sertifika";

  const title = normalizeTur(doc?.title || doc?.baslik || "");

  if (title.includes("katılım") || title.includes("katilim")) {
  return "Katılım Formu";
}

if (
  title.includes("işe başlama") ||
  title.includes("ise baslama")
) {
  return "İşe Başlama Formu";
}

if (title.includes("test")) {
  return "Test";
}

if (title.includes("sertifika")) {
  return "Sertifika";
}

  return "";
};

const getTypeLabel = (doc) => {
  let base = inferTur(doc);
  const alt = inferAltTurLabel(doc);

  if (!base) {
    const t = normalizeTur(
      doc?.title ||
        doc?.baslik ||
        doc?.belgeTuru ||
        doc?.type ||
        doc?.tur ||
        doc?.kategori
    );

    const isDestekAtamaFormu =
      (t.includes("destek elemanı") || t.includes("destek elemani")) &&
      t.includes("atama formu");

    if (isDestekAtamaFormu) base = "Destek Elemanı";
    else if (t.includes("acil ekip") || t.includes("toplu acil ekip") || /^acil\b/.test(t))
      base = "Acil Ekip";
    else if (t.includes("temsil")) base = "Çalışan Temsilcisi";
    else if (t.includes("destek")) base = "Destek Elemanı";
    else if (t.includes("yüksekte")) base = "Yüksekte Çalışma";
    else if (t.includes("işe") || t.includes("ise")) base = "İşe Giriş";
  }

  if (!base && alt) return alt;
  if (base && alt) return `${base} - ${alt}`;

  return base || "-";
};

const getDocYear = (doc) => {
  if (doc?.yil) return Number(doc.yil);
  if (doc?.year) return Number(doc.year);
  const iso = toIsoDate(doc?.tarih || doc?.tarihISO || doc?.createdAt);
  if (!iso) return undefined;
  return Number(iso.slice(0, 4));
};

const getPreparedBy = (doc) =>
  doc?.hazirlayan ||
  doc?.hazirlayanAdSoyad ||
  doc?.hazirlayanKisi ||
  doc?.olusturan ||
  doc?.olusturanAdSoyad ||
  doc?.preparedBy ||
  doc?.preparedByName ||
  doc?.createdByName ||
  doc?.createdBy?.name ||
  doc?.createdBy?.fullName ||
  doc?.createdBy?.adSoyad ||
  doc?.createdBy?.email ||
  doc?.userName ||
  doc?.user?.name ||
  doc?.user?.fullName ||
  doc?.user?.adSoyad ||
  doc?.user?.email ||
  doc?.data?.hazirlayan ||
  doc?.data?.preparedBy ||
  doc?.payload?.hazirlayan ||
  doc?.payload?.preparedBy ||
  doc?.meta?.hazirlayan ||
  doc?.meta?.preparedBy ||
  "";

const STOP_WORDS = [
  "eğitim",
  "egitim",
  "katılım",
  "katilim",
  "sertifika",
  "formu",
  "atama",
  "çalışan",
  "calisan",
  "temsilcisi",
  "destek",
  "elemanı",
  "elemani",
  "acil",
  "ekip",
  "işe",
  "ise",
  "giriş",
  "giris",
  "yüksekte",
  "yuksekte",
  "çalışma",
  "calisma",
];

const looksLikeDocTitle = (s) => {
  const low = normalizeTur(s);
  return STOP_WORDS.some((w) => low.includes(w));
};

const extractNameFromTitle = (t) => {
  const s = String(t || "").trim();
  if (!s) return "";

  const left = s.split("-")[0].trim();
  if (left && left.length <= 40) {
    const w = left.split(/\s+/).filter(Boolean);
    if (w.length >= 2 && w.length <= 4 && !looksLikeDocTitle(left)) return left;
  }

  const candidates = s
    .replace(/[(){}\[\],;:_]/g, " ")
    .split("-")
    .map((x) => x.trim())
    .filter(Boolean);

  for (const c of candidates) {
    if (!c || c.length > 50) continue;
    const w = c.split(/\s+/).filter(Boolean);
    if (w.length >= 2 && w.length <= 4 && !looksLikeDocTitle(c)) return c;
  }

  return "";
};

const pickFirst = (...vals) => {
  for (const v of vals) {
    const s = String(v ?? "").trim();
    if (s) return s;
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
    doc?.employeeName,
    doc?.employee_full_name,
    doc?.employee_fullname,
    doc?.employee_fullName,
    doc?.fullName,
    doc?.fullname,
    doc?.nameSurname,
    doc?.adSoyadTR,
    doc?.calisanAdSoyad,
    doc?.calisanAdi,
    doc?.employeeFullName,
    doc?.personFullName,
    doc?.personelSoyad ? `${doc?.personelAd || ""} ${doc?.personelSoyad}` : "",
    doc?.personel?.adSoyad,
    doc?.personel?.fullName,
    doc?.kisi?.adSoyad,
    doc?.kisi?.fullName,
    doc?.person?.name,
    doc?.person?.fullName,
    doc?.employee?.name,
    doc?.employee?.fullName,
    doc?.data?.personName,
    doc?.data?.personelAdSoyad,
    doc?.data?.adSoyad,
    doc?.data?.fullName,
    doc?.payload?.personName,
    doc?.payload?.personelAdSoyad,
    doc?.payload?.adSoyad,
    doc?.payload?.fullName,
    doc?.meta?.personName,
    doc?.meta?.personelAdSoyad,
    doc?.meta?.adSoyad,
    doc?.meta?.fullName,
    doc?.meta?.personel?.adSoyad,
    doc?.meta?.personel?.fullName
  );

  const cleaned = cleanName(direct);
  if (cleaned) return cleaned;

  const t1 = cleanName(extractNameFromTitle(doc?.title || doc?.baslik));
  if (t1) return t1;

  const t2 = cleanName(extractNameFromFile(doc));
  if (t2) return t2;

  const fallbackTitle =
    doc?.title || doc?.baslik || doc?.subCategory || doc?.sub_category || "";

  return fallbackTitle || "";
};

const sanitizeFileName = (s) =>
  String(s || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const buildDownloadName = (doc) => {
  const personel = sanitizeFileName(getPersonelAdSoyad(doc) || "Personel");
  const tur = sanitizeFileName(getTypeLabel(doc) || "Egitim");
  const tarih = sanitizeFileName(toDisplayDate(doc.tarih || doc.createdAt));
  return `${personel} - ${tur} - ${tarih}.pdf`;
};

const isMongoObjectId = (value) =>
  /^[a-f\d]{24}$/i.test(String(value || "").trim());

const getDocumentServerId = (doc) => {
  const candidates = [doc?._id, doc?.documentId, doc?.serverId];

  for (const candidate of candidates) {
    const v = String(candidate || "").trim();
    if (isMongoObjectId(v)) return v;
  }

  return "";
};

const getServerDownloadUrl = (doc) => {
  const docId = getDocumentServerId(doc);
  if (!docId) return "";
  return `${API_BASE}/documents/${docId}/download`;
};

const isBlobUrl = (value) => String(value || "").trim().startsWith("blob:");
const isHttpLikeUrl = (value) => /^(https?:)?\/\//i.test(String(value || "").trim());
const isServerRelativeUrl = (value) => String(value || "").trim().startsWith("/");

const hasUsablePdfSource = (doc) => {
  const rawUrl = String(extractMaybeUrl(doc) || "").trim();
  const maybeBase64 = extractMaybeBase64(doc);
  const hasServerId = !!getDocumentServerId(doc);

  if (isProbablyDataUrl(maybeBase64)) return true;
  if (isProbablyBase64(maybeBase64)) return true;
  if (hasServerId) return true;
  if (rawUrl) return true;

  return false;
};

function PreviewModal({ open, doc, onClose }) {
  if (!open || !doc) return null;

  const fileUrl = doc?.__previewUrl || "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-4xl rounded-2xl bg-white shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">
              {getPersonelAdSoyad(doc) || "PERSONEL"} · {getTypeLabel(doc)}
            </div>
            <div className="text-xs text-gray-500">
              {toDisplayDate(doc?.tarih || doc?.createdAt)}
              {getPreparedBy(doc) ? ` · Hazırlayan: ${getPreparedBy(doc)}` : ""}
              {doc?.durum ? ` · ${doc?.durum}` : ""}
            </div>
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
              Bu belge için geçerli bir PDF bağlantısı bulunamadı.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function EgitimBelgeleri() {
  const { selectedFirm } = useContext(FirmaContext);

  const [docs, setDocs] = useState([]);
  const [yilFilter, setYilFilter] = useState("Tüm");
  const [turFilter, setTurFilter] = useState("Tüm");
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

  const previewBlobCacheRef = useRef(new Map());

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
    confirmText,
    cancelText,
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

    try {
      let serverList = [];

      if (token) {
        const res = await fetch(`${API_BASE}/documents`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          serverList = Array.isArray(data)
            ? data
            : data?.items || data?.documents || [];
        }
      }

           // Eğitim belgelerinde kaynak artık server.
      // Ticari kullanıcıda aynı belge hem server hem localStorage’dan geldiği için çift kayıt oluşuyordu.
      let localList = [];

      const selectedFirmId = normalizeFirmaId(selectedFirm);

      const normalizeDoc = (d, source = "server") => {
        const rawServerIdCandidates = [d?._id, d?.documentId, d?.serverId];
        const realServerId =
          rawServerIdCandidates
            .map((x) => String(x || "").trim())
            .find((x) => isMongoObjectId(x)) || "";

        const resolvedId =
          realServerId ||
          String(d?.id || "").trim() ||
          `${source}_${normalizeFirmaId(d?.firmaId || d?.companyId || d?.firma)}_${
            d?.fileName || d?.title || d?.baslik || d?.createdAt || Date.now()
          }`;

        return {
          ...d,
          __source: source,
          id: resolvedId,
          _id: realServerId,
          documentId: realServerId,
          serverId: realServerId,

          firmaId: normalizeFirmaId(d?.firmaId || d?.companyId || d?.firma || d?.firmaRef || d),
          firmaAdi: d?.firmaAdi || d?.firma?.firmaAdi || d?.companyName || "",
                    title: d?.title || d?.baslik || "",
          baslik: d?.baslik || d?.title || "",

          hazirlayan:
            d?.hazirlayan ||
            d?.hazirlayanAdSoyad ||
            d?.hazirlayanKisi ||
            d?.olusturan ||
            d?.olusturanAdSoyad ||
            d?.preparedBy ||
            d?.preparedByName ||
            d?.createdByName ||
            d?.createdBy?.name ||
            d?.createdBy?.fullName ||
            d?.createdBy?.adSoyad ||
            d?.createdBy?.email ||
            d?.userName ||
            d?.user?.name ||
            d?.user?.fullName ||
            d?.user?.adSoyad ||
            d?.user?.email ||
            d?.data?.hazirlayan ||
            d?.data?.preparedBy ||
            d?.payload?.hazirlayan ||
            d?.payload?.preparedBy ||
            d?.meta?.hazirlayan ||
            d?.meta?.preparedBy ||
            "",

          createdAt: d?.createdAt || new Date().toISOString(),
          tarih: d?.tarih || d?.tarihISO || d?.dateISO || d?.createdAt || "",
          tarihISO: d?.tarihISO || d?.dateISO || toIsoDate(d?.tarih || d?.createdAt) || "",
          durum:
            d?.durum ||
            (d?.status === "arsiv" || d?.status === "arsivde" ? "Arşivde" : "Hazır"),
          status: d?.status || (d?.durum === "Arşivde" ? "arsivde" : "hazir"),

          fileUrl:
            d?.fileUrl ||
            d?.url ||
            d?.pdfUrl ||
            d?.file?.url ||
            d?.pdf?.url ||
            d?.document?.url ||
            "",
          pdfUrl:
            d?.pdfUrl ||
            d?.fileUrl ||
            d?.url ||
            d?.pdf?.url ||
            d?.document?.url ||
            "",
          url:
            d?.url ||
            d?.fileUrl ||
            d?.pdfUrl ||
            d?.document?.url ||
            "",
          path:
            d?.path ||
            d?.filePath ||
            d?.pdfPath ||
            d?.documentPath ||
            d?.file?.path ||
            d?.pdf?.path ||
            d?.document?.path ||
            "",
          pdfBase64:
            d?.pdfBase64 ||
            d?.base64 ||
            d?.pdfData ||
            d?.pdfContent ||
            d?.data?.pdfBase64 ||
            d?.payload?.pdfBase64 ||
            "",
        };
      };

      const allDocs = [
        ...serverList.map((d) => normalizeDoc(d, "server")),
        ...localList.map((d) => normalizeDoc(d, "local")),
      ];

      const seen = new Set();

      const merged = allDocs.filter((d) => {
        const uniqKey = [
          normalizeFirmaId(d?.firmaId),
          String(getPersonelAdSoyad(d) || "").toLocaleUpperCase("tr-TR"),
          String(
            d?.belgeTuru ||
              d?.belge_turu ||
              d?.trainingType ||
              d?.type ||
              d?.tur ||
              d?.kategori ||
              d?.subCategory ||
              d?.sub_category ||
              d?.title ||
              d?.baslik ||
              ""
          ).toLocaleUpperCase("tr-TR"),
          String(toIsoDate(d?.tarih || d?.tarihISO || d?.createdAt) || ""),
          String(d?._id || d?.id || d?.documentId || ""),
        ].join("||");

        if (seen.has(uniqKey)) return false;
        seen.add(uniqKey);
        return true;
      });

      const egitim = merged.filter((d) => {
        const category = normalizeTur(d?.category);
        const subCategory = normalizeTur(d?.subCategory || d?.sub_category);
        const type = normalizeTur(
          d?.belgeTuru ||
            d?.belge_turu ||
            d?.trainingType ||
            d?.type ||
            d?.tur ||
            d?.kategori
        );

        const firmaId = normalizeFirmaId(
          d?.firmaId || d?.companyId || d?.firma || d?.firmaRef || d
        );

        const firmMatch =
          !selectedFirmId
            ? true
            : !!firmaId && firmaId === selectedFirmId;

        const inferredType = inferTur(d);

        const hasExplicitEgitimType =
          type.includes("egitim") ||
          type.includes("eğitim") ||
          type.includes("ise giris") ||
          type.includes("işe giriş") ||
          type.includes("yuksekte") ||
          type.includes("yüksekte") ||
          type.includes("temsilci") ||
          type.includes("destek elemani") ||
          type.includes("destek elemanı") ||
          type.includes("acil ekip") ||
          type.includes("acil durum ekip");

        const hasValidInferredType = EGITIM_TURLER.includes(inferredType);

        const isEgitimCategory =
          category === "egitim" ||
          category === "eğitim" ||
          subCategory === "egitim" ||
          subCategory === "eğitim";

        const titleText = normalizeTur(d?.title || d?.baslik || "");
        const categoryText = normalizeTur(
          d?.category ||
            d?.kategori ||
            d?.mainCategory ||
            d?.documentCategory ||
            ""
        );

        const subCategoryText = normalizeTur(
          d?.subCategory ||
            d?.sub_category ||
            d?.belgeTuruAlt ||
            d?.belge_turu_alt ||
            ""
        );

        const hasEgitimKeywordAnywhere =
          hasExplicitEgitimType ||
          titleText.includes("egitim") ||
          titleText.includes("eğitim") ||
          titleText.includes("ise giris") ||
          titleText.includes("işe giriş") ||
          titleText.includes("yuksekte") ||
          titleText.includes("yüksekte") ||
          titleText.includes("temsilci") ||
          titleText.includes("destek elemani") ||
          titleText.includes("destek elemanı") ||
          titleText.includes("acil ekip") ||
          titleText.includes("sertifika") ||
          subCategoryText.includes("egitim") ||
          subCategoryText.includes("eğitim") ||
          subCategoryText.includes("sertifika") ||
          categoryText.includes("egitim") ||
          categoryText.includes("eğitim");

        const isYillikDoc =
          categoryText === "yillik" ||
          subCategoryText === "yillik" ||
          titleText.includes("yıllık eğitim planı") ||
          titleText.includes("yillik egitim plani") ||
          titleText.includes("yıllık plan") ||
          titleText.includes("yillik plan") ||
          type.includes("yep") ||
          type.includes("yçp") ||
          type.includes("ycp") ||
          type.includes("ydr");

        const isAcilDurumDoc =
          categoryText === "acil_durum" ||
          categoryText === "acil durum" ||
          subCategoryText === "acil_durum" ||
          subCategoryText === "acil durum" ||
          titleText.includes("acil durum eylem planı") ||
          titleText.includes("acil durum eylem plani") ||
          (
            titleText.includes("acil durum") &&
            !titleText.includes("acil ekip") &&
            !titleText.includes("acil durum ekip formu") &&
            !titleText.includes("acil durum ekip")
          );

        const isEgitimDoc =
          !isYillikDoc &&
          !isAcilDurumDoc &&
          (
            isEgitimCategory ||
            hasValidInferredType ||
            hasEgitimKeywordAnywhere
          );

        return firmMatch && isEgitimDoc;
      });

      setDocs(egitim);
    } catch (e) {
      console.error("Eğitim belgeleri çekilemedi:", e);
      setDocs([]);
    }
  };

  useEffect(() => {
    fetchDocs();

    const h = () => fetchDocs();

    const onStorage = (e) => {
      if (e.key === DOCS_SYNC_KEY || e.key === EGITIM_DOCS_KEY) fetchDocs();
    };

    window.addEventListener("ticari_docs_refresh", h);
    window.addEventListener(DOCS_SYNC_KEY, h);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("ticari_docs_refresh", h);
      window.removeEventListener(DOCS_SYNC_KEY, h);
      window.removeEventListener("storage", onStorage);

      try {
        for (const url of previewBlobCacheRef.current.values()) {
          URL.revokeObjectURL(url);
        }
        previewBlobCacheRef.current.clear();
      } catch {}
    };
  }, [selectedFirm?.id, selectedFirm?._id]);

  const uniqueYears = useMemo(() => {
    const years = Array.from(new Set(docs.map(getDocYear).filter(Boolean)));
    years.sort((a, b) => b - a);
    return years;
  }, [docs]);

  const uniqueDurum = useMemo(() => {
    const d = Array.from(
      new Set(
        docs
          .map((x) =>
            x?.durum ||
            (x?.status === "arsiv" || x?.status === "arsivde"
              ? "Arşivde"
              : x?.status === "hazir"
                ? "Hazır"
                : "")
          )
          .filter(Boolean)
      )
    );
    return d.length ? d : ["Hazır", "Arşivde"];
  }, [docs]);

  const filteredDocs = useMemo(() => {
    const selectedFirmId = normalizeFirmaId(selectedFirm);

    return docs
      .filter((d) => {
        const firmaId = normalizeFirmaId(
          d?.firmaId || d?.companyId || d?.firma || d?.firmaRef || d
        );

        const firmaAdiText = normalizeTur(
          d?.firmaAdi || d?.firma?.firmaAdi || d?.companyName || ""
        );

        const selectedFirmaAdiText = normalizeTur(selectedFirm?.firmaAdi || "");

        const firmMatch =
          !selectedFirmId ||
          !firmaId ||
          firmaId === selectedFirmId ||
          (selectedFirmaAdiText && firmaAdiText && firmaAdiText === selectedFirmaAdiText);

        if (!firmMatch) return false;
        if (yilFilter !== "Tüm" && String(getDocYear(d)) !== String(yilFilter)) return false;
        if (turFilter !== "Tüm" && inferTur(d) !== turFilter) return false;

        const durumValue =
          d?.durum ||
          (d?.status === "arsiv" || d?.status === "arsivde"
            ? "Arşivde"
            : d?.status === "hazir"
              ? "Hazır"
              : "");

        if (durumFilter !== "Tüm" && durumValue !== durumFilter) return false;

        if (search.trim()) {
          const q = search.toLowerCase();
          const hay =
            `${getPersonelAdSoyad(d)} ${getTypeLabel(d)} ${toDisplayDate(
              d.tarih || d.createdAt
            )} ${getPreparedBy(d)} ${durumValue}`.toLowerCase();

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

 const getResolvedCandidates = (doc) => {
  const raw = String(extractMaybeUrl(doc) || "").trim();
  const normalized = raw ? normalizeDocumentUrl(raw) : "";
  const serverId = getDocumentServerId(doc);
  const serverDownload = serverId ? getServerDownloadUrl(doc) : "";

  const strongCandidates = [];
  const weakCandidates = [];

  if (serverDownload) strongCandidates.push(serverDownload);

  if (raw && !isBlobUrl(raw)) {
    if (isHttpLikeUrl(raw) || isServerRelativeUrl(raw)) {
      strongCandidates.push(raw);
    }
  }

  if (normalized && !isBlobUrl(normalized)) {
    if (isHttpLikeUrl(normalized) || isServerRelativeUrl(normalized)) {
      strongCandidates.push(normalized);
    }
  }

  if (raw && isBlobUrl(raw)) weakCandidates.push(raw);
  if (normalized && isBlobUrl(normalized)) weakCandidates.push(normalized);

  return [...new Set([...strongCandidates, ...weakCandidates])].filter(
    (x) =>
      x &&
      !String(x).includes("/documents/undefined/download") &&
      !String(x).endsWith("/documents//download")
  );
};

 const fetchDocumentBlob = async (doc) => {
  const token = getAuthToken();
  const candidates = getResolvedCandidates(doc);

  for (const url of candidates) {
    try {
      const isBlob = isBlobUrl(url);

      const res = await fetch(url, {
        method: "GET",
        headers: !isBlob && token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) continue;

      const blob = await res.blob();
      if (blob && blob.size > 0) {
        return blob;
      }
    } catch (err) {
      console.error("Belge fetch denemesi başarısız:", url, err);
    }
  }

  const maybeBase64 = extractMaybeBase64(doc);

  if (isProbablyDataUrl(maybeBase64)) {
    const res = await fetch(maybeBase64);
    return await res.blob();
  }

  if (isProbablyBase64(maybeBase64)) {
    const clean = maybeBase64.replace(/\s/g, "");
    const byteChars = atob(clean);
    const byteNumbers = new Array(byteChars.length);

    for (let i = 0; i < byteChars.length; i += 1) {
      byteNumbers[i] = byteChars.charCodeAt(i);
    }

    return new Blob([new Uint8Array(byteNumbers)], {
      type: "application/pdf",
    });
  }

  throw new Error("Geçerli PDF kaynağı bulunamadı");
};

 const resolvePdfUrl = async (doc) => {
  const cacheKey =
    doc?._id ||
    doc?.id ||
    `${normalizeFirmaId(doc?.firmaId || doc?.firma)}_${doc?.createdAt || doc?.tarih || ""}_${getTypeLabel(doc)}`;

  if (cacheKey && previewBlobCacheRef.current.has(cacheKey)) {
    return previewBlobCacheRef.current.get(cacheKey);
  }

  const directDataUrl = extractMaybeBase64(doc);
  if (isProbablyDataUrl(directDataUrl)) {
    return directDataUrl;
  }

  const candidates = getResolvedCandidates(doc);

  for (const url of candidates) {
  if (!url) continue;

  // ❗ Artık direkt URL dönmüyoruz
  // Çünkü /download endpoint iframe'de açılmaz
  try {
    const blob = await fetchDocumentBlob(doc);
    const blobUrl = URL.createObjectURL(blob);

    if (cacheKey) {
      previewBlobCacheRef.current.set(cacheKey, blobUrl);
    }

    return blobUrl;
  } catch (e) {
    console.error("Preview blob oluşturulamadı:", e);
  }
}

  

  const blob = await fetchDocumentBlob(doc);
  const blobUrl = URL.createObjectURL(blob);

  if (cacheKey) {
    previewBlobCacheRef.current.set(cacheKey, blobUrl);
  }

  return blobUrl;
};

  const openPreview = async (doc) => {
    if (!hasUsablePdfSource(doc)) {
      openInfo("Bilgilendirme", "Bu kayıt için geçerli PDF kaynağı bulunmuyor.");
      return;
    }

    try {
      const resolvedUrl = await resolvePdfUrl(doc);
      setPreviewDoc({ ...doc, __previewUrl: resolvedUrl });
      setPreviewOpen(true);
    } catch (e) {
      console.error("Önizleme hatası:", e);
      openInfo("Hata", "Belge önizlenemedi.");
    }
  };

 const handleIndir = async (doc) => {
  if (!hasUsablePdfSource(doc)) {
    openInfo("Bilgilendirme", "Bu kayıt için indirilebilir PDF kaynağı bulunmuyor.");
    return;
  }

  try {
    console.log("[INDIR_DOC_DEBUG]", {
      id: doc?._id || doc?.id,
      title: doc?.title || doc?.baslik,
      fileUrl: doc?.fileUrl,
      pdfUrl: doc?.pdfUrl,
      url: doc?.url,
      path: doc?.path,
      documentPath: doc?.documentPath,
      serverId: getDocumentServerId(doc),
      resolvedCandidates: getResolvedCandidates(doc),
    });

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
    openInfo("Bilgilendirme", "Bu belge indirilemedi.");
  }
};

  const handleArsivle = (doc) => {
    const isArchived =
      doc?.durum === "Arşivde" || doc?.status === "arsiv" || doc?.status === "arsivde";
    if (isArchived) return;

    if (!doc?._id) {
      openInfo("Bilgilendirme", "Local kayıtlarda arşivleme desteklenmiyor.");
      return;
    }

    openConfirm({
      title: "Uyarı",
      message: "Bu belge arşive alınacak. Devam edilsin mi?",
      confirmText: "Arşivle",
      cancelText: "İptal",
      onConfirm: async () => {
        const token = getAuthToken();
        const docId = doc?._id;

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
            openInfo("Hata", "Belge arşivlenemedi.");
            return;
          }

          setDocs((prev) =>
            prev.map((d) =>
              String(d?._id || d?.id) === String(docId)
                ? { ...d, durum: "Arşivde", status: "arsivde" }
                : d
            )
          );

          try {
            localStorage.setItem(DOCS_SYNC_KEY, String(Date.now()));
          } catch {}
          window.dispatchEvent(new Event("ticari_docs_refresh"));
          window.dispatchEvent(new Event(DOCS_SYNC_KEY));
        } catch (e) {
          console.error("Arşivleme hatası:", e);
          openInfo("Hata", "Belge arşivlenirken hata oluştu.");
        }
      },
    });
  };

  const handleGeriAl = (doc) => {
    const isArchived =
      doc?.durum === "Arşivde" || doc?.status === "arsiv" || doc?.status === "arsivde";
    if (!isArchived) return;

    if (!doc?._id) {
      openInfo("Bilgilendirme", "Local kayıtlarda geri alma desteklenmiyor.");
      return;
    }

    openConfirm({
      title: "Uyarı",
      message: "Bu belge arşivden geri alınacak. Devam edilsin mi?",
      confirmText: "Geri Al",
      cancelText: "İptal",
      onConfirm: async () => {
        const token = getAuthToken();
        const docId = doc?._id;

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
            openInfo("Hata", "Belge geri alınamadı.");
            return;
          }

          setDocs((prev) =>
            prev.map((d) =>
              String(d?._id || d?.id) === String(docId)
                ? { ...d, durum: "Hazır", status: "hazir" }
                : d
            )
          );

          try {
            localStorage.setItem(DOCS_SYNC_KEY, String(Date.now()));
          } catch {}
          window.dispatchEvent(new Event("ticari_docs_refresh"));
          window.dispatchEvent(new Event(DOCS_SYNC_KEY));
        } catch (e) {
          console.error("Geri alma hatası:", e);
          openInfo("Hata", "Belge geri alınırken hata oluştu.");
        }
      },
    });
  };

  const handleSil = (doc) => {
    const isArchived =
      doc?.durum === "Arşivde" || doc?.status === "arsiv" || doc?.status === "arsivde";
    if (isArchived) return;

    const role = getRoleFromStorage();
    const isTicariUser = isTicariRole(role) && !isAdminRole(role);
    if (isTicariUser) return;

    openConfirm({
      title: "Uyarı",
      message: "Bu belgeyi silmek istiyor musunuz?",
      confirmText: "Sil",
      cancelText: "İptal",
      variant: "danger",
      onConfirm: async () => {
        const docId = doc?._id || doc?.id;
        if (!docId) {
          openInfo("Hata", "Belge ID bulunamadı.");
          return;
        }

        const isLocalDoc =
          doc?.__source === "local" ||
          !doc?._id;

        if (isLocalDoc) {
          try {
            const raw = localStorage.getItem(EGITIM_DOCS_KEY);
            const list = raw ? JSON.parse(raw) : [];
            const next = Array.isArray(list)
              ? list.filter((d) => String(d?.id) !== String(doc?.id))
              : [];

            localStorage.setItem(EGITIM_DOCS_KEY, JSON.stringify(next));
            setDocs((prev) =>
              prev.filter((d) => String(d?._id || d?.id) !== String(docId))
            );

            try {
              localStorage.setItem(DOCS_SYNC_KEY, String(Date.now()));
            } catch {}
            window.dispatchEvent(new Event(DOCS_SYNC_KEY));

            openInfo("Bilgilendirme", "Belge silindi ✅");
          } catch (e) {
            console.error("Local silme hatası:", e);
            openInfo("Hata", "Local belge silinirken hata oluştu.");
          }
          return;
        }

        const token = getAuthToken();
        if (!token) {
          openInfo("Hata", "Token bulunamadı.");
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

          setDocs((prev) => prev.filter((d) => String(d?._id || d?.id) !== String(docId)));
          openInfo("Bilgilendirme", "Belge silindi ✅");

          try {
            localStorage.setItem(DOCS_SYNC_KEY, String(Date.now()));
          } catch {}
          window.dispatchEvent(new Event("ticari_docs_refresh"));
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
          title="Eğitim & Sertifika Belgeleri"
          subtitle="Lütfen bir firma seçiniz."
        />
      </CardBox>
    );
  }

  return (
    <CardBox className="flex flex-col gap-4">
      <SectionTitle
        title="Eğitim & Sertifika Belgeleri"
        subtitle={`${selectedFirm.firmaAdi} firmasına ait eğitim belgeleri burada listelenir.`}
      />

      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
        <input
          className="w-full sm:flex-1 min-w-[140px] px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#042f4b]"
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
          {EGITIM_TURLER.map((t) => (
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
              Kayıt bulunamadı.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredDocs.map((doc) => {
                const type = inferTur(doc) || "-";
                const durumText =
                  doc?.durum ||
                  (doc?.status === "arsiv" || doc?.status === "arsivde"
                    ? "Arşivde"
                    : doc?.status === "hazir"
                      ? "Hazır"
                      : "");
                const isArchived = durumText === "Arşivde";
                const preparedBy = getPreparedBy(doc);
                const personel = getPersonelAdSoyad(doc) || "-";

                return (
                  <div key={doc?._id || doc?.id} className="p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-900 break-words">
                        {personel}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2">
                        <span
                          className={
                            "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold " +
                            TYPE_BADGE_CLASS(type)
                          }
                        >
                          {getTypeLabel(doc)}
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
                        <span className="font-medium text-gray-800">Tarih:</span>{" "}
                        {toDisplayDate(doc?.tarih || doc?.createdAt) || "-"}
                      </div>
                      <div>
                        <span className="font-medium text-gray-800">Hazırlayan:</span>{" "}
                        {preparedBy || "-"}
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
                        const isTicariUser = isTicariRole(role) && !isAdminRole(role);
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
          <div className="max-h-[60vh] overflow-auto">
            <table className="min-w-[700px] w-full text-[12px]">
              <thead className="bg-gray-50 text-[11px] uppercase text-gray-500 sticky top-0 z-10">
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
                  const type = inferTur(doc) || "-";
                  const isArchived =
                    doc?.durum === "Arşivde" ||
                    doc?.status === "arsiv" ||
                    doc?.status === "arsivde";

                  return (
                    <tr key={doc?._id || doc?.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium truncate max-w-[140px] sm:max-w-[220px]">
                        {getPersonelAdSoyad(doc) || "-"}
                      </td>

                      <td className="px-3 py-2 truncate max-w-[120px] sm:max-w-[240px]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${TYPE_BADGE_CLASS(
                              type
                            )}`}
                          >
                            {getTypeLabel(doc)}
                          </span>

                          {(doc?.durum || doc?.status) && (
                            <span
                              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${STATUS_BADGE_CLASS(
                                doc?.durum ||
                                  (doc?.status === "arsiv" || doc?.status === "arsivde"
                                    ? "Arşivde"
                                    : "Hazır")
                              )}`}
                            >
                              {doc?.durum ||
                                (doc?.status === "arsiv" || doc?.status === "arsivde"
                                  ? "Arşivde"
                                  : "Hazır")}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-3 py-2 whitespace-nowrap">
                        {toDisplayDate(doc.tarih || doc.createdAt)}
                      </td>

                      <td className="px-3 py-2">{getPreparedBy(doc) || "-"}</td>

                      <td className="px-3 py-2 text-right">
                        <div className="flex flex-wrap sm:flex-nowrap justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openPreview(doc)}
                            className="px-2 sm:px-3 py-1 border rounded text-[10px] sm:text-[11px] whitespace-nowrap text-gray-700 hover:bg-gray-100"
                          >
                            Önizle
                          </button>

                          <button
                            type="button"
                            onClick={() => handleIndir(doc)}
                            className="px-2 sm:px-3 py-1 border rounded text-[10px] sm:text-[11px] whitespace-nowrap text-gray-700 hover:bg-gray-100"
                          >
                            İndir
                          </button>

                          {!isArchived && (
                            <button
                              type="button"
                              onClick={() => handleArsivle(doc)}
                              className="px-2 sm:px-3 py-1 border rounded text-[10px] sm:text-[11px] whitespace-nowrap text-gray-700 hover:bg-gray-100"
                            >
                              Arşivle
                            </button>
                          )}

                          {isArchived && (
                            <button
                              type="button"
                              onClick={() => handleGeriAl(doc)}
                              className="px-3 py-1 border rounded text-[11px] text-indigo-700 hover:bg-indigo-50"
                            >
                              Geri Al
                            </button>
                          )}

                          {(() => {
                            const role = getRoleFromStorage();
                            const isTicariUser = isTicariRole(role) && !isAdminRole(role);
                            if (isTicariUser) return null;

                            return (
                              <button
                                type="button"
                                onClick={() => handleSil(doc)}
                                disabled={isArchived}
                                className={`px-3 py-1 border rounded text-[11px] ${
                                  isArchived
                                    ? "text-gray-300 bg-gray-50 cursor-not-allowed"
                                    : "text-red-600 hover:bg-red-50"
                                }`}
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