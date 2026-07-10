const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const auth = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");

const Announcement = require("../models/Announcement");
const AnnouncementDelivery = require("../models/AnnouncementDelivery");
const User = require("../models/User");

// Notification modeli (superAdmin.js'te de kullanılıyor)
let Notification = null;
try {
  Notification = require("../models/Notification");
} catch (_) {
  Notification = null;
}

/**
 * Ticari admin yakalama için rol varyasyonları (rol üzerinden de yakalayalım)
 * ✅ notificationScheduler.js tarafındaki CORPORATE_ADMIN mantığı ile uyumlu hale getirildi.
 */
const COMMERCIAL_ADMIN_ROLES = [
  "ticari_admin",
  "TICARI_ADMIN",
  "org_admin",
  "ORG_ADMIN",
  "commercial_admin",
  "COMMERCIAL_ADMIN",
  "corporate_admin",
  "CORPORATE_ADMIN",
];

// ✅ super admin guard (mevcut yapı)
router.use(auth, requireRole("super_admin"));

/* ---------------- helpers ---------------- */
function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function isValidObjectId(x) {
  return mongoose.Types.ObjectId.isValid(String(x));
}
function splitTargets(text) {
  return String(text || "")
    .split(/[\r\n,; \t]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function resolveUsersFromTargets(targetList) {
  const targets = (targetList || []).map((x) => String(x).trim()).filter(Boolean);

  const emails = targets.filter((x) => x.includes("@"));
  const ids = targets.filter((x) => !x.includes("@") && isValidObjectId(x));

  const or = [];
  if (emails.length) {
    const emailRegexes = emails.map((e) => new RegExp(`^${escapeRegex(e)}$`, "i"));
    // email alanı projeye göre farklı olabileceği için toleranslı
    or.push({ email: { $in: emailRegexes } });
    or.push({ mail: { $in: emailRegexes } });
    or.push({ eposta: { $in: emailRegexes } });
  }
  if (ids.length) {
    or.push({ _id: { $in: ids } });
  }

  const users = or.length
    ? await User.find({ $or: or })
        .select("_id email mail eposta role type orgId organizationId extraAdminExpiresAt")
        .lean()
    : [];

  return { users, targets };
}

/**
 * ✅ Scheduler mantığına benzer: role içinde CORPORATE ve ADMIN geçenleri de admin say.
 * (DB'de rol stringleri farklı gelirse bile yakalama şansını artırır.)
 */
function corporateAdminRoleRegex() {
  // "CORPORATE_ADMIN", "ADMIN_CORPORATE", "CORPORATE ... ADMIN" vb.
  return /(CORPORATE.*ADMIN|ADMIN.*CORPORATE)/i;
}

/* ---------------- routes ---------------- */

/**
 * GET /api/super/announcements
 */
router.get("/", async (req, res) => {
  try {
    const { search = "", status, type, priority, page = 1, limit = 20 } = req.query;

    const q = {};
    if (status) q.status = status;
    if (type) q.type = type;
    if (priority) q.priority = priority;

    if (search) {
      q.$or = [
        { title: { $regex: search, $options: "i" } },
        { content: { $regex: search, $options: "i" } },
      ];
    }

    const p = Math.max(parseInt(page, 10) || 1, 1);
    const l = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

    const [items, total] = await Promise.all([
      Announcement.find(q).sort({ createdAt: -1 }).skip((p - 1) * l).limit(l),
      Announcement.countDocuments(q),
    ]);

    return res.json({ ok: true, items, total, page: p, limit: l });
  } catch (err) {
    console.error("GET /super/announcements error:", err);
    return res.status(500).json({ ok: false, message: "Sunucu hatası" });
  }
});

/**
 * GET /api/super/announcements/:id
 */
router.get("/:id", async (req, res) => {
  try {
    const item = await Announcement.findById(req.params.id);
    if (!item) return res.status(404).json({ ok: false, message: "Duyuru bulunamadı" });
    return res.json({ ok: true, item });
  } catch (err) {
    console.error("GET /super/announcements/:id error:", err);
    return res.status(500).json({ ok: false, message: "Sunucu hatası" });
  }
});

/**
 * POST /api/super/announcements
 * Duyuru oluştur (taslak)
 */
router.post("/", async (req, res) => {
  try {
    const payload = req.body || {};

    const doc = await Announcement.create({
      title: payload.title,
      content: payload.content,

      type: payload.type || "bilgilendirme",
      priority: payload.priority || "normal",
      requiredAck: !!payload.requiredAck,

      status: payload.status || "taslak",
      startAt: payload.startAt || null,
      endAt: payload.endAt || null,

      audience: payload.audience || { mode: "all", roles: [], users: [], bulk: "" },

      createdBy: req.user?._id || null,
    });

    return res.json({ ok: true, item: doc });
  } catch (err) {
    console.error("POST /super/announcements error:", err);
    return res.status(500).json({ ok: false, message: "Sunucu hatası" });
  }
});

/**
 * PUT /api/super/announcements/:id
 */
router.put("/:id", async (req, res) => {
  try {
    const updated = await Announcement.findByIdAndUpdate(
      req.params.id,
      { $set: req.body || {} },
      { new: true }
    );

    if (!updated) return res.status(404).json({ ok: false, message: "Duyuru bulunamadı" });
    return res.json({ ok: true, item: updated });
  } catch (err) {
    console.error("PUT /super/announcements/:id error:", err);
    return res.status(500).json({ ok: false, message: "Sunucu hatası" });
  }
});

/**
 * DELETE /api/super/announcements/:id
 */
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Announcement.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ ok: false, message: "Duyuru bulunamadı" });

    await AnnouncementDelivery.deleteMany({ announcementId: deleted._id });
    return res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /super/announcements/:id error:", err);
    return res.status(500).json({ ok: false, message: "Sunucu hatası" });
  }
});

/**
 * POST /api/super/announcements/:id/publish
 * ✅ publish: delivery bas + ticari admin'e notification bas
 */
router.post("/:id/publish", async (req, res) => {
  try {
    const ann = await Announcement.findById(req.params.id);
    if (!ann) return res.status(404).json({ ok: false, message: "Duyuru bulunamadı" });

    // 1) aktif et
    ann.status = "aktif";
    ann.publishedAt = new Date();

    // startAt boşsa şimdi setle (meAnnouncements zaman filtresine takılmasın)
    if (!ann.startAt) ann.startAt = new Date();

    await ann.save();

    // 2) hedef kitleyi çöz
    const audience = ann.audience || { mode: "all" };
    let targetUsers = [];
    let notFoundTargets = [];

    if (audience.mode === "all") {
      targetUsers = await User.find({})
        .select("_id role type orgId organizationId extraAdminExpiresAt")
        .lean();
    } else if (audience.mode === "role") {
      targetUsers = await User.find({ role: { $in: audience.roles || [] } })
        .select("_id role type orgId organizationId extraAdminExpiresAt")
        .lean();
    } else if (audience.mode === "users") {
      const r = await resolveUsersFromTargets(audience.users || []);
      targetUsers = r.users;
      notFoundTargets = r.targets.filter((t) => {
        if (t.includes("@")) {
          return !r.users.some(
            (u) =>
              String(u.email || u.mail || u.eposta || "").toLowerCase() === t.toLowerCase()
          );
        }
        return !r.users.some((u) => String(u._id) === String(t));
      });
    } else if (audience.mode === "bulk") {
      const r = await resolveUsersFromTargets(splitTargets(audience.bulk));
      targetUsers = r.users;
      notFoundTargets = r.targets.filter((t) => {
        if (t.includes("@")) {
          return !r.users.some(
            (u) =>
              String(u.email || u.mail || u.eposta || "").toLowerCase() === t.toLowerCase()
          );
        }
        return !r.users.some((u) => String(u._id) === String(t));
      });
    }

    // 3) delivery bas (meAnnouncements bunu okuyor)
    const now = new Date();
    const deliveryOps = (targetUsers || []).map((u) => ({
      updateOne: {
        filter: { announcementId: ann._id, userId: u._id },
        update: {
          $setOnInsert: {
            announcementId: ann._id,
            userId: u._id,
            status: "delivered",
            deliveredAt: now,
          },
        },
        upsert: true,
      },
    }));

    if (deliveryOps.length) {
      await AnnouncementDelivery.bulkWrite(deliveryOps, { ordered: false });
    }

    /**
     * ✅ 4) TICARI ADMIN BULMA
     * ✅ Mevcut kodu koruyup sadece sorguyu güçlendiriyoruz:
     * - role şartı ZORUNLU (AND)
     * - role: listeden veya CORPORATE+ADMIN regex
     * - extraAdminExpiresAt: yoksa da problem olmasın (exists:false) / null / >= now
     */
    const commercialAdmins = await User.find({
      $and: [
        {
          $or: [
            { role: { $in: COMMERCIAL_ADMIN_ROLES } },
            { role: { $regex: corporateAdminRoleRegex() } },
          ],
        },
        {
          $or: [
            { extraAdminExpiresAt: { $exists: false } },
            { extraAdminExpiresAt: null },
            { extraAdminExpiresAt: { $gte: now } },
          ],
        },
      ],
    })
      .select("_id role type orgId organizationId extraAdminExpiresAt")
      .lean();

    /**
     * ✅✅✅ FIX: Ticari admin'e de DELIVERY bas (meAnnouncements delivery okuyor)
     * Mevcut kodu bozmadan sadece ek bir bulkWrite yapıyoruz.
     */
    const adminDeliveryOps = (commercialAdmins || []).map((u) => ({
      updateOne: {
        filter: { announcementId: ann._id, userId: u._id },
        update: {
          $setOnInsert: {
            announcementId: ann._id,
            userId: u._id,
            status: "delivered",
            deliveredAt: now,
          },
        },
        upsert: true,
      },
    }));

    if (adminDeliveryOps.length) {
      await AnnouncementDelivery.bulkWrite(adminDeliveryOps, { ordered: false });
    }

    // 5) Notification bas (ticari admin panel notifications.js userId ile okuyor)
    const merged = new Map();
    (targetUsers || []).forEach((u) => merged.set(String(u._id), u));
    (commercialAdmins || []).forEach((u) => merged.set(String(u._id), u));
    const notifyUsers = Array.from(merged.values());

    let notificationCreatedCount = 0;

    if (Notification && notifyUsers.length) {
      const severity =
        ann.priority === "cok_yuksek"
          ? "kritik"
          : ann.priority === "yuksek"
          ? "yuksek"
          : ann.priority === "dusuk"
          ? "dusuk"
          : "normal";

      const notifDocs = notifyUsers.map((u) => ({
        userId: u._id,
        type: "system",
        module: "announcements",
        title: ann.title || "Yeni duyuru",
        message: (ann.content || "").slice(0, 5000),
        severity,
        status: "unread",
        link: null, // ✅ yönlendirme yok
        key: `ann:${String(ann._id)}:u:${String(u._id)}`,
        organizationId: u.organizationId || u.orgId || null,
        createdAt: now,
      }));

      try {
        await Notification.insertMany(notifDocs, { ordered: false });
        notificationCreatedCount = notifDocs.length;
      } catch (e) {
        console.warn("Notification insertMany warning:", e?.message || e);
      }
    }

    return res.json({
      ok: true,
      announcementId: ann._id,
      deliveredUserCount: targetUsers.length,
      commercialAdminCount: commercialAdmins.length,
      notificationCreatedCount,
      notFoundTargets: (notFoundTargets || []).slice(0, 50),
    });
  } catch (err) {
    console.error("POST /super/announcements/:id/publish error:", err);
    return res.status(500).json({ ok: false, message: "Sunucu hatası" });
  }
});

module.exports = router;
