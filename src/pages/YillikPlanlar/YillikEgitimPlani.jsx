import React, { useContext, useEffect, useMemo, useState } from "react";
import { SectionTitle, CardBox, PrimaryButton, Modal } from "../../components/ui";
import { FirmaContext } from "../../context/FirmaContext";
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

const safeParseLS = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
};

const DOCS_SYNC_KEY = "docs:lastChangeAt";

/** ✅ Token bulucu (referans dosya mantığı) */
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

    const email =
      userObj?.email ||
      userObj?.mail ||
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

const KONULAR = [
  "İŞYERİ TEMİZLİĞİ VE DÜZENİ",
  "ÇALIŞMA MEVZUATI İLE İLGİLİ BİLGİLER",
  "ÇALIŞANLARIN YASAL HAK VE SORUMLULUKLARI",
  "İŞ KAZASI VE MESLEK HASTALIĞINDAN DOĞAN HUKUKİ SONUÇLAR",
  "MESLEK HASTALIKLARININ SEBEPLERİ",
  "HASTALIKTAN KORUNMA PRENSİPLERİ VE KORUNMA TEKNİKLERİNİN UYGULANMASI",
  "BİYOLOJİK VE PSİKOLOJİK RİSK ETMENLERİ",
  "İLKYARDIM",
  "TÜTÜN ÜRÜNLERİNİN ZARARLARI VE PASİF ETKİLENİM",
  "KİMYASAL, FİZİKSEL VE ERGONOMİK RİSK ETMENLERİ",
  "ELLE KALDIRMA VE TAŞIMA",
  "YANGIN EĞİTİMİ",
  "İŞ EKİPMANLARININ GÜVENLİ KULLANIMI",
  "EKRANLI ARAÇLARLA ÇALIŞMA",
  "ELEKTRİK TEHLİKELERİ, RİSKLERİ VE ÖNLEMLERİ",
  "İŞYERİNDE SAĞLIK GÖZETİMİ",
  "KİŞİSEL KORUYUCU DONANIM KULLANIMI",
  "SAĞLIK VE GÜVENLİK GENEL KURALLARI VE GÜV. KÜL.",
  "TAHLİYE VE KURTARMA",
  "DİĞER",
  "DİĞER",
  "DİĞER",
];

export default function YillikEgitimPlani() {
  const { selectedFirm } = useContext(FirmaContext);

  const API_BASE =
    (import.meta.env.VITE_API_URL || "").trim().replace(/\/$/, "") ||
    "https://api.isgpanel.tr/api";

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

  const [planTarihi, setPlanTarihi] = useState("");
  const [pdfUrl, setPdfUrl] = useState(null);
  const [show, setShow] = useState(false);
const [loading, setLoading] = useState(false);
const [pdfProgress, setPdfProgress] = useState(0);
  const [downloadName, setDownloadName] = useState("YillikEgitimPlani.pdf");
  const [saving, setSaving] = useState(false);

  const [kurumsal, setKurumsal] = useState(() => safeParseLS("kurumsalBilgiler"));
  useEffect(() => {
    const loadKurumsal = () => {
      try {
        const raw = localStorage.getItem("kurumsalBilgiler");
        if (raw) {
          setKurumsal(JSON.parse(raw));
        } else {
          setKurumsal(null);
        }
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
        selectedFirm?.logoUrl ||
        selectedFirm?.logo ||
        "";

      if (!rawLogoUrl) return "";

      const absoluteLogoUrl = toAbsoluteUrl(rawLogoUrl);

      const tokenValue =
        localStorage.getItem("token") ||
        localStorage.getItem("jwt") ||
        localStorage.getItem("accessToken") ||
        localStorage.getItem("authToken") ||
        sessionStorage.getItem("token") ||
        sessionStorage.getItem("jwt") ||
        sessionStorage.getItem("accessToken") ||
        sessionStorage.getItem("authToken") ||
        "";

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

  const kisiselLS = useMemo(() => safeParseLS("kisiselBilgiler"), []);
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

  const firmId = selectedFirm?.id || selectedFirm?._id || null;
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

    useEffect(() => {
    const pickFirst = (...vals) => vals.find((v) => String(v || "").trim()) || "";
    const hasAny = (obj) => Object.values(obj || {}).some((x) => String(x || "").trim());

    const emptyThreeSignatures = {
      isveren: { imza: null, paraf: null },
      uzman: { imza: null, paraf: null },
      hekim: { imza: null, paraf: null },
    };

    const run = async () => {
      if (!firmId) return;

      const token = getAuthToken(user);

      if (token) {
        try {
          const r = await fetch(`${API_BASE}/firma/${firmId}/kisiler`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (r.ok) {
            const data = await r.json();
            const next = {
              isveren: pickFirst(
                data?.isveren,
                data?.isverenAdSoyad,
                data?.isverenVekiliAdSoyad,
                data?.isverenVekili
              ),
              hekim: pickFirst(
                data?.hekim,
                data?.isyeriHekimiAdSoyad,
                data?.isyeriHekimiAdiSoyadi
              ),
              uzman: pickFirst(
                data?.uzman,
                data?.isgUzmaniAdSoyad,
                data?.isgUzmaniAdiSoyadi
              ),
            };

            if (hasAny(next)) {
              setProsedurKisiler(next);
            }
          }
        } catch (e) {
          console.error("Firma kişi bilgileri alınamadı:", e);
        }

        try {
          const imzaRes = await fetch(`${API_BASE}/firma/${firmId}/imzalar`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (imzaRes.ok) {
            const imzaData = await imzaRes.json();
            setProsedurImzalar({
              isveren: imzaData?.isveren || { imza: null, paraf: null },
              uzman: imzaData?.uzman || { imza: null, paraf: null },
              hekim: imzaData?.hekim || { imza: null, paraf: null },
            });
            return;
          } else {
            setProsedurImzalar(emptyThreeSignatures);
          }
        } catch (e) {
          console.error("Firma imza bilgileri alınamadı:", e);
          setProsedurImzalar(emptyThreeSignatures);
        }
      }

      if (token) {
        try {
          const r = await fetch(`${API_BASE}/profile/personal`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (r.ok) {
            const p = await r.json();
            const next = {
              isveren: pickFirst(p?.isverenVekiliAdSoyad, p?.isverenAdSoyad, p?.isveren),
              uzman: pickFirst(p?.isgUzmaniAdSoyad, p?.uzman),
              hekim: pickFirst(p?.isyeriHekimiAdSoyad, p?.hekim),
            };

            if (hasAny(next)) {
              setProsedurKisiler(next);
              return;
            }
          }
        } catch (e) {
          console.warn("profile/personal alınamadı:", e);
        }
      }

      try {
        const raw = localStorage.getItem(firmKey);
        if (!raw) return;
        const saved = JSON.parse(raw) || {};
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
        if (hasAny(next)) setProsedurKisiler(next);
      } catch (e) {
        console.error("LocalStorage kişi bilgileri okunamadı:", e);
      }
    };

    run();
  }, [API_BASE, firmId, firmKey, user]);


  useEffect(() => {
    return () => {
      try {
        if (pdfUrl && String(pdfUrl).startsWith("blob:")) {
          URL.revokeObjectURL(pdfUrl);
        }
      } catch {}
    };
  }, [pdfUrl]);

  const firmaAdi = selectedFirm?.firmaAdi || "";
  const tehlikeText = selectedFirm?.tehlike || "";
  const tehlikeLower = (tehlikeText || "").toLowerCase();

 const egitimSureleri = useMemo(() => {
  // Az Tehlikeli => 2 + 2 + 2 + 2
  if (tehlikeLower.includes("az")) {
    return { b1: 2, b2: 2, b3: 2, b4: 2, toplam: 8 };
  }

  // Çok Tehlikeli => 2 + 1 + 1 + 4
  if (tehlikeLower.includes("çok")) {
    return { b1: 2, b2: 1, b3: 1, b4: 4, toplam: 8 };
  }

  // Tehlikeli => 2 + 2 + 1 + 3
  if (tehlikeLower.includes("tehlikeli")) {
    return { b1: 2, b2: 2, b3: 1, b4: 3, toplam: 8 };
  }

  return { b1: 2, b2: 2, b3: 2, b4: 2, toplam: 8 };
}, [tehlikeLower]);

  const baslangicTr = toTR(planTarihi);
  const yil =
    planTarihi && !isNaN(new Date(planTarihi))
      ? new Date(planTarihi).getFullYear()
      : new Date().getFullYear();
  const bitisTr = `31.12.${yil}`;

  const readonlyInputClass =
    "w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-2.5 text-sm text-gray-800";

  const dateInputClass =
    "w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-800";

  const handlePrepare = async () => {
    if (!planTarihi) {
      openInfo("Bilgilendirme", "Lütfen plan tarihini seçiniz.");
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

      const isgAdSoyad =
        prosedurKisiler?.uzman ||
        kisiselLS?.adSoyad ||
        `${kisiselLS?.ad || ""} ${kisiselLS?.soyad || ""}`.trim();

      const hekimAdSoyad =
        prosedurKisiler?.hekim ||
        hekimLS?.adSoyad ||
        `${hekimLS?.ad || ""} ${hekimLS?.soyad || ""}`.trim();

      const isverenAdSoyad =
        prosedurKisiler?.isveren ||
        isverenLS?.adSoyad ||
        `${isverenLS?.ad || ""} ${isverenLS?.soyad || ""}`.trim();

      const token = getAuthToken(user);
      const finalLogo = await buildFinalLogo();

      const payload = {
        kurumsal: {
          logo: finalLogo || "",
          logoUrl: "",
        },
        firma: {
          firmaAdi,
          adres: selectedFirm?.adres || "",
          nace: selectedFirm?.nace || "",
          tehlikeSinifi: tehlikeText || "",
        },
        tarihler: {
          hazirlamaTr: baslangicTr,
          gecerlilikTr: bitisTr,
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
    kisiselLS?.sertifikaNo ||
    kisiselLS?.sertifika_no ||
    "",

  sertifikaSinifi:
    kisiselLS?.sertifikaSinifi ||
    kisiselLS?.sertifika_sinifi ||
    "",
},
        egitimSureleri: {
          bolum1Saat: egitimSureleri.b1,
          bolum2Saat: egitimSureleri.b2,
          bolum3Saat: egitimSureleri.b3,
          toplamSaat: egitimSureleri.toplam,
        },
        konular: KONULAR,
      };

      const res = await fetch(`${API_BASE}/yillik-egitim-plani/pdf`, {
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

  const text = await res.text();
  openInfo("Hata", `PDF oluşturulamadı:\n${text.slice(0, 400)}`);
  return;
}

      const blob = await res.blob();

      if (pdfUrl && String(pdfUrl).startsWith("blob:")) {
        URL.revokeObjectURL(pdfUrl);
      }

     const objectUrl = URL.createObjectURL(blob);

clearInterval(progressTimer);
setPdfProgress(100);
setPdfUrl(objectUrl);

setTimeout(() => {
  setLoading(false);
}, 400);

      const tarihTr = toTR(planTarihi) || new Date().toLocaleDateString("tr-TR");
      setDownloadName(`${sanitizeName(firmaAdi)} (YEP-${tarihTr}).pdf`);

      setShow(true);
    } catch (e) {
  clearInterval(progressTimer);
  setLoading(false);
  setPdfProgress(0);

  console.error(e);
  openInfo("Hata", "PDF hazırlanırken bir hata oluştu.");
}
  };

  const handleYeniSekmedeAc = () => {
    if (!pdfUrl) {
      openInfo("Bilgilendirme", "Önce Hazırla (PDF) ile belgeyi oluşturunuz.");
      return;
    }
    window.open(pdfUrl, "_blank", "noopener,noreferrer");
  };

  const handleIndir = async () => {
    try {
      if (!pdfUrl) {
        openInfo("Bilgilendirme", "Önce Hazırla (PDF) ile belgeyi oluşturunuz.");
        return;
      }

      const res = await fetch(pdfUrl);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = downloadName || "YillikEgitimPlani.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(() => {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch {}
      }, 1500);
    } catch (e) {
      console.error("PDF indirme hatası:", e);
      openInfo("Hata", "PDF indirilemedi.");
    }
  };

  const saveToDocs = async () => {
    if (!pdfUrl) {
      openInfo("Bilgilendirme", "Önce 'Hazırla (PDF)' ile belgeyi oluştur.");
      return;
    }

    if (!selectedFirm?.id && !selectedFirm?._id) {
      openInfo("Bilgilendirme", "Geçerli bir firma seçili değil.");
      return;
    }

    const currentFirmId = selectedFirm?._id || selectedFirm?.id;
    const firmaAdiLocal = selectedFirm?.firmaAdi || "Firma";
    const tarihTr = toTR(planTarihi) || new Date().toLocaleDateString("tr-TR");
    const yilLocal = Number(tarihTr.slice(6, 10)) || new Date().getFullYear();

    const doSave = async () => {
      try {
        setSaving(true);

        const hazirlayan =
          (kisiselLS?.adSoyad && `${kisiselLS.adSoyad}`) ||
          (user?.ad && `${user.ad} (İSG Uzmanı)`) ||
          (user?.name && `${user.name} (İSG Uzmanı)`) ||
          "İSG Uzmanı";

        const fileName = `${sanitizeName(firmaAdiLocal)} (YEP-${tarihTr}).pdf`;
        const token = getAuthToken(user);

        if (!token) {
          openInfo("Hata", "Oturum bulunamadı.");
          return;
        }

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
          console.error("YEP pdf upload hata:", text);
          openInfo("Hata", "PDF dosyası sunucuya yüklenemedi.");
          return;
        }

        const uploadJson = await uploadRes.json();
        const uploadedFileUrl = uploadJson?.fileUrl || "";
        const uploadedAbsoluteUrl = uploadJson?.absoluteUrl || "";

        const payload = {
          firmaId: String(currentFirmId),
          firmaAdi: firmaAdiLocal,
          category: "yillik",
          subCategory: "yillik-egitim-plani",
          title: "Yıllık Eğitim Planı (YEP)",
          year: yilLocal,
          createdBy: hazirlayan,
          createdByUserId: user?._id || user?.id,
          hazirlayan,
          personName: hazirlayan,
          belgeTuru: "Yıllık Eğitim Planı (YEP)",
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
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const text = await res.text();
          console.error("YEP kayıt hatası:", text);
          openInfo("Hata", "Belge servera kaydedilemedi.");
          return;
        }

        await res.json().catch(() => null);

        try {
          localStorage.setItem(DOCS_SYNC_KEY, String(Date.now()));
        } catch {}

        setShow(false);
        openInfo("Bilgilendirme", "Belgelerim, Yıllık Planlar sekmesine kaydedildi ✅");
      } catch (e) {
        console.error("Yıllık Eğitim Planı kaydedilemedi:", e);
        openInfo("Hata", "Belge kaydedilirken hata oluştu.");
      } finally {
        setSaving(false);
      }
    };

    openConfirm({
      title: "Onay",
      message: `${firmaAdiLocal} için ${yilLocal} yılına ait "Yıllık Eğitim Planı (YEP)" kaydedilecektir.\n\nDevam etmek ister misiniz?`,
      confirmText: "Kaydet",
      cancelText: "İptal",
      variant: "warning",
      onConfirm: doSave,
    });
  };

  return (
    <>
      <CardBox className="flex flex-col gap-4">
        <SectionTitle
          title="Yıllık Eğitim Planı"
          subtitle="Tehlike sınıfına göre yıllık eğitim saatlerini otomatik hesaplayıp, PDF oluşturabilirsiniz."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <input readOnly value={firmaAdi} className={`${readonlyInputClass} min-w-0 h-11 text-sm`} />
          <input readOnly value={tehlikeText} className={`${readonlyInputClass} min-w-0 h-11 text-sm`} />
          <input
  type="date"
  value={planTarihi}
  onChange={(e) => setPlanTarihi(e.target.value)}
  className="w-full min-w-0 h-11 rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-800 [color-scheme:light]"
  style={{
    WebkitAppearance: "none",
    appearance: "none",
  }}
/>
          <input readOnly value={bitisTr} className={`${readonlyInputClass} min-w-0 h-11 text-sm`} />
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5">
            <span className="font-semibold">Bilgi:</span> Plan tarihi seçildikten sonra{" "}
            <span className="font-semibold">"Hazırla (PDF)"</span> ile belge oluşturulur ve
            popup içinde PDF olarak açılır. Tehlike sınıfına göre süre otomatik yazılır.
          </p>

          <div className="text-xs border border-slate-200 rounded-lg px-4 py-2.5 bg-slate-50 min-w-[220px]">
            <div className="font-semibold text-slate-700 mb-1">Toplam Eğitim Süresi</div>
            <div className="mb-1">
              {tehlikeText} işyeri için:{" "}
              <span className="font-semibold">{egitimSureleri.toplam} saat</span>
            </div>
            <div className="text-[11px] text-slate-600">
              Dağılım: {egitimSureleri.b1} + {egitimSureleri.b2} + {egitimSureleri.b3} + {egitimSureleri.b4}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2 border-t border-slate-200">
          <PrimaryButton
            type="button"
            size="sm"
            onClick={handlePrepare}
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
        title="Yıllık Eğitim Planı"
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
            title="Yıllık Eğitim Planı"
            className="w-full h-[50vh] sm:h-[60vh] border border-gray-200 rounded"
          />
        )}

        {!loading && !pdfUrl && (
          <div className="w-full h-[50vh] sm:h-[60vh] flex items-center justify-center text-sm text-gray-600">
            PDF bulunamadı. Lütfen "Hazırla (PDF)" butonu ile oluşturunuz.
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