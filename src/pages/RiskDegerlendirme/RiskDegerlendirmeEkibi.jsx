import {
  SectionTitle,
  CardBox,
  PrimaryButton,
  Modal
} from "../../components/ui";

import ConfirmModal from "../../components/ui/ConfirmModal";
import React, { useContext, useEffect, useState } from "react";
import { FirmaContext } from "../../context/FirmaContext";

export default function RiskDegerlendirmeEkibi() {
  const { selectedFirm } = useContext(FirmaContext);
  const firmId = selectedFirm?.id || selectedFirm?._id;

  const API_BASE =
    (import.meta.env.VITE_API_URL || "").trim().replace(/\/$/, "") ||
    "https://api.isgpanel.tr";

  const firmKey = `risk_prosedur_kisiler_${firmId ?? "default"}`;

  const [kisiler, setKisiler] = useState({
    isveren: "",
    uzman: "",
    hekim: "",
    temsilci: "",
    destek: "",
    bilgi: "",
  });

  const [signatureState, setSignatureState] = useState({});
  const [kurumsal, setKurumsal] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loading, setLoading] = useState(false);
const [pdfProgress, setPdfProgress] = useState(0);

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

  const [hazirlamaTarihi, setHazirlamaTarihi] = useState(
    new Date().toISOString().substring(0, 10)
  );

  const getAuthTokenSafe = () => {
    try {
      return (
        localStorage.getItem("token") ||
        localStorage.getItem("jwt") ||
        localStorage.getItem("accessToken") ||
        localStorage.getItem("authToken") ||
        sessionStorage.getItem("token") ||
        sessionStorage.getItem("jwt") ||
        sessionStorage.getItem("accessToken") ||
        sessionStorage.getItem("authToken") ||
        null
      );
    } catch {
      return null;
    }
  };

  const parseJsonSafe = (v) => {
    try {
      return v ? JSON.parse(v) : null;
    } catch {
      return null;
    }
  };

  const getUserObj = () =>
    parseJsonSafe(localStorage.getItem("user")) ||
    parseJsonSafe(localStorage.getItem("ticari_user")) ||
    parseJsonSafe(localStorage.getItem("bireysel_user")) ||
    parseJsonSafe(localStorage.getItem("auth_user")) ||
    parseJsonSafe(localStorage.getItem("currentUser")) ||
    parseJsonSafe(sessionStorage.getItem("user")) ||
    null;

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

  useEffect(() => {
    if (!firmId) return;

    const loadKisiler = async () => {
      try {
        const token = getAuthTokenSafe();
        if (!token) return;

        const res = await fetch(
          `${API_BASE}/firma/${firmId}/kisiler`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!res.ok) return;

        const p = await res.json();

        setKisiler({
          isveren: p?.isveren || "",
          uzman: p?.uzman || "",
          hekim: p?.hekim || "",
          temsilci: p?.temsilci || "",
          destek: p?.destek || "",
          bilgi: p?.bilgi || "",
        });
      } catch (e) {
        console.error("Firma kisiler load hata:", e);
      }
    };

    loadKisiler();
  }, [firmId, API_BASE, firmKey]);

  useEffect(() => {
    if (!firmId) return;

    const loadSignatures = async () => {
      try {
        const token = getAuthTokenSafe();
        if (!token) return;

        const res = await fetch(
          `${API_BASE}/firma/${firmId}/imzalar`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!res.ok) return;

        const data = await res.json();
        setSignatureState(data || {});
      } catch (e) {
        console.error("İmzalar çekilemedi:", e);
        setSignatureState({});
      }
    };

    loadSignatures();
  }, [firmId, API_BASE]);


useEffect(() => {
  if (!firmId) return;

  const loadKurumsal = async () => {
    try {
      const token = getAuthTokenSafe();

      if (token) {

const endpoints = [
  `${API_BASE}/kurumsal/${firmId}`,
  `${API_BASE}/firma/${firmId}`,
];

let json = null;

for (const url of endpoints) {
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) continue;

    const temp = await res.json();



    const possibleLogo =
      temp?.kurumsal?.logoUrl ||
      temp?.kurumsal?.logo ||
      temp?.kurumsal?.logoPath ||
      temp?.logoUrl ||
      temp?.logo ||
      temp?.logoPath ||
      temp?.firmaLogo ||
      temp?.data?.kurumsal?.logoUrl ||
      temp?.data?.kurumsal?.logo ||
      temp?.data?.kurumsal?.logoPath ||
      temp?.data?.logoUrl ||
      temp?.data?.logo ||
      temp?.data?.logoPath ||
      temp?.firma?.kurumsal?.logoUrl ||
      temp?.firma?.kurumsal?.logo ||
      temp?.firma?.kurumsal?.logoPath ||
      temp?.firma?.logoUrl ||
      temp?.firma?.logo ||
      temp?.firma?.logoPath ||
      "";

    if (possibleLogo) {
      json = temp;
      break;
    }
  } catch {}
}

if (json) {

const firma =
  json?.payload ||
  json?.firma ||
  json?.data ||
  json?.organization ||
  json;

const kurumsalData =
  firma?.kurumsal ||
  json?.payload?.kurumsal ||
  json?.kurumsal ||
  json?.data?.kurumsal ||
  json?.firma?.kurumsal ||
  json?.organization?.kurumsal ||
  {};


  const logoValue =
    kurumsalData?.logoUrl ||
    kurumsalData?.logo ||
    kurumsalData?.logoPath ||
    kurumsalData?.firmaLogo ||
    firma?.logoUrl ||
    firma?.logo ||
    firma?.logoPath ||
    firma?.firmaLogo ||

json?.payload?.logoUrl ||
json?.payload?.logo ||
json?.payload?.logoPath ||
json?.payload?.firmaLogo ||
json?.payload?.kurumsalLogoUrl ||
json?.logoUrl ||
json?.logo ||
json?.logoPath ||
json?.firmaLogo ||
json?.kurumsalLogoUrl ||
"";


  setKurumsal({
    ...kurumsalData,
    logoUrl: logoValue || "",
    logo: logoValue || "",
    logoPath: logoValue || "",
    firmaLogo: logoValue || "",
  });

  return;
}
      }

      const raw = localStorage.getItem("kurumsalBilgiler");
      if (raw) setKurumsal(JSON.parse(raw));
    } catch (e) {
      console.error("Kurumsal bilgiler çekilemedi:", e);

      try {
        const raw = localStorage.getItem("kurumsalBilgiler");
        if (raw) setKurumsal(JSON.parse(raw));
      } catch {}
    }
  };

  loadKurumsal();

  window.addEventListener("storage", loadKurumsal);
  window.addEventListener("kurumsalBilgilerUpdated", loadKurumsal);

  return () => {
    window.removeEventListener("storage", loadKurumsal);
    window.removeEventListener("kurumsalBilgilerUpdated", loadKurumsal);
  };
}, [firmId, API_BASE]);


  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  if (!selectedFirm) {
    return (
      <div className="p-3 rounded-lg border bg-white text-sm text-red-600">
        Lütfen üst bardan bir firma seçiniz.
      </div>
    );
  }

  const handleLockedFieldClick = () => {
    openInfo(
      "Bilgilendirme",
      "Kişi bilgilerini güncellemek için 'Risk Değerlendirme Prosedürü' sekmesine gidiniz."
    );
  };

  const formatDateTR = (isoDate) => {
    if (!isoDate) return "";
    const [y, m, d] = isoDate.split("-");
    return `${d}.${m}.${y}`;
  };

  function normalizeLogoForPdf(rawLogo, apiBase) {
  if (!rawLogo) return "";

  const s = String(rawLogo).trim();
  if (!s) return "";

  if (s.startsWith("data:image/")) return s;

  const looksBase64 = /^[A-Za-z0-9+/=\s]+$/.test(s) && s.length > 200;
  if (looksBase64) {
    return `data:image/png;base64,${s.replace(/\s/g, "")}`;
  }

if (s.startsWith("/uploads")) {
  return `https://api.isgpanel.tr${s}?v=${Date.now()}`;
}


  if (s.startsWith("/")) {
    return `${apiBase}${s}`;
  }

  if (s.startsWith("http://") || s.startsWith("https://")) {
    return s
      .replace("https://api.isgpanel.tr/api/uploads/", "https://api.isgpanel.tr/uploads/")
      .replace("/api/uploads/", "/uploads/");
  }

  return `${apiBase}/${s.replace(/^\/+/, "")}`;
}

const buildFinalLogo = async () => {
  try {
    if (
      typeof kurumsal?.logo === "string" &&
      kurumsal.logo.startsWith("data:image")
    ) {
      return kurumsal.logo;
    }


const rawLogoUrl =
  kurumsal?.logoUrl ||
  kurumsal?.kurumsalLogoUrl ||
  kurumsal?.logo ||

  kurumsal?.logoPath ||
  kurumsal?.logoSrc ||
  kurumsal?.firmaLogo ||

  selectedFirm?.kurumsal?.logoUrl ||
  selectedFirm?.kurumsal?.logo ||
  selectedFirm?.kurumsal?.logoPath ||

  selectedFirm?.kurumsalLogoUrl ||
  selectedFirm?.companyLogo ||
  selectedFirm?.logoData ||
  selectedFirm?.logoBase64 ||

  selectedFirm?.firma?.kurumsal?.logoUrl ||
  selectedFirm?.firma?.kurumsal?.logo ||

  selectedFirm?.firma?.logoUrl ||
  selectedFirm?.firma?.logo ||

  selectedFirm?.logoUrl ||
  selectedFirm?.logo ||
  selectedFirm?.logoPath ||

  selectedFirm?.firmaLogo ||

  "";



if (!rawLogoUrl) {
  return "";
}



let absoluteLogoUrl = normalizeLogoForPdf(rawLogoUrl, API_BASE);

absoluteLogoUrl = absoluteLogoUrl
  .replace("https://api.isgpanel.tr/api/uploads/", "https://api.isgpanel.tr/uploads/")
  .replace("/api/uploads/", "/uploads/");



const res = await fetch(absoluteLogoUrl, {
  method: "GET",
  cache: "no-store",
});



if (!res.ok) {
  return "";
}

if (!res.headers.get("content-type")?.startsWith("image/")) {
  return "";
}

    const blob = await res.blob();

    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result || ""));
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    return "";
  }
};

  const sanitizeName = (s) =>
    (s || "Firma")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9ÇĞİÖŞÜçğıöşü \-_.]/g, "")
      .trim() || "Firma";

  const handleHazirla = async () => {
    try {
     setLoading(true);
setPdfProgress(5);
setModalOpen(true);
setPdfUrl(null);

const progressTimer = setInterval(() => {
  setPdfProgress((prev) => {
    if (prev >= 92) return prev;
    return prev + Math.floor(Math.random() * 6) + 2;
  });
}, 700);

      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
      setPdfUrl(null);

      const hazirTr = formatDateTR(hazirlamaTarihi);


const finalLogo = await buildFinalLogo();

      const payload = {


kurumsal: {
  logo: finalLogo || "",
  logoUrl: finalLogo || "",
  firmaLogo: finalLogo || "",
},


        firma: {
          firmaAdi: selectedFirm?.firmaAdi || selectedFirm?.name || "",
          adres: selectedFirm?.adres || "",
        },
        tarihler: {
          hazirlamaTr: hazirTr,
        },
        kisiler: {
          isveren: kisiler.isveren || "",
          uzman: kisiler.uzman || "",
          hekim: kisiler.hekim || "",
          temsilci: kisiler.temsilci || "",
          destek: kisiler.destek || "",
          bilgiSahibi: kisiler.bilgi || "",
        },
        imzalar: signatureState || {},
        riskEkip: {
          yaziTarihi: hazirTr,
        },
      };

      const token = getAuthTokenSafe();


      const res = await fetch(`${API_BASE}/pdf/risk-ekip`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("API /pdf/risk-ekip HATA:", res.status, text);
        throw new Error(`Sunucu hatası: ${res.status}`);
      }

      const blob = await res.blob();
const url = URL.createObjectURL(blob);

clearInterval(progressTimer);
setPdfProgress(100);

setPdfUrl(url);

setTimeout(() => {
  setLoading(false);
}, 400);

   } catch (err) {
  clearInterval(progressTimer);
  setLoading(false);

  console.error(err);
  openInfo("Hata", "PDF hazırlanırken hata oluştu.");
  setModalOpen(false);
}finally {
      setLoading(false);
    }
  };

  const handleYeniSekmedeAc = () => {
    if (!pdfUrl) {
      openInfo("Bilgilendirme", "Önce Hazırla ile oluşturun.");
      return;
    }
    window.open(pdfUrl, "_blank");
  };

  const handleIndir = () => {
    if (!pdfUrl) {
      openInfo("Bilgilendirme", "Önce Hazırla ile oluşturun.");
      return;
    }

    const firmaAdi = selectedFirm?.firmaAdi || selectedFirm?.name || "Firma";
    const tarihTr = hazirlamaTarihi
      ? formatDateTR(hazirlamaTarihi)
      : new Date().toLocaleDateString("tr-TR");

    const safeFirma = sanitizeName(firmaAdi);

    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = `${safeFirma} (Ekip-${tarihTr}).pdf`;
    a.click();
  };

  const handleBelgelerimeKaydet = async () => {
    if (!pdfUrl) {
      openInfo("Bilgilendirme", "Önce 'Hazırla (PDF)' ile belgeyi oluşturunuz.");
      return;
    }

    const firmIdSafe = firmId || null;
    if (!firmIdSafe) {
      openInfo("Bilgilendirme", "Lütfen üst bardan bir firma seçiniz.");
      return;
    }

    const token = getAuthTokenSafe();
    if (!token) {
      openInfo("Hata", "Oturum bilgisi bulunamadı.");
      return;
    }

    const firmaAdi = selectedFirm?.firmaAdi || selectedFirm?.name || "Firma";
    const tarihTr = hazirlamaTarihi
      ? formatDateTR(hazirlamaTarihi)
      : new Date().toLocaleDateString("tr-TR");

    const yil = hazirlamaTarihi
      ? Number(hazirlamaTarihi.slice(0, 4))
      : new Date().getFullYear();

    let olusturan = "İSG Uzmanı";
    try {
      const kisisel = JSON.parse(localStorage.getItem("kisiselBilgiler") || "null");
      const user = getUserObj();

      olusturan =
  (kisisel?.adSoyad && `${kisisel.adSoyad}`) ||
  (user?.name && `${user.name}`) ||
  (user?.adSoyad && `${user.adSoyad}`) ||
  (user?.fullName && `${user.fullName}`) ||
  (user?.ad && `${user.ad}`) ||
  kisiler.uzman ||
  "İSG Uzmanı";
    } catch {}

    const safeFirma = sanitizeName(firmaAdi);
    const fileName = `${safeFirma} (Ekip-${tarihTr}).pdf`;

    const doSave = async () => {
      try {
        setLoading(true);

        const userObj = getUserObj();
        const fileBlob = await fetch(pdfUrl).then((r) => r.blob());

        const formData = new FormData();
        formData.append("file", fileBlob, fileName);

        const uploadRes = await fetch(`${API_BASE}/documents/upload-pdf`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        if (!uploadRes.ok) {
          const text = await uploadRes.text();
          console.error("PDF upload hata:", uploadRes.status, text);
          openInfo("Hata", `PDF yüklenemedi.\n\nHata Kodu: ${uploadRes.status}`);
          return;
        }

        const uploadJson = await uploadRes.json();
        const uploadedFileUrl = uploadJson?.fileUrl || uploadJson?.absoluteUrl || "";

        if (!uploadedFileUrl) {
          openInfo("Hata", "PDF dosya yolu alınamadı.");
          return;
        }

        const serverPayload = {
          firmaId: String(firmIdSafe),
          firmaAdi: firmaAdi || "",
          category: "risk",
          subCategory: "ekip",
          title: "Risk Değerlendirme Ekibi",
          type: "Risk Değerlendirme Ekibi",
          belgeTuru: "Risk Değerlendirme Ekibi",
          year: yil,
          createdBy: olusturan,
          createdByUserId: userObj?._id || userObj?.id,
          fileUrl: uploadedFileUrl,
          fileName,
        };

        const res = await fetch(`${API_BASE}/documents`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(serverPayload),
        });

        if (!res.ok) {
          const text = await res.text();
          console.error("Server belge kaydı başarısız:", res.status, text);
          openInfo(
            "Hata",
            `Belge server'a kaydedilemedi.\n\nHata Kodu: ${res.status}\n${text.slice(0, 300)}`
          );
          return;
        }

        try {
          window.dispatchEvent(new Event("documentsUpdated"));
          window.dispatchEvent(new Event("belgelerimUpdated"));
        } catch {}

        openInfo(
          "Bilgilendirme",
          "Belgelerim, Risk Değerlendirme sekmesine kaydedildi ✅"
        );
        setModalOpen(false);
      } catch (e) {
        console.error("Risk ekip kaydedilemedi:", e);
        openInfo("Hata", "Belge kaydedilirken hata oluştu.");
      } finally {
        setLoading(false);
      }
    };

    await doSave();
  };

  const renderLockedInput = (label, value) => (
    <div
      className="flex flex-col gap-1 text-sm cursor-pointer"
      onClick={handleLockedFieldClick}
    >
      <label className="text-sm font-medium text-gray-700 break-words">
        {label}
      </label>
      <input
        type="text"
        value={value || ""}
        readOnly
        className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 focus:outline-none"
      />
    </div>
  );

  return (
    <>
      <CardBox className="flex w-full flex-col gap-4 overflow-hidden p-3 sm:p-4 md:p-5">
        <SectionTitle
          title="Risk Değerlendirme Ekibi"
          subtitle="Kişi bilgileri Risk Değerlendirme Prosedürü sekmesinden otomatik olarak gelir ve burada değiştirilemez."
        />

        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm leading-6 text-amber-800 sm:px-4">
          <strong>Bilgi:</strong> Aşağıdaki kişi bilgileri{" "}
          <span className="font-semibold">Risk Değerlendirme Prosedürü</span>{" "}
          sekmesinden otomatik olarak gelmektedir.
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="w-full min-w-0">
            <label className="mb-1 block text-sm font-medium text-gray-700 break-words">
              Hazırlama Tarihi
            </label>

            <div className="w-full overflow-hidden rounded-lg border border-gray-300 bg-gray-50">
              <input
                type="date"
                value={hazirlamaTarihi}
                onChange={(e) => setHazirlamaTarihi(e.target.value)}
                className="block w-full appearance-none bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none"
                style={{
                  WebkitAppearance: "none",
                  appearance: "none",
                }}
              />
            </div>
          </div>

          <div className="hidden md:block" />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {renderLockedInput("İşveren / Vekili", kisiler.isveren)}
          {renderLockedInput("İşyeri Hekimi", kisiler.hekim)}
          {renderLockedInput("İş Güvenliği Uzmanı", kisiler.uzman)}
          {renderLockedInput("Çalışan Temsilcisi", kisiler.temsilci)}
          {renderLockedInput("Destek Elemanı", kisiler.destek)}
          {renderLockedInput("Bilgi Sahibi Kişi", kisiler.bilgi)}
        </div>

        <div className="mt-2 flex flex-col gap-2 sm:mt-4 sm:flex-row sm:flex-wrap sm:justify-end">
          <PrimaryButton
            size="sm"
            onClick={handleHazirla}
            disabled={loading}
            className={`w-full sm:w-auto sm:min-w-[160px] ${loading ? "cursor-wait" : ""}`}
          >
            {loading ? "Hazırlanıyor." : "Hazırla (PDF)"}
          </PrimaryButton>
        </div>
      </CardBox>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Risk Değerlendirme Ekibi"
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
              onClick={handleBelgelerimeKaydet}
              className="w-full sm:w-auto px-2 py-1 text-[10px] sm:text-xs"
            >
              Belgelerime Kaydet
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
            src={pdfUrl}
            className="h-[50vh] w-full rounded border border-gray-200 sm:h-[65vh]"
            title="Risk Değerlendirme Ekibi PDF"
          />
        )}

        {!loading && !pdfUrl && (
          <div className="flex h-[45vh] w-full items-center justify-center px-4 text-center text-sm text-gray-600 sm:h-[60vh]">
            PDF bulunamadı. Lütfen tekrar Hazırla deneyiniz.
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