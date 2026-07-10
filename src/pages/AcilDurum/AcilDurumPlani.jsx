import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { FirmaContext } from "../../context/FirmaContext";
import { SectionTitle, CardBox, PrimaryButton, Modal } from "../../components/ui";
import ConfirmModal from "../../components/ui/ConfirmModal";

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

/* =========================================================
   Çoklu kayıt için ekstra global kilit
   ========================================================= */
let acilDurumSaveGlobalLock = false;

export default function AcilDurumPlani() {
  const { selectedFirm } = useContext(FirmaContext);

  const API_BASE =
    (import.meta.env.VITE_API_URL || "").trim().replace(/\/$/, "") ||
    "https://api.isgpanel.tr/api";

  const firmId = selectedFirm?._id || selectedFirm?.id || selectedFirm?.firmaId || null;


  /* =========================================================
     Confirm / Info Modal
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

  /* ---- kullanıcı bilgileri ---- */
  const kisisel = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("kisiselBilgiler") || "null");
    } catch {
      return null;
    }
  }, []);

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
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
        else setKurumsal(null);
      } catch {
        setKurumsal(null);
      }
    };

    loadKurumsal();
    window.addEventListener("storage", loadKurumsal);
    window.addEventListener("kurumsalBilgilerUpdated", loadKurumsal);

    return () => {
      window.removeEventListener("storage", loadKurumsal);
      window.removeEventListener("kurumsalBilgilerUpdated", loadKurumsal);
    };
  }, []);

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

  /* ---- Kişi bilgileri ---- */
   const [kisiler, setKisiler] = useState({
    isveren: "",
    uzman: "",
    hekim: "",
    temsilci: "",
    destek: "",
    bilgi: "",
  });

  const [imzalar, setImzalar] = useState({
    isveren: { imza: null, paraf: null },
    uzman: { imza: null, paraf: null },
    hekim: { imza: null, paraf: null },
    temsilci: { imza: null, paraf: null },
    destek: { imza: null, paraf: null },
    bilgi: { imza: null, paraf: null },
  });

  useEffect(() => {
    if (!firmId) return;

       const loadKisiler = async () => {
      try {
        const token =
          localStorage.getItem("token") ||
          localStorage.getItem("jwt") ||
          localStorage.getItem("accessToken") ||
          localStorage.getItem("authToken");

        if (token) {
          const res = await fetch(`${API_BASE}/firma/${firmId}/kisiler`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (res.ok) {
            const p = await res.json();
            setKisiler({
              isveren: p?.isveren || "",
              uzman: (p?.uzman || "").toUpperCase(),
              hekim: p?.hekim || "",
              temsilci: p?.temsilci || "",
              destek: p?.destek || "",
              bilgi: p?.bilgi || "",
            });
          } else {
            const text = await res.text();
            console.error("Acil kişi bilgileri API hata:", res.status, text);
            setKisiler({
              isveren: "",
              uzman: "",
              hekim: "",
              temsilci: "",
              destek: "",
              bilgi: "",
            });
          }

          const imzaRes = await fetch(`${API_BASE}/firma/${firmId}/imzalar`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (imzaRes.ok) {
            const imzaData = await imzaRes.json();
            setImzalar({
              isveren: imzaData?.isveren || { imza: null, paraf: null },
              uzman: imzaData?.uzman || { imza: null, paraf: null },
              hekim: imzaData?.hekim || { imza: null, paraf: null },
              temsilci: imzaData?.temsilci || { imza: null, paraf: null },
              destek: imzaData?.destek || { imza: null, paraf: null },
              bilgi: imzaData?.bilgi || { imza: null, paraf: null },
            });
          } else {
            const text = await imzaRes.text();
            console.error("Acil imza bilgileri API hata:", imzaRes.status, text);
            setImzalar({
              isveren: { imza: null, paraf: null },
              uzman: { imza: null, paraf: null },
              hekim: { imza: null, paraf: null },
              temsilci: { imza: null, paraf: null },
              destek: { imza: null, paraf: null },
              bilgi: { imza: null, paraf: null },
            });
          }

          return;
        }

        setKisiler({
          isveren: "",
          uzman: "",
          hekim: "",
          temsilci: "",
          destek: "",
          bilgi: "",
        });

        setImzalar({
          isveren: { imza: null, paraf: null },
          uzman: { imza: null, paraf: null },
          hekim: { imza: null, paraf: null },
          temsilci: { imza: null, paraf: null },
          destek: { imza: null, paraf: null },
          bilgi: { imza: null, paraf: null },
        });
      } catch (e) {
        console.error("Firma kisiler load hata:", e);
      }
    };

    loadKisiler();
  }, [API_BASE, firmId]);

  /* =========================================================
     FOTOĞRAFLAR
     ========================================================= */
  const [toplanmaFoto, setToplanmaFoto] = useState(null);
  const [tahliyeFoto, setTahliyeFoto] = useState(null);
  const [hastaneFoto, setHastaneFoto] = useState(null);

  const [toplanmaFotoUrl, setToplanmaFotoUrl] = useState("");
  const [tahliyeFotoUrl, setTahliyeFotoUrl] = useState("");
  const [hastaneFotoUrl, setHastaneFotoUrl] = useState("");

  useEffect(() => {
    return () => {
      try {
        if (toplanmaFoto?.startsWith("blob:")) URL.revokeObjectURL(toplanmaFoto);
        if (tahliyeFoto?.startsWith("blob:")) URL.revokeObjectURL(tahliyeFoto);
        if (hastaneFoto?.startsWith("blob:")) URL.revokeObjectURL(hastaneFoto);
      } catch {}
    };
  }, [toplanmaFoto, tahliyeFoto, hastaneFoto]);

  async function uploadImage(file, kind) {
    const fd = new FormData();
    fd.append("file", file);

    const endpoint =
      kind === "toplanma"
        ? "/upload/toplanma"
        : kind === "tahliye"
        ? "/upload/tahliye"
        : "/upload/hastane";

    const token =
      localStorage.getItem("token") ||
      localStorage.getItem("jwt") ||
      localStorage.getItem("accessToken") ||
      localStorage.getItem("authToken");

    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Upload hatası (${res.status})`);
    }

    const data = await res.json();
    if (!data?.ok || !data?.url) throw new Error("Upload cevabı geçersiz");
    return data.url;
  }

  const handleFileChange = async (e, type) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;

      console.log("SECILEN DOSYA:", {
        name: file.name,
        type: file.type,
        size: file.size,
        sizeMB: (file.size / (1024 * 1024)).toFixed(2),
      });

      const MAX_FILE_SIZE = 15 * 1024 * 1024;

      if (file.size > MAX_FILE_SIZE) {
        openInfo("Uyarı", "Fotoğraf boyutu 15 MB sınırını aşıyor.");
        return;
      }

      const previewUrl = URL.createObjectURL(file);

      if (type === "toplanma") {
        if (toplanmaFoto?.startsWith("blob:")) URL.revokeObjectURL(toplanmaFoto);
        setToplanmaFoto(previewUrl);
      }

      if (type === "tahliye") {
        if (tahliyeFoto?.startsWith("blob:")) URL.revokeObjectURL(tahliyeFoto);
        setTahliyeFoto(previewUrl);
      }

      if (type === "hastane") {
        if (hastaneFoto?.startsWith("blob:")) URL.revokeObjectURL(hastaneFoto);
        setHastaneFoto(previewUrl);
      }

      try {
        const uploadedUrl = await uploadImage(file, type);

        if (type === "toplanma") setToplanmaFotoUrl(uploadedUrl);
        if (type === "tahliye") setTahliyeFotoUrl(uploadedUrl);
        if (type === "hastane") setHastaneFotoUrl(uploadedUrl);
      } catch (err) {
        console.error("Fotoğraf upload hata:", err);

        const label =
          type === "toplanma"
            ? "Toplanma Yeri"
            : type === "tahliye"
            ? "Tahliye Planı"
            : "Hastane Yol Tarifi";

        openInfo(
          "Bilgilendirme",
          `${label} fotoğrafı yüklenemedi.\n\nDosya boyutu çok büyük olabilir.\nLütfen daha küçük bir görsel seçip tekrar deneyin.`
        );
      }
    } catch (err) {
      console.error("Dosya seçme hatası:", err);
      openInfo("Hata", "Fotoğraf seçilirken bir hata oluştu.");
    }
  };

  const buildFinalLogo = async () => {
    try {
      if (
        typeof kurumsal?.logo === "string" &&
        kurumsal.logo.startsWith("data:image")
      ) {
        return kurumsal.logo;
      }

      const rawLogoUrl = kurumsal?.logoUrl || "";
      if (!rawLogoUrl) return "";

      const absoluteLogoUrl = toAbsoluteUrl(rawLogoUrl);

      const token =
        localStorage.getItem("token") ||
        localStorage.getItem("jwt") ||
        localStorage.getItem("accessToken") ||
        localStorage.getItem("authToken") ||
        "";

      const res = await fetch(absoluteLogoUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) return "";

      const blob = await res.blob();

      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result || ""));
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.error("Logo base64 hatası:", e);
      return "";
    }
  };

  /* ---- PDF & Popup state'leri ---- */
  const [loading, setLoading] = useState(false);
const [pdfProgress, setPdfProgress] = useState(0);
const [show, setShow] = useState(false);
const [pdfUrl, setPdfUrl] = useState(null);
  const [downloadName, setDownloadName] = useState("AcilDurumPlani.pdf");
  const [saving, setSaving] = useState(false);
  const [alreadySaved, setAlreadySaved] = useState(false);

  const savingRef = useRef(false);
  const [pdfBlob, setPdfBlob] = useState(null);

useEffect(() => {
  setPdfUrl(null);
  setPdfBlob(null);
  setAlreadySaved(false);
  setShow(false);

  setToplanmaFoto(null);
  setTahliyeFoto(null);
  setHastaneFoto(null);

  setToplanmaFotoUrl("");
  setTahliyeFotoUrl("");
  setHastaneFotoUrl("");
}, [firmId]);

  useEffect(() => {
    return () => {
      try {
        if (pdfUrl && String(pdfUrl).startsWith("blob:")) {
          URL.revokeObjectURL(pdfUrl);
        }
      } catch {}
    };
  }, [pdfUrl]);

  const readonlyInputClass =
    "w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-800";

  const readonlyKisiInputClass =
    "w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm uppercase";

const normalizeName = (v) =>
  String(v || "")
    .split("/")[0]
    .trim()
    .toLocaleUpperCase("tr-TR")
    .replace(/\s+/g, " ");

const getCurrentRoleName = (roleKey) => {
  return normalizeName(kisiler?.[roleKey] || "");
};

const getSignatureStatus = (record, currentName) => {
  const normalizedCurrent = normalizeName(currentName);

  if (!record?.dataUrl) return "Eksik";

  if (!normalizedCurrent) return "Eksik";

  const signerName = normalizeName(
  record?.signerName ||
  record?.adSoyad ||
  record?.ownerName ||
  record?.kisi ||
  ""
);

  if (signerName !== normalizedCurrent) {
    return "Güncelle Gerekli";
  }

  return "Kayıtlı";
};

const buildCleanImzalarPayload = () => {
  return Object.fromEntries(
    Object.entries(imzalar || {}).map(([roleKey, roleValue]) => {
      const currentName = getCurrentRoleName(roleKey);

      const cleanItem = (item) => {
        const status = getSignatureStatus(item, currentName);

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
  );
};

  if (!selectedFirm) {
    return (
      <CardBox>
        <SectionTitle
          title="Acil Durum Planı"
          subtitle="Devam etmek için lütfen sağ üstten bir firma seçiniz."
        />
      </CardBox>
    );
  }

  const handlePrepare = async () => {
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

 
    if (pdfUrl && String(pdfUrl).startsWith("blob:")) {
      try {
        URL.revokeObjectURL(pdfUrl);
      } catch {}
    }

    setPdfUrl(null);
    setPdfBlob(null);
    setAlreadySaved(false);

    const finalLogo = await buildFinalLogo();

    const payload = {
      kurumsal: {
  logo: finalLogo || "",
  logoUrl: "",
  firmaId: String(firmId || ""),
},

      firma: {
        firmaAdi: selectedFirm?.firmaAdi || "",
        sgkSicilNo: selectedFirm?.sgkSicilNo || "",
        adres: selectedFirm?.adres || "",
        nace: selectedFirm?.nace || "",
        faaliyet: selectedFirm?.faaliyet || "",
        tehlikeSinifi: selectedFirm?.tehlike || "",
      },

      tarihler: {
        hazirlamaTr: toTR(selectedFirm?.hazirlama),
        gecerlilikTr: toTR(selectedFirm?.gecerlilik),
      },

      kisiler: {
        isveren: kisiler?.isveren || "",
        uzman: kisiler?.uzman || "",
        hekim: kisiler?.hekim || "",
        temsilci: kisiler?.temsilci || "",
        destek: kisiler?.destek || "",
        bilgiSahibi: kisiler?.bilgi || "",
      },

      kisisel: {
        adSoyad: kisisel?.adSoyad || user?.ad || kisiler?.uzman || "",
        sertifikaNo: kisisel?.sertifikaNo || user?.sertifikaNo || "",
        sertifikaSinifi:
          kisisel?.sertifikaSinifi || user?.sertifikaSinifi || "",
      },

      imzalar: buildCleanImzalarPayload(),

      acil: {
        toplanmaFotoUrl: toplanmaFotoUrl || "",
        tahliyeFotoUrl: tahliyeFotoUrl || "",
        hastaneFotoUrl: hastaneFotoUrl || "",
      },
    };

    const token =
      localStorage.getItem("token") ||
      localStorage.getItem("jwt") ||
      localStorage.getItem("accessToken") ||
      localStorage.getItem("authToken");

    const jobRes = await fetch(`https://api.isgpanel.tr/api/pdf/acildurumplani`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });

   if (!jobRes.ok) {
  clearInterval(progressTimer);
  setLoading(false);

  const text = await jobRes.text();
  openInfo("Hata", `PDF işi başlatılamadı:\n${text.slice(0, 400)}`);
  return;
}

    const jobJson = await jobRes.json();
    const jobId = String(jobJson?.jobId || "").trim();

   if (!jobId) {
  clearInterval(progressTimer);
  setLoading(false);

  openInfo("Hata", "PDF jobId alınamadı.");
  return;
}
    const belgeTarihTr =
      toTR(selectedFirm?.hazirlama) || new Date().toLocaleDateString("tr-TR");

    setDownloadName(
      `${sanitizeName(selectedFirm?.firmaAdi)} (AcilPlan-${belgeTarihTr}).pdf`
    );

    let tryCount = 0;
    const maxTry = 60;

    const interval = setInterval(async () => {
      try {
        tryCount += 1;

        const r = await fetch(`https://api.isgpanel.tr/api/pdf/job/${jobId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!r.ok) return;

        const j = await r.json();

      if (j.status === "done") {
  clearInterval(interval);
  clearInterval(progressTimer);

  setPdfProgress(100);
  const freshPdfUrl = j.resultFileUrl
  ? `${j.resultFileUrl}${j.resultFileUrl.includes("?") ? "&" : "?"}v=${Date.now()}&firmId=${firmId}`
  : "";

setPdfUrl(freshPdfUrl);
  setPdfBlob(null);
  setShow(true);

  setTimeout(() => {
    setLoading(false);
  }, 400);

  return;
}

       if (j.status === "error") {
  clearInterval(interval);
  clearInterval(progressTimer);
  setLoading(false);

  openInfo("Hata", j.error || "PDF oluşturulamadı");
  return;
}

       if (tryCount >= maxTry) {
  clearInterval(interval);
  clearInterval(progressTimer);
  setLoading(false);

  openInfo("Hata", "PDF oluşturma zaman aşımına uğradı.");
}
      } catch (err) {
  clearInterval(interval);
  clearInterval(progressTimer);
  setLoading(false);

  openInfo("Hata", "PDF job kontrol hatası.");
}

    }, 3000);
  } catch (e) {
  setLoading(false);
  setPdfProgress(0);

  openInfo("Hata", "Hata: " + (e?.message || e));
}
};

 
const saveToDocs = async (e) => {
  e?.preventDefault?.();
  e?.stopPropagation?.();

  if (savingRef.current === true) {
    console.log("DOUBLE SAVE ENGELLENDİ");
    return;
  }

  if (savingRef.current || acilDurumSaveGlobalLock) return;

  savingRef.current = true;
  acilDurumSaveGlobalLock = true;
  setSaving(true);

  try {
    if (alreadySaved) {
      openInfo("Bilgilendirme", "Bu belge zaten kaydedildi.");
      return;
    }

   if (!pdfUrl) {
  openInfo("Bilgilendirme", "Önce 'Hazırla (PDF)' ile belgeyi oluştur.");
  return;
}

    if (!firmId) {
      openInfo("Bilgilendirme", "Geçerli bir firma seçili değil.");
      return;
    }

    const firmaAdi = selectedFirm?.firmaAdi || "Firma";
    const belgeTarihTr =
      toTR(selectedFirm?.hazirlama) || new Date().toLocaleDateString("tr-TR");

    const yil =
      selectedFirm?.hazirlama && !isNaN(new Date(selectedFirm.hazirlama))
        ? new Date(selectedFirm.hazirlama).getFullYear()
        : new Date().getFullYear();

    const olusturan =
      (kisisel?.adSoyad && `${kisisel.adSoyad}`) ||
      (user?.ad && `${user.ad} (İSG Uzmanı)`) ||
      kisiler?.uzman ||
      "İSG Uzmanı";

    const role = String(user?.role || "").toLowerCase();
    const isBireysel = role === "bireysel";
    const fileName = `${sanitizeName(firmaAdi)} (AcilPlan-${belgeTarihTr}).pdf`;

    const token =
      localStorage.getItem("token") ||
      localStorage.getItem("jwt") ||
      localStorage.getItem("accessToken") ||
      localStorage.getItem("authToken");
   
    const payload = {
      uniqueKey: `${String(firmId)}-acil-durum-plani-${belgeTarihTr}`,
      firmaId: String(firmId),
      firmaAdi,
      category: "acil",
      subCategory: "acil-durum-plani",
      title: "Acil Durum Planı",
      year: yil,
      createdBy: olusturan,
      createdByUserId: user?._id || user?.id,
      hazirlayan: olusturan,
      personName: olusturan,
      belgeTuru: "Acil Durum Planı",
      tarih: belgeTarihTr,
      dosyaTuru: "PDF",
      status: "hazir",
      fileUrl: pdfUrl,
      absoluteUrl: pdfUrl,
      fileName,
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
      console.error("Acil belge kayıt hatası:", text);
      openInfo("Hata", "Belge servera kaydedilemedi.");
      return;
    }

    const saveJson = await res.json().catch(() => null);
    console.log("Acil belge kayıt cevabı:", saveJson);

    setAlreadySaved(true);

    try {
      window.dispatchEvent(new Event("ticari_docs_refresh"));
      window.dispatchEvent(new Event("documentsUpdated"));
      window.dispatchEvent(new Event("belgelerimUpdated"));
    } catch {}

    setShow(false);

    openInfo(
      "Bilgilendirme",
      "Belgelerim, Acil Durum sekmesine kaydedildi ✅"
    );
  } catch (e) {
    console.error("Acil durum planı kaydedilemedi:", e);
    openInfo("Hata", "Belge kaydedilirken bir hata oluştu.");
  } finally {
    savingRef.current = false;
    acilDurumSaveGlobalLock = false;
    setSaving(false);
  }
};


  const handleYeniSekmedeAc = () => {
    if (!pdfUrl) {
      openInfo("Bilgilendirme", "Önce 'Hazırla (PDF)' ile belgeyi oluştur.");
      return;
    }
    window.open(pdfUrl, "_blank", "noopener");
  };

 const handleIndir = () => {
  try {
    if (!pdfUrl) {
      openInfo("Bilgilendirme", "Önce 'Hazırla (PDF)' ile belgeyi oluştur.");
      return;
    }

    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = downloadName || "AcilDurumPlani.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (e) {
    console.error("PDF indirme hatası:", e);
    openInfo("Hata", "PDF indirilemedi.");
  }
};

  return (
    <>
      <CardBox className="flex flex-col gap-4">
        <SectionTitle
          title="Acil Durum Planı"
          subtitle="Firma ve kişi bilgileri Risk Değerlendirme Prosedürü sekmesinden otomatik gelir."
        />

        <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <input
            readOnly
            value={selectedFirm.firmaAdi || ""}
            className={`${readonlyInputClass} min-w-0 h-11 text-sm`}
          />
          <input
            readOnly
            value={selectedFirm.adres || ""}
            className={`${readonlyInputClass} min-w-0 h-11 text-sm`}
          />
          <input
            readOnly
            value={selectedFirm.sgkSicilNo || ""}
            className={`${readonlyInputClass} min-w-0 h-11 text-sm`}
          />
          <input
            readOnly
            value={selectedFirm.nace || ""}
            className={`${readonlyInputClass} min-w-0 h-11 text-sm`}
          />
          <input
            readOnly
            value={selectedFirm.faaliyet || ""}
            className={`${readonlyInputClass} min-w-0 h-11 text-sm`}
          />
          <input
            readOnly
            value={selectedFirm.tehlike || ""}
            className={`${readonlyInputClass} min-w-0 h-11 text-sm`}
          />
          <input
            readOnly
            value={toTR(selectedFirm.hazirlama)}
            className={`${readonlyInputClass} min-w-0 h-11 text-sm`}
          />
          <input
            readOnly
            value={toTR(selectedFirm.gecerlilik)}
            className={`${readonlyInputClass} min-w-0 h-11 text-sm`}
          />
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-[#0a2b45]">Kişi Bilgileri</h3>

          <p className="rounded border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <span className="font-semibold">Bilgi:</span> Aşağıdaki kişi bilgileri{" "}
            <span className="font-semibold">Risk Değerlendirme Prosedürü</span> sekmesinden otomatik
            olarak gelmektedir.
          </p>

          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <input
              readOnly
              placeholder="İşveren / Vekili"
              value={kisiler.isveren}
              className={`${readonlyKisiInputClass} min-w-0 h-11`}
            />
            <input
              readOnly
              placeholder="İş Güvenliği Uzmanı"
              value={kisiler.uzman}
              className={`${readonlyKisiInputClass} min-w-0 h-11 font-semibold`}
            />
            <input
              readOnly
              placeholder="İşyeri Hekimi"
              value={kisiler.hekim}
              className={`${readonlyKisiInputClass} min-w-0 h-11`}
            />
            <input
              readOnly
              placeholder="Çalışan Temsilcisi"
              value={kisiler.temsilci}
              className={`${readonlyKisiInputClass} min-w-0 h-11`}
            />
            <input
              readOnly
              placeholder="Destek Elemanı"
              value={kisiler.destek}
              className={`${readonlyKisiInputClass} min-w-0 h-11`}
            />
            <input
              readOnly
              placeholder="Bilgi Sahibi Kişi"
              value={kisiler.bilgi}
              className={`${readonlyKisiInputClass} min-w-0 h-11`}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-[#0a2b45]">Fotoğraflar</h3>

          <div className="grid grid-cols-1 gap-4 text-sm lg:grid-cols-3">
            <div className="rounded-lg border border-slate-200 p-3">
              <label className="mb-2 block text-xs font-medium text-slate-700">
                Toplanma Yeri Fotoğrafı
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileChange(e, "toplanma")}
                className="w-full text-sm"
              />
              <div className="mt-1 text-[11px] text-slate-500">
                En fazla 15 MB görsel yükleyebilirsiniz.
              </div>
              {toplanmaFoto && (
                <img
                  src={toplanmaFoto}
                  alt="Toplanma Yeri"
                  className="mt-3 h-40 w-full rounded border bg-white object-contain"
                />
              )}
              {!!toplanmaFotoUrl && (
                <div className="mt-2 break-all text-[11px] text-slate-500">
                  Yüklendi: {toplanmaFotoUrl}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-slate-200 p-3">
              <label className="mb-2 block text-xs font-medium text-slate-700">
                Tahliye Planı Fotoğrafı
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileChange(e, "tahliye")}
                className="w-full text-sm"
              />
              <div className="mt-1 text-[11px] text-slate-500">
                En fazla 15 MB görsel yükleyebilirsiniz.
              </div>
              {tahliyeFoto && (
                <img
                  src={tahliyeFoto}
                  alt="Tahliye Planı"
                  className="mt-3 h-40 w-full rounded border bg-white object-contain"
                />
              )}
              {!!tahliyeFotoUrl && (
                <div className="mt-2 break-all text-[11px] text-slate-500">
                  Yüklendi: {tahliyeFotoUrl}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-slate-200 p-3">
              <label className="mb-2 block text-xs font-medium text-slate-700">
                Hastane Yol Tarifi Fotoğrafı
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileChange(e, "hastane")}
                className="w-full text-sm"
              />
              <div className="mt-1 text-[11px] text-slate-500">
                En fazla 15 MB görsel yükleyebilirsiniz.
              </div>
              {hastaneFoto && (
                <img
                  src={hastaneFoto}
                  alt="Hastane Yol Tarifi"
                  className="mt-3 h-40 w-full rounded border bg-white object-contain"
                />
              )}
              {!!hastaneFotoUrl && (
                <div className="mt-2 break-all text-[11px] text-slate-500">
                  Yüklendi: {hastaneFotoUrl}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-200 pt-2 sm:flex-row sm:items-center sm:justify-end">
          <PrimaryButton
            type="button"
            size="sm"
            onClick={handlePrepare}
            disabled={loading}
            className={`w-full sm:w-auto ${loading ? "cursor-wait" : ""}`}
          >
            {loading ? "Hazırlanıyor..." : "Hazırla (PDF)"}
          </PrimaryButton>
        </div>
      </CardBox>

      <Modal
        isOpen={show}
        onClose={() => setShow(false)}
        title="Acil Durum Planı"
        headerActions={
          <div className="flex w-full flex-col gap-1 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            <button
              type="button"
              onClick={handleYeniSekmedeAc}
              className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-[10px] hover:bg-gray-50 sm:w-auto sm:text-xs"
            >
              Yeni sekmede aç
            </button>

            <button
              type="button"
              onClick={handleIndir}
              className="w-full rounded-md bg-blue-600 px-2 py-1 text-[10px] text-white hover:bg-blue-700 sm:w-auto sm:text-xs"
            >
              İndir (PDF)
            </button>

            <PrimaryButton
              type="button"
              size="sm"
              variant="green"
              onClick={(e) => {
  e.preventDefault();
  e.stopPropagation();

  if (savingRef.current) return;

  saveToDocs(e);
}}


              disabled={saving || alreadySaved}
              className="w-full px-2 py-1 text-[10px] sm:w-auto sm:text-xs"
            >
              {saving ? "Kaydediliyor..." : alreadySaved ? "Kaydedildi" : "Belgelerime Kaydet"}
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
            title="Acil Durum Planı"
            className="h-[50vh] w-full rounded border border-gray-200 sm:h-[65vh]"
          />
        )}

        {!loading && !pdfUrl && (
          <div className="flex h-[45vh] w-full items-center justify-center px-4 text-center text-sm text-gray-600 sm:h-[60vh]">
            PDF bulunamadı. Lütfen 'Hazırla (PDF)' butonu ile yeniden deneyin.
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