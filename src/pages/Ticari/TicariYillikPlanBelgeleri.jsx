import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";

const API_BASE =
  (import.meta?.env?.VITE_API_URL && import.meta.env.VITE_API_URL.trim()) ||
  "http://localhost:5001";

const DOC_SCOPE = "ticari";
const LS_ADMIN_USER_KEY = "isgpanel:adminSelectedUser";
const user = JSON.parse(localStorage.getItem("user") || "{}");
const userRole = (user?.role || "").toLowerCase();
function getAuthHeader() {
  let token = localStorage.getItem("token");
  if (!token) {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.endsWith(":token")) {
        const t = localStorage.getItem(k);
        if (t) {
          token = t;
          break;
        }
      }
    }
  }
  if (!token) return {};
  const t = String(token).trim();
  return { Authorization: /^bearer\s+/i.test(t) ? t : `Bearer ${t}` };
}

const pad2 = (n) => String(n).padStart(2, "0");
const toDisplayDate = (value) => {
  if (!value) return "";
  if (typeof value === "string") {
    const iso = value.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      const [y, m, d] = iso.split("-");
      return `${d}.${m}.${y}`;
    }
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(value)) return value;
  }
  try {
    const dt = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(dt.getTime())) return "";
    return `${pad2(dt.getDate())}.${pad2(dt.getMonth() + 1)}.${dt.getFullYear()}`;
  } catch {
    return "";
  }
};

async function fetchAssignedFirms(userId) {
  const headers = getAuthHeader();
  if (!headers.Authorization) return [];

  const res = await axios.get(`${API_BASE}/api/firma`, { headers });
  const firms = Array.isArray(res.data) ? res.data : [];

  const filtered =
    !userId || userId === "all"
      ? firms
      : firms.filter((f) => String(f?.atanmisKullanici || "") === String(userId));

  return filtered
    .map((f) => ({
      id: String(f?._id || f?.id || ""),
      firmaAdi: f?.firmaAdi || f?.name || "",
    }))
    .filter((x) => x.id);
}

async function fetchDocsForFirmIds(firmIds, category) {
  const headers = getAuthHeader();
  if (!headers.Authorization) return [];
  if (!firmIds?.length) return [];

  const out = [];
  for (const firmId of firmIds) {
    try {
      const res = await axios.get(`${API_BASE}/api/documents`, {
        headers,
        params: { firmaId: firmId, category, scope: DOC_SCOPE },
      });
      const list = res?.data?.documents || res?.data || [];
      if (Array.isArray(list)) out.push(...list);
    } catch (e) {
      console.error("fetch docs error:", firmId, e);
    }
  }

  out.sort((a, b) => {
    const da = new Date(a?.tarih || a?.createdAt || 0).getTime();
    const db = new Date(b?.tarih || b?.createdAt || 0).getTime();
    return db - da;
  });

  return out;
}

export default function TicariYillikPlanBelgeleri() {

  const handleDelete = async (doc) => {
    if (!window.confirm("Belge silinsin mi?")) return;

    try {
      const headers = getAuthHeader();
      await axios.delete(`${API_BASE}/api/documents/${doc._id || doc.id}`, { headers });

      setDocs((prev) =>
        prev.filter((d) => (d._id || d.id) !== (doc._id || doc.id))
      );
    } catch (e) {
      alert("Silinemedi");
    }
  };
  const location = useLocation();

  const [selectedUserId, setSelectedUserId] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    const u = (p.get("u") || "").trim();
    if (u) return u;
    return localStorage.getItem(LS_ADMIN_USER_KEY) || "all";
  });

  const [firms, setFirms] = useState([]);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(false);

  // ?u değişirse güncelle
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    const u = (p.get("u") || "").trim();
    if (u) {
      setSelectedUserId(u);
      localStorage.setItem(LS_ADMIN_USER_KEY, u);
    } else {
      setSelectedUserId(localStorage.getItem(LS_ADMIN_USER_KEY) || "all");
    }
  }, [location.search]);

  // firms
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const list = await fetchAssignedFirms(selectedUserId);
        if (!alive) return;
        setFirms(list);
      } catch (e) {
        console.error(e);
        if (alive) setFirms([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => (alive = false);
  }, [selectedUserId]);

  // docs
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const firmIds = firms.map((f) => f.id);
        const list = await fetchDocsForFirmIds(firmIds, "yillik");
        if (!alive) return;
        setDocs(Array.isArray(list) ? list : []);
      } catch (e) {
        console.error(e);
        if (alive) setDocs([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => (alive = false);
  }, [firms]);

  const rows = useMemo(() => docs || [], [docs]);

  return (
    <div className="bg-white rounded-xl border">
      <div className="px-4 py-3 border-b">
        <div className="text-sm font-semibold text-[#042f4b]">Yıllık Plan Belgeleri</div>
        <div className="text-xs text-gray-500">
          (Geçici ekran) Listeleme çalışır; bireyseldeki filtre/arsiv/preview yapısını sırayla buraya taşıyacağız.
        </div>
      </div>

      {loading ? (
        <div className="p-6 text-sm text-gray-600">Yükleniyor…</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-gray-600">Belge</th>
                <th className="px-3 py-2 text-left text-gray-600">Firma</th>
                <th className="px-3 py-2 text-left text-gray-600">Tarih</th>
                <th className="px-3 py-2 text-right text-gray-600">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr className="border-t">
                  <td className="px-3 py-6 text-center text-gray-500" colSpan={4}>
                    Kayıtlı yıllık plan belgesi yok.
                  </td>
                </tr>
              ) : (
                rows.map((doc, idx) => {
                  const key = doc?._id || doc?.id || `row-${idx}`;
                  const title = doc?.baslik || doc?.title || doc?.belgeAdi || "Yıllık Eğitim Planı (YEP)";
                  const dateText = toDisplayDate(doc?.tarih || doc?.createdAt) || "-";
                  const fileUrl = doc?.fileUrl || doc?.url;

                  return (
                    <tr key={key} className="border-t hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-900 truncate max-w-[320px]">
                        {title}
                      </td>
                      <td className="px-3 py-2 text-gray-700 truncate max-w-[260px]">
  {title}
</td>
                      <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{dateText}</td>
                      <td className="px-3 py-2 text-right space-x-2">
  {fileUrl ? (
    <a
      href={fileUrl}
      target="_blank"
      rel="noreferrer"
      className="px-3 py-1 rounded-lg border text-[11px] text-gray-700 hover:bg-gray-100"
    >
      Görüntüle
    </a>
  ) : (
    <span className="text-[11px] text-gray-400">PDF yok</span>
  )}

  {userRole !== "ticari" && (
    <button
      className="px-3 py-1 rounded-lg border text-[11px] text-red-600 hover:bg-red-50"
      onClick={() => handleDelete(doc)}
    >
      Sil
    </button>
  )}
</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
