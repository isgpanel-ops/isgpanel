import React, { useEffect, useMemo, useState } from "react";
import ExcelJS from "exceljs";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import { createWorker } from "tesseract.js";
import {
  HiPlus,
  HiSearch,
  HiSortAscending,
  HiUserAdd,
  HiPencilAlt,
  HiTrash,
  HiUpload,
  HiDownload,
  HiDocumentText,
  HiX,
} from "react-icons/hi";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";
import ConfirmModal from "@/components/ui/ConfirmModal";
import naceData from "@/data/naceTR.json";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const API_BASE =
  (import.meta?.env?.VITE_API_URL || "").trim().replace(/\/$/, "") ||
  "https://api.isgpanel.tr";

const upTR = (s) => (s || "").toLocaleUpperCase("tr-TR");
const digitsOnly = (s) => (s || "").replace(/\D/g, "");

const toTitleHazard = (v) => {
  const folded = foldText(v);
  if (folded.includes("cok")) return "\u00c7ok Tehlikeli";
  if (folded.includes("az")) return "Az Tehlikeli";
  return "Tehlikeli";
};

const toInputDate = (v) => {
  if (!v) return "";
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{1,2}[./-]\d{1,2}[./-]\d{4}$/.test(s)) {
    const [d, m, y] = s.split(/[./-]/);
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
};

const computeValidity = (hazirlama, tehlike) => {
  if (!hazirlama) return "";
  const t = new Date(hazirlama);
  const addYears =
    tehlike === "Az Tehlikeli" ? 6 : tehlike === "Tehlikeli" ? 4 : 2;
  t.setFullYear(t.getFullYear() + addYears);
  return t.toISOString().slice(0, 10);
};

const inferNaceFromSgk = (sgk) => {
  const only = digitsOnly(sgk);
  return only.length >= 7 ? only.slice(1, 7) : "";
};

const normalizeHazardFromText = (text) => {
  const upper = String(text || "").toLocaleUpperCase("tr-TR");
  if (upper.includes("Ã‡OK TEHLÄ°KELÄ°") || upper.includes("COK TEHLIKELI")) return "Çok Tehlikeli";
  if (upper.includes("AZ TEHLÄ°KELÄ°") || upper.includes("AZ TEHLIKELI")) return "Az Tehlikeli";
  if (upper.includes("TEHLÄ°KELÄ°") || upper.includes("TEHLIKELI")) return "Tehlikeli";
  return "";
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
    .replace(/Ã§/g, "c")
    .replace(/ÄŸ/g, "g")
    .replace(/[Ä±Ä°]/g, "i")
    .replace(/Ã¶/g, "o")
    .replace(/ÅŸ/g, "s")
    .replace(/Ã¼/g, "u")
    .replace(/[^a-z0-9]/g, "");

const getHeaderMap = (worksheet) => {
  const map = new Map();
  worksheet.getRow(1).eachCell((cell, colNumber) => {
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

const getOcrLines = (text) =>
  String(text || "")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);

const foldText = (value) =>
  String(value || "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/Ä±/g, "i")
    .replace(/ÄŸ/g, "g")
    .replace(/Ã¼/g, "u")
    .replace(/ÅŸ/g, "s")
    .replace(/Ã¶/g, "o")
    .replace(/Ã§/g, "c");

const normalizeCleanHazardFromText = (text) => {
  const folded = foldText(text);
  if (folded.includes("cok tehlikeli")) return "\u00c7ok Tehlikeli";
  if (folded.includes("az tehlikeli")) return "Az Tehlikeli";
  if (folded.includes("tehlikeli")) return "Tehlikeli";
  return "";
};

const includesAny = (text, keys) => {
  const hay = foldText(text);
  return keys.some((key) => hay.includes(foldText(key)));
};

const valueNearLabel = (lines, labels) => {
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!includesAny(line, labels)) continue;
    const afterColon = line.split(/[:ï¼š]/).slice(1).join(":").trim();
    if (afterColon && !includesAny(afterColon, labels)) return afterColon;
    for (let j = i + 1; j < Math.min(lines.length, i + 5); j += 1) {
      if (!includesAny(lines[j], labels)) return lines[j];
    }
  }
  return "";
};

const parseFirmaFromOcrText = (text) => {
  const lines = getOcrLines(text);
  const all = lines.join("\n");
  const sgkMatch = all.match(/\b\d{20,30}\b/) || all.replace(/\s+/g, "").match(/\d{20,30}/);
  const dateMatch = all.match(/\b\d{1,2}[./-]\d{1,2}[./-]\d{4}\b/) || all.match(/\b\d{4}-\d{2}-\d{2}\b/);
  const sgk = digitsOnly(sgkMatch?.[0] || "");

  let firmaAdi = valueNearLabel(lines, ["Hizmet Alan Ä°ÅŸyeri UnvanÄ±", "Hizmet Alan Isyeri Unvani", "Ä°ÅŸyeri UnvanÄ±", "UnvanÄ±"]);
  let adres = valueNearLabel(lines, ["Hizmet Alan Ä°ÅŸyeri Adresi", "Hizmet Alan Isyeri Adresi", "Ä°ÅŸyeri Adresi", "Adresi"]);
  const hazardText = valueNearLabel(lines, ["GÃ¼ncel Tehlike Sınıfı", "Guncel Tehlike Sinifi", "Tehlike Sınıfı", "Tehlike Sinifi"]) || all;
  const dateText = valueNearLabel(lines, ["SÃ¶zleÅŸme Onay Tarihi", "SÃ¶zleÅŸme BaÅŸlangÄ±Ã§ Tarihi", "Sozlesme Onay Tarihi"]) || dateMatch?.[0] || "";

  if (sgk && (!firmaAdi || !adres)) {
    const sgkLineIndex = lines.findIndex((line) => digitsOnly(line).includes(sgk.slice(0, 14)));
    const nearby = lines.slice(Math.max(0, sgkLineIndex - 14), Math.min(lines.length, sgkLineIndex + 18));
    const companyKeywords = /(LÄ°MÄ°TED|LIMITED|ANONÄ°M|ANONIM|ÅÄ°RKET|SIRKET|TÄ°CARET|TICARET|SANAYÄ°|SANAYI|LTD|A\.Å|AÅ|POLÄ°KLÄ°NÄ°K|POLIKLINIK|MERKEZ|HÄ°ZMET|HIZMET)/i;
    const addressKeywords = /(MAH|MAHALLE|CAD|CADDE|SOK|SOKAK|BULVAR|NO[:\s]|KAT|DAÄ°RE|DAIRE|ANKARA|Ä°STANBUL|ISTANBUL|Ä°ZMÄ°R|IZMIR|ADRES)/i;
    const noiseKeywords = /(HÄ°ZMET ALAN|HIZMET ALAN|Ä°ÅYERÄ°|ISYERI|SGK|DETS|TEHLÄ°KE|TEHLIKE|SÃ–ZLEÅME|SOZLESME|TARÄ°H|TARIH|Ã‡ALIÅAN|CALISAN|SAYISI)/i;
    if (!firmaAdi) {
      firmaAdi = nearby.find((line) => companyKeywords.test(line) && !noiseKeywords.test(line)) || "";
    }
    if (!adres) {
      adres = nearby.find((line) => addressKeywords.test(line) && !noiseKeywords.test(line)) || "";
    }
  }

  const tehlike = normalizeCleanHazardFromText(hazardText) || "Tehlikeli";
  const hazirlama = toInputDate(dateText);
  return {
    firmaAdi,
    sgkNo: sgk,
    sgkSicilNo: sgk,
    adres,
    nace: inferNaceFromSgk(sgk),
    faaliyet: "",
    tehlike,
    hazirlama,
    gecerlilik: hazirlama ? computeValidity(hazirlama, tehlike) : "",
  };
};

const parseIskatipFirmaFromOcrText = (text) => {
  const lines = getOcrLines(text);
  const all = lines.join("\n");
  const receiverStartIndex = lines.findIndex((line) =>
    includesAny(line, ["Hizmet Alan Ä°ÅŸyeri Bilgileri", "Hizmet Alan Isyeri Bilgileri"])
  );
  const receiverEndIndex = lines.findIndex(
    (line, index) =>
      index > receiverStartIndex &&
      includesAny(line, ["Hizmet Sunan", "SÃ¶zleÅŸme Bilgileri", "Sozlesme Bilgileri"])
  );
  const receiverLines =
    receiverStartIndex >= 0
      ? lines.slice(
          receiverStartIndex,
          receiverEndIndex > receiverStartIndex ? receiverEndIndex : Math.min(lines.length, receiverStartIndex + 45)
        )
      : lines;
  const receiverText = receiverLines.join("\n");
  const sgkMatch =
    receiverText.match(/\b\d{20,30}\b/) ||
    receiverText.replace(/\s+/g, "").match(/\d{20,30}/) ||
    all.match(/\b\d{20,30}\b/) ||
    all.replace(/\s+/g, "").match(/\d{20,30}/);
  const sgk = digitsOnly(sgkMatch?.[0] || "");
  const dateMatch =
    all.match(/\b\d{1,2}[./-]\d{1,2}[./-]\d{4}\b/) ||
    all.match(/\b\d{4}-\d{2}-\d{2}\b/);
  const hazardText =
    valueNearLabel(receiverLines, [
      "GÃ¼ncel Tehlike Sınıfı",
      "Guncel Tehlike Sinifi",
      "Tehlike Sınıfı",
      "Tehlike Sinifi",
    ]) || receiverText;
  const dateText =
    valueNearLabel(lines, [
      "SÃ¶zleÅŸme BaÅŸlangÄ±Ã§ Tarihi",
      "Sozlesme Baslangic Tarihi",
      "SÃ¶zleÅŸme Onay Tarihi",
      "Sozlesme Onay Tarihi",
    ]) || dateMatch?.[0] || "";

  let firmaAdi = valueNearLabel(receiverLines, [
    "Hizmet Alan Ä°ÅŸyeri UnvanÄ±",
    "Hizmet Alan Isyeri Unvani",
    "Ä°ÅŸyeri UnvanÄ±",
    "Isyeri Unvani",
    "UnvanÄ±",
    "Unvan",
  ]);

  if (sgk && !firmaAdi) {
    const sgkLineIndex = receiverLines.findIndex((line) => digitsOnly(line).includes(sgk.slice(0, 14)));
    const nearby =
      sgkLineIndex >= 0
        ? receiverLines.slice(Math.max(0, sgkLineIndex - 12), Math.min(receiverLines.length, sgkLineIndex + 12))
        : receiverLines;
    const companyKeywords = /(LÄ°MÄ°TED|LIMITED|ANONÄ°M|ANONIM|ÅÄ°RKET|SIRKET|TÄ°CARET|TICARET|SANAYÄ°|SANAYI|LTD|A\.Å|AÅ|POLÄ°KLÄ°NÄ°K|POLIKLINIK|MERKEZ|MERKEZÄ°|MERKEZI|HÄ°ZMET|HIZMET)/i;
    const noiseKeywords = /(HÄ°ZMET ALAN|HIZMET ALAN|Ä°ÅYERÄ°|ISYERI|SGK|DETS|TEHLÄ°KE|TEHLIKE|SÃ–ZLEÅME|SOZLESME|TARÄ°H|TARIH|Ã‡ALIÅAN|CALISAN|SAYISI|TC KÄ°MLÄ°K|TC KIMLIK)/i;
    firmaAdi =
      nearby.find((line) => companyKeywords.test(line) && !noiseKeywords.test(line)) ||
      nearby.find((line) => {
        const clean = line.replace(/[0-9/.,:-]/g, "").trim();
        return clean.length >= 8 && clean === clean.toLocaleUpperCase("tr-TR") && !noiseKeywords.test(line);
      }) ||
      "";
  }

  firmaAdi = String(firmaAdi || "").replace(/^(UNVAN|ÃœNVAN|UNVANI|ÃœNVANI)\s*[:\-]?\s*/i, "").trim();
  const tehlike = normalizeCleanHazardFromText(hazardText) || "Tehlikeli";
  const hazirlama = toInputDate(dateText);

  return {
    firmaAdi,
    sgkNo: sgk,
    sgkSicilNo: sgk,
    nace: inferNaceFromSgk(sgk),
    faaliyet: "",
    tehlike,
    hazirlama,
    gecerlilik: hazirlama ? computeValidity(hazirlama, tehlike) : "",
  };
};

const stripPdfValue = (value) =>
  String(value || "")
    .replace(/^[:\s-]+/, "")
    .replace(/\s+/g, " ")
    .trim();

const rowValueFromPdfItems = (items, labelKeys) => {
  const label = items.find((item) => includesAny(item.text, labelKeys));
  if (!label) return "";
  return stripPdfValue(
    items
      .filter((item) => Math.abs(item.y - label.y) <= 3 && item.x > label.x + 40 && !includesAny(item.text, labelKeys))
      .sort((a, b) => a.x - b.x)
      .map((item) => item.text)
      .join(" ")
  );
};

const isLikelyCompanyName = (value) => {
  const text = foldText(value);
  return /(limited|anonim|sirket|ticaret|sanayi|ltd|as|osb|apartman|site|yonetici|insaat|dekorasyon|poliklinik|merkez|hizmet)/i.test(text);
};

const readPdfStructuredFirma = async (file) => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const page = await pdf.getPage(1);
  const content = await page.getTextContent();
  const items = (content.items || [])
    .map((item) => ({
      text: stripPdfValue(item.str),
      x: Math.round(item.transform?.[4] || 0),
      y: Math.round(item.transform?.[5] || 0),
    }))
    .filter((item) => item.text);

  const serviceStart = items.find((item) => includesAny(item.text, ["Hizmet Alan Ä°ÅŸyeri Bilgileri", "Hizmet Alan Isyeri Bilgileri"]));
  if (!serviceStart) return null;
  const nextSection = items.find((item) => item.y < serviceStart.y && includesAny(item.text, ["Ä°mza Bilgileri", "Imza Bilgileri"]));
  const serviceItems = items.filter((item) => item.y < serviceStart.y && (!nextSection || item.y > nextSection.y));
  const dateText = rowValueFromPdfItems(items, ["SÃ¶zleÅŸme BaÅŸlangÄ±Ã§ Tarihi", "Sozlesme Baslangic Tarihi"]) || rowValueFromPdfItems(items, ["SÃ¶zleÅŸme Onay Tarihi", "Sozlesme Onay Tarihi"]);
  const sgk = digitsOnly(rowValueFromPdfItems(serviceItems, ["SGK/DETSÄ°S No", "SGK/DETSIS No"]));
  const adres = rowValueFromPdfItems(serviceItems, ["Adres"]);
  const tehlike = normalizeCleanHazardFromText(rowValueFromPdfItems(serviceItems, ["GÃ¼ncel Tehlike Sınıfı", "Guncel Tehlike Sinifi"]));
  const nace = inferNaceFromSgk(sgk);
  const rawFirmaAdi = stripPdfValue(rowValueFromPdfItems(serviceItems, ["Unvan", "Ünvan", "Unvani"])).replace(/^(UNVAN|ÜNVAN|UNVANI|ÜNVANI)\s*[:\-]?\s*/i, "");
  const firmaAdi = isLikelyCompanyName(rawFirmaAdi) ? rawFirmaAdi : "";
  const hazirlama = toInputDate(dateText);

  if (!sgk && !firmaAdi) return null;
  return {
    firmaAdi,
    sgkNo: sgk,
    sgkSicilNo: sgk,
    adres,
    nace,
    faaliyet: "",
    tehlike: tehlike || "Tehlikeli",
    hazirlama,
    gecerlilik: hazirlama ? computeValidity(hazirlama, tehlike || "Tehlikeli") : "",
  };
};

const readPdfWithOcr = async (file, onProgress) => {
  onProgress?.("PDF metni okunuyor...");
  const structured = await readPdfStructuredFirma(file);
  if (structured?.firmaAdi || structured?.sgkNo || structured?.sgkSicilNo) {
    return structured;
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const worker = await createWorker("tur+eng");
  const texts = [];
  const pageLimit = Math.min(pdf.numPages || 1, 2);
  try {
    for (let pageNo = 1; pageNo <= pageLimit; pageNo += 1) {
      onProgress?.(`OCR yapÄ±lÄ±yor (${pageNo}/${pageLimit})...`);
      const page = await pdf.getPage(pageNo);
      const viewport = page.getViewport({ scale: 2.2 });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d", { willReadFrequently: true });
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvasContext: context, viewport }).promise;
      const result = await worker.recognize(canvas);
      texts.push(result?.data?.text || "");
    }
  } finally {
    await worker.terminate();
  }
  return parseIskatipFirmaFromOcrText(texts.join("\n"));
};

const btn = {
  base: `inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition shadow-sm disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#0a2b45]`,
  primary: "bg-[#2563eb] text-white hover:bg-[#1d4ed8]",
  ghost: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50",
  success: "bg-emerald-600 text-white hover:bg-emerald-700",
  danger: "bg-rose-600 text-white hover:bg-rose-700",
};

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs shadow-sm placeholder:text-slate-400 focus:border-[#0a2b45] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#0a2b45]";
const selectClass = inputClass;

const badgeHazard = (t) => {
  if (t === "Az Tehlikeli")
    return "bg-emerald-50 text-emerald-700 border border-emerald-200";
  if (t === "Tehlikeli")
    return "bg-amber-50 text-amber-700 border border-amber-200";
  if (t === "Çok Tehlikeli")
    return "bg-rose-50 text-rose-700 border border-rose-200";
  return "bg-slate-50 text-slate-600 border border-slate-200";
};

// ---- helper: firm normalize (backend farklÄ± dÃ¶ndÃ¼rebilir)
const normalizeFirms = (data) => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.firmalar)) return data.firmalar;
  if (Array.isArray(data.firms)) return data.firms;
  if (Array.isArray(data.data)) return data.data;
  return [];
};

// ---- helper: user label (backend name alanÄ± deÄŸiÅŸebilir)
const userLabel = (u) =>
  (u?.name ||
    u?.adSoyad ||
    u?.fullName ||
    u?.username ||
    u?.email ||
    "").toString();

export default function AdminFirmalar() {
  const location = useLocation();
  const navigate = useNavigate();

  const urlParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search]
  );
  const urlU = (urlParams.get("u") || "").toString(); // "all" veya userId
  const urlQ = (urlParams.get("q") || "").toString(); // arama

  const getGlobalU = () =>
    (typeof window !== "undefined" &&
      window.isgUserFilter &&
      window.isgUserFilter.selectedUserId) ||
    "all";

  const getGlobalQ = () =>
    (typeof window !== "undefined" &&
      window.isgUserFilter &&
      window.isgUserFilter.searchTerm) ||
    "";

  const [selectedUserFilter, setSelectedUserFilter] = useState(
    urlU || getGlobalU() || "all"
  );
  const [q, setQ] = useState(urlQ || getGlobalQ() || "");

  useEffect(() => {
    const nextU = urlU || getGlobalU() || "all";
    const nextQ = urlQ || getGlobalQ() || "";
    setSelectedUserFilter(nextU);
    setQ(nextQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlU, urlQ]);

  const storedUser =
    typeof window !== "undefined" ? localStorage.getItem("user") : null;
  const currentUser = storedUser ? JSON.parse(storedUser) : null;
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const orgId =
    currentUser && currentUser.organization
      ? currentUser.organization._id || currentUser.organization
      : currentUser && currentUser.organizationId
      ? currentUser.organizationId
      : null;

  // =========================
  // ConfirmModal (Firmalar.jsx ile aynÄ± mantÄ±k)
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

  // âœ… Bilgilendirme: iptal yok
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

  // âœ… UyarÄ±/Onay
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

  // âœ… EK: Atama bildirimi tetikleyici
  // assignments endpoint DB'yi gÃ¼ncelliyor ama bildirim Ã¼retmiyor.
  // Bu yÃ¼zden atama sonrasÄ± /api/firma/:id/assign Ã§aÄŸÄ±rÄ±yoruz.
  const notifyAssignment = async ({ userId, firmIds }) => {
    try {
      if (!token) return;
      if (!userId) return;
      if (!firmIds || firmIds.length === 0) return;

      await Promise.all(
        firmIds.map((fid) =>
          axios.post(
            `${API_BASE}/api/firma/${fid}/assign`,
            { userId },
            { headers: { Authorization: `Bearer ${token}` } }
          )
        )
      );
    } catch (err) {
      // Bildirim opsiyonel: atama DB'ye yazÄ±ldÄ±ysa burada hata olsa bile UI'Ä± kÄ±rmayalÄ±m.
      console.error("Atama bildirimi tetikleme hatasÄ±:", err);
    }
  };

  // -------------------- USERS (org users)
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState("");

  useEffect(() => {
    if (!orgId) {
      setUsersError("Organizasyon bilgisi bulunamadÄ±. LÃ¼tfen tekrar giriÅŸ yapÄ±n.");
      setUsersLoading(false);
      return;
    }

    const fetchUsers = async () => {
      try {
        setUsersLoading(true);
        setUsersError("");

        const res = await axios.get(`${API_BASE}/api/org/${orgId}/users`, {
          headers: { Authorization: token ? `Bearer ${token}` : "" },
        });

        setUsers(res.data.users || []);
      } catch (err) {
        console.error("ORG KULLANICI LÄ°STE HATASI:", err);
        setUsersError(
          err.response?.data?.message ||
            "KullanÄ±cÄ± listesi yÃ¼klenirken bir hata oluÅŸtu."
        );
      } finally {
        setUsersLoading(false);
      }
    };

    fetchUsers();
  }, [orgId, token]);

  // ğŸ”’ SADECE ticari_user gÃ¶rÃ¼nÃ¼r (admin rolleri listede Ã§Ä±kmasÄ±n)
  const kullanicilar = useMemo(
    () =>
      (users || []).filter((u) => {
        const role = (u.role || "").toString().toLowerCase().trim();
        if (!role) return false;
        if (role.includes("admin")) return false;
        return role === "ticari_user";
      }),
    [users]
  );

  // âœ… id -> AD SOYAD map (name alanÄ± deÄŸiÅŸse bile yakalasÄ±n)
  const userNameById = useMemo(() => {
    const m = new Map();
    (kullanicilar || []).forEach((u) => {
      const id = (u._id || u.id)?.toString();
      if (id) m.set(id, userLabel(u));
    });
    return m;
  }, [kullanicilar]);

  // -------------------- FIRMS (DB)
  const [firmalar, setFirmalar] = useState([]);
  const [firmsLoading, setFirmsLoading] = useState(true);
  const [firmsError, setFirmsError] = useState("");

  const fetchFirms = async () => {
    try {
      setFirmsLoading(true);
      setFirmsError("");

      const res = await axios.get(`${API_BASE}/api/firma`, {
        headers: { Authorization: token ? `Bearer ${token}` : "" },
      });

      setFirmalar(normalizeFirms(res.data));
    } catch (err) {
      console.error("FÄ°RMA LÄ°STE HATASI:", err);
      setFirmsError(
        err.response?.data?.message || "Firmalar yÃ¼klenirken bir hata oluÅŸtu."
      );
      setFirmalar([]);
    } finally {
      setFirmsLoading(false);
    }
  };

  useEffect(() => {
    fetchFirms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // âœ… Atama sonrasÄ± UI'da "Atanmış Kullanıcı" hemen gÃ¶rÃ¼nsÃ¼n diye
  // firmalar state'inde ilgili firmalara atanmisKullanici alanÄ±nÄ± lokal basÄ±yoruz.
  const applyLocalAssignment = (firmIds = [], userId = "") => {
    const ids = new Set((firmIds || []).map((x) => String(x)));
    setFirmalar((prev) =>
      (prev || []).map((f) => {
        const fid = String(f._id || f.id || "");
        if (!ids.has(fid)) return f;
        return { ...f, atanmisKullanici: userId };
      })
    );
  };

  // -------------------- UI state
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [openForm, setOpenForm] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [bulkImportLoading, setBulkImportLoading] = useState(false);
  const [bulkImportResult, setBulkImportResult] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfStatus, setPdfStatus] = useState("");
  const [form, setForm] = useState({
    _id: null,
    firmaAdi: "",
    sgkNo: "",
    adres: "",
    nace: "",
    faaliyet: "",
    tehlike: "Tehlikeli",
    hazirlama: "",
    gecerlilik: "",
  });

  const [selectedFirms, setSelectedFirms] = useState([]); // firm _id array
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [selectedUserForBulk, setSelectedUserForBulk] = useState("");

  const [singleAssignOpen, setSingleAssignOpen] = useState(false);
  const [singleAssignFirmId, setSingleAssignFirmId] = useState(null);
  const [selectedUserForSingle, setSelectedUserForSingle] = useState("");

  // âœ… YENÄ°: Hepsi / Yeni / Eski filtresi (tasarÄ±mÄ± bozmadan)
  const [firmaTipi, setFirmaTipi] = useState("all"); // all | yeni | eski

  useEffect(() => {
    setPage(1);
  }, [selectedUserFilter, q, firmaTipi]);

  const setParamLocal = (key, value) => {
    const p = new URLSearchParams(location.search);
    if (value === "" || value == null) p.delete(key);
    else p.set(key, value);
    const qs = p.toString();
    navigate(`${location.pathname}${qs ? `?${qs}` : ""}`, { replace: true });
  };

  const filtered = useMemo(() => {
    const text = (q || "").trim().toLowerCase();
    let arr = [...(firmalar || [])];

    // âœ… KullanÄ±cÄ± filtresi
    if (selectedUserFilter && selectedUserFilter !== "all") {
      arr = arr.filter(
        (f) => (f.atanmisKullanici || "").toString() === selectedUserFilter
      );
    }

    // âœ… YENÄ°: Firma tipi filtresi (Yeni = atanmÄ±ÅŸ kullanÄ±cÄ± yok, Eski = atanmÄ±ÅŸ kullanÄ±cÄ± var)
    if (firmaTipi === "yeni") {
      arr = arr.filter((f) => !(f.atanmisKullanici || "").toString());
    } else if (firmaTipi === "eski") {
      arr = arr.filter((f) => !!(f.atanmisKullanici || "").toString());
    }

    if (text) {
      arr = arr.filter((f) => {
        const uid = (f.atanmisKullanici || "").toString();
        const userName = (userNameById.get(uid) || "").toLowerCase();
        const firmaAdi = (f.firmaAdi || "").toString().toLowerCase();
        const sgk = (f.sgkNo || f.sgkSicilNo || "").toString().toLowerCase();
        return userName.includes(text) || firmaAdi.includes(text) || sgk.includes(text);
      });
    }

    arr.sort((a, b) =>
      (a.firmaAdi || "").localeCompare(b.firmaAdi || "", "tr", {
        sensitivity: "base",
      })
    );
    if (!sortAsc) arr.reverse();
    return arr;
  }, [firmalar, q, sortAsc, selectedUserFilter, userNameById, firmaTipi]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pageCount);
  const paged = filtered.slice((current - 1) * pageSize, current * pageSize);

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
    setForm((prev) => ({
      ...prev,
      faaliyet: upTR(auto.faaliyet),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.nace]);

  // -------------------- actions
  const openAdd = () => {
    setForm({
      _id: null,
      firmaAdi: "",
      sgkNo: "",
      adres: "",
      nace: "",
      faaliyet: "",
      tehlike: "Tehlikeli",
      hazirlama: "",
      gecerlilik: "",
    });
    setOpenForm(true);
  };

  const openEdit = (firma) => {
    setForm({
      _id: firma._id || firma.id || null,
      firmaAdi: firma.firmaAdi || "",
      sgkNo: firma.sgkNo || firma.sgkSicilNo || "",
      adres: firma.adres || "",
      nace: firma.nace || "",
      faaliyet: firma.faaliyet || "",
      tehlike: firma.tehlike || "Tehlikeli",
      hazirlama: toInputDate(firma.hazirlama || firma.hazirlamaTarihi),
      gecerlilik: toInputDate(firma.gecerlilik || firma.gecerlilikTarihi),
    });
    setOpenForm(true);
  };

  const saveForm = async (e) => {
    e.preventDefault();

    if (!form.firmaAdi || !form.sgkNo) {
      openInfo("Bilgilendirme", "LÃ¼tfen firma adÄ± ve SGK sicil no giriniz.");
      return;
    }

    try {
      if (!token) {
        openInfo("Bilgilendirme", "Token bulunamadÄ±. LÃ¼tfen tekrar giriÅŸ yapÄ±n.");
        return;
      }

      // âœ… CREATE
      const normalizedSgk = digitsOnly(form.sgkNo);
      const duplicate = (firmalar || []).some((f) => {
        const fid = f?._id || f?.id || null;
        return fid !== form._id && digitsOnly(f?.sgkNo || f?.sgkSicilNo) === normalizedSgk;
      });
      if (duplicate) {
        openInfo("Bilgilendirme", "Bu SGK Sicil NumarasÄ±na ait firma sistemde zaten kayıtlÄ±dÄ±r.");
        return;
      }

      if (!form._id) {
        await axios.post(
          `${API_BASE}/api/firma`,
          {
            firmaAdi: form.firmaAdi,
            sgkNo: normalizedSgk,
            adres: form.adres,
            nace: form.nace,
            faaliyet: form.faaliyet,
            tehlike: form.tehlike,
            hazirlama: form.hazirlama,
            gecerlilik: form.gecerlilik,
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } else {
        // âœ… UPDATE
        await axios.put(
          `${API_BASE}/api/firma/${form._id}`,
          {
            firmaAdi: form.firmaAdi,
            sgkNo: normalizedSgk,
            adres: form.adres,
            nace: form.nace,
            faaliyet: form.faaliyet,
            tehlike: form.tehlike,
            hazirlama: form.hazirlama,
            gecerlilik: form.gecerlilik,
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }

      setOpenForm(false);
      await fetchFirms();
    } catch (err) {
      console.error("FÄ°RMA KAYDET HATASI:", err);
      openInfo("Hata", err.response?.data?.message || "Firma kaydedilemedi.");
    }
  };

  // âœ… SÄ°LME: window.confirm yerine ConfirmModal popup
  const handleDelete = (id) => {
    openConfirm({
      title: "UyarÄ±",
      message: "FirmayÄ± silmek istediÄŸinize emin misiniz?",
      confirmText: "Sil",
      cancelText: "İptal",
      variant: "warning",
      onConfirm: async () => {
        try {
          await axios.delete(`${API_BASE}/api/firma/${id}`, {
            headers: { Authorization: token ? `Bearer ${token}` : "" },
          });

          setSelectedFirms((prev) =>
            prev.filter((fid) => String(fid) !== String(id))
          );
          await fetchFirms();

          // istersen kapat: silince popup Ã§Ä±kmasÄ±n diyorsan bunu kaldÄ±rÄ±rÄ±z
          openInfo("Bilgilendirme", "Firma silindi âœ…");
        } catch (err) {
          console.error("FÄ°RMA SÄ°LME HATASI:", err);
          openInfo("Hata", err.response?.data?.message || "Firma silinemedi.");
        }
      },
    });
  };

  const handleSingleAssignClick = (firmaId) => {
    setSingleAssignFirmId(firmaId);
    setSelectedUserForSingle("");
    setSingleAssignOpen(true);
  };

  const handleSingleAssignSave = async () => {
    if (!selectedUserForSingle || !singleAssignFirmId) return;

    try {
      // âœ… DÃœZELTÄ°LDÄ°: server'a dokunmadan doÄŸru endpoint
      await axios.post(
        `${API_BASE}/api/assignments/admin/assign-firms`,
        { userId: selectedUserForSingle, firmIds: [singleAssignFirmId] },
        { headers: { Authorization: token ? `Bearer ${token}` : "" } }
      );

      // âœ… UI: hemen atanmÄ±ÅŸ kullanÄ±cÄ± ad soyad gÃ¶rÃ¼nsÃ¼n
      applyLocalAssignment([singleAssignFirmId], selectedUserForSingle);

      // âœ…âœ… YENÄ°: Bildirim Ã¼ret (ticari_user'a)
      await notifyAssignment({
        userId: selectedUserForSingle,
        firmIds: [singleAssignFirmId],
      });
    } catch (err) {
      console.error("Atama DB HATASI:", err);
      openInfo("Hata", err.response?.data?.message || "Atama DB'ye yazÄ±lamadÄ±");
      return;
    }

    // UI kapanÄ±ÅŸ
    setSingleAssignOpen(false);
    setSingleAssignFirmId(null);
    setSelectedUserForSingle("");

    openInfo("Bilgilendirme", "Atama yapÄ±ldÄ±. KullanÄ±cÄ± panelinde firmalar gÃ¶rÃ¼necek.");
  };

  const handleBulkAssignSave = async () => {
    if (!selectedUserForBulk || selectedFirms.length === 0) return;

    try {
      // âœ… DÃœZELTÄ°LDÄ°: server'a dokunmadan doÄŸru endpoint
      await axios.post(
        `${API_BASE}/api/assignments/admin/assign-firms`,
        { userId: selectedUserForBulk, firmIds: selectedFirms },
        { headers: { Authorization: token ? `Bearer ${token}` : "" } }
      );

      // âœ… UI: hemen atanmÄ±ÅŸ kullanÄ±cÄ± ad soyad gÃ¶rÃ¼nsÃ¼n
      applyLocalAssignment(selectedFirms, selectedUserForBulk);

      // âœ…âœ… YENÄ°: Bildirim Ã¼ret (ticari_user'a)
      await notifyAssignment({
        userId: selectedUserForBulk,
        firmIds: selectedFirms,
      });
    } catch (err) {
      console.error("Toplu atama DB HATASI:", err);
      openInfo("Hata", err.response?.data?.message || "Toplu atama DB'ye yazÄ±lamadÄ±");
      return;
    }

    setBulkAssignOpen(false);
    setSelectedUserForBulk("");
    setSelectedFirms([]);

    openInfo("Bilgilendirme", "Toplu atama yapÄ±ldÄ±. KullanÄ±cÄ± panelinde firmalar gÃ¶rÃ¼necek.");
  };

  const applyParsedFirma = (parsed = {}) => {
    const sgk = digitsOnly(parsed.sgkNo || parsed.sgkSicilNo);
    const tehlike = parsed.tehlike || "Tehlikeli";
    const hazirlama = toInputDate(parsed.hazirlama || parsed.sozlesmeOnayTarihi);
    setForm((prev) => ({
      ...prev,
      firmaAdi: upTR(parsed.firmaAdi || prev.firmaAdi),
      sgkNo: sgk || prev.sgkNo,
      adres: upTR(parsed.adres || prev.adres),
      nace: parsed.nace || inferNaceFromSgk(sgk) || prev.nace,
      faaliyet: upTR(parsed.faaliyet || prev.faaliyet),
      tehlike,
      hazirlama: hazirlama || prev.hazirlama,
      gecerlilik: toInputDate(parsed.gecerlilik) || computeValidity(hazirlama || prev.hazirlama, tehlike),
    }));
  };

  const handlePdfSelect = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setPdfLoading(true);
      setPdfStatus("PDF okunuyor...");
      const parsed = await readPdfWithOcr(file, setPdfStatus);
      const sgk = digitsOnly(parsed.sgkNo || parsed.sgkSicilNo);
      const duplicate = sgk && (firmalar || []).some((f) => digitsOnly(f?.sgkNo || f?.sgkSicilNo) === sgk);
      if (duplicate) {
        openInfo("Bilgilendirme", "Bu SGK Sicil NumarasÄ±na ait firma sistemde zaten kayıtlÄ±dÄ±r.");
        return;
      }
      if (!parsed.firmaAdi && !sgk) {
        openInfo("Bilgilendirme", "PDF okunamadÄ±. Dosya Ã§ok dÃ¼ÅŸÃ¼k kaliteliyse Excel aktarÄ±mÄ± kullanÄ±n.");
        return;
      }
      applyParsedFirma(parsed);
      openInfo("Bilgilendirme", "PDF okundu ve firma formu dolduruldu.");
    } catch (err) {
      console.error("Admin PDF okuma hatasÄ±:", err);
      openInfo("Hata", "PDF okunamadÄ±. Excel aktarÄ±mÄ± ile devam edebilirsiniz.");
    } finally {
      setPdfLoading(false);
      setPdfStatus("");
    }
  };

  const downloadBulkTemplate = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Firmalar");
    ws.addRow(["Firma Adı", "SGK Sicil No", "Adres", "Tehlike Sınıfı", "SÃ¶zleÅŸme Onay Tarihi"]);
    ws.addRow(["Ã–RNEK FÄ°RMA LTD. ÅTÄ°.", "12345678901234567890123456", "Ã–rnek adres", "Tehlikeli", "01.06.2026"]);
    ws.columns.forEach((col) => {
      col.width = 24;
    });
    const buffer = await wb.xlsx.writeBuffer();
    downloadBlob(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "isgpanel_toplu_firma_sablonu.xlsx");
  };

  const handleBulkExcelSelect = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!token) {
      openInfo("Bilgilendirme", "Token bulunamadÄ±. LÃ¼tfen tekrar giriÅŸ yapÄ±n.");
      return;
    }
    try {
      setBulkImportLoading(true);
      setBulkImportResult(null);
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const ws = wb.worksheets[0];
      const headerMap = getHeaderMap(ws);
      const rows = [];
      ws.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const firmaAdi = getCellByHeader(row, headerMap, ["Firma Adı", "Hizmet Alan Ä°ÅŸyeri UnvanÄ±", "Unvan"], 1);
        const sgkSicilNo = digitsOnly(getCellByHeader(row, headerMap, ["SGK Sicil No", "Hizmet Alan Ä°ÅŸyeri SGK/DETSÄ°S No", "SGK DETSÄ°S No"], 2));
        const adres = getCellByHeader(row, headerMap, ["Adres", "Hizmet Alan Ä°ÅŸyeri Adresi"], 3);
        const tehlike = getCellByHeader(row, headerMap, ["Tehlike Sınıfı", "GÃ¼ncel Tehlike Sınıfı", "Hizmet Alan Ä°ÅŸyeri Tehlike Sınıfı"], 4);
        const hazirlama = getCellByHeader(row, headerMap, ["SÃ¶zleÅŸme Onay Tarihi", "SÃ¶zleÅŸme BaÅŸlangÄ±Ã§ Tarihi", "Hazırlama Tarihi"], 5);
        if (![firmaAdi, sgkSicilNo, adres, tehlike, hazirlama].some(Boolean)) return;
        const nace = inferNaceFromSgk(sgkSicilNo);
        rows.push({ rowNumber, firmaAdi, sgkSicilNo, sgkNo: sgkSicilNo, adres, tehlike, hazirlama, nace });
      });
      const res = await axios.post(`${API_BASE}/api/firma/bulk`, { rows }, { headers: { Authorization: `Bearer ${token}` } });
      setBulkImportResult(res.data || null);
      await fetchFirms();
    } catch (err) {
      console.error("Admin toplu firma ekleme hatasÄ±:", err);
      openInfo("Hata", err.response?.data?.message || "Toplu firma ekleme baÅŸarÄ±sÄ±z oldu.");
    } finally {
      setBulkImportLoading(false);
    }
  };

  // -------------------- render
  return (
    <div className="p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#042f4b] mb-1">Firmalar</h2>
            <p className="text-slate-500 text-xs">
              FirmalarÄ± gÃ¶rÃ¼ntÃ¼leyin, kullanÄ±cÄ± atayÄ±n, toplu iÅŸlem yapÄ±n.
            </p>

            {!!usersError && (
              <p className="mt-1 text-[11px] text-rose-600">{usersError}</p>
            )}
            {usersLoading && (
              <p className="mt-1 text-[11px] text-slate-500">
                KullanÄ±cÄ±lar yÃ¼kleniyor...
              </p>
            )}

            {!!firmsError && (
              <p className="mt-1 text-[11px] text-rose-600">{firmsError}</p>
            )}
            {firmsLoading && (
              <p className="mt-1 text-[11px] text-slate-500">
                Firmalar yÃ¼kleniyor...
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setBulkImportResult(null);
                setBulkImportOpen(true);
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

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative">
            <HiSearch className="absolute left-3 top-2.5 text-slate-400 h-3.5 w-3.5" />
            <input
              value={q}
              onChange={(e) => {
                const v = e.target.value;
                setQ(v);
                setParamLocal("q", v);
              }}
              placeholder="Firma / SGK ara..."
              className={`${inputClass} pl-8 w-72`}
            />
          </div>

          <div className="flex items-center gap-2">
            {/* âœ… YENÄ° / ESKÄ° / HEPSÄ° - mevcut tasarÄ±ma uyumlu butonlar */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFirmaTipi("all")}
                className={`${btn.base} ${
                  firmaTipi === "all" ? btn.primary : btn.ghost
                } !px-2`}
                title="Hepsi"
              >
                Hepsi
              </button>
              <button
                onClick={() => setFirmaTipi("yeni")}
                className={`${btn.base} ${
                  firmaTipi === "yeni" ? btn.primary : btn.ghost
                } !px-2`}
                title="Yeni (atanmamÄ±ÅŸ)"
              >
                Yeni
              </button>
              <button
                onClick={() => setFirmaTipi("eski")}
                className={`${btn.base} ${
                  firmaTipi === "eski" ? btn.primary : btn.ghost
                } !px-2`}
                title="Eski (atanmÄ±ÅŸ)"
              >
                Eski
              </button>
            </div>

            {selectedFirms.length > 0 && (
              <button
                onClick={() => setBulkAssignOpen(true)}
                className={`${btn.base} ${btn.success}`}
                disabled={kullanicilar.length === 0}
              >
                Seçilen {selectedFirms.length} firmayı ata/deÄŸiÅŸtir
              </button>
            )}

            <button
              onClick={() => setSortAsc((s) => !s)}
              className={`${btn.base} ${btn.ghost}`}
            >
              <HiSortAscending
                className={`h-3.5 w-3.5 ${sortAsc ? "" : "rotate-180"} transition`}
              />
              {sortAsc ? "A-Z" : "Z-A"}
            </button>

            <div className="hidden md:flex items-center gap-2 text-xs text-slate-500">
              <span>GÃ¶ster:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className={`${selectClass} h-8 w-20`}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow">
          <div className="max-h-[60vh] overflow-auto">
            <table className="min-w-full text-xs">
              <thead className="sticky top-0 bg-slate-50 z-10">
                <tr className="text-slate-600">
                  <th className="py-1.5 px-2 text-center border-b w-8">
                    <input
                      type="checkbox"
                      checked={
                        selectedFirms.length > 0 &&
                        selectedFirms.length === paged.length
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedFirms(paged.map((f) => f._id || f.id));
                        } else setSelectedFirms([]);
                      }}
                    />
                  </th>
                  <th className="py-2 px-3 text-left font-semibold border-b w-10">
                    #
                  </th>
                  <th className="py-2 px-3 text-left font-semibold border-b">
                    Firma Adı
                  </th>
                  <th className="py-2 px-3 text-left font-semibold border-b">
                    SGK Sicil No
                  </th>
                  <th className="py-2 px-3 text-left font-semibold border-b">
                    Tehlike Sınıfı
                  </th>
                  <th className="py-2 px-3 text-left font-semibold border-b">
                    Atanmış Kullanıcı
                  </th>
                  <th className="py-2 px-3 text-left font-semibold border-b">
                    Durum
                  </th>
                  <th className="py-2 px-3 text-right font-semibold border-b w-40">
                    İşlemler
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 text-slate-700">
                {paged.map((f, idx) => {
                  const rowNo = (current - 1) * pageSize + idx + 1;

                  const atanmisId = (f.atanmisKullanici || "").toString();
                  const atanmisEtiket = atanmisId
                    ? upTR(userNameById.get(atanmisId) || "")
                    : null;

                  const durum = f.durum || (atanmisId ? "Aktif" : "AskÄ±da");
                  const durumClass =
                    durum === "Aktif"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-slate-50 text-slate-600 border border-slate-200";

                  return (
                    <tr key={f._id || f.id} className="hover:bg-slate-50">
                      <td className="py-1.5 px-2 text-center">
                        <input
                          type="checkbox"
                          checked={selectedFirms.some(
                            (x) => String(x) === String(f._id || f.id)
                          )}
                          onChange={(e) => {
                            const fid = f._id || f.id;
                            if (e.target.checked) {
                              setSelectedFirms((prev) => [...prev, fid]);
                            } else {
                              setSelectedFirms((prev) =>
                                prev.filter((x) => String(x) !== String(fid))
                              );
                            }
                          }}
                        />
                      </td>

                      <td className="py-1.5 px-3">{rowNo}</td>

                      <td className="py-1.5 px-3">
                        <span className="text-[11px] font-medium text-slate-800">
                          {f.firmaAdi}
                        </span>
                      </td>

                      <td className="py-1.5 px-3">
                        <span className="text-[11px] tracking-wide">
                          {f.sgkNo || f.sgkSicilNo || "-"}
                        </span>
                      </td>

                      <td className="py-1.5 px-3">
                        <span
                          className={`px-2 py-1 rounded-full text-[10px] font-semibold ${badgeHazard(
                            f.tehlike
                          )}`}
                        >
                          {f.tehlike || "Tehlikeli"}
                        </span>
                      </td>

                      <td className="py-1.5 px-3">
                        {atanmisEtiket ? (
                          <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] border border-emerald-200">
                            {atanmisEtiket}
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700 text-[10px] border border-amber-200">
                            ATANMAMIÅ
                          </span>
                        )}
                      </td>

                      <td className="py-1.5 px-3">
                        <span
                          className={`px-2 py-1 rounded-full text-[9px] font-semibold uppercase tracking-wide ${durumClass}`}
                        >
                          {durum}
                        </span>
                      </td>

                      <td className="py-1.5 px-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            className={`${btn.base} ${btn.ghost} !px-2`}
                            title="Ata / DeÄŸiÅŸtir"
                            onClick={() => handleSingleAssignClick(f._id || f.id)}
                            disabled={kullanicilar.length === 0}
                          >
                            <HiUserAdd className="h-3.5 w-3.5" />
                          </button>

                          <button
                            className={`${btn.base} ${btn.ghost} !px-2`}
                            title="DÃ¼zenle"
                            onClick={() => openEdit(f)}
                          >
                            <HiPencilAlt className="h-3.5 w-3.5" />
                          </button>

                          <button
                            className={`${btn.base} ${btn.danger} !px-2`}
                            title="Sil"
                            onClick={() => handleDelete(f._id || f.id)}
                          >
                            <HiTrash className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {paged.length === 0 && !firmsLoading && (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-6 text-center text-slate-500 text-xs"
                    >
                      Kayıt bulunamadı.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-4 py-2 border-t bg-slate-50 text-[11px] text-slate-600">
            <div>
              {filtered.length > 0 ? (
                <span>
                  Gösterilen{" "}
                  <strong>
                    {(current - 1) * pageSize + 1}-
                    {Math.min(current * pageSize, filtered.length)}
                  </strong>{" "}
                  / Toplam <strong>{filtered.length}</strong> firma
                </span>
              ) : (
                <span>Hiç firma yok.</span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                className={`${btn.base} ${btn.ghost} !px-2`}
                disabled={current === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {"<"}
              </button>
              <span className="px-2">
                {current} / {pageCount}
              </span>
              <button
                className={`${btn.base} ${btn.ghost} !px-2`}
                disabled={current === pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              >
                {">"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* FORM MODAL */}
      {openForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-5">
            <h3 className="text-sm font-semibold mb-3">
              {!form._id ? "Yeni Firma Ekle" : "Firmayı Düzenle"}
            </h3>

            <form onSubmit={saveForm} className="text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">
                  Firma Adı
                </label>
                <input
                  className={inputClass}
                  value={form.firmaAdi}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      firmaAdi: (e.target.value || "").toLocaleUpperCase("tr-TR"),
                    }))
                  }
                  placeholder="FİRMA ADI"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">
                  SGK Sicil No
                </label>
                <input
                  className={inputClass}
                  value={form.sgkNo}
                  onChange={(e) => {
                    const sgkNo = digitsOnly(e.target.value);
                    const nace = sgkNo.length >= 7 ? sgkNo.slice(1, 7) : form.nace;
                    setForm((prev) => ({ ...prev, sgkNo, nace }));
                  }}
                  placeholder="SGK SİCİL NO"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Adres</label>
                <input
                  className={inputClass}
                  value={form.adres}
                  onChange={(e) => setForm((prev) => ({ ...prev, adres: upTR(e.target.value) }))}
                  placeholder="ADRES"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">NACE</label>
                <input
                  className={inputClass}
                  value={form.nace}
                  onChange={(e) => setForm((prev) => ({ ...prev, nace: digitsOnly(e.target.value) }))}
                  placeholder="NACE"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Faaliyet</label>
                <input
                  className={inputClass}
                  value={form.faaliyet}
                  onChange={(e) => setForm((prev) => ({ ...prev, faaliyet: upTR(e.target.value) }))}
                  placeholder="FAALİYET"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Tehlike Sınıfı</label>
                <select
                  className={selectClass}
                  value={form.tehlike}
                  onChange={(e) => {
                    const tehlike = e.target.value;
                    setForm((prev) => ({
                      ...prev,
                      tehlike,
                      gecerlilik: computeValidity(prev.hazirlama, tehlike),
                    }));
                  }}
                >
                  <option value="Az Tehlikeli">Az Tehlikeli</option>
                  <option value="Tehlikeli">Tehlikeli</option>
                  <option value="Çok Tehlikeli">Çok Tehlikeli</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Hazırlama Tarihi</label>
                <input
                  type="date"
                  className={inputClass}
                  value={form.hazirlama}
                  onChange={(e) => {
                    const hazirlama = e.target.value;
                    setForm((prev) => ({
                      ...prev,
                      hazirlama,
                      gecerlilik: computeValidity(hazirlama, prev.tehlike),
                    }));
                  }}
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Geçerlilik Tarihi</label>
                <input
                  type="date"
                  className={`${inputClass} bg-slate-50`}
                  value={form.gecerlilik}
                  readOnly
                />
              </div>

              </div>

              <div className="mt-4 flex items-center justify-end gap-2 border-t pt-3">
                <button
                  type="button"
                  onClick={() => setOpenForm(false)}
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

      {/* TOPLU FIRMA EKLE MODAL */}
      {bulkImportOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Toplu Firma Ekle</h3>
              <button onClick={() => setBulkImportOpen(false)} className="rounded-lg p-1 hover:bg-slate-100">
                <HiX className="h-4 w-4" />
              </button>
            </div>

            <p className="text-[11px] text-slate-500 mb-3">
              Excel'in ilk satÄ±rÄ± baÅŸlÄ±k satÄ±rÄ±dÄ±r. KayÄ±tlar 2. satÄ±rdan itibaren okunur.
            </p>

            <input
              id="admin-bulk-firma-input"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={handleBulkExcelSelect}
            />

            <div className="flex flex-wrap gap-2 mb-3">
              <button type="button" onClick={downloadBulkTemplate} className={`${btn.base} ${btn.ghost}`}>
                <HiDownload className="h-3.5 w-3.5" />
                Örnek Excel Şablonu İndir
              </button>
              <button
                type="button"
                onClick={() => document.getElementById("admin-bulk-firma-input")?.click()}
                disabled={bulkImportLoading}
                className={`${btn.base} ${btn.primary}`}
              >
                <HiUpload className="h-3.5 w-3.5" />
                {bulkImportLoading ? "YÃ¼kleniyor..." : "Excel SeÃ§ ve YÃ¼kle"}
              </button>
            </div>

            {bulkImportResult && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                <div className="mb-2 font-semibold text-slate-800">YÃ¼kleme Ã–zeti</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>Toplam Satır: <b>{bulkImportResult.totalRows || 0}</b></div>
                  <div>Başarıyla Eklenen: <b>{bulkImportResult.insertedCount || 0}</b></div>
                  <div>Mükerrer Kayıt: <b>{bulkImportResult.duplicateCount || 0}</b></div>
                  <div>Hatalı Satır: <b>{bulkImportResult.invalidCount || 0}</b></div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TOPLU ATAMA MODAL */}
      {bulkAssignOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-4">
            <h3 className="text-sm font-semibold mb-2">Toplu Atama</h3>
            <p className="text-[11px] text-slate-500 mb-3">
              Seçilen {selectedFirms.length} firmayı aynÄ± kullanÄ±cÄ±ya atayÄ±n veya
              atamasÄ±nÄ± deÄŸiÅŸtirin.
            </p>

            <label className="block text-[11px] font-medium text-slate-700 mb-1">
              Kullanıcı Seç
            </label>
            <select
              value={selectedUserForBulk}
              onChange={(e) => setSelectedUserForBulk(e.target.value)}
              className={`${selectClass} mb-4`}
            >
              <option value="">SeÃ§iniz</option>
              {kullanicilar.map((k) => (
                <option key={k._id || k.id} value={k._id || k.id}>
                  {upTR(userLabel(k))}
                </option>
              ))}
            </select>

            <div className="flex gap-2">
              <button
                className={`${btn.base} ${btn.success} flex-1`}
                onClick={handleBulkAssignSave}
                disabled={
                  !selectedUserForBulk ||
                  selectedFirms.length === 0 ||
                  kullanicilar.length === 0
                }
              >
                Atamayı Yap
              </button>
              <button
                className={`${btn.base} ${btn.ghost} flex-1`}
                onClick={() => setBulkAssignOpen(false)}
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TEKLÄ° ATAMA MODAL */}
      {singleAssignOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xs p-4">
            <h3 className="text-sm font-semibold mb-2">Ata / DeÄŸiÅŸtir</h3>

            <label className="block text-[11px] font-medium text-slate-700 mb-1">
              Kullanıcı Seç
            </label>
            <select
              value={selectedUserForSingle}
              onChange={(e) => setSelectedUserForSingle(e.target.value)}
              className={`${selectClass} mb-4`}
            >
              <option value="">SeÃ§iniz</option>
              {kullanicilar.map((k) => (
                <option key={k._id || k.id} value={k._id || k.id}>
                  {upTR(userLabel(k))}
                </option>
              ))}
            </select>

            <div className="flex gap-2">
              <button
                className={`${btn.base} ${btn.success} flex-1`}
                onClick={handleSingleAssignSave}
                disabled={!selectedUserForSingle || kullanicilar.length === 0}
              >
                Kaydet
              </button>
              <button
                className={`${btn.base} ${btn.ghost} flex-1`}
                onClick={() => setSingleAssignOpen(false)}
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* âœ… ConfirmModal */}
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

