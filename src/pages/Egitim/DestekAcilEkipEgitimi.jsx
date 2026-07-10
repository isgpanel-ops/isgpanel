// src/pages/Egitim/DestekAcilEkipEgitimi.jsx
import React, { useContext, useEffect, useMemo, useState, useCallback, useRef } from "react";
import { SectionTitle, CardBox, PrimaryButton, Modal } from "../../components/ui";
import { FirmaContext } from "../../context/FirmaContext";
import ConfirmModal from "../../components/ui/ConfirmModal";

/* =========================
   ✅ GLOBAL STANDARD
========================= */
const DOCS_SYNC_KEY = "docs:lastChangeAt";

/* =========================
   ✅ TOKEN + URL + TARİH HELPERS
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

    const activeEmail = localStorage.getItem("__isg_active_email_global") || "";

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
  if (String(url).startsWith("data:image")) return url;
  if (String(url).startsWith("http://") || String(url).startsWith("https://")) return url;
  return `${base}${String(url).startsWith("/") ? "" : "/"}${url}`;
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

function formatDateTR(value) {
  if (!value) return "__.__.____";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-");
    return `${d}.${m}.${y}`;
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [d, m, y] = value.split("/");
    return `${d}.${m}.${y}`;
  }
  return value;
}

const safeFile = (v) =>
  (v || "")
    .toString()
    .trim()
    .toLocaleUpperCase("tr-TR")
    .replace(/\s+/g, " ")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\.+$/g, "");

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
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  } catch {
    return "";
  }
};

const fileToBase64 = (fileOrBlob) =>
  new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result || "");
      reader.onerror = reject;
      reader.readAsDataURL(fileOrBlob);
    } catch (err) {
      reject(err);
    }
  });

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

const isEmptyRow = (row) => {
  const fields = [row?.tc, row?.adSoyad, row?.gorev];
  return fields.every((v) => !String(v || "").trim());
};

const isSignatureRequiredRow = (row) => !isEmptyRow(row) && !!String(row?.adSoyad || "").trim();

const isCriticalSignatureField = (field) => ["tc", "adSoyad", "gorev"].includes(field);

const resetRowSignature = (row) => ({
  ...row,
  imzalar: createEmptyImzaState(),
});

const getMissingSignatureLabels = (row) => {
  if (!isSignatureRequiredRow(row)) return [];
  return rowHasSignature(row) ? [] : ["Personel İmzası"];
};




/* Aynı AcilDurumEkipleri.jsx mantığı */
const calcIlkYardimCount = (calisan, tehlike) => {
  if (!calisan || calisan <= 0) return 0;
  const t = (tehlike || "").toLowerCase();
  let divisor = 20;

  if (t.includes("az")) divisor = 20;
  else if (t.includes("çok")) divisor = 10;
  else if (t.includes("tehlikeli")) divisor = 15;

  return Math.max(1, Math.ceil(calisan / divisor));
};

const calcOtherTeamCount = (calisan, tehlike) => {
  if (!calisan || calisan <= 0) return 0;
  const t = (tehlike || "").toLowerCase();
  let divisor = 50;

  if (t.includes("çok")) divisor = 30;
  else if (t.includes("az")) divisor = 50;
  else if (t.includes("tehlikeli")) divisor = 40;

  return Math.max(1, Math.ceil(calisan / divisor));
};

export default function DestekAcilEkipEgitimi() {
  const { selectedFirm } = useContext(FirmaContext);

  const RAW_API_ORIGIN =
    (import.meta.env.VITE_API_URL || import.meta.env.VITE_API || "").trim() ||
    "https://api.isgpanel.tr";

  const API_ORIGIN = RAW_API_ORIGIN
    .replace(/\/+$/, "")
    .replace(/\/api$/i, "");

  const API_BASE = `${API_ORIGIN}/api`;

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

  const [serverKurumsal, setServerKurumsal] = useState({
    logoUrl: "",
    logoBase64: "",
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
    saat: "2",
  });

  const [calisanSayisi, setCalisanSayisi] = useState("");
  const [oneriler, setOneriler] = useState({
    yangin: 0,
    kurtarma: 0,
    koruma: 0,
    ilkyardim: 0,
  });

  const [katilimcilar, setKatilimcilar] = useState([]);
  const [riskDestek, setRiskDestek] = useState("");
  const [riskBilgi, setRiskBilgi] = useState("");

  const [acilTeams, setAcilTeams] = useState([]);
  const [acilMeta, setAcilMeta] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalTip, setModalTip] = useState(null); // "katilim" | "atama" | "acil"
 const [pdfUrl, setPdfUrl] = useState(null);
const [pdfLoading, setPdfLoading] = useState(false);
const [pdfProgress, setPdfProgress] = useState(0);
const [pdfError, setPdfError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

 const [signatureModalOpen, setSignatureModalOpen] = useState(false);
const [activeSignatureRowIndex, setActiveSignatureRowIndex] = useState(null);
const [signatureDrawingEmpty, setSignatureDrawingEmpty] = useState(true);
const [signatureConsentChecked, setSignatureConsentChecked] = useState(false);
const [signatureDraftRow, setSignatureDraftRow] = useState(null);

const canvasRef = useRef(null);
const canvasWrapRef = useRef(null);
const drawingRef = useRef(false);
const lastPointRef = useRef({ x: 0, y: 0 }); 

const getFilledRows = (rows) =>
  (rows || []).filter((row) => String(row?.adSoyad || "").trim() !== "");

const ensureRowsSigned = (rows, emptyMessage = "İmzalanacak kayıt bulunamadı.") => {
  const targetRows = getFilledRows(rows);

  if (!targetRows.length) {
    openInfo("Bilgilendirme", emptyMessage);
    return false;
  }

  const firstMissing = targetRows.find((row) => getMissingSignatureLabels(row).length > 0);

  if (firstMissing) {
    openInfo(
      "Eksik İmza Uyarısı",
      `${firstMissing.adSoyad || "İsimsiz satır"} için personel imzası eksik.`
    );
    return false;
  }

  return true;
};

const getRowsForKatilimFormu = () =>
  katilimcilar.filter((k) => String(k?.adSoyad || "").trim() !== "");

const getRowsForAtamaFormu = () =>
  katilimcilar.filter(
    (k) => k?.kaynak === "destek" && String(k?.adSoyad || "").trim() !== ""
  );



const getRowsForAcilFormu = () =>
  katilimcilar.filter(
    (k) => k?.kaynak === "acil" && String(k?.adSoyad || "").trim() !== ""
  );

const normalizeNameTR = (value) =>
  String(value || "").trim().toLocaleUpperCase("tr-TR");

const findMatchingEgitimAcilRow = (egitimRows, teamRow) => {
  const teamTc = normalizeTC(teamRow?.tc || "");
  const teamName = normalizeNameTR(teamRow?.adSoyad || "");
  const teamEkip = normalizeNameTR(teamRow?.ekip || teamRow?.gorev || "");

  if (teamTc) {
    const byTc = (egitimRows || []).find(
      (row) =>
        row?.kaynak === "acil" &&
        normalizeTC(row?.tc || "") === teamTc
    );
    if (byTc) return byTc;
  }

  return (egitimRows || []).find(
    (row) =>
      row?.kaynak === "acil" &&
      normalizeNameTR(row?.adSoyad || "") === teamName &&
      normalizeNameTR(row?.gorev || "") === teamEkip
  );
};

const normalizePhone = (value) =>
  String(value || "")
    .replace(/\D/g, "")
    .slice(0, 11);

const validateAcilPdfDependencies = (serverTeams, egitimRows) => {
  const teams = Array.isArray(serverTeams) ? serverTeams : [];
  const acilEgitimRows = (egitimRows || []).filter((row) => row?.kaynak === "acil");

  if (!teams.length) {
    return {
      ok: false,
      message: "Lütfen acil durum sekmesindeki bilgileri doldurunuz.",
    };
  }

  const firstMissingTeamInfo = teams.find(
    (team) =>
      !String(team?.ekip || "").trim() ||
      !String(team?.adSoyad || "").trim() ||
      !String(team?.gorev || "").trim() ||
      normalizePhone(team?.iletisim || "").length !== 11
  );

  if (firstMissingTeamInfo) {
    return {
      ok: false,
      message:
        "Lütfen acil durum sekmesindeki kişi bilgilerini eksiksiz doldurunuz. Telefon numarası 11 haneli olmalıdır.",
    };
  }

  if (!acilEgitimRows.length) {
    return {
      ok: false,
      message:
        "Lütfen eğitim sekmesindeki bilgileri doldurunuz. Acil ekip personelleri için TC kimlik numarası ve imza zorunludur.",
    };
  }

  for (const team of teams) {
    const match = findMatchingEgitimAcilRow(acilEgitimRows, team);

    if (!match) {
      return {
        ok: false,
        message:
          "Lütfen eğitim sekmesindeki bilgileri doldurunuz. Acil ekip personelleri için TC kimlik numarası ve imza zorunludur.",
      };
    }

    if (normalizeTC(match?.tc || "").length !== 11) {
      return {
        ok: false,
        message:
          "Lütfen eğitim sekmesindeki bilgileri doldurunuz. Acil ekip personelleri için TC kimlik numarası ve imza zorunludur.",
      };
    }

    if (!rowHasSignature(match)) {
      return {
        ok: false,
        message:
          "Lütfen eğitim sekmesindeki bilgileri doldurunuz. Acil ekip personelleri için TC kimlik numarası ve imza zorunludur.",
      };
    }
  }

  return { ok: true };
};


  const firmaId = selectedFirm?._id || selectedFirm?.id || "default";
  const RISK_KISILER_KEY = `risk_prosedur_kisiler_${firmaId}`;
  const ACIL_KEY = `acil_ekipleri_${firmaId}`;
  const EGITIM_DOCS_KEY = "belgelerim_egitim_listesi";

  const API = useMemo(
    () => ({
      katilimPdf: `${API_BASE}/destek-acil/egitim-katilim-formu/pdf`,
      atamaPdf: `${API_BASE}/destek-acil/destek-elemani-atama-formu/pdf`,
      acilPdf: `${API_BASE}/destek-acil/acil-ekip-formu/pdf`,
      kayitGet: `${API_BASE}/destek-acil/katilimcilar`,
      kayitSave: `${API_BASE}/destek-acil/katilimcilar`,
      acilEkipGet: `${API_BASE}/acil-ekipleri/form/${selectedFirm?.id}`,
      acilEkipSave: `${API_BASE}/acil-ekipleri/form/${selectedFirm?.id}`,
    }),
    [API_BASE, selectedFirm?.id]
  );

  const requestWithFallback = useCallback(
    async (path, options = {}, parseAs = "json") => {
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
          if (ct.includes("application/json")) return await res.json();

          return await safeJsonParse(res);
        } catch (err) {
          lastError = err;
        }
      }

      throw lastError || new Error("İstek başarısız.");
    },
    [API_ROOTS]
  );

  const readonlyInputClass =
    "w-full min-w-0 h-11 rounded-lg border border-gray-300 bg-slate-50 px-4 text-sm text-gray-800";
  const editableInputClass =
    "w-full min-w-0 h-11 rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 [color-scheme:light]";
  const tableInputClass =
    "w-full min-w-0 h-9 sm:h-11 rounded-lg border border-gray-300 bg-white px-2 sm:px-3 text-[11px] sm:text-xs text-gray-800 text-center focus:outline-none focus:ring-2 focus:ring-blue-500/30";

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

  const getTopluEtiket = (tip, adet) => {
    if (tip === "acil") return `TOPLU ACİL EKİP (${adet} KİŞİ)`;
    return `TOPLU DESTEK/ACİL (${adet} KİŞİ)`;
  };

  const countFilled = (arr) =>
    (arr || []).filter((k) => (k.adSoyad || "").trim() !== "").length;

  const countFilledAcil = (arr) =>
    (arr || []).filter((k) => k.kaynak === "acil" && (k.adSoyad || "").trim() !== "").length;

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

    if (selectedFirm && firmaId) loadKurumsal();

    return () => {
      cancelled = true;
    };
  }, [selectedFirm, firmaId, user, API_ORIGIN, requestWithFallback]);

  useEffect(() => {
    if (!selectedFirm?.id) return;

    const firmIdLocal = selectedFirm.id;
    const pickFirst = (...vals) => vals.find((v) => String(v || "").trim()) || "";
    const hasAny = (obj) => Object.values(obj || {}).some((x) => String(x || "").trim());
    let alive = true;

    const fetchKisiler = async () => {
      const token = getBearerToken(user);
      if (!token) return null;

      try {
        const r = await fetch(`${API_BASE}/firma/${firmIdLocal}/kisiler`, {
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
        const raw = localStorage.getItem(`risk_prosedur_kisiler_${firmIdLocal}`);
        const p = raw ? JSON.parse(raw) : null;
        if (p && typeof p === "object") {
          const next = {
            uzman: pickFirst(p?.uzman, p?.isgUzmani, p?.uzmanAdiSoyadi, p?.isgUzmaniAdSoyad),
            hekim: pickFirst(p?.hekim, p?.isyeriHekimi, p?.hekimAdiSoyadi, p?.isyeriHekimiAdSoyad),
            isveren: pickFirst(
              p?.isveren,
              p?.isverenVekili,
              p?.isverenAdSoyad,
              p?.isverenVekiliAdSoyad
            ),
          };
          if (hasAny(next)) return next;
        }
      } catch {}

      return null;
    };

    (async () => {
      const kisiler = await fetchKisiler();
      if (!alive) return;
      setImzalar({
        isgUzmaniAdi: pickFirst(kisiler?.uzman),
        isyeriHekimiAdi: pickFirst(kisiler?.hekim),
        isverenAdi: pickFirst(kisiler?.isveren),
      });
    })();

    return () => {
      alive = false;
    };
  }, [API_BASE, selectedFirm?.id, user]);

  useEffect(() => {
    const handleRefresh = () => {
      setReloadKey((prev) => prev + 1);
    };

    window.addEventListener("acilEkipleriUpdated", handleRefresh);
    window.addEventListener("ticari_docs_refresh", handleRefresh);
    window.addEventListener(DOCS_SYNC_KEY, handleRefresh);

    return () => {
      window.removeEventListener("acilEkipleriUpdated", handleRefresh);
      window.removeEventListener("ticari_docs_refresh", handleRefresh);
      window.removeEventListener(DOCS_SYNC_KEY, handleRefresh);
    };
  }, []);


useEffect(() => {
  const handleAcilChanged = (e) => {
    const payload = e?.detail;
    if (!payload?.teams) return;

    const acilList = payload.teams;

    setKatilimcilar((prev) => {
      const prevAcilRows = prev.filter((k) => k.kaynak === "acil");
      const nonAcil = prev.filter((k) => k.kaynak !== "acil");

      const newAcilRows = acilList.map((t, idx) => {
        const tc = normalizeTC(t.tc || "");

        const existing =
          prevAcilRows.find(
            (k) => tc && normalizeTC(k.tc || "") === tc
          ) ||
          prevAcilRows.find(
            (k) =>
              normalizeNameTR(k.adSoyad || "") === normalizeNameTR(t.adSoyad || "") &&
              normalizeNameTR(k.gorev || "") === normalizeNameTR(t.ekip || "")
          ) ||
          prevAcilRows[idx];

        return {
          no: 0,
          tc: normalizeTC(t.tc || existing?.tc || ""),
          adSoyad: (t.adSoyad || existing?.adSoyad || "").toLocaleUpperCase("tr-TR"),
          gorev: (t.ekip || existing?.gorev || "").toLocaleUpperCase("tr-TR"),
          kaynak: "acil",
          imzalar: existing?.imzalar || createEmptyImzaState(),
        };
      });

      const merged = [...nonAcil, ...newAcilRows];

      return merged.map((k, i) => ({ ...k, no: i + 1 }));
    });
  };

  window.addEventListener("acilEkipleriChanged", handleAcilChanged);

  return () => {
    window.removeEventListener("acilEkipleriChanged", handleAcilChanged);
  };
}, []);

useEffect(() => {
  const handleAcilFormHazirla = async (e) => {
    const eventFirmaId = e?.detail?.firmaId;

    if (!selectedFirm?.id) return;
    if (eventFirmaId && String(eventFirmaId) !== String(selectedFirm.id)) return;

    await handleAcilFormu({ silent: false });
  };

  window.addEventListener("acilFormHazirla", handleAcilFormHazirla);

  return () => {
    window.removeEventListener("acilFormHazirla", handleAcilFormHazirla);
  };
}, [selectedFirm?.id, egitimBilgileri, katilimcilar, acilTeams, oneriler]);

  useEffect(() => {
    if (!selectedFirm) return;

    let alive = true;

    const loadPageData = async () => {
      try {
        setEgitimBilgileri((prev) => ({
          ...prev,
          yer: prev.yer || selectedFirm.firmaAdi || "",
          saat: prev.saat || "2",
        }));

        let destekAd = "";
        let bilgiAd = "";
        let teams = [];
        let meta = null;

        try {
          const rawRisk = localStorage.getItem(RISK_KISILER_KEY);
          if (rawRisk) {
            const obj = JSON.parse(rawRisk);
            if (obj && typeof obj === "object") {
              if (obj.destek) destekAd = String(obj.destek).toLocaleUpperCase("tr-TR");
              if (obj.bilgi) bilgiAd = String(obj.bilgi).toLocaleUpperCase("tr-TR");
            }
          }
        } catch (e) {
          console.error("Risk prosedürü kişi bilgileri okunamadı:", e);
        }

        let savedDestekFromEgitim = "";
        let savedBilgiFromEgitim = "";
        let savedCalisanFromEgitim = "";
        let savedOnerilerFromEgitim = null;
        let savedTarihFromEgitim = "";
        let savedRowsFromServer = null;

        try {
          const token = getBearerToken(user);
          const res = await fetch(`${API.kayitGet}?firmaId=${selectedFirm.id}`, {
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          });

          if (res.ok) {
            const json = await res.json();
            const data = json?.payload || null;

            if (data?.egitimBilgileri) {
              if (data.egitimBilgileri.tarih) {
                savedTarihFromEgitim = data.egitimBilgileri.tarih;
              }

              if (alive) {
                setEgitimBilgileri((prev) => ({
                  ...prev,
                  ...data.egitimBilgileri,
                  saat: data.egitimBilgileri.saat || "2",
                }));
              }
            }

            if (data?.calisanSayisi) savedCalisanFromEgitim = String(data.calisanSayisi);
            if (data?.oneriler) savedOnerilerFromEgitim = data.oneriler;

            if (Array.isArray(data?.katilimcilar)) {
  savedRowsFromServer = data.katilimcilar.map((k, i) => ({
    no: i + 1,
    tc: normalizeTC(k?.tc || ""),
    adSoyad: (k?.adSoyad || "").toLocaleUpperCase("tr-TR"),
    gorev: (k?.gorev || "").toLocaleUpperCase("tr-TR"),
    kaynak: k?.kaynak || "",
    imzalar: {
      ...createEmptyImzaState(),
      ...(k?.imzalar || {}),
    },
  }));

              const dSatir = data.katilimcilar.find((k) => k.kaynak === "destek");
              const bSatir = data.katilimcilar.find((k) => k.kaynak === "bilgi");

              if (dSatir?.adSoyad) savedDestekFromEgitim = dSatir.adSoyad;
              if (bSatir?.adSoyad) savedBilgiFromEgitim = bSatir.adSoyad;
            }
          }
        } catch (e) {
          console.error("Destek/Acil server kayıt yükleme hatası:", e);
        }

        if (alive) {
          setRiskDestek(savedDestekFromEgitim || destekAd);
          setRiskBilgi(savedBilgiFromEgitim || bilgiAd);
        }

        try {
          const token = getBearerToken(user);

          const res = await fetch(API.acilEkipGet, {
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          });

          if (res.ok) {
            const json = await res.json();
            const data = json?.payload || json || {};
            teams = data?.teams || [];
            meta = data?.meta || null;
          } else {
            try {
              const localRaw = localStorage.getItem(ACIL_KEY);
              const localData = localRaw ? JSON.parse(localRaw) : null;
              if (localData) {
                teams = localData?.teams || [];
                meta = localData?.meta || null;
              }
            } catch {}
          }
        } catch (e) {
          console.error("Acil ekip serverdan okunamadı:", e);
          try {
            const localRaw = localStorage.getItem(ACIL_KEY);
            const localData = localRaw ? JSON.parse(localRaw) : null;
            if (localData) {
              teams = localData?.teams || [];
              meta = localData?.meta || null;
            }
          } catch {}
        }

        if (!alive) return;

        setAcilTeams(teams);
        setAcilMeta(meta);

        let initialRows = [];

        const firmCalisanSayisi =
          Number(savedCalisanFromEgitim || selectedFirm?.calisanSayisi || meta?.calisanSayisi || 0) || "";

        setCalisanSayisi(String(firmCalisanSayisi || ""));

        const y = calcOtherTeamCount(Number(firmCalisanSayisi || 0), selectedFirm?.tehlike || "");
        const i = calcIlkYardimCount(Number(firmCalisanSayisi || 0), selectedFirm?.tehlike || "");

        const hesaplananOneriler =
          savedOnerilerFromEgitim || {
            yangin: y,
            kurtarma: y,
            koruma: y,
            ilkyardim: i,
          };

        setOneriler(hesaplananOneriler);

       if (Array.isArray(savedRowsFromServer) && savedRowsFromServer.length > 0) {
  const nonAcilRows = savedRowsFromServer.filter((k) => k.kaynak !== "acil");
  const prevAcilRows = savedRowsFromServer.filter((k) => k.kaynak === "acil");

 const fillTeamRowsFromServer = (existingRows, serverRows, targetCount, gorev) => {
  const result = [];
  const safeServerRows = Array.isArray(serverRows) ? serverRows : [];
  const safeExistingRows = Array.isArray(existingRows) ? existingRows : [];

  for (let i = 0; i < Number(targetCount || 0); i++) {
    const serverRow = safeServerRows[i];
    const tc = normalizeTC(serverRow?.tc || "");

    const existing =
      safeExistingRows.find((k) => tc && normalizeTC(k.tc || "") === tc) ||
      safeExistingRows.find(
        (k) =>
          normalizeNameTR(k.adSoyad || "") === normalizeNameTR(serverRow?.adSoyad || "") &&
          normalizeNameTR(k.gorev || "") === normalizeNameTR(serverRow?.ekip || gorev)
      ) ||
      safeExistingRows[i];

    result.push({
      no: 0,
      tc: normalizeTC(serverRow?.tc || existing?.tc || ""),
      adSoyad: (serverRow?.adSoyad || existing?.adSoyad || "").toLocaleUpperCase("tr-TR"),
      gorev: (serverRow?.ekip || existing?.gorev || gorev).toLocaleUpperCase("tr-TR"),
      kaynak: "acil",
      imzalar: existing?.imzalar || createEmptyImzaState(),
    });
  }

  return result;
};

const teamYangin = Array.isArray(teams)
  ? teams.filter((t) => normalizeNameTR(t.ekip || "") === "YANGIN SÖNDÜRME EKİBİ")
  : [];

const teamKurtarma = Array.isArray(teams)
  ? teams.filter((t) => normalizeNameTR(t.ekip || "") === "KURTARMA / TAHLİYE EKİBİ")
  : [];

const teamKoruma = Array.isArray(teams)
  ? teams.filter((t) => normalizeNameTR(t.ekip || "") === "KORUMA / GÜVENLİK EKİBİ")
  : [];

const teamIlkyardim = Array.isArray(teams)
  ? teams.filter((t) => normalizeNameTR(t.ekip || "") === "İLKYARDIM EKİBİ")
  : [];

const prevYangin = prevAcilRows.filter((k) => normalizeNameTR(k.gorev || "") === "YANGIN SÖNDÜRME EKİBİ");
const prevKurtarma = prevAcilRows.filter((k) => normalizeNameTR(k.gorev || "") === "KURTARMA / TAHLİYE EKİBİ");
const prevKoruma = prevAcilRows.filter((k) => normalizeNameTR(k.gorev || "") === "KORUMA / GÜVENLİK EKİBİ");
const prevIlkyardim = prevAcilRows.filter((k) => normalizeNameTR(k.gorev || "") === "İLKYARDIM EKİBİ");

const mergedAcilRows = [
  ...fillTeamRowsFromServer(prevYangin, teamYangin, hesaplananOneriler.yangin, "YANGIN SÖNDÜRME EKİBİ"),
  ...fillTeamRowsFromServer(prevKurtarma, teamKurtarma, hesaplananOneriler.kurtarma, "KURTARMA / TAHLİYE EKİBİ"),
  ...fillTeamRowsFromServer(prevKoruma, teamKoruma, hesaplananOneriler.koruma, "KORUMA / GÜVENLİK EKİBİ"),
  ...fillTeamRowsFromServer(prevIlkyardim, teamIlkyardim, hesaplananOneriler.ilkyardim, "İLKYARDIM EKİBİ"),
];

  initialRows = [...nonAcilRows, ...mergedAcilRows].map((k, i) => ({
    ...k,
    no: i + 1,
  }));
} else {
  initialRows.push({
    no: 1,
    tc: "",
    adSoyad: savedDestekFromEgitim || destekAd || "",
    gorev: "DESTEK ELEMANI",
    kaynak: "destek",
    imzalar: createEmptyImzaState(),
  });

  initialRows.push({
    no: 2,
    tc: "",
    adSoyad: savedBilgiFromEgitim || bilgiAd || "",
    gorev: "BİLGİ SAHİBİ KİŞİ",
    kaynak: "bilgi",
    imzalar: createEmptyImzaState(),
  });

  let counter = 3;

  if (Array.isArray(teams) && teams.length > 0) {
    teams.forEach((t) => {
      initialRows.push({
        no: counter++,
        tc: normalizeTC(t.tc || ""),
        adSoyad: (t.adSoyad || "").toLocaleUpperCase("tr-TR"),
        gorev: (t.ekip || "").toLocaleUpperCase("tr-TR"),
        kaynak: "acil",
        imzalar: createEmptyImzaState(),
      });
    });
  } else {
    for (let n = 1; n <= Number(hesaplananOneriler.yangin || 0); n++) {
      initialRows.push({
        no: counter++,
        tc: "",
        adSoyad: "",
        gorev: "YANGIN SÖNDÜRME EKİBİ",
        kaynak: "acil",
        imzalar: createEmptyImzaState(),
      });
    }

    for (let n = 1; n <= Number(hesaplananOneriler.kurtarma || 0); n++) {
      initialRows.push({
        no: counter++,
        tc: "",
        adSoyad: "",
        gorev: "KURTARMA / TAHLİYE EKİBİ",
        kaynak: "acil",
        imzalar: createEmptyImzaState(),
      });
    }

    for (let n = 1; n <= Number(hesaplananOneriler.koruma || 0); n++) {
      initialRows.push({
        no: counter++,
        tc: "",
        adSoyad: "",
        gorev: "KORUMA / GÜVENLİK EKİBİ",
        kaynak: "acil",
        imzalar: createEmptyImzaState(),
      });
    }

    for (let n = 1; n <= Number(hesaplananOneriler.ilkyardim || 0); n++) {
      initialRows.push({
        no: counter++,
        tc: "",
        adSoyad: "",
        gorev: "İLKYARDIM EKİBİ",
        kaynak: "acil",
        imzalar: createEmptyImzaState(),
      });
    }
  }
}

        setKatilimcilar(initialRows);

        if (meta?.manualDate) {
          setEgitimBilgileri((prev) => ({ ...prev, tarih: meta.manualDate }));
        } else if (savedTarihFromEgitim) {
          setEgitimBilgileri((prev) => ({ ...prev, tarih: savedTarihFromEgitim }));
        }

        setModalOpen(false);
        setModalTip(null);
        setPdfUrl(null);
        setPdfLoading(false);
        setPdfError("");
      } catch (e) {
        console.error("Destek/Acil eğitim kaydı okunamadı:", e);
      }
    };

    loadPageData();

    return () => {
      alive = false;
    };
  }, [selectedFirm, RISK_KISILER_KEY, API.kayitGet, API.acilEkipGet, user, reloadKey, ACIL_KEY]);

  const handleEgitimChange = (field, value) => {
    setEgitimBilgileri((prev) => ({ ...prev, [field]: value }));
  };

const handleCalisanSayisiChange = (value) => {
  setCalisanSayisi(value);
  const n = parseInt(value, 10);

  if (isNaN(n)) {
    setOneriler({ yangin: 0, kurtarma: 0, koruma: 0, ilkyardim: 0 });
    return;
  }

  const nextOneriler = {
    yangin: calcOtherTeamCount(n, selectedFirm?.tehlike || ""),
    kurtarma: calcOtherTeamCount(n, selectedFirm?.tehlike || ""),
    koruma: calcOtherTeamCount(n, selectedFirm?.tehlike || ""),
    ilkyardim: calcIlkYardimCount(n, selectedFirm?.tehlike || ""),
  };

  setOneriler(nextOneriler);

  setKatilimcilar((prev) => {
    const destekRow = prev.find((k) => k.kaynak === "destek") || {
      tc: "",
      adSoyad: riskDestek || "",
      gorev: "DESTEK ELEMANI",
      kaynak: "destek",
      imzalar: createEmptyImzaState(),
    };

    const bilgiRow = prev.find((k) => k.kaynak === "bilgi") || {
      tc: "",
      adSoyad: riskBilgi || "",
      gorev: "BİLGİ SAHİBİ KİŞİ",
      kaynak: "bilgi",
      imzalar: createEmptyImzaState(),
    };

    const mevcutAcilRows = prev.filter((k) => k.kaynak === "acil");

    const mevcutYangin = mevcutAcilRows.filter(
      (k) => k.gorev === "YANGIN SÖNDÜRME EKİBİ"
    );
    const mevcutKurtarma = mevcutAcilRows.filter(
      (k) => k.gorev === "KURTARMA / TAHLİYE EKİBİ"
    );
    const mevcutKoruma = mevcutAcilRows.filter(
      (k) => k.gorev === "KORUMA / GÜVENLİK EKİBİ"
    );
    const mevcutIlkyardim = mevcutAcilRows.filter(
      (k) => k.gorev === "İLKYARDIM EKİBİ"
    );

    const fillTeamRows = (existingRows, targetCount, gorev) => {
      const arr = [...existingRows];

      while (arr.length < Number(targetCount || 0)) {
        arr.push({
          no: 0,
          tc: "",
          adSoyad: "",
          gorev,
          kaynak: "acil",
          imzalar: createEmptyImzaState(),
        });
      }

      return arr.slice(0, Number(targetCount || 0));
    };

    let rows = [
      { ...destekRow, no: 1 },
      { ...bilgiRow, no: 2 },
    ];

    let counter = 3;

    rows = rows.concat(
      fillTeamRows(
        mevcutYangin,
        nextOneriler.yangin,
        "YANGIN SÖNDÜRME EKİBİ"
      ).map((k) => ({
        ...k,
        no: counter++,
      }))
    );

    rows = rows.concat(
      fillTeamRows(
        mevcutKurtarma,
        nextOneriler.kurtarma,
        "KURTARMA / TAHLİYE EKİBİ"
      ).map((k) => ({
        ...k,
        no: counter++,
      }))
    );

    rows = rows.concat(
      fillTeamRows(
        mevcutKoruma,
        nextOneriler.koruma,
        "KORUMA / GÜVENLİK EKİBİ"
      ).map((k) => ({
        ...k,
        no: counter++,
      }))
    );

    rows = rows.concat(
      fillTeamRows(
        mevcutIlkyardim,
        nextOneriler.ilkyardim,
        "İLKYARDIM EKİBİ"
      ).map((k) => ({
        ...k,
        no: counter++,
      }))
    );

    return rows.map((k, i) => ({ ...k, no: i + 1 }));
  });
}; 

 const handleKatilimciChange = (index, field, value) => {
  setKatilimcilar((prev) => {
    const updated = [...prev];
    const oldRow = updated[index];
    let nextVal = value;

    if (field === "tc") nextVal = normalizeTC(value);
    else nextVal = value?.toLocaleUpperCase?.("tr-TR") || value;

    const nextRow = { ...updated[index], [field]: nextVal };
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
      {
        no: prev.length + 1,
        tc: "",
        adSoyad: "",
        gorev: "DİĞER",
        kaynak: "manuel",
        imzalar: createEmptyImzaState(),
      },
    ];
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

  if (activeRow) {
    const missing = getMissingSignatureLabels(activeRow);

    if (missing.length > 0) {
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

 
setKatilimcilar((prev) => {
  const nextRows = prev.map((row, idx) =>
    idx === activeSignatureRowIndex
      ? {
          ...row,
          imzalar: {
            ...(row.imzalar || createEmptyImzaState()),
            personel: savedSignature,
          },
        }
      : row
  );

  try {
    const token = getBearerToken(user);

    const payload = {
      egitimBilgileri,
      calisanSayisi,
      oneriler,
      katilimcilar: nextRows.map(({ no, ...rest }) => ({
        tc: normalizeTC(rest.tc),
        adSoyad: (rest.adSoyad || "").toLocaleUpperCase("tr-TR"),
        gorev: (rest.gorev || "").toLocaleUpperCase("tr-TR"),
        kaynak: rest.kaynak || "",
        imzalar: {
          personel: rest?.imzalar?.personel || null,
        },
      })),
    };

    fetch(API.kayitSave, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        firmaId,
        firmaAdi: selectedFirm?.firmaAdi || "",
        egitimTuru: "Destek Acil Ekip Eğitimi",
        katilimcilar: payload.katilimcilar,
        payload,
      }),
    })
     .then(async () => {
  try {
    await syncAcilTeams();
  } catch {}

  try {
    localStorage.setItem(DOCS_SYNC_KEY, String(Date.now()));
  } catch {}

  window.dispatchEvent(new Event(DOCS_SYNC_KEY));
  window.dispatchEvent(new Event("ticari_docs_refresh"));
})
      .catch(() => {});
  } catch {}

  return nextRows;
});

forceCloseSignatureModal();

};

  const syncAcilTeams = async () => {
    const token = getBearerToken(user);

  const acilRows = katilimcilar
  .filter((k) => k.kaynak === "acil")
  .map((r, idx) => {
    const existingTeam =
      (acilTeams || []).find(
        (t) =>
          normalizeTC(t?.tc || "") &&
          normalizeTC(t?.tc || "") === normalizeTC(r.tc || "")
      ) ||
      (acilTeams || []).find(
        (t) =>
          normalizeNameTR(t?.adSoyad || "") === normalizeNameTR(r.adSoyad || "") &&
          normalizeNameTR(t?.ekip || "") === normalizeNameTR(r.gorev || "")
      );

    return {
      id: existingTeam?.id || Date.now() + idx,
      ekip: (r.gorev || existingTeam?.ekip || "ACİL DURUM EKİBİ").toLocaleUpperCase("tr-TR"),
      adSoyad: (r.adSoyad || existingTeam?.adSoyad || "").toLocaleUpperCase("tr-TR"),
      tc: normalizeTC(r.tc || existingTeam?.tc || ""),
      gorev: (existingTeam?.gorev || "").toLocaleUpperCase("tr-TR"),
      iletisim: existingTeam?.iletisim || "",
      imzalar: {
        personel: r?.imzalar?.personel || existingTeam?.imzalar?.personel || null,
      },
    };
  });

    const sayYangin = acilRows.filter((r) => r.ekip === "YANGIN SÖNDÜRME EKİBİ").length;
    const sayKurtarma = acilRows.filter((r) => r.ekip === "KURTARMA / TAHLİYE EKİBİ").length;
    const sayKoruma = acilRows.filter((r) => r.ekip === "KORUMA / GÜVENLİK EKİBİ").length;
    const sayIlkyardim = acilRows.filter((r) => r.ekip === "İLKYARDIM EKİBİ").length;

    const payload = {
      firmaId: selectedFirm?.id,
      firmaAdi: selectedFirm?.firmaAdi || "",
      teams: acilRows,
      meta: {
        calisanSayisi: Number(calisanSayisi) || 0,
        manualDate: egitimBilgileri.tarih || "",
        oneriler: {
          yangin: sayYangin,
          kurtarma: sayKurtarma,
          koruma: sayKoruma,
          ilkyardim: sayIlkyardim,
        },
      },
    };

    const requestOptions = {
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    };

    let syncOk = false;
    let lastErrorText = "";

    try {
      const putRes = await fetch(API.acilEkipSave, {
        method: "PUT",
        ...requestOptions,
      });

      if (putRes.ok) {
        syncOk = true;
      } else {
        lastErrorText = await putRes.text().catch(() => "");
      }
    } catch (err) {
      console.error("Acil ekip PUT senkron hatası:", err);
    }

   if (!syncOk) {
  console.error("Acil ekip server senkron başarısız:", lastErrorText);
  openInfo("Hata", "Acil ekip bilgileri server'a kaydedilemedi. Lütfen tekrar deneyin.");
  return false;
}

    setAcilTeams(acilRows);
    setAcilMeta(payload.meta);

    try {
      localStorage.setItem(DOCS_SYNC_KEY, String(Date.now()));
    } catch {}

    window.dispatchEvent(new Event(DOCS_SYNC_KEY));
    window.dispatchEvent(new Event("ticari_docs_refresh"));
    window.dispatchEvent(new Event("acilEkipleriUpdated"));

    return syncOk;
  };

 
const handleKatilimcilarKaydet = async () => {
  try {
    const filledRows = getFilledRows(katilimcilar);

    if (!filledRows.length) {
      openInfo("Bilgilendirme", "Lütfen en az 1 katılımcı adı girin.");
      return;
    }

    if (!ensureRowsSigned(filledRows, "İmzalanacak kayıt bulunamadı.")) {
      return;
    }

    const token = getBearerToken(user);

    const payload = {
      egitimBilgileri,
      calisanSayisi,
      oneriler,
      katilimcilar: katilimcilar.map(({ no, ...rest }) => ({
        tc: normalizeTC(rest.tc),
        adSoyad: (rest.adSoyad || "").toLocaleUpperCase("tr-TR"),
        gorev: (rest.gorev || "").toLocaleUpperCase("tr-TR"),
        kaynak: rest.kaynak || "",
        imzalar: {
          personel: rest?.imzalar?.personel || null,
        },
      })),
    };

    const res = await fetch(API.kayitSave, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        firmaId,
        firmaAdi: selectedFirm?.firmaAdi || "",
        egitimTuru: "Destek Acil Ekip Eğitimi",
        katilimcilar: payload.katilimcilar,
        payload,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || "Kayıt başarısız");
    }

    const json = await res.json().catch(() => null);
    const savedRows = Array.isArray(json?.payload?.katilimcilar)
      ? json.payload.katilimcilar
      : Array.isArray(json?.katilimcilar)
      ? json.katilimcilar
      : null;

    if (Array.isArray(savedRows) && savedRows.length > 0) {
      setKatilimcilar(
        savedRows.map((k, i) => ({
          no: i + 1,
          tc: normalizeTC(k?.tc || ""),
          adSoyad: (k?.adSoyad || "").toLocaleUpperCase("tr-TR"),
          gorev: (k?.gorev || "").toLocaleUpperCase("tr-TR"),
          kaynak: k?.kaynak || "",
          imzalar: {
            ...createEmptyImzaState(),
            ...(k?.imzalar || {}),
          },
        }))
      );
    } else {
      setKatilimcilar((prev) => prev.map((row, i) => ({ ...row, no: i + 1 })));
    }

    const syncOk = await syncAcilTeams();

    try {
      localStorage.setItem(DOCS_SYNC_KEY, String(Date.now()));
    } catch {}

    window.dispatchEvent(new Event(DOCS_SYNC_KEY));
    window.dispatchEvent(new Event("ticari_docs_refresh"));

    openInfo(
      "Bilgilendirme",
      syncOk
  ? "Destek / Acil durum ekipleri bilgileri kaydedildi ve Acil Durum Ekip sayfası ile senkronize edildi ✅"
  : "Acil ekip server senkronu yapılamadı. Lütfen tekrar deneyin."
    );
  } catch (e) {
    console.error("Destek/Acil eğitim kaydedilemedi:", e);
    openInfo("Hata", "Kaydederken bir hata oluştu.");
  }
};


  const readKurumsalForPdf = async () => {
    try {
      const raw = localStorage.getItem("kurumsalBilgiler");
      const k = raw ? JSON.parse(raw) : null;

      const localLogoUrl = k?.logoUrl || k?.logoURL || "";
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

      let finalLogoBase64 =
        serverKurumsal.logoBase64 ||
        firmLogoBase64 ||
        localLogoBase64 ||
        "";

      if (!finalLogoBase64 && finalLogoUrl) {
        try {
          const token = getBearerToken(user);
          const res = await fetch(finalLogoUrl, {
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          });

          if (res.ok) {
            const blob = await res.blob();
            finalLogoBase64 = await fileToBase64(blob);
          }
        } catch (e) {
          console.error("Logo URL base64'e çevrilemedi:", e);
        }
      }

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

  const buildPayload = async (rowsOverride = null) => {
  const rows = Array.isArray(rowsOverride) ? rowsOverride : katilimcilar;
  const kurumsalPdf = await readKurumsalForPdf();

  const kisiler = (() => {
    try {
      return JSON.parse(localStorage.getItem(RISK_KISILER_KEY) || "{}");
    } catch {
      return {};
    }
  })();

    let firmaImzalari = {};

  try {
    const token = getBearerToken(user);

    const res = await fetch(`${API_BASE}/firma/${firmaId}/imzalar`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (res.ok) {
      const json = await res.json().catch(() => ({}));
      const root =
        json?.payload?.imzalar ||
        json?.payload ||
        json?.data?.imzalar ||
        json?.data ||
        json?.imzalar ||
        json ||
        {};

      firmaImzalari = root || {};
    }
  } catch (err) {
    console.error("Firma imzaları serverdan alınamadı:", err);
  }

  if (!firmaImzalari || Object.keys(firmaImzalari).length === 0) {
    try {
      firmaImzalari = JSON.parse(localStorage.getItem(`firma_imzalar_${firmaId}`) || "{}");
    } catch {
      firmaImzalari = {};
    }
  }

  const kisiselBilgiler = (() => {
    try {
      return JSON.parse(localStorage.getItem("kisiselBilgiler") || "{}");
    } catch {
      return {};
    }
  })();
  const uzmanImzaDataUrl =
    firmaImzalari?.uzman?.imza?.dataUrl ||
    firmaImzalari?.uzman?.imza?.url ||
    firmaImzalari?.uzman?.imza ||
    firmaImzalari?.isgUzmani?.imza?.dataUrl ||
    firmaImzalari?.isgUzmani?.imza?.url ||
    firmaImzalari?.isgUzmani?.imza ||
    firmaImzalari?.uzman?.signature?.dataUrl ||
    firmaImzalari?.uzman?.signature?.url ||
    firmaImzalari?.uzman?.signature ||
    firmaImzalari?.uzman?.dataUrl ||
    firmaImzalari?.uzman?.url ||
    firmaImzalari?.isgUzmani?.dataUrl ||
    firmaImzalari?.isgUzmani?.url ||
    "";

  const uzmanParafDataUrl =
    firmaImzalari?.uzman?.paraf?.dataUrl ||
    firmaImzalari?.uzman?.paraf?.url ||
    firmaImzalari?.uzman?.paraf ||
    firmaImzalari?.isgUzmani?.paraf?.dataUrl ||
    firmaImzalari?.isgUzmani?.paraf?.url ||
    firmaImzalari?.isgUzmani?.paraf ||
    "";

  const hekimImzaDataUrl =
    firmaImzalari?.hekim?.imza?.dataUrl ||
    firmaImzalari?.hekim?.imza?.url ||
    firmaImzalari?.hekim?.imza ||
    firmaImzalari?.isyeriHekimi?.imza?.dataUrl ||
    firmaImzalari?.isyeriHekimi?.imza?.url ||
    firmaImzalari?.isyeriHekimi?.imza ||
    firmaImzalari?.hekim?.signature?.dataUrl ||
    firmaImzalari?.hekim?.signature?.url ||
    firmaImzalari?.hekim?.signature ||
    firmaImzalari?.hekim?.dataUrl ||
    firmaImzalari?.hekim?.url ||
    firmaImzalari?.isyeriHekimi?.dataUrl ||
    firmaImzalari?.isyeriHekimi?.url ||
    "";

  const hekimParafDataUrl =
    firmaImzalari?.hekim?.paraf?.dataUrl ||
    firmaImzalari?.hekim?.paraf?.url ||
    firmaImzalari?.hekim?.paraf ||
    firmaImzalari?.isyeriHekimi?.paraf?.dataUrl ||
    firmaImzalari?.isyeriHekimi?.paraf?.url ||
    firmaImzalari?.isyeriHekimi?.paraf ||
    "";

  const isverenImzaDataUrl =
    firmaImzalari?.isveren?.imza?.dataUrl ||
    firmaImzalari?.isveren?.imza?.url ||
    firmaImzalari?.isveren?.imza ||
    firmaImzalari?.isverenVekili?.imza?.dataUrl ||
    firmaImzalari?.isverenVekili?.imza?.url ||
    firmaImzalari?.isverenVekili?.imza ||
    firmaImzalari?.isveren_vekili?.imza?.dataUrl ||
    firmaImzalari?.isveren_vekili?.imza?.url ||
    firmaImzalari?.isveren_vekili?.imza ||
    firmaImzalari?.isveren?.signature?.dataUrl ||
    firmaImzalari?.isveren?.signature?.url ||
    firmaImzalari?.isveren?.signature ||
    firmaImzalari?.isverenVekili?.signature?.dataUrl ||
    firmaImzalari?.isverenVekili?.signature?.url ||
    firmaImzalari?.isverenVekili?.signature ||
    firmaImzalari?.isveren?.dataUrl ||
    firmaImzalari?.isveren?.url ||
    firmaImzalari?.isverenVekili?.dataUrl ||
    firmaImzalari?.isverenVekili?.url ||
    "";

  const isverenParafDataUrl =
    firmaImzalari?.isveren?.paraf?.dataUrl ||
    firmaImzalari?.isveren?.paraf?.url ||
    firmaImzalari?.isveren?.paraf ||
    firmaImzalari?.isverenVekili?.paraf?.dataUrl ||
    firmaImzalari?.isverenVekili?.paraf?.url ||
    firmaImzalari?.isverenVekili?.paraf ||
    firmaImzalari?.isveren_vekili?.paraf?.dataUrl ||
    firmaImzalari?.isveren_vekili?.paraf?.url ||
    firmaImzalari?.isveren_vekili?.paraf ||
    "";

  return {
    authToken: getBearerToken(user),
    firmaId,
    firma: {
      firmaAdi: selectedFirm?.firmaAdi || "",
      tehlike: selectedFirm?.tehlike || "",
      adres: selectedFirm?.adres || "",
      nace: selectedFirm?.nace || selectedFirm?.naceKodu || "",
      sgkSicilNo: selectedFirm?.sgkSicilNo || selectedFirm?.sgk || "",
      calisanSayisi: calisanSayisi || selectedFirm?.calisanSayisi || "",
      isverenAdSoyad: imzalar.isverenAdi || kisiler?.isveren || "",
    },
   kurumsal: {
  logo: kurumsalPdf.logoBase64 || kurumsalPdf.logoUrl || "",
  logoUrl: kurumsalPdf.logoUrl || "",
  logoBase64: kurumsalPdf.logoBase64 || "",
  firmaLogo: kurumsalPdf.logoBase64 || kurumsalPdf.logoUrl || "",
  kurumsalLogo: kurumsalPdf.logoBase64 || kurumsalPdf.logoUrl || "",
  logoPath: kurumsalPdf.logoUrl || "",
  firmaAdi: selectedFirm?.firmaAdi || "",
},

logo: kurumsalPdf.logoBase64 || kurumsalPdf.logoUrl || "",
logoUrl: kurumsalPdf.logoUrl || "",
logoBase64: kurumsalPdf.logoBase64 || "",
firmaLogo: kurumsalPdf.logoBase64 || kurumsalPdf.logoUrl || "",
       kisiler: {
      uzmanAdSoyad: imzalar.isgUzmaniAdi || kisiler?.uzman || "",
      hekimAdSoyad: imzalar.isyeriHekimiAdi || kisiler?.hekim || "",
      isverenAdSoyad: imzalar.isverenAdi || kisiler?.isveren || "",

      uzman: imzalar.isgUzmaniAdi || kisiler?.uzman || "",
      hekim: imzalar.isyeriHekimiAdi || kisiler?.hekim || "",
      isveren: imzalar.isverenAdi || kisiler?.isveren || "",

      destek: riskDestek || kisiler?.destek || "",
      bilgi: riskBilgi || kisiler?.bilgi || "",
    },
        imzalar: {
      uzman: {
        imza: {
          dataUrl: uzmanImzaDataUrl || "",
        },
        paraf: {
          dataUrl: uzmanParafDataUrl || "",
        },
      },
      hekim: {
        imza: {
          dataUrl: hekimImzaDataUrl || "",
        },
        paraf: {
          dataUrl: hekimParafDataUrl || "",
        },
      },
      isveren: {
        imza: {
          dataUrl: isverenImzaDataUrl || "",
        },
        paraf: {
          dataUrl: isverenParafDataUrl || "",
        },
      },
    },
        isveren: {
      adSoyad: imzalar.isverenAdi || kisiler?.isveren || "",
      imzaDataUrl: isverenImzaDataUrl || "",
    },
    kisisel: {
      sertifikaNo:
        kisiselBilgiler?.sertifikaNo ||
        kisiselBilgiler?.uzmanSertifikaNo ||
        "",
      sertifikaSinifi:
        kisiselBilgiler?.sertifikaSinifi ||
        kisiselBilgiler?.uzmanlikSinifi ||
        "",
    },
    egitim: {
      konu: "Destek / Acil Ekip Eğitimi",
      tarihISO: egitimBilgileri.tarih || "",
      tarihTR: formatDateTR(egitimBilgileri.tarih || ""),
      yer: egitimBilgileri.yer || "",
      saat: Number(egitimBilgileri.saat || 2) || 2,
    },
    oneriler,
    katilimcilar: rows.map((k, i) => ({
      no: i + 1,
      tc: normalizeTC(k.tc),
      adSoyad: (k.adSoyad || "").toLocaleUpperCase("tr-TR"),
      gorev: (k.gorev || "").toLocaleUpperCase("tr-TR"),
      kaynak: k.kaynak || "",
      imzalar: {
        personel: k?.imzalar?.personel || null,
      },
      personelImzalari: {
        personel: k?.imzalar?.personel?.dataUrl || "",
      },
      personelImzasi: k?.imzalar?.personel?.dataUrl || "",
    })),
  };
};

  
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const generateQueuedPdf = async (jobType, payload) => {
    const token = getBearerToken(user);

  const createRes = await fetch(`${API_BASE}/pdf/destek-acil`, {
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
      const text = await createRes.text().catch(() => "");
      throw new Error(text || `PDF işi oluşturulamadı: ${createRes.status}`);
    }

    const createJson = await createRes.json();
    const jobId = createJson?.jobId || createJson?.id;

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
        const text = await statusRes.text().catch(() => "");
        throw new Error(text || `PDF durumu alınamadı: ${statusRes.status}`);
      }

      const statusJson = await statusRes.json();

      if (statusJson?.status === "done") {
        const fileUrl =
          statusJson?.resultFileUrl ||
          statusJson?.fileUrl ||
          statusJson?.url ||
          "";

        if (!fileUrl) {
          throw new Error("PDF tamamlandı ama dosya linki gelmedi.");
        }

        return fileUrl.startsWith("http://") || fileUrl.startsWith("https://")
          ? fileUrl
          : `${API_ORIGIN}${fileUrl.startsWith("/") ? "" : "/"}${fileUrl}`;
      }

      if (statusJson?.status === "error") {
        throw new Error(statusJson?.error || "PDF oluşturma hatası.");
      }
    }

    throw new Error("PDF oluşturma zaman aşımına uğradı.");
  };

  
const handleKatilimFormu = async () => {
  const filled = getRowsForKatilimFormu();

  if (!filled.length) {
    openInfo("Bilgilendirme", "Lütfen en az 1 katılımcı adı girin.");
    return;
  }

  if (!ensureRowsSigned(filled, "Lütfen en az 1 katılımcı adı girin.")) {
    return;
  }

  if (!egitimBilgileri.tarih) {
    openInfo("Bilgilendirme", "Lütfen önce eğitim tarihini girin.");
    return;
  }

  setModalTip("katilim");
  setModalOpen(true);

  let progressTimer = null;

  try {
    setPdfLoading(true);
    setPdfProgress(5);
    setPdfError("");
    setPdfUrl(null);

    progressTimer = setInterval(() => {
      setPdfProgress((prev) => {
        if (prev >= 92) return prev;
        return prev + Math.floor(Math.random() * 6) + 2;
      });
    }, 700);

    const payload = await buildPayload(filled);
    const objectUrl = await generateQueuedPdf(
      "destek-acil-egitim-katilim",
      payload
    );

    if (progressTimer) clearInterval(progressTimer);
    setPdfProgress(100);
    setPdfUrl(objectUrl);

    setTimeout(() => {
      setPdfLoading(false);
    }, 400);
  } catch (e) {
    if (progressTimer) clearInterval(progressTimer);
    setPdfLoading(false);
    setPdfProgress(0);

    console.error(e);
    setPdfError(e.message || "PDF oluşturulamadı.");
    setModalOpen(false);
  } finally {
    if (progressTimer) clearInterval(progressTimer);
  }
};


const handleAtamaFormu = async () => {
  const destek = katilimcilar.find((k) => k.kaynak === "destek");

  if (!destek || !(destek.adSoyad || "").trim()) {
    openInfo("Bilgilendirme", "Lütfen DESTEK ELEMANI adını doldurun.");
    return;
  }

  if (!ensureRowsSigned(getRowsForAtamaFormu(), "Lütfen DESTEK ELEMANI adını doldurun.")) {
    return;
  }

  if (!egitimBilgileri.tarih) {
    openInfo("Bilgilendirme", "Lütfen önce eğitim tarihini girin.");
    return;
  }

  setModalTip("atama");
  setModalOpen(true);

  let progressTimer = null;

  try {
    setPdfLoading(true);
    setPdfProgress(5);
    setPdfError("");
    setPdfUrl(null);

    progressTimer = setInterval(() => {
      setPdfProgress((prev) => {
        if (prev >= 92) return prev;
        return prev + Math.floor(Math.random() * 6) + 2;
      });
    }, 700);

    const basePayload = await buildPayload();

    const payload = {
      ...basePayload,
      tarihISO: egitimBilgileri.tarih || "",
      destek: {
        adSoyad: (destek.adSoyad || "").toLocaleUpperCase("tr-TR"),
        tc: normalizeTC(destek.tc || ""),
        imzalar: {
          personel: destek?.imzalar?.personel || null,
        },
        personelImzalari: {
          personel: destek?.imzalar?.personel?.dataUrl || "",
        },
        personelImzasi: destek?.imzalar?.personel?.dataUrl || "",
      },
    };

    const objectUrl = await generateQueuedPdf("destek-acil-atama", payload);

    if (progressTimer) clearInterval(progressTimer);
    setPdfProgress(100);
    setPdfUrl(objectUrl);

    setTimeout(() => {
      setPdfLoading(false);
    }, 400);
  } catch (e) {
    if (progressTimer) clearInterval(progressTimer);
    setPdfLoading(false);
    setPdfProgress(0);

    console.error(e);
    setPdfError(e.message || "PDF oluşturulamadı.");
    setModalOpen(false);
  } finally {
    if (progressTimer) clearInterval(progressTimer);
  }
};

const getAcilEkipFormData = async () => {
  try {
    const token = getBearerToken(user);

    const res = await fetch(API.acilEkipGet, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!res.ok) {
      return { ok: false, teams: [], meta: null };
    }

    const json = await res.json();
    const data = json?.payload || json || {};
    const teams = Array.isArray(data?.teams) ? data.teams : [];
    const meta = data?.meta || null;

    return {
      ok: teams.length > 0,
      teams,
      meta,
    };
  } catch (e) {
    console.error("Acil ekip formu serverdan okunamadı:", e);
    return { ok: false, teams: [], meta: null };
  }
};

const handleAcilFormu = async (options = {}) => {
  const { silent = false } = options;

  if (!egitimBilgileri.tarih) {
    if (!silent) openInfo("Bilgilendirme", "Lütfen önce eğitim tarihini girin.");
    return;
  }

  const { ok, teams, meta } = await getAcilEkipFormData();

  if (!ok) {
    if (!silent) {
      openInfo("Bilgilendirme", "Lütfen acil durum sekmesindeki bilgileri doldurunuz.");
    }
    return;
  }

  const dependencyValidation = validateAcilPdfDependencies(teams, katilimcilar);

  if (!dependencyValidation.ok) {
    if (!silent) openInfo("Bilgilendirme", dependencyValidation.message);
    return;
  }

  const acilRows = teams.map((t, index) => {
    const localMatch = findMatchingEgitimAcilRow(katilimcilar, t);

    return {
      no: index + 1,
      ekip: (t.ekip || "").toLocaleUpperCase("tr-TR"),
      adSoyad: (t.adSoyad || "").toLocaleUpperCase("tr-TR"),
      tc: normalizeTC(localMatch?.tc || t?.tc || ""),
      gorev: (t.gorev || "").toLocaleUpperCase("tr-TR"),
      ekipGorevi: (t.gorev || "").toLocaleUpperCase("tr-TR"),
      iletisim: t.iletisim || "",
      kaynak: "acil",
      imzalar: {
        personel: localMatch?.imzalar?.personel || null,
      },
      personelImzalari: {
        personel: localMatch?.imzalar?.personel?.dataUrl || "",
      },
      personelImzasi: localMatch?.imzalar?.personel?.dataUrl || "",
    };
  });

  setModalTip("acil");
  setModalOpen(true);

  let progressTimer = null;

  try {
    setPdfLoading(true);
    setPdfProgress(5);
    setPdfError("");
    setPdfUrl(null);

    progressTimer = setInterval(() => {
      setPdfProgress((prev) => {
        if (prev >= 92) return prev;
        return prev + Math.floor(Math.random() * 6) + 2;
      });
    }, 700);

    const base = await buildPayload();

    const payload = {
      authToken: base.authToken,
      firmaId: base.firmaId,

      kurumsal: base.kurumsal,

      firma: {
        firmaAdi: base.firma.firmaAdi,
        adres: base.firma.adres,
        nace: base.firma.nace,
        sgkSicilNo: base.firma.sgkSicilNo,
        tehlikeSinifi: base.firma.tehlike,
        calisanSayisi: meta?.calisanSayisi || base.firma.calisanSayisi,
        isverenAdSoyad: base.firma.isverenAdSoyad || "",
      },

      tarihler: {
        hazirlamaTr: formatDateTR(egitimBilgileri.tarih),
      },

      kisiler: {
        ...base.kisiler,
        isveren: base.kisiler?.isveren || base.kisiler?.isverenAdSoyad || "",
        isverenAdSoyad: base.kisiler?.isverenAdSoyad || "",
      },

      imzalar: {
        ...(base.imzalar || {}),
        isveren: {
          imza: {
            dataUrl: base?.imzalar?.isveren?.imza?.dataUrl || "",
          },
          paraf: {
            dataUrl: base?.imzalar?.isveren?.paraf?.dataUrl || "",
          },
        },
      },

      isveren: {
        adSoyad: base?.isveren?.adSoyad || base.kisiler?.isverenAdSoyad || "",
        imzaDataUrl: base?.isveren?.imzaDataUrl || "",
      },

      egitim: {
        konu: "Destek / Acil Ekip Eğitimi",
        tarihISO: egitimBilgileri.tarih || "",
        tarihTR: formatDateTR(egitimBilgileri.tarih || ""),
        yer: egitimBilgileri.yer || "",
        saat: Number(egitimBilgileri.saat || 2) || 2,
      },

      oneriler: {
        ...(meta?.oneriler || oneriler),
      },

      katilimcilar: acilRows.map((row, index) => ({
        no: index + 1,
        ekip: row.ekip,
        adSoyad: row.adSoyad,
        tc: row.tc,
        gorev: row.gorev,
        ekipGorevi: row.ekipGorevi,
        iletisim: row.iletisim,
        kaynak: row.kaynak || "acil",
        imzalar: {
          personel: row?.imzalar?.personel || null,
        },
        personelImzalari: {
          personel: row?.imzalar?.personel?.dataUrl || "",
        },
        personelImzasi: row?.imzalar?.personel?.dataUrl || "",
      })),

      ekipler: acilRows,

      acilEkip: {
        teams: acilRows,
        yanginOneri: meta?.oneriler?.yangin ?? oneriler.yangin,
        kurtarmaOneri: meta?.oneriler?.kurtarma ?? oneriler.kurtarma,
        korumaOneri: meta?.oneriler?.koruma ?? oneriler.koruma,
        ilkyardimOneri: meta?.oneriler?.ilkyardim ?? oneriler.ilkyardim,
      },
    };

    const objectUrl = await generateQueuedPdf("destek-acil-ekip-formu", payload);

    if (progressTimer) clearInterval(progressTimer);
    setPdfProgress(100);
    setPdfUrl(objectUrl);

    setTimeout(() => {
      setPdfLoading(false);
    }, 400);
  } catch (e) {
    if (progressTimer) clearInterval(progressTimer);
    setPdfLoading(false);
    setPdfProgress(0);

    console.error(e);
    setPdfError(e.message || "PDF oluşturulamadı.");
    setModalOpen(false);
  } finally {
    if (progressTimer) clearInterval(progressTimer);
  }
};


  const closeModal = () => {
    try {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    } catch {}
    setModalOpen(false);
    setModalTip(null);
    setPdfUrl(null);
setPdfLoading(false);
setPdfProgress(0);
setPdfError("");
  };

  const handleYeniSekmedeAc = () => {
    if (!pdfUrl) return;
    window.open(pdfUrl, "_blank", "noopener,noreferrer");
  };

  const handleIndir = async () => {
    try {
      if (!pdfUrl) return;

      const tarihTR = isoToTR(egitimBilgileri?.tarih || "") || `${new Date().getFullYear()}`;

      let baseName = "DESTEK_ACIL";
      if (modalTip === "atama") {
        const destek = katilimcilar.find((k) => k.kaynak === "destek");
        baseName = safeFile(destek?.adSoyad || "DESTEK_ELEMANI");
      } else if (modalTip === "acil") {
        baseName = safeFile(getTopluEtiket("acil", countFilledAcil(katilimcilar)));
      } else {
        baseName = safeFile(getTopluEtiket("katilim", countFilled(katilimcilar)));
      }

      const short =
        modalTip === "atama" ? "ATAMA" : modalTip === "acil" ? "ACIL_EKIP" : "KATILIM";

      const fileName = `${baseName} (DESTEK-ACIL-${short}-${tarihTR}).pdf`;

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
      console.error("Destek/acil PDF indirme hatası:", e);
      openInfo("Hata", "PDF indirilemedi.");
    }
  };

  const handleBelgelerimeKaydet = async () => {
    if (!pdfUrl) return openInfo("Bilgilendirme", "Önce PDF oluşmalı.");
    if (!selectedFirm?.id) return openInfo("Bilgilendirme", "Firma seçili değil.");

    try {
      const raw = localStorage.getItem(EGITIM_DOCS_KEY);
      const list = raw ? JSON.parse(raw) : [];

      const targetISO = toIsoDate(egitimBilgileri.tarih);
      const egitimTR = formatDateTR(egitimBilgileri.tarih) || isoToTR(targetISO);
      const yil = Number((targetISO || "").slice(0, 4)) || new Date().getFullYear();
      const hazirlayan = imzalar.isgUzmaniAdi || getHazirlayanAdSoyad() || "";

      let adSoyad = "DESTEK_ACIL";
      if (modalTip === "atama") {
        const destek = katilimcilar.find((k) => k.kaynak === "destek");
        adSoyad = safeFile(destek?.adSoyad || "DESTEK_ELEMANI");
      } else if (modalTip === "acil") {
        adSoyad = safeFile(getTopluEtiket("acil", countFilledAcil(katilimcilar)));
      } else {
        adSoyad = safeFile(getTopluEtiket("katilim", countFilled(katilimcilar)));
      }

      const kategori =
        modalTip === "atama"
          ? "Atama Formu"
          : modalTip === "acil"
          ? "Acil Durum Ekip Formu"
          : "Eğitim Katılım Formu";

      const short =
        modalTip === "atama"
          ? "ATAMA"
          : modalTip === "acil"
          ? "ACIL_EKIP"
          : "KATILIM";

      const tur =
        modalTip === "atama"
          ? "Destek Elemanı - Atama"
          : modalTip === "acil"
          ? "Acil Durum Ekip - Liste"
          : "Destek/Acil - Katılım";

      const exists =
        Array.isArray(list) &&
        list.some((d) => {
          const docISO = toIsoDate(d?.tarihISO || d?.tarih || d?.createdAt);
          return (
            String(d?.firmaId) === String(selectedFirm.id) &&
            String(d?.belgeTuru || "") === "Destek / Acil Ekip" &&
            String(d?.kategori || "") === String(kategori) &&
            String(d?.adSoyad || "").toLocaleUpperCase("tr-TR") ===
              String(adSoyad).toLocaleUpperCase("tr-TR") &&
            docISO &&
            targetISO &&
            docISO === targetISO
          );
        });

  const doSave = async () => {
  try {
    const token = getBearerToken(user);

    const fileName = `${adSoyad} (DESTEK-ACIL-${short}-${egitimTR}).pdf`;
    const pdfBlob = await fetch(pdfUrl).then((r) => r.blob());

    let uploadedFileUrl = "";
    let uploadedAbsoluteUrl = "";

    const uploadForm = new FormData();
    uploadForm.append("file", pdfBlob, fileName);

    const uploadRes = await fetch(`${API_BASE}/documents/upload-pdf`, {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: uploadForm,
    });

    if (!uploadRes.ok) {
      const text = await uploadRes.text();
      console.error("Destek/acil pdf upload hata:", text);
      openInfo("Hata", "PDF dosyası sunucuya yüklenemedi.");
      return;
    }

    const uploadJson = await uploadRes.json();
    uploadedFileUrl = uploadJson?.fileUrl || "";
    uploadedAbsoluteUrl = uploadJson?.absoluteUrl || "";

    if (!uploadedFileUrl && !uploadedAbsoluteUrl) {
      openInfo("Hata", "PDF sunucuya yüklenmeden Belgelerime Kaydet yapılamaz.");
      return;
    }

    if (token) {
      const res = await fetch(`${API_BASE}/documents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
  firmaId: selectedFirm?.id,
  firmaAdi: selectedFirm?.firmaAdi || "Firma",
  category: "egitim",
  subCategory: tur,
  belgeTuru: "Destek / Acil Ekip",
  belgeTuruAlt: kategori,
  title: `${adSoyad} - ${kategori}`,
  dateISO: targetISO || egitimBilgileri.tarih,
  tarihISO: targetISO || egitimBilgileri.tarih,
  tarih: egitimTR,
  year: yil,

 personName: adSoyad,
adSoyad,
gorev: adSoyad || "",

hazirlayan: hazirlayan || "",
hazirlayanAdSoyad: hazirlayan || "",
hazirlayanKisi: hazirlayan || "",
olusturan: hazirlayan || "",
olusturanAdSoyad: hazirlayan || "",
preparedBy: hazirlayan || "",
preparedByName: hazirlayan || "",
createdByName: hazirlayan || "",
userName: hazirlayan || "",

createdBy: hazirlayan || "",
createdByUserId: user?._id || user?.id || "",

status: "hazir",
durum: "Hazır",
fileUrl: uploadedFileUrl,
absoluteUrl: uploadedAbsoluteUrl,
fileName,
}),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("Server belge kayıt hatası:", text);
        openInfo("Hata", "Belge server kaydına eklenemedi.");
        return;
      }
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
          message: `UYARI:\n${adSoyad} için "${kategori}" belgesi ${egitimTR} tarihinde zaten kayıtlı.\n\nYine de kaydetmek ister misiniz?`,
          confirmText: "Yine de Kaydet",
          cancelText: "İptal",
          variant: "warning",
          onConfirm: doSave,
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
          title="Destek / Acil Ekip Eğitimi"
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

  return (
    <>
      <style>{hideModalHeaderCloseStyle}</style>

      <CardBox className="flex flex-col gap-4">
        <SectionTitle
          title="Destek / Acil Ekip Eğitimi"
          subtitle="Destek elemanı, bilgi sahibi kişi ve acil ekip personelleri için eğitim belgelerini hazırlayabilirsiniz."
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
            <label className="mb-1 block text-xs text-slate-500">Tehlike Sınıfı</label>
            <input
              readOnly
              value={selectedFirm.tehlike || ""}
              className={`${readonlyInputClass} min-w-0 h-11 text-sm`}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-500">Toplam Çalışan Sayısı</label>
            <input
              type="number"
              min="0"
              value={calisanSayisi}
              onChange={(e) => handleCalisanSayisiChange(e.target.value)}
              className={`${editableInputClass} min-w-0 h-11 text-sm`}
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
                value={egitimBilgileri.tarih}
                onChange={(e) => handleEgitimChange("tarih", e.target.value)}
                className="w-full min-w-0 h-11 rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-800 [color-scheme:light]"
                style={{ WebkitAppearance: "none", appearance: "none" }}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-500">Eğitim Yeri</label>
              <input
                type="text"
                value={egitimBilgileri.yer}
                onChange={(e) => handleEgitimChange("yer", e.target.value)}
                className={`${editableInputClass} min-w-0 h-11 text-sm`}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-500">Eğitim Süresi (Saat)</label>
              <input
                type="number"
                min="1"
                value={egitimBilgileri.saat}
                onChange={(e) => handleEgitimChange("saat", e.target.value)}
                className={`${editableInputClass} min-w-0 h-11 text-sm`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-[11px] sm:text-xs text-slate-700">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              Yangın ekibi önerisi: <b>{oneriler.yangin}</b>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              Kurtarma ekibi önerisi: <b>{oneriler.kurtarma}</b>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              Koruma ekibi önerisi: <b>{oneriler.koruma}</b>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              İlkyardım ekibi önerisi: <b>{oneriler.ilkyardim}</b>
            </div>
          </div>
        </div>

        <div className="border rounded-lg p-3 bg-slate-50 text-[11px] sm:text-xs text-slate-700 leading-6">
          Risk değerlendirme prosedüründe kayıtlı destek elemanı:{" "}
          <span className="font-semibold">{riskDestek || "Kayıt bulunamadı"}</span>
          {" • "}
          Bilgi sahibi kişi:{" "}
          <span className="font-semibold">{riskBilgi || "Kayıt bulunamadı"}</span>
          {" • "}
          Acil ekip kaydı:{" "}
          <span className="font-semibold">{countFilledAcil(katilimcilar)} kişi</span>
        </div>

        <div className="border rounded-lg p-4 space-y-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h3 className="text-sm font-semibold text-[#0a2b45]">
              Destek / Acil Ekip Listesi
            </h3>

            <button
              type="button"
              onClick={satirEkle}
              className="w-full md:w-auto px-3 py-2 text-[11px] rounded border border-slate-300 bg-slate-50 hover:bg-slate-100"
            >
              + Yeni Satır Ekle
            </button>
          </div>

          <div className="w-full overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full min-w-[760px] text-xs border table-fixed">
              <thead className="bg-slate-100">
               <tr>
  <th className={`${thClass} w-[56px]`}>No</th>
  <th className={`${thClass} w-[160px] sm:w-[190px]`}>T.C. Kimlik No</th>
  <th className={`${thClass} w-[190px] sm:w-[240px]`}>Adı Soyadı</th>
  <th className={`${thClass} w-[190px] sm:w-[240px]`}>Görevi / Ekibi</th>
  <th className={`${thClass} w-[120px] sm:w-[140px]`}>İmza</th>
</tr>
              </thead>

              <tbody>
                {katilimcilar.map((k, index) => (
                  <tr key={index}>
                    <td className={tdCenter}>
                      <span className="font-medium">{k.no}</span>
                    </td>

                    <td className={tdCell}>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={11}
                        autoComplete="off"
                        className={tableInputClass}
                        value={k.tc || ""}
                        onChange={(e) => handleKatilimciChange(index, "tc", e.target.value)}
                        placeholder="11 hane"
                      />
                    </td>

                    <td className={tdCell}>
                      <input
                        type="text"
                        autoComplete="off"
                        className={tableInputClass}
                        value={k.adSoyad}
                        onChange={(e) => handleKatilimciChange(index, "adSoyad", e.target.value)}
                        placeholder="AD SOYAD"
                      />
                    </td>

                    <td className={tdCell}>
                      <input
                        type="text"
                        autoComplete="off"
                        className={tableInputClass}
                        value={k.gorev}
                        onChange={(e) => handleKatilimciChange(index, "gorev", e.target.value)}
                        placeholder="GÖREV / EKİP"
                      />
                    </td>

                   <td className={tdCenter}>
  <div className="flex items-center justify-center gap-2">
    <button
      type="button"
      onClick={() => openSignatureModal(index)}
      className={signatureButtonClass(k)}
    >
      İmza
    </button>

    <span className="text-[11px] font-medium text-slate-600">
      ({getImzaProgress(k).text})
    </span>
  </div>
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
              onClick={handleKatilimcilarKaydet}
              className="w-full sm:w-auto"
            >
              Katılımcıları Kaydet
            </PrimaryButton>
          </div>

          <p className="text-[11px] text-slate-500 leading-6">
            Destek elemanı, bilgi sahibi kişi ve acil ekip personelleri burada birlikte yönetilir.
            Eğitim tarihini belirledikten sonra katılım formu, atama formu veya acil ekip formu hazırlanabilir.
          </p>
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

          <PrimaryButton
            size="sm"
            onClick={handleAcilFormu}
            className="w-full sm:w-auto"
          >
            Acil Durum Ekip Formu Hazırla
          </PrimaryButton>
        </div>
      </CardBox>

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

      <Modal
  isOpen={modalOpen}
  onClose={closeModal}
  title={
    modalTip === "katilim"
      ? "Destek / Acil Eğitim Katılım Formu"
      : modalTip === "atama"
      ? "Destek Elemanı Atama Formu"
      : modalTip === "acil"
      ? "Acil Durum Ekip Formu"
      : "Önizleme"
  }
  headerActions={
    (modalTip === "katilim" || modalTip === "atama" || modalTip === "acil") ? (
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
  {(modalTip === "katilim" || modalTip === "atama" || modalTip === "acil") && (
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
            onClick={
              modalTip === "atama"
                ? handleAtamaFormu
                : modalTip === "acil"
                ? handleAcilFormu
                : handleKatilimFormu
            }
          >
            Tekrar Dene
          </PrimaryButton>
        </div>
      )}

      {!pdfLoading && !pdfError && pdfUrl && (
        <iframe
          key={pdfUrl}
          title="pdfPreview"
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