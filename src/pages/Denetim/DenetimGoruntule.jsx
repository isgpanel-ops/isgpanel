import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  AlertTriangle,
  Calendar,
  FileText,
  FolderOpen,
  ShieldCheck,
  X,
} from "lucide-react";
import { API_BASE } from "../../config/api";

const formatDate = (value) => {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "-";
  }
};

const getDocId = (doc) => doc?.id || doc?._id || doc?.documentId;

const isImageFile = (doc) => {
  const source = `${doc?.fileName || ""} ${doc?.fileUrl || ""} ${doc?.url || ""}`;
  return /\.(png|jpe?g|webp|gif|bmp)$/i.test(source);
};

const documentFileUrl = (token, doc) => {
  const id = getDocId(doc);
  if (!id) return "";
  return `${API_BASE}/api/audit-packages/public/${encodeURIComponent(
    token
  )}/documents/${encodeURIComponent(id)}/file`;
};

export default function DenetimGoruntule() {
  const { publicToken } = useParams();
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeCategory, setActiveCategory] = useState("summary");
  const [previewDoc, setPreviewDoc] = useState(null);

  useEffect(() => {
    let alive = true;

    const loadPackage = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `${API_BASE}/api/audit-packages/public/${encodeURIComponent(publicToken)}`
        );

        if (!response.ok) {
          throw new Error("invalid");
        }

        const data = await response.json();
        if (alive) {
          setPayload(data);
          const first = (data?.categories || []).find((cat) => cat.count > 0);
          setActiveCategory(first?.id || first?.category || first?.name || "summary");
        }
      } catch {
        if (alive) {
          setError(
            "Bu denetim bağlantısı geçersiz, iptal edilmiş veya artık kullanılamıyor."
          );
        }
      } finally {
        if (alive) setLoading(false);
      }
    };

    loadPackage();
    return () => {
      alive = false;
    };
  }, [publicToken]);

  const auditPackage = payload?.package || payload?.auditPackage || payload || {};
  const categories = useMemo(
    () => (payload?.categories || []).filter((cat) => Number(cat.count || 0) > 0),
    [payload]
  );
  const active = useMemo(() => {
    return categories.find((cat) =>
      [cat.id, cat.category, cat.name].includes(activeCategory)
    );
  }, [categories, activeCategory]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-5 text-sm text-slate-600 shadow-sm">
          Denetim dosyası yükleniyor...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md rounded-xl border border-rose-200 bg-white p-6 shadow-sm">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-rose-50 text-rose-600">
            <AlertTriangle size={22} />
          </div>
          <h1 className="text-xl font-bold text-[#042f4b]">
            Denetim bağlantısı geçersiz
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  const totalDocuments =
    auditPackage.documentCount ||
    payload?.documentCount ||
    categories.reduce((sum, cat) => sum + Number(cat.count || 0), 0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src="/logo-panel.png" alt="İSG Panel" className="h-12 w-auto" />
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                DENETİM GÖRÜNTÜLEME
              </span>
            </div>
            <div className="text-sm text-slate-500">
              Dosya No:{" "}
              <span className="font-semibold text-[#042f4b]">
                {auditPackage.packageNumber || "-"}
              </span>
            </div>
          </div>

          <div>
            <h1 className="text-2xl font-bold text-[#042f4b]">
              {auditPackage.companyName || payload?.company?.name || "Firma"}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Dijital İSG Denetim Dosyası
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs text-slate-500">Oluşturulma</div>
              <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Calendar size={15} /> {formatDate(auditPackage.createdAt)}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs text-slate-500">Toplam Belge</div>
              <div className="mt-1 text-lg font-bold text-[#042f4b]">
                {totalDocuments}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs text-slate-500">Kategori</div>
              <div className="mt-1 text-lg font-bold text-[#042f4b]">
                {categories.length}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[280px_1fr] lg:px-8">
        <aside className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <button
            type="button"
            onClick={() => setActiveCategory("summary")}
            className={`mb-2 flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${
              activeCategory === "summary"
                ? "bg-[#042f4b] text-white"
                : "text-slate-700 hover:bg-slate-50"
            }`}
          >
            <span className="flex items-center gap-2">
              <ShieldCheck size={16} /> Denetim Özeti
            </span>
          </button>

          <div className="space-y-1">
            {categories.map((cat) => {
              const key = cat.id || cat.category || cat.name;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveCategory(key)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${
                    activeCategory === key
                      ? "bg-emerald-50 text-emerald-800"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <FolderOpen size={15} /> {cat.name || cat.category}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          {activeCategory === "summary" ? (
            <>
              <h2 className="text-lg font-bold text-[#042f4b]">Denetim Özeti</h2>
              <p className="mt-1 text-sm text-slate-500">
                Bu paket yalnızca oluşturulduğu anda seçilen belgeleri içerir.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {categories.map((cat) => (
                  <button
                    key={cat.id || cat.category || cat.name}
                    type="button"
                    onClick={() => setActiveCategory(cat.id || cat.category || cat.name)}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-left hover:border-emerald-200 hover:bg-emerald-50"
                  >
                    <div className="font-semibold text-slate-900">
                      {cat.name || cat.category}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      {cat.count} belge
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-[#042f4b]">
                    {active?.name || active?.category || "Belgeler"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {active?.count || 0} belge
                  </p>
                </div>
              </div>

              <div className="mt-4 divide-y divide-slate-100">
                {(active?.documents || []).map((doc) => (
                  <div
                    key={getDocId(doc)}
                    className="grid gap-3 py-3 sm:grid-cols-[1fr_auto]"
                  >
                    <div>
                      <div className="flex items-center gap-2 font-semibold text-slate-900">
                        <FileText size={16} className="text-[#042f4b]" />
                        {doc.title || doc.name || doc.fileName || "Belge"}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                        {doc.date && <span>{formatDate(doc.date)}</span>}
                        {doc.revision && <span>Rev. {doc.revision}</span>}
                        {doc.signatureStatus && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5">
                            {doc.signatureStatus}
                          </span>
                        )}
                        {doc.status && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5">
                            {doc.status}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPreviewDoc(doc)}
                      className="h-9 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                      Görüntüle
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </main>

      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 p-3">
          <div className="mx-auto flex h-full max-w-6xl flex-col rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate font-semibold text-[#042f4b]">
                  {previewDoc.title || previewDoc.name || previewDoc.fileName || "Belge"}
                </div>
                <div className="text-xs text-slate-500">Denetim dosyası belgesi</div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                aria-label="Kapat"
              >
                <X size={18} />
              </button>
            </div>
            <div className="min-h-0 flex-1 bg-slate-100">
              {isImageFile(previewDoc) ? (
                <div className="flex h-full items-center justify-center p-4">
                  <img
                    src={documentFileUrl(publicToken, previewDoc)}
                    alt={previewDoc.title || "Belge"}
                    className="max-h-full max-w-full rounded bg-white object-contain"
                  />
                </div>
              ) : (
                <iframe
                  title={previewDoc.title || "Belge"}
                  src={documentFileUrl(publicToken, previewDoc)}
                  className="h-full w-full border-0"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
