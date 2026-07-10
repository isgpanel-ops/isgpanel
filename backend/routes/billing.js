// backend/routes/billing.js
// ✅ mevcut kod korunarak: planId normalize + KDV dahil tahsilat + UPGRADE/ADD_USERS amount override + prof-ozel amount zorunlu
// ✅ FIX: map syntax, bireysel-standart desteği, iyzicoClient cache/null problemi için reload, sessUserId redeclare kaldırıldı

const express = require("express");
const router = express.Router();

const PaymentSession = require("../models/PaymentSession");
const Payment = require("../models/Payment"); // ✅ Son Ödemeler için
const User = require("../models/User");
// Plan fiyatlarını server belirlesin (client fiyat vermesin) ✅
function getPriceByPlan(planId, period) {
  // ✅ normalize: bireysel panel "bireysel" gönderiyor
  const pid = String(planId || "").trim();
  const normalizedPlanId =
    pid === "bireysel" ? "bireysel_standart" : pid.replaceAll("-", "_");

  // ✅ period normalize (ister Aylık/Yıllık, ister monthly/yearly gelsin)
  const pr = String(period || "").trim().toLowerCase();
  const isYearly = pr === "yıllık" || pr === "yillik" || pr === "yearly" || pr === "annual";

  // Not: map değerleri KDV HARİÇ; tahsilat KDV DAHİL yapılacak
  const map = {
   bireysel_standart: { monthly: 300, yearly: 300 * 10 },

  ticari_5: { monthly: 2000, yearly: 2000 * 10 },
  ticari_10: { monthly: 3500, yearly: 3500 * 10 },
  ticari_15: { monthly: 5000, yearly: 5000 * 10 },
  };

  const p = map[normalizedPlanId];
  if (!p) return null;
  return isYearly ? p.yearly : p.monthly;
}

function safeStr(v, fallback = "") {
  return (v ?? fallback).toString().trim();
}

function hasIyzicoEnv() {
  return (
    !!process.env.IYZICO_API_KEY &&
    !!process.env.IYZICO_SECRET_KEY &&
    !!process.env.IYZICO_BASE_URL
  );
}

// ✅ env varsa require et, yoksa null dön
// ✅ FIX: iyzicoClient bazen ilk load'da NULL cache'lenebiliyor → cache temizle/yeniden yükle
function getIyzipayClient() {
  if (!hasIyzicoEnv()) return null;

  try {
    const p = require.resolve("../iyzicoClient");
    delete require.cache[p];
  } catch (_) {}

  const client = require("../iyzicoClient");
  return client || null;
}

// ✅ fetch helper (Node18+ global.fetch var, yoksa node-fetch dene)
async function doFetch(url, opts) {
  if (typeof fetch === "function") return fetch(url, opts);
  try {
    // eslint-disable-next-line global-require
    const nf = require("node-fetch");
    return nf(url, opts);
  } catch (e) {
    throw new Error("fetch yok. Node 18+ kullan veya node-fetch kur.");
  }
}

// ✅ hızlı teşhis
router.get("/iyzico/api-info", (req, res) => {
  const client = getIyzipayClient();
  res.json({
    ok: true,
    hasKeys: hasIyzicoEnv(),
    clientReady: !!client,
    env: process.env.NODE_ENV || "development",
  });
});

/**
 * ✅ Son İşlemler
 * - Sadece başarılı (PAID)
 * - Son 6 ay
 * - En yeni → eski
 * - Maksimum 6 kayıt
 */
router.get("/transactions/recent", async (req, res) => {
  try {
    const orgUuid = safeStr(
  req.user?.organization?.uuid ||
  req.user?.organizationUuid ||
  req.user?.orgUuid ||
  ""
);

const userId = safeStr(
  req.user?.id ||
  req.user?.userId ||
  req.user?._id ||
  ""
);

const role = safeStr(req.user?.role || "").toLowerCase();

if (!orgUuid && !userId) {
  return res.status(401).json({ ok: false, message: "auth gerekli (org/user yok)" });
}

const sixMonthsAgo = new Date();
sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

const orgMongoId =
  req.user?.organization?._id ||
  req.user?.organizationId ||
  "";

const payFilter = {
  status: "success",
  createdAt: { $gte: sixMonthsAgo },
};

// ✅ bireyselde her zaman userId ile ara
if (role === "bireysel") {
  payFilter.userId = userId;
} else if (orgUuid || orgMongoId) {
  payFilter.$or = [];
  if (orgUuid) payFilter.$or.push({ organizationUuid: String(orgUuid) });
  if (orgMongoId) payFilter.$or.push({ organizationId: orgMongoId });
} else {
  payFilter.userId = userId;
}

    const rows = await Payment.find(payFilter)
      .sort({ createdAt: -1 })
      .limit(6)
      .lean();

    // ✅ 1) Senin mevcut formatın
    const items = rows.map((r) => ({
      id: String(r._id),
      date: r.createdAt,
      type: r.type,
      amount: r.amountTRY || 0,
      note: r.note || "",
    }));

    // ✅ 2) Bazı ekranların beklediği format (payment.js /recent gibi)
    const payments = rows.map((r) => ({
      ...r,
      id: String(r._id),
    }));

    return res.json({ ok: true, items, payments });
  } catch (err) {
    console.error("transactions/recent error:", err);
    return res.status(500).json({ ok: false, message: "Son işlemler okunamadı" });
  }
});

router.post("/iyzico/init", async (req, res) => {
  try {
    const iyzipay = getIyzipayClient();
    if (!iyzipay) {
      return res.status(400).json({
        ok: false,
        message: "Ödeme altyapısı aktif değil. (IYZICO env eksik veya client null)",
      });
    }

    // ✅ KDV oranı (tahsilat KDV dahil)
    const VAT_RATE = 0.2;

   const { period, type, billingInfo } = req.body || {};

const cleanBillingInfo = {
  type: ["bireysel", "kurumsal"].includes(String(billingInfo?.type || "").toLowerCase())
    ? String(billingInfo.type).toLowerCase()
    : "kurumsal",

  title: safeStr(billingInfo?.title),
  taxNumber: safeStr(billingInfo?.taxNumber),
  taxOffice: safeStr(billingInfo?.taxOffice),
  contactName: safeStr(billingInfo?.contactName),
  email: safeStr(billingInfo?.email),
  phone: safeStr(billingInfo?.phone),
  address: safeStr(billingInfo?.address),
  city: safeStr(billingInfo?.city),
  district: safeStr(billingInfo?.district),
};

// ✅ mahsuplu tutar farklı alan adlarıyla gelebilir (frontend farkları)
// öncelik: amount → amountTRY → payableTRY → expectedAmountTRY → total/payableAmount
const amount =
  req.body?.amount ??
  req.body?.amountTRY ??
  req.body?.payableTRY ??
  req.body?.expectedAmountTRY ??
  req.body?.payableAmount ??
  req.body?.payable ??
  req.body?.total ??

  // ✅ ekstra fallback’ler (frontend farklı alan kullanırsa)
  req.body?.payment?.amount ??
  req.body?.payment?.amountTRY ??
  req.body?.summary?.total ??
  req.body?.summary?.kdvDahil ??
  req.body?.odeme?.tutar ??
  undefined;

console.log("IYZICO INIT BODY (KEYS):", Object.keys(req.body || {}));
console.log("IYZICO INIT BODY (AMOUNT PICK):", {
  type,
  period,
  pickedAmount: amount,
  amount,
  amountTRY: req.body?.amountTRY,
  payableTRY: req.body?.payableTRY,
  expectedAmountTRY: req.body?.expectedAmountTRY,
});

    const payType = String(type || "NEW").toUpperCase();
    // ✅ period'dan yıllık tespiti
const pr = String(period || "").trim().toLowerCase();
const isYearly =
  pr === "yıllık" ||
  pr === "yillik" ||
  pr === "yearly" ||
  pr === "annual";

// ✅ months düzeltmesi (yıllıkta 12 zorunlu)
const monthsRaw = Number(req.body?.months || 1) || 1;
const months = isYearly ? 12 : monthsRaw;

   // ✅ UPGRADE'de hedef planı baz al (iyzico ekranda doğru paket/fiyat görünsün)
let planIdRaw = safeStr(
  req.body?.planId || req.body?.currentPlanId || req.body?.planCode || ""
);

const targetPlanRaw = safeStr(
  req.body?.targetPlanId || req.body?.targetPlanCode || ""
);

// ✅ paket değişimi veya yearly geçişte hedef planı kullan
if ((payType === "UPGRADE" || payType === "NEW") && targetPlanRaw) {
  planIdRaw = targetPlanRaw;
}

// ✅ tek normalize noktası
const pid = String(planIdRaw || "").trim();
const planId =
  pid === "bireysel" ? "bireysel_standart" : pid.replaceAll("-", "_");

    // ✅ payment.js /success ile uyumlu alanlar (uuid bekliyor)
    const organizationUuid = safeStr(
      req.user?.organization?.uuid ||
        req.user?.organizationUuid ||
        req.user?.orgUuid ||
        req.body?.organizationId ||
        req.body?.orgUuid ||
        ""
    );

    // ✅ Bireysel için org zorunlu değil
    const userId = safeStr(req.user?.id || req.user?.userId || req.user?._id || "");

    if (!organizationUuid) {
      // bireysel (uzman) akış: org yoksa userId ile devam et
      if (!userId) {
        return res.status(401).json({
          ok: false,
          message: "auth gerekli (token yok / user bulunamadı)",
        });
      }
    }

    const usersCount = Number(req.body?.usersCount || 0) || 0;
    const offerToken = safeStr(req.body?.offerToken || req.body?.token || "");
    const planCode = safeStr(req.body?.planCode || "");
    

    if (!planIdRaw) {
      return res.status(400).json({ ok: false, message: "planId/currentPlanId zorunlu" });
    }
    if (!period) {
      return res.status(400).json({ ok: false, message: "period zorunlu" });
    }

    const planRawLower = String(planIdRaw || "").trim().toLowerCase();

if (planId === "kurumsal_10_plus" || planRawLower === "kurumsal-10-plus" || planRawLower === "kurumsal_10_plus") {
  return res.status(400).json({ ok: false, message: "Kurumsal 10+ teklif üzerinedir." });
}

    // ✅ Fiyat belirleme (mevcut kod korunarak güçlendirildi)
    // - ticari/bireysel paketlerde server map -> KDV dahil tahsilat
    // - UPGRADE/ADD_USERS veya amount geldiyse amount (KDV dahil) override
    // - prof-ozel gelirse amount zorunlu
    let price = null;

    if (planId === "prof_ozel" || planIdRaw === "prof-ozel") {
      const a = Number(amount);
      if (!Number.isFinite(a) || a <= 0) {
        return res.status(400).json({
          ok: false,
          message: "Kurumsal paket için amount (KDV dahil) zorunlu",
        });
      }
      price = a; // ✅ KDV dahil tahsil
    } else {
      const baseExVat = getPriceByPlan(planId, period);
      if (baseExVat == null) {
        return res.status(400).json({
          ok: false,
          message: "Plan fiyatı bulunamadı",
          planIdRaw,
          normalized: planId,
          period,
        });
      }

     // ✅ map KDV hariç -> tahsil KDV dahil
price = Math.round(Number(baseExVat) * (1 + VAT_RATE));
/* =========================================================
   ✅ TİCARİ / KURUMSAL PRORATA (KALAN GÜN DÜŞÜMÜ)
   ========================================================= */
try {
  const isCorporate = !!organizationUuid; // şirket hesabı

  const isUpgradeToYearly =
    isCorporate &&
    (payType === "NEW" || payType === "UPGRADE") &&
    isYearly &&
    (amount == null); // frontend mahsup göndermediyse

  if (isUpgradeToYearly) {
    // 🔥 organization'dan abonelik bitiş tarihini çek
    const org = await require("../models/Organization")
      .findOne({ uuid: organizationUuid })
      .select("subscriptionStartAt subscriptionEnd")
      .lean();

    const now = new Date();
    const end = org?.subscriptionEnd ? new Date(org.subscriptionEnd) : null;
    const start = org?.subscriptionStartAt
      ? new Date(org.subscriptionStartAt)
      : null;

    if (end && end > now) {
      const remainingDays = Math.max(
        0,
        Math.ceil((end - now) / (24 * 60 * 60 * 1000))
      );

      // 🔥 aylık KDV dahil fiyat
      const monthlyExVat = getPriceByPlan(planId, "aylık");
      const monthlyIncVat = Math.round(monthlyExVat * (1 + VAT_RATE));

      // 🔥 yıllık KDV dahil fiyat
      const yearlyIncVat = Math.round(baseExVat * (1 + VAT_RATE));

      const credit = monthlyIncVat * (remainingDays / 30);
      const discounted = Math.max(0, yearlyIncVat - credit);

      price = Math.round(discounted);
    }
  }
} catch (e) {
  console.warn("Corporate proration failed:", e?.message || e);
}


/* =========================================================
   ✅ BİREYSEL GARANTİ: Frontend amount göndermese bile
   aylık→yıllık geçişte mahsuplu fiyatı backend hesaplasın.
   Kural: yıllık (10 ay ücret) - aylık(KDV dahil) * (kalanGün/30)
   ========================================================= */
try {
  const isPersonal = !organizationUuid && !!userId; // bireysel
  const isPersonalPlan = planId === "bireysel_standart";
  const isMonthlyToYearlyCase =
    isPersonal &&
    isPersonalPlan &&
    (payType === "NEW" || payType === "UPGRADE") &&
    isYearly &&
    (amount == null); // frontend mahsuplu amount göndermediyse

  if (isMonthlyToYearlyCase) {
    const u = await User.findById(userId).select("subscriptionStartAt subscriptionEnd").lean();
    const now = new Date();

    const end = u?.subscriptionEnd ? new Date(u.subscriptionEnd) : null;
    const start = u?.subscriptionStartAt ? new Date(u.subscriptionStartAt) : null;

    if (end && !isNaN(end) && end > now) {
      // aktif abonelik var → periyodu 30/365 gün farkından anla
      const totalDays = (start && !isNaN(start)) ? Math.round((end - start) / (24 * 60 * 60 * 1000)) : 30;
      const activeIsYearly = totalDays >= 300;

      // sadece aktif AYLIK iken yıllığa geçişte mahsup uygula
      if (!activeIsYearly) {
        const remainingDays = Math.max(0, Math.ceil((end - now) / (24 * 60 * 60 * 1000)));

        // map’ten gelen baseExVat şu an "yıllık" seçili olduğu için yıllık exvat’tır.
        // bireysel monthly exvat = 300 (map’den)
        const monthlyExVat = getPriceByPlan("bireysel_standart", "aylık"); // 300
        const monthlyIncVat = Math.round(Number(monthlyExVat) * (1 + VAT_RATE));

        // yıllık KDV dahil (10 ay ücret)
        const yearlyIncVat = Math.round(Number(baseExVat) * (1 + VAT_RATE)); // baseExVat = yearly exvat

        const credit = monthlyIncVat * (remainingDays / 30);
        const discounted = Math.max(0, yearlyIncVat - credit);

        // ✅ İyzico’ya gidecek tutar
        price = Math.round(discounted);
      }
    }
  }
} catch (e) {
  console.warn("Personal proration fallback failed:", e?.message || e);
}

// ✅ NEW/UPGRADE/ADD_USERS için frontend "kalan gün mahsuplu" amount gönderebilir
const canOverrideAmount =
  payType === "NEW" ||
  payType === "UPGRADE" ||
  payType === "ADD_USERS" ||
  payType === "OFFER" ||
  planId === "prof_ozel" ||
  planIdRaw === "prof-ozel";

if (canOverrideAmount && amount != null) {
  // ✅ "34.375,67" / "34375.67" / "34 375.67" gibi formatları toparla
  const rawA = String(amount).trim();
  const normA = rawA
    .replace(/\s/g, "")     // boşlukları sil
    .replace(/\./g, "")     // binlik nokta ise sil
    .replace(",", ".");     // virgülü noktaya çevir

  const a = Number(normA);

  if (!Number.isFinite(a) || a <= 0) {
    return res.status(400).json({
      ok: false,
      message: "amount geçersiz. (KDV dahil, 0'dan büyük olmalı)",
      amount,
      parsed: normA,
      maxPrice: price,
      payType,
      planIdRaw,
      normalizedPlanId: planId,
      period,
    });
  }

  

  price = Math.round(a);
}
    }

    const conversationId = `conv_${Date.now()}`;

    const buyer = {
      id: "BY789",
      name: "ISG",
      surname: "PANEL",
      gsmNumber: "+905350000000",
      email: "info@isgpanel.com",
      identityNumber: "11111111111",
      registrationAddress: "Türkiye",
      ip: req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || req.ip,
      city: "Istanbul",
      country: "Turkey",
      zipCode: "34000",
    };

    const address = {
      contactName: "ISG PANEL",
      city: "Istanbul",
      country: "Turkey",
      address: "Türkiye",
      zipCode: "34000",
    };

    const baseUrl =
      process.env.PUBLIC_BASE_URL ||
      process.env.PUBLIC_URL ||
      `http://localhost:${process.env.PORT || 5001}`;

    // ✅ artık query taşımak zorunda değilsin
    const callbackUrl = `${baseUrl}/api/billing/iyzico/callback`;

    const request = {
      locale: "tr",
      conversationId,
      price: Number(price).toFixed(2),
      paidPrice: Number(price).toFixed(2),
      currency: "TRY",
      basketId: `BASKET_${Date.now()}`,
      paymentGroup: "SUBSCRIPTION",
      callbackUrl,
      enabledInstallments: [1],
      buyer,
      shippingAddress: address,
      billingAddress: address,
      basketItems: [
        {
          id: planId,
          name: `Abonelik (${safeStr(period)})`,
          category1: "Subscription",
          itemType: "VIRTUAL",
          price: Number(price).toFixed(2),
        },
      ],
    };

    iyzipay.checkoutFormInitialize.create(request, async (err, result) => {
      if (err) {
        console.error("❌ iyzico init err:", err);
        return res.status(500).json({ ok: false, message: "iyzico init error" });
      }

      if (!result || result.status !== "success") {
  console.error("❌ iyzico init fail:", result);

  return res.status(400).json({
    ok: false,
    message: result?.errorMessage || "iyzico init başarısız",
    errorCode: result?.errorCode,
    errorGroup: result?.errorGroup,
    status: result?.status,
    // sadece dev ortamında ham sonucu dön (prod’da kapalı)
    debug: (process.env.NODE_ENV || "development") !== "production" ? result : undefined,
  });
}

  // ✅ token geldi → PaymentSession oluştur (PENDING)
try {
  // ✅ session planCode üretimi için (object içine değil, üstte)
const sessionPlanIdForCode =
  payType === "UPGRADE"
    ? (safeStr(req.body?.targetPlanId || req.body?.targetPlanCode || "") || planId)
    : planId;

await PaymentSession.findOneAndUpdate(
  { iyzicoToken: result.token },
  {
    $set: {
      provider: "IYZICO",
      iyzicoToken: result.token,
      conversationId,
      organizationUuid: organizationUuid || "",
      userId: userId || "",
      type: safeStr(type || "NEW"),

      planId: safeStr(planId),

      planCode: safeStr(
        sessionPlanIdForCode === "prof_ozel" || sessionPlanIdForCode === "prof-ozel"
          ? "prof-ozel"
          : String(sessionPlanIdForCode || "").trim().replaceAll("_", "-").replaceAll("--", "-")
      ),

      period: safeStr(period),
      months,
      usersCount,
      carryOverDays: Number(req.body?.carryOverDays || 0) || 0,

      targetPlanId: safeStr(req.body?.targetPlanId || req.body?.targetPlanCode || ""),
      addUsersCount: Number(req.body?.addUsersCount || 0) || 0,

     expectedAmountTRY: Math.round(Number(price || 0)),

billingInfo: cleanBillingInfo,
invoiceStatus: cleanBillingInfo?.title && cleanBillingInfo?.taxNumber && cleanBillingInfo?.address
  ? "READY_TO_INVOICE"
  : "WAITING_BILLING_INFO",

status: "PENDING",
errorMessage: "",
offerToken: offerToken || "",
    },
  },
  { upsert: true, new: true }
);
} catch (e) {
  console.error("❌ PaymentSession create failed:", e?.message || e);
}

      return res.json({
        ok: true,
        conversationId,
        token: result.token,
        checkoutFormContent: result.checkoutFormContent,
        paymentPageUrl: result.paymentPageUrl,
      });
    });
  } catch (e) {
    console.error("❌ /iyzico/init exception:", e);
    return res.status(500).json({ ok: false, message: e.message || "Sunucu hatası" });
  }
});

router.post("/iyzico/callback", async (req, res) => {
  try {
    const iyzipay = getIyzipayClient();
    if (!iyzipay) return res.status(400).send("IYZICO ENV MISSING");

    const token = safeStr(req.body?.token || "");
    if (!token) return res.status(400).send("TOKEN MISSING");

    // ✅ 1) Session bul (kaynak burası)
    const session = await PaymentSession.findOne({ iyzicoToken: token });
    if (!session) return res.status(404).send("PAYMENT SESSION NOT FOUND");

    // ✅ idempotency
   if (session.status === "PAID") {
  const frontBase =
    process.env.FRONTEND_BASE_URL ||
    process.env.PUBLIC_APP_URL ||
    process.env.PUBLIC_FRONTEND_URL ||
    "http://localhost:5173";

  const planQ = encodeURIComponent(safeStr(session.planCode || session.planId || ""));
  const orgQ = encodeURIComponent(safeStr(session.organizationUuid || ""));
  return res.redirect(302, `${frontBase}/odeme-sonuc?plan=${planQ}&org=${orgQ}`);
}

    const sessOrg = safeStr(session.organizationUuid || "");
    const sessUserId = safeStr(session.userId || "");

    if (!sessOrg && !sessUserId) {
      await PaymentSession.updateOne(
        { iyzicoToken: token },
        { $set: { status: "FAILED", errorMessage: "ORG/USER MISSING IN SESSION" } }
      );
      return res.status(400).send("ORG/USER MISSING IN SESSION");
    }

    // ✅ 2) iyzico retrieve doğrula
    const retrieveReq = { locale: "tr", token };
    const result = await new Promise((resolve, reject) => {
      iyzipay.checkoutForm.retrieve(retrieveReq, (err, data) => {
        if (err) return reject(err);
        return resolve(data);
      });
    });

    if (!result || result.status !== "success") {
      await PaymentSession.updateOne(
        { iyzicoToken: token },
        { $set: { status: "FAILED", errorMessage: result?.errorMessage || "IYZICO RETRIEVE FAIL" } }
      );
      return res.status(400).send(result?.errorMessage || "IYZICO RETRIEVE FAIL");
    }

    const paidPrice = Number(result.paidPrice || result.price || 0);
    const paymentStatus = String(result.paymentStatus || "").toUpperCase();

    if (!(paidPrice > 0) || (paymentStatus && paymentStatus !== "SUCCESS")) {
      await PaymentSession.updateOne(
        { iyzicoToken: token },
        {
          $set: {
            status: "FAILED",
            errorMessage: `PAYMENT NOT SUCCESS (${paymentStatus || "UNKNOWN"})`,
          },
        }
      );
      return res.status(402).send("PAYMENT NOT SUCCESS");
    }

    const expected = Number(session.expectedAmountTRY || 0);
const received = Math.round(paidPrice);

// ✅ Callback seviyesinde "eşit olmalı" şartı fazla sert.
// ✅ En güvenlisi: sadece 0/negatif ve paymentStatus kontrol et (yukarıda var).
// ✅ İstersen minimum koruma: received expected'dan küçükse hata ver.
if (expected > 0 && received < expected) {
  await PaymentSession.updateOne(
    { iyzicoToken: token },
    {
      $set: {
        status: "FAILED",
        errorMessage: `AMOUNT MISMATCH (received<expected) expected=${expected} received=${received}`,
      },
    }
  );
  return res.status(400).send("AMOUNT MISMATCH");
}

    // ✅ 3) TEK KAYNAK aktivasyon: /api/payment/success
    const baseUrl =
      process.env.INTERNAL_BASE_URL ||
      process.env.PUBLIC_BASE_URL ||
      process.env.PUBLIC_URL ||
      `http://127.0.0.1:${process.env.PORT || 5001}`;

   const payload = {
  ...(sessOrg ? { organizationId: sessOrg } : {}),
  ...(!sessOrg && sessUserId ? { userId: sessUserId } : {}),

  period: safeStr(session.period || ""),
  months: Number(session.months || 1) || 1,
  amountTRY: Math.round(paidPrice),

  type: safeStr(session.type || "NEW") === "NEW" && safeStr(session.targetPlanId || "")
    ? "UPGRADE"
    : safeStr(session.type || "NEW"),

  planCode: safeStr(session.planCode) || undefined,
  usersCount: Number(session.usersCount || 0) || undefined,
  token: safeStr(session.offerToken) || undefined,

  targetPlanId: safeStr(session.targetPlanId || "") || undefined,
  addUsersCount: Number(session.addUsersCount || 0) || undefined,

  // ✅ EKLE
  carryOverDays: Number(session.carryOverDays || 0) || 0,
  isRenewal: Number(session.carryOverDays || 0) > 0,
};

    const r = await doFetch(`${baseUrl}/api/payment/success`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});

const data = await r.json().catch(() => ({}));

if (!r.ok) {

  // ✅ BURAYA EKLE
  console.log("❌ ACTIVATE FAILED", {
    status: r.status,
    payload,
    response: data
  });

  await PaymentSession.updateOne(
    { iyzicoToken: token },
    { $set: { status: "FAILED", errorMessage: data?.message || "SUBSCRIPTION ACTIVATE FAILED" } }
  );

  return res.status(500).send("SUBSCRIPTION ACTIVATE FAILED");
}

    // ✅ 4) Session PAID
    await PaymentSession.updateOne(
      { iyzicoToken: token },
      {
        $set: {
          status: "PAID",
          paidPrice: Math.round(paidPrice),
          paymentId: String(result.paymentId || result.conversationId || ""),
          paidAt: new Date(),
          errorMessage: "",
        },
      }
    );

    const frontBase =
  process.env.FRONTEND_BASE_URL ||
  process.env.PUBLIC_APP_URL ||
  process.env.PUBLIC_FRONTEND_URL ||
  "http://localhost:5173";

const finalPlan =
  String(session.type || "").toUpperCase() === "UPGRADE"
    ? (session.targetPlanId || session.planCode)
    : (session.planCode || session.planId);

const planQ = encodeURIComponent(safeStr(finalPlan || ""));
const orgQ = encodeURIComponent(safeStr(session.organizationUuid || ""));

return res.redirect(302, `${frontBase}/odeme-sonuc?plan=${planQ}&org=${orgQ}&panel=1`);
  } catch (e) {
    console.error("❌ iyzico callback exception:", e);
    return res.status(500).send("ERROR");
  }
});

module.exports = router;