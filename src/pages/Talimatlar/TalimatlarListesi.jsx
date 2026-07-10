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

// ✅ TR uyumlu Title Case
const toTitleCaseTR = (text) => {
  if (!text) return "";
  return String(text)
    .toLocaleLowerCase("tr-TR")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toLocaleUpperCase("tr-TR") + w.slice(1))
    .join(" ");
};

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

// ✅ Dosya adı güvenli hale getir
const safeFileName = (name) =>
  String(name || "PERSONEL")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();

// =========================
// TARİH FONKSİYONU (gg.aa.yyyy)
// =========================
function formatTarih(dateStr) {
  if (!dateStr) return "-";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  return `${d}.${m}.${y}`;
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

const createEmptySignatureRecord = () => ({
  dataUrl: "",
  createdAt: "",
});

const createEmptyImzaState = () => ({
  genel: null,
});

const rowHasSignature = (row) => !!row?.imzalar?.genel?.dataUrl;

const getMissingSignatureLabels = (row) => {
  if (!String(row?.adSoyad || "").trim()) return [];
  return rowHasSignature(row) ? [] : ["Personel İmzası"];
};

const isCriticalSignatureField = (field) =>
  ["tc", "adSoyad", "gorev", "baslangicTarihi", "bitisTarihi"].includes(field);

const resetRowSignature = (row) => ({
  ...row,
  imzalar: createEmptyImzaState(),
});

const getImzaProgress = (row) => {
  const completed = rowHasSignature(row) ? 1 : 0;
  return {
    completed,
    total: 1,
    text: `${completed}/1`,
  };
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

export default function TalimatlarListesi() {
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

  // ✅ Modal + PDF preview
  const [modalOpen, setModalOpen] = useState(false);
 const [pdfUrl, setPdfUrl] = useState(null);
const [pdfLoading, setPdfLoading] = useState(false);
const [pdfProgress, setPdfProgress] = useState(0);

  // ✅ ZIP loading
  const [bulkLoading, setBulkLoading] = useState(false);

  

  // ✅ Confirm / Info Modal
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

  
  // ✅ endpoint’ler
  const API = useMemo(() => {
  return {
    talimatPdf: `${API_BASE}/talimat/pdf`,
    talimatBulkZip: `${API_BASE}/talimat/pdf-bulk`,
    katilimcilarGet: `${API_BASE}/ise-giris/katilimcilar`,
    katilimcilarSave: `${API_BASE}/ise-giris/katilimcilar`,
  };
}, []);

  // ✅ modal header “X” kapatmayı gizle
  const hideModalHeaderCloseStyle = `
    .pdf-onizleme-modal button[aria-label="Close"],
    .pdf-onizleme-modal button[aria-label="Kapat"],
    .pdf-onizleme-modal button[aria-label="close"]{
      display: none !important;
    }
  `;

 

// Firma değişince personel listesini server’dan yükle
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
        setPersoneller([]);
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

      if (!cancelled) {
  setPersoneller((prev) =>
    cleaned.map((k, index) => {
      const normalizedTc = normalizeTC(k.tc || "");
      const normalizedAd = (k.adSoyad || "").toLocaleUpperCase("tr-TR");
      const normalizedGorev = (k.gorev || "").toLocaleUpperCase("tr-TR");
      const normalizedBaslangic = k.baslangicTarihi || "";
      const normalizedBitis = k.bitisTarihi || "";

      const existing =
        prev.find(
          (row) =>
            normalizeTC(row.tc || "") === normalizedTc &&
            String(row.adSoyad || "").toLocaleUpperCase("tr-TR") === normalizedAd &&
            String(row.gorev || "").toLocaleUpperCase("tr-TR") === normalizedGorev
        ) ||
        prev.find(
          (row) =>
            String(row.adSoyad || "").toLocaleUpperCase("tr-TR") === normalizedAd &&
            String(row.gorev || "").toLocaleUpperCase("tr-TR") === normalizedGorev &&
            String(row.bitisTarihi || "") === normalizedBitis
        );

      return {
        id: index,
        tc: normalizedTc,
        adSoyad: normalizedAd,
        gorev: normalizedGorev,
        baslangicTarihi: normalizedBaslangic,
        bitisTarihi: normalizedBitis,
        imzalar: {
          ...createEmptyImzaState(),
          ...(existing?.imzalar || {}),
          ...(k?.imzalar || {}),
        },
      };
    })
  );
}
    } catch (e) {
      console.error("Talimat listesi personelleri serverdan okunamadı:", e);
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
}, [selectedFirm?.id, user]);

  const toggleSelect = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };



const signatureButtonClass = (row) =>
  `inline-flex items-center justify-center rounded-lg border px-3 py-1.5 text-[11px] font-medium transition ${
    rowHasSignature(row)
      ? "border-green-300 bg-green-100 text-green-700"
      : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
  }`;





  const selectedPersons = useMemo(
    () => personeller.filter((p) => selectedIds.includes(p.id)),
    [personeller, selectedIds]
  );

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

  const hasSelection = selectedIds.length > 0;


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

    const talimatTarihISO = person?.bitisTarihi || "";
    const talimatTarihTR = formatTarih(person?.bitisTarihi || "");

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
        tarihISO: talimatTarihISO,
        tarihTR: talimatTarihTR,
      },
      egitim: {
        baslangicISO: person?.baslangicTarihi || "",
        bitisISO: person?.bitisTarihi || "",
        baslangicTR: formatTarih(person?.baslangicTarihi || ""),
        bitisTR: formatTarih(person?.bitisTarihi || ""),
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
 const openModalPreview = async () => {
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
   const blob = await postBlob(API.talimatPdf, payload, user);
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
  openInfo("Hata", `Talimat PDF hazırlanırken hata: ${e.message}`);
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

  const handleIndir = async () => {
    try {
      if (!pdfUrl) return;

      const first = selectedPersons?.[0];
      const personelAdSoyad = safeFileName(first?.adSoyad || "PERSONEL");
      const tur = safeFileName(toTitleCaseTR("Genel Talimat"));
      const fileName = `${personelAdSoyad} - ${tur}.pdf`;

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
      console.error("Talimat PDF indirme hatası:", e);
      openInfo("Hata", "PDF indirilemedi.");
    }
  };

  // ✅ Belgelerime Kaydet
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
      const tur = "Genel Talimat";
      const fileName = `${safeFileName(personelAdSoyad)} - ${safeFileName(tur)}.pdf`;

      const targetISO = toIsoDate(first?.bitisTarihi || now.toISOString());
      const exists =
        Array.isArray(list) &&
        list.some((d) => {
          const docISO = toIsoDate(d?.tarihISO || d?.tarih || d?.createdAt);
          return (
            String(d?.firmaId) === String(selectedFirm?.id) &&
            String(d?.kategori || "") === kategori &&
            String(d?.personelAdSoyad || d?.adSoyad || "").toLocaleUpperCase("tr-TR") ===
              String(personelAdSoyad).toLocaleUpperCase("tr-TR") &&
            docISO === targetISO
          );
        });

      const doSave = async () => {
  const token = getAuthToken(user);
  const pdfBlob = await fetch(pdfUrl).then((r) => r.blob());

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
    console.error("Talimat pdf upload hata:", text);
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
      subCategory: tur,
      belgeTuru: kategori,
      title: `${personelAdSoyad} - ${tur}`,
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
    console.error("Talimat server belge kayıt hatası:", text);
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
          message: `"${personelAdSoyad}" için "${kategori}" belgesi zaten kayıtlı.\nYine de kaydetmek ister misiniz?`,
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

  /* =========================
     ✅ Toplu ZIP indir
     ========================= */
 const handleTopluTalimatZipIndir = async () => {
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
    const blob = await postBlob(API.talimatBulkZip, payload, user);

    const firmaAdi = (selectedFirm?.firmaAdi || "firma").toString().replace(/\s+/g, "_");
    downloadBlob(blob, `${firmaAdi}_ise_giris_talimatlari.zip`);
  } catch (e) {
    console.error(e);
    openInfo("Hata", `Toplu talimat ZIP hazırlanırken hata: ${e.message}`);
  } finally {
    setBulkLoading(false);
  }
};

  if (!selectedFirm) {
    return (
      <CardBox>
        <SectionTitle
          title="İşe Giriş Talimatları"
          subtitle="Talimat listesi için lütfen sağ üstten bir firma seçiniz."
        />
      </CardBox>
    );
  }

  return (
    <>
      <style>{hideModalHeaderCloseStyle}</style>

      <CardBox className="flex flex-col gap-4">
        <SectionTitle
          title="İşe Giriş Talimatları – Personel Listesi"
          subtitle="İşe giriş eğitimine katılan personel listesi üzerinden kişi bazlı talimat oluşturabilirsiniz."
        />

        <div className="border rounded-lg p-4 space-y-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h3 className="text-sm font-semibold text-[#0a2b45]">
              Eğitime Katılan Personel (Talimat için Seçiniz)
            </h3>
            <span className="text-[11px] text-slate-500">
              Veri kaynağı: İşe Giriş Eğitimi sekmesindeki katılımcılar
            </span>
          </div>

          <div className="w-full overflow-x-auto max-h-80 overflow-y-auto rounded-lg border">
           <table className="min-w-[900px] w-full text-xs sm:text-sm border-collapse">
             <thead className="bg-slate-100">
 <tr>
  <th className="border px-2 py-2 w-10 text-center sticky top-0 bg-slate-100">Seç</th>
  <th className="border px-2 py-2 min-w-[150px] sticky top-0 bg-slate-100">T.C. Kimlik No</th>
  <th className="border px-2 py-2 min-w-[220px] sticky top-0 bg-slate-100">Adı Soyadı</th>
  <th className="border px-2 py-2 min-w-[180px] sticky top-0 bg-slate-100">Görevi</th>
  <th className="border px-2 py-2 min-w-[150px] sticky top-0 bg-slate-100">Eğitim Bitiş Tarihi</th>
  <th className="border px-2 py-2 min-w-[140px] sticky top-0 bg-slate-100 text-center">İmza</th>
</tr>
</thead>

              <tbody>
                {personeller.length === 0 ? (
                  <tr>
                   <td
  colSpan={6}
  className="border px-2 py-4 text-center text-[11px] text-slate-500"
>
                      Bu firmaya ait eğitime katılan personel kaydı bulunamadı.
                      <br />
                      Önce <span className="font-semibold">İşe Giriş Eğitimi</span> sekmesinden personel ekleyip{" "}
                      <span className="font-semibold">Katılımcıları Kaydet</span> butonuna basın.
                    </td>
                  </tr>
                ) : (
                 personeller.map((p, index) => {
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
      <td className="border px-2 py-2 text-center whitespace-nowrap">{formatTarih(p.bitisTarihi)}</td>
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

    <span className={`text-[11px] font-medium ${
      rowHasSignature(p) ? "text-green-600" : "text-slate-500"
    }`}>
      {rowHasSignature(p) ? "1/1" : "0/1"}
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
              onClick={openModalPreview}
            >
              Talimat Hazırla
            </PrimaryButton>

            <PrimaryButton
              size="sm"
              variant="green"
              className="w-full sm:w-auto"
              disabled={!hasSelection || bulkLoading}
              onClick={handleTopluTalimatZipIndir}
            >
              {bulkLoading ? "Hazırlanıyor..." : "Toplu İndir (ZIP)"}
            </PrimaryButton>
          </div>
        </div>
      </CardBox>

     <Modal
  isOpen={modalOpen}
  onClose={closeModal}
  title="Genel Talimat"
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
      title="pdfPreviewTalimat"
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