const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");

const Announcement = require("../models/Announcement");
const AnnouncementDelivery = require("../models/AnnouncementDelivery");

router.use(auth);

/**
 * GET /api/me/announcements
 * Normal: sadece aktif + zaman uygun + delivery varsa
 * Debug:
 *  - ?debug=1       -> hidden nedenlerini döner
 *  - ?includeAll=1  -> aktif/tarih filtresi olmadan, delivery varsa getirir (test için)
 */
router.get("/", async (req, res) => {
  try {
    const userId = req.user._id;
    const now = new Date();

    const debug = String(req.query.debug || "") === "1";
    const includeAll = String(req.query.includeAll || "") === "1";

    const deliveries = await AnnouncementDelivery.find({
      userId,
      status: { $ne: "failed" },
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const announcementIds = deliveries.map((d) => d.announcementId);

    if (announcementIds.length === 0) {
      return res.json(
        debug
          ? { ok: true, items: [], debug: { deliveryCount: 0, announcementIds: [] } }
          : { ok: true, items: [] }
      );
    }

    const q = { _id: { $in: announcementIds } };

    if (!includeAll) {
      q.status = "aktif";
      q.$and = [
        { $or: [{ startAt: null }, { startAt: { $lte: now } }] },
        { $or: [{ endAt: null }, { endAt: { $gte: now } }] },
      ];
    }

    const anns = await Announcement.find(q)
      .sort({ publishedAt: -1, createdAt: -1 })
      .lean();

    const deliveryMap = new Map(deliveries.map((d) => [String(d.announcementId), d]));

    const items = anns.map((a) => {
      const d = deliveryMap.get(String(a._id));
      return {
        ...a,
        delivery: d
          ? {
              deliveredAt: d.deliveredAt,
              readAt: d.readAt,
              ackAt: d.ackAt,
              status: d.status,
            }
          : null,
      };
    });

    if (!debug) return res.json({ ok: true, items });

    // debug: filtreye takılan duyurular
    const allAnns = await Announcement.find({ _id: { $in: announcementIds } }).lean();
    const visibleIds = new Set(items.map((x) => String(x._id)));

    const hiddenPreview = allAnns
      .filter((a) => !visibleIds.has(String(a._id)))
      .map((a) => {
        const reasons = [];
        if (a.status !== "aktif") reasons.push(`status:${a.status}`);
        if (a.startAt && new Date(a.startAt) > now) reasons.push("startAt_future");
        if (a.endAt && new Date(a.endAt) < now) reasons.push("endAt_past");
        return {
          id: a._id,
          title: a.title,
          status: a.status,
          startAt: a.startAt,
          endAt: a.endAt,
          reasons,
        };
      })
      .slice(0, 20);

    return res.json({
      ok: true,
      items,
      debug: {
        now,
        userId,
        includeAll,
        deliveryCount: deliveries.length,
        announcementIds,
        hiddenCount: allAnns.length - items.length,
        hiddenPreview,
      },
    });
  } catch (err) {
    console.error("GET /me/announcements error:", err);
    return res.status(500).json({ ok: false, message: "Sunucu hatası" });
  }
});

/** POST /api/me/announcements/:id/read */
router.post("/:id/read", async (req, res) => {
  try {
    const userId = req.user._id;
    const announcementId = req.params.id;

    const updated = await AnnouncementDelivery.findOneAndUpdate(
      { userId, announcementId },
      { $set: { readAt: new Date(), status: "delivered" } },
      { new: true }
    );

    if (!updated) return res.status(404).json({ ok: false, message: "Kayıt bulunamadı" });
    return res.json({ ok: true });
  } catch (err) {
    console.error("POST /me/announcements/:id/read error:", err);
    return res.status(500).json({ ok: false, message: "Sunucu hatası" });
  }
});

/** POST /api/me/announcements/:id/ack */
router.post("/:id/ack", async (req, res) => {
  try {
    const userId = req.user._id;
    const announcementId = req.params.id;

    const updated = await AnnouncementDelivery.findOneAndUpdate(
      { userId, announcementId },
      { $set: { ackAt: new Date(), status: "delivered" } },
      { new: true }
    );

    if (!updated) return res.status(404).json({ ok: false, message: "Kayıt bulunamadı" });
    return res.json({ ok: true });
  } catch (err) {
    console.error("POST /me/announcements/:id/ack error:", err);
    return res.status(500).json({ ok: false, message: "Sunucu hatası" });
  }
});

module.exports = router;
