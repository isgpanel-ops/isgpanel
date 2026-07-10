// src/pages/Egitim/CalisanTemsilcisiEgitimi.jsx
import React, { useContext, useEffect, useMemo, useState, useCallback, useRef } from "react";
import { SectionTitle, CardBox, PrimaryButton, Modal } from "../../components/ui";
import { FirmaContext } from "../../context/FirmaContext";
import ConfirmModal from "../../components/ui/ConfirmModal";

/* =========================
   ✅ GLOBAL STANDARD
========================= */
const DOCS_SYNC_KEY = "docs:lastChangeAt";

/* =========================
   ✅ TOKEN + URL HELPERS
========================= */
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
      localStorage.getItem("__isg_active_email_global") || "";

    const email =
      userObj?.email ||
      userObj?.mail ||
      activeEmail ||
      localStorage.getItem("userEmail");

    if (email) {
      const key = `isgpanel:${email}:token`;
      const t = localStorage.getItem(key);
      if (t) return t;
    }

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.endsWith(":token")) {
        const t = localStorage.getItem(k);
        if (t) return t;
      }
    }
  } catch {}

  return "";
}

function getBearerToken(userObj) {
  return getAuthToken(userObj);
}

const toAbsoluteUrl = (base, url) => {
  if (!url) return "";
  const s = String(url).trim();

  if (s.startsWith("data:image")) return s;

  if (s.startsWith("/uploads")) {
    return `https://api.isgpanel.tr${s}?v=${Date.now()}`;
  }

  if (s.startsWith("http://") || s.startsWith("https://")) {
    return s
      .replace("https://api.isgpanel.tr/api/uploads/", "https://api.isgpanel.tr/uploads/")
      .replace("/api/uploads/", "/uploads/");
  }

  return `${base}${s.startsWith("/") ? "" : "/"}${s}`;
};

const joinUrl = (root, path) => {
  const cleanRoot = String(root || "").replace(/\/+$/, "");
  const cleanPath = String(path || "").startsWith("/") ? path : `/${path}`;
  return `${cleanRoot}${cleanPath}`;
};

const getContentType = (res) => String(res?.headers?.get("content-type") || "").toLowerCase();

const safeJsonParse = async (res) => {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    throw new Error(text || "Geçersiz JSON yanıtı");
  }
};

const normalizeTC = (v) => (v || "").toString().replace(/\D/g, "").slice(0, 11);

const createEmptySignatureRecord = () => ({
  dataUrl: "",
  createdAt: "",
});

const createEmptyImzaState = () => ({
  personel: null,
});

const rowHasSignature = (row) => !!row?.imzalar?.personel?.dataUrl;

const getImzaProgress = (row) => {
  const completed = rowHasSignature(row) ? 1 : 0;
  return {
    completed,
    total: 1,
    text: `${completed}/1`,
  };
};

const isCriticalSignatureField = (field) =>
  ["tc", "adSoyad", "gorev"].includes(field);

const resetRowSignature = (row) => ({
  ...row,
  imzalar: createEmptyImzaState(),
});

const safeFile = (v) =>
  (v || "")
    .toString()
    .trim()
    .toLocaleUpperCase("tr-TR")
    .replace(/\s+/g, " ")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\.+$/g, "");

const pad2 = (n) => String(n).padStart(2, "0");

const isoToTR = (iso) => {
  if (!iso) return "";
  const s = iso.toString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  const [y, m, d] = s.split("-");
  return `${d}.${m}.${y}`;
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

/* Toplam çalışana göre önerilen temsilci sayısı */
function temsilciHesapla(sayi) {
  if (sayi === "" || sayi === null || sayi === undefined) return 0;

  const n = Number(sayi);
  if (!Number.isFinite(n)) return 0;

  if (n <= 1) return 0;
  if (n <= 50) return 1;
  if (n <= 100) return 2;
  if (n <= 500) return 3;
  if (n <= 1000) return 4;
  if (n <= 2000) return 5;
  return 6;
}

export default function CalisanTemsilcisiEgitimi() {
  const { selectedFirm } = useContext(FirmaContext);

  const RAW_API_ORIGIN =
    (import.meta.env.VITE_API_URL || import.meta.env.VITE_API || "").trim() ||
    "https://api.isgpanel.tr";

  const API_ORIGIN = RAW_API_ORIGIN
    .replace(/\/+$/, "")
    .replace(/\/api$/i, "");

  const API_ROOTS = useMemo(
    () =>
      Array.from(
        new Set([
          `${API_ORIGIN}/api`,
          API_ORIGIN,
        ])
      ),
    [API_ORIGIN]
  );

  const user = useMemo(() => {
    try {
      const activeEmail = localStorage.getItem("__isg_active_email_global");
      const u1 = activeEmail ? localStorage.getItem(`isgpanel:${activeEmail}:user`) : null;
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

  const createEmptySharedSignatureState = () => ({
    isveren: { imza: null, paraf: null },
    uzman: { imza: null, paraf: null },
    hekim: { imza: null, paraf: null },
    temsilci: { imza: null, paraf: null },
    destek: { imza: null, paraf: null },
    bilgi: { imza: null, paraf: null },
  });
  const pickSharedRoleSignature = (base, ...keys) => {
    for (const key of keys) {
      const item = base?.[key];
      if (
        item &&
        (item?.imza?.dataUrl || item?.paraf?.dataUrl || item?.dataUrl)
      ) {
        return item;
      }
    }

    return { imza: null, paraf: null };
  };

  const [sharedSignatures, setSharedSignatures] = useState(
    createEmptySharedSignatureState()
  );

  const [serverKurumsal, setServerKurumsal] = useState({
    logoUrl: "",
    logoBase64: "",
  });

  /* =========================================================
     ✅ Confirm / Info Modal
     ========================================================= */
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
    confirmText = "Evet",
    cancelText = "İptal",
    variant = "warning",
    onCancel,
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
      onCancel: () => {
        setConfirmOpen(false);
        onCancel?.();
      },
    });
    setConfirmOpen(true);
  };

  const [egitimBilgileri, setEgitimBilgileri] = useState({
    tarih: "",
    yer: "",
    saat: "4",
  });

  const [calisanSayisi, setCalisanSayisi] = useState("");
  const [onerilenTemsilci, setOnerilenTemsilci] = useState(0);

const [katilimcilar, setKatilimcilar] = useState([
  {
    no: 1,
    tc: "",
    adSoyad: "",
    gorev: "ÇALIŞAN TEMSİLCİSİ",
    imzalar: createEmptyImzaState(),
  },
]);
const [basTemsilciIndex, setBasTemsilciIndex] = useState(0);

/* Belge üretilecek temsilci seçimi */
const [belgeTemsilciIndex, setBelgeTemsilciIndex] = useState(0);
  const [riskTemsilci, setRiskTemsilci] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalTip, setModalTip] = useState(null); // "katilim" | "atama"

 const [pdfUrl, setPdfUrl] = useState(null);
const [pdfLoading, setPdfLoading] = useState(false);
const [pdfProgress, setPdfProgress] = useState(0);
const [pdfError, setPdfError] = useState("");
  const [signatureModalOpen, setSignatureModalOpen] = useState(false);
const [activeSignatureRowIndex, setActiveSignatureRowIndex] = useState(null);
const [signatureDrawingEmpty, setSignatureDrawingEmpty] = useState(true);
const [signatureConsentChecked, setSignatureConsentChecked] = useState(false);
const [signatureDraftRow, setSignatureDraftRow] = useState(null);

const canvasRef = useRef(null);
const canvasWrapRef = useRef(null);
const drawingRef = useRef(false);
const lastPointRef = useRef({ x: 0, y: 0 });

  const firmaId = selectedFirm?._id || selectedFirm?.id || "default";
  const RISK_KISILER_KEY = `risk_prosedur_kisiler_${firmaId}`;
  const EGITIM_DOCS_KEY = "belgelerim_egitim_listesi";

  const requestWithFallback = async (
    path,
    options = {},
    parseAs = "json" // "json" | "blob" | "text" | "response"
  ) => {
    let lastError = null;

    for (const root of API_ROOTS) {
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

  const readonlyInputClass =
    "w-full min-w-0 h-11 rounded-lg border border-gray-300 bg-slate-50 px-4 text-sm text-gray-800";
  const editableInputClass =
    "w-full min-w-0 h-11 rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 [color-scheme:light]";

 const signatureButtonClass = (row) =>
  `inline-flex items-center justify-center rounded-md border px-2 py-1 text-[11px] font-medium ${
    rowHasSignature(row)
      ? "border-green-200 bg-green-50 text-green-700"
      : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
  }`;

  const hideModalHeaderCloseStyle = `
    .pdf-onizleme-modal button[aria-label="Close"],
    .pdf-onizleme-modal button[aria-label="Kapat"],
    .pdf-onizleme-modal button[aria-label="close"]{
      display: none !important;
    }
  `;

  const getHazirlayanAdSoyad = () => {
    try {
      const raw = localStorage.getItem(RISK_KISILER_KEY);
      const obj = raw ? JSON.parse(raw) : {};
      const v =
        obj?.uzmanAdSoyad ||
        obj?.uzmanAdiSoyadi ||
        obj?.isgUzmaniAdSoyad ||
        obj?.uzman ||
        "";
      return (v || "").toString().trim();
    } catch {
      return "";
    }
  };

  const getTopluEtiket = (adet) => `TOPLU ÇALIŞAN TEMSİLCİSİ (${adet} KİŞİ)`;

  const hasMultipleTemsilci = (katilimcilar || []).length > 1;

const getSelectedBelgeTemsilci = () => {
  if (!hasMultipleTemsilci) {
    return katilimcilar?.[0] || null;
  }

  return katilimcilar?.[belgeTemsilciIndex] || null;
};

  useEffect(() => {
    let cancelled = false;

    const loadKurumsal = async () => {
      const token = getBearerToken(user);

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
      };

      if (fromFirm.logoUrl || fromFirm.logoBase64) {
        if (!cancelled) {
          setServerKurumsal({
            logoUrl: toAbsoluteUrl(API_ORIGIN, fromFirm.logoUrl || ""),
            logoBase64: fromFirm.logoBase64 || "",
          });
        }
        return;
      }

      const candidates = [
        `/firma/${firmaId}/kurumsal`,
        `/firma/${firmaId}/kurumsal-bilgiler`,
        `/kurumsal/${firmaId}`,
        `/kurumsal-bilgiler/${firmaId}`,
      ];

      for (const path of candidates) {
        try {
          const data = await requestWithFallback(
            path,
            {
              headers: {
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
            },
            "json"
          );

          const payload = data?.payload || data || {};
          const logoUrl =
            payload?.logoUrl ||
            payload?.logo ||
            payload?.kurumsalLogo ||
            "";
          const logoBase64 =
            payload?.logoBase64 ||
            payload?.logoData ||
            "";

          if (logoUrl || logoBase64) {
            if (!cancelled) {
              setServerKurumsal({
                logoUrl: toAbsoluteUrl(API_ORIGIN, logoUrl || ""),
                logoBase64: logoBase64 || "",
              });
            }
            return;
          }
        } catch {}
      }
    };

    if (selectedFirm && firmaId) {
      loadKurumsal();
    }

    return () => {
      cancelled = true;
    };
  }, [selectedFirm, firmaId, user, API_ORIGIN]);

  useEffect(() => {
    const firmIdLocal = selectedFirm?._id || selectedFirm?.id;
    if (!firmIdLocal) return;

    const pickFirst = (...vals) => vals.find((v) => String(v || "").trim()) || "";
    const hasAny = (obj) => Object.values(obj || {}).some((x) => String(x || "").trim());

    let alive = true;

    const fetchKisiler = async () => {
  const token = getBearerToken(user);

  const normalizeKisiler = (src = {}) => ({
    uzman: pickFirst(src?.uzman, src?.isgUzmaniAdSoyad, src?.isgUzmaniAdiSoyadi, src?.uzmanAdSoyad),
    hekim: pickFirst(src?.hekim, src?.isyeriHekimiAdSoyad, src?.isyeriHekimiAdiSoyadi, src?.hekimAdSoyad),
    isveren: pickFirst(
      src?.isveren,
      src?.isverenAdSoyad,
      src?.isverenVekiliAdSoyad,
      src?.isverenVekili
    ),
    temsilci: pickFirst(
      src?.temsilci,
      src?.calisanTemsilcisiAdSoyad,
      src?.calisanTemsilcisi,
      src?.temsilciAdSoyad
    ),
  });

  let serverKisiler = null;

  if (token) {
    try {
      const data = await requestWithFallback(
        `/firma/${firmIdLocal}/kisiler`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
        "json"
      );

      const next = normalizeKisiler(data || {});
      if (hasAny(next)) {
        serverKisiler = next;

        try {
          localStorage.setItem(
            `risk_prosedur_kisiler_${firmIdLocal}`,
            JSON.stringify({
              uzman: next.uzman || "",
              hekim: next.hekim || "",
              isveren: next.isveren || "",
              temsilci: next.temsilci || "",
              _syncedFromServerAt: new Date().toISOString(),
            })
          );
        } catch {}

        return next;
      }
    } catch (err) {
      console.error("Firma kişiler server’dan alınamadı:", err);
    }

    try {
      const p = await requestWithFallback(
        "/profile/personal",
        {
          headers: { Authorization: `Bearer ${token}` },
        },
        "json"
      );

      const next = normalizeKisiler(p || {});
      if (hasAny(next)) {
        return {
          ...serverKisiler,
          ...next,
        };
      }
    } catch (err) {
      console.error("Profile personal alınamadı:", err);
    }
  } else {
    console.warn("fetchKisiler: token bulunamadı, sadece local fallback denenecek.");
  }

  try {
    const raw = localStorage.getItem(`risk_prosedur_kisiler_${firmIdLocal}`);
    const p = raw ? JSON.parse(raw) : null;

    if (p && typeof p === "object") {
      const next = normalizeKisiler(p);

      if (hasAny(next)) {
        return next;
      }
    }
  } catch (err) {
    console.error("Local risk kişi cache okunamadı:", err);
  }

  return {
    uzman: "",
    hekim: "",
    isveren: "",
    temsilci: "",
  };
};


    (async () => {
      const kisiler = await fetchKisiler();

      if (!alive) return;
      setImzalar({
        isgUzmaniAdi: pickFirst(kisiler?.uzman),
        isyeriHekimiAdi: pickFirst(kisiler?.hekim),
        isverenAdi: pickFirst(kisiler?.isveren),
      });

      const apiTemsilci = pickFirst(kisiler?.temsilci).toLocaleUpperCase("tr-TR").trim();
      if (apiTemsilci) {
        setRiskTemsilci(apiTemsilci);
      }
    })();

    return () => {
      alive = false;
    };
  }, [selectedFirm?._id, selectedFirm?.id, user, API_ROOTS]);

    useEffect(() => {
    const firmIdLocal = selectedFirm?._id || selectedFirm?.id;
    if (!firmIdLocal) return;

    let alive = true;

    const SHARED_SIGNATURES_CACHE_KEY = `firma_${firmIdLocal}_shared_signatures`;

const loadSharedSignatures = async () => {
  const token = getBearerToken(user);

  const normalizeSharedSignatures = (incoming = {}) => ({
    ...createEmptySharedSignatureState(),
    ...incoming,

    isveren:
      incoming?.isveren ||
      incoming?.isverenVekili ||
      incoming?.isveren_vekili ||
      { imza: null, paraf: null },

    uzman:
      incoming?.uzman ||
      incoming?.isgUzmani ||
      incoming?.isg_uzmani ||
      { imza: null, paraf: null },

    hekim:
      incoming?.hekim ||
      incoming?.isyeriHekimi ||
      incoming?.isyeri_hekimi ||
      { imza: null, paraf: null },

    temsilci:
      incoming?.temsilci ||
      incoming?.calisanTemsilcisi ||
      incoming?.calisan_temsilcisi ||
      { imza: null, paraf: null },
  });

  if (token) {
    try {
      const data = await requestWithFallback(
        `/firma/${firmIdLocal}/imzalar`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        "json"
      );

      if (!alive) return;

      const normalized = normalizeSharedSignatures(data || {});
      setSharedSignatures(normalized);

      try {
        localStorage.setItem(
          SHARED_SIGNATURES_CACHE_KEY,
          JSON.stringify({
            ...normalized,
            _syncedFromServerAt: new Date().toISOString(),
          })
        );
      } catch {}

      return;
    } catch (err) {
      console.error("Ortak imza kayıtları server’dan alınamadı:", err);
    }
  } else {
    console.warn("loadSharedSignatures: token bulunamadı, local cache denenecek.");
  }

  try {
    const raw = localStorage.getItem(SHARED_SIGNATURES_CACHE_KEY);
    const cached = raw ? JSON.parse(raw) : null;

    if (cached && typeof cached === "object") {
      if (!alive) return;
      setSharedSignatures(normalizeSharedSignatures(cached));
      return;
    }
  } catch (err) {
    console.error("İmza cache okunamadı:", err);
  }

  if (alive) {
    setSharedSignatures(createEmptySharedSignatureState());
  }
};

    const refreshSharedSignatures = () => {
      loadSharedSignatures();
    };

    loadSharedSignatures();

    window.addEventListener("focus", refreshSharedSignatures);
    window.addEventListener("pageshow", refreshSharedSignatures);
    window.addEventListener("risk_kisiler_updated", refreshSharedSignatures);

    return () => {
      alive = false;
      window.removeEventListener("focus", refreshSharedSignatures);
      window.removeEventListener("pageshow", refreshSharedSignatures);
      window.removeEventListener("risk_kisiler_updated", refreshSharedSignatures);
    };
  }, [selectedFirm?._id, selectedFirm?.id, user, API_ROOTS]);

  /* ---------------------- İlk yükleme / yeniden kurma ---------------------- */
  useEffect(() => {
    if (!selectedFirm) return;

    let alive = true;

    const loadPageData = async () => {
      try {
        setEgitimBilgileri((prev) => ({
          ...prev,
          yer: prev.yer || selectedFirm.firmaAdi || "",
          saat: prev.saat || "4",
        }));

        let temsilciAd = (riskTemsilci || "").toLocaleUpperCase("tr-TR").trim();

        try {
          const rawRisk = localStorage.getItem(RISK_KISILER_KEY);
          if (rawRisk) {
            const obj = JSON.parse(rawRisk);
            if (obj && typeof obj === "object" && obj.temsilci) {
              temsilciAd =
                temsilciAd ||
                String(obj.temsilci).toLocaleUpperCase("tr-TR").trim();
            }
          }
        } catch {}

        if (!alive) return;
        setRiskTemsilci(temsilciAd || "");

        let savedData = null;
        try {
          const token = getBearerToken(user);
          const json = await requestWithFallback(
            `/calisan-temsilcisi/katilimcilar?firmaId=${encodeURIComponent(firmaId)}`,
            {
              headers: {
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
            },
            "json"
          );

          savedData = json?.payload?.payload || json?.payload || json || null;
        } catch (err) {
          console.error("Çalışan temsilcisi server kayıt yükleme hatası:", err);
        }

        if (!alive) return;

        if (savedData?.egitimBilgileri) {
          setEgitimBilgileri((prev) => ({
            ...prev,
            ...savedData.egitimBilgileri,
            saat: savedData.egitimBilgileri.saat || "4",
          }));
        }

        const savedCalisanSayisi = savedData?.calisanSayisi ? String(savedData.calisanSayisi) : "";

        if (savedCalisanSayisi) {
          setCalisanSayisi(savedCalisanSayisi);
          setOnerilenTemsilci(temsilciHesapla(Number(savedCalisanSayisi)));
        } else {
          setCalisanSayisi("");
          setOnerilenTemsilci(0);
        }

        const savedBasIndex =
          typeof savedData?.basTemsilciIndex === "number" ? savedData.basTemsilciIndex : 0;
        setBasTemsilciIndex(savedBasIndex);

        let rows = [];

        if (Array.isArray(savedData?.katilimcilar) && savedData.katilimcilar.length > 0) {
          rows = savedData.katilimcilar.map((k, i) => ({
  no: i + 1,
  tc: normalizeTC(k.tc || ""),
  adSoyad: (k.adSoyad || "").toLocaleUpperCase("tr-TR"),
  gorev: (k.gorev || "ÇALIŞAN TEMSİLCİSİ").toLocaleUpperCase("tr-TR"),
  imzalar: {
    ...createEmptyImzaState(),
    ...(k?.imzalar || {}),
  },
}));
        } else {
          rows = [
            {
              no: 1,
              tc: "",
              adSoyad: "",
              gorev: "ÇALIŞAN TEMSİLCİSİ",
            },
          ];
        }

        const idx =
          typeof savedBasIndex === "number" && rows[savedBasIndex] ? savedBasIndex : 0;

        if (temsilciAd) {
          if (!rows[idx]) {
            rows = [
              {
                no: 1,
                tc: "",
                adSoyad: temsilciAd,
                gorev: "ÇALIŞAN TEMSİLCİSİ",
              },
            ];
            setBasTemsilciIndex(0);
          } else {
            rows[idx] = {
              ...rows[idx],
              adSoyad: temsilciAd,
            };
          }
        }

        setKatilimcilar(rows.map((k, i) => ({ ...k, no: i + 1 })));
      } catch (e) {
        console.error("Çalışan temsilcisi eğitimi yüklenemedi:", e);
      }
    };

    loadPageData();

    return () => {
      alive = false;
    };
  }, [selectedFirm, RISK_KISILER_KEY, riskTemsilci, firmaId, user, API_ROOTS]);

  const handleEgitimChange = (field, value) => {
    setEgitimBilgileri((prev) => ({ ...prev, [field]: value }));
  };

  const handleCalisanSayisiChange = (value) => {
    setCalisanSayisi(value);
    const n = parseInt(value, 10);

    if (!isNaN(n)) {
      const oneri = temsilciHesapla(n);
      setOnerilenTemsilci(oneri);

      setKatilimcilar((prev) => {
        let arr = [...prev];

        arr = arr.filter((item) => (item.adSoyad || "").trim() !== "");

        while (arr.length < oneri) {
          arr.push({
            no: arr.length + 1,
            tc: "",
            adSoyad: "",
            gorev: "ÇALIŞAN TEMSİLCİSİ",
          });
        }

        if (arr.length > oneri && oneri > 0) {
          arr = arr.slice(0, oneri);
        }

        if (oneri === 0) {
          arr = [{
  no: 1,
  tc: "",
  adSoyad: "",
  gorev: "ÇALIŞAN TEMSİLCİSİ",
  imzalar: createEmptyImzaState(),
}];
        }

        arr = arr.map((k, i) => ({ ...k, no: i + 1 }));
        return arr;
      });

     if (basTemsilciIndex >= oneri && oneri > 0) {
  setBasTemsilciIndex(0);
}

if (belgeTemsilciIndex >= oneri && oneri > 0) {
  setBelgeTemsilciIndex(0);
}

    } else {
      setOnerilenTemsilci(0);
    }
  };

  const handleKatilimciChange = (index, field, value) => {
    setKatilimcilar((prev) => {
      const updated = [...prev];

      let nextVal = value;

      if (field === "tc") {
        nextVal = normalizeTC(value);
      } else {
        nextVal = value?.toLocaleUpperCase?.("tr-TR") || value;
      }

      const oldRow = updated[index];
const nextRow = { ...oldRow, [field]: nextVal };
const changed = String(oldRow?.[field] || "") !== String(nextVal || "");

updated[index] =
  changed && isCriticalSignatureField(field) && rowHasSignature(oldRow)
    ? resetRowSignature(nextRow)
    : nextRow;

return updated.map((k, i) => ({ ...k, no: i + 1 }));
    });
  };

const satirEkle = () => {
  setKatilimcilar((prev) => {
    const arr = [
      ...prev,
      { no: prev.length + 1, tc: "", adSoyad: "", gorev: "ÇALIŞAN TEMSİLCİSİ" },
    ];

    if (arr.length === 2) {
      setBelgeTemsilciIndex(0);
    }

    return arr.map((k, i) => ({ ...k, no: i + 1 }));
  });
};

const getCurrentSignatureRow = () => {
  if (signatureDraftRow) return signatureDraftRow;
  if (activeSignatureRowIndex === null) return null;
  return katilimcilar?.[activeSignatureRowIndex] || null;
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

const openSignatureModal = (rowIndex) => {
  const row = katilimcilar?.[rowIndex] || null;

  if (!String(row?.adSoyad || "").trim()) {
    openInfo("Bilgilendirme", "Önce personel adını giriniz.");
    return;
  }

  setActiveSignatureRowIndex(rowIndex);
  setSignatureDraftRow(
    row ? { ...row, imzalar: { ...(row.imzalar || createEmptyImzaState()) } } : null
  );
  setSignatureDrawingEmpty(true);
  setSignatureConsentChecked(false);
  setSignatureModalOpen(true);

  setTimeout(() => {
    resizeCanvas();
    clearCanvas();
  }, 80);
};

const forceCloseSignatureModal = () => {
  setSignatureModalOpen(false);
  setActiveSignatureRowIndex(null);
  setSignatureDrawingEmpty(true);
  setSignatureConsentChecked(false);
  setSignatureDraftRow(null);
};

const closeSignatureModal = () => {
  const activeRow = getCurrentSignatureRow();

  if (activeRow && !rowHasSignature(activeRow)) {
    openConfirm({
      title: "Eksik İmza Uyarısı",
      message: "Eksik imzanız var. Yine de çıkmak istiyor musunuz?",
      confirmText: "Çık",
      cancelText: "Devam Et",
      variant: "warning",
      onConfirm: forceCloseSignatureModal,
    });
    return;
  }

  forceCloseSignatureModal();
};

const saveSignatureDrawing = async () => {
  if (activeSignatureRowIndex === null) return;

  if (!signatureConsentChecked) {
    openInfo(
      "Bilgilendirme",
      "Devam etmeden önce eğitim aldığına dair onay kutusunu işaretleyiniz."
    );
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

  const OUTPUT_SCALE = 2;
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

  outCtx.drawImage(canvas, minX, minY, cropW, cropH, dx, dy, drawW, drawH);

  const dataUrl = outCanvas.toDataURL("image/png");

  const savedSignature = {
    ...createEmptySignatureRecord(),
    dataUrl,
    createdAt: new Date().toISOString(),
  };

  const currentRow = getCurrentSignatureRow();

  const nextDraftRow = {
    ...(currentRow || {}),
    imzalar: {
      ...((currentRow || {}).imzalar || createEmptyImzaState()),
      personel: savedSignature,
    },
  };

  setSignatureDraftRow(nextDraftRow);

  setKatilimcilar((prev) =>
    prev.map((row, idx) =>
      idx === activeSignatureRowIndex
        ? {
            ...row,
            imzalar: {
              ...(row.imzalar || createEmptyImzaState()),
              personel: savedSignature,
            },
          }
        : row
    )
  );

  forceCloseSignatureModal();
};

  /* -------- Risk prosedürü ile çift yönlü senkron -------- */
  const syncRiskTemsilci = async (katilimcilarState, basIndexState) => {
    let aktifTemsilciAd = "";

    if (basIndexState != null && katilimcilarState[basIndexState]) {
      aktifTemsilciAd = katilimcilarState[basIndexState].adSoyad || "";
    } else if (katilimcilarState.length === 1) {
      aktifTemsilciAd = katilimcilarState[0].adSoyad || "";
    }

    aktifTemsilciAd = aktifTemsilciAd.trim().toLocaleUpperCase("tr-TR");
    const mevcutRiskAd = (riskTemsilci || "").trim().toLocaleUpperCase("tr-TR");

    if (!aktifTemsilciAd) return false;

       const writeAndNotify = async () => {
      const token = getBearerToken(user);

      let localObj = {};
      try {
        const raw = localStorage.getItem(RISK_KISILER_KEY);
        localObj = raw ? JSON.parse(raw) : {};
        if (!localObj || typeof localObj !== "object") localObj = {};
      } catch {
        localObj = {};
      }

      let serverObj = {};
      if (token && firmaId) {
        try {
          const existing = await requestWithFallback(
            `/firma/${firmaId}/kisiler`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            },
            "json"
          );
          if (existing && typeof existing === "object") {
            serverObj = existing;
          }
        } catch (err) {
          console.error("Mevcut kişi kayıtları alınamadı:", err);
        }
      }

      const mergedPayload = {
        ...serverObj,
        ...localObj,

        temsilci: aktifTemsilciAd,
        calisanTemsilcisiAdSoyad: aktifTemsilciAd,

        uzman:
          serverObj?.uzman ||
          serverObj?.isgUzmaniAdSoyad ||
          localObj?.uzman ||
          "",
        isgUzmaniAdSoyad:
          serverObj?.isgUzmaniAdSoyad ||
          serverObj?.uzman ||
          localObj?.isgUzmaniAdSoyad ||
          localObj?.uzman ||
          "",

        hekim:
          serverObj?.hekim ||
          serverObj?.isyeriHekimiAdSoyad ||
          localObj?.hekim ||
          "",
        isyeriHekimiAdSoyad:
          serverObj?.isyeriHekimiAdSoyad ||
          serverObj?.hekim ||
          localObj?.isyeriHekimiAdSoyad ||
          localObj?.hekim ||
          "",

        isveren:
          serverObj?.isveren ||
          serverObj?.isverenVekiliAdSoyad ||
          serverObj?.isverenVekili ||
          localObj?.isveren ||
          "",
        isverenVekiliAdSoyad:
          serverObj?.isverenVekiliAdSoyad ||
          serverObj?.isveren ||
          serverObj?.isverenVekili ||
          localObj?.isverenVekiliAdSoyad ||
          localObj?.isveren ||
          "",
      };

      localStorage.setItem(
        RISK_KISILER_KEY,
        JSON.stringify({
          ...localObj,
          uzman: mergedPayload.uzman || "",
          hekim: mergedPayload.hekim || "",
          isveren: mergedPayload.isveren || "",
          temsilci: aktifTemsilciAd,
        })
      );

      if (token && firmaId) {
        try {
          await requestWithFallback(
            `/firma/${firmaId}/kisiler`,
            {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(mergedPayload),
            },
            "json"
          );
        } catch (err) {
          console.error("Çalışan temsilcisi Mongo güncelleme hatası:", err);
        }
      }

      setRiskTemsilci(aktifTemsilciAd);

      window.dispatchEvent(
        new CustomEvent("risk_kisiler_updated", {
          detail: { firmaId: String(firmaId) },
        })
      );
    };

    if (aktifTemsilciAd === mevcutRiskAd) {
      await writeAndNotify();
      return true;
    }

    const mesaj = mevcutRiskAd
      ? `Risk değerlendirme prosedüründe kayıtlı çalışan temsilcisi "${mevcutRiskAd}".\nBunu "${aktifTemsilciAd}" olarak güncellemek ister misiniz?`
      : `"${aktifTemsilciAd}" çalışan temsilcisi olarak risk değerlendirme prosedürüne kaydedilsin mi?`;

    return await new Promise((resolve) => {
      openConfirm({
        title: "Onay",
        message: mesaj,
        confirmText: "Evet",
        cancelText: "İptal",
        variant: "warning",
        onConfirm: async () => {
          try {
            await writeAndNotify();
            openInfo("Bilgilendirme", "Risk değerlendirme prosedürü çalışan temsilcisi güncellendi ✅");
            resolve(true);
          } catch (e) {
            console.error("Risk prosedürü güncellenemedi:", e);
            openInfo("Hata", "Risk değerlendirme prosedürü güncellenirken hata oluştu.");
            resolve(false);
          }
        },
        onCancel: () => resolve(false),
      });
    });
  };

  /* ----------------------------- Kaydet ----------------------------- */
  const handleKaydet = async () => {
    try {
      await syncRiskTemsilci(katilimcilar, basTemsilciIndex);

      const token = getBearerToken(user);

      const payload = {
        egitimBilgileri,
        calisanSayisi,
        onerilenTemsilci,
        katilimcilar: (katilimcilar || []).map((k, i) => ({
          no: i + 1,
          tc: normalizeTC(k.tc || ""),
          adSoyad: (k.adSoyad || "").toLocaleUpperCase("tr-TR"),
          gorev: (k.gorev || "ÇALIŞAN TEMSİLCİSİ").toLocaleUpperCase("tr-TR"),
imzalar: {
  personel: k?.imzalar?.personel || null,
},
        })),
        basTemsilciIndex,
      };

      await requestWithFallback(
        "/calisan-temsilcisi/katilimcilar",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            firmaId: String(firmaId),
            firmaAdi: selectedFirm?.firmaAdi || "",
            egitimTuru: "Çalışan Temsilcisi Eğitimi",
            katilimcilar: payload.katilimcilar,
            payload,
          }),
        },
        "json"
      );

      try {
        localStorage.setItem(DOCS_SYNC_KEY, String(Date.now()));
      } catch {}
      window.dispatchEvent(new Event(DOCS_SYNC_KEY));
window.dispatchEvent(new Event("ticari_docs_refresh"));

      openInfo("Bilgilendirme", "Çalışan temsilcisi eğitimi bilgileri kaydedildi ✅");
    } catch (e) {
      console.error("Kaydedilemedi:", e);
      openInfo("Hata", "Kaydederken bir hata oluştu.");
    }
  };

    useEffect(() => {
    const handleRiskKisilerUpdated = async (e) => {
      const eventFirmaId = String(e?.detail?.firmaId || "");
      const currentFirmaId = String(firmaId || "");

      if (!eventFirmaId || eventFirmaId !== currentFirmaId) return;

      try {
        const rawRisk = localStorage.getItem(RISK_KISILER_KEY);
        const obj = rawRisk ? JSON.parse(rawRisk) : {};

       const temsilciAd = (obj?.temsilci || "")
  .toString()
  .toLocaleUpperCase("tr-TR")
  .trim();

const uzmanAd = (obj?.uzman || "")
  .toString()
  .toLocaleUpperCase("tr-TR")
  .trim();

const hekimAd = (obj?.hekim || "")
  .toString()
  .toLocaleUpperCase("tr-TR")
  .trim();

const isverenAd = (obj?.isveren || "")
  .toString()
  .toLocaleUpperCase("tr-TR")
  .trim();

if (temsilciAd) {
  setRiskTemsilci(temsilciAd);
}

setImzalar((prev) => ({
  ...prev,
  isgUzmaniAdi: uzmanAd || prev.isgUzmaniAdi || "",
  isyeriHekimiAdi: hekimAd || prev.isyeriHekimiAdi || "",
  isverenAdi: isverenAd || prev.isverenAdi || "",
}));

if (!temsilciAd) return;

        setImzalar((prev) => ({
          ...prev,
          isgUzmaniAdi: uzmanAd || prev.isgUzmaniAdi || "",
          isyeriHekimiAdi: hekimAd || prev.isyeriHekimiAdi || "",
          isverenAdi: isverenAd || prev.isverenAdi || "",
        }));

        if (!temsilciAd) return;

        setKatilimcilar((prev) => {
          let rows =
            Array.isArray(prev) && prev.length
              ? [...prev]
              : [{
  no: 1,
  tc: "",
  adSoyad: "",
  gorev: "ÇALIŞAN TEMSİLCİSİ",
  imzalar: createEmptyImzaState(),
}];

          const idx =
            typeof basTemsilciIndex === "number" && rows[basTemsilciIndex]
              ? basTemsilciIndex
              : 0;

          rows[idx] = {
            ...rows[idx],
            adSoyad: temsilciAd,
            gorev: rows[idx]?.gorev || "ÇALIŞAN TEMSİLCİSİ",
          };

          return rows.map((k, i) => ({ ...k, no: i + 1 }));
        });

        const token = getBearerToken(user);
        if (token && firmaId) {
          try {
            const fresh = await requestWithFallback(
              `/firma/${firmaId}/kisiler`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              },
              "json"
            );

            setImzalar((prev) => ({
              ...prev,
              isgUzmaniAdi:
                fresh?.uzman ||
                fresh?.isgUzmaniAdSoyad ||
                prev.isgUzmaniAdi ||
                "",
              isyeriHekimiAdi:
                fresh?.hekim ||
                fresh?.isyeriHekimiAdSoyad ||
                prev.isyeriHekimiAdi ||
                "",
              isverenAdi:
                fresh?.isveren ||
                fresh?.isverenVekiliAdSoyad ||
                fresh?.isverenVekili ||
                prev.isverenAdi ||
                "",
            }));
          } catch (err) {
            console.error("Güncel kişi kayıtları alınamadı:", err);
          }
        }
      } catch (err) {
        console.error("risk_kisiler_updated senkron hatası:", err);
      }
    };

    window.addEventListener("risk_kisiler_updated", handleRiskKisilerUpdated);
    return () =>
      window.removeEventListener("risk_kisiler_updated", handleRiskKisilerUpdated);
  }, [firmaId, RISK_KISILER_KEY, basTemsilciIndex, user, API_ROOTS]);

  const readRiskKisilerForPdf = () => {
  let obj = {};

  try {
    const raw = localStorage.getItem(RISK_KISILER_KEY);
    obj = raw ? JSON.parse(raw) : {};
    if (!obj || typeof obj !== "object") obj = {};
  } catch {
    obj = {};
  }

  const aktifBasTemsilci =
    katilimcilar?.[basTemsilciIndex]?.adSoyad ||
    katilimcilar?.[0]?.adSoyad ||
    "";

  return {
    uzmanAdSoyad:
      imzalar.isgUzmaniAdi ||
      obj.isgUzmaniAdSoyad ||
      obj.uzmanAdSoyad ||
      obj.uzman ||
      "",

    hekimAdSoyad:
      imzalar.isyeriHekimiAdi ||
      obj.isyeriHekimiAdSoyad ||
      obj.hekimAdSoyad ||
      obj.hekim ||
      "",

    isverenAdSoyad:
      imzalar.isverenAdi ||
      obj.isverenVekiliAdSoyad ||
      obj.isverenAdSoyad ||
      obj.isverenVekili ||
      obj.isveren ||
      "",

    temsilciAdSoyad:
      riskTemsilci ||
      aktifBasTemsilci ||
      obj.calisanTemsilcisiAdSoyad ||
      obj.temsilciAdSoyad ||
      obj.calisanTemsilcisi ||
      obj.temsilci ||
      "",
  };
};

    const readRiskImzalarForPdf = (isAtama = false) => {
    const base = sharedSignatures || createEmptySharedSignatureState();

    const normalized = {
      isveren: pickSharedRoleSignature(
        base,
        "isveren",
        "isverenVekili",
        "isveren_vekili"
      ),
      uzman: pickSharedRoleSignature(
        base,
        "uzman",
        "isgUzmani",
        "isg_uzmani"
      ),
      hekim: pickSharedRoleSignature(
        base,
        "hekim",
        "isyeriHekimi",
        "isyeri_hekimi"
      ),
      temsilci: pickSharedRoleSignature(
        base,
        "temsilci",
        "calisanTemsilcisi",
        "calisan_temsilcisi"
      ),
    };

    if (isAtama) {
      return {
        isveren: normalized.isveren,
        temsilci: normalized.temsilci,
      };
    }

    return {
      isveren: normalized.isveren,
      uzman: normalized.uzman,
      hekim: normalized.hekim,
      temsilci: normalized.temsilci,
    };
  };

  const readKurumsalForPdf = () => {
    try {
      const raw = localStorage.getItem("kurumsalBilgiler");
      const k = raw ? JSON.parse(raw) : null;

      const localLogoUrl = k?.logoUrl || "";
      const localLogoBase64 = k?.logoBase64 || k?.logo || "";

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
      };
    } catch {
      return {
        logoUrl: serverKurumsal.logoUrl || "",
        logoBase64: serverKurumsal.logoBase64 || "",
      };
    }
  };

  const buildFirmaPayload = useMemo(() => {
    const f = selectedFirm || {};
    return {
      firmaAdi: f.firmaAdi || "",
      adres: f.adres || "",
      nace: f.nace || f.naceKodu || "",
      sgkSicilNo: f.sgkSicilNo || f.sgk || "",
      tehlike: f.tehlike || "",
      tehlikeSinifi: f.tehlike || "",
      calisanSayisi:
        Number(calisanSayisi) ||
        f.calisanSayisi ||
        f.calisan ||
        f.personelSayisi ||
        "",
    };
  }, [selectedFirm, calisanSayisi]);

   const buildPayload = (rows, isAtama = false) => {
    const kisilerPdf = readRiskKisilerForPdf();
    const kurumsalPdf = readKurumsalForPdf();
    const sharedImzalar = readRiskImzalarForPdf(isAtama);

// ✅ EKLENECEK DOĞRU YER
const kisiselBilgiler = (() => {
  try {
    return JSON.parse(localStorage.getItem("kisiselBilgiler") || "{}");
  } catch {
    return {};
  }
})();

  const firstSelectedRow = rows?.[0] || null;

const selectedIsBasTemsilci =
  String(firstSelectedRow?.adSoyad || "").toLocaleUpperCase("tr-TR").trim() ===
  String(katilimcilar?.[basTemsilciIndex]?.adSoyad || "").toLocaleUpperCase("tr-TR").trim();

const selectedPersonelSignature = firstSelectedRow?.imzalar?.personel || null;

const finalImzalar =
  selectedIsBasTemsilci || !selectedPersonelSignature?.dataUrl
    ? sharedImzalar
    : {
        ...sharedImzalar,
        temsilci: {
          imza: selectedPersonelSignature,
          paraf: null,
        },
      };

    console.log("CTE PDF IMZA PAYLOAD", {
      isAtama,
      temsilci: !!(
        sharedImzalar?.temsilci?.imza?.dataUrl ||
        sharedImzalar?.temsilci?.dataUrl
      ),
      uzman: !!(
        sharedImzalar?.uzman?.imza?.dataUrl ||
        sharedImzalar?.uzman?.dataUrl
      ),
      hekim: !!(
        sharedImzalar?.hekim?.imza?.dataUrl ||
        sharedImzalar?.hekim?.dataUrl
      ),
      isveren: !!(
        sharedImzalar?.isveren?.imza?.dataUrl ||
        sharedImzalar?.isveren?.dataUrl
      ),
      sharedSignatures,
    });


   const selectedRows = (rows || []).map((k, idx) => ({
  no: idx + 1,
  tc: normalizeTC(k.tc || ""),
  adSoyad: (k.adSoyad || "").toLocaleUpperCase("tr-TR"),
 gorev: (k.gorev || "ÇALIŞAN TEMSİLCİSİ").toLocaleUpperCase("tr-TR"),
imzalar: {
  personel: k?.imzalar?.personel || null,
},
personelImzasi: k?.imzalar?.personel || null,
isBasTemsilci:
    String(k.adSoyad || "").toLocaleUpperCase("tr-TR").trim() ===
    String(katilimcilar?.[basTemsilciIndex]?.adSoyad || "").toLocaleUpperCase("tr-TR").trim(),
}));

   return {
  authToken: getBearerToken(user),
  firmaId: String(firmaId),

 kisisel: {
  sertifikaNo:
    kisiselBilgiler?.sertifikaNo ||
    kisiselBilgiler?.uzmanSertifikaNo ||
    user?.sertifikaNo ||
    user?.sertifikaNumarasi ||
    user?.isgUzmaniSertifikaNo ||
    user?.isgSertifikaNo ||
    user?.certificateNo ||
    user?.iguSertifikaNo ||
    "",
  sertifikaSinifi:
    kisiselBilgiler?.sertifikaSinifi ||
    kisiselBilgiler?.uzmanlikSinifi ||
    user?.sertifikaSinifi ||
    user?.sertifikaSinif ||
    user?.sertifikaSinifiText ||
    user?.certificateClass ||
    user?.iguSinifi ||
    "",
},

  firma: buildFirmaPayload,
kurumsal: {
  logo: kurumsalPdf.logoBase64 || kurumsalPdf.logoUrl || "",
  logoUrl: kurumsalPdf.logoUrl || "",
  logoBase64: kurumsalPdf.logoBase64 || "",
  firmaLogo: kurumsalPdf.logoBase64 || kurumsalPdf.logoUrl || "",
  kurumsalLogo: kurumsalPdf.logoBase64 || kurumsalPdf.logoUrl || "",
  logoPath: kurumsalPdf.logoUrl || "",
},

logo: kurumsalPdf.logoBase64 || kurumsalPdf.logoUrl || "",
logoUrl: kurumsalPdf.logoUrl || "",
logoBase64: kurumsalPdf.logoBase64 || "",
firmaLogo: kurumsalPdf.logoBase64 || kurumsalPdf.logoUrl || "",
      imzalar: finalImzalar,
      kisiler: {
        uzman: kisilerPdf.uzmanAdSoyad || "",
        uzmanAdSoyad: kisilerPdf.uzmanAdSoyad || "",
        hekim: kisilerPdf.hekimAdSoyad || "",
        hekimAdSoyad: kisilerPdf.hekimAdSoyad || "",
        isveren: kisilerPdf.isverenAdSoyad || "",
        isverenAdSoyad: kisilerPdf.isverenAdSoyad || "",
        temsilci: kisilerPdf.temsilciAdSoyad || "",
        temsilciAdSoyad: kisilerPdf.temsilciAdSoyad || "",
      },
      egitim: {
        konu: "Çalışan Temsilcisi Eğitimi",
        tarih: egitimBilgileri.tarih || "",
        tarihTR: isoToTR(egitimBilgileri.tarih || ""),
        yer: egitimBilgileri.yer || "",
        saat: Number(egitimBilgileri.saat || 4) || 4,
        konular: [
          "ÇALIŞAN TEMSİLCİSİNİN GÖREV VE SORUMLULUKLARI",
          "İSG TEMEL KAVRAMLARI",
          "İŞ SAĞLIĞI VE GÜVENLİĞİ KONULARINDA ULUSAL MEVZUAT VE STANDARTLAR",
          "ACİL DURUM ÖNLEMLERİ",
          "RİSK DEĞERLENDİRMESİ",
        ],
      },
      temsilci: {
        toplamCalisan: Number(calisanSayisi || 0),
        onerilenSayi: Number(onerilenTemsilci || 0),
        basTemsilciIndex,
        atamaMi: !!isAtama,
      },
      katilimcilar: selectedRows,
    };
  };

  const openModal = (tip) => {
    setModalTip(tip);
    setModalOpen(true);
  };

  const closeModal = () => {
  setModalOpen(false);
  setModalTip(null);

  try {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
  } catch {}

  setPdfUrl(null);
  setPdfError("");
  setPdfLoading(false);
  setPdfProgress(0);
};

  const postBlob = async (path, payload) => {
    const token = getBearerToken(user);

    return await requestWithFallback(
      path,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      },
      "blob"
    );
  };

  const handleKatilimFormu = async () => {
    await syncRiskTemsilci(katilimcilar, basTemsilciIndex);

    openModal("katilim");
    try {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    } catch {}
  setPdfUrl(null);
setPdfError("");
setPdfLoading(true);
setPdfProgress(5);

const progressTimer = setInterval(() => {
  setPdfProgress((prev) => {
    if (prev >= 92) return prev;
    return prev + Math.floor(Math.random() * 6) + 2;
  });
}, 700);

    const selectedRow = getSelectedBelgeTemsilci();

if (!selectedRow || !(selectedRow.adSoyad || "").trim()) {
  setPdfLoading(false);
  setPdfError(
    hasMultipleTemsilci
      ? "Lütfen belge oluşturmak için bir temsilci seçin ve ad soyadını doldurun."
      : "Lütfen katılımcı adını girin."
  );
  return;
}

if (normalizeTC(selectedRow.tc).length !== 11) {
  setPdfLoading(false);
  setPdfError("Seçilen temsilci için T.C. Kimlik No 11 hane olmalıdır.");
  return;
}

    if (!egitimBilgileri?.tarih) {
      setPdfLoading(false);
      setPdfError("Lütfen eğitim tarihini seçin.");
      return;
    }

    try {
      const payload = buildPayload([selectedRow], false);
     const blob = await postBlob("/calisan-temsilcisi/katilim/pdf", payload);
const objectUrl = URL.createObjectURL(blob);

clearInterval(progressTimer);
setPdfProgress(100);
setPdfUrl(objectUrl);

setTimeout(() => {
  setPdfLoading(false);
}, 400);
    } catch (e) {
      console.error(e);
      setPdfError(e.message || "Katılım formu PDF hazırlanamadı.");
   } finally {
  clearInterval(progressTimer);
}
  };

  const handleAtamaFormu = async () => {
    await syncRiskTemsilci(katilimcilar, basTemsilciIndex);

    openModal("atama");
    try {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    } catch {}
   setPdfUrl(null);
setPdfError("");
setPdfLoading(true);
setPdfProgress(5);

const progressTimer = setInterval(() => {
  setPdfProgress((prev) => {
    if (prev >= 92) return prev;
    return prev + Math.floor(Math.random() * 6) + 2;
  });
}, 700);

   const selectedRow = getSelectedBelgeTemsilci();

if (!selectedRow || !(selectedRow.adSoyad || "").trim()) {
  setPdfLoading(false);
  setPdfError(
    hasMultipleTemsilci
      ? "Lütfen atama formu için bir temsilci seçin ve ad soyadını doldurun."
      : "Lütfen temsilci adını girin."
  );
  return;
}

if (normalizeTC(selectedRow.tc).length !== 11) {
  setPdfLoading(false);
  setPdfError("Seçilen temsilci için T.C. Kimlik No 11 hane olmalıdır.");
  return;
}

    if (!egitimBilgileri?.tarih) {
      setPdfLoading(false);
      setPdfError("Lütfen eğitim tarihini seçin.");
      return;
    }

    try {
      const payload = buildPayload([selectedRow], true);
    const blob = await postBlob("/calisan-temsilcisi/atama/pdf", payload);
const objectUrl = URL.createObjectURL(blob);

clearInterval(progressTimer);
setPdfProgress(100);
setPdfUrl(objectUrl);

setTimeout(() => {
  setPdfLoading(false);
}, 400);
    } catch (e) {
      console.error(e);
      setPdfError(e.message || "Atama formu PDF hazırlanamadı.");
    } finally {
  clearInterval(progressTimer);
}
  };

  const handleYeniSekmedeAc = () => {
    if (!pdfUrl) return;
    window.open(pdfUrl, "_blank", "noopener,noreferrer");
  };

  const handleIndir = async () => {
    try {
      if (!pdfUrl) return;

      const isAtama = modalTip === "atama";
     const selectedRow = getSelectedBelgeTemsilci();

const personelAdSoyad = safeFile(
  selectedRow?.adSoyad || "CALISAN_TEMSILCISI"
);

      const tarihTR = isoToTR(egitimBilgileri.tarih) || new Date().toLocaleDateString("tr-TR");
      const short = isAtama ? "ATAMA" : "KATILIM";
      const fileName = `${personelAdSoyad} (CALISAN_TEMSILCISI-${short}-${tarihTR}).pdf`;

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
      console.error("Çalışan temsilcisi PDF indirme hatası:", e);
      openInfo("Hata", "PDF indirilemedi.");
    }
  };

  const handleBelgelerimeKaydet = async () => {
    if (!pdfUrl) return openInfo("Bilgilendirme", "Önce PDF oluşmalı.");
    if (!selectedFirm?.id) return openInfo("Bilgilendirme", "Firma seçili değil.");

    const selectedRow = getSelectedBelgeTemsilci();

if (!selectedRow || !(selectedRow.adSoyad || "").trim()) {
  return openInfo(
    "Bilgilendirme",
    hasMultipleTemsilci
      ? "Lütfen belge kaydı için bir temsilci seçin."
      : "Temsilci kaydı bulunamadı."
  );
}

    const targetISO = toIsoDate(egitimBilgileri.tarih);
    if (!targetISO) {
      return openInfo("Bilgilendirme", "Eğitim tarihi boş. Lütfen eğitim tarihini seçin.");
    }

    try {
      const raw = localStorage.getItem(EGITIM_DOCS_KEY);
      const egitimList = raw ? JSON.parse(raw) : [];

     const isAtama = modalTip === "atama";

const personelAdSoyad = safeFile(
  selectedRow?.adSoyad || "CALISAN_TEMSILCISI"
);

      const tarihTR = isoToTR(targetISO) || new Date().toLocaleDateString("tr-TR");
      const yil = Number((targetISO || "").slice(0, 4)) || new Date().getFullYear();
      const kategori = isAtama ? "Atama Formu" : "Eğitim Katılım Formu";
      const short = isAtama ? "ATAMA" : "KATILIM";

      const exists =
        Array.isArray(egitimList) &&
        egitimList.some((d) => {
          const docISO = toIsoDate(d?.tarihISO || d?.tarih || d?.createdAt);
          return (
            String(d?.firmaId) === String(selectedFirm.id) &&
            String(d?.belgeTuru || "") === "Çalışan Temsilcisi" &&
            String(d?.kategori || "") === String(kategori) &&
            String(d?.personelAdSoyad || d?.adSoyad || "").toLocaleUpperCase("tr-TR") ===
              String(personelAdSoyad).toLocaleUpperCase("tr-TR") &&
            docISO &&
            docISO === targetISO
          );
        });

      const doSave = async () => {
        const role = String(user?.role || "").toLowerCase();
        const isBireysel = role === "bireysel";

        const pickFirst = (...vals) => vals.find((v) => String(v || "").trim()) || "";
        const kisilerPdf =
          typeof readRiskKisilerForPdf === "function" ? readRiskKisilerForPdf() : {};

        const hazirlayanFinal = pickFirst(
          imzalar?.isgUzmaniAdi,
          kisilerPdf?.uzmanAdSoyad,
          kisilerPdf?.uzman,
          typeof getHazirlayanAdSoyad === "function" ? getHazirlayanAdSoyad() : "",
          user?.adSoyad,
          user?.name,
          user?.fullName
        )
          .toString()
          .trim();

        const fileName = `${personelAdSoyad} (CALISAN_TEMSILCISI-${short}-${tarihTR}).pdf`;
let uploadedFileUrl = "";
let uploadedAbsoluteUrl = "";
let serverSaved = false;

try {
  const token = getBearerToken(user) || "";

  const pdfBlob = await fetch(pdfUrl).then((r) => r.blob());
  const uploadForm = new FormData();
  uploadForm.append("file", pdfBlob, fileName);

            const uploadJson = await requestWithFallback(
              "/documents/upload-pdf",
              {
                method: "POST",
                headers: {
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: uploadForm,
              },
              "json"
            );

            uploadedFileUrl = uploadJson?.fileUrl || "";
            uploadedAbsoluteUrl = uploadJson?.absoluteUrl || "";

            const turText = isAtama
              ? "Çalışan Temsilcisi - Atama Formu"
              : "Çalışan Temsilcisi - Katılım Formu";

            try {
              await requestWithFallback(
                "/documents",
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                  },
                  body: JSON.stringify({
                    firmaId: String(selectedFirm.id),
                    firmaAdi: selectedFirm?.firmaAdi || "Firma",

                    category: "egitim",
                    subCategory: isAtama
                      ? "calisan-temsilcisi-atama"
                      : "calisan-temsilcisi-katilim",

                    title: isAtama
                      ? `${personelAdSoyad} - Çalışan Temsilcisi Atama Formu`
                      : `${personelAdSoyad} - Çalışan Temsilcisi Eğitim Katılım Formu`,

                    tur: turText,
                    kategori,
                    belgeTuru: "Çalışan Temsilcisi",

                    year: yil,
                    dateISO: targetISO,

                   personName: personelAdSoyad,
personelAdSoyad,
adSoyad: personelAdSoyad,

hazirlayan: hazirlayanFinal || "",
hazirlayanAdSoyad: hazirlayanFinal || "",
hazirlayanKisi: hazirlayanFinal || "",
olusturan: hazirlayanFinal || "",
olusturanAdSoyad: hazirlayanFinal || "",
preparedBy: hazirlayanFinal || "",
preparedByName: hazirlayanFinal || "",
createdByName: hazirlayanFinal || "",
userName: hazirlayanFinal || "",

// createdBy eski listeleme referansları için isim kalsın
createdBy: hazirlayanFinal || "",

createdByUserId:
  user?._id ||
  user?.id ||
  user?.adminId ||
  user?.createdByAdminId ||
  "",

status: "hazir",
durum: "Hazır",
fileUrl: uploadedFileUrl,
absoluteUrl: uploadedAbsoluteUrl,
fileName,
                  }),
                },
                "json"
              );

             serverSaved = true;

            } catch (saveErr) {
              console.error("Server belge kayıt hatası:", saveErr);
            }
                   } catch (e) {
            console.error("Server’a kaydedilemedi:", e);
          
        }

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

          hazirlayan: hazirlayanFinal || "",

          kategori,
          tur: isAtama ? "Çalışan Temsilcisi - Atama Formu" : "Çalışan Temsilcisi - Katılım Formu",
          belgeTuru: "Çalışan Temsilcisi",

          baslik: isAtama
            ? `${personelAdSoyad} - Çalışan Temsilcisi Atama Formu`
            : `${personelAdSoyad} - Çalışan Temsilcisi Eğitim Katılım Formu`,
          yil,
          durum: "Hazır",
          status: "hazir",

          tarih: targetISO,
          tarihISO: targetISO,

          dosyaTuru: "PDF",
          fileType: "PDF",
          fileUrl: uploadedFileUrl,
absoluteUrl: uploadedAbsoluteUrl,
          fileName,
          createdAt: new Date().toISOString(),
        };

      if (!serverSaved) {
  openInfo("Hata", "Belge server'a kaydedilemedi. Lütfen tekrar deneyin.");
  return;
}

       try {
  localStorage.setItem(DOCS_SYNC_KEY, String(Date.now()));
} catch {}

window.dispatchEvent(new Event(DOCS_SYNC_KEY));
window.dispatchEvent(new Event("ticari_docs_refresh"));

        openInfo("Bilgilendirme", "Belgelerim, Eğitim & Sertifikalar sekmesine kaydedildi ✅");
      };

      if (exists) {
        openConfirm({
          title: "Uyarı",
          message: `"${personelAdSoyad}" için "${kategori}" belgesi zaten kayıtlı.\nYine de kaydetmek ister misiniz?`,
          confirmText: "Yine de Kaydet",
          cancelText: "İptal",
          variant: "warning",
          onConfirm: () => {
            void doSave();
          },
        });
        return;
      }

      await doSave();
    } catch (e) {
      console.error("Belgelerime kaydet hata:", e);
      openInfo("Hata", "Belge kaydedilirken hata oluştu.");
    }
  };

  if (!selectedFirm) {
    return (
      <CardBox>
        <SectionTitle
          title="Çalışan Temsilcisi Eğitimi"
          subtitle="Devam etmek için lütfen sağ üstten bir firma seçiniz."
        />
      </CardBox>
    );
  }

  const thClass =
    "border px-2 py-2 text-center align-middle whitespace-nowrap text-[11px] sm:text-xs";
  const tdCenter =
    "border px-1 sm:px-2 py-1 text-center align-middle";
  const tdCell =
    "border px-1 sm:px-2 py-1 align-middle";
  const inputBase =
    "w-full min-w-0 h-9 sm:h-11 rounded-lg border border-gray-300 bg-white px-2 sm:px-3 text-[11px] sm:text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30";
  const inputCenter = `${inputBase} text-center`;

  return (
    <>
      <style>{hideModalHeaderCloseStyle}</style>

      <CardBox className="flex flex-col gap-4">
        <SectionTitle
          title="Çalışan Temsilcisi Eğitimi – Katılım ve Atama"
          subtitle="Toplam çalışan sayısına göre temsilci sayısı otomatik hesaplanır; eğitim katılım ve atama formları buradan hazırlanır."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <label className="mb-1 block text-xs text-slate-500">Firma Adı</label>
            <input
              readOnly
              value={selectedFirm.firmaAdi || ""}
              className={`${readonlyInputClass} min-w-0 h-11 text-sm`}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-500">Toplam Çalışan Sayısı</label>
            <input
              type="number"
              min="0"
              className={`${editableInputClass} min-w-0 h-11 text-sm`}
              value={calisanSayisi}
              onChange={(e) => handleCalisanSayisiChange(e.target.value)}
            />
            {onerilenTemsilci > 0 && (
              <p className="mt-1 text-[11px] text-emerald-700">
                Önerilen çalışan temsilcisi sayısı:{" "}
                <span className="font-semibold">{onerilenTemsilci}</span>
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-500">Tehlike Sınıfı</label>
            <input
              readOnly
              value={selectedFirm.tehlike || ""}
              className={`${readonlyInputClass} min-w-0 h-11 text-sm`}
            />
          </div>
        </div>

        <div className="border rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold text-[#0a2b45]">Eğitim Bilgileri</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div>
              <label className="mb-1 block text-xs text-slate-500">Eğitim Tarihi</label>
              <input
                type="date"
                className="w-full min-w-0 h-11 rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-800 [color-scheme:light]"
                style={{ WebkitAppearance: "none", appearance: "none" }}
                value={egitimBilgileri.tarih}
                onChange={(e) => handleEgitimChange("tarih", e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-500">Eğitim Yeri</label>
              <input
                type="text"
                className={`${editableInputClass} min-w-0 h-11 text-sm`}
                value={egitimBilgileri.yer}
                onChange={(e) => handleEgitimChange("yer", e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-500">Eğitim Süresi (Saat)</label>
              <input
                type="number"
                min="1"
                className={`${editableInputClass} min-w-0 h-11 text-sm`}
                value={egitimBilgileri.saat}
                onChange={(e) => handleEgitimChange("saat", e.target.value)}
              />
            </div>
          </div>

          <div className="text-[11px] sm:text-xs text-slate-600 pt-1 leading-6">
            Konular: (a) Çalışan Temsilcisini Görev Ve Sorumlulukları • (b) İSG Temel Kavramları •
            (c) Ulusal Mevzuat ve Standartlar • (d) Acil Durum Önlemleri • (e) Risk Değerlendirmesi
          </div>
        </div>

        <div className="border rounded-lg p-3 bg-slate-50 text-[11px] sm:text-xs text-slate-700 leading-6">
          Risk değerlendirme prosedüründe kayıtlı çalışan temsilcisi:{" "}
          <span className="font-semibold">
            {riskTemsilci ? riskTemsilci : "Kayıt bulunamadı"}
          </span>
          . Bu eğitim formunda seçilen <span className="font-semibold">baş çalışan temsilcisi</span>{" "}
          isterseniz prosedürde de otomatik güncellenecektir.
        </div>

        <div className="border rounded-lg p-4 space-y-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h3 className="text-sm font-semibold text-[#0a2b45]">Çalışan Temsilcisi Listesi</h3>

            <button
              type="button"
              onClick={satirEkle}
              className="w-full md:w-auto px-3 py-2 text-[11px] rounded border border-slate-300 bg-slate-50 hover:bg-slate-100"
            >
              + Yeni Temsilci Satırı Ekle
            </button>
          </div>

          <div className="w-full overflow-x-auto max-h-80 overflow-y-auto">
           <table className="w-full min-w-[1000px] text-xs border table-fixed">
  <thead className="bg-slate-100">
    <tr>
      {hasMultipleTemsilci && (
        <th className={`${thClass} w-[64px]`}>Seç</th>
      )}
      <th className={`${thClass} w-[56px]`}>No</th>
      <th className={`${thClass} w-[160px] sm:w-[190px]`}>T.C. Kimlik No</th>
      <th className={`${thClass} w-[190px] sm:w-[240px]`}>Adı Soyadı</th>
      <th className={`${thClass} w-[150px] sm:w-[190px]`}>Görevi</th>
      <th className={`${thClass} w-[90px] sm:w-[120px]`}>Baş Temsilci</th>
<th className={`${thClass} w-[130px]`}>Personel İmzası</th>
    </tr>
  </thead>

              <tbody>
                {katilimcilar.map((k, index) => (
                  <tr key={index}>
  {hasMultipleTemsilci && (
    <td className={tdCenter}>
     <input
  type="checkbox"
  checked={belgeTemsilciIndex === index}
  onChange={() => setBelgeTemsilciIndex(index)}
/>
    </td>
  )}

  <td className={tdCenter}>
    <span className="font-medium">{k.no}</span>
  </td>

                    <td className={tdCell}>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={11}
                        className={inputCenter}
                        value={k.tc || ""}
                        placeholder="11 hane"
                        onChange={(e) => handleKatilimciChange(index, "tc", e.target.value)}
                      />
                    </td>

                    <td className={tdCell}>
                      <input
                        type="text"
                        className={inputCenter}
                        value={k.adSoyad || ""}
                        placeholder="AD SOYAD"
                        onChange={(e) => handleKatilimciChange(index, "adSoyad", e.target.value)}
                      />
                    </td>

                    <td className={tdCell}>
                      <input
                        type="text"
                        className={inputCenter}
                        value={k.gorev || ""}
                        placeholder="GÖREV"
                        onChange={(e) => handleKatilimciChange(index, "gorev", e.target.value)}
                      />
                    </td>

                    <td className={tdCenter}>
  <input
    type="radio"
    name="bas-temsilci"
    checked={basTemsilciIndex === index}
    onChange={() => setBasTemsilciIndex(index)}
  />
</td>

<td className={tdCenter}>
  {basTemsilciIndex === index ? (
    <span className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-500">
      Prosedürden gelir
    </span>
  ) : (
    <button
      type="button"
      onClick={() => openSignatureModal(index)}
      className={signatureButtonClass(k)}
    >
      İmza {getImzaProgress(k).text}
    </button>
  )}
</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <PrimaryButton
              size="sm"
              variant="green"
              onClick={handleKaydet}
              className="w-full sm:w-auto"
            >
              Bilgileri Kaydet
            </PrimaryButton>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 pt-2 border-t border-slate-200">
          <PrimaryButton
            size="sm"
            onClick={handleKatilimFormu}
            className="w-full sm:w-auto"
          >
            Eğitim Katılım Formu Hazırla
          </PrimaryButton>

          <PrimaryButton
            size="sm"
            onClick={handleAtamaFormu}
            className="w-full sm:w-auto"
          >
            Atama Formu Hazırla
          </PrimaryButton>
        </div>
      </CardBox>

      <Modal
  isOpen={modalOpen}
  onClose={closeModal}
  title={
    modalTip === "katilim"
      ? "Çalışan Temsilcisi Eğitim Katılım Formu"
      : modalTip === "atama"
      ? "Çalışan Temsilcisi Atama Formu"
      : "Önizleme"
  }
  headerActions={
    modalTip === "katilim" || modalTip === "atama" ? (
      <div className="flex flex-col gap-1 w-full sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
        <button
          type="button"
          onClick={handleYeniSekmedeAc}
          disabled={!pdfUrl || pdfLoading}
          className="w-full sm:w-auto px-2 py-1 text-[10px] sm:text-xs rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Yeni sekmede aç
        </button>

        <PrimaryButton
          size="sm"
          onClick={handleIndir}
          disabled={!pdfUrl || pdfLoading}
          className="w-full sm:w-auto px-2 py-1 text-[10px] sm:text-xs"
        >
          İndir (PDF)
        </PrimaryButton>

        <PrimaryButton
          size="sm"
          variant="green"
          onClick={handleBelgelerimeKaydet}
          disabled={!pdfUrl || pdfLoading}
          className="w-full sm:w-auto px-2 py-1 text-[10px] sm:text-xs"
        >
          Belgelerime Kaydet
        </PrimaryButton>
      </div>
    ) : null
  }
>
  {(modalTip === "katilim" || modalTip === "atama") && (
    <>
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

      {!pdfLoading && pdfError && (
        <div className="w-full h-[50vh] sm:h-[60vh] flex flex-col items-center justify-center text-sm text-gray-700 gap-2">
          <div className="font-semibold text-red-600">PDF üretilemedi</div>
          <div className="text-xs text-slate-600 text-center max-w-md">{pdfError}</div>

          <PrimaryButton
            size="sm"
            onClick={modalTip === "atama" ? handleAtamaFormu : handleKatilimFormu}
          >
            Tekrar Dene
          </PrimaryButton>
        </div>
      )}

      {!pdfLoading && !pdfError && pdfUrl && (
        <iframe
          key={pdfUrl}
          title="PDF Önizleme"
          src={pdfUrl}
          className="w-full h-[50vh] sm:h-[60vh] border border-gray-200 rounded"
        />
      )}

      {!pdfLoading && !pdfError && !pdfUrl && (
        <div className="w-full h-[50vh] sm:h-[60vh] flex items-center justify-center text-sm text-gray-600">
          Önizleme hazırlanıyor...
        </div>
      )}
    </>
  )}
</Modal>

<Modal isOpen={signatureModalOpen} onClose={closeSignatureModal} title="Personel İmzası">
  <div className="flex flex-col gap-4">
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs sm:text-sm text-slate-700">
      <div>
        <strong>Personel:</strong> {getCurrentSignatureRow()?.adSoyad || "-"}
      </div>
      <div className="mt-1">
        <strong>Görev / Ekip:</strong> {getCurrentSignatureRow()?.gorev || "-"}
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
            Buraya personel imzasını çiziniz.
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