import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Upload,
  FileText,
  Save,
  Trash2,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { useFirmalar } from "../../context/FirmaContext";

import ConfirmModal from "../../components/ui/ConfirmModal";

const RAW_API_ORIGIN =
  (import.meta.env.VITE_API_URL || import.meta.env.VITE_API || "").trim() ||
  "https://api.isgpanel.tr";

const API_ORIGIN = RAW_API_ORIGIN.replace(/\/+$/, "").replace(/\/api$/i, "");

const API_BASE = `${API_ORIGIN}/api`;

const DOCS_SYNC_KEY = "docs:lastChangeAt";
const IS_HIJYEN_SYNC_KEY = "isHijyen:lastChangeAt";
const MAX_FILE_SIZE = 5 * 1024 * 1024;

function getToken() {
  return (
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("accessToken") ||
    ""
  );
}

function normalizeFirma(f) {
  if (!f) return { id: "", name: "" };

  return {
    id: String(f._id || f.id || f.firmaId || f.sgkSicilNo || f.sgkNo || ""),
    name: String(f.firmaAdi || f.unvan || f.name || f.ad || f.label || ""),
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

export default function IsHijyenRaporlari() {
  const now = new Date();
  const fileInputRef = useRef(null);
  const { selectedFirm } = useFirmalar();

  const firma = useMemo(() => normalizeFirma(selectedFirm), [selectedFirm]);

  const [year, setYear] = useState(now.getFullYear());
  const [files, setFiles] = useState([]);
  const [savedToBelgelerim, setSavedToBelgelerim] = useState(false);
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

  const currentYear = now.getFullYear();

const years = [
  currentYear - 2,
  currentYear - 1,
  currentYear,
];

useEffect(() => {
  loadIsHijyenRaporlari();
}, [firma.id, year]);

async function loadIsHijyenRaporlari() {
  if (!firma.id) return;

  try {
    const res = await fetch(
      `${API_BASE}/is-hijyen-raporlari?firmaId=${firma.id}&year=${year}`,
      {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      }
    );

    const json = await res.json();

    if (!res.ok || !json.ok) {
      throw new Error(json.message || "İş hijyen raporları alınamadı.");
    }

    const item = Array.isArray(json.items) ? json.items[0] : null;

    setFiles(item?.files || []);
    setSavedToBelgelerim(Boolean(item?.savedToBelgelerim));
  } catch (err) {
    console.error("İş hijyen raporları yüklenemedi:", err);
  }
}

  function renameFile(file, index, total) {
    const ext = file.name?.includes(".")
      ? file.name.substring(file.name.lastIndexOf("."))
      : file.type?.includes("pdf")
      ? ".pdf"
      : ".jpg";

    const suffix = total > 1 ? ` - ${index + 1}` : "";
    const name = safeFileName(
      `${firma.name} - İş Hijyen Ölçüm Raporları ${year}${suffix}${ext}`
    );

    return new File([file], name, {
      type: file.type,
      lastModified: file.lastModified,
    });
  }

  async function handleFileChange(e) {
    const rawFiles = Array.from(e.target.files || []);
    e.target.value = "";

    if (!firma.id) {
      alert("Lütfen önce üst navbar üzerinden firma seçin.");
      return;
    }

    if (!rawFiles.length) return;

    const overLimit = rawFiles.find((file) => file.size > MAX_FILE_SIZE);
    if (overLimit) {
      alert(`"${overLimit.name}" dosyası 5 MB sınırını aşıyor.`);
      return;
    }

    try {
      setUploading(true);

      const uploadFiles = rawFiles.map((file, index) =>
        renameFile(file, index, rawFiles.length)
      );

      const formData = new FormData();
      formData.append("firmaId", firma.id);
      formData.append("firmaAdi", firma.name);
      formData.append("year", year);
      formData.append("raporKey", "is-hijyen-olcumleri");
      formData.append("raporAdi", "İş Hijyen Ölçüm Raporları");
      formData.append("belgeAdi", `${firma.name} - İş Hijyen Ölçüm Raporları ${year}`);

      uploadFiles.forEach((file) => formData.append("files", file));

      const res = await fetch(`${API_BASE}/is-hijyen-raporlari/upload`, {
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

      setFiles(json.files || []);

      localStorage.setItem("isHijyen:lastChangeAt", String(Date.now()));
      localStorage.setItem("docs:lastChangeAt", String(Date.now()));
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
        const res = await fetch(`${API_BASE}/is-hijyen-raporlari/file/${fileId}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        });

        const json = await res.json();

        if (!res.ok || !json.ok) {
          throw new Error(json.message || "Dosya silinemedi.");
        }

        setFiles((prev) =>
          prev.filter((file) => (file._id || file.id) !== fileId)
        );

        localStorage.setItem(IS_HIJYEN_SYNC_KEY, String(Date.now()));
        localStorage.setItem(DOCS_SYNC_KEY, String(Date.now()));

        window.dispatchEvent(new Event(IS_HIJYEN_SYNC_KEY));
        window.dispatchEvent(new Event(DOCS_SYNC_KEY));
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

    if (!files.length) {
      alert("İş hijyen raporu için önce PDF veya görsel yükleyin.");
      return;
    }

    try {
      setSaving(true);

      const res = await fetch(`${API_BASE}/is-hijyen-raporlari/save-belgelerim`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          firmaId: firma.id,
          firmaAdi: firma.name,
          year,
          raporKey: "is-hijyen-olcumleri",
          raporAdi: "İş Hijyen Ölçüm Raporları",
          belgeAdi: `${firma.name} - İş Hijyen Ölçüm Raporları ${year}`,
          category: "periyodik-is-hijyeni",
          subCategory: "is-hijyen-olcumleri",
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.message || "Belgelerim’e kaydedilemedi.");
      }

      setSavedToBelgelerim(true);

      localStorage.setItem("isHijyen:lastChangeAt", String(Date.now()));
      localStorage.setItem("docs:lastChangeAt", String(Date.now()));

      alert("Belgelerim, Periyodik & İş Hijyeni sekmesine kaydedildi ✅");
    } catch (err) {
      console.error(err);
      alert(err.message || "Belgelerim’e kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-5">
        <div>
          <h3 className="text-base font-semibold text-slate-900 leading-tight">
  İş Hijyen Raporları
</h3>

<p className="text-[13px] text-slate-500 mt-1 leading-relaxed">
            Gürültü, aydınlatma, termal konfor, toz, gaz, titreşim ve benzeri iş
            hijyen ölçüm raporlarını PDF veya görsel olarak yükleyebilirsiniz.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="border border-slate-200 rounded-xl px-4 py-3 bg-slate-50 min-w-[220px]">
            <div className="text-xs text-slate-500 mb-1">Firma</div>
            <div className="font-bold text-slate-900 truncate">
              {firma.id ? firma.name : "Navbar’dan firma seçin"}
            </div>
          </div>

          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="border border-slate-200 rounded-xl px-4 py-3 bg-white font-semibold text-slate-800"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="application/pdf,image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="border-2 border-dashed border-slate-300 rounded-xl p-5 text-center bg-slate-50">
        <div className="w-11 h-11 mx-auto rounded-full bg-blue-600 text-white flex items-center justify-center mb-3">
          {uploading ? (
            <RefreshCw size={22} className="animate-spin" />
          ) : (
            <Upload size={22} />
          )}
        </div>

        <div className="font-semibold text-slate-800">
          {uploading ? "Yükleniyor..." : "PDF / Görsel Yükle"}
        </div>

        <div className="text-xs text-slate-500 mt-1 mb-4">
          Aynı alana birden fazla PDF veya görsel yüklenebilir. Maksimum dosya boyutu 5 MB.
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-3 py-1.5 rounded-md font-semibold text-xs transition"
        >
          <Upload size={14} />
          Dosya Seç
        </button>
      </div>

      <div className="mt-4">
        {files.length === 0 ? (
          <div className="text-center border border-slate-200 rounded-xl p-3 text-slate-500 text-sm">
            Henüz iş hijyen raporu yüklenmedi.
          </div>
        ) : (
          <div className="space-y-2">
            {files.map((file, index) => (
              <div
                key={file._id || file.id || index}
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

      <div className="mt-4 flex justify-end">
  <button
    onClick={saveToBelgelerim}
    disabled={saving || uploading || !files.length}
    className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md font-semibold text-xs transition
      ${
        savedToBelgelerim
          ? "bg-green-600 hover:bg-green-700 text-white"
          : "bg-green-600 hover:bg-green-700 text-white"
      }
      disabled:bg-gray-300 disabled:cursor-not-allowed`}
  >
    {savedToBelgelerim ? <CheckCircle2 size={17} /> : <Save size={17} />}

    {saving
      ? "Kaydediliyor..."
      : savedToBelgelerim
      ? "Belgelerim’e Kaydedildi"
      : "Belgelerime Kaydet"}
  </button>
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