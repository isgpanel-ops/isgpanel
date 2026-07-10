import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { API_BASE } from "../../config/api";

function authHeader() {
  const token = localStorage.getItem("token") || sessionStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function toDateInput(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  } catch {
    return "";
  }
}

/* ✅ Sıralama yardımcıları (tanımlı olsun) */
const EMPTY_LAST = "\uffff"; // boşlar en sona gitsin
function asText(v) {
  if (v === null || v === undefined) return "";
  return String(v).trim().toLowerCase();
}

export default function SuperKullanicilar() {
 const [q, setQ] = useState("");
const [type, setType] = useState(""); // "" | "bireysel" | "ticari"
const [status, setStatus] = useState(""); // "" | "aktif" | "askida" | "pasif" | "blokeli"
const [page, setPage] = useState(1);

const [listFilter, setListFilter] = useState(""); // "" | "bireysel_az" | "ticari_az" | "bireysel_new" | "ticari_new"
const pageSize = 25;
const sortBy = "fullName";
const sortDir = "asc";
  
 
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  // ✅ Accordion: hangi ticari admin (org) açık?
  const [expandedOrgs, setExpandedOrgs] = useState({}); // { [orgId]: true }

  // ✅ admin altı kullanıcıları cache
  const [orgChildren, setOrgChildren] = useState({}); // { [orgId]: [] }
  const [orgChildrenLoading, setOrgChildrenLoading] = useState({}); // { [orgId]: true }

  // Drawer
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [saving, setSaving] = useState(false);

  // ✅ Ticari admin / kullanıcı ayrımı
  const isTicari = (u) => u?.type === "ticari";
  const isAdminRole = (role) => role === "admin" || role === "ticari_admin";
  const isTicariAdmin = (u) => isTicari(u) && isAdminRole(u?.role);

  async function fetchOrgChildren(orgId) {
    if (!orgId) return;

    const key = String(orgId);
    if (Array.isArray(orgChildren[key])) return;

    setOrgChildrenLoading((p) => ({ ...p, [key]: true }));
    try {
      const params = new URLSearchParams();
      params.set("type", "ticari");
      params.set("orgId", key);
      params.set("organizationId", key);
      params.set("page", "1");
      params.set("limit", "500");

      const r = await axios.get(`${API_BASE}/super/users?${params.toString()}`, {
        headers: authHeader(),
      });

      const items = r.data?.items || [];

      const sameOrg = items.filter((u) => {
        const uOrg = String(u?.orgId || u?.org?._id || u?.org || "");
        return uOrg === key;
      });

      const children = sameOrg.filter(
        (u) => u?.type === "ticari" && !(u?.role === "admin" || u?.role === "ticari_admin")
      );

      setOrgChildren((p) => ({ ...p, [key]: children }));
    } catch {
      setOrgChildren((p) => ({ ...p, [key]: [] }));
    } finally {
      setOrgChildrenLoading((p) => ({ ...p, [key]: false }));
    }
  }

  function toggleOrg(orgId) {
    if (!orgId) return;
    const key = String(orgId);

    setExpandedOrgs((prev) => {
      const nextOpen = !prev[key];

      if (nextOpen && !Array.isArray(orgChildren[key])) {
        fetchOrgChildren(key);
      }

      return { ...prev, [key]: nextOpen };
    });
  }

  // ✅ Filtre değişince accordion’ları kapat
  useEffect(() => {
  setExpandedOrgs({});
  setOrgChildren({});
  setOrgChildrenLoading({});
}, [q, type, status, listFilter]);

  // Actions - Block
  const [blockReason, setBlockReason] = useState("");
  const [unblockReason, setUnblockReason] = useState("");

  // Actions - Identity
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [identityReason, setIdentityReason] = useState("");

  // Actions - Subscription extend
  const [extendDays, setExtendDays] = useState(30);
  const [extendReason, setExtendReason] = useState("");

  // Actions - Org
  const [orgStatus, setOrgStatus] = useState("aktif"); // aktif | askida | pasif
  const [pilotEnd, setPilotEnd] = useState(""); // yyyy-mm-dd
  const [licenseEnd, setLicenseEnd] = useState(""); // yyyy-mm-dd
  const [planCode, setPlanCode] = useState("");
  const [orgReason, setOrgReason] = useState("");

  const qs = useMemo(() => {
  const p = new URLSearchParams();
  if (q.trim()) p.set("q", q.trim());
  if (type) p.set("type", type);
  if (status) p.set("status", status);

  const isClientSortedFilter =
  listFilter === "" ||
  listFilter === "bireysel_az" ||
  listFilter === "ticari_az" ||
  listFilter === "bireysel_new" ||
  listFilter === "ticari_new";

 if (isClientSortedFilter) {
  p.set("page", "1");
  p.set("limit", "5000");
  p.set("pageSize", "5000");
  p.set("perPage", "5000");
} else {
  p.set("page", String(page));
  p.set("limit", String(pageSize));
  p.set("pageSize", String(pageSize));
  p.set("perPage", String(pageSize));
}

  p.set("sortBy", sortBy);
  p.set("sortDir", sortDir);

  return p.toString();
}, [q, type, status, page, listFilter]);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const r = await axios.get(`${API_BASE}/super/users?${qs}`, { headers: authHeader() });

      const payload = r.data || {};
      const items = Array.isArray(payload.items) ? payload.items : [];

      // ✅ totalPages backend yoksa hesapla (pageSize’e göre)
      const total = Number(payload.total || items.length || 0);

const isClientSortedFilter =
  listFilter === "" ||
  listFilter === "bireysel_az" ||
  listFilter === "ticari_az" ||
  listFilter === "bireysel_new" ||
  listFilter === "ticari_new";

const totalPages = isClientSortedFilter
  ? Math.max(1, Math.ceil(items.length / pageSize))
  : payload.totalPages || (pageSize ? Math.max(1, Math.ceil(total / pageSize)) : 1);

setData({
  ...payload,
  items,
  total: isClientSortedFilter ? items.length : total,
  totalPages,
});
    } catch (e) {
      setErr(e?.response?.data?.message || "Kullanıcılar alınamadı");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [qs]); // eslint-disable-line

  async function openUser(u) {
    setSelected(u);
    setOpen(true);
    setDetail(null);

    // reset
    setBlockReason("");
    setUnblockReason("");
    setEditName("");
    setEditEmail("");
    setIdentityReason("");
    setExtendDays(30);
    setExtendReason("");
    setOrgStatus("aktif");
    setPilotEnd("");
    setLicenseEnd("");
    setPlanCode("");
    setOrgReason("");

    try {
      const r = await axios.get(`${API_BASE}/super/users/${u._id}`, { headers: authHeader() });
      setDetail(r.data);

      setEditName(r.data?.fullName || "");
      setEditEmail(r.data?.email || "");

      if (r.data?.org) {
        setOrgStatus(r.data.org.lifecycleStatus || "aktif");
        setPilotEnd(toDateInput(r.data.org.pilotEndAt));
        setLicenseEnd(toDateInput(r.data.org.licenseEndAt));
        setPlanCode(r.data.org.planCode || "");
      }
    } catch (e) {
      setErr(e?.response?.data?.message || "Kullanıcı detayı alınamadı");
    }
  }

  function closeDrawer() {
    setOpen(false);
    setSelected(null);
    setDetail(null);
  }

  async function refreshDetail() {
    if (!selected?._id) return;
    try {
      const r = await axios.get(`${API_BASE}/super/users/${selected._id}`, { headers: authHeader() });
      setDetail(r.data);

      if (r.data?.org) {
        setOrgStatus(r.data.org.lifecycleStatus || "aktif");
        setPilotEnd(toDateInput(r.data.org.pilotEndAt));
        setLicenseEnd(toDateInput(r.data.org.licenseEndAt));
        setPlanCode(r.data.org.planCode || "");
      }
    } catch {}
  }

  async function blockUser() {
    if (!detail?._id) return;
    if (!blockReason.trim()) {
      alert("Bloke sebebi zorunlu (log + bildirim).");
      return;
    }

    setSaving(true);
    try {
      await axios.post(
        `${API_BASE}/super/users/${detail._id}/block`,
        { reason: blockReason.trim() },
        { headers: authHeader() }
      );
      await refreshDetail();
      await load();
      setBlockReason("");
      alert("Kullanıcı bloke edildi.");
    } catch (e) {
      alert(e?.response?.data?.message || "Bloke başarısız");
    } finally {
      setSaving(false);
    }
  }

  async function unblockUser() {
    if (!detail?._id) return;
    if (!unblockReason.trim()) {
      alert("Bloke açma sebebi zorunlu (log + bildirim).");
      return;
    }

    setSaving(true);
    try {
      await axios.post(
        `${API_BASE}/super/users/${detail._id}/unblock`,
        { reason: unblockReason.trim() },
        { headers: authHeader() }
      );
      await refreshDetail();
      await load();
      setUnblockReason("");
      alert("Bloke kaldırıldı.");
    } catch (e) {
      alert(e?.response?.data?.message || "Bloke kaldırma başarısız");
    } finally {
      setSaving(false);
    }
  }

  async function updateIdentity() {
    if (!detail?._id) return;

    const name = editName.trim();
    const email = editEmail.trim().toLowerCase();

    if (!identityReason.trim()) {
      alert("Güncelleme açıklaması zorunlu (log + bildirim).");
      return;
    }
    if (!name) {
      alert("Ad soyad boş olamaz.");
      return;
    }
    if (!email || !email.includes("@")) {
      alert("Geçerli bir email gir.");
      return;
    }

    setSaving(true);
    try {
      await axios.patch(
        `${API_BASE}/super/users/${detail._id}/identity`,
        { name, email, reason: identityReason.trim() },
        { headers: authHeader() }
      );
      await refreshDetail();
      await load();
      setIdentityReason("");
      alert("Kimlik bilgileri güncellendi.");
    } catch (e) {
      alert(e?.response?.data?.message || "Güncelleme başarısız");
    } finally {
      setSaving(false);
    }
  }

  async function extendSubscription() {
    if (!detail?._id) return;

    const days = Number(extendDays);
    if (!extendReason.trim()) {
      alert("Süre uzatma açıklaması zorunlu (log + bildirim).");
      return;
    }
    if (!Number.isFinite(days) || days <= 0) {
      alert("Gün sayısı pozitif olmalı.");
      return;
    }

    setSaving(true);
    try {
      await axios.post(
        `${API_BASE}/super/users/${detail._id}/subscription/extend`,
        { days, reason: extendReason.trim(), syncOrg: true },
        { headers: authHeader() }
      );

      await refreshDetail();
      await load();

      if (detail?.orgId) {
        try {
          const r = await axios.get(`${API_BASE}/super/users/${detail._id}`, { headers: authHeader() });
          setDetail(r.data);
        } catch {}
      }

      setExtendReason("");
      alert("Süre uzatıldı.");
    } catch (e) {
      alert(e?.response?.data?.message || "Süre uzatma başarısız");
    } finally {
      setSaving(false);
    }
  }

  async function updateOrg() {
    if (!detail?._id) return;
    if (detail.type !== "ticari" || !detail.orgId) {
      alert("Kurum yönetimi sadece ticari ve kuruma bağlı kullanıcılar için.");
      return;
    }
    if (!orgReason.trim()) {
      alert("Kurum güncelleme açıklaması zorunlu (audit log).");
      return;
    }

    const body = {
      lifecycleStatus: orgStatus,
      planCode: planCode.trim(),
      pilotEndAt: pilotEnd ? new Date(`${pilotEnd}T23:59:59.999Z`).toISOString() : null,
      licenseEndAt: licenseEnd ? new Date(`${licenseEnd}T23:59:59.999Z`).toISOString() : null,
      reason: orgReason.trim(),
    };

    setSaving(true);
    try {
      await axios.patch(`${API_BASE}/super/users/${detail._id}/org`, body, { headers: authHeader() });
      await refreshDetail();
      await load();
      setOrgReason("");
      alert("Kurum bilgileri güncellendi (pilot/lisans/durum).");
    } catch (e) {
      alert(e?.response?.data?.message || "Kurum güncelleme başarısız");
    } finally {
      setSaving(false);
    }
  }

  // ✅ RETURN'DAN HEMEN ÖNCE
  const tableModel = useMemo(() => {
    const items = data?.items || [];

    const isAdminRoleLocal = (role) => role === "admin" || role === "ticari_admin";
    const isTicariAdminLocal = (u) => u?.type === "ticari" && isAdminRoleLocal(u?.role);

    // ✅ yeni/eski aboneler
    const now = Date.now();
    const isActiveSub = (u) => {
      if (!u?.subscriptionEnd) return false;
      const t = new Date(u.subscriptionEnd).getTime();
      return Number.isFinite(t) && t >= now;
    };

   const applySubFilter = (arr) => {
  if (listFilter === "bireysel_new" || listFilter === "ticari_new") {
    return arr.filter((u) => isActiveSub(u));
  }
  return arr;
};

   const sortArr = (arr) => {
  const isAZ = listFilter === "bireysel_az" || listFilter === "ticari_az";

  return [...arr].sort((a, b) => {
    if (isAZ) {
      const va = asText(a?.fullName) || EMPTY_LAST;
      const vb = asText(b?.fullName) || EMPTY_LAST;
      return String(va).localeCompare(String(vb), "tr", { sensitivity: "base" });
    }

    const ta = new Date(a?.subscriptionEnd || 0).getTime();
    const tb = new Date(b?.subscriptionEnd || 0).getTime();
    const va = Number.isFinite(ta) ? ta : 0;
    const vb = Number.isFinite(tb) ? tb : 0;
    return vb - va; // yeni → eski
  });
}; 

    // ✅ Bireysel modu
    if (type === "bireysel") {
  let rows = items.filter((u) => u?.type === "bireysel");
  rows = applySubFilter(rows);
  rows = sortArr(rows);

  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  rows = rows.slice(start, end);

  return { mode: "bireysel", rows, byOrg: new Map(), sortArr };
}

    const ticariItems = applySubFilter(items.filter((u) => u?.type === "ticari"));
    const bireyselItems = applySubFilter(items.filter((u) => u?.type === "bireysel"));

    const byOrg = new Map();
    for (const u of ticariItems) {
      const orgIdRaw = u?.orgId || u?.org?._id || u?.org;
      const orgKey = orgIdRaw ? String(orgIdRaw) : "";
      if (!orgKey) continue;

      if (!byOrg.has(orgKey)) byOrg.set(orgKey, { orgId: orgKey, admin: null, users: [] });
      const bucket = byOrg.get(orgKey);

      if (isTicariAdminLocal(u)) bucket.admin = u;
      else bucket.users.push(u);
    }

    let adminRows = Array.from(byOrg.values()).map((b) => b.admin).filter(Boolean);
    let topRows;

    if (type === "ticari") {
      topRows = sortArr(adminRows);
    } else if (!type) {
      const sortedBireysel = sortArr(bireyselItems);
      const sortedAdmins = sortArr(adminRows);
      topRows = [...sortedBireysel, ...sortedAdmins];
    } else {
      topRows = sortArr(adminRows);
    }

    // ✅ pageSize her koşulda etki etsin
    const start = (page - 1) * pageSize;
const end = start + pageSize;
topRows = topRows.slice(start, end);

return { mode: type || "tumu", rows: topRows, byOrg, sortArr };
 }, [data, type, listFilter, page]);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-2xl font-bold text-[#0a2b45]">Kullanıcılar</div>
          <div className="text-sm text-gray-500 mt-1">
            Denetim Merkezi: hareketleri izle, suistimali önle, bloke yönet.
          </div>
        </div>

        <button
          onClick={load}
          className="rounded-2xl border bg-white shadow-sm px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 active:scale-[0.99]"
        >
          Yenile
        </button>
      </div>

      {/* Filters */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-12 gap-3">
        <div className="md:col-span-6">
          <input
            className="w-full border rounded-2xl px-3 py-2 bg-white shadow-sm"
            placeholder="Ara: ad-soyad, mail, kurum"
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
          />
        </div>

        <div className="md:col-span-3">
          <select
  className="w-full border rounded-2xl px-3 py-2 bg-white shadow-sm"
  value={listFilter}
  onChange={(e) => {
    const v = e.target.value;
    setPage(1);
    setListFilter(v);

    if (v === "") setType("");
    if (v === "bireysel_az") setType("bireysel");
    if (v === "ticari_az") setType("ticari");
    if (v === "bireysel_new") setType("bireysel");
    if (v === "ticari_new") setType("ticari");
  }}
>
  <option value="">Tümü</option>
  <option value="bireysel_az">Bireysel (A → Z)</option>
  <option value="ticari_az">Ticari (A → Z)</option>
  <option value="bireysel_new">Bireysel Yeni Aboneler</option>
  <option value="ticari_new">Ticari Yeni Aboneler</option>
</select>
        </div>

        <div className="md:col-span-3">
          <select
            className="w-full border rounded-2xl px-3 py-2 bg-white shadow-sm"
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
          >
            <option value="">Tüm durumlar</option>
            <option value="aktif">aktif</option>
            <option value="pasif">pasif</option>
            <option value="blokeli">blokeli</option>
          </select>
        </div>
             

       
      </div>

      {err ? (
        <div className="mt-4 p-3 rounded-2xl bg-red-50 text-red-700 border border-red-200">{err}</div>
      ) : null}

      {/* Table */}
      <div className="mt-6 rounded-3xl border bg-white shadow-sm overflow-hidden">
  <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
    <div className="text-sm font-semibold text-gray-700">
      {loading ? "Yükleniyor..." : `${data?.total || 0} kayıt (backend)`}
    </div>
    <div className="text-xs text-gray-400">Sayfa: {page}</div>
  </div>

  {/* MOBİL KART LİSTE */}
  <div className="md:hidden p-3 space-y-3">
    {tableModel.rows.length === 0 ? (
      <div className="py-8 text-gray-500 text-center text-sm">Kayıt bulunamadı</div>
    ) : tableModel.mode === "bireysel" ? (
      tableModel.rows.map((u) => (
        <div key={u._id} className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-semibold text-gray-900 break-words">
                {u.fullName || "—"}
              </div>
              <div className="mt-1 text-sm text-gray-600 break-all">
                {u.email || "—"}
              </div>
            </div>

            <button
              onClick={() => openUser(u)}
              className="shrink-0 px-3 py-2 rounded-2xl border bg-white hover:bg-gray-50 text-sm"
            >
              Denetle
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <span className="px-2 py-1 rounded-xl border text-xs font-semibold bg-gray-50 text-gray-700 border-gray-200">
              {u.type || "—"}
            </span>
            <StatusBadge v={u.status} />
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 text-sm">
            <div>
              <div className="text-xs text-gray-500">Kurum / Rol</div>
              <div className="text-gray-800">—</div>
            </div>

            <div>
              <div className="text-xs text-gray-500">T.C. (maskeli)</div>
              <div className="font-mono text-gray-800">{u.tcMasked || "—"}</div>
            </div>

            <div>
              <div className="text-xs text-gray-500">Değişim</div>
              <div className="mt-1">
                <ChangePill nameCount={u.nameChangeCount} emailCount={u.emailChangeCount} />
              </div>
            </div>
          </div>
        </div>
      ))
    ) : (
      tableModel.rows.map((u) => {
        const orgIdRaw = u?.orgId || u?.org?._id || u?.org;
        const orgKey = orgIdRaw ? String(orgIdRaw) : "";
        const bucket = orgKey ? tableModel.byOrg.get(orgKey) : null;

        const isAdmin = u?.type === "ticari" && (u?.role === "admin" || u?.role === "ticari_admin");
        const isExpanded = !!expandedOrgs[orgKey];
        const cached = orgKey ? orgChildren[orgKey] : null;
        const childLoading = isAdmin ? !!orgChildrenLoading[orgKey] : false;

        let childUsers = isAdmin
          ? Array.isArray(cached)
            ? cached
            : bucket?.users || []
          : [];

        if (isAdmin && Array.isArray(childUsers) && childUsers.length) {
          childUsers = tableModel.sortArr(childUsers);
        }

        return (
          <div key={u._id} className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {isAdmin ? (
                    <button
                      type="button"
                      onClick={() => toggleOrg(orgKey)}
                      className="w-7 h-7 rounded-xl border bg-white hover:bg-gray-50 flex items-center justify-center shrink-0"
                      title={isExpanded ? "Kapat" : "Aç"}
                    >
                      {isExpanded ? "▾" : "▸"}
                    </button>
                  ) : null}

                  <div className="font-semibold text-gray-900 break-words">
                    {u.fullName || "—"}
                  </div>
                </div>

                <div className="mt-1 text-sm text-gray-600 break-all">
                  {u.email || "—"}
                </div>
              </div>

              <button
                onClick={() => openUser(u)}
                className="shrink-0 px-3 py-2 rounded-2xl border bg-white hover:bg-gray-50 text-sm"
              >
                Denetle
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <span className="px-2 py-1 rounded-xl border text-xs font-semibold bg-gray-50 text-gray-700 border-gray-200">
                {u.type || "—"}
              </span>
              <StatusBadge v={u.status} />
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 text-sm">
              <div>
                <div className="text-xs text-gray-500">Kurum / Rol</div>
                <div className="text-gray-800">
                  {u.type === "ticari" ? (
                    <>
                      <div>{u.orgName || "—"}</div>
                      <div className="text-xs text-gray-500 mt-0.5">Rol: {u.role || "—"}</div>
                    </>
                  ) : (
                    "—"
                  )}
                </div>
              </div>

              <div>
                <div className="text-xs text-gray-500">T.C. (maskeli)</div>
                <div className="font-mono text-gray-800">{u.tcMasked || "—"}</div>
              </div>

              <div>
                <div className="text-xs text-gray-500">Değişim</div>
                <div className="mt-1">
                  <ChangePill nameCount={u.nameChangeCount} emailCount={u.emailChangeCount} />
                </div>
              </div>
            </div>

            {isAdmin && isExpanded && childLoading ? (
              <div className="mt-3 rounded-2xl border bg-gray-50 px-3 py-3 text-sm text-gray-500">
                Kullanıcılar yükleniyor...
              </div>
            ) : null}

            {isAdmin && isExpanded && childUsers.length > 0 ? (
              <div className="mt-3 space-y-2">
                {childUsers.map((cu) => (
                  <div key={cu._id} className="rounded-2xl border bg-gray-50/70 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium text-gray-800 break-words">
                          ↳ {cu.fullName || "—"}
                        </div>
                        <div className="mt-1 text-sm text-gray-600 break-all">
                          {cu.email || "—"}
                        </div>
                      </div>

                      <button
                        onClick={() => openUser(cu)}
                        className="shrink-0 px-3 py-2 rounded-2xl border bg-white hover:bg-gray-50 text-sm"
                      >
                        Denetle
                      </button>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="px-2 py-1 rounded-xl border text-xs font-semibold bg-gray-50 text-gray-700 border-gray-200">
                        {cu.type || "—"}
                      </span>
                      <StatusBadge v={cu.status} />
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2 text-sm">
                      <div>
                        <div className="text-xs text-gray-500">Kurum / Rol</div>
                        <div className="text-gray-800">
                          <div>{cu.orgName || u.orgName || "—"}</div>
                          <div className="text-xs text-gray-500 mt-0.5">Rol: {cu.role || "—"}</div>
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-gray-500">T.C. (maskeli)</div>
                        <div className="font-mono text-gray-800">{cu.tcMasked || "—"}</div>
                      </div>

                      <div>
                        <div className="text-xs text-gray-500">Değişim</div>
                        <div className="mt-1">
                          <ChangePill nameCount={cu.nameChangeCount} emailCount={cu.emailChangeCount} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      })
    )}
  </div>

  {/* MASAÜSTÜ TABLO */}
  <div className="hidden md:block overflow-auto">
    <table className="min-w-[1200px] w-full text-sm">
      <thead className="bg-white">
        <tr className="border-b">
          <Th>Ad Soyad</Th>
          <Th>Email</Th>
          <Th>Tür</Th>
          <Th>Kurum / Rol</Th>
          <Th>T.C. (maskeli)</Th>
          <Th>Değişim</Th>
          <Th>Durum</Th>
          <Th className="text-right pr-4">İşlem</Th>
        </tr>
      </thead>

      <tbody className="divide-y">
        {tableModel.mode === "bireysel" ? (
          <>
            {tableModel.rows.map((u) => (
              <tr key={u._id} className="hover:bg-gray-50">
                <Td className="font-medium text-gray-900">{u.fullName || "—"}</Td>
                <Td className="text-gray-700">{u.email || "—"}</Td>
                <Td>{u.type || "—"}</Td>
                <Td>
                  <span className="text-gray-600">—</span>
                </Td>
                <Td className="font-mono text-gray-700">{u.tcMasked || "—"}</Td>
                <Td>
                  <ChangePill nameCount={u.nameChangeCount} emailCount={u.emailChangeCount} />
                </Td>
                <Td>
                  <StatusBadge v={u.status} />
                </Td>
                <Td className="text-right pr-4">
                  <button
                    onClick={() => openUser(u)}
                    className="px-3 py-2 rounded-2xl border bg-white hover:bg-gray-50"
                  >
                    Denetle
                  </button>
                </Td>
              </tr>
            ))}
            {tableModel.rows.length === 0 ? (
              <tr>
                <Td colSpan={8} className="py-8 text-gray-500 text-center">
                  Kayıt bulunamadı
                </Td>
              </tr>
            ) : null}
          </>
        ) : (
          <>
            {tableModel.rows.map((u) => {
              const orgIdRaw = u?.orgId || u?.org?._id || u?.org;
              const orgKey = orgIdRaw ? String(orgIdRaw) : "";
              const bucket = orgKey ? tableModel.byOrg.get(orgKey) : null;

              const isAdmin = u?.type === "ticari" && (u?.role === "admin" || u?.role === "ticari_admin");
              const isExpanded = !!expandedOrgs[orgKey];
              const cached = orgKey ? orgChildren[orgKey] : null;
              const childLoading = isAdmin ? !!orgChildrenLoading[orgKey] : false;

              let childUsers = isAdmin
                ? Array.isArray(cached)
                  ? cached
                  : bucket?.users || []
                : [];

              if (isAdmin && Array.isArray(childUsers) && childUsers.length) {
                childUsers = tableModel.sortArr(childUsers);
              }

              return (
                <React.Fragment key={u._id}>
                  <tr className="hover:bg-gray-50">
                    <Td className="font-medium text-gray-900">
                      <div className="flex items-center gap-2">
                        {isAdmin ? (
                          <button
                            type="button"
                            onClick={() => toggleOrg(orgKey)}
                            className="w-7 h-7 rounded-xl border bg-white hover:bg-gray-50 flex items-center justify-center"
                            title={isExpanded ? "Kapat" : "Aç"}
                          >
                            {isExpanded ? "▾" : "▸"}
                          </button>
                        ) : (
                          <span className="w-7 h-7 inline-block" />
                        )}

                        <span>{u.fullName || "—"}</span>
                      </div>
                    </Td>

                    <Td className="text-gray-700">{u.email || "—"}</Td>
                    <Td>{u.type || "—"}</Td>

                    <Td>
                      {u.type === "ticari" ? (
                        <div className="flex flex-col">
                          <span className="text-gray-900">{u.orgName || "—"}</span>
                          <span className="text-xs text-gray-500">Rol: {u.role || "—"}</span>
                        </div>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </Td>

                    <Td className="font-mono text-gray-700">{u.tcMasked || "—"}</Td>
                    <Td>
                      <ChangePill nameCount={u.nameChangeCount} emailCount={u.emailChangeCount} />
                    </Td>
                    <Td>
                      <StatusBadge v={u.status} />
                    </Td>

                    <Td className="text-right pr-4">
                      <button
                        onClick={() => openUser(u)}
                        className="px-3 py-2 rounded-2xl border bg-white hover:bg-gray-50"
                      >
                        Denetle
                      </button>
                    </Td>
                  </tr>

                  {isAdmin && isExpanded && childLoading ? (
                    <tr>
                      <Td colSpan={8} className="py-3 text-gray-500">
                        Kullanıcılar yükleniyor...
                      </Td>
                    </tr>
                  ) : null}

                  {isAdmin &&
                    isExpanded &&
                    childUsers.map((cu) => (
                      <tr key={cu._id} className="bg-gray-50/50 hover:bg-gray-50">
                        <Td className="font-medium text-gray-800">
                          <div className="flex items-center gap-2 pl-9">
                            <span className="text-gray-400">↳</span>
                            <span>{cu.fullName || "—"}</span>
                          </div>
                        </Td>
                        <Td className="text-gray-700">{cu.email || "—"}</Td>
                        <Td>{cu.type || "—"}</Td>
                        <Td>
                          <div className="flex flex-col">
                            <span className="text-gray-900">{cu.orgName || u.orgName || "—"}</span>
                            <span className="text-xs text-gray-500">Rol: {cu.role || "—"}</span>
                          </div>
                        </Td>
                        <Td className="font-mono text-gray-700">{cu.tcMasked || "—"}</Td>
                        <Td>
                          <ChangePill nameCount={cu.nameChangeCount} emailCount={cu.emailChangeCount} />
                        </Td>
                        <Td>
                          <StatusBadge v={cu.status} />
                        </Td>
                        <Td className="text-right pr-4">
                          <button
                            onClick={() => openUser(cu)}
                            className="px-3 py-2 rounded-2xl border bg-white hover:bg-gray-50"
                          >
                            Denetle
                          </button>
                        </Td>
                      </tr>
                    ))}
                </React.Fragment>
              );
            })}

            {tableModel.rows.length === 0 ? (
              <tr>
                <Td colSpan={8} className="py-8 text-gray-500 text-center">
                  Kayıt bulunamadı
                </Td>
              </tr>
            ) : null}
          </>
        )}
      </tbody>
    </table>
  </div>

  <div className="px-4 py-3 bg-white border-t flex items-center justify-between">
    <div className="text-xs text-gray-500">
      Toplam: {data?.total || 0} • Sayfa: {page} / {data?.totalPages || 1}
    </div>
    <div className="flex gap-2">
      <button
        disabled={page <= 1}
        onClick={() => setPage((p) => Math.max(1, p - 1))}
        className="px-3 py-2 rounded-2xl border bg-white hover:bg-gray-50 disabled:opacity-50"
      >
        Önceki
      </button>
      <button
        disabled={page >= (data?.totalPages || 1)}
        onClick={() => setPage((p) => p + 1)}
        className="px-3 py-2 rounded-2xl border bg-white hover:bg-gray-50 disabled:opacity-50"
      >
        Sonraki
      </button>
    </div>
  </div>
</div>

      {/* Drawer */}
      <Drawer open={open} onClose={closeDrawer} title="Kullanıcı Denetimi" subtitle={selected?.email || ""}>
        {!detail ? (
          <div className="text-gray-500">Detay yükleniyor...</div>
        ) : (
          <div className="space-y-6">
            {/* Summary */}
            <div className="rounded-3xl border bg-white shadow-sm p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm text-gray-500">Kullanıcı</div>
                  <div className="text-lg font-semibold text-gray-900">{detail.fullName || "—"}</div>
                  <div className="mt-1 text-sm text-gray-600">{detail.email || "—"}</div>

                  <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Info label="Tür" value={detail.type || "—"} />
                    <Info label="Durum" value={<StatusBadge v={detail.status} />} />
                    <Info label="T.C. (maskeli)" value={<span className="font-mono">{detail.tcMasked || "—"}</span>} />
                  </div>

                  {detail.type === "ticari" ? (
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                      <Info label="Kurum" value={detail.orgName || "—"} />
                      <Info label="Rol" value={detail.role || "—"} />
                      <Info label="Kurum ID" value={<span className="font-mono">{detail.orgId || "—"}</span>} />
                    </div>
                  ) : null}

                  <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Info label="Süre Bitişi" value={detail.subscriptionEnd ? toTRDateTime(detail.subscriptionEnd) : "—"} />
                    <Info
                      label="Otomatik Bloke"
                      value={
                        detail.autoBlockTriggered ? (
                          <span className="text-red-600 font-semibold">Evet</span>
                        ) : (
                          <span className="text-gray-700 font-semibold">Hayır</span>
                        )
                      }
                    />
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <div className="text-xs text-gray-400">Değişim Sayaçları</div>
                  <ChangePill nameCount={detail.nameChangeCount} emailCount={detail.emailChangeCount} big />
                  {detail.autoBlockTriggered ? (
                    <div className="text-xs text-red-600 font-semibold">Otomatik bloke tetiklendi</div>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Identity management */}
            <Section title="Kimlik Bilgileri (Ad Soyad / Email)" desc="Açıklama zorunlu (audit log + bildirim).">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Ad Soyad</div>
                  <input
                    className="w-full border rounded-2xl px-3 py-2 bg-white"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Ad Soyad"
                  />
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Email</div>
                  <input
                    className="w-full border rounded-2xl px-3 py-2 bg-white"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="ornek@mail.com"
                  />
                </div>
              </div>

              <div className="mt-3">
                <div className="text-xs text-gray-500 mb-1">Açıklama (zorunlu)</div>
                <textarea
                  className="w-full border rounded-2xl px-3 py-2 bg-white min-h-[90px]"
                  value={identityReason}
                  onChange={(e) => setIdentityReason(e.target.value)}
                  placeholder="Örn: Kullanıcı talebi ile düzeltildi / yanlış yazım"
                />
              </div>

              <button
                disabled={saving}
                onClick={updateIdentity}
                className="mt-3 w-full rounded-2xl bg-[#0a2b45] text-white px-4 py-2 text-sm font-semibold disabled:opacity-60"
              >
                Kaydet (Ad Soyad / Email)
              </button>

              <div className="mt-3 text-xs text-gray-500">
                Not: Sayaçlar artar; eşik aşılırsa sistem otomatik bloke tetikleyebilir.
              </div>
            </Section>

            {/* Subscription extend */}
            <Section title="Süre Yönetimi (Uzatma)" desc="Açıklama zorunlu (audit log + bildirim).">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Mevcut Bitiş</div>
                  <div className="rounded-2xl border bg-white px-3 py-2 font-semibold text-gray-900">
                    {detail.subscriptionEnd ? toTRDateTime(detail.subscriptionEnd) : "—"}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500 mb-1">Kaç gün uzat?</div>
                  <input
                    type="number"
                    min={1}
                    className="w-full border rounded-2xl px-3 py-2 bg-white"
                    value={extendDays}
                    onChange={(e) => setExtendDays(e.target.value)}
                  />
                </div>

                <div className="flex items-end">
                  <button
                    disabled={saving}
                    onClick={extendSubscription}
                    className="w-full rounded-2xl bg-emerald-600 text-white px-4 py-2 text-sm font-semibold disabled:opacity-60"
                  >
                    Süreyi Uzat
                  </button>
                </div>
              </div>

              <div className="mt-3">
                <div className="text-xs text-gray-500 mb-1">Açıklama (zorunlu)</div>
                <textarea
                  className="w-full border rounded-2xl px-3 py-2 bg-white min-h-[90px]"
                  value={extendReason}
                  onChange={(e) => setExtendReason(e.target.value)}
                  placeholder="Örn: Pilot çalışma uzatıldı / ödeme alındı / telafi"
                />
              </div>
            </Section>

            {/* Block management */}
            <Section title="Bloke Yönetimi" desc="Manuel bloke et / aç. Sebep zorunlu (log + bildirim).">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-3xl border p-4 bg-white">
                  <div className="text-sm font-semibold text-gray-900">Bloke Et</div>
                  <div className="text-xs text-gray-500 mt-1">Hesap “blokeli” olur.</div>
                  <textarea
                    className="mt-3 w-full border rounded-2xl px-3 py-2 bg-white min-h-[90px]"
                    placeholder="Bloke sebebi (zorunlu)"
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                  />
                  <button
                    disabled={saving || detail.status === "blokeli"}
                    onClick={blockUser}
                    className="mt-3 w-full rounded-2xl bg-red-600 text-white px-4 py-2 text-sm font-semibold disabled:opacity-60"
                  >
                    Bloke Et
                  </button>
                </div>

                <div className="rounded-3xl border p-4 bg-white">
                  <div className="text-sm font-semibold text-gray-900">Blokeyi Aç</div>
                  <div className="text-xs text-gray-500 mt-1">Hesap “aktif” olur.</div>
                  <textarea
                    className="mt-3 w-full border rounded-2xl px-3 py-2 bg-white min-h-[90px]"
                    placeholder="Bloke açma sebebi (zorunlu)"
                    value={unblockReason}
                    onChange={(e) => setUnblockReason(e.target.value)}
                  />
                  <button
                    disabled={saving || detail.status !== "blokeli"}
                    onClick={unblockUser}
                    className="mt-3 w-full rounded-2xl bg-[#0a2b45] text-white px-4 py-2 text-sm font-semibold disabled:opacity-60"
                  >
                    Blokeyi Aç
                  </button>
                </div>
              </div>

              {detail.blockReason ? (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-amber-800">
                  <div className="text-sm font-semibold">Mevcut Bloke Sebebi</div>
                  <div className="text-sm mt-1">{detail.blockReason}</div>
                </div>
              ) : null}
            </Section>

            {/* Logs */}
            <Section title="Son Denetim Logları" desc="Son 20 kullanıcı hareket kaydı.">
              <div className="rounded-2xl border overflow-hidden bg-white">
                <div className="bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-600 grid grid-cols-12">
                  <div className="col-span-3">Tarih</div>
                  <div className="col-span-3">Kim</div>
                  <div className="col-span-6">Olay</div>
                </div>
                <div className="divide-y max-h-[420px] overflow-y-auto">
  {(detail.auditLogs || []).length === 0 ? (
    <div className="px-4 py-4 text-sm text-gray-500">Log yok.</div>
  ) : (
    detail.auditLogs.slice(0, 20).map((l) => (
      <div key={l._id} className="px-4 py-3 grid grid-cols-12 text-sm">
        <div className="col-span-3 text-gray-600">{toTRDateTime(l.createdAt)}</div>
        <div className="col-span-3 text-gray-800 font-medium">{l.actorEmail || "—"}</div>
        <div className="col-span-6 text-gray-700">
          <div className="font-medium">{l.action}</div>
          {l.reason ? <div className="text-xs text-gray-500 mt-0.5">{l.reason}</div> : null}
        </div>
      </div>
    ))
  )}
</div>
              </div>
            </Section>
          </div>
        )}
      </Drawer>
    </div>
  );
}

/* ---------------- UI Components ---------------- */

function Th({ children, className = "" }) {
  return <th className={`text-left font-semibold text-gray-600 px-4 py-3 ${className}`}>{children}</th>;
}
function Td({ children, className = "", colSpan }) {
  return (
    <td colSpan={colSpan} className={`px-4 py-3 ${className}`}>
      {children}
    </td>
  );
}

function StatusBadge({ v }) {
  const map = {
    aktif: "bg-emerald-50 text-emerald-700 border-emerald-200",
    askida: "bg-amber-50 text-amber-800 border-amber-200",
    pasif: "bg-gray-50 text-gray-700 border-gray-200",
    blokeli: "bg-red-50 text-red-700 border-red-200",
  };
  const cls = map[v] || "bg-gray-50 text-gray-700 border-gray-200";
  return <span className={`px-2 py-1 rounded-xl border text-xs font-semibold ${cls}`}>{v || "—"}</span>;
}

function ChangePill({ nameCount = 0, emailCount = 0, big = false }) {
  const total = (Number(nameCount) || 0) + (Number(emailCount) || 0);
  const tone =
    total >= 6
      ? "border-red-200 bg-red-50 text-red-700"
      : total >= 3
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-gray-200 bg-gray-50 text-gray-700";

  return (
    <span className={`${big ? "text-sm" : "text-xs"} font-semibold rounded-full px-2.5 py-1 border ${tone}`}>
      İsim:{Number(nameCount) || 0} • Mail:{Number(emailCount) || 0}
    </span>
  );
}

function Drawer({ open, onClose, title, subtitle, children }) {
  return (
    <div className={["fixed inset-0 z-50", open ? "pointer-events-auto" : "pointer-events-none"].join(" ")}>
      <div
        className={["absolute inset-0 transition-opacity", open ? "opacity-100" : "opacity-0"].join(" ")}
        onClick={onClose}
        style={{ background: "rgba(0,0,0,0.35)" }}
      />
      <div
        className={[
          "absolute right-0 top-0 h-full w-full sm:w-[760px] bg-[#f7f8fb] shadow-2xl transition-transform",
          open ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
      >
        <div className="h-full flex flex-col">
          <div className="p-5 bg-white border-b">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-gray-900">{title}</div>
                {subtitle ? <div className="text-sm text-gray-500 mt-0.5">{subtitle}</div> : null}
              </div>
              <button onClick={onClose} className="px-3 py-2 rounded-2xl border bg-white hover:bg-gray-50">
                Kapat
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, desc, children }) {
  return (
    <div className="rounded-3xl border bg-white shadow-sm p-5">
      <div>
        <div className="text-base font-semibold text-gray-900">{title}</div>
        {desc ? <div className="text-sm text-gray-500 mt-1">{desc}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-2xl border bg-white px-3 py-2">
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className="text-sm font-semibold text-gray-900">{value}</div>
    </div>
  );
}

/* -------- date -------- */
function toTRDateTime(iso) {
  try {
    return new Date(iso).toLocaleString("tr-TR");
  } catch {
    return "—";
  }
}