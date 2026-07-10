import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFirmalar } from "../../context/FirmaContext";
import { CardBox, Modal, PrimaryButton, SectionTitle } from "../../components/ui";
import ConfirmModal from "../../components/ui/ConfirmModal";

// API adresi
const API_BASE =
  (import.meta.env.VITE_API_URL || "").trim().replace(/\/$/, "") ||
  "https://api.isgpanel.tr";

const DOF_SYNC_KEY = "dof:lastChangeAt";

const EMPTY_FORM = {
  tarih: "",
  kayitNo: "",
  tanim: "",
  neden: "",
  faaliyet: "",
  planBitis: "",
  takipSonucu: "",
  yeniFaaliyetNo: "",
};

const sanitizeName = (s) =>
  (s || "Firma")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9ÇĞİÖŞÜçğıöşü \-_.]/g, "")
    .trim() || "Firma";

const yearFromTrDate = (tarihStr) => {
  if (!tarihStr) return null;
  const m = String(tarihStr).trim().match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (m) return Number(m[3]);
  const y = String(tarihStr).trim().match(/\b(19|20)\d{2}\b/);
  return y ? Number(y[0]) : null;
};

const pad3 = (n) => String(n).padStart(3, "0");

function normalizeLogoForPdf(rawLogo, apiBase) {
  if (!rawLogo) return "";

  const s = String(rawLogo).trim();
  if (!s) return "";

  if (s.startsWith("data:image/")) return s;

  if (/^[a-zA-Z]:\\/.test(s)) {
    console.warn("Logo yerel path görünüyor (C:\\...). PDF içinde görünmez:", s);
    return "";
  }

  const looksBase64 = /^[A-Za-z0-9+/=\s]+$/.test(s) && s.length > 200;
  if (looksBase64) {
    return `data:image/png;base64,${s.replace(/\s/g, "")}`;
  }

  if (s.startsWith("/uploads")) {
    return `https://api.isgpanel.tr${s}`;
  }

  if (s.startsWith("/")) {
    return `${apiBase}${s}`;
  }

  if (s.startsWith("http://") || s.startsWith("https://")) {
    return s
      .replace("https://api.isgpanel.tr/api/uploads/", "https://api.isgpanel.tr/uploads/")
      .replace("/api/uploads/", "/uploads/");
  }

  if (!s.includes("://") && !s.startsWith("data:")) {
    return `${apiBase}/${s.replace(/^\/+/, "")}`;
  }

  return s;
}

function getAuthTokenSafe() {
  try {
    return (
      localStorage.getItem("token") ||
      localStorage.getItem("jwt") ||
      localStorage.getItem("accessToken") ||
      localStorage.getItem("authToken") ||
      ""
    );
  } catch {
    return "";
  }
}

function parseJsonSafe(v) {
  try {
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}

function getCurrentUserSafe() {
  return (
    parseJsonSafe(localStorage.getItem("user")) ||
    parseJsonSafe(localStorage.getItem("ticari_user")) ||
    parseJsonSafe(localStorage.getItem("bireysel_user")) ||
    parseJsonSafe(localStorage.getItem("auth_user")) ||
    parseJsonSafe(localStorage.getItem("currentUser")) ||
    null
  );
}

async function apiFetch(url, options = {}) {
  const token = getAuthTokenSafe();
  const headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(url, {
    ...options,
    headers,
  });

  return res;
}

export default function Dof() {
  const { selectedFirm } = useFirmalar() || {};

  const [autoData, setAutoData] = useState({
  firmaAdi: "",
  sgkSicilNo: "",
  uzmanAdi: "",
  isverenAdi: "",
  uzmanRaw: "",
  uzmanSertifikaNo: "",
  uzmanSertifikaSinifi: "",
});

  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
const [pdfProgress, setPdfProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [downloadName, setDownloadName] = useState("DOF.pdf");
  const [isDirty, setIsDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);

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

  const lastLoadedRef = useRef("");
  const isMountedRef = useRef(true);

  const kurumsal = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("kurumsalBilgiler") || "null");
    } catch {
      return null;
    }
  }, []);

  const firmId = selectedFirm?.id || selectedFirm?._id || null;

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

  const buildDefaultKayitNo = useCallback((currentForm = EMPTY_FORM) => {
    const year = yearFromTrDate(currentForm?.tarih) || new Date().getFullYear();
    return `DOF-${year}-${pad3(1)}`;
  }, []);

  const normalizeServerForm = useCallback(
    (incoming) => {
      const merged = {
        ...EMPTY_FORM,
        ...(incoming || {}),
      };

      if (!merged.kayitNo) {
        merged.kayitNo = buildDefaultKayitNo(merged);
      }

      return merged;
    },
    [buildDefaultKayitNo]
  );

  const buildServerPayloadForm = useCallback(() => {
    const uzman = autoData.uzmanAdi || "";
    const isveren = autoData.isverenAdi || "";

    return {
      tarih: form.tarih || "",
      tespitBirim: "İŞ SAĞLIĞI VE GÜVENLİĞİ",
      kayitNo: form.kayitNo || "",
      tespitKaynak: "isgUzmani",
      tespitKaynakDiger: "",
      isgUzmani: uzman,
      tanim: form.tanim || "",
      neden: form.neden || "",
      faaliyet: form.faaliyet || "",
      bolumSorumlusu: uzman,
      ilgiliBolumSorumlusu: isveren,
      planBaslangic: form.tarih || "",
      planBitis: form.planBitis || "",
      gercekBaslangic: "",
      gercekBitis: "",
      takipSonucu: form.takipSonucu || "",
      yeniFaaliyetNo: form.yeniFaaliyetNo || "",
      talepEden: isveren,
      yonetimTemsilcisi: isveren,
    };
  }, [autoData.isverenAdi, autoData.uzmanAdi, form]);

  const emitSync = useCallback(() => {
    try {
      const now = String(Date.now());
      localStorage.setItem(DOF_SYNC_KEY, now);
      window.dispatchEvent(new Event("dofUpdated"));
      window.dispatchEvent(new Event("documentsUpdated"));
      window.dispatchEvent(new Event("belgelerimUpdated"));
    } catch {}
  }, []);

  const loadAutoData = useCallback(async () => {
    try {
      let firmaAdi = "";
      let sgkSicilNo = "";
      let isverenAdi = "";

      if (selectedFirm) {
        const f = selectedFirm;
        firmaAdi =
          f.firmaAdi ||
          f.unvan ||
          f.firmaUnvani ||
          f.firma_adi ||
          f.adi ||
          f.adiSoyadi ||
          "";
        sgkSicilNo =
          f.sgkSicilNo ||
          f.sgkNo ||
          f.sgk ||
          f.sgkSicil ||
          "";
        isverenAdi =
          f.isverenAdi ||
          f.isverenAdSoyad ||
          f.isverenVekili ||
          f.yetkiliKisi ||
          f.yetkili ||
          f.firmaYetkilisi ||
          f.ownerName ||
          "";
      } else {
        const firmaStr =
          localStorage.getItem("seciliFirma") ||
          localStorage.getItem("selectedFirma") ||
          localStorage.getItem("firmaBilgileri");

        if (firmaStr) {
          const firma = JSON.parse(firmaStr);
          firmaAdi =
            firma.firmaAdi ||
            firma.unvan ||
            firma.firmaUnvani ||
            firma.firma_adi ||
            firma.adi ||
            firma.adiSoyadi ||
            "";
          sgkSicilNo =
            firma.sgkSicilNo ||
            firma.sgkNo ||
            firma.sgk ||
            firma.sgkSicil ||
            "";
          isverenAdi =
            firma.isverenAdi ||
            firma.isverenAdSoyad ||
            firma.isverenVekili ||
            firma.yetkiliKisi ||
            firma.yetkili ||
            firma.firmaYetkilisi ||
            firma.ownerName ||
            "";
        }
      }

      let uzmanAdi = "";

      let uzmanRaw = "";
let uzmanSertifikaNo = "";
let uzmanSertifikaSinifi = "";
      const token = getAuthTokenSafe();

    if (token && firmId) {
  try {
    const res = await apiFetch(`${API_BASE}/firma/${firmId}/kisiler`);
    if (res.ok) {
      const p = await res.json();
      uzmanRaw = p?.uzman || p?.isgUzmaniAdSoyad || "";
      uzmanAdi = uzmanRaw || uzmanAdi;

      isverenAdi =
        isverenAdi ||
        p?.isveren ||
        p?.isverenVekili ||
        p?.yetkili ||
        "";

      uzmanSertifikaNo =
        p?.sertifikaNo ||
        p?.uzmanSertifikaNo ||
        p?.isgUzmaniSertifikaNo ||
        uzmanSertifikaNo;

      uzmanSertifikaSinifi =
        p?.sertifikaSinifi ||
        p?.uzmanSertifikaSinifi ||
        p?.isgUzmaniSertifikaSinifi ||
        uzmanSertifikaSinifi;
    }
  } catch (err) {
    console.error("DÖF uzman / işveren API okuma hatası:", err);
  }
}

      if (!uzmanAdi && firmId) {
        try {
          const raw = localStorage.getItem(`risk_prosedur_kisiler_${firmId}`);
          if (raw) {
            const saved = JSON.parse(raw);
            uzmanAdi = saved?.uzman || "";
            isverenAdi =
              isverenAdi ||
              saved?.isveren ||
              saved?.isverenVekili ||
              saved?.yetkili ||
              "";
          }
        } catch (err) {
          console.error("DÖF kişiler localStorage okuma hatası:", err);
        }
      }
try {
  const kisiStr = localStorage.getItem("kisiselBilgiler");
  if (kisiStr) {
    const kisi = JSON.parse(kisiStr);

    if (!uzmanAdi) {
      uzmanAdi =
        kisi.uzmanAdi ||
        kisi.adSoyad ||
        kisi.adıSoyadı ||
        kisi.ad_soyad ||
        "";
    }

    uzmanSertifikaNo =
      uzmanSertifikaNo ||
      kisi.sertifikaNo ||
      kisi.uzmanSertifikaNo ||
      "";

    uzmanSertifikaSinifi =
      uzmanSertifikaSinifi ||
      kisi.sertifikaSinifi ||
      kisi.uzmanSertifikaSinifi ||
      "";
  }
} catch (err) {
  console.error("DÖF uzman kisiselBilgiler okuma hatası:", err);
}

      if (isMountedRef.current) {
        setAutoData({
  firmaAdi,
  sgkSicilNo,
  uzmanAdi,
  isverenAdi,
  uzmanRaw,
  uzmanSertifikaNo,
  uzmanSertifikaSinifi,
});
      }
    } catch (err) {
      console.error("Otomatik bilgiler okunurken hata:", err);
    }
  }, [firmId, selectedFirm]);

  const loadDraftFromServer = useCallback(
    async ({ silent = false } = {}) => {
      if (!firmId) {
        setForm(normalizeServerForm(EMPTY_FORM));
        setIsDirty(false);
        return;
      }

      try {
        if (!silent) setFormLoading(true);

        const res = await apiFetch(`${API_BASE}/dof/form/${firmId}`, {
          method: "GET",
        });

        if (res.status === 404) {
          const fresh = normalizeServerForm({
            ...EMPTY_FORM,
            kayitNo: buildDefaultKayitNo(),
          });
          if (isMountedRef.current) {
            setForm(fresh);
            setIsDirty(false);
            lastLoadedRef.current = JSON.stringify(fresh);
          }
          return;
        }

        if (!res.ok) {
          const text = await res.text();
          console.error("DÖF form okunamadı:", res.status, text);
          return;
        }

        const json = await res.json();
        const serverForm = normalizeServerForm(json?.form || json?.data || json);

        const serialized = JSON.stringify(serverForm);

        if (isMountedRef.current) {
          setForm(serverForm);
          setIsDirty(false);
          lastLoadedRef.current = serialized;
          setLastSavedAt(json?.updatedAt || json?.savedAt || null);
        }
      } catch (err) {
        console.error("DÖF form server yükleme hatası:", err);
      } finally {
        if (isMountedRef.current && !silent) {
          setFormLoading(false);
        }
      }
    },
    [API_BASE, buildDefaultKayitNo, firmId, normalizeServerForm]
  );

  const saveDraftToServer = useCallback(
    async ({ showMessage = true, overrideForm = null } = {}) => {
      if (!firmId) {
        openInfo("Bilgilendirme", "Lütfen üst bardan bir firma seçiniz.");
        return false;
      }

      try {
        setSaving(true);

        const payloadForm = overrideForm || form;
        const body = {
          firmaId: String(firmId),
          form: payloadForm,
        };

        const res = await apiFetch(`${API_BASE}/dof/form/${firmId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const text = await res.text();
          console.error("DÖF form server kaydı başarısız:", res.status, text);
          openInfo("Hata", `DÖF formu server'a kaydedilemedi.\n\nHata Kodu: ${res.status}`);
          return false;
        }

        const json = await res.json().catch(() => null);
        const normalized = normalizeServerForm(payloadForm);

        setForm(normalized);
        setIsDirty(false);
        setLastSavedAt(json?.updatedAt || new Date().toISOString());
        lastLoadedRef.current = JSON.stringify(normalized);
        emitSync();

        if (showMessage) {
          openInfo("Bilgilendirme", "DÖF formu kaydedildi ✅");
        }

        return true;
      } catch (e) {
        console.error("DÖF formu kaydedilirken hata:", e);
        openInfo("Hata", "DÖF formu kaydedilirken hata oluştu.");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [API_BASE, emitSync, firmId, form, normalizeServerForm]
  );

  const deleteDraftFromServer = useCallback(async () => {
    if (!firmId) return false;

    try {
      const res = await apiFetch(`${API_BASE}/dof/form/${firmId}`, {
        method: "DELETE",
      });

      if (!res.ok && res.status !== 404) {
        const text = await res.text();
        console.error("DÖF form silinemedi:", res.status, text);
        openInfo("Hata", `Server'daki DÖF taslağı silinemedi.\n\nHata Kodu: ${res.status}`);
        return false;
      }

      emitSync();
      return true;
    } catch (e) {
      console.error("DÖF form silme hatası:", e);
      openInfo("Hata", "Server'daki DÖF taslağı silinirken hata oluştu.");
      return false;
    }
  }, [API_BASE, emitSync, firmId]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  useEffect(() => {
    loadAutoData();
  }, [loadAutoData]);

  useEffect(() => {
    loadDraftFromServer();
  }, [loadDraftFromServer]);

  useEffect(() => {
    const onFocus = () => {
      loadDraftFromServer({ silent: true });
    };

    const onStorage = (e) => {
      if (e.key === DOF_SYNC_KEY) {
        loadDraftFromServer({ silent: true });
      }
    };

    const onCustomSync = () => {
      loadDraftFromServer({ silent: true });
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);
    window.addEventListener("dofUpdated", onCustomSync);
    window.addEventListener("documentsUpdated", onCustomSync);

    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("dofUpdated", onCustomSync);
      window.removeEventListener("documentsUpdated", onCustomSync);
    };
  }, [loadDraftFromServer]);

  const handleChange = (field) => (e) => {
    const upperCaseFields = ["kayitNo", "tanim", "neden", "faaliyet", "yeniFaaliyetNo"];
    let value = e.target.value;

    if (upperCaseFields.includes(field)) {
      value = value.toLocaleUpperCase("tr-TR");
    }

    setForm((prev) => {
      const updated = { ...prev, [field]: value };
      setIsDirty(JSON.stringify(updated) !== lastLoadedRef.current);
      return updated;
    });
  };

  const handleSaveOrUpdate = async () => {
    await saveDraftToServer({ showMessage: true });
  };

  const handleReset = () => {
    openConfirm({
      title: "Yeni DÖF",
      message:
        "Form alanları sıfırlansın ve server'daki mevcut taslak silinsin mi?",
      onConfirm: async () => {
        const fresh = normalizeServerForm({
          ...EMPTY_FORM,
          kayitNo: buildDefaultKayitNo(),
        });

        const deleted = await deleteDraftFromServer();
        if (!deleted) return;

        setForm(fresh);
        setIsDirty(false);
        setLastSavedAt(null);
        lastLoadedRef.current = JSON.stringify(fresh);

        if (pdfUrl) {
          URL.revokeObjectURL(pdfUrl);
          setPdfUrl(null);
        }
        setShowModal(false);

        openInfo("Bilgilendirme", "Yeni DÖF formu hazırlandı ✅");
      },
    });
  };

  const handleYeniSekmedeAc = () => {
    if (!pdfUrl) {
      openInfo("Bilgilendirme", "Önce 'Hazırla (PDF)' ile belgeyi oluşturun.");
      return;
    }
    window.open(pdfUrl, "_blank", "noopener,noreferrer");
  };

  const handleGenerate = async () => {
    try {
      if (!firmId) {
        openInfo("Bilgilendirme", "Lütfen üst bardan bir firma seçiniz.");
        return;
      }

      if (!form.tarih || !form.kayitNo || !form.tanim || !form.neden || !form.faaliyet) {
        openInfo(
          "Bilgilendirme",
          "Lütfen tarih, kayıt no, uygunsuzluk tanımı, neden ve faaliyet alanlarını doldurunuz."
        );
        return;
      }

      if (isDirty) {
        const saved = await saveDraftToServer({ showMessage: false });
        if (!saved) return;
      }

      setLoading(true);
setPdfProgress(5);
setShowModal(true);
setPdfUrl(null);

const progressTimer = setInterval(() => {
  setPdfProgress((prev) => {
    if (prev >= 92) return prev;
    return prev + Math.floor(Math.random() * 6) + 2;
  });
}, 700);

      const rawLogo =
        kurumsal?.logoUrl ||
        kurumsal?.logo ||
        kurumsal?.firmaLogo ||
        kurumsal?.logo_path ||
        kurumsal?.logoBase64 ||
        kurumsal?.logoDataUrl ||
        selectedFirm?.logoUrl ||
        selectedFirm?.logo ||
        selectedFirm?.firmaLogo ||
        "";

      let logoUrl = normalizeLogoForPdf(rawLogo, API_BASE);

      logoUrl = logoUrl
        .replace("https://api.isgpanel.tr/api/uploads/", "https://api.isgpanel.tr/uploads/")
        .replace("/api/uploads/", "/uploads/");

      if (logoUrl.includes("/api/uploads/")) {
        logoUrl = logoUrl.replace("/api/uploads/", "/uploads/");
      }

      let base64Logo = logoUrl?.startsWith("data:image") ? logoUrl : "";

      if (logoUrl && !logoUrl.startsWith("data:image")) {
        try {
          const token = getAuthTokenSafe();

          const res = await fetch(logoUrl, {
            method: "GET",
            mode: "cors",
            cache: "no-store",
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });

          if (!res.ok) {
            throw new Error(`Logo alınamadı: ${res.status} ${res.statusText}`);
          }

          const blob = await res.blob();

          base64Logo = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(String(reader.result || ""));
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch (e) {
          console.error("DOF logo base64 hatası:", e);
        }
      }

     const firmaImzalariRes = await apiFetch(`${API_BASE}/firma/${firmId}/imzalar`);
let firmaImzalari = {};

if (firmaImzalariRes.ok) {
  const imzaJson = await firmaImzalariRes.json().catch(() => null);
  firmaImzalari = imzaJson?.payload || imzaJson || {};
}

const payload = {
  kurumsal: {
    logoUrl: base64Logo || "",
  },

  firma: {
    firmaAdi: autoData.firmaAdi || selectedFirm?.firmaAdi || "",
    sgkSicilNo: autoData.sgkSicilNo || selectedFirm?.sgkSicilNo || "",
  },

  uzman: {
    adSoyad: autoData.uzmanAdi || "",
  },

  isveren: {
    adSoyad: autoData.isverenAdi || "",
  },

  kisiler: {
    uzman: autoData.uzmanRaw || autoData.uzmanAdi || "",
    isveren: autoData.isverenAdi || "",
  },

  kisisel: {
    sertifikaNo: autoData.uzmanSertifikaNo || "",
    sertifikaSinifi: autoData.uzmanSertifikaSinifi || "",
  },

  imzalar: {
    uzman: {
      imza: {
        dataUrl:
          firmaImzalari?.uzman?.imza?.dataUrl ||
          firmaImzalari?.uzman?.imza ||
          "",
      },
    },
    isveren: {
      imza: {
        dataUrl:
          firmaImzalari?.isveren?.imza?.dataUrl ||
          firmaImzalari?.isveren?.imza ||
          firmaImzalari?.isverenVekili?.imza?.dataUrl ||
          firmaImzalari?.isverenVekili?.imza ||
          "",
      },
    },
  },

  form: buildServerPayloadForm(),
};

      const token = getAuthTokenSafe();

      const res = await fetch(`${API_BASE}/dof/pdf`, {
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
      const objectUrl = URL.createObjectURL(blob);
if (pdfUrl) URL.revokeObjectURL(pdfUrl);

clearInterval(progressTimer);
setPdfProgress(100);
setPdfUrl(objectUrl);

setTimeout(() => {
  setLoading(false);
}, 400);

      const safeName = sanitizeName(
        autoData.firmaAdi || selectedFirm?.firmaAdi || "Firma"
      );
      const tarihTr =
        form?.tarih && form.tarih.includes(".")
          ? form.tarih
          : new Date().toLocaleDateString("tr-TR");

      setDownloadName(`${safeName} (DOF-${form?.kayitNo || "NO"}-${tarihTr}).pdf`);
      setShowModal(true);
    } catch (e) {
  clearInterval(progressTimer);
  setLoading(false);
  setPdfProgress(0);

  openInfo("Hata", "PDF hazırlanırken hata: " + (e?.message || e));
}
  };

  const saveToDocs = async () => {
    if (!pdfUrl) {
      openInfo("Bilgilendirme", "Önce 'Hazırla (PDF)' ile belgeyi oluşturun.");
      return;
    }

    const firmIdSafe = selectedFirm?.id || selectedFirm?._id || null;
    if (!firmIdSafe) {
      openInfo("Bilgilendirme", "Lütfen üst bardan bir firma seçiniz.");
      return;
    }

    try {
      setSaving(true);

      const token = getAuthTokenSafe();
      if (!token) {
        openInfo("Hata", "Oturum bilgisi bulunamadı.");
        return;
      }

      const firmaAdi =
        autoData.firmaAdi ||
        selectedFirm?.firmaAdi ||
        selectedFirm?.name ||
        "Firma";

      const tarihTr =
        form?.tarih && String(form.tarih).includes(".")
          ? form.tarih
          : new Date().toLocaleDateString("tr-TR");

      const yil = yearFromTrDate(tarihTr) || new Date().getFullYear();
      const userObj = getCurrentUserSafe();

const olusturan =
  userObj?.name ||
  userObj?.adSoyad ||
  userObj?.fullName ||
  userObj?.ad ||
  autoData.uzmanAdi ||
  "İSG Uzmanı";

      const safeFirma = sanitizeName(firmaAdi);
      const fileName = `${safeFirma} (DOF-${form?.kayitNo || "NO"}-${tarihTr}).pdf`;

     
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
        console.error("DOF PDF upload hata:", uploadRes.status, text);
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
        subCategory: "dof",
        title: `${form?.kayitNo || "DÖF"}`,
        year: yil,
        createdBy: olusturan,
createdByName: olusturan,
hazirlayan: olusturan,
hazirlayanAdSoyad: olusturan,
olusturan: olusturan,
preparedBy: olusturan,
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
          `Belge server'a kaydedilemedi.\n\nHata Kodu: ${res.status}`
        );
        return;
      }

      emitSync();

      openInfo(
        "Bilgilendirme",
        "Belgelerim, Risk Değerlendirme sekmesine kaydedildi ✅"
      );

      setShowModal(false);
    } catch (e) {
      console.error("DÖF kaydedilemedi:", e);
      openInfo("Hata", "Belge kaydedilirken hata oluştu.");
    } finally {
      setSaving(false);
    }
  };

  const formattedLastSaved = useMemo(() => {
    if (!lastSavedAt) return "";
    try {
      return new Date(lastSavedAt).toLocaleString("tr-TR");
    } catch {
      return "";
    }
  }, [lastSavedAt]);

  return (
    <CardBox className="space-y-4 overflow-x-hidden p-3 text-xs sm:p-4 sm:text-sm">
      <SectionTitle
        title="Düzeltici ve Önleyici Faaliyet (DÖF)"
        subtitle="Server tabanlı taslak senkronu ile sadeleştirilmiş DÖF formu"
      />

      <div className="rounded border bg-gray-50 p-2 text-[11px] text-gray-700">
        {formLoading ? (
          <span>Form verileri server'dan yükleniyor...</span>
        ) : (
          <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <span>
              Durum:{" "}
              {isDirty ? "Kaydedilmemiş değişiklik var" : "Form server ile senkron"}
            </span>
            {formattedLastSaved ? <span>Son kayıt: {formattedLastSaved}</span> : null}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
        <div>
          <label className="mb-1 block text-[11px]">Firma Adı</label>
          <input
            type="text"
            disabled
            className="w-full min-w-0 rounded border bg-gray-100 px-2 py-2 text-xs uppercase"
            value={
              autoData.firmaAdi
                ? `FİRMA ADI: ${autoData.firmaAdi}`
                : "FİRMA ADI: (seçili firma bulunamadı)"
            }
          />
        </div>

        <div>
          <label className="mb-1 block text-[11px]">SGK Sicil No</label>
          <input
            type="text"
            disabled
            className="w-full min-w-0 rounded border bg-gray-100 px-2 py-2 text-xs uppercase"
            value={
              autoData.sgkSicilNo
                ? `SGK SİCİL NO: ${autoData.sgkSicilNo}`
                : "SGK SİCİL NO: -"
            }
          />
        </div>

        <div>
          <label className="mb-1 block text-[11px]">İş Güvenliği Uzmanı</label>
          <input
            type="text"
            disabled
            className="w-full min-w-0 rounded border bg-gray-100 px-2 py-2 text-xs uppercase"
            value={
              autoData.uzmanAdi
                ? `İŞ GÜVENLİĞİ UZMANI: ${autoData.uzmanAdi}`
                : "İŞ GÜVENLİĞİ UZMANI: -"
            }
          />
        </div>

        <div>
          <label className="mb-1 block text-[11px]">İşveren / İşveren Vekili</label>
          <input
            type="text"
            disabled
            className="w-full min-w-0 rounded border bg-gray-100 px-2 py-2 text-xs uppercase"
            value={
              autoData.isverenAdi
                ? `İŞVEREN / İŞVEREN VEKİLİ: ${autoData.isverenAdi}`
                : "İŞVEREN / İŞVEREN VEKİLİ: -"
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
        <div>
          <label className="mb-1 block text-[11px]">DÖF Tarihi</label>
          <input
            type="text"
            placeholder="gg.aa.yyyy"
            className="w-full rounded border px-2 py-2 text-xs"
            value={form.tarih}
            onChange={handleChange("tarih")}
          />
        </div>

        <div>
          <label className="mb-1 block text-[11px]">DÖF Kayıt No</label>
          <input
            type="text"
            placeholder="Örn: DOF-2026-001"
            className="w-full rounded border px-2 py-2 text-xs uppercase"
            value={form.kayitNo}
            onChange={handleChange("kayitNo")}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
        <div>
          <label className="mb-1 block text-[11px]">Uygunsuzluğun Tanımı</label>
          <textarea
            className="min-h-[140px] w-full resize-y rounded border px-2 py-2 text-xs"
            placeholder="Uygunsuzluk nasıl tespit edildi, nerede oluştu?"
            value={form.tanim}
            onChange={handleChange("tanim")}
          />
        </div>

        <div>
          <label className="mb-1 block text-[11px]">Uygunsuzluğun Nedeni</label>
          <textarea
            className="min-h-[140px] w-full resize-y rounded border px-2 py-2 text-xs"
            placeholder="Kök neden analizi, sebep(ler)..."
            value={form.neden}
            onChange={handleChange("neden")}
          />
        </div>

        <div>
          <label className="mb-1 block text-[11px]">
            Yapılacak Düzeltici / Önleyici Faaliyet
          </label>
          <textarea
            className="min-h-[140px] w-full resize-y rounded border px-2 py-2 text-xs"
            placeholder="Alınacak aksiyonlar, yöntem, uygulanacak işlem..."
            value={form.faaliyet}
            onChange={handleChange("faaliyet")}
          />
        </div>
      </div>

      <div className="rounded border p-3 sm:p-4">
        <div className="mb-3 text-xs font-semibold text-[#042f4b]">
          Termin ve İmza Yapısı
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
          <div>
            <label className="mb-1 block text-[11px]">Planlanan Bitiş Tarihi</label>
            <input
              type="text"
              placeholder="gg.aa.yyyy"
              className="w-full rounded border px-2 py-2 text-xs"
              value={form.planBitis}
              onChange={handleChange("planBitis")}
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px]">İş Güvenliği Uzmanı</label>
            <input
              type="text"
              disabled
              className="w-full rounded border bg-gray-100 px-2 py-2 text-xs uppercase"
              value={autoData.uzmanAdi || "-"}
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px]">İşveren / İşveren Vekili</label>
            <input
              type="text"
              disabled
              className="w-full rounded border bg-gray-100 px-2 py-2 text-xs uppercase"
              value={autoData.isverenAdi || "-"}
            />
          </div>
        </div>

       
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
        <PrimaryButton
          size="sm"
          variant="outline"
          onClick={handleReset}
          className="w-full sm:w-auto"
        >
          Yenile (Yeni DÖF)
        </PrimaryButton>

        <PrimaryButton
          size="sm"
          variant="green"
          onClick={handleSaveOrUpdate}
          disabled={saving || formLoading}
          className="w-full sm:w-auto"
        >
          {saving ? "Kaydediliyor..." : "Güncelle / Kaydet"}
        </PrimaryButton>

        <PrimaryButton
          size="sm"
          onClick={handleGenerate}
          disabled={loading || formLoading}
          className={`w-full sm:w-auto ${loading ? "cursor-wait" : ""}`}
        >
          {loading ? "Hazırlanıyor..." : "Hazırla (PDF)"}
        </PrimaryButton>
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="DÖF"
        headerActions={
          <div className="flex w-full flex-col gap-1 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            <button
              onClick={handleYeniSekmedeAc}
              className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-[10px] hover:bg-gray-50 sm:w-auto sm:text-xs"
            >
              Yeni sekmede aç
            </button>

            <a
              href={pdfUrl || "#"}
              download={downloadName}
              className="w-full rounded-md bg-blue-600 px-2 py-1 text-[10px] text-white hover:bg-blue-700 sm:w-auto sm:text-xs"
            >
              İndir (PDF)
            </a>

            <PrimaryButton
              size="sm"
              variant="green"
              onClick={saveToDocs}
              disabled={saving}
              className="w-full px-2 py-1 text-[10px] sm:w-auto sm:text-xs"
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
    title="DÖF PDF"
    className="h-[50vh] w-full rounded border border-gray-200 sm:h-[65vh]"
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
    </CardBox>
  );
}