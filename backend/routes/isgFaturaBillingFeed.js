const crypto = require("crypto");
const express = require("express");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");

const PaymentSession = require("../models/PaymentSession");
const Organization = require("../models/Organization");
const User = require("../models/User");
const PLANS = require("../plans");

const router = express.Router();

const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Çok fazla fatura entegrasyonu isteği gönderildi." },
});

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function requireBillingIntegration(req, res, next) {
  const expected = String(process.env.ISG_FATURA_BILLING_API_TOKEN || "").trim();
  const header = String(req.headers.authorization || "").trim();
  const supplied = header.startsWith("Bearer ") ? header.slice(7).trim() : "";

  if (expected.length < 32) {
    return res.status(503).json({
      code: "BILLING_INTEGRATION_NOT_CONFIGURED",
      message: "İSG Fatura satış entegrasyonu sunucuda yapılandırılmamış.",
    });
  }
  if (!safeEqual(expected, supplied)) {
    return res.status(401).json({
      code: "BILLING_INTEGRATION_UNAUTHORIZED",
      message: "Fatura entegrasyonu erişim anahtarı geçersiz.",
    });
  }
  return next();
}

function normalizePlanCode(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll("_", "-")
    .replace(/-+/g, "-");
}

function planDetails(session) {
  const code = normalizePlanCode(session.targetPlanId || session.planCode || session.planId);
  const key = Object.keys(PLANS).find((item) => normalizePlanCode(item) === code);
  const plan = key ? PLANS[key] : null;
  return {
    code: code || "ozel-teklif",
    name: plan?.name || (session.offerToken ? "Kurumsal Özel Teklif" : code || "İSG Panel Paketi"),
    userLimit: Number(session.usersCount || plan?.maxUsers || 0),
    vatRate: Number(plan?.kdvRate || 0.2) * 100,
  };
}

function saleType(value) {
  const type = String(value || "NEW").trim().toUpperCase();
  if (type === "OFFER") return "special_offer";
  if (type === "UPGRADE" || type === "ADD_USERS") return "upgrade";
  return "subscription";
}

function billingCycle(value) {
  const period = String(value || "").toLocaleLowerCase("tr-TR");
  if (period.includes("yıll") || period.includes("yill") || period === "annual" || period === "yearly") {
    return "yearly";
  }
  return "monthly";
}

function roundMoney(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

async function accountMap(sessions) {
  const organizationUuids = [...new Set(sessions.map((item) => item.organizationUuid).filter(Boolean))];
  const userIds = [
    ...new Set(
      sessions
        .map((item) => String(item.userId || ""))
        .filter((item) => mongoose.Types.ObjectId.isValid(item)),
    ),
  ];

  const [organizations, directUsers] = await Promise.all([
    Organization.find({ uuid: { $in: organizationUuids } }).select("_id uuid name").lean(),
    User.find({ _id: { $in: userIds } }).select("_id name email").lean(),
  ]);
  const organizationIds = organizations.map((item) => item._id);
  const admins = await User.find({
    organization: { $in: organizationIds },
    role: "ticari_admin",
  })
    .select("organization name email")
    .sort({ createdAt: 1 })
    .lean();

  const adminByOrganization = new Map();
  for (const admin of admins) {
    const key = String(admin.organization);
    if (!adminByOrganization.has(key)) adminByOrganization.set(key, admin);
  }
  return {
    organizations: new Map(organizations.map((item) => [item.uuid, item])),
    directUsers: new Map(directUsers.map((item) => [String(item._id), item])),
    adminByOrganization,
  };
}

router.get("/paid-sales", limiter, requireBillingIntegration, async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit || 500), 1), 1000);
    const updatedSince = req.query.updatedSince ? new Date(String(req.query.updatedSince)) : null;
    const query = { status: { $in: ["PAID", "paid", "SUCCESS", "success", "COMPLETED", "completed"] } };
    if (updatedSince && !Number.isNaN(updatedSince.getTime())) query.updatedAt = { $gte: updatedSince };

    const sessions = await PaymentSession.find(query)
      .sort({ paidAt: -1, updatedAt: -1, _id: -1 })
      .limit(limit)
      .lean();
    const accounts = await accountMap(sessions);

    const normalizedSales = sessions.map((session) => {
      const billing = session.billingInfo || {};
      const organization = accounts.organizations.get(session.organizationUuid);
      const admin = organization ? accounts.adminByOrganization.get(String(organization._id)) : null;
      const directUser = accounts.directUsers.get(String(session.userId || ""));
      const plan = planDetails(session);
      const total = roundMoney(session.paidPrice || session.expectedAmountTRY);
      const subtotal = roundMoney(total / (1 + plan.vatRate / 100));

      return {
        id: String(session._id),
        accountId: String(billing.email || admin?.email || directUser?.email || "").trim().toLowerCase(),
        customerName: billing.title || organization?.name || directUser?.name || "",
        customerEmail: String(billing.email || admin?.email || directUser?.email || "").trim().toLowerCase(),
        customerTaxNo: billing.taxNumber || "",
        customerTaxOffice: billing.taxOffice || "",
        customerAddress: billing.address || "",
        city: billing.city || "",
        district: billing.district || "",
        phone: billing.phone || "",
        saleType: saleType(session.type),
        packageCode: plan.code,
        packageName: plan.name,
        userLimit: plan.userLimit,
        billingCycle: billingCycle(session.period),
        subtotal,
        vatRate: plan.vatRate,
        vatAmount: roundMoney(total - subtotal),
        total,
        paidAt: session.paidAt || session.updatedAt || session.createdAt,
        paymentReference: session.paymentId || session.conversationId || "",
      };
    });

    // Fatura kuyruğuna yalnızca sahibini belirleyebildiğimiz, ücretli ve
    // faturalandırılabilir satışlar girer. Eksik eski kayıtlar diğer satışların
    // senkronizasyonunu durdurmaz.
    const sales = normalizedSales.filter(
      (sale) => sale.accountId && sale.customerName && sale.customerEmail && sale.subtotal > 0,
    );

    return res.json({
      sales,
      skippedCount: normalizedSales.length - sales.length,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("İSG Fatura ücretli satış aktarımı hatası:", error?.message || error);
    return res.status(500).json({ message: "Ücretli satış kayıtları hazırlanamadı." });
  }
});

module.exports = router;
