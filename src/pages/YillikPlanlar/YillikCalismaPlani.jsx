import React, { useContext, useEffect, useMemo, useState } from "react";
import { SectionTitle, CardBox, PrimaryButton, Modal } from "../../components/ui";
import { FirmaContext } from "../../context/FirmaContext";
import axios from "axios";
import ConfirmModal from "../../components/ui/ConfirmModal";

/* ------------ yardımcılar ------------ */

const DOCS_SYNC_KEY = "docs:lastChangeAt";

const toTRDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("tr-TR");
};

const sanitizeFileName = (name) => {
  if (!name) return "YillikCalismaPlani";
  return String(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "_")
    .replace(/^_+|_+$/g, "");
};

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
      (typeof window !== "undefined" && localStorage.getItem("token")) ||
      (typeof window !== "undefined" && localStorage.getItem("jwt")) ||
      (typeof window !== "undefined" && localStorage.getItem("accessToken")) ||
      (typeof window !== "undefined" && localStorage.getItem("authToken")) ||
      (typeof window !== "undefined" && sessionStorage.getItem("token")) ||
      (typeof window !== "undefined" && sessionStorage.getItem("jwt")) ||
      (typeof window !== "undefined" && sessionStorage.getItem("accessToken")) ||
      (typeof window !== "undefined" && sessionStorage.getItem("authToken"));

    if (direct) return direct;

    const fromUser =
      userObj?.token ||
      userObj?.accessToken ||
      userObj?.jwt ||
      userObj?.authToken;

    if (fromUser) return fromUser;

    const activeEmail =
      (typeof window !== "undefined" && localStorage.getItem("__isg_active_email_global")) || "";

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
  return null;
}

const MONTHS = [
  { key: "ocak", label: "Ocak" },
  { key: "subat", label: "Şubat" },
  { key: "mart", label: "Mart" },
  { key: "nisan", label: "Nisan" },
  { key: "mayis", label: "Mayıs" },
  { key: "haziran", label: "Haziran" },
  { key: "temmuz", label: "Temmuz" },
  { key: "agustos", label: "Ağustos" },
  { key: "eylul", label: "Eylül" },
  { key: "ekim", label: "Ekim" },
  { key: "kasim", label: "Kasım" },
  { key: "aralik", label: "Aralık" },
];

const DEFAULT_ACTIVITIES = [
  "Saha denetimi yapılması",
  "İSG kurul toplantılarının yapılması",
  "Çalışan temsilcisi seçimi ve eğitimi",
  "Risk analizi gözden geçirme",
  "Acil eylem planının gözden geçirilmesi",
  "İşe giriş periyodik raporlarının hazırlanması",
  "Tetanoz",
  "Eğitim - Sağlık konuları",
  "Eğitim - Genel konular",
  "Eğitim - Teknik konular",
  "Temel ilkyardım eğitimi (ilkyardımcı eğitimi)",
  "Hijyen eğitimi",
  "Kişisel koruyucu donanımın takibi",
  "Yangın tüplerinin kontrolü",
  "Topraklama / paratoner yıllık kontrolü",
  "Kaldırma araçlarının yıllık kontrolü",
  "Basınçlı kapların yıllık kontrolü",
  "Havalandırma periyodik test ve kontrolü",
  "Yemekhane kontrolünün yapılması",
  "MSDS (malzeme güvenlik bilgi formu) kontrolü",
  "İSG dosyasının kontrolü",
  "Özlük dosyalarının kontrolü",
  "Yıllık değerlendirme raporlarının hazırlanması",
  "Yangın ekiplerinin oluşturulması",
  "İş güvenliği ile ilgili yazılmış tüm talimatlar",
  "Acil durum ekiplerinin eğitimi",
];

const createEmptyRow = (name = "") => {
  const months = {};
  MONTHS.forEach((m) => (months[m.key] = ""));
  return { id: Date.now() + Math.random(), name, months };
};

const getMonthIndexFromDate = (value) => {
  if (!value) return 0;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 0;
  return d.getMonth();
};

const patternFn = {
  every: () => true,
  quarter: (i) => i % 3 === 0,
  half: (i) => i % 6 === 0,
  once: (i) => i === 0,
};

const formatActivityName = (text) => {
  if (!text) return "";
  return text
    .split(" ")
    .map((word) => {
      if (!word) return word;
      if (word === word.toUpperCase()) return word;
      const first = word[0].toLocaleUpperCase("tr-TR");
      const rest = word.slice(1).toLocaleLowerCase("tr-TR");
      return first + rest;
    })
    .join(" ");
};

const CellIcon = ({ val }) => {
  if (val === "+") {
    return (
      <svg viewBox="0 0 24 24" className="w-3 h-3" aria-hidden="true">
        <path
          d="M12 5v14M5 12h14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (val === "-") {
    return (
      <svg viewBox="0 0 24 24" className="w-3 h-3" aria-hidden="true">
        <path
          d="M5 12h14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return null;
};

export default function YillikCalismaPlani() {
  const { selectedFirm } = useContext(FirmaContext);

  const API_BASE =
  (import.meta.env.VITE_API_URL || "").trim().replace(/\/$/, "") ||
  "https://api.isgpanel.tr/api";

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

  const kisisel = useMemo(() => safeParseLS("kisiselBilgiler"), []);
  const hekimLS = useMemo(() => safeParseLS("hekimBilgileri"), []);
  const isverenLS = useMemo(() => safeParseLS("isverenBilgileri"), []);
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

  const [kurumsal, setKurumsal] = useState(() => safeParseLS("kurumsalBilgiler"));

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "kurumsalBilgiler") {
        setKurumsal(safeParseLS("kurumsalBilgiler"));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const currentYear = new Date().getFullYear();
const firmId = selectedFirm?.id || selectedFirm?._id || "";
const PLAN_DOC_TYPE = "yillik-calisma-plani";

  const [planYear, setPlanYear] = useState(currentYear);
  const [startDate, setStartDate] = useState("");

  const [monthMode, setMonthMode] = useState("fromStart");
  const [customMonths, setCustomMonths] = useState(MONTHS.map((m) => m.key));

  const [activities, setActivities] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const [loading, setLoading] = useState(false);
const [pdfProgress, setPdfProgress] = useState(0);
const [show, setShow] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [downloadName, setDownloadName] = useState("YillikCalismaPlani.pdf");
  const [saving, setSaving] = useState(false);

 
  const firmKey = `risk_prosedur_kisiler_${firmId ?? "default"}`;

    const [prosedurKisiler, setProsedurKisiler] = useState({
    isveren: "",
    hekim: "",
    uzman: "",
  });

  const [prosedurImzalar, setProsedurImzalar] = useState({
    isveren: { imza: null, paraf: null },
    uzman: { imza: null, paraf: null },
    hekim: { imza: null, paraf: null },
  });

  const pickFirst = (...vals) => vals.find((v) => String(v || "").trim()) || "";
  const hasAny = (obj) => Object.values(obj || {}).some((x) => String(x || "").trim());

    const fetchKisiler = async () => {
    if (!firmId) return null;

    const token = getAuthToken(user);
    if (!token) return null;

    try {
      const r = await axios.get(`${API_BASE}/firma/${firmId}/kisiler`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const k = r.data || {};
      const next = {
        isveren: pickFirst(
          k?.isveren,
          k?.isverenAdSoyad,
          k?.isverenVekiliAdSoyad,
          k?.isverenVekili
        ),
        uzman: pickFirst(
          k?.uzman,
          k?.isgUzmaniAdSoyad,
          k?.isgUzmaniAdiSoyadi
        ),
        hekim: pickFirst(
          k?.hekim,
          k?.isyeriHekimiAdSoyad,
          k?.isyeriHekimiAdiSoyadi
        ),
      };

      if (hasAny(next)) {
        try {
          const imzaRes = await axios.get(`${API_BASE}/firma/${firmId}/imzalar`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          const imzaData = imzaRes.data || {};

          setProsedurImzalar({
            isveren: imzaData?.isveren || { imza: null, paraf: null },
            uzman: imzaData?.uzman || { imza: null, paraf: null },
            hekim: imzaData?.hekim || { imza: null, paraf: null },
          });
        } catch (e) {
          console.error("İmza çekilemedi:", e);
          setProsedurImzalar({
            isveren: { imza: null, paraf: null },
            uzman: { imza: null, paraf: null },
            hekim: { imza: null, paraf: null },
          });
        }

        return next;
      }
    } catch (e) {
      console.log("[YCP] firma/kisiler hata:", e?.response?.status, e?.response?.data || e?.message);
    }

    try {
      const r2 = await axios.get(`${API_BASE}/profile/personal`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const p = r2.data || {};
      const next = {
        isveren: pickFirst(p?.isverenVekiliAdSoyad, p?.isverenAdSoyad, p?.isveren),
        uzman: pickFirst(p?.isgUzmaniAdSoyad, p?.uzmanAdSoyad, p?.isgUzmani),
        hekim: pickFirst(p?.isyeriHekimiAdSoyad, p?.isyeriHekimi, p?.hekimAdSoyad),
      };

      if (hasAny(next)) return next;
    } catch (e) {
      console.log("[YCP] profile/personal hata:", e?.response?.status, e?.response?.data || e?.message);
    }

    try {
      const raw = localStorage.getItem(firmKey);
      const saved = raw ? JSON.parse(raw) : null;
      if (saved && typeof saved === "object") {
        const next = {
          isveren: pickFirst(
            saved?.isveren,
            saved?.isverenAdSoyad,
            saved?.isverenVekiliAdSoyad,
            saved?.isverenVekili
          ),
          uzman: pickFirst(saved?.uzman, saved?.isgUzmaniAdSoyad),
          hekim: pickFirst(saved?.hekim, saved?.isyeriHekimiAdSoyad),
        };
        if (hasAny(next)) return next;
      }
    } catch {}

    return null;
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      const next = await fetchKisiler();
      if (!alive) return;
      if (next) setProsedurKisiler(next);
    })();
    return () => {
      alive = false;
    };
  }, [API_BASE, firmId, firmKey]);

  useEffect(() => {
    return () => {
      try {
        if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      } catch {}
    };
  }, [pdfUrl]);

const savePlanFormToServer = async (nextState = {}) => {
  if (!firmId) return;

  try {
    const token = getAuthToken(user);

    await fetch(`${API_BASE}/yillik-calisma-plani/form/${firmId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        firmaId: String(firmId),
        firmaAdi: selectedFirm?.firmaAdi || "",
        type: PLAN_DOC_TYPE,
        planYear: nextState.planYear ?? planYear ?? currentYear,
        startDate: nextState.startDate ?? startDate ?? "",
        monthMode: nextState.monthMode ?? monthMode ?? "fromStart",
        customMonths: nextState.customMonths ?? customMonths ?? MONTHS.map((m) => m.key),
        activities: (nextState.activities ?? activities ?? []).map((row) => ({
          id: String(row?.id || `${Date.now()}_${Math.random()}`),
          name: row?.name || "",
          months: row?.months || {},
        })),
      }),
    });

    try {
      localStorage.setItem(DOCS_SYNC_KEY, String(Date.now()));
    } catch {}

    window.dispatchEvent(new Event(DOCS_SYNC_KEY));
  } catch (e) {
    console.error("Yıllık çalışma planı servera kaydedilemedi:", e);
  }
};

const loadPlanFormFromServer = async () => {
  if (!firmId) {
    setActivities(DEFAULT_ACTIVITIES.map((name) => createEmptyRow(name)));
    setLoaded(true);
    return;
  }

  try {
    const token = getAuthToken(user);

    const res = await fetch(`${API_BASE}/yillik-calisma-plani/form/${firmId}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!res.ok) {
      setActivities(DEFAULT_ACTIVITIES.map((name) => createEmptyRow(name)));
      setLoaded(true);
      return;
    }

    const data = await res.json();
    const form = data?.form || null;

    if (!form) {
      setActivities(DEFAULT_ACTIVITIES.map((name) => createEmptyRow(name)));
      setLoaded(true);
      return;
    }

    const serverActivities = Array.isArray(form?.activities) ? form.activities : [];

    setActivities(
      serverActivities.length
        ? serverActivities.map((row) => ({
            id: row?.id || Date.now() + Math.random(),
            name: row?.name || "",
            months: row?.months || {},
          }))
        : DEFAULT_ACTIVITIES.map((name) => createEmptyRow(name))
    );

    setPlanYear(Number(form?.planYear || currentYear));
    setMonthMode(form?.monthMode || "fromStart");
    setCustomMonths(
      Array.isArray(form?.customMonths) && form.customMonths.length
        ? form.customMonths
        : MONTHS.map((m) => m.key)
    );
    setStartDate(form?.startDate || "");
  } catch (e) {
    console.error("Yıllık çalışma planı serverdan okunamadı:", e);
    setActivities(DEFAULT_ACTIVITIES.map((name) => createEmptyRow(name)));
  } finally {
    setLoaded(true);
  }
};

  const readonlyInputClass =
    "w-full min-w-0 h-11 rounded-lg border border-gray-300 bg-slate-50 px-4 text-sm text-gray-800";
  const editableInputClass =
    "w-full min-w-0 h-11 rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 [color-scheme:light]";

  useEffect(() => {
  loadPlanFormFromServer();
}, [API_BASE, firmId]);

useEffect(() => {
  if (!firmId) return;

  const syncReload = () => {
    loadPlanFormFromServer();
  };

  const onStorage = (e) => {
    if (e.key === DOCS_SYNC_KEY) {
      loadPlanFormFromServer();
    }
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      loadPlanFormFromServer();
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
}, [firmId, API_BASE]);

  const isMonthActive = (monthKey) => {
    if (monthMode === "full") return true;

    if (monthMode === "fromStart") {
      if (!startDate) return true;
      const startIdx = getMonthIndexFromDate(startDate);
      const idx = MONTHS.findIndex((m) => m.key === monthKey);
      if (idx === -1) return true;
      return idx >= startIdx;
    }

    if (monthMode === "custom") {
      return customMonths.includes(monthKey);
    }

    return true;
  };

  const handleToggleCell = (rowId, monthKey) => {
  setActivities((prev) => {
    const updated = prev.map((row) => {
      if (row.id !== rowId) return row;
      const current = row.months?.[monthKey] || "";
      let next = "";
      if (current === "") next = "+";
      else if (current === "+") next = "-";
      else next = "";
      return { ...row, months: { ...row.months, [monthKey]: next } };
    });

    void savePlanFormToServer({ activities: updated });
    return updated;
  });
};

  const handleAddRow = () => {
  setActivities((prev) => {
    const updated = [...prev, createEmptyRow("")];
    void savePlanFormToServer({ activities: updated });
    return updated;
  });
};

 const handleRemoveRow = (rowId) => {
  openConfirm({
    title: "Uyarı",
    message: "Bu satırı silmek istediğinize emin misiniz?",
    confirmText: "Sil",
    cancelText: "İptal",
    variant: "warning",
    onConfirm: () =>
      setActivities((prev) => {
        const updated = prev.filter((r) => r.id !== rowId);
        void savePlanFormToServer({ activities: updated });
        return updated;
      }),
  });
};

 const handleChangeRowName = (rowId, value) => {
  const formatted = formatActivityName(value);
  setActivities((prev) => {
    const updated = prev.map((row) =>
      row.id === rowId ? { ...row, name: formatted } : row
    );
    void savePlanFormToServer({ activities: updated });
    return updated;
  });
};

  const applyPatternToRow = (rowId, patternKey) => {
  const fn = patternFn[patternKey];
  if (!fn) return;

  setActivities((prev) => {
    const updated = prev.map((row) => {
      if (row.id !== rowId) return row;

      const newMonths = { ...row.months };
      const activeMonthKeys = MONTHS.filter((m) => isMonthActive(m.key)).map((m) => m.key);

      let isPlusPattern = true;
      let isMinusPattern = true;

      activeMonthKeys.forEach((key, idx) => {
        const expectedActive = fn(idx);
        const cur = newMonths[key] || "";

        if (expectedActive) {
          if (cur !== "+") isPlusPattern = false;
        } else if (cur !== "") {
          isPlusPattern = false;
        }

        if (expectedActive) {
          if (cur !== "-") isMinusPattern = false;
        } else if (cur !== "") {
          isMinusPattern = false;
        }
      });

      if (!isPlusPattern && !isMinusPattern) {
        activeMonthKeys.forEach((key, idx) => (newMonths[key] = fn(idx) ? "+" : ""));
      } else if (isPlusPattern) {
        activeMonthKeys.forEach((key, idx) => (newMonths[key] = fn(idx) ? "-" : ""));
      } else if (isMinusPattern) {
        activeMonthKeys.forEach((key) => (newMonths[key] = ""));
      }

      return { ...row, months: newMonths };
    });

    void savePlanFormToServer({ activities: updated });
    return updated;
  });
};

 const clearRow = (rowId) => {
  setActivities((prev) => {
    const updated = prev.map((row) => {
      if (row.id !== rowId) return row;
      const newMonths = { ...row.months };
      const activeMonthKeys = MONTHS.filter((m) => isMonthActive(m.key)).map((m) => m.key);
      activeMonthKeys.forEach((key) => (newMonths[key] = ""));
      return { ...row, months: newMonths };
    });

    void savePlanFormToServer({ activities: updated });
    return updated;
  });
};

const buildFinalLogo = async () => {
  try {
    const directBase64 =
      (typeof kurumsal?.logoBase64 === "string" && kurumsal.logoBase64.startsWith("data:image") && kurumsal.logoBase64) ||
      (typeof kurumsal?.logoData === "string" && kurumsal.logoData.startsWith("data:image") && kurumsal.logoData) ||
      (typeof kurumsal?.logo === "string" && kurumsal.logo.startsWith("data:image") && kurumsal.logo) ||
      (typeof selectedFirm?.logoBase64 === "string" && selectedFirm.logoBase64.startsWith("data:image") && selectedFirm.logoBase64) ||
      (typeof selectedFirm?.logoData === "string" && selectedFirm.logoData.startsWith("data:image") && selectedFirm.logoData) ||
      (typeof selectedFirm?.logo === "string" && selectedFirm.logo.startsWith("data:image") && selectedFirm.logo);

    if (directBase64) return directBase64;

    const rawLogoUrl =
      kurumsal?.logoUrl ||
      kurumsal?.logoPath ||
      kurumsal?.kurumsalLogo ||
      (typeof kurumsal?.logo === "string" && !kurumsal.logo.startsWith("data:image") ? kurumsal.logo : "") ||
      selectedFirm?.logoUrl ||
      selectedFirm?.kurumsalLogo ||
      (typeof selectedFirm?.logo === "string" && !selectedFirm.logo.startsWith("data:image") ? selectedFirm.logo : "") ||
      "";

    if (!rawLogoUrl) return "";

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

    const absoluteLogoUrl = toAbsoluteUrl(rawLogoUrl);
    if (!absoluteLogoUrl) return "";

    const tokenValue = getAuthToken(user);

    const res = await fetch(absoluteLogoUrl, {
      headers: tokenValue ? { Authorization: `Bearer ${tokenValue}` } : {},
    });

    if (!res.ok) {
      console.error("YÇP logo fetch başarısız:", absoluteLogoUrl, res.status);
      return "";
    }

    const blob = await res.blob();

    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result || ""));
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.error("YÇP logo hazırlanamadı:", e);
    return "";
  }
};  


  const handlePreparePdf = async () => {
    if (!selectedFirm) {
      openInfo("Bilgilendirme", "Lütfen önce bir firma seçiniz.");
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

      const endDate = `${planYear}-12-31`;

      let kisiler = prosedurKisiler;
      if (!String(kisiler?.hekim || "").trim() || !String(kisiler?.isveren || "").trim()) {
        const fresh = await fetchKisiler();
        if (fresh) {
          kisiler = fresh;
          setProsedurKisiler(fresh);
        }
      }

      const isgAdSoyad =
        pickFirst(
          kisiler?.uzman,
          kisisel?.adSoyad,
          `${kisisel?.ad || ""} ${kisisel?.soyad || ""}`.trim()
        ) || "İSG Uzmanı";

      const hekimAdSoyad = pickFirst(
        kisiler?.hekim,
        hekimLS?.adSoyad,
        hekimLS?.isyeriHekimiAdSoyad,
        hekimLS?.isyeriHekimiAdiSoyadi,
        hekimLS?.hekimAdSoyad,
        `${hekimLS?.ad || ""} ${hekimLS?.soyad || ""}`.trim()
      );

      const isverenAdSoyad = pickFirst(
        kisiler?.isveren,
        isverenLS?.adSoyad,
        isverenLS?.isverenAdSoyad,
        isverenLS?.isverenVekiliAdSoyad,
        isverenLS?.isverenVekili,
        `${isverenLS?.ad || ""} ${isverenLS?.soyad || ""}`.trim()
      );

      const finalLogo = await buildFinalLogo();

      const payload = {
        firmaId: String(selectedFirm?.id || selectedFirm?._id || ""),
        kurumsal: { logoUrl: finalLogo || "", logo: finalLogo || "" },
        firma: {
          firmaAdi: selectedFirm?.firmaAdi || "",
          sgkSicilNo: selectedFirm?.sgkSicilNo || "",
          adres: selectedFirm?.adres || "",
          tehlikeSinifi: selectedFirm?.tehlike || selectedFirm?.tehlikeSinifi || "",
        },
        plan: {
          yil: planYear,
          baslangicTarihi: startDate,
          bitisTarihi: endDate,
          monthMode,
          customMonths,
          months: MONTHS,
          activities,
        },
        imzalar: {
  isveren: {
    imza: prosedurImzalar?.isveren?.imza || null,
    paraf: prosedurImzalar?.isveren?.paraf || null,
    signerName: isverenAdSoyad || "",
  },
  uzman: {
    imza: prosedurImzalar?.uzman?.imza || null,
    paraf: prosedurImzalar?.uzman?.paraf || null,
    signerName: isgAdSoyad || "",
  },
  hekim: {
    imza: prosedurImzalar?.hekim?.imza || null,
    paraf: prosedurImzalar?.hekim?.paraf || null,
    signerName: hekimAdSoyad || "",
  },
},
        prosedurKisiBilgileri: {
  isgUzmaniAdi: isgAdSoyad || "",
  isyeriHekimiAdi: hekimAdSoyad || "",
  isverenAdi: isverenAdSoyad || "",

  sertifikaNo:
    kisisel?.sertifikaNo ||
    kisisel?.sertifika_no ||
    "",

  sertifikaSinifi:
    kisisel?.sertifikaSinifi ||
    kisisel?.sertifika_sinifi ||
    "",

  hekimSertifikaNo:
    hekimLS?.hekimSertifikaNo ||
    hekimLS?.sertifikaNo ||
    hekimLS?.sertifika_no ||
    "",
},
       kisiler: {
  uzman: isgAdSoyad || "",
  hekim: hekimAdSoyad || "",
  isveren: isverenAdSoyad || "",

  uzmanSertifikaNo:
    kisisel?.sertifikaNo ||
    kisisel?.sertifika_no ||
    "",

  uzmanlikSinifi:
    kisisel?.sertifikaSinifi ||
    kisisel?.sertifika_sinifi ||
    "",

  hekimSertifikaNo:
    hekimLS?.hekimSertifikaNo ||
    hekimLS?.sertifikaNo ||
    hekimLS?.sertifika_no ||
    "",
},
        olusturan:
          (kisisel?.adSoyad && `${kisisel.adSoyad}`) ||
          (user?.ad && `${user.ad}`) ||
          "İSG Uzmanı",
      };

      const token = getAuthToken(user);

     const res = await fetch(`${API_BASE}/yillik-calisma-plani/pdf`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  },
  body: JSON.stringify(payload),
});

     if (!res.ok) {
  clearInterval(progressTimer);
  setLoading(false);
  setPdfProgress(0);
  setShow(false);

  const text = await res.text();
  console.error("Yıllık plan PDF hatası:", text);
  openInfo("Hata", "PDF hazırlanırken bir hata oluştu. Lütfen daha sonra tekrar deneyin.");
  return;
}

      const blob = await res.blob();
const objectUrl = URL.createObjectURL(blob);

clearInterval(progressTimer);
setPdfProgress(100);
setPdfUrl(objectUrl);

      const tarihTr = new Date().toLocaleDateString("tr-TR");
      setDownloadName(`${sanitizeFileName(selectedFirm.firmaAdi)} (YÇP-${planYear}-${tarihTr}).pdf`);

      setTimeout(() => {
  setLoading(false);
}, 400);

   } catch (e) {
  clearInterval(progressTimer);
  setLoading(false);
  setPdfProgress(0);
  setShow(false);

  console.error("Yıllık plan PDF hazırlanamadı:", e);
  openInfo("Hata", "PDF hazırlanırken beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.");
}
  };

  const handleYeniSekmedeAc = () => {
    if (!pdfUrl) return;
    window.open(pdfUrl, "_blank", "noopener,noreferrer");
  };

  const handleIndir = async () => {
    try {
      if (!pdfUrl) {
        openInfo("Bilgilendirme", 'Önce "Hazırla (PDF)" ile belgeyi oluştur.');
        return;
      }

      const res = await fetch(pdfUrl);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = downloadName || "YillikCalismaPlani.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(() => {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch {}
      }, 1500);
    } catch (e) {
      console.error("YÇP PDF indirme hatası:", e);
      openInfo("Hata", "PDF indirilemedi.");
    }
  };

  const saveToDocs = async () => {
    if (!pdfUrl) {
      openInfo("Bilgilendirme", 'Önce "Hazırla (PDF)" ile belgeyi oluştur.');
      return;
    }

    if (!selectedFirm?.id && !selectedFirm?._id) {
      openInfo("Bilgilendirme", "Geçerli bir firma seçili değil.");
      return;
    }

    const firmIdValue = selectedFirm?.id || selectedFirm?._id;
    const firmaAdi = selectedFirm.firmaAdi || "Firma";
    const yil = planYear || new Date().getFullYear();
    const tarihTr = new Date().toLocaleDateString("tr-TR");

    const olusturan =
      (kisisel?.adSoyad && `${kisisel.adSoyad}`) ||
      (user?.ad && `${user.ad}`) ||
      "İSG Uzmanı";

    const doSave = async () => {
      try {
        setSaving(true);

        const token = getAuthToken(user);
        if (!token) {
          openInfo("Hata", "Oturum bilgisi bulunamadı.");
          return;
        }

        const fileName = `${sanitizeFileName(firmaAdi)} (YÇP-${yil}-${tarihTr}).pdf`;
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
          const text = await uploadRes.text();
          console.error("YÇP pdf upload hata:", text);
          openInfo("Hata", "PDF dosyası sunucuya yüklenemedi.");
          return;
        }

        const uploadJson = await uploadRes.json();
        const uploadedFileUrl = uploadJson?.fileUrl || "";
        const uploadedAbsoluteUrl = uploadJson?.absoluteUrl || "";

        const payload = {
          firmaId: String(firmIdValue),
          firmaAdi,
          category: "yillik",
          subCategory: "yillik-calisma-plani",
          title: "Yıllık Çalışma Planı (YÇP)",
          year: yil,
          createdBy: olusturan,
          createdByUserId: user?._id || user?.id || user?.adminId || user?.createdByAdminId,
          hazirlayan: olusturan,
          personName: olusturan,
          belgeTuru: "YÇP",
          tarih: tarihTr,
          dosyaTuru: "PDF",
          status: "hazir",
          fileUrl: uploadedAbsoluteUrl || uploadedFileUrl,
          absoluteUrl: uploadedAbsoluteUrl || "",
          fileName,
        };

        const res = await fetch(`${API_BASE}/documents`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify(payload),
});

        if (!res.ok) {
          const text = await res.text();
          console.error("YÇP kayıt hatası:", text);
          openInfo("Hata", "Belge servera kaydedilemedi.");
          return;
        }

        await res.json().catch(() => null);

        try {
          localStorage.setItem(DOCS_SYNC_KEY, String(Date.now()));
        } catch {}

        window.dispatchEvent(new Event(DOCS_SYNC_KEY));

        setShow(false);
        openInfo("Bilgilendirme", "Belgelerim, Yıllık Planlar sekmesine kaydedildi ✅");
      } catch (e) {
        console.error("YÇP kaydedilemedi:", e);
        openInfo("Hata", "Belge kaydedilirken hata oluştu.");
      } finally {
        setSaving(false);
      }
    };

    openConfirm({
      title: "Onay",
      message: `${firmaAdi} için ${yil} yılına ait "Yıllık Çalışma Planı (YÇP)" kaydedilecektir.\n\nDevam etmek ister misiniz?`,
      confirmText: "Kaydet",
      cancelText: "İptal",
      variant: "warning",
      onConfirm: doSave,
    });
  };

  if (!selectedFirm) {
    return (
      <CardBox>
        <SectionTitle
          title="Yıllık Çalışma Planı"
          subtitle="Devam etmek için lütfen sağ üstten bir firma seçiniz."
        />
      </CardBox>
    );
  }

  return (
    <>
      <CardBox className="flex flex-col gap-4">
        <SectionTitle
          title="Yıllık Çalışma Planı"
          subtitle="Risk Değerlendirme Prosedürü referans görünümüne uyumlu şekilde yıllık çalışma planı hazırlayabilirsiniz."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <input
            readOnly
            value={selectedFirm?.firmaAdi || ""}
            className={`${readonlyInputClass} min-w-0 h-11 text-sm`}
            placeholder="Firma adı"
          />

          <input
            readOnly
            value={selectedFirm?.tehlike || selectedFirm?.tehlikeSinifi || ""}
            className={`${readonlyInputClass} min-w-0 h-11 text-sm`}
            placeholder="Tehlike sınıfı"
          />

          <input
            type="number"
            min="2020"
            max="2100"
            value={planYear}
            onChange={(e) => {
  const nextYear = Number(e.target.value || currentYear);
  setPlanYear(nextYear);
  void savePlanFormToServer({ planYear: nextYear });
}}
            className={`${readonlyInputClass} min-w-0 h-11 text-sm`}
            placeholder="Plan yılı"
          />

          <input
            type="date"
            value={startDate}
            onChange={(e) => {
  const nextDate = e.target.value;
  setStartDate(nextDate);
  void savePlanFormToServer({ startDate: nextDate });
}}
            className="w-full min-w-0 h-11 rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-800 [color-scheme:light]"
            style={{ WebkitAppearance: "none", appearance: "none" }}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-lg border border-slate-200 p-4">
            <div className="text-sm font-semibold text-slate-700 mb-3">Ay Gösterim Modu</div>

            <div className="flex flex-col gap-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="monthMode"
                  checked={monthMode === "full"}
                  onChange={() => {
  setMonthMode("full");
  void savePlanFormToServer({ monthMode: "full" });
}}
                />
                <span>Tüm aylar aktif</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="monthMode"
                  checked={monthMode === "fromStart"}
                  onChange={() => {
  setMonthMode("fromStart");
  void savePlanFormToServer({ monthMode: "fromStart" });
}}
                />
                <span>Başlangıç tarihinden itibaren aktif</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="monthMode"
                  checked={monthMode === "custom"}
                  onChange={() => {
  setMonthMode("custom");
  void savePlanFormToServer({ monthMode: "custom" });
}}
                />
                <span>Özel ay seçimi</span>
              </label>
            </div>

            {monthMode === "custom" && (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                {MONTHS.map((m) => (
                  <label key={m.key} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={customMonths.includes(m.key)}
                      onChange={(e) => {
  const checked = e.target.checked;
  setCustomMonths((prev) => {
    const updated = checked ? [...prev, m.key] : prev.filter((x) => x !== m.key);
    void savePlanFormToServer({ customMonths: updated });
    return updated;
  });
}}
                    />
                    <span>{m.label}</span>
                  </label>
                ))}
              </div>
            )}

            <p className="mt-2 text-[11px] text-slate-500">
              Seçilen aylar tabloda aktif olur. Hücreye tıklayarak boş → + → - → boş şeklinde geçiş yapılır.
            </p>
          </div>

          <div className="rounded-lg bg-slate-50 px-4 py-3 text-[12px] text-slate-600 border border-slate-200">
            <p>
              <span className="font-semibold">Açıklama:</span> Tabloda her faaliyet için ilgili aylara tıklayarak işaretleme yapabilirsiniz.
            </p>
            <p className="mt-1">
              <span className="font-semibold">Kısayollar:</span> Her ay / 3 ayda bir / 6 ayda bir / Yılda 1
              butonları aynı satıra hızlı pattern uygular.
            </p>
            <p className="mt-1">
              <span className="font-semibold">+</span>: Bu ay faaliyet planlandı &nbsp; | &nbsp;
              <span className="font-semibold">-</span>: Bu ay faaliyet yapılmayacak / gerekmiyor
            </p>
          </div>
        </div>

        <div className="mt-1 border border-slate-200 rounded-lg overflow-x-auto">
          <div className="max-h-[500px] overflow-y-auto">
            <table className="min-w-full text-[10px]">
              <thead className="bg-slate-100 sticky top-0 z-10">
                <tr>
                  <th className="px-2 py-2 border-b border-slate-200 text-left w-10">#</th>
                  <th className="px-3 py-2 border-b border-slate-200 text-left min-w-[260px]">Faaliyet</th>
                  {MONTHS.map((m) => (
                    <th key={m.key} className="px-1 py-2 border-b border-slate-200 text-center min-w-[52px]">
                      {m.label}
                    </th>
                  ))}
                  <th className="px-2 py-2 border-b border-slate-200 text-center min-w-[190px]">Kısayollar</th>
                  <th className="px-2 py-2 border-b border-slate-200 text-center w-16">Sil</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((row, index) => (
                  <tr key={row.id} className="odd:bg-white even:bg-slate-50/40">
                    <td className="px-2 py-2 border-b border-slate-200 align-top">{index + 1}</td>

                    <td className="px-3 py-2 border-b border-slate-200 align-top">
                      <input
                        value={row.name}
                        onChange={(e) => handleChangeRowName(row.id, e.target.value)}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      />
                    </td>

                    {MONTHS.map((m) => {
                      const active = isMonthActive(m.key);
                      const val = row.months?.[m.key] || "";
                      return (
                        <td key={m.key} className="px-1 py-2 border-b border-slate-200 text-center align-top">
                          <button
                            type="button"
                            disabled={!active}
                            onClick={() => handleToggleCell(row.id, m.key)}
                            className={`mx-auto flex items-center justify-center w-8 h-8 rounded-md border text-xs ${
                              !active
                                ? "bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed"
                                : "bg-white hover:bg-slate-50 border-slate-300 text-slate-700"
                            }`}
                          >
                            <CellIcon val={val} />
                          </button>
                        </td>
                      );
                    })}

                    <td className="px-2 py-2 border-b border-slate-200 text-center align-top">
                      <div className="flex flex-wrap items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => applyPatternToRow(row.id, "every")}
                          className="px-2 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-[10px]"
                        >
                          Her ay
                        </button>
                        <button
                          type="button"
                          onClick={() => applyPatternToRow(row.id, "quarter")}
                          className="px-2 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-[10px]"
                        >
                          3 ayda 1
                        </button>
                        <button
                          type="button"
                          onClick={() => applyPatternToRow(row.id, "half")}
                          className="px-2 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-[10px]"
                        >
                          6 ayda 1
                        </button>
                        <button
                          type="button"
                          onClick={() => applyPatternToRow(row.id, "once")}
                          className="px-2 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-[10px]"
                        >
                          Yılda 1
                        </button>
                        <button
                          type="button"
                          onClick={() => clearRow(row.id)}
                          className="px-2 py-1 rounded-md border border-amber-300 bg-amber-50 hover:bg-amber-100 text-[10px] text-amber-800"
                        >
                          Temizle
                        </button>
                      </div>
                    </td>

                    <td className="px-2 py-2 border-b border-slate-200 text-center align-top">
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(row.id)}
                        className="inline-flex items-center justify-center px-2 py-2 text-[10px] rounded-md bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                      >
                        Sil
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2 border-t border-slate-200">
          <PrimaryButton
            type="button"
            size="sm"
            variant="secondary"
            onClick={handleAddRow}
            className="w-full sm:w-auto"
          >
            Satır Ekle
          </PrimaryButton>

          <PrimaryButton
            type="button"
            size="sm"
            onClick={handlePreparePdf}
            disabled={loading}
            className={loading ? "cursor-wait w-full sm:w-auto" : "w-full sm:w-auto"}
          >
            {loading ? "Hazırlanıyor..." : "Hazırla (PDF)"}
          </PrimaryButton>
        </div>
      </CardBox>

      <Modal
        isOpen={show}
        onClose={() => setShow(false)}
        title="Yıllık Çalışma Planı"
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

            <PrimaryButton size="sm" variant="green" onClick={saveToDocs} disabled={saving}>
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
            title="Yıllık Çalışma Planı PDF"
            className="w-full h-[60vh] border border-gray-200 rounded"
          />
        )}

        {!loading && !pdfUrl && (
          <div className="w-full h-[60vh] flex items-center justify-center text-sm text-gray-600">
            PDF yok. Lütfen yeniden deneyin.
          </div>
        )}
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