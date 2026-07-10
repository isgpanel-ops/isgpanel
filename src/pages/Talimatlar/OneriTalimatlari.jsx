import React, { useContext, useEffect, useMemo, useState } from "react";
import { CardBox, SectionTitle, PrimaryButton, Modal } from "../../components/ui";
import { FirmaContext } from "../../context/FirmaContext";
import ConfirmModal from "../../components/ui/ConfirmModal";

/* =========================
   ✅ Ortak helper’lar
   ========================= */
const DOCS_SYNC_KEY = "docs:lastChangeAt";

const API_BASE =
  (import.meta.env.VITE_API_URL || import.meta.env.VITE_API || "")
    .trim()
    .replace(/\/+$/, "") || "https://api.isgpanel.tr/api";

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

const normalizeTC = (v) => (v || "").toString().replace(/\D/g, "").slice(0, 11);

const toTitleCaseTR = (text) => {
  if (!text) return "";
  return String(text)
    .toLocaleLowerCase("tr-TR")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toLocaleUpperCase("tr-TR") + w.slice(1))
    .join(" ");
};

const safeFileName = (s) =>
  (s || "")
    .toString()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();

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

const postBlob = async (url, payload, userObj) => {
  const token = getAuthToken(userObj);
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

function formatDateTR(dateStr) {
  if (!dateStr) return "-";

  const isoMatch = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${d}.${m}.${y}`;
  }

  const d = new Date(dateStr);
  if (isNaN(d)) return String(dateStr);

  const gun = String(d.getDate()).padStart(2, "0");
  const ay = String(d.getMonth() + 1).padStart(2, "0");
  const yil = d.getFullYear();
  return `${gun}.${ay}.${yil}`;
}

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

const createEmptyImzaState = () => ({
  genel: null,
});

const rowHasSignature = (row) => !!row?.imzalar?.genel?.dataUrl;

const getMissingSignatureLabels = (row) => {
  if (!String(row?.adSoyad || "").trim()) return [];
  return rowHasSignature(row) ? [] : ["Personel İmzası"];
};

const getImzaProgress = (row) => {
  const completed = rowHasSignature(row) ? 1 : 0;
  return {
    completed,
    total: 1,
    text: `${completed}/1`,
  };
};

/* -------------------- GÖREV → ÖNERİ TALİMATI HARİTASI -------------------- */
const GOREV_TALIMAT_HARITASI = [
  {
    keywords: [
      "inşaat", "insaat", "şantiye", "santiye",

      "inşaat işçisi", "insaat iscisi", "işçi", "isci",
      "kalıpçı", "kalipci", "kalıp ustası", "kalip ustasi",
      "demirci", "inşaat demircisi", "insaat demircisi",
      "betoncu",
      "duvarcı", "duvarci",
      "sıvacı", "sivaci",
      "alçı ustası", "alci ustasi", "alçıcı", "alcici",
      "alçıpan ustası", "alcipan ustasi", "alçıpan",
      "boyacı", "boyaci",
      "badanacı", "badanaci",
      "seramik ustası", "seramikçi", "seramikci",
      "fayans ustası", "fayansçı", "fayansci",
      "mermer ustası", "mermerci",
      "taş ustası", "tas ustasi", "taşçı", "tasci",
      "çatı ustası", "cati ustasi", "çatıcı", "catici",
      "izolasyon ustası", "yalıtım ustası", "yalitim ustasi",
      "mantolama ustası", "mantolama",
      "iskeleci", "iskele kurulum", "iskele kurulum elemanı", "iskele kurulum elemani",
      "inşaat marangozu", "insaat marangozu", "marangoz",
      "pvc doğrama", "pvc dograma",
      "alüminyum doğrama", "aluminyum dograma",
      "cam montaj", "camcı", "camci",

      "elektrikçi", "elektrikci", "şantiye elektrikçisi", "santiye elektrikcisi", "elektrik tesisatçısı", "elektrik tesisatcisi",
      "sıhhi tesisatçı", "sihhi tesisatci", "tesisatçı", "tesisatci",
      "doğalgaz tesisatçısı", "dogalgaz tesisatcisi",
      "klima montaj", "klimacı", "klimaci",
      "havalandırma ustası", "havalandirma ustasi",

      "kaynakçı", "kaynakci",
      "taşlama", "taslama",

      "kepçe operatörü", "kepce operatoru", "kepçe", "kepce",
      "ekskavatör operatörü", "ekskavator operatoru", "ekskavatör", "ekskavator",
      "greyder operatörü", "greyder operatoru", "greyder",
      "forklift operatörü", "forklift operatoru", "forklift",
      "vinç operatörü", "vinc operatoru", "vinç", "vinc",
      "beton pompası operatörü", "beton pompasi operatoru",
      "silindir operatörü", "silindir operatoru",
      "yükleyici operatörü", "yukleyici operatoru", "yükleyici", "yukleyici",

      "kamyon şoförü", "kamyon soforu", "şoför", "sofor",
      "asfalt işçisi", "asfalt iscisi",
      "yol işçisi", "yol iscisi",
      "hafriyat işçisi", "hafriyat iscisi",
      "şantiye temizlik", "santiye temizlik", "temizlik personeli",
    ],
    talimatlar: ["İnşaat Genel Talimat"],
  },
];

function getOnerilenTalimatlar(gorevRaw) {
  if (!gorevRaw) return [];

  const gorev = String(gorevRaw).trim().toLocaleLowerCase("tr-TR");
  if (!gorev) return [];

  const result = [];
  for (const kural of GOREV_TALIMAT_HARITASI) {
    const matched = (kural.keywords || []).some((kw) => gorev.includes(kw));
    if (matched) result.push(...(kural.talimatlar || []));
  }

  return Array.from(new Set(result)).map((t) => toTitleCaseTR(t));
}

/* ========================================================================== */
/*                            ÖNERİ TALİMATLARI                               */
/* ========================================================================== */
export default function OneriTalimatlari() {
  const { selectedFirm } = useContext(FirmaContext);

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

  const [personeller, setPersoneller] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
 const [pdfUrl, setPdfUrl] = useState(null);
const [pdfLoading, setPdfLoading] = useState(false);
const [pdfProgress, setPdfProgress] = useState(0);
  const [bulkLoading, setBulkLoading] = useState(false);

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

  const firmaId = selectedFirm?.id ?? "default";

  const API = useMemo(() => {
    return {
      oneriPdf: `${API_BASE}/talimat/oneri/pdf`,
      oneriBulkZip: `${API_BASE}/talimat/oneri/pdf-bulk`,
      katilimcilarGet: `${API_BASE}/ise-giris/katilimcilar`,
    };
  }, []);

  const hideModalHeaderCloseStyle = `
    .pdf-onizleme-modal button[aria-label="Close"],
    .pdf-onizleme-modal button[aria-label="Kapat"],
    .pdf-onizleme-modal button[aria-label="close"]{
      display: none !important;
    }
  `;

  const signatureButtonClass = (row) =>
    `inline-flex items-center justify-center rounded-lg border px-3 py-1.5 text-[11px] font-medium transition ${
      rowHasSignature(row)
        ? "border-green-300 bg-green-100 text-green-700"
        : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
    }`;

  /* ---------- İŞE GİRİŞ KATILIMCILARINI SERVER'DAN OKU VE ÖNERİ ÜRET ---------- */
  useEffect(() => {
    if (!selectedFirm?.id) {
      setPersoneller([]);
      setSelectedIds([]);
      setModalOpen(false);
      setPdfUrl(null);
      setPdfLoading(false);
      setBulkLoading(false);
      return;
    }

    let cancelled = false;

    const loadPersoneller = async () => {
      try {
        const token = getAuthToken(user);

        const res = await fetch(
          `${API.katilimcilarGet}?firmaId=${selectedFirm.id}`,
          {
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          }
        );

        if (!res.ok) {
          if (!cancelled) setPersoneller([]);
          return;
        }

        const data = await res.json();

        const items =
          Array.isArray(data?.items) ? data.items :
          Array.isArray(data?.payload?.items) ? data.payload.items :
          Array.isArray(data?.katilimcilar) ? data.katilimcilar :
          Array.isArray(data?.payload?.katilimcilar) ? data.payload.katilimcilar :
          [];

        const cleaned = items.filter((k) => {
          const vals = [k.tc, k.adSoyad, k.gorev, k.baslangicTarihi, k.bitisTarihi];
          return vals.some((v) => v && typeof v === "string" && v.trim() !== "");
        });

        const mapped = cleaned.map((k, index) => {
          const gorev = (k.gorev || "").toString();
          const onerilenTalimatlar = getOnerilenTalimatlar(gorev);

          return {
            id: index,
            tc: normalizeTC(k.tc || ""),
            adSoyad: (k.adSoyad || "").toLocaleUpperCase("tr-TR"),
            gorev: (gorev || "").toLocaleUpperCase("tr-TR"),
            baslangicTarihi: k.baslangicTarihi || "",
            bitisTarihi: k.bitisTarihi || "",
            imzalar: {
              ...createEmptyImzaState(),
              ...(k?.imzalar || {}),
            },
            onerilenTalimatlar,
          };
        });

        if (!cancelled) setPersoneller(mapped);
      } catch (e) {
        console.error("Öneri talimatı personelleri serverdan okunamadı:", e);
        if (!cancelled) setPersoneller([]);
      } finally {
        if (!cancelled) {
          setSelectedIds([]);
          setModalOpen(false);
          setPdfUrl(null);
          setPdfLoading(false);
          setBulkLoading(false);
        }
      }
    };

    loadPersoneller();

    return () => {
      cancelled = true;
    };
  }, [selectedFirm?.id, user, API.katilimcilarGet]);

  const oneriliPersoneller = useMemo(
    () => personeller.filter((p) => p.onerilenTalimatlar && p.onerilenTalimatlar.length > 0),
    [personeller]
  );

  const selectedPersons = useMemo(
    () => oneriliPersoneller.filter((p) => selectedIds.includes(p.id)),
    [oneriliPersoneller, selectedIds]
  );

  const hasSelection = selectedIds.length > 0;

  const toggleSelect = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const ensureRowsSigned = (rows, emptyMessage = "İmzalanacak kayıt bulunamadı.") => {
    const targetRows = (rows || []).filter((row) => String(row?.adSoyad || "").trim() !== "");

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

  /* =========================
     ✅ Payload
     ========================= */
  const buildPayloadSingle = (person) => {
    let kisiler = { uzman: "", hekim: "", isveren: "" };
    try {
      const raw = localStorage.getItem(`risk_prosedur_kisiler_${firmaId}`);
      const p = raw ? JSON.parse(raw) : null;
      kisiler = { uzman: p?.uzman || "", hekim: p?.hekim || "", isveren: p?.isveren || "" };
    } catch {
      kisiler = { uzman: "", hekim: "", isveren: "" };
    }

    const tarihISO = person?.bitisTarihi || "";
    const tarihTR = formatDateTR(person?.bitisTarihi || "");

    return {
      authToken: getAuthToken(user),
      firmaId,
      firma: {
        firmaAdi: selectedFirm?.firmaAdi || "",
        tehlike: selectedFirm?.tehlike || "",
      },
      kisiler,
      personel: {
        tc: normalizeTC(person?.tc),
        adSoyad: person?.adSoyad || "",
        gorev: person?.gorev || "",
        imzalar: {
          genel: person?.imzalar?.genel || null,
        },
        personelImzalari: {
          personel: person?.imzalar?.genel?.dataUrl || "",
        },
        personelImzasi: person?.imzalar?.genel?.dataUrl || "",
      },
      talimat: {
        tarihISO,
        tarihTR,
        onerilenTalimatlar: Array.isArray(person?.onerilenTalimatlar)
          ? person.onerilenTalimatlar.map(toTitleCaseTR)
          : [],
        tur: "oneri",
      },
      egitim: {
        baslangicISO: person?.baslangicTarihi || "",
        bitisISO: person?.bitisTarihi || "",
        baslangicTR: formatDateTR(person?.baslangicTarihi || ""),
        bitisTR: formatDateTR(person?.bitisTarihi || ""),
      },
    };
  };

  const buildBulkPayload = (persons) => ({
    firmaId,
    firma: {
      firmaAdi: selectedFirm?.firmaAdi || "",
      tehlike: selectedFirm?.tehlike || "",
    },
    items: (persons || [])
      .filter((p) => String(p?.adSoyad || "").trim() !== "")
      .map((p) => buildPayloadSingle(p)),
  });

  /* =========================
     ✅ Modal aksiyonları
     ========================= */
  const openModal = async () => {
    if (!hasSelection) {
      openInfo("Bilgilendirme", "Lütfen en az 1 personel seçiniz.");
      return;
    }

    if (!ensureRowsSigned(selectedPersons, "Lütfen önce seçilen personellerin imzalarını tamamlayın.")) {
      return;
    }

    const first = selectedPersons[0];
    if (!first) {
      openInfo("Bilgilendirme", "Seçilen personel bulunamadı.");
      return;
    }

    const payload = buildPayloadSingle(first);

   setModalOpen(true);
setPdfLoading(true);
setPdfProgress(5);
setPdfUrl(null);

const progressTimer = setInterval(() => {
  setPdfProgress((prev) => {
    if (prev >= 92) return prev;
    return prev + Math.floor(Math.random() * 6) + 2;
  });
}, 700);

try {
      const blob = await postBlob(API.oneriPdf, payload, user);
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
  openInfo("Hata", `Öneri talimat PDF hazırlanırken hata: ${e.message}`);
  setModalOpen(false);
} finally {
  clearInterval(progressTimer);
}
  };

  const closeModal = () => {
    try {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    } catch {}

setModalOpen(false);
setPdfLoading(false);
setPdfProgress(0);
setPdfUrl(null);
  };

  const handleYeniSekmedeAc = () => {
    if (!pdfUrl) return;
    window.open(pdfUrl, "_blank");
  };

  const getAltTurFromPerson = (person) => {
    const raw =
      Array.isArray(person?.onerilenTalimatlar) && person.onerilenTalimatlar.length > 0
        ? person.onerilenTalimatlar.join(" + ")
        : "Öneri Talimatı";
    return toTitleCaseTR(raw);
  };

  const handleIndir = async () => {
    try {
      if (!pdfUrl) return;

      const first = selectedPersons?.[0];
      const personel = safeFileName(first?.adSoyad || "PERSONEL");
      const altTur = safeFileName(getAltTurFromPerson(first));
      const fileName = `${personel} - ${altTur}.pdf`;

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
      console.error("Öneri talimat PDF indirme hatası:", e);
      openInfo("Hata", "PDF indirilemedi.");
    }
  };

  const handleBelgelerimeKaydet = async () => {
    if (!pdfUrl) return openInfo("Bilgilendirme", "Önce PDF oluşmalı.");

    if (!ensureRowsSigned(selectedPersons, "Lütfen önce seçilen personellerin imzalarını tamamlayın.")) {
      return;
    }

    try {
      const KEY = "belgelerim_talimat_listesi";
      const raw = localStorage.getItem(KEY);
      const list = raw ? JSON.parse(raw) : [];

      const now = new Date();
      const yil = now.getFullYear();

      const first = selectedPersons?.[0];
      const adSoyad = (first?.adSoyad || "PERSONEL").toString();
      const personelAdSoyad = adSoyad;
      const gorev = (first?.gorev || "").toString();

      const role = String(user?.role || "").toLowerCase();
      const isBireysel = role === "bireysel";

      const pickFirst = (...vals) => vals.find((v) => String(v || "").trim()) || "";

      let hazirlayan = "";
      try {
        const rawK = localStorage.getItem(`risk_prosedur_kisiler_${firmaId}`);
        const p = rawK ? JSON.parse(rawK) : null;

        let kisisel = null;
        try {
          kisisel = JSON.parse(localStorage.getItem("kisiselBilgiler") || "null");
        } catch {
          kisisel = null;
        }

        hazirlayan = pickFirst(
          p?.uzman,
          p?.isgUzmani,
          p?.uzmanAdSoyad,
          p?.uzmanAdiSoyadi,
          p?.isgUzmaniAdSoyad,
          selectedFirm?.uzmanAdi,
          selectedFirm?.uzman,
          kisisel?.adSoyad,
          `${kisisel?.ad || ""} ${kisisel?.soyad || ""}`.trim(),
          user?.adSoyad,
          user?.name,
          user?.fullName
        )
          .toString()
          .trim()
          .toLocaleUpperCase("tr-TR");
      } catch {
        hazirlayan = "";
      }

      const firmaAdi = selectedFirm?.firmaAdi || "Firma";
      const kategori = "Genel Talimat";
      const altTur = getAltTurFromPerson(first);
      const fileName = `${safeFileName(personelAdSoyad)} - ${safeFileName(altTur)}.pdf`;

      const targetISO = toIsoDate(first?.bitisTarihi || now.toISOString());

      const exists =
        Array.isArray(list) &&
        list.some((d) => {
          const docISO = toIsoDate(d?.tarihISO || d?.tarih || d?.createdAt);
          return (
            String(d?.firmaId) === String(selectedFirm?.id) &&
            String(d?.kategori || "") === kategori &&
            String(d?.tur || "") === altTur &&
            String(d?.personelAdSoyad || d?.adSoyad || "").toLocaleUpperCase("tr-TR") ===
              String(personelAdSoyad).toLocaleUpperCase("tr-TR") &&
            docISO === targetISO
          );
        });

    const doSave = async () => {
  const token = getAuthToken(user);
  const pdfBlob = await fetch(pdfUrl).then((r) => r.blob());

  const formData = new FormData();
  formData.append("file", pdfBlob, fileName);

  const uploadRes = await fetch(`${API_BASE}/documents/upload-pdf`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    console.error("Öneri talimat pdf upload hata:", text);
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

  const res = await fetch(`${API_BASE}/documents`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      firmaId: selectedFirm?.id,
      firmaAdi,
      category: "talimat",
      subCategory: altTur,
      belgeTuru: kategori,
      title: `${personelAdSoyad} - ${altTur}`,
      dateISO: targetISO,
      year: yil,
      personName: adSoyad,
      personelAdSoyad,
      createdBy: hazirlayan || "",
      hazirlayan: hazirlayan || "",
      createdByUserId: user?.adminId || user?.createdByAdminId || user?.id || null,
      fileUrl: uploadedFileUrl,
      absoluteUrl: uploadedAbsoluteUrl,
      fileName,
      status: "hazir",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Öneri talimat server belge kayıt hatası:", text);
    openInfo("Hata", "Belge server kaydına eklenemedi.");
    return;
  }

  try {
    localStorage.setItem(DOCS_SYNC_KEY, String(Date.now()));
  } catch {}

  window.dispatchEvent(new Event(DOCS_SYNC_KEY));
  window.dispatchEvent(new Event("ticari_docs_refresh"));

  openInfo("Bilgilendirme", "Belgelerim, Talimatlar sekmesine kaydedildi ✅");
};

      if (exists) {
        openConfirm({
          title: "Uyarı",
          message: `"${personelAdSoyad}" için "${altTur}" belgesi zaten kayıtlı.\nYine de kaydetmek ister misiniz?`,
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

  const handleTopluIndirZip = async () => {
    if (!hasSelection) {
      openInfo("Bilgilendirme", "Lütfen en az 1 personel seçiniz.");
      return;
    }

    if (!ensureRowsSigned(selectedPersons, "Lütfen önce seçilen personellerin imzalarını tamamlayın.")) {
      return;
    }

    try {
      setBulkLoading(true);

      const payload = buildBulkPayload(selectedPersons);
      const blob = await postBlob(API.oneriBulkZip, payload, user);

      const firmaAdi = (selectedFirm?.firmaAdi || "firma").toString().replace(/\s+/g, "_");
      downloadBlob(blob, `${firmaAdi}_oneri_talimatlar.zip`);
    } catch (e) {
      console.error(e);
      openInfo("Hata", `Toplu öneri talimat ZIP hazırlanırken hata: ${e.message}`);
    } finally {
      setBulkLoading(false);
    }
  };

  if (!selectedFirm) {
    return (
      <CardBox>
        <SectionTitle
          title="Öneri Talimatları"
          subtitle="Öneri talimatlarını görebilmek için lütfen sağ üstten bir firma seçiniz."
        />
      </CardBox>
    );
  }

  return (
    <>
      <style>{hideModalHeaderCloseStyle}</style>

      <CardBox className="flex flex-col gap-4">
        <SectionTitle
          title="Öneri Talimatları – Personel Listesi"
          subtitle="Sadece inşaat/şantiye görevlerinde otomatik öneri çıkarır."
        />

        <div className="border-l-4 border-amber-400 bg-amber-50 p-3 text-xs text-amber-800 rounded">
          Bu listede sadece <strong>İNŞAAT / ŞANTİYE</strong> ile ilgili personel görünür.
        </div>

        <div className="border rounded-lg p-4 space-y-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h3 className="text-sm font-semibold text-[#0a2b45]">Öneri Talimatı Bulunan Personel</h3>
            <span className="text-[11px] text-slate-500">Veri kaynağı: İŞE GİRİŞ EĞİTİMİ sekmesi</span>
          </div>

          <div className="w-full overflow-x-auto max-h-80 overflow-y-auto rounded-lg border">
            <table className="min-w-[1240px] w-full text-xs sm:text-sm border-collapse">
              <thead className="bg-slate-100">
                <tr>
                  <th className="border px-2 py-2 w-10 text-center sticky top-0 bg-slate-100">Seç</th>
                  <th className="border px-2 py-2 min-w-[150px] text-center sticky top-0 bg-slate-100">
                    T.C. Kimlik No
                  </th>
                  <th className="border px-2 py-2 min-w-[220px] text-center sticky top-0 bg-slate-100">
                    Adı Soyadı
                  </th>
                  <th className="border px-2 py-2 min-w-[180px] text-center sticky top-0 bg-slate-100">
                    Görevi
                  </th>
                  <th className="border px-2 py-2 min-w-[150px] text-center sticky top-0 bg-slate-100">
                    Eğitim Bitiş Tarihi
                  </th>
                  <th className="border px-2 py-2 min-w-[220px] text-center sticky top-0 bg-slate-100">
                    Önerilen Talimatlar
                  </th>
                  <th className="border px-2 py-2 min-w-[140px] text-center sticky top-0 bg-slate-100">
                    İmza
                  </th>
                </tr>
              </thead>

              <tbody>
                {oneriliPersoneller.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="border px-2 py-4 text-center text-[11px] text-slate-500">
                      İnşaat/Şantiye görevi olan personel bulunamadı.
                    </td>
                  </tr>
                ) : (
                  oneriliPersoneller.map((p) => {
                    const imzaDurum = getImzaProgress(p);

                    return (
                      <tr
                        key={p.id}
                        className={
                          selectedIds.includes(p.id)
                            ? rowHasSignature(p)
                              ? "bg-green-50"
                              : "bg-slate-50"
                            : rowHasSignature(p)
                            ? "bg-green-50/40"
                            : ""
                        }
                      >
                        <td className="border px-2 py-2 text-center whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(p.id)}
                            onChange={() => toggleSelect(p.id)}
                          />
                        </td>

                        <td className="border px-2 py-2 text-center whitespace-nowrap">{p.tc}</td>
                        <td className="border px-2 py-2 text-center whitespace-nowrap">{p.adSoyad}</td>
                        <td className="border px-2 py-2 text-center whitespace-nowrap">{p.gorev}</td>
                        <td className="border px-2 py-2 text-center whitespace-nowrap">
                          {formatDateTR(p.bitisTarihi)}
                        </td>

                        <td className="border px-2 py-2 text-center whitespace-nowrap">
                          {p.onerilenTalimatlar?.length ? (
                            <div className="flex flex-col items-center gap-1">
                              {p.onerilenTalimatlar.map((t, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 text-[10px] font-semibold text-emerald-700 border border-emerald-200"
                                >
                                  {toTitleCaseTR(t)}
                                </span>
                              ))}
                            </div>
                          ) : (
                            "-"
                          )}
                        </td>

                        <td className="border px-2 py-1.5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                openInfo(
                                  "Bilgilendirme",
                                  "Personel imzası İşe Giriş Eğitimi sekmesinden alınmaktadır."
                                )
                              }
                              className="inline-flex items-center justify-center rounded-md border border-green-300 bg-green-100 text-green-700 px-2 py-1 text-[11px]"
                            >
                              İmza
                            </button>

                            <span
                              className={`text-[11px] font-medium ${
                                rowHasSignature(p) ? "text-green-600" : "text-slate-500"
                              }`}
                            >
                              {imzaDurum.text}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-end gap-2 pt-3">
            <PrimaryButton
              size="sm"
              className="w-full sm:w-auto"
              disabled={!hasSelection || bulkLoading}
              onClick={openModal}
            >
              Hazırla
            </PrimaryButton>

            <PrimaryButton
              size="sm"
              variant="green"
              className="w-full sm:w-auto"
              disabled={!hasSelection || bulkLoading}
              onClick={handleTopluIndirZip}
            >
              {bulkLoading ? "Hazırlanıyor..." : "Toplu İndir (ZIP)"}
            </PrimaryButton>
          </div>
        </div>
      </CardBox>

    <Modal
  isOpen={modalOpen}
  onClose={closeModal}
  title="Öneri Talimatı"
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
      src={pdfUrl}
      title="pdfPreviewOneriTalimat"
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