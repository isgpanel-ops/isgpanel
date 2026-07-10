const express = require("express");
const auth = require("../middleware/auth");
const Subscription = require("../models/Subscription");
const Organization = require("../models/Organization");
const mongoose = require("mongoose");

const router = express.Router();

const todayISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

function addDaysISO(iso, days) {
  // noon -> timezone edge azaltır
  const [y, m, d] = String(iso || todayISO()).slice(0, 10).split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
  dt.setDate(dt.getDate() + Number(days || 0));
  return dt.toISOString().slice(0, 10);
}

function isCorporate(req) {
  const role = (req.user?.role || "").toString();
  return role === "CORPORATE_ADMIN" || role === "CORPORATE_USER";
}

/**
 * POST /api/subscription/start
 * body: { period: "Aylık"|"Yıllık" }
 * - startDate = bugün
 * - endDate = +30 / +365
 * - corporate ise Organization.subscriptionEnd de güncellenir
 */
router.post("/start", auth, async (req, res) => {
  try {
   const periodInput = req.body?.period;
const pilotDays = Number(req.body?.pilotDays || 0);

let period;
let days;

if (pilotDays > 0) {
  period = "Pilot";
  days = pilotDays;
} else {
  period = periodInput === "Yıllık" ? "Yıllık" : "Aylık";
  days = period === "Yıllık" ? 365 : 30;
}

const startDate = todayISO();
const endDate = addDaysISO(startDate, days);

    if (isCorporate(req)) {
      let orgId = req.user.organizationId;
      if (!orgId) return res.status(400).json({ ok: false, message: "organizationId yok." });

      // orgId UUID geldiyse -> Mongo ObjectId’ye çevir
      if (!mongoose.Types.ObjectId.isValid(String(orgId))) {
        const orgByUuid = await Organization.findOne({ uuid: String(orgId) }).select("_id").lean();
        if (!orgByUuid?._id) return res.status(404).json({ ok: false, message: "Organization bulunamadı (uuid)." });
        orgId = orgByUuid._id;
      }

      // Subscription bul/oluştur
      let sub = await Subscription.findOne({ organizationId: orgId, planType: "CORPORATE" });
      if (!sub) {
        sub = await Subscription.create({
          organizationId: orgId,
          planType: "CORPORATE",
          currentPlanId: "ticari-1-3",
          usersCount: 1,
          period,
          startDate,
          endDate,
        });
      } else {
        sub.period = period;
        sub.startDate = startDate;
        sub.endDate = endDate;
        await sub.save();
      }

      // ✅ Source of truth: Organization.subscriptionEnd de set edelim
      await Organization.updateOne(
        { _id: orgId },
        { $set: { subscriptionEnd: new Date(`${endDate}T23:59:59.000Z`), status: "active" } }
      );

      return res.json({ ok: true, mode: "CORPORATE", startDate, endDate, period });
    }

    // INDIVIDUAL
    const userId = req.user.id;
    let sub = await Subscription.findOne({ userId, planType: "INDIVIDUAL" });
    if (!sub) {
      sub = await Subscription.create({
        userId,
        planType: "INDIVIDUAL",
        currentPlanId: "bireysel_standart",
        period,
        startDate,
        endDate,
      });
    } else {
      sub.period = period;
      sub.startDate = startDate;
      sub.endDate = endDate;
      await sub.save();
    }

    return res.json({ ok: true, mode: "INDIVIDUAL", startDate, endDate, period });
  } catch (e) {
    console.error("POST /subscription/start hata:", e);
    return res.status(500).json({ ok: false, message: e.message || "Sunucu hatası" });
  }
});

module.exports = router;
