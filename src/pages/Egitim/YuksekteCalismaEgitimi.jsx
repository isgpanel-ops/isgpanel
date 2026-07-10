// src/pages/Egitim/YuksekteCalismaEgitimi.jsx
import React, {
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import { SectionTitle, CardBox, PrimaryButton, Modal } from "../../components/ui";
import { FirmaContext } from "../../context/FirmaContext";
import ConfirmModal from "../../components/ui/ConfirmModal";

/* =========================
   ✅ Ortak helper’lar
   ========================= */
const DOCS_SYNC_KEY = "docs:lastChangeAt";

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

const normalizeTC = (v) => (v || "").toString().replace(/\D/g, "").slice(0, 11);

const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

const safeFile = (v) =>
  (v || "")
    .toString()
    .trim()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

const toTR = (isoOrStr) => {
  if (!isoOrStr) return "";
  const s = (isoOrStr || "").toString();
  const iso = s.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split("-");
    return `${d}.${m}.${y}`;
  }
  try {
    const dt = new Date(s);
    if (Number.isNaN(dt.getTime())) return s;
    const dd = String(dt.getDate()).padStart(2, "0");
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const yy = dt.getFullYear();
    return `${dd}.${mm}.${yy}`;
  } catch {
    return s;
  }
};

const pad2 = (n) => String(n).padStart(2, "0");
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

const toAbsoluteUrl = (base, url) => {
  const u = (url || "").toString().trim();
  if (!u) return "";
  if (u.startsWith("data:image/")) return u;
  if (/^https?:\/\//i.test(u)) return u;

  const b = (base || "").toString().replace(/\/+$/, "");
  if (!b) return u;

  return `${b}${u.startsWith("/") ? "" : "/"}${u}`;
};

const getDistinctDateCount = (records) => {
  const set = new Set();
  for (const r of records || []) {
    const t = (r?.egitimTarihi || "").toString();
    if (t) set.add(t);
  }
  return set.size;
};

const createEmptySignatureRecord = () => ({
  dataUrl: "",
  createdAt: "",
});

const createEmptyImzaState = () => ({
  personel: null,
});

const getImzaProgress = (row) => {
  const completed = row?.imzalar?.personel?.dataUrl ? 1 : 0;
  return {
    completed,
    total: 1,
    text: `${completed}/1`,
  };
};

const createEmptyRow = (no = 1) => ({
  no,
  secili: false,
  tc: "",
  adSoyad: "",
  gorev: "",
  egitimTarihi: "",
  imzalar: createEmptyImzaState(),
  personelFoto: "",
});

export default function YuksekteCalismaEgitimi() {
  const { selectedFirm } = useContext(FirmaContext);

  const RAW_API_ORIGIN =
    (import.meta.env.VITE_API_URL || import.meta.env.VITE_API || "").trim() ||
    "https://api.isgpanel.tr";

  const API_ORIGIN = RAW_API_ORIGIN.replace(/\/+$/, "").replace(/\/api$/i, "");
  const API_BASE = `${API_ORIGIN}/api`;

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
    saat: "4",
  });

  const [topluTarih, setTopluTarih] = useState("");
  const [katilimcilar, setKatilimcilar] = useState([createEmptyRow()]);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalTip, setModalTip] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
const [pdfLoading, setPdfLoading] = useState(false);
const [pdfProgress, setPdfProgress] = useState(0);

  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkSaveLoading, setBulkSaveLoading] = useState(false);

  const [katilimciLoading, setKatilimciLoading] = useState(false);
  const [katilimciSaving, setKatilimciSaving] = useState(false);

  const [signatureModalOpen, setSignatureModalOpen] = useState(false);
  const [activeSignatureRowIndex, setActiveSignatureRowIndex] = useState(null);
  const [signatureDrawingEmpty, setSignatureDrawingEmpty] = useState(true);
  const [signatureConsentChecked, setSignatureConsentChecked] = useState(false);
  const [signatureDraftRow, setSignatureDraftRow] = useState(null);

  const canvasRef = useRef(null);
  const canvasWrapRef = useRef(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef({ x: 0, y: 0 });

  const readonlyInputClass =
    "w-full min-w-0 h-11 rounded-lg border border-gray-300 bg-slate-50 px-4 text-sm text-gray-800";
  const editableInputClass =
    "w-full min-w-0 h-11 rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 [color-scheme:light]";

  const tableInputClass =
    "w-full min-w-[140px] sm:min-w-0 h-11 rounded-lg border border-gray-300 bg-white px-3 text-xs sm:text-sm text-gray-800 text-center focus:outline-none focus:ring-2 focus:ring-blue-500/30";

  const firmaId = selectedFirm?._id || selectedFirm?.id || "default";

  const API = useMemo(() => {
    return {
      katilimPdf: `${API_BASE}/yuksekte-calisma/katilim/pdf`,
      katilimBulkZip: `${API_BASE}/yuksekte-calisma/katilim/pdf-bulk`,
      sertifikaPdf: `${API_BASE}/yuksekte-calisma/sertifika/pdf`,
      sertifikaBulkZip: `${API_BASE}/yuksekte-calisma/sertifika/pdf-bulk`,
      katilimciList: `${API_BASE}/yuksekte-calisma/katilimcilar`,
      katilimciSave: `${API_BASE}/yuksekte-calisma/katilimcilar`,
    };
  }, [API_BASE]);

  const hideModalHeaderCloseStyle = `
    .pdf-onizleme-modal button[aria-label="Close"],
    .pdf-onizleme-modal button[aria-label="Kapat"],
    .pdf-onizleme-modal button[aria-label="close"]{
      display: none !important;
    }
  `;

  const isEmptyRow = (row) => {
    const fields = [row.tc, row.adSoyad, row.gorev, row.egitimTarihi];
    return fields.every((v) => !v || (typeof v === "string" && v.trim() === ""));
  };

  const rowHasSignature = (row) => !!row?.imzalar?.personel?.dataUrl;

const rowHasPhoto = (row) => !!row?.personelFoto;

  const resetRowSignature = (row) => ({
    ...row,
    imzalar: createEmptyImzaState(),
  });

  const isCriticalSignatureField = (field) =>
    ["tc", "adSoyad", "gorev", "egitimTarihi"].includes(field);

  const getMissingSignatureLabels = (row) => {
    return row?.imzalar?.personel?.dataUrl ? [] : ["Personel İmzası"];
  };

  const normalizeRowsFromServer = useCallback((rows) => {
    const arr = Array.isArray(rows) ? rows : [];

    const cleaned = arr
      .map((item, i) => ({
        no: i + 1,
        secili: false,
        tc: item?.tc || "",
        adSoyad: item?.adSoyad || "",
        gorev: item?.gorev || "",
        egitimTarihi: item?.egitimTarihi || "",
personelFoto: item?.personelFoto || item?.personelFotoDataUrl || "",
imzalar: {
  ...createEmptyImzaState(),
  ...(item?.imzalar || {}),
},
      }))
      .filter((row) => !isEmptyRow(row));

    return cleaned.length ? cleaned : [createEmptyRow()];
  }, []);

  const getHazirlayanAdSoyad = () => {
    try {
      const kisiler = JSON.parse(localStorage.getItem(`risk_prosedur_kisiler_${firmaId}`) || "{}");

      const candidates = [
        kisiler?.isgUzmaniAdSoyad,
        kisiler?.uzmanAdSoyad,
        kisiler?.uzmanAdiSoyadi,
        kisiler?.isgUzmani,
        kisiler?.uzman,
        kisiler?.hazirlayan,
        kisiler?.adSoyad,
        kisiler?.adiSoyadi,
      ].filter(Boolean);

      if (candidates.length) return candidates[0].toString().trim();
    } catch {}

    try {
      const k = JSON.parse(localStorage.getItem("kisiselBilgiler") || "{}");
      const candidates = [k?.adSoyad, k?.adiSoyadi, k?.nameSurname, k?.fullName].filter(Boolean);
      if (candidates.length) return candidates[0].toString().trim();
    } catch {}

    return "";
  };

  const fetchKatilimcilarFromServer = useCallback(async () => {
    if (!selectedFirm?.id) {
      setKatilimcilar([createEmptyRow()]);
      return;
    }

    try {
      setKatilimciLoading(true);

      const token = getAuthToken(user);
      const res = await fetch(`${API.katilimciList}?firmaId=${selectedFirm.id}`, {
        method: "GET",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Katılımcı listesi alınamadı (${res.status}): ${text || "Bilinmeyen hata"}`);
      }

      const data = await res.json().catch(() => null);
      const rows = data?.items || data?.katilimcilar || data?.participants || [];
      setKatilimcilar((prev) => {
  const normalized = normalizeRowsFromServer(rows);

  return normalized.map((serverRow) => {
    const localRow = prev.find(
      (p) =>
        normalizeTC(p.tc) === normalizeTC(serverRow.tc) &&
        (p.adSoyad || "") === (serverRow.adSoyad || "")
    );

    return {
      ...serverRow,

      personelFoto:
        serverRow.personelFoto ||
        serverRow.personelFotoDataUrl ||
        localRow?.personelFoto ||
        "",

      imzalar: {
        ...createEmptyImzaState(),
        ...(serverRow.imzalar || {}),
        personel:
          serverRow?.imzalar?.personel ||
          localRow?.imzalar?.personel ||
          null,
      },
    };
  });
});
    } catch (e) {
      console.error("Katılımcılar serverdan yüklenemedi:", e);
      setKatilimcilar([createEmptyRow()]);
      openInfo("Hata", "Katılımcı listesi yüklenemedi.");
    } finally {
      setKatilimciLoading(false);
    }
  }, [API.katilimciList, normalizeRowsFromServer, selectedFirm?.id, user]);

  const persistKatilimcilarToServer = useCallback(
    async (rows) => {
      try {
        if (!selectedFirm?.id) return;

        const token = getAuthToken(user);
        const doluSatirlar = (rows || []).filter((row) => !isEmptyRow(row));

       const arrToSave = doluSatirlar.map(
  ({ tc, adSoyad, gorev, egitimTarihi, imzalar, personelFoto }) => ({
    tc: normalizeTC(tc),
    adSoyad: (adSoyad || "").toLocaleUpperCase("tr-TR"),
    gorev: (gorev || "").toLocaleUpperCase("tr-TR"),
    egitimTarihi: egitimTarihi || "",
    personelFoto: personelFoto || "",
    imzalar: {
      personel: imzalar?.personel || null,
    },
  })
);

        const res = await fetch(API.katilimciSave, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            firmaId: selectedFirm.id,
            firmaAdi: selectedFirm.firmaAdi || "",
            egitimTuru: "Yüksekte Çalışma Eğitimi",
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
  throw err;
}
    },
    [API.katilimciSave, selectedFirm?.id, selectedFirm?.firmaAdi, user]
  );

  useEffect(() => {
    if (!selectedFirm?.id) return;

    const firmIdLocal = selectedFirm.id;
    const pickFirst = (...vals) => vals.find((v) => String(v || "").trim()) || "";
    const hasAny = (obj) => Object.values(obj || {}).some((x) => String(x || "").trim());

    let alive = true;

    const fetchKisiler = async () => {
      const token = getAuthToken(user);
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
            isveren: pickFirst(p?.isveren, p?.isverenVekili, p?.isverenAdSoyad, p?.isverenVekiliAdSoyad),
          };
          if (hasAny(next)) return next;
        }
      } catch {}

      return null;
    };

    (async () => {
      const kisiler = await fetchKisiler();

      let kisisel = null;
      try {
        kisisel = JSON.parse(localStorage.getItem("kisiselBilgiler") || "null");
      } catch {}

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

    let alive = true;

    const loadKurumsal = async () => {
      try {
        const token = getAuthToken(user);

        const fromFirm = {
          logoUrl: selectedFirm?.logoUrl || selectedFirm?.logo || selectedFirm?.kurumsalLogo || "",
          logoBase64: selectedFirm?.logoBase64 || selectedFirm?.logoData || "",
        };

        if (fromFirm.logoUrl || fromFirm.logoBase64) {
          if (!alive) return;
          setServerKurumsal({
            logoUrl: toAbsoluteUrl(API_ORIGIN, fromFirm.logoUrl || ""),
            logoBase64: fromFirm.logoBase64 || "",
          });
          return;
        }

        const endpoints = [
          `${API_BASE}/firma/${selectedFirm.id}`,
          `${API_BASE}/firma/${selectedFirm.id}/kurumsal`,
          `${API_BASE}/firma/${selectedFirm.id}/kurumsal-bilgiler`,
          `${API_BASE}/company/${selectedFirm.id}`,
        ];

        for (const url of endpoints) {
          try {
            const res = await fetch(url, {
              headers: {
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
            });

            if (!res.ok) continue;

            const data = await res.json();
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

            if (rawLogo || logoBase64) {
              if (!alive) return;

              setServerKurumsal({
                logoUrl: toAbsoluteUrl(API_ORIGIN, rawLogo || ""),
                logoBase64: logoBase64 || "",
              });
              return;
            }
          } catch {}
        }
      } catch (e) {
        console.error("Logo çekilemedi:", e);
      }
    };

    loadKurumsal();

    return () => {
      alive = false;
    };
  }, [API_BASE, API_ORIGIN, selectedFirm?.id, selectedFirm, user]);

  useEffect(() => {
    if (!selectedFirm) return;

    setEgitimBilgileri((prev) => ({
      ...prev,
      yer: selectedFirm.firmaAdi || prev.yer || "",
    }));

    setTopluTarih("");
    setModalOpen(false);
    setModalTip(null);
    setPdfUrl(null);
    setPdfLoading(false);
    setBulkLoading(false);
    setBulkSaveLoading(false);

    fetchKatilimcilarFromServer();
  }, [selectedFirm?.id, selectedFirm?.firmaAdi, fetchKatilimcilarFromServer]);

  useEffect(() => {
    if (!selectedFirm?.id) return;

    const syncReload = () => {
      fetchKatilimcilarFromServer();
    };

    const onStorage = (e) => {
      if (e.key === DOCS_SYNC_KEY) fetchKatilimcilarFromServer();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") fetchKatilimcilarFromServer();
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
  }, [selectedFirm?.id, fetchKatilimcilarFromServer]);

  const handleEgitimChange = (field, value) => {
    setEgitimBilgileri((prev) => ({ ...prev, [field]: value }));
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

      const nextRow = { ...updated[index], [field]: yeniDeger };
      const changed = String(oldRow?.[field] || "") !== String(yeniDeger || "");

      updated[index] =
        changed && isCriticalSignatureField(field) && rowHasSignature(oldRow)
          ? resetRowSignature(nextRow)
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
    setKatilimcilar((prev) => [
      createEmptyRow(1),
      ...prev.map((k, i) => ({ ...k, no: i + 2 })),
    ]);
  };

  const handleKatilimcilarKaydet = async () => {
    if (!selectedFirm?.id) {
      openInfo("Bilgilendirme", "Firma seçili değil.");
      return;
    }

    try {
      setKatilimciSaving(true);

      const doluSatirlar = katilimcilar.filter((row) => !isEmptyRow(row));

      const eksikImzaliSatirlar = doluSatirlar.filter((row) => {
        const missing = getMissingSignatureLabels(row);
        return missing.length > 0;
      });

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

      if (eksikImzaliSatirlar.length > 0) {
        const ilkEksik = eksikImzaliSatirlar[0];
        openInfo(
          "Eksik İmza Uyarısı",
          `${ilkEksik.adSoyad || "İsimsiz satır"} için personel imzası eksik.`
        );
        return;
      }

    const arrToSave = doluSatirlar.map(
  ({ tc, adSoyad, gorev, egitimTarihi, imzalar, personelFoto }) => ({
    tc: normalizeTC(tc),
    adSoyad: (adSoyad || "").toLocaleUpperCase("tr-TR"),
    gorev: (gorev || "").toLocaleUpperCase("tr-TR"),
    egitimTarihi: egitimTarihi || "",
    personelFoto: personelFoto || "",
    imzalar: {
      personel: imzalar?.personel || null,
    },
  })
);

      const token = getAuthToken(user);

      const res = await fetch(API.katilimciSave, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          firmaId: selectedFirm.id,
          firmaAdi: selectedFirm.firmaAdi || "",
          egitimTuru: "Yüksekte Çalışma Eğitimi",
          katilimcilar: arrToSave,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Kaydetme başarısız (${res.status}): ${text || "Bilinmeyen hata"}`);
      }

     await res.json().catch(() => null);

// Kaydet sonrası ekrandaki mevcut imzalı satırları koru.
// Böylece backend response eksik gelse bile imza UI'dan silinmez.
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
        "Yüksekte çalışma eğitimine katılan personel listesi kaydedildi ✅"
      );
    } catch (e) {
      console.error("Katılımcılar kaydedilemedi:", e);
      openInfo("Hata", "Katılımcı listesi kaydedilirken hata oluştu.");
    } finally {
      setKatilimciSaving(false);
    }
  };

  const seciliKayitlar = useMemo(() => katilimcilar.filter((k) => k.secili), [katilimcilar]);
  const hasSelection = seciliKayitlar.length > 0;
  const canApplyBulkDate = hasSelection && !!topluTarih;

  const handleTopluTarihUygula = () => {
    if (!canApplyBulkDate) return;
    setKatilimcilar((prev) =>
      prev.map((k) => {
        if (!k.secili) return k;

        const nextRow = { ...k, egitimTarihi: topluTarih };
        const tarihDegisti = String(k?.egitimTarihi || "") !== String(topluTarih || "");

        return tarihDegisti && rowHasSignature(k) ? resetRowSignature(nextRow) : nextRow;
      })
    );
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

  const saveSignatureDrawing = () => {
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

    const updatedRows = katilimcilar.map((row, idx) =>
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



setKatilimcilar(updatedRows);
forceCloseSignatureModal();


  };

 

 const buildPayloadSingle = (record) => {
  const t = record?.egitimTarihi || "";

  let kurumsal = {};
  try {
    const raw = localStorage.getItem("kurumsalBilgiler");
    const k = raw ? JSON.parse(raw) : null;

    const localLogoUrl = k?.logoUrl || k?.logoURL || "";
    const localLogoBase64 =
      k?.logoBase64 ||
      k?.logoB64 ||
      (typeof k?.logo === "string" && k.logo.startsWith("data:image") ? k.logo : "");

    const firmLogoUrl = selectedFirm?.logoUrl || selectedFirm?.logo || selectedFirm?.kurumsalLogo || "";
    const firmLogoBase64 = selectedFirm?.logoBase64 || selectedFirm?.logoData || "";

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

    kurumsal = {
      logoUrl: finalLogoUrl,
      logo: finalLogoBase64,
      logoBase64: finalLogoBase64,
      logoB64: finalLogoBase64,
      firmaAdi:
        k?.firmaAdi ||
        k?.unvan ||
        k?.unvanAdi ||
        k?.title ||
        k?.companyName ||
        "",
    };
  } catch {
    kurumsal = {
      logoUrl: serverKurumsal.logoUrl || "",
      logo: serverKurumsal.logoBase64 || "",
      logoBase64: serverKurumsal.logoBase64 || "",
      logoB64: serverKurumsal.logoBase64 || "",
      firmaAdi: selectedFirm?.firmaAdi || "",
    };
  }

  const kisiler = JSON.parse(localStorage.getItem(`risk_prosedur_kisiler_${firmaId}`) || "{}");

  let kisisel = {};
  try {
    kisisel = JSON.parse(localStorage.getItem("kisiselBilgiler") || "{}");
  } catch {
    kisisel = {};
  }

  return {
    authToken: getAuthToken(user) || "",
    firmaId,
    firmaIdMongo: selectedFirm?._id || selectedFirm?.id || "",
    firma: {
      _id: selectedFirm?._id || selectedFirm?.id || "",
      id: selectedFirm?.id || selectedFirm?._id || "",
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
      konu: "Yüksekte Çalışma Eğitimi",
      yer: egitimBilgileri.yer || "",
      saat: egitimBilgileri.saat || "4",
      baslangicISO: t,
      bitisISO: t,
    },

    katilimcilar: [
      {
        no: 1,
        tc: normalizeTC(record?.tc),
        adSoyad: record?.adSoyad || "",
        gorev: record?.gorev || "",
        egitimTarihi: t,
        imzalar: {
  personel: record?.imzalar?.personel || null,
},

personelImzalari: {
  personel: record?.imzalar?.personel?.dataUrl || "",
},

personelImzasi: record?.imzalar?.personel?.dataUrl || "",
personelFoto: record?.personelFoto || "",
personelFotoDataUrl: record?.personelFoto || "",
      },
    ],

   personel: {
  tc: normalizeTC(record?.tc),
  adSoyad: record?.adSoyad || "",
  gorev: record?.gorev || "",
  personelFoto: record?.personelFoto || "",
  personelFotoDataUrl: record?.personelFoto || "",
},
  };
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
      const outH = 480;

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
        sh = img.height;
        sw = img.height * targetRatio;
        sx = (img.width - sw) / 2;
      } else {
        sw = img.width;
        sh = img.width / targetRatio;
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

    const updatedRows = katilimcilar.map((row, i) =>
      i === index
        ? {
            ...row,
            personelFoto: dataUrl,
          }
        : row
    );

    setKatilimcilar(updatedRows);

    await persistKatilimcilarToServer(updatedRows);
  } catch (e) {
    console.error("Fotoğraf yükleme hatası:", e);

    openInfo("Hata", "Fotoğraf kaydedilemedi.");
  }
};

const buildBulkPayload = (records) => {
  let kisisel = {};
  try {
    kisisel = JSON.parse(localStorage.getItem("kisiselBilgiler") || "{}");
  } catch {
    kisisel = {};
  }

  return {
    authToken: getAuthToken(user) || "",
    firmaId,
    firmaIdMongo: selectedFirm?._id || selectedFirm?.id || "",
    firma: {
      _id: selectedFirm?._id || selectedFirm?.id || "",
      id: selectedFirm?.id || selectedFirm?._id || "",
      firmaAdi: selectedFirm?.firmaAdi || "",
      tehlike: selectedFirm?.tehlike || "",
    },
    kurumsal: {
      logoUrl: serverKurumsal.logoUrl || "",
      logo: serverKurumsal.logoBase64 || "",
      logoBase64: serverKurumsal.logoBase64 || "",
      logoB64: serverKurumsal.logoBase64 || "",
      firmaAdi: selectedFirm?.firmaAdi || "",
    },

    imzalar: {
      isgUzmaniAdi: imzalar.isgUzmaniAdi || "",
      isyeriHekimiAdi: imzalar.isyeriHekimiAdi || "",
      isverenAdi: imzalar.isverenAdi || "",
    },

    kisiler: {
      uzman: imzalar.isgUzmaniAdi || "",
      hekim: imzalar.isyeriHekimiAdi || "",
      isveren: imzalar.isverenAdi || "",
    },

    kisisel: {
      adSoyad: kisisel?.adSoyad || "",
      meslek: kisisel?.meslek || "",
      sertifikaSinifi: kisisel?.sertifikaSinifi || "",
      sertifikaNo: kisisel?.sertifikaNo || "",
    },

    egitim: {
      konu: "Yüksekte Çalışma Eğitimi",
      yer: egitimBilgileri.yer || "",
      saat: egitimBilgileri.saat || "4",
    },

    katilimcilar: (records || []).map((r, i) => ({
      no: i + 1,
      tc: normalizeTC(r?.tc),
      adSoyad: r?.adSoyad || "",
      gorev: r?.gorev || "",
      egitimTarihi: r?.egitimTarihi || "",
      imzalar: {
        personel: r?.imzalar?.personel || null,
      },
      personelImzalari: {
        personel: r?.imzalar?.personel?.dataUrl || "",
      },
      personelImzasi: r?.imzalar?.personel?.dataUrl || "",
personelFoto: r?.personelFoto || "",
personelFotoDataUrl: r?.personelFoto || "",
    })),
  };
};

  const postBlob = async (url, payload) => {
    const token = getAuthToken(user);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`İstek başarısız (${res.status}): ${text || "Bilinmeyen hata"}`);
    }
    return await res.blob();
  };

  const ensureSelectedRowsSigned = (rows) => {
    const eksikImzaliSecili = (rows || []).filter((row) => {
      const missing = getMissingSignatureLabels(row);
      return missing.length > 0;
    });

    if (eksikImzaliSecili.length > 0) {
      const ilkEksik = eksikImzaliSecili[0];
      openInfo(
        "Eksik İmza Uyarısı",
        `${ilkEksik.adSoyad || "İsimsiz satır"} için personel imzası eksik.`
      );
      return false;
    }

    return true;
  };

  const handleTopluKatilimZipIndir = async () => {
    if (!hasSelection) return;
    if (!ensureSelectedRowsSigned(seciliKayitlar)) return;

    const anyMissing = seciliKayitlar.some((r) => !r.egitimTarihi);
    if (anyMissing) {
      openInfo("Bilgilendirme", "Seçili personellerin eğitim tarihi eksik. Lütfen tamamlayın.");
      return;
    }

    try {
      setBulkLoading(true);
      const payload = buildBulkPayload(seciliKayitlar);
      const blob = await postBlob(API.katilimBulkZip, payload);
      const firmaAdi = (selectedFirm?.firmaAdi || "firma").toString().replace(/\s+/g, "_");
      downloadBlob(blob, `${firmaAdi}_yuksekte_calisma_katilim_formlari.zip`);
    } catch (e) {
      console.error(e);
      openInfo("Hata", `Toplu katılım ZIP hazırlanırken hata: ${e.message}`);
    } finally {
      setBulkLoading(false);
    }
  };

  const handleTopluSertifikaZipIndir = async () => {
    if (!hasSelection) return;
    if (!ensureSelectedRowsSigned(seciliKayitlar)) return;

    const anyMissing = seciliKayitlar.some((r) => !r.egitimTarihi);
    if (anyMissing) {
      openInfo("Bilgilendirme", "Seçili personellerin eğitim tarihi eksik. Lütfen tamamlayın.");
      return;
    }

    try {
      setBulkLoading(true);
      const payload = buildBulkPayload(seciliKayitlar);
      const blob = await postBlob(API.sertifikaBulkZip, payload);
      const firmaAdi = (selectedFirm?.firmaAdi || "firma").toString().replace(/\s+/g, "_");
      downloadBlob(blob, `${firmaAdi}_yuksekte_calisma_sertifikalar.zip`);
    } catch (e) {
      console.error(e);
      openInfo("Hata", `Toplu sertifika ZIP hazırlanırken hata: ${e.message}`);
    } finally {
      setBulkLoading(false);
    }
  };

  const openModal = async (tip) => {
let progressTimer = null;

  if (!hasSelection) return;
  if (!ensureSelectedRowsSigned(seciliKayitlar)) return;

  if (tip === "katilim") {
    if (seciliKayitlar.length > 1) {
      openInfo(
        "Bilgilendirme",
        "Eğitim Katılım Formu için yalnızca 1 personel seçebilirsiniz. Birden fazla personel için Toplu Katılım Formu İndir (ZIP) butonunu kullanınız."
      );
      return;
    }

    const anyMissing = seciliKayitlar.some((r) => !r.egitimTarihi);
    if (anyMissing) {
      openInfo("Bilgilendirme", "Seçili personelin eğitim tarihi eksik. Lütfen tamamlayın.");
      return;
    }
  }

  setModalTip(tip);
  setModalOpen(true);

  const first = seciliKayitlar[0];
  const singlePayload = buildPayloadSingle(first);

 try {
  setPdfLoading(true);
  setPdfProgress(5);
  setPdfUrl(null);

  progressTimer = setInterval(() => {
    setPdfProgress((prev) => {
      if (prev >= 92) return prev;
      return prev + Math.floor(Math.random() * 6) + 2;
    });
  }, 700);

  const url = tip === "katilim" ? API.katilimPdf : API.sertifikaPdf;

 const blob = await postBlob(url, singlePayload);
const objectUrl = URL.createObjectURL(blob);

clearInterval(progressTimer);
setPdfProgress(100);
setPdfUrl(objectUrl);

setTimeout(() => {
  setPdfLoading(false);
}, 400);

 } catch (e) {
  clearInterval(progressTimer);
  setPdfLoading(false);
  setPdfProgress(0);

  console.error(e);
  openInfo("Hata", `PDF hazırlanırken hata: ${e.message}`);
  setModalOpen(false);
} finally {
  clearInterval(progressTimer);
}

};

  const closeModal = () => {
    setModalOpen(false);
    setModalTip(null);
    setPdfUrl(null);
setPdfLoading(false);
setPdfProgress(0);
  };

  const handleYeniSekmedeAc = () => {
    if (!pdfUrl) return;
    window.open(pdfUrl, "_blank");
  };

  const handleIndir = async () => {
    try {
      if (!pdfUrl) return;

      const first = seciliKayitlar?.[0];
      const adSoyad = safeFile(first?.adSoyad || "PERSONEL");
      const egitimTR = toTR(first?.egitimTarihi) || toTR(new Date().toISOString());

      const short = modalTip === "sertifika" ? "SERTIFIKA" : "KATILIM";
      const fileName = `${adSoyad} (YUKSEKTE-${short}-${egitimTR}).pdf`;

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
      console.error("Yüksekte çalışma PDF indirme hatası:", e);
      openInfo("Hata", "PDF indirilemedi.");
    }
  };

  const handleBelgelerimeKaydet = async () => {
    if (!pdfUrl) return openInfo("Bilgilendirme", "Önce PDF oluşmalı.");
    if (!selectedFirm?.id) return openInfo("Bilgilendirme", "Firma seçili değil.");
    if (!hasSelection) return openInfo("Bilgilendirme", "Seçili personel yok.");
    if (!ensureSelectedRowsSigned(seciliKayitlar)) return;

    try {
      const token = getAuthToken(user);

if (!token) {
  openInfo("Hata", "Oturum bilgisi bulunamadı. Lütfen tekrar giriş yapın.");
  return;
}

      const first = seciliKayitlar?.[0];
      const adSoyad = safeFile(first?.adSoyad || "PERSONEL");
      const gorev = safeFile(first?.gorev || "");
      const egitimISO = (first?.egitimTarihi || "").toString();

      if (!egitimISO) {
        openInfo("Bilgilendirme", "Bu personelin eğitim tarihi boş. Lütfen eğitim tarihini girin.");
        return;
      }

      const targetISO = toIsoDate(egitimISO);
      const egitimTR = toTR(targetISO) || toTR(egitimISO);

      const yil = Number((targetISO || "").slice(0, 4)) || new Date().getFullYear();
      const hazirlayan = imzalar.isgUzmaniAdi || getHazirlayanAdSoyad() || "";

      const kategori = modalTip === "sertifika" ? "Sertifika" : "Eğitim Katılım Formu";
      const short = modalTip === "sertifika" ? "SERTIFIKA" : "KATILIM";

      // Server-only akışta local liste kontrolü yapılmaz.
const exists = false;

      const doSave = async () => {
        try {
          

          const fileName = `${adSoyad} (YUKSEKTE-${short}-${egitimTR}).pdf`;
          const pdfBlob = await fetch(pdfUrl).then((r) => r.blob());

          let uploadedFileUrl = "";
          let uploadedAbsoluteUrl = "";

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
  console.error("Yüksekte çalışma pdf upload hata:", text);
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

          const yeniBelge = {
            id: Date.now(),
            firmaId: selectedFirm?.id,
            firmaAdi: selectedFirm?.firmaAdi || "Firma",
            adSoyad,
            gorev,
            tur: `Yüksekte çalışma - ${modalTip === "sertifika" ? "sertifika" : "katılım formu"}`,
            kategori,
            belgeTuru: "Yüksekte Çalışma",
            baslik: `${adSoyad} - ${kategori}`,
            yil,
            durum: "Hazır",
            status: "hazir",
            tarih: egitimTR,
            tarihISO: targetISO || egitimISO,
            hazirlayan: hazirlayan || "",
            dosyaTuru: "PDF",
            fileType: "PDF",
            fileUrl: uploadedFileUrl,
absoluteUrl: uploadedAbsoluteUrl,
            fileName,
            createdAt: new Date().toISOString(),
          };

         

          try {
            const token = getAuthToken(user);
            {
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
                  title: yeniBelge.baslik,
                  dateISO: yeniBelge.tarihISO,
                  year: yeniBelge.yil,
                  personName: yeniBelge.adSoyad,
adSoyad: yeniBelge.adSoyad,
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
fileUrl: yeniBelge.fileUrl,
absoluteUrl: yeniBelge.absoluteUrl,
fileName: yeniBelge.fileName,
                }),
              });

              if (!res.ok) {
                const text = await res.text().catch(() => "");
                console.error("Admin belgelerime kaydedilemedi:", text);
              } else {
                try {
                  localStorage.setItem(DOCS_SYNC_KEY, String(Date.now()));
                } catch {}
                window.dispatchEvent(new Event(DOCS_SYNC_KEY));
              }
            }
          } catch (e) {
            console.error("Admin belgelerime kaydedilemedi:", e);
          }

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
          title="Yüksekte Çalışma Eğitimi"
          subtitle="Devam etmek için lütfen sağ üstten bir firma seçiniz."
        />
      </CardBox>
    );
  }

  return (
    <>
      <style>{hideModalHeaderCloseStyle}</style>

      <CardBox className="flex flex-col gap-4">
        <SectionTitle
          title="Yüksekte Çalışma Eğitimi – Eğitim Katılım Formu"
          subtitle="Tek tarih ve tek personel imzası üzerinden ilerlenir."
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
            <label className="mb-1 block text-xs text-slate-500">Eğitimin Verildiği Yer</label>
            <input
              type="text"
              value={egitimBilgileri.yer}
              onChange={(e) => handleEgitimChange("yer", e.target.value)}
              className={`${editableInputClass} min-w-0 h-11 text-sm`}
            />
          </div>
        </div>

        <div className="border rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold text-[#0a2b45]">Eğitim Bilgileri</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <label className="mb-1 block text-xs text-slate-500">Eğitim Konusu</label>
              <input
                readOnly
                value="Yüksekte Çalışma Eğitimi"
                className={`${readonlyInputClass} min-w-0 h-11 text-sm`}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Eğitim Süresi (saat)</label>
              <input
                type="number"
                min="1"
                className={`${editableInputClass} min-w-0 h-11 text-sm`}
                value={egitimBilgileri.saat}
                onChange={(e) => handleEgitimChange("saat", e.target.value)}
              />
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            NOT: Bu eğitim tek gün/tek tarih mantığıyla ilerler. Bitiş tarihi yoktur.
          </p>
        </div>

        <div className="border rounded-lg p-4 space-y-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h3 className="text-sm font-semibold text-[#0a2b45]">
              Yüksekte Çalışma Eğitimine Katılan Personel
            </h3>

            <div className="flex flex-wrap items-end gap-2 text-xs">
              <div>
                <label className="block text-[10px] text-slate-500 mb-0.5">Toplu Eğitim Tarihi</label>
                <input
                  type="date"
                  className="w-full min-w-[180px] sm:min-w-0 h-11 rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-800 [color-scheme:light]"
                  style={{ WebkitAppearance: "none", appearance: "none" }}
                  value={topluTarih}
                  onChange={(e) => setTopluTarih(e.target.value)}
                />
              </div>

              <PrimaryButton size="sm" disabled={!canApplyBulkDate} onClick={handleTopluTarihUygula}>
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

          {katilimciLoading && (
            <div className="text-xs text-slate-500">Katılımcı listesi yükleniyor...</div>
          )}

          <div className="w-full overflow-x-auto rounded-lg border">
            <div className="max-h-[360px] overflow-y-auto">
              <table className="min-w-[1180px] w-full text-xs sm:text-sm border-collapse">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="border px-2 py-2 w-10 text-center sticky top-0 bg-slate-100">✓</th>
                    <th className="border px-2 py-2 w-12 text-center sticky top-0 bg-slate-100">No</th>
                    <th className="border px-3 py-2 min-w-[150px] sticky top-0 bg-slate-100">T.C. Numarası</th>
                    <th className="border px-3 py-2 min-w-[220px] sticky top-0 bg-slate-100">Adı Soyadı</th>
                    <th className="border px-3 py-2 min-w-[180px] sticky top-0 bg-slate-100">Görevi</th>
                    <th className="border px-3 py-2 min-w-[150px] sticky top-0 bg-slate-100">Eğitim Tarihi</th>
                    <th className="border px-3 py-2 min-w-[150px] sticky top-0 bg-slate-100 text-center">
                      İmza / Foto
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {katilimcilar.map((k, index) => (
                    <tr key={index}>
                      <td className="border px-2 py-1 text-center">
                        <input
                          type="checkbox"
                          checked={k.secili || false}
                          onChange={() => handleSecimToggle(index)}
                        />
                      </td>
                      <td className="border px-2 py-1 text-center">{k.no}</td>
                      <td className="border px-2 py-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={11}
                          className={tableInputClass}
                          value={k.tc}
                          onChange={(e) => handleKatilimciChange(index, "tc", e.target.value)}
                        />
                      </td>
                      <td className="border px-2 py-2">
                        <input
                          type="text"
                          className={tableInputClass}
                          value={k.adSoyad}
                          onChange={(e) => handleKatilimciChange(index, "adSoyad", e.target.value)}
                        />
                      </td>
                      <td className="border px-2 py-2">
                        <input
                          type="text"
                          className={tableInputClass}
                          value={k.gorev}
                          onChange={(e) => handleKatilimciChange(index, "gorev", e.target.value)}
                        />
                      </td>
                      <td className="border px-2 py-2">
                        <input
                          type="date"
                          className="w-full min-w-[150px] sm:min-w-0 h-11 rounded-lg border border-gray-300 bg-white px-3 text-xs sm:text-sm text-gray-800 text-center [color-scheme:light] focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                          style={{ WebkitAppearance: "none", appearance: "none" }}
                          value={k.egitimTarihi}
                          onChange={(e) => handleKatilimciChange(index, "egitimTarihi", e.target.value)}
                        />
                      </td>
                     <td className="border px-2 py-2 text-center">
  <div className="flex items-center justify-center gap-2">
    <button
      type="button"
      onClick={() => openSignatureModal(index)}
      className={`inline-flex items-center justify-center rounded-md border px-2 py-1 text-[11px] font-medium ${
        rowHasSignature(k)
          ? "border-green-200 bg-green-50 text-green-700"
          : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
      }`}
    >
      İmza
    </button>

    <span className="text-[11px] font-medium text-slate-600">
      ({getImzaProgress(k).text})
    </span>
<label
  title={rowHasPhoto(k) ? "Fotoğraf değiştir" : "Fotoğraf ekle"}
  className={`inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border text-[14px] ${
    rowHasPhoto(k)
      ? "border-green-500 bg-green-50 text-green-700"
      : "border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
  }`}
>
  📷
  <input
    type="file"
    accept="image/*"
    capture="environment"
    className="hidden"
    onChange={(e) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      handlePersonelFotoChange(index, file);
    }}
  />
</label>
  </div>
</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end">
            <PrimaryButton
              size="sm"
              variant="green"
              onClick={handleKatilimcilarKaydet}
              disabled={katilimciSaving || katilimciLoading}
            >
              {katilimciSaving ? "Kaydediliyor..." : "Katılımcıları Kaydet"}
            </PrimaryButton>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-end gap-2 pt-2 border-t border-slate-200">
          <PrimaryButton
            size="sm"
            className="w-full sm:w-auto"
            disabled={!hasSelection || bulkLoading}
            onClick={() => openModal("katilim")}
          >
            Eğitim Katılım Formu Hazırla
          </PrimaryButton>

          <PrimaryButton
            size="sm"
            className="w-full sm:w-auto"
            disabled={!hasSelection || bulkLoading}
            onClick={() => openModal("sertifika")}
          >
            Sertifika Hazırla
          </PrimaryButton>

          <PrimaryButton
            size="sm"
            variant="green"
            className="w-full sm:w-auto"
            disabled={!hasSelection || bulkLoading}
            onClick={handleTopluKatilimZipIndir}
          >
            {bulkLoading ? "Hazırlanıyor..." : "Toplu Katılım Formu İndir (ZIP)"}
          </PrimaryButton>

          <PrimaryButton
            size="sm"
            variant="green"
            className="w-full sm:w-auto"
            disabled={!hasSelection || bulkLoading}
            onClick={handleTopluSertifikaZipIndir}
          >
            {bulkLoading ? "Hazırlanıyor..." : "Toplu Sertifikaları İndir (ZIP)"}
          </PrimaryButton>
        </div>

        {hasSelection && (
  <p className="text-[10px] text-slate-400 text-right">
    Not: Eğitim Katılım Formu tek personel için hazırlanır. Birden fazla personel için Toplu Katılım Formu İndir (ZIP) butonunu kullanınız.
  </p>
)}
      </CardBox>

      <Modal isOpen={signatureModalOpen} onClose={closeSignatureModal} title="Personel İmzası">
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs sm:text-sm text-slate-700">
            <div>
              <strong>Personel:</strong> {getCurrentSignatureRow()?.adSoyad || "-"}
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
  title="Yüksekte Çalışma Eğitimi"
  headerActions={
    <div className="flex flex-col gap-1 w-full sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
      <button
        type="button"
        onClick={handleYeniSekmedeAc}
        disabled={!pdfUrl || pdfLoading || (modalTip !== "katilim" && modalTip !== "sertifika")}
        className="w-full sm:w-auto px-2 py-1 text-[10px] sm:text-xs rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Yeni sekmede aç
      </button>

      <button
        type="button"
        onClick={handleIndir}
        disabled={!pdfUrl || pdfLoading || (modalTip !== "katilim" && modalTip !== "sertifika")}
        className="w-full sm:w-auto px-2 py-1 text-[10px] sm:text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        İndir (PDF)
      </button>

      <button
        type="button"
        onClick={handleBelgelerimeKaydet}
        disabled={!pdfUrl || pdfLoading || (modalTip !== "katilim" && modalTip !== "sertifika")}
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
      title={modalTip === "sertifika" ? "pdfPreviewYuksekteSertifika" : "pdfPreviewYuksekteKatilim"}
      src={pdfUrl}
      className="w-full h-[50vh] sm:h-[60vh] border border-gray-200 rounded"
    />
  )}

  {!pdfLoading && !pdfUrl && (
    <div className="w-full h-[50vh] sm:h-[60vh] flex items-center justify-center text-sm text-gray-600">
      PDF bulunamadı. Lütfen yeniden deneyin.
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