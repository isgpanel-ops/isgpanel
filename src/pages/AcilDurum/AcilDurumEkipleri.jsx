import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { SectionTitle, CardBox, PrimaryButton, Modal } from "../../components/ui";
import ConfirmModal from "../../components/ui/ConfirmModal";
import { FirmaContext } from "../../context/FirmaContext";


/* ------------ yardımcılar ------------ */
const DOCS_SYNC_KEY = "docs:lastChangeAt";

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

/* İlkyardım kişi sayısı (mevzuata göre) */
const calcIlkYardimCount = (calisan, tehlike) => {
  if (!calisan || calisan <= 0) return 0;

  const t = (tehlike || "").toLowerCase();
  let divisor = 20;

  if (t.includes("az")) {
    divisor = 20;
  } else if (t.includes("çok")) {
    divisor = 10;
  } else if (t.includes("tehlikeli")) {
    divisor = 15;
  }

  return Math.max(1, Math.ceil(calisan / divisor));
};

/* Söndürme / Kurtarma / Koruma kişi sayısı */
const calcOtherTeamCount = (calisan, tehlike) => {
  if (!calisan || calisan <= 0) return 0;

  let divisor = 50;

  if (typeof tehlike === "string") {
    const t = tehlike.toLowerCase();

    if (t.includes("çok")) {
      divisor = 30;
    } else if (t.includes("az")) {
      divisor = 50;
    } else if (t.includes("tehlikeli")) {
      divisor = 40;
    }
  }

  return Math.max(1, Math.ceil(calisan / divisor));
};

const EKIP_TIPLERI = [
  "YANGIN SÖNDÜRME EKİBİ",
  "KURTARMA / TAHLİYE EKİBİ",
  "KORUMA / GÜVENLİK EKİBİ",
  "İLKYARDIM EKİBİ",
];

const PHONE_MAX_LENGTH = 11;
const makeRowId = () =>
  `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
const normalizePhone = (value) =>
  String(value || "")
    .replace(/\D/g, "")
    .slice(0, PHONE_MAX_LENGTH);

const isFilledText = (value) => !!String(value || "").trim();

const buildSyncPayload = ({ firmaId, teams, meta = {} }) => ({
  firmaId: String(firmaId || ""),
  teams: (teams || []).map((row) => ({
    id: row?.id || makeRowId(),
    ekip: String(row?.ekip || "").trim(),
    adSoyad: String(row?.adSoyad || "").trim().toLocaleUpperCase("tr-TR"),
    gorev: String(row?.gorev || "").trim().toLocaleUpperCase("tr-TR"),
    iletisim: normalizePhone(row?.iletisim || ""),
  })),
  meta: {
    calisanSayisi: meta?.calisanSayisi ?? "",
    manualDate: meta?.manualDate || "",
    oneriler: meta?.oneriler || {
      yangin: 0,
      kurtarma: 0,
      koruma: 0,
      ilkyardim: 0,
    },
  },
});

export default function AcilDurumEkipleri() {
  const { selectedFirm } = useContext(FirmaContext);

  const API_BASE =
    (import.meta.env.VITE_API_URL || "").trim().replace(/\/$/, "") ||
    "https://api.isgpanel.tr/api";

  const getAuthToken = () =>
    localStorage.getItem("token") ||
    localStorage.getItem("jwt") ||
    localStorage.getItem("accessToken") ||
    localStorage.getItem("authToken") ||
    "";

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

  const [calisanSayisi, setCalisanSayisi] = useState("");
  const [manualDate, setManualDate] = useState("");
  const [oneriler, setOneriler] = useState({
    yangin: 0,
    kurtarma: 0,
    koruma: 0,
    ilkyardim: 0,
  });

  const [teams, setTeams] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const [loading, setLoading] = useState(false);
const [pdfProgress, setPdfProgress] = useState(0);
const [show, setShow] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [downloadName, setDownloadName] = useState("AcilDurumEkipleri.pdf");
  const [saving, setSaving] = useState(false);

  const saveTimeout = useRef(null);
  const skipAutoSaveRef = useRef(true);

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

  const toAbsoluteUrl = (p) => {
    if (!p) return "";
    const s = String(p).trim();
    if (!s) return "";
    if (/^https?:\/\//i.test(s)) return s;
    if (s.startsWith("data:") || s.startsWith("blob:")) return s;
    if (s.startsWith("//")) return `${window.location.protocol}${s}`;
    if (s.startsWith("/uploads")) return `https://api.isgpanel.tr${s}`;
    if (s.startsWith("/")) return `${API_BASE}${s}`;
    return `${API_BASE}/${s}`;
  };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const generateQueuedPdf = async (jobType, payload) => {
  const token = getAuthToken();

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

  const createJson = await createRes.json().catch(() => null);

  if (!createRes.ok || !createJson?.jobId) {
    throw new Error(createJson?.message || "PDF işi başlatılamadı.");
  }

  for (let i = 0; i < 80; i++) {
    await sleep(1500);

    const statusRes = await fetch(`${API_BASE}/pdf/job/${createJson.jobId}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    const job = await statusRes.json().catch(() => null);

    if (!statusRes.ok) {
      throw new Error(job?.message || "PDF durumu alınamadı.");
    }

    if (job?.status === "done") {
      return job.resultFileUrl;
    }

    if (job?.status === "error") {
      throw new Error(job?.error || "PDF oluşturulamadı.");
    }
  }

  throw new Error("PDF oluşturma zaman aşımına uğradı.");
};

  const safeParseLS = (key) => {
    try {
      return JSON.parse(localStorage.getItem(key) || "null");
    } catch {
      return null;
    }
  };

  const kisisel = useMemo(() => safeParseLS("kisiselBilgiler"), []);
  const user = useMemo(() => safeParseLS("user"), []);
  const [kurumsal, setKurumsal] = useState(() => safeParseLS("kurumsalBilgiler"));

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "kurumsalBilgiler") setKurumsal(safeParseLS("kurumsalBilgiler"));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const getFirmId = () => selectedFirm?.id || selectedFirm?._id || null;

  const loadAcilEkipForm = async (firmId) => {
    const token = getAuthToken();
    if (!token || !firmId) return null;

    const candidates = [
      `${API_BASE}/acil-ekipleri/form/${firmId}`,
      `${API_BASE}/acil-ekipleri/${firmId}`,
      `${API_BASE}/acil-ekipleri/by-firma/${firmId}`,
    ];

    for (const url of candidates) {
      try {
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.ok) {
          const contentType = res.headers.get("content-type") || "";
          if (contentType.includes("application/json")) {
            return await res.json();
          }
          return null;
        }

        if (res.status !== 404 && res.status !== 405) {
          const text = await res.text();
          throw new Error(text || "Acil ekip form verisi alınamadı.");
        }
      } catch (err) {
        console.error("Acil ekip form okuma denemesi başarısız:", url, err);
      }
    }

    return null;
  };

  const saveAcilEkipForm = async (firmId, payload) => {
    const token = getAuthToken();
    if (!token || !firmId) throw new Error("Oturum veya firma bilgisi yok.");

    const candidates = [
      {
        url: `${API_BASE}/acil-ekipleri/form/${firmId}`,
        method: "PUT",
        body: payload,
      },
      {
        url: `${API_BASE}/acil-ekipleri/form/${firmId}`,
        method: "POST",
        body: payload,
      },
      {
        url: `${API_BASE}/acil-ekipleri/${firmId}`,
        method: "PUT",
        body: payload,
      },
      {
        url: `${API_BASE}/acil-ekipleri/${firmId}`,
        method: "POST",
        body: payload,
      },
      {
        url: `${API_BASE}/acil-ekipleri`,
        method: "POST",
        body: {
          firmaId: firmId,
          ...payload,
        },
      },
      {
        url: `${API_BASE}/acil-ekipleri/by-firma/${firmId}`,
        method: "POST",
        body: payload,
      },
    ];

    let lastErrorText = "";

    for (const item of candidates) {
      try {
        const res = await fetch(item.url, {
          method: item.method,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(item.body),
        });

        if (res.ok) {
          const contentType = res.headers.get("content-type") || "";
          if (contentType.includes("application/json")) {
            return await res.json();
          }
          return { success: true };
        }

        const text = await res.text();
        lastErrorText = text;

        if (res.status !== 404 && res.status !== 405) {
          throw new Error(text || "Acil ekip form verisi kaydedilemedi.");
        }
      } catch (err) {
        console.error("Acil ekip save denemesi başarısız:", item.url, err);

        if (
          err?.message &&
          !err.message.includes("Cannot PUT") &&
          !err.message.includes("Cannot POST")
        ) {
          throw err;
        }
      }
    }

    throw new Error(
      lastErrorText ||
        "Acil ekip kayıt endpointi bulunamadı. Backend route kontrol edilmeli."
    );
  };

  const readonlyInputClass =
    "w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-800";
  const editableInputClass =
    "w-full rounded-md border border-slate-200 px-2 py-1 text-[11px]";

 const emitTeamsChanged = (nextTeams) => {
  try {
    const firmaId = getFirmId();

    window.dispatchEvent(
      new CustomEvent("acilEkipleriChanged", {
        detail: buildSyncPayload({
          firmaId,
          teams: nextTeams,
          meta: {
            calisanSayisi: calisanSayisi ? Number(calisanSayisi) : "",
            manualDate,
            oneriler,
          },
        }),
      })
    );
  } catch {}
};

  const getExpectedCounts = () => {
    const n = Number(calisanSayisi);
    if (!n || isNaN(n) || n <= 0) {
      return { yangin: 0, kurtarma: 0, koruma: 0, ilkyardim: 0 };
    }

    return {
      yangin: calcOtherTeamCount(n, selectedFirm?.tehlike || ""),
      kurtarma: calcOtherTeamCount(n, selectedFirm?.tehlike || ""),
      koruma: calcOtherTeamCount(n, selectedFirm?.tehlike || ""),
      ilkyardim: calcIlkYardimCount(n, selectedFirm?.tehlike || ""),
    };
  };



  const validateAcilEkipForm = () => {
  const expected = getExpectedCounts();
  const expectedTotal =
    Number(expected.yangin || 0) +
    Number(expected.kurtarma || 0) +
    Number(expected.koruma || 0) +
    Number(expected.ilkyardim || 0);

  if (!expectedTotal) {
    return {
      ok: false,
      message: "Acil durum sekmesindeki bilgileri doldurunuz.",
    };
  }

  if (!Array.isArray(teams) || teams.length < expectedTotal) {
    return {
      ok: false,
      message: "Acil durum sekmesindeki bilgileri doldurunuz.",
    };
  }

  const requiredTeams = teams.slice(0, expectedTotal);

  const firstMissingRow = requiredTeams.find(
    (row) =>
      !isFilledText(row?.ekip) ||
      !isFilledText(row?.adSoyad) ||
      !isFilledText(row?.gorev) ||
      normalizePhone(row?.iletisim || "").length !== PHONE_MAX_LENGTH
  );

  if (firstMissingRow) {
    return {
      ok: false,
      message:
        "Acil durum sekmesindeki kişi bilgilerini eksiksiz doldurunuz. Telefon numarası 11 haneli olmalıdır.",
    };
  }

  return { ok: true };
};

const validateEgitimDependencies = async () => {
  try {
    const firmId = getFirmId();
    const serverData = await loadAcilEkipForm(firmId);

    const serverTeams = Array.isArray(serverData?.teams) ? serverData.teams : [];
    const expected = getExpectedCounts();
    const expectedTotal =
      Number(expected.yangin || 0) +
      Number(expected.kurtarma || 0) +
      Number(expected.koruma || 0) +
      Number(expected.ilkyardim || 0);

    if (!expectedTotal || !serverTeams.length) {
      return {
        ok: false,
        message: "Lütfen eğitim sekmesindeki bilgileri doldurunuz.",
      };
    }

    let rows = [];

    try {
      const token = getAuthToken();
      if (token && firmId) {
        const res = await fetch(`${API_BASE}/destek-acil/katilimcilar?firmaId=${firmId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.ok) {
          const json = await res.json();
          const data = json?.payload || json || {};
          rows = Array.isArray(data?.katilimcilar) ? data.katilimcilar : [];
        }
      }
    } catch (err) {
      console.error("Eğitim bağımlılığı serverdan okunamadı:", err);
    }

    const acilRows = rows.filter(
      (r) => r?.kaynak === "acil" && String(r?.adSoyad || "").trim()
    );

    if (!acilRows.length || acilRows.length < Math.min(expectedTotal, serverTeams.length)) {
      return {
        ok: false,
        message: "Lütfen eğitim sekmesindeki bilgileri doldurunuz.",
      };
    }

    const normalizeTC = (v) => String(v || "").replace(/\D/g, "").slice(0, 11);
    const normalizeText = (v) => String(v || "").trim().toLocaleUpperCase("tr-TR");

    const findMatchingEgitimRow = (teamRow) => {
      const teamTc = normalizeTC(teamRow?.tc || "");
      const teamName = normalizeText(teamRow?.adSoyad || "");
      const teamEkip = normalizeText(teamRow?.ekip || "");

      if (teamTc) {
        const byTc = acilRows.find((row) => normalizeTC(row?.tc || "") === teamTc);
        if (byTc) return byTc;
      }

      return acilRows.find(
        (row) =>
          normalizeText(row?.adSoyad || "") === teamName &&
          normalizeText(row?.gorev || "") === teamEkip
      );
    };

    for (const team of serverTeams.slice(0, expectedTotal)) {
      const match = findMatchingEgitimRow(team);

      if (!match) {
        return {
          ok: false,
          message: "Lütfen eğitim sekmesindeki bilgileri doldurunuz.",
        };
      }

      if (normalizeTC(match?.tc || "").length !== 11) {
        return {
          ok: false,
          message: "Lütfen eğitim sekmesindeki bilgileri doldurunuz.",
        };
      }

      if (!match?.imzalar?.personel?.dataUrl) {
        return {
          ok: false,
          message: "Lütfen eğitim sekmesindeki bilgileri doldurunuz.",
        };
      }
    }

    return { ok: true };
  } catch (err) {
    console.error("validateEgitimDependencies hata:", err);
    return {
      ok: false,
      message: "Lütfen eğitim sekmesindeki bilgileri doldurunuz.",
    };
  }
};

  useEffect(() => {
    let active = true;

    const run = async () => {
      if (!selectedFirm) return;

      try {
        setLoaded(false);

        const firmId = getFirmId();
        const serverData = await loadAcilEkipForm(firmId);

        if (!active) return;

        if (serverData) {
 setTeams(
  (Array.isArray(serverData?.teams) ? serverData.teams : []).map((row) => ({
    ...row,
    id: makeRowId(),
  }))
);
          setCalisanSayisi(
            serverData?.meta?.calisanSayisi
              ? String(serverData.meta.calisanSayisi)
              : String(
                  selectedFirm.calisanSayisi ||
                    selectedFirm.calisan ||
                    selectedFirm.personelSayisi ||
                    ""
                )
          );
          setOneriler(
            serverData?.meta?.oneriler || {
              yangin: 0,
              kurtarma: 0,
              koruma: 0,
              ilkyardim: 0,
            }
          );
          setManualDate(serverData?.meta?.manualDate || "");
        } else {
          const guess =
            selectedFirm.calisanSayisi ||
            selectedFirm.calisan ||
            selectedFirm.personelSayisi ||
            "";

          setCalisanSayisi(guess ? String(guess) : "");
          setManualDate("");
          setOneriler({
            yangin: 0,
            kurtarma: 0,
            koruma: 0,
            ilkyardim: 0,
          });
          setTeams([]);
        }
      } catch (e) {
        console.error("Acil ekipler serverdan okunamadı:", e);
        setTeams([]);
      } finally {
        if (active) {
          setLoaded(true);
          skipAutoSaveRef.current = true;
        }
      }
    };

    run();

    return () => {
      active = false;
    };
  }, [selectedFirm]);

  useEffect(() => {
    const handleExternalRefresh = async () => {
      const firmId = getFirmId();
      if (!firmId) return;

      try {
        const serverData = await loadAcilEkipForm(firmId);
        if (!serverData) return;

        skipAutoSaveRef.current = true;
setTeams(
  (Array.isArray(serverData?.teams) ? serverData.teams : []).map((row) => ({
    ...row,
    id: makeRowId(),
  }))
);
        setCalisanSayisi(
          serverData?.meta?.calisanSayisi ? String(serverData.meta.calisanSayisi) : ""
        );
        setOneriler(
          serverData?.meta?.oneriler || {
            yangin: 0,
            kurtarma: 0,
            koruma: 0,
            ilkyardim: 0,
          }
        );
        setManualDate(serverData?.meta?.manualDate || "");
      } catch (e) {
        console.error("Acil ekip harici refresh okunamadı:", e);
      }
    };

    window.addEventListener("acilEkipleriUpdated", handleExternalRefresh);
    window.addEventListener(DOCS_SYNC_KEY, handleExternalRefresh);

    return () => {
      window.removeEventListener("acilEkipleriUpdated", handleExternalRefresh);
      window.removeEventListener(DOCS_SYNC_KEY, handleExternalRefresh);
    };
  }, [selectedFirm]);

  const tehlikeSinifi = selectedFirm?.tehlike || "";

  const handleAutoGenerate = () => {
    const n = Number(calisanSayisi);
    if (!n || isNaN(n) || n <= 0) {
      openInfo("Bilgilendirme", "Lütfen geçerli bir çalışan sayısı giriniz.");
      return;
    }

    const yangin = calcOtherTeamCount(n, tehlikeSinifi);
    const kurtarma = calcOtherTeamCount(n, tehlikeSinifi);
    const koruma = calcOtherTeamCount(n, tehlikeSinifi);
    const ilkyardim = calcIlkYardimCount(n, tehlikeSinifi);

    const newOneriler = { yangin, kurtarma, koruma, ilkyardim };

    const buildGeneratedTeams = () => {
      const generated = [];
      let counter = 0;

      const pushRows = (count, ekipTip) => {
        for (let i = 0; i < count; i++) {
         generated.push({
  id: makeRowId(),
  ekip: ekipTip,
  adSoyad: "",
  gorev: "",
  iletisim: "",
});
        }
      };

      pushRows(yangin, "YANGIN SÖNDÜRME EKİBİ");
      pushRows(kurtarma, "KURTARMA / TAHLİYE EKİBİ");
      pushRows(koruma, "KORUMA / GÜVENLİK EKİBİ");
      pushRows(ilkyardim, "İLKYARDIM EKİBİ");

      return generated;
    };

    const applyGeneratedTeams = () => {
      const generated = buildGeneratedTeams();
      setOneriler(newOneriler);
      setTeams(generated);
      emitTeamsChanged(generated);
    };

    if (teams.length > 0) {
      openConfirm({
        title: "Uyarı",
        message:
          "Mevcut ekip listesi silinip önerilere göre yeniden oluşturulacak. Devam edilsin mi?",
        confirmText: "Devam Et",
        cancelText: "İptal",
        variant: "warning",
        onConfirm: applyGeneratedTeams,
      });
      return;
    }

    applyGeneratedTeams();
  };

 const handleChangeRow = (id, field, value) => {
  setTeams((prev) => {
    const updated = prev.map((row) => {
      if (row.id !== id) return row;

      let nextValue = value;

      if (field === "adSoyad" || field === "gorev") {
        nextValue = (value || "").toLocaleUpperCase("tr-TR");
      }

      if (field === "iletisim") {
        nextValue = normalizePhone(value);
      }

      return {
        ...row,
        [field]: nextValue,
      };
    });

    emitTeamsChanged(updated);
    return updated;
  });
};

 const addRow = () => {
  setTeams((prev) => {
    const updated = [
      ...prev,
      {
         id: makeRowId(),
  ekip: "YANGIN SÖNDÜRME EKİBİ",
  adSoyad: "",
  gorev: "",
  iletisim: "",
      },
    ];

    emitTeamsChanged(updated);
    return updated;
  });
};

  const removeRow = (id) => {
    openConfirm({
      title: "Uyarı",
      message: "Bu satırı silmek istiyor musunuz?",
      confirmText: "Sil",
      cancelText: "İptal",
      variant: "warning",
      onConfirm: () => {
        setTeams((prev) => {
          const updated = prev.filter((row) => row.id !== id);
          emitTeamsChanged(updated);
          return updated;
        });
      },
    });
  };

  const handleManualSave = async (silent = false) => {
  try {
    const firmId = getFirmId();

    const payload = {
      ...buildSyncPayload({
        firmaId: firmId,
        teams,
        meta: {
          calisanSayisi: calisanSayisi ? Number(calisanSayisi) : "",
          manualDate,
          oneriler,
        },
      }),
      updatedAt: new Date().toISOString(),
    };

    await saveAcilEkipForm(firmId, payload);

    try {
      // Yazarken sessiz autosave'de dış refresh tetikleme.
      // Aksi halde input'a girilen değerler serverdan tekrar çekilip
      // kullanıcı yazarken silinmiş gibi görünebiliyor.
      if (!silent) {
        emitTeamsChanged(payload.teams);
        window.dispatchEvent(new Event("acilEkipleriUpdated"));
        window.dispatchEvent(new Event("ticari_docs_refresh"));
        window.dispatchEvent(new Event("documentsUpdated"));
        window.dispatchEvent(new Event("belgelerimUpdated"));
        window.dispatchEvent(new Event(DOCS_SYNC_KEY));
      }
    } catch {}

    if (!silent) {
      openInfo("Bilgilendirme", "Kişi bilgileri kaydedildi ✅");
    }
  } catch (e) {
    console.error("Kaydederken hata:", e);
    if (!silent) {
      openInfo("Hata", e?.message || "Kaydedilirken bir hata oluştu.");
    }
  }
};

  useEffect(() => {
    if (!loaded) return;

    if (skipAutoSaveRef.current) {
      skipAutoSaveRef.current = false;
      return;
    }

    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
    }

    saveTimeout.current = setTimeout(() => {
      handleManualSave(true);
    }, 800);

    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
  }, [teams, oneriler, calisanSayisi, manualDate, loaded]);

const handlePrepare = async () => {
  if (!selectedFirm) {
    openInfo("Bilgilendirme", "Lütfen önce bir firma seçiniz.");
    return;
  }

  const validation = validateAcilEkipForm();
  if (!validation.ok) {
    openInfo("Bilgilendirme", validation.message);
    return;
  }

  const egitimValidation = await validateEgitimDependencies();
  if (!egitimValidation.ok) {
    openInfo("Bilgilendirme", egitimValidation.message);
    return;
  }

  await doPreparePdf();
};

const doPreparePdf = async () => {
  let progressTimer = null;

  try {
  setLoading(true);
  setPdfProgress(5);
  setShow(true);
  setPdfUrl(null);

  progressTimer = setInterval(() => {
    setPdfProgress((prev) => {
      if (prev >= 92) return prev;
      return prev + Math.floor(Math.random() * 6) + 2;
    });
  }, 700);

    const firmId = getFirmId();
    const authToken = getAuthToken();

    const rawLogoUrl =
      kurumsal?.logoUrl ||
      kurumsal?.logoPath ||
      kurumsal?.logoSrc ||
      selectedFirm?.logoUrl ||
      selectedFirm?.logo ||
      "";

    const absoluteLogoUrl = toAbsoluteUrl(rawLogoUrl);

    let finalLogo =
      kurumsal?.logoBase64 ||
      (typeof kurumsal?.logo === "string" && kurumsal.logo.startsWith("data:image")
        ? kurumsal.logo
        : "") ||
      (typeof selectedFirm?.logo === "string" && selectedFirm.logo.startsWith("data:image")
        ? selectedFirm.logo
        : "");

    if (!finalLogo && absoluteLogoUrl) {
      try {
        const logoRes = await fetch(absoluteLogoUrl, {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        });

        if (logoRes.ok) {
          const blob = await logoRes.blob();
          finalLogo = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(String(reader.result || ""));
            reader.readAsDataURL(blob);
          });
        }
      } catch (e) {
        console.error("Logo base64 hatası:", e);
      }
    }

    let riskKisiler = {};
    if (authToken && firmId) {
      try {
        const r = await fetch(`${API_BASE}/firma/${firmId}/kisiler`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        if (r.ok) {
          const data = await r.json();
          riskKisiler = {
            isveren:
              data?.isveren ||
              data?.isverenAdSoyad ||
              data?.isverenVekiliAdSoyad ||
              data?.isverenVekili ||
              "",
            uzman: data?.uzman || data?.isgUzmaniAdSoyad || "",
            hekim: data?.hekim || data?.isyeriHekimiAdSoyad || "",
            temsilci: data?.temsilci || data?.calisanTemsilcisiAdSoyad || "",
            destek: data?.destek || data?.destekElemaniAdSoyad || "",
            bilgi: data?.bilgi || data?.bilgiSahibiKisiAdSoyad || "",
          };
        }
      } catch (e) {
        console.error("Firma kişileri alınamadı:", e);
      }
    }

    let egitimRows = [];
    try {
      if (authToken && firmId) {
        const res = await fetch(`${API_BASE}/destek-acil/katilimcilar?firmaId=${firmId}`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });

        if (res.ok) {
          const json = await res.json();
          const data = json?.payload || json || {};
          egitimRows = Array.isArray(data?.katilimcilar) ? data.katilimcilar : [];
        }
      }
    } catch (e) {
      console.error("Eğitim katılımcıları okunamadı:", e);
    }

    const normalizeTC = (v) => String(v || "").replace(/\D/g, "").slice(0, 11);
    const normalizeText = (v) => String(v || "").trim().toLocaleUpperCase("tr-TR");

    const acilEgitimRows = egitimRows.filter((r) => r?.kaynak === "acil");

    const findMatchingEgitimRow = (teamRow) => {
      const teamTc = normalizeTC(teamRow?.tc || "");
      const teamName = normalizeText(teamRow?.adSoyad || "");
      const teamEkip = normalizeText(teamRow?.ekip || "");

      if (teamTc) {
        const byTc = acilEgitimRows.find((row) => normalizeTC(row?.tc || "") === teamTc);
        if (byTc) return byTc;
      }

      return acilEgitimRows.find(
        (row) =>
          normalizeText(row?.adSoyad || "") === teamName &&
          normalizeText(row?.gorev || "") === teamEkip
      );
    };

   const teamsForPdf = (teams || []).map((r, index) => {
  const egitimMatch = findMatchingEgitimRow(r);

  return {
    no: index + 1,
    ekip: (r.ekip || "").toLocaleUpperCase("tr-TR"),
    adSoyad: (r.adSoyad || "").toLocaleUpperCase("tr-TR"),
    tc: normalizeTC(egitimMatch?.tc || r?.tc || ""),
    gorev: (r.gorev || "").toLocaleUpperCase("tr-TR"),
    ekipGorevi: (r.gorev || "").toLocaleUpperCase("tr-TR"),
    iletisim: normalizePhone(r.iletisim || ""),
    telefon: normalizePhone(r.iletisim || ""),
    kaynak: "acil",
    imzalar: {
      personel: egitimMatch?.imzalar?.personel || null,
    },
    personelImzalari: {
      personel: egitimMatch?.imzalar?.personel?.dataUrl || "",
    },
    personelImzasi: egitimMatch?.imzalar?.personel?.dataUrl || "",
  };
});

   const payload = {
  authToken,
  firmaId: firmId,

  kurumsal: {
    logo: finalLogo || "",
    logoUrl: "",
  },
  firma: {
    _id: selectedFirm?._id || selectedFirm?.id || "",
    id: selectedFirm?.id || selectedFirm?._id || "",
    firmaAdi: selectedFirm?.firmaAdi || "",
    sgkSicilNo: selectedFirm?.sgkSicilNo || "",
    adres: selectedFirm?.adres || "",
    nace: selectedFirm?.nace || "",
    faaliyet: selectedFirm?.faaliyet || "",
    tehlikeSinifi: tehlikeSinifi || "",
    calisanSayisi: calisanSayisi ? Number(calisanSayisi) : null,
  },
  tarihler: {
    hazirlamaTr: manualDate ? toTR(manualDate) : toTR(selectedFirm?.hazirlama),
    gecerlilikTr: toTR(selectedFirm?.gecerlilik),
  },
  kisiler: {
    ...riskKisiler,
    isveren: String(riskKisiler?.isveren || ""),
  },
  egitim: {
    konu: "Destek / Acil Ekip Eğitimi",
    tarihISO: manualDate || "",
    tarihTR: manualDate ? toTR(manualDate) : toTR(selectedFirm?.hazirlama),
    yer: selectedFirm?.firmaAdi || "",
    saat: 2,
  },
  oneriler,
  katilimcilar: teamsForPdf.map((row, index) => ({
    no: index + 1,
    tc: normalizeTC(row.tc || ""),
    adSoyad: (row.adSoyad || "").toLocaleUpperCase("tr-TR"),
    gorev: (row.ekip || "").toLocaleUpperCase("tr-TR"),
    kaynak: "acil",
    imzalar: {
      personel: row?.imzalar?.personel || null,
    },
    personelImzalari: {
      personel: row?.personelImzalari?.personel || "",
    },
    personelImzasi: row?.personelImzasi || "",
  })),
  acilEkip: {
    teams: teamsForPdf,
    meta: {
      calisanSayisi: calisanSayisi ? Number(calisanSayisi) : 0,
      manualDate: manualDate || "",
      oneriler,
    },
  },
  ekipler: teamsForPdf,
};

  const objectUrl = await generateQueuedPdf(
  "destek-acil-ekip-formu",
  payload
);

   if (progressTimer) clearInterval(progressTimer);
setPdfProgress(100);
setPdfUrl(objectUrl);

setTimeout(() => {
  setLoading(false);
}, 400);

    const belgeTarihTr = manualDate ? toTR(manualDate) : toTR(selectedFirm?.hazirlama);
    setDownloadName(
      `${sanitizeName(selectedFirm?.firmaAdi)} (AcilEkip-${belgeTarihTr}).pdf`
    );

    setShow(true);
 } catch (e) {
  clearInterval(progressTimer);
  setLoading(false);
  setPdfProgress(0);

  console.error("Acil ekip imzalı PDF hatası:", e);
  openInfo("Hata", "Hata: " + (e?.message || e));
}
};

  const saveToDocs = async () => {
    if (!pdfUrl) {
      openInfo("Bilgilendirme", "Önce 'Hazırla (PDF)' ile belgeyi oluştur.");
      return;
    }

    if (!selectedFirm?.id) {
      openInfo("Bilgilendirme", "Geçerli bir firma seçili değil.");
      return;
    }

    try {
      setSaving(true);

      const firmaAdi = selectedFirm.firmaAdi || "Firma";
      const belgeTarihTr = manualDate ? toTR(manualDate) : toTR(selectedFirm?.hazirlama);

      const yil =
        selectedFirm?.hazirlama && !isNaN(new Date(selectedFirm.hazirlama))
          ? new Date(selectedFirm.hazirlama).getFullYear()
          : new Date().getFullYear();

      const olusturan =
        (kisisel?.adSoyad && `${kisisel.adSoyad} `) ||
        (user?.ad && `${user.ad} (İSG Uzmanı)`) ||
        "İSG Uzmanı";

      const sameExists = false;

      const doSave = async () => {
        try {
          setSaving(true);

          const role = String(user?.role || "").toLowerCase();
          const isBireysel = role === "bireysel";
          const fileName = `${sanitizeName(firmaAdi)} (AcilEkip-${belgeTarihTr}).pdf`;

          const pdfBlob = await fetch(pdfUrl).then((r) => r.blob());

          let uploadedFileUrl = "";
          let uploadedAbsoluteUrl = "";

          if (!isBireysel) {
            const token =
              localStorage.getItem("token") ||
              localStorage.getItem("jwt") ||
              localStorage.getItem("accessToken") ||
              localStorage.getItem("authToken");

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
              console.error("Acil ekip pdf upload hata:", text);
              openInfo("Hata", "PDF dosyası sunucuya yüklenemedi.");
              return;
            }

            const uploadJson = await uploadRes.json();
            uploadedFileUrl = uploadJson?.fileUrl || "";
            uploadedAbsoluteUrl = uploadJson?.absoluteUrl || "";
          }

         

          const token =
            localStorage.getItem("token") ||
            localStorage.getItem("jwt") ||
            localStorage.getItem("accessToken") ||
            localStorage.getItem("authToken");

          const payload = {
            firmaId: String(selectedFirm.id),
            firmaAdi,
            category: "acil",
            subCategory: "acil-ekip",
            title: "Acil Ekip",
            year: yil,
            createdBy: olusturan,
            createdByUserId: user?._id || user?.id,
            hazirlayan: olusturan,
            personName: olusturan,
            belgeTuru: "Acil Ekip",
            tarih: belgeTarihTr,
            dosyaTuru: "PDF",
            status: "hazir",
            fileUrl: uploadedFileUrl,
            absoluteUrl: uploadedAbsoluteUrl,
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
            console.error("Acil ekip kayıt hatası:", text);
            openInfo("Hata", "Belge servera kaydedilemedi.");
            return;
          }

          try {
            window.dispatchEvent(new Event("ticari_docs_refresh"));
            window.dispatchEvent(new Event("documentsUpdated"));
            window.dispatchEvent(new Event("belgelerimUpdated"));
            window.dispatchEvent(new Event(DOCS_SYNC_KEY));
          } catch {}

          setShow(false);
          openInfo("Bilgilendirme", "Belgelerim, Acil Durum sekmesine kaydedildi ✅");
        } catch (e) {
          console.error("Acil ekip kaydedilemedi:", e);
          openInfo("Hata", "Belge kaydedilirken hata oluştu.");
        } finally {
          setSaving(false);
        }
      };

      if (sameExists) {
        openConfirm({
          title: "Uyarı",
          message: `${firmaAdi} için ${belgeTarihTr} tarihli "Acil Ekip" zaten kayıtlı.\n\nYine de kaydetmek ister misiniz?`,
          confirmText: "Yine de Kaydet",
          cancelText: "İptal",
          variant: "warning",
          onConfirm: doSave,
        });
        return;
      }

      doSave();
    } catch (e) {
      console.error("Acil ekip kaydedilemedi:", e);
      openInfo("Hata", "Belge kaydedilirken hata oluştu.");
    } finally {
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

  const handleIndir = async () => {
    try {
      if (!pdfUrl) {
        openInfo("Bilgilendirme", "Önce 'Hazırla (PDF)' ile belgeyi oluştur.");
        return;
      }

      const res = await fetch(pdfUrl);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = downloadName || "AcilDurumEkipleri.pdf";
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

  if (!selectedFirm) {
    return (
      <CardBox>
        <SectionTitle
          title="Acil Durum Ekipleri"
          subtitle="Devam etmek için lütfen sağ üstten bir firma seçiniz."
        />
      </CardBox>
    );
  }

  return (
    <>
      <CardBox className="flex flex-col gap-4">
        <SectionTitle
          title="Acil Durum Ekipleri"
          subtitle="Çalışan sayısı ve tehlike sınıfına göre ekipleri otomatik hesaplayabilir ve manuel olarak düzenleyebilirsiniz."
        />

        <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2 xl:grid-cols-4 xl:items-end">
          <input
            readOnly
            value={selectedFirm.firmaAdi || ""}
            className={`${readonlyInputClass} min-w-0 h-11 text-sm`}
            placeholder="Firma adı"
          />

          <input
            readOnly
            value={tehlikeSinifi || ""}
            className={`${readonlyInputClass} min-w-0 h-11 text-sm`}
            placeholder="Tehlike sınıfı"
          />

          <input
            type="number"
            min={1}
            inputMode="numeric"
            value={calisanSayisi}
            onChange={(e) => setCalisanSayisi(e.target.value)}
            className="w-full min-w-0 h-11 rounded-md border border-slate-300 px-3 text-sm"
            placeholder="Toplam çalışan sayısı"
          />

          <input
            type="date"
            value={manualDate}
            onChange={(e) => setManualDate(e.target.value)}
            className="w-full min-w-0 h-11 rounded-md border border-slate-300 px-3 text-sm text-slate-700 [color-scheme:light]"
            style={{
              WebkitAppearance: "none",
              appearance: "none",
            }}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_auto] xl:items-start">
          <p className="w-full rounded border border-slate-200 bg-slate-50 px-3 py-3 text-xs leading-5 text-slate-600">
            <span className="font-semibold">Bilgi:</span> Çalışan sayısını girdikten sonra{" "}
            <span className="font-semibold">"Önerilen kişi sayılarını hesapla"</span> butonu
            ile söndürme, kurtarma, koruma ve ilkyardım ekipleri için önerilen minimum kişi
            sayıları hesaplanır. İsterseniz tabloyu manuel olarak da düzenleyebilirsiniz.
            Düzenleme tarihini sağdaki alandan manuel seçebilirsiniz.
          </p>

          <PrimaryButton
            size="sm"
            variant="blue"
            onClick={handleAutoGenerate}
            className="h-9 w-full whitespace-nowrap px-3 text-[11px] xl:w-auto"
          >
            Önerilen kişi sayılarını hesapla ve tabloyu oluştur
          </PrimaryButton>
        </div>

        <div className="min-h-[28px]">
          {(oneriler.yangin || oneriler.kurtarma || oneriler.koruma || oneriler.ilkyardim) ? (
            <div className="grid grid-cols-2 gap-2 text-[11px] md:grid-cols-4">
              <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1">
                <div className="font-semibold text-slate-700">Yangın Söndürme</div>
                <div>Önerilen: {oneriler.yangin} kişi</div>
              </div>
              <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1">
                <div className="font-semibold text-slate-700">Kurtarma / Tahliye</div>
                <div>Önerilen: {oneriler.kurtarma} kişi</div>
              </div>
              <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1">
                <div className="font-semibold text-slate-700">Koruma / Güvenlik</div>
                <div>Önerilen: {oneriler.koruma} kişi</div>
              </div>
              <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1">
                <div className="font-semibold text-slate-700">İlkyardım</div>
                <div>Önerilen: {oneriler.ilkyardim} kişi</div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <button
            type="button"
            onClick={addRow}
            className="h-8 w-full rounded border border-gray-300 bg-white px-3 text-[11px] hover:bg-gray-50 md:w-auto"
          >
            Satır ekle
          </button>

          <PrimaryButton
            size="sm"
            variant="green"
            onClick={() => handleManualSave(false)}
            className="h-8 w-full px-3 text-[11px] md:w-auto"
          >
            Kaydet
          </PrimaryButton>
        </div>

        <div className="overflow-x-auto rounded border border-slate-200">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50 text-[11px] text-slate-600">
              <tr>
                <th className="px-2 py-2 border-b text-left w-8">#</th>
                <th className="px-2 py-2 border-b text-left min-w-[160px]">Ekip</th>
                <th className="px-2 py-2 border-b text-left min-w-[180px]">Ad Soyad</th>
                <th className="px-2 py-2 border-b text-left min-w-[160px]">Görev</th>
                <th className="px-2 py-2 border-b text-left min-w-[160px]">
                  İletişim (Telefon / Dahili)
                </th>
                <th className="px-2 py-2 border-b w-16 text-center">Sil</th>
              </tr>
            </thead>
            <tbody className="text-[11px]">
              {teams.map((row, index) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-2 py-1.5 border-b align-top">{index + 1}</td>
                  <td className="px-2 py-1.5 border-b align-top">
                    <select
                      value={row.ekip}
                      onChange={(e) => handleChangeRow(row.id, "ekip", e.target.value)}
                      className={`${editableInputClass} bg-white`}
                    >
                      {EKIP_TIPLERI.map((et) => (
                        <option key={et} value={et}>
                          {et}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1.5 border-b align-top">
                    <input
                      value={row.adSoyad}
                      onChange={(e) => handleChangeRow(row.id, "adSoyad", e.target.value)}
                      className={`${editableInputClass} uppercase text-center`}
                      placeholder="Ad SOYAD"
                    />
                  </td>
                  <td className="px-2 py-1.5 border-b align-top">
                    <input
                      value={row.gorev}
                      onChange={(e) => handleChangeRow(row.id, "gorev", e.target.value)}
                      className={`${editableInputClass} uppercase text-center`}
                      placeholder="Görev / Ünvan"
                    />
                  </td>
                  <td className="px-2 py-1.5 border-b align-top">
                    <input
  value={row.iletisim}
  onChange={(e) => handleChangeRow(row.id, "iletisim", e.target.value)}
  inputMode="numeric"
  maxLength={PHONE_MAX_LENGTH}
  className={editableInputClass}
  placeholder="05xxxxxxxxx"
/>
                  </td>
                  <td className="px-2 py-1.5 border-b align-top text-center">
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      className="px-2 py-1 text-[10px] rounded border border-red-200 text-red-600 hover:bg-red-50"
                    >
                      Sil
                    </button>
                  </td>
                </tr>
              ))}

              {teams.length === 0 && (
                <tr>
                  <td className="px-2 py-3 text-center text-slate-500 text-xs" colSpan={6}>
                    Henüz ekip satırı yok. Çalışan sayısını girip "Önerilen kişi sayılarını
                    hesapla" butonunu kullanabilir veya "Satır ekle" ile manuel
                    başlayabilirsiniz.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
          <PrimaryButton
            type="button"
            size="sm"
            onClick={handlePrepare}
            disabled={loading}
            className={loading ? "cursor-wait" : ""}
          >
            {loading ? "Hazırlanıyor..." : "Hazırla (PDF)"}
          </PrimaryButton>
        </div>
      </CardBox>

      <Modal
        isOpen={show}
        onClose={() => setShow(false)}
        title="Acil Durum Ekip Formu"
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
            title="Acil Durum Ekipleri"
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