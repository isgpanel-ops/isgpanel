// src/pages/Egitim/IseGirisEgitimi.jsx
import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { SectionTitle, CardBox, PrimaryButton, Modal } from "../../components/ui";
import { FirmaContext } from "../../context/FirmaContext";
import ConfirmModal from "../../components/ui/ConfirmModal";

/* =========================
   ✅ GLOBAL STANDARD
   ========================= */
const DOCS_SYNC_KEY = "docs:lastChangeAt";

/* =========================
   ✅ LOGO + TOKEN HELPERS
   ========================= */
const toAbsoluteUrl = (base, url) => {
  if (!url) return "";
  if (url.startsWith("data:image")) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
};

const normalizeTC = (v) => (v || "").toString().replace(/\D/g, "").slice(0, 11);

const safeParseLS = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
};

function getAuthToken(userObj) {
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

    const fromUser =
      userObj?.token ||
      userObj?.accessToken ||
      userObj?.jwt ||
      userObj?.authToken;

    if (fromUser) return fromUser;

    const activeEmail =
      (typeof window !== "undefined" &&
        localStorage.getItem("__isg_active_email_global")) ||
      "";

    const email =
      userObj?.email ||
      userObj?.mail ||
      activeEmail ||
      (typeof window !== "undefined" ? localStorage.getItem("userEmail") : null);

    if (email) {
      const key = `isgpanel:${email}:token`;
      const t = localStorage.getItem(key);
      if (t) return t;
    }

    if (typeof window !== "undefined") {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (k.endsWith(":token")) {
          const t = localStorage.getItem(k);
          if (t) return t;
        }
      }
    }
  } catch {}

  return "";
}

function getBearerToken(userObj) {
  return getAuthToken(userObj);
}

const joinUrl = (root, path) => {
  const cleanRoot = String(root || "").replace(/\/+$/, "");
  const cleanPath = String(path || "").startsWith("/") ? path : `/${path}`;
  return `${cleanRoot}${cleanPath}`;
};

const getContentType = (res) =>
  String(res?.headers?.get("content-type") || "").toLowerCase();

const safeJsonParse = async (res) => {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    throw new Error(text || "Geçersiz JSON yanıtı");
  }
};

const requestWithFallback = async (
  apiRoots,
  path,
  options = {},
  parseAs = "json"
) => {
  let lastError = null;

  for (const root of apiRoots) {
    const url = joinUrl(root, path);

    try {
      const res = await fetch(url, options);

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        lastError = new Error(text || `${res.status} ${res.statusText}`);
        continue;
      }

      if (parseAs === "response") return res;
      if (parseAs === "blob") return await res.blob();
      if (parseAs === "text") return await res.text();

      const ct = getContentType(res);
      if (ct.includes("application/json")) {
        return await res.json();
      }

      return await safeJsonParse(res);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("İstek başarısız.");
};

/* ✅ dosya adı güvenli */
const safeFile = (s) =>
  (s || "")
    .toString()
    .trim()
    .toLocaleUpperCase("tr-TR")
    .replace(/\s+/g, " ")
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\.+$/g, "");

const trNow = () => new Date().toLocaleDateString("tr-TR");

const EGITIM_IMZA_FIELDS = [
  { key: "genel", label: "Genel" },
  { key: "teknik", label: "Teknik" },
  { key: "saglik", label: "Sağlık" },
  { key: "iseOzelRiskler", label: "İşe Özel Riskler" },
];

const ISE_GIRIS_TEST_SORULARI = [
  {
    soru: "İş sağlığı ve güvenliğinin temel amacı nedir?",
    secenekler: [
      "Çalışanların sağlık ve güvenliğini korumak",
      "Sadece üretimi artırmak",
      "Çalışma süresini uzatmak",
      "Maliyetleri tamamen sıfırlamak",
    ],
    dogru: 0,
  },
  {
    soru: "Kişisel koruyucu donanım ne zaman kullanılmalıdır?",
    secenekler: [
      "Sadece denetim günlerinde",
      "Riskler toplu korunma ile tamamen önlenemediğinde",
      "Sadece mesai bitiminde",
      "Yalnızca ofis çalışanlarında",
    ],
    dogru: 1,
  },
  {
    soru: "Acil durumda ilk yapılması gerekenlerden biri nedir?",
    secenekler: [
      "Panik yapmak",
      "Eşyaları toplamaya çalışmak",
      "Çalışmaya devam etmek",
      "Yetkililere haber vermek ve talimatlara uymak",
    ],
    dogru: 3,
  },
  {
    soru: "Elektrik panolarına yetkisiz müdahale edilmesi doğru mudur?",
    secenekler: ["Evet", "Hayır", "Sadece kısa süreliğine evet", "Malzeme varsa evet"],
    dogru: 1,
  },
  {
    soru: "Kaygan zeminde güvenli davranış hangisidir?",
    secenekler: [
      "Koşarak geçmek",
      "Görmezden gelmek",
      "Uyarı levhasını dikkate almak",
      "Telefonla yürümek",
    ],
    dogru: 2,
  },
  {
    soru: "Yangın söndürücülerin önü nasıl olmalıdır?",
    secenekler: [
      "Her zaman ulaşılabilir ve açık olmalıdır",      
      "Malzeme ile kapatılabilir",
      "Sadece depoda bulunmalıdır",
      "Kilitli dolapta erişilemez olmalıdır",
    ],
    dogru: 0,
  },
  {
    soru: "İş kazası veya ramak kala olay kime bildirilmelidir?",
    secenekler: [
      "Hiç kimseye",
      "Sosyal medyaya",
      "Sadece çalışma arkadaşına",
      "Yetkili amire/iş güvenliği sorumlusuna",
    ],
    dogru: 3,
  },
  {
    soru: "Makine koruyucuları çıkarılarak çalışmak güvenli midir?",
    secenekler: ["Evet", "Hayır", "Daha hızlı çalışılırsa evet", "Sadece deneyimli kişiler için evet"],
    dogru: 1,
  },
  {
    soru: "Yük kaldırırken doğru yöntem hangisidir?",
    secenekler: [
      "Belden eğilerek kaldırmak",
      "Tek elle hızlıca kaldırmak",
      "Dizleri bükerek ve yükü vücuda yakın tutarak kaldırmak",
      "Dönerek kaldırmak",
    ],
    dogru: 2,
  },
  {
    soru: "İşyerindeki uyarı levhaları ne için kullanılır?",
    secenekler: [
      "Dekorasyon için",
      "Risk ve güvenli davranışlar hakkında bilgi vermek için",
      "Sadece misafirler için",
      "Reklam amacıyla",
    ],
    dogru: 1,
  },
];

const getDeviceType = () => {
  try {
    const ua = navigator.userAgent || "";

    if (/tablet|ipad/i.test(ua)) return "tablet";
    if (/mobile|android|iphone/i.test(ua)) return "mobile";

    return "desktop";
  } catch {
    return "unknown";
  }
};

const createSignatureHash = async ({
  dataUrl,
  signerName,
  signedAt,
}) => {
  try {
    const raw = [
      signerName || "",
      signedAt || "",
      dataUrl || "",
    ].join("|");

    const encoder = new TextEncoder();

    const buffer = await crypto.subtle.digest(
      "SHA-256",
      encoder.encode(raw)
    );

    return Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return "";
  }
};

const createEmptySignatureRecord = () => ({
  dataUrl: "",
  createdAt: "",
  signedAt: "",
  signerName: "",
  signatureHash: "",
  deviceType: "",
});

const createEmptyImzaState = () => ({
  genel: null,
  teknik: null,
  saglik: null,
  iseOzelRiskler: null,
});

const getRequiredImzaKeysBySaat = (egitimBilgileri) => {
  const list = [];

  if (Number(egitimBilgileri?.genelSaat || 0) > 0) list.push("genel");
  if (Number(egitimBilgileri?.teknikSaat || 0) > 0) list.push("teknik");
  if (Number(egitimBilgileri?.saglikSaat || 0) > 0) list.push("saglik");
  if (Number(egitimBilgileri?.iseOzelRisklerSaat || 0) > 0) list.push("iseOzelRiskler");

  return list;
};

const getImzaProgress = (row, egitimBilgileri) => {
  const requiredKeys = getRequiredImzaKeysBySaat(egitimBilgileri);
  const total = requiredKeys.length;

  const completed = requiredKeys.filter(
    (key) => row?.imzalar?.[key]?.dataUrl
  ).length;

  return {
    completed,
    total,
    text: `${completed}/${total}`,
    requiredKeys,
  };
};

/* 🔥 Eğitim geçerlilik süresi hesabı */
const hesaplaGecerlilik = (bitis, tehlike) => {
  if (!bitis) return "";
  const d = new Date(bitis);
  if (Number.isNaN(d.getTime())) return "";

  const t = (tehlike || "").toLowerCase();
  let yil = 0;

  if (t.includes("az")) yil = 3;
  else if (t.includes("çok") || t.includes("cok")) yil = 1;
  else if (t.includes("tehlikeli")) yil = 2;

  d.setFullYear(d.getFullYear() + yil);
  return d.toISOString().slice(0, 10);
};

const getRowStatusClass = (bitisTarihi) => {
  if (!bitisTarihi) return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(bitisTarihi);
  if (Number.isNaN(target.getTime())) return "";
  target.setHours(0, 0, 0, 0);

  const diffDays = Math.floor(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays < 0) return "bg-red-50";
  if (diffDays <= 30) return "bg-yellow-50";
  return "bg-green-50";
};

/* ===== Tarih yardımcıları ===== */
const pad2 = (n) => String(n).padStart(2, "0");

const isoToTR = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
};

const isoToDate = (iso) => {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  dt.setHours(12, 0, 0, 0);
  return dt;
};

const dateToISO = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const isWeekend = (d) => {
  const day = d.getDay();
  return day === 0 || day === 6;
};

const isBusinessDay = (d, holidaySet) => {
  if (!d) return false;
  if (isWeekend(d)) return false;
  const iso = dateToISO(d);
  if (holidaySet?.has?.(iso)) return false;
  return true;
};

// Saatleri günlere sırayla dağıtır
const buildScheduleByHours = (startISO, hoursObj, holidaySet) => {
  const start = isoToDate(startISO);
  if (!start) return [];

  const blocks = [
    { key: "genel", label: "GENEL", h: Number(hoursObj?.genel || 0) },
    { key: "teknik", label: "TEKNİK", h: Number(hoursObj?.teknik || 0) },
    { key: "saglik", label: "SAĞLIK", h: Number(hoursObj?.saglik || 0) },
    {
      key: "iseOzelRiskler",
      label: "İŞE ÖZEL RİSKLER",
      h: Number(hoursObj?.iseOzelRiskler || 0),
    },
  ];

  const schedule = [];

  let cursor = new Date(start);
  cursor.setHours(12, 0, 0, 0);

  while (!isBusinessDay(cursor, holidaySet)) {
    cursor.setDate(cursor.getDate() + 1);
  }

  const gun1ISO = dateToISO(cursor);

  // 1. gün → Genel + Teknik
  const gun1Blocks = [blocks[0], blocks[1]];
  gun1Blocks.forEach((b) => {
    if (!b.h || b.h <= 0) return;
    schedule.push({
      key: b.key,
      label: b.label,
      saat: b.h,
      tarihISO: gun1ISO,
      tarihTR: isoToTR(gun1ISO),
    });
  });

  // 2. güne geç
  cursor.setDate(cursor.getDate() + 1);
  while (!isBusinessDay(cursor, holidaySet)) {
    cursor.setDate(cursor.getDate() + 1);
  }

  const gun2ISO = dateToISO(cursor);

  // 2. gün → Sağlık + İşe Özel Riskler
  const gun2Blocks = [blocks[2], blocks[3]];
  gun2Blocks.forEach((b) => {
    if (!b.h || b.h <= 0) return;
    schedule.push({
      key: b.key,
      label: b.label,
      saat: b.h,
      tarihISO: gun2ISO,
      tarihTR: isoToTR(gun2ISO),
    });
  });

  return schedule;
};

const toIsoDate = (value) => {
  if (!value) return "";
  if (typeof value === "string") {
    const v = value.toString().trim();
    const s = v.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(v)) {
      const [d, m, y] = v.split(".");
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

const downloadBlobAsFile = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
};

/* =========================
   ✅ İŞE GİRİŞ / 3 AY KONTROLÜ
   ========================= */
const ucAySonrasiISO = (iso) => {
  const d = isoToDate(iso);
  if (!d) return "";
  d.setMonth(d.getMonth() + 3);
  return dateToISO(d);
};

const iseGirisUcAyUygunMu = (iseGirisTarihi, egitimBaslangicTarihi) => {
  const iseGiris = isoToDate(iseGirisTarihi);
  const egitim = isoToDate(egitimBaslangicTarihi);

  if (!iseGiris || !egitim) return true;

  const limit = new Date(iseGiris);
  limit.setMonth(limit.getMonth() + 3);
  limit.setHours(23, 59, 59, 999);

  return egitim.getTime() <= limit.getTime();
};

const getUcAyKontrolDurumu = (iseGirisTarihi, egitimBaslangicTarihi) => {
  if (!iseGirisTarihi || !egitimBaslangicTarihi) {
    return {
      status: "",
      text: "-",
      title: "İşe giriş veya eğitim başlangıç tarihi eksik.",
    };
  }

  const limitISO = ucAySonrasiISO(iseGirisTarihi);
  const uygun = iseGirisUcAyUygunMu(iseGirisTarihi, egitimBaslangicTarihi);

  return {
    status: uygun ? "uygun" : "uygunsuz",
    text: uygun
      ? `Uygun (Son gün: ${isoToTR(limitISO)})`
      : `Aşıldı (Son gün: ${isoToTR(limitISO)})`,
    title: uygun
      ? `Mevzuata uygun. Eğitim en geç ${isoToTR(limitISO)} tarihine kadar verilmeliydi.`
      : `Mevzuata aykırı. Eğitim en geç ${isoToTR(limitISO)} tarihine kadar verilmeliydi.`,
  };
};

export default function IseGirisEgitimi() {
  const { selectedFirm } = useContext(FirmaContext);

  const RAW_API_ORIGIN =
    (import.meta.env.VITE_API_URL || import.meta.env.VITE_API || "").trim() ||
    "https://api.isgpanel.tr";

  const API_ORIGIN = RAW_API_ORIGIN.replace(/\/+$/, "").replace(/\/api$/i, "");
  const API_BASE = `${API_ORIGIN}/api`;

  const API_ROOTS = useMemo(
    () => Array.from(new Set([API_BASE, API_ORIGIN])),
    [API_BASE, API_ORIGIN]
  );

  const user = useMemo(() => {
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
  }, []);

  const [imzalar, setImzalar] = useState({
    isgUzmaniAdi: "",
    isyeriHekimiAdi: "",
    isverenAdi: "",
  });

 const [serverKurumsal, setServerKurumsal] = useState({
  logoUrl: "",
  logoBase64: "",
  firmaAdi: "",
});

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

  const [egitimBilgileri, setEgitimBilgileri] = useState({
  yer: "",
  genelSaat: "",
  teknikSaat: "",
  saglikSaat: "",
  iseOzelRisklerSaat: "",
});

  const [topluTarih, setTopluTarih] = useState({
    baslangic: "",
    bitis: "",
  });

  const [topluOtoBitis, setTopluOtoBitis] = useState(true);
  const [bireyselOto, setBireyselOto] = useState(true);



const [katilimcilar, setKatilimcilar] = useState([
  {
    no: 1,
    secili: false,
    tc: "",
    adSoyad: "",
    gorev: "",
    iseGirisTarihi: "",
    baslangicTarihi: "",
    bitisTarihi: "",
    imzalar: createEmptyImzaState(),
personelFoto: "",
testSonucu: null,
  },
]);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalTip, setModalTip] = useState(null);
  const [modalData, setModalData] = useState(null);

 const [pdfUrl, setPdfUrl] = useState(null);
const [pdfLoading, setPdfLoading] = useState(false);
const [pdfProgress, setPdfProgress] = useState(0);
const [pdfError, setPdfError] = useState("");

  const [bulkLoading, setBulkLoading] = useState(false);
const [bulkSaveLoading, setBulkSaveLoading] = useState(false);

const [signatureModalOpen, setSignatureModalOpen] = useState(false);
const [activeSignatureRowIndex, setActiveSignatureRowIndex] = useState(null);
const [activeSignatureField, setActiveSignatureField] = useState("");
const [signatureDrawingEmpty, setSignatureDrawingEmpty] = useState(true);
const [signatureConsentChecked, setSignatureConsentChecked] = useState(false);
const [signatureDraftRow, setSignatureDraftRow] = useState(null);

const [testModalOpen, setTestModalOpen] = useState(false);
const [activeTestRowIndex, setActiveTestRowIndex] = useState(null);
const [activeTestQuestionIndex, setActiveTestQuestionIndex] = useState(0);
const [testAnswers, setTestAnswers] = useState({});

const canvasRef = useRef(null);
const canvasWrapRef = useRef(null);
const drawingRef = useRef(false);
const lastPointRef = useRef({ x: 0, y: 0 });

  const readonlyInputClass =
    "w-full min-w-0 h-11 rounded-lg border border-gray-300 bg-slate-50 px-4 text-sm text-gray-800";
  const tableInputClass =
    "w-full min-w-[140px] sm:min-w-0 h-11 rounded-lg border border-gray-300 bg-white px-3 text-xs sm:text-sm text-gray-800 text-center focus:outline-none focus:ring-2 focus:ring-blue-500/30";

  const firmaId = selectedFirm?.id ?? "default";
  const EGITIM_DOCS_KEY = "belgelerim_egitim_listesi";

const createEmptyRow = (no = 1) => ({
  no,
  secili: false,
  tc: "",
  adSoyad: "",
  gorev: "",
  iseGirisTarihi: "",
  baslangicTarihi: "",
  bitisTarihi: "",
  imzalar: createEmptyImzaState(),
personelFoto: "",
testSonucu: null,
});

const persistKatilimcilarToServer = async (rows) => {
  try {
    if (!selectedFirm?.id) return;

    const token = getBearerToken(user);
    const doluSatirlar = (rows || []).filter((row) => !isEmptyRow(row));

    const arrToSave = doluSatirlar.map(
  ({
    tc,
    adSoyad,
    gorev,
    iseGirisTarihi,
    baslangicTarihi,
    bitisTarihi,
    imzalar,
    personelFoto,
testSonucu,
  }) => ({
        tc,
        adSoyad,
        gorev,
        iseGirisTarihi,
        baslangicTarihi,
        bitisTarihi,
personelFoto: personelFoto || "",
testSonucu: testSonucu || null,
imzalar: {
          genel: imzalar?.genel || null,
          teknik: imzalar?.teknik || null,
          saglik: imzalar?.saglik || null,
          iseOzelRiskler: imzalar?.iseOzelRiskler || null,
        },
      })
    );

    const res = await fetch(`${API_BASE}/ise-giris/katilimcilar`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        firmaId,
        firmaAdi: selectedFirm?.firmaAdi || "",
        egitimTuru: "İşe Giriş Eğitimi",
        katilimcilar: arrToSave,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || "İmza autosave başarısız.");
    }

    try {
      localStorage.setItem(DOCS_SYNC_KEY, String(Date.now()));
    } catch {}

    window.dispatchEvent(new Event(DOCS_SYNC_KEY));
  } catch (err) {
    console.error("İmza autosave hatası:", err);
    openInfo(
      "İmza Kaydetme Uyarısı",
      "İmza sunucuya kaydedilemedi. Sayfayı yenilemeden önce tekrar kontrol ediniz."
    );
  }
};

const loadKatilimcilar = async () => {
  if (!selectedFirm?.id) return;

  try {
    const token = getBearerToken(user);

    const res = await fetch(
      `${API_BASE}/ise-giris/katilimcilar?firmaId=${selectedFirm.id}`,
      {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      }
    );

    if (!res.ok) return;

    const data = await res.json();
    const items = Array.isArray(data?.items) ? data.items : [];

   if (items.length > 0) {
  const cleaned = items
    .map((k, i) => ({
      no: i + 1,
      secili: false,
      tc: k?.tc || "",
      adSoyad: k?.adSoyad || "",
      gorev: k?.gorev || "",
      iseGirisTarihi: k?.iseGirisTarihi || "",
      baslangicTarihi: k?.baslangicTarihi || "",
      bitisTarihi: k?.bitisTarihi || "",
personelFoto: k?.personelFoto || k?.personelFotoDataUrl || "",
testSonucu: k?.testSonucu || null,
imzalar: {
        ...createEmptyImzaState(),
        ...(k?.imzalar || {}),
      },
    }))
    .filter((row) => !isEmptyRow(row));

  setKatilimcilar(cleaned.length ? cleaned : [createEmptyRow(1)]);
} else {
  setKatilimcilar([createEmptyRow(1)]);
}


  } catch (e) {
    console.error("Server veri çekme hatası:", e);
  }
};

  const getUzmanAdiSoyadi = () => {
    try {
      const key = `risk_prosedur_kisiler_${firmaId}`;
      const raw = localStorage.getItem(key);
      const p = raw ? JSON.parse(raw) : null;
      return (p?.uzman || "").toString().trim();
    } catch {
      return "";
    }
  };

  useEffect(() => {
    if (!selectedFirm?.id) return;

    const firmId = selectedFirm.id;
    const pickFirst = (...vals) => vals.find((v) => String(v || "").trim()) || "";
    const hasAny = (obj) => Object.values(obj || {}).some((x) => String(x || "").trim());

    let alive = true;

    const fetchKisiler = async () => {
      const token = getBearerToken(user);
      if (!token) return null;

      try {
        const r = await fetch(`${API_BASE}/firma/${firmId}/kisiler`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (r.ok) {
          const data = await r.json();
          const next = {
            uzman: pickFirst(data?.uzman, data?.isgUzmaniAdSoyad, data?.isgUzmaniAdiSoyadi),
            hekim: pickFirst(data?.hekim, data?.isyeriHekimiAdSoyad, data?.isyeriHekimiAdiSoyadi),
            isveren: pickFirst(
              data?.isveren,
              data?.isverenAdSoyad,
              data?.isverenVekiliAdSoyad,
              data?.isverenVekili
            ),
          };
          if (hasAny(next)) return next;
        }
      } catch {}

      try {
        const r2 = await fetch(`${API_BASE}/profile/personal`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (r2.ok) {
          const p = await r2.json();
          const next = {
            uzman: pickFirst(p?.isgUzmaniAdSoyad, p?.uzmanAdSoyad, p?.uzman),
            hekim: pickFirst(p?.isyeriHekimiAdSoyad, p?.hekimAdSoyad, p?.hekim),
            isveren: pickFirst(p?.isverenVekiliAdSoyad, p?.isverenAdSoyad, p?.isveren),
          };
          if (hasAny(next)) return next;
        }
      } catch {}

      try {
        const raw = localStorage.getItem(`risk_prosedur_kisiler_${firmId}`);
        const p = raw ? JSON.parse(raw) : null;
        if (p && typeof p === "object") {
          const next = {
            uzman: pickFirst(p?.uzman, p?.isgUzmani, p?.uzmanAdiSoyadi, p?.isgUzmaniAdSoyad),
            hekim: pickFirst(p?.hekim, p?.isyeriHekimi, p?.hekimAdiSoyadi, p?.isyeriHekimiAdSoyad),
            isveren: pickFirst(p?.isveren, p?.isverenVekili, p?.isverenAdSoyad, p?.isverenVekiliAdSoyad),
          };
          if (hasAny(next)) return next;
        }
      } catch {}

      return null;
    };

    (async () => {
      const kisiler = await fetchKisiler();
      const kisisel = safeParseLS("kisiselBilgiler");

      const pickFirst = (...vals) => vals.find((v) => String(v || "").trim()) || "";

      const isgUzmaniAdi = pickFirst(
        kisiler?.uzman,
        kisisel?.adSoyad,
        `${kisisel?.ad || ""} ${kisisel?.soyad || ""}`.trim()
      );

      const isyeriHekimiAdi = pickFirst(kisiler?.hekim);
      const isverenAdi = pickFirst(kisiler?.isveren);

      if (!alive) return;
      setImzalar({
        isgUzmaniAdi: isgUzmaniAdi || "",
        isyeriHekimiAdi: isyeriHekimiAdi || "",
        isverenAdi: isverenAdi || "",
      });
    })();

    return () => {
      alive = false;
    };
  }, [API_BASE, selectedFirm?.id, user]);

  useEffect(() => {
  if (!selectedFirm?.id) return;

  let cancelled = false;

  const loadKurumsal = async () => {
    const token = getBearerToken(user);
    const currentFirmaId = selectedFirm?._id || selectedFirm?.id;

    const fromFirm = {
      logoUrl:
        selectedFirm?.logoUrl ||
        selectedFirm?.logo ||
        selectedFirm?.kurumsalLogo ||
        "",
      logoBase64:
        selectedFirm?.logoBase64 ||
        selectedFirm?.logoData ||
        "",
      firmaAdi:
        selectedFirm?.kurumsalFirmaAdi || "",
    };

   if ((fromFirm.logoUrl || fromFirm.logoBase64) && fromFirm.firmaAdi) {
  if (!cancelled) {
    setServerKurumsal({
      logoUrl: toAbsoluteUrl(API_ORIGIN, fromFirm.logoUrl || ""),
      logoBase64: fromFirm.logoBase64 || "",
      firmaAdi: fromFirm.firmaAdi || "",
    });
  }
  return;
}

    const candidates = [
      `/firma/${currentFirmaId}/kurumsal`,
      `/firma/${currentFirmaId}/kurumsal-bilgiler`,
      `/kurumsal/${currentFirmaId}`,
      `/kurumsal-bilgiler/${currentFirmaId}`,
      `/firma/${currentFirmaId}`,
      `/company/${currentFirmaId}`,
    ];

    for (const path of candidates) {
      try {
        const data = await requestWithFallback(
          API_ROOTS,
          path,
          {
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          },
          "json"
        );

        const payload = data?.payload || data || {};

        const rawLogo =
          payload?.logoUrl ||
          payload?.logo ||
          payload?.kurumsalLogo ||
          payload?.firmaLogo ||
          payload?.companyLogo ||
          "";

        const logoBase64 =
          payload?.logoBase64 ||
          payload?.logoData ||
          payload?.logoB64 ||
          (typeof payload?.logo === "string" && payload.logo.startsWith("data:image")
            ? payload.logo
            : "");

        const firmaAdi =
          payload?.firmaAdi ||
          payload?.companyName ||
          payload?.unvan ||
          payload?.title ||
          "";

        if (rawLogo || logoBase64 || firmaAdi) {
          if (!cancelled) {
            setServerKurumsal({
              logoUrl: toAbsoluteUrl(API_ORIGIN, rawLogo || ""),
              logoBase64: logoBase64 || "",
              firmaAdi: firmaAdi || "",
            });
          }
          return;
        }
      } catch {}
    }
  };

  loadKurumsal();

  return () => {
    cancelled = true;
  };
}, [API_ORIGIN, API_ROOTS, selectedFirm, user]);

  const getTopluEgitimEtiketi = (adet) => `TOPLU İŞE GİRİŞ EĞİTİMİ (${adet} KİŞİ)`;

  const holidaySet = useMemo(() => {
    try {
      const raw = localStorage.getItem("resmiTatiller");
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr.filter(Boolean) : []);
    } catch {
      return new Set();
    }
  }, []);

  const hideModalHeaderCloseStyle = `
    .pdf-onizleme-modal button[aria-label="Close"],
    .pdf-onizleme-modal button[aria-label="Kapat"],
    .pdf-onizleme-modal button[aria-label="close"]{
      display: none !important;
    }
  `;

  const isEmptyRow = (row) => {
    const fields = [
      row.tc,
      row.adSoyad,
      row.gorev,
      row.iseGirisTarihi,
      row.baslangicTarihi,
      row.bitisTarihi,
    ];
    return fields.every((v) => !v || (typeof v === "string" && v.trim() === ""));
  };

  const getDistinctDateRangeCount = (rows) => {
    const set = new Set();
    (rows || []).forEach((r) => {
      const s = (r?.baslangicTarihi || "").toString();
      const e = (r?.bitisTarihi || "").toString();
      if (s && e) set.add(`${s}__${e}`);
    });
    return set.size;
  };

  const readKurumsalForPdf = () => {
  try {
    const raw = localStorage.getItem("kurumsalBilgiler");
    const k = raw ? JSON.parse(raw) : null;

    const localLogoUrl = k?.logoUrl || k?.logoURL || "";
    const localLogoBase64 =
      k?.logoBase64 ||
      k?.logoB64 ||
      (typeof k?.logo === "string" && k.logo.startsWith("data:image") ? k.logo : "");

    const localFirmaAdi =
      k?.firmaAdi ||
      k?.unvan ||
      k?.companyName ||
      "";

    const firmLogoUrl =
      selectedFirm?.logoUrl ||
      selectedFirm?.logo ||
      selectedFirm?.kurumsalLogo ||
      "";

    const firmLogoBase64 =
      selectedFirm?.logoBase64 ||
      selectedFirm?.logoData ||
      "";

    const finalLogoUrl =
      serverKurumsal.logoUrl ||
      toAbsoluteUrl(API_ORIGIN, firmLogoUrl || "") ||
      toAbsoluteUrl(API_ORIGIN, localLogoUrl || "") ||
      "";

    const finalLogoBase64 =
      serverKurumsal.logoBase64 ||
      firmLogoBase64 ||
      localLogoBase64 ||
      "";

    return {
      logoUrl: finalLogoUrl,
      logoBase64: finalLogoBase64,
     firmaAdi:
  serverKurumsal.firmaAdi ||
  localFirmaAdi ||
  selectedFirm?.kurumsalFirmaAdi || // 🔥 YENİ
  selectedFirm?.firmaAdi ||
  "",
    };
  } catch {
    return {
      logoUrl: serverKurumsal.logoUrl || "",
      logoBase64: serverKurumsal.logoBase64 || "",
      firmaAdi:
        serverKurumsal.firmaAdi ||
        selectedFirm?.kurumsalFirmaAdi ||
        "",
    };
  }
};

  useEffect(() => {
  loadKatilimcilar();
}, [API_BASE, selectedFirm?.id, user]);

useEffect(() => {
  if (!selectedFirm?.id) return;

  const syncReload = () => {
    loadKatilimcilar();
  };

  const onStorage = (e) => {
    if (e.key === DOCS_SYNC_KEY) {
      loadKatilimcilar();
    }
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      loadKatilimcilar();
    }
  };

  window.addEventListener(DOCS_SYNC_KEY, syncReload);
  window.addEventListener("storage", onStorage);
  window.addEventListener("focus", syncReload);
  document.addEventListener("visibilitychange", onVisibilityChange);

  return () => {
    window.removeEventListener(DOCS_SYNC_KEY, syncReload);
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("focus", syncReload);
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };
}, [selectedFirm?.id, API_BASE, user]);

  useEffect(() => {
  if (!selectedFirm) return;

  const hazard = (selectedFirm?.tehlike || "").toLowerCase();

  let genel = "";
  let teknik = "";
  let saglik = "";
  let iseOzelRiskler = "";

  if (hazard.includes("az")) {
    genel = "2";
    teknik = "2";
    saglik = "2";
    iseOzelRiskler = "2";
  } else if (hazard.includes("çok") || hazard.includes("cok")) {
    genel = "2";
    teknik = "1";
    saglik = "1";
    iseOzelRiskler = "4";
  } else if (hazard.includes("tehlikeli")) {
    genel = "2";
    teknik = "2";
    saglik = "1";
    iseOzelRiskler = "3";
  }

  setEgitimBilgileri((prev) => ({
    ...prev,
    yer: selectedFirm?.firmaAdi || prev.yer || "",
    genelSaat: genel,
    teknikSaat: teknik,
    saglikSaat: saglik,
    iseOzelRisklerSaat: iseOzelRiskler,
  }));
}, [selectedFirm]);

  useEffect(() => {
    if (!topluOtoBitis) return;
    if (!topluTarih.baslangic) {
      setTopluTarih((p) => ({ ...p, bitis: "" }));
      return;
    }

    const sc = buildScheduleByHours(
  topluTarih.baslangic,
  {
    genel: egitimBilgileri.genelSaat,
    teknik: egitimBilgileri.teknikSaat,
    saglik: egitimBilgileri.saglikSaat,
    iseOzelRiskler: egitimBilgileri.iseOzelRisklerSaat,
  },
  holidaySet
);

    const bitis = sc.length ? sc[sc.length - 1].tarihISO : "";
    setTopluTarih((p) => ({ ...p, bitis }));
  }, [
  topluOtoBitis,
  topluTarih.baslangic,
  egitimBilgileri.genelSaat,
  egitimBilgileri.teknikSaat,
  egitimBilgileri.saglikSaat,
  egitimBilgileri.iseOzelRisklerSaat,
  holidaySet,
]);

  const handleSaatChange = (field, value) => {
    setEgitimBilgileri((prev) => ({ ...prev, [field]: value }));
  };

const resizeCanvas = useCallback(() => {
  const canvas = canvasRef.current;
  const wrap = canvasWrapRef.current;
  if (!canvas || !wrap) return;

  const rect = wrap.getBoundingClientRect();
  const ratio = Math.max(window.devicePixelRatio || 1, 1);

  const oldData =
    !signatureDrawingEmpty && canvas.width > 0 && canvas.height > 0
      ? canvas.toDataURL("image/png")
      : null;

  canvas.width = Math.floor(rect.width * ratio);
  canvas.height = Math.floor(rect.height * ratio);
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#1E40AF";
  ctx.lineWidth = 2.2;
  ctx.clearRect(0, 0, rect.width, rect.height);

  if (oldData) {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, rect.width, rect.height);
    };
    img.src = oldData;
  }
}, [signatureDrawingEmpty]);

useEffect(() => {
  if (!signatureModalOpen) return;

  const timer = setTimeout(() => {
    resizeCanvas();
  }, 60);

  window.addEventListener("resize", resizeCanvas);

  return () => {
    clearTimeout(timer);
    window.removeEventListener("resize", resizeCanvas);
  };
}, [signatureModalOpen, resizeCanvas]);

const getCanvasPos = (e) => {
  const canvas = canvasRef.current;
  if (!canvas) return { x: 0, y: 0 };

  const rect = canvas.getBoundingClientRect();
  const touch = e.touches?.[0] || e.changedTouches?.[0];

  const clientX = touch ? touch.clientX : e.clientX;
  const clientY = touch ? touch.clientY : e.clientY;

  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
  };
};

const startDraw = (e) => {
  e.preventDefault();

  const canvas = canvasRef.current;
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const pos = getCanvasPos(e);
  drawingRef.current = true;
  lastPointRef.current = pos;

  ctx.beginPath();
  ctx.moveTo(pos.x, pos.y);
};

const draw = (e) => {
  if (!drawingRef.current) return;
  e.preventDefault();

  const canvas = canvasRef.current;
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const pos = getCanvasPos(e);

  ctx.beginPath();
  ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
  ctx.lineTo(pos.x, pos.y);
  ctx.stroke();

  lastPointRef.current = pos;
  setSignatureDrawingEmpty(false);
};

const endDraw = (e) => {
  if (!drawingRef.current) return;
  e.preventDefault();
  drawingRef.current = false;
};

const clearCanvas = () => {
  const canvas = canvasRef.current;
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  setSignatureDrawingEmpty(true);
};

const openSignatureModal = (rowIndex, fieldKey = "") => {
  const row = katilimcilar?.[rowIndex];
  const nextField = fieldKey || getNextMissingSignatureKey(row, egitimBilgileri);

  setActiveSignatureRowIndex(rowIndex);
  setActiveSignatureField(nextField);
  setSignatureDraftRow(row ? { ...row, imzalar: { ...(row.imzalar || createEmptyImzaState()) } } : null);
  setSignatureDrawingEmpty(true);
  setSignatureConsentChecked(false);
  setSignatureModalOpen(true);

  setTimeout(() => {
    resizeCanvas();
    clearCanvas();
  }, 80);
};

const openTestModal = (rowIndex) => {
  setActiveTestRowIndex(rowIndex);
  setActiveTestQuestionIndex(0);
  setTestAnswers({});
  setTestModalOpen(true);
};

const closeTestModal = () => {
  setTestModalOpen(false);
  setActiveTestRowIndex(null);
  setActiveTestQuestionIndex(0);
  setTestAnswers({});
};

const handleTestAnswerChange = (questionIndex, answerIndex) => {
  setTestAnswers((prev) => ({
    ...prev,
    [questionIndex]: answerIndex,
  }));
};

const getAnsweredTestCount = () => {
  return Object.keys(testAnswers || {}).length;
};

const handleTestKaydet = () => {
  const answeredCount = getAnsweredTestCount();

  if (answeredCount < ISE_GIRIS_TEST_SORULARI.length) {
    openInfo(
      "Eksik Test",
      "Testi kaydetmek için 10 sorunun tamamını cevaplayınız."
    );
    return;
  }

  const dogruSayisi = ISE_GIRIS_TEST_SORULARI.reduce((total, soru, index) => {
    return total + (testAnswers[index] === soru.dogru ? 1 : 0);
  }, 0);

  const activeRow =
    activeTestRowIndex !== null ? katilimcilar?.[activeTestRowIndex] : null;

 const testKaydi = {
  cevaplar: testAnswers,
  dogruSayisi,
  soruSayisi: ISE_GIRIS_TEST_SORULARI.length,
  tamamlandi: true,
  createdAt: new Date().toISOString(),
};

setKatilimcilar((prev) => {
  const updated = prev.map((row, index) =>
    index === activeTestRowIndex
      ? {
          ...row,
          testSonucu: testKaydi,
        }
      : row
  );

  void persistKatilimcilarToServer(updated);
  return updated;
});

openInfo(
  "Test Kaydedildi",
  `${activeRow?.adSoyad || "Personel"} için test kaydedildi. Doğru sayısı: ${dogruSayisi}/10`
);

closeTestModal();

};

const forceCloseSignatureModal = () => {
  setSignatureModalOpen(false);
  setActiveSignatureRowIndex(null);
  setActiveSignatureField("");
  setSignatureDrawingEmpty(true);
  setSignatureConsentChecked(false);
  setSignatureDraftRow(null);
};

const closeSignatureModal = () => {
  const activeRow =
    activeSignatureRowIndex !== null ? katilimcilar[activeSignatureRowIndex] : null;

  if (activeRow) {
    const missing = getMissingSignatureLabels(activeRow, egitimBilgileri);

    if (missing.length > 0) {
      openConfirm({
        title: "Eksik İmza Uyarısı",
        message: `Eksik imzalarınız var: ${missing.join(", ")}.\nYine de çıkmak istiyor musunuz?`,
        confirmText: "Çık",
        cancelText: "Devam Et",
        variant: "warning",
        onConfirm: forceCloseSignatureModal,
      });
      return;
    }
  }

  forceCloseSignatureModal();
};

const saveSignatureDrawing = async () => {
  if (activeSignatureRowIndex === null || !activeSignatureField) return;

  if (!signatureConsentChecked) {
    openInfo("Bilgilendirme", "Devam etmeden önce eğitim aldığına dair onay kutusunu işaretleyiniz.");
    return;
  }

  const canvas = canvasRef.current;
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let hasInk = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const alpha = data[idx + 3];

      if (alpha > 0) {
        hasInk = true;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!hasInk) {
    openInfo("Bilgilendirme", "Lütfen önce imza çiziniz.");
    return;
  }

  const pad = 12;
  minX = Math.max(minX - pad, 0);
  minY = Math.max(minY - pad, 0);
  maxX = Math.min(maxX + pad, width);
  maxY = Math.min(maxY + pad, height);

  const cropW = Math.max(maxX - minX, 1);
  const cropH = Math.max(maxY - minY, 1);

  const OUTPUT_SCALE = 4;
  const outW = 210 * OUTPUT_SCALE;
  const outH = 90 * OUTPUT_SCALE;

  const outCanvas = document.createElement("canvas");
  outCanvas.width = outW;
  outCanvas.height = outH;

  const outCtx = outCanvas.getContext("2d");
  if (!outCtx) return;

  outCtx.imageSmoothingEnabled = true;
  outCtx.imageSmoothingQuality = "high";
  outCtx.clearRect(0, 0, outW, outH);

  const innerPadX = 8 * OUTPUT_SCALE;
  const innerPadY = 6 * OUTPUT_SCALE;

  const usableW = outW - innerPadX * 2;
  const usableH = outH - innerPadY * 2;

  const scale = Math.min(usableW / cropW, usableH / cropH);

  const drawW = cropW * scale;
  const drawH = cropH * scale;

  const dx = (outW - drawW) / 2;
  const dy = (outH - drawH) / 2;

  outCtx.drawImage(canvas, minX, minY, cropW, cropH, dx, dy, drawW, drawH);

 const dataUrl = outCanvas.toDataURL("image/png");

const currentRow = getCurrentSignatureRow();

const signedAt = new Date().toISOString();

const signerName =
  currentRow?.adSoyad ||
  "";

const signatureHash =
  await createSignatureHash({
    dataUrl,
    signerName,
    signedAt,
  });

const savedSignature = {
  ...createEmptySignatureRecord(),
  dataUrl,
  createdAt: signedAt,
  signedAt,
  signerName,
  signatureHash,
  deviceType: getDeviceType(),
};

const nextDraftRow = {
  ...(currentRow || {}),
  imzalar: {
    ...((currentRow || {}).imzalar || createEmptyImzaState()),
    [activeSignatureField]: savedSignature,
  },
};

setSignatureDraftRow(nextDraftRow);

setKatilimcilar((prev) => {
  const updatedRows = prev.map((row, idx) =>
    idx === activeSignatureRowIndex
      ? {
          ...row,
          imzalar: {
            ...(row.imzalar || createEmptyImzaState()),
            [activeSignatureField]: savedSignature,
          },
        }
      : row
  );

  void persistKatilimcilarToServer(updatedRows);
  return updatedRows;
});

const missingAfterSave = getMissingSignatureLabels(nextDraftRow, egitimBilgileri);

if (missingAfterSave.length > 0) {
  const nextMissingKey = getNextMissingSignatureKey(nextDraftRow, egitimBilgileri);
  setActiveSignatureField(nextMissingKey);
  setSignatureConsentChecked(false);
  clearCanvas();
  setTimeout(() => resizeCanvas(), 30);
  return;
}

forceCloseSignatureModal();

};
const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result || "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const resizePhotoToDataUrl = async (file) => {
  const rawDataUrl = await fileToDataUrl(file);

  return await new Promise((resolve) => {
    const img = new Image();

    img.onload = () => {
      const outW = 360;
      const outH = 480; // 3:4 biyometrik oran

      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(rawDataUrl);
        return;
      }

      const targetRatio = outW / outH;
      const imgRatio = img.width / img.height;

      let sx = 0;
      let sy = 0;
      let sw = img.width;
      let sh = img.height;

      if (imgRatio > targetRatio) {
        // Foto genişse yanlardan kırp
        sh = img.height;
        sw = img.height * targetRatio;
        sx = (img.width - sw) / 2;
        sy = 0;
      } else {
        // Foto uzunsa üstten biraz daha fazla alan bırak, çene kesilmesin
        sw = img.width;
        sh = img.width / targetRatio;
        sx = 0;
        sy = Math.max((img.height - sh) * 0.28, 0);
      }

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, outW, outH);

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);

      resolve(canvas.toDataURL("image/jpeg", 0.9));
    };

    img.onerror = () => resolve(rawDataUrl);
    img.src = rawDataUrl;
  });
};

const handlePersonelFotoChange = async (index, file) => {
  if (!file) return;

  if (!file.type?.startsWith("image/")) {
    openInfo("Uyarı", "Lütfen fotoğraf formatında bir dosya seçiniz.");
    return;
  }

  try {
    const dataUrl = await resizePhotoToDataUrl(file);

    setKatilimcilar((prev) => {
      const updated = prev.map((row, i) =>
        i === index
          ? {
              ...row,
              personelFoto: dataUrl,
            }
          : row
      );

      void persistKatilimcilarToServer(updated);
      return updated;
    });
  } catch (e) {
    console.error("Fotoğraf yükleme hatası:", e);
    openInfo("Hata", "Fotoğraf kaydedilemedi.");
  }
};

  const handleKatilimciChange = (index, field, value) => {
    setKatilimcilar((prev) => {
  const updated = [...prev];
  const oldRow = updated[index];

  let yeniDeger = value;
      if (field === "tc") yeniDeger = normalizeTC(value);
      if (field === "adSoyad" || field === "gorev") {
        yeniDeger = (value || "").toLocaleUpperCase("tr-TR");
      }

   // 🔥 İŞE GİRİŞTEN ÖNCE EĞİTİM KONTROLÜ
if (field === "baslangicTarihi") {
  const iseGiris = prev[index]?.iseGirisTarihi;

  if (iseGiris && value) {
    const iseGirisDate = new Date(iseGiris);
    const egitimDate = new Date(value);

    if (egitimDate < iseGirisDate) {
      openInfo(
        "Uyarı",
        "İşe başlamadan önce eğitim tarihi seçmeyiniz."
      );
      return prev; // ❌ değişikliği iptal eder
    }
  }
}


     if (field === "baslangicTarihi" && bireyselOto) {
  if (!yeniDeger) {
    const nextRow = {
      ...updated[index],
      baslangicTarihi: "",
      bitisTarihi: "",
    };

    updated[index] =
      rowHasAnySignature(oldRow) ? resetRowSignatures(nextRow) : nextRow;

    return updated;
  }

  const sc = buildScheduleByHours(
    yeniDeger,
    {
      genel: egitimBilgileri.genelSaat,
      teknik: egitimBilgileri.teknikSaat,
      saglik: egitimBilgileri.saglikSaat,
      iseOzelRiskler: egitimBilgileri.iseOzelRisklerSaat,
    },
    holidaySet
  );

  const bitis = sc.length ? sc[sc.length - 1].tarihISO : "";
  const nextRow = {
    ...updated[index],
    baslangicTarihi: yeniDeger,
    bitisTarihi: bitis,
  };

  updated[index] =
    rowHasAnySignature(oldRow) ? resetRowSignatures(nextRow) : nextRow;

  return updated;
}

     const nextRow = { ...updated[index], [field]: yeniDeger };

const changed =
  String(oldRow?.[field] || "") !== String(yeniDeger || "");

updated[index] =
  changed && isCriticalSignatureField(field) && rowHasAnySignature(oldRow)
    ? resetRowSignatures(nextRow)
    : nextRow;

return updated;
    });
  };

  const handleSecimToggle = (index) => {
    setKatilimcilar((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], secili: !updated[index].secili };
      return updated;
    });
  };

  const satirEkle = () => {
  setKatilimcilar((prev) => {
    const yeni = [createEmptyRow(1), ...prev.map((k, i) => ({ ...k, no: i + 2 }))];
    return yeni;
  });
};

  const handleKatilimcilarKaydet = async () => {
  try {
    const doluSatirlar = katilimcilar.filter((row) => !isEmptyRow(row));

    const eksikImzaliSatirlar = doluSatirlar.filter((row) => {
      const missing = getMissingSignatureLabels(row, egitimBilgileri);
      return missing.length > 0;
    });

    if (eksikImzaliSatirlar.length > 0) {
      const ilkEksik = eksikImzaliSatirlar[0];
      const eksikAlanlar = getMissingSignatureLabels(ilkEksik, egitimBilgileri);

      openInfo(
        "Eksik İmza Uyarısı",
        `${ilkEksik.adSoyad || "İsimsiz satır"} için zorunlu personel imzaları eksik: ${eksikAlanlar.join(", ")}`
      );
      return;
    }

const eksikFotoluSatirlar = doluSatirlar.filter(
  (row) => !row?.personelFoto
);

if (eksikFotoluSatirlar.length > 0) {
  const ilkEksik = eksikFotoluSatirlar[0];

  openInfo(
    "Eksik Fotoğraf Uyarısı",
    `${ilkEksik.adSoyad || "İsimsiz satır"} için personel fotoğrafı eksik.`
  );
  return;
}

const eksikTestliSatirlar = doluSatirlar.filter(
  (row) => !row?.testSonucu?.tamamlandi
);

if (eksikTestliSatirlar.length > 0) {
  const ilkEksik = eksikTestliSatirlar[0];

  openInfo(
    "Eksik Test Uyarısı",
    `${ilkEksik.adSoyad || "İsimsiz satır"} için test tamamlanmamış.`
  );
  return;
}

    const eksikIseGiris = doluSatirlar.filter(
      (row) => row.baslangicTarihi && !row.iseGirisTarihi
    );

    if (eksikIseGiris.length > 0) {
      openInfo(
        "Bilgilendirme",
        "Eğitim tarihi girilen personeller için İşe Giriş Tarihi alanı zorunludur."
      );
      return;
    }

    const mevzuataAykiri = doluSatirlar.filter(
      (row) =>
        row.iseGirisTarihi &&
        row.baslangicTarihi &&
        !iseGirisUcAyUygunMu(row.iseGirisTarihi, row.baslangicTarihi)
    );

    if (mevzuataAykiri.length > 0) {
      openInfo(
        "Mevzuat Uyarısı",
        "Bazı personeller için işe giriş eğitimi, işe giriş tarihinden itibaren 3 ay içinde verilmemiş görünüyor. Lütfen tarihleri kontrol edin."
      );
      return;
    }

    const arrToSave = doluSatirlar.map(
  ({
    tc,
    adSoyad,
    gorev,
    iseGirisTarihi,
    baslangicTarihi,
    bitisTarihi,
    imzalar,
    personelFoto,
testSonucu,
  }) => ({
        tc: normalizeTC(tc),
        adSoyad: (adSoyad || "").toLocaleUpperCase("tr-TR"),
        gorev: (gorev || "").toLocaleUpperCase("tr-TR"),
        iseGirisTarihi: iseGirisTarihi || "",
        baslangicTarihi: baslangicTarihi || "",
       bitisTarihi: bitisTarihi || "",
personelFoto: personelFoto || "",
testSonucu: testSonucu || null,
imzalar: {
          genel: imzalar?.genel || null,
          teknik: imzalar?.teknik || null,
          saglik: imzalar?.saglik || null,
          iseOzelRiskler: imzalar?.iseOzelRiskler || null,
        },
      })
    );

    const token = getBearerToken(user);

    const res = await fetch(`${API_BASE}/ise-giris/katilimcilar`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        firmaId,
        firmaAdi: selectedFirm?.firmaAdi || "",
        egitimTuru: "İşe Giriş Eğitimi",
        katilimcilar: arrToSave,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || "Katılımcılar kaydedilemedi");
    }

    await res.json().catch(() => null);

    // Referans dosyadaki gibi:
    // Kaydet sonrası ekrandaki mevcut imzaları koru.
    setKatilimcilar((prev) =>
      prev.map((row, i) => ({
        ...row,
        no: i + 1,
      }))
    );

    try {
      localStorage.setItem(DOCS_SYNC_KEY, String(Date.now()));
    } catch {}

    window.dispatchEvent(new Event(DOCS_SYNC_KEY));

    openInfo(
      "Bilgilendirme",
      "İşe giriş eğitimine katılan personel listesi kaydedildi ✅"
    );
  } catch (e) {
    console.error("Katılımcılar kaydedilemedi:", e);
    openInfo("Hata", "Kaydederken bir hata oluştu.");
  }
};

  const seciliKayitlar = useMemo(
    () => katilimcilar.filter((k) => k.secili),
    [katilimcilar]
  );
  const hasSelection = seciliKayitlar.length > 0;
  const canApplyBulkDate = hasSelection && !!topluTarih.baslangic;

const getActiveSignatureLabel = () => {
  const found = EGITIM_IMZA_FIELDS.find((f) => f.key === activeSignatureField);
  return found?.label || "";
};

const getNextMissingSignatureKey = (row, egitimBilgileri) => {
  const requiredKeys = getRequiredImzaKeysBySaat(egitimBilgileri);
  return (
    requiredKeys.find((key) => !row?.imzalar?.[key]?.dataUrl) ||
    requiredKeys[requiredKeys.length - 1] ||
    "genel"
  );
};

const getSignatureStepStatus = (row, fieldKey) => {
  return !!row?.imzalar?.[fieldKey]?.dataUrl;
};

const getCurrentSignatureRow = () => {
  if (signatureDraftRow) return signatureDraftRow;
  if (activeSignatureRowIndex === null) return null;
  return katilimcilar?.[activeSignatureRowIndex] || null;
};

const willFinishAllSignaturesAfterCurrent = () => {
  const row = getCurrentSignatureRow();
  if (!row || !activeSignatureField) return false;

  const simulatedRow = {
    ...row,
    imzalar: {
      ...(row.imzalar || createEmptyImzaState()),
      [activeSignatureField]: {
        ...(row?.imzalar?.[activeSignatureField] || createEmptySignatureRecord()),
        dataUrl: "__signed__",
      },
    },
  };

  const missingAfterThis = getMissingSignatureLabels(simulatedRow, egitimBilgileri);
  return missingAfterThis.length === 0;
};

const resetRowSignatures = (row) => ({
  ...row,
  imzalar: createEmptyImzaState(),
});

const isCriticalSignatureField = (field) => {
  return [
    "tc",
    "adSoyad",
    "gorev",
    "iseGirisTarihi",
    "baslangicTarihi",
    "bitisTarihi",
  ].includes(field);
};

const rowHasAnySignature = (row) => {
  const imzalar = row?.imzalar || {};
  return Object.values(imzalar).some((item) => item?.dataUrl);
};

const getMissingSignatureLabels = (row, egitimBilgileri) => {
  const requiredKeys = getRequiredImzaKeysBySaat(egitimBilgileri);

  return requiredKeys
    .filter((key) => !row?.imzalar?.[key]?.dataUrl)
    .map((key) => EGITIM_IMZA_FIELDS.find((f) => f.key === key)?.label || key);
};

const getPersonelTekImza = (row) => {
  return (
    row?.imzalar?.genel?.dataUrl ||
    row?.imzalar?.teknik?.dataUrl ||
    row?.imzalar?.saglik?.dataUrl ||
    row?.imzalar?.iseOzelRiskler?.dataUrl ||
    ""
  );
};

const hasAnyMissingRequiredSignature = (rows, egitimBilgileri) => {
  return (rows || []).some((row) => {
    if (isEmptyRow(row)) return false;
    const missing = getMissingSignatureLabels(row, egitimBilgileri);
    return missing.length > 0;
  });
};

 const handleTopluTarihUygula = () => {
  if (!canApplyBulkDate) return;

  setKatilimcilar((prev) =>
    prev.map((k) => {
      if (!k.secili) return k;

      const nextRow = {
        ...k,
        baslangicTarihi: topluTarih.baslangic,
        bitisTarihi: topluTarih.bitis,
      };

      const tarihDegisti =
        String(k?.baslangicTarihi || "") !== String(topluTarih.baslangic || "") ||
        String(k?.bitisTarihi || "") !== String(topluTarih.bitis || "");

      return tarihDegisti && rowHasAnySignature(k)
        ? resetRowSignatures(nextRow)
        : nextRow;
    })
  );
};

  const buildPayload = (startISO, rowsOverride = null) => {
  const kurumsalPdf = readKurumsalForPdf();

  const kurumsal = {
  logoUrl: kurumsalPdf.logoUrl || "",
  logoBase64: kurumsalPdf.logoBase64 || "",
  firmaAdi: kurumsalPdf.firmaAdi || "",

  // ✅ EĞİTİM VEREN (kurumsal)
  egitimVerenKurum: kurumsalPdf.firmaAdi || "",
  egitimVerenKurulus: kurumsalPdf.firmaAdi || "",

  // 🔥 YENİ EKLE
  calisaninIsyeriUnvani:
    selectedFirm?.firmaAdi ||
    selectedFirm?.unvan ||
    "",
};

  const kisiler = safeParseLS(`risk_prosedur_kisiler_${firmaId}`) || {};
const kisisel = safeParseLS("kisiselBilgiler") || {};
const selectedRows = Array.isArray(rowsOverride) ? rowsOverride : seciliKayitlar;

  const schedule = buildScheduleByHours(
    startISO,
    {
      genel: egitimBilgileri.genelSaat,
      teknik: egitimBilgileri.teknikSaat,
      saglik: egitimBilgileri.saglikSaat,
      iseOzelRiskler: egitimBilgileri.iseOzelRisklerSaat,
    },
    holidaySet
  );

  return {
    authToken: getBearerToken(user),
    firmaId,
    firma: {
      firmaAdi: selectedFirm?.firmaAdi || "",
      tehlike: selectedFirm?.tehlike || "",
    },

    kurumsal,

    imzalar: {
      isgUzmaniAdi: imzalar.isgUzmaniAdi || kisiler?.uzman || "",
      isyeriHekimiAdi: imzalar.isyeriHekimiAdi || kisiler?.hekim || "",
      isverenAdi: imzalar.isverenAdi || kisiler?.isveren || "",
    },

    kisiler: {
      ...kisiler,
      uzman: imzalar.isgUzmaniAdi || kisiler?.uzman || "",
      hekim: imzalar.isyeriHekimiAdi || kisiler?.hekim || "",
      isveren: imzalar.isverenAdi || kisiler?.isveren || "",
    },

    kisisel: {
      adSoyad: kisisel?.adSoyad || "",
      meslek: kisisel?.meslek || "",
      sertifikaSinifi: kisisel?.sertifikaSinifi || "",
      sertifikaNo: kisisel?.sertifikaNo || "",
    },

    egitim: {
      konu: "İşe Giriş Eğitimi",
      yer: egitimBilgileri.yer || "",
      genelSaat: egitimBilgileri.genelSaat || "",
      teknikSaat: egitimBilgileri.teknikSaat || "",
      saglikSaat: egitimBilgileri.saglikSaat || "",
      iseOzelRisklerSaat: egitimBilgileri.iseOzelRisklerSaat || "",
      baslangicISO: startISO || "",
      bitisISO: selectedRows?.[0]?.bitisTarihi || "",
      egitimVerenKurum: kurumsalPdf.firmaAdi || "",
      egitimVerenKurulus: kurumsalPdf.firmaAdi || "",
    },

    takvim: schedule,
testSorulari: ISE_GIRIS_TEST_SORULARI,

katilimcilar: selectedRows.map((k, i) => ({
  no: i + 1,
  tc: normalizeTC(k?.tc),
  adSoyad: k?.adSoyad || "",
  gorev: k?.gorev || "",
  iseGirisTarihi: k?.iseGirisTarihi || "",
  iseGirisTarihiTR: isoToTR(k?.iseGirisTarihi || ""),
  baslangicTarihi: k?.baslangicTarihi || "",
  bitisTarihi: k?.bitisTarihi || "",
  personelFoto: k?.personelFoto || "",
  personelFotoDataUrl: k?.personelFoto || "",
personelImzasi: getPersonelTekImza(k),
personelTekImza: getPersonelTekImza(k),
testSonucu: k?.testSonucu || null,
testCevaplari: k?.testSonucu?.cevaplar || {},
testDogruSayisi: k?.testSonucu?.dogruSayisi ?? "",
testSoruSayisi: k?.testSonucu?.soruSayisi ?? ISE_GIRIS_TEST_SORULARI.length,
      imzalar: {
        genel: k?.imzalar?.genel || null,
        teknik: k?.imzalar?.teknik || null,
        saglik: k?.imzalar?.saglik || null,
        iseOzelRiskler: k?.imzalar?.iseOzelRiskler || null,
      },
      personelImzalari: {
        genel: k?.imzalar?.genel?.dataUrl || "",
        teknik: k?.imzalar?.teknik?.dataUrl || "",
        saglik: k?.imzalar?.saglik?.dataUrl || "",
        iseOzelRiskler: k?.imzalar?.iseOzelRiskler?.dataUrl || "",
      },
    })),
  };
};


const buildSinglePersonPayload = (person) => {
  if (!person) return null;

  const payload = buildPayload(person?.baslangicTarihi || "", [person]);

  const normalizedCevaplar = Object.fromEntries(
    Object.entries(person?.testSonucu?.cevaplar || {}).map(([k, v]) => [
      String(k),
      Number(v),
    ])
  );

  const fixedPersonel = {
    adSoyad: person?.adSoyad || "",
    gorev: person?.gorev || "",
    tc: normalizeTC(person?.tc),
    iseGirisTarihi: person?.iseGirisTarihi || "",
    iseGirisTarihiTR: isoToTR(person?.iseGirisTarihi || ""),
    baslangicTarihi: person?.baslangicTarihi || "",
    bitisTarihi: person?.bitisTarihi || "",
    personelFoto: person?.personelFoto || "",
    personelFotoDataUrl: person?.personelFoto || "",
    personelImzasi: getPersonelTekImza(person),
    personelTekImza: getPersonelTekImza(person),

    testSonucu: {
      ...(person?.testSonucu || {}),
      cevaplar: normalizedCevaplar,
      dogruSayisi: person?.testSonucu?.dogruSayisi ?? 0,
      soruSayisi:
        person?.testSonucu?.soruSayisi ?? ISE_GIRIS_TEST_SORULARI.length,
      tamamlandi: !!person?.testSonucu?.tamamlandi,
    },

    cevaplar: normalizedCevaplar,
    testCevaplari: normalizedCevaplar,
    testDogruSayisi: person?.testSonucu?.dogruSayisi ?? 0,
    testSoruSayisi:
      person?.testSonucu?.soruSayisi ?? ISE_GIRIS_TEST_SORULARI.length,

    imzalar: {
      genel: person?.imzalar?.genel || null,
      teknik: person?.imzalar?.teknik || null,
      saglik: person?.imzalar?.saglik || null,
      iseOzelRiskler: person?.imzalar?.iseOzelRiskler || null,
    },

    personelImzalari: {
      genel: person?.imzalar?.genel?.dataUrl || "",
      teknik: person?.imzalar?.teknik?.dataUrl || "",
      saglik: person?.imzalar?.saglik?.dataUrl || "",
      iseOzelRiskler: person?.imzalar?.iseOzelRiskler?.dataUrl || "",
    },
  };

  return {
    ...payload,
    katilimcilar: [{ no: 1, ...fixedPersonel }],
    personel: fixedPersonel,
    egitim: {
      ...(payload?.egitim || {}),
      baslangicISO: person?.baslangicTarihi || "",
      bitisISO: person?.bitisTarihi || "",
    },
  };
};

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const generatePdf = async (person, type = "katilim") => {
  const token = getBearerToken(user);

  const payload = buildSinglePersonPayload(person);

 const jobType =
  type === "sertifika"
    ? "isegiris-sertifika"
    : type === "iseBaslama"
    ? "ise-baslama-formu"
    : type === "test"
    ? "isegiris-test"
    : "isegiris-egitim-katilim";

  const createRes = await fetch(`${API_BASE}/pdf/isegiris`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      type: jobType,
      data: payload,
    }),
  });

  if (!createRes.ok) {
    const txt = await createRes.text().catch(() => "");
    console.error("PDF CREATE JOB HATA:", createRes.status, txt);
    throw new Error(txt || `PDF işi oluşturulamadı: ${createRes.status}`);
  }

  const createData = await createRes.json();
  const jobId = createData?.jobId || createData?.id;

  if (!jobId) {
    throw new Error("PDF jobId alınamadı.");
  }

  for (let i = 0; i < 90; i++) {
    await sleep(1000);

   const statusRes = await fetch(`${API_BASE}/pdf/job/${jobId}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!statusRes.ok) {
      const txt = await statusRes.text().catch(() => "");
      throw new Error(txt || `PDF durumu alınamadı: ${statusRes.status}`);
    }

    const statusData = await statusRes.json();

    if (statusData?.status === "done") {
      const fileUrl =
        statusData?.resultFileUrl ||
        statusData?.fileUrl ||
        statusData?.url ||
        "";

      if (!fileUrl) {
        throw new Error("PDF tamamlandı ama dosya linki gelmedi.");
      }

            const absolutePdfUrl =
        fileUrl.startsWith("http://") || fileUrl.startsWith("https://")
          ? fileUrl
          : `${API_ORIGIN}${fileUrl.startsWith("/") ? "" : "/"}${fileUrl}`;

      return absolutePdfUrl;
    }

    if (statusData?.status === "error") {
      throw new Error(statusData?.error || "PDF oluşturma hatası.");
    }
  }

  throw new Error("PDF oluşturma zaman aşımına uğradı.");
};

 const generateBulkZip = async (rows, type = "katilim") => {
  const token = getBearerToken(user);

  const endpoint =
  type === "sertifika"
    ? `${API_BASE}/sertifika/pdf-bulk`
    : type === "iseBaslama"
    ? `${API_BASE}/ise-baslama-formu/pdf-bulk`
    : type === "test"
    ? `${API_BASE}/isegiris-test/pdf-bulk`
    : `${API_BASE}/egitim-katilim-formu/pdf-bulk`;


  const firstStartISO = rows?.[0]?.baslangicTarihi || "";
  const basePayload = buildPayload(firstStartISO, rows || []);

const bulkItems = (rows || []).map((person, index) => {
  const single = buildSinglePersonPayload(person);
  

const rawCevaplar = person?.testSonucu?.cevaplar || {};

const normalizedCevaplar = {};
Object.entries(rawCevaplar).forEach(([k, v]) => {
  const zeroIndex = Number(k);
  const answerIndex = Number(v);

  if (!Number.isNaN(zeroIndex) && !Number.isNaN(answerIndex)) {
    // 0 tabanlı: 0,1,2...
    normalizedCevaplar[String(zeroIndex)] = answerIndex;

    // 1 tabanlı: 1,2,3...
    normalizedCevaplar[String(zeroIndex + 1)] = answerIndex;
  }
});

const cevapArray = ISE_GIRIS_TEST_SORULARI.map((_, qIndex) => {
  const v = normalizedCevaplar[String(qIndex)];
  return Number.isNaN(Number(v)) ? null : Number(v);
});

const dogruSayisiHesap = ISE_GIRIS_TEST_SORULARI.reduce((total, soru, qIndex) => {
  const verilen =
    normalizedCevaplar[String(qIndex)] ??
    normalizedCevaplar[String(qIndex + 1)];

  return total + (Number(verilen) === Number(soru.dogru) ? 1 : 0);
}, 0);

const soruSayisiHesap = ISE_GIRIS_TEST_SORULARI.length;
const yanlisSayisiHesap = soruSayisiHesap - dogruSayisiHesap;
const toplamPuanHesap = dogruSayisiHesap * 10;
const basariOraniHesap = Math.round((dogruSayisiHesap / soruSayisiHesap) * 100);




const fixedPersonel = {
  ...(single.personel || {}),
  adSoyad: person?.adSoyad || "",
  gorev: person?.gorev || "",
  tc: normalizeTC(person?.tc),
  iseGirisTarihi: person?.iseGirisTarihi || "",
  iseGirisTarihiTR: isoToTR(person?.iseGirisTarihi || ""),
  baslangicTarihi: person?.baslangicTarihi || "",
  bitisTarihi: person?.bitisTarihi || "",
  personelFoto: person?.personelFoto || "",
  personelFotoDataUrl: person?.personelFoto || "",
  personelImzasi: getPersonelTekImza(person),
  personelTekImza: getPersonelTekImza(person),

  testSonucu: {
  ...(person?.testSonucu || {}),
  cevaplar: normalizedCevaplar,
  cevapArray,
  dogruSayisi: dogruSayisiHesap,
  yanlisSayisi: yanlisSayisiHesap,
  soruSayisi: soruSayisiHesap,
  toplamPuan: toplamPuanHesap,
  basariOrani: basariOraniHesap,
  tamamlandi: !!person?.testSonucu?.tamamlandi,
},

  cevaplar: normalizedCevaplar,
testCevaplari: normalizedCevaplar,
cevapArray,
testCevapArray: cevapArray,

testDogruSayisi: dogruSayisiHesap,
testYanlisSayisi: yanlisSayisiHesap,
testSoruSayisi: soruSayisiHesap,
testToplamPuan: toplamPuanHesap,
testBasariOrani: basariOraniHesap,
};

return {
  ...single,
  zipFileName: `${safeFile(person?.adSoyad || "PERSONEL")} - test.pdf`,
  testSorulari: ISE_GIRIS_TEST_SORULARI,
  personel: fixedPersonel,
  katilimcilar: [{ no: 1, ...fixedPersonel }],
};
});

const bulkPayload = {
  ...basePayload,
  testSorulari: ISE_GIRIS_TEST_SORULARI,
  items: bulkItems,
  katilimcilar:
    type === "test"
      ? bulkItems.map((x) => x.personel)
      : basePayload.katilimcilar,
};

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(bulkPayload),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `Sunucu hatası: ${res.status}`);
  }

  return await res.blob();
};

const handleTopluIseBaslamaZipIndir = async () => {
  if (!hasSelection) return;

  try {
    setBulkLoading(true);
    const blob = await generateBulkZip(seciliKayitlar, "iseBaslama");
    const firmaAdi = (selectedFirm?.firmaAdi || "firma").toString().replace(/\s+/g, "_");
    downloadBlobAsFile(blob, `${firmaAdi}_ise_baslama_formlari.zip`);
  } catch (e) {
    console.error(e);
    openInfo("Hata", "Toplu işe başlama ZIP hazırlanırken hata oluştu.");
  } finally {
    setBulkLoading(false);
  }
};

const handleTopluTestZipIndir = async () => {
  if (!hasSelection) return;

  const eksikTestliSecili = seciliKayitlar.filter(
    (row) => !row?.testSonucu?.tamamlandi
  );

  if (eksikTestliSecili.length > 0) {
    const ilkEksik = eksikTestliSecili[0];

    openInfo(
      "Eksik Test Uyarısı",
      `${ilkEksik.adSoyad || "İsimsiz satır"} için test tamamlanmamış.`
    );
    return;
  }

  try {
    setBulkLoading(true);

    const blob = await generateBulkZip(seciliKayitlar, "test");

    const firmaAdi = (selectedFirm?.firmaAdi || "firma")
      .toString()
      .replace(/\s+/g, "_");

    downloadBlobAsFile(blob, `${firmaAdi}_testler.zip`);
  } catch (e) {
    console.error(e);
    openInfo("Hata", "Toplu test ZIP hazırlanırken hata oluştu.");
  } finally {
    setBulkLoading(false);
  }
};

  const handleTopluKatilimZipIndir = async () => {
    if (!hasSelection) return;

  const eksikImzaliSecili = seciliKayitlar.filter((row) => {
    const missing = getMissingSignatureLabels(row, egitimBilgileri);
    return missing.length > 0;
  });

  if (eksikImzaliSecili.length > 0) {
    const ilkEksik = eksikImzaliSecili[0];
    const eksikAlanlar = getMissingSignatureLabels(ilkEksik, egitimBilgileri);

    openInfo(
      "Eksik İmza Uyarısı",
      `${ilkEksik.adSoyad || "İsimsiz satır"} için eksik imzalar var: ${eksikAlanlar.join(", ")}`
    );
    return;
  }

    const anyMissing = seciliKayitlar.some((r) => !r.baslangicTarihi || !r.bitisTarihi);
    if (anyMissing) {
      openInfo(
        "Bilgilendirme",
        "Seçili personellerin eğitim başlangıç/bitiş tarihleri eksik. Lütfen tamamlayın."
      );
      return;
    }

    try {
      setBulkLoading(true);
      const items = seciliKayitlar.map((k) => buildPayload(k.baslangicTarihi, [k]));
      const blob = await generateBulkZip(seciliKayitlar, "katilim");
      const firmaAdi = (selectedFirm?.firmaAdi || "firma").toString().replace(/\s+/g, "_");
      downloadBlobAsFile(blob, `${firmaAdi}_egitim_katilim_formlari.zip`);
    } catch (e) {
      console.error(e);
      openInfo("Hata", "Toplu katılım formu ZIP hazırlanırken hata oluştu.");
    } finally {
      setBulkLoading(false);
    }
  };

  const handleTopluSertifikaZipIndir = async () => {
  if (!hasSelection) return;

  const eksikImzaliSecili = seciliKayitlar.filter((row) => {
    const missing = getMissingSignatureLabels(row, egitimBilgileri);
    return missing.length > 0;
  });

  if (eksikImzaliSecili.length > 0) {
    const ilkEksik = eksikImzaliSecili[0];
    const eksikAlanlar = getMissingSignatureLabels(ilkEksik, egitimBilgileri);

    openInfo(
      "Eksik İmza Uyarısı",
      `${ilkEksik.adSoyad || "İsimsiz satır"} için eksik imzalar var: ${eksikAlanlar.join(", ")}`
    );
    return;
  }

  const iseGirisEksik = seciliKayitlar.some(
    (r) =>
      !r.iseGirisTarihi ||
      String(r.iseGirisTarihi).includes("gg") ||
      String(r.iseGirisTarihi).trim() === ""
  );

  if (iseGirisEksik) {
    openInfo(
      "Bilgilendirme",
      "Seçili personeller için İşe Giriş Tarihi zorunludur."
    );
    return;
  }

  const anyMissing = seciliKayitlar.some((r) => !r.baslangicTarihi || !r.bitisTarihi);
  if (anyMissing) {
    openInfo(
      "Bilgilendirme",
      "Seçili personellerin bazı eğitim tarihleri eksik. Sertifika için tarihleri doldurmanı öneririm."
    );
  }

    try {
      setBulkLoading(true);
      const items = seciliKayitlar.map((k) => {
        const base = buildPayload(k.baslangicTarihi, [k]);
        return {
          ...base,
          personel: { adSoyad: k?.adSoyad || "", gorev: k?.gorev || "" },
        };
      });
      const blob = await generateBulkZip(seciliKayitlar, "sertifika");
      const firmaAdi = (selectedFirm?.firmaAdi || "firma").toString().replace(/\s+/g, "_");
      downloadBlobAsFile(blob, `${firmaAdi}_sertifikalar.zip`);
    } catch (e) {
      console.error(e);
      openInfo("Hata", "Toplu sertifika ZIP hazırlanırken hata oluştu.");
    } finally {
      setBulkLoading(false);
    }
  };

  const openModal = async (tip) => {
  setModalTip(tip);
  setPdfError("");

  if (!hasSelection) {
    openInfo("Bilgilendirme", "Lütfen en az 1 personel seçiniz.");
    return;
  }

  if (tip === "katilim" || tip === "sertifika" || tip === "iseBaslama" || tip === "test") {
    if (seciliKayitlar.length > 1) {
      openInfo(
        "Bilgilendirme",
        tip === "katilim"
          ? "Eğitim Katılım Formu için yalnızca 1 personel seçebilirsiniz. Birden fazla personel için Toplu Katılım Formu İndir (ZIP) butonunu kullanınız."
          : "Sertifika için yalnızca 1 personel seçebilirsiniz. Birden fazla personel için Toplu Sertifikaları İndir (ZIP) butonunu kullanınız."
      );
      return;
    }

    const kisi = seciliKayitlar[0];

    setModalOpen(true);
setPdfLoading(true);
setPdfProgress(5);
setPdfUrl(null);
setPdfError("");

const progressTimer = setInterval(() => {
  setPdfProgress((prev) => {
    if (prev >= 92) return prev;
    return prev + Math.floor(Math.random() * 6) + 2;
  });
}, 700);

    try {
      const createdUrl = await generatePdf(kisi, tip);

clearInterval(progressTimer);
setPdfProgress(100);
setPdfUrl(createdUrl);

setTimeout(() => {
  setPdfLoading(false);
}, 400);

} catch (e) {
  clearInterval(progressTimer);
  setPdfLoading(false);
  setPdfProgress(0);

  console.error(e);
  setPdfError("PDF hazırlanırken hata oluştu.");
} finally {
  clearInterval(progressTimer);
}

    return;
  }

  setModalData(seciliKayitlar);
  setModalOpen(true);
};



  const closeModal = () => {
    setModalOpen(false);
    setModalTip(null);
    setModalData(null);
   setPdfUrl(null);
setPdfLoading(false);
setPdfProgress(0);
setBulkSaveLoading(false);
setPdfError("");
  };

  const handleYeniSekmedeAc = () => {
    if (!pdfUrl) return;
    window.open(pdfUrl, "_blank");
  };

  const handleIndir = async () => {
    try {
      if (!pdfUrl) return;

      const first = seciliKayitlar?.[0];

      const startISO =
        (modalData?.egitim?.baslangicISO || first?.baslangicTarihi || "").toString();
      const tarihTR = startISO ? isoToTR(startISO) : trNow();

      const short = modalTip === "sertifika" ? "SERTIFIKA" : "KATILIM";

      const distinctCount = getDistinctDateRangeCount(seciliKayitlar);
      const isTopluKatilim =
        modalTip === "katilim" && seciliKayitlar.length > 1 && distinctCount === 1;

      const baseName = isTopluKatilim
        ? safeFile(getTopluEgitimEtiketi(seciliKayitlar.length))
        : safeFile(first?.adSoyad || "PERSONEL");

      const fileName = `${baseName} (${short}-${tarihTR}).pdf`;

      const res = await fetch(pdfUrl);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(() => {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch {}
      }, 1500);
    } catch (e) {
      console.error("İşe giriş PDF indirme hatası:", e);
      openInfo("Hata", "PDF indirilemedi.");
    }
  };

  const handleBelgelerimeKaydet = async () => {
    if (!pdfUrl) return openInfo("Bilgilendirme", "Önce PDF oluşmalı.");
    if (!selectedFirm?.id) return openInfo("Bilgilendirme", "Firma seçili değil.");

    try {
      const raw = localStorage.getItem(EGITIM_DOCS_KEY);
      const list = raw ? JSON.parse(raw) : [];

      const now = new Date();
      const first = seciliKayitlar?.[0];

      const startISO =
        (modalData?.egitim?.baslangicISO || first?.baslangicTarihi || "").toString();
      const yil = startISO ? Number(startISO.slice(0, 4)) : now.getFullYear();
      const tarihTR = startISO ? isoToTR(startISO) : now.toLocaleDateString("tr-TR");

      const turMap = {
  iseBaslama: "İşe Başlama Formu",
  katilim: "Eğitim Katılım Formu",
  test: "Test",
  sertifika: "Sertifika",
};

const shortMap = {
  iseBaslama: "ISE-BASLAMA",
  katilim: "KATILIM",
  test: "TEST",
  sertifika: "SERTIFIKA",
};

const tur = turMap[modalTip] || "Eğitim Katılım Formu";
const short = shortMap[modalTip] || "KATILIM";

      const distinctCount = getDistinctDateRangeCount(seciliKayitlar);
      const isTopluKatilim =
        modalTip === "katilim" && seciliKayitlar.length > 1 && distinctCount === 1;

      const topluEtiket = isTopluKatilim
        ? safeFile(getTopluEgitimEtiketi(seciliKayitlar.length))
        : "";

      const adSoyad = isTopluKatilim ? "" : safeFile(first?.adSoyad || "PERSONEL");
      const personelAdSoyad = isTopluKatilim ? topluEtiket : adSoyad;
      const gorev = isTopluKatilim ? "" : safeFile(first?.gorev || "");

      const exists =
        Array.isArray(list) &&
        list.some(
          (d) =>
            String(d?.firmaId) === String(selectedFirm.id) &&
            String(d?.tur || d?.belgeTuru || d?.kategori) === String(tur) &&
            String(d?.adSoyad || d?.personelAdSoyad || "").toLocaleUpperCase("tr-TR") ===
              personelAdSoyad &&
            String(d?.yil) === String(yil)
        );

      const doSave = async () => {
  try {
    const token = getBearerToken(user);

    if (!token) {
      openInfo("Hata", "Oturum bilgisi bulunamadı. Lütfen tekrar giriş yapın.");
      return;
    }

const first =
  modalData?.personel ||
  modalData?.row ||
  modalData ||
  seciliKayitlar?.[0] ||
  {};

const personelAdSoyad = safeFile(
  first?.adSoyad ||
  first?.personelAdSoyad ||
  first?.personName ||
  ""
);

if (!personelAdSoyad) {
  openInfo("Uyarı", "Personel adı bulunamadı. Lütfen personel satırındaki Ad Soyad alanını kontrol edin.");
  return;
}

const gorev = first?.gorev || "";
const yil =
  Number((first?.bitisTarihi || first?.baslangicTarihi || "").slice(0, 4)) ||
  new Date().getFullYear();

const turMap = {
  iseBaslama: "İşe Başlama Formu",
  katilim: "Eğitim Katılım Formu",
  test: "Test",
  sertifika: "Sertifika",
};

const shortMap = {
  iseBaslama: "ISE-BASLAMA",
  katilim: "KATILIM",
  test: "TEST",
  sertifika: "SERTIFIKA",
};

const kategori = turMap[modalTip] || "Eğitim Katılım Formu";
const tur = turMap[modalTip] || "Eğitim Katılım Formu";
const short = shortMap[modalTip] || "KATILIM";

const hazirlayan =
  imzalar?.isgUzmaniAdi ||
  getUzmanAdiSoyadi?.() ||
  user?.adSoyad ||
  user?.name ||
  user?.fullName ||
  "";

    const fileName = `${personelAdSoyad} (ISE-GIRIS-${short}-${yil}).pdf`;
    const pdfBlob = await fetch(pdfUrl).then((r) => r.blob());

    const uploadForm = new FormData();
    uploadForm.append("file", pdfBlob, fileName);

    const uploadRes = await fetch(`${API_BASE}/documents/upload-pdf`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: uploadForm,
    });

    if (!uploadRes.ok) {
      const text = await uploadRes.text().catch(() => "");
      console.error("İşe giriş pdf upload hata:", text);
      openInfo("Hata", "PDF dosyası sunucuya yüklenemedi.");
      return;
    }

    const uploadJson = await uploadRes.json();
    const uploadedFileUrl = uploadJson?.fileUrl || "";
    const uploadedAbsoluteUrl = uploadJson?.absoluteUrl || "";

    if (!uploadedFileUrl && !uploadedAbsoluteUrl) {
      openInfo("Hata", "PDF sunucuya yüklenmeden Belgelerime Kaydet yapılamaz.");
      return;
    }

    const yeniBelge = {
      id: Date.now(),
      firmaId: selectedFirm?.id,
      firmaAdi: selectedFirm?.firmaAdi || "Firma",
      adSoyad: personelAdSoyad,
      personelAdSoyad,
      gorev,
      hazirlayan: hazirlayan || "",
      kategori,
      tur,
      belgeTuru: "İşe Giriş Eğitimi",
      category: "egitim",
subCategory: tur,
type: tur,
belgeTuruAlt: tur,
documentTypeAlt: tur,
      baslik: `${personelAdSoyad} - ${tur}`,
      yil,
      durum: "Hazır",
      status: "hazir",
      tarih: first?.bitisTarihi || first?.baslangicTarihi || "",
      tarihISO: first?.bitisTarihi || first?.baslangicTarihi || "",
      dosyaTuru: "PDF",
      fileType: "PDF",
      fileUrl: uploadedFileUrl,
      absoluteUrl: uploadedAbsoluteUrl,
      fileName,
      createdAt: new Date().toISOString(),
    };

    const res = await fetch(`${API_BASE}/documents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        firmaId: yeniBelge.firmaId,
        firmaAdi: yeniBelge.firmaAdi,
        category: "egitim",
        subCategory: yeniBelge.tur,
        belgeTuru: yeniBelge.belgeTuru,
        belgeTuruAlt: yeniBelge.kategori,
        title: yeniBelge.baslik,
        dateISO: yeniBelge.tarihISO,
        tarihISO: yeniBelge.tarihISO,
        tarih: yeniBelge.tarih,
        iseGirisTarihi: first?.iseGirisTarihi || "",
        baslangicTarihi: first?.baslangicTarihi || "",
        bitisTarihi: first?.bitisTarihi || "",
        gecerlilik: hesaplaGecerlilik(first?.bitisTarihi, selectedFirm?.tehlike || ""),
        year: yeniBelge.yil,

        personName: yeniBelge.personelAdSoyad || yeniBelge.adSoyad,
        adSoyad: yeniBelge.adSoyad,
        personelAdSoyad: yeniBelge.personelAdSoyad,
        gorev: yeniBelge.gorev,

        hazirlayan: yeniBelge.hazirlayan || "",
        hazirlayanAdSoyad: yeniBelge.hazirlayan || "",
        hazirlayanKisi: yeniBelge.hazirlayan || "",
        olusturan: yeniBelge.hazirlayan || "",
        olusturanAdSoyad: yeniBelge.hazirlayan || "",
        preparedBy: yeniBelge.hazirlayan || "",
        preparedByName: yeniBelge.hazirlayan || "",
        createdByName: yeniBelge.hazirlayan || "",
        userName: yeniBelge.hazirlayan || "",

        createdBy: yeniBelge.hazirlayan || "",
        createdByUserId: user?._id || user?.id || "",

        status: "hazir",
        durum: "Hazır",
        fileUrl: uploadedFileUrl,
        absoluteUrl: uploadedAbsoluteUrl,
        fileName: yeniBelge.fileName,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("Belgelerime kaydedilemedi:", text);
      openInfo("Hata", "Belge server kaydına eklenemedi.");
      return;
    }

    try {
      localStorage.setItem(DOCS_SYNC_KEY, String(Date.now()));
    } catch {}

    window.dispatchEvent(new Event(DOCS_SYNC_KEY));
    window.dispatchEvent(new Event("ticari_docs_refresh"));

    openInfo("Bilgilendirme", "Belgelerim, Eğitim & Sertifikalar sekmesine kaydedildi ✅");
  } catch (e) {
    console.error("Belgelerime kaydet hata:", e);
    openInfo("Hata", "Belge kaydedilirken hata oluştu.");
  }
};

      if (exists) {
        openConfirm({
          title: "Uyarı",
          message: `UYARI:\n${personelAdSoyad} için ${yil} yılı "${tur}" zaten kayıtlı.\n\nYine de kaydetmek ister misiniz?`,
          confirmText: "Yine de Kaydet",
          cancelText: "İptal",
          variant: "warning",
          onConfirm: doSave,
        });
        return;
      }

      doSave();
    } catch (e) {
      console.error("Belgelerime kaydet hata:", e);
      openInfo("Hata", "Belge kaydedilirken hata oluştu.");
    }
  };



  if (!selectedFirm) {
    return (
      <CardBox>
        <SectionTitle
          title="İşe Giriş Eğitimi"
          subtitle="Devam etmek için lütfen bir firma seçiniz."
        />
      </CardBox>
    );
  }

  return (
    <>
      <style>{hideModalHeaderCloseStyle}</style>

      <CardBox className="flex flex-col gap-4">
        <SectionTitle
          title="İşe Giriş Eğitimi"
          subtitle="İşe giriş eğitim planını ve belgelerini hazırlayabilirsiniz."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <label className="mb-1 block text-xs text-slate-500">Firma Adı</label>
            <input
              readOnly
              value={selectedFirm.firmaAdi || ""}
              className={readonlyInputClass}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-500">Tehlike Sınıfı</label>
            <input
              readOnly
              value={selectedFirm.tehlike || ""}
              className={readonlyInputClass}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-500">Eğitimin Verildiği Yer</label>
            <input
              type="text"
              value={egitimBilgileri.yer}
              onChange={(e) =>
                setEgitimBilgileri((prev) => ({ ...prev, yer: e.target.value }))
              }
              className={readonlyInputClass}
            />
          </div>
        </div>

        <div className="border rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold text-[#0a2b45]">Eğitim Bilgileri</h3>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm pt-1">
            <div>
              <label className="mb-1 block text-xs text-slate-500">
                Genel Konular (Saat)
              </label>
              <input
                type="number"
                min="0"
                className={readonlyInputClass}
                value={egitimBilgileri.genelSaat}
                onChange={(e) => handleSaatChange("genelSaat", e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-500">
                Teknik Konular (Saat)
              </label>
              <input
                type="number"
                min="0"
                className={readonlyInputClass}
                value={egitimBilgileri.teknikSaat}
                onChange={(e) => handleSaatChange("teknikSaat", e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-500">
                Sağlık Konuları (Saat)
              </label>
              <input
                type="number"
                min="0"
                className={readonlyInputClass}
                value={egitimBilgileri.saglikSaat}
                onChange={(e) => handleSaatChange("saglikSaat", e.target.value)}
              />
            </div>

            <div>
  <label className="mb-1 block text-xs text-slate-500">
    İşe Özel Riskler (Saat)
  </label>
  <input
    type="number"
    min="0"
    className={readonlyInputClass}
    value={egitimBilgileri.iseOzelRisklerSaat}
    onChange={(e) => handleSaatChange("iseOzelRisklerSaat", e.target.value)}
  />
</div>
          </div>
        </div>

        <div className="border rounded-lg p-4 space-y-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <h3 className="text-sm font-semibold text-[#0a2b45]">
              İşe Giriş Eğitimine Katılan Personel
            </h3>

            <div className="flex flex-wrap items-end gap-2 text-xs">
              <div>
                <label className="block text-[10px] text-slate-500 mb-0.5">
                  Toplu Başlangıç
                </label>
                <input
                  type="date"
                  value={topluTarih.baslangic}
                  onChange={(e) =>
                    setTopluTarih((p) => ({ ...p, baslangic: e.target.value }))
                  }
                  className="w-full min-w-0 h-11 rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-800 [color-scheme:light]"
                  style={{ WebkitAppearance: "none", appearance: "none" }}
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 mb-0.5">
                  Toplu Bitiş
                </label>
                <input
                  type="date"
                  value={topluTarih.bitis}
                  onChange={(e) =>
                    setTopluTarih((p) => ({ ...p, bitis: e.target.value }))
                  }
                  disabled={topluOtoBitis}
                  className="w-full min-w-0 h-11 rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-800 [color-scheme:light] disabled:bg-slate-50"
                  style={{ WebkitAppearance: "none", appearance: "none" }}
                />
              </div>

              <label className="inline-flex items-center gap-2 text-[11px] text-slate-600">
                <input
                  type="checkbox"
                  checked={topluOtoBitis}
                  onChange={(e) => setTopluOtoBitis(e.target.checked)}
                />
                Toplu bitiş otomatik
              </label>

              <label className="inline-flex items-center gap-2 text-[11px] text-slate-600">
                <input
                  type="checkbox"
                  checked={bireyselOto}
                  onChange={(e) => setBireyselOto(e.target.checked)}
                />
                Satır bitiş otomatik
              </label>

              <PrimaryButton
                size="sm"
                disabled={!canApplyBulkDate}
                onClick={handleTopluTarihUygula}
              >
                Seçili Kayıtlara Tarih Uygula
              </PrimaryButton>

              <button
                type="button"
                onClick={satirEkle}
                className="px-3 py-1 text-[11px] rounded border border-slate-300 bg-slate-50 hover:bg-slate-100 ml-auto"
              >
                + Yeni Satır Ekle (En Üste)
              </button>
            </div>
          </div>

          <div className="w-full overflow-x-auto rounded-lg border">
  <div className="max-h-[360px] overflow-y-auto">
    <table className="min-w-[1450px] w-full text-xs sm:text-sm border-collapse">
      <thead className="bg-slate-100">
        <tr>
          <th className="border px-2 py-2 w-10 text-center sticky top-0 bg-slate-100">
            ✓
          </th>
          <th className="border px-2 py-2 w-12 text-center sticky top-0 bg-slate-100">
            No
          </th>
          <th className="border px-3 py-2 min-w-[150px] sticky top-0 bg-slate-100">
            T.C. Numarası
          </th>
          <th className="border px-3 py-2 min-w-[220px] sticky top-0 bg-slate-100">
            Adı Soyadı
          </th>
          <th className="border px-3 py-2 min-w-[180px] sticky top-0 bg-slate-100">
            Görevi
          </th>
          <th className="border px-3 py-2 min-w-[170px] sticky top-0 bg-slate-100">
            İşe Giriş Tarihi
          </th>
          <th className="border px-3 py-2 min-w-[150px] sticky top-0 bg-slate-100">
            Başlangıç
          </th>
          <th className="border px-3 py-2 min-w-[150px] sticky top-0 bg-slate-100">
            Bitiş
          </th>
          <th className="border px-3 py-2 min-w-[140px] sticky top-0 bg-slate-100">
            Geçerlilik
          </th>
          <th className="border px-3 py-2 min-w-[120px] sticky top-0 bg-slate-100">
  İmza / Foto
</th>

<th className="border px-3 py-2 min-w-[120px] sticky top-0 bg-slate-100">
  Test
</th>
        </tr>
      </thead>

              <tbody>
                {katilimcilar.map((k, index) => {
                  const kontrol = getUcAyKontrolDurumu(
                    k.iseGirisTarihi,
                    k.baslangicTarihi
                  );

                  const colorClass =
                    kontrol.status === "uygun"
                      ? "text-green-700"
                      : kontrol.status === "uygunsuz"
                      ? "text-red-700"
                      : "text-slate-500";

                  return (
                    <tr key={index} className={getRowStatusClass(k.bitisTarihi)}>
                      <td className="border px-2 py-1 text-center">
                        <input
                          type="checkbox"
                          checked={k.secili || false}
                          onChange={() => handleSecimToggle(index)}
                        />
                      </td>

                      <td className="border px-2 py-1 text-center">{k.no}</td>

                      <td className="border px-2 py-1">
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={11}
                          className={tableInputClass}
                          value={k.tc}
                          onChange={(e) =>
                            handleKatilimciChange(index, "tc", e.target.value)
                          }
                        />
                      </td>

                      <td className="border px-2 py-1">
                        <input
                          type="text"
                          className={tableInputClass}
                          value={k.adSoyad}
                          onChange={(e) =>
                            handleKatilimciChange(index, "adSoyad", e.target.value)
                          }
                        />
                      </td>

                      <td className="border px-2 py-1">
                        <input
                          type="text"
                          className={tableInputClass}
                          value={k.gorev}
                          onChange={(e) =>
                            handleKatilimciChange(index, "gorev", e.target.value)
                          }
                        />
                      </td>

                      <td className="border px-2 py-1">
                        <input
                          type="date"
                          value={k.iseGirisTarihi || ""}
                          onChange={(e) =>
                            handleKatilimciChange(index, "iseGirisTarihi", e.target.value)
                          }
                          className="w-full min-w-[160px] sm:min-w-0 h-11 rounded-lg border border-gray-300 bg-white px-3 text-xs sm:text-sm text-gray-800 text-center [color-scheme:light] focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                          style={{ WebkitAppearance: "none", appearance: "none" }}
                        />
                      </td>

                      <td className="border px-2 py-1">
                        <input
                          type="date"
                          value={k.baslangicTarihi}
                          onChange={(e) =>
                            handleKatilimciChange(index, "baslangicTarihi", e.target.value)
                          }
                          className="w-full min-w-[150px] sm:min-w-0 h-11 rounded-lg border border-gray-300 bg-white px-3 text-xs sm:text-sm text-gray-800 text-center [color-scheme:light] focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                          style={{ WebkitAppearance: "none", appearance: "none" }}
                        />
                      </td>

                    <td className="border px-2 py-1">
  <input
    type="date"
    value={k.bitisTarihi}
    onChange={(e) =>
      handleKatilimciChange(index, "bitisTarihi", e.target.value)
    }
    disabled={bireyselOto}
    className="w-full min-w-[150px] sm:min-w-0 h-11 rounded-lg border border-gray-300 bg-white px-3 text-xs sm:text-sm text-gray-800 text-center [color-scheme:light] focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:bg-slate-50"
    style={{ WebkitAppearance: "none", appearance: "none" }}
  />
</td>


                      <td className="border px-2 py-1 text-center">
                        <span className="text-[11px]">
                          {hesaplaGecerlilik(k.bitisTarihi, selectedFirm?.tehlike || "")
                            ? isoToTR(
                                hesaplaGecerlilik(
                                  k.bitisTarihi,
                                  selectedFirm?.tehlike || ""
                                )
                              )
                            : "-"}
                        </span>
                      </td>
<td className="border px-2 py-1 text-center align-middle">
  <div className="flex items-center justify-center gap-2 whitespace-nowrap">
    <button
      type="button"
      onClick={() => openSignatureModal(index)}
      className="inline-flex h-8 min-w-[58px] items-center justify-center rounded-md border border-blue-200 bg-blue-50 px-2 text-[11px] text-blue-700 hover:bg-blue-100"
      title="Personel imzaları"
    >
      İmza
    </button>

    <span className="text-[11px] font-medium text-slate-600">
      ({getImzaProgress(k, egitimBilgileri).text})
    </span>

    <label
      className={[
        "inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border text-[14px] shadow-sm transition",
        k?.personelFoto
          ? "border-green-500 bg-green-50 text-green-700 hover:bg-green-100"
          : "border-red-500 bg-red-50 text-red-700 hover:bg-red-100",
      ].join(" ")}
      title={k?.personelFoto ? "Fotoğraf kaydedildi" : "Fotoğraf yok"}
    >
      📷
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          void handlePersonelFotoChange(index, file);
          e.target.value = "";
        }}
      />
    </label>
  </div>
</td>

<td className="border px-2 py-1 text-center">
  <button
    type="button"
    onClick={() => openTestModal(index)}
    className="inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-blue-700"
    title="Personel testi"
  >
    Test
  </button>
</td>

                    </tr>
                  );
                   })}
    </tbody>
  </table>
  </div>
</div>

          <div className="flex justify-end">
            <PrimaryButton size="sm" variant="green" onClick={handleKatilimcilarKaydet}>
              Katılımcıları Kaydet
            </PrimaryButton>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-end gap-2 pt-2 border-t border-slate-200">
  <PrimaryButton
    size="sm"
    className="w-full sm:w-auto"
    disabled={!hasSelection || bulkLoading || pdfLoading}
    onClick={() => openModal("iseBaslama")}
  >
    İşe Başlama Formu Hazırla
  </PrimaryButton>

  <PrimaryButton
    size="sm"
    className="w-full sm:w-auto"
    disabled={!hasSelection || bulkLoading || pdfLoading}
    onClick={() => openModal("katilim")}
  >
    Eğitim Katılım Formu Hazırla
  </PrimaryButton>

  <PrimaryButton
    size="sm"
    className="w-full sm:w-auto"
    disabled={!hasSelection || bulkLoading || pdfLoading}
    onClick={() => openModal("test")}
  >
    Test Hazırla
  </PrimaryButton>

  <PrimaryButton
    size="sm"
    className="w-full sm:w-auto"
    disabled={!hasSelection || bulkLoading || pdfLoading}
    onClick={() => openModal("sertifika")}
  >
    Sertifika Hazırla
  </PrimaryButton>

  <PrimaryButton
    size="sm"
    variant="green"
    className="w-full sm:w-auto"
    disabled={!hasSelection || bulkLoading}
    onClick={handleTopluIseBaslamaZipIndir}
  >
    {bulkLoading ? "Hazırlanıyor..." : "Toplu İşe Başlama İndir"}
  </PrimaryButton>

  <PrimaryButton
    size="sm"
    variant="green"
    className="w-full sm:w-auto"
    disabled={!hasSelection || bulkLoading}
    onClick={handleTopluKatilimZipIndir}
  >
    {bulkLoading ? "Hazırlanıyor..." : "Toplu Katılım Formu İndir"}
  </PrimaryButton>

  <PrimaryButton
    size="sm"
    variant="green"
    className="w-full sm:w-auto"
    disabled={!hasSelection || bulkLoading}
    onClick={handleTopluTestZipIndir}
  >
    {bulkLoading ? "Hazırlanıyor..." : "Toplu Test İndir"}
  </PrimaryButton>

  <PrimaryButton
    size="sm"
    variant="green"
    className="w-full sm:w-auto"
    disabled={!hasSelection || bulkLoading}
    onClick={handleTopluSertifikaZipIndir}
  >
    {bulkLoading ? "Hazırlanıyor..." : "Toplu Sertifika İndir"}
  </PrimaryButton>
</div>

{hasSelection && (
          <p className="text-[10px] text-slate-400 text-right">
            Not: Toplu eğitimlerde Eğitim Katılım Formu için seçili kişilerin tarih aralığı aynı olmalıdır.
          </p>
        )}
      </CardBox>

{testModalOpen && (
  <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-3">
    <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
      
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Test
          </h3>

          <p className="text-[11px] text-slate-500">
            10 sorunun tamamını cevapladıktan sonra kaydedebilirsiniz.
          </p>
        </div>

        <button
          type="button"
          onClick={closeTestModal}
          className="inline-flex h-8 min-w-[32px] items-center justify-center rounded-md px-2 text-xs text-slate-500 transition hover:bg-slate-100"
        >
          ✕
        </button>
      </div>

      <div className="space-y-4 p-4">

        <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          Cevaplanan soru: {getAnsweredTestCount()} / {ISE_GIRIS_TEST_SORULARI.length}
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full bg-blue-600 transition-all"
            style={{
              width: `${
                (getAnsweredTestCount() /
                  ISE_GIRIS_TEST_SORULARI.length) *
                100
              }%`,
            }}
          />
        </div>

        {(() => {
          const soru =
            ISE_GIRIS_TEST_SORULARI[activeTestQuestionIndex];

          return (
            <div className="rounded-xl border border-slate-200 p-4">

              <div className="mb-3 text-sm font-semibold text-slate-900">
                Soru {activeTestQuestionIndex + 1} / {ISE_GIRIS_TEST_SORULARI.length}
              </div>

              <p className="mb-3 text-sm text-slate-800">
                {soru.soru}
              </p>

              <div className="space-y-2">
                {soru.secenekler.map(
                  (secenek, secenekIndex) => (
                    <label
                      key={secenekIndex}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
                    >
                      <input
                        type="radio"
                        name={`test-soru-${activeTestQuestionIndex}`}
                        checked={
                          testAnswers[
                            activeTestQuestionIndex
                          ] === secenekIndex
                        }
                        onChange={() =>
                          handleTestAnswerChange(
                            activeTestQuestionIndex,
                            secenekIndex
                          )
                        }
                      />

                      <span>
                        {String.fromCharCode(
                          65 + secenekIndex
                        )}
                        ) {secenek}
                      </span>
                    </label>
                  )
                )}
              </div>
            </div>
          );
        })()}

        <div className="flex items-center justify-between gap-2">

          <button
            type="button"
            disabled={activeTestQuestionIndex === 0}
            onClick={() =>
              setActiveTestQuestionIndex((p) =>
                Math.max(0, p - 1)
              )
            }
            className="inline-flex h-8 min-w-[78px] items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 transition shadow-sm hover:bg-slate-50 disabled:opacity-40"
          >
            Önceki
          </button>

          <span className="text-xs text-slate-500">
            {getAnsweredTestCount()} / 10 cevaplandı
          </span>

          <button
            type="button"
            disabled={
              activeTestQuestionIndex ===
              ISE_GIRIS_TEST_SORULARI.length - 1
            }
            onClick={() =>
              setActiveTestQuestionIndex((p) =>
                Math.min(
                  ISE_GIRIS_TEST_SORULARI.length - 1,
                  p + 1
                )
              )
            }
            className="inline-flex h-8 min-w-[78px] items-center justify-center rounded-md bg-blue-600 px-3 text-xs font-medium text-white transition shadow-sm hover:bg-blue-700 disabled:opacity-40"
          >
            Sonraki
          </button>
        </div>

        <div className="flex justify-end border-t border-slate-200 pt-3">
          <button
            type="button"
            onClick={handleTestKaydet}
            disabled={
              getAnsweredTestCount() <
              ISE_GIRIS_TEST_SORULARI.length
            }
            className="inline-flex h-8 min-w-[78px] items-center justify-center rounded-md bg-green-600 px-3 text-xs font-medium text-white transition shadow-sm hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Kaydet
          </button>
        </div>
      </div>
    </div>
  </div>
)}

     <Modal
  isOpen={modalOpen}
  onClose={closeModal}
  title="İşe Giriş Eğitimi"
  headerActions={
    <div className="flex flex-col gap-1 w-full sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
      <button
        type="button"
        onClick={handleYeniSekmedeAc}
        disabled={!pdfUrl || pdfLoading}
        className="w-full sm:w-auto px-2 py-1 text-[10px] sm:text-xs rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Yeni sekmede aç
      </button>

      <button
        type="button"
        onClick={handleIndir}
        disabled={!pdfUrl || pdfLoading}
        className="w-full sm:w-auto px-2 py-1 text-[10px] sm:text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        İndir (PDF)
      </button>

      <button
        type="button"
        onClick={handleBelgelerimeKaydet}
        disabled={!pdfUrl || pdfLoading}
        className="w-full sm:w-auto px-2 py-1 text-[10px] sm:text-xs rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Belgelerime Kaydet
      </button>
    </div>
  }
>
  {pdfLoading && (
  <div className="w-full h-[50vh] sm:h-[60vh] flex items-center justify-center px-4">
    <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-center">
      <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />

      <div className="text-base font-bold text-slate-800">
        PDF hazırlanıyor...
      </div>

      <div className="mt-2 text-2xl font-bold text-blue-600">
        %{pdfProgress}
      </div>

      <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-blue-600 transition-all duration-500"
          style={{ width: `${pdfProgress}%` }}
        />
      </div>

      <div className="mt-3 text-xs sm:text-sm text-slate-500">
        Evrak oluşturuluyor, lütfen bekleyiniz.
      </div>
    </div>
  </div>
)}

  {!pdfLoading && pdfUrl && (
    <iframe
      key={pdfUrl}
      title={modalTip === "sertifika" ? "pdfPreviewIseGirisSertifika" : "pdfPreviewIseGirisKatilim"}
      src={pdfUrl}
      className="w-full h-[50vh] sm:h-[60vh] border border-gray-200 rounded"
    />
  )}

  {!pdfLoading && !pdfUrl && (
    <div className="w-full h-[50vh] sm:h-[60vh] flex items-center justify-center text-sm text-gray-600">
      {pdfError || "PDF bulunamadı. Lütfen yeniden deneyin."}
    </div>
  )}
</Modal>

         <Modal
  isOpen={signatureModalOpen}
  onClose={closeSignatureModal}
  title={`Personel İmzası - ${getActiveSignatureLabel()}`}
>

<div className="flex flex-col gap-4">
  <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs sm:text-sm text-slate-700">
    <div><strong>Personel:</strong> {getCurrentSignatureRow()?.adSoyad || "-"}</div>
  </div>

  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
    <div className="flex flex-wrap items-center gap-2">
      {getRequiredImzaKeysBySaat(egitimBilgileri).map((fieldKey) => {
        const fieldDef = EGITIM_IMZA_FIELDS.find((f) => f.key === fieldKey);
        const signed = getSignatureStepStatus(getCurrentSignatureRow(), fieldKey);
        const active = activeSignatureField === fieldKey;

        return (
          <button
            key={fieldKey}
            type="button"
            onClick={() => setActiveSignatureField(fieldKey)}
            className={`inline-flex items-center justify-center rounded-md px-2 py-1 text-[11px] font-medium border ${
              active
                ? "border-blue-300 bg-blue-50 text-blue-700"
                : signed
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
            }`}
          >
            {fieldDef?.label || fieldKey}
          </button>
        );
      })}
    </div>
  </div>

  <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-3 text-xs sm:text-sm text-slate-700">
    <input
      type="checkbox"
      checked={signatureConsentChecked}
      onChange={(e) => setSignatureConsentChecked(e.target.checked)}
      className="mt-0.5"
    />
    <span>
      Eğitimin tarafıma eksiksiz olarak verildiğini, içeriğini anladığımı ve bu hususu kabul ettiğimi beyan ederim.
    </span>
  </label>

  <div className="rounded-xl border border-dashed border-slate-300 bg-white p-3 sm:p-4">
    <div
      ref={canvasWrapRef}
      className="relative w-full h-[180px] sm:h-[280px] rounded-lg bg-slate-50 overflow-hidden touch-none"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full touch-none"
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
      />

      {signatureDrawingEmpty && (
        <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-slate-500 pointer-events-none">
          Buraya {getActiveSignatureLabel()} imzasını çiziniz.
        </div>
      )}
    </div>

    <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
      <button
        type="button"
        onClick={clearCanvas}
        className="inline-flex h-8 min-w-[78px] items-center justify-center rounded-md bg-red-600 px-3 text-xs font-medium text-white transition shadow-sm hover:bg-red-700"
      >
        Temizle
      </button>
    </div>
  </div>

  <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-slate-200">

<button
  type="button"
  onClick={saveSignatureDrawing}
  className="inline-flex h-8 min-w-[78px] items-center justify-center rounded-md bg-green-600 px-3 text-xs font-medium text-white transition shadow-sm hover:bg-green-700"
>
  {willFinishAllSignaturesAfterCurrent() ? "Kaydet" : "Devam Et"}
</button>

  </div>
</div>

</Modal>

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
    </>
  );
}
