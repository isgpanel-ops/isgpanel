// src/pages/super/DuyurularBildirimler.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { API_BASE } from "../../config/api";
import {
  Bell,
  Megaphone,
  Plus,
  Search,
  Filter,
  Calendar,
  Users,
  User,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldAlert,
  Activity,
  FileDown,
  Copy,
  Pencil,
  Trash2,
  Send,
  Save,
  X,
  Sparkles,
  Clock,
  Tag,
  Info,
} from "lucide-react";

/**
 * ✅ Bu sayfa: Süper Admin > Duyurular & Bildirimler
 * - Duyurular = Kampanya / broadcast (tüm, rol, seçili kişi, toplu liste)
 * - Bildirimler = Olay & teslimat log (salt okunur)
 *
 * ✅ Backend bağlandı:
 *  - GET    /api/super/announcements
 *  - POST   /api/super/announcements
 *  - PUT    /api/super/announcements/:id
 *  - DELETE /api/super/announcements/:id
 *  - POST   /api/super/announcements/:id/publish
 */

const BRAND = "#0a2b45";

// ---------- AUTH (SuperKullanicilar ile aynı) ----------
function authHeader() {
  const token = localStorage.getItem("token") || sessionStorage.getItem("token");
  return { Authorization: `Bearer ${token}` };
}

// ---------- Mock Data (UI için aynı kalsın) ----------
const ROLE_OPTIONS = [
  { key: "isveren", label: "İşveren" },
  { key: "uzman", label: "İSG Uzmanı" },
  { key: "hekim", label: "İşyeri Hekimi" },
  { key: "calisan", label: "Çalışan" },
  { key: "admin", label: "Admin" },
];

const TEMPLATE_OPTIONS = [
  {
    key: "bos",
    label: "Boş",
    icon: <Info className="w-4 h-4" />,
    preset: {
      title: "",
      content: "",
      type: "bilgilendirme",
      priority: "normal",
      requiredAck: false,
    },
  },
  {
    key: "dogum_gunu",
    label: "Doğum Günü",
    icon: <Sparkles className="w-4 h-4" />,
    preset: {
      title: "🎂 Doğum günün kutlu olsun, {{adSoyad}}!",
      content:
        "Bugün senin günün! İSG Panel ailesi olarak yeni yaşında sağlık ve başarı dileriz. 🎉",
      type: "bilgilendirme",
      priority: "dusuk",
      requiredAck: false,
    },
  },
  {
    key: "ozel_gun",
    label: "Özel Gün",
    icon: <Sparkles className="w-4 h-4" />,
    preset: {
      title: "🎉 Özel gününüz kutlu olsun!",
      content:
        "Bugün için güzel bir mesaj: Sağlıkla, güvenle ve huzurla. İyi günler dileriz.",
      type: "bilgilendirme",
      priority: "normal",
      requiredAck: false,
    },
  },
  {
    key: "bakim",
    label: "Bakım Duyurusu",
    icon: <Activity className="w-4 h-4" />,
    preset: {
      title: "🔧 Planlı Bakım",
      content:
        "Belirtilen saat aralığında kısa süreli kesintiler yaşanabilir. Anlayışınız için teşekkürler.",
      type: "sistem",
      priority: "yuksek",
      requiredAck: false,
    },
  },
  {
    key: "limit_uyari",
    label: "Kullanım Limiti Uyarısı",
    icon: <ShieldAlert className="w-4 h-4" />,
    preset: {
      title: "⚠️ Kullanım limitine ulaşıldı / yaklaşıldı",
      content:
        "Kullanım kotanız aşıldı veya limite çok yaklaştınız. Lütfen paket/teklif ekranından yükseltme yapın.",
      type: "zorunlu",
      priority: "cok_yuksek",
      requiredAck: true,
    },
  },
];

// Bildirimler paneli şimdilik mock kalsın (tasarım bozulmasın)
function makeId(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

const initialNotifications = [
  {
    id: makeId("not"),
    kind: "limit",
    title: "Kullanım limiti aşıldı",
    message: "ABC Ltd kotasını aştı. Hizmet kısıtı uygulanabilir.",
    severity: "kritik",
    read: false,
    user: { id: "u1", name: "Mehmet Yılmaz", email: "mehmet@abc.com" },
    createdAt: "2026-01-11T20:05",
    source: { type: "event", ref: "usage_limit" },
  },
];

// ---------- Helpers ----------
function cn(...a) {
  return a.filter(Boolean).join(" ");
}
function formatDT(dt) {
  if (!dt) return "—";
  const iso = typeof dt === "string" ? dt : new Date(dt).toISOString();
  // İstersen daha güzel formatlarsın
  return iso.replace("T", " ").slice(0, 16);
}
function safeLower(s) {
  return (s || "").toString().toLowerCase();
}
function isNowWithin(startAt, endAt) {
  try {
    const now = new Date();
    const s = startAt ? new Date(startAt) : null;
    const e = endAt ? new Date(endAt) : null;
    if (s && now < s) return false;
    if (e && now > e) return false;
    return true;
  } catch {
    return false;
  }
}

function badgeStyleForType(type) {
  switch (type) {
    case "zorunlu":
      return "bg-red-50 text-red-700 border-red-200";
    case "sistem":
      return "bg-indigo-50 text-indigo-700 border-indigo-200";
    default:
      return "bg-blue-50 text-blue-700 border-blue-200";
  }
}
function badgeStyleForPriority(p) {
  switch (p) {
    case "cok_yuksek":
      return "bg-red-50 text-red-700 border-red-200";
    case "yuksek":
      return "bg-orange-50 text-orange-700 border-orange-200";
    case "dusuk":
      return "bg-gray-50 text-gray-700 border-gray-200";
    default:
      return "bg-sky-50 text-sky-700 border-sky-200";
  }
}
function badgeStyleForStatus(s) {
  switch (s) {
    case "aktif":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "taslak":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "bitti":
      return "bg-gray-50 text-gray-700 border-gray-200";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
  }
}
function labelType(t) {
  if (t === "zorunlu") return "Zorunlu";
  if (t === "sistem") return "Sistem";
  return "Bilgilendirme";
}
function labelPriority(p) {
  if (p === "cok_yuksek") return "Çok Yüksek";
  if (p === "yuksek") return "Yüksek";
  if (p === "dusuk") return "Düşük";
  return "Normal";
}
function labelStatus(s) {
  if (s === "aktif") return "Aktif";
  if (s === "taslak") return "Taslak";
  if (s === "bitti") return "Süresi Doldu";
  return "Pasif";
}

function notifIcon(kind) {
  switch (kind) {
    case "limit":
      return <ShieldAlert className="w-4 h-4" />;
    case "evrak":
      return <Calendar className="w-4 h-4" />;
    case "uygunsuzluk":
      return <AlertTriangle className="w-4 h-4" />;
    case "kutlama":
      return <Sparkles className="w-4 h-4" />;
    case "sistem":
      return <Activity className="w-4 h-4" />;
    default:
      return <Bell className="w-4 h-4" />;
  }
}
function notifBadge(sev) {
  switch (sev) {
    case "kritik":
      return "bg-red-50 text-red-700 border-red-200";
    case "yuksek":
      return "bg-orange-50 text-orange-700 border-orange-200";
    case "dusuk":
      return "bg-gray-50 text-gray-700 border-gray-200";
    default:
      return "bg-blue-50 text-blue-700 border-blue-200";
  }
}

function parseBulkTargets(text) {
  const raw = (text || "")
    .split(/[\n,; \t]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
  return Array.from(new Set(raw)).slice(0, 5000);
}

function audienceShort(aud) {
  if (!aud) return "Hedef: —";
  if (aud.mode === "all") return "Tüm kullanıcılar";
  if (aud.mode === "role") {
    return `Roller: ${aud.roles?.length ? aud.roles.join(", ") : "—"}`;
  }
  if (aud.mode === "users") {
    return `Seçili: ${aud.users?.length || 0}`;
  }
  if (aud.mode === "bulk") {
    const count = parseBulkTargets(aud.bulk).length;
    return `Toplu: ${count}`;
  }
  return "Hedef: —";
}

function normalizeAnnouncementDraft(d) {
  return {
    ...d,
    title: (d.title || "").trim(),
    content: (d.content || "").trim(),
    startAt: d.startAt || null,
    endAt: d.endAt || null,
    audience: d.audience || { mode: "all", roles: [], users: [], bulk: "" },
  };
}

/** datetime-local helper */
function toLocalDTInput(dateObj) {
  const d = dateObj instanceof Date ? dateObj : new Date(dateObj);
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

/** backend map */
function mapFromBackend(a) {
  return {
    id: a._id,
    title: a.title,
    content: a.content,
    type: a.type,
    priority: a.priority,
    requiredAck: !!a.requiredAck,
    status: a.status,
    startAt: a.startAt ? toLocalDTInput(a.startAt) : "",
    endAt: a.endAt ? toLocalDTInput(a.endAt) : "",
    audience: a.audience || { mode: "all", roles: [], users: [], bulk: "" },
    createdAt: a.createdAt ? toLocalDTInput(a.createdAt) : "",
    updatedAt: a.updatedAt ? toLocalDTInput(a.updatedAt) : "",
  };
}

/** backend payload */
function mapToBackendPayload(draft) {
  const payload = normalizeAnnouncementDraft(draft);
  return {
    title: payload.title,
    content: payload.content,
    type: payload.type,
    priority: payload.priority,
    requiredAck: !!payload.requiredAck,
    status: payload.status,
    startAt: payload.startAt ? new Date(payload.startAt).toISOString() : null,
    endAt: payload.endAt ? new Date(payload.endAt).toISOString() : null,
    audience: payload.audience,
  };
}

// ---------- UI Components ----------
function Pill({ className, children, icon }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium",
        className
      )}
    >
      {icon ? <span className="opacity-80">{icon}</span> : null}
      {children}
    </span>
  );
}

function Button({ variant = "primary", className, children, ...props }) {
  const base =
    "inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed";
  const styles =
    variant === "primary"
      ? "text-white shadow-sm"
      : variant === "ghost"
      ? "bg-transparent hover:bg-black/5 text-slate-800"
      : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-900";
  const styleProp =
    variant === "primary" ? { backgroundColor: BRAND } : undefined;

  return (
    <button
      {...props}
      style={styleProp}
      className={cn(base, styles, className)}
    >
      {children}
    </button>
  );
}

function Input({ className, ...props }) {
  return (
    <input
      {...props}
      className={cn(
        "w-full px-3 py-2 rounded-xl border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-slate-200",
        className
      )}
    />
  );
}

function Select({ className, children, ...props }) {
  return (
    <select
      {...props}
      className={cn(
        "w-full px-3 py-2 rounded-xl border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-slate-200",
        className
      )}
    >
      {children}
    </select>
  );
}

function Textarea({ className, ...props }) {
  return (
    <textarea
      {...props}
      className={cn(
        "w-full px-3 py-2 rounded-xl border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-slate-200 min-h-[120px] resize-y",
        className
      )}
    />
  );
}

function Card({ className, children }) {
  return (
    <div
      className={cn(
        "bg-white border border-slate-200 rounded-2xl shadow-sm",
        className
      )}
    >
      {children}
    </div>
  );
}

function CardHeader({ title, subtitle, right }) {
  return (
    <div className="p-5 border-b border-slate-200 flex items-start justify-between gap-4">
      <div>
        <div className="text-lg font-semibold text-slate-900">{title}</div>
        {subtitle ? (
          <div className="text-sm text-slate-500 mt-1">{subtitle}</div>
        ) : null}
      </div>
      {right}
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-slate-200 my-3" />;
}

function FieldLabel({ children, icon }) {
  return (
    <div className="text-xs font-medium text-slate-600 mb-1 flex items-center gap-1.5">
      {icon}
      {children}
    </div>
  );
}

function EmptyState({ title, desc, action }) {
  return (
    <div className="py-10 px-3 text-center">
      <div className="mx-auto w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-700">
        <Megaphone className="w-5 h-5" />
      </div>
      <div className="mt-3 text-base font-semibold text-slate-900">{title}</div>
      <div className="mt-1 text-sm text-slate-500">{desc}</div>
      <div className="mt-4 flex justify-center">{action}</div>
    </div>
  );
}

function TabButton({ active, children, ...props }) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition",
        active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
      )}
    >
      {children}
    </button>
  );
}

function Kpi({ icon, label, value, hint }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-700">
          {icon}
        </div>
        <div className="text-2xl font-semibold text-slate-900">{value}</div>
      </div>
      <div className="mt-3 text-sm font-medium text-slate-800">{label}</div>
      <div className="text-xs text-slate-500 mt-1">{hint}</div>
    </Card>
  );
}

function IconBtn({ children, title, onClick, danger }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={cn(
        "w-9 h-9 rounded-xl border transition flex items-center justify-center",
        danger
          ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      )}
    >
      {children}
    </button>
  );
}

// ---------- Main Page ----------
export default function DuyurularBildirimler() {
  const [tab, setTab] = useState("duyurular"); // duyurular | bildirimler

  // Data (announcements artık API'den gelecek)
  const [announcements, setAnnouncements] = useState([]);
  const [notifications, setNotifications] = useState(initialNotifications);

  // Selection
  const [selectedAnnouncementId, setSelectedAnnouncementId] = useState(null);
  const [selectedNotificationId, setSelectedNotificationId] = useState(
    initialNotifications[0]?.id || null
  );

  // Right panel mode for announcements
  const [annPanelMode, setAnnPanelMode] = useState("view"); // view | create | edit

  // Filters - announcements
  const [annSearch, setAnnSearch] = useState("");
  const [annStatus, setAnnStatus] = useState("hepsi");
  const [annType, setAnnType] = useState("hepsi");
  const [annPriority, setAnnPriority] = useState("hepsi");

  // Filters - notifications
  const [notSearch, setNotSearch] = useState("");
  const [notKind, setNotKind] = useState("hepsi");
  const [notRead, setNotRead] = useState("hepsi");
  const [notSeverity, setNotSeverity] = useState("hepsi");

  // Announcement draft form
  const emptyDraft = useMemo(
    () => ({
      id: null,
      title: "",
      content: "",
      type: "bilgilendirme",
      priority: "normal",
      requiredAck: false,
      status: "taslak",
      startAt: "",
      endAt: "",
      audience: { mode: "all", roles: [], users: [], bulk: "" },
      createdAt: "",
      updatedAt: "",
    }),
    []
  );

  const [draft, setDraft] = useState(emptyDraft);
  const [draftTemplateKey, setDraftTemplateKey] = useState("bos");
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;

  const selectedAnnouncement = useMemo(() => {
    return announcements.find((a) => a.id === selectedAnnouncementId) || null;
  }, [announcements, selectedAnnouncementId]);

  const selectedNotification = useMemo(() => {
    return notifications.find((n) => n.id === selectedNotificationId) || null;
  }, [notifications, selectedNotificationId]);

  // ✅ Load announcements from backend
  async function loadAnnouncements() {
    try {
      const r = await axios.get(`${API_BASE}/super/announcements`, {
        headers: authHeader(),
      });
      const items = (r.data?.items || []).map(mapFromBackend);
      setAnnouncements(items);

      if (!selectedAnnouncementId && items[0]) {
        setSelectedAnnouncementId(items[0].id);
      }
    } catch (e) {
      alert(e?.response?.data?.message || "Duyurular alınamadı");
    }
  }

  useEffect(() => {
    loadAnnouncements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-mark announcements "bitti" if out of date (UI side)
  useEffect(() => {
    setAnnouncements((prev) =>
      prev.map((a) => {
        const shouldBeActiveWindow = isNowWithin(a.startAt, a.endAt);
        if (a.status === "aktif" && !shouldBeActiveWindow) {
          return { ...a, status: "bitti" };
        }
        return a;
      })
    );
  }, []);

  // KPIs
  const kpis = useMemo(() => {
    const active = announcements.filter((a) => a.status === "aktif").length;
    const required = announcements.filter(
      (a) => a.status === "aktif" && a.requiredAck
    ).length;
    const unread = notifications.filter((n) => !n.read).length;
    const critical = notifications.filter((n) => n.severity === "kritik").length;
    return { active, required, unread, critical };
  }, [announcements, notifications]);

  const filteredAnnouncements = useMemo(() => {
    const s = safeLower(annSearch);
    return announcements
      .filter((a) => {
        const matchesSearch =
          !s ||
          safeLower(a.title).includes(s) ||
          safeLower(a.content).includes(s);
        const matchesStatus = annStatus === "hepsi" || a.status === annStatus;
        const matchesType = annType === "hepsi" || a.type === annType;
        const matchesPriority =
          annPriority === "hepsi" || a.priority === annPriority;
        return matchesSearch && matchesStatus && matchesType && matchesPriority;
      })
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }, [annSearch, annStatus, annType, annPriority, announcements]);

  const filteredNotifications = useMemo(() => {
    const s = safeLower(notSearch);
    return notifications
      .filter((n) => {
        const matchesSearch =
          !s ||
          safeLower(n.title).includes(s) ||
          safeLower(n.message).includes(s) ||
          safeLower(n.user?.name).includes(s) ||
          safeLower(n.user?.email).includes(s);

        const matchesKind = notKind === "hepsi" || n.kind === notKind;
        const matchesRead =
          notRead === "hepsi" ||
          (notRead === "okunmamis" ? !n.read : n.read);
        const matchesSeverity =
          notSeverity === "hepsi" || n.severity === notSeverity;

        return matchesSearch && matchesKind && matchesRead && matchesSeverity;
      })
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [notSearch, notKind, notRead, notSeverity, notifications]);

  // ---------- Actions ----------
  function startCreateAnnouncement() {
    setTab("duyurular");
    setAnnPanelMode("create");
    setDirty(false);
    setDraftTemplateKey("bos");
    setDraft({
      ...emptyDraft,
      id: null,
      status: "taslak",
      startAt: toLocalDTInput(new Date()),
      endAt: "",
      createdAt: "",
      updatedAt: "",
    });
  }

  function startEditAnnouncement(a) {
    setAnnPanelMode("edit");
    setDirty(false);
    setDraftTemplateKey("bos");
    setDraft(structuredClone(a));
  }

  function cancelDraft() {
    setAnnPanelMode("view");
    setDirty(false);
  }

  function applyTemplate(key) {
    const tpl = TEMPLATE_OPTIONS.find((t) => t.key === key);
    if (!tpl) return;
    setDraftTemplateKey(key);
    setDraft((prev) => ({
      ...prev,
      ...tpl.preset,
    }));
    setDirty(true);
  }

  async function saveAsDraft() {
    const payload = normalizeAnnouncementDraft(draft);

    if (!payload.title.trim()) {
      alert("Başlık boş olamaz.");
      return;
    }

    try {
      if (annPanelMode === "create") {
        const r = await axios.post(
          `${API_BASE}/super/announcements`,
          mapToBackendPayload({ ...payload, status: "taslak" }),
          { headers: authHeader() }
        );

        const item = mapFromBackend(r.data?.item);
        setAnnouncements((prev) => [item, ...prev]);
        setSelectedAnnouncementId(item.id);
      } else {
        const r = await axios.put(
          `${API_BASE}/super/announcements/${payload.id}`,
          mapToBackendPayload(payload),
          { headers: authHeader() }
        );

        const item = mapFromBackend(r.data?.item);
        setAnnouncements((prev) => prev.map((x) => (x.id === item.id ? item : x)));
        setSelectedAnnouncementId(item.id);
      }

      setDirty(false);
      setAnnPanelMode("view");
    } catch (e) {
      alert(e?.response?.data?.message || "Taslak kaydedilemedi");
    }
  }

  async function publishAnnouncement() {
    const payload = normalizeAnnouncementDraft(draft);

    if (!payload.title.trim()) {
      alert("Başlık boş olamaz.");
      return;
    }
    if (!payload.startAt) {
      alert("Başlangıç tarihi gerekli.");
      return;
    }

    if (payload.endAt) {
      const s = new Date(payload.startAt);
      const e = new Date(payload.endAt);
      if (e < s) {
        alert("Bitiş tarihi başlangıç tarihinden önce olamaz.");
        return;
      }
    }

    // Hedef kitle check
    const aud = payload.audience;
    if (aud.mode === "role" && (!aud.roles || aud.roles.length === 0)) {
      alert("Rol bazlı hedeflemede en az 1 rol seçmelisin.");
      return;
    }
    if (aud.mode === "users" && (!aud.users || aud.users.length === 0)) {
      alert("Seçili kullanıcı hedeflemede en az 1 kullanıcı eklemelisin.");
      return;
    }
    if (aud.mode === "bulk") {
      const list = parseBulkTargets(aud.bulk);
      if (list.length === 0) {
        alert("Toplu listede en az 1 hedef olmalı (e-posta / id).");
        return;
      }
    }

    try {
      let annId = payload.id;

      // 1) önce duyuruyu kaydet (create/edit)
      if (annPanelMode === "create") {
        const r = await axios.post(
          `${API_BASE}/super/announcements`,
          mapToBackendPayload({ ...payload, status: "taslak" }),
          { headers: authHeader() }
        );
        const item = mapFromBackend(r.data?.item);
        annId = item.id;
        setAnnouncements((prev) => [item, ...prev]);
        setSelectedAnnouncementId(item.id);
      } else {
        const r = await axios.put(
          `${API_BASE}/super/announcements/${payload.id}`,
          mapToBackendPayload(payload),
          { headers: authHeader() }
        );
        const item = mapFromBackend(r.data?.item);
        setAnnouncements((prev) => prev.map((x) => (x.id === item.id ? item : x)));
        setSelectedAnnouncementId(item.id);
      }

      // 2) publish
      await axios.post(
        `${API_BASE}/super/announcements/${annId}/publish`,
        {},
        { headers: authHeader() }
      );

      // 3) tekrar çek (status=aktif vs)
      await loadAnnouncements();

      setDirty(false);
      setAnnPanelMode("view");
      alert("Duyuru yayınlandı ✅");
    } catch (e) {
      alert(e?.response?.data?.message || "Yayınlama başarısız");
    }
  }

  async function toggleAnnouncementStatus(a) {
    const next =
      a.status === "aktif" ? "pasif" : a.status === "pasif" ? "aktif" : "pasif";

    try {
      const r = await axios.put(
        `${API_BASE}/super/announcements/${a.id}`,
        { status: next },
        { headers: authHeader() }
      );

      const item = mapFromBackend(r.data?.item);
      setAnnouncements((prev) => prev.map((x) => (x.id === item.id ? item : x)));
    } catch (e) {
      alert(e?.response?.data?.message || "Durum güncellenemedi");
    }
  }

  function duplicateAnnouncement(a) {
    const copy = {
      ...structuredClone(a),
      id: null,
      title: `${a.title} (Kopya)`,
      status: "taslak",
      createdAt: "",
      updatedAt: "",
    };
    setDraft(copy);
    setAnnPanelMode("create");
    setDirty(true);
    setTab("duyurular");
  }

  async function deleteAnnouncement(a) {
    const ok = confirm(`"${a.title}" duyurusunu silmek istiyor musun?`);
    if (!ok) return;

    try {
      await axios.delete(`${API_BASE}/super/announcements/${a.id}`, {
        headers: authHeader(),
      });
      setAnnouncements((prev) => prev.filter((x) => x.id !== a.id));
      if (selectedAnnouncementId === a.id) {
        setSelectedAnnouncementId(null);
        setAnnPanelMode("view");
      }
    } catch (e) {
      alert(e?.response?.data?.message || "Silme başarısız");
    }
  }

  function markNotificationRead(n, read) {
    setNotifications((prev) =>
      prev.map((x) => (x.id === n.id ? { ...x, read } : x))
    );
  }

  function bulkMarkRead(read) {
    const ids = new Set(filteredNotifications.map((x) => x.id));
    setNotifications((prev) =>
      prev.map((x) => (ids.has(x.id) ? { ...x, read } : x))
    );
  }

  // Handle selection defaults
  useEffect(() => {
    if (tab === "duyurular") {
      if (!selectedAnnouncementId && filteredAnnouncements[0]) {
        setSelectedAnnouncementId(filteredAnnouncements[0].id);
      }
    } else {
      if (!selectedNotificationId && filteredNotifications[0]) {
        setSelectedNotificationId(filteredNotifications[0].id);
      }
    }
  }, [
    tab,
    selectedAnnouncementId,
    selectedNotificationId,
    filteredAnnouncements,
    filteredNotifications,
  ]);

  // ---------- Layout ----------
  return (
    <div className="p-6 bg-slate-50 min-h-[calc(100vh-0px)]">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-2xl font-semibold text-slate-900">
            Duyurular & Bildirimler
          </div>
          <div className="text-sm text-slate-500 mt-1">
            Duyuruları yayınla (tüm/rol/seçili/toplu), bildirimleri (olay & log)
            izle.
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => alert("İleride: CSV/Excel")}>
            <FileDown className="w-4 h-4" />
            Dışa Aktar
          </Button>
          <Button onClick={startCreateAnnouncement}>
            <Plus className="w-4 h-4" />
            Yeni Duyuru
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-5">
        <Kpi
          icon={<Megaphone className="w-5 h-5" />}
          label="Aktif Duyuru"
          value={kpis.active}
          hint="Yayında"
        />
        <Kpi
          icon={<ShieldAlert className="w-5 h-5" />}
          label="Zorunlu Duyuru"
          value={kpis.required}
          hint="Okunmadan geçilemez"
        />
        <Kpi
          icon={<Bell className="w-5 h-5" />}
          label="Okunmamış Bildirim"
          value={kpis.unread}
          hint="Tüm zaman"
        />
        <Kpi
          icon={<AlertTriangle className="w-5 h-5" />}
          label="Kritik Bildirim"
          value={kpis.critical}
          hint="Öncelikli"
        />
      </div>

      {/* Tabs */}
      <div className="mt-5">
        <div className="inline-flex bg-white border border-slate-200 rounded-2xl p-1 shadow-sm">
          <TabButton
            active={tab === "duyurular"}
            onClick={() => {
              setTab("duyurular");
              setAnnPanelMode("view");
              setDirty(false);
            }}
          >
            <Megaphone className="w-4 h-4" />
            Duyurular
          </TabButton>
          <TabButton
            active={tab === "bildirimler"}
            onClick={() => {
              setTab("bildirimler");
              setAnnPanelMode("view");
              setDirty(false);
            }}
          >
            <Bell className="w-4 h-4" />
            Bildirimler
          </TabButton>
        </div>
      </div>

      {/* Body */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-4 mt-4">
        {/* Left: list + filters */}
        <Card className="overflow-hidden">
          {tab === "duyurular" ? (
            <>
              <CardHeader
                title="Duyurular (Kampanyalar)"
                subtitle="Yayınla, planla, kopyala, hedefle."
                right={
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setAnnSearch("");
                        setAnnStatus("hepsi");
                        setAnnType("hepsi");
                        setAnnPriority("hepsi");
                      }}
                    >
                      <Filter className="w-4 h-4" />
                      Sıfırla
                    </Button>
                  </div>
                }
              />
              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                  <div className="md:col-span-2">
                    <FieldLabel icon={<Search className="w-4 h-4" />}>
                      Arama
                    </FieldLabel>
                    <Input
                      value={annSearch}
                      onChange={(e) => setAnnSearch(e.target.value)}
                      placeholder="Başlık / içerik ara…"
                    />
                  </div>

                  <div>
                    <FieldLabel icon={<Tag className="w-4 h-4" />}>
                      Durum
                    </FieldLabel>
                    <Select
                      value={annStatus}
                      onChange={(e) => setAnnStatus(e.target.value)}
                    >
                      <option value="hepsi">Hepsi</option>
                      <option value="aktif">Aktif</option>
                      <option value="taslak">Taslak</option>
                      <option value="pasif">Pasif</option>
                      <option value="bitti">Süresi Doldu</option>
                    </Select>
                  </div>

                  <div>
                    <FieldLabel icon={<AlertTriangle className="w-4 h-4" />}>
                      Öncelik
                    </FieldLabel>
                    <Select
                      value={annPriority}
                      onChange={(e) => setAnnPriority(e.target.value)}
                    >
                      <option value="hepsi">Hepsi</option>
                      <option value="cok_yuksek">Çok Yüksek</option>
                      <option value="yuksek">Yüksek</option>
                      <option value="normal">Normal</option>
                      <option value="dusuk">Düşük</option>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mt-2">
                  <div className="md:col-span-1">
                    <FieldLabel icon={<Info className="w-4 h-4" />}>
                      Tip
                    </FieldLabel>
                    <Select
                      value={annType}
                      onChange={(e) => setAnnType(e.target.value)}
                    >
                      <option value="hepsi">Hepsi</option>
                      <option value="bilgilendirme">Bilgilendirme</option>
                      <option value="sistem">Sistem</option>
                      <option value="zorunlu">Zorunlu</option>
                    </Select>
                  </div>

                  <div className="md:col-span-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-slate-700 mt-2">
                        Sonuç:{" "}
                        <span className="font-semibold">
                          {filteredAnnouncements.length}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-2">
                        Listeye tıkla → sağda detay
                      </div>
                    </div>
                  </div>
                </div>

                <Divider />

                {filteredAnnouncements.length === 0 ? (
                  <EmptyState
                    title="Henüz duyuru yok."
                    desc="Yeni duyuru oluşturup yayınlayabilirsin."
                    action={
                      <Button onClick={startCreateAnnouncement}>
                        <Plus className="w-4 h-4" />
                        Yeni Duyuru
                      </Button>
                    }
                  />
                ) : (
                 <div className="flex flex-col gap-2 max-h-[520px] overflow-y-auto pr-1">
  {filteredAnnouncements.map((a) => (
    <AnnouncementRow
      key={a.id}
      item={a}
      active={a.id === selectedAnnouncementId}
      onClick={() => {
        setSelectedAnnouncementId(a.id);
        setAnnPanelMode("view");
        setDirty(false);
      }}
      onToggleStatus={() => toggleAnnouncementStatus(a)}
      onDuplicate={() => duplicateAnnouncement(a)}
      onEdit={() => startEditAnnouncement(a)}
      onDelete={() => deleteAnnouncement(a)}
    />
  ))}
</div>
                )}
              </div>
            </>
          ) : (
            <>
              <CardHeader
                title="Bildirimler (Olay & Log)"
                subtitle="Sistem olaylarını ve kampanya teslimatlarını izle."
                right={
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={() => bulkMarkRead(true)}>
                      <CheckCircle2 className="w-4 h-4" />
                      Toplu Okundu
                    </Button>
                    <Button variant="secondary" onClick={() => bulkMarkRead(false)}>
                      <XCircle className="w-4 h-4" />
                      Toplu Okunmadı
                    </Button>
                  </div>
                }
              />
              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                  <div className="md:col-span-2">
                    <FieldLabel icon={<Search className="w-4 h-4" />}>
                      Arama
                    </FieldLabel>
                    <Input
                      value={notSearch}
                      onChange={(e) => setNotSearch(e.target.value)}
                      placeholder="Başlık / açıklama / kullanıcı…"
                    />
                  </div>

                  <div>
                    <FieldLabel icon={<Tag className="w-4 h-4" />}>Tür</FieldLabel>
                    <Select value={notKind} onChange={(e) => setNotKind(e.target.value)}>
                      <option value="hepsi">Hepsi</option>
                      <option value="limit">Limit</option>
                      <option value="evrak">Evrak</option>
                      <option value="uygunsuzluk">Uygunsuzluk</option>
                      <option value="kutlama">Kutlama</option>
                      <option value="sistem">Sistem</option>
                      <option value="atama">Atama</option>
                      <option value="sure">Süre</option>
                    </Select>
                  </div>

                  <div>
                    <FieldLabel icon={<User className="w-4 h-4" />}>Okunma</FieldLabel>
                    <Select value={notRead} onChange={(e) => setNotRead(e.target.value)}>
                      <option value="hepsi">Hepsi</option>
                      <option value="okunmamis">Okunmamış</option>
                      <option value="okunmus">Okunmuş</option>
                    </Select>
                  </div>

                  <div>
                    <FieldLabel icon={<AlertTriangle className="w-4 h-4" />}>Seviye</FieldLabel>
                    <Select
                      value={notSeverity}
                      onChange={(e) => setNotSeverity(e.target.value)}
                    >
                      <option value="hepsi">Hepsi</option>
                      <option value="kritik">Kritik</option>
                      <option value="yuksek">Yüksek</option>
                      <option value="normal">Normal</option>
                      <option value="dusuk">Düşük</option>
                    </Select>
                  </div>
                </div>

                <Divider />

                {filteredNotifications.length === 0 ? (
                  <EmptyState
                    title="Bildirim bulunamadı."
                    desc="Filtreleri sıfırlayıp tekrar deneyebilirsin."
                    action={
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setNotSearch("");
                          setNotKind("hepsi");
                          setNotRead("hepsi");
                          setNotSeverity("hepsi");
                        }}
                      >
                        <Filter className="w-4 h-4" />
                        Filtreleri Sıfırla
                      </Button>
                    }
                  />
                ) : (
                  <div className="flex flex-col gap-2 max-h-[520px] overflow-y-auto pr-1">
  {filteredNotifications.map((n) => (
    <NotificationRow
      key={n.id}
      item={n}
      active={n.id === selectedNotificationId}
      onClick={() => setSelectedNotificationId(n.id)}
      onToggleRead={() => markNotificationRead(n, !n.read)}
    />
  ))}
</div>
                )}
              </div>
            </>
          )}
        </Card>

        {/* Right: detail panel */}
        <Card className="overflow-hidden">
          {tab === "duyurular" ? (
            <AnnouncementPanel
              mode={annPanelMode}
              setMode={setAnnPanelMode}
              selected={selectedAnnouncement}
              draft={draft}
              setDraft={(updater) => {
                setDraft((prev) => {
                  const next = typeof updater === "function" ? updater(prev) : updater;
                  return next;
                });
                if (!dirtyRef.current) setDirty(true);
              }}
              dirty={dirty}
              setDirty={setDirty}
              templateKey={draftTemplateKey}
              onApplyTemplate={applyTemplate}
              onCancel={cancelDraft}
              onStartEdit={() => selectedAnnouncement && startEditAnnouncement(selectedAnnouncement)}
              onStartCreate={startCreateAnnouncement}
              onSaveDraft={saveAsDraft}
              onPublish={publishAnnouncement}
            />
          ) : (
            <NotificationPanel
              selected={selectedNotification}
              onToggleRead={() =>
                selectedNotification &&
                markNotificationRead(selectedNotification, !selectedNotification.read)
              }
            />
          )}
        </Card>
      </div>
    </div>
  );
}

// ---------- Announcement Row ----------
function AnnouncementRow({
  item,
  active,
  onClick,
  onToggleStatus,
  onDuplicate,
  onEdit,
  onDelete,
}) {
  const targetLabel = audienceShort(item.audience);

  return (
    <div
      onClick={onClick}
      className={cn(
        "cursor-pointer p-3 rounded-2xl border transition shadow-sm",
        active
          ? "border-slate-900 bg-slate-50"
          : "border-slate-200 bg-white hover:bg-slate-50"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-slate-900 truncate">
              {item.title}
            </div>
            {item.requiredAck ? (
              <Pill
                className="bg-red-50 text-red-700 border-red-200"
                icon={<ShieldAlert className="w-3.5 h-3.5" />}
              >
                Zorunlu
              </Pill>
            ) : null}
          </div>

          <div className="text-xs text-slate-500 mt-1 line-clamp-1">
            {item.content}
          </div>

          <div className="flex flex-wrap gap-2 mt-2">
            <Pill className={badgeStyleForType(item.type)}>
              {labelType(item.type)}
            </Pill>
            <Pill className={badgeStyleForPriority(item.priority)}>
              {labelPriority(item.priority)}
            </Pill>
            <Pill className={badgeStyleForStatus(item.status)}>
              {labelStatus(item.status)}
            </Pill>
            <Pill
              className="bg-slate-50 text-slate-700 border-slate-200"
              icon={<Users className="w-3.5 h-3.5" />}
            >
              {targetLabel}
            </Pill>
          </div>

          <div className="mt-2 text-xs text-slate-500 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" />
            <span>
              {formatDT(item.startAt)} {item.endAt ? `→ ${formatDT(item.endAt)}` : ""}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleStatus();
            }}
            className={cn(
              "px-2.5 py-1 rounded-full text-xs font-medium border transition",
              item.status === "aktif"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
            )}
          >
            {item.status === "aktif" ? "Aktif" : "Pasif"}
          </button>

          <div className="flex items-center gap-1">
            <IconBtn
              title="Kopyala"
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate();
              }}
            >
              <Copy className="w-4 h-4" />
            </IconBtn>
            <IconBtn
              title="Düzenle"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            >
              <Pencil className="w-4 h-4" />
            </IconBtn>
            <IconBtn
              title="Sil"
              danger
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="w-4 h-4" />
            </IconBtn>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Announcement Panel ----------
function AnnouncementPanel({
  mode,
  setMode,
  selected,
  draft,
  setDraft,
  dirty,
  setDirty,
  templateKey,
  onApplyTemplate,
  onCancel,
  onStartEdit,
  onStartCreate,
  onSaveDraft,
  onPublish,
}) {
  const isCreate = mode === "create";
  const isEdit = mode === "edit";
  const isForm = isCreate || isEdit;

  useEffect(() => {
    if (!isForm) setDirty(false);
  }, [isForm, setDirty]);

  return (
    <>
      <CardHeader
        title={
          isForm
            ? isCreate
              ? "Yeni Duyuru"
              : "Duyuruyu Düzenle"
            : "Duyuru Detayı"
        }
        subtitle={
          isForm
            ? "Hedefle, planla ve yayınla."
            : selected
            ? "Kampanya detayları ve hızlı aksiyonlar."
            : "Listeden bir duyuru seç."
        }
        right={
          isForm ? (
            <div className="flex items-center gap-2">
              {dirty ? (
                <Pill className="bg-amber-50 text-amber-700 border-amber-200">
                  Kaydedilmedi
                </Pill>
              ) : (
                <Pill className="bg-emerald-50 text-emerald-700 border-emerald-200">
                  Güncel
                </Pill>
              )}
              <Button variant="secondary" onClick={onCancel}>
                <X className="w-4 h-4" />
                Vazgeç
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={onStartCreate}>
                <Plus className="w-4 h-4" />
                Yeni
              </Button>
              <Button
                variant="secondary"
                onClick={() => selected && onStartEdit()}
                disabled={!selected}
              >
                <Pencil className="w-4 h-4" />
                Düzenle
              </Button>
            </div>
          )
        }
      />

      <div className="p-4">
        {!selected && !isForm ? (
          <EmptyState
            title="Duyuru seçilmedi."
            desc="Soldaki listeden bir duyuru seç veya yeni duyuru oluştur."
            action={
              <Button onClick={onStartCreate}>
                <Plus className="w-4 h-4" />
                Yeni Duyuru
              </Button>
            }
          />
        ) : isForm ? (
          <div className="space-y-4">
            {/* Template */}
            <div>
              <FieldLabel icon={<Sparkles className="w-4 h-4" />}>
                Şablon (opsiyonel)
              </FieldLabel>
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={templateKey}
                  onChange={(e) => onApplyTemplate(e.target.value)}
                >
                  {TEMPLATE_OPTIONS.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </Select>

                <Button
                  variant="secondary"
                  onClick={() => {
                    navigator.clipboard?.writeText(draft.content || "");
                    alert("İçerik panoya kopyalandı.");
                  }}
                >
                  <Copy className="w-4 h-4" />
                  İçeriği Kopyala
                </Button>
              </div>
              <div className="text-xs text-slate-500 mt-2">
                Placeholder örnekleri:{" "}
                <span className="font-mono">{"{{adSoyad}}"}</span>{" "}
                <span className="font-mono">{"{{tarih}}"}</span>{" "}
                <span className="font-mono">{"{{paketAdi}}"}</span>
              </div>
            </div>

            {/* Title */}
            <div>
              <FieldLabel>Başlık</FieldLabel>
              <Input
                value={draft.title}
                onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
                placeholder="Örn: 🔧 Planlı bakım"
              />
            </div>

            {/* Content */}
            <div>
              <FieldLabel>İçerik</FieldLabel>
              <Textarea
                value={draft.content}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, content: e.target.value }))
                }
                placeholder="Duyuru içeriğini yaz…"
              />
            </div>

            {/* Type / Priority / Required */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div>
                <FieldLabel>Tip</FieldLabel>
                <Select
                  value={draft.type}
                  onChange={(e) => setDraft((p) => ({ ...p, type: e.target.value }))}
                >
                  <option value="bilgilendirme">Bilgilendirme</option>
                  <option value="sistem">Sistem</option>
                  <option value="zorunlu">Zorunlu</option>
                </Select>
              </div>

              <div>
                <FieldLabel>Öncelik</FieldLabel>
                <Select
                  value={draft.priority}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, priority: e.target.value }))
                  }
                >
                  <option value="cok_yuksek">Çok Yüksek</option>
                  <option value="yuksek">Yüksek</option>
                  <option value="normal">Normal</option>
                  <option value="dusuk">Düşük</option>
                </Select>
              </div>

              <div>
                <FieldLabel>Zorunlu okuma</FieldLabel>
                <div className="flex items-center justify-between px-3 py-2 rounded-xl border border-slate-200 bg-white">
                  <div className="text-sm text-slate-700">Okunmadan geçilemesin</div>
                  <input
                    type="checkbox"
                    checked={!!draft.requiredAck}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, requiredAck: e.target.checked }))
                    }
                    className="w-4 h-4"
                  />
                </div>
              </div>
            </div>

            {/* Schedule */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <FieldLabel icon={<Calendar className="w-4 h-4" />}>
                  Başlangıç
                </FieldLabel>
                <Input
                  type="datetime-local"
                  value={draft.startAt || ""}
                  onChange={(e) => setDraft((p) => ({ ...p, startAt: e.target.value }))}
                />
              </div>
              <div>
                <FieldLabel icon={<Calendar className="w-4 h-4" />}>
                  Bitiş (opsiyonel)
                </FieldLabel>
                <Input
                  type="datetime-local"
                  value={draft.endAt || ""}
                  onChange={(e) => setDraft((p) => ({ ...p, endAt: e.target.value }))}
                />
              </div>
            </div>

            {/* Audience */}
            <AudienceBuilder
              value={draft.audience}
              onChange={(aud) => setDraft((p) => ({ ...p, audience: aud }))}
            />

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <div className="text-xs text-slate-500">
                Taslak kaydet veya direkt yayınla.
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={onSaveDraft}>
                  <Save className="w-4 h-4" />
                  Taslak Kaydet
                </Button>
                <Button onClick={onPublish}>
                  <Send className="w-4 h-4" />
                  Yayınla
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <AnnouncementDetailView selected={selected} />
        )}
      </div>
    </>
  );
}

function AnnouncementDetailView({ selected }) {
  if (!selected) return null;
  const audLabel = audienceShort(selected.audience);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Pill className={badgeStyleForType(selected.type)}>
          {labelType(selected.type)}
        </Pill>
        <Pill className={badgeStyleForPriority(selected.priority)}>
          {labelPriority(selected.priority)}
        </Pill>
        <Pill className={badgeStyleForStatus(selected.status)}>
          {labelStatus(selected.status)}
        </Pill>
        {selected.requiredAck ? (
          <Pill
            className="bg-red-50 text-red-700 border-red-200"
            icon={<ShieldAlert className="w-3.5 h-3.5" />}
          >
            Zorunlu okuma
          </Pill>
        ) : null}
      </div>

      <div className="text-lg font-semibold text-slate-900">{selected.title}</div>
      <div className="text-sm text-slate-600 whitespace-pre-wrap">
        {selected.content}
      </div>

      <div className="grid grid-cols-1 gap-2 pt-2">
        <MetaRow label="Zaman">
          {formatDT(selected.startAt)} {selected.endAt ? `→ ${formatDT(selected.endAt)}` : ""}
        </MetaRow>
        <MetaRow label="Hedef">{audLabel}</MetaRow>
        <MetaRow label="Oluşturma">{formatDT(selected.createdAt)}</MetaRow>
        <MetaRow label="Güncelleme">{formatDT(selected.updatedAt)}</MetaRow>
      </div>
    </div>
  );
}

function MetaRow({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-xs font-medium text-slate-800 text-right">{children}</div>
    </div>
  );
}

function AudienceBuilder({ value, onChange }) {
  const aud = value || { mode: "all", roles: [], users: [], bulk: "" };
  const [userInput, setUserInput] = useState("");

  function setMode(mode) {
    onChange({
      mode,
      roles: mode === "role" ? aud.roles : [],
      users: mode === "users" ? aud.users : [],
      bulk: mode === "bulk" ? aud.bulk : "",
    });
  }

  function toggleRole(roleKey) {
    const set = new Set(aud.roles || []);
    set.has(roleKey) ? set.delete(roleKey) : set.add(roleKey);
    onChange({ ...aud, roles: Array.from(set) });
  }

  function addUserChip() {
    const text = userInput.trim();
    if (!text) return;
    const set = new Set(aud.users || []);
    set.add(text);
    onChange({ ...aud, users: Array.from(set) });
    setUserInput("");
  }

  function removeUserChip(x) {
    onChange({ ...aud, users: (aud.users || []).filter((u) => u !== x) });
  }

  const bulkCount = useMemo(() => parseBulkTargets(aud.bulk).length, [aud.bulk]);

  return (
    <div className="p-3 rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-900">Hedef Kitle</div>
        <Pill
          className="bg-slate-50 text-slate-700 border-slate-200"
          icon={<Users className="w-3.5 h-3.5" />}
        >
          {audienceShort(aud)}
        </Pill>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-3">
        <AudienceModeCard
          active={aud.mode === "all"}
          title="Tüm kullanıcılar"
          desc="Broadcast"
          icon={<Users className="w-4 h-4" />}
          onClick={() => setMode("all")}
        />
        <AudienceModeCard
          active={aud.mode === "role"}
          title="Rol bazlı"
          desc="İşveren, Uzman…"
          icon={<Tag className="w-4 h-4" />}
          onClick={() => setMode("role")}
        />
        <AudienceModeCard
          active={aud.mode === "users"}
          title="Seçili kullanıcılar"
          desc="Tek tek ekle"
          icon={<User className="w-4 h-4" />}
          onClick={() => setMode("users")}
        />
        <AudienceModeCard
          active={aud.mode === "bulk"}
          title="Toplu liste"
          desc="E-posta/ID yapıştır"
          icon={<FileDown className="w-4 h-4" />}
          onClick={() => setMode("bulk")}
        />
      </div>

      {aud.mode === "role" ? (
        <div className="mt-3">
          <div className="text-xs font-medium text-slate-600 mb-2">Roller (çoklu)</div>
          <div className="flex flex-wrap gap-2">
            {ROLE_OPTIONS.map((r) => {
              const active = (aud.roles || []).includes(r.key);
              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => toggleRole(r.key)}
                  className={cn(
                    "px-3 py-1.5 rounded-full border text-xs font-medium transition",
                    active
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  )}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {aud.mode === "users" ? (
        <div className="mt-3">
          <div className="text-xs font-medium text-slate-600 mb-2">
            Kullanıcı ekle (ID veya e-posta yazıp Enter)
          </div>
          <div className="flex gap-2">
            <Input
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="örn: u_123 veya mail@domain.com"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addUserChip();
                }
              }}
            />
            <Button variant="secondary" type="button" onClick={addUserChip}>
              Ekle
            </Button>
          </div>

          {(aud.users || []).length > 0 ? (
            <div className="flex flex-wrap gap-2 mt-3">
              {aud.users.map((u) => (
                <span
                  key={u}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-xs text-slate-700"
                >
                  {u}
                  <button
                    type="button"
                    onClick={() => removeUserChip(u)}
                    className="text-slate-400 hover:text-slate-700"
                    title="Kaldır"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <div className="text-xs text-slate-500 mt-3">Henüz kullanıcı eklenmedi.</div>
          )}
        </div>
      ) : null}

      {aud.mode === "bulk" ? (
        <div className="mt-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-slate-600 mb-2">
              Toplu hedef listesi (satır satır e-posta/ID)
            </div>
            <Pill className="bg-slate-50 text-slate-700 border-slate-200">
              {bulkCount} hedef
            </Pill>
          </div>
          <Textarea
            value={aud.bulk || ""}
            onChange={(e) => onChange({ ...aud, bulk: e.target.value })}
            placeholder={"örnek:\nmehmet@abc.com\nu_123\nayse@demo.com"}
          />
          <div className="text-xs text-slate-500 mt-2">
            Ayırıcılar: yeni satır, virgül, boşluk, noktalı virgül.
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AudienceModeCard({ active, title, desc, icon, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "p-3 rounded-2xl border text-left transition flex items-start gap-3",
        active
          ? "border-slate-900 bg-slate-50"
          : "border-slate-200 bg-white hover:bg-slate-50"
      )}
    >
      <div
        className={cn(
          "w-9 h-9 rounded-2xl flex items-center justify-center",
          active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <div className="text-xs text-slate-500 mt-0.5">{desc}</div>
      </div>
    </button>
  );
}

// ---------- Notification UI (mock) ----------
function NotificationRow({ item, active, onClick, onToggleRead }) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "cursor-pointer p-3 rounded-2xl border transition shadow-sm",
        active
          ? "border-slate-900 bg-slate-50"
          : "border-slate-200 bg-white hover:bg-slate-50"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-700">
              {notifIcon(item.kind)}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900 truncate">
                {item.title}
              </div>
              <div className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                {item.message}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-2">
            <Pill className={notifBadge(item.severity)}>
              {item.severity === "kritik"
                ? "Kritik"
                : item.severity === "yuksek"
                ? "Yüksek"
                : item.severity === "dusuk"
                ? "Düşük"
                : "Normal"}
            </Pill>

            <Pill
              className={cn(
                "border-slate-200",
                item.read
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700"
              )}
            >
              {item.read ? "Okundu" : "Okunmadı"}
            </Pill>
          </div>

          <div className="mt-2 text-xs text-slate-500 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" />
            <span>{formatDT(item.createdAt)}</span>
          </div>
        </div>

        <div className="shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleRead();
            }}
            className={cn(
              "px-2.5 py-1 rounded-full text-xs font-medium border transition",
              item.read
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
            )}
          >
            {item.read ? "Okundu" : "Okunmadı"}
          </button>
        </div>
      </div>
    </div>
  );
}

function NotificationPanel({ selected, onToggleRead }) {
  return (
    <>
      <CardHeader
        title="Bildirim Detayı"
        subtitle={selected ? "Olay/teslimat detayları." : "Listeden bir bildirim seç."}
        right={
          <Button variant="secondary" onClick={onToggleRead} disabled={!selected}>
            <CheckCircle2 className="w-4 h-4" />
            Okundu Değiştir
          </Button>
        }
      />
      <div className="p-4">
        {!selected ? (
          <EmptyState title="Bildirim seçilmedi." desc="Soldaki listeden bir bildirim seç." action={<span />} />
        ) : (
          <div className="space-y-2">
            <Pill className={notifBadge(selected.severity)}>
              {selected.severity}
            </Pill>
            <div className="text-lg font-semibold text-slate-900">{selected.title}</div>
            <div className="text-sm text-slate-600">{selected.message}</div>
          </div>
        )}
      </div>
    </>
  );
}
