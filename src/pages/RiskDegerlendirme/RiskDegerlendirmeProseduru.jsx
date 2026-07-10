import {
  SectionTitle,
  CardBox,
  PrimaryButton,
  Modal,
} from "../../components/ui";

import ConfirmModal from "../../components/ui/ConfirmModal";
import React, {
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { FirmaContext } from "../../context/FirmaContext";
import axios from "axios";
import naceTr from "@/data/naceTR.json";

/* ------------ yardımcılar ------------ */
const toTR = (v) => {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d)) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}.${mm}.${yy}`;
};

const sanitizeName = (s) =>
  (s || "Firma")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9ÇĞİÖŞÜçğıöşü \-_.]/g, "")
    .trim() || "Firma";

function getAuthToken(userObj) {
  try {
    const direct =
      (typeof window !== "undefined" && localStorage.getItem("token")) ||
      (typeof window !== "undefined" && localStorage.getItem("jwt")) ||
      (typeof window !== "undefined" && localStorage.getItem("accessToken")) ||
      (typeof window !== "undefined" && localStorage.getItem("authToken")) ||
      (typeof window !== "undefined" &&
        localStorage.getItem("access_token")) ||
      (typeof window !== "undefined" &&
        localStorage.getItem("id_token")) ||
      (typeof window !== "undefined" && sessionStorage.getItem("token")) ||
      (typeof window !== "undefined" && sessionStorage.getItem("jwt")) ||
      (typeof window !== "undefined" &&
        sessionStorage.getItem("accessToken")) ||
      (typeof window !== "undefined" &&
        sessionStorage.getItem("authToken")) ||
      (typeof window !== "undefined" &&
        sessionStorage.getItem("access_token")) ||
      (typeof window !== "undefined" &&
        sessionStorage.getItem("id_token"));

    if (direct) return direct;

    const email =
      userObj?.email ||
      userObj?.mail ||
      (typeof window !== "undefined"
        ? localStorage.getItem("userEmail")
        : null);

    if (email) {
      const key = `isgpanel:${email}:token`;
      const t = localStorage.getItem(key);
      if (t) return t;
    }

    if (typeof window !== "undefined") {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (
          k.endsWith(":token") ||
          k.endsWith(":jwt") ||
          k.endsWith(":accessToken") ||
          k.endsWith(":authToken")
        ) {
          const t = localStorage.getItem(k);
          if (t) return t;
        }
      }
    }

    if (typeof window !== "undefined") {
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (!k) continue;
        if (
          k.endsWith(":token") ||
          k.endsWith(":jwt") ||
          k.endsWith(":accessToken") ||
          k.endsWith(":authToken")
        ) {
          const t = sessionStorage.getItem(k);
          if (t) return t;
        }
      }
    }
  } catch {}
  return null;
}

const toUpperTR = (v) => (v || "").toLocaleUpperCase("tr-TR");

const deepGet = (obj, path) => {
  try {
    return path.split(".").reduce((acc, k) => (acc ? acc[k] : undefined), obj);
  } catch {
    return undefined;
  }
};

const findFirstStringByKeyHint = (obj, hint) => {
  const h = String(hint || "").toLowerCase();
  const seen = new Set();

  const walk = (o) => {
    if (!o || typeof o !== "object") return "";
    if (seen.has(o)) return "";
    seen.add(o);

    for (const [k, v] of Object.entries(o)) {
      const key = String(k).toLowerCase();

      if (typeof v === "string" && key.includes(h) && v.trim()) return v.trim();
      if (typeof v === "number" && key.includes(h)) return String(v);

      if (v && typeof v === "object") {
        const r = walk(v);
        if (r) return r;
      }
    }
    return "";
  };

  return walk(obj);
};

const resolveFirmNaceRaw = (firm) => {
  if (!firm) return "";

  const candidates = [
    "nace",
    "naceKodu",
    "naceKod",
    "naceCode",
    "naceKoduTr",
    "naceAciklama",
    "firma.nace",
    "firma.naceKodu",
    "firma.naceKod",
    "firmaBilgileri.nace",
    "firmaBilgileri.naceKodu",
    "isyeri.nace",
    "isyeri.naceKodu",
  ];

  for (const p of candidates) {
    const v = deepGet(firm, p);
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }

  return findFirstStringByKeyHint(firm, "nace");
};

const resolveFirmFaaliyet = (firm) => {
  if (!firm) return "";

  const candidates = [
    "faaliyet",
    "faaliyetAlani",
    "faaliyetAdi",
    "faaliyetKonusu",
    "anaFaaliyet",
    "isKolu",
    "isKoluAdi",
    "activity",
    "firma.faaliyet",
    "firma.faaliyetAlani",
    "firma.faaliyetAdi",
    "firmaBilgileri.faaliyet",
    "firmaBilgileri.faaliyetAlani",
    "firmaBilgileri.faaliyetAdi",
    "isyeri.faaliyet",
    "isyeri.faaliyetAlani",
    "isyeri.faaliyetAdi",
  ];

  for (const p of candidates) {
    const v = deepGet(firm, p);
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }

  return findFirstStringByKeyHint(firm, "faaliyet");
};

const normalizeNaceCode = (v) => {
  if (v == null) return "";
  let s = String(v).trim();
  if (!s) return "";
  if (s.includes("-")) s = s.split("-")[0].trim();
  s = s.replace(/\s+/g, "");
  return s;
};

const buildNaceIndex = (data) => {
  const byCode = new Map();
  const byNoDot = new Map();

  const put = (codeRaw, row) => {
    const code = normalizeNaceCode(codeRaw);
    if (!code) return;
    byCode.set(code, row);
    const nd = code.replace(/\./g, "");
    if (nd) byNoDot.set(nd, row);
  };

  if (Array.isArray(data)) {
    for (const row of data) {
      put(
        row?.kod || row?.code || row?.nace || row?.naceKodu || row?.naceKod,
        row
      );
    }
  } else if (data && typeof data === "object") {
    for (const [code, row] of Object.entries(data)) {
      put(code, row);
      put(
        row?.kod || row?.code || row?.nace || row?.naceKodu || row?.naceKod,
        row
      );
    }
  }

  return { byCode, byNoDot };
};

const ROLE_DEFS = [
  { key: "isveren", label: "İşveren / Vekili" },
  { key: "uzman", label: "İş Güvenliği Uzmanı" },
  { key: "hekim", label: "İşyeri Hekimi" },
  { key: "temsilci", label: "Çalışan Temsilcisi" },
  { key: "destek", label: "Destek Elemanı" },
  { key: "bilgi", label: "Bilgi Sahibi Kişi" },
];

const createEmptySignatureState = () => ({
  isveren: { imza: null, paraf: null },
  uzman: { imza: null, paraf: null },
  hekim: { imza: null, paraf: null },
  temsilci: { imza: null, paraf: null },
  destek: { imza: null, paraf: null },
  bilgi: { imza: null, paraf: null },
});

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
  signerRole,
  signatureType,
  signedAt,
}) => {
  try {
    const raw = [
      signerRole || "",
      signatureType || "",
      toUpperTR(signerName || ""),
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

const buildSignatureRecord = async (
  dataUrl,
  signerName,
  signerRole,
  signatureType
) => {
  const signedAt = new Date().toISOString();

  const signatureHash = await createSignatureHash({
    dataUrl,
    signerName,
    signerRole,
    signatureType,
    signedAt,
  });

  return {
    dataUrl: dataUrl || "",
    signerName: toUpperTR(signerName || ""),
    signerRole: signerRole || "",
    signatureType: signatureType || "",
    signedAt,
    createdAt: signedAt,
    updatedAt: signedAt,
    signatureHash,
    deviceType: getDeviceType(),
    isPassive: false,
  };
};

const getSignatureStatus = (record, currentName) => {
  const normalizedCurrent = toUpperTR(currentName || "").trim();
  if (!record?.dataUrl) return "Eksik";
  if (!normalizedCurrent) return "Eksik";
  if (toUpperTR(record?.signerName || "").trim() !== normalizedCurrent) {
    return "Güncelle Gerekli";
  }
  return "Kayıtlı";
};



const statusBadgeClass = (status) => {
  if (status === "Kayıtlı") {
    return "bg-green-50 text-green-700 border border-green-200";
  }
  if (status === "Güncelle Gerekli") {
    return "bg-amber-50 text-amber-700 border border-amber-200";
  }
  return "bg-red-50 text-red-700 border border-red-200";
};

const splitNameAndCert = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return { name: "", certNo: "" };

  const parts = raw.split("/").map((s) => s.trim()).filter(Boolean);

  if (parts.length === 0) return { name: "", certNo: "" };
  if (parts.length === 1) return { name: parts[0], certNo: "" };

  return {
    name: parts[0] || "",
    certNo: parts.slice(1).join(" / ") || "",
  };
};

const buildExpertDisplay = (fullName, certNo) => {
  const n = toUpperTR(fullName || "").trim();
  const c = toUpperTR(certNo || "").trim();
  if (!n) return "";
  if (!c) return n;
  return `${n} / ${c}`;
};


const isValidHekimDisplay = (value) => {
  const { name, certNo } = splitNameAndCert(value);
  if (!name) return false;
  if (!certNo) return false;
  return /^İH-\S+$/i.test(certNo.trim());
};

const normalizeHekimDisplay = (value) => {
  const raw = toUpperTR(value || "").trim();
  if (!raw) return "";

  const { name, certNo } = splitNameAndCert(raw);

  // Sadece isim yazıldıysa
  if (name && !certNo) {
    return `${name} / İH-`;
  }

  // Sertifika tarafı yazılmış ama İH- yoksa ekle
  if (name && certNo && !certNo.startsWith("İH-")) {
    return `${name} / İH-${certNo.replace(/^İH-/i, "").trim()}`;
  }

  return `${name}${certNo ? ` / ${certNo}` : ""}`.trim();
};

const moveCaretToEnd = (el) => {
  try {
    const len = el.value?.length || 0;
    requestAnimationFrame(() => {
      el.setSelectionRange(len, len);
    });
  } catch {}
};

export default function RiskDegerlendirmeProseduru() {
  const { selectedFirm } = useContext(FirmaContext);

  const API_BASE =
    (import.meta.env.VITE_API_URL || "").trim().replace(/\/$/, "") ||
    "https://api.isgpanel.tr/api";

  const DOCS_SYNC_KEY = "docs:lastChangeAt";
const KISILER_SYNC_KEY = "risk:kisiler:lastChangeAt";
const IMZALAR_SYNC_KEY = "risk:imzalar:lastChangeAt";

  const [personal, setPersonal] = useState({
  sertifikaNo: "",
  sertifikaSinifi: "",
});

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

  const [kurumsal, setKurumsal] = useState(null);

  useEffect(() => {
    const loadKurumsal = () => {
      try {
        const raw = localStorage.getItem("kurumsalBilgiler");
        if (raw) setKurumsal(JSON.parse(raw));
      } catch {}
    };

    loadKurumsal();
    window.addEventListener("storage", loadKurumsal);
    window.addEventListener("kurumsalBilgilerUpdated", loadKurumsal);

    return () => {
      window.removeEventListener("storage", loadKurumsal);
      window.removeEventListener("kurumsalBilgilerUpdated", loadKurumsal);
    };
  }, []);

  const [firmDetail, setFirmDetail] = useState(null);
  const firmId = selectedFirm?._id || selectedFirm?.id || null;

  const firmHasNaceOrFaaliyet = (f) => {
    const nace = resolveFirmNaceRaw(f);
    const faaliyet = resolveFirmFaaliyet(f);
    return Boolean(
      (nace && String(nace).trim()) || (faaliyet && String(faaliyet).trim())
    );
  };

  useEffect(() => {
    const run = async () => {
      setFirmDetail(null);
      if (!firmId) return;
      if (firmHasNaceOrFaaliyet(selectedFirm)) return;

      const token = getAuthToken(user);
      if (!token) return;

      try {
        const res = await axios.get(`${API_BASE}/firma/${firmId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setFirmDetail(res.data || null);
      } catch (e) {
        console.error("Firma detayı çekilemedi:", e);
      }
    };

    run();
  }, [firmId, selectedFirm, API_BASE, user]);

useEffect(() => {
  const loadPersonalFromServer = async () => {
    const token = getAuthToken(user);
    if (!token) return;

    try {
      const res = await axios.get(`${API_BASE}/profile/personal`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const p = res.data || {};

      setPersonal({
        sertifikaNo: p.sertifikaNo || "",
        sertifikaSinifi: p.sertifikaSinifi || "",
      });
    } catch (e) {
      console.error("Kişisel bilgiler server'dan alınamadı:", e);
      setPersonal({
        sertifikaNo: "",
        sertifikaSinifi: "",
      });
    }
  };

  loadPersonalFromServer();
}, [API_BASE, user]);

  const firmObj = firmDetail || selectedFirm;
  

  const [kisiler, setKisiler] = useState({
  isveren: "",
  uzman: "",
  hekim: "",
  temsilci: "",
  destek: "",
  bilgi: "",
});

  const [signatureState, setSignatureState] = useState(createEmptySignatureState());
  const [signaturesLoading, setSignaturesLoading] = useState(false);
  const [signatureModalOpen, setSignatureModalOpen] = useState(false);
  const [activeSignatureRole, setActiveSignatureRole] = useState("");
  const [activeSignatureType, setActiveSignatureType] = useState("imza");
  const [signatureConsent, setSignatureConsent] = useState(false);
  const [signatureDrawingEmpty, setSignatureDrawingEmpty] = useState(true);

  const canvasRef = useRef(null);
  const canvasWrapRef = useRef(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef({ x: 0, y: 0 });

  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
const [pdfProgress, setPdfProgress] = useState(0);
const [show, setShow] = useState(false);
const [pdfUrl, setPdfUrl] = useState(null);
  const [downloadName, setDownloadName] = useState(
    "Firma (Prosedür-01.01.2026).pdf"
  );
  const [saving, setSaving] = useState(false);
  const saveLockRef = useRef(false);

  useEffect(() => {
    return () => {
      if (pdfUrl && String(pdfUrl).startsWith("blob:")) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmData, setConfirmData] = useState({
    title: "",
    message: "",
    variant: "info",
    confirmText: "Tamam",
    cancelText: "İptal",
    onConfirm: null,
    onCancel: null,
  });

  const openInfo = (title, message) => {
    setConfirmData({
      title,
      message,
      variant: "info",
      confirmText: "Tamam",
      cancelText: "",
      onConfirm: () => setConfirmOpen(false),
      onCancel: () => setConfirmOpen(false),
    });
    setConfirmOpen(true);
  };

  useEffect(() => {
    if (!confirmOpen) return;
    if (saveLockRef.current) return;

    const onStorage = (e) => {
      if (e.key === DOCS_SYNC_KEY) {
        setConfirmOpen(false);
        closePreview();
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [confirmOpen]);

  const loadKisilerFromServer = useCallback(async () => {
    if (!firmId) return false;

    const token = getAuthToken(user);
    if (!token) {
      console.warn("Kişi bilgileri server'dan alınamadı: token yok");
      return false;
    }

    try {
      const res = await axios.get(`${API_BASE}/firma/${firmId}/kisiler`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const p = res.data || {};

      setKisiler((prev) => ({
        ...prev,
        isveren: toUpperTR(
          p.isveren || p.isverenVekiliAdSoyad || p.isverenVekili || ""
        ),
        uzman: toUpperTR(
          p.uzman || p.isgUzmaniAdSoyad || p.isgUzmani || prev.uzman || ""
        ),
        hekim: toUpperTR(
          p.hekim || p.isyeriHekimiAdSoyad || p.isyeriHekimi || ""
        ),
        temsilci: toUpperTR(
          p.temsilci ||
            p.calisanTemsilcisiAdSoyad ||
            p.calisanTemsilcisi ||
            ""
        ),
        destek: toUpperTR(
          p.destek || p.destekElemaniAdSoyad || p.destekElemani || ""
        ),
        bilgi: toUpperTR(
          p.bilgi || p.bilgiSahibiKisiAdSoyad || p.bilgiSahibiKisi || ""
        ),
      }));

      return true;
    } catch (e) {
      console.error("Kişi bilgileri server'dan alınamadı:", e);
      return false;
    }
  }, [API_BASE, firmId, user]);

const loadSignaturesFromServer = useCallback(async () => {
  if (!firmId) return false;

  const token = getAuthToken(user);
  if (!token) {
    console.warn("İmza kayıtları server'dan alınamadı: token yok");
    return false;
  }

  try {
    setSignaturesLoading(true);

    const res = await axios.get(`${API_BASE}/firma/${firmId}/imzalar`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const incoming = res.data || {};
    setSignatureState({
      ...createEmptySignatureState(),
      ...incoming,
    });

    return true;
  } catch (e) {
    console.error("İmza / paraf kayıtları alınamadı:", e);
    setSignatureState(createEmptySignatureState());
    return false;
  } finally {
    setSignaturesLoading(false);
  }
}, [API_BASE, firmId, user]);

  const broadcastKisiSync = useCallback(() => {
    const stamp = String(Date.now());

    try {
      localStorage.setItem(KISILER_SYNC_KEY, stamp);
    } catch {}

    try {
      window.dispatchEvent(
        new CustomEvent("risk_kisiler_updated", {
          detail: { firmaId: String(firmId), at: stamp },
        })
      );
    } catch {}
  }, [KISILER_SYNC_KEY, firmId]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!firmId) {
        if (mounted) setLoaded(true);
        return;
      }

      await loadKisilerFromServer();

if (mounted) setLoaded(true);
    };

    load();

    return () => {
      mounted = false;
    };
  }, [firmId, loadKisilerFromServer]);

const broadcastImzaSync = useCallback(() => {
  const stamp = String(Date.now());

  try {
    localStorage.setItem(IMZALAR_SYNC_KEY, stamp);
  } catch {}

  try {
    window.dispatchEvent(
      new CustomEvent("risk_imzalar_updated", {
        detail: { firmaId: String(firmId), at: stamp },
      })
    );
  } catch {}
}, [IMZALAR_SYNC_KEY, firmId]);

  useEffect(() => {
  if (!firmId) return;
  loadSignaturesFromServer();
}, [firmId, loadSignaturesFromServer]);

 useEffect(() => {
  if (!firmId) return;

  const refreshFromServer = () => {
    loadKisilerFromServer();
    loadSignaturesFromServer();
  };

  const handleVisibility = () => {
    if (document.visibilityState === "visible") {
      refreshFromServer();
    }
  };

  const handleStorage = (e) => {
    if (
      e.key === KISILER_SYNC_KEY ||
      e.key === IMZALAR_SYNC_KEY ||
      e.key === DOCS_SYNC_KEY
    ) {
      refreshFromServer();
    }
  };

  const handleRiskKisilerUpdate = (e) => {
    const eventFirmaId = String(e?.detail?.firmaId || "");
    const currentFirmaId = String(firmId || "");
    if (!eventFirmaId || eventFirmaId !== currentFirmaId) return;

    refreshFromServer();
  };

  const handleRiskImzalarUpdate = (e) => {
    const eventFirmaId = String(e?.detail?.firmaId || "");
    const currentFirmaId = String(firmId || "");
    if (!eventFirmaId || eventFirmaId !== currentFirmaId) return;

    refreshFromServer();
  };

  window.addEventListener("focus", refreshFromServer);
  window.addEventListener("pageshow", refreshFromServer);
  window.addEventListener("storage", handleStorage);
  window.addEventListener("risk_kisiler_updated", handleRiskKisilerUpdate);
  window.addEventListener("risk_imzalar_updated", handleRiskImzalarUpdate);
  document.addEventListener("visibilitychange", handleVisibility);

  return () => {
    window.removeEventListener("focus", refreshFromServer);
    window.removeEventListener("pageshow", refreshFromServer);
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener("risk_kisiler_updated", handleRiskKisilerUpdate);
    window.removeEventListener("risk_imzalar_updated", handleRiskImzalarUpdate);
    document.removeEventListener("visibilitychange", handleVisibility);
  };
}, [
  DOCS_SYNC_KEY,
  KISILER_SYNC_KEY,
  IMZALAR_SYNC_KEY,
  firmId,
  loadKisilerFromServer,
  loadSignaturesFromServer,
]);

  const naceIndex = useMemo(() => buildNaceIndex(naceTr), []);

  const formatNaceFromNaceTr = (raw) => {
    const rawTrim = (raw || "").trim();
    if (!rawTrim) return "";
    if (rawTrim.includes(" - ")) return rawTrim;

    const code = normalizeNaceCode(rawTrim);
    if (!code) return rawTrim;

    const row1 = naceIndex.byCode.get(code);
    if (row1) {
      const name = row1?.tanim || row1?.ad || row1?.aciklama || row1?.isim || "";
      return name ? `${code} - ${name}` : code;
    }

    const nd = code.replace(/\./g, "");
    const row2 = naceIndex.byNoDot.get(nd);
    if (row2) {
      const name = row2?.tanim || row2?.ad || row2?.aciklama || row2?.isim || "";
      return name ? `${code} - ${name}` : code;
    }

    return rawTrim;
  };

  const firmNaceRaw = resolveFirmNaceRaw(firmObj) || "";
const firmNace = formatNaceFromNaceTr(firmNaceRaw);
const firmFaaliyet = resolveFirmFaaliyet(firmObj) || "";

const uzmanSertifikaNo = toUpperTR(personal?.sertifikaNo || "").trim();
const uzmanSertifikaSinifi = toUpperTR(personal?.sertifikaSinifi || "").trim();

const uzmanDisplayValue = buildExpertDisplay(kisiler?.uzman || "", uzmanSertifikaNo);

  const toAbsoluteUrl = (url) => {
    if (!url) return "";

    if (typeof url === "object") {
      url = url?.url || url?.path || "";
    }

    if (!url) return "";
    if (url.startsWith("data:image")) return url;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;

    if (url.startsWith("/uploads")) {
  return `https://api.isgpanel.tr${url}`;
}

    return `${API_BASE}${url.startsWith("/") ? "" : "/"}${url}`;
  };

  const closePreview = () => {
    if (pdfUrl && String(pdfUrl).startsWith("blob:")) {
      URL.revokeObjectURL(pdfUrl);
    }
    setPdfUrl(null);
    setShow(false);
  };


const validateProcedureInputs = () => {
  if (!uzmanSertifikaNo || uzmanSertifikaNo === "İGU-") {
    openInfo(
      "Bilgilendirme",
      "Lütfen Kişisel Bilgiler sayfasında sertifika numaranızı giriniz."
    );
    return false;
  }

  const hekimRaw = toUpperTR(kisiler?.hekim || "").trim();
  if (hekimRaw && !isValidHekimDisplay(hekimRaw)) {
    openInfo(
      "Bilgilendirme",
      'İşyeri hekimi bilgisi eksik veya hatalı. Lütfen "Ad Soyad / İH-12345" formatında giriniz.'
    );
    return false;
  }

  return true;
};

  const buildFinalLogo = async () => {
    try {
      if (
        typeof kurumsal?.logo === "string" &&
        kurumsal.logo.startsWith("data:image")
      ) {
        return kurumsal.logo;
      }

     const rawLogoUrl =
  kurumsal?.logoUrl || selectedFirm?.logoUrl || selectedFirm?.logo || "";

      if (!rawLogoUrl) return "";

      const absoluteLogoUrl = toAbsoluteUrl(rawLogoUrl);

      const tokenValue = getAuthToken(user) || "";

      const res = await fetch(absoluteLogoUrl, {
        headers: tokenValue ? { Authorization: `Bearer ${tokenValue}` } : {},
      });

      if (!res.ok) return "";

      const blob = await res.blob();

      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result || ""));
        reader.readAsDataURL(blob);
      });
    } catch {
      return "";
    }
  };

  const getCurrentRoleName = useCallback(
  (roleKey) => {
    const raw = toUpperTR(kisiler?.[roleKey] || "");
    const { name } = splitNameAndCert(raw);
    return name || raw;
  },
  [kisiler]
);

const handleHekimFocus = (e) => {
  const current = toUpperTR(e.target.value || "").trim();
  if (!current) return;

  const normalized = normalizeHekimDisplay(current);

  setKisiler((s) => ({ ...s, hekim: normalized }));

  if (normalized.endsWith("/ İH-")) {
    requestAnimationFrame(() => moveCaretToEnd(e.target));
  }
};

const handleHekimBlur = (e) => {
  const current = toUpperTR(e.target.value || "").trim();
  if (!current) return;

  const normalized = normalizeHekimDisplay(current);
  setKisiler((s) => ({ ...s, hekim: normalized }));
};

  const currentRoleLabel = useMemo(() => {
    const found = ROLE_DEFS.find((r) => r.key === activeSignatureRole);
    return found?.label || "";
  }, [activeSignatureRole]);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = canvasWrapRef.current;
    if (!canvas || !wrap) return;

    const rect = wrap.getBoundingClientRect();
    const ratio = Math.max(window.devicePixelRatio || 1, 1);

    const existingData = canvas.toDataURL("image/png");

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

    if (!signatureDrawingEmpty && existingData && existingData !== "data:,") {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
      };
      img.src = existingData;
    }
  }, [signatureDrawingEmpty]);

  useEffect(() => {
    if (!signatureModalOpen) return;
    const t = setTimeout(() => resizeCanvas(), 50);
    window.addEventListener("resize", resizeCanvas);
    return () => {
      clearTimeout(t);
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

  const openSignatureModal = (roleKey, type) => {
    const currentName = getCurrentRoleName(roleKey);

    if (!currentName) {
      openInfo(
        "Bilgilendirme",
        "Önce ilgili kişi adını giriniz, ardından imza / paraf alınız."
      );
      return;
    }

    setActiveSignatureRole(roleKey);
    setActiveSignatureType(type);
    setSignatureConsent(false);
    setSignatureDrawingEmpty(true);
    setSignatureModalOpen(true);

    setTimeout(() => {
      resizeCanvas();
      clearCanvas();
    }, 80);
  };

  const closeSignatureModal = () => {
    setSignatureModalOpen(false);
    setActiveSignatureRole("");
    setActiveSignatureType("imza");
    setSignatureConsent(false);
    setSignatureDrawingEmpty(true);
  };

  const saveSignatureDrawing = async () => {
  if (!activeSignatureRole || !activeSignatureType) return;

  const currentName = getCurrentRoleName(activeSignatureRole);

  if (!currentName) {
    openInfo("Bilgilendirme", "İlgili kişi adı boş olamaz.");
    return;
  }

  if (!signatureConsent) {
    openInfo("Bilgilendirme", "Devam etmek için onay kutusunu işaretleyiniz.");
    return;
  }

  if (signatureDrawingEmpty) {
    openInfo("Bilgilendirme", "Lütfen önce imza / paraf çiziniz.");
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
    openInfo("Bilgilendirme", "Lütfen önce imza / paraf çiziniz.");
    return;
  }

  const pad = activeSignatureType === "imza" ? 12 : 8;

  minX = Math.max(minX - pad, 0);
  minY = Math.max(minY - pad, 0);
  maxX = Math.min(maxX + pad, width);
  maxY = Math.min(maxY + pad, height);

  const cropW = Math.max(maxX - minX, 1);
const cropH = Math.max(maxY - minY, 1);

const OUTPUT_SCALE = 4;

const outW = 170 * OUTPUT_SCALE;
const outH = 72 * OUTPUT_SCALE;

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

outCtx.drawImage(
  canvas,
  minX,
  minY,
  cropW,
  cropH,
  dx,
  dy,
  drawW,
  drawH
);

  const dataUrl = outCanvas.toDataURL("image/png");

  const signatureRecord = await buildSignatureRecord(
  dataUrl,
  currentName,
  activeSignatureRole,
  activeSignatureType
);

setSignatureState((prev) => ({
  ...prev,
  [activeSignatureRole]: {
    ...(prev?.[activeSignatureRole] || { imza: null, paraf: null }),
    [activeSignatureType]: signatureRecord,
  },
}));

  closeSignatureModal();
  openInfo(
    "Bilgilendirme",
    `${currentRoleLabel} için ${
      activeSignatureType === "imza" ? "imza" : "paraf"
    } kaydedildi. Kalıcı olması için sayfadaki ana Kaydet butonuna basınız.`
  );
};


const handlePrepare = async () => {
  if (!firmObj) {
    openInfo("Bilgilendirme", "Lütfen önce bir firma seçiniz.");
    return;
  }

  if (!validateProcedureInputs()) {
    return;
  }

 try {
  setLoading(true);
  setPdfProgress(5);
  setShow(true);
  setPdfUrl(null);

  const progressTimer = setInterval(() => {
    setPdfProgress((prev) => {
      if (prev >= 92) return prev;
      return prev + Math.floor(Math.random() * 6) + 2;
    });
  }, 700);

  const token = getAuthToken(user);

    const finalLogo = await buildFinalLogo();

    const payload = {
      kurumsal: {
        logo: finalLogo || "",
        logoUrl: "",
      },
      firma: {
        firmaAdi: firmObj?.firmaAdi || "",
        sgkSicilNo: firmObj?.sgkSicilNo || "",
        adres: firmObj?.adres || "",
        nace: firmNace,
        faaliyet: firmFaaliyet,
        tehlikeSinifi: firmObj?.tehlike || firmObj?.tehlikeSinifi || "",
      },
      tarihler: {
        hazirlamaTr: toTR(firmObj?.hazirlama),
        gecerlilikTr: toTR(firmObj?.gecerlilik),
      },
      kisiler: {
        isveren: kisiler?.isveren || "",
        uzman: kisiler?.uzman || "",
        hekim: kisiler?.hekim || "",
        temsilci: kisiler?.temsilci || "",
        destek: kisiler?.destek || "",
        bilgiSahibi: kisiler?.bilgi || "",
      },
      imzalar: Object.fromEntries(
  Object.entries(signatureState || {}).map(([roleKey, roleValue]) => {
    const currentName = getCurrentRoleName(roleKey);

    const cleanItem = (item) => {
      const status = getSignatureStatus(item, currentName);

      // Eksik veya güncelle gerekli ise eski imzayı gönderme
      if (status !== "Kayıtlı") {
        return null;
      }

      return item;
    };

    return [
      roleKey,
      {
        imza: cleanItem(roleValue?.imza),
        paraf: cleanItem(roleValue?.paraf),
      },
    ];
  })
),

kisisel: {
  sertifikaNo: personal?.sertifikaNo || "",
  sertifikaSinifi: personal?.sertifikaSinifi || "",
},
    };

    const res = await fetch(`${API_BASE}/prosedur/pdf`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
  clearInterval(progressTimer);
  setLoading(false);
      openInfo(
        "Hata",
        data?.message || "PDF oluşturulamadı"
      );
      return;
    }

   if (!data?.jobId) {
  clearInterval(progressTimer);
  setLoading(false);
      openInfo("Hata", "Job başlatılamadı");
      return;
    }

    if (pdfUrl && String(pdfUrl).startsWith("blob:")) {
      URL.revokeObjectURL(pdfUrl);
    }

    setPdfUrl(null);
    setShow(true);

    const jobId = data.jobId;

    const interval = setInterval(async () => {
      try {
        const r = await fetch(`${API_BASE}/prosedur/pdf-job/${jobId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        const j = await r.json();

       if (j.status === "done") {
  clearInterval(interval);
  clearInterval(progressTimer);

  setPdfProgress(100);
  setPdfUrl(j.resultFileUrl);

          const belgeTarihTr =
            toTR(firmObj?.hazirlama) || toTR(new Date());

          setDownloadName(
            `${sanitizeName(firmObj?.firmaAdi)} (Prosedür-${belgeTarihTr}).pdf`
          );

          setTimeout(() => {
  setLoading(false);
}, 400);
        }

      if (j.status === "error") {
  clearInterval(interval);
  clearInterval(progressTimer);
  setLoading(false);
          openInfo("Hata", j.error || "PDF oluşturulamadı");
        }
    } catch (err) {
  clearInterval(interval);
  clearInterval(progressTimer);
  setLoading(false);
        openInfo("Hata", "Job kontrol hatası");
      }
    }, 2000);
 } catch (e) {
  setLoading(false);
  setPdfProgress(0);
    openInfo("Hata", "Hata: " + (e?.message || e));
  }
};

  const saveSignaturesToServer = async () => {
  const token = getAuthToken(user);

  if (!token) {
    openInfo("Hata", "İmza / paraf kaydı için oturum bulunamadı.");
    return false;
  }

  try {
    await axios.put(
      `${API_BASE}/firma/${firmId}/imzalar`,
      { imzalar: signatureState },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    broadcastImzaSync();
    return true;
  } catch (e) {
    console.error("İmza / paraf server kaydı başarısız:", e);
    openInfo("Hata", "İmza / paraf kayıtları server'a kaydedilemedi.");
    return false;
  }
};

  
const handleKisilerKaydet = async () => {
  const token = getAuthToken(user);

  if (!token) {
    openInfo(
      "Hata",
      "Oturum bulunamadı. Kayıt server'a yapılamadı. Lütfen bu cihazda yeniden giriş yapın."
    );
    return;
  }

  if (!validateProcedureInputs()) {
    return;
  }

  try {

      const payload = {
        isverenVekiliAdSoyad: kisiler.isveren || "",
        isgUzmaniAdSoyad: kisiler.uzman || "",
        isyeriHekimiAdSoyad: kisiler.hekim || "",
        calisanTemsilcisiAdSoyad: kisiler.temsilci || "",
        destekElemaniAdSoyad: kisiler.destek || "",
        bilgiSahibiKisiAdSoyad: kisiler.bilgi || "",

        isveren: kisiler.isveren || "",
        uzman: kisiler.uzman || "",
        hekim: kisiler.hekim || "",
        temsilci: kisiler.temsilci || "",
        destek: kisiler.destek || "",
        bilgi: kisiler.bilgi || "",
      };

      await axios.put(`${API_BASE}/firma/${firmId}/kisiler`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const signaturesOk = await saveSignaturesToServer();
      if (!signaturesOk) return;

     
      await loadKisilerFromServer();
      broadcastKisiSync();

      openInfo(
        "Bilgilendirme",
        "Kişi bilgileri ve imzalar kaydedildi ✅"
      );
    } catch (e) {
      console.error("Mongo kayıt hatası:", e);
      openInfo(
        "Hata",
        "Server kaydı başarısız. Token / yetki / endpoint kontrol edin. ❌"
      );
    }
  };

 

const saveToDocs = async () => {
  if (!pdfUrl) {
    openInfo("Bilgilendirme", "Önce 'Hazırla (PDF)' ile belgeyi oluştur.");
    return;
  }

  if (!firmId) {
    openInfo("Bilgilendirme", "Geçerli bir firma seçili değil.");
    return;
  }

  if (!validateProcedureInputs()) {
    return;
  }

  if (saving || saveLockRef.current) return;


    const year =
      firmObj?.hazirlama && !isNaN(new Date(firmObj.hazirlama))
        ? new Date(firmObj.hazirlama).getFullYear()
        : new Date().getFullYear();

   const createdBy =
  (user?.name && `${user.name}`) ||
  (user?.adSoyad && `${user.adSoyad}`) ||
  (user?.fullName && `${user.fullName}`) ||
  (user?.ad && `${user.ad}`) ||
  kisiler?.uzman ||
  "İSG Uzmanı";

    const belgeTarihTr =
      toTR(firmObj?.hazirlama) || new Date().toLocaleDateString("tr-TR");
    const token = getAuthToken(user);

    const doSave = async () => {
      try {
        if (saveLockRef.current) return;
        saveLockRef.current = true;
        setSaving(true);

        if (!token) {
          openInfo("Hata", "Oturum bulunamadı.");
          return;
        }

        const finalLogo = await buildFinalLogo();

        const pdfPersistPayload = {
          firma: {
            firmaAdi: firmObj?.firmaAdi || "",
            sgkSicilNo: firmObj?.sgkSicilNo || "",
            adres: firmObj?.adres || "",
            nace: firmNace,
            faaliyet: firmFaaliyet,
            tehlikeSinifi: firmObj?.tehlike || firmObj?.tehlikeSinifi || "",
          },
          tarihler: {
            hazirlamaTr: toTR(firmObj?.hazirlama),
            gecerlilikTr: toTR(firmObj?.gecerlilik),
          },
          kisiler: {
            isveren: kisiler?.isveren || "",
            uzman: kisiler?.uzman || "",
            hekim: kisiler?.hekim || "",
            temsilci: kisiler?.temsilci || "",
            destek: kisiler?.destek || "",
            bilgiSahibi: kisiler?.bilgi || "",
          },
          kurumsal: {
            logo: finalLogo || "",
            logoUrl: "",
          },
          imzalar: Object.fromEntries(
  Object.entries(signatureState || {}).map(([roleKey, roleValue]) => {
    const currentName = getCurrentRoleName(roleKey);

    const cleanItem = (item) => {
      const status = getSignatureStatus(item, currentName);

      // Eksik veya güncelle gerekli ise eski imzayı gönderme
      if (status !== "Kayıtlı") {
        return null;
      }

      return item;
    };

    return [
      roleKey,
      {
        imza: cleanItem(roleValue?.imza),
        paraf: cleanItem(roleValue?.paraf),
      },
    ];
  })
),
          persist: true,
        };

      const pdfPersistRes = await fetch(`${API_BASE}/prosedur/pdf`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  },
  body: JSON.stringify(pdfPersistPayload),
});

if (!pdfPersistRes.ok) {
  const text = await pdfPersistRes.text();
  openInfo(
    "Hata",
    `Kalıcı PDF oluşturulamadı.\n\nHata Kodu: ${pdfPersistRes.status}\n${text.slice(
      0,
      400
    )}`
  );
  return;
}

const pdfPersistJson = await pdfPersistRes.json();
const persistJobId = String(pdfPersistJson?.jobId || "").trim();

if (!persistJobId) {
  openInfo("Hata", "Kalıcı PDF işi başlatılamadı.");
  return;
}

const waitForPersistedPdf = async () => {
  const maxTry = 60; // yaklaşık 120 sn
  let tryCount = 0;

  while (tryCount < maxTry) {
    tryCount += 1;

    const jobRes = await fetch(`${API_BASE}/prosedur/pdf-job/${persistJobId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    const jobJson = await jobRes.json();

    if (jobJson?.status === "done") {
      const persistedDocId =
        jobJson?.documentId ||
        jobJson?._id ||
        jobJson?.id ||
        "";

      const realFileUrl =
        jobJson?.resultFileUrl ||
        (persistedDocId
          ? `${API_BASE}/documents/${persistedDocId}/download`
          : "");

      if (!realFileUrl) {
        openInfo("Hata", "Kalıcı PDF URL alınamadı.");
        return null;
      }

      return {
        realFileUrl,
        persistedDocId,
        jobJson,
      };
    }

    if (jobJson?.status === "error") {
      openInfo("Hata", jobJson?.error || "Kalıcı PDF oluşturulamadı.");
      return null;
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  openInfo("Hata", "Kalıcı PDF oluşturma zaman aşımına uğradı.");
  return null;
};

const persistedResult = await waitForPersistedPdf();
if (!persistedResult) return;

const { realFileUrl } = persistedResult;

        const payload = {
          firmaId: String(selectedFirm?._id || firmId),
          firmaAdi: firmObj?.firmaAdi || "",
          category: "risk",
          subCategory: "prosedur",
          title: "Risk Değerlendirme Prosedürü",
          year,
          createdBy,
createdByName: createdBy,
hazirlayan: createdBy,
hazirlayanAdSoyad: createdBy,
olusturan: createdBy,
preparedBy: createdBy,
createdByUserId: user?._id || user?.id,
          fileUrl: realFileUrl,
          tarih: belgeTarihTr,
        };

        const res = await fetch(`${API_BASE}/documents`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const text = await res.text();
          console.error("Belgelerime kaydet hatası:", res.status, text);
          openInfo(
            "Hata",
            `Belge, Belgelerim listesine kaydedilemedi.\n\nHata Kodu: ${
              res.status
            }\n${text.slice(0, 400)}`
          );
          return;
        }

        await res.json().catch(() => null);

        const syncStamp = String(Date.now());
        try {
          localStorage.setItem(DOCS_SYNC_KEY, syncStamp);
        } catch {}

        openInfo("Bilgilendirme", "Belgelerim, Risk Değerlendirme sekmesine kaydedildi ✅");
        closePreview();
      } catch (e) {
        console.error("saveToDocs error:", e);
        openInfo("Hata", "Belge kaydedilirken hata oluştu.");
      } finally {
        setSaving(false);
        saveLockRef.current = false;
      }
    };

    await doSave();
  };

  const handleYeniSekmedeAc = () => {
    if (!pdfUrl) {
      openInfo("Bilgilendirme", "Önce 'Hazırla (PDF)' ile belgeyi oluştur.");
      return;
    }
    window.open(pdfUrl, "_blank", "noopener,noreferrer");
  };

  const handleIndir = () => {
    if (!pdfUrl) {
      openInfo("Bilgilendirme", "Önce 'Hazırla (PDF)' ile belgeyi oluştur.");
      return;
    }
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = downloadName || "Prosedur.pdf";
    a.click();
  };

  const readonlyInputClass =
    "w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-2.5 text-sm text-gray-800";

  const editableUpperInputClass =
    "w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm uppercase";

  const actionButtonClass =
    "inline-flex h-8 min-w-[78px] items-center justify-center rounded-md px-3 text-xs font-medium text-white transition shadow-sm";

  const greenActionButtonClass =
    `${actionButtonClass} bg-green-600 hover:bg-green-700`;

  const blueActionButtonClass =
    `${actionButtonClass} bg-blue-600 hover:bg-blue-700`;

  const redActionButtonClass =
    `${actionButtonClass} bg-red-600 hover:bg-red-700`;

  if (!selectedFirm) {
    return (
      <CardBox>
        <SectionTitle
          title="Risk Değerlendirme Prosedürü"
          subtitle="Devam etmek için lütfen sağ üstten bir firma seçiniz."
        />
      </CardBox>
    );
  }

  const logoPreviewSrc =
    typeof kurumsal?.logo === "string" && kurumsal.logo.startsWith("data:image")
      ? kurumsal.logo
      : "";

  return (
    <>
      <CardBox className="flex flex-col gap-4">
        <SectionTitle
          title="Risk Değerlendirme Prosedürü"
          subtitle="Firma ve kişi bilgileri bu sekmeden yönetilir; diğer risk sekmelerine otomatik olarak aktarılır."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <input readOnly value={firmObj?.firmaAdi || ""} className={readonlyInputClass} />
          <input readOnly value={firmObj?.adres || ""} className={readonlyInputClass} />
          <input readOnly value={firmObj?.sgkSicilNo || ""} className={readonlyInputClass} />
          <input readOnly value={firmNace} className={readonlyInputClass} />
          <input readOnly value={firmFaaliyet} className={readonlyInputClass} />
          <input
            readOnly
            value={firmObj?.tehlike || firmObj?.tehlikeSinifi || ""}
            className={readonlyInputClass}
          />
          <input readOnly value={toTR(firmObj?.hazirlama)} className={readonlyInputClass} />
          <input readOnly value={toTR(firmObj?.gecerlilik)} className={readonlyInputClass} />
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-[#0a2b45]">Kişi Bilgileri</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <input
              placeholder="İşveren / Vekili"
              value={kisiler.isveren}
              onChange={(e) =>
                setKisiler((s) => ({ ...s, isveren: toUpperTR(e.target.value || "") }))
              }
              className={editableUpperInputClass}
            />
            <input
  value={uzmanDisplayValue}
  readOnly
  className={`${editableUpperInputClass} bg-slate-100 font-semibold`}
/>

<input
  placeholder="İŞYERİ HEKİMİ / İH-"
  value={kisiler.hekim}
  onChange={(e) =>
    setKisiler((s) => ({
      ...s,
      hekim: toUpperTR(e.target.value || ""),
    }))
  }
  onFocus={handleHekimFocus}
  onBlur={handleHekimBlur}
  className={editableUpperInputClass}
/>
            <input
              placeholder="Çalışan Temsilcisi"
              value={kisiler.temsilci}
              onChange={(e) =>
                setKisiler((s) => ({ ...s, temsilci: toUpperTR(e.target.value || "") }))
              }
              className={editableUpperInputClass}
            />
            <input
              placeholder="Destek Elemanı"
              value={kisiler.destek}
              onChange={(e) =>
                setKisiler((s) => ({ ...s, destek: toUpperTR(e.target.value || "") }))
              }
              className={editableUpperInputClass}
            />
            <input
              placeholder="Bilgi Sahibi Kişi"
              value={kisiler.bilgi}
              onChange={(e) =>
                setKisiler((s) => ({ ...s, bilgi: toUpperTR(e.target.value || "") }))
              }
              className={editableUpperInputClass}
            />
          </div>

          <div className="mt-2 rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-4 py-3">
              <h3 className="text-sm sm:text-base font-semibold text-[#0a2b45]">
                İmza ve Paraflar
              </h3>
              <p className="mt-1 text-xs sm:text-sm text-slate-600">
                Burada kaydedilen imza ve paraflar diğer çok sayfalı evraklarda otomatik kullanılır.
              </p>
            </div>

            <div className="p-3 sm:p-4">
              {signaturesLoading && (
                <div className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-xs sm:text-sm text-slate-600">
                  İmza / paraf kayıtları server&apos;dan yükleniyor...
                </div>
              )}

              <div className="flex flex-col gap-2">
                {ROLE_DEFS.map((role) => {
                  const currentName = getCurrentRoleName(role.key);
                  const roleRecord = signatureState?.[role.key] || { imza: null, paraf: null };
                  const imzaStatus = getSignatureStatus(roleRecord.imza, currentName);
                  const parafStatus = getSignatureStatus(roleRecord.paraf, currentName);

                  return (
                    <div
                      key={role.key}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-slate-800 break-words leading-5">
                            {role.label}
                          </div>

                          <div className="mt-0.5 text-xs text-slate-600 break-words leading-5">
                            {currentName || "Kişi adı girilmedi"}
                          </div>

                          <div className="mt-1 flex flex-wrap gap-1">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] sm:text-[11px] font-medium ${statusBadgeClass(imzaStatus)}`}
                            >
                              İmza: {imzaStatus}
                            </span>

                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] sm:text-[11px] font-medium ${statusBadgeClass(parafStatus)}`}
                            >
                              Paraf: {parafStatus}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-row justify-end items-center gap-1.5 w-full lg:w-auto lg:shrink-0">
                          <button
                            type="button"
                            onClick={() => openSignatureModal(role.key, "imza")}
                            className={`${greenActionButtonClass} w-auto`}
                          >
                            İmza
                          </button>

                          <button
                            type="button"
                            onClick={() => openSignatureModal(role.key, "paraf")}
                            className={`${blueActionButtonClass} w-auto`}
                          >
                            Paraf
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-end mt-1 gap-2">
            <PrimaryButton size="sm" variant="green" onClick={handleKisilerKaydet}>
              Kaydet
            </PrimaryButton>
          </div>
        </div>

        {logoPreviewSrc && (
          <div className="flex justify-center">
            <img src={logoPreviewSrc} alt="Logo" className="h-20 object-contain" />
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2 border-t border-slate-200">
          <PrimaryButton
            type="button"
            size="sm"
            onClick={handlePrepare}
            disabled={loading}
            className={loading ? "cursor-wait" : ""}
          >
            {loading ? "Hazırlanıyor..." : "Hazırla (PDF)"}
          </PrimaryButton>
        </div>
      </CardBox>

      <Modal
        isOpen={show}
        onClose={closePreview}
        title="Risk Değerlendirme Prosedürü"
        headerActions={
          <div className="flex flex-col gap-1 w-full sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            <button
              onClick={handleYeniSekmedeAc}
              className="w-full sm:w-auto px-2 py-1 text-[10px] sm:text-xs rounded-md border border-gray-300 bg-white hover:bg-gray-50"
            >
              Yeni sekmede aç
            </button>

            <button
              onClick={handleIndir}
              className="w-full sm:w-auto px-2 py-1 text-[10px] sm:text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700"
            >
              İndir (PDF)
            </button>

            <PrimaryButton
              size="sm"
              variant="green"
              onClick={saveToDocs}
              disabled={saving}
              className="w-full sm:w-auto px-2 py-1 text-[10px] sm:text-xs"
            >
              {saving ? "Kaydediliyor..." : "Belgelerime Kaydet"}
            </PrimaryButton>
          </div>
        }
      >
        {loading && (
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

        {!loading && pdfUrl && (
          <iframe
            key={pdfUrl}
            src={pdfUrl}
            title="Risk Değerlendirme Prosedürü"
            className="w-full h-[50vh] sm:h-[60vh] border border-gray-200 rounded"
          />
        )}

        {!loading && !pdfUrl && (
          <div className="w-full h-[50vh] sm:h-[60vh] flex items-center justify-center text-sm text-gray-600">
            PDF bulunamadı. Lütfen 'Hazırla (PDF)' butonu ile yeniden deneyin.
          </div>
        )}
      </Modal>

      <Modal
        isOpen={signatureModalOpen}
        onClose={closeSignatureModal}
        title={`${currentRoleLabel} ${
          activeSignatureType === "imza" ? "İmzası" : "Parafı"
        }`}
      >
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs sm:text-sm text-slate-700">
            {activeSignatureType === "imza"
              ? "Bu imza, bu firmaya ait oluşturulan resmi İSG belgelerinde ilgili rol için kullanılacaktır."
              : "Bu paraf, çok sayfalı belgelerde ilk sayfa dışındaki sayfalarda kullanılacaktır."}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs sm:text-sm font-medium text-slate-700">
                Rol
              </label>
              <input
                readOnly
                value={currentRoleLabel}
                className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-2.5 text-sm text-gray-800"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs sm:text-sm font-medium text-slate-700">
                Kişi
              </label>
              <input
                readOnly
                value={getCurrentRoleName(activeSignatureRole)}
                className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-2.5 text-sm text-gray-800"
              />
            </div>
          </div>

          <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-3 text-xs sm:text-sm text-slate-700">
            <input
              type="checkbox"
              checked={signatureConsent}
              onChange={(e) => setSignatureConsent(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              {activeSignatureType === "imza"
                ? "Bu imzanın tarafıma ait olduğunu, elektronik ortamda oluşturulduğunu ve bu firma kapsamında düzenlenen resmi belgelerde kullanılmasını açık rızam ile onaylıyorum."
                : "Parafımın çok sayfalı belgelerde kullanılmasını onaylıyorum."}
            </span>
          </label>

          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-3 sm:p-4">
            <div
              ref={canvasWrapRef}
              className="relative w-full h-[220px] sm:h-[280px] rounded-lg bg-slate-50 overflow-hidden"
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
                  Buraya{" "}
                  {activeSignatureType === "imza" ? "imzanızı" : "parafınızı"}{" "}
                  çiziniz.
                </div>
              )}
            </div>

            <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="text-[11px] sm:text-xs text-slate-500">
                Renk: #1E40AF · Kalınlık: 2.2 px
              </div>

              <button
                type="button"
                onClick={clearCanvas}
                className={`${redActionButtonClass} w-auto`}
              >
                Temizle
              </button>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={saveSignatureDrawing}
              className={`${greenActionButtonClass} w-auto`}
            >
              Kaydet
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