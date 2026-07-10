import React, { useEffect, useMemo, useState } from "react";
import { HiSearch, HiSortAscending, HiUserAdd, HiPencilAlt } from "react-icons/hi";
import axios from "axios";

const upTR = (s) => (s || "").toLocaleUpperCase("tr-TR");

// ✅ ENV destekli (prod/dev)
const API_BASE =
  (import.meta?.env?.VITE_API_URL || "").trim().replace(/\/$/, "") ||
  "https://api.isgpanel.tr";

const brand = {
  primary: "#0a2b45",
  ring: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#0a2b45]",
};

const btn = {
  base: `inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition shadow-sm disabled:opacity-60 disabled:cursor-not-allowed ${brand.ring}`,
  primary: "bg-[#2563eb] text-white hover:bg-[#1d4ed8]",
  ghost: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50",
  success: "bg-[#16a34a] text-white hover:bg-[#15803d]",
};

const inputClass = `w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs shadow-sm placeholder:text-slate-400 focus:border-[#0a2b45] ${brand.ring}`;
const selectClass = inputClass;

const badgeHazard = (t) => {
  if (t === "Az Tehlikeli") return "bg-emerald-50 text-emerald-700 border border-emerald-200";
  if (t === "Tehlikeli") return "bg-amber-50 text-amber-700 border border-amber-200";
  if (t === "Çok Tehlikeli") return "bg-rose-50 text-rose-700 border border-rose-200";
  return "bg-slate-50 text-slate-600 border-slate-200";
};

const firmIdOf = (f) => String(f?._id || f?.id || "");
const sgkOf = (f) => f?.sgkNo || f?.sgkSicilNo || "-";
const userLabel = (u) => (u?.name || u?.adSoyad || u?.fullName || u?.email || "").toString();

export default function AdminAtamaBekleyen() {
  // ============ AUTH / ORG ============ //
  const storedUser = typeof window !== "undefined" ? localStorage.getItem("user") : null;
  const currentUser = storedUser ? JSON.parse(storedUser) : null;
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const orgId =
    currentUser && currentUser.organization
      ? currentUser.organization._id || currentUser.organization
      : currentUser && currentUser.organizationId
      ? currentUser.organizationId
      : null;

  // ✅ EK: Atama bildirimi tetikleyici
  // assignments endpoint DB'yi güncelliyor ama bildirim üretmiyor.
  // Bu yüzden atama sonrası /api/firma/:id/assign çağrısı yapıyoruz (bildirim üretimi için).
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
      // Bildirim opsiyonel: DB'ye atama yazıldıysa burada hata olsa bile UI'ı kırmayalım.
      console.error("Atama bildirimi tetikleme hatası:", err);
    }
  };

  // ============ FİRMALAR (tek kaynak: backend) ============ //
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

      setFirmalar(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("AtamaBekleyen: firma liste hatası:", err);
      setFirmsError(err.response?.data?.message || "Firmalar yüklenirken hata oluştu.");
      setFirmalar([]);
    } finally {
      setFirmsLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchFirms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ============ KULLANICILAR (ORG’DAN) ============ //
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState("");

  useEffect(() => {
    if (!orgId) {
      setUsersError("Organizasyon bilgisi bulunamadı. Lütfen tekrar giriş yapın.");
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
        console.error("ORG KULLANICI LİSTE HATASI:", err);
        setUsersError(
          err.response?.data?.message || "Kullanıcı listesi yüklenirken bir hata oluştu."
        );
      } finally {
        setUsersLoading(false);
      }
    };

    fetchUsers();
  }, [orgId, token]);

  // 🔒 SADECE UZMANLAR (ticari_user)
  const kullanicilar = useMemo(
    () =>
      (users || []).filter((u) => {
        const role = (u.role || "").toString().toLowerCase().trim();
        if (!role) return false;
        if (role.includes("admin") || u.isAdmin) return false;
        return role === "ticari_user";
      }),
    [users]
  );

  // id -> user map
  const expertById = useMemo(() => {
    const m = new Map();
    (kullanicilar || []).forEach((u) => {
      const id = String(u._id || u.id || "");
      if (id) m.set(id, u);
    });
    return m;
  }, [kullanicilar]);

  // ✅ ATAMA BEKLEYENLER:
  // - atanmisKullanici yoksa
  // - atanmisKullanici var ama artık geçerli uzman değilse (silindi / rol değişti)
  const atamaBekleyen = useMemo(() => {
    return (firmalar || []).filter((f) => {
      const assigned = (f.atanmisKullanici || "").toString();
      if (!assigned) return true;
      return !expertById.has(assigned);
    });
  }, [firmalar, expertById]);

  // ============ UI ============ //
  const [q, setQ] = useState("");
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setPage(1);
  }, [q]);

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    let arr = [...atamaBekleyen];

    if (text) {
      arr = arr.filter((f) => {
        const firmaAdi = (f.firmaAdi || "").toString().toLowerCase();
        const sgk = (sgkOf(f) || "").toString().toLowerCase();
        return firmaAdi.includes(text) || sgk.includes(text);
      });
    }

    arr.sort((a, b) =>
      (a.firmaAdi || "").localeCompare(b.firmaAdi || "", "tr", { sensitivity: "base" })
    );
    if (!sortAsc) arr.reverse();
    return arr;
  }, [atamaBekleyen, q, sortAsc]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pageCount);
  const paged = filtered.slice((current - 1) * pageSize, current * pageSize);

  // ============ DÜZENLEME (DB) ============ //
  const [openEditModal, setOpenEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    id: null,
    firmaAdi: "",
    sgkNo: "",
  });

  const openEdit = (firma) => {
    setEditForm({
      id: firmIdOf(firma),
      firmaAdi: firma.firmaAdi || "",
      sgkNo: sgkOf(firma) === "-" ? "" : sgkOf(firma),
    });
    setOpenEditModal(true);
  };

  const saveEditForm = async (e) => {
    e.preventDefault();
    if (!editForm.id) {
      setOpenEditModal(false);
      return;
    }
    if (!editForm.firmaAdi || !editForm.sgkNo) {
      alert("Lütfen Firma Adı ve SGK Sicil No giriniz!");
      return;
    }

    try {
      await axios.put(
        `${API_BASE}/api/firma/${editForm.id}`,
        { firmaAdi: editForm.firmaAdi, sgkNo: editForm.sgkNo },
        { headers: { Authorization: token ? `Bearer ${token}` : "" } }
      );

      setOpenEditModal(false);
      await fetchFirms(); // ✅ tüm ekranlar ile senkron
    } catch (err) {
      console.error("Firma düzenleme hatası:", err);
      alert(err.response?.data?.message || "Firma güncellenemedi.");
    }
  };

  // ============ ATAMA (DB) ============ //
  const [selectedFirms, setSelectedFirms] = useState([]);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [selectedUserForBulk, setSelectedUserForBulk] = useState("");

  const [singleAssignOpen, setSingleAssignOpen] = useState(false);
  const [singleAssignFirmId, setSingleAssignFirmId] = useState(null);
  const [selectedUserForSingle, setSelectedUserForSingle] = useState("");

  const handleSingleAssignClick = (firmaId) => {
    setSingleAssignFirmId(firmaId);
    setSelectedUserForSingle("");
    setSingleAssignOpen(true);
  };

  const handleSingleAssignSave = async () => {
    if (!selectedUserForSingle || !singleAssignFirmId) return;

    try {
      // ✅ DÜZELTİLDİ: server'a dokunmadan doğru endpoint
      await axios.post(
        `${API_BASE}/api/assignments/admin/assign-firms`,
        { userId: selectedUserForSingle, firmIds: [singleAssignFirmId] },
        { headers: { Authorization: token ? `Bearer ${token}` : "" } }
      );

      // ✅ anında listeden düşsün: firmalar state’ini güncelle (optimistic)
      setFirmalar((prev) =>
        (prev || []).map((f) =>
          firmIdOf(f) === String(singleAssignFirmId)
            ? { ...f, atanmisKullanici: selectedUserForSingle, durum: "Aktif" }
            : f
        )
      );

      // ✅✅ YENİ: Bildirim üret (ticari_user'a)
      await notifyAssignment({
        userId: selectedUserForSingle,
        firmIds: [singleAssignFirmId],
      });

      // ✅ AdminFirmalar ile aynı bilgilendirme
      alert("Atama yapıldı. Kullanıcı panelinde firmalar görünecek.");
    } catch (err) {
      console.error("Tekli atama hatası:", err);
      alert(err.response?.data?.message || "Atama yapılamadı.");
      return;
    } finally {
      setSingleAssignOpen(false);
      setSingleAssignFirmId(null);
      setSelectedUserForSingle("");
    }
  };

  const handleBulkAssignSave = async () => {
    if (!selectedUserForBulk || selectedFirms.length === 0) return;

    try {
      // ✅ DÜZELTİLDİ: server'a dokunmadan doğru endpoint
      await axios.post(
        `${API_BASE}/api/assignments/admin/assign-firms`,
        { userId: selectedUserForBulk, firmIds: selectedFirms },
        { headers: { Authorization: token ? `Bearer ${token}` : "" } }
      );

      // ✅ anında listeden düşsün
      const setIds = new Set(selectedFirms.map(String));
      setFirmalar((prev) =>
        (prev || []).map((f) =>
          setIds.has(firmIdOf(f))
            ? { ...f, atanmisKullanici: selectedUserForBulk, durum: "Aktif" }
            : f
        )
      );

      // ✅✅ YENİ: Bildirim üret (ticari_user'a)
      await notifyAssignment({
        userId: selectedUserForBulk,
        firmIds: selectedFirms,
      });

      // ✅ AdminFirmalar ile aynı bilgilendirme
      alert("Toplu atama yapıldı. Kullanıcı panelinde firmalar görünecek.");
    } catch (err) {
      console.error("Toplu atama hatası:", err);
      alert(err.response?.data?.message || "Toplu atama yapılamadı.");
      return;
    } finally {
      setBulkAssignOpen(false);
      setSelectedUserForBulk("");
      setSelectedFirms([]);
    }
  };

  // ============ RENDER ============ //
  return (
    <div className="p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#042f4b] mb-1">Atama Bekleyen Firmalar</h2>
            <p className="text-slate-500 text-xs">
              Uzman ataması yapılmamış (veya atanmış uzmanı kalmamış) firmalar.
              Buradan ilgili uzmanlara atama yapabilirsiniz.
            </p>

            {!!firmsError && <p className="mt-1 text-[11px] text-rose-600">{firmsError}</p>}
            {firmsLoading && <p className="mt-1 text-[11px] text-slate-500">Firmalar yükleniyor...</p>}

            {!!usersError && <p className="mt-1 text-[11px] text-rose-600">{usersError}</p>}
            {usersLoading && <p className="mt-1 text-[11px] text-slate-500">Kullanıcılar yükleniyor...</p>}
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative">
            <HiSearch className="absolute left-3 top-2 text-slate-400 h-3.5 w-3.5" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Firma / SGK ara..."
              className={`${inputClass} pl-8 w-64`}
            />
          </div>

          <div className="flex items-center gap-2">
            {selectedFirms.length > 0 && (
              <button
                onClick={() => setBulkAssignOpen(true)}
                className={`${btn.base} ${btn.success}`}
                disabled={kullanicilar.length === 0}
              >
                Seçilen {selectedFirms.length} firmayı ata/değiştir
              </button>
            )}

            <button
              onClick={() => setSortAsc((s) => !s)}
              className={`${btn.base} ${btn.ghost}`}
              title="A-Z / Z-A"
            >
              <HiSortAscending className={`h-3.5 w-3.5 ${sortAsc ? "" : "rotate-180"} transition`} />
              {sortAsc ? "A-Z" : "Z-A"}
            </button>

            <div className="hidden md:flex items-center gap-2 text-xs text-slate-500">
              <span>Göster:</span>
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

        {/* TABLE */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow">
          <div className="max-h-[60vh] overflow-auto">
            <table className="min-w-full text-xs">
              <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur supports-[backdrop-filter]:bg-slate-50/60">
                <tr className="text-slate-600">
                  <th className="py-1.5 px-2 text-center border-b w-8">
                    <input
                      type="checkbox"
                      checked={selectedFirms.length > 0 && selectedFirms.length === paged.length}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedFirms(paged.map((f) => firmIdOf(f)));
                        else setSelectedFirms([]);
                      }}
                    />
                  </th>
                  <th className="py-2 px-3 text-left font-semibold border-b w-10">#</th>
                  <th className="py-2 px-3 text-left font-semibold border-b">Firma Adı</th>
                  <th className="py-2 px-3 text-left font-semibold border-b">SGK Sicil No</th>
                  <th className="py-2 px-3 text-left font-semibold border-b">Tehlike Sınıfı</th>
                  <th className="py-2 px-3 text-left font-semibold border-b">Durum</th>
                  <th className="py-2 px-3 text-right font-semibold border-b w-40">İşlemler</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 text-slate-700">
                {paged.map((f, idx) => {
                  const rowNo = (current - 1) * pageSize + idx + 1;
                  const fid = firmIdOf(f);

                  return (
                    <tr key={fid} className="hover:bg-slate-50">
                      <td className="py-1.5 px-2 text-center">
                        <input
                          type="checkbox"
                          checked={selectedFirms.includes(fid)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedFirms((prev) => [...prev, fid]);
                            else setSelectedFirms((prev) => prev.filter((x) => x !== fid));
                          }}
                        />
                      </td>

                      <td className="py-1.5 px-3 align-middle">{rowNo}</td>
                      <td className="py-1.5 px-3 align-middle font-medium">{f.firmaAdi}</td>
                      <td className="py-1.5 px-3 align-middle tabular-nums">{sgkOf(f)}</td>

                      <td className="py-1.5 px-3 align-middle">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${badgeHazard(
                            f.tehlike
                          )}`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current/60" />
                          {f.tehlike || "-"}
                        </span>
                      </td>

                      <td className="py-1.5 px-3 align-middle">
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide bg-amber-50 text-amber-700 border border-amber-200">
                          Atama Bekliyor
                        </span>
                      </td>

                      <td className="py-1.5 px-3 align-middle">
                        <div className="flex justify-end gap-1">
                          <button
                            className={`${btn.base} ${btn.success} !px-2`}
                            onClick={() => handleSingleAssignClick(fid)}
                            title="Ata / Değiştir"
                            disabled={kullanicilar.length === 0}
                          >
                            <HiUserAdd className="h-3.5 w-3.5" />
                          </button>

                          <button
                            className={`${btn.base} ${btn.ghost} !px-2`}
                            onClick={() => openEdit(f)}
                            title="Düzenle"
                          >
                            <HiPencilAlt className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {paged.length === 0 && !firmsLoading && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-500 text-xs">
                      Atama bekleyen firma bulunamadı.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-3 py-2 border-t bg-slate-50 text-xs text-slate-600">
            <div>
              Toplam <span className="font-medium text-slate-800">{filtered.length}</span> atama bekleyen firma
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={current <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className={`${btn.base} ${btn.ghost} !px-2 disabled:opacity-40`}
              >
                {"<"}
              </button>
              <span>
                {current} / {pageCount}
              </span>
              <button
                disabled={current >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                className={`${btn.base} ${btn.ghost} !px-2 disabled:opacity-40`}
              >
                {">"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* DÜZENLE MODAL */}
      {openEditModal && (
        <div className="fixed inset-0 z-50 grid place-items-center p-3">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setOpenEditModal(false)}
          />
          <div className="relative w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-2 bg-gradient-to-r from-[#0a2b45] to-[#0a2b45]/90 text-white">
              <h3 className="text-sm font-semibold tracking-tight">Firmayı Düzenle</h3>
              <button onClick={() => setOpenEditModal(false)} className="rounded-lg p-1.5 hover:bg-white/10">
                ✕
              </button>
            </div>

            <form onSubmit={saveEditForm} className="p-4">
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">Firma Adı</label>
                  <input
                    className={inputClass}
                    placeholder="FİRMA ADI"
                    value={editForm.firmaAdi}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, firmaAdi: upTR(e.target.value) }))
                    }
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">SGK Sicil No</label>
                  <input
                    className={inputClass}
                    placeholder="XXXXXXXX-XXXX"
                    value={editForm.sgkNo}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, sgkNo: (e.target.value || "").replace(/\D/g, "") }))
                    }
                  />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2 border-t pt-3">
                <button type="button" onClick={() => setOpenEditModal(false)} className={`${btn.base} ${btn.ghost}`}>
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

      {/* TOPLU ATAMA MODAL */}
      {bulkAssignOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-4">
            <h3 className="text-sm font-semibold mb-2">Toplu Atama</h3>
            <p className="text-[11px] text-slate-500 mb-3">
              Seçilen {selectedFirms.length} firmayı aynı kullanıcıya atayın veya atamasını değiştirin.
            </p>

            <label className="block text-[11px] font-medium text-slate-700 mb-1">Kullanıcı Seç</label>
            <select
              value={selectedUserForBulk}
              onChange={(e) => setSelectedUserForBulk(e.target.value)}
              className={`${selectClass} mb-4`}
            >
              <option value="">Seçiniz</option>
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
                disabled={!selectedUserForBulk || selectedFirms.length === 0 || kullanicilar.length === 0}
              >
                Atamayı Yap
              </button>
              <button className={`${btn.base} ${btn.ghost} flex-1`} onClick={() => setBulkAssignOpen(false)}>
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TEKLİ ATAMA MODAL */}
      {singleAssignOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xs p-4">
            <h3 className="text-sm font-semibold mb-2">Ata / Değiştir</h3>

            <label className="block text-[11px] font-medium text-slate-700 mb-1">Kullanıcı Seç</label>
            <select
              value={selectedUserForSingle}
              onChange={(e) => setSelectedUserForSingle(e.target.value)}
              className={`${selectClass} mb-4`}
            >
              <option value="">Seçiniz</option>
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
              <button className={`${btn.base} ${btn.ghost} flex-1`} onClick={() => setSingleAssignOpen(false)}>
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
