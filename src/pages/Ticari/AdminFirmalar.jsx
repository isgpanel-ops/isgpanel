import React, { useEffect, useMemo, useState } from "react";
import {
  HiPlus,
  HiSearch,
  HiSortAscending,
  HiUserAdd,
  HiPencilAlt,
  HiTrash,
} from "react-icons/hi";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";
import ConfirmModal from "@/components/ui/ConfirmModal";

const API_BASE =
  (import.meta?.env?.VITE_API_URL || "").trim().replace(/\/$/, "") ||
  "https://api.isgpanel.tr";

const upTR = (s) => (s || "").toLocaleUpperCase("tr-TR");

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

// ---- helper: firm normalize (backend farklı döndürebilir)
const normalizeFirms = (data) => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.firmalar)) return data.firmalar;
  if (Array.isArray(data.firms)) return data.firms;
  if (Array.isArray(data.data)) return data.data;
  return [];
};

// ---- helper: user label (backend name alanı değişebilir)
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
  // ConfirmModal (Firmalar.jsx ile aynı mantık)
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

  // ✅ Bilgilendirme: iptal yok
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

  // ✅ EK: Atama bildirimi tetikleyici
  // assignments endpoint DB'yi güncelliyor ama bildirim üretmiyor.
  // Bu yüzden atama sonrası /api/firma/:id/assign çağırıyoruz.
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
      // Bildirim opsiyonel: atama DB'ye yazıldıysa burada hata olsa bile UI'ı kırmayalım.
      console.error("Atama bildirimi tetikleme hatası:", err);
    }
  };

  // -------------------- USERS (org users)
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
          err.response?.data?.message ||
            "Kullanıcı listesi yüklenirken bir hata oluştu."
        );
      } finally {
        setUsersLoading(false);
      }
    };

    fetchUsers();
  }, [orgId, token]);

  // 🔒 SADECE ticari_user görünür (admin rolleri listede çıkmasın)
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

  // ✅ id -> AD SOYAD map (name alanı değişse bile yakalasın)
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
      console.error("FİRMA LİSTE HATASI:", err);
      setFirmsError(
        err.response?.data?.message || "Firmalar yüklenirken bir hata oluştu."
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

  // ✅ Atama sonrası UI'da "Atanmış Kullanıcı" hemen görünsün diye
  // firmalar state'inde ilgili firmalara atanmisKullanici alanını lokal basıyoruz.
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
  const [form, setForm] = useState({
    _id: null,
    firmaAdi: "",
    sgkNo: "",
    tehlike: "Tehlikeli",
  });

  const [selectedFirms, setSelectedFirms] = useState([]); // firm _id array
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [selectedUserForBulk, setSelectedUserForBulk] = useState("");

  const [singleAssignOpen, setSingleAssignOpen] = useState(false);
  const [singleAssignFirmId, setSingleAssignFirmId] = useState(null);
  const [selectedUserForSingle, setSelectedUserForSingle] = useState("");

  // ✅ YENİ: Hepsi / Yeni / Eski filtresi (tasarımı bozmadan)
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

    // ✅ Kullanıcı filtresi
    if (selectedUserFilter && selectedUserFilter !== "all") {
      arr = arr.filter(
        (f) => (f.atanmisKullanici || "").toString() === selectedUserFilter
      );
    }

    // ✅ YENİ: Firma tipi filtresi (Yeni = atanmış kullanıcı yok, Eski = atanmış kullanıcı var)
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

  // -------------------- actions
  const openAdd = () => {
    setForm({
      _id: null,
      firmaAdi: "",
      sgkNo: "",
      tehlike: "Tehlikeli",
    });
    setOpenForm(true);
  };

  const openEdit = (firma) => {
    setForm({
      _id: firma._id || firma.id || null,
      firmaAdi: firma.firmaAdi || "",
      sgkNo: firma.sgkNo || firma.sgkSicilNo || "",
      tehlike: firma.tehlike || "Tehlikeli",
    });
    setOpenForm(true);
  };

  const saveForm = async (e) => {
    e.preventDefault();

    if (!form.firmaAdi || !form.sgkNo) {
      openInfo("Bilgilendirme", "Lütfen firma adı ve SGK sicil no giriniz.");
      return;
    }

    try {
      if (!token) {
        openInfo("Bilgilendirme", "Token bulunamadı. Lütfen tekrar giriş yapın.");
        return;
      }

      // ✅ CREATE
      if (!form._id) {
        await axios.post(
          `${API_BASE}/api/firma`,
          {
            firmaAdi: form.firmaAdi,
            sgkNo: form.sgkNo,
            tehlike: form.tehlike,
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } else {
        // ✅ UPDATE
        await axios.put(
          `${API_BASE}/api/firma/${form._id}`,
          {
            firmaAdi: form.firmaAdi,
            sgkNo: form.sgkNo,
            tehlike: form.tehlike,
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }

      setOpenForm(false);
      await fetchFirms();
    } catch (err) {
      console.error("FİRMA KAYDET HATASI:", err);
      openInfo("Hata", err.response?.data?.message || "Firma kaydedilemedi.");
    }
  };

  // ✅ SİLME: window.confirm yerine ConfirmModal popup
  const handleDelete = (id) => {
    openConfirm({
      title: "Uyarı",
      message: "Firmayı silmek istediğinize emin misiniz?",
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

          // istersen kapat: silince popup çıkmasın diyorsan bunu kaldırırız
          openInfo("Bilgilendirme", "Firma silindi ✅");
        } catch (err) {
          console.error("FİRMA SİLME HATASI:", err);
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
      // ✅ DÜZELTİLDİ: server'a dokunmadan doğru endpoint
      await axios.post(
        `${API_BASE}/api/assignments/admin/assign-firms`,
        { userId: selectedUserForSingle, firmIds: [singleAssignFirmId] },
        { headers: { Authorization: token ? `Bearer ${token}` : "" } }
      );

      // ✅ UI: hemen atanmış kullanıcı ad soyad görünsün
      applyLocalAssignment([singleAssignFirmId], selectedUserForSingle);

      // ✅✅ YENİ: Bildirim üret (ticari_user'a)
      await notifyAssignment({
        userId: selectedUserForSingle,
        firmIds: [singleAssignFirmId],
      });
    } catch (err) {
      console.error("Atama DB HATASI:", err);
      openInfo("Hata", err.response?.data?.message || "Atama DB'ye yazılamadı");
      return;
    }

    // UI kapanış
    setSingleAssignOpen(false);
    setSingleAssignFirmId(null);
    setSelectedUserForSingle("");

    openInfo("Bilgilendirme", "Atama yapıldı. Kullanıcı panelinde firmalar görünecek.");
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

      // ✅ UI: hemen atanmış kullanıcı ad soyad görünsün
      applyLocalAssignment(selectedFirms, selectedUserForBulk);

      // ✅✅ YENİ: Bildirim üret (ticari_user'a)
      await notifyAssignment({
        userId: selectedUserForBulk,
        firmIds: selectedFirms,
      });
    } catch (err) {
      console.error("Toplu atama DB HATASI:", err);
      openInfo("Hata", err.response?.data?.message || "Toplu atama DB'ye yazılamadı");
      return;
    }

    setBulkAssignOpen(false);
    setSelectedUserForBulk("");
    setSelectedFirms([]);

    openInfo("Bilgilendirme", "Toplu atama yapıldı. Kullanıcı panelinde firmalar görünecek.");
  };

  // -------------------- render
  return (
    <div className="p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#042f4b] mb-1">Firmalar</h2>
            <p className="text-slate-500 text-xs">
              Firmaları görüntüleyin, kullanıcı atayın, toplu işlem yapın.
            </p>

            {!!usersError && (
              <p className="mt-1 text-[11px] text-rose-600">{usersError}</p>
            )}
            {usersLoading && (
              <p className="mt-1 text-[11px] text-slate-500">
                Kullanıcılar yükleniyor...
              </p>
            )}

            {!!firmsError && (
              <p className="mt-1 text-[11px] text-rose-600">{firmsError}</p>
            )}
            {firmsLoading && (
              <p className="mt-1 text-[11px] text-slate-500">
                Firmalar yükleniyor...
              </p>
            )}
          </div>

          <button onClick={openAdd} className={`${btn.base} ${btn.primary}`}>
            <HiPlus className="-ml-0.5 h-3 w-3" />
            Yeni Firma
          </button>
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
            {/* ✅ YENİ / ESKİ / HEPSİ - mevcut tasarıma uyumlu butonlar */}
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
                title="Yeni (atanmamış)"
              >
                Yeni
              </button>
              <button
                onClick={() => setFirmaTipi("eski")}
                className={`${btn.base} ${
                  firmaTipi === "eski" ? btn.primary : btn.ghost
                } !px-2`}
                title="Eski (atanmış)"
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
                Seçilen {selectedFirms.length} firmayı ata/değiştir
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

                  const durum = f.durum || (atanmisId ? "Aktif" : "Askıda");
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
                            ATANMAMIŞ
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
                            title="Ata / Değiştir"
                            onClick={() => handleSingleAssignClick(f._id || f.id)}
                            disabled={kullanicilar.length === 0}
                          >
                            <HiUserAdd className="h-3.5 w-3.5" />
                          </button>

                          <button
                            className={`${btn.base} ${btn.ghost} !px-2`}
                            title="Düzenle"
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5">
            <h3 className="text-sm font-semibold mb-3">
              {!form._id ? "Yeni Firma Ekle" : "Firmayı Düzenle"}
            </h3>

            <form onSubmit={saveForm} className="space-y-3 text-xs">
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
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      sgkNo: (e.target.value || "").replace(/\D/g, ""),
                    }))
                  }
                  placeholder="2683..."
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">
                  Tehlike Sınıfı
                </label>
                <select
                  className={selectClass}
                  value={form.tehlike}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, tehlike: e.target.value }))
                  }
                >
                  <option value="Az Tehlikeli">Az Tehlikeli</option>
                  <option value="Tehlikeli">Tehlikeli</option>
                  <option value="Çok Tehlikeli">Çok Tehlikeli</option>
                </select>
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

      {/* TOPLU ATAMA MODAL */}
      {bulkAssignOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-4">
            <h3 className="text-sm font-semibold mb-2">Toplu Atama</h3>
            <p className="text-[11px] text-slate-500 mb-3">
              Seçilen {selectedFirms.length} firmayı aynı kullanıcıya atayın veya
              atamasını değiştirin.
            </p>

            <label className="block text-[11px] font-medium text-slate-700 mb-1">
              Kullanıcı Seç
            </label>
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

      {/* TEKLİ ATAMA MODAL */}
      {singleAssignOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xs p-4">
            <h3 className="text-sm font-semibold mb-2">Ata / Değiştir</h3>

            <label className="block text-[11px] font-medium text-slate-700 mb-1">
              Kullanıcı Seç
            </label>
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

      {/* ✅ ConfirmModal */}
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
