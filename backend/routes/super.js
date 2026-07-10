// routes/super.js
const express = require("express");
const router = express.Router();

const { requireAuth, requireSuperAdmin } = require("../middleware/auth");

const User = require("../models/User");
const Subscription = require("../models/Subscription");
const PaymentSession = require("../models/PaymentSession");

// ===============================
// SUPER OVERVIEW
// ===============================

router.get("/overview", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const range = String(req.query.range || "7d");
    const now = new Date();

    const rangeDays = rangeToDays(range);
    const cut = daysAgo(now, rangeDays);

    const [bireyselTotal, ticariTotal] = await Promise.all([
      User.countDocuments({ type: "bireysel" }),
      User.countDocuments({ type: "ticari" }),
    ]);

    const [bireyselStatusAgg, ticariStatusAgg] = await Promise.all([
      statusAgg("bireysel"),
      statusAgg("ticari"),
    ]);

    const engagementWindows = [1, 7, 15, 30];
    const bireyselActiveCounts = await Promise.all(
      engagementWindows.map((d) =>
        User.countDocuments({
          type: "bireysel",
          lastLoginAt: { $gte: daysAgo(now, d) },
        })
      )
    );

    const engagement = {
      bireysel: {
        "1d": {
          active: bireyselActiveCounts[0],
          passive: Math.max(0, bireyselTotal - bireyselActiveCounts[0]),
        },
        "7d": {
          active: bireyselActiveCounts[1],
          passive: Math.max(0, bireyselTotal - bireyselActiveCounts[1]),
        },
        "15d": {
          active: bireyselActiveCounts[2],
          passive: Math.max(0, bireyselTotal - bireyselActiveCounts[2]),
        },
        "30d": {
          active: bireyselActiveCounts[3],
          passive: Math.max(0, bireyselTotal - bireyselActiveCounts[3]),
        },
      },
    };

    let kpis = { newSubscriptions: 0, cancellations: 0 };

    if (Subscription) {
      const [newSubs, cancels] = await Promise.all([
        Subscription.countDocuments({
          createdAt: { $gte: cut },
          status: { $in: ["active", "trialing"] },
        }),
        Subscription.countDocuments({
          cancelledAt: { $gte: cut },
          status: { $in: ["canceled", "cancelled"] },
        }),
      ]);

      kpis = {
        newSubscriptions: newSubs,
        cancellations: cancels,
      };
    }

    const systemHealth = {
      apiLatencyAvg: null,
      apiLatencyP95: null,
      cpu: null,
      ram: null,
      disk: null,
      errorRate: null,
      cronStatus: null,
      cronLastRun: null,
    };

    const activities = [];

    return res.json({
      range,
      users: {
        bireysel: {
          total: bireyselTotal,
          status: bireyselStatusAgg,
        },
        ticari: {
          total: ticariTotal,
          status: ticariStatusAgg,
        },
      },
      engagement,
      kpis,
      systemHealth,
      activities,
    });
  } catch (err) {
    console.error("super/overview error:", err);
    return res.status(500).json({ message: "Overview verisi alınamadı." });
  }
});

// ===============================
// SUPER FATURALAR
// ===============================

router.get("/invoices", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const sessions = await PaymentSession.find({
      $or: [
        { status: { $in: ["paid", "success", "completed"] } },
        { paymentStatus: { $in: ["paid", "success", "completed"] } },
      ],
    })
      .sort({ paidAt: -1, paymentDate: -1, updatedAt: -1, createdAt: -1 })
      .lean();

    const rows = sessions.map((s) => {
      const b = s.billingInfo || {};

      const rawPeriod =
        s.period || s.billingPeriod || s.packagePeriod || s.subscriptionPeriod;

      const period =
        rawPeriod === "yearly" ||
        rawPeriod === "annual" ||
        rawPeriod === "yillik" ||
        rawPeriod === "Yıllık"
          ? "Yıllık"
          : "Aylık";

      const amount = Number(
        s.amount ||
          s.paidAmount ||
          s.price ||
          s.totalAmount ||
          s.paymentAmount ||
          0
      );

      const vat = Number(s.vat || s.kdv || s.taxAmount || 0);

      return {
        id: String(s._id),
        paymentSessionId: String(s._id),

        title:
          b.companyTitle ||
          b.unvan ||
          b.title ||
          b.fullName ||
          b.adSoyad ||
          s.customerName ||
          s.name ||
          "—",

        type: b.type || b.invoiceType || b.faturaTipi || "—",

        taxNumber:
          b.taxNumber ||
          b.vergiNo ||
          b.tcNo ||
          b.tckn ||
          b.identityNumber ||
          "",

        taxOffice: b.taxOffice || b.vergiDairesi || "",

        email: b.email || s.email || s.customerEmail || "",
        phone: b.phone || b.telefon || s.phone || "",
        address: b.address || b.adres || "",
        city: b.city || b.il || "",
        district: b.district || b.ilce || "",

        planCode:
          s.planCode ||
          s.packageCode ||
          s.packageName ||
          s.paket ||
          s.plan ||
          "—",

        period,
        amount,
        vat,

        paidAt: s.paidAt || s.paymentDate || s.updatedAt || s.createdAt,

        invoiceStatus: s.invoiceStatus || "READY_TO_INVOICE",

        invoiceNo: s.invoiceNo || "",
        invoiceNote: s.invoiceNote || "",

        rawStatus: s.status || s.paymentStatus || "",
      };
    });

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const totalRevenue = rows.reduce(
      (sum, r) => sum + Number(r.amount || 0),
      0
    );

    const monthRevenue = rows
      .filter((r) => {
        const d = new Date(r.paidAt);
        return (
          !Number.isNaN(d.getTime()) &&
          d.getMonth() === currentMonth &&
          d.getFullYear() === currentYear
        );
      })
      .reduce((sum, r) => sum + Number(r.amount || 0), 0);

    const yearRevenue = rows
      .filter((r) => {
        const d = new Date(r.paidAt);
        return !Number.isNaN(d.getTime()) && d.getFullYear() === currentYear;
      })
      .reduce((sum, r) => sum + Number(r.amount || 0), 0);

    const waitingCount = rows.filter(
      (r) => r.invoiceStatus === "READY_TO_INVOICE"
    ).length;

    return res.json({
      rows,
      stats: {
        totalRevenue,
        monthRevenue,
        yearRevenue,
        waitingCount,
      },
    });
  } catch (err) {
    console.error("super/invoices error:", err);
    return res.status(500).json({
      message: "Fatura kayıtları alınamadı.",
    });
  }
});

router.patch(
  "/invoices/:id/status",
  requireAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const invoiceStatus = String(req.body.invoiceStatus || "");

      const allowed = [
        "READY_TO_INVOICE",
        "INVOICE_DRAFT",
        "OFFICIAL_ISSUED",
      ];

      if (!allowed.includes(invoiceStatus)) {
        return res.status(400).json({
          message: "Geçersiz fatura durumu.",
        });
      }

      const updated = await PaymentSession.findByIdAndUpdate(
        req.params.id,
        {
          invoiceStatus,
          invoiceStatusUpdatedAt: new Date(),
          invoiceStatusUpdatedBy: req.user?.id || req.user?._id || null,
        },
        { new: true }
      ).lean();

      if (!updated) {
        return res.status(404).json({
          message: "PaymentSession bulunamadı.",
        });
      }

      return res.json({
        ok: true,
        invoiceStatus: updated.invoiceStatus,
      });
    } catch (err) {
      console.error("super/invoices status error:", err);
      return res.status(500).json({
        message: "Fatura durumu güncellenemedi.",
      });
    }
  }
);

// ---------------- helpers ----------------

function rangeToDays(r) {
  if (r === "1d") return 1;
  if (r === "7d") return 7;
  if (r === "15d") return 15;
  if (r === "30d") return 30;
  return 7;
}

function daysAgo(now, days) {
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  return d;
}

async function statusAgg(type) {
  const rows = await User.aggregate([
    { $match: { type } },
    { $group: { _id: "$status", c: { $sum: 1 } } },
  ]);

  const map = { aktif: 0, askida: 0, pasif: 0, blokeli: 0 };

  for (const r of rows) {
    const k = (r._id || "aktif").toString().toLowerCase();
    if (map[k] === undefined) map[k] = 0;
    map[k] += r.c || 0;
  }

  return map;
}

module.exports = router;