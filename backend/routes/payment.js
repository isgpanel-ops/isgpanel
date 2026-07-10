// backend/routes/payment.js
console.log("✅ PAYMENT ROUTE LOADED - v6 (org model uyumlu: only subscriptionEnd + sub-based timing)");

const express = require("express");
const Organization = require("../models/Organization");
const User = require("../models/User");
const { createNotification } = require("../services/notificationService");
const PLANS = require("../plans");
const Subscription = require("../models/Subscription");
const Payment = require("../models/Payment");
const { sendActivationMail } = require("../services/mailService");

const DAY_MS = 24 * 60 * 60 * 1000;
const roundTRY = (n) => Math.round(Number(n || 0));

function safePlanId(v) {
  const x = String(v || "").trim();
  if (!x) return "";

  if (x === "kurumsal_ozel" || x === "kurumsal-ozel") return "prof-ozel";

  // 🔥 ESKİ → YENİ MAP
  if (x === "ticari_1_3") return "ticari-5";
  if (x === "ticari_4_5") return "ticari-5";
  if (x === "ticari_6_10") return "ticari-10";

  return x.split("_").join("-");
}
function normalizePlanCodeForPlans(v) {
  const s = String(v || "").trim();
  if (!s) return "";

  if (s === "kurumsal_ozel" || s === "kurumsal-ozel") return "prof-ozel";

  // 🔥 ESKİ → YENİ MAP
  if (s === "ticari_1_3") return "ticari_5";
  if (s === "ticari_4_5") return "ticari_5";
  if (s === "ticari_6_10") return "ticari_10";

  return s.replaceAll("-", "_");
}

// kalan gün / toplam gün (30|365) — net gün bazlı
function computeProration(now, startAt, endAt) {
  let s = startAt ? new Date(startAt) : null;
  const e = endAt ? new Date(endAt) : null;

  // endAt yoksa proration yapamayız
  if (!e || isNaN(e)) {
    return { totalDays: 30, remainingDays: 0, factor: 0 };
  }

  // ✅ FIX: startAt yoksa endAt üzerinden tahmini startAt üret
  // Kural: kalan gün 60+ ise yıllık varsay, değilse aylık.
  if (!s || isNaN(s)) {
    const remainingMsGuess = e - now;
    const remainingDaysGuess = remainingMsGuess > 0 ? Math.ceil(remainingMsGuess / DAY_MS) : 0;
    const assumedTotalDays = remainingDaysGuess >= 60 ? 365 : 30;
    s = new Date(e.getTime() - assumedTotalDays * DAY_MS);
  }

  if (isNaN(s) || isNaN(e)) {
    return { totalDays: 30, remainingDays: 0, factor: 0 };
  }

  const totalDaysRaw = Math.round((e - s) / DAY_MS);
  const totalDays = totalDaysRaw >= 300 ? 365 : 30;

  const remainingMs = e - now;
  const remainingDays = remainingMs > 0 ? Math.ceil(remainingMs / DAY_MS) : 0;

  const factor = totalDays > 0 ? Math.min(1, Math.max(0, remainingDays / totalDays)) : 0;
  return { totalDays, remainingDays, factor };
}

module.exports = function paymentRoutes(pgPool) {
  const router = express.Router();

  // ✅ Son Ödemeler: sadece başarılı, son 6
  // GET /api/payment/recent?orgUuid=...&limit=6&status=success
  router.get("/recent", async (req, res) => {
  try {
    const { orgUuid, organizationId, userId, status } = req.query;
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 6)));

    const q = {};
    q.status = status ? String(status).toLowerCase() : "success";

    // ✅ 1) Query öncelikli
    let resolvedOrgUuid = orgUuid || organizationId || "";
    let resolvedUserId = userId || "";

    // ✅ 2) Query yoksa token (req.user) fallback
    if (!resolvedOrgUuid && !resolvedUserId) {
      resolvedOrgUuid = String(
        req.user?.organization?.uuid ||
        req.user?.organizationUuid ||
        req.user?.orgUuid ||
        ""
      );

      resolvedUserId = String(
        req.user?.id ||
        req.user?.userId ||
        req.user?._id ||
        ""
      );
    }

    if (resolvedOrgUuid) q.organizationUuid = String(resolvedOrgUuid);
    if (!resolvedOrgUuid && resolvedUserId) q.userId = resolvedUserId;

    // ✅ hala yoksa auth yok demektir
    if (!q.organizationUuid && !q.userId) {
      return res.status(401).json({ payments: [] });
    }

    const payments = await Payment.find(q).sort({ createdAt: -1 }).limit(limit).lean();
    return res.json({ payments });
  } catch (e) {
    return res.status(500).json({
      message: "recent payments error",
      detail: e?.message || String(e),
    });
  }
});

  // ✅ offers kolonlarını dinamik bul (cache)
  let _offerColsCache = null;

  async function resolveOfferColumns() {
    if (_offerColsCache) return _offerColsCache;

    const colsRes = await pgPool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'offers'
    `);

    const cols = colsRes.rows.map((r) => r.column_name);

    const orgCol =
      ["accepted_org_id", "organization_id", "org_id", "company_id"].find((c) => cols.includes(c)) ||
      null;

    const priceCol = ["price_try", "price", "amount", "total"].find((c) => cols.includes(c)) || null;

    const usersCol =
      ["users_count", "user_count", "users", "usersCount"].find((c) => cols.includes(c)) || null;

    const durationCol =
      ["duration_days", "durationDays", "pilot_days"].find((c) => cols.includes(c)) || null;

       const tokenCol = cols.includes("token") ? "token" : null;
    const statusCol = cols.includes("status") ? "status" : null;
    const acceptedAtCol = cols.includes("accepted_at") ? "accepted_at" : null;

    _offerColsCache = {
      orgCol,
      priceCol,
      usersCol,
      durationCol,
      tokenCol,
      statusCol,
      acceptedAtCol,
    };
    return _offerColsCache;
  }

  // ✅ Son teklifi çek (TEK KAYNAK)
  async function getLatestOffer(organizationUuid, token) {
    if (!pgPool) return null;

    const { orgCol, priceCol, usersCol, durationCol, tokenCol } = await resolveOfferColumns();

    if (!priceCol) throw new Error("offers tablosunda fiyat kolonu yok");
    if (!orgCol && !(token && tokenCol)) throw new Error("offers tablosunda org kolonu yok");

    let q = "";
    let params = [];

    if (token && tokenCol) {
      q = `
        SELECT
          ${priceCol} AS price
          ${usersCol ? `, ${usersCol} AS users_count` : ""}
          ${durationCol ? `, ${durationCol} AS duration_days` : ""}
        FROM offers
        WHERE ${tokenCol} = $1
        LIMIT 1
      `;
      params = [token];
    } else {
      q = `
        SELECT
          ${priceCol} AS price
          ${usersCol ? `, ${usersCol} AS users_count` : ""}
          ${durationCol ? `, ${durationCol} AS duration_days` : ""}
        FROM offers
        WHERE ${orgCol} = $1
        ORDER BY created_at DESC
        LIMIT 1
      `;
      params = [organizationUuid];
    }

    const r = await pgPool.query(q, params);
    if (!r.rowCount) return null;

    return {
      priceTRY: roundTRY(r.rows[0].price),
      usersCount: Number(r.rows[0].users_count || 0),
      durationDays: Number(r.rows[0].duration_days || 0),
    };
  }

  function isPersonalInfoMissing(user) {
    const p = user.personal || {};
    return !p.tcKimlik || !p.telefon || !p.meslek;
  }

  function isOrganizationInfoMissing(org) {
    return !org.name || !org.planCode || !org.userLimit;
  }

  // POST /api/payment/success
  router.post("/success", async (req, res) => {
    try {
      const {
        organizationId,
        userId,
        months,
        amountTRY,
        token,
        planCode,
        usersCount,
        type, // NEW | UPGRADE | ADD_USERS | OFFER
        targetPlanId, // UPGRADE hedef plan
        addUsersCount, // ADD_USERS net ek kullanıcı adedi
        carryOverDays = 0,
        isRenewal = false,
      } = req.body;



      let payType = String(type || "NEW").toUpperCase();

// ✅ frontend MONTHLY_TO_YEARLY gönderirse bunu UPGRADE gibi ele al
if (payType === "MONTHLY_TO_YEARLY") payType = "UPGRADE";

const allowedTypes = new Set(["NEW", "UPGRADE", "ADD_USERS", "OFFER"]);
if (!allowedTypes.has(payType)) {
  return res.status(400).json({ message: "type geçersiz.", type: payType });
}

      if (!organizationId && !userId) {
        return res.status(400).json({ message: "organizationId veya userId zorunludur." });
      }

      // =========================
      // ✅ BİREYSEL (userId)
      // =========================
      if (!organizationId && userId) {
        const u = await User.findById(userId);
        if (!u) return res.status(404).json({ message: "Kullanıcı bulunamadı." });

const now = new Date();

// ✅ period'a göre süre belirle (months gelmese bile)
const pr = String(req.body?.period || "").trim().toLowerCase();
const requestedIsYearly =
  pr === "yıllık" || pr === "yillik" || pr === "yearly" || pr === "annual" || Number(months) >= 12;

const totalDays = requestedIsYearly ? 365 : 30;

// ✅ Bireysel: log + tutar değişkenleri (ReferenceError fix)
const receivedAmount = Number(amountTRY || 0);

// planCode normalize + expected hesap (log için)
const reqPlanCodeRaw = String(planCode || "").trim();
const reqPlanCode = normalizePlanCodeForPlans(reqPlanCodeRaw);

const def = PLANS?.[reqPlanCode] || null;
if (!def) {
  return res.status(400).json({
    message: "planCode geçersiz.",
    planCode: reqPlanCode,
    raw: reqPlanCodeRaw,
  });
}

const monthly = Number(def.monthlyPrice || 0);
const vat = Number(def.kdvRate || 0.2);
const fullExVat = (totalDays === 365) ? monthly * 10 : monthly;
const expectedAmountTRY = roundTRY(fullExVat * (1 + vat));

const hasActive = u.subscriptionEnd && new Date(u.subscriptionEnd) > now;

// ✅ aktif aboneliğin aylık mı yıllık mı olduğunu anla
let activeIsYearly = false;
try {
  const s = u.subscriptionStartAt ? new Date(u.subscriptionStartAt) : null;
  const e = u.subscriptionEnd ? new Date(u.subscriptionEnd) : null;
  if (s && e && !isNaN(s) && !isNaN(e)) {
    const days = Math.round((e - s) / DAY_MS);
    activeIsYearly = days >= 300;
  }
} catch {}

// ✅ aylıktan→yıllığa geçiş mi?
const isMonthlyToYearlyUpgrade = hasActive && !activeIsYearly && requestedIsYearly;

// ✅ demo mu?
const wasDemo = u.demo === true || !!u.demoEndAt || !!u.demoStartAt;

// ✅ kalan gün (aktif abonelik varsa)
const remainingDays = hasActive
  ? Math.max(0, Math.ceil((new Date(u.subscriptionEnd) - now) / DAY_MS))
  : 0;

// ✅ reset sadece demo kullanıcı normal pakete geçiyorsa yapılır
const shouldResetFromNow = payType === "NEW" && wasDemo;

let effectiveDays = totalDays;

// ✅ Bireysel süre hesabı
// Demo -> normal: bugünden başlar
// Aylık -> yıllık: ücrette kredi uygulanır, ama süreye kalan gün tekrar eklenmez
// Aynı dönem yenileme: sadece son 3 gün kala, mevcut bitişin üstüne eklenir
let newStart = now;
let newEnd = new Date(now.getTime() + effectiveDays * DAY_MS);

if (shouldResetFromNow) {
  newStart = now;
  newEnd = new Date(now.getTime() + effectiveDays * DAY_MS);
} else if (isMonthlyToYearlyUpgrade) {
  newStart = now;
  newEnd = new Date(now.getTime() + effectiveDays * DAY_MS);
} else if (hasActive) {
  newStart = u.subscriptionStartAt || now;
  newEnd = new Date(new Date(u.subscriptionEnd).getTime() + effectiveDays * DAY_MS);
}
// ✅ Bireysel yenileme penceresi (son 3 gün)
const activePeriodText = activeIsYearly ? "Yıllık" : "Aylık";
const reqPeriodText = requestedIsYearly ? "Yıllık" : "Aylık";
const canRenewNow = remainingDays <= 3;

// ✅ aynı plan + aynı periyot yenileme: sadece NEW ve son 3 gün
// ✅ demo ise bu işlem “demo -> normal satın alma” sayılır, yenileme penceresine girmez
const isRenewSamePeriod =
  hasActive &&
  (reqPeriodText === activePeriodText) &&
  payType === "NEW" &&
  !wasDemo; // ✅ kritik ek

if (isRenewSamePeriod && !canRenewNow) {
  return res.status(400).json({
    message: "Yenileme ödemesi sadece bitişe son 3 gün kala yapılabilir.",
    remainingDays,
  });
}

u.subscriptionStartAt = newStart;
u.subscriptionEnd = newEnd;

u.demo = false;
u.demoStartAt = null;
u.demoEndAt = null;

u.status = "aktif";
await u.save();

// ✅ bireysel subscription kaydını da oluştur/güncelle
await Subscription.findOneAndUpdate(
  { userId: u._id, planType: "INDIVIDUAL" },
  {
    $set: {
      currentPlanId: reqPlanCode || "bireysel_standart",
      period: requestedIsYearly ? "Yıllık" : "Aylık",
      autoRenew: true,
      startDate: newStart,
      endDate: newEnd,
    },
  },
  { upsert: true, new: true }
);

        await createNotification({
          userId: u._id,
          type: "event",
          module: "bireysel",
          title: "Ödeme başarılı ✅",
          message: `Aboneliğiniz güncellendi. Bitiş: ${new Date(newEnd).toLocaleDateString("tr-TR")}`,
          severity: "info",
          link: "",
          key: `payment:user:${u._id}`,
        }).catch(() => {});

        // ✅ PAYMENT LOG (Bireysel)
try {
  const periodText = totalDays === 365 ? "Yıllık" : "Aylık";

  await Payment.create({
    scope: "PERSONAL",
    userId: u._id,
    type: payType,
    status: "success",
    amountTRY: receivedAmount,
    expectedTRY: Number(expectedAmountTRY || 0),
    period: periodText,
    planFrom: "",
    planTo: String(reqPlanCode || planCode || ""),
    usersBefore: 1,
    usersAfter: 1,
    usersDelta: 0,
    token: String(token || ""),
    note: "Bireysel ödeme",
  });
} catch (e) {
  console.error("PAYMENT LOG ERROR (PERSONAL):", e?.message || e);
}

               try {
          if (u.email) {
           console.log("✅ ACTIVATION MAIL START", {
  to: u.email,
  planCode: reqPlanCode || "bireysel_standart",
});

console.log("🚨 BIREYSEL MAIL BLOĞU ÇALIŞTI:", u.email);

await sendActivationMail({
  to: u.email,
  companyName: u.name || u.adSoyad || "Kullanıcı",
  panelLink: `${process.env.APP_URL || process.env.FRONTEND_URL || "https://www.isgpanel.tr"}`,
});
          }
        } catch (mailErr) {
          console.error("PERSONAL PANEL ACTIVE MAIL ERROR:", u.email, mailErr?.message || mailErr);
        }

               return res.json({
          message: "Bireysel abonelik başarılı",
          expectedAmountTRY,
          user: { id: u._id, subscriptionEnd: u.subscriptionEnd },
        });
      }

      // =========================
      // ✅ TİCARİ (organizationId)
      // =========================
      let org = null;

if (organizationId) {
  org =
    (await Organization.findOne({ uuid: organizationId })) ||
    (await Organization.findById(organizationId).catch(() => null));
}

if (!org) {
  console.log("ORG LOOKUP FAILED:", { organizationId });
  return res.status(404).json({ message: "Organizasyon bulunamadı." });
}
      if (!pgPool) {
        return res.status(500).json({ message: "pgPool bulunamadı. Ödeme doğrulaması yapılamadı." });
      }

     if (payType === "UPGRADE") {
  const t = String(targetPlanId || planCode || org?.planCode || "").trim();
  if (!t) {
    return res
      .status(400)
      .json({ message: "UPGRADE için targetPlanId / planCode bulunamadı." });
  }
}

     

      // ✅ Süre kaynağı: Subscription (timestamp korunur)
      const corpSub =
        (await Subscription.findOne({ organizationId: org._id, planType: "CORPORATE" }).lean()) || null;

      const subStartAt = corpSub?.startDate ? new Date(corpSub.startDate) : null;
      const subEndAt = corpSub?.endDate
        ? new Date(corpSub.endDate)
        : org.subscriptionEnd
        ? new Date(org.subscriptionEnd)
        : null;

          const now = new Date();

      const orgStatus = String(org?.status || "").toLowerCase();
      const hasActive =
        orgStatus === "active" &&
        subEndAt &&
        subEndAt > now;

      // ✅ OFFER: token varsa, org prof-ozel ise, YA DA istek prof-ozel satın alma ise (ilk alım senaryosu)
      const isProfOzel = String(org.planCode || "").trim() === "prof-ozel";

      const reqPlanSafe = safePlanId(planCode);
      const reqTargetSafe = safePlanId(targetPlanId);
      const wantsProfOzel = reqPlanSafe === "prof-ozel" || reqTargetSafe === "prof-ozel" || isProfOzel;

      // token yoksa bile prof-ozel alımında orgUuid üzerinden son teklifi çek
      const offer = token
        ? await getLatestOffer(organizationId, token)
        : wantsProfOzel
        ? await getLatestOffer(organizationId, null)
        : null;

      // ✅ period: frontend period varsa onu kullan, yoksa months
      // ✅ (kritik) prof-ozel’de offers.durationDays 300+ ise backend kesin yıllık saysın
      let periodRaw = String(req.body.period || "").trim().toLowerCase();

      let isYearly =
        periodRaw === "yıllık" ||
        periodRaw === "yillik" ||
        periodRaw === "yearly" ||
        periodRaw === "annual" ||
        Number(months) >= 12;

      // ✅ PROF-OZEL: offers.durationDays 300+ ise kesin yıllık
      if (!isYearly && offer && Number(offer.durationDays || 0) >= 300) {
        isYearly = true;
        if (!periodRaw) periodRaw = "yearly";
      }

      // ✅ PROF-OZEL: period gelmiyorsa yıllığı ödenen tutardan da yakala (ek güvence)
      // Not: Sizde offers.priceTRY aylık mı yıllık mı değişebilir; durationDays varsa yukarıdaki kural öncelikli.
      if (!isYearly && offer && !periodRaw) {
        const receivedTry = Number(amountTRY || 0);
        const offerTotalIncVat = Number(offer.priceTRY || 0);
        if (offerTotalIncVat > 0 && receivedTry > offerTotalIncVat * 3) {
          isYearly = true;
          periodRaw = "yearly";
        }
      }

      const addMonths = Number(months) > 0 ? Number(months) : isYearly ? 12 : 1;
      const newTotalDays = isYearly ? 365 : 30;

      // Mevcut plan (upgrade farkı için)
      const currentPlanCodeRaw = String(org.planCode || "").trim();
      const currentPlanCode = currentPlanCodeRaw.replaceAll("-", "_");

      const currentDef = PLANS?.[currentPlanCode] || PLANS?.[currentPlanCodeRaw] || null;
      const currentMonthly = Number(currentDef?.monthlyPrice || 0);
      const currentFullPrice = newTotalDays === 365 ? currentMonthly * 10 : currentMonthly;

      // hedef plan
      const reqPlanCode = String(planCode || "").trim();
      const reqTargetPlanId = String(targetPlanId || "").trim();
      const normalizedTargetPlanId = reqTargetPlanId.replaceAll("-", "_");
      const normalizedReqPlanCode = String(reqPlanCode || "").trim().replaceAll("-", "_");

     const targetPlanCode =
  payType === "UPGRADE"
    ? normalizedTargetPlanId || normalizedReqPlanCode || currentPlanCode
    : normalizedReqPlanCode || currentPlanCode || String(org.planCode || "").replaceAll("-", "_");

      const targetDef =
        PLANS?.[targetPlanCode] || PLANS?.[String(targetPlanCode || "").trim().replaceAll("-", "_")] || null;

      const targetMonthly = Number(targetDef?.monthlyPrice || 0);
      const targetVat = Number(targetDef?.kdvRate || 0.2);
      const targetFullPrice = newTotalDays === 365 ? targetMonthly * 10 : targetMonthly;

      // kullanıcı sayıları
      const reqUsersCount = Number(usersCount || 0);
      const currentUsers = Number(org.userLimit || 0);

      const addC = Math.max(0, Number(addUsersCount || 0));
      const derivedExtraUsers = reqUsersCount > 0 ? Math.max(0, reqUsersCount - currentUsers) : 0;
      const extraUsersFinal = addC > 0 ? addC : derivedExtraUsers;

      // proration
      const { totalDays, remainingDays, factor } = computeProration(now, subStartAt, subEndAt);

      // period text
      const reqPeriod = isYearly ? "Yıllık" : "Aylık";
      const activePeriod = totalDays >= 300 ? "Yıllık" : "Aylık";

      // yenileme penceresi
      const canRenewNow = remainingDays <= 3;

     // ✅ Yenileme tespiti (GENEL FIX)
// Sadece:
// - aktif abonelik varsa
// - ek kullanıcı yoksa
// - hedef plan gerçekten mevcut plan ile aynıysa
// - dönem de aynıysa
// yenileme saysın.
// Bunun dışındaki tüm akışlar:
// yeni satın alma / paket değişimi / aylık->yıllık geçiş / teklif geçişi olsun.

const currentPlanNormalized = safePlanId(currentDef?.code || org.planCode || "");
const targetPlanNormalized = safePlanId(
  offer ? "prof-ozel" : (targetDef?.code || targetPlanCode || planCode || "")
);

const isSamePlan = !!currentPlanNormalized && !!targetPlanNormalized
  ? currentPlanNormalized === targetPlanNormalized
  : false;

const isSamePeriod = reqPeriod === activePeriod;

// ✅ Standart paket gerçek yenileme
const isRenewalSamePlanSamePeriod =
  payType === "NEW" &&
  hasActive &&
  !offer &&
  extraUsersFinal === 0 &&
  isSamePlan &&
  isSamePeriod;

// ✅ Prof-özel gerçek yenileme
// registered = teklif kabul edildi ama ilk ödeme henüz yapılmadı
// bu durumda 3 gün kuralına TAKILMAMALI
let latestOfferStatus = "";

try {
  const { orgCol, tokenCol, statusCol } = await resolveOfferColumns();

  if (pgPool && statusCol && (tokenCol || orgCol)) {
    let q = "";
    let params = [];

    if (token && tokenCol) {
      q = `SELECT ${statusCol} AS status FROM offers WHERE ${tokenCol} = $1 LIMIT 1`;
      params = [token];
    } else if (org.uuid && orgCol) {
      q = `
        SELECT ${statusCol} AS status
        FROM offers
        WHERE ${orgCol} = $1
        ORDER BY created_at DESC
        LIMIT 1
      `;
      params = [org.uuid];
    }

    if (q) {
      const stRes = await pgPool.query(q, params);
      latestOfferStatus = String(stRes.rows?.[0]?.status || "").toLowerCase().trim();
    }
  }
} catch (e) {
  console.error("offer status read error:", e);
}

const isAcceptedButUnpaidOffer =
  payType === "OFFER" &&
  !!offer &&
  ["registered", "opened", "sent"].includes(latestOfferStatus);

// ✅ sadece gerçekten aktif/paid olmuş prof-özel abonelikte aynı dönem yenilemeyi yenileme say
const isOfferRenewalSamePeriod =
  payType === "OFFER" &&
  hasActive &&
  !!offer &&
  extraUsersFinal === 0 &&
  isSamePlan &&
  isSamePeriod &&
  !isAcceptedButUnpaidOffer;

      let expectedAmountTRY = null;

      // =========================
      // ✅ 1) ADD_USERS
      // =========================
      if (payType === "ADD_USERS") {
  if (!hasActive) {
    return res.status(400).json({ message: "Ek kullanıcı için aktif abonelik gereklidir." });
  }

  if (extraUsersFinal <= 0) {
    return res.status(400).json({ message: "addUsersCount geçersiz (0)." });
  }

  // ✅ aktif döneme göre çarpan
 const periodMultiplier = reqPeriod === "Yıllık" ? 10 : 1;

if (offer) {
  const offerTotalIncVat = Number(offer.priceTRY || 0);
  const offerDays = Number(offer.durationDays || 0);

  if (offerTotalIncVat <= 0) {
    return res.status(400).json({ message: "Teklif tutarı bulunamadı." });
  }

  const vatIncluded = true; // prof-ozel teklif KDV dahil geliyor
  const monthlyIncVat =
    offerDays >= 300 ? offerTotalIncVat / 10 : offerTotalIncVat;

  const baseUsers =
    Number(offer.usersCount || 0) ||
    Number(currentUsers || 0) ||
    Number(org.userLimit || 0) ||
    1;

  // ✅ frontend ile birebir aynı sıra:
  // 1) kişi başı TRY
  const perUserBaseTRY = monthlyIncVat / baseUsers;

  // 2) KDV hariçe çevir
  const perUserExVat = vatIncluded ? perUserBaseTRY / 1.2 : perUserBaseTRY;

  // 3) dönem çarpanı
  const perUserPeriodExVat = reqPeriod === "Yıllık"
    ? perUserExVat * 10
    : perUserExVat;

  // 4) oran
  const frontendLikeRemainingDays = subEndAt
  ? Math.max(0, Math.floor((new Date(subEndAt).getTime() - now.getTime()) / DAY_MS))
  : 0;

const prorationFactor = totalDays > 0 ? frontendLikeRemainingDays / totalDays : 0;

  // 5) toplam
  const ex = Math.round(perUserPeriodExVat * extraUsersFinal * prorationFactor);
  const vat = Math.round(ex * 0.2);
  const total = ex + vat;

  expectedAmountTRY = total;
} else {
    // ✅ sabit paket / teklif yoksa: 300 TL + KDV kişi başı
    const EXTRA_PER_USER_EX_VAT = 300;

    const extraBase =
      EXTRA_PER_USER_EX_VAT *
      periodMultiplier *
      extraUsersFinal *
      factor;

    const extraWithVat = extraBase * (1 + 0.2);
    expectedAmountTRY = roundTRY(extraWithVat);
  }
}

      // =========================
      // ✅ 2) OFFER (prof-ozel)
      // =========================
      else if (offer) {
        // ✅ Kritik: offers.priceTRY sizde aylık da olabilir, yıllık toplam da olabilir.
        // durationDays >= 300 ise "priceTRY = yıllık toplam" kabul ediyoruz.
        const offerTotalIncVat = Number(offer.priceTRY || 0);
        const offerDays = Number(offer.durationDays || 0);

        if (offerTotalIncVat <= 0) {
          return res.status(400).json({ message: "Teklif tutarı bulunamadı." });
        }

        const monthlyIncVat = offerDays >= 300 ? offerTotalIncVat / 10 : offerTotalIncVat;
        const yearlyIncVat = offerDays >= 300 ? offerTotalIncVat : monthlyIncVat * 10; // 2 ay bizden

       const isPilotTransition =
  org?.pilotEnabled === true ||
  !!org?.pilotStartAt ||
  !!org?.pilotEndAt ||
  (offer && Number(offer.durationDays || 0) > 0 && Number(offer.durationDays || 0) < 30);
if (hasActive) {
  if (reqPeriod === activePeriod) {
    // ✅ teklif kabul edildi ama ilk ödeme yapılmadıysa yenileme değil, direkt ödeme
    const isPaidOfferActivation =
  payType === "NEW" &&
  wantsProfOzel &&
  Number(amountTRY || 0) > 0;

if (!isAcceptedButUnpaidOffer && !isPaidOfferActivation && !canRenewNow) {
      return res.status(400).json({
        message: "Yenileme ödemesi sadece bitiş tarihine son 3 gün kala yapılabilir.",
        remainingDays,
      });
    }

    expectedAmountTRY = roundTRY(reqPeriod === "Yıllık" ? yearlyIncVat : monthlyIncVat);
  } else {
    // ✅ Pilot -> pakete geçişte mahsup yok
    if (isPilotTransition) {
      expectedAmountTRY = roundTRY(reqPeriod === "Yıllık" ? yearlyIncVat : monthlyIncVat);
   } else {
  // ✅ Pilot / teklif geçişinde mahsup yok
  // ✅ Sadece gerçek aktif aylık abonelikten yıllığa geçişte mahsup var
  const shouldApplyCredit =
    !isPilotTransition &&
    activePeriod === "Aylık" &&
    reqPeriod === "Yıllık" &&
    Number(remainingDays || 0) > 0;

  if (shouldApplyCredit) {
    const credit = monthlyIncVat * (remainingDays / 30);
    expectedAmountTRY = roundTRY(Math.max(0, yearlyIncVat - credit));
  } else {
    expectedAmountTRY = roundTRY(reqPeriod === "Yıllık" ? yearlyIncVat : monthlyIncVat);
  }
}
  }
} else {
  expectedAmountTRY = roundTRY(reqPeriod === "Yıllık" ? yearlyIncVat : monthlyIncVat);
}
        // aktif abonelikte ek kullanıcı da eklenmişse
        if (extraUsersFinal > 0 && hasActive) {
          // ✅ Özel teklif kişi başı (KDV DAHİL): teklif / mevcut kullanıcı limiti
          const baseUsers =
            Number(offer.usersCount || 0) ||
            Number(org.userLimit || 0) ||
            Number(currentUsers || 0) ||
            1;

          const perUserIncVatMonthly = Number(monthlyIncVat) / baseUsers;

          // ✅ “20 gün baz” kuralı: kalan gün 20’den büyükse 20 kabul et
          const usedRemainingDays = Math.min(remainingDays, 20);

          // ✅ aktif periyot aylık/yıllık: totalDays zaten 30/365 veriyor
          const pr = totalDays > 0 ? usedRemainingDays / totalDays : 0;

          const extraIncVat = perUserIncVatMonthly * extraUsersFinal * pr;

          expectedAmountTRY = roundTRY(Number(expectedAmountTRY || 0) + extraIncVat);
        }
      }

      // =========================
      // ✅ 3) Standart paket (PLANS)
      // =========================
      else {
        if (!targetDef) {
          return res.status(400).json({
            message: "Standart paket için planCode geçersiz veya eksik.",
            planCode: targetPlanCode,
          });
        }

        const RENEW_WINDOW_DAYS = 3;

        if (!hasActive) {
          // yeni satın alma / süre bitmiş
          expectedAmountTRY = roundTRY(targetFullPrice * (1 + targetVat));
        } else if (isRenewalSamePlanSamePeriod) {
          // ✅ Yenileme (aynı plan + aynı periyot): full ücret, sadece son 3 gün
          if (remainingDays > RENEW_WINDOW_DAYS) {
            return res.status(400).json({
              message: "Yenileme ödemesi sadece bitişe son 3 gün kala yapılabilir.",
              remainingDays,
            });
          }
          expectedAmountTRY = roundTRY(targetFullPrice * (1 + targetVat));
        } else if (
  (payType === "NEW" || payType === "UPGRADE") &&
  reqPeriod === "Yıllık"
) {
  // ✅ Yıllık pakete geçişte:
  // hedef yıllık ücret - mevcut paketin kalan süre kredisi
  // (aynı plan / farklı plan fark etmez)
  const currentVatRate = Number(currentDef?.kdvRate || 0.2);

  const currentPeriodIncVat =
    activePeriod === "Yıllık"
      ? roundTRY(Number(currentMonthly || 0) * 10 * (1 + currentVatRate))
      : roundTRY(Number(currentMonthly || 0) * (1 + currentVatRate));

  const targetYearlyIncVat = roundTRY(
    Number(targetMonthly || 0) * 10 * (1 + Number(targetVat || 0.2))
  );

  const creditBaseDays = activePeriod === "Yıllık" ? 365 : 30;
  const credit = currentPeriodIncVat * (Number(remainingDays || 0) / creditBaseDays);

  expectedAmountTRY = roundTRY(Math.max(0, targetYearlyIncVat - credit));
} else {
  // aktifken: upgrade farkı + ek kullanıcı (kalan gün oranlı)
  const EXTRA_PER_USER_EX_VAT = 300;

  const diffBase = Math.max(0, (targetFullPrice - currentFullPrice) * factor);
  const diffWithVat = diffBase * (1 + targetVat);

  const extraBase = EXTRA_PER_USER_EX_VAT * extraUsersFinal * factor;
  const extraWithVat = extraBase * (1 + 0.2);

  expectedAmountTRY = roundTRY(extraWithVat + diffWithVat);
}
      }

      // ✅ 0 TL koruması
      if (!Number.isFinite(expectedAmountTRY) || expectedAmountTRY < 0) {
        return res.status(400).json({ message: "Beklenen ödeme tutarı geçersiz.", expectedAmountTRY });
      }

           const received = Number(amountTRY || 0);

      // ✅ ödeme alınmadan abonelik başlatma
      if (received <= 0) {
        return res.status(400).json({
          message: "Ödeme alınmadan abonelik başlatılamaz.",
        });
      }

      // ✅ NEW: sadece ödeme GELMEDİYSE 0₺ engelle
      if (payType === "NEW") {
        if (expectedAmountTRY === 0 && received <= 0) {
          return res.status(400).json({ message: "Bu işlem için ödeme gerekmiyor (0 ₺)." });
        }
        if ((!Number.isFinite(expectedAmountTRY) || expectedAmountTRY < 0) && received <= 0) {
          return res.status(400).json({
            message: "Beklenen ödeme tutarı geçersiz.",
            expectedAmountTRY,
          });
        }
      } else {
        if (received <= 0 && expectedAmountTRY === 0) {
          return res.status(400).json({ message: "Bu işlem için ödeme gerekmiyor (0 ₺)." });
        }
      }

              if (typeof amountTRY !== "undefined") {
        const received2 = Number(amountTRY);

        // ✅ callback’ten gelen gerçek tutarı esas al
        if ((payType === "OFFER" || payType === "ADD_USERS") && received2 > 0) {
          expectedAmountTRY = roundTRY(received2);
        }

        // ✅ NEW / OFFER / ADD_USERS için birebir eşitlik isteme
        const skipStrictEquality =
          ["NEW", "OFFER", "ADD_USERS"].includes(payType) ||
          (payType === "UPGRADE" && reqPeriod === "Yıllık");

        if (!skipStrictEquality && expectedAmountTRY > 0 && received2 !== expectedAmountTRY) {
          return res.status(400).json({
            message: "Ödeme tutarı beklenen tutar ile uyuşmuyor.",
            expected: expectedAmountTRY,
            received: received2,
          });
        }
      }

      // ✅ NEW'de callback zaten ödeme aldı: birebir eşitlik yerine güvenli aralık kontrolü yap.
      // ✅ maxAllowed: tam paket ücreti (KDV dahil). Ödenen bunun ÜSTÜNE çıkamaz.
      let maxAllowedTRY = expectedAmountTRY;

      // Standart paketlerde "tam ücret"i max olarak tut (prorate/discount NEW gelirse reddetmeyelim)
      if (!offer && payType === "NEW" && targetDef) {
        maxAllowedTRY = roundTRY(targetFullPrice * (1 + targetVat));
      }

     // prof-ozel offer'da max: seçilen periyodun tam ücreti (KDV dahil)
if (offer && (payType === "NEW" || payType === "OFFER")) {
  const offerTotalIncVat = Number(offer.priceTRY || 0);
  const offerDays = Number(offer.durationDays || 0);

  const monthlyIncVat = offerDays >= 300 ? offerTotalIncVat / 10 : offerTotalIncVat;
  const yearlyIncVat = offerDays >= 300 ? offerTotalIncVat : monthlyIncVat * 10;

  maxAllowedTRY = roundTRY(reqPeriod === "Yıllık" ? yearlyIncVat : monthlyIncVat);
}

     if (typeof amountTRY !== "undefined") {
  const received2 = Number(amountTRY);

 if ((payType === "NEW" || payType === "OFFER" || payType === "ADD_USERS") && received2 > 0) {
  if (Number.isFinite(maxAllowedTRY) && maxAllowedTRY > 0 && received2 > maxAllowedTRY) {
    return res.status(400).json({
      message: "Ödenen tutar paket ücretini aşıyor.",
      maxAllowed: maxAllowedTRY,
      received: received2,
    });
  }

  // ✅ ödeme alındıysa callback tutarını esas al
  expectedAmountTRY = roundTRY(received2);
}
}

      // =========================
      // ✅ ORGANIZATION UPDATE
      // =========================
      org.status = "active";

      let newSubStart = subStartAt;
      let newSubEnd = subEndAt;

      if (!hasActive) {
  newSubStart = now;
  newSubEnd = new Date(now.getTime() + newTotalDays * DAY_MS);
} else {
  if (!newSubEnd) {
    return res.status(400).json({ message: "Aktif abonelik var ama endDate bulunamadı." });
  }

  // ✅ Standart paket yenileme
  if (isRenewalSamePlanSamePeriod) {
    if (!canRenewNow) {
      return res.status(400).json({
        message: "Yenileme ödemesi sadece bitiş tarihine son 3 gün kala yapılabilir.",
        remainingDays,
      });
    }

    const anchor = new Date(newSubEnd);
    newSubStart = anchor;
    newSubEnd = new Date(anchor.getTime() + newTotalDays * DAY_MS);
  }
    // ✅ Prof-özel teklif yenileme
  else if (isOfferRenewalSamePeriod) {
    if (!canRenewNow) {
      return res.status(400).json({
        message: "Yenileme ödemesi sadece bitiş tarihine son 3 gün kala yapılabilir.",
        remainingDays,
      });
    }

    const anchor = new Date(newSubEnd);
    newSubStart = anchor;
    newSubEnd = new Date(anchor.getTime() + newTotalDays * DAY_MS);
  }
  // ✅ teklif kabul edildi ama ilk ödeme henüz yapılmadıysa
  // bunu yenileme gibi değil, yeni teklif aktivasyonu gibi başlat
  else if (isAcceptedButUnpaidOffer) {
    newSubStart = now;
    newSubEnd = new Date(now.getTime() + newTotalDays * DAY_MS);
  }
 // ✅ Aylık -> Yıllık geçiş
else if (
  (payType === "NEW" || payType === "UPGRADE" || payType === "OFFER") &&
  activePeriod === "Aylık" &&
  reqPeriod === "Yıllık"
) {
  const extraDays = Math.max(
  0,
  Number(carryOverDays || 0),
  Number(remainingDays || 0)
);

newSubStart = now;

// ✅ 365 + mevcut kalan gün
newSubEnd = new Date(
  now.getTime() + (365 + extraDays) * DAY_MS
);
}else {
  if (!newSubStart) newSubStart = now;
}
}


org.subscriptionStartAt = newSubStart;
org.subscriptionEnd = newSubEnd;

// ✅ Ödeme aldıktan sonra sayaç “pilot”tan kilitlenmesin
// subscription.js: lockEnd = pilotEndAt || subscriptionEnd
// pilotEndAt 30 gün kaldıysa yıllığa geçmez -> burada temizliyoruz
org.pilotEnabled = false;
org.pilotStartAt = null;
org.pilotEndAt = null;

      // plan & userLimit
      if (payType === "ADD_USERS") {
        org.userLimit = Number(org.userLimit || 0) + extraUsersFinal;
      } else if (offer) {
        org.planCode = "prof-ozel";
        if (offer.usersCount && offer.usersCount > 0) {
          org.userLimit = offer.usersCount;
        }
      } else {
        org.planCode = targetDef.code;

        const planMax = Number(targetDef.maxUsers || 0);
        const currentLimit = Number(org.userLimit || 0);

        if (payType === "UPGRADE") {
          org.userLimit = Math.max(currentLimit, planMax || currentLimit || 1);
        } else {
          if (reqUsersCount > 0) org.userLimit = reqUsersCount;
          else org.userLimit = Number(planMax || currentLimit || 1);
        }
      }

      await org.save();

      // =========================
      // ✅ SUBSCRIPTION UPDATE
      // =========================
      const subPlanId = offer ? "prof-ozel" : safePlanId(org.planCode);
      const subUsersCount = Number(org.userLimit || 1);

      const subPeriod = (() => {
        const s = newSubStart ? new Date(newSubStart) : null;
        const e = newSubEnd ? new Date(newSubEnd) : null;
        if (!s || !e) return addMonths >= 12 ? "Yıllık" : "Aylık";
        const days = Math.round((e - s) / DAY_MS);
        return days >= 300 ? "Yıllık" : "Aylık";
      })();

      await Subscription.findOneAndUpdate(
        { organizationId: org._id, planType: "CORPORATE" },
        {
          $set: {
            currentPlanId: subPlanId,
            usersCount: subUsersCount,
            period: subPeriod,
            autoRenew: true,
            startDate: newSubStart,
            endDate: newSubEnd,
          },
        },
        { upsert: true, new: true }
      );

      // =========================
      // ✅ USER UPDATE
      // =========================
           await User.updateMany(
        { organization: org._id },
        {
          $set: {
            subscriptionStartAt: newSubStart,
            subscriptionEnd: newSubEnd,
            demo: false,
            demoStartAt: null,
            demoEndAt: null,
            status: "aktif",
            blockReason: "",
            blockedAt: null,
            autoBlockTriggered: false,
          },
        }
      );

  
      // ✅ Aktivasyon maili: ödeme başarılıysa organizasyondaki aktif kullanıcılara gönder
      try {
        const mailUsers = await User.find({
          organization: org._id,
          email: { $exists: true, $ne: "" },
        }).lean();

        for (const mu of mailUsers) {
          try {
            console.log("✅ CORPORATE ACTIVATION MAIL START", {
              to: mu.email,
              planCode: org.planCode || "",
            });

            await sendActivationMail({
  to: mu.email,
  companyName: org.name || mu.name || mu.adSoyad || "İSG Panel",
  panelLink: `${process.env.APP_URL || process.env.FRONTEND_URL || "https://www.isgpanel.tr"}`,
});
          } catch (mailErr) {
            console.error("CORPORATE ACTIVATION MAIL ERROR:", mu?.email, mailErr?.message || mailErr);
          }
        }
      } catch (e) {
        console.error("PANEL ACTIVE MAIL FETCH ERROR:", e?.message || e);
      }


      // =========================
      // ✅ OFFER STATUS UPDATE
      // ödeme başarılıysa ilgili teklifi de aktive et
      // =========================
      try {
        const { orgCol, tokenCol, statusCol, acceptedAtCol } = await resolveOfferColumns();

        if (pgPool && orgCol && statusCol) {
          if (token && tokenCol) {
            const updateByTokenSql = `
              UPDATE offers
              SET
                ${orgCol} = $1,
                ${statusCol} = 'active'
                ${acceptedAtCol ? `, ${acceptedAtCol} = NOW()` : ""}
              WHERE ${tokenCol} = $2
                AND ${statusCol} NOT IN ('canceled', 'expired')
            `;

            await pgPool.query(updateByTokenSql, [org.uuid, token]);
          } else {
            const updateLatestByOrgSql = `
              UPDATE offers
              SET
                ${statusCol} = 'active'
                ${acceptedAtCol ? `, ${acceptedAtCol} = COALESCE(${acceptedAtCol}, NOW())` : ""}
              WHERE id = (
                SELECT id
                FROM offers
                WHERE ${orgCol} = $1
                  AND ${statusCol} NOT IN ('canceled', 'expired')
                ORDER BY created_at DESC
                LIMIT 1
              )
            `;

            await pgPool.query(updateLatestByOrgSql, [org.uuid]);
          }
        }
      } catch (e) {
        console.error("OFFER STATUS UPDATE ERROR:", e);
      }

      // =========================
      // ✅ notifications
      // =========================
      const users = await User.find({ organization: org._id }).lean();
      const notificationErrors = [];

      for (const u of users || []) {
        if (!u?._id) continue;

        try {
          await createNotification({
            userId: u._id,
            type: "event",
            module: "ticari",
            title: "Ödeme başarılı ✅",
            message: `Aboneliğiniz güncellendi. Bitiş: ${new Date(newSubEnd).toLocaleDateString("tr-TR")}`,
            severity: "info",
            link: "",
            key: `payment:${organizationId}`,
          });
        } catch (e) {
          notificationErrors.push(`payment:${u._id}`);
        }

        const personalMissing = isPersonalInfoMissing(u);
        const orgMissing = isOrganizationInfoMissing(org);

        if (personalMissing || orgMissing) {
          try {
            await createNotification({
              userId: u._id,
              type: "event",
              module: "ticari",
              title: "Hoş geldiniz 👋",
              message: "Kurumsal kimlik bilgilerinizi doldurarak sisteminizi aktif hale getirin.",
              severity: "info",
              link: "/ticari/admin/kurumsal-kimlik",
              key: "welcome:v1",
            });
          } catch (e) {
            notificationErrors.push(`welcome:${u._id}`);
          }
        }
      }

      // =========================
      // ✅ PAYMENT LOG (Ticari)
      // =========================
           try {
        const receivedAmount = Number(amountTRY || 0);

        const planFrom = currentPlanCodeRaw || "";
        const planTo = offer ? "prof-ozel" : targetDef?.code || org.planCode || "";

        const usersBefore = Number(currentUsers || 0);
        const usersAfter = Number(org.userLimit || 0);
        const usersDelta = Math.max(0, usersAfter - usersBefore);

        const logType = offer ? "OFFER" : payType;
        await Payment.create({
          scope: "CORPORATE",
          organizationUuid: String(org.uuid || organizationId || ""),
          organizationId: org._id,
          type: logType,
          status: "success",
          amountTRY: receivedAmount,
          expectedTRY: Number(expectedAmountTRY || 0),
          period: reqPeriod,
          planFrom,
          planTo,
          usersBefore,
          usersAfter,
          usersDelta,
          token: String(token || ""),
          note:
            logType === "ADD_USERS"
              ? `Ek kullanıcı: +${extraUsersFinal}`
              : logType === "UPGRADE"
              ? "Paket yükseltme"
              : logType === "OFFER"
              ? "Özel teklif"
              : "Yeni satın alma",
        });
      } catch (e) {
        console.error("PAYMENT LOG ERROR (CORPORATE):", e?.message || e);
      }

      return res.json({
        message: "Abonelik işlemi başarılı",
        payType,
        offer,
        proration: hasActive
          ? { remainingDays, totalDays, factor }
          : { remainingDays: newTotalDays, totalDays: newTotalDays, factor: 1 },
        organization: {
          uuid: org.uuid,
          mongoId: org._id,
          name: org.name,
          status: org.status,
          subscriptionEnd: org.subscriptionEnd,
          planCode: org.planCode,
          userLimit: org.userLimit,
        },
        expectedAmountTRY,
        notification: {
          attemptedUsers: Array.isArray(users) ? users.length : 0,
          failedCount: notificationErrors.length,
          failedKeys: notificationErrors,
        },
      });
    } catch (err) {
      console.error("PAYMENT SUCCESS ERROR:", err?.stack || err);
      return res.status(500).json({
        message: "Sunucu hatası",
        detail: err?.message || String(err),
      });
    }
  });

  return router;
};