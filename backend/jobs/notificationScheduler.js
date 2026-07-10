// backend/jobs/notificationScheduler.js
// ✅ BİREYSEL + TİCARİ (ADMIN) TEK DOSYA
// - Mevcut bireysel taramalar KORUNDU
// - Ticari admin 6 madde eklendi (module: "ticari")
// - Ticari bildirimler: org admin(ler)e gider (firma sahibi user’a değil)
// - Saat: günlük 03:30 Europe/Istanbul (mevcut mantık korunuyor)

// ✅ EK: Bireysel "Ödeme başarılı" helper eklendi (isteğine göre)

function safeRequire(paths) {
  for (const p of paths) {
    try {
      // eslint-disable-next-line import/no-dynamic-require, global-require
      return require(p);
    } catch (_) {}
  }
  return null;
}

// ⚠️ Sende şu an böyleydi: "./models/ReminderItem" ve "./services/notificationService"
// Bu yüzden path'leri KORUYORUM + yedekli deniyorum.
const ReminderItem = safeRequire([
  "./models/ReminderItem",
  "../models/ReminderItem",
  "../models/ReminderItem.js",
]);

const { createNotification } =
  safeRequire([
    "./services/notificationService",
    "../services/notificationService",
    "../services/notificationService.js",

    // ✅ projede farklı klasör isimleri olabiliyor (organizationUsers.js ile aynı yedekler)
    "../services/notification/notificationService",
    "../services/notification/notificationService.js",
    "../services/notifications/notificationService",
    "../services/notifications/notificationService.js",
  ]) || {};

// ✅ Firma modelini de yedekli bağla
const Firma = safeRequire(["./models/Firma", "../models/Firma", "../models/Firma.js"]);

// ✅ Eğitim / Abonelik modelleri sende farklı isimlerde olabilir: yedekli deniyoruz.
const EgitimModel = safeRequire([
  "./models/Egitim",
  "../models/Egitim",
  "../models/Egitim.js",
  "./models/Training",
  "../models/Training",
  "../models/Training.js",
]);

const SubscriptionModel = safeRequire([
  "./models/Subscription",
  "../models/Subscription",
  "../models/Subscription.js",
  "./models/Abonelik",
  "../models/Abonelik",
  "../models/Abonelik.js",
]);

// ✅ Profil / Kurumsal bilgi kontrolü için modeller (yedekli)
const User = safeRequire(["./models/User", "../models/User", "../models/User.js"]);
const Organization = safeRequire([
  "./models/Organization",
  "../models/Organization",
  "../models/Organization.js",
]);

/* =========================
   Helpers
   ========================= */
function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysBetween(a, b) {
  const ms = 24 * 60 * 60 * 1000;
  const A = startOfDay(a);
  const B = startOfDay(b);
  return Math.round((B - A) / ms);
}

// ✅ Istanbul timezone için "bir sonraki 03:30" timestamp’i
function getTzOffsetMinutes(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
    hour: "2-digit",
  }).formatToParts(date);
  const tz = parts.find((p) => p.type === "timeZoneName")?.value || "GMT+00:00";
  const m = tz.match(/([+-])(\d{1,2})(?::?(\d{2}))?/);
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  const hh = Number(m[2] || 0);
  const mm = Number(m[3] || 0);
  return sign * (hh * 60 + mm);
}

function getNowPartsInTz(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (t) => parts.find((p) => p.type === t)?.value;
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    second: Number(get("second")),
  };
}

function nextRunTimestamp({ hour = 3, minute = 30, timeZone = "Europe/Istanbul" } = {}) {
  const now = new Date();
  const p = getNowPartsInTz(now, timeZone);

  let targetY = p.year;
  let targetM = p.month;
  let targetD = p.day;

  const passed = p.hour > hour || (p.hour === hour && p.minute >= minute);
  if (passed) {
    const tmp = new Date(Date.UTC(targetY, targetM - 1, targetD, 12, 0, 0));
    tmp.setUTCDate(tmp.getUTCDate() + 1);
    const p2 = getNowPartsInTz(tmp, timeZone);
    targetY = p2.year;
    targetM = p2.month;
    targetD = p2.day;
  }

  const offsetMin = getTzOffsetMinutes(now, timeZone);
  const utcMillis =
    Date.UTC(targetY, targetM - 1, targetD, hour, minute, 0) - offsetMin * 60 * 1000;
  return utcMillis;
}

/* =========================
   ORTAK küçük yardımcılar (TR)
   ========================= */
function upTR(s) {
  return (s || "").toLocaleUpperCase("tr-TR");
}

function pickUserDisplayName(u) {
  const name =
    u?.name ||
    u?.fullName ||
    u?.adSoyad ||
    (u?.personal ? `${u.personal.ad || ""} ${u.personal.soyad || ""}`.trim() : "") ||
    "";
  return upTR(name || "KULLANICI");
}

function isCorporateAdmin(user) {
  const role = String(user?.role || "").toUpperCase();
  return role === "CORPORATE_ADMIN" || (role.includes("CORPORATE") && role.includes("ADMIN"));
}

// ✅ Ticari kullanıcı: org bağlantısı olan + admin olmayan
// Not: Bazı kurulumlarda alan adı farklı olabiliyor (organization, organizationId, orgId, org)
// veya sadece role üzerinden corporate user anlaşılabiliyor.
const _commercialUserCache = new Map(); // userId -> boolean
async function isCommercialUserId(userId) {
  const k = String(userId);
  if (_commercialUserCache.has(k)) return _commercialUserCache.get(k);
  if (!User) {
    _commercialUserCache.set(k, false);
    return false;
  }

  const u = await User.findById(userId)
    .select("_id organization organizationId orgId org role")
    .lean();

  const role = String(u?.role || "").toUpperCase();
  const hasOrg = Boolean(u?.organization || u?.organizationId || u?.orgId || u?.org);

  // 1) Öncelik: org bağlıysa ve admin değilse => ticari kullanıcı
  // 2) Fallback: role corporate içeriyor ama admin değilse => ticari kullanıcı
  const ok = (hasOrg || role.includes("CORPORATE")) && !isCorporateAdmin(u);
  _commercialUserCache.set(k, ok);
  return ok;
}

function isOrganizationInfoMissing(org) {
  // kurumsal kimlik min kontrol (sen isterse alanları arttırırsın)
  const name = String(org?.name || "").trim();
  const planCode = String(org?.planCode || "").trim();
  const userLimit = Number(org?.userLimit || 0);
  return !name || !planCode || !Number.isFinite(userLimit) || userLimit <= 0;
}

function getPersonNameFromTraining(t) {
  return (
    t?.personName ||
    t?.kisiAdi ||
    t?.employeeName ||
    t?.adSoyad ||
    t?.fullName ||
    t?.name ||
    (t?.meta ? t.meta.personName || t.meta.employeeName || t.meta.adSoyad : "") ||
    ""
  );
}

function validityYearsFromHazard(h) {
  const v = (h || "").toLowerCase();
  if (v.includes("çok")) return 2;
  if (v.includes("tehlikeli")) return 4;
  if (v.includes("az")) return 6;
  return 4;
}

/* =========================
   TİCARİ: admin hedefleme (org admin listesi)
   ========================= */
const _userOrgCache = new Map(); // userId -> orgId
const _orgAdminsCache = new Map(); // orgId -> [adminUserId]
const _userNameCache = new Map(); // userId -> displayName

async function getOrgIdOfUser(userId) {
  const k = String(userId);
  if (_userOrgCache.has(k)) return _userOrgCache.get(k);
  if (!User) return null;
  const u = await User.findById(userId).select("_id organization").lean();
  const orgId = u?.organization ? String(u.organization) : null;
  _userOrgCache.set(k, orgId);
  return orgId;
}

async function getOrgAdmins(orgId) {
  const k = String(orgId || "");
  if (!k) return [];
  if (_orgAdminsCache.has(k)) return _orgAdminsCache.get(k);
  if (!User) return [];
  const admins = await User.find({ organization: orgId }).select("_id role").lean();

  const list = admins.filter(isCorporateAdmin).map((a) => String(a._id));
  _orgAdminsCache.set(k, list);
  return list;
}

async function getUserName(userId) {
  const k = String(userId);
  if (_userNameCache.has(k)) return _userNameCache.get(k);
  if (!User) return "KULLANICI";
  const u = await User.findById(userId).select("_id name personal fullName adSoyad").lean();
  const nm = pickUserDisplayName(u);
  _userNameCache.set(k, nm);
  return nm;
}

/* =========================
   (BİREYSEL) Profil + Kurumsal bilgi eksik hatırlatma (haftada 1)
   Popup (link yok)
   key: welcome_remind:{userId}:{YYYY-Www}
   ========================= */
function isoWeekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function isPersonalMissing(u) {
  const p = u?.personal || {};
  const tc = String(p.tcKimlik || "").trim();
  const tel = String(p.telefon || "").trim();
  const meslek = String(p.meslek || "").trim();
  return !tc || !tel || !meslek;
}

function isOrgMissing(org) {
  if (!org) return true;
  const name = String(org.name || "").trim();
  return !name;
}

async function runProfileCorporateNudgeScan() {
  if (!createNotification || !User || !Organization) return;

  const wk = isoWeekKey(new Date());

  const users = await User.find({}).select("_id organization personal").lean();

  for (const u of users) {
    const personalMissing = isPersonalMissing(u);

    let orgMissing = false;
    if (u.organization) {
      const org = await Organization.findOne({ _id: u.organization }).select("_id name").lean();
      orgMissing = isOrgMissing(org);
    } else {
      orgMissing = true;
    }

    if (!personalMissing && !orgMissing) continue;

    const key = `welcome_remind:${String(u._id)}:${wk}`;

    await createNotification({
      userId: u._id,
      type: "time",
      module: "genel",
      title: "Hoş geldiniz 👋",
      message:
        "Paneli tam verimli kullanabilmek için kişisel bilgileriniz ve kurumsal bilgilerinizi doldurunuz.",
      severity: "info",
      link: "", // popup
      dueDate: new Date(),
      key,
    });
  }
}

/* =========================
   (TİCARİ KULLANICI) Profil + Kurumsal bilgi eksik hatırlatma (haftada 1)
   - Bireyseldeki 1. madde ile aynı içerik
   - Sadece organization'ı olan ve admin olmayan kullanıcılara gider
   Popup (link yok)
   key: ticari_user_welcome_remind:{userId}:{YYYY-Www}
   ========================= */
async function runCommercialUserProfileCorporateNudgeScan() {
  if (!createNotification || !User || !Organization) return;

  const wk = isoWeekKey(new Date());

  const users = await User.find({ organization: { $ne: null } })
    .select("_id organization personal role")
    .lean();

  for (const u of users) {
    if (isCorporateAdmin(u)) continue;

    const personalMissing = isPersonalMissing(u);

    let orgMissing = false;
    if (u.organization) {
      const org = await Organization.findOne({ _id: u.organization }).select("_id name").lean();
      orgMissing = isOrgMissing(org);
    } else {
      orgMissing = true;
    }

    if (!personalMissing && !orgMissing) continue;

    const key = `ticari_user_welcome_remind:${String(u._id)}:${wk}`;

    await createNotification({
      userId: u._id,
      type: "time",
      // UI tarafında module whitelist varsa "ticari_user" görünmeyebilir.
      // Bu yüzden ticari kullanıcıya giden bu hatırlatma "genel" altında listelensin.
      module: "genel",
      title: "Bilgiler eksik",
      message:
        "Paneli tam verimli kullanabilmek için kişisel bilgileriniz ve kurumsal bilgilerinizi doldurunuz.",
      severity: "info",
      link: "", // popup
      dueDate: new Date(),
      key,
    });
  }
}

/* =========================
   1) ReminderItem taraması (mevcut davranış korunuyor)
   ========================= */
async function runReminderScan() {
  if (!ReminderItem || !createNotification) return;

  const now = new Date();
  const items = await ReminderItem.find({ isActive: true }).lean();

  for (const item of items) {
    const due = new Date(item.dueDate);
    const d = daysBetween(now, due);
    if (d < 0) continue;

    const thresholds =
      Array.isArray(item.thresholds) && item.thresholds.length ? item.thresholds : [30, 15, 7];

    if (!thresholds.includes(d)) continue;

    const key = `reminder:${item.kind}:${item._id}:${d}`;

    await createNotification({
      userId: item.userId,
      firmId: item.firmId,
      type: "time",
      module:
        item.kind === "document_expiry"
          ? "genel"
          : item.kind === "training_renewal"
          ? "egitim"
          : item.kind === "subscription"
          ? "abonelik"
          : item.kind === "year_end_plan"
          ? "yillikPlan"
          : "genel",
      title: item.title,
      message: `${item.message} (Kalan: ${d} gün)`,
      severity: d <= 7 ? "warning" : "info",
      link: item.link || "/panel",
      dueDate: due,
      key,
    });
  }
}

/* =========================
   (TİCARİ KULLANICI) ReminderItem taraması
   - Bireyseldeki 2. madde ile aynı davranış
   - Sadece organization'ı olan ve admin olmayan kullanıcılara gider
   ========================= */
async function runCommercialUserReminderScan() {
  if (!ReminderItem || !createNotification || !User) return;

  const now = new Date();
  const items = await ReminderItem.find({ isActive: true }).lean();

  for (const item of items) {
    if (!item.userId) continue;
    // ticari kullanıcı filtresi
    // eslint-disable-next-line no-await-in-loop
    const ok = await isCommercialUserId(item.userId);
    if (!ok) continue;

    const due = new Date(item.dueDate);
    const d = daysBetween(now, due);
    if (d < 0) continue;

    const thresholds =
      Array.isArray(item.thresholds) && item.thresholds.length ? item.thresholds : [30, 15, 7];

    if (!thresholds.includes(d)) continue;

    const key = `ticari_user_reminder:${item.kind}:${item._id}:${d}`;

    await createNotification({
      userId: item.userId,
      firmId: item.firmId,
      type: "time",
      // Bireyseldeki module eşlemesiyle aynı; UI'da görünürlük için.
      module:
        item.kind === "document_expiry"
          ? "genel"
          : item.kind === "training_renewal"
          ? "egitim"
          : item.kind === "subscription"
          ? "abonelik"
          : item.kind === "year_end_plan"
          ? "yillikPlan"
          : "genel",
      title: item.title,
      message: `${item.message} (Kalan: ${d} gün)`,
      severity: d <= 7 ? "warning" : "info",
      link: item.link || "/panel",
      dueDate: due,
      key,
    });
  }
}

/* =========================
   2) Evrak süresi doluyor (Firmalar -> gecerlilik)
   Eşik: 30 / 15 / 7 / 3
   Link: /panel/firmalar
   ========================= */
async function runDocumentExpiryScan() {
  if (!Firma || !createNotification) return;

  const now = new Date();
  const thresholds = [30, 15, 7, 3];

  const firms = await Firma.find({ gecerlilik: { $ne: null } })
    .select("_id userId firmaAdi gecerlilik")
    .lean();

  for (const f of firms) {
    if (!f.userId || !f.gecerlilik) continue;

    const due = new Date(f.gecerlilik);
    const d = daysBetween(now, due);
    if (d < 0) continue;
    if (!thresholds.includes(d)) continue;

    const docType = "risk";
    const key = `doc:${String(f._id)}:${docType}:d${d}`;

    await createNotification({
      userId: f.userId,
      firmId: f._id,
      type: "time",
      module: "genel",
      title: "Evrak süresi doluyor",
      message: `${f.firmaAdi || "Firma"} evrakının süresi ${d} gün içinde dolacak.`,
      severity: d <= 7 ? "warning" : "info",
      link: "/panel/firmalar",
      dueDate: due,
      key,
    });
  }
}

/* =========================
   (TİCARİ KULLANICI) Evrak süresi doluyor (Firmalar -> gecerlilik)
   - Bireyseldeki 3. madde ile aynı eşikler
   - Sadece organization'ı olan ve admin olmayan kullanıcılara gider
   - Firma.userId ticari kullanıcı ise bildirim üretir (mevcut veri modeline uyumlu)
   Eşik: 30 / 15 / 7 / 3
   Link: /panel/firmalar
   ========================= */
async function runCommercialUserDocumentExpiryScan() {
  if (!Firma || !createNotification || !User) return;

  const now = new Date();
  const thresholds = [30, 15, 7, 3];

  const firms = await Firma.find({ gecerlilik: { $ne: null } })
    .select("_id userId firmaAdi gecerlilik")
    .lean();

  for (const f of firms) {
    if (!f.userId || !f.gecerlilik) continue;

    // eslint-disable-next-line no-await-in-loop
    const ok = await isCommercialUserId(f.userId);
    if (!ok) continue;

    const due = new Date(f.gecerlilik);
    const d = daysBetween(now, due);
    if (d < 0) continue;
    if (!thresholds.includes(d)) continue;

    const docType = "risk";
    const key = `ticari_user_doc:${String(f._id)}:${docType}:d${d}`;

    await createNotification({
      userId: f.userId,
      firmId: f._id,
      type: "time",
      module: "genel",
      title: "Evrak süresi doluyor",
      message: `${f.firmaAdi || "Firma"} evrakının süresi ${d} gün içinde dolacak.`,
      severity: d <= 7 ? "warning" : "info",
      link: "/panel/firmalar",
      dueDate: due,
      key,
    });
  }
}

/* =========================
   3) Eğitim yenileme (Model varsa)
   Eşik: 30 / 15 / 7 / 3
   Link: /panel/egitim
   ========================= */
async function runTrainingRenewalScan() {
  if (!EgitimModel || !createNotification) return;

  const now = new Date();
  const thresholds = [30, 15, 7, 3];

  const trainings = await EgitimModel.find({})
    .select("_id userId firmId egitimBitis bitisTarihi endDate tehlikeSinifi tehlike")
    .lean();

  for (const t of trainings) {
    const userId = t.userId;
    if (!userId) continue;

    const rawEnd = t.egitimBitis || t.bitisTarihi || t.endDate || t.egitimBitisTarihi || null;
    if (!rawEnd) continue;

    let hazard = t.tehlikeSinifi || t.tehlike || "";

    if ((!hazard || hazard === "") && t.firmId && Firma) {
      const f = await Firma.findById(t.firmId).select("tehlike").lean();
      hazard = f?.tehlike || hazard;
    }

    const years = validityYearsFromHazard(hazard);
    const renewalDue = new Date(rawEnd);
    renewalDue.setFullYear(renewalDue.getFullYear() + years);

    const d = daysBetween(now, renewalDue);
    if (d < 0) continue;
    if (!thresholds.includes(d)) continue;

    const firmId = t.firmId ? String(t.firmId) : "nofirm";
    const key = `train:${firmId}:${String(t._id)}:d${d}`;

    await createNotification({
      userId,
      firmId: t.firmId || undefined,
      type: "time",
      module: "egitim",
      title: "Eğitim yenileme yaklaşıyor",
      message: `Eğitim yenileme süreniz ${d} gün içinde dolacak. (Tehlike: ${hazard || "-"})`,
      severity: d <= 7 ? "warning" : "info",
      link: "/panel/egitim",
      dueDate: renewalDue,
      key,
    });
  }
}

/* =========================
   (TİCARİ KULLANICI) Eğitim yenileme (Model varsa)
   - Bireyseldeki 4. madde ile aynı eşikler
   - Sadece organization'ı olan ve admin olmayan kullanıcılara gider
   Eşik: 30 / 15 / 7 / 3
   Link: /panel/egitim
   ========================= */
async function runCommercialUserTrainingRenewalScan() {
  if (!EgitimModel || !createNotification || !User) return;

  const now = new Date();
  const thresholds = [30, 15, 7, 3];

  const trainings = await EgitimModel.find({})
    .select("_id userId firmId egitimBitis bitisTarihi endDate tehlikeSinifi tehlike")
    .lean();

  for (const t of trainings) {
    const userId = t.userId;
    if (!userId) continue;

    // eslint-disable-next-line no-await-in-loop
    const ok = await isCommercialUserId(userId);
    if (!ok) continue;

    const rawEnd = t.egitimBitis || t.bitisTarihi || t.endDate || t.egitimBitisTarihi || null;
    if (!rawEnd) continue;

    let hazard = t.tehlikeSinifi || t.tehlike || "";

    if ((!hazard || hazard === "") && t.firmId && Firma) {
      // eslint-disable-next-line no-await-in-loop
      const f = await Firma.findById(t.firmId).select("tehlike").lean();
      hazard = f?.tehlike || hazard;
    }

    const years = validityYearsFromHazard(hazard);
    const renewalDue = new Date(rawEnd);
    renewalDue.setFullYear(renewalDue.getFullYear() + years);

    const d = daysBetween(now, renewalDue);
    if (d < 0) continue;
    if (!thresholds.includes(d)) continue;

    const firmId = t.firmId ? String(t.firmId) : "nofirm";
    const key = `ticari_user_train:${firmId}:${String(t._id)}:d${d}`;

    await createNotification({
      userId,
      firmId: t.firmId || undefined,
      type: "time",
      module: "egitim",
      title: "Eğitim yenileme yaklaşıyor",
      message: `Eğitim yenileme süreniz ${d} gün içinde dolacak. (Tehlike: ${hazard || "-"})`,
      severity: d <= 7 ? "warning" : "info",
      link: "/panel/egitim",
      dueDate: renewalDue,
      key,
    });
  }
}

/* =========================
   4) Yıllık Planlar (yıl sonu)
   Referans: 31 Aralık
   Eşik: 15 / 7 / 3
   Link: /panel/yillik-planlar
   ========================= */
async function runYearEndPlansScan() {
  if (!createNotification || !Firma) return;

  const now = new Date();
  const thresholds = [15, 7, 3];

  const userIds = await Firma.distinct("userId", { userId: { $ne: null } });
  const year = now.getFullYear();
  const due = new Date(year, 11, 31);

  const d = daysBetween(now, due);
  if (d < 0) return;
  if (!thresholds.includes(d)) return;

  for (const uid of userIds) {
    const key = `plan:${year}:d${d}`;

    await createNotification({
      userId: uid,
      type: "time",
      module: "yillikPlan",
      title: "Yıllık planlar yenileme zamanı",
      message: `Yıl sonuna ${d} gün kaldı. Yıllık planlarınızı güncellemeyi unutmayın.`,
      severity: d <= 7 ? "warning" : "info",
      link: "/panel/yillik-planlar",
      dueDate: due,
      key,
    });
  }
}

/* =========================
   (TİCARİ KULLANICI) Yıllık Planlar (yıl sonu)
   - Bireyseldeki 5. madde ile aynı eşikler
   - Sadece organization'ı olan ve admin olmayan kullanıcılara gider
   - Firma.userId ticari kullanıcı ise bildirim üretir (mevcut veri modeline uyumlu)
   Referans: 31 Aralık
   Eşik: 15 / 7 / 3
   Link: /panel/yillik-planlar
   ========================= */
async function runCommercialUserYearEndPlansScan() {
  if (!createNotification || !Firma || !User) return;

  const now = new Date();
  const thresholds = [15, 7, 3];

  const userIds = await Firma.distinct("userId", { userId: { $ne: null } });
  const year = now.getFullYear();
  const due = new Date(year, 11, 31);

  const d = daysBetween(now, due);
  if (d < 0) return;
  if (!thresholds.includes(d)) return;

  for (const uid of userIds) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await isCommercialUserId(uid);
    if (!ok) continue;

    const key = `ticari_user_plan:${year}:d${d}`;

    await createNotification({
      userId: uid,
      type: "time",
      module: "yillikPlan",
      title: "Yıllık planlar yenileme zamanı",
      message: `Yıl sonuna ${d} gün kaldı. Yıllık planlarınızı güncellemeyi unutmayın.`,
      severity: d <= 7 ? "warning" : "info",
      link: "/panel/yillik-planlar",
      dueDate: due,
      key,
    });
  }
}

/* =========================
   5) Paket bitimi yaklaşıyor (BİREYSEL) (Model varsa)
   Eşik: 5 / 3 / 1
   Popup (link yok)
   ========================= */
async function runSubscriptionExpiryScan() {
  if (!SubscriptionModel || !createNotification) return;

  const now = new Date();
  const thresholds = [5, 3, 1];

  const subs = await SubscriptionModel.find({})
    .select("_id userId planId endDate bitisTarihi expiresAt")
    .lean();

  for (const s of subs) {
    const userId = s.userId;
    if (!userId) continue;

    const rawEnd = s.endDate || s.bitisTarihi || s.expiresAt || null;
    if (!rawEnd) continue;

    const due = new Date(rawEnd);
    const d = daysBetween(now, due);
    if (d < 0) continue;
    if (!thresholds.includes(d)) continue;

    const planId = s.planId ? String(s.planId) : "plan";
    const key = `sub_expiry:${planId}:d${d}`;

    await createNotification({
      userId,
      type: "time",
      module: "abonelik",
      title: "Paket bitiyor",
      message: `Paketinizin bitmesine ${d} gün kaldı.`,
      severity: d <= 3 ? "warning" : "info",
      link: "", // popup
      dueDate: due,
      key,
    });
  }
}

/* =========================================================
   ✅✅ BİREYSEL: Ödeme başarılı helper (EKLENDİ)
   module: "abonelik"
   Popup
   ========================================================= */
async function notifyPersonalPaymentSuccess({
  userId,
  endDate,
  paymentId = "",
  message = "",
}) {
  if (!createNotification) return;
  if (!userId) return;

  const due = endDate ? new Date(endDate) : null;

  await createNotification({
    userId,
    type: "event",
    module: "abonelik",
    title: "Ödeme başarılı ✅",
    message:
      message ||
      `Ödemeniz başarıyla alınmıştır.${due ? ` Bitiş tarihi: ${due.toLocaleDateString("tr-TR")}` : ""}`,
    severity: "info",
    link: "", // popup
    dueDate: new Date(),
    key: `personal_payment_success:${String(userId)}:${String(paymentId || "v1")}`,
  });
}

/* =========================================================
   ✅✅ TİCARİ ADMIN BİLDİRİMLERİ (6 MADDE)
   module: "ticari"
   ========================================================= */

/**
 * Ticari hedef kuralı:
 * - Firma/Training gibi şeyler "userId" üzerinden org bulunur
 * - Bildirimler o org’un admin(ler)ine gider
 */

async function notifyToOrgAdmins({ orgId, payload, keyBase }) {
  if (!createNotification) return;
  const adminIds = await getOrgAdmins(orgId);
  for (const adminId of adminIds) {
    await createNotification({
      ...payload,
      userId: adminId,
      module: "ticari",
      // key’i admin bazlı yap ki çakışma olmasın
      key: `${keyBase}:admin:${String(adminId)}`,
    });
  }
}

/* 1) Hoşgeldiniz: Kurumsal kimlik doldur (YÖNLENDİRME VAR) */
async function runWelcomeCorporateIdentityScan() {
  if (!createNotification || !Organization || !User) return;

  const orgs = await Organization.find({ status: { $in: ["active", "pending-payment"] } })
    .select("_id name planCode userLimit status")
    .lean();

  for (const org of orgs) {
    if (!isOrganizationInfoMissing(org)) continue;

    const admins = await User.find({ organization: org._id }).select("_id role").lean();
    const adminIds = admins.filter(isCorporateAdmin).map((a) => String(a._id));

    for (const adminId of adminIds) {
      await createNotification({
        userId: adminId,
        type: "event",
        module: "ticari",
        title: "Hoş geldiniz 👋",
        message: "Lütfen kurumsal kimlik bilgilerinizi doldurunuz.",
        severity: "info",
        link: "/ticari/admin/kurumsal-kimlik", // ✅ sadece burada yönlendirme var
        dueDate: new Date(),
        key: `corp_welcome_kimlik:v1:${String(org._id)}:admin:${adminId}`,
      });
    }
  }
}

/* 2) Ödeme başarılı/başarısız helper (webhook’tan çağırmak için) */
async function notifyCorporatePaymentStatus({
  userId,
  organizationId,
  success,
  endDate,
  paymentId = "",
}) {
  if (!createNotification) return;
  if (!userId) throw new Error("notifyCorporatePaymentStatus: userId zorunlu");

  const ok = Boolean(success);
  const due = endDate ? new Date(endDate) : null;

  await createNotification({
    userId,
    type: "event",
    module: "ticari",
    title: ok ? "Ödeme başarılı ✅" : "Ödeme başarısız ❌",
    message: ok
      ? `Ödemeniz başarıyla alınmıştır.${due ? ` Bitiş tarihi: ${due.toLocaleDateString("tr-TR")}` : ""}`
      : "Ödeme alınamadı / başarısız.",
    severity: ok ? "info" : "warning",
    link: "", // ❌ yönlendirme yok
    dueDate: new Date(),
    key: `corp_payment:${String(organizationId || "org")}:${String(paymentId || "v1")}:${ok ? "ok" : "fail"}`,
  });
}

/* 2b) Abonelik bitecek (TİCARİ) 5/3/1 (YÖNLENDİRME YOK) */
async function runCorporateSubscriptionExpiryScan() {
  if (!createNotification || !Organization) return;

  const now = new Date();
  const thresholds = [5, 3, 1];

  const orgs = await Organization.find({ subscriptionEnd: { $ne: null } })
    .select("_id subscriptionEnd")
    .lean();

  for (const org of orgs) {
    const due = org.subscriptionEnd ? new Date(org.subscriptionEnd) : null;
    if (!due) continue;

    const d = daysBetween(now, due);
    if (d < 0) continue;
    if (!thresholds.includes(d)) continue;

    await notifyToOrgAdmins({
      orgId: org._id,
      keyBase: `corp_sub_end:${String(org._id)}:d${d}`,
      payload: {
        type: "time",
        title: "Abonelik bitiyor",
        message: `Aboneliğinizin bitmesine ${d} gün kaldı.`,
        severity: d <= 3 ? "warning" : "info",
        link: "", // ❌
        dueDate: due,
      },
    });
  }
}

/* 3) X kullanıcı Y firmasını ekledi (YÖNLENDİRME YOK) */
async function runCorporateFirmCreatedScan() {
  if (!createNotification || !Firma || !User) return;

  const since = new Date(Date.now() - 48 * 60 * 60 * 1000);

  const firms = await Firma.find({ createdAt: { $gte: since } })
    .select("_id userId firmaAdi createdAt")
    .lean();

  for (const f of firms) {
    if (!f?._id || !f?.userId) continue;

    const orgId = await getOrgIdOfUser(f.userId);
    if (!orgId) continue;

    const userName = await getUserName(f.userId);

    await notifyToOrgAdmins({
      orgId,
      keyBase: `corp_firma_created:${String(f._id)}`,
      payload: {
        firmId: f._id,
        type: "event",
        title: "Firma eklendi",
        message: `${userName} kullanıcısı ${upTR(f.firmaAdi || "FİRMA")} firmasını ekledi.`,
        severity: "info",
        link: "", // ❌
        dueDate: f.createdAt ? new Date(f.createdAt) : new Date(),
      },
    });
  }
}

/* 4) X kullanıcının Y firması evrakları yaklaştı/geçti (YÖNLENDİRME YOK) */
async function runCorporateFirmDocumentDueScan() {
  if (!createNotification || !Firma || !User) return;

  const now = new Date();
  const thresholds = [30, 15, 7, 3];

  const firms = await Firma.find({ gecerlilik: { $ne: null } })
    .select("_id userId firmaAdi gecerlilik")
    .lean();

  for (const f of firms) {
    if (!f?.userId || !f?.gecerlilik) continue;

    const orgId = await getOrgIdOfUser(f.userId);
    if (!orgId) continue;

    const userName = await getUserName(f.userId);
    const due = new Date(f.gecerlilik);
    const d = daysBetween(now, due);

    // yaklaşıyor
    if (d >= 0 && thresholds.includes(d)) {
      await notifyToOrgAdmins({
        orgId,
        keyBase: `corp_firma_doc:upcoming:${String(f._id)}:d${d}`,
        payload: {
          firmId: f._id,
          type: "time",
          title: "Firma evrakları yaklaşıyor",
          message: `${userName} kullanıcısının ${upTR(
            f.firmaAdi || "FİRMA"
          )} firması evrakları ${d} gün içinde dolacak.`,
          severity: d <= 7 ? "warning" : "info",
          link: "", // ❌
          dueDate: due,
        },
      });
      continue;
    }

    // geçti (1 kez)
    if (d < 0) {
      await notifyToOrgAdmins({
        orgId,
        keyBase: `corp_firma_doc:overdue:${String(f._id)}:v1`,
        payload: {
          firmId: f._id,
          type: "time",
          title: "Firma evrakları geçti",
          message: `${userName} kullanıcısının ${upTR(
            f.firmaAdi || "FİRMA"
          )} firması evraklarının süresi geçti.`,
          severity: "critical",
          link: "", // ❌
          dueDate: due,
        },
      });
    }
  }
}

/* 5) X kullanıcının Y firmasının Z kişisinin eğitimi yaklaştı/geçti (YÖNLENDİRME YOK) */
async function runCorporatePersonTrainingDueScan() {
  if (!createNotification || !EgitimModel || !User) return;

  const now = new Date();
  const thresholds = [30, 15, 7, 3];

  const trainings = await EgitimModel.find({})
    .select(
      "_id userId firmId personId personName kisiAdi employeeName adSoyad name fullName meta " +
        "egitimBitis bitisTarihi endDate egitimBitisTarihi tehlikeSinifi tehlike"
    )
    .lean();

  for (const t of trainings) {
    const userId = t?.userId;
    if (!userId) continue;

    const orgId = await getOrgIdOfUser(userId);
    if (!orgId) continue;

    const userName = await getUserName(userId);

    const rawEnd = t.egitimBitis || t.bitisTarihi || t.endDate || t.egitimBitisTarihi || null;
    if (!rawEnd) continue;

    // firma adı/hazard gerekiyorsa firmadan çek
    let firmName = "FİRMA";
    let hazard = t.tehlikeSinifi || t.tehlike || "";
    if (t.firmId && Firma) {
      const f = await Firma.findById(t.firmId).select("_id firmaAdi tehlike").lean();
      firmName = upTR(f?.firmaAdi || firmName);
      if (!hazard && f?.tehlike) hazard = f.tehlike;
    }

    const years = validityYearsFromHazard(hazard);
    const renewalDue = new Date(rawEnd);
    renewalDue.setFullYear(renewalDue.getFullYear() + years);

    const d = daysBetween(now, renewalDue);

    const personNameRaw = getPersonNameFromTraining(t);
    const personName = upTR(personNameRaw || "ÇALIŞAN");
    const firmIdStr = t.firmId ? String(t.firmId) : "nofirm";

    if (d >= 0 && thresholds.includes(d)) {
      await notifyToOrgAdmins({
        orgId,
        keyBase: `corp_train:upcoming:${firmIdStr}:${String(t._id)}:d${d}`,
        payload: {
          firmId: t.firmId || undefined,
          type: "time",
          title: "Eğitim yaklaşıyor",
          message: `${userName} kullanıcısının ${firmName} firmasının ${personName} kişisinin eğitimi ${d} gün içinde dolacak.`,
          severity: d <= 7 ? "warning" : "info",
          link: "", // ❌
          dueDate: renewalDue,
        },
      });
      continue;
    }

    if (d < 0) {
      await notifyToOrgAdmins({
        orgId,
        keyBase: `corp_train:overdue:${firmIdStr}:${String(t._id)}:v1`,
        payload: {
          firmId: t.firmId || undefined,
          type: "time",
          title: "Eğitim geçti",
          message: `${userName} kullanıcısının ${firmName} firmasının ${personName} kişisinin eğitim süresi geçti.`,
          severity: "critical",
          link: "", // ❌
          dueDate: renewalDue,
        },
      });
    }
  }
}

/* 6) 15 Aralık’tan sonra yıllık planlar yaklaşıyor (15/7/3) (YÖNLENDİRME YOK) */
async function runCorporateAnnualPlansScan() {
  if (!createNotification || !Firma || !User) return;

  const now = new Date();
  const m = now.getMonth() + 1;
  const dday = now.getDate();
  if (!(m === 12 && dday >= 15)) return;

  const thresholds = [15, 7, 3];
  const year = now.getFullYear();
  const due = new Date(year, 11, 31);
  const left = daysBetween(now, due);

  if (left < 0) return;
  if (!thresholds.includes(left)) return;

  // Firmaları gez -> org bul -> o org admin(ler)ine bildir
  const firms = await Firma.find({ userId: { $ne: null } })
    .select("_id userId firmaAdi")
    .lean();

  for (const f of firms) {
    if (!f?.userId) continue;

    const orgId = await getOrgIdOfUser(f.userId);
    if (!orgId) continue;

    const userName = await getUserName(f.userId);

    await notifyToOrgAdmins({
      orgId,
      keyBase: `corp_plan:${year}:${String(f._id)}:d${left}`,
      payload: {
        firmId: f._id,
        type: "time",
        title: "Yıllık planlar yaklaşıyor",
        message: `${userName} kullanıcısının ${upTR(
          f.firmaAdi || "FİRMA"
        )} firması için yıllık planlar yaklaşıyor. (Kalan: ${left} gün)`,
        severity: left <= 7 ? "warning" : "info",
        link: "", // ❌
        dueDate: due,
      },
    });
  }
}

/* =========================================================
   ✅✅ TİCARİ USER (ANLIK) BİLDİRİM HELPER'LARI
   module: "ticari_user"
   - Atama/çıkarma endpoint'inden çağırılacak (scheduler scan değil)
   ========================================================= */

// =========================================================
// ✅ TİCARİ KULLANICI (EVENT): Admin firma atadı / çıkardı
// - actorName: işlemi yapan admin adı
// - actionId: aynı firmaya tekrar işlem yapılınca da bildirim düşsün diye
//   (yoksa Date.now() ile uniq key üretir)
// =========================================================

async function notifyCommercialUserFirmAssigned({
  userId,
  firmId,
  firmName = "",
  actorName = "",
  actionId = "",
}) {
  if (!createNotification) return;
  if (!userId) return;

  const actor = upTR(actorName || "ADMIN");
  const uniq = String(actionId || Date.now());
  const key = `ticari_user_firm_assigned:${String(firmId || "nofirm")}:${String(userId)}:${uniq}`;

  await createNotification({
    userId,
    firmId: firmId || undefined,
    type: "event",
    module: "genel",
    title: "Firma ataması yapıldı",
    message: `${actor}, ${upTR(firmName || "FİRMA")} firmasını size atadı.`,
    severity: "info",
    link: "", // yönlendirme yok (popup)
    dueDate: new Date(),
    key,
  });
}

async function notifyCommercialUserFirmRemoved({
  userId,
  firmId,
  firmName = "",
  actorName = "",
  actionId = "",
}) {
  if (!createNotification) return;
  if (!userId) return;

  const actor = upTR(actorName || "ADMIN");
  const uniq = String(actionId || Date.now());
  const key = `ticari_user_firm_removed:${String(firmId || "nofirm")}:${String(userId)}:${uniq}`;

  await createNotification({
    userId,
    firmId: firmId || undefined,
    type: "event",
    module: "genel",
    title: "Firma ataması düşürüldü",
    message: `${actor}, ${upTR(firmName || "FİRMA")} firmasını üzerinizden çıkardı.`,
    severity: "warning",
    link: "", // yönlendirme yok (popup)
    dueDate: new Date(),
    key,
  });
}

/* =========================
   RUN ALL SCANS (TEK NOKTA)
   ========================= */
async function runAllScans() {
  // BİREYSEL (mevcut)
  await runReminderScan().catch(() => {});
  await runDocumentExpiryScan().catch(() => {});
  await runTrainingRenewalScan().catch(() => {});
  await runYearEndPlansScan().catch(() => {});
  await runSubscriptionExpiryScan().catch(() => {});
  await runProfileCorporateNudgeScan().catch(() => {});

  // TİCARİ (kullanıcı) ✅ yeni: bireyseldeki 1-5 maddeleri
  await runCommercialUserProfileCorporateNudgeScan().catch(() => {});
  await runCommercialUserReminderScan().catch(() => {});
  await runCommercialUserDocumentExpiryScan().catch(() => {});
  await runCommercialUserTrainingRenewalScan().catch(() => {});
  await runCommercialUserYearEndPlansScan().catch(() => {});

  // TİCARİ (admin)
  await runWelcomeCorporateIdentityScan().catch(() => {});
  await runCorporateSubscriptionExpiryScan().catch(() => {});
  await runCorporateFirmCreatedScan().catch(() => {});
  await runCorporateFirmDocumentDueScan().catch(() => {});
  await runCorporatePersonTrainingDueScan().catch(() => {});
  await runCorporateAnnualPlansScan().catch(() => {});
}

/* =========================
   START SCHEDULER (03:30 Europe/Istanbul)
   ========================= */
function startScheduler() {
  // ✅ Server açılınca 20sn sonra 1 kez tarama (dev için güzel)
  setTimeout(() => runAllScans().catch(() => {}), 20_000);

  const timeZone = "Europe/Istanbul";

  const scheduleNext = () => {
    const ts = nextRunTimestamp({ hour: 3, minute: 30, timeZone });
    const delay = Math.max(1000, ts - Date.now());

    setTimeout(async () => {
      await runAllScans().catch(() => {});
      scheduleNext();
    }, delay);
  };

  scheduleNext();

  console.log("✅ Notification scheduler started (daily @ 03:30 Europe/Istanbul).");
}

module.exports = {
  startScheduler,

  // bireysel exports (mevcut)
  runReminderScan,
  runAllScans,
  runDocumentExpiryScan,
  runTrainingRenewalScan,
  runYearEndPlansScan,
  runSubscriptionExpiryScan,
  runProfileCorporateNudgeScan,

  // ✅ bireysel ödeme helper
  notifyPersonalPaymentSuccess,

  // ticari exports (test / webhook / manuel)
  runWelcomeCorporateIdentityScan,
  runCorporateSubscriptionExpiryScan,
  runCorporateFirmCreatedScan,
  runCorporateFirmDocumentDueScan,
  runCorporatePersonTrainingDueScan,
  runCorporateAnnualPlansScan,
  notifyCorporatePaymentStatus,

  // ticari user exports (event)
  notifyCommercialUserFirmAssigned,
  notifyCommercialUserFirmRemoved,

  // ticari user scans (yeni: bireyseldeki 1-5)
  runCommercialUserProfileCorporateNudgeScan,
  runCommercialUserReminderScan,
  runCommercialUserDocumentExpiryScan,
  runCommercialUserTrainingRenewalScan,
  runCommercialUserYearEndPlansScan,
};
