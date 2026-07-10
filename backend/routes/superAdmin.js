const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");

const User = require("../models/User");
const Organization = require("../models/Organization");
const AuditLog = require("../models/AuditLog");
const Notification = require("../models/Notification");
const PlanSetting = require("../models/PlanSetting");
const PLANS = require("../plans");

// ✅ Tüm endpointler super_admin korumalı
router.use(auth, requireRole("super_admin"));

function requestMeta(req) {
  const ip =
    (req.headers["x-forwarded-for"]?.toString()?.split(",")?.[0] || "").trim() ||
    req.ip ||
    "";
  const userAgent = req.headers["user-agent"] || "";
  return { ip, userAgent };
}

async function ensurePlanSettingsSeed() {
  const defaults = Object.values(PLANS || {});

  for (const p of defaults) {
    await PlanSetting.updateOne(
      { code: p.code },
      {
        $setOnInsert: {
          code: p.code,
          name: p.name,
          maxUsers: Number(p.maxUsers || 1),
          monthlyPrice: Number(p.monthlyPrice || 0),
          kdvRate: Number(p.kdvRate ?? 0.2),
          active: true,
        },
      },
      { upsert: true }
    );
  }
}

// ✅ Genel Bakış
router.get("/stats", async (req, res) => {
  try {
    const [users, orgs] = await Promise.all([
      User.countDocuments({}),
      Organization.countDocuments({}),
    ]);

    return res.json({ users, orgs });
  } catch (e) {
    console.error("super/stats error:", e);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});

// ✅ Kurumlar liste
router.get("/organizations", async (req, res) => {
  try {
    const { search = "", status = "" } = req.query;

    const q = {};
    if (status) q.lifecycleStatus = status;

    if (search.trim()) {
      q.$or = [{ name: new RegExp(search.trim(), "i") }];
    }

    const items = await Organization.find(q).sort({ createdAt: -1 }).lean();
    return res.json({ items });
  } catch (e) {
    console.error("super/organizations error:", e);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});

// ✅ Pilot +7 gün uzat (açıklama zorunlu)
router.post("/organizations/:id/pilot/extend7", async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};

    if (!reason || !reason.trim()) {
      return res.status(400).json({ message: "Uzatma açıklaması zorunlu" });
    }

    const org = await Organization.findById(id);
    if (!org) return res.status(404).json({ message: "Kurum bulunamadı" });

    const before = {
      lifecycleStatus: org.lifecycleStatus,
      pilotEnabled: org.pilotEnabled,
      pilotStartAt: org.pilotStartAt,
      pilotEndAt: org.pilotEndAt,
      pilotExtendedCount: org.pilotExtendedCount,
      pilotNotesLast: org.pilotNotesLast,
    };

    // pilotEndAt yoksa “bugün” baz al
    const base = org.pilotEndAt ? new Date(org.pilotEndAt) : new Date();
    base.setDate(base.getDate() + 7);

    org.pilotEnabled = true;
    if (!org.pilotStartAt) org.pilotStartAt = new Date();
    org.pilotEndAt = base;

    org.pilotExtendedCount = Number(org.pilotExtendedCount || 0) + 1;
    org.pilotNotesLast = reason.trim();

    // ❗ Senin kararın: kitleme yok
    // lifecycleStatus'u otomatik değiştirmiyoruz

    await org.save();

    const after = {
      lifecycleStatus: org.lifecycleStatus,
      pilotEnabled: org.pilotEnabled,
      pilotStartAt: org.pilotStartAt,
      pilotEndAt: org.pilotEndAt,
      pilotExtendedCount: org.pilotExtendedCount,
      pilotNotesLast: org.pilotNotesLast,
    };

    const meta = requestMeta(req);

    // ✅ Audit log
    await AuditLog.create({
      actorUserId: req.user.id,
      actorEmail: req.user?.email || "", // non-breaking: varsa yazar, yoksa boş
      action: "ORG_PILOT_EXTEND_7D",
      targetType: "organization",
      targetId: org._id,
      reason: reason.trim(),
      before,
      after,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    // ✅ Notification (opsiyonel, hata verse bile işlemi bozmasın)
    try {
      await Notification.create({
        type: "system",
        module: "genel",
        title: "Pilot Süresi Uzatıldı (+7 gün)",
        message: `${org.name} için pilot süresi +7 gün uzatıldı. Yeni bitiş: ${new Date(
          org.pilotEndAt
        ).toLocaleDateString("tr-TR")}`,
        severity: "info",
        status: "unread",
        link: "/super/kurumlar",
        key: `org:${org._id}:pilotExtend:${org.pilotExtendedCount}`,
      });
    } catch (nerr) {
      console.warn("Notification create failed (ignored):", nerr?.message || nerr);
    }

    return res.json({ ok: true, organization: org });
  } catch (e) {
    console.error("super/extend7 error:", e);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});
// ✅ Paketleri listele
router.get("/plans", async (req, res) => {
  try {
    

    const items = await PlanSetting.find({}).sort({ maxUsers: 1, createdAt: 1 }).lean();
    return res.json({ items });
  } catch (e) {
    console.error("super/plans GET error:", e);
    return res.status(500).json({ message: "Paketler alınamadı" });
  }
});

// ✅ Paket güncelle
router.put("/plans/:code", async (req, res) => {
  try {
    const { code } = req.params;
    const { name, maxUsers, monthlyPrice, kdvRate, active } = req.body || {};

    

    const plan = await PlanSetting.findOne({ code });
    if (!plan) {
      return res.status(404).json({ message: "Paket bulunamadı" });
    }

    const before = {
      code: plan.code,
      name: plan.name,
      maxUsers: plan.maxUsers,
      monthlyPrice: plan.monthlyPrice,
      kdvRate: plan.kdvRate,
      active: plan.active,
    };

    if (typeof name === "string" && name.trim()) plan.name = name.trim();
    if (Number.isFinite(Number(maxUsers))) plan.maxUsers = Number(maxUsers);
    if (Number.isFinite(Number(monthlyPrice))) plan.monthlyPrice = Number(monthlyPrice);
    if (Number.isFinite(Number(kdvRate))) plan.kdvRate = Number(kdvRate);
    if (typeof active === "boolean") plan.active = active;

    await plan.save();

    const after = {
      code: plan.code,
      name: plan.name,
      maxUsers: plan.maxUsers,
      monthlyPrice: plan.monthlyPrice,
      kdvRate: plan.kdvRate,
      active: plan.active,
    };

    const meta = requestMeta(req);

    try {
  await AuditLog.create({
    actorUserId: req.user.id,
    actorEmail: req.user?.email || "",
    action: "PLAN_UPDATED",
    targetType: "plan",
    targetId: plan._id,
    before,
    after,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
} catch (logErr) {
  console.warn("PLAN_UPDATED audit log yazılamadı:", logErr?.message || logErr);
}

return res.json({ ok: true, item: plan });
  } catch (e) {
    console.error("super/plans PUT error:", e);
    return res.status(500).json({ message: "Paket güncellenemedi" });
  }
});

module.exports = router;
