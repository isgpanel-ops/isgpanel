import React, { useContext, useEffect, useMemo, useState, useCallback } from "react";
import {
  CardBox,
  SectionTitle,
  PrimaryButton,
  Modal,
} from "../../components/ui";
import { FirmaContext } from "../../context/FirmaContext";

const API_BASE =
  (import.meta.env.VITE_API_URL || import.meta.env.VITE_API || "")
    .trim()
    .replace(/\/+$/, "") || "https://api.isgpanel.tr/api";

const MALZEMELER = [
  { no: 1, ad: "İş Ayakkabısı" },
  { no: 2, ad: "Baret" },
  { no: 3, ad: "Paraşüt Tipi Emniyet Kemeri" },
  { no: 4, ad: "Parça ve Çapak Gözlüğü (Buğulanmayan)" },
  { no: 5, ad: "İş Eldiveni Soğuk" },
  { no: 6, ad: "İş Botu" },
  { no: 7, ad: "İş Elbisesi" },
  { no: 8, ad: "Genel Amaçlı Nitril Eldiven" },
  { no: 9, ad: "İş Eldiveni (Mekanik Koruma)" },
  { no: 10, ad: "Elektrik Eldiveni" },
  { no: 11, ad: "Kulak Koruyucular" },
  { no: 12, ad: "Maskeler Yarım Yüz ve Çeyrek" },
  { no: 13, ad: "Reflektörlü Yelek" },
  { no: 14, ad: "Günlük Cerrahi Maske" },
  { no: 15, ad: "Kaynakçı Eldiveni / Maske / Gözlük / Önlük / Kolluk / Tozluk" },
];

function getAuthToken(userObj) {
  try {
    const direct =
      (typeof window !== "undefined" && localStorage.getItem("token")) ||
      (typeof window !== "undefined" && localStorage.getItem("jwt")) ||
      (typeof window !== "undefined" && localStorage.getItem("accessToken")) ||
      (typeof window !== "undefined" && localStorage.getItem("authToken")) ||
      (typeof window !== "undefined" && localStorage.getItem("access_token")) ||
      (typeof window !== "undefined" && localStorage.getItem("id_token")) ||
      (typeof window !== "undefined" && sessionStorage.getItem("token")) ||
      (typeof window !== "undefined" && sessionStorage.getItem("jwt")) ||
      (typeof window !== "undefined" && sessionStorage.getItem("accessToken")) ||
      (typeof window !== "undefined" && sessionStorage.getItem("authToken")) ||
      (typeof window !== "undefined" && sessionStorage.getItem("access_token")) ||
      (typeof window !== "undefined" && sessionStorage.getItem("id_token"));

    if (direct) return direct;

    const email =
      userObj?.email ||
      userObj?.mail ||
      (typeof window !== "undefined"
        ? localStorage.getItem("userEmail")
        : null);

    if (email) {
      const key = `isgpanel:${email}:token`;
      const t = localStorage.getItem(key);
      if (t) return t;
    }

    if (typeof window !== "undefined") {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (
          k.endsWith(":token") ||
          k.endsWith(":jwt") ||
          k.endsWith(":accessToken") ||
          k.endsWith(":authToken")
        ) {
          const t = localStorage.getItem(k);
          if (t) return t;
        }
      }
    }

    if (typeof window !== "undefined") {
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (!k) continue;
        if (
          k.endsWith(":token") ||
          k.endsWith(":jwt") ||
          k.endsWith(":accessToken") ||
          k.endsWith(":authToken")
        ) {
          const t = sessionStorage.getItem(k);
          if (t) return t;
        }
      }
    }
  } catch {}

  return "";
}

function normalizeTC(v) {
  return String(v || "").replace(/\D/g, "").slice(0, 11);
}

function formatTarih(dateStr) {
  if (!dateStr) return "-";
  const p = String(dateStr).slice(0, 10).split("-");
  if (p.length !== 3) return dateStr;
  return `${p[2]}.${p[1]}.${p[0]}`;
}

function rowHasSignature(row) {
  return !!row?.imzalar?.genel?.dataUrl;
}

function safeFileName(name) {
  return String(name || "")
    .replace(/[\\/:*?"<>|]/g, "")
    .trim();
}

function createEmptyKkdRow() {
  return MALZEMELER.reduce((acc, item) => {
    acc[item.ad] = {
      no: item.no,
      selected: false,
      adet: "",
    };
    return acc;
  }, {});
}

function mapServerItemsToRow(items = []) {
  const base = createEmptyKkdRow();

  for (const item of items) {
    const ad = String(item?.ad || "").trim();
    if (!ad) continue;

    const matched = MALZEMELER.find((x) => x.ad === ad);

    base[ad] = {
      no: Number(item?.no) || matched?.no || base[ad]?.no || null,
      selected: !!item?.selected,
      adet: item?.selected ? String(item?.adet || 1) : "",
    };
  }

  return base;
}

function rowToItemsPayload(row = {}) {
  return MALZEMELER.map(({ no, ad }) => {
    const current = row?.[ad] || {};
    const selected = !!current?.selected;
    const adet = selected ? Number(current?.adet || 1) : 0;

    return {
      no,
      ad,
      selected,
      adet,
    };
  });
}

async function postBlob(url, payload, token) {
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
    throw new Error(text || `İstek başarısız (${res.status})`);
  }

  return await res.blob();
}

function downloadBlob(blob, fileName) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => {
    try {
      window.URL.revokeObjectURL(url);
    } catch {}
  }, 1500);
}

export default function KKDListesi() {
  const { selectedFirm } = useContext(FirmaContext);

  const user = useMemo(() => {
    try {
      const activeEmail = localStorage.getItem("__isg_active_email_global");
      const u1 = activeEmail
        ? localStorage.getItem(`isgpanel:${activeEmail}:user`)
        : null;
      const u2 = localStorage.getItem("user") || sessionStorage.getItem("user");
      return JSON.parse(u1 || u2 || "null");
    } catch {
      return null;
    }
  }, []);

  const [kurumsal, setKurumsal] = useState(null);

 useEffect(() => {
  let cancelled = false;

  const loadKurumsal = async () => {
    try {
      let next = null;

      const raw = localStorage.getItem("kurumsalBilgiler");
      if (raw) next = JSON.parse(raw);

      const token = getAuthToken(user);

      if (selectedFirm?.id && token) {
        const res = await fetch(`${API_BASE}/firma/${selectedFirm.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const json = await res.json().catch(() => ({}));
          const firma = json?.firma || json?.data || json;

          next = {
            ...(next || {}),
            ...(firma?.kurumsal || {}),
            logo:
              firma?.kurumsal?.logo ||
              firma?.kurumsalLogo ||
              firma?.logo ||
              next?.logo ||
              "",
            logoUrl:
              firma?.kurumsal?.logoUrl ||
              firma?.logoUrl ||
              firma?.logo ||
              next?.logoUrl ||
              "",
          };
        }
      }

      if (!cancelled) setKurumsal(next || null);
    } catch {}
  };

  loadKurumsal();

  window.addEventListener("storage", loadKurumsal);
  window.addEventListener("kurumsalBilgilerUpdated", loadKurumsal);

  return () => {
    cancelled = true;
    window.removeEventListener("storage", loadKurumsal);
    window.removeEventListener("kurumsalBilgilerUpdated", loadKurumsal);
  };
}, [selectedFirm?.id, user]);

  const [personeller, setPersoneller] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [aktifPersonel, setAktifPersonel] = useState(null);

  const [bulkLoading, setBulkLoading] = useState(false);
  const [savingKkd, setSavingKkd] = useState(false);
  const [loadingPage, setLoadingPage] = useState(false);

  const [previewOpen, setPreviewOpen] = useState(false);
 const [previewLoading, setPreviewLoading] = useState(false);
const [previewProgress, setPreviewProgress] = useState(0);
const [previewPdfUrl, setPreviewPdfUrl] = useState(null);
  const [previewFileName, setPreviewFileName] = useState("kkd_teslim_tutanagi.pdf");
  const [savingToDocs, setSavingToDocs] = useState(false);

  const [firmaImzalari, setFirmaImzalari] = useState({
    isveren: { imza: null, paraf: null },
    uzman: { imza: null, paraf: null },
    hekim: { imza: null, paraf: null },
    temsilci: { imza: null, paraf: null },
    destek: { imza: null, paraf: null },
    bilgi: { imza: null, paraf: null },
  });

  const [kkdKayitlari, setKkdKayitlari] = useState({});

  const API = useMemo(() => {
    return {
      katilimcilarGet: `${API_BASE}/ise-giris/katilimcilar`,
      kkdList: `${API_BASE}/kkd/list`,
      kkdSave: `${API_BASE}/kkd/save`,
      kkdBulk: `${API_BASE}/kkd/bulk`,
      kkdPdf: `${API_BASE}/kkd/pdf`,
      kkdPdfBulk: `${API_BASE}/kkd/pdf-bulk`,
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
  return `https://api.isgpanel.tr${url}?v=${Date.now()}`;
}

    return `${API_BASE}${url.startsWith("/") ? "" : "/"}${url}`;
  };

  const buildFinalLogo = useCallback(async () => {
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
      const res = await fetch(absoluteLogoUrl, {
  method: "GET",
  cache: "no-store",
});

if (!res.ok) return "";

const contentType = res.headers.get("content-type") || "";
if (!contentType.startsWith("image/")) return "";

const blob = await res.blob();

      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result || ""));
        reader.readAsDataURL(blob);
      });
    } catch {
      return "";
    }
  }, [kurumsal, selectedFirm, user]);

  const closePreviewModal = () => {
    try {
      if (previewPdfUrl && String(previewPdfUrl).startsWith("blob:")) {
        window.URL.revokeObjectURL(previewPdfUrl);
      }
    } catch {}

    setPreviewPdfUrl(null);
setPreviewProgress(0);
setPreviewOpen(false);
  };

  useEffect(() => {
    return () => {
      try {
        if (previewPdfUrl && String(previewPdfUrl).startsWith("blob:")) {
          window.URL.revokeObjectURL(previewPdfUrl);
        }
      } catch {}
    };
  }, [previewPdfUrl]);

  useEffect(() => {
    if (!selectedFirm?.id) {
      setPersoneller([]);
      setSelectedIds([]);
      setKkdKayitlari({});
      return;
    }

    let cancelled = false;

    const loadData = async () => {
      try {
        setLoadingPage(true);

        const token = getAuthToken(user);

        const [katilimciRes, kkdRes] = await Promise.all([
          fetch(`${API.katilimcilarGet}?firmaId=${selectedFirm.id}`, {
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          }),
          fetch(`${API.kkdList}?firmaId=${selectedFirm.id}`, {
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          }),
        ]);

        let katilimciData = {};
        let kkdData = {};

        if (katilimciRes.ok) {
          katilimciData = await katilimciRes.json();
        }

        if (kkdRes.ok) {
          kkdData = await kkdRes.json();
        }

        const items =
          katilimciData?.items ||
          katilimciData?.payload?.items ||
          katilimciData?.katilimcilar ||
          katilimciData?.payload?.katilimcilar ||
          [];

        const cleaned = items.filter((k) =>
          String(k?.adSoyad || "").trim()
        );

        const kkdMap = {};
        const kkdItems = Array.isArray(kkdData?.items) ? kkdData.items : [];

        for (const row of kkdItems) {
          const tcKey = normalizeTC(row?.tc);
          if (!tcKey) continue;
          kkdMap[tcKey] = mapServerItemsToRow(row?.items || []);
        }

        if (!cancelled) {
          setKkdKayitlari(kkdMap);

          setPersoneller(
            cleaned.map((k, i) => ({
              id: i + 1,
              tc: normalizeTC(k.tc),
              adSoyad: String(k.adSoyad || "")
                .trim()
                .toLocaleUpperCase("tr-TR"),
              gorev: String(k.gorev || "")
                .trim()
                .toLocaleUpperCase("tr-TR"),
              bitisTarihi: k.bitisTarihi || "",
              imzalar: k.imzalar || {},
            }))
          );
        }
      } catch (err) {
        console.error("KKD verileri yüklenemedi:", err);
        if (!cancelled) {
          setPersoneller([]);
          setKkdKayitlari({});
        }
      } finally {
        if (!cancelled) {
          setLoadingPage(false);
        }
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [selectedFirm?.id, API, user]);

  useEffect(() => {
    if (!selectedFirm?.id) {
      setFirmaImzalari({
        isveren: { imza: null, paraf: null },
        uzman: { imza: null, paraf: null },
        hekim: { imza: null, paraf: null },
        temsilci: { imza: null, paraf: null },
        destek: { imza: null, paraf: null },
        bilgi: { imza: null, paraf: null },
      });
      return;
    }

    let cancelled = false;

    const loadFirmaImzalari = async () => {
      try {
        const token = getAuthToken(user);
        if (!token) return;

        const res = await fetch(`${API_BASE}/firma/${selectedFirm.id}/imzalar`, {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (!res.ok) return;

        const data = await res.json().catch(() => ({}));

        if (!cancelled && data && typeof data === "object") {
          setFirmaImzalari({
            isveren: data?.isveren || { imza: null, paraf: null },
            uzman: data?.uzman || { imza: null, paraf: null },
            hekim: data?.hekim || { imza: null, paraf: null },
            temsilci: data?.temsilci || { imza: null, paraf: null },
            destek: data?.destek || { imza: null, paraf: null },
            bilgi: data?.bilgi || { imza: null, paraf: null },
          });
        }
      } catch (err) {
        console.error("Firma imzaları yüklenemedi:", err);
      }
    };

    loadFirmaImzalari();

    return () => {
      cancelled = true;
    };
  }, [selectedFirm?.id, user]);

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id]
    );
  };

  const openKkdModal = (personel) => {
    const tcKey = normalizeTC(personel?.tc);
    setAktifPersonel(personel);

    setKkdKayitlari((prev) => ({
      ...prev,
      [tcKey]: prev[tcKey] || createEmptyKkdRow(),
    }));

    setModalOpen(true);
  };

  const closeModal = () => {
    if (savingKkd) return;
    setModalOpen(false);
    setAktifPersonel(null);
  };

  const handleItemCheck = (name, checked) => {
    if (!aktifPersonel) return;

    const tcKey = normalizeTC(aktifPersonel.tc);

    setKkdKayitlari((prev) => ({
      ...prev,
      [tcKey]: {
        ...prev[tcKey],
        [name]: {
          ...prev[tcKey]?.[name],
          selected: checked,
          adet: checked ? prev[tcKey]?.[name]?.adet || "1" : "",
        },
      },
    }));
  };

  const handleItemAdet = (name, val) => {
    if (!aktifPersonel) return;

    const tcKey = normalizeTC(aktifPersonel.tc);

    setKkdKayitlari((prev) => ({
      ...prev,
      [tcKey]: {
        ...prev[tcKey],
        [name]: {
          ...prev[tcKey]?.[name],
          adet: val,
        },
      },
    }));
  };

  const handleSaveKKD = async () => {
    if (!aktifPersonel || !selectedFirm?.id) return;

    const tcKey = normalizeTC(aktifPersonel.tc);
    const row = kkdKayitlari[tcKey] || createEmptyKkdRow();
    const token = getAuthToken(user);

    try {
      setSavingKkd(true);

      const res = await fetch(API.kkdSave, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          firmaId: String(selectedFirm.id),
          firmaAdi: selectedFirm?.firmaAdi || "",
          tc: tcKey,
          adSoyad: aktifPersonel?.adSoyad || "",
          gorev: aktifPersonel?.gorev || "",
          tarih: aktifPersonel?.bitisTarihi || "",
          items: rowToItemsPayload(row),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data?.ok === false) {
        throw new Error(data?.message || "KKD kaydedilemedi.");
      }

      const serverRow = mapServerItemsToRow(data?.item?.items || []);

      setKkdKayitlari((prev) => ({
        ...prev,
        [tcKey]: serverRow,
      }));

      setModalOpen(false);
      setAktifPersonel(null);
    } catch (err) {
      console.error("KKD kayıt hatası:", err);
      alert(err?.message || "KKD kaydedilemedi.");
    } finally {
      setSavingKkd(false);
    }
  };

  const buildKkdPdfPayload = async (personel) => {
    const tcKey = normalizeTC(personel?.tc);
    const row = kkdKayitlari[tcKey] || createEmptyKkdRow();
    const finalLogo = await buildFinalLogo();

    let kisiler = { isveren: "", uzman: "", hekim: "" };
    try {
      const raw = localStorage.getItem(`risk_prosedur_kisiler_${selectedFirm?.id}`);
      const parsed = raw ? JSON.parse(raw) : null;
      kisiler = {
        isveren: parsed?.isveren || "",
        uzman: parsed?.uzman || "",
        hekim: parsed?.hekim || "",
      };
    } catch {}

    return {
      firmaId: String(selectedFirm?.id || ""),
      firma: {
        id: String(selectedFirm?.id || ""),
        firmaAdi: selectedFirm?.firmaAdi || "",
        tehlike: selectedFirm?.tehlike || "",
      },
      kurumsal: {
        logo: finalLogo || "",
        logoUrl: "",
      },
      kisiler,
      imzalar: firmaImzalari,
      personel: {
        tc: tcKey,
        adSoyad: personel?.adSoyad || "",
        gorev: personel?.gorev || "",
        imzalar: {
          genel: personel?.imzalar?.genel || null,
        },
        personelImzalari: {
          personel: personel?.imzalar?.genel?.dataUrl || "",
        },
        personelImzasi: personel?.imzalar?.genel?.dataUrl || "",
      },
      kkd: {
        tarih: personel?.bitisTarihi || "",
        items: rowToItemsPayload(row),
      },
    };
  };

  const getDurumText = (tc) => {
    const tcKey = normalizeTC(tc);
    const row = kkdKayitlari[tcKey];
    if (!row) return "Tanımsız";

    const count = Object.values(row).filter((x) => x?.selected).length;
    return count > 0 ? `${count} Malzeme` : "Tanımsız";
  };

  const handleHazirla = async () => {
    const selectedPersons = personeller.filter((p) =>
      selectedIds.includes(p.id)
    );

    if (!selectedPersons.length) {
      alert("Lütfen en az 1 personel seçiniz.");
      return;
    }

    const eksikKkd = selectedPersons.find((p) => {
      const tcKey = normalizeTC(p.tc);
      const row = kkdKayitlari[tcKey];
      if (!row) return true;
      const count = Object.values(row).filter((x) => x?.selected).length;
      return count === 0;
    });

    if (eksikKkd) {
      alert(`${eksikKkd.adSoyad} için önce KKD seçimi yapınız.`);
      return;
    }

    const imzaEksik = selectedPersons.find((p) => !rowHasSignature(p));
    if (imzaEksik) {
      alert(`${imzaEksik.adSoyad} için personel imzası eksik.`);
      return;
    }

    if (selectedPersons.length > 1) {
      alert("Tekli KKD PDF için lütfen yalnızca 1 personel seçiniz.");
      return;
    }

   try {
  setPreviewLoading(true);
  setPreviewProgress(5);
  setPreviewOpen(true);

  const progressTimer = setInterval(() => {
    setPreviewProgress((prev) => {
      if (prev >= 92) return prev;
      return prev + Math.floor(Math.random() * 6) + 2;
    });
  }, 700);

  if (previewPdfUrl && String(previewPdfUrl).startsWith("blob:")) {
        window.URL.revokeObjectURL(previewPdfUrl);
      }
      setPreviewPdfUrl(null);

      const token = getAuthToken(user);
      const first = selectedPersons[0];
      const payload = await buildKkdPdfPayload(first);

      const blob = await postBlob(API.kkdPdf, payload, token);
      const blobUrl = window.URL.createObjectURL(blob);

      const firmaAdi = safeFileName(selectedFirm?.firmaAdi || "Firma");
      const adSoyad = safeFileName(first?.adSoyad || "PERSONEL");

      clearInterval(progressTimer);
setPreviewProgress(100);

setPreviewFileName(`${firmaAdi}_${adSoyad}_kkd_teslim_tutanagi.pdf`);
setPreviewPdfUrl(blobUrl);

setTimeout(() => {
  setPreviewLoading(false);
}, 400);

   } catch (err) {
  clearInterval(progressTimer);
  setPreviewLoading(false);
  setPreviewProgress(0);

  console.error("KKD PDF oluşturma hatası:", err);
  alert(err?.message || "KKD PDF oluşturulamadı.");
} finally {
  clearInterval(progressTimer);
}
  };

  const handleTopluIndir = async () => {
    try {
      const selectedPersons = personeller.filter((p) =>
        selectedIds.includes(p.id)
      );

      if (!selectedPersons.length) {
        alert("Lütfen en az 1 personel seçiniz.");
        return;
      }

      const eksikKkd = selectedPersons.find((p) => {
        const tcKey = normalizeTC(p.tc);
        const row = kkdKayitlari[tcKey];
        if (!row) return true;
        const count = Object.values(row).filter((x) => x?.selected).length;
        return count === 0;
      });

      if (eksikKkd) {
        alert(`${eksikKkd.adSoyad} için önce KKD seçimi yapınız.`);
        return;
      }

      const imzaEksik = selectedPersons.find((p) => !rowHasSignature(p));
      if (imzaEksik) {
        alert(`${imzaEksik.adSoyad} için personel imzası eksik.`);
        return;
      }

      setBulkLoading(true);

      const token = getAuthToken(user);
      const payload = {
        firmaId: String(selectedFirm?.id || ""),
        firma: {
          id: String(selectedFirm?.id || ""),
          firmaAdi: selectedFirm?.firmaAdi || "",
          tehlike: selectedFirm?.tehlike || "",
        },
        items: await Promise.all(
          selectedPersons.map((personel) => buildKkdPdfPayload(personel))
        ),
      };

      const blob = await postBlob(API.kkdPdfBulk, payload, token);
      const firmaAdi = safeFileName(selectedFirm?.firmaAdi || "firma");
      downloadBlob(blob, `${firmaAdi}_kkd_tutanaklari.zip`);
    } catch (err) {
      console.error("Toplu KKD ZIP hatası:", err);
      alert(err?.message || "Toplu KKD ZIP oluşturulamadı.");
    } finally {
      setBulkLoading(false);
    }
  };

  const handlePreviewYeniSekmedeAc = () => {
    if (!previewPdfUrl) {
      alert("Önce belge hazırlanmalıdır.");
      return;
    }

    window.open(previewPdfUrl, "_blank", "noopener,noreferrer");
  };

  const handlePreviewIndir = () => {
    if (!previewPdfUrl) {
      alert("Önce belge hazırlanmalıdır.");
      return;
    }

    const a = document.createElement("a");
    a.href = previewPdfUrl;
    a.download = previewFileName || "kkd_teslim_tutanagi.pdf";
    a.click();
  };

  const handlePreviewSaveToDocs = async () => {
    try {
      const selectedPersons = personeller.filter((p) =>
        selectedIds.includes(p.id)
      );

      if (selectedPersons.length !== 1) {
        alert("Belgelerime kaydetmek için yalnızca 1 personel seçiniz.");
        return;
      }

      const first = selectedPersons[0];
      const token = getAuthToken(user);

      if (!token) {
        alert("Oturum bulunamadı.");
        return;
      }

      setSavingToDocs(true);

      const payload = await buildKkdPdfPayload(first);

    if (!previewPdfUrl) {
  throw new Error("Önce PDF hazırlanmalıdır.");
}

const pdfBlob = await fetch(previewPdfUrl).then((r) => r.blob());

const uploadForm = new FormData();
uploadForm.append(
  "file",
  pdfBlob,
  `${safeFileName(first?.adSoyad || "PERSONEL")} - KKD Teslim Tutanağı.pdf`
);

const uploadRes = await fetch(`${API_BASE}/documents/upload-pdf`, {
  method: "POST",
  headers: {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  },
  body: uploadForm,
});

const uploadJson = await uploadRes.json().catch(() => ({}));

if (!uploadRes.ok) {
  throw new Error(uploadJson?.message || "PDF sunucuya yüklenemedi.");
}

const realFileUrl = uploadJson?.fileUrl || "";
const realAbsoluteUrl = uploadJson?.absoluteUrl || "";

if (!realFileUrl && !realAbsoluteUrl) {
  throw new Error("Kalıcı PDF URL alınamadı.");
}

const hazirlayanKisi =
  user?.name ||
  user?.adSoyad ||
  user?.fullName ||
  user?.ad ||
  payload?.kisiler?.uzman ||
  payload?.kisiler?.isgUzmaniAdSoyad ||
  "İSG Uzmanı";

      const docPayload = {
        firmaId: String(selectedFirm?.id || ""),
        firmaAdi: selectedFirm?.firmaAdi || "",
        category: "talimat",
        subCategory: "kkd",
        belgeTuru: "KKD Teslim Tutanağı",
tur: "KKD Teslim Tutanağı",
       title: `${first?.adSoyad || "PERSONEL"} - KKD Teslim Tutanağı`,
personName: first?.adSoyad || "PERSONEL",
personelAdSoyad: first?.adSoyad || "PERSONEL",
year: new Date().getFullYear(),
        createdBy: hazirlayanKisi,
createdByName: hazirlayanKisi,
hazirlayan: hazirlayanKisi,
hazirlayanAdSoyad: hazirlayanKisi,
olusturan: hazirlayanKisi,
preparedBy: hazirlayanKisi,
        createdByUserId: user?._id || user?.id,
       fileUrl: realFileUrl,
absoluteUrl: realAbsoluteUrl,
        fileName: `${safeFileName(first?.adSoyad || "PERSONEL")} - KKD Teslim Tutanağı.pdf`,
        tarih: formatTarih(first?.bitisTarihi || "") || "-",
        dateISO: String(first?.bitisTarihi || "").slice(0, 10),
        status: "hazir",
      };

      console.log("KKD docPayload:", docPayload);

      const docRes = await fetch(`${API_BASE}/documents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(docPayload),
      });

      const savedJson = await docRes.json().catch(() => null);
      console.log("KKD documents save response:", savedJson);

      if (!docRes.ok) {
        throw new Error(savedJson?.message || "Belge, Belgelerim listesine kaydedilemedi.");
      }

      try {
        localStorage.setItem("docs:lastChangeAt", String(Date.now()));
      } catch {}

      window.dispatchEvent(new Event("docs:lastChangeAt"));
      window.dispatchEvent(new Event("ticari_docs_refresh"));

      alert("Belgelerim, Talimatlar sekmesine kaydedildi ✅");
      closePreviewModal();
    } catch (err) {
      console.error("KKD Belgelerime kaydet hatası:", err);
      alert(err?.message || "Belge kaydedilemedi.");
    } finally {
      setSavingToDocs(false);
    }
  };

  if (!selectedFirm) {
    return (
      <CardBox>
        <SectionTitle
          title="KKD Personel Listesi"
          subtitle="Lütfen firma seçiniz."
        />
      </CardBox>
    );
  }

  return (
    <>
      <CardBox className="flex flex-col gap-4">
        <SectionTitle
          title="KKD Personel Listesi"
          subtitle="Eğitime katılan personeller üzerinden KKD teslim formu hazırlayabilirsiniz."
        />

        <div className="border rounded-lg p-4 space-y-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h3 className="text-sm font-semibold text-[#0a2b45]">
              Eğitime Katılan Personel (KKD için Seçiniz)
            </h3>

            <span className="text-[11px] text-slate-500">
              Veri kaynağı: İşe Giriş Eğitimi sekmesindeki katılımcılar
            </span>
          </div>

          <div className="w-full overflow-x-auto max-h-80 overflow-y-auto rounded-lg border">
            <table className="min-w-[900px] w-full text-xs sm:text-sm border-collapse">
              <thead className="bg-slate-100">
                <tr>
                  <th className="border px-2 py-2 w-10 text-center sticky top-0 bg-slate-100">
                    Seç
                  </th>
                  <th className="border px-2 py-2 min-w-[160px] sticky top-0 bg-slate-100">
                    T.C. Kimlik No
                  </th>
                  <th className="border px-2 py-2 min-w-[220px] sticky top-0 bg-slate-100">
                    Adı Soyadı
                  </th>
                  <th className="border px-2 py-2 min-w-[150px] sticky top-0 bg-slate-100">
                    Tarih
                  </th>
                  <th className="border px-2 py-2 min-w-[180px] sticky top-0 bg-slate-100 text-center">
                    KKD Durumu
                  </th>
                  <th className="border px-2 py-2 min-w-[140px] sticky top-0 bg-slate-100 text-center">
                    İmza
                  </th>
                </tr>
              </thead>

              <tbody>
                {loadingPage ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="border px-2 py-4 text-center text-[11px] text-slate-500"
                    >
                      Veriler yükleniyor...
                    </td>
                  </tr>
                ) : personeller.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="border px-2 py-4 text-center text-[11px] text-slate-500"
                    >
                      Bu firmaya ait personel bulunamadı.
                      <br />
                      Önce <span className="font-semibold">İşe Giriş Eğitimi</span>{" "}
                      sekmesinden personel ekleyip{" "}
                      <span className="font-semibold">Katılımcıları Kaydet</span>{" "}
                      butonuna basın.
                    </td>
                  </tr>
                ) : (
                  personeller.map((p) => (
                    <tr
                      key={p.tc || p.id}
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

                      <td className="border px-2 py-2 text-center whitespace-nowrap">
                        {p.tc}
                      </td>

                      <td className="border px-2 py-2 text-center whitespace-nowrap">
                        {p.adSoyad}
                      </td>

                      <td className="border px-2 py-2 text-center whitespace-nowrap">
                        {formatTarih(p.bitisTarihi)}
                      </td>

                      <td className="border px-2 py-2 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => openKkdModal(p)}
                            className="inline-flex items-center justify-center rounded-md bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-[11px]"
                          >
                            KKD Düzenle
                          </button>

                          <span className="text-[11px] text-slate-500">
                            {getDurumText(p.tc)}
                          </span>
                        </div>
                      </td>

                      <td className="border px-2 py-1.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            className="inline-flex items-center justify-center rounded-md border border-green-300 bg-green-100 text-green-700 px-2 py-1 text-[11px]"
                          >
                            İmza
                          </button>

                          <span
                            className={`text-[11px] font-medium ${
                              rowHasSignature(p)
                                ? "text-green-600"
                                : "text-slate-500"
                            }`}
                          >
                            {rowHasSignature(p) ? "1/1" : "0/1"}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-end gap-2 pt-3">
            <PrimaryButton
              size="sm"
              className="w-full sm:w-auto"
              disabled={selectedIds.length === 0 || loadingPage || previewLoading}
              onClick={handleHazirla}
            >
              {previewLoading ? "Hazırlanıyor..." : "KKD Hazırla"}
            </PrimaryButton>

            <PrimaryButton
              size="sm"
              variant="green"
              className="w-full sm:w-auto"
              disabled={selectedIds.length === 0 || bulkLoading || loadingPage}
              onClick={handleTopluIndir}
            >
              {bulkLoading ? "Hazırlanıyor..." : "Toplu İndir (ZIP)"}
            </PrimaryButton>
          </div>
        </div>
      </CardBox>

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={`KKD Düzenle ${
          aktifPersonel?.adSoyad ? "- " + aktifPersonel.adSoyad : ""
        }`}
      >
        <div className="space-y-3 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-12 gap-2 items-center px-2 pb-1 text-[11px] font-semibold text-slate-600">
            <div className="col-span-7">Malzemenin Cinsi</div>
            <div className="col-span-2 text-center">Verildi</div>
            <div className="col-span-3 text-center">Adet</div>
          </div>

          {aktifPersonel &&
            MALZEMELER.map((item, i) => {
              const tcKey = normalizeTC(aktifPersonel.tc);
              const row = kkdKayitlari[tcKey]?.[item.ad] || {};

              return (
                <div
                  key={item.no}
                  className="grid grid-cols-12 gap-2 items-center border rounded p-2"
                >
                  <div className="col-span-7 text-xs sm:text-sm">
                    {i + 1}. {item.ad}
                  </div>

                  <div className="col-span-2 flex justify-center">
                    <input
                      type="checkbox"
                      checked={row.selected || false}
                      onChange={(e) =>
                        handleItemCheck(item.ad, e.target.checked)
                      }
                    />
                  </div>

                  <div className="col-span-3">
                    <input
                      type="number"
                      min="1"
                      value={row.adet || ""}
                      disabled={!row.selected}
                      onChange={(e) =>
                        handleItemAdet(item.ad, e.target.value)
                      }
                      placeholder="Adet"
                      className="w-full border rounded px-2 py-1 text-xs sm:text-sm"
                    />
                  </div>
                </div>
              );
            })}

          <div className="flex justify-end pt-2">
            <PrimaryButton
              size="sm"
              onClick={handleSaveKKD}
              disabled={savingKkd}
            >
              {savingKkd ? "Kaydediliyor..." : "Kaydet"}
            </PrimaryButton>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={previewOpen}
        onClose={closePreviewModal}
        title="KKD"
        headerActions={
          <div className="flex flex-col gap-1 w-full sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            <button
              onClick={handlePreviewYeniSekmedeAc}
              className="w-full sm:w-auto px-2 py-1 text-[10px] sm:text-xs rounded-md border border-gray-300 bg-white hover:bg-gray-50"
            >
              Yeni sekmede aç
            </button>

            <button
              onClick={handlePreviewIndir}
              className="w-full sm:w-auto px-2 py-1 text-[10px] sm:text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700"
            >
              İndir (PDF)
            </button>

            <PrimaryButton
              size="sm"
              variant="green"
              onClick={handlePreviewSaveToDocs}
              disabled={savingToDocs}
              className="w-full sm:w-auto px-2 py-1 text-[10px] sm:text-xs"
            >
              {savingToDocs ? "Kaydediliyor..." : "Belgelerime Kaydet"}
            </PrimaryButton>
          </div>
        }
      >
       {(previewLoading || savingToDocs) && (
  <div className="w-full h-[50vh] sm:h-[60vh] flex items-center justify-center px-4">
    <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-center">
      <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />

      <div className="text-base font-bold text-slate-800">
        {savingToDocs ? "Belge kaydediliyor..." : "PDF hazırlanıyor..."}
      </div>

      <div className="mt-2 text-2xl font-bold text-blue-600">
        %{savingToDocs ? 100 : previewProgress}
      </div>

      <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-blue-600 transition-all duration-500"
          style={{ width: `${savingToDocs ? 100 : previewProgress}%` }}
        />
      </div>

      <div className="mt-3 text-xs sm:text-sm text-slate-500">
        {savingToDocs
          ? "Belge Belgelerim alanına kaydediliyor, lütfen bekleyiniz."
          : "Evrak oluşturuluyor, lütfen bekleyiniz."}
      </div>
    </div>
  </div>
)}

        {!previewLoading && !savingToDocs && previewPdfUrl && (
          <iframe
            key={previewPdfUrl}
            src={previewPdfUrl}
            title="KKD Teslim Tutanağı"
            className="w-full h-[50vh] sm:h-[60vh] border border-gray-200 rounded"
          />
        )}

        {!previewLoading && !savingToDocs && !previewPdfUrl && (
          <div className="w-full h-[50vh] sm:h-[60vh] flex items-center justify-center text-sm text-gray-600">
            PDF bulunamadı. Lütfen yeniden deneyin.
          </div>
        )}
      </Modal>
    </>
  );
}