import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Upload,
  FileText,
  Save,
  Trash2,
  CheckCircle2,
  RefreshCw,
  XCircle,
  Camera,
  Minus,
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
const KURUL_SYNC_KEY = "kurul:lastChangeAt";

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

async function readJsonSafe(res) {
  const text = await res.text();

  try {
    return JSON.parse(text);
  } catch {
    return {
      ok: false,
      message:
        res.status === 404
          ? "Backend route bulunamadı. /api/kurul-nushalari veya /api/firma/:id kontrol edilmeli."
          : "Sunucudan geçersiz cevap geldi.",
    };
  }
}

function normalizeFirma(f) {
  if (!f) return { id: "", name: "", tehlikeSinifi: "" };

  const id = f._id || f.id || f.firmaId || f.sgkSicilNo || f.sgkNo || "";

  const name = f.firmaAdi || f.unvan || f.name || f.ad || f.label || "";

  const tehlikeSinifi =
    f.tehlike ||
    f.tehlikeSinifi ||
    f.tehlikeSinif ||
    f.tehlike_sinifi ||
    f.isyeriTehlikeSinifi ||
    f.isYeriTehlikeSinifi ||
    f.firmaTehlikeSinifi ||
    f.naceTehlikeSinifi ||
    f.nace?.tehlikeSinifi ||
    f.naceKodu?.tehlikeSinifi ||
    f.kurumsal?.tehlikeSinifi ||
    f.isyeri?.tehlikeSinifi ||
    f.dangerClass ||
    "";

  return {
    id: String(id || ""),
    name: String(name || ""),
    tehlikeSinifi: String(tehlikeSinifi || "").toLocaleLowerCase("tr-TR"),
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

export default function KurulNushalari() {
  const now = new Date();

  const scanInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const { selectedFirm } = useFirmalar();

  const [firmDetail, setFirmDetail] = useState(null);

  const firmId =
    selectedFirm?._id ||
    selectedFirm?.id ||
    selectedFirm?.firmaId ||
    selectedFirm?.sgkSicilNo ||
    "";

  useEffect(() => {
    const run = async () => {
      setFirmDetail(null);

      if (!firmId) return;

      const token = getToken();
      if (!token) return;

      try {
        const res = await fetch(`${API_BASE}/firma/${firmId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const json = await readJsonSafe(res);

        if (res.ok) {
          setFirmDetail(json);
        }
      } catch (e) {
        console.error("Firma detayı çekilemedi:", e);
      }
    };

    run();
  }, [firmId]);

  const firmObj = firmDetail || selectedFirm;

  const firma = useMemo(() => {
    return normalizeFirma(firmObj);
  }, [firmObj]);

const currentYear = new Date().getFullYear();

const years = [
  currentYear - 2,
  currentYear - 1,
  currentYear,
];

  const [items, setItems] = useState([]);
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [kurulStartMonth, setKurulStartMonth] = useState(now.getMonth() + 1);

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
      (x) => Number(x.year) === Number(year) && Number(x.month) === Number(month)
    );
  }, [items, year, month]);

  const selectedFiles = selectedMonthData?.files || [];
  const isSavedToBelgelerim = Boolean(selectedMonthData?.savedToBelgelerim);

  function makeBaseName() {
    return safeFileName(`${firma.name} Kurul ${periodLabel}`);
  }

  function getFrequencyText() {
    const t = firma.tehlikeSinifi;

    if (t.includes("çok")) return "Ayda bir";
    if (t.includes("tehlikeli")) return "2 ayda bir";
    if (t.includes("az")) return "3 ayda bir";

    return "Tehlike sınıfı bulunamadı";
  }

  function isRequiredMonth(monthNumber) {
    const startMonth = Number(kurulStartMonth || 1);

    if (monthNumber < startMonth) return false;

    const diff = monthNumber - startMonth;
    const t = firma.tehlikeSinifi;

    if (t.includes("çok")) return true;

    if (t.includes("tehlikeli")) {
      return diff % 2 === 0;
    }

    if (t.includes("az")) {
      return diff % 3 === 0;
    }

    return diff % 3 === 0;
  }

  useEffect(() => {
    if (firma.id) {
      loadKurulNushalari();
    } else {
      setItems([]);
    }
  }, [firma.id]);

  async function loadKurulNushalari() {
    if (!firma.id) return;

    try {
      setLoading(true);

      const res = await fetch(`${API_BASE}/kurul-nushalari?firmaId=${firma.id}`, {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });

      const json = await readJsonSafe(res);

      if (!res.ok || !json.ok) {
        throw new Error(json.message || "Kurul nüshaları alınamadı.");
      }

      setItems(Array.isArray(json.items) ? json.items : []);
    } catch (err) {
      console.error(err);
      alert(err.message || "Kurul nüshaları yüklenemedi.");
    } finally {
      setLoading(false);
    }
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

    return rawFiles.map((file, index) => {
      const ext = file.name?.includes(".")
        ? file.name.substring(file.name.lastIndexOf("."))
        : file.type?.includes("pdf")
        ? ".pdf"
        : ".jpg";

      const suffix = rawFiles.length > 1 ? ` - ${index + 1}` : "";
      const newName = safeFileName(`${makeBaseName()}${suffix}${ext}`);

      return new File([file], newName, {
        type: file.type,
        lastModified: file.lastModified,
      });
    });
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
      formData.append("kurulStartMonth", kurulStartMonth);
      formData.append("tehlikeSinifi", firma.tehlikeSinifi);
      formData.append("belgeAdi", `${firma.name} Kurul ${periodLabel}`);

      files.forEach((file) => formData.append("files", file));

      const res = await fetch(`${API_BASE}/kurul-nushalari/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
        body: formData,
      });

      const json = await readJsonSafe(res);

      if (!res.ok || !json.ok) {
        throw new Error(json.message || "Yükleme başarısız.");
      }

      localStorage.setItem("kurul:lastChangeAt", String(Date.now()));
      localStorage.setItem("docs:lastChangeAt", String(Date.now()));

      await loadKurulNushalari();
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
        const res = await fetch(`${API_BASE}/kurul-nushalari/file/${fileId}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        });

        const json = await readJsonSafe(res);

        if (!res.ok || !json.ok) {
          throw new Error(json.message || "Dosya silinemedi.");
        }

        localStorage.setItem(KURUL_SYNC_KEY, String(Date.now()));
        localStorage.setItem(DOCS_SYNC_KEY, String(Date.now()));

        window.dispatchEvent(new Event(KURUL_SYNC_KEY));
        window.dispatchEvent(new Event(DOCS_SYNC_KEY));

        await loadKurulNushalari();
      } catch (err) {
        console.error(err);
        alert(err.message || "Dosya silinemedi.");
      }
    },
  });

  setConfirmOpen(true);
}



  async function saveToBelgelerim() {
    if (!firma.id) {
      alert("Lütfen önce üst navbar üzerinden firma seçin.");
      return;
    }

    if (!selectedFiles.length) {
      alert(`${periodLabel} için önce kurul evrakı yükleyin.`);
      return;
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
    try {
      setSaving(true);

const hazirlayanAd =
  JSON.parse(localStorage.getItem("user") || "null")?.name ||
  JSON.parse(localStorage.getItem("user") || "null")?.adSoyad ||
  JSON.parse(sessionStorage.getItem("user") || "null")?.name ||
  JSON.parse(sessionStorage.getItem("user") || "null")?.adSoyad ||
  "";

      const res = await fetch(`${API_BASE}/kurul-nushalari/save-belgelerim`, {
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
  kurulStartMonth,
  tehlikeSinifi: firma.tehlikeSinifi,
  belgeAdi: `${firma.name} Kurul ${periodLabel}`,

  hazirlayan: hazirlayanAd,
  hazirlayanAdSoyad: hazirlayanAd,
  preparedBy: hazirlayanAd,
  preparedByName: hazirlayanAd,
  createdByName: hazirlayanAd,
  createdByFullName: hazirlayanAd,
  olusturan: hazirlayanAd,
  olusturanAdSoyad: hazirlayanAd,
}),
      });

      const json = await readJsonSafe(res);

      if (!res.ok || !json.ok) {
        throw new Error(json.message || "Kayıt başarısız.");
      }

      localStorage.setItem("kurul:lastChangeAt", String(Date.now()));
      localStorage.setItem("docs:lastChangeAt", String(Date.now()));

      await loadKurulNushalari();

      alert("Belgelerim, Defter & Kurul sekmesine kaydedildi ✅");
    } catch (err) {
      console.error(err);
      alert(err.message || "Kayıt başarısız.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base sm:text-lg font-semibold text-slate-900 leading-tight">
            Kurul Nüshaları
          </h3>

          <p className="text-[13px] text-slate-500 mt-1 leading-relaxed">
            Tehlike sınıfına ve başlangıç ayına göre kurul evraklarını takip edin.
          </p>
        </div>

        <button
          onClick={saveToBelgelerim}
          disabled={saving || uploading || !selectedFiles.length}
          className="inline-flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-md font-semibold text-xs transition"
        >
          {isSavedToBelgelerim ? <CheckCircle2 size={14} /> : <Save size={14} />}

          {saving
            ? "Kaydediliyor..."
            : isSavedToBelgelerim
            ? "Belgelerim’e Kaydedildi"
            : "Belgelerime Kaydet"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
        <div className="border border-slate-200 rounded-xl px-4 py-3 bg-slate-50">
          <div className="text-xs text-slate-500 mb-1">Firma</div>

          <div className="font-bold text-slate-900 truncate">
            {firma.name || "Firma seçin"}
          </div>
        </div>

        <div className="border border-slate-200 rounded-xl px-4 py-3 bg-slate-50">
          <div className="text-xs text-slate-500 mb-1">Tehlike Sınıfı</div>

          <div className="font-bold text-slate-900 capitalize">
            {firma.tehlikeSinifi || "-"}
          </div>

          <div className="text-[11px] text-slate-500 mt-1">
            Sıklık: {getFrequencyText()}
          </div>
        </div>

        <div className="border border-slate-200 rounded-xl px-4 py-3 bg-slate-50">
          <div className="text-xs text-slate-500 mb-1">Kurul Başlangıç Ayı</div>

          <select
            value={kurulStartMonth}
            onChange={(e) => setKurulStartMonth(Number(e.target.value))}
            className="w-full bg-transparent font-bold text-slate-900 outline-none"
          >
            {MONTHS.map((m, index) => (
              <option key={m} value={index + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="border border-slate-200 rounded-xl px-3 py-3 bg-white font-semibold text-slate-800"
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
            className="border border-slate-200 rounded-xl px-3 py-3 bg-white font-semibold text-slate-800"
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

          <div className="font-bold text-slate-800">
            {uploading ? "PDF hazırlanıyor ve yükleniyor..." : "Kurul Evrakı Yükle"}
          </div>

          <div className="text-sm text-slate-500 mt-1 mb-4">
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
              className="inline-flex items-center justify-center gap-1.5 bg-white hover:bg-gray-50 disabled:bg-gray-100 text-slate-800 border border-slate-300 px-3 py-1.5 rounded-md font-semibold text-xs transition"
            >
              <Upload size={14} />
              PDF / Görsel Yükle
            </button>
          </div>

          <div className="text-xs text-slate-500 mt-3">
            Kayıt adı otomatik: {firma.name || "Firma Adı"} Kurul {periodLabel}.pdf
          </div>
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-bold text-slate-800">
            {periodLabel} Evrakları
          </h2>

          {loading && <span className="text-sm text-slate-500">Yükleniyor...</span>}
        </div>

        {selectedFiles.length === 0 ? (
          <div className="text-center border border-slate-200 rounded-xl p-4 text-slate-500 text-sm">
            Evrak yüklenmedi.
          </div>
        ) : (
          <div className="space-y-2">
            {selectedFiles.map((file, index) => (
              <div
                key={file._id || file.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border border-slate-200 rounded-xl px-3 py-2"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                    <FileText size={20} />
                  </div>

                  <div className="min-w-0">
                    <div className="font-semibold text-slate-800 truncate">
                      {index + 1}. {file.originalName || file.name}
                    </div>

                    <div className="text-xs text-slate-500">
                      {formatSize(file.size)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                  {file.url && (
                   <button
  type="button"
  onClick={() => handleOpenFile(file)}
  className="text-blue-600 hover:bg-blue-50 px-3 py-2 rounded-lg text-sm font-semibold"
>
  Aç
</button>
                  )}

                  <button
                    type="button"
                    onClick={() => removeFile(file._id || file.id)}
                    className="inline-flex items-center gap-1 text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg text-sm font-semibold transition"
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
        <h2 className="text-base font-bold text-slate-800 mb-2">
          Kurul Takip Tablosu
        </h2>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full min-w-[950px] text-sm">
            <thead className="bg-slate-50">
              <tr>
                {MONTHS.map((m, index) => (
                  <th
                    key={m}
                    onClick={() => setMonth(index + 1)}
                    className={`px-3 py-3 text-center border-b border-r last:border-r-0 cursor-pointer whitespace-nowrap ${
                      month === index + 1
                        ? "bg-blue-50 text-blue-700"
                        : "text-slate-700"
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
                  const required = isRequiredMonth(rowMonth);

                  return (
                    <td
                      key={m}
                      onClick={() => setMonth(rowMonth)}
                      className={`px-3 py-4 text-center border-r last:border-r-0 cursor-pointer ${
                        month === rowMonth ? "bg-blue-50" : "bg-white"
                      }`}
                    >
                      <div className="flex flex-col items-center gap-1">
                        {!required ? (
                          <>
                            <Minus size={22} className="text-slate-400" />
                            <span className="text-xs font-semibold text-slate-400">
                              Zorunlu Değil
                            </span>
                          </>
                        ) : hasFile ? (
                          <>
                            <CheckCircle2 size={22} className="text-green-600" />
                            <span className="text-xs font-semibold text-green-700">
                              {count} evrak
                            </span>
                          </>
                        ) : (
                          <>
                            <XCircle size={22} className="text-red-500" />
                            <span className="text-xs font-semibold text-red-500">
                              Eksik
                            </span>
                          </>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>

        <p className="text-xs text-slate-500 mt-2">
          Başlangıç ayına göre zorunlu dönemler otomatik belirlenir. Gri aylar kurul
          açısından zorunlu olmayan dönemlerdir.
        </p>
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