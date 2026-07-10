// src/pages/super/Teklifler.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toTitleTR } from "../../utils/toTitleTR";
import {
  BadgeCheck,
  Banknote,
  Building2,
  CheckCircle2,
  Clock,
  Copy,
  FileDown,
  Filter,
  Inbox,
  Link2,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  UserRound,
  Users,
  XCircle,
} from "lucide-react";

/**
 * ✅ Süper Admin > Teklifler
 * Amaç: Büyük kurumlar (10+ kullanıcı) için kontrollü satış & kayıt akışı.
 */

const BRAND = "#0a2b45";
const DEFAULT_OFFER_NOTES = `Bu teklif, belirtilen geçerlilik süresi boyunca geçerlidir.
Fiyatlara Katma Değer Vergisi (KDV) dahildir.
Teklifin kabul edilmesi durumunda “Devam Et” adımı ile kayıt ve ödeme sürecine yönlendirilirsiniz.
Kayıt ve ödeme işlemlerinin tamamlanmasının ardından paneliniz aktif hale getirilecek ve hizmet süreci başlatılacaktır.
Hizmet kapsamı, teklif onayı sonrasında ilgili mevzuat ve paket içeriği doğrultusunda uygulanır.`;

function cn(...a) {
  return a.filter(Boolean).join(" ");
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
  const styleProp = variant === "primary" ? { backgroundColor: BRAND } : undefined;

  return (
    <button {...props} style={styleProp} className={cn(base, styles, className)}>
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
        "w-full px-3 py-2 rounded-xl border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-slate-200 min-h-[110px] resize-y",
        className
      )}
    />
  );
}

function Card({ className, children }) {
  return (
    <div className={cn("bg-white border border-slate-200 rounded-2xl shadow-sm", className)}>
      {children}
    </div>
  );
}

function CardHeader({ title, subtitle, right }) {
  return (
    <div className="p-5 border-b border-slate-200 flex items-start justify-between gap-4">
      <div>
        <div className="text-lg font-semibold text-slate-900">{title}</div>
        {subtitle ? <div className="text-sm text-slate-500 mt-1">{subtitle}</div> : null}
      </div>
      {right}
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-slate-200 my-3" />;
}

function Pill({ tone = "neutral", children, icon }) {
  const base =
    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium";
  const styles =
    tone === "good"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : tone === "warn"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : tone === "bad"
      ? "bg-red-50 text-red-700 border-red-200"
      : tone === "info"
      ? "bg-sky-50 text-sky-700 border-sky-200"
      : "bg-slate-50 text-slate-700 border-slate-200";

  return (
    <span className={cn(base, styles)}>
      {icon ? <span className="opacity-80">{icon}</span> : null}
      {children}
    </span>
  );
}

function makeId(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}
function nowLocalISO() {
  const d = new Date();
  const pad2 = (n) => (n < 10 ? `0${n}` : `${n}`);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(
    d.getHours()
  )}:${pad2(d.getMinutes())}`;
}
function formatDT(dt) {
  if (!dt) return "—";
  const [d, t] = dt.split("T");
  return t ? `${d} ${t}` : d;
}
function safeLower(s) {
  return (s || "").toString().toLowerCase();
}
function addDaysISO(baseISO, days) {
  const d = baseISO ? new Date(baseISO) : new Date();
  d.setDate(d.getDate() + days);
  return toDTLocalValue(d);
}
function toDTLocalValue(date) {
  const d = new Date(date);
  const pad2 = (n) => (n < 10 ? `0${n}` : `${n}`);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(
    d.getHours()
  )}:${pad2(d.getMinutes())}`;
}
function genToken(len = 22) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
function currencyTRY(n) {
  const x = Number(n || 0);
  return x.toLocaleString("tr-TR", { style: "currency", currency: "TRY" });
}

// --- Status / Tones ---
function offerStatusLabel(s) {
  switch (s) {
    case "draft":
      return "Taslak";
    case "sent":
      return "Gönderildi";
    case "opened":
      return "Açıldı";
    case "registered":
      return "Kayıt Yapıldı";
    case "paid":
      return "Ödeme Alındı";
    case "active":
      return "Aktif";
    case "expired":
      return "Süresi Doldu";
    case "canceled":
      return "İptal";
    default:
      return s;
  }
}
function offerStatusTone(s) {
  switch (s) {
    case "active":
    case "paid":
      return "good";
    case "registered":
    case "opened":
    case "sent":
      return "info";
    case "expired":
      return "warn";
    case "canceled":
      return "bad";
    default:
      return "neutral";
  }
}

// ✅ Source / Tones
function offerSourceLabel(src) {
  const s = (src || "").toString().toLowerCase();
  if (s === "panel") return "PANEL";
  if (s === "inbox") return "MAIL";
  if (s === "landing" || s === "landing_form") return "FORM";
  if (s === "web") return "WEB";
  return s ? s.toUpperCase() : "—";
}
function offerSourceTone(src) {
  const s = (src || "").toString().toLowerCase();
  if (s === "panel") return "info";
  if (s === "inbox") return "warn";
  if (s === "landing" || s === "landing_form") return "good";
  if (s === "web") return "neutral";
  return "neutral";
}

function offerDeliveryLabel(delivery) {
  const d = (delivery || "").toString().toLowerCase();
  if (d === "panel") return "PANEL";
  if (d === "email" || d === "mail") return "MAIL";
  return d ? d.toUpperCase() : "—";
}
function offerDeliveryTone(delivery) {
  const d = (delivery || "").toString().toLowerCase();
  if (d === "panel") return "info";
  if (d === "email" || d === "mail") return "warn";
  return "neutral";
}
function isPanelDelivery(offerLike) {
  const delivery = (
    offerLike?.delivery ||
    offerLike?.deliveryType ||
    offerLike?.delivery_method ||
    offerLike?.delivery_type ||
    ""
  )
    .toString()
    .toLowerCase();

  if (delivery === "panel") return true;
  if (delivery === "email") return false;

  return false;
}

// ✅ Inbox mail kaynağı algılama (panel içi mi?)
function detectInboxSource(mail) {
  const meta = mail?.meta || {};
  const src =
    meta?.source ||
    meta?.origin ||
    meta?.channel ||
    mail?.source ||
    "";

  const s = String(src).toLowerCase();

  // backend meta: { source: "panel" } gibi
  if (s === "panel") return "panel";

  // subject / body heuristics (güvenli)
  const subj = (mail?.subject || "").toString().toLowerCase();
  const body = (getMailText(mail) || "").toString().toLowerCase();

  if (subj.includes("[panel]") || subj.includes("panel içi") || subj.includes("panel ici")) return "panel";
  if (body.includes("panel_teklif") || body.includes("panel içi") || body.includes("panel ici")) return "panel";

  return "inbox"; // normal mail
}

function isPanelInboxMail(mail) {
  return detectInboxSource(mail) === "panel";
}

function eventIcon(type) {
  switch (type) {
    case "LEAD_CREATED":
      return <Mail className="w-4 h-4" />;
    case "OFFER_CREATED":
      return <Plus className="w-4 h-4" />;
    case "LINK_GENERATED":
      return <Link2 className="w-4 h-4" />;
    case "EMAIL_SENT":
      return <Mail className="w-4 h-4" />;

    // ✅ yeni
    case "PANEL_SENT":
      return <Inbox className="w-4 h-4" />;

    case "LINK_OPENED":
      return <Clock className="w-4 h-4" />;
    case "REGISTERED":
      return <Building2 className="w-4 h-4" />;
    case "PAYMENT_SUCCESS":
      return <Banknote className="w-4 h-4" />;
    case "LOGIN_FIRST":
      return <BadgeCheck className="w-4 h-4" />;
    case "EXPIRED":
      return <ShieldAlert className="w-4 h-4" />;
    case "CANCELED":
      return <XCircle className="w-4 h-4" />;
    default:
      return <Clock className="w-4 h-4" />;
  }
}
function calcOfferSummary(offers) {
  const total = offers.length;
  const active = offers.filter((o) => o.status === "active").length;
  const sent = offers.filter((o) => o.status === "sent" || o.status === "opened").length;
  const registered = offers.filter(
    (o) => o.status === "registered" || o.status === "paid" || o.status === "active"
  ).length;
  const revenue = offers
    .filter((o) => o.status === "paid" || o.status === "active")
    .reduce((sum, o) => sum + (Number(o.priceTRY) || 0), 0);
  return { total, active, sent, registered, revenue };
}

// --- Mock Data ---
const initialLeads = [
  {
    id: makeId("lead"),
    companyName: "İsg Panel ",
    contactName: "Mehmet ARIKAN",
    email: "mehmet@isgpanel.com",
    phone: "+90 5xx xxx xx xx",
    usersExpected: 120,
    note: "10+ kullanıcı. Kurumsal talep. Teklif istiyor.",
    createdAt: "2026-01-10T11:20",
    source: "landing_form",
    status: "new",
  },
  {
    id: makeId("lead"),
    companyName: "Mavi İnşaat",
    contactName: "Ahmet Şahin",
    email: "ahmet@maviinsaat.com",
    phone: "+90 5xx xxx xx xx",
    usersExpected: 45,
    note: "Şantiye ağırlıklı kullanım, e-imza opsiyonu soruyor.",
    createdAt: "2026-01-09T15:05",
    source: "landing_form",
    status: "contacted",
  },
];

const initialOffers = [
  {
    id: makeId("off"),
    leadId: null,
    companyName: "Orion OSGB",
    contactName: "Elif Arslan",
    email: "elif@orionosgb.com",
    usersCount: 80,
    durationDays: 14,
    priceTRY: 19900,
    currency: "TRY",
    notes: "Kurumsal paket + eğitim modülü dahil.",
    createdAt: "2026-01-08T10:30",
    updatedAt: "2026-01-08T10:30",
    token: genToken(),
    linkExpiresAt: "2026-01-22T10:30",
    status: "sent",
    paymentRef: null,
    source: "panel",
  },
  {
    id: makeId("off"),
    leadId: null,
    companyName: "Beta Kimya",
    contactName: "Murat Uçar",
    email: "murat@betakimya.com",
    usersCount: 25,
    durationDays: 7,
    priceTRY: 9900,
    currency: "TRY",
    notes: "Pilot kullanım. 7 gün içinde kayıt + ödeme.",
    createdAt: "2026-01-06T16:10",
    updatedAt: "2026-01-06T16:10",
    token: genToken(),
    linkExpiresAt: "2026-01-13T16:10",
    status: "paid",
    paymentRef: "PAY_9XK2A",
    source: "panel",
  },
];

const initialEvents = [
  {
    id: makeId("evt"),
    offerId: initialOffers[0]?.id,
    type: "OFFER_CREATED",
    at: "2026-01-08T10:30",
    by: "superadmin",
    meta: { usersCount: 80, priceTRY: 19900 },
  },
  {
    id: makeId("evt"),
    offerId: initialOffers[0]?.id,
    type: "LINK_GENERATED",
    at: "2026-01-08T10:31",
    by: "system",
    meta: { token: initialOffers[0]?.token },
  },
  {
    id: makeId("evt"),
    offerId: initialOffers[0]?.id,
    type: "EMAIL_SENT",
    at: "2026-01-08T10:33",
    by: "system",
    meta: { to: "elif@orionosgb.com" },
  },
  {
    id: makeId("evt"),
    offerId: initialOffers[1]?.id,
    type: "OFFER_CREATED",
    at: "2026-01-06T16:10",
    by: "superadmin",
    meta: { usersCount: 25, priceTRY: 9900 },
  },
  {
    id: makeId("evt"),
    offerId: initialOffers[1]?.id,
    type: "LINK_GENERATED",
    at: "2026-01-06T16:11",
    by: "system",
    meta: { token: initialOffers[1]?.token },
  },
  {
    id: makeId("evt"),
    offerId: initialOffers[1]?.id,
    type: "LINK_OPENED",
    at: "2026-01-06T18:20",
    by: "prospect",
    meta: {},
  },
  {
    id: makeId("evt"),
    offerId: initialOffers[1]?.id,
    type: "REGISTERED",
    at: "2026-01-06T18:45",
    by: "prospect",
    meta: { orgId: "ORG_23A" },
  },
  {
    id: makeId("evt"),
    offerId: initialOffers[1]?.id,
    type: "PAYMENT_SUCCESS",
    at: "2026-01-06T19:02",
    by: "payment",
    meta: { paymentRef: "PAY_9XK2A", amountTRY: 9900 },
  },
];

// --- Inbox Mock ---
const initialInbox = [];

function buildOfferLink(token, usersCount, meta = {}) {
  const APP_URL =
    (typeof import.meta !== "undefined" && import.meta?.env?.VITE_APP_URL) ||
    window.location.origin;

  const safeToken = String(token || "").trim();
  return `${APP_URL}/kayit/teklif/${encodeURIComponent(safeToken)}`;
}

export default function Teklifler() {
  function readPilots() {
    try {
      const raw = localStorage.getItem("super_pilots");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function persistPilots(next) {
    try {
      localStorage.setItem("super_pilots", JSON.stringify(next || []));
    } catch {}
  }

  const [tab, setTab] = useState(() => localStorage.getItem("super_tab") || "teklifler");
  useEffect(() => {
    localStorage.setItem("super_tab", tab);
  }, [tab]);

  // ---------------- PILOT STATE ----------------
  const [pilots, setPilots] = useState(() => {
    try {
      const raw = localStorage.getItem("super_pilots");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [selectedPilotId, setSelectedPilotId] = useState(() => localStorage.getItem("super_pilot_selected") || null);
const [pilotMode, setPilotMode] = useState("view"); // "view" | "create" | "edit"

  useEffect(() => {
    try {
      localStorage.setItem("super_pilots", JSON.stringify(pilots || []));
    } catch {}
  }, [pilots]);

  useEffect(() => {
    if (selectedPilotId) localStorage.setItem("super_pilot_selected", selectedPilotId);
    else localStorage.removeItem("super_pilot_selected");
  }, [selectedPilotId]);

  const [pilotLoading, setPilotLoading] = useState(false);

  const DEFAULT_PILOT_NOTES = `Pilot kullanım süresi boyunca ödeme alınmaz.
Pilot süresi sonunda hizmetin devamı için ücretli pakete geçiş yapılır.
Pilot kapsamı ve kullanıcı limiti bu kayıtla sabitlenir.`;

 const [pilotDraft, setPilotDraft] = useState({
  id: null,
  companyName: "",
  contactName: "",
  email: "",
  usersCount: 10,
  pilotDays: 30,

  // ✅ Link süresi (kayıt için)
  linkDays: 5,
  linkExpiresAt: "",

  token: genToken(),
  createdAt: "",
  pilotEndDate: "",
  status: "draft",
  notes: DEFAULT_PILOT_NOTES,
});

  // ---------------- TEKLİF / LEAD / EVENT ----------------
  const [leads, setLeads] = useState([]);
  const [offers, setOffers] = useState([]);
  const [events, setEvents] = useState([]);

  // Inbox
  const [inboxMails, setInboxMails] = useState([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [mailSearch, setMailSearch] = useState("");
  const [mailStatus, setMailStatus] = useState("hepsi");
  const [selectedMailId, setSelectedMailId] = useState(null);

  // ✅ API helpers
  const API_BASE =
    (typeof import.meta !== "undefined" && import.meta?.env?.VITE_API_URL) ||
    (typeof process !== "undefined" && process?.env?.REACT_APP_API_URL) ||
    "";

  function getAuthToken() {
    return (
      localStorage.getItem("token") ||
      localStorage.getItem("accessToken") ||
      localStorage.getItem("jwt") ||
      ""
    );
  }

  async function apiGet(url) {
    const token = getAuthToken();
    const res = await fetch(`${API_BASE}${url}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async function apiPost(url, body) {
    const token = getAuthToken();
    const res = await fetch(`${API_BASE}${url}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body || {}),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async function apiDelete(url) {
    const token = getAuthToken();
    const res = await fetch(`${API_BASE}${url}`, {
      method: "DELETE",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json().catch(() => ({}));
  }

  async function deleteOffer(offer) {
    const ok = confirm(`"${offer.companyName}" teklifini silmek istiyor musun?`);
    if (!ok) return;

    try {
      await apiDelete(`/api/super/offers/${offer.id}`);
      await fetchOffers();
      if (selectedOfferId === offer.id) setSelectedOfferId(null);
    } catch (e) {
      console.error(e);
      alert("Teklif silinemedi: " + (e?.message || e));
    }
  }

  async function deleteInboxMail(id) {
    const ok = confirm("Bu maili silmek istiyor musun?");
    if (!ok) return;

    try {
      await apiDelete(`/api/super/inbox/${id}`);
      setInboxMails((prev) => prev.filter((m) => m.id !== id));
      if (selectedMailId === id) setSelectedMailId(null);
    } catch (e) {
      console.error(e);
      alert("Mail silinemedi");
    }
  }

  // ---------------- PILOT API (MOCK/STATE) ----------------
  const fetchPilots = useCallback(async () => {
    setPilotLoading(true);
    try {
      const list = readPilots();
      setPilots(list);
      setSelectedPilotId((prev) => prev ?? (list?.[0]?.id ? String(list[0].id) : null));
      return list;
    } finally {
      setPilotLoading(false);
    }
  }, []);

  function genTempPassword(len = 10) {
    const U = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const L = "abcdefghijkmnopqrstuvwxyz";
    const D = "23456789";
    const S = "!@#$%*?_-";
    const all = U + L + D + S;

    const pick = (pool) => pool[Math.floor(Math.random() * pool.length)];

    let out = pick(U) + pick(S);
    for (let i = out.length; i < len; i++) out += pick(all);
    return out
      .split("")
      .sort(() => Math.random() - 0.5)
      .join("");
  }

 async function createPilot(payload) {
  const now = nowLocalISO();
  const linkDays = Number(payload?.linkDays || 5);

  const newPilot = {
    ...payload,
    id: payload?.id ? String(payload.id) : makeId("pilot"),
    createdAt: payload?.createdAt || now,
    updatedAt: now,
    linkDays,
    linkExpiresAt:
      payload?.linkExpiresAt || addDaysISO(payload?.createdAt || now, linkDays),
    pilotEndDate:
      payload?.pilotEndDate ||
      addDaysISO(payload?.createdAt || now, Number(payload?.pilotDays || 30)),
    status: payload?.status || "draft",
    token: payload?.token || genToken(),
  };

  // ✅ BACKEND’E PİLOT KAYDI
  try {
    await apiPost("/api/super/pilots/create", {
      companyName: newPilot.companyName,
      contactName: newPilot.contactName,
      email: newPilot.email,
      usersCount: Number(newPilot.usersCount || 0),
      pilotDays: Number(newPilot.pilotDays || 30),
      linkDays: Number(newPilot.linkDays || 5),
      token: newPilot.token,
      pilotEndDate: newPilot.pilotEndDate,
      linkExpiresAt: newPilot.linkExpiresAt,
      status: "pilot",
    });
  } catch (e) {
    console.error("pilot backend kayıt hatası:", e);
  }

  const prev = readPilots();
  const next = [newPilot, ...(prev || [])];
  persistPilots(next);

  setPilots(next);
  setSelectedPilotId(String(newPilot.id));
  setPilotDraft(newPilot);

  return newPilot;
}

  async function updatePilot(pilotId, payload) {
    const prev = readPilots();
    const next = (prev || []).map((p) =>
      String(p.id) === String(pilotId) ? { ...p, ...payload } : p
    );
    persistPilots(next);

    setPilots(next);
    setPilotDraft((p) => (p && String(p.id) === String(pilotId) ? { ...p, ...payload } : p));

    return { ok: true };
  }

 async function sendPilotEmail(pilotId, draftOverride = null) {
  const id = String(pilotId);
  const now = nowLocalISO();

  const list = readPilots();
  const current = (list || []).find((x) => String(x.id) === id);
  if (!current) throw new Error("Pilot bulunamadı");

  const mergedPilot = {
    ...current,
    ...(draftOverride || {}),
    id,
    updatedAt: now,
    status: "active",
  };

  const next = (list || []).map((x) =>
    String(x.id) === id ? mergedPilot : x
  );

  // önce kesin kaydet
  persistPilots(next);
  setPilots(next);
  setPilotDraft((cur) =>
    cur && String(cur.id) === id ? mergedPilot : cur
  );

  let saved = null;

  try {
    saved = await apiPost("/api/super/pilots/send-mail", {
      companyName: mergedPilot.companyName,
      contactName: mergedPilot.contactName,
      email: mergedPilot.email,
      usersCount: Number(mergedPilot.usersCount || 0),
      pilotDays: Number(mergedPilot.pilotDays || 30),
      token: mergedPilot.token,
      pilotEndDate: mergedPilot.pilotEndDate,
    });
  } catch (e) {
    console.error("Pilot mail gönderim hatası:", e);
    alert("Pilot kaydedildi, fakat mail gönderilemedi.");
    return {
      ok: false,
      token: mergedPilot.token,
      pilotLink: null,
      tempPassword: null,
    };
  }

  alert("✅ Pilot maili gönderildi.");

  return {
    ok: true,
    token: saved?.token || mergedPilot.token,
    pilotLink: saved?.pilotLink || null,
    tempPassword: saved?.tempPassword || null,
  };
}

  async function deletePilot(pilot) {
    const ok = confirm(`"${pilot.companyName}" pilot kaydını silmek istiyor musun?`);
    if (!ok) return;

    const prev = readPilots();
    const next = (prev || []).filter((p) => String(p.id) !== String(pilot.id));
    persistPilots(next);

    setPilots(next);
    setSelectedPilotId(null);

    // ✅ seçim silindiyse sağ paneli sıfırla
    const now = nowLocalISO();
setPilotDraft({
  id: null,
  companyName: "",
  contactName: "",
  email: "",
  usersCount: 10,
  pilotDays: 30,

  linkDays: 5,
  linkExpiresAt: addDaysISO(now, 5),

  token: genToken(),
  createdAt: now,
  pilotEndDate: addDaysISO(now, 30),
  status: "draft",
  notes: DEFAULT_PILOT_NOTES,
});
  }

  // ✅ Pilot: KOPYALA (Eksikti → bu yüzden buton “aktif değil” gibi davranıyordu)
  function copyPilotLink(pilot) {
  const link = buildPilotLink(pilot?.token, pilot?.usersCount, {
    companyName: pilot?.companyName,
    contactName: pilot?.contactName,
    email: pilot?.email,

    // ✅ EK
    pilotDays: pilot?.pilotDays,
    pilotEndDate: pilot?.pilotEndDate,
  });
  navigator.clipboard?.writeText(link);
  alert("Pilot linki panoya kopyalandı.");
}

  // ✅ Pilot: DÜZENLE (Eksikti → bu yüzden “düzenle” tıklayınca bir şey olmuyordu)
  function startEditPilot(pilot) {
    if (!pilot) return;
    setSelectedPilotId(String(pilot.id));
    setPilotDraft({ ...pilot });
    setTab("pilotlar");
  }

  // ---------------- INBOX (GERÇEK API) ----------------
  async function fetchInbox({ status = "new", search = "" } = {}) {
    setInboxLoading(true);
    try {
      const q = new URLSearchParams();
      if (status) q.set("status", status);
      if (search) q.set("search", search);

      const data = await apiGet(`/api/super/inbox?${q.toString()}`);
      const mapped = Array.isArray(data)
  ? data.map((m) => {
      const src = detectInboxSource(m);

      const usersCount =
        Number(m.users_count ?? m.usersCount ?? 0) ||
        guessUsersFromSubject(m.subject) ||
        null;

      return {
        id: m.id,
        to: m.to_email || m.to || "teklif@isgpanel.tr",
        fromName: m.from_name ?? m.fromName ?? "",
        fromEmail: m.from_email ?? m.fromEmail ?? "",
        subject: m.subject ?? "",
        snippet: m.snippet ?? "",
        textBody: m.text_body ?? m.textBody ?? "",
        htmlBody: m.html_body ?? m.htmlBody ?? "",
        attachments: m.attachments ?? [],
        receivedAt: m.received_at ?? m.receivedAt ?? "",
        status: m.status ?? "new",

        companyName: (m.company_name ?? m.companyName ?? "").toString(),
        usersCount, // ✅ eklendi

        meta: m.meta,
        inboxSource: src,
        isPanelInbox: src === "panel",
      };
    })
  : [];

      setInboxMails(mapped);
      if (!selectedMailId && Array.isArray(mapped) && mapped[0]?.id) setSelectedMailId(mapped[0].id);
    } catch (e) {
      console.error(e);
      alert("Inbox çekilemedi: " + (e?.message || e));
    } finally {
      setInboxLoading(false);
    }
  }

  async function fetchMailDetail(id) {
    if (!id) return;
    try {
      const d = await apiGet(`/api/super/inbox/${id}`);
      setInboxMails((prev) =>
        prev.map((m) =>
          m.id === id
            ? {
                ...m,
                to: d.to_email || m.to,
                fromName: d.from_name ?? m.fromName,
                fromEmail: d.from_email ?? m.fromEmail,
                subject: d.subject ?? m.subject,
                snippet: d.snippet ?? m.snippet,
                textBody: d.text_body ?? m.textBody,
                htmlBody: d.html_body ?? m.htmlBody,
                attachments: d.attachments ?? m.attachments,
                receivedAt: d.received_at ?? m.receivedAt,
                status: d.status ?? m.status,
                companyName: d.company_name ?? d.companyName ?? m.companyName ?? "",
              }
            : m
        )
      );
    } catch (e) {
      console.error(e);
    }
  }

  // ---------------- FILTERS / UI STATE ----------------
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("hepsi");

  const [leadSearch, setLeadSearch] = useState("");
  const [leadStatus, setLeadStatus] = useState("hepsi");

  const [selectedOfferId, setSelectedOfferId] = useState(null);

  // ✅ Pilot filtre state
  const [pilotSearch, setPilotSearch] = useState("");
  const [pilotStatusFilter, setPilotStatusFilter] = useState("hepsi");

  const [panelMode, setPanelMode] = useState("view"); // view | create | edit

  const emptyDraft = useMemo(
  () => ({
    id: null,
    leadId: null,
    source: "panel",
    delivery: "email", // default mail, ama UI’dan değişecek
    companyName: "",
    contactName: "",
    email: "",
    usersCount: 10,
    durationDays: 7,
    priceTRY: 0,
    notes: DEFAULT_OFFER_NOTES,
    token: "",
    linkExpiresAt: "",
    status: "draft",
  }),
  []
);

  const [draft, setDraft] = useState(emptyDraft);
  const [dirty, setDirty] = useState(false);

  // ✅ İlk yükleme (mocklar)
  useEffect(() => {
    setLeads(initialLeads);
    setEvents(initialEvents);
    // setInboxMails(initialInbox);
  }, []);

  const fetchOffers = useCallback(async () => {
  try {
    const data = await apiGet("/api/super/offers");
    const raw = Array.isArray(data) ? data : data?.items || [];

    const items = (raw || []).map((o) => {
      const id = o?.id ?? o?.offerId ?? o?.uuid ?? o?.token ?? makeId("off");
      return {
        ...o,
        id: String(id),
        companyName: o?.companyName ?? o?.company_name ?? "",
        contactName: o?.contactName ?? o?.contact_name ?? "",
        email: o?.email ?? o?.toEmail ?? o?.to_email ?? "",
        usersCount: Number(o?.usersCount ?? o?.users_count ?? 0) || 0,
        priceTRY: Number(o?.priceTRY ?? o?.price_try ?? o?.amountTRY ?? 0) || 0,
        durationDays: Number(o?.durationDays ?? o?.duration_days ?? 7) || 7,
        notes: o?.notes ?? o?.note ?? "",
        token: o?.token ?? "",
        linkExpiresAt: o?.linkExpiresAt ?? o?.link_expires_at ?? "",
        status: o?.status ?? "draft",
        updatedAt: o?.updatedAt ?? o?.updated_at ?? o?.createdAt ?? o?.created_at ?? nowLocalISO(),
        createdAt: o?.createdAt ?? o?.created_at ?? nowLocalISO(),
        source: o?.source ?? "panel",
delivery:
  o?.delivery ??
  o?.deliveryType ??
  o?.delivery_method ??
  o?.delivery_type ??
  "email",
      };
    });

    setOffers(items);

    setSelectedOfferId((prev) => {
      const prevStr = prev ? String(prev) : null;
      if (prevStr && items.some((x) => String(x.id) === prevStr)) return prevStr;
      return items?.[0]?.id ? String(items[0].id) : null;
    });

    return items;
  } catch (e) {
    console.error(e);
    setOffers((prev) => (prev?.length ? prev : initialOffers));
    setSelectedOfferId((prev) =>
      prev ?? (initialOffers?.[0]?.id ? String(initialOffers[0].id) : null)
    );
    return [];
  }
}, []);
  useEffect(() => {
    fetchOffers();
  }, [fetchOffers]);

  useEffect(() => {
    if (tab === "pilotlar") {
      fetchPilots();
    }
  }, [tab, fetchPilots]);

  const summary = useMemo(() => calcOfferSummary(offers), [offers]);

  // Expire check (UI side)
  useEffect(() => {
    const now = new Date();
    setOffers((prev) =>
      prev.map((o) => {
        if ((o.status === "sent" || o.status === "opened") && o.linkExpiresAt) {
          const exp = new Date(o.linkExpiresAt);
          if (now > exp) return { ...o, status: "expired", updatedAt: nowLocalISO() };
        }
        return o;
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

// ✅ Panel-offer sonrası inbox’ı anında yenile (event ile)
useEffect(() => {
  function onRefreshInbox() {
    if (tab !== "inbox") return; // inbox açık değilse boşuna istek atma
    const st = mailStatus === "hepsi" ? "new" : mailStatus;
    fetchInbox({ status: st, search: mailSearch });
  }

  window.addEventListener("super_inbox_refresh", onRefreshInbox);
  return () => window.removeEventListener("super_inbox_refresh", onRefreshInbox);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [tab, mailStatus, mailSearch]);

  // ✅ Inbox gerçek veri (tab açılınca çek)
  useEffect(() => {
    if (tab === "inbox") {
      const st = mailStatus === "hepsi" ? "new" : mailStatus;
      fetchInbox({ status: st, search: mailSearch });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (tab === "inbox" && selectedMailId) {
      const cur = inboxMails.find((x) => x.id === selectedMailId);
      if (cur && (!cur.textBody && !cur.htmlBody)) fetchMailDetail(selectedMailId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, selectedMailId]);

  useEffect(() => {
    if (tab !== "inbox") return;
    const st = mailStatus === "hepsi" ? "new" : mailStatus;
    const t = setTimeout(() => {
      fetchInbox({ status: st, search: mailSearch });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mailStatus, mailSearch]);

  const selectedOffer = useMemo(
    () => offers.find((o) => String(o.id) === String(selectedOfferId)) || null,
    [offers, selectedOfferId]
  );

  // ✅ Pilot filtre
  const filteredPilots = useMemo(() => {
    const s = safeLower(pilotSearch);

    return pilots
      .filter((p) => {
        const matchesSearch =
          !s ||
          safeLower(p.companyName).includes(s) ||
          safeLower(p.contactName).includes(s) ||
          safeLower(p.email).includes(s);

        const status = pilotIsExpired(p) ? "expired" : p.status === "draft" ? "draft" : "active";

        const matchesStatus = pilotStatusFilter === "hepsi" || pilotStatusFilter === status;

        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }, [pilots, pilotSearch, pilotStatusFilter]);

  // ---- offers filtre ----
  const filteredOffers = useMemo(() => {
    const s = safeLower(search);

    return offers
      .filter((o) => {
        const matchesSearch =
          !s ||
          safeLower(o.companyName).includes(s) ||
          safeLower(o.contactName).includes(s) ||
          safeLower(o.email).includes(s) ||
          safeLower(o.notes).includes(s);

        const matchesStatus = statusFilter === "hepsi" || o.status === statusFilter;

        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }, [offers, search, statusFilter]);

  // ---- leads filtre ----
  const filteredLeads = useMemo(() => {
    const s = safeLower(leadSearch);
    return leads
      .filter((l) => {
        const matchesSearch =
          !s ||
          safeLower(l.companyName).includes(s) ||
          safeLower(l.contactName).includes(s) ||
          safeLower(l.email).includes(s) ||
          safeLower(l.note).includes(s);
        const matchesStatus = leadStatus === "hepsi" || l.status === leadStatus;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [leads, leadSearch, leadStatus]);

  const selectedMail = useMemo(
    () => inboxMails.find((m) => String(m.id) === String(selectedMailId)) || null,
    [inboxMails, selectedMailId]
  );

  const filteredMails = useMemo(() => {
    const s = safeLower(mailSearch);
    return inboxMails
      .filter((m) => {
        const matchesSearch =
          !s ||
          safeLower(m.fromName).includes(s) ||
          safeLower(m.fromEmail).includes(s) ||
          safeLower(m.subject).includes(s) ||
          safeLower(m.snippet).includes(s) ||
          safeLower(m.textBody).includes(s);
        const matchesStatus = mailStatus === "hepsi" || m.status === mailStatus;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1));
  }, [inboxMails, mailSearch, mailStatus]);

  const selectedOfferEvents = useMemo(() => {
    if (!selectedOfferId) return [];
    return events.filter((e) => String(e.offerId) === String(selectedOfferId)).sort((a, b) => (a.at < b.at ? 1 : -1));
  }, [events, selectedOfferId]);

  // ---- Actions ----
  function setMailStatusById(id, status) {
    setInboxMails((prev) => prev.map((m) => (m.id === id ? { ...m, status } : m)));
  }

  async function convertMailToLead(mail) {
    try {
      const r = await apiPost(`/api/super/inbox/${mail.id}/convert-to-lead`);
      setMailStatusById(mail.id, "converted");
      alert("✅ Mail lead'e dönüştürüldü. Lead ID: " + (r.leadId || ""));
    } catch (e) {
      console.error(e);
      alert("Lead'e dönüştürülemedi: " + (e?.message || e));
    }
  }

  function onCreateOfferFromMail() {
  if (!selectedMail) return;

  const panelIcimi = Boolean(selectedMail?.isPanelInbox || isPanelInboxMail(selectedMail));

  const raw = getMailText(selectedMail);
  const f = parseSalesFormText(raw);

  const companyAuto =
    (selectedMail?.companyName && selectedMail.companyName.trim()) ? selectedMail.companyName.trim()
    : (getCompanyNameForMail(selectedMail) || "");

  const usersAuto =
    Number(selectedMail?.usersCount || 0) ||
    guessUsersFromSubject(selectedMail?.subject) ||
    Number(f.users) ||
    guessUsersFromText(f.raw) ||
    10;

  setTab("teklifler");
  setPanelMode("create");
  setDirty(false);

  setDraft({
    ...emptyDraft,

    source: panelIcimi ? "panel" : "inbox",
    delivery: panelIcimi ? "panel" : "email",

    companyName: companyAuto,
    contactName: (f.name || selectedMail.fromName || "").trim(),
    email: (f.email || selectedMail.fromEmail || "").trim(),
    usersCount: usersAuto,

    durationDays: 7,
    priceTRY: 0,
    notes: DEFAULT_OFFER_NOTES,
    token: genToken(),
    linkExpiresAt: addDaysISO(nowLocalISO(), 7),
    status: "draft",
  });
}

  function startCreateFromScratch() {
  setTab("teklifler");
  setPanelMode("create");
  setDirty(false);
  setDraft({
    ...emptyDraft,
    source: "panel",
    delivery: "email", // ✅ açıkça koy (istersen "panel" da yapabilirsin)
    id: null,
    token: genToken(),
    status: "draft",
    usersCount: 10,
    durationDays: 7,
    linkExpiresAt: addDaysISO(nowLocalISO(), 7),
  });
}

  function startCreateFromLead(lead) {
    setTab("teklifler");
    setPanelMode("create");
    setDirty(false);
    setDraft({
      ...emptyDraft,
      source: "landing",
      leadId: lead.id,
      companyName: lead.companyName,
      contactName: lead.contactName,
      email: lead.email,
      usersCount: Math.max(10, lead.usersExpected || 10),
      durationDays: 7,
      token: genToken(),
      linkExpiresAt: addDaysISO(nowLocalISO(), 7),
      notes: lead.note || "",
      status: "draft",
    });
  }

 function startEditOffer(offer) {
  setPanelMode("edit");
  setDirty(false);
  setDraft({
    id: offer.id,
    leadId: offer.leadId,
    source: offer.source || "panel",

    // ✅ EKLE
    delivery:
      offer.delivery ||
      offer.deliveryType ||
      offer.delivery_method ||
      ((offer.source || "").toString().toLowerCase() === "panel" ? "panel" : "email"),

    companyName: offer.companyName,
    contactName: offer.contactName,
    email: offer.email,
    usersCount: offer.usersCount,
    durationDays: offer.durationDays,
    priceTRY: offer.priceTRY,
    notes: offer.notes,
    token: offer.token || genToken(),
    linkExpiresAt: offer.linkExpiresAt || addDaysISO(nowLocalISO(), offer.durationDays || 7),
    status: offer.status,
  });
}

  function cancelDraft() {
    setPanelMode("view");
    setDirty(false);
  }

  function addEvent(offerId, type, by = "system", meta = {}) {
    const evt = {
      id: makeId("evt"),
      offerId,
      type,
      at: nowLocalISO(),
      by,
      meta,
    };
    setEvents((prev) => [evt, ...prev]);
  }

  function saveDraft() {
  const d = normalizeDraft(draft);
  if (!d.companyName.trim()) return alert("Kurum adı zorunlu.");

  // ✅ sadece mail akışında zorunlu
  if (d.delivery !== "panel" && !d.email.trim()) return alert("E-posta zorunlu.");

  if (d.usersCount < 10) return alert("Bu akış 10+ içindir. Kullanıcı sayısı en az 10 olmalı.");

    const now = nowLocalISO();
    if (panelMode === "create") {
     const newOffer = {
  id: makeId("off"),
  leadId: d.leadId || null,
  source: d.source || "panel",
  delivery: d.delivery || "email", // ✅ eklendi
  companyName: d.companyName.trim(),
  contactName: d.contactName.trim(),
  email: d.email.trim(),
  usersCount: Number(d.usersCount),
  durationDays: Number(d.durationDays),
  priceTRY: Number(d.priceTRY || 0),
  currency: "TRY",
  notes: d.notes,
  createdAt: now,
  updatedAt: now,
  token: d.token || genToken(),
  linkExpiresAt: d.linkExpiresAt || addDaysISO(now, Number(d.durationDays || 7)),
  status: "draft",
  paymentRef: null,
};
      setOffers((prev) => [newOffer, ...prev]);
      setSelectedOfferId(newOffer.id);
      setPanelMode("view");
      setDirty(false);

      addEvent(newOffer.id, "OFFER_CREATED", "superadmin", {
        usersCount: newOffer.usersCount,
        priceTRY: newOffer.priceTRY,
      });
      addEvent(newOffer.id, "LINK_GENERATED", "system", { token: newOffer.token });
    } else {
      setOffers((prev) =>
        prev.map((o) => {
          if (String(o.id) !== String(d.id)) return o;
          return {
            ...o,
            source: d.source || o.source || "panel",
            delivery: d.delivery || o.delivery || "email", // ✅ eklendi
            companyName: d.companyName.trim(),
            contactName: d.contactName.trim(),
            email: d.email.trim(),
            usersCount: Number(d.usersCount),
            durationDays: Number(d.durationDays),
            priceTRY: Number(d.priceTRY || 0),
            notes: d.notes,
            token: d.token || o.token,
            linkExpiresAt: d.linkExpiresAt || o.linkExpiresAt,
            updatedAt: now,
          };
        })
      );
      setPanelMode("view");
      setDirty(false);
    }
  }

async function publishAndSendPanel() {
  const d = normalizeDraft(draft);

  if (!d.companyName.trim()) return alert("Kurum adı zorunlu.");
  // panel içi olsa da email genelde var; yoksa da akış bozulmasın diye zorlamıyoruz
  if (d.usersCount < 10) return alert("Kullanıcı sayısı en az 10 olmalı.");
  if (!Number(d.priceTRY) || Number(d.priceTRY) <= 0) return alert("Fiyat girilmeli (TRY).");
  if (!d.linkExpiresAt) return alert("Link bitiş tarihi zorunlu.");

  const exp = new Date(d.linkExpiresAt);
  if (exp <= new Date()) return alert("Link bitiş tarihi gelecekte olmalı.");

  // ✅ backend'e kaydet: sadece create, mail gönderme yok
  const payload = {
    source: "panel",
    delivery: "panel",
    companyName: d.companyName.trim(),
    contactName: (d.contactName || "").trim(),
    toEmail: (d.email || "").trim(), // varsa kaydetsin
    usersCount: Number(d.usersCount),
    priceTRY: Number(d.priceTRY),
    durationDays: Number(d.durationDays),
    note: d.notes || "",
    linkExpiresAt: d.linkExpiresAt,
    status: "sent",
  };

  let backendId = null;
  let backendToken = null;

  try {
  const saved = await apiPost("/api/super/offers/create", payload);
backendId = saved?.offerId || saved?.id || null;
backendToken = saved?.token || null;

try {
  await apiPost("/api/super/inbox/panel-offer", {
    offerId: backendId || null,
    token: backendToken || d.token || null,
    companyName: payload.companyName,
    contactName: payload.contactName,
    email: payload.toEmail,
    usersCount: payload.usersCount,
    priceTRY: payload.priceTRY,
    durationDays: payload.durationDays,
    linkExpiresAt: payload.linkExpiresAt,
    note: payload.note,
    meta: {
      source: "panel",
      type: "panel_offer",
    },
    message: "Panel içi teklif oluşturuldu",
  });

  window.dispatchEvent(new Event("super_inbox_refresh"));
} catch (e) {
  console.warn("panel notification failed (non-blocking):", e);
}

} catch (e) {
  console.error(e);
  alert("Teklif backend'e kaydedilemedi");
  return;
}

  const now = nowLocalISO();

  const newOffer = {
    id: backendId || makeId("off"),
    leadId: d.leadId || null,
    source: "panel",
  delivery: "panel",
    companyName: d.companyName.trim(),
    contactName: (d.contactName || "").trim(),
    email: (d.email || "").trim(),
    usersCount: Number(d.usersCount),
    durationDays: Number(d.durationDays),
    priceTRY: Number(d.priceTRY),
    currency: "TRY",
    notes: d.notes,
    createdAt: now,
    updatedAt: now,
    token: backendToken || d.token,
    linkExpiresAt: d.linkExpiresAt,
    status: "sent",
    paymentRef: null,
  };

  setOffers((prev) => [newOffer, ...prev]);
  setSelectedOfferId(String(newOffer.id));
  setPanelMode("view");
  setDirty(false);

  addEvent(newOffer.id, "OFFER_CREATED", "superadmin", {
    usersCount: newOffer.usersCount,
    priceTRY: newOffer.priceTRY,
  });
  addEvent(newOffer.id, "LINK_GENERATED", "system", { token: newOffer.token });
  addEvent(newOffer.id, "PANEL_SENT", "system", { channel: "panel" }); // ✅
  await fetchOffers();
  setSelectedOfferId(String(newOffer.id));

  alert("✅ Teklif panele gönderildi.");
}
  async function publishAndSendEmail() {
   // ✅ Panel içi teklif: mail yerine panel bildirimi
if (draft?.delivery === "panel") {
  return publishAndSendPanel();
}

    const d = normalizeDraft(draft);
    if (!d.companyName.trim()) return alert("Kurum adı zorunlu.");
    if (!d.email.trim()) return alert("E-posta zorunlu.");
    if (d.usersCount < 10) return alert("Kullanıcı sayısı en az 10 olmalı.");
    if (!Number(d.priceTRY) || Number(d.priceTRY) <= 0) return alert("Fiyat girilmeli (TRY).");
    if (!d.linkExpiresAt) return alert("Link bitiş tarihi zorunlu.");

    const now = nowLocalISO();

    const exp = new Date(d.linkExpiresAt);
    const nowD = new Date();
    if (exp <= nowD) return alert("Link bitiş tarihi gelecekte olmalı.");

    if (panelMode === "create") {
      const payload = {
        source: d.source || "panel",
        companyName: d.companyName.trim(),
        contactName: (d.contactName || "").trim(),
        toEmail: d.email.trim(),
        usersCount: Number(d.usersCount),
        priceTRY: Number(d.priceTRY),
        durationDays: Number(d.durationDays),
        note: d.notes || "",
        linkExpiresAt: d.linkExpiresAt,
        status: "sent",
      };

      let backendId = null;
      let backendToken = null;

      try {
      const saved = await apiPost("/api/super/offers/create", payload);
backendId = saved?.offerId || saved?.id || null;
backendToken = saved?.token || null;

if (backendId) {
  await apiPost(`/api/super/offers/${backendId}/send-mail`, {});
}



      } catch (e) {
        console.error(e);
        alert("Teklif backend'e kaydedilemedi");
        return;
      }

      const newOffer = {
        id: backendId || makeId("off"),
        leadId: d.leadId || null,
        source: d.source || "panel",
        companyName: d.companyName.trim(),
        contactName: d.contactName.trim(),
        email: d.email.trim(),
        usersCount: Number(d.usersCount),
        durationDays: Number(d.durationDays),
        priceTRY: Number(d.priceTRY),
        currency: "TRY",
        notes: d.notes,
        createdAt: now,
        updatedAt: now,
        token: backendToken || d.token,
        linkExpiresAt: d.linkExpiresAt,
        status: "sent",
        paymentRef: null,
      };

      setOffers((prev) => [newOffer, ...prev]);
      setSelectedOfferId(newOffer.id);
      setPanelMode("view");
      setDirty(false);

      addEvent(newOffer.id, "OFFER_CREATED", "superadmin", {
        usersCount: newOffer.usersCount,
        priceTRY: newOffer.priceTRY,
      });
      addEvent(newOffer.id, "LINK_GENERATED", "system", { token: newOffer.token });
      addEvent(newOffer.id, "EMAIL_SENT", "system", { to: newOffer.email });

      setTab("teklifler");
      await fetchOffers();
      setSelectedOfferId(String(newOffer.id));

      alert("✅ Teklif gönderildi.");
    } else {
      const offerId = d.id;

      setOffers((prev) =>
        prev.map((o) =>
          String(o.id) === String(offerId)
            ? {
                ...o,
                source: d.source || o.source || "panel",
                companyName: d.companyName.trim(),
                contactName: d.contactName.trim(),
                email: d.email.trim(),
                usersCount: Number(d.usersCount),
                durationDays: Number(d.durationDays),
                priceTRY: Number(d.priceTRY),
                notes: d.notes,
                token: d.token || o.token,
                linkExpiresAt: d.linkExpiresAt,
                status: "sent",
                updatedAt: now,
              }
            : o
        )
      );

      addEvent(offerId, "EMAIL_SENT", "system", { to: d.email.trim() });
      setPanelMode("view");
      setDirty(false);
      alert("✅ Teklif maili gönderildi (mock).");
    }
  }

  function copyOfferLink(offer) {
    const link = buildOfferLink(offer.token, offer.usersCount, {
      companyName: offer.companyName,
      contactName: offer.contactName,
      email: offer.email,
    });
    navigator.clipboard?.writeText(link);
    alert("Link panoya kopyalandı.");
  }

  function cancelOffer(offer) {
    const ok = confirm(`"${offer.companyName}" teklifi iptal edilsin mi?`);
    if (!ok) return;
    setOffers((prev) =>
      prev.map((o) =>
        String(o.id) === String(offer.id) ? { ...o, status: "canceled", updatedAt: nowLocalISO() } : o
      )
    );
    addEvent(offer.id, "CANCELED", "superadmin", {});
  }

 function simulateNextStep(offer) {
  // ✅ PANEL içi teklifte register akışı yok
  if (isPanelDelivery(offer)) {
    return alert("Panel içi teklifte demo ilerleme yok (kayıt linki kullanılmaz).");
  }

  const now = new Date();
  if (offer.linkExpiresAt && now > new Date(offer.linkExpiresAt)) {
      setOffers((prev) =>
        prev.map((o) =>
          String(o.id) === String(offer.id) ? { ...o, status: "expired", updatedAt: nowLocalISO() } : o
        )
      );
      addEvent(offer.id, "EXPIRED", "system", {});
      return alert("Link süresi dolmuş. Teklif expired oldu.");
    }

    if (offer.status === "sent") {
      setOffers((prev) =>
        prev.map((o) =>
          String(o.id) === String(offer.id) ? { ...o, status: "opened", updatedAt: nowLocalISO() } : o
        )
      );
      addEvent(offer.id, "LINK_OPENED", "prospect", {});
      return;
    }
    if (offer.status === "opened") {
      setOffers((prev) =>
        prev.map((o) =>
          String(o.id) === String(offer.id) ? { ...o, status: "registered", updatedAt: nowLocalISO() } : o
        )
      );
      addEvent(offer.id, "REGISTERED", "prospect", {
        orgId: `ORG_${Math.random().toString(16).slice(2, 6).toUpperCase()}`,
      });
      return;
    }
    if (offer.status === "registered") {
      const payRef = `PAY_${Math.random().toString(16).slice(2, 7).toUpperCase()}`;
      setOffers((prev) =>
        prev.map((o) =>
          String(o.id) === String(offer.id)
            ? { ...o, status: "paid", paymentRef: payRef, updatedAt: nowLocalISO() }
            : o
        )
      );
      addEvent(offer.id, "PAYMENT_SUCCESS", "payment", { paymentRef: payRef, amountTRY: offer.priceTRY });
      return;
    }
    if (offer.status === "paid") {
      setOffers((prev) =>
        prev.map((o) =>
          String(o.id) === String(offer.id) ? { ...o, status: "active", updatedAt: nowLocalISO() } : o
        )
      );
      addEvent(offer.id, "LOGIN_FIRST", "prospect", {});
      return;
    }
    alert("Bu teklif zaten tamamlandı veya ilerletilemez (active/expired/canceled).");
  }

  function exportCSV() {
    const rows = [
      ["id", "companyName", "contactName", "email", "usersCount", "priceTRY", "status", "createdAt", "linkExpiresAt"].join(
        ","
      ),
      ...filteredOffers.map((o) =>
        [o.id, csv(o.companyName), csv(o.contactName), o.email, o.usersCount, o.priceTRY, o.status, o.createdAt, o.linkExpiresAt].join(
          ","
        )
      ),
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `teklifler_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function csv(v) {
    const s = (v ?? "").toString().replaceAll('"', '""');
    return `"${s}"`;
  }

  // ----- UI -----
  return (
    <div className="p-3 md:p-6 bg-slate-50 min-h-[calc(100vh-0px)]">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-2xl font-semibold text-slate-900">Teklifler</div>
          <div className="text-sm text-slate-500 mt-1">
            10+ kullanıcı kurumsal talepler için kontrollü teklif, süreli kayıt linki ve uçtan uca log.
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Pill tone="info" icon={<Users className="w-4 h-4" />}>
              Toplam: {summary.total}
            </Pill>
            <Pill tone="good" icon={<CheckCircle2 className="w-4 h-4" />}>
              Aktif: {summary.active}
            </Pill>
            <Pill tone="info" icon={<Mail className="w-4 h-4" />}>
              Gönderilen: {summary.sent}
            </Pill>
            <Pill tone="info" icon={<Building2 className="w-4 h-4" />}>
              Kayıt alan: {summary.registered}
            </Pill>
            <Pill tone="good" icon={<Banknote className="w-4 h-4" />}>
              Gelir: {currencyTRY(summary.revenue)}
            </Pill>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={exportCSV}>
            <FileDown className="w-4 h-4" />
            CSV Dışa Aktar
          </Button>
          <Button onClick={startCreateFromScratch}>
            <Plus className="w-4 h-4" />
            Yeni Teklif
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-5">
        <div className="inline-flex bg-white border border-slate-200 rounded-2xl p-1 shadow-sm">
          <TabButton active={tab === "teklifler"} onClick={() => setTab("teklifler")}>
            Teklifler
          </TabButton>

          <TabButton active={tab === "pilotlar"} onClick={() => setTab("pilotlar")}>
            Pilotlar
          </TabButton>

          <TabButton active={tab === "inbox"} onClick={() => setTab("inbox")}>
            Gelen Mailler
            <Pill tone={inboxMails.some((m) => m.status === "new") ? "info" : "neutral"}>
              {inboxMails.filter((m) => m.status === "new").length}
            </Pill>
          </TabButton>

          <TabButton active={tab === "log"} onClick={() => setTab("log")}>
            Süreç Logları
          </TabButton>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_440px] gap-4 mt-4">
        {/* LEFT */}
        <Card className="overflow-hidden">
          {tab === "teklifler" ? (
            <>
              <CardHeader
                title="Teklif Listesi"
                subtitle="Arama, filtre, seç → sağda detay ve işlem."
                right={
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setSearch("");
                        setStatusFilter("hepsi");
                      }}
                    >
                      <Filter className="w-4 h-4" />
                      Sıfırla
                    </Button>
                    <Button variant="secondary" onClick={() => fetchOffers()}>
                      <RefreshCw className="w-4 h-4" />
                      Yenile
                    </Button>
                  </div>
                }
              />

              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                  <div className="md:col-span-2">
                    <FieldLabel icon={<Search className="w-4 h-4" />}>Arama</FieldLabel>
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Kurum / kişi / e-posta / not…"
                    />
                  </div>
                  <div>
                    <FieldLabel>Durum</FieldLabel>
                    <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                      <option value="hepsi">Hepsi</option>
                      <option value="draft">Taslak</option>
                      <option value="sent">Gönderildi</option>
                      <option value="expired">Süresi Doldu</option>
                      <option value="canceled">İptal</option>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <div className="text-sm text-slate-500">
                      Sonuç:{" "}
                      <span className="font-semibold text-slate-900">{filteredOffers.length}</span>
                    </div>
                  </div>
                </div>

                <Divider />

                {filteredOffers.length === 0 ? (
                  <EmptyState
                    title="Teklif bulunamadı."
                    desc="Filtreleri sıfırla veya yeni teklif oluştur."
                    action={
                      <Button onClick={startCreateFromScratch}>
                        <Plus className="w-4 h-4" />
                        Yeni Teklif
                      </Button>
                    }
                  />
                ) : (
                 <div className="flex flex-col gap-2 max-h-[520px] overflow-y-auto pr-1">
  {filteredOffers.map((o) => (
    <OfferRow
      key={o.id}
      item={o}
      active={String(o.id) === String(selectedOfferId)}
      onClick={() => {
        setSelectedOfferId(String(o.id));
        setPanelMode("view");
        setDirty(false);
      }}
      onCopy={() => copyOfferLink(o)}
      onEdit={() => startEditOffer(o)}
      onCancel={() => cancelOffer(o)}
      onDelete={() => deleteOffer(o)}
      onSimulate={() => simulateNextStep(o)}
    />
  ))}
</div>
                )}
              </div>
            </>
          ) : tab === "pilotlar" ? (
            <>
              <CardHeader
                title="Pilot Listesi"
                subtitle="Ücretsiz deneme firmaları"
                right={
                  <Button
                   onClick={() => {
  setPilotDraft({
    id: null,
    companyName: "",
    contactName: "",
    email: "",
    usersCount: 10,
    pilotDays: 30,
    token: genToken(),
    createdAt: nowLocalISO(),
    pilotEndDate: addDaysISO(nowLocalISO(), 30),
    status: "draft",
    notes: DEFAULT_PILOT_NOTES,
  });
  setSelectedPilotId(null);
  setPilotMode("create");
}}
                  >
                    + Yeni Pilot
                  </Button>
                }
              />

              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                  <div className="md:col-span-2">
                    <FieldLabel icon={<Search className="w-4 h-4" />}>Arama</FieldLabel>
                    <Input
                      value={pilotSearch}
                      onChange={(e) => setPilotSearch(e.target.value)}
                      placeholder="Kurum / kişi / e-posta…"
                    />
                  </div>

                  <div>
                    <FieldLabel>Durum</FieldLabel>
                    <Select value={pilotStatusFilter} onChange={(e) => setPilotStatusFilter(e.target.value)}>
                      <option value="hepsi">Hepsi</option>
                      <option value="draft">Taslak</option>
                      <option value="active">Aktif</option>
                      <option value="expired">Süresi Doldu</option>
                    </Select>
                  </div>

                  <div className="flex items-end">
                    <div className="text-sm text-slate-500">
                      Sonuç:{" "}
                      <span className="font-semibold text-slate-900">{filteredPilots.length}</span>
                    </div>
                  </div>
                </div>

                <Divider />

                {filteredPilots.length === 0 ? (
                  <EmptyState
                    title="Pilot bulunamadı."
                    desc="Filtreleri değiştir veya yeni pilot oluştur."
                    action={
                      <Button
                        onClick={() => {
                          setPilotDraft({
                            id: null,
                            companyName: "",
                            contactName: "",
                            email: "",
                            usersCount: 10,
                            pilotDays: 30,
                            token: genToken(),
                            createdAt: "",
                            pilotEndDate: "",
                            status: "draft",
                            notes: DEFAULT_PILOT_NOTES,
                          });
                          setSelectedPilotId(null);
                        }}
                      >
                        + Yeni Pilot
                      </Button>
                    }
                  />
                ) : (
                 <div className="flex flex-col gap-2 max-h-[520px] overflow-y-auto pr-1">
  {filteredPilots.map((p) => (
    <PilotRow
      key={p.id}
      item={p}
      active={String(p.id) === String(selectedPilotId)}
      onClick={() => {
        setSelectedPilotId(String(p.id));
        setPilotDraft({ ...p });
        setPilotMode("view");
      }}
      onCopy={(item) => copyPilotLink(item)}
      onEdit={(item) => startEditPilot(item)}
      onActivate={(item) =>
  sendPilotEmail(item.id, {
    companyName: item.companyName,
    contactName: item.contactName,
    email: item.email,
    usersCount: Number(item.usersCount || 10),
    pilotDays: Number(item.pilotDays || 30),
    linkDays: Number(item.linkDays || 5),
    linkExpiresAt: item.linkExpiresAt,
    notes: item.notes || "",
    token: item.token || genToken(),
    pilotEndDate: item.pilotEndDate,
    status: "active",
    updatedAt: nowLocalISO(),
  })
}
      onDelete={(item) => deletePilot(item)}
    />
  ))}
</div>
                )}
              </div>
            </>
          ) : tab === "inbox" ? (
            <>
              <CardHeader
                title="Gelen Mailler (teklif@isgpanel.tr)"
                subtitle="Tanıtım sitesinden gelen 10+ talepler ve direkt gelen mailler burada okunur."
                right={
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const st = mailStatus === "hepsi" ? "new" : mailStatus;
                      fetchInbox({ status: st, search: mailSearch });
                    }}
                    disabled={inboxLoading}
                  >
                    <RefreshCw className="w-4 h-4" />
                    {inboxLoading ? "Yükleniyor" : "Yenile"}
                  </Button>
                }
              />

              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                  <div className="md:col-span-2">
                    <FieldLabel icon={<Search className="w-4 h-4" />}>Arama</FieldLabel>
                    <Input
                      value={mailSearch}
                      onChange={(e) => setMailSearch(e.target.value)}
                      placeholder="Gönderen / konu / içerik..."
                    />
                  </div>
                  <div>
                    <FieldLabel>Durum</FieldLabel>
                    <Select value={mailStatus} onChange={(e) => setMailStatus(e.target.value)}>
                      <option value="new">Okunmadı</option>
                      <option value="converted">İşlendi</option>
                      <option value="hepsi">Hepsi</option>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <div className="text-sm text-slate-500">
                      Sonuç:{" "}
                      <span className="font-semibold text-slate-900">{filteredMails.length}</span>
                    </div>
                  </div>
                </div>

                <Divider />

                {filteredMails.length === 0 ? (
                  <EmptyState title="Mail yok." desc="teklif@isgpanel.tr adresine gelen mailler burada listelenir." action={<span />} />
                ) : (
                  <div className="flex flex-col gap-2 max-h-[520px] overflow-y-auto pr-1">
  {filteredMails.map((m) => (
    <MailRow
      key={m.id}
      mail={m}
      active={String(m.id) === String(selectedMailId)}
      onClick={() => setSelectedMailId(m.id)}
      onDelete={() => deleteInboxMail(m.id)}
    />
  ))}
</div>
                )}
              </div>
            </>
          ) : (
            <>
              <CardHeader
                title="Süreç Logları"
                subtitle="Tüm teklifler için event timeline (audit)."
                right={
                  <Button variant="secondary" onClick={() => alert("İleride: gelişmiş filtre")}>
                    <Filter className="w-4 h-4" />
                    Filtre
                  </Button>
                }
              />
              <div className="p-4">
                <GlobalLog events={events} offers={offers} />
              </div>
            </>
          )}
        </Card>

        {/* RIGHT: Panel */}
        <Card className="overflow-hidden">
          {tab === "pilotlar" ? (
            <PilotPanel
              pilotDraft={pilotDraft}
  setPilotDraft={setPilotDraft}
  selectedPilotId={selectedPilotId}
  setSelectedPilotId={setSelectedPilotId}
  pilotMode={pilotMode}
  setPilotMode={setPilotMode}
              onRefresh={fetchPilots}
              onDeletePilot={deletePilot}
              onCreatePilot={createPilot}
              onUpdatePilot={updatePilot}
              onSendPilotEmail={sendPilotEmail}
              pilotLoading={pilotLoading}
            />
          ) : tab === "inbox" ? (
            <MailPanel selected={selectedMail} onCreateOfferFromMail={onCreateOfferFromMail} />
          ) : (
            <OfferPanel
              mode={panelMode}
              setMode={setPanelMode}
              selected={selectedOffer}
              draft={draft}
              setDraft={setDraft}
              dirty={dirty}
              setDirty={setDirty}
              onCancel={cancelDraft}
              onStartCreate={startCreateFromScratch}
              onStartEdit={() => selectedOffer && startEditOffer(selectedOffer)}
              onSaveDraft={saveDraft}
              onPublishSend={publishAndSendEmail}
              offerEvents={selectedOfferEvents}
              onCopyLink={() => selectedOffer && copyOfferLink(selectedOffer)}
              onSimulate={() => selectedOffer && simulateNextStep(selectedOffer)}
            />
          )}
        </Card>
      </div>
    </div>
  );
}

// ----------------- LEFT ROWS / CARDS -----------------
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
        <Building2 className="w-5 h-5" />
      </div>
      <div className="mt-3 text-base font-semibold text-slate-900">{title}</div>
      <div className="mt-1 text-sm text-slate-500">{desc}</div>
      <div className="mt-4 flex justify-center">{action}</div>
    </div>
  );
}

function OfferRow({ item, active, onClick, onCopy, onEdit, onCancel, onDelete, onSimulate }) {
  const panelIcimi = isPanelDelivery(item);
const link = panelIcimi
  ? ""
  : buildOfferLink(item.token, item.usersCount, {
      companyName: item.companyName,
      contactName: item.contactName,
      email: item.email,
    });

  const expiresSoon =
    isExpiresSoon(item.linkExpiresAt, 48) && (item.status === "sent" || item.status === "opened");
  const expired = item.status === "expired";

  return (
    <div
      onClick={onClick}
      className={cn(
        "cursor-pointer p-3 rounded-2xl border transition shadow-sm",
        active ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white hover:bg-slate-50"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-700">
              <Building2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900 truncate">{item.companyName}</div>
              <div className="text-xs text-slate-500 truncate">
                {item.contactName || "—"} • {item.email}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-2">
  {/* ✅ Kaynak: PANEL/MAIL/FORM vs */}
  <Pill tone={offerSourceTone(item.source)}>{offerSourceLabel(item.source)}</Pill>

  {/* ✅ Kural: panel içiyse MAIL gösterme (yanlış algıyı bitirir) */}
  {!isPanelDelivery(item) && String(item?.source || "").toLowerCase() === "inbox" ? (
    <Pill tone="warn">MAIL</Pill>
  ) : null}

  <Pill tone="neutral" icon={<Users className="w-4 h-4" />}>
    {item.usersCount} kullanıcı
  </Pill>
  <Pill tone="neutral" icon={<Banknote className="w-4 h-4" />}>
    {currencyTRY(item.priceTRY)}
  </Pill>
  <Pill tone={offerStatusTone(item.status)} icon={<CheckCircle2 className="w-4 h-4" />}>
    {offerStatusLabel(item.status)}
  </Pill>
            {expiresSoon ? (
              <Pill tone="warn" icon={<Clock className="w-4 h-4" />}>
                Süre yaklaşıyor
              </Pill>
            ) : null}
            {expired ? (
              <Pill tone="warn" icon={<ShieldAlert className="w-4 h-4" />}>
                Süresi doldu
              </Pill>
            ) : null}
          </div>

          <div className="mt-2 text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1">
              <Clock className="w-4 h-4" /> Oluşturma: {formatDT(item.createdAt)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Link2 className="w-4 h-4" /> Bitiş: {formatDT(item.linkExpiresAt)}
            </span>
          </div>

         {!panelIcimi ? (
  <div className="mt-2 text-xs text-slate-500 truncate">
    <span className="text-slate-400">Link:</span> {link}
  </div>
) : null}
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="flex items-center gap-1">
           {!panelIcimi ? (
  <IconBtn title="Linki kopyala" onClick={(e) => stop(e, onCopy)}>
    <Copy className="w-4 h-4" />
  </IconBtn>
) : null}
            <IconBtn title="Düzenle" onClick={(e) => stop(e, onEdit)}>
              <Pencil className="w-4 h-4" />
            </IconBtn>
            <IconBtn title="İptal" danger onClick={(e) => stop(e, onCancel)}>
              <XCircle className="w-4 h-4" />
            </IconBtn>
            <IconBtn title="Sil" danger onClick={(e) => stop(e, onDelete)}>
              <Trash2 className="w-4 h-4" />
            </IconBtn>
          </div>

         
        </div>
      </div>
    </div>
  );
}

function stop(e, fn) {
  e.stopPropagation();
  fn?.();
}

function IconBtn({ children, title, onClick, danger }) {
  return (
    <button
      type="button"
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

function MailRow({ mail, active, onClick, onDelete }) {
  const statusTone = mail.status === "new" ? "info" : mail.status === "converted" ? "good" : "neutral";
  const company = getCompanyNameForMail(mail);

  return (
    <div
      onClick={onClick}
      className={cn(
        "cursor-pointer p-3 rounded-2xl border transition shadow-sm",
        active ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white hover:bg-slate-50"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-700">
              <Inbox className="w-4 h-4" />
            </div>

            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900 truncate">{mail.subject}</div>

              {company ? (
                <div className="text-xs text-slate-600 truncate">
                  <span className="text-slate-400">Kurum:</span> {company}
                </div>
              ) : null}

              <div className="text-xs text-slate-500 truncate">
                {mail.fromName || mail.fromEmail} • {mail.fromEmail}
              </div>
            </div>
          </div>

          <div className="mt-2 text-xs text-slate-600 line-clamp-2">{mail.snippet || mail.textBody}</div>

          <div className="flex flex-wrap gap-2 mt-2">
            <Pill tone={statusTone}>{mail.status === "new" ? "Yeni" : mail.status === "converted" ? "Dönüştü" : "Arşiv"}</Pill>
             {mail?.isPanelInbox ? <Pill tone="info">PANEL İÇİ</Pill> : null}
            <Pill tone="neutral" icon={<Clock className="w-4 h-4" />}>
              {formatDT(mail.receivedAt)}
            </Pill>
            {mail.attachments?.length ? <Pill tone="neutral">{mail.attachments.length} ek</Pill> : null}
          </div>
        </div>

        <div className="shrink-0">
          <Button
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.();
            }}
          >
            <Trash2 className="w-4 h-4" />
            Sil
          </Button>
        </div>
      </div>
    </div>
  );
}

function MailPanel({ selected, onCreateOfferFromMail }) {
  if (!selected) {
    return (
      <div className="p-5">
        <EmptyState title="Mail seç" desc="Soldan bir mail seçince burada içeriğini göreceksin." action={<span />} />
      </div>
    );
  }

  return (
    <>
      <CardHeader
        title="Mail Detayı"
        subtitle={`${selected.fromName || selected.fromEmail} • ${selected.fromEmail}`}
        right={
          <div className="flex gap-2">
            <Button variant="primary" className="bg-[#0a2b45] hover:opacity-90" onClick={onCreateOfferFromMail}>
              <Plus className="w-4 h-4" />
              Teklif Oluştur
            </Button>
          </div>
        }
      />

      <div className="p-4 space-y-4">
        <div className="p-4 rounded-2xl border border-slate-200 bg-white">
          <div className="text-lg font-semibold text-slate-900">{selected.subject}</div>
          <div className="text-xs text-slate-500 mt-1">
            <span className="font-medium text-slate-700">To:</span> {selected.to} •{" "}
            <span className="font-medium text-slate-700">Tarih:</span> {formatDT(selected.receivedAt)}
          </div>
          <Divider />

          {(() => {
           const panelIcimi = Boolean(selected?.isPanelInbox || isPanelInboxMail(selected));

const raw = getMailText(selected);
const f = parseSalesFormText(raw);

const companyAuto =
  (selected?.companyName && selected.companyName.trim()) ? selected.companyName.trim()
  : (getCompanyNameForMail(selected) || "");

const usersAuto =
  Number(selected?.usersCount || 0) ||
  guessUsersFromSubject(selected?.subject) ||
  Number(f.users) ||
  guessUsersFromText(f.raw) ||
  null;

const messageAuto =
  (panelIcimi ? (selected?.snippet || selected?.textBody || raw) : (f.message || raw)) || "—";

            return (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-2">
                  {companyAuto ? (
                    <div className="text-sm">
                      <span className="text-slate-500">Kurum Adı:</span>{" "}
                      <span className="font-medium text-slate-900">{companyAuto}</span>
                    </div>
                  ) : null}

                  <div className="text-sm">
                    <span className="text-slate-500">Ad Soyad:</span>{" "}
                    <span className="font-medium text-slate-900">{f.name || "—"}</span>
                  </div>

                  <div className="text-sm">
                    <span className="text-slate-500">E-posta:</span>{" "}
                    <span className="font-medium text-slate-900">{f.email || selected.fromEmail || "—"}</span>
                  </div>

                  <div className="text-sm">
                    <span className="text-slate-500">Kullanıcı Sayısı:</span>{" "}
                    <span className="font-medium text-slate-900">{f.users || guessUsersFromText(f.raw) || "—"}</span>
                  </div>

                  <div className="text-sm">
                    <span className="text-slate-500">Ekran:</span>{" "}
                    <span className="font-medium text-slate-900">{f.screen || "—"}</span>
                  </div>
                </div>

                <Divider />

                <div className="text-sm text-slate-500">Mesaj:</div>
                <div className="text-sm text-slate-800 whitespace-pre-wrap">{f.message || "—"}</div>
              </div>
            );
          })()}
        </div>
      </div>
    </>
  );
}

// ----------------- RIGHT PANEL -----------------
function OfferPanel({
  mode,
  setMode,
  selected,
  draft,
  setDraft,
  dirty,
  setDirty,
  onCancel,
  onStartCreate,
  onStartEdit,
  onSaveDraft,
  onPublishSend,
  offerEvents,
  onCopyLink,
  onSimulate, // ✅ eklendi (üstten zaten gönderiyorsun)
}) {
  const isForm = mode === "create" || mode === "edit";

  useEffect(() => {
    if (!isForm) setDirty(false);
  }, [isForm, setDirty]);

  return (
    <>
      <CardHeader
        title={isForm ? (mode === "create" ? "Yeni Teklif" : "Teklifi Düzenle") : "Teklif Detayı"}
        subtitle={
          isForm
            ? "Kullanıcı sayısı, fiyat, süreli link ve mail gönderimi."
            : selected
            ? "Süreç adımlarını ve loglarını buradan yönet."
            : "Soldan bir teklif seç veya yeni teklif oluştur."
        }
        right={
          isForm ? (
            <div className="flex flex-wrap items-center gap-2">
              {dirty ? <Pill tone="warn">Kaydedilmedi</Pill> : <Pill tone="good">Güncel</Pill>}
              <Button variant="secondary" onClick={onCancel}>
                <XCircle className="w-4 h-4" />
                Vazgeç
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={onStartCreate}>
                <Plus className="w-4 h-4" />
                Yeni
              </Button>
              <Button variant="secondary" onClick={onStartEdit} disabled={!selected}>
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
            title="Teklif seçilmedi."
            desc="Soldaki listeden seç veya yeni teklif oluştur."
            action={
              <Button onClick={onStartCreate}>
                <Plus className="w-4 h-4" />
                Yeni Teklif
              </Button>
            }
          />

) : isForm ? (
  <div className="space-y-4">
       {/* Link Preview */}
    <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50">
      <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
        <Link2 className="w-4 h-4" />
        Süreli Kayıt Linki
      </div>

      <div className="text-xs text-slate-500 mt-1">
        {draft?.delivery === "panel"
          ? "Panel içi teklifte süreli kayıt linki kullanılmaz. Teklif panelde görüntülenir."
          : "Token otomatik üretildi. Yayınlayıp mail gönderince süreç başlar."}
      </div>

      {draft?.delivery === "panel" ? (
        <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Bu teklif panel içi gönderilecektir. Mail gönderimi yapılmaz.
        </div>
      ) : null}

      <div className="mt-3 text-xs text-slate-500 grid gap-1">
        <div>
          <span className="font-medium text-slate-700">Bitiş:</span>{" "}
          {formatDT(draft.linkExpiresAt)}
        </div>
        <div>
          <span className="font-medium text-slate-700">Token:</span>{" "}
          <span className="font-mono">{draft.token || "—"}</span>
        </div>
      </div>

      {draft?.delivery !== "panel" ? (
        <>
          <div className="mt-2 text-xs text-slate-700 font-mono break-all">
            {buildOfferLink(draft.token || "TOKEN", draft.usersCount, {
              companyName: draft.companyName,
              contactName: draft.contactName,
              email: draft.email,
            })}
          </div>

          <div className="mt-2 flex justify-end">
            <Button
              variant="secondary"
              onClick={() => {
                const link = buildOfferLink(draft.token || "TOKEN", draft.usersCount, {
                  companyName: draft.companyName,
                  contactName: draft.contactName,
                  email: draft.email,
                });
                navigator.clipboard?.writeText(link);
                alert("Teklif linki panoya kopyalandı.");
              }}
            >
              <Copy className="w-4 h-4" />
              Link Kopyala
            </Button>
          </div>
        </>
      ) : null}
    </div>

    {/* Temel Bilgiler */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
<div className="md:col-span-2">
  <FieldLabel>Gönderim Tipi</FieldLabel>
  <Select
    value={draft.delivery || "email"}
    onChange={(e) => {
      setDirty(true);
      const v = e.target.value;
      setDraft((p) => ({ ...p, delivery: v }));
    }}
  >
    <option value="email">Mail (Link + Mail)</option>
    <option value="panel">Panel (Panele Gönder)</option>
  </Select>

  {draft.delivery === "panel" ? (
    <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
      Bu teklif panel içi gönderilecektir. Mail gönderimi yapılmaz.
    </div>
  ) : null}
</div>

      <div className="md:col-span-2">
        <FieldLabel icon={<Building2 className="w-4 h-4" />}>Kurum Adı</FieldLabel>
        <Input
          value={draft.companyName}
          onChange={(e) => {
            setDirty(true);
            setDraft((p) => ({ ...p, companyName: e.target.value }));
          }}
          onBlur={(e) => setDraft((p) => ({ ...p, companyName: toTitleTR(e.target.value) }))}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          onPaste={(e) => {
            const v = e.clipboardData.getData("text");
            e.preventDefault();
            setDirty(true);
            setDraft((p) => ({ ...p, companyName: toTitleTR(v) }));
          }}
        />
      </div>

      <div className="md:col-span-2">
        <FieldLabel icon={<UserRound className="w-4 h-4" />}>Yetkili Kişi</FieldLabel>
        <Input
          value={draft.contactName}
          onChange={(e) => {
            setDirty(true);
            setDraft((p) => ({ ...p, contactName: e.target.value }));
          }}
          onBlur={(e) => setDraft((p) => ({ ...p, contactName: toTitleTR(e.target.value) }))}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          onPaste={(e) => {
            const v = e.clipboardData.getData("text");
            e.preventDefault();
            setDirty(true);
            setDraft((p) => ({ ...p, contactName: toTitleTR(v) }));
          }}
        />
      </div>

      <div className="md:col-span-2">
        <FieldLabel icon={<Mail className="w-4 h-4" />}>E-posta</FieldLabel>
        <Input
          value={draft.email}
          onChange={(e) => {
            setDirty(true);
            setDraft((p) => ({ ...p, email: e.target.value }));
          }}
          placeholder="ornek@firma.com"
        />
      </div>
    </div>

    {/* Teklif Detayları */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
      <div>
        <FieldLabel icon={<Users className="w-4 h-4" />}>Kullanıcı Sayısı</FieldLabel>
        <Input
          type="number"
          min={10}
          value={draft.usersCount}
          onChange={(e) => {
            setDirty(true);
            const users = Number(e.target.value || 10);
            setDraft((p) => ({ ...p, usersCount: users }));
          }}
        />
      </div>

      <div>
        <FieldLabel icon={<Clock className="w-4 h-4" />}>Geçerlilik Süresi (gün)</FieldLabel>
        <Input
          type="number"
          min={1}
          value={draft.durationDays}
          onChange={(e) => {
            setDirty(true);
            const days = Number(e.target.value || 7);
            setDraft((p) => ({
              ...p,
              durationDays: days,
              linkExpiresAt: addDaysISO(nowLocalISO(), days),
            }));
          }}
        />
      </div>

      <div className="md:col-span-2">
        <FieldLabel icon={<Banknote className="w-4 h-4" />}>Fiyat (TRY)</FieldLabel>
        <Input
          type="number"
          min={0}
          value={draft.priceTRY}
          onChange={(e) => {
            setDirty(true);
            setDraft((p) => ({ ...p, priceTRY: Number(e.target.value || 0) }));
          }}
          placeholder="0"
        />
      </div>

      <div className="md:col-span-2">
        <FieldLabel icon={<Link2 className="w-4 h-4" />}>Link Bitiş Tarihi</FieldLabel>
        <Input
          type="datetime-local"
          value={draft.linkExpiresAt || ""}
          onChange={(e) => {
            setDirty(true);
            setDraft((p) => ({ ...p, linkExpiresAt: e.target.value }));
          }}
        />
        <div className="text-xs text-slate-500 mt-1">
          Not: “Gönder” için bitiş tarihi gelecekte olmalı.
        </div>
      </div>
    </div>

    {/* Notlar */}
    <div>
      <div className="flex items-center justify-between">
        <FieldLabel>Teklif Notları</FieldLabel>
        <button
          type="button"
          onClick={() => {
            setDirty(true);
            setDraft((p) => ({ ...p, notes: DEFAULT_OFFER_NOTES }));
          }}
          className="text-xs font-medium text-slate-600 hover:text-slate-900 underline underline-offset-2"
          title="Notları varsayılana döndür"
        >
          Varsayılanı geri yükle
        </button>
      </div>

      <Textarea
        value={draft.notes || ""}
        onChange={(e) => {
          setDirty(true);
          setDraft((p) => ({ ...p, notes: e.target.value }));
        }}
        placeholder="Teklif kapsamı, özel şartlar..."
      />
    </div>

    {/* Aksiyonlar */}
    <div className="flex items-center justify-between pt-2">
      <div className="text-xs text-slate-500">
        “Taslak Kaydet” sadece kayıt eder. “Gönder” = teklif aktif link + mail + log.
      </div>
      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={onSaveDraft}>
          <CheckCircle2 className="w-4 h-4" />
          Taslak Kaydet
        </Button>
        <Button onClick={onPublishSend}>
  {draft?.delivery === "panel" ? <Inbox className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
  {draft?.delivery === "panel" ? "Gönder (Panel)" : "Gönder (Link + Mail)"}
</Button>
      </div>
    </div>
  </div>
) : (
  <div className="space-y-4">
    {/* Üst özet */}
    <div className="p-4 rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-lg font-semibold text-slate-900">{selected.companyName}</div>
          <div className="text-sm text-slate-600 mt-1">
            {selected.contactName || "—"} • {selected.email}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Pill tone={offerSourceTone(selected.source)}>{offerSourceLabel(selected.source)}</Pill>
<Pill tone={offerDeliveryTone(selected.delivery)}>{offerDeliveryLabel(selected.delivery)}</Pill>

            <Pill tone="neutral" icon={<Users className="w-4 h-4" />}>
              {Number(selected.usersCount || 0)} kullanıcı
            </Pill>

            <Pill tone="neutral" icon={<Banknote className="w-4 h-4" />}>
              {currencyTRY(selected.priceTRY)}
            </Pill>

            <Pill tone={offerStatusTone(selected.status)} icon={<CheckCircle2 className="w-4 h-4" />}>
              {offerStatusLabel(selected.status)}
            </Pill>
          </div>

          <div className="mt-3 text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1">
              <Clock className="w-4 h-4" /> Oluşturma: {formatDT(selected.createdAt)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Link2 className="w-4 h-4" /> Bitiş: {formatDT(selected.linkExpiresAt)}
            </span>
          </div>

          {!isPanelDelivery(selected) ? (
  <div className="mt-2 text-xs text-slate-500 truncate">
    <span className="text-slate-400">Link:</span>{" "}
    {buildOfferLink(selected.token, selected.usersCount, {
      companyName: selected.companyName,
      contactName: selected.contactName,
      email: selected.email,
    })}
  </div>
) : null}
        </div>

        <div className="shrink-0">
          {!isPanelDelivery(selected) ? (
  <Button variant="secondary" onClick={onCopyLink}>
    <Copy className="w-4 h-4" />
    Link Kopyala
  </Button>
) : null}
        </div>
      </div>
    </div>

    {/* Notlar */}
    <div className="p-4 rounded-2xl border border-slate-200 bg-white">
      <div className="text-sm font-semibold text-slate-900">Teklif Notu</div>
      <div className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">
        {selected.notes?.trim?.() ? selected.notes : "—"}
      </div>
    </div>

    {/* Timeline */}
    <div className="p-4 rounded-2xl border border-slate-200 bg-white">
      <div className="text-sm font-semibold text-slate-900">Süreç Timeline</div>
      <div className="mt-3 space-y-3">
        {offerEvents?.length ? (
          offerEvents.map((e) => <EventRow key={e.id} e={e} />)
        ) : (
          <div className="text-sm text-slate-500">Henüz log yok.</div>
        )}
      </div>
    </div>
  </div>
        )}
      </div>
    </>
  );
}

function EventRow({ e }) {
  const title = eventTitle(e);
  const tone = eventTone(e.type);
  return (
    <div className="flex items-start gap-3">
      <div className={cn("w-9 h-9 rounded-2xl flex items-center justify-center border", tone.bg, tone.border, tone.text)}>
        {eventIcon(e.type)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          <div className="text-xs text-slate-500">{formatDT(e.at)}</div>
        </div>
        <div className="text-xs text-slate-500 mt-1">
          <span className="font-medium text-slate-700">{e.by}</span>
          {e.meta && Object.keys(e.meta).length ? <span className="text-slate-400"> • </span> : null}
          {e.meta && Object.keys(e.meta).length ? <span className="font-mono break-all">{JSON.stringify(e.meta)}</span> : null}
        </div>
      </div>
    </div>
  );
}

function eventTitle(e) {
  switch (e.type) {
    case "LEAD_CREATED":
      return "Lead oluşturuldu";
    case "OFFER_CREATED":
      return "Teklif oluşturuldu";
    case "LINK_GENERATED":
      return "Süreli kayıt linki üretildi";
    case "EMAIL_SENT":
      return "Teklif maili gönderildi";

    // ✅ yeni
    case "PANEL_SENT":
      return "Teklif panele iletildi";

    case "LINK_OPENED":
      return "Link açıldı";
    case "REGISTERED":
      return "Kurum kayıt oldu";
    case "PAYMENT_SUCCESS":
      return "Ödeme başarılı";
    case "LOGIN_FIRST":
      return "İlk giriş yapıldı";
    case "EXPIRED":
      return "Link süresi doldu";
    case "CANCELED":
      return "Teklif iptal edildi";
    default:
      return e.type;
  }
}

function eventTone(type) {
  const base = { bg: "bg-slate-50", border: "border-slate-200", text: "text-slate-700" };

  if (type === "PAYMENT_SUCCESS" || type === "LOGIN_FIRST") {
    return { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700" };
  }

  if (type === "REGISTERED" || type === "LINK_OPENED" || type === "EMAIL_SENT" || type === "PANEL_SENT") {
  return { bg: "bg-sky-50", border: "border-sky-200", text: "text-sky-700" };
}

  if (type === "EXPIRED") {
    return { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700" };
  }

  if (type === "CANCELED") {
    return { bg: "bg-red-50", border: "border-red-200", text: "text-red-700" };
  }

  return base;
}

function GlobalLog({ events, offers }) {
  const mapOffer = useMemo(() => {
    const m = new Map();
    offers.forEach((o) => m.set(o.id, o));
    return m;
  }, [offers]);

  const sorted = useMemo(() => {
    return [...events].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 200);
  }, [events]);

  if (sorted.length === 0) {
    return <div className="text-sm text-slate-500">Log yok.</div>;
  }

  return (
    <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
      {sorted.map((e) => {
        const o = mapOffer.get(e.offerId);
        return (
          <div key={e.id} className="p-3 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900">
                  {eventTitle(e)} <span className="text-slate-400 font-normal">•</span>{" "}
                  <span className="text-slate-700">{o ? o.companyName : "—"}</span>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {formatDT(e.at)} • by <span className="font-medium text-slate-700">{e.by}</span>
                </div>
                {e.meta && Object.keys(e.meta).length ? (
                  <div className="text-xs text-slate-500 mt-2 font-mono break-all">{JSON.stringify(e.meta)}</div>
                ) : null}
              </div>

              <div className="shrink-0">
                <Pill
                  tone={
                    eventTone(e.type).text.includes("emerald")
                      ? "good"
                      : eventTone(e.type).text.includes("red")
                      ? "bad"
                      : eventTone(e.type).text.includes("amber")
                      ? "warn"
                      : "info"
                  }
                >
                  {e.type}
                </Pill>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ----------------- Utils -----------------
function stripHtml(html) {
  return (html || "")
    .toString()
    .replace(/<\/td>\s*<td[^>]*>/gi, ": ")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getMailText(mail) {
  return mail?.textBody || stripHtml(mail?.htmlBody) || mail?.snippet || "";
}

function guessUsersFromText(text) {
  const t = (text || "").toString();
  const m = t.match(/(\d{2,5})\s*(kullan\u0131c\u0131|ki\u015fi|personel|\+?user)/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function guessUsersFromSubject(subject) {
  const s = (subject || "").toString();

  // "(... 18 ...)" gibi
  const m1 = s.match(/\((\d{1,5})\s*/);
  if (m1) {
    const n = Number(m1[1]);
    if (Number.isFinite(n)) return n;
  }

  // "18 kullanici" gibi
  const m2 = s.match(/(\d{1,5})\s*(kullan\u0131c\u0131|kullanici|ki\u015fi|kisi|personel|user)/i);
  if (m2) {
    const n = Number(m2[1]);
    if (Number.isFinite(n)) return n;
  }

  return null;
}

function parseSalesFormText(text) {
  const t = (text || "").toString();

  const lines = t
    .split("\n")
    .map((x) => x.replace(/\u00a0/g, " ").trim())
    .filter(Boolean);

  const labelRes = [
    { key: "company", re: /^(Kurum\s*Ad[ıi]|Firma\s*Ad[ıi]|Şirket|Sirket|Company)\s*[*]?\s*[:\-–—]?\s*(.*)$/i },
    { key: "name", re: /^(Ad\s*Soyad[ıi]?|Ad|İsim|Isim|Name)\s*[*]?\s*[:\-–—]?\s*(.*)$/i },
    { key: "email", re: /^(E-?posta|Eposta|Email|Mail)\s*[*]?\s*[:\-–—]?\s*(.*)$/i },
    { key: "users", re: /^(Kullan[ıi]c[ıi]\s*Say[ıi]s[ıi]|Kişi\s*Say[ıi]s[ıi]|Personel)\s*[*]?\s*[:\-–—]?\s*(.*)$/i },
    { key: "screen", re: /^(Ekran|Sayfa|Screen)\s*[*]?\s*[:\-–—]?\s*(.*)$/i },
    { key: "message", re: /^(Mesaj(ınız)?|Açıklama|Aciklama|Not|Message)\s*[*]?\s*[:\-–—]?\s*(.*)$/i },
  ];

  const out = { company: "", name: "", email: "", users: "", screen: "", message: "", raw: t };

  let curKey = null;
  for (const line of lines) {
    let matched = false;

    for (const lr of labelRes) {
      const m = line.match(lr.re);
      if (m) {
        curKey = lr.key;
        const v = (m[m.length - 1] || "").toString().trim();
        if (v) out[curKey] = v;
        matched = true;
        break;
      }
    }

    if (!matched && curKey === "message") {
      out.message = (out.message ? out.message + "\n" : "") + line;
    }
  }

  return out;
}

function guessCompanyFromSubject(subject) {
  const s = (subject || "").toString().trim();
  if (!s) return "";
  const cleaned = s.replace(/\([^)]*\)/g, "").trim();
  const dash = cleaned.split("-").map((x) => x.trim()).filter(Boolean);
  let cand = dash.length >= 2 ? dash[dash.length - 1] : cleaned;
  cand = cand.replace(/[–—:]+$/g, "").trim();
  if (/^(teklif al|satış talebi|satis talebi|teklif|talep|kurumsal)$/i.test(cand)) return "";
  if (/(kullanıcı|kullanici|kişi|kisi|personel|10\+)/i.test(cand)) return "";
  if (cand.length < 3) return "";
  return cand;
}

function guessCompanyFromEmail(email) {
  if (!email) return "";
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return "";
  if (/gmail\.com|hotmail\.com|outlook\.com|yahoo\.com|icloud\.com/i.test(domain)) return "";
  const name = domain.split(".")[0];
  if (!name || name.length < 2) return "";
  return toTitleTR(name.replace(/[-_]/g, " "));
}

function getCompanyNameForMail(mail) {
  if (mail?.companyName && mail.companyName.trim()) return mail.companyName.trim();

  const hasBody = Boolean((mail?.textBody && mail.textBody.trim()) || (mail?.htmlBody && mail.htmlBody.trim()));
  if (!hasBody) {
    const byDomain = guessCompanyFromEmail(mail?.fromEmail);
    if (byDomain) return byDomain;
    const bySub = guessCompanyFromSubject(mail?.subject);
    if (bySub) return toTitleTR(bySub);
    return "";
  }

  const raw = getMailText(mail);
  const f = parseSalesFormText(raw);

  if (f?.company && f.company.trim()) {
    const c = f.company.trim();
    const n = (f.name || "").trim();
    if (c.toLowerCase() !== n.toLowerCase()) return toTitleTR(c);
  }

  const byDomain = guessCompanyFromEmail(f?.email || mail?.fromEmail);
  if (byDomain) return byDomain;

  const bySub = guessCompanyFromSubject(mail?.subject);
  if (bySub) return toTitleTR(bySub);

  return "";
}

function normalizeDraft(d) {
  return {
    ...d,
    source: (d.source || "panel").toString(),
    delivery: (d.delivery || "email").toString(), // ✅ eklendi
    companyName: (d.companyName || "").toString(),
    contactName: (d.contactName || "").toString(),
    email: (d.email || "").toString(),
    usersCount: Number(d.usersCount || 10),
    durationDays: Number(d.durationDays || 7),
    priceTRY: Number(d.priceTRY || 0),
    notes: (d.notes || "").toString(),
    token: (d.token || "").toString(),
    linkExpiresAt: d.linkExpiresAt || "",
    id: d.id || null,
    leadId: d.leadId || null,
  };
}

function isExpiresSoon(iso, hours = 24) {
  if (!iso) return false;
  const exp = new Date(iso);
  const now = new Date();
  const diff = exp.getTime() - now.getTime();
  return diff > 0 && diff <= hours * 3600 * 1000;
}

function pilotIsExpired(p) {
  if (!p?.pilotEndDate) return false;
  return new Date() > new Date(p.pilotEndDate);
}

function planFromUsersCount(n) {
  const c = Number(n || 0);
  if (c <= 3) return { plan: "ticari-1-3", label: "Ticari 1-3" };
  if (c <= 5) return { plan: "ticari-4-5", label: "Ticari 4-5" };
  if (c <= 10) return { plan: "ticari-6-10", label: "Ticari 6-10" };
  return { plan: "prof-ozel", label: "Kurumsal 10+ (Özel Teklif)" };
}

function buildPilotLink(token, usersCount, meta = {}) {
  const APP_URL =
    (typeof import.meta !== "undefined" && import.meta?.env?.VITE_APP_URL) ||
    window.location.origin;

  const { plan } = planFromUsersCount(usersCount);

  const params = new URLSearchParams();
  params.set("pilotToken", token || "");
  params.set("pilot", "1");
  params.set("plan", plan);
  params.set("users", String(Number(usersCount || 0)));

  if (meta.companyName) params.set("companyName", meta.companyName);
  if (meta.contactName) params.set("contactName", meta.contactName);
  if (meta.email) params.set("email", meta.email);

  // ✅ EK: pilot bilgileri (register ekranı bunları okuyacak)
  if (meta.pilotDays != null && meta.pilotDays !== "") {
    params.set("pilotDays", String(Number(meta.pilotDays || 0)));
  }
  if (meta.pilotEndDate) {
    params.set("pilotEndDate", String(meta.pilotEndDate));
  }

  return `${APP_URL}/register/kurumsal?${params.toString()}`;
}

// ---------------- PILOT PANEL ----------------
function PilotPanel({
  pilotDraft,
  setPilotDraft,
  selectedPilotId,
  setSelectedPilotId,

  // ✅ Tek kaynaktan yönet (Teklifler.jsx zaten gönderiyor)
  pilotMode,
  setPilotMode,

  onRefresh,
  onDeletePilot,
  onCreatePilot,
  onUpdatePilot,
  onSendPilotEmail,
  pilotLoading,
}) {
  const hasSelected = Boolean(selectedPilotId);
  const isForm = pilotMode === "create" || pilotMode === "edit";
  const isEdit = pilotMode === "edit";

  // ✅ seçili pilot değişince otomatik view’a dön (OfferPanel gibi)
  React.useEffect(() => {
    setPilotMode("view");
  }, [selectedPilotId, setPilotMode]);

  // ✅ createdAt + pilotDays => pilotEndDate otomatik üret
 React.useEffect(() => {
  if (!pilotDraft.createdAt) {
    const now = nowLocalISO();
    setPilotDraft((p) => ({
      ...p,
      createdAt: now,

      // ✅ pilot kullanılabilirlik
      pilotEndDate: p.pilotEndDate || addDaysISO(now, Number(p.pilotDays || 30)),

      // ✅ link süresi
      linkDays: Number(p.linkDays || 5),
      linkExpiresAt: p.linkExpiresAt || addDaysISO(now, Number(p.linkDays || 5)),
    }));
    return;
  }

  setPilotDraft((p) => {
    const base = p.createdAt || nowLocalISO();

    const nextPilotEnd = addDaysISO(base, Number(p.pilotDays || 30));
    const nextLinkExp = addDaysISO(base, Number(p.linkDays || 5));

    if (p.pilotEndDate === nextPilotEnd && p.linkExpiresAt === nextLinkExp) return p;

    return {
      ...p,
      pilotEndDate: nextPilotEnd,
      linkExpiresAt: nextLinkExp,
    };
  });
}, [pilotDraft.pilotDays, pilotDraft.linkDays, pilotDraft.createdAt, setPilotDraft]);

  function resetPilot() {
    setSelectedPilotId(null);
    setPilotDraft({
      id: null,
      companyName: "",
      contactName: "",
      email: "",
      usersCount: 10,
      pilotDays: 30,
      token: genToken(),
      createdAt: "",
      pilotEndDate: "",
      status: "draft",
      notes:
        pilotDraft?.notes && pilotDraft.notes.trim().length > 0
          ? pilotDraft.notes
          : `Pilot kullanım süresi boyunca ödeme alınmaz.
Pilot süresi sonunda hizmetin devamı için ücretli pakete geçiş yapılır.
Pilot kapsamı ve kullanıcı limiti bu kayıtla sabitlenir.`,
    });
  }

  const link = buildPilotLink(pilotDraft.token || "TOKEN", pilotDraft.usersCount, {
    companyName: pilotDraft.companyName,
    contactName: pilotDraft.contactName,
    email: pilotDraft.email,
  });

  const effectiveStatus = pilotIsExpired(pilotDraft)
    ? "expired"
    : pilotDraft?.status === "draft"
    ? "draft"
    : "active";

  return (
    <>
      <CardHeader
        title={isForm ? (pilotMode === "create" ? "Yeni Pilot" : "Pilot Düzenle") : "Pilot Detayı"}
        subtitle={
          isForm
            ? "Kullanıcı sayısı, pilot süresi, notlar ve pilot kayıt linki."
            : hasSelected
            ? "Pilot bilgilerini görüntüle. Düzenlemek için ‘Düzenle’."
            : "Soldan bir pilot seç veya yeni pilot oluştur."
        }
        right={
          isForm ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setPilotMode("view");
                }}
              >
                <XCircle className="w-4 h-4" />
                Vazgeç
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Pill tone="warn">PİLOT</Pill>

              <Button
                variant="secondary"
                onClick={() => {
                  resetPilot();
                  setPilotMode("create");
                }}
              >
                <Plus className="w-4 h-4" />
                Yeni
              </Button>

              <Button
                variant="secondary"
                onClick={() => setPilotMode("edit")}
                disabled={!hasSelected}
              >
                <Pencil className="w-4 h-4" />
                Düzenle
              </Button>
            </div>
          )
        }
      />

      <div className="p-4">
        {!hasSelected && !isForm ? (
          <EmptyState
            title="Pilot seçilmedi."
            desc="Soldaki listeden bir pilot seç veya yeni pilot oluştur."
            action={
              <Button
                onClick={() => {
                  resetPilot();
                  setPilotMode("create");
                }}
              >
                <Plus className="w-4 h-4" />
                Yeni Pilot
              </Button>
            }
          />
        ) : isForm ? (
          // ---------------- FORM (create/edit) ----------------
          <div className="space-y-4">
            <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50">
              <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Link2 className="w-4 h-4" />
                Pilot Kayıt Linki
              </div>

              <div className="mt-2 text-xs text-slate-500 grid gap-1">
                <div>
  <span className="font-medium text-slate-700">Oluşturma:</span> {formatDT(pilotDraft.createdAt)}
</div>

{/* ✅ Link süresi */}
<div>
  <span className="font-medium text-slate-700">Link Bitiş:</span> {formatDT(pilotDraft.linkExpiresAt)}
</div>

{/* ✅ Pilot kullanılabilirlik */}
<div>
  <span className="font-medium text-slate-700">Pilot Bitiş:</span> {formatDT(pilotDraft.pilotEndDate)}
</div>
                <div>
                  <span className="font-medium text-slate-700">Token:</span>{" "}
                  <span className="font-mono">{pilotDraft.token || "—"}</span>
                </div>
              </div>

              <div className="mt-2 text-xs text-slate-700 font-mono break-all">{link}</div>

              <div className="mt-2 flex justify-end">
                <Button
                  variant="secondary"
                  onClick={() => {
                    navigator.clipboard?.writeText(link);
                    alert("Pilot linki panoya kopyalandı.");
                  }}
                >
                  <Copy className="w-4 h-4" />
                  Link Kopyala
                </Button>
              </div>
            </div>

            {/* --- FORM ALANLARI (mevcut kodun aynı, sadece burada) --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="md:col-span-2">
                <FieldLabel icon={<Building2 className="w-4 h-4" />}>Kurum Adı</FieldLabel>
                <Input
                  value={pilotDraft.companyName}
                  onChange={(e) => setPilotDraft((p) => ({ ...p, companyName: e.target.value }))}
                  onBlur={(e) => setPilotDraft((p) => ({ ...p, companyName: toTitleTR(e.target.value) }))}
                />
              </div>

              <div className="md:col-span-2">
                <FieldLabel icon={<UserRound className="w-4 h-4" />}>Yetkili Kişi</FieldLabel>
                <Input
                  value={pilotDraft.contactName}
                  onChange={(e) => setPilotDraft((p) => ({ ...p, contactName: e.target.value }))}
                  onBlur={(e) => setPilotDraft((p) => ({ ...p, contactName: toTitleTR(e.target.value) }))}
                />
              </div>

              <div className="md:col-span-2">
                <FieldLabel icon={<Mail className="w-4 h-4" />}>E-posta</FieldLabel>
                <Input
                  value={pilotDraft.email}
                  onChange={(e) => setPilotDraft((p) => ({ ...p, email: e.target.value }))}
                  placeholder="ornek@firma.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <FieldLabel icon={<Users className="w-4 h-4" />}>Kullanıcı Sayısı</FieldLabel>
                <Input
                  type="number"
                  min={1}
                  value={pilotDraft.usersCount}
                  onChange={(e) => setPilotDraft((p) => ({ ...p, usersCount: Number(e.target.value) }))}
                />
              </div>

             <div>
  <FieldLabel icon={<Clock className="w-4 h-4" />}>Link Süresi (gün)</FieldLabel>
  <Input
    type="number"
    min={1}
    value={pilotDraft.linkDays || 5}
    onChange={(e) => setPilotDraft((p) => ({ ...p, linkDays: Number(e.target.value) }))}
  />
</div>

<div>
  <FieldLabel icon={<Clock className="w-4 h-4" />}>Pilot Süresi (gün)</FieldLabel>
  <Input
    type="number"
    min={1}
    value={pilotDraft.pilotDays}
    onChange={(e) => setPilotDraft((p) => ({ ...p, pilotDays: Number(e.target.value) }))}
  />
</div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <FieldLabel>Kurumsal Notlar</FieldLabel>
                <button
                  type="button"
                  onClick={() =>
                    setPilotDraft((p) => ({
                      ...p,
                      notes: `Pilot kullanım süresi boyunca ödeme alınmaz.
Pilot süresi sonunda hizmetin devamı için ücretli pakete geçiş yapılır.
Pilot kapsamı ve kullanıcı limiti bu kayıtla sabitlenir.`,
                    }))
                  }
                  className="text-xs font-medium text-slate-600 hover:text-slate-900 underline underline-offset-2"
                  title="Notları varsayılana döndür"
                >
                  Varsayılanı geri yükle
                </button>
              </div>

              <Textarea
                value={pilotDraft.notes || ""}
                onChange={(e) => setPilotDraft((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Pilot kapsamı, sınırlar, özel notlar…"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="text-xs text-slate-500">
                Taslaklara Kaydet: pilotu taslak yazar • Mail Gönder: link + geçici şifre ile aktif eder.
              </div>

              {/* ✅ Sil / Taslak / Mail Gönder sadece FORM’da */}
              <div className="flex items-center gap-2">
                {isEdit ? (
                  <>
                    <Button
                      variant="secondary"
                      onClick={() => onDeletePilot?.(pilotDraft)}
                      disabled={pilotLoading}
                    >
                      <Trash2 className="w-4 h-4" />
                      Sil
                    </Button>

                    <Button
                      variant="secondary"
                      onClick={async () => {
                        if (!pilotDraft.companyName?.trim()) return alert("Kurum adı zorunlu.");
                        if (!pilotDraft.email?.trim()) return alert("E-posta zorunlu.");

                        try {
                          const now = nowLocalISO();
                          await onUpdatePilot?.(selectedPilotId, {
                            companyName: pilotDraft.companyName.trim(),
                            contactName: (pilotDraft.contactName || "").trim(),
                            email: pilotDraft.email.trim(),
                            usersCount: Number(pilotDraft.usersCount || 10),
                            pilotDays: Number(pilotDraft.pilotDays || 30),
                            notes: pilotDraft.notes || "",
                            token: pilotDraft.token || genToken(),
                            pilotEndDate: pilotDraft.pilotEndDate || addDaysISO(now, Number(pilotDraft.pilotDays || 30)),
                            status: "draft",
                            updatedAt: now,
                          });
                          await onRefresh?.();
                          alert("✅ Taslak kaydedildi.");
                          setPilotMode("view");
                        } catch (e) {
                          alert("Taslak kaydedilemedi: " + (e?.message || e));
                        }
                      }}
                      disabled={pilotLoading}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Taslaklara Kaydet
                    </Button>

                   <Button
  onClick={async () => {
    try {
      if (!pilotDraft.companyName?.trim()) return alert("Kurum adı zorunlu.");
      if (!pilotDraft.email?.trim()) return alert("E-posta zorunlu.");

      const now = nowLocalISO();

      await onUpdatePilot?.(selectedPilotId, {
        companyName: pilotDraft.companyName.trim(),
        contactName: (pilotDraft.contactName || "").trim(),
        email: pilotDraft.email.trim(),
        usersCount: Number(pilotDraft.usersCount || 10),
        pilotDays: Number(pilotDraft.pilotDays || 30),
        linkDays: Number(pilotDraft.linkDays || 5),
        linkExpiresAt: pilotDraft.linkExpiresAt || addDaysISO(now, Number(pilotDraft.linkDays || 5)),
        notes: pilotDraft.notes || "",
        token: pilotDraft.token || genToken(),
        pilotEndDate: pilotDraft.pilotEndDate || addDaysISO(now, Number(pilotDraft.pilotDays || 30)),
        status: "active",
        updatedAt: now,
      });

      await onSendPilotEmail?.(selectedPilotId, {
  companyName: pilotDraft.companyName.trim(),
  contactName: (pilotDraft.contactName || "").trim(),
  email: pilotDraft.email.trim(),
  usersCount: Number(pilotDraft.usersCount || 10),
  pilotDays: Number(pilotDraft.pilotDays || 30),
  linkDays: Number(pilotDraft.linkDays || 5),
  linkExpiresAt: pilotDraft.linkExpiresAt || addDaysISO(now, Number(pilotDraft.linkDays || 5)),
  notes: pilotDraft.notes || "",
  token: pilotDraft.token || genToken(),
  pilotEndDate: pilotDraft.pilotEndDate || addDaysISO(now, Number(pilotDraft.pilotDays || 30)),
  status: "active",
  updatedAt: now,
});
      await onRefresh?.();
      setPilotMode("view");
    } catch (e) {
      alert("Mail gönderilemedi: " + (e?.message || e));
    }
  }}
  disabled={pilotLoading}
>
  <Mail className="w-4 h-4" />
  Mail Gönder (Pilot)
</Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="secondary"
                      onClick={async () => {
                        if (!pilotDraft.companyName?.trim()) return alert("Kurum adı zorunlu.");
                        if (!pilotDraft.email?.trim()) return alert("E-posta zorunlu.");

                        try {
                          const now = nowLocalISO();
                         const payload = {
  companyName: pilotDraft.companyName.trim(),
  contactName: (pilotDraft.contactName || "").trim(),
  email: pilotDraft.email.trim(),
  usersCount: Number(pilotDraft.usersCount || 10),
  pilotDays: Number(pilotDraft.pilotDays || 30),
  linkDays: Number(pilotDraft.linkDays || 5),
  linkExpiresAt: pilotDraft.linkExpiresAt || addDaysISO(now, Number(pilotDraft.linkDays || 5)),
  notes: pilotDraft.notes || "",
  token: pilotDraft.token || genToken(),
  pilotEndDate: addDaysISO(now, Number(pilotDraft.pilotDays || 30)),
  status: "draft",
};
                          const saved = await onCreatePilot?.(payload);
                          const newId = saved?.pilotId || saved?.id;

                          await onRefresh?.();
                          if (newId) setSelectedPilotId(String(newId));

                          alert("✅ Taslak oluşturuldu.");
                          setPilotMode("view");
                        } catch (e) {
                          alert("Taslak oluşturulamadı: " + (e?.message || e));
                        }
                      }}
                      disabled={pilotLoading}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Taslaklara Kaydet
                    </Button>

                    <Button
                      onClick={async () => {
                        if (!pilotDraft.companyName?.trim()) return alert("Kurum adı zorunlu.");
                        if (!pilotDraft.email?.trim()) return alert("E-posta zorunlu.");

                        try {
                          const now = nowLocalISO();
                          const payload = {
                            companyName: pilotDraft.companyName.trim(),
                            contactName: (pilotDraft.contactName || "").trim(),
                            email: pilotDraft.email.trim(),
                            usersCount: Number(pilotDraft.usersCount || 10),
                            pilotDays: Number(pilotDraft.pilotDays || 30),
                            notes: pilotDraft.notes || "",
                            token: pilotDraft.token || genToken(),
                            pilotEndDate: addDaysISO(now, Number(pilotDraft.pilotDays || 30)),
                            status: "draft",
                          };

                          const saved = await onCreatePilot?.(payload);
                          const newId = saved?.pilotId || saved?.id;

                          await onRefresh?.();

                          const idToSend = newId ? String(newId) : null;
                          if (!idToSend) return alert("Pilot kaydı oluşturulamadı (id yok).");

                          setSelectedPilotId(idToSend);

                          await onSendPilotEmail?.(idToSend, {
  companyName: pilotDraft.companyName.trim(),
  contactName: (pilotDraft.contactName || "").trim(),
  email: pilotDraft.email.trim(),
  usersCount: Number(pilotDraft.usersCount || 10),
  pilotDays: Number(pilotDraft.pilotDays || 30),
  linkDays: Number(pilotDraft.linkDays || 5),
  linkExpiresAt: pilotDraft.linkExpiresAt,
  pilotEndDate: pilotDraft.pilotEndDate,
  notes: pilotDraft.notes || "",
  token: pilotDraft.token || genToken(),
});
                          await onRefresh?.();
                          alert("Pilot maili gönderildi.");
                          setPilotMode("view");
                        } catch (e) {
                          alert("Mail gönderilemedi: " + (e?.message || e));
                        }
                      }}
                      disabled={pilotLoading}
                    >
                      <Mail className="w-4 h-4" />
                      Mail Gönder (Pilot)
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          // ---------------- VIEW (Pilot Detayı) ----------------
          <div className="space-y-4">
            <div className="p-4 rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-lg font-semibold text-slate-900">{pilotDraft.companyName || "—"}</div>
                  <div className="text-sm text-slate-600 mt-1">
                    {pilotDraft.contactName || "—"} • {pilotDraft.email || "—"}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <Pill tone="warn">PİLOT</Pill>
                    <Pill tone="neutral" icon={<Users className="w-4 h-4" />}>
                      {Number(pilotDraft.usersCount || 0)} kullanıcı
                    </Pill>
                    <Pill tone="neutral" icon={<Clock className="w-4 h-4" />}>
                      {Number(pilotDraft.pilotDays || 0)} gün
                    </Pill>
                    <Pill tone={pilotStatusTone(effectiveStatus)} icon={<CheckCircle2 className="w-4 h-4" />}>
                      {pilotStatusLabel(effectiveStatus)}
                    </Pill>
                  </div>

                  <div className="mt-2 text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-1">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-4 h-4" /> Oluşturma: {formatDT(pilotDraft.createdAt)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Link2 className="w-4 h-4" /> Pilot Bitiş: {formatDT(pilotDraft.pilotEndDate)}
                    </span>
                  </div>

                  <div className="mt-2 text-xs text-slate-500 truncate">
                    <span className="text-slate-400">Link:</span> {link}
                  </div>
                </div>

                <div className="shrink-0">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      navigator.clipboard?.writeText(link);
                      alert("Pilot linki panoya kopyalandı.");
                    }}
                  >
                    <Copy className="w-4 h-4" />
                    Link Kopyala
                  </Button>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200 bg-white">
              <div className="text-sm font-semibold text-slate-900">Pilot Notları</div>
              <div className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">
                {pilotDraft.notes || "—"}
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200 bg-white">
              <div className="text-sm font-semibold text-slate-900">Süreç Timeline</div>
              <div className="mt-3 text-sm text-slate-500">Henüz log yok.</div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}


function pilotStatusLabel(s) {
  switch (s) {
    case "draft":
      return "Taslak";
    case "active":
      return "Aktif";
    case "expired":
      return "Süresi Doldu";
    default:
      return s || "—";
  }
}

function pilotStatusTone(s) {
  switch (s) {
    case "active":
      return "good";
    case "expired":
      return "warn";
    case "draft":
      return "neutral";
    default:
      return "neutral";
  }
}

/**
 * ✅ PilotRow: SİL / DÜZENLE / KOPYALA / AKTİF ET (Mail) hepsi AKTİF
 * - Butonlar item’i parametre olarak parent’a gönderir.
 * - onClick satır seçimi bozulmaz (stopPropagation).
 */
function PilotRow({ item, active, onClick, onCopy, onEdit, onActivate, onDelete }) {
  const status = pilotIsExpired(item) ? "expired" : item?.status === "draft" ? "draft" : "active";

 const link = buildPilotLink(item?.token, item?.usersCount, {
  companyName: item?.companyName,
  contactName: item?.contactName,
  email: item?.email,

  // ✅ EK
  pilotDays: item?.pilotDays,
  pilotEndDate: item?.pilotEndDate,
});

  const expiresSoon = isExpiresSoon(item?.pilotEndDate, 48) && status === "active";
  const expired = status === "expired";

  const handleCopy = (e) => {
    e.stopPropagation();
    onCopy?.(item);
  };
  const handleEdit = (e) => {
    e.stopPropagation();
    onEdit?.(item);
  };
  const handleActivate = (e) => {
    e.stopPropagation();
    onActivate?.(item);
  };
  const handleDelete = (e) => {
    e.stopPropagation();
    onDelete?.(item);
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "cursor-pointer p-3 rounded-2xl border transition shadow-sm",
        active ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white hover:bg-slate-50"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-700">
              <Building2 className="w-4 h-4" />
            </div>

            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900 truncate">{item?.companyName || "—"}</div>
              <div className="text-xs text-slate-500 truncate">
                {(item?.contactName || "—")} • {(item?.email || "—")}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-2">
            <Pill tone="warn">PİLOT</Pill>

            <Pill tone="neutral" icon={<Users className="w-4 h-4" />}>
              {Number(item?.usersCount || 0)} kullanıcı
            </Pill>

            <Pill tone="neutral" icon={<Clock className="w-4 h-4" />}>
              {Number(item?.pilotDays || 0)} gün
            </Pill>

            <Pill tone={pilotStatusTone(status)} icon={<CheckCircle2 className="w-4 h-4" />}>
              {pilotStatusLabel(status)}
            </Pill>

            {expiresSoon ? (
              <Pill tone="warn" icon={<Clock className="w-4 h-4" />}>
                Süre yaklaşıyor
              </Pill>
            ) : null}

            {expired ? (
              <Pill tone="warn" icon={<ShieldAlert className="w-4 h-4" />}>
                Süresi doldu
              </Pill>
            ) : null}
          </div>

          <div className="mt-2 text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1">
              <Clock className="w-4 h-4" /> Oluşturma: {formatDT(item?.createdAt)}
            </span>
           <span className="inline-flex items-center gap-1">
  <Link2 className="w-4 h-4" /> Link Bitiş: {formatDT(item?.linkExpiresAt)}
</span>

<span className="inline-flex items-center gap-1">
  <Clock className="w-4 h-4" /> Pilot Bitiş: {formatDT(item?.pilotEndDate)}
</span>
          </div>

          <div className="mt-2 text-xs text-slate-500 truncate">
            <span className="text-slate-400">Link:</span> {link}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="flex items-center gap-1">
            <IconBtn title="Linki kopyala" onClick={handleCopy}>
              <Copy className="w-4 h-4" />
            </IconBtn>

            <IconBtn title="Düzenle" onClick={handleEdit}>
              <Pencil className="w-4 h-4" />
            </IconBtn>

            <IconBtn title="Aktif Et (Mail)" onClick={handleActivate}>
              <CheckCircle2 className="w-4 h-4" />
            </IconBtn>

            <IconBtn title="Sil" danger onClick={handleDelete}>
              <Trash2 className="w-4 h-4" />
            </IconBtn>
          </div>
        </div>
      </div>
    </div>
  );
}