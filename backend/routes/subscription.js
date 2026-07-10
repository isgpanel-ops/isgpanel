// backend/routes/subscription.js
const express = require("express");
console.log("✅ SUBSCRIPTION ROUTE LOADED");

const auth = require("../middleware/auth");
const Subscription = require("../models/Subscription");
const Organization = require("../models/Organization");
const User = require("../models/User"); // ✅ eklendi
const mongoose = require("mongoose");

// ✅ "YYYY-MM-DD" gelirse timezone sapmasın diye local öğlen parse et
function parseDateSafe(v) {
  if (!v) return null;

  // Date ise
  if (v instanceof Date) {
    return Number.isNaN(v.getTime()) ? null : v;
  }

  const s = String(v);

  // date-only: 2026-02-26
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  // ISO / diğer
  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

// ✅ TAM TIMESTAMP (saat korunur)
const nowISO = () => new Date().toISOString();

// ✅ saat + dakika + saniye korunur
function addDaysISO(iso, days) {
  const d = iso ? new Date(iso) : new Date();
  d.setTime(d.getTime() + Number(days || 0) * 24 * 60 * 60 * 1000);
  return d.toISOString();
}

// ✅ startDate + endDate üzerinden net period hesapla (Date ya da string kabul)
function computePeriodFromDuration(startVal, endVal) {
  if (!startVal || !endVal) return "Aylık";
  const s = startVal instanceof Date ? startVal : new Date(startVal);
  const e = endVal instanceof Date ? endVal : new Date(endVal);
  const days = Math.ceil((e - s) / (1000 * 60 * 60 * 24));
  return days >= 300 ? "Yıllık" : "Aylık";
}

// Bireysel paketler (şimdilik sabit)
const INDIVIDUAL_PLANS = [
  {
    id: "bireysel_standart",
    name: "Bireysel (Standart)",
    monthlyExVat: 300,
    yearlyExVat: 3000,
    note: "Tek uzmanlar için ideal • 1 kullanıcı",
    features: ["Sınırsız firma", "Tüm modüllere erişim", "Hızlı kurulum & onboarding"],
  },
];

// Ticari/Kurumsal paketler
const CORPORATE_PLANS = [
  {
    id: "ticari_5",
    name: "Ticari (Max 5 Kullanıcı)",
    users: "1–5 kullanıcı",
    monthlyExVat: 2000,
    yearlyExVat: 2000 * 10,
    note: "Küçük ekipler için",
    badge: null,
    features: ["Sınırsız firma", "Tüm modüllere erişim", "Hızlı kurulum & onboarding"],
  },
  {
    id: "ticari_10",
    name: "Ticari (Max 10 Kullanıcı)",
    users: "6–10 kullanıcı",
    monthlyExVat: 3500,
    yearlyExVat: 3500 * 10,
    note: "Büyüyen ekipler için",
    badge: "Popüler",
    features: ["Sınırsız firma", "Tüm modüllere erişim", "Hızlı kurulum & onboarding"],
  },
  {
    id: "ticari_15",
    name: "Ticari (Max 15 Kullanıcı)",
    users: "11–15 kullanıcı",
    monthlyExVat: 5000,
    yearlyExVat: 5000 * 10,
    note: "Geniş ekipler için",
    badge: null,
    features: ["Sınırsız firma", "Tüm modüllere erişim", "Hızlı kurulum & onboarding"],
  },
  {
    id: "prof-ozel",
    name: "Kurumsal Özel",
    users: "15+ kullanıcı",
    monthlyExVat: 0,
    yearlyExVat: 0,
    note: "15+ kullanıcı için teklif bazlı özel plan",
    badge: "Özel",
    features: ["Sınırsız firma", "Tüm modüllere erişim", "Hızlı kurulum & onboarding"],
  },
];

function isCorporate(req) {
  const role = (req.user?.role || "").toString();
  return (
    role === "CORPORATE_ADMIN" ||
    role === "CORPORATE_USER" ||
    role === "ticari_admin" ||
    role === "ticari_user"
  );
}

function canEditCorporate(req) {
  return (req.user?.role || "") === "CORPORATE_ADMIN";
}

// ✅ (UI ile aynı) usersCount → planId
function mapUsersCountToPlanId(usersCount) {
  const n = Number(usersCount || 0);
  if (!n) return "ticari_5";
  if (n <= 5) return "ticari_5";
  if (n <= 10) return "ticari_10";
  if (n <= 15) return "ticari_15";
  return "prof-ozel";
}

// ✅ plan normalize (node uyumlu)
function normalizePlanId(v) {
  const x = String(v || "").trim();
  if (!x) return "";

  if (x === "kurumsal_ozel" || x === "kurumsal-ozel") return "prof-ozel";

  if (x === "ticari-1-3" || x === "ticari_1_3") return "ticari_5";
  if (x === "ticari-4-5" || x === "ticari_4_5") return "ticari_5";
  if (x === "ticari-6-10" || x === "ticari_6_10") return "ticari_10";

  if (x === "prof_ozel") return "prof-ozel";

  return x.replaceAll("-", "_");
}

// ✅ UI id eşleşmesi için alias plan listesi üret (res.json içine const koymamak için burada fonksiyon)
function buildCorporatePlansWithAliases() {
  const clones = [];
  for (const p of CORPORATE_PLANS) {
    clones.push(p);

    // ticari-6-10 -> ticari_6_10
    const under = String(p.id).split("-").join("_");
    if (under !== p.id) clones.push({ ...p, id: under });

    // prof-ozel için eski isimler
    if (p.id === "prof-ozel") {
      clones.push({ ...p, id: "kurumsal_ozel" });
      clones.push({ ...p, id: "kurumsal-ozel" });
    }
  }
  const uniq = new Map();
  for (const x of clones) uniq.set(x.id, x);
  return Array.from(uniq.values());
}

/**
 * Factory route: pgPool server.js’ten gelir
 */
module.exports = function subscriptionRoutes(pgPool) {
  const router = express.Router();

  async function readOfferAmountTRY(pgPool, orgUuid) {
    if (!pgPool || !orgUuid) return 0;

    const colsRes = await pgPool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'offers'`
    );
    const cols = colsRes.rows.map((r) => r.column_name);
    const pick = (...names) => names.find((n) => cols.includes(n));

    const orgCol = pick("accepted_org_id", "organization_id", "org_id", "company_id");
    const priceCol = pick("price_try", "price", "amount", "total");
    const createdCol = pick("created_at", "createdAt");

    if (!orgCol || !priceCol) return 0;

    const orderBy = createdCol ? `ORDER BY ${createdCol} DESC` : "";
    const q = `SELECT ${priceCol} AS price FROM offers WHERE ${orgCol} = $1 ${orderBy} LIMIT 1`;

    const r = await pgPool.query(q, [orgUuid]);
    return Math.round(Number(r.rows?.[0]?.price || 0));
  }

async function readOfferDurationDays(pgPool, orgUuid) {
  if (!pgPool || !orgUuid) return 0;

  try {
    const colsRes = await pgPool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'offers'`
    );
    const cols = colsRes.rows.map((r) => r.column_name);
    const pick = (...names) => names.find((n) => cols.includes(n));

    const orgCol = pick("accepted_org_id", "organization_id", "org_id", "company_id");
    const durationCol = pick("duration_days", "durationDays", "pilot_days");

    // ✅ Yıllık bilgisini yakalamak için olası kolonlar
    const periodCol = pick("billing_period", "period", "plan_period");
    const isYearlyCol = pick("is_yearly", "yearly", "is_year", "annual");

    if (!orgCol) return 0;

    // ✅ duration yoksa bile yıllık kolonu varsa 365'e çevirebileceğiz
    const selectParts = [];
    if (durationCol) selectParts.push(`${durationCol} AS duration`);
    if (periodCol) selectParts.push(`${periodCol} AS period`);
    if (isYearlyCol) selectParts.push(`${isYearlyCol} AS is_yearly`);

    if (selectParts.length === 0) return 0;

    const q = `
      SELECT ${selectParts.join(", ")}
      FROM offers
      WHERE ${orgCol} = $1
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const r = await pgPool.query(q, [orgUuid]);
    const row = r.rows?.[0] || {};

    const days = Number(row.duration || 0);

    // ✅ 1) duration_days varsa onu kullan
    if (Number.isFinite(days) && days > 0) return days;

    // ✅ 2) duration yoksa: period/is_yearly alanlarından yıllık yakala → 365
    const periodRaw = (row.period || "").toString().toLowerCase().trim();
    const isYearlyRaw = row.is_yearly;

    const isYearly =
      periodRaw === "yearly" ||
      periodRaw === "annual" ||
      periodRaw === "yillik" ||
      periodRaw === "yıllık" ||
      isYearlyRaw === true ||
      isYearlyRaw === 1 ||
      isYearlyRaw === "1" ||
      (typeof isYearlyRaw === "string" && isYearlyRaw.toLowerCase() === "true");

    return isYearly ? 365 : 0;
  } catch (e) {
    console.error("readOfferDurationDays error:", e);
    return 0;
  }
}



  // ✅ Pilot başlangıcı: created_at değil accepted_at (kayıt anı) öncelikli
  async function readOfferAcceptedStart(pgPool, orgUuid) {
    if (!pgPool || !orgUuid) return null;

    try {
      const colsRes = await pgPool.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'offers'`
      );
      const cols = colsRes.rows.map((r) => r.column_name);
      const pick = (...names) => names.find((n) => cols.includes(n));

      const orgCol = pick("accepted_org_id", "organization_id", "org_id", "company_id");
      const acceptedCol = pick("accepted_at", "acceptedAt");
      const createdCol = pick("created_at", "createdAt");

      if (!orgCol) return null;

      // accepted_at yoksa created_at fallback
      const dateCol = acceptedCol || createdCol;
      if (!dateCol) return null;

      const orderBy = (acceptedCol || createdCol) ? `ORDER BY ${dateCol} DESC` : "";
      const q = `SELECT ${dateCol} AS dt FROM offers WHERE ${orgCol} = $1 ${orderBy} LIMIT 1`;

      const r = await pgPool.query(q, [orgUuid]);
      const dt = parseDateSafe(r.rows?.[0]?.dt);
      return dt || null;
    } catch (e) {
      console.error("readOfferAcceptedStart error:", e);
      return null;
    }
  }

  async function getOrCreateSubscription(req) {
    if (isCorporate(req)) {
      let orgId = req.user.organizationId;
      if (!orgId) throw new Error("organizationId bulunamadı (token/user).");

      // orgId UUID ise -> Mongo _id’ye çevir
      if (!mongoose.Types.ObjectId.isValid(String(orgId))) {
        const orgByUuid = await Organization.findOne({ uuid: String(orgId) })
          .select("_id uuid planCode userLimit subscriptionEnd pilotEnabled pilotStartAt pilotEndAt status")
          .lean();
        if (!orgByUuid?._id) throw new Error("Organization UUID bulundu ama Mongo _id yok.");
        orgId = orgByUuid._id;
      }

      // ✅ org artık kesin Mongo ObjectId
      let org = await Organization.findById(orgId)
        .select("_id uuid planCode userLimit subscriptionEnd pilotEnabled pilotStartAt pilotEndAt status")
        .lean();

      if (!org) throw new Error("Organization bulunamadı.");

      // ✅ sub doğru aranır
      let sub = await Subscription.findOne({
        organizationId: org._id,
        planType: "CORPORATE",
      });

      // ✅ org pilot alanlarını artık esas alıyoruz
      const orgStartDate = parseDateSafe(org?.pilotStartAt);
      const orgEndDate = parseDateSafe(org?.pilotEndAt) || parseDateSafe(org?.subscriptionEnd); // geriye uyum

      // ✅ pilot başlangıcı + gün (offers’tan)
      let offerStartDate = null;
      let pilotDays = 0;

      if ((!orgStartDate || !orgEndDate) && org?.uuid && pgPool) {
        try {
          pilotDays = await readOfferDurationDays(pgPool, org.uuid);
          offerStartDate = await readOfferAcceptedStart(pgPool, org.uuid); // ✅ accepted_at öncelikli

          console.log("PILOT DEBUG =>", {
            orgUuid: org.uuid,
            orgStartDate,
            orgEndDate,
            offerStartDate,
            pilotDays,
          });
        } catch (e) {
          console.error("Pilot duration/start read error:", e);
        }
      }

      // ✅ startDate öncelik:
      // 1) org.pilotStartAt
      // 2) offer.accepted_at (yoksa created_at)
      // 3) sub.startDate
      // 4) now
      const baseStartDate =
        orgStartDate ||
        offerStartDate ||
        parseDateSafe(sub?.startDate) ||
        new Date();

      // ✅ endDate öncelik:
      // 1) org.pilotEndAt / org.subscriptionEnd
      // 2) offer durationDays
      // 3) sub.endDate
      // 4) fallback 30 gün
      const computedFromOffer =
        pilotDays > 0
          ? new Date(baseStartDate.getTime() + pilotDays * 24 * 60 * 60 * 1000)
          : null;

      const baseEndDate =
  orgEndDate ||
  computedFromOffer ||
  parseDateSafe(sub?.endDate) ||
  null;

      // ✅ Kritik: org’da pilot yok ama offerDays varsa -> org’u pilotStart/End ile SENKRONLA (sayaç kökten düzelir)
     const resolvedPlanIdForSync = normalizePlanId(org?.planCode) || normalizePlanId(sub?.currentPlanId);
const isProfOzel = resolvedPlanIdForSync === "prof-ozel";

// ✅ prof-ozel’de “pilot sync” yapma
if ((!orgStartDate || !orgEndDate) && pilotDays > 0 && !isProfOzel) {
  try {
    const orgDoc = await Organization.findById(org._id);
    if (orgDoc) {
      let changedOrg = false;

      if (!orgDoc.pilotStartAt || new Date(orgDoc.pilotStartAt).getTime() !== baseStartDate.getTime()) {
        orgDoc.pilotStartAt = baseStartDate;
        changedOrg = true;
      }

      if (!orgDoc.pilotEndAt || new Date(orgDoc.pilotEndAt).getTime() !== baseEndDate.getTime()) {
        orgDoc.pilotEndAt = baseEndDate;
        changedOrg = true;
      }

      if (orgDoc.pilotEnabled !== true) {
        orgDoc.pilotEnabled = true;
        changedOrg = true;
      }

      if (!orgDoc.subscriptionEnd || new Date(orgDoc.subscriptionEnd).getTime() !== baseEndDate.getTime()) {
        orgDoc.subscriptionEnd = baseEndDate;
        changedOrg = true;
      }

      if (orgDoc.status !== "active") {
        orgDoc.status = "active";
        changedOrg = true;
      }

      if (changedOrg) await orgDoc.save();

      org = await Organization.findById(org._id)
        .select("_id uuid planCode userLimit subscriptionEnd pilotEnabled pilotStartAt pilotEndAt status")
        .lean();
    }
  } catch (e) {
    console.error("ORG PILOT SYNC error:", e);
  }
}

      // ✅ orgEnd yokken pilotDays varsa sub.start/end’i güncelle (30 günde kalmasın)
      if (!orgEndDate && pilotDays > 0 && sub) {
        let changed = false;

        if (!sub.startDate || new Date(sub.startDate).getTime() !== baseStartDate.getTime()) {
          sub.startDate = baseStartDate;
          changed = true;
        }

        const subEnd = parseDateSafe(sub?.endDate);
        const shouldEndSync = !subEnd || subEnd.getTime() !== baseEndDate.getTime();
        if (shouldEndSync) {
          sub.endDate = baseEndDate;
          changed = true;
        }

        if (changed) {
          sub.period = computePeriodFromDuration(sub.startDate, sub.endDate);
          await sub.save();
        }
      }

      const desiredUsersCount = Number(org?.userLimit || sub?.usersCount || 1);

      const desiredPlanId =
        normalizePlanId(org?.planCode) ||
        normalizePlanId(sub?.currentPlanId) ||
        mapUsersCountToPlanId(desiredUsersCount) ||
        "ticari-1-3";

      const desiredPeriod = computePeriodFromDuration(baseStartDate, baseEndDate);

      if (!sub) {
  const orgStatus = String(org?.status || "").toLowerCase();
  const hasRealEnd = !!baseEndDate;

  // ✅ ödeme yoksa 30 günlük sahte abonelik oluşturma
  if (!hasRealEnd && orgStatus === "pending-payment") {
    return {
      sub: {
        currentPlanId: desiredPlanId || "ticari-1-3",
        usersCount: desiredUsersCount,
        period: "Aylık",
        autoRenew: true,
        showVatIncluded: false,
        startDate: null,
        endDate: null,
        paymentBrand: "VISA",
        paymentLast4: "1234",
        paymentHolder: "",
        invoices: [],
      },
      org,
    };
  }

  sub = await Subscription.create({
    organizationId: org._id,
    planType: "CORPORATE",
    currentPlanId: desiredPlanId || "ticari-1-3",
    usersCount: desiredUsersCount,
    period: desiredPeriod,
    startDate: baseStartDate,
    endDate: baseEndDate,
  });

  return { sub, org };
}

      let changed = false;

      if (desiredPlanId && sub.currentPlanId !== desiredPlanId) {
        sub.currentPlanId = desiredPlanId;
        changed = true;
      }

      if (Number.isFinite(desiredUsersCount) && desiredUsersCount > 0 && sub.usersCount !== desiredUsersCount) {
        sub.usersCount = desiredUsersCount;
        changed = true;
      }

      if (!sub.currentPlanId) {
        sub.currentPlanId = "ticari-1-3";
        changed = true;
      }

    // ✅ Öncelik her zaman gerçek subscription end'de olsun
// pilot sadece gerçekten pilot aktifse devreye girsin
const pilotStillActive =
  org?.pilotEnabled === true &&
  parseDateSafe(org?.pilotEndAt) &&
  parseDateSafe(org?.pilotEndAt).getTime() > Date.now();

const lockEnd = pilotStillActive
  ? parseDateSafe(org?.pilotEndAt)
  : parseDateSafe(org?.subscriptionEnd);

if (lockEnd) {
  const currEnd = parseDateSafe(sub?.endDate);
  const baseEnd = parseDateSafe(baseEndDate);

  // ✅ büyük olanı kullan
  const effectiveEnd =
    baseEnd && baseEnd.getTime() > lockEnd.getTime() ? baseEnd : lockEnd;

  if (!currEnd || currEnd.getTime() !== effectiveEnd.getTime()) {
    sub.endDate = effectiveEnd;
    sub.period = computePeriodFromDuration(sub.startDate, effectiveEnd);
    changed = true;
  }
}

      // corporate: period’i start/end’e göre güncel tut
      const computed = computePeriodFromDuration(sub.startDate, sub.endDate);
      if (sub.period !== computed) {
        sub.period = computed;
        changed = true;
      }

      if (changed) await sub.save();
      return { sub, org };
    }
// INDIVIDUAL
const userId = req.user.id;

let sub = await Subscription.findOne({ userId, planType: "INDIVIDUAL" });

const u = await User.findById(userId)
  .select("subscriptionStartAt subscriptionEnd demoEnd demoEndAt demo_end demo_end_at demo")
  .lean();

const demoEnd =
  u?.demoEndAt || u?.demoEnd || u?.demo_end_at || u?.demo_end || null;

const effectiveEnd = demoEnd || u?.subscriptionEnd || null;
const effectiveStart = u?.subscriptionStartAt || null;

// ✅ Subscription yoksa ama User'da gerçek abonelik varsa buradan oluştur
if (!sub) {
  if (effectiveEnd) {
    const start = effectiveStart ? new Date(effectiveStart) : new Date();
    const end = new Date(effectiveEnd);

    if (!Number.isNaN(end.getTime())) {
      sub = await Subscription.create({
        userId,
        planType: "INDIVIDUAL",
        currentPlanId: "bireysel_standart",
        period: computePeriodFromDuration(start, end),
        startDate: start,
        endDate: end,
        autoRenew: true,
        showVatIncluded: true,
      });

      return { sub, org: null };
    }
  }

  // ödeme yapılmamış kullanıcı
  return {
    sub: {
      currentPlanId: "bireysel_standart",
      usersCount: 1,
      period: "Aylık",
      autoRenew: false,
      showVatIncluded: false,
      startDate: null,
      endDate: null,
      paymentBrand: "",
      paymentLast4: "",
      paymentHolder: "",
      invoices: [],
    },
    org: null,
  };
}

// ✅ Subscription varsa User ile sync et
if (effectiveEnd) {
  const newEnd = new Date(effectiveEnd);
  if (!Number.isNaN(newEnd.getTime())) {
    let changed = false;

    if (!sub.endDate || new Date(sub.endDate).getTime() !== newEnd.getTime()) {
      sub.endDate = newEnd;
      changed = true;
    }

    if (effectiveStart) {
      const newStart = new Date(effectiveStart);
      if (!Number.isNaN(newStart.getTime())) {
        if (!sub.startDate || new Date(sub.startDate).getTime() !== newStart.getTime()) {
          sub.startDate = newStart;
          changed = true;
        }
      }
    } else if (!sub.startDate) {
      sub.startDate = new Date();
      changed = true;
    }

    const computedPeriod = computePeriodFromDuration(sub.startDate, sub.endDate);
    if (sub.period !== computedPeriod) {
      sub.period = computedPeriod;
      changed = true;
    }

    if (changed) await sub.save();
  }
}

return { sub, org: null };
  } // ✅ getOrCreateSubscription BİTTİ

  /**
   * GET /api/subscription/me
   */
  router.get("/me", auth, async (req, res) => {
    try {
      const { sub, org } = await getOrCreateSubscription(req);

      const corporate = isCorporate(req);
      const readOnly = corporate && !canEditCorporate(req);

      const plans = corporate ? buildCorporatePlansWithAliases() : INDIVIDUAL_PLANS;

      // ✅ Kurumsal teklif tutarı (prof-ozel) - billing'e girmeden burada göster
      let amountTRY = 0;
      const resolvedPlanId = normalizePlanId(sub?.currentPlanId || org?.planCode || "");
      if (corporate && resolvedPlanId === "prof-ozel") {
        amountTRY = await readOfferAmountTRY(pgPool, org?.uuid);
      }

      console.log("SUB DEBUG =>", {
        orgPlanCode: org?.planCode,
        orgUserLimit: org?.userLimit,
        subPlanId: sub?.currentPlanId,
        subUsers: sub?.usersCount,
      });

  const effectiveEndDt = parseDateSafe(
  sub?.endDate || org?.subscriptionEnd || org?.pilotEndAt
);
const isExpired = effectiveEndDt ? new Date().getTime() > effectiveEndDt.getTime() : false;
const orgPendingPayment =
  corporate && String(org?.status || "").toLowerCase() === "pending-payment";
return res.json({
  serverNow: new Date().toISOString(),
  mode: corporate ? "CORPORATE" : "INDIVIDUAL",
  role: req.user.role || "",
  readOnly,
  plans,
  isSubscriptionExpired: isExpired,
  subscription: {
    isExpired,
    
          currentPlanId: (() => {
            const users = Number(sub.usersCount || org?.userLimit || 1);

            // önce DB’den gelen planı dene
            const raw = sub.currentPlanId || org?.planCode || "";
            const normalized = normalizePlanId(raw);

            // plan boş/uygunsuzsa usersCount'tan türet
            return normalized || mapUsersCountToPlanId(users);
          })(),

          usersCount: Number(sub.usersCount || org?.userLimit || 1),
          period: sub.period,
          autoRenew: sub.autoRenew,
          showVatIncluded: sub.showVatIncluded,
         startDate: orgPendingPayment ? null : sub.startDate,
endDate: orgPendingPayment ? null : (sub.endDate || org?.subscriptionEnd || org?.pilotEndAt),
          paymentBrand: sub.paymentBrand,
          paymentLast4: sub.paymentLast4,
          paymentHolder: sub.paymentHolder,
          invoices: sub.invoices || [],
          amountTRY,
        },
      });
    } catch (e) {
      console.error("GET /subscription/me hata:", e);
      return res.status(500).json({ message: e.message || "Sunucu hatası" });
    }
  });

  /**
   * PUT /api/subscription/update
   */
  router.put("/update", auth, async (req, res) => {
    try {
      const corporate = isCorporate(req);
      

      const { sub, org } = await getOrCreateSubscription(req);

      const {
        currentPlanId,
        usersCount,
        period,
        autoRenew,
        showVatIncluded,
        startDate,
        paymentBrand,
        paymentLast4,
        paymentHolder,
        endDate,
      } = req.body || {};

      // ✅ Plan
      if (typeof currentPlanId === "string" && currentPlanId.trim()) {
        sub.currentPlanId = normalizePlanId(currentPlanId.trim()) || currentPlanId.trim();
      }

      // ✅ Users
      if (typeof usersCount !== "undefined") {
        const n = Number(usersCount);
        if (Number.isFinite(n) && n > 0) sub.usersCount = n;
      }

      if (period === "Aylık" || period === "Yıllık") sub.period = period;
      if (typeof autoRenew === "boolean") sub.autoRenew = autoRenew;
      if (typeof showVatIncluded === "boolean") sub.showVatIncluded = showVatIncluded;

      const corporateMode = isCorporate(req);

      if (!corporateMode) {
        // bireysel: start/end serbest
        if (startDate) sub.startDate = new Date(startDate);
        if (endDate) sub.endDate = new Date(endDate);

        // end yoksa period’e göre hesapla
        if (!endDate && startDate && (period === "Aylık" || period === "Yıllık")) {
          const d = new Date(startDate);
          sub.endDate = new Date(
            d.getTime() + (period === "Yıllık" ? 365 : 30) * 24 * 60 * 60 * 1000
          );
        }
      } else {
        // kurumsal: org.pilotEndAt (varsa) kilit, yoksa subscriptionEnd kilit
        const orgEnd = parseDateSafe(org?.pilotEndAt) || (org?.subscriptionEnd ? new Date(org.subscriptionEnd) : null);
        if (orgEnd) sub.endDate = orgEnd;

        if (!sub.startDate) sub.startDate = new Date();
        sub.period = computePeriodFromDuration(sub.startDate, sub.endDate);
      }

      if (typeof paymentBrand === "string") sub.paymentBrand = paymentBrand;
      if (typeof paymentLast4 === "string") sub.paymentLast4 = paymentLast4;
      if (typeof paymentHolder === "string") sub.paymentHolder = paymentHolder;

      await sub.save();

      return res.json({ message: "Abonelik bilgileri kaydedildi.", subscription: sub });
    } catch (e) {
      console.error("PUT /subscription/update hata:", e);
      return res.status(500).json({ message: e.message || "Sunucu hatası" });
    }
  });

  return router;
};