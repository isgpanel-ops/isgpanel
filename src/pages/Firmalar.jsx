import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import ExcelJS from "exceljs";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import { createWorker } from "tesseract.js";
import {
  HiPlus,
  HiSearch,
  HiSortAscending,
  HiPencil,
  HiTrash,
  HiX,
  HiEye,
  HiUpload,
  HiDownload,
  HiDocumentText,
} from "react-icons/hi";
import { Building2 } from "lucide-react";
import naceData from "@/data/naceTR.json";
import { useFirmalar } from "../context/FirmaContext";
import ConfirmModal from "../components/ui/ConfirmModal";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// =========================
// API
// =========================
const API_URL =
  (import.meta.env.VITE_API_URL || "").trim().replace(/\/$/, "") ||
  "https://api.isgpanel.tr";
const getToken = () => localStorage.getItem("token");

// =========================
// Yardımcılar
// =========================
const formatTR = (d) => (d ? new Date(d).toLocaleDateString("tr-TR") : "-");
const digitsOnly = (s) => (s || "").replace(/\D/g, "");
const upTR = (s) => (s || "").toLocaleUpperCase("tr-TR");
const toTitleHazard = (v) => {
  const u = (v || "").toLocaleUpperCase("tr-TR");
  if (u.includes("ÇOK")) return "Çok Tehlikeli";
  if (u.includes("AZ")) return "Az Tehlikeli";
  return "Tehlikeli";
};

const computeValidity = (hazirlama, tehlike) => {
  if (!hazirlama) return "";
  const t = new Date(hazirlama);
  const addYears =
    tehlike === "Az Tehlikeli" ? 6 : tehlike === "Tehlikeli" ? 4 : 2;
  t.setFullYear(t.getFullYear() + addYears);
  return t.toISOString().slice(0, 10);
};

// ✅ type="date" için güvenli tarih dönüştürücü
// - yyyy-mm-dd => aynen
// - gg.aa.yyyy => yyyy-mm-dd
// - ISO / Date parse edilebilir string => yyyy-mm-dd
// - diğer => ""
const toInputDate = (v) => {
  if (!v) return "";
  const s = String(v).trim();
  if (!s) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) {
    const [d, m, y] = s.split(".");
    return `${y}-${m}-${d}`;
  }

  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);

  return "";
};

const inferNaceFromSgk = (sgk) => {
  const only = digitsOnly(sgk);
  return only.length >= 7 ? only.slice(1, 7) : "";
};

const getExcelCellValue = (cell) => {
  const value = cell?.value;
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if (value.text) return String(value.text);
    if (Array.isArray(value.richText)) return value.richText.map((x) => x.text || "").join("");
    if (value.result != null) return String(value.result);
  }
  return String(value).trim();
};

const normalizeExcelHeader = (value) =>
  String(value || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/[ıİ]/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .replace(/[^a-z0-9]/g, "");

const getHeaderMap = (worksheet) => {
  const map = new Map();
  const headerRow = worksheet.getRow(1);
  headerRow.eachCell((cell, colNumber) => {
    const key = normalizeExcelHeader(getExcelCellValue(cell));
    if (key) map.set(key, colNumber);
  });
  return map;
};

const getCellByHeader = (row, headerMap, aliases, fallbackCol = null) => {
  const normalizedAliases = aliases.map(normalizeExcelHeader);
  for (const [key, col] of headerMap.entries()) {
    if (normalizedAliases.some((alias) => key === alias || key.includes(alias))) {
      return getExcelCellValue(row.getCell(col));
    }
  }
  return fallbackCol ? getExcelCellValue(row.getCell(fallbackCol)) : "";
};

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const normalizeSearchText = (value) =>
  String(value || "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();

const getOcrLines = (text) =>
  normalizeSearchText(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

const includesAny = (text, keys) => {
  const hay = String(text || "").toLocaleLowerCase("tr-TR");
  return keys.some((key) => hay.includes(String(key).toLocaleLowerCase("tr-TR")));
};

const valueNearLabel = (lines, labels) => {
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!includesAny(line, labels)) continue;

    const afterColon = line.split(/[:：]/).slice(1).join(":").trim();
    if (afterColon && !includesAny(afterColon, labels)) return afterColon;

    for (let j = i + 1; j < Math.min(lines.length, i + 5); j += 1) {
      const candidate = lines[j];
      if (!includesAny(candidate, labels)) return candidate;
    }
  }
  return "";
};

const normalizeHazardFromText = (text) => {
  const upper = String(text || "").toLocaleUpperCase("tr-TR");
  if (upper.includes("ÇOK TEHLİKELİ") || upper.includes("COK TEHLIKELI")) {
    return "Çok Tehlikeli";
  }
  if (upper.includes("AZ TEHLİKELİ") || upper.includes("AZ TEHLIKELI")) {
    return "Az Tehlikeli";
  }
  if (upper.includes("TEHLİKELİ") || upper.includes("TEHLIKELI")) {
    return "Tehlikeli";
  }
  return "";
};

const parseFirmaFromOcrText = (text) => {
  const lines = getOcrLines(text);
  const all = lines.join("\n");
  const sgkMatch =
    all.match(/\b\d{20,30}\b/) ||
    all.replace(/\s+/g, "").match(/\d{20,30}/);
  const dateMatch =
    all.match(/\b\d{1,2}[./-]\d{1,2}[./-]\d{4}\b/) ||
    all.match(/\b\d{4}-\d{2}-\d{2}\b/);

  let firmaAdi = valueNearLabel(lines, [
    "Hizmet Alan İşyeri Unvanı",
    "Hizmet Alan Isyeri Unvani",
    "İşyeri Unvanı",
    "Isyeri Unvani",
    "Unvanı",
  ]);
  let adres = valueNearLabel(lines, [
    "Hizmet Alan İşyeri Adresi",
    "Hizmet Alan Isyeri Adresi",
    "İşyeri Adresi",
    "Isyeri Adresi",
    "Adresi",
  ]);
  const hazardText =
    valueNearLabel(lines, [
      "Güncel Tehlike Sınıfı",
      "Guncel Tehlike Sinifi",
      "Tehlike Sınıfı",
      "Tehlike Sinifi",
    ]) || all;
  const dateText =
    valueNearLabel(lines, [
      "Sözleşme Onay Tarihi",
      "Sozlesme Onay Tarihi",
      "Sözleşme Başlangıç Tarihi",
      "Sozlesme Baslangic Tarihi",
    ]) || dateMatch?.[0] || "";

  const tehlike = normalizeHazardFromText(hazardText);
  const hazirlama = toInputDate(dateText);
  const sgk = digitsOnly(sgkMatch?.[0] || "");

  if (sgk && (!firmaAdi || !adres)) {
    const sgkLineIndex = lines.findIndex((line) => digitsOnly(line).includes(sgk.slice(0, 14)));
    const nearby = lines.slice(Math.max(0, sgkLineIndex - 14), Math.min(lines.length, sgkLineIndex + 18));
    const companyKeywords = /(LİMİTED|LIMITED|ANONİM|ANONIM|ŞİRKET|SIRKET|TİCARET|TICARET|SANAYİ|SANAYI|LTD|A\.Ş|AŞ|POLİKLİNİK|POLIKLINIK|MERKEZ|MERKEZİ|MERKEZI|HİZMET|HIZMET)/i;
    const addressKeywords = /(MAH|MAHALLE|CAD|CADDE|SOK|SOKAK|BULVAR|NO[:\s]|KAT|DAİRE|DAIRE|ANKARA|İSTANBUL|ISTANBUL|İZMİR|IZMIR|ADRES)/i;
    const noiseKeywords = /(HİZMET ALAN|HIZMET ALAN|İŞYERİ|ISYERI|SGK|DETS|TEHLİKE|TEHLIKE|SÖZLEŞME|SOZLESME|TARİH|TARIH|ÇALIŞAN|CALISAN|SAYISI)/i;

    if (!firmaAdi) {
      const companyLine =
        nearby.find((line) => companyKeywords.test(line) && !noiseKeywords.test(line)) ||
        nearby.find((line) => {
          const clean = line.replace(/[0-9/.,:-]/g, "").trim();
          return clean.length >= 8 && clean === clean.toLocaleUpperCase("tr-TR") && !noiseKeywords.test(line);
        });
      firmaAdi = companyLine || "";
    }

    if (!adres) {
      const addressLine = nearby.find((line) => addressKeywords.test(line) && !noiseKeywords.test(line));
      adres = addressLine || "";
    }
  }

  return {
    firmaAdi,
    sgkSicilNo: sgk,
    sgkNo: sgk,
    adres,
    tehlike,
    hazirlama,
    gecerlilik: hazirlama && tehlike ? computeValidity(hazirlama, tehlike) : "",
  };
};

const readPdfWithOcr = async (file, onProgress) => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const worker = await createWorker("tur+eng");
  const pageLimit = Math.min(pdf.numPages || 1, 2);
  const texts = [];

  try {
    for (let pageNo = 1; pageNo <= pageLimit; pageNo += 1) {
      onProgress?.(`PDF sayfası okunuyor (${pageNo}/${pageLimit})...`);
      const page = await pdf.getPage(pageNo);
      const viewport = page.getViewport({ scale: 2.2 });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d", { willReadFrequently: true });
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvasContext: context, viewport }).promise;

      onProgress?.(`OCR yapılıyor (${pageNo}/${pageLimit})...`);
      const result = await worker.recognize(canvas);
      texts.push(result?.data?.text || "");
    }
  } finally {
    await worker.terminate();
  }

  return parseFirmaFromOcrText(texts.join("\n"));
};

// Geçerlilik / durum yardımcıları
const diffDaysFromToday = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);

  const diffMs = d.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
};

const getStatusFromGecerlilik = (gecerlilik) => {
  const diff = diffDaysFromToday(gecerlilik);

  if (diff === null) {
    return {
      label: "Tarih Yok",
      color: "bg-slate-100 text-slate-600 border border-slate-200",
    };
  }

  if (diff < 0) {
    return {
      label: "Süresi Doldu",
      color: "bg-slate-100 text-slate-500 border border-slate-200",
    };
  }

  if (diff <= 30) {
    return {
      label: "Kritik",
      color: "bg-rose-50 text-rose-700 border border-rose-200",
    };
  }

  if (diff <= 180) {
    return {
      label: "Yaklaşıyor",
      color: "bg-amber-50 text-amber-700 border border-amber-200",
    };
  }

  return {
    label: "Güncel",
    color: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  };
};

// =========================
// Görsel sabitler
// =========================
const brand = {
  primary: "#0a2b45",
  ring: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#0a2b45]",
};

const btn = {
   base: `inline-flex items-center justify-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-[10px] sm:text-xs whitespace-nowrap font-medium transition shadow-sm disabled:opacity-60 disabled:cursor-not-allowed ${brand.ring}`,
  primary: "bg-[#2563eb] text-white hover:bg-[#1d4ed8]",
  ghost: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50",
  success: "bg-[#16a34a] text-white hover:bg-[#15803d]",
  danger: "bg-[#dc2626] text-white hover:bg-[#b91c1c]",
};

const inputClass = `w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs shadow-sm placeholder:text-slate-400 focus:border-[#0a2b45] ${brand.ring}`;
const selectClass = inputClass;
const dateInputClass = `${inputClass} min-w-0 h-9 appearance-none`;

const badgeHazard = (t) => {
  if (t === "Az Tehlikeli")
    return "bg-emerald-50 text-emerald-700 border border-emerald-200";
  if (t === "Tehlikeli")
    return "bg-amber-50 text-amber-700 border border-amber-200";
  return "bg-rose-50 text-rose-700 border border-rose-200";
};

export default function Firmalar() {
  // =========================
  // Kullanıcı türünü algıla (ticari/bireysel ayrımı NET)
  // =========================
  const ticariUserLS = safeJson(localStorage.getItem("ticari_user"));
  const bireyselUserLS = safeJson(localStorage.getItem("bireysel_user"));
  const userLS = safeJson(localStorage.getItem("user")); // genelde login sonrası burada olur

  const role = (userLS?.role || "").toString().toLowerCase().trim();

  // ticari_user: ASLA silme yok
  const isTicariUser = role === "ticari_user" || !!ticariUserLS;

  // bireysel uzman: tam yetkili (silme dahil)
  const isBireysel = role === "bireysel" || !!bireyselUserLS;

  // senin istediğin: ticari kullanıcıda silme kapalı; bireyselde dokunmuyoruz => silme açık
  const canDelete = !isTicariUser;

  // =========================
  // Context (Mongo kaynağı)
  // =========================
  const { firmalar, setFirmalar, selectedFirm, setSelectedFirm, fetchFirmalar } =
    useFirmalar();

  // =========================
  // ConfirmModal (alert/confirm yerine)
  // =========================
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmData, setConfirmData] = useState({
    title: "",
    message: "",
    variant: "info", // info | warning | danger
    confirmText: "Tamam",
    cancelText: null,
    onConfirm: null,
    onCancel: null,
  });

  // ✅ Bilgilendirme: iptal butonu yok => soldaki boş kare yok
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

  // ✅ Uyarı/Onay
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

  // =========================
  // State (UI aynı)
  // =========================
  const [q, setQ] = useState("");
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const emptyForm = {
    id: null, // Mongo _id burada tutulacak
    firmaAdi: "",
    sgkSicilNo: "",
    adres: "",
    nace: "",
    faaliyet: "",
    tehlike: "Az Tehlikeli",
    hazirlama: "",
    gecerlilik: "",
  };

  const [form, setForm] = useState(emptyForm);
  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfStatus, setPdfStatus] = useState("");
  const pdfInputRef = useRef(null);
  const bulkInputRef = useRef(null);
  const [detail, setDetail] = useState(null);
  const [userEdited, setUserEdited] = useState({
    faaliyet: false,
    tehlike: false,
  });

  // =========================
  // İlk girişte firmaları çek
  // =========================
  useEffect(() => {
    fetchFirmalar?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // =========================
  // Filtreleme (aynı)
  // =========================
  const safeFirmalar = Array.isArray(firmalar) ? firmalar : [];

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();

    // Mongo’dan gelen firmaları “eski UI şekli” gibi kullanacağız
    // id alanına _id’yi koyup eski kodu bozmuyoruz
    let arr = safeFirmalar.map((f) => ({
      ...f,
      id: f.id || f._id,
    }));

    if (text) {
      arr = arr.filter((f) =>
        [
          f.firmaAdi,
          f.sgkSicilNo,
          f.sgkNo, // ✅ admin tarafı sgkNo yazarsa da aransın
          f.nace,
          f.faaliyet,
          f.adres,
        ]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(text))
      );
    }

    arr.sort((a, b) =>
      (a.firmaAdi || "").localeCompare(b.firmaAdi || "", "tr", {
        sensitivity: "base",
      })
    );
    if (!sortAsc) arr.reverse();
    return arr;
  }, [safeFirmalar, q, sortAsc]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pageCount);
  const paged = filtered.slice((current - 1) * pageSize, current * pageSize);

  // aktif firma (localStorage yerine context)
  const activeFirmId = selectedFirm?.id || selectedFirm?._id || null;

  // =========================
  // CRUD (Mongo)
  // =========================
  const openAdd = () => {
    setForm(emptyForm);
    setUserEdited({ faaliyet: false, tehlike: false });
    setOpen(true);
  };

  const openEdit = async (firma) => {
    // 1) Önce eldeki veriyle modalı aç (UI gecikmesin)
    const id = firma?.id || firma?._id || null;

    const rawHaz =
      firma?.hazirlama || firma?.hazirlamaTarihi || firma?.hazirlamaTarih || "";
    const rawGec =
      firma?.gecerlilik ||
      firma?.gecerlilikTarihi ||
      firma?.gecerlilikTarih ||
      "";

    const baseForm = {
      id: id,
      firmaAdi: firma?.firmaAdi || "",
      sgkSicilNo: firma?.sgkSicilNo || firma?.sgkNo || "",
      adres: firma?.adres || "",
      nace:
        firma?.nace ||
        firma?.naceKodu ||
        firma?.naceKod ||
        firma?.naceCode ||
        "",
      faaliyet:
        firma?.faaliyet ||
        firma?.faaliyetAlani ||
        firma?.faaliyetAdi ||
        firma?.anaFaaliyet ||
        firma?.activity ||
        "",
      tehlike: firma?.tehlike || "Az Tehlikeli",
      // ✅ type=date uyumluluğu
      hazirlama: toInputDate(rawHaz),
      gecerlilik: toInputDate(rawGec),
    };

    setForm(baseForm);
    setUserEdited({ faaliyet: false, tehlike: false });
    setOpen(true);

    // 2) Eğer nace/faaliyet boşsa backend'den detay çek
    const needDetail =
      !String(baseForm.nace || "").trim() ||
      !String(baseForm.faaliyet || "").trim() ||
      !String(baseForm.hazirlama || "").trim() || // ✅ tarih boşsa da detay çek
      !String(baseForm.gecerlilik || "").trim(); // ✅

    if (!id || !needDetail) return;

    const token = getToken();
    if (!token) return;

    try {
      const res = await axios.get(`${API_URL}/firma/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const d = res.data || {};

      const detailNace = d.nace || d.naceKodu || d.naceKod || d.naceCode || "";
      const detailFaaliyet =
        d.faaliyet ||
        d.faaliyetAlani ||
        d.faaliyetAdi ||
        d.anaFaaliyet ||
        d.activity ||
        "";

      const detailHaz = toInputDate(
        d.hazirlama || d.hazirlamaTarihi || d.hazirlamaTarih
      );
      const detailGec = toInputDate(
        d.gecerlilik || d.gecerlilikTarihi || d.gecerlilikTarih
      );

      // 3) Modal açıkken formu detayla güncelle
      setForm((prev) => {
        if ((prev?.id || null) !== id) return prev;
        return {
          ...prev,
          nace: String(prev.nace || "").trim() ? prev.nace : detailNace,
          faaliyet: String(prev.faaliyet || "").trim()
            ? prev.faaliyet
            : detailFaaliyet,
          tehlike: prev.tehlike || d.tehlike || d.tehlikeSinifi || prev.tehlike,
          // ✅ tarihleri sadece boşsa doldur
          hazirlama: String(prev.hazirlama || "").trim()
            ? prev.hazirlama
            : detailHaz,
          gecerlilik: String(prev.gecerlilik || "").trim()
            ? prev.gecerlilik
            : detailGec,
        };
      });

      // 4) Listeyi de güncelle (bir daha edit boş açılmasın)
      if (typeof setFirmalar === "function") {
        setFirmalar((prev) => {
          const arr = Array.isArray(prev) ? prev : [];
          return arr.map((x) => {
            const xid = x?.id || x?._id;
            if (xid !== id) return x;
            return { ...x, ...d, id: x?.id || x?._id || id };
          });
        });
      }

      // 5) Seçili firmayı da güncelle (prosedür/risk ekranları için)
      const selId = selectedFirm?.id || selectedFirm?._id || null;
      if (selId && selId === id && typeof setSelectedFirm === "function") {
        await setSelectedFirm({ ...selectedFirm, ...d, id });
      }
    } catch (err) {
      console.warn(
        "Firma detay çekilemedi (edit):",
        err?.response?.data || err?.message || err
      );
    }
  };

  const saveForm = async (e) => {
    e.preventDefault();

    if (!form.firmaAdi || !form.sgkSicilNo) {
      openInfo("Bilgilendirme", "Lütfen Firma Adı ve SGK Sicil No giriniz!");
      return;
    }

    const normalizedSgk = digitsOnly(form.sgkSicilNo);
    const duplicate = safeFirmalar.some((f) => {
      const fid = f?.id || f?._id || null;
      return fid !== form.id && digitsOnly(f?.sgkSicilNo || f?.sgkNo) === normalizedSgk;
    });
    if (duplicate) {
      openInfo("Bilgilendirme", "Bu SGK Sicil Numarasına ait firma sistemde zaten kayıtlıdır.");
      return;
    }

    const token = getToken();
    if (!token) {
      openInfo("Bilgilendirme", "Oturum bulunamadı. Lütfen tekrar giriş yapınız.");
      return;
    }

    const payload = {
      firmaAdi: upTR(form.firmaAdi),
      // ✅ backend sgkNo bekliyorsa da sıkıntı olmasın diye ikisini de yolluyoruz
      sgkSicilNo: digitsOnly(form.sgkSicilNo),
      sgkNo: digitsOnly(form.sgkSicilNo),
      adres: upTR(form.adres),
      nace: digitsOnly(form.nace),
      faaliyet: upTR(form.faaliyet),
      tehlike: form.tehlike,
      // ✅ zaten yyyy-mm-dd olarak gider
      hazirlama: form.hazirlama || "",
      gecerlilik: form.gecerlilik || "",
    };

    try {
      let saved;

      if (form.id) {
        const res = await axios.put(`${API_URL}/firma/${form.id}`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        saved = res.data;
      } else {
        const res = await axios.post(`${API_URL}/firma`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        saved = res.data;
      }

      await fetchFirmalar?.();
      setSelectedFirm?.(saved);

      setOpen(false);
      openInfo("Bilgilendirme", "Firma kaydedildi ✅");
    } catch (err) {
      console.error("Firma kaydetme hatası:", err);
      openInfo(
        "Hata",
        "Firma kaydedilirken hata oluştu. (Backend/Yetki/Endpoint kontrol)"
      );
    }
  };

  const applyParsedFirma = (parsed = {}) => {
    const sgk = digitsOnly(parsed.sgkSicilNo || parsed.sgkNo || "");
    const nace = parsed.nace || inferNaceFromSgk(sgk);
    const tehlike = parsed.tehlike || form.tehlike || "Az Tehlikeli";
    const hazirlama = toInputDate(parsed.hazirlama || parsed.sozlesmeOnayTarihi);
    setForm((prev) => ({
      ...prev,
      firmaAdi: upTR(parsed.firmaAdi || prev.firmaAdi),
      sgkSicilNo: sgk || prev.sgkSicilNo,
      adres: upTR(parsed.adres || prev.adres),
      nace: nace || prev.nace,
      faaliyet: upTR(parsed.faaliyet || prev.faaliyet),
      tehlike,
      hazirlama: hazirlama || prev.hazirlama,
      gecerlilik:
        toInputDate(parsed.gecerlilik) ||
        computeValidity(hazirlama || prev.hazirlama, tehlike),
    }));
    setUserEdited({ faaliyet: false, tehlike: false });
  };

  const handlePdfSelect = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const token = getToken();
    if (!token) {
      openInfo("Bilgilendirme", "Oturum bulunamadı. Lütfen tekrar giriş yapınız.");
      return;
    }

    try {
      setPdfLoading(true);
      setPdfStatus("PDF metni kontrol ediliyor...");
      const fd = new FormData();
      fd.append("file", file);
      const res = await axios.post(`${API_URL}/firma/parse-iskatip-pdf`, fd, {
        headers: { Authorization: `Bearer ${token}` },
      });
      let parsed = res.data?.firma || {};
      if (!parsed.firmaAdi && !parsed.sgkSicilNo && !parsed.sgkNo) {
        parsed = await readPdfWithOcr(file, setPdfStatus);
      }

      if (!parsed.firmaAdi && !parsed.sgkSicilNo && !parsed.sgkNo) {
        openInfo("Bilgilendirme", "PDF okunamadı. Dosya çok düşük kaliteliyse Excel aktarımı kullanın.");
        return;
      }

      const parsedSgk = digitsOnly(parsed.sgkSicilNo || parsed.sgkNo);
      const duplicate = safeFirmalar.some(
        (f) => digitsOnly(f?.sgkSicilNo || f?.sgkNo) === parsedSgk
      );
      if (parsedSgk && duplicate) {
        openInfo("Bilgilendirme", "Bu SGK Sicil Numarasına ait firma sistemde zaten kayıtlıdır.");
        return;
      }
      applyParsedFirma(parsed);
      openInfo("Bilgilendirme", "PDF okundu ve firma formu dolduruldu.");
    } catch (err) {
      if (err?.response?.status === 422) {
        try {
          const parsed = await readPdfWithOcr(file, setPdfStatus);
          if (parsed.firmaAdi || parsed.sgkSicilNo || parsed.sgkNo) {
            const parsedSgk = digitsOnly(parsed.sgkSicilNo || parsed.sgkNo);
            const duplicate = safeFirmalar.some(
              (f) => digitsOnly(f?.sgkSicilNo || f?.sgkNo) === parsedSgk
            );
            if (parsedSgk && duplicate) {
              openInfo("Bilgilendirme", "Bu SGK Sicil Numarasına ait firma sistemde zaten kayıtlıdır.");
              return;
            }
            applyParsedFirma(parsed);
            openInfo("Bilgilendirme", "PDF OCR ile okundu ve firma formu dolduruldu.");
            return;
          }
        } catch (ocrErr) {
          console.error("PDF OCR hatası:", ocrErr);
        }
      }
      openInfo(
        "Hata",
        err?.response?.data?.message ||
          "PDF okunamadı. Dosyanın İSG-KATİP hizmet sözleşmesi PDF'i olduğundan emin olun."
      );
    } finally {
      setPdfLoading(false);
      setPdfStatus("");
    }
  };

  const downloadBulkTemplate = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Firmalar");
    ws.addRow([
      "Firma Adı",
      "SGK Sicil No",
      "Adres",
      "Tehlike Sınıfı",
      "Sözleşme Onay Tarihi",
    ]);
    ws.addRow([
      "ÖRNEK FİRMA LTD. ŞTİ.",
      "12345678901234567890123456",
      "Örnek adres",
      "Tehlikeli",
      "01.06.2026",
    ]);
    ws.columns.forEach((col) => {
      col.width = 24;
    });
    const buffer = await wb.xlsx.writeBuffer();
    downloadBlob(
      new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      "isgpanel_toplu_firma_sablonu.xlsx"
    );
  };

  const handleBulkExcelSelect = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const token = getToken();
    if (!token) {
      openInfo("Bilgilendirme", "Oturum bulunamadı. Lütfen tekrar giriş yapınız.");
      return;
    }

    try {
      setBulkLoading(true);
      setBulkResult(null);
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const ws = wb.worksheets[0];
      if (!ws) throw new Error("Excel sayfası bulunamadı");

      const headerMap = getHeaderMap(ws);
      const rows = [];
      ws.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const firmaAdi = getCellByHeader(row, headerMap, ["Firma Adı", "Hizmet Alan İşyeri Unvanı", "Unvan"], 1);
        const sgkSicilNo = digitsOnly(
          getCellByHeader(row, headerMap, ["SGK Sicil No", "Hizmet Alan İşyeri SGK/DETSİS No", "SGK DETSİS No"], 2)
        );
        const il = getCellByHeader(row, headerMap, ["İl", "Hizmet Alan İşyeri İli"], null);
        const adres = getCellByHeader(row, headerMap, ["Adres", "Hizmet Alan İşyeri Adresi"], 3);
        const calisanSayisi = getCellByHeader(row, headerMap, ["Çalışan Sayısı", "Güncel Çalışan Sayısı", "Hizmet Alan İşyeri Çalışan Sayısı"], null);
        const tehlike = getCellByHeader(
          row,
          headerMap,
          ["Tehlike Sınıfı", "Güncel Tehlike Sınıfı", "Hizmet Alan İşyeri Tehlike Sınıfı"],
          4
        );
        const sozlesmeOnayTarihi = getCellByHeader(
          row,
          headerMap,
          ["Sözleşme Onay Tarihi", "Sözleşme Başlangıç Tarihi", "Hazırlama Tarihi"],
          5
        );
        if (![firmaAdi, sgkSicilNo, adres, tehlike, sozlesmeOnayTarihi].some(Boolean)) return;

        const nace = inferNaceFromSgk(sgkSicilNo);
        const auto = autoFromNace(nace);
        rows.push({
          rowNumber,
          firmaAdi,
          sgkSicilNo,
          sgkNo: sgkSicilNo,
          il,
          adres,
          calisanSayisi,
          tehlike: tehlike || auto?.tehlike || "",
          hazirlama: sozlesmeOnayTarihi,
          nace,
          faaliyet: auto?.faaliyet || "",
        });
      });

      if (!rows.length) {
        openInfo("Bilgilendirme", "Excel içinde eklenecek firma satırı bulunamadı.");
        return;
      }

      const res = await axios.post(
        `${API_URL}/firma/bulk`,
        { rows },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setBulkResult(res.data || null);
      await fetchFirmalar?.();
    } catch (err) {
      openInfo(
        "Hata",
        err?.response?.data?.message || err?.message || "Toplu firma ekleme başarısız oldu."
      );
    } finally {
      setBulkLoading(false);
    }
  };

  const removeFirm = async (id) => {
    // ✅ ticari_user kesinlikle silemez
    if (!canDelete) {
      openInfo("Bilgilendirme", "Ticari kullanıcı firma silemez.");
      return;
    }

    openConfirm({
      title: "Uyarı",
      message: "Bu firmayı silmek istiyor musunuz?",
      confirmText: "Sil",
      cancelText: "İptal",
      variant: "warning",
      onConfirm: async () => {
        const token = getToken();
        if (!token) {
          openInfo("Bilgilendirme", "Oturum bulunamadı. Lütfen tekrar giriş yapınız.");
          return;
        }

        try {
          await axios.delete(`${API_URL}/firma/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          await fetchFirmalar?.();

          if ((selectedFirm?.id || selectedFirm?._id) === id) {
            setSelectedFirm?.(null);
          }

          openInfo("Bilgilendirme", "Firma silindi ✅");
        } catch (err) {
          console.error("Firma silme hatası:", err);
          openInfo(
            "Hata",
            "Firma silinirken hata oluştu. (Backend/Yetki/Endpoint kontrol)"
          );
        }
      },
    });
  };

  // =========================
  // NACE Otomatik Doldurma (aynı)
  // =========================
  const naceIndex = useMemo(() => {
    const m = new Map();
    try {
      (naceData || []).forEach((row) => {
        const key = digitsOnly(row.kod);
        if (!key) return;
        m.set(key, {
          faaliyet: row.faaliyet,
          tehlike: toTitleHazard(row.tehlikeSinifi),
        });
      });
    } catch {}
    return m;
  }, []);

  const autoFromNace = (nace) => {
    const n6 = digitsOnly(nace).slice(0, 6);
    if (!n6) return null;
    return (
      naceIndex.get(n6) ||
      naceIndex.get(n6.slice(0, 4)) ||
      naceIndex.get(n6.slice(0, 2)) ||
      null
    );
  };

  useEffect(() => {
    const auto = autoFromNace(form.nace);
    if (!auto) return;

    setForm((prev) => {
      const nextTehlike = userEdited.tehlike ? prev.tehlike : auto.tehlike;
      return {
        ...prev,
        faaliyet: userEdited.faaliyet ? prev.faaliyet : upTR(auto.faaliyet),
        tehlike: nextTehlike,
        gecerlilik: computeValidity(prev.hazirlama, nextTehlike),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.nace]);

  // =========================
  // UI
  // =========================
  return (
    <div className="p-3 sm:p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        {/* Başlık */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div>
              <h2 className="text-xl font-bold text-[#042f4b] mb-4">
                Firmalarım
              </h2>
              <p className="text-slate-500 text-xs">
                Kayıtlı firmaları yönetin, yeni firma ekleyin.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setBulkResult(null);
                setBulkOpen(true);
              }}
              className={`${btn.base} ${btn.ghost}`}
            >
              <HiUpload className="-ml-0.5 h-3 w-3" />
              Toplu Firma Ekle
            </button>
            <button onClick={openAdd} className={`${btn.base} ${btn.primary}`}>
              <HiPlus className="-ml-0.5 h-3 w-3" />
              Yeni Firma
            </button>
          </div>
        </div>

        {/* Araç Çubuğu */}
        <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center justify-between gap-3">
          <div className="relative">
            <HiSearch className="absolute left-3 top-2 text-slate-400 h-3.5 w-3.5" />
            <input
              value={q}
              onChange={(e) => setQ(upTR(e.target.value))}
              placeholder="Firma ara..."
              className={`${inputClass} pl-8 w-full sm:w-64 uppercase tracking-wide`}
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSortAsc((s) => !s)}
              className={`${btn.base} ${btn.ghost}`}
              title="A-Z / Z-A"
            >
              <HiSortAscending
                className={`h-3.5 w-3.5 ${sortAsc ? "" : "rotate-180"} transition`}
              />
              {sortAsc ? "A-Z" : "Z-A"}
            </button>

            <div className="hidden md:flex items-center gap-2 text-xs text-slate-500">
              <span>Göster:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className={`${selectClass} h-8 w-20`}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tablo */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow">
          <div className="max-h-[60vh] overflow-auto">
  <table className="min-w-[800px] w-full text-xs">
              <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur">
                <tr className="text-slate-600">
                  <th className="py-2 px-3 text-left font-semibold border-b">#</th>
                  <th className="py-2 px-3 text-left font-semibold border-b">Firma Adı</th>
                  <th className="py-2 px-3 text-left font-semibold border-b">SGK Sicil No</th>
                  <th className="py-2 px-3 text-left font-semibold border-b">Tehlike</th>
                  <th className="py-2 px-3 text-left font-semibold border-b">Hazırlama</th>
                  <th className="py-2 px-3 text-left font-semibold border-b">Geçerlilik</th>
                  <th className="py-2 px-3 text-left font-semibold border-b">İşlemler</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 text-slate-700">
                {paged.map((f, idx) => {
                  const status = getStatusFromGecerlilik(f.gecerlilik);
                  const isActive = (f.id || f._id) === activeFirmId;

                  // ✅ SGK alanı iki isimden gelebilir
                  const sgkVal = f.sgkSicilNo || f.sgkNo || "-";

                  return (
                    <tr
                      key={f.id || f._id}
                      className={`hover:bg-slate-50 ${
                        isActive ? "bg-[#0a2b45]/5 ring-1 ring-[#0a2b45]/20" : ""
                      }`}
                    >
                      <td className="py-1.5 px-3 align-middle">
                        {(current - 1) * pageSize + idx + 1}
                      </td>

                      <td className="py-1.5 px-3 font-medium align-middle max-w-[160px] sm:max-w-none truncate">
                        <div className="flex items-center gap-2">
                          <span>{f.firmaAdi}</span>
                          {isActive && (
                            <span className="inline-flex items-center rounded-full bg-[#0a2b45] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
                              Aktif
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-1.5 px-3 tabular-nums align-middle">{sgkVal}</td>

                      <td className="py-1.5 px-3 align-middle">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${badgeHazard(
                            f.tehlike
                          )}`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current/60" />
                          {f.tehlike}
                        </span>
                      </td>

                      <td className="py-1.5 px-3 align-middle">{formatTR(f.hazirlama)}</td>

                      <td className="py-1.5 px-3 align-middle">
                        <div className="flex items-center gap-2">
                          <span>{formatTR(f.gecerlilik)}</span>
                          {status && (
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${status.color}`}
                            >
                              {status.label}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* İşlemler */}
                      <td className="py-1.5 px-3 align-middle">
                        <div className="flex flex-wrap sm:flex-nowrap gap-1">
                          {/* DETAY */}
                          <button
                            onClick={() => setDetail(f)}
                            className={`${btn.base} ${btn.ghost}`}
                            title="Detay"
                          >
                            <HiEye className="h-3.5 w-3.5" />
                          </button>

                          {/* DÜZENLE */}
                          <button
                            onClick={() => openEdit(f)}
                            className={`${btn.base} ${btn.ghost}`}
                            title="Düzenle"
                          >
                            <HiPencil className="h-3.5 w-3.5" />
                          </button>

                          {/* SİLME — sadece ticari_user kapalı */}
                          {!canDelete ? (
                            <button
                              onClick={() => openInfo("Bilgilendirme", "Ticari kullanıcı firma silemez.")}
                              className={`${btn.base} bg-gray-200 text-gray-400 cursor-not-allowed`}
                              title="Silemez"
                            >
                              <HiTrash className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => removeFirm(f.id || f._id)}
                              className={`${btn.base} ${btn.danger}`}
                              title="Sil"
                            >
                              <HiTrash className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {paged.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-500 text-xs">
                      Henüz firma yok.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* SAYFALAMA */}
          <div className="flex items-center justify-between px-3 py-2 border-t bg-slate-50">
            <div className="text-xs text-slate-500">
              Toplam{" "}
              <span className="font-medium text-slate-700">{filtered.length}</span>{" "}
              kayıt
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={current <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className={`${btn.base} ${btn.ghost} disabled:opacity-40`}
              >
                {"<"}
              </button>
              <span className="text-xs text-slate-600">
                {current} / {pageCount}
              </span>
              <button
                disabled={current >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                className={`${btn.base} ${btn.ghost} disabled:opacity-40`}
              >
                {">"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Firma Ekle / Düzenle */}
      {open && (
        <div className="fixed inset-0 z-[99999] grid place-items-center p-3">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-[99999] w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-2 bg-gradient-to-r from-[#0a2b45] to-[#0a2b45]/90 text-white">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                <h3 className="text-sm font-semibold tracking-tight">
                  {form.id ? "Firmayı Düzenle" : "Yeni Firma Kaydı"}
                </h3>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 hover:bg-white/10"
              >
                <HiX className="h-4 w-4" />
              </button>
            </div>

            <div className="border-b bg-slate-50 px-4 py-3">
              <input
                ref={pdfInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={handlePdfSelect}
              />
              <button
                type="button"
                onClick={() => pdfInputRef.current?.click()}
                disabled={pdfLoading}
                className={`${btn.base} ${btn.ghost} bg-white`}
              >
                <HiDocumentText className="h-3.5 w-3.5" />
                {pdfLoading ? pdfStatus || "PDF okunuyor..." : "İSG-KATİP PDF'den Otomatik Doldur"}
              </button>
            </div>

            <form onSubmit={saveForm} className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Firma Adı
                  </label>
                  <input
                    className={inputClass}
                    placeholder="FİRMA ADI"
                    value={form.firmaAdi}
                    onChange={(e) =>
                      setForm({ ...form, firmaAdi: upTR(e.target.value) })
                    }
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    SGK Sicil No
                  </label>
                  <input
                    className={inputClass}
                    placeholder="SGK SİCİL NO"
                    value={form.sgkSicilNo}
                    onChange={(e) => {
                      const only = digitsOnly(e.target.value);
                      let nace = form.nace;
                      if (only.length >= 7) nace = only.slice(1, 7);
                      setForm({ ...form, sgkSicilNo: only, nace });
                    }}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Adres
                  </label>
                  <input
                    className={inputClass}
                    placeholder="ADRES"
                    value={form.adres}
                    onChange={(e) =>
                      setForm({ ...form, adres: upTR(e.target.value) })
                    }
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    NACE
                  </label>
                  <input
                    className={inputClass}
                    placeholder="OTOMATİK"
                    value={form.nace}
                    onChange={(e) => setForm({ ...form, nace: e.target.value })}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Faaliyet
                  </label>
                  <input
                    className={inputClass}
                    placeholder="OTOMATİK / MANUEL"
                    value={form.faaliyet}
                    onChange={(e) => {
                      setUserEdited((u) => ({ ...u, faaliyet: true }));
                      setForm({ ...form, faaliyet: upTR(e.target.value) });
                    }}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Tehlike Sınıfı
                  </label>
                  <select
                    className={selectClass}
                    value={form.tehlike}
                    onChange={(e) => {
                      setUserEdited((u) => ({ ...u, tehlike: true }));
                      const val = e.target.value;
                      const g = computeValidity(form.hazirlama, val);
                      setForm({ ...form, tehlike: val, gecerlilik: g });
                    }}
                  >
                    <option>Az Tehlikeli</option>
                    <option>Tehlikeli</option>
                    <option>Çok Tehlikeli</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Hazırlama Tarihi
                  </label>
                  <input
  type="date"
  className={dateInputClass}
  value={form.hazirlama}
  onChange={(e) => {
    const g = computeValidity(e.target.value, form.tehlike);
    setForm({
      ...form,
      hazirlama: e.target.value,
      gecerlilik: g,
    });
  }}
/>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Geçerlilik Tarihi
                  </label>
                  <input
  type="date"
  className={`${dateInputClass} bg-slate-50`}
  value={form.gecerlilik}
  readOnly
/>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2 border-t pt-3 pb-2 sm:pb-0">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className={`${btn.base} ${btn.ghost}`}
                >
                  İptal
                </button>
                <button type="submit" className={`${btn.base} ${btn.success}`}>
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Toplu Firma Ekle */}
      {bulkOpen && (
        <div className="fixed inset-0 z-[99999] grid place-items-center p-3">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setBulkOpen(false)}
          />
          <div className="relative z-[99999] w-full max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-2 bg-gradient-to-r from-[#0a2b45] to-[#0a2b45]/90 text-white">
              <div className="flex items-center gap-2">
                <HiUpload className="h-4 w-4" />
                <h3 className="text-sm font-semibold tracking-tight">
                  Toplu Firma Ekle
                </h3>
              </div>
              <button
                onClick={() => setBulkOpen(false)}
                className="rounded-lg p-1.5 hover:bg-white/10"
              >
                <HiX className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 p-4 text-xs text-slate-700">
              <input
                ref={bulkInputRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={handleBulkExcelSelect}
              />

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                Excel'in ilk satırı başlık satırıdır. Kayıtlar 2. satırdan itibaren okunur.
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={downloadBulkTemplate}
                  className={`${btn.base} ${btn.ghost}`}
                >
                  <HiDownload className="h-3.5 w-3.5" />
                  Örnek Excel Şablonu İndir
                </button>
                <button
                  type="button"
                  onClick={() => bulkInputRef.current?.click()}
                  disabled={bulkLoading}
                  className={`${btn.base} ${btn.primary}`}
                >
                  <HiUpload className="h-3.5 w-3.5" />
                  {bulkLoading ? "Yükleniyor..." : "Excel Seç ve Yükle"}
                </button>
              </div>

              {bulkResult && (
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="mb-2 font-semibold text-slate-800">Yükleme Özeti</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>Toplam Satır: <b>{bulkResult.totalRows || 0}</b></div>
                    <div>Başarıyla Eklenen: <b>{bulkResult.insertedCount || 0}</b></div>
                    <div>Mükerrer Kayıt: <b>{bulkResult.duplicateCount || 0}</b></div>
                    <div>Hatalı Satır: <b>{bulkResult.invalidCount || 0}</b></div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end border-t p-3">
              <button
                type="button"
                onClick={() => setBulkOpen(false)}
                className={`${btn.base} ${btn.ghost}`}
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detay Modal */}
      {detail && (
        <div className="fixed inset-0 z-[99999] grid place-items-center p-3">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setDetail(null)}
          />
          <div className="relative w-full max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-2 bg-slate-50">
              <h3 className="text-sm font-semibold tracking-tight text-slate-800">
                Firma Detayları
              </h3>
              <button
                onClick={() => setDetail(null)}
                className="rounded-lg p-1.5 hover:bg-slate-100"
              >
                <HiX className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-700">
              <div>
                <span className="text-slate-500">Firma Adı:</span>{" "}
                <span className="font-medium">{detail.firmaAdi}</span>
              </div>

              <div>
                <span className="text-slate-500">SGK Sicil No:</span>{" "}
                <span className="font-medium tabular-nums">
                  {detail.sgkSicilNo || detail.sgkNo || "-"}
                </span>
              </div>

              <div className="sm:col-span-2">
                <span className="text-slate-500">Adres:</span>{" "}
                <span className="font-medium">{detail.adres}</span>
              </div>

              <div>
                <span className="text-slate-500">NACE:</span>{" "}
                <span className="font-medium">{detail.nace}</span>
              </div>

              <div>
                <span className="text-slate-500">Faaliyet:</span>{" "}
                <span className="font-medium">{detail.faaliyet}</span>
              </div>

              <div>
                <span className="text-slate-500">Tehlike:</span>{" "}
                <span
                  className={`ml-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${badgeHazard(
                    detail.tehlike
                  )}`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current/60" />
                  {detail.tehlike}
                </span>
              </div>

              <div>
                <span className="text-slate-500">Hazırlama:</span>{" "}
                <span className="font-medium">{formatTR(detail.hazirlama)}</span>
              </div>

              <div>
                <span className="text-slate-500">Geçerlilik:</span>{" "}
                <span className="font-medium">{formatTR(detail.gecerlilik)}</span>
                <span
                  className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                    getStatusFromGecerlilik(detail.gecerlilik).color
                  }`}
                >
                  {getStatusFromGecerlilik(detail.gecerlilik).label}
                </span>
              </div>
            </div>

            <div className="p-3 border-t flex justify-end">
              <button
                onClick={() => setDetail(null)}
                className={`${btn.base} ${btn.ghost}`}
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ ConfirmModal (alert/confirm yerine) */}
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
    </div>
  );
}

// küçük güvenli json parse
function safeJson(v) {
  try {
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}
