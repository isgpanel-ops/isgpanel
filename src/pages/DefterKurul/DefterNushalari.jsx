import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Upload,
  FileText,
  Save,
  Trash2,
  CalendarDays,
  CheckCircle2,
  RefreshCw,
  XCircle,
  Camera,
} from "lucide-react";
import jsPDF from "jspdf";

import { useFirmalar } from "../../context/FirmaContext";
import ConfirmModal from "../../components/ui/ConfirmModal";


const RAW_API_ORIGIN =
  (import.meta.env.VITE_API_URL || import.meta.env.VITE_API || "").trim() ||
  "https://api.isgpanel.tr";

const API_ORIGIN = RAW_API_ORIGIN.replace(/\/+$/, "").replace(/\/api$/i, "");
const API_BASE = `${API_ORIGIN}/api`;

const DOCS_SYNC_KEY = "docs:lastChangeAt";
const DEFTER_SYNC_KEY = "defter:lastChangeAt";

const MAX_MANUAL_FILE_SIZE = 1 * 1024 * 1024;

const MONTHS = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

function getToken() {
  return (
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("accessToken") ||
    ""
  );
}

function getStoredUser() {
  try {
    return JSON.parse(
      localStorage.getItem("user") ||
      sessionStorage.getItem("user") ||
      "null"
    );
  } catch {
    return null;
  }
}

function getHazirlayanAdSoyad() {
  try {
    const u = getStoredUser();

    return (
      u?.adSoyad ||
      u?.name ||
      u?.fullName ||
      u?.userName ||
      ""
    );
  } catch {
    return "";
  }
}

function normalizeFirma(f) {
  if (!f) return { id: "", name: "" };

  const id = f._id || f.id || f.firmaId || f.sgkSicilNo || f.sgkNo || "";

  const name = f.firmaAdi || f.unvan || f.name || f.ad || f.label || "";

  return {
    id: String(id || ""),
    name: String(name || ""),
    raw: f,
  };
}

function formatSize(size) {
  if (!size) return "-";
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

function safeFileName(text) {
  return String(text || "")
    .replace(/[<>:"/\\|?*]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isImageFile(file) {
  return String(file?.type || "").startsWith("image/");
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function compressImageToJpegDataUrl(file, maxWidth = 1600, quality = 0.72) {
  const dataUrl = await readFileAsDataUrl(file);
  const img = await loadImage(dataUrl);

  const ratio = Math.min(1, maxWidth / img.width);
  const width = Math.round(img.width * ratio);
  const height = Math.round(img.height * ratio);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  return canvas.toDataURL("image/jpeg", quality);
}

async function imagesToCompressedPdfFile(imageFiles, pdfName) {
  const pdf = new jsPDF({
    orientation: "p",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  for (let i = 0; i < imageFiles.length; i++) {
    const imageDataUrl = await compressImageToJpegDataUrl(imageFiles[i]);
    const img = await loadImage(imageDataUrl);

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 8;

    const usableWidth = pageWidth - margin * 2;
    const usableHeight = pageHeight - margin * 2;

    const imgRatio = img.width / img.height;
    const pageRatio = usableWidth / usableHeight;

    let renderWidth = usableWidth;
    let renderHeight = usableHeight;

    if (imgRatio > pageRatio) {
      renderHeight = usableWidth / imgRatio;
    } else {
      renderWidth = usableHeight * imgRatio;
    }

    const x = (pageWidth - renderWidth) / 2;
    const y = (pageHeight - renderHeight) / 2;

    if (i > 0) pdf.addPage();

    pdf.addImage(
      imageDataUrl,
      "JPEG",
      x,
      y,
      renderWidth,
      renderHeight,
      undefined,
      "FAST"
    );
  }

  const blob = pdf.output("blob");

  return new File([blob], pdfName, {
    type: "application/pdf",
    lastModified: Date.now(),
  });
}

export default function DefterNushalari() {
  const now = new Date();

  const scanInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const { selectedFirm } = useFirmalar();

  const firma = useMemo(() => {
    return normalizeFirma(selectedFirm);
  }, [selectedFirm]);

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

const [confirmData, setConfirmData] = useState({
  title: "",
  message: "",
  variant: "warning",
  confirmText: "Tamam",
  cancelText: "İptal",
  onConfirm: null,
});

  const periodLabel = `${MONTHS[month - 1]} ${year}`;

  const selectedMonthData = useMemo(() => {
    return items.find(
      (x) =>
        Number(x.year) === Number(year) &&
        Number(x.month) === Number(month)
    );
  }, [items, year, month]);

  const selectedFiles = selectedMonthData?.files || [];
  const isSavedToBelgelerim = Boolean(selectedMonthData?.savedToBelgelerim);

  const currentYear = now.getFullYear();

const years = [
  currentYear - 2,
  currentYear - 1,
  currentYear,
];

  useEffect(() => {
    if (firma.id) {
      loadDefterNushalari(firma.id);
    } else {
      setItems([]);
    }
  }, [firma.id]);

  function makeBaseName() {
    return safeFileName(`${firma.name} ${periodLabel}`);
  }

  function renameUploadFile(file, index, total) {
    const ext = file.name?.includes(".")
      ? file.name.substring(file.name.lastIndexOf("."))
      : file.type?.includes("pdf")
      ? ".pdf"
      : ".jpg";

    const suffix = total > 1 ? ` - ${index + 1}` : "";
    const newName = safeFileName(`${makeBaseName()}${suffix}${ext}`);

    return new File([file], newName, {
      type: file.type,
      lastModified: file.lastModified,
    });
  }

  async function prepareFilesForUpload(rawFiles, mode = "file") {
    if (mode === "scan") {
      const imageFiles = rawFiles.filter(isImageFile);

      if (!imageFiles.length) {
        throw new Error("Kamera ile tarama için görsel dosya seçilmelidir.");
      }

      return [await imagesToCompressedPdfFile(imageFiles, `${makeBaseName()}.pdf`)];
    }

    const allImages = rawFiles.length > 0 && rawFiles.every(isImageFile);

    if (allImages) {
      return [await imagesToCompressedPdfFile(rawFiles, `${makeBaseName()}.pdf`)];
    }

    const overLimit = rawFiles.find((file) => file.size > MAX_MANUAL_FILE_SIZE);

    if (overLimit) {
      throw new Error(
        `"${overLimit.name}" dosyası 1 MB sınırını aşıyor. Lütfen daha küçük dosya yükleyin.`
      );
    }

    return rawFiles.map((file, index) =>
      renameUploadFile(file, index, rawFiles.length)
    );
  }

  async function loadDefterNushalari(activeFirmaId = firma.id) {
    if (!activeFirmaId) return;

    try {
      setLoading(true);

      const res = await fetch(
        `${API_BASE}/defter-nushalari?firmaId=${activeFirmaId}`,
        {
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        }
      );

      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.message || "Defter nüshaları alınamadı.");
      }

      setItems(Array.isArray(json.items) ? json.items : []);
    } catch (err) {
      console.error(err);
      alert(err.message || "Defter nüshaları yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }

  async function handleFileChange(e, mode = "file") {
    const rawFiles = Array.from(e.target.files || []);
    e.target.value = "";

    if (!firma.id) {
      alert("Lütfen önce üst navbar üzerinden firma seçin.");
      return;
    }

    if (!rawFiles.length) return;

    try {
      setUploading(true);

      const files = await prepareFilesForUpload(rawFiles, mode);

      const formData = new FormData();
      formData.append("firmaId", firma.id);
      formData.append("firmaAdi", firma.name);
      formData.append("year", year);
      formData.append("month", month);
      formData.append("periodLabel", periodLabel);
      formData.append("belgeAdi", `${firma.name} ${periodLabel}`);

      files.forEach((file) => formData.append("files", file));

      const res = await fetch(`${API_BASE}/defter-nushalari/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
        body: formData,
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.message || "Dosya yüklenemedi.");
      }

      localStorage.setItem("defter:lastChangeAt", String(Date.now()));
      localStorage.setItem("docs:lastChangeAt", String(Date.now()));

      await loadDefterNushalari(firma.id);
    } catch (err) {
      console.error(err);
      alert(err.message || "Dosya yüklenemedi.");
    } finally {
      setUploading(false);
    }
  }

  function removeFile(fileId) {
  setConfirmData({
    title: "Evrak Silinsin mi?",
    message: "Bu evrak silinecek. Devam etmek istiyor musunuz?",
    variant: "danger",
    confirmText: "Sil",
    cancelText: "İptal",
    onConfirm: async () => {
      setConfirmOpen(false);

      try {
        const res = await fetch(`${API_BASE}/defter-nushalari/file/${fileId}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        });

        const json = await res.json();

        if (!res.ok || !json.ok) {
          throw new Error(json.message || "Dosya silinemedi.");
        }

        localStorage.setItem(DEFTER_SYNC_KEY, String(Date.now()));
        localStorage.setItem(DOCS_SYNC_KEY, String(Date.now()));

        window.dispatchEvent(new Event(DEFTER_SYNC_KEY));
        window.dispatchEvent(new Event(DOCS_SYNC_KEY));

        await loadDefterNushalari(firma.id);
      } catch (err) {
        console.error(err);
        alert(err.message || "Dosya silinemedi.");
      }
    },
  });

  setConfirmOpen(true);
}

async function handleOpenFile(file) {
  try {
    const rawUrl = file?.url || "";
    const url = rawUrl?.startsWith("http")
      ? rawUrl
      : `${API_ORIGIN}${rawUrl}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${getToken()}`,
      },
    });

    if (!res.ok) {
      throw new Error("Dosya açılamadı.");
    }

    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);

    window.open(blobUrl, "_blank");

    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  } catch (err) {
    console.error(err);
    alert("Dosya açılamadı.");
  }
}

  async function saveToBelgelerim() {
    if (!firma.id) {
      alert("Lütfen önce üst navbar üzerinden firma seçin.");
      return;
    }

    if (!selectedFiles.length) {
      alert(`${periodLabel} için önce tarama veya PDF ekleyin.`);
      return;
    }

    try {
      setSaving(true);

      const res = await fetch(`${API_BASE}/defter-nushalari/save-belgelerim`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
      body: JSON.stringify({
  firmaId: firma.id,
  firmaAdi: firma.name,
  year,
  month,
  periodLabel,
  belgeAdi: `${firma.name} ${periodLabel}`,

  category: "defter-kurul",
  kategori: "Defter & Kurul",
  belgeTuru: "Defter Nüshaları",
  tur: "Defter Nüshaları",
  type: "Defter Nüshaları",

  hazirlayan: getHazirlayanAdSoyad(),
  hazirlayanAdSoyad: getHazirlayanAdSoyad(),

  preparedBy: getHazirlayanAdSoyad(),
  preparedByName: getHazirlayanAdSoyad(),
  createdByName: getHazirlayanAdSoyad(),
}),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.message || "Belgelerim’e kaydedilemedi.");
      }

      localStorage.setItem("defter:lastChangeAt", String(Date.now()));
      localStorage.setItem("docs:lastChangeAt", String(Date.now()));

      await loadDefterNushalari(firma.id);
      alert("Belgelerim, Defter & Kurul sekmesine kaydedildi ✅");
    } catch (err) {
      console.error(err);
      alert(err.message || "Belgelerim’e kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
          <div>
            <h1 className="text-base sm:text-lg font-semibold text-slate-900 leading-tight">
              Defter Nüshaları
            </h1>
            <p className="text-[13px] text-slate-500 mt-1 leading-relaxed">
              Navbar’dan seçilen firma için aylık tarama veya PDF dosyalarını yükleyin.
            </p>
          </div>

          <button
            onClick={saveToBelgelerim}
            disabled={saving || uploading || !selectedFiles.length}
            className="inline-flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-md font-semibold text-xs transition"
          >
            {isSavedToBelgelerim ? <CheckCircle2 size={17} /> : <Save size={17} />}
            {saving
              ? "Kaydediliyor..."
              : isSavedToBelgelerim
              ? "Belgelerim’e Kaydedildi"
              : "Belgelerime Kaydet"}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div className="border border-gray-200 rounded-xl px-4 py-3 bg-gray-50">
            <div className="text-xs text-gray-500 mb-1">Firma</div>
            <div className="font-bold text-gray-900 truncate">
              {firma.id ? firma.name : "Navbar’dan firma seçin"}
            </div>
          </div>

          <div className="border border-gray-200 rounded-xl px-4 py-3 bg-gray-50">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
              <CalendarDays size={14} />
              Dönem
            </div>
            <div className="font-bold text-gray-900">{periodLabel}</div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="border border-gray-200 rounded-xl px-3 py-3 bg-white font-semibold text-gray-800"
            >
              {MONTHS.map((m, index) => (
                <option key={m} value={index + 1}>
                  {m}
                </option>
              ))}
            </select>

            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="border border-gray-200 rounded-xl px-3 py-3 bg-white font-semibold text-gray-800"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="border-2 border-dashed border-blue-300 rounded-2xl p-5 sm:p-6 text-center bg-blue-50">
          <input
            ref={scanInputRef}
            type="file"
            multiple
            accept="image/*"
            capture="environment"
            onChange={(e) => handleFileChange(e, "scan")}
            className="hidden"
          />

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="application/pdf,image/*"
            onChange={(e) => handleFileChange(e, "file")}
            className="hidden"
          />

          <div className="flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center mb-3">
              {uploading ? (
                <RefreshCw size={23} className="animate-spin" />
              ) : (
                <Upload size={23} />
              )}
            </div>

            <div className="font-bold text-gray-800">
              {uploading ? "PDF hazırlanıyor ve yükleniyor..." : "Tarama veya PDF ekle"}
            </div>

            <div className="text-sm text-gray-500 mt-1 mb-4">
              Kamera/görseller PDF’e çevrilir. Manuel PDF yükleme sınırı 1 MB.
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 w-full">
              <button
                type="button"
                onClick={() => scanInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-3 py-1.5 rounded-md font-semibold text-xs transition"
              >
                <Camera size={14} />
                Kamera ile Tara
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center justify-center gap-1.5 bg-white hover:bg-gray-50 disabled:bg-gray-100 text-gray-800 border border-gray-300 px-3 py-1.5 rounded-md font-semibold text-xs transition"
              >
                <Upload size={14} />
                PDF / Görsel Yükle
              </button>
            </div>

            <div className="text-xs text-gray-500 mt-3">
              Kayıt adı otomatik: {firma.name || "Firma Adı"} {periodLabel}.pdf
            </div>
          </div>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between gap-3 mb-2">
            <h2 className="text-base font-bold text-gray-800">
              {periodLabel} Evrakları
            </h2>

            {loading && <span className="text-sm text-gray-500">Yükleniyor...</span>}
          </div>

          {selectedFiles.length === 0 ? (
            <div className="text-center border border-gray-200 rounded-xl p-4 text-gray-500 text-sm">
              Bu dönem için henüz evrak eklenmedi.
            </div>
          ) : (
            <div className="space-y-2">
              {selectedFiles.map((file, index) => (
                <div
                  key={file._id || file.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border border-gray-200 rounded-xl px-3 py-2"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600">
                      <FileText size={20} />
                    </div>

                    <div className="min-w-0">
                      <div className="font-semibold text-gray-800 truncate">
                        {index + 1}. {file.originalName || file.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatSize(file.size)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                   <button
  type="button"
  onClick={() => handleOpenFile(file)}
  className="text-blue-600 hover:bg-blue-50 px-3 py-2 rounded-lg text-sm font-semibold"
>
  Aç
</button>

                    <button
                      onClick={() => removeFile(file._id || file.id)}
                      className="inline-flex items-center gap-1 text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg transition text-sm font-semibold"
                    >
                      <Trash2 size={15} />
                      Sil
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6">
          <h2 className="text-base font-bold text-gray-800 mb-2">
            Aylık Takip Tablosu
          </h2>

          <div className="overflow-x-auto border border-gray-200 rounded-xl">
            <table className="w-full min-w-[950px] text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {MONTHS.map((m, index) => (
                    <th
                      key={m}
                      onClick={() => setMonth(index + 1)}
                      className={`px-3 py-3 text-center border-b border-r last:border-r-0 cursor-pointer whitespace-nowrap ${
                        month === index + 1
                          ? "bg-blue-50 text-blue-700"
                          : "text-gray-700"
                      }`}
                    >
                      {m}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                <tr>
                  {MONTHS.map((m, index) => {
                    const rowMonth = index + 1;
                    const row = items.find(
                      (x) =>
                        Number(x.year) === Number(year) &&
                        Number(x.month) === Number(rowMonth)
                    );

                    const count = row?.files?.length || 0;
                    const hasFile = count > 0;

                    return (
                      <td
                        key={m}
                        onClick={() => setMonth(rowMonth)}
                        className={`px-3 py-4 text-center border-r last:border-r-0 cursor-pointer ${
                          month === rowMonth ? "bg-blue-50" : "bg-white"
                        }`}
                      >
                        <div className="flex flex-col items-center gap-1">
                          {hasFile ? (
                            <CheckCircle2 size={22} className="text-green-600" />
                          ) : (
                            <XCircle size={22} className="text-red-500" />
                          )}

                          <span
                            className={`text-xs font-semibold ${
                              hasFile ? "text-green-700" : "text-red-500"
                            }`}
                          >
                            {hasFile ? `${count} evrak` : "Yok"}
                          </span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>

          <p className="text-xs text-gray-500 mt-2">
            Mobilde tabloyu sağa sola kaydırarak tüm ayları görebilirsiniz.
          </p>
        </div>
      </div>
      <ConfirmModal
        open={confirmOpen}
        title={confirmData.title}
        message={confirmData.message}
        variant={confirmData.variant}
        confirmText={confirmData.confirmText}
        cancelText={confirmData.cancelText}
        onConfirm={confirmData.onConfirm}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

    