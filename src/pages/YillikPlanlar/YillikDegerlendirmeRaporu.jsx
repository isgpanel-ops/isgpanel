import React, { useContext, useEffect, useMemo, useState } from "react";
import { SectionTitle, CardBox, PrimaryButton, Modal } from "../../components/ui";
import { FirmaContext } from "../../context/FirmaContext";
import ConfirmModal from "../../components/ui/ConfirmModal";

/* ---------------- helpers ---------------- */

const DOCS_SYNC_KEY = "docs:lastChangeAt";
const YDR_DOC_TYPE = "yillik-degerlendirme-raporu";

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

function getBearerToken(userObj) {
  return getAuthToken(userObj);
}

const toTRDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}.${mm}.${yy}`;
};

const toISODateInput = (value) => {
  if (!value) return "";
  const s = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);

  if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) {
    const [dd, mm, yy] = s.split(".");
    return `${yy}-${mm}-${dd}`;
  }

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${yy}-${mm}-${dd}`;
};

const sanitizeFileName = (name) => {
  if (!name) return "YillikDegerlendirmeRaporu";
  return String(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "_")
    .replace(/^_+|_+$/g, "");
};

const DEFAULT_ROWS_LABELS = [
  "RİSK DEĞERLENDİRMESİ",
  "ACİL EYLEM PLANI",
  "İŞE GİRİŞ MUAYENELERİ",
  "RADYOLOJİK ANALİZLER – AKCİĞER",
  "BİYOLOJİK ANALİZLER – TAM KAN",
  "TOKSİKOLOJİK ANALİZLER",
  "TETANOZ",
  "FİZYOLOJİK ANALİZLER – ODYO SET",
  "PSİKOLOJİK TESTLER",
  "EĞİTİM ÇALIŞMALARI – GENEL KONULAR",
  "EĞİTİM ÇALIŞMALARI – TEKNİK KONULAR",
  "EĞİTİM ÇALIŞMALARI – SAĞLIK KONULARI",
  "EĞİTİM ÇALIŞMALARI - İŞE ÖZEL RİSKLER",
  "ELEKTRİK İÇ TESİSAT + TOPRAKLAMA / PARATONER PERİYODİK TEST VE KONTROLÜ",
  "BASINÇLI KAPLARIN KONTROLÜ",
  "KALDIRMA ARAÇLARININ KONTROLÜ",
  "İLKYARDIMCI EĞİTİMİ",
  "HİJYEN EĞİTİMİ",
  "ACİL DURUM TATBİKATI",
  "İŞ HİJYENİ ÖLÇÜMLERİ",
  "HAVALANDIRMA PERİYODİK TEST VE KONTROLÜ",
  "DİĞER",
  "DİĞER",
];

const createEmptyRow = (label = "") => ({
  id: Date.now() + Math.random(),
  calisma: label,
  tarih: "",
  yapanKisiUnvan: "",
  tekrarSayisi: "",
  kullanilanYontem: "",
  sonucYorum: "",
});

const buildDefaultRows = () => DEFAULT_ROWS_LABELS.map((label) => createEmptyRow(label));

const ensureTitle = (text, defaultTitle) => {
  const t = (text || "").toString().trim();
  if (!t) return "";
  if (t.includes(" - ")) return t;
  return `${t} - ${defaultTitle}`;
};

const normLabel = (s) =>
  (s || "")
    .toString()
    .trim()
    .replace(/\s+/g, " ")
    .replaceAll("–", "-")
    .toLocaleUpperCase("tr-TR");

export default function YillikDegerlendirmeRaporu() {
  const { selectedFirm } = useContext(FirmaContext);

  const API_BASE =
    (import.meta.env.VITE_API_URL || import.meta.env.VITE_API || "")
      .trim()
      .replace(/\/+$/, "") || "https://api.isgpanel.tr/api";

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

  const toAbsoluteUrl = (url) => {
    if (!url) return "";

    if (typeof url === "object") {
      url = url?.url || url?.path || "";
    }

    if (!url) return "";
    if (String(url).startsWith("data:image")) return url;
    if (String(url).startsWith("http://") || String(url).startsWith("https://")) return url;

    if (String(url).startsWith("/uploads")) {
      return `https://api.isgpanel.tr${url}`;
    }

    return `${API_BASE}${String(url).startsWith("/") ? "" : "/"}${url}`;
  };

  const kisisel = useMemo(() => safeParseLS("kisiselBilgiler"), []);
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
  const hekimLS = useMemo(() => safeParseLS("hekimBilgileri"), []);
  const isverenLS = useMemo(() => safeParseLS("isverenBilgileri"), []);
  const kurumsal = useMemo(() => safeParseLS("kurumsalBilgiler"), []);

  const firmId = selectedFirm?.id || selectedFirm?._id || "";

  const [raporTarihi, setRaporTarihi] = useState("");
  const [raporYili, setRaporYili] = useState("");
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [latestIseGirisBaslangic, setLatestIseGirisBaslangic] = useState("");

const [pdfUrl, setPdfUrl] = useState(null);
const [downloadName, setDownloadName] = useState("YillikDegerlendirmeRaporu.pdf");
const [show, setShow] = useState(false);
const [loading, setLoading] = useState(false);
const [pdfProgress, setPdfProgress] = useState(0);
  const [saving, setSaving] = useState(false);

  const [imzalar, setImzalar] = useState({
    uzman: { imza: null, paraf: null, signerName: "" },
    hekim: { imza: null, paraf: null, signerName: "" },
    isveren: { imza: null, paraf: null, signerName: "" },
  });

  const readonlyInputClass =
    "w-full min-w-0 h-11 rounded-lg border border-gray-300 bg-slate-50 px-4 text-sm text-gray-800";

  const saveYdrFormToServer = async (nextState = {}) => {
    if (!firmId) return;

    try {
      const token = getBearerToken(user);

      await fetch(`${API_BASE}/yillik-degerlendirme-raporu/form/${firmId}`, {
  method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          firmaId: String(firmId),
          firmaAdi: selectedFirm?.firmaAdi || "",
          type: YDR_DOC_TYPE,
          raporTarihi: nextState.raporTarihi ?? raporTarihi ?? "",
          raporYili: nextState.raporYili ?? raporYili ?? "",
          rows: (nextState.rows ?? rows ?? []).map((row, index) => ({
            id: row?.id || `${index + 1}`,
            siraNo: index + 1,
            calisma: row?.calisma || "",
            tarih: row?.tarih || "",
            yapanKisiUnvan: row?.yapanKisiUnvan || "",
            tekrarSayisi: row?.tekrarSayisi || "",
            kullanilanYontem: row?.kullanilanYontem || "",
            sonucYorum: row?.sonucYorum || "",
          })),
        }),
      });

      try {
        localStorage.setItem(DOCS_SYNC_KEY, String(Date.now()));
      } catch {}

      window.dispatchEvent(new Event(DOCS_SYNC_KEY));
    } catch (e) {
      console.error("YDR form servera kaydedilemedi:", e);
    }
  };

  const loadYdrFromServer = async () => {
    if (!firmId) {
      setRows(buildDefaultRows());
      setLoaded(true);
      return;
    }

    try {
      const token = getBearerToken(user);

      const res = await fetch(
        `${API_BASE}/yillik-degerlendirme-raporu/form/${firmId}`,
        {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );

      if (!res.ok) {
        setRows(buildDefaultRows());
        setLoaded(true);
        return;
      }

      const data = await res.json();
      const form = data?.form || data || {};

      const serverRows = Array.isArray(form?.rows) ? form.rows : [];
      const mergedRows =
        serverRows.length > 0
          ? serverRows.map((row, index) => ({
              id: row?.id || Date.now() + index + Math.random(),
              calisma: row?.calisma || "",
              tarih: row?.tarih || "",
              yapanKisiUnvan: row?.yapanKisiUnvan || "",
              tekrarSayisi: row?.tekrarSayisi || "",
              kullanilanYontem: row?.kullanilanYontem || "",
              sonucYorum: row?.sonucYorum || "",
            }))
          : buildDefaultRows();

      setRows(mergedRows);

      const nextRaporTarihi = form?.raporTarihi || "";
      setRaporTarihi(nextRaporTarihi);

      const y = new Date(nextRaporTarihi).getFullYear();
      setRaporYili(Number.isFinite(y) ? String(y) : "");
    } catch (e) {
      console.error("Yıllık değerlendirme raporu serverdan okunamadı:", e);
      setRows(buildDefaultRows());
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    loadYdrFromServer();
  }, [API_BASE, firmId]);

  useEffect(() => {
    if (!firmId) return;

    const syncReload = () => {
      loadYdrFromServer();
    };

    const onStorage = (e) => {
      if (e.key === DOCS_SYNC_KEY) {
        loadYdrFromServer();
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadYdrFromServer();
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

  useEffect(() => {
    if (!firmId) return;

    let cancelled = false;

    const loadLatestIseGirisBaslangic = async () => {
      try {
        const token = getBearerToken(user);

        const res = await fetch(
          `${API_BASE}/ise-giris/katilimcilar?firmaId=${firmId}`,
          {
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          }
        );

        if (!res.ok) return;

        const data = await res.json();
        const items = Array.isArray(data?.items) ? data.items : [];

        const valid = items
          .map((item, index) => ({
            ...item,
            __idx: index,
            baslangicISO: toISODateInput(item?.baslangicTarihi),
            createdAtValue: new Date(item?.createdAt || item?.updatedAt || 0).getTime(),
          }))
          .filter((item) => item?.baslangicISO);

        if (!valid.length) return;

        valid.sort((a, b) => {
          if (b.createdAtValue !== a.createdAtValue) {
            return b.createdAtValue - a.createdAtValue;
          }
          return b.__idx - a.__idx;
        });

        if (!cancelled) {
          setLatestIseGirisBaslangic(valid[0]?.baslangicISO || "");
        }
      } catch (e) {
        console.error("İşe giriş başlangıç tarihi alınamadı:", e);
      }
    };

    loadLatestIseGirisBaslangic();

    return () => {
      cancelled = true;
    };
  }, [API_BASE, firmId]);

  useEffect(() => {
    if (!loaded || !selectedFirm) return;

    const pickFirst = (...vals) => vals.find((v) => String(v || "").trim()) || "";
    const hasAny = (obj) => Object.values(obj || {}).some((x) => String(x || "").trim());

    let alive = true;

    const fetchKisiler = async () => {
      const token = getBearerToken(user);
      if (!token) return null;

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
            try {
              const signRes = await fetch(`${API_BASE}/firma/${firmId}/imzalar`, {
                headers: { Authorization: `Bearer ${token}` },
              });

              if (signRes.ok) {
                const signData = await signRes.json();

                setImzalar({
                  uzman: {
                    imza: signData?.uzman?.imza || null,
                    paraf: signData?.uzman?.paraf || null,
                    signerName: next?.uzman || "",
                  },
                  hekim: {
                    imza: signData?.hekim?.imza || null,
                    paraf: signData?.hekim?.paraf || null,
                    signerName: next?.hekim || "",
                  },
                  isveren: {
                    imza: signData?.isveren?.imza || null,
                    paraf: signData?.isveren?.paraf || null,
                    signerName: next?.isveren || "",
                  },
                });
              } else {
                setImzalar({
                  uzman: { imza: null, paraf: null, signerName: next?.uzman || "" },
                  hekim: { imza: null, paraf: null, signerName: next?.hekim || "" },
                  isveren: { imza: null, paraf: null, signerName: next?.isveren || "" },
                });
              }
            } catch {
              setImzalar({
                uzman: { imza: null, paraf: null, signerName: next?.uzman || "" },
                hekim: { imza: null, paraf: null, signerName: next?.hekim || "" },
                isveren: { imza: null, paraf: null, signerName: next?.isveren || "" },
              });
            }

            return next;
          }
        }
      } catch {}

      try {
        const r2 = await fetch(`${API_BASE}/profile/personal`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (r2.ok) {
          const p = await r2.json();
          const next = {
            isveren: pickFirst(p?.isverenVekiliAdSoyad, p?.isverenAdSoyad, p?.isveren),
            uzman: pickFirst(p?.isgUzmaniAdSoyad, p?.uzmanAdSoyad, p?.uzman),
            hekim: pickFirst(p?.isyeriHekimiAdSoyad, p?.hekimAdSoyad, p?.hekim),
          };
          if (hasAny(next)) return next;
        }
      } catch {}

      try {
        const raw = localStorage.getItem(`risk_prosedur_kisiler_${firmId}`);
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

      const isgUzmaniAdi = pickFirst(
        kisiler?.uzman,
        kisisel?.adSoyad,
        `${kisisel?.ad || ""} ${kisisel?.soyad || ""}`.trim()
      );

      const isyeriHekimiAdi = pickFirst(
        kisiler?.hekim,
        hekimLS?.adSoyad,
        hekimLS?.isyeriHekimiAdSoyad,
        `${hekimLS?.ad || ""} ${hekimLS?.soyad || ""}`.trim()
      );

      const isverenAdi = pickFirst(
        kisiler?.isveren,
        isverenLS?.adSoyad,
        isverenLS?.isverenAdSoyad,
        isverenLS?.isverenVekiliAdSoyad,
        `${isverenLS?.ad || ""} ${isverenLS?.soyad || ""}`.trim()
      );

      if (!alive) return;
      setImzalar((prev) => ({
        uzman: {
          imza: prev?.uzman?.imza || null,
          paraf: prev?.uzman?.paraf || null,
          signerName: isgUzmaniAdi || "",
        },
        hekim: {
          imza: prev?.hekim?.imza || null,
          paraf: prev?.hekim?.paraf || null,
          signerName: isyeriHekimiAdi || "",
        },
        isveren: {
          imza: prev?.isveren?.imza || null,
          paraf: prev?.isveren?.paraf || null,
          signerName: isverenAdi || "",
        },
      }));
    })();

    return () => {
      alive = false;
    };
  }, [API_BASE, loaded, selectedFirm, user, kisisel, hekimLS, isverenLS, firmId]);

  useEffect(() => {
    if (!loaded || !selectedFirm) return;

    const tehlikeRaw =
      selectedFirm?.tehlike ||
      selectedFirm?.tehlikeSinifi ||
      selectedFirm?.tehlikeSınıfı ||
      selectedFirm?.firmaTehlikeSinifi ||
      "";

    const tehlike = String(tehlikeRaw || "").toLocaleUpperCase("tr-TR");

    const findHazirlamaISO = () => {
      const cands = [
        selectedFirm?.hazirlama,
        selectedFirm?.hazirlamaTarihi,
        selectedFirm?.tarihler?.hazirlama,
        selectedFirm?.tarihler?.hazirlamaTr,
        selectedFirm?.prosedur?.hazirlama,
        selectedFirm?.rdHazirlama,
        selectedFirm?.rdTarih,
        selectedFirm?.riskHazirlamaTarihi,
      ].filter(Boolean);

      for (const c of cands) {
        const iso = toISODateInput(c);
        if (iso) return iso;
      }
      return "";
    };

    const hazirlamaISO = findHazirlamaISO();
    const iseGirisISO = latestIseGirisBaslangic || "";

    let kisiler = { uzman: "", hekim: "", isveren: "" };
    try {
      const raw = localStorage.getItem(`risk_prosedur_kisiler_${firmId}`);
      const p = raw ? JSON.parse(raw) : null;
      kisiler = {
        uzman: (p?.uzman || p?.isgUzmani || p?.uzmanAdiSoyadi || "").toString(),
        hekim: (p?.hekim || p?.isyeriHekimi || p?.hekimAdiSoyadi || "").toString(),
        isveren: (p?.isveren || p?.isverenVekili || "").toString(),
      };
    } catch {
      kisiler = { uzman: "", hekim: "", isveren: "" };
    }

    const uzmanName =
      (kisiler.uzman && kisiler.uzman.trim()) ||
      (kisisel?.adSoyad || "").toString().toUpperCase() ||
      "";

    const uzmanFull = ensureTitle(uzmanName, "İSG Uzmanı");
    const hekimFull = (kisiler.hekim || "").toString().trim();

    const tekrar12Map = { "AZ TEHLİKELİ": "6 Yıl", "TEHLİKELİ": "4 Yıl", "ÇOK TEHLİKELİ": "2 Yıl" };
    const tekrarMuayeneMap = { "AZ TEHLİKELİ": "5", "TEHLİKELİ": "3", "ÇOK TEHLİKELİ": "1" };
    const tekrarEgitimMap = { "AZ TEHLİKELİ": "3", "TEHLİKELİ": "2", "ÇOK TEHLİKELİ": "1" };

    const tekrar12 = tekrar12Map[tehlike] || "";
    const tekrarMuayene = tekrarMuayeneMap[tehlike] || "";
    const tekrarEgitim = tekrarEgitimMap[tehlike] || "";

    const METHOD = {
      "İŞE GİRİŞ MUAYENELERİ":
        "İşe giriş sürecinde hekim tarafından anamnez alınmış, fizik muayene yapılmış ve gerekli tetkikler planlanarak kayıt altına alınmıştır.",
      "RADYOLOJİK ANALİZLER - AKCİĞER":
        "İşe giriş kapsamında akciğer grafisi çekimi yaptırılmış, sonuçlar değerlendirmeye sunulmuştur.",
      "BİYOLOJİK ANALİZLER - TAM KAN":
        "Mevzuata uygun şekilde gerekli biyolojik tetkikler uygulanmış, sonuçlar çalışan dosyasında saklanmıştır.",
      "TOKSİKOLOJİK ANALİZLER":
        "Gerekli görülen toksikolojik değerlendirmeler yapılmış, sonuçlar kayıt altına alınmıştır.",
      TETANOZ:
        "İşe giriş sürecinde aşı durumu değerlendirilmiş, gerekli durumlarda tetanoz uygulaması planlanmıştır.",
      "FİZYOLOJİK ANALİZLER - ODYO SET":
        "Odyometri testi uygulanmış, sonuçlar başlangıç verisi olarak kayıt altına alınmıştır.",
      "PSİKOLOJİK TESTLER":
        "Gerekli görülen durumlarda psikolojik değerlendirme/test uygulamaları yapılmış ve kayıt altına alınmıştır.",
      "EĞİTİM ÇALIŞMALARI - GENEL KONULAR":
        "Planlanan eğitim kapsamında katılımcılara İSG genel konuları anlatım, sunum ve soru-cevap yöntemiyle aktarılmıştır.",
      "EĞİTİM ÇALIŞMALARI - TEKNİK KONULAR":
        "Eğitim programı doğrultusunda teknik konular anlatım ve görsel materyaller eşliğinde aktarılmıştır.",
      "EĞİTİM ÇALIŞMALARI - SAĞLIK KONULARI":
        "Eğitim kapsamında sağlık konuları anlatım yöntemiyle aktarılmış, gerekli bilgilendirme yapılmıştır.",
      "EĞİTİM ÇALIŞMALARI - İŞE ÖZEL RİSKLER":
        "Çalışanın yapacağı işe, görevine ve maruz kalabileceği tehlikelere göre işe özel riskler değerlendirilmiş, ilgili riskler gözden geçirilerek gerekli bilgilendirme ve önleyici tedbirler belirlenmiştir.",
      "ELEKTRİK İÇ TESİSAT + TOPRAKLAMA / PARATONER PERİYODİK TEST VE KONTROLÜ":
        "Elektrik iç tesisat, topraklama ve/veya paratoner sistemi ilgili mevzuat kapsamında ölçüm ve kontrollerle değerlendirilmiştir.",
      "BASINÇLI KAPLARIN KONTROLÜ":
        "Basınçlı kaplar ilgili mevzuat ve standartlar kapsamında periyodik kontrol esaslarına göre incelenmiştir.",
      "KALDIRMA ARAÇLARININ KONTROLÜ":
        "Kaldırma ve iletme ekipmanları periyodik kontrol kriterlerine göre test ve gözlem ile değerlendirilmiştir.",
      "İLKYARDIMCI EĞİTİMİ":
        "İlkyardım eğitimi teorik ve uygulamalı olarak gerçekleştirilmiş, örnek senaryolarla pekiştirilmiştir.",
      "HİJYEN EĞİTİMİ":
        "Hijyen eğitimi anlatım yöntemiyle verilmiş, uygulamada dikkat edilecek hususlar aktarılmıştır.",
      "ACİL DURUM TATBİKATI":
        "Acil durum planı kapsamında senaryo oluşturularak tatbikat gerçekleştirilmiş, tahliye ve toplanma süreçleri gözlemlenmiştir.",
      "İŞ HİJYENİ ÖLÇÜMLERİ":
        "İş hijyeni ölçümleri plan kapsamında yapılmış, sonuçlar mevzuat limitleriyle karşılaştırılarak değerlendirilmiştir.",
      "HAVALANDIRMA PERİYODİK TEST VE KONTROLÜ":
        "Havalandırma sistemleri periyodik kontrol programına uygun şekilde test edilmiş, performans ve uygunluk değerlendirmesi yapılmıştır.",
    };

    const RESULT = {
      "İŞE GİRİŞ MUAYENELERİ":
        "Çalışanın işe uygunluğu değerlendirilmiş, gerekli yönlendirmeler yapılmış ve işe giriş sağlık dosyası oluşturulmuştur.",
      "RADYOLOJİK ANALİZLER - AKCİĞER":
        "Sonuçlar değerlendirilmiş, gerekli görülen durumlarda takip/yönlendirme planlanmıştır.",
      "BİYOLOJİK ANALİZLER - TAM KAN":
        "Tetkik sonuçları değerlendirilmiş, gerekli görülen durumlarda tekrar/ek tetkik planlaması yapılmıştır.",
      "TOKSİKOLOJİK ANALİZLER":
        "Sonuçlar değerlendirilmiş, gerekli görülen durumlarda takip planı oluşturulmuştur.",
      TETANOZ:
        "Aşı durumu kayıt altına alınmış, gerekli görülen durumlarda uygulama/takip planlanmıştır.",
      "FİZYOLOJİK ANALİZLER - ODYO SET":
        "İşitme açısından başlangıç seviyesi belirlenmiş, gerekli bilgilendirmeler yapılmıştır.",
      "PSİKOLOJİK TESTLER":
        "Değerlendirmeler sonucunda gerekli görülen durumlar için takip/yönlendirme planlanmıştır.",
      "EĞİTİM ÇALIŞMALARI - GENEL KONULAR":
        "Eğitim tamamlanmış, çalışanların farkındalığı artırılmış ve eğitim kayıtları oluşturulmuştur.",
      "EĞİTİM ÇALIŞMALARI - TEKNİK KONULAR":
        "Eğitim tamamlanmış, gerekli bilgilendirme sağlanmış ve katılım kayıt altına alınmıştır.",
      "EĞİTİM ÇALIŞMALARI - SAĞLIK KONULARI":
        "Eğitim tamamlanmış, çalışanlar bilgilendirilmiş ve kayıt altına alınmıştır.",
      "EĞİTİM ÇALIŞMALARI - İŞE ÖZEL RİSKLER":
        "İşe özel riskler çalışan bazında değerlendirilmiş, gerekli kontrol tedbirleri belirlenmiş ve çalışanın güvenli şekilde görev yapabilmesi için bilgilendirme ile takip süreci planlanmıştır.",
      "ELEKTRİK İÇ TESİSAT + TOPRAKLAMA / PARATONER PERİYODİK TEST VE KONTROLÜ":
        "Kontrol sonuçları değerlendirilmiş, tespit edilen uygunsuzluklar için düzeltici/önleyici öneriler belirlenmiştir.",
      "BASINÇLI KAPLARIN KONTROLÜ":
        "Kontrol sonuçları raporlanmış, gerekli görülen bakım/iyileştirmeler planlanmıştır.",
      "KALDIRMA ARAÇLARININ KONTROLÜ":
        "Kontrol sonuçları raporlanmış, güvenli kullanım için gerekli öneriler belirlenmiştir.",
      "İLKYARDIMCI EĞİTİMİ":
        "Katılımcıların temel ilkyardım farkındalığı artırılmış, eğitim kayıtları tamamlanmıştır.",
      "HİJYEN EĞİTİMİ":
        "Çalışanların hijyen kuralları farkındalığı artırılmış, eğitim kayıt altına alınmıştır.",
      "ACİL DURUM TATBİKATI":
        "Tatbikat sonucunda hazırlık seviyesi değerlendirilmiş, tespit edilen eksikler için iyileştirme planlanmıştır.",
      "İŞ HİJYENİ ÖLÇÜMLERİ":
        "Ölçüm sonuçları kayıt altına alınmış, limitlere göre gerekli iyileştirme önerileri belirlenmiştir.",
      "HAVALANDIRMA PERİYODİK TEST VE KONTROLÜ":
        "Sistem uygunluğu değerlendirilmiş, gerekli bakım ve takip planlamaları yapılmıştır.",
    };

    const muayeneGroup = new Set([
      "İŞE GİRİŞ MUAYENELERİ",
      "RADYOLOJİK ANALİZLER - AKCİĞER",
      "BİYOLOJİK ANALİZLER - TAM KAN",
      "TOKSİKOLOJİK ANALİZLER",
      "TETANOZ",
      "FİZYOLOJİK ANALİZLER - ODYO SET",
      "PSİKOLOJİK TESTLER",
    ]);

    setRows((prev) =>
      prev.map((r) => {
        const key = normLabel(r.calisma);

        if (key === "RİSK DEĞERLENDİRMESİ") {
          return {
            ...r,
            tarih: !r.tarih && hazirlamaISO ? hazirlamaISO : r.tarih,
            yapanKisiUnvan: !r.yapanKisiUnvan && uzmanFull ? uzmanFull : r.yapanKisiUnvan,
            tekrarSayisi: !r.tekrarSayisi && tekrar12 ? tekrar12 : r.tekrarSayisi,
            kullanilanYontem: r.kullanilanYontem || "L matriks 5x5 metodu kullanılmıştır.",
            sonucYorum:
              r.sonucYorum ||
              "Mevcut riskler değerlendirilmiş, gerekli önleyici faaliyetler belirlenmiş ve işverene bildirilmiştir.",
          };
        }

        if (key === "ACİL EYLEM PLANI") {
          return {
            ...r,
            tarih: !r.tarih && hazirlamaISO ? hazirlamaISO : r.tarih,
            yapanKisiUnvan: !r.yapanKisiUnvan && uzmanFull ? uzmanFull : r.yapanKisiUnvan,
            tekrarSayisi: !r.tekrarSayisi && tekrar12 ? tekrar12 : r.tekrarSayisi,
            kullanilanYontem:
              r.kullanilanYontem ||
              "Acil durumların belirlenmesi, analiz edilmesi, müdahale akış şemaları ve tatbikat esaslı acil durum yönetimi uygulanmıştır.",
            sonucYorum:
              r.sonucYorum ||
              "Acil durum planı hazırlanmış, gerekli tedbirler belirlenmiş ve tatbikatla doğrulanmıştır. Bulgular ve öneriler işverene bildirilmiştir.",
          };
        }

        if (muayeneGroup.has(key)) {
          return {
            ...r,
            tarih: !r.tarih && iseGirisISO ? iseGirisISO : r.tarih,
            yapanKisiUnvan: !r.yapanKisiUnvan && hekimFull ? hekimFull : r.yapanKisiUnvan,
            tekrarSayisi: !r.tekrarSayisi && tekrarMuayene ? tekrarMuayene : r.tekrarSayisi,
            kullanilanYontem: r.kullanilanYontem || (METHOD[key] || ""),
            sonucYorum: r.sonucYorum || (RESULT[key] || ""),
          };
        }

        if (
          key === "EĞİTİM ÇALIŞMALARI - GENEL KONULAR" ||
          key === "EĞİTİM ÇALIŞMALARI - TEKNİK KONULAR"
        ) {
          return {
            ...r,
            tarih: !r.tarih && iseGirisISO ? iseGirisISO : r.tarih,
            yapanKisiUnvan: !r.yapanKisiUnvan && uzmanFull ? uzmanFull : r.yapanKisiUnvan,
            tekrarSayisi: !r.tekrarSayisi && tekrarEgitim ? tekrarEgitim : r.tekrarSayisi,
            kullanilanYontem: r.kullanilanYontem || (METHOD[key] || ""),
            sonucYorum: r.sonucYorum || (RESULT[key] || ""),
          };
        }

        if (key === "EĞİTİM ÇALIŞMALARI - SAĞLIK KONULARI") {
          return {
            ...r,
            tarih: !r.tarih && iseGirisISO ? iseGirisISO : r.tarih,
            yapanKisiUnvan: !r.yapanKisiUnvan && hekimFull ? hekimFull : r.yapanKisiUnvan,
            tekrarSayisi: !r.tekrarSayisi && tekrarEgitim ? tekrarEgitim : r.tekrarSayisi,
            kullanilanYontem: r.kullanilanYontem || (METHOD[key] || ""),
            sonucYorum: r.sonucYorum || (RESULT[key] || ""),
          };
        }

        if (key === "EĞİTİM ÇALIŞMALARI - İŞE ÖZEL RİSKLER") {
          return {
            ...r,
            tarih: !r.tarih && iseGirisISO ? iseGirisISO : r.tarih,
            yapanKisiUnvan: !r.yapanKisiUnvan && uzmanFull ? uzmanFull : r.yapanKisiUnvan,
            tekrarSayisi: !r.tekrarSayisi && tekrarEgitim ? tekrarEgitim : r.tekrarSayisi,
            kullanilanYontem: r.kullanilanYontem || (METHOD[key] || ""),
            sonucYorum: r.sonucYorum || (RESULT[key] || ""),
          };
        }

        if (
          key ===
          normLabel("ELEKTRİK İÇ TESİSAT + TOPRAKLAMA / PARATONER PERİYODİK TEST VE KONTROLÜ")
        ) {
          return {
            ...r,
            tekrarSayisi: !r.tekrarSayisi ? "1" : r.tekrarSayisi,
            kullanilanYontem: r.kullanilanYontem || (METHOD[key] || ""),
            sonucYorum: r.sonucYorum || (RESULT[key] || ""),
          };
        }

        if (key === "BASINÇLI KAPLARIN KONTROLÜ" || key === "KALDIRMA ARAÇLARININ KONTROLÜ") {
          return {
            ...r,
            tekrarSayisi: !r.tekrarSayisi ? "1" : r.tekrarSayisi,
            kullanilanYontem: r.kullanilanYontem || (METHOD[key] || ""),
            sonucYorum: r.sonucYorum || (RESULT[key] || ""),
          };
        }

        if (key === "İLKYARDIMCI EĞİTİMİ") {
          return {
            ...r,
            tekrarSayisi: !r.tekrarSayisi ? "3" : r.tekrarSayisi,
            kullanilanYontem: r.kullanilanYontem || (METHOD[key] || ""),
            sonucYorum: r.sonucYorum || (RESULT[key] || ""),
          };
        }

        if (key === "HİJYEN EĞİTİMİ") {
          return {
            ...r,
            tekrarSayisi: !r.tekrarSayisi ? "Süresiz" : r.tekrarSayisi,
            kullanilanYontem: r.kullanilanYontem || (METHOD[key] || ""),
            sonucYorum: r.sonucYorum || (RESULT[key] || ""),
          };
        }

        if (key === "ACİL DURUM TATBİKATI") {
          return {
            ...r,
            yapanKisiUnvan: !r.yapanKisiUnvan && uzmanFull ? uzmanFull : r.yapanKisiUnvan,
            tekrarSayisi: !r.tekrarSayisi ? "1" : r.tekrarSayisi,
            kullanilanYontem: r.kullanilanYontem || (METHOD[key] || ""),
            sonucYorum: r.sonucYorum || (RESULT[key] || ""),
          };
        }

        if (key === "İŞ HİJYENİ ÖLÇÜMLERİ" || key === "HAVALANDIRMA PERİYODİK TEST VE KONTROLÜ") {
          return {
            ...r,
            tekrarSayisi: !r.tekrarSayisi ? "1" : r.tekrarSayisi,
            kullanilanYontem: r.kullanilanYontem || (METHOD[key] || ""),
            sonucYorum: r.sonucYorum || (RESULT[key] || ""),
          };
        }

        return r;
      })
    );
  }, [loaded, selectedFirm, kisisel, latestIseGirisBaslangic, firmId]);

  useEffect(() => {
    return () => {
      try {
        if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      } catch {}
    };
  }, [pdfUrl]);

  const handleChangeRowField = (rowId, field, value) => {
    setRows((prev) => {
      const updated = prev.map((row) => (row.id === rowId ? { ...row, [field]: value } : row));
      void saveYdrFormToServer({ rows: updated });
      return updated;
    });
  };

  const handleAddRow = () => {
    setRows((prev) => {
      const updated = [...prev, createEmptyRow("DİĞER")];
      void saveYdrFormToServer({ rows: updated });
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
      onConfirm: () => {
        setRows((prev) => {
          const updated = prev.filter((row) => row.id !== rowId);
          void saveYdrFormToServer({ rows: updated });
          return updated;
        });
      },
    });
  };

  const buildFinalLogo = async () => {
    try {
      if (typeof kurumsal?.logo === "string" && kurumsal.logo.startsWith("data:image")) {
        return kurumsal.logo;
      }

      const rawLogoUrl =
        kurumsal?.logoUrl ||
        kurumsal?.logo ||
        selectedFirm?.logoUrl ||
        selectedFirm?.logo ||
        "";

      if (!rawLogoUrl) return "";

      const absoluteLogoUrl = toAbsoluteUrl(rawLogoUrl);
      const tokenValue = getBearerToken(user);

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

  const handlePreparePdf = async () => {
    if (!selectedFirm) {
      openInfo("Bilgilendirme", "Lütfen önce bir firma seçin.");
      return;
    }

    if (!raporTarihi) {
      openInfo("Bilgilendirme", "Lütfen rapor tarihini giriniz.");
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

      const tarihTr = toTRDate(raporTarihi);
      const finalLogo = await buildFinalLogo();

      const payload = {
        firmaId: String(selectedFirm.id || selectedFirm._id || ""),

        kurumsal: {
          logoUrl: finalLogo || "",
          logo: finalLogo || "",
        },

        prosedurKisiBilgileri: {
          isgUzmaniAdi: imzalar?.uzman?.signerName || "",
          isyeriHekimiAdi: imzalar?.hekim?.signerName || "",
          isverenAdi: imzalar?.isveren?.signerName || "",
          sertifikaNo: kisisel?.sertifikaNo || kisisel?.sertifika_no || "",
          sertifikaSinifi: kisisel?.sertifikaSinifi || kisisel?.sertifika_sinifi || "",
          hekimSertifikaNo: hekimLS?.hekimSertifikaNo || hekimLS?.sertifikaNo || "",
        },

        imzalar: {
          uzman: {
            imza: imzalar?.uzman?.imza || null,
            paraf: imzalar?.uzman?.paraf || null,
            signerName: imzalar?.uzman?.signerName || "",
          },
          hekim: {
            imza: imzalar?.hekim?.imza || null,
            paraf: imzalar?.hekim?.paraf || null,
            signerName: imzalar?.hekim?.signerName || "",
          },
          isveren: {
            imza: imzalar?.isveren?.imza || null,
            paraf: imzalar?.isveren?.paraf || null,
            signerName: imzalar?.isveren?.signerName || "",
          },
        },
        firma: {
          id: selectedFirm.id || selectedFirm._id || "",
          firmaAdi: selectedFirm.firmaAdi || "",
          adres: selectedFirm.adres || "",
          tehlikeSinifi: selectedFirm.tehlike || selectedFirm.tehlikeSinifi || "",
          calisanSayisi: selectedFirm.calisanSayisi || "",
          sgkSicilNo: selectedFirm.sgkSicilNo || "",
        },
        rapor: {
          tarih: tarihTr,
          yil: raporYili || new Date(raporTarihi).getFullYear(),
          satirlar: rows.map((row, index) => ({
            no: index + 1,
            yapilanCalisma: row.calisma || "",
            tarih: row.tarih ? toTRDate(row.tarih) : "",
            yapanKisiUnvan: row.yapanKisiUnvan || "",
            tekrarSayisi: row.tekrarSayisi || "",
            kullanilanYontem: row.kullanilanYontem || "",
            sonucYorum: row.sonucYorum || "",
          })),
        },
      };

      const token = getBearerToken(user);

      const res = await fetch(`${API_BASE}/yillik-degerlendirme-raporu/pdf`, {
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
  console.error("YDR PDF hatası:", text);
  openInfo("Hata", "PDF hazırlanırken bir hata oluştu.");
  return;
}

      const blob = await res.blob();
const objectUrl = URL.createObjectURL(blob);

clearInterval(progressTimer);
setPdfProgress(100);
setPdfUrl(objectUrl);

      const firmaAdi = selectedFirm?.firmaAdi || "Firma";
      setDownloadName(
        `${sanitizeFileName(firmaAdi)} (YDR-${raporYili || new Date().getFullYear()}-${tarihTr}).pdf`
      );

      setTimeout(() => {
  setLoading(false);
}, 400);
    } catch (e) {
  clearInterval(progressTimer);
  setLoading(false);
  setPdfProgress(0);
  setShow(false);

  console.error("YDR PDF hazırlanamadı:", e);
  openInfo("Hata", "PDF hazırlanırken beklenmeyen bir hata oluştu.");
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
      a.download = downloadName || "YillikDegerlendirmeRaporu.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(() => {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch {}
      }, 1500);
    } catch (e) {
      console.error("YDR PDF indirme hatası:", e);
      openInfo("Hata", "PDF indirilemedi.");
    }
  };

  const saveToDocs = async () => {
    if (!pdfUrl) {
      openInfo("Bilgilendirme", 'Önce "Hazırla (PDF)" ile belgeyi oluştur.');
      return;
    }

    const activeFirmId = selectedFirm?.id || selectedFirm?._id;
    if (!activeFirmId) {
      openInfo("Bilgilendirme", "Geçerli bir firma seçili değil.");
      return;
    }

    const firmaAdi = selectedFirm.firmaAdi || "Firma";
    const yil = raporYili || new Date(raporTarihi || Date.now()).getFullYear();
    const tarihTr = new Date().toLocaleDateString("tr-TR");
    const hazirlayan =
      (kisisel?.adSoyad && `${kisisel.adSoyad}`) ||
      (user?.ad && `${user.ad}`) ||
      "İSG Uzmanı";

    const doSave = async () => {
      try {
        setSaving(true);

        const token = getBearerToken(user);
        if (!token) {
          openInfo("Hata", "Oturum bilgisi bulunamadı.");
          return;
        }

        const fileName = `${sanitizeFileName(firmaAdi)} (YDR-${yil}-${tarihTr}).pdf`;
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
          console.error("YDR pdf upload hata:", text);
          openInfo("Hata", "PDF dosyası sunucuya yüklenemedi.");
          return;
        }

        const uploadJson = await uploadRes.json();
        const uploadedFileUrl = uploadJson?.fileUrl || "";
        const uploadedAbsoluteUrl = uploadJson?.absoluteUrl || "";

        const payload = {
          firmaId: String(activeFirmId),
          firmaAdi,
          category: "yillik",
          subCategory: "yillik-degerlendirme-raporu",
          title: "Yıllık Değerlendirme Raporu (YDR)",
          year: yil,
          createdBy: hazirlayan,
          createdByUserId: user?._id || user?.id || user?.adminId || user?.createdByAdminId,
          hazirlayan,
          personName: hazirlayan,
          belgeTuru: "YDR",
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
          console.error("YDR kayıt hatası:", text);
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
        console.error("YDR kaydedilemedi:", e);
        openInfo("Hata", "Belge kaydedilirken hata oluştu.");
      } finally {
        setSaving(false);
      }
    };

    openConfirm({
      title: "Onay",
      message: `${firmaAdi} için ${yil} yılına ait "Yıllık Değerlendirme Raporu (YDR)" kaydedilecektir.\n\nDevam etmek ister misiniz?`,
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
          title="Yıllık Değerlendirme Raporu"
          subtitle="Devam etmek için lütfen sağ üstten bir firma seçiniz."
        />
      </CardBox>
    );
  }

  return (
    <>
      <CardBox className="flex flex-col gap-4">
        <SectionTitle
          title="Yıllık Değerlendirme Raporu"
          subtitle="Risk Değerlendirme Prosedürü referans görünümüne uyumlu şekilde yıllık değerlendirme raporu hazırlayabilirsiniz."
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
            type="date"
            value={raporTarihi}
            onChange={(e) => {
              const nextDate = e.target.value;
              const y = new Date(nextDate).getFullYear();
              const nextYear = Number.isFinite(y) ? String(y) : "";

              setRaporTarihi(nextDate);
              setRaporYili(nextYear);

              void saveYdrFormToServer({
                raporTarihi: nextDate,
                raporYili: nextYear,
              });
            }}
            className="w-full min-w-0 h-11 rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-800 [color-scheme:light]"
            style={{ WebkitAppearance: "none", appearance: "none" }}
          />

          <input
            readOnly
            value={raporYili || ""}
            className={`${readonlyInputClass} min-w-0 h-11 text-sm`}
            placeholder="Rapor yılı"
          />
        </div>

        <div className="mt-2 rounded-lg border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-[1200px] w-full text-xs">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-3 py-3 text-left border-b border-slate-200 w-12">#</th>
                  <th className="px-3 py-3 text-left border-b border-slate-200 min-w-[220px]">Yapılan Çalışma</th>
                  <th className="px-3 py-3 text-left border-b border-slate-200 min-w-[150px]">Tarih</th>
                  <th className="px-3 py-3 text-left border-b border-slate-200 min-w-[230px]">Yapan Kişi / Unvan</th>
                  <th className="px-3 py-3 text-left border-b border-slate-200 min-w-[120px]">Tekrar Sayısı</th>
                  <th className="px-3 py-3 text-left border-b border-slate-200 min-w-[280px]">Kullanılan Yöntem</th>
                  <th className="px-3 py-3 text-left border-b border-slate-200 min-w-[300px]">Sonuç / Yorum</th>
                  <th className="px-3 py-3 text-center border-b border-slate-200 w-20">Sil</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.id} className="odd:bg-white even:bg-slate-50/40">
                    <td className="px-3 py-2 border-b border-slate-200 align-top">{index + 1}</td>

                    <td className="px-3 py-2 border-b border-slate-200 align-top">
                      <input
                        value={row.calisma}
                        onChange={(e) => handleChangeRowField(row.id, "calisma", e.target.value)}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      />
                    </td>

                    <td className="px-3 py-2 border-b border-slate-200 align-top">
                      <input
                        type="date"
                        value={row.tarih || ""}
                        onChange={(e) => handleChangeRowField(row.id, "tarih", e.target.value)}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 [color-scheme:light]"
                        style={{ WebkitAppearance: "none", appearance: "none" }}
                      />
                    </td>

                    <td className="px-3 py-2 border-b border-slate-200 align-top">
  <input
    value={row.yapanKisiUnvan}
    onChange={(e) =>
      handleChangeRowField(
        row.id,
        "yapanKisiUnvan",
        e.target.value.toLocaleUpperCase("tr-TR")
      )
    }
    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-800"
  />
</td>

                    <td className="px-3 py-2 border-b border-slate-200 align-top">
                      <input
                        value={row.tekrarSayisi}
                        onChange={(e) => handleChangeRowField(row.id, "tekrarSayisi", e.target.value)}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      />
                    </td>

                    <td className="px-3 py-2 border-b border-slate-200 align-top">
                      <textarea
                        rows={3}
                        value={row.kullanilanYontem}
                        onChange={(e) => handleChangeRowField(row.id, "kullanilanYontem", e.target.value)}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-y"
                      />
                    </td>

                    <td className="px-3 py-2 border-b border-slate-200 align-top">
                      <textarea
                        rows={3}
                        value={row.sonucYorum}
                        onChange={(e) => handleChangeRowField(row.id, "sonucYorum", e.target.value)}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-y"
                      />
                    </td>

                    <td className="px-3 py-2 border-b border-slate-200 align-top text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(row.id)}
                        className="inline-flex items-center justify-center px-3 py-2 text-xs rounded-md bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
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
        title="Yıllık Değerlendirme Raporu"
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
            title="Yıllık Değerlendirme Raporu PDF"
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
