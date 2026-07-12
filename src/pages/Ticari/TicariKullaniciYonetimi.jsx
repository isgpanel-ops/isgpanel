import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import ConfirmModal from "@/components/ui/ConfirmModal";

const API_BASE =
  (import.meta?.env?.VITE_API_URL || "").trim().replace(/\/$/, "") ||
  "https://api.isgpanel.tr";

/* helpers */
const formatTR = (d) => (d ? new Date(d).toLocaleDateString("tr-TR") : "-");
const upTR = (s = "") => (s || "").toLocaleUpperCase("tr-TR");

const brandRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#0a2b45]";

const btnBase =
  "inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition shadow-sm disabled:opacity-60 disabled:cursor-not-allowed " +
  brandRing;

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs shadow-sm placeholder:text-slate-400 focus:border-[#0a2b45] " +
  brandRing;

function isAdminRole(u) {
  return !!u && (u.role === "ticari_admin" || u.role === "admin" || u.isAdmin === true);
}

function getRoleLabel(role, userObj = null) {
  if (isAdminRole(userObj) || role === "ticari_admin" || role === "admin") {
    return "Admin";
  }

  if (role === "ticari_user") {
    return "Ä°ÅŸ GÃ¼venliÄŸi UzmanÄ±";
  }

  if (role === "isyeri_hekimi") {
    return "Ä°ÅŸyeri Hekimi";
  }

  return role || "-";
}

/** Tek admin seÃ§: ticari_admin > admin > isAdmin */
function pickPrimaryAdmin(list) {
  const admins = (list || []).filter(isAdminRole);
  if (admins.length === 0) return null;

  const ticari = admins.find((u) => u.role === "ticari_admin");
  if (ticari) return ticari;

  const admin = admins.find((u) => u.role === "admin");
  if (admin) return admin;

  return admins[0];
}

/** âœ… GÃ¼Ã§lÃ¼ ÅŸifre Ã¼retici (crypto varsa onu kullanÄ±r) */
function secureRandomInt(max) {
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    const arr = new Uint32Array(1);
    window.crypto.getRandomValues(arr);
    return arr[0] % max;
  }
  return Math.floor(Math.random() * max);
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function generateStrongPassword(length = 12) {
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const digits = "0123456789";
  const special = "!@#$%^&*()-_=+[]{};:,.?/";

  const all = lower + upper + digits + special;
  const L = Math.max(8, Number(length) || 12);

  // her gruptan en az 1 tane garanti
  const chars = [
    lower[secureRandomInt(lower.length)],
    upper[secureRandomInt(upper.length)],
    digits[secureRandomInt(digits.length)],
    special[secureRandomInt(special.length)],
  ];

  for (let i = chars.length; i < L; i++) {
    chars.push(all[secureRandomInt(all.length)]);
  }

  return shuffleArray(chars).join("");
}

export default function TicariKullaniciYonetimi() {
  const [organization, setOrganization] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [newUserName, setNewUserName] = useState("");
const [newUserEmail, setNewUserEmail] = useState("");
const [newUserTcKimlik, setNewUserTcKimlik] = useState("");
const [newUserRole, setNewUserRole] = useState("ticari_user");
const [newUserPassword, setNewUserPassword] = useState("");
const [adding, setAdding] = useState(false);


  // âœ… Åifre alanÄ± iÃ§in show/hide + kopyalandÄ±
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [copied, setCopied] = useState(false);

 const [editingUser, setEditingUser] = useState(null);
const [editForm, setEditForm] = useState({ name: "", email: "", tcKimlik: "", role: "ticari_user", password: "" });
const [savingEdit, setSavingEdit] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);  
  const [editCopied, setEditCopied] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("all");

  const storedUser = localStorage.getItem("user");
  const user = storedUser ? JSON.parse(storedUser) : null;
  const token = localStorage.getItem("token");

  const orgId =
    user && user.organization
      ? user.organization._id || user.organization
      : user && user.organizationId
      ? user.organizationId
      : null;

  // =========================
  // âœ… ConfirmModal (Firma silme ile aynÄ± UX)
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

  const openConfirm = ({
    title,
    message,
    onConfirm,
    confirmText = "Tamam",
    cancelText = "Ä°ptal",
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

  /* fetch */
  useEffect(() => {
    if (!orgId) {
      setError("Organizasyon bilgisi bulunamadÄ±. LÃ¼tfen tekrar giriÅŸ yapÄ±n.");
      setLoading(false);
      return;
    }

    const fetchUsers = async () => {
      try {
        setLoading(true);
        setError("");

        const res = await axios.get(`${API_BASE}/api/org/${orgId}/users`, {
          headers: { Authorization: token ? `Bearer ${token}` : "" },
        });

        setOrganization(res.data.organization);
        setUsers(res.data.users || []);
      } catch (err) {
        console.error("KULLANICI LÄ°STE HATASI:", err);
        setError(err.response?.data?.message || "KullanÄ±cÄ±lar yÃ¼klenirken bir hata oluÅŸtu.");
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [orgId, token]);

  // âœ… Sayfa ilk aÃ§Ä±lÄ±ÅŸta otomatik gÃ¼Ã§lÃ¼ ÅŸifre bas
  useEffect(() => {
    setNewUserPassword(generateStrongPassword(12));
    setShowNewPassword(false);
    setCopied(false);
  }, []);

  /** âœ… TEK ADMIN */
  const primaryAdmin = useMemo(() => pickPrimaryAdmin(users), [users]);

  /** âœ… Admin hariÃ§ kullanÄ±cÄ±lar (kota/koltuk + dropdown + normal tablo) */
  const nonAdminUsers = useMemo(() => {
    const primaryId = (primaryAdmin?._id || primaryAdmin?.id || "").toString();

    return (users || []).filter((u) => {
      if (!isAdminRole(u)) return true;

      // admin ise sadece primaryAdmin'Ä± tabloda gÃ¶stereceÄŸiz, diÄŸer adminleri sakla
      const uid = (u._id || u.id || "").toString();
      return uid === primaryId;
    });
  }, [users, primaryAdmin]);

  /** Dropdown admin iÃ§ermez */
  const dropdownUsers = useMemo(() => (users || []).filter((u) => !isAdminRole(u)), [users]);

  /** Ãœst bar filtre objesi (admin yok) */
  useEffect(() => {
    const options = [
      { value: "all", label: "TÃ¼m KullanÄ±cÄ±lar" },
      ...dropdownUsers.map((u, idx) => ({
        value: (u._id || u.id || "").toString(),
        label: `KullanÄ±cÄ± ${idx + 1} - ${upTR(u.name || "")}`,
      })),
    ];

    if (typeof window !== "undefined") {
      window.isgUserFilter = {
        options,
        searchTerm,
        selectedUserId,
        setSearchTerm: (val) => setSearchTerm(val || ""),
        setSelectedUserId: (val) => setSelectedUserId(val || "all"),
      };
    }

    return () => {
      if (typeof window !== "undefined" && window.isgUserFilter) delete window.isgUserFilter;
    };
  }, [dropdownUsers, searchTerm, selectedUserId]);

  /* add */
  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!orgId) return;

  if (!newUserName || !newUserEmail || !newUserRole || !newUserPassword) {
  setError("LÃ¼tfen tÃ¼m alanlarÄ± doldurunuz.");
  return;
}

    try {
      setAdding(true);
      setError("");

    const res = await axios.post(
  `${API_BASE}/api/org/${orgId}/users`,
  {
    name: newUserName,
    email: newUserEmail,
    role: newUserRole,
    password: newUserPassword,
    tcKimlik: newUserTcKimlik,
  },
  { headers: { Authorization: token ? `Bearer ${token}` : "" } }
);

      const created = res.data.user || res.data;
      setUsers((prev) => [...prev, created]);

     setNewUserName("");
setNewUserEmail("");
setNewUserTcKimlik("");
setNewUserRole("ticari_user");

// âœ… KullanÄ±cÄ± eklenince yeni ÅŸifre otomatik Ã¼ret
setNewUserPassword(generateStrongPassword(12));
      setShowNewPassword(false);
      setCopied(false);
    } catch (err) {
      console.error("YENÄ° KULLANICI EKLEME HATASI:", err);
      setError(err.response?.data?.message || "KullanÄ±cÄ± eklenirken bir hata oluÅŸtu.");
    } finally {
      setAdding(false);
    }
  };

  /* edit open */
  const openEditUser = (u) => {
    if (isAdminRole(u)) {
      openInfo("Bilgilendirme", "Admin kullanÄ±cÄ± kilitlidir, dÃ¼zenlenemez.");
      return;
    }
   setEditingUser(u);
setEditForm({
  name: upTR(u.name || ""),
  email: u.email || "",
  tcKimlik: String(u.personal?.tcKimlik || ""),
  role: u.role || "ticari_user",
  password: "",
});
setShowEditPassword(false);
setEditCopied(false);
  };

  /* update (role gÃ¶nderme yok) */
  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!orgId || !editingUser) return;

    if (isAdminRole(editingUser)) {
      openInfo("Bilgilendirme", "Admin kullanÄ±cÄ± kilitlidir, gÃ¼ncellenemez.");
      return;
    }

    try {
      setSavingEdit(true);
      setError("");

      const userId = editingUser._id || editingUser.id;

     const payload = {
  name: editForm.name,
  email: editForm.email,
  tcKimlik: editForm.tcKimlik,
  role: editForm.role,
};

if (editForm.password?.trim()) {
  payload.password = editForm.password.trim();
}

const res = await axios.put(
  `${API_BASE}/api/org/${orgId}/users/${userId}`,
  payload,
  { headers: { Authorization: token ? `Bearer ${token}` : "" } }
);

      const updated = res.data.user || res.data;

      setUsers((prev) =>
        prev.map((u) => ((u._id || u.id) === userId ? { ...u, ...updated } : u))
      );

      setEditingUser(null);
    } catch (err) {
      console.error("KULLANICI GÃœNCELLEME HATASI:", err);
      setError(err.response?.data?.message || "KullanÄ±cÄ± gÃ¼ncellenirken bir hata oluÅŸtu.");
      openInfo("Hata", err.response?.data?.message || "KullanÄ±cÄ± gÃ¼ncellenirken bir hata oluÅŸtu.");
    } finally {
      setSavingEdit(false);
    }
  };

  /* delete */
  const handleDeleteUser = (u) => {
    if (!orgId) return;

    if (isAdminRole(u)) {
      openInfo("Bilgilendirme", "Admin kullanÄ±cÄ± kilitlidir, silinemez.");
      return;
    }

    const userId = (u._id || u.id || "").toString();

    openConfirm({
      title: "UyarÄ±",
      message: `${upTR(u.name || "")} kullanÄ±cÄ±sÄ±nÄ± silmek istediÄŸinize emin misiniz?`,
      confirmText: "Sil",
      cancelText: "Ä°ptal",
      variant: "warning",
      onConfirm: async () => {
        try {
          setError("");

          await axios.delete(`${API_BASE}/api/org/${orgId}/users/${userId}`, {
            headers: { Authorization: token ? `Bearer ${token}` : "" },
          });

          setUsers((prev) => prev.filter((x) => (x._id || x.id || "").toString() !== userId));
          setSelectedUserId((prevSel) => (prevSel === userId ? "all" : prevSel));

          // Ä°stersen kaldÄ±rÄ±rÄ±z; silindi bilgisi
          openInfo("Bilgilendirme", "KullanÄ±cÄ± silindi âœ…");
        } catch (err) {
          console.error("KULLANICI SÄ°LME HATASI:", err);
          const msg = err.response?.data?.message || "KullanÄ±cÄ± silinirken bir hata oluÅŸtu.";
          setError(msg);
          openInfo("Hata", msg);
        }
      },
    });
  };

  if (!user) {
    return (
      <div className="p-6">
        <p>GiriÅŸ yapÄ±lmamÄ±ÅŸ gÃ¶rÃ¼nÃ¼yor. LÃ¼tfen tekrar giriÅŸ yapÄ±n.</p>
      </div>
    );
  }

  /** âœ… Koltuk hesabÄ±: admin hariÃ§ */
  const uzmanSayisi = (users || []).filter((u) => !isAdminRole(u) && u.role === "ticari_user").length;
  
  const hekimSayisi = (users || []).filter((u) => !isAdminRole(u) && u.role === "isyeri_hekimi").length;

const toplamKullanici = (users || []).filter((u) => !isAdminRole(u)).length;

const maxKullanici = organization ? organization.userLimit : 0;

const kalanKoltuk = Math.max(maxKullanici - toplamKullanici, 0);

 

  /** âœ… Tablo filtre */
  const filteredUsers = (nonAdminUsers || [])
    .filter((u) => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (u.name || "").toLowerCase().includes(term) || (u.email || "").toLowerCase().includes(term);
    })
    .filter((u) =>
      selectedUserId === "all" ? true : (u._id || u.id || "").toString() === selectedUserId
    );

  /** normal numaralandÄ±rma (admin = "-") */
  const normalIds = filteredUsers
    .filter((u) => !isAdminRole(u))
    .map((u) => (u._id || u.id || "").toString());

  return (
    <div className="p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <div>
          <h2 className="text-xl font-bold text-[#042f4b] mb-1">KullanÄ±cÄ± YÃ¶netimi</h2>
          <p className="text-slate-500 text-xs">
            Admin kullanÄ±cÄ± kilitlidir ve koltuk hakkÄ±na dahil deÄŸildir (UIâ€™da tek admin gÃ¶sterilir).
          </p>
        </div>

       {organization && (
  <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 text-xs text-slate-700">
    <div className="font-semibold text-sm text-slate-800 mb-1">{organization.name}</div>

    <div className="grid gap-1 md:grid-cols-2 lg:grid-cols-4">
  <p>
    <span className="font-medium">KullanÄ±cÄ± Limiti:</span>{" "}
    {toplamKullanici} / {maxKullanici || 0}{" "}
    {maxKullanici > 0 && (
      <span className="text-slate-500">(Kalan koltuk: {kalanKoltuk})</span>
    )}
  </p>

  <p>
    <span className="font-medium">Uzman:</span> {uzmanSayisi}
  </p>

  <p>
    <span className="font-medium">Hekim:</span> {hekimSayisi}
  </p>

  <p>
    <span className="font-medium">Admin:</span>{" "}
    {primaryAdmin ? upTR(primaryAdmin.name || "") : "-"}
  </p>
</div>

  </div>
)}

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            âš  {error}
          </div>
        )}

        {/* Dropdown: admin yok */}
        <div className="flex items-center justify-end text-xs text-slate-600 mb-1">
          <span className="mr-2">KullanÄ±cÄ± SeÃ§:</span>
          <select
            className={inputClass + " w-48"}
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
          >
            <option value="all">TÃ¼m KullanÄ±cÄ±lar</option>
            {dropdownUsers.map((u, idx) => (
              <option key={u._id || u.id} value={u._id || u.id}>
                {`KullanÄ±cÄ± ${idx + 1} - ${upTR(u.name || "")}`}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="text-xs text-slate-600">YÃ¼kleniyor...</p>
        ) : (
          <>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow">
              <div className="px-3 py-2 border-b bg-slate-50/80">
                <h3 className="text-sm font-semibold text-slate-800">KullanÄ±cÄ±lar</h3>
              </div>

              <div className="max-h-[60vh] overflow-auto">
                <table className="min-w-full text-xs">
                  <thead className="sticky top-0 z-10 bg-slate-50/95">
                    <tr className="text-slate-600">
                      <th className="py-2 px-3 text-left font-semibold border-b">#</th>
                      <th className="py-2 px-3 text-left font-semibold border-b">Ad Soyad</th>
                      <th className="py-2 px-3 text-left font-semibold border-b">TC Kimlik No</th>
                      <th className="py-2 px-3 text-left font-semibold border-b">Email</th>
                      <th className="py-2 px-3 text-left font-semibold border-b">Rol</th>
                      <th className="py-2 px-3 text-left font-semibold border-b">KayÄ±t Tarihi</th>
                      <th className="py-2 px-3 text-right font-semibold border-b">Ä°ÅŸlemler</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredUsers.map((u) => {
                      const isAdm = isAdminRole(u);
                      const idStr = (u._id || u.id || "").toString();
                      const siraNo = isAdm ? "-" : normalIds.indexOf(idStr) + 1;

                      return (
                        <tr key={idStr} className={isAdm ? "bg-amber-50/60" : "hover:bg-slate-50/70"}>
                          <td className="py-1.5 px-3">{siraNo}</td>
                          <td className="py-1.5 px-3 font-medium">
                            {upTR(u.name || "")}{" "}
                            {isAdm && (
                              <span className="ml-2 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                                KÄ°LÄ°TLÄ° ADMIN
                              </span>
                            )}
                          </td>
                          <td className="py-1.5 px-3 tabular-nums">{u.personal?.tcKimlik || "-"}</td>
                          <td className="py-1.5 px-3">{u.email}</td>
                          <td className="py-1.5 px-3">
  {getRoleLabel(u.role || (isAdm ? "ticari_admin" : "ticari_user"), u)}
</td>
                          <td className="py-1.5 px-3">{u.createdAt ? formatTR(u.createdAt) : "-"}</td>
                          <td className="py-1.5 px-3">
                            <div className="flex justify-end gap-1">
                              <button
                                className={`${btnBase} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}
                                onClick={() => openEditUser(u)}
                                disabled={isAdm}
                              >
                                DÃ¼zenle
                              </button>
                              <button
                                className={`${btnBase} bg-rose-600 text-white hover:bg-rose-700`}
                                onClick={() => handleDeleteUser(u)}
                                disabled={isAdm}
                              >
                                Sil
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-slate-500 text-xs">
                          Filtreye uygun kullanÄ±cÄ± bulunamadÄ±.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Yeni kullanÄ±cÄ± */}
            <div className="rounded-xl border border-slate-200 bg-white shadow p-4">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-slate-800">Yeni KullanÄ±cÄ± Ekle</h3>
               <p className="text-[11px] text-slate-500">
  Bu ekrandan admin oluÅŸturulamaz. KullanÄ±cÄ± eklerken rol seÃ§ebilirsiniz.
</p>
              </div>

              <form onSubmit={handleAddUser} className="grid gap-3 md:grid-cols-4">
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">Ad Soyad</label>
                  <input
                    type="text"
                    className={inputClass + " uppercase tracking-wide"}
                    placeholder="AD SOYAD"
                    value={newUserName}
                    onChange={(e) => setNewUserName(upTR(e.target.value))}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    className={inputClass}
                    placeholder="ornek@firma.com"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">TC Kimlik No</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={11}
                    className={inputClass}
                    placeholder="TC KİMLİK NO"
                    value={newUserTcKimlik}
                    onChange={(e) => setNewUserTcKimlik(e.target.value.replace(/\D/g, "").slice(0, 11))}
                  />
                </div>

<div>
  <label className="block text-[11px] font-medium text-slate-700 mb-1">Rol</label>
  <select
    className={inputClass}
    value={newUserRole}
    onChange={(e) => setNewUserRole(e.target.value)}
  >
    <option value="ticari_user">Ä°ÅŸ GÃ¼venliÄŸi UzmanÄ±</option>
    <option value="isyeri_hekimi" disabled>
    Ä°ÅŸyeri Hekimi (YakÄ±nda)
  </option>
  </select>
</div>

                {/* âœ… Åifre alanÄ± (otomatik Ã¼ret + gÃ¶z + yenile + kopyala) */}
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">Åifre</label>

                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      className={inputClass + " pr-[86px]"}
                      placeholder="GeÃ§ici ÅŸifre"
                      value={newUserPassword}
                      onChange={(e) => {
                        setNewUserPassword(e.target.value);
                        setCopied(false);
                      }}
                      autoComplete="new-password"
                    />

                    {/* GÃ¶z ikon */}
                    <button
                      type="button"
                      title={showNewPassword ? "Åifreyi gizle" : "Åifreyi gÃ¶ster"}
                      onClick={() => setShowNewPassword((v) => !v)}
                      className="absolute right-[44px] top-1/2 -translate-y-1/2 rounded-md p-1.5 hover:bg-slate-100 text-slate-600"
                    >
                      {showNewPassword ? (
                        // eye-off
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          <path
                            d="M10.6 10.6a3 3 0 004.24 4.24"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                          <path
                            d="M9.88 5.1A10.9 10.9 0 0112 5c7 0 10 7 10 7a18.6 18.6 0 01-4.2 5.1"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                          <path
                            d="M6.2 6.2C2.9 8.9 2 12 2 12s3 7 10 7c1.2 0 2.3-.2 3.3-.5"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                        </svg>
                      ) : (
                        // eye
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path
                            d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                          <path
                            d="M12 15a3 3 0 100-6 3 3 0 000 6z"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                        </svg>
                      )}
                    </button>

                    {/* Yenile */}
                    <button
                      type="button"
                      title="Yeni ÅŸifre Ã¼ret"
                      onClick={() => {
                        setNewUserPassword(generateStrongPassword(12));
                        setShowNewPassword(false);
                        setCopied(false);
                      }}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-[10px] font-semibold border border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
                    >
                      Yenile
                    </button>
                  </div>

                  <div className="mt-1 flex items-center justify-between">
                    <p className="text-[10px] text-slate-500">
                      Otomatik Ã¼retilir (min 8) â€¢ BÃ¼yÃ¼k/kÃ¼Ã§Ã¼k harf, rakam ve Ã¶zel karakter iÃ§erir.
                           <p className="text-[10px] text-slate-500 mt-1">
  OluÅŸturulan ÅŸifre kullanÄ±cÄ±ya mail iletilecektir. Åifreyi kopyalamayÄ± veya not almayÄ± unutmayÄ±nÄ±z.
</p>
                    </p>

                    <button
                      type="button"
                      className="text-[10px] font-semibold text-[#0a2b45] hover:underline"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(newUserPassword || "");
                          setCopied(true);
                          setTimeout(() => setCopied(false), 1200);
                        } catch {
                          // clipboard engellenirse sessiz geÃ§
                        }
                      }}
                    >
                      {copied ? "KopyalandÄ±" : "Kopyala"}
                    </button>
                  </div>
                </div>

                <div className="md:col-span-4 flex justify-end pt-2">
  <button
    type="submit"
    disabled={adding}
    className={`${btnBase} bg-[#2563eb] text-white hover:bg-[#1d4ed8] min-w-[140px]`}
  >
    {adding ? "Ekleniyor..." : "KullanÄ±cÄ± Ekle"}
  </button>
</div>
              </form>
            </div>
          </>
        )}
      </div>

      {/* Edit modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 grid place-items-center p-3">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setEditingUser(null)} />
          <div className="relative w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-2 bg-gradient-to-r from-[#0a2b45] to-[#0a2b45]/90 text-white">
              <h3 className="text-sm font-semibold tracking-tight">KullanÄ±cÄ±yÄ± DÃ¼zenle</h3>
              <button onClick={() => setEditingUser(null)} className="rounded-lg p-1.5 hover:bg-white/10">
                âœ•
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="p-4 space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-medium text-slate-700">Ad Soyad</label>
                <input
                  className={inputClass + " uppercase tracking-wide"}
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: upTR(e.target.value) }))}
                />
              </div>

              <div>
                <label className="mb-1 block font-medium text-slate-700">Email</label>
                <input
                  className={inputClass}
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>

              <div>
                <label className="mb-1 block font-medium text-slate-700">TC Kimlik No</label>
                <input
                  className={inputClass}
                  inputMode="numeric"
                  maxLength={11}
                  value={editForm.tcKimlik}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      tcKimlik: e.target.value.replace(/\D/g, "").slice(0, 11),
                    }))
                  }
                />
              </div>

<div>
  <label className="mb-1 block font-medium text-slate-700">Rol</label>
  <select
    className={inputClass}
    value={editForm.role}
    onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
  >
    <option value="ticari_user">Ä°ÅŸ GÃ¼venliÄŸi UzmanÄ±</option>
    <option value="isyeri_hekimi" disabled>
    Ä°ÅŸyeri Hekimi (YakÄ±nda)
  </option>
  </select>
</div>

            <div>
  <label className="block text-[11px] font-medium text-slate-700 mb-1">Åifre</label>

  <div className="relative">
    <input
      type={showEditPassword ? "text" : "password"}
      className={inputClass + " pr-[86px]"}
      value={editForm.password}
      onChange={(e) => {
        setEditForm((f) => ({ ...f, password: e.target.value }));
        setEditCopied(false);
      }}
      placeholder="Yeni ÅŸifre"
      autoComplete="new-password"
    />

    {/* ğŸ‘ gÃ¶z */}
    <button
      type="button"
      onClick={() => setShowEditPassword((v) => !v)}
      className="absolute right-[44px] top-1/2 -translate-y-1/2 rounded-md p-1.5 hover:bg-slate-100 text-slate-600"
    >
      ğŸ‘
    </button>

    {/* ğŸ” ÅŸifre Ã¼ret */}
    <button
      type="button"
      onClick={() => {
        setEditForm((f) => ({ ...f, password: generateStrongPassword(12) }));
        setShowEditPassword(false);
        setEditCopied(false);
      }}
      className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-[10px] font-semibold border border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
    >
      Yenile
    </button>
  </div>

  <div className="mt-1 flex items-center justify-between">
    <p className="text-[10px] text-slate-500">
      GÃ¼Ã§lÃ¼ ÅŸifre otomatik Ã¼retilebilir.
<p className="text-[10px] text-slate-500 mt-1">
  BoÅŸ bÄ±rakÄ±lÄ±rsa mevcut ÅŸifre deÄŸiÅŸmez. Yeni ÅŸifre oluÅŸturduysanÄ±z kullanÄ±cÄ±ya mail iletilecektir. KopyalamayÄ± veya not almayÄ± unutmayÄ±nÄ±z.
</p>
    </p>

    <button
      type="button"
      className="text-[10px] font-semibold text-[#0a2b45] hover:underline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(editForm.password || "");
          setEditCopied(true);
          setTimeout(() => setEditCopied(false), 1200);
        } catch {}
      }}
    >
      {editCopied ? "KopyalandÄ±" : "Kopyala"}
    </button>
  </div>
</div>

              <div className="mt-3 flex items-center justify-end gap-2 border-t pt-3">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className={`${btnBase} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}
                >
                  Ä°ptal
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className={`${btnBase} bg-[#16a34a] text-white hover:bg-[#15803d]`}
                >
                  {savingEdit ? "Kaydediliyor..." : "Kaydet"}
                </button>
              </div>
            </form>
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



