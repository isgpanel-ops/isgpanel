// filename: backend/routes/notifications.js
const express = require("express");
const router = express.Router();

const Notification = require("../models/Notification");
const auth = require("../middleware/auth");
const mongoose = require("mongoose"); // ✅ EKLE

const safeLimit = (n, def = 30) => {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return def;
  return Math.min(v, 200);
};

// ✅ Her panelde çalışsın: farklı jwt payload alanlarını yakala
function getUserId(req) {
  return (
    req.userId ||
    req.user?._id ||
    req.user?.id ||
    req.user?.userId ||
    req.user?.sub ||
    null
  );
}

// ✅ Notification.userId = ObjectId olduğundan burada normalize ediyoruz
function normalizeUserId(raw) {
  if (!raw) return null;
  // zaten ObjectId ise
  if (raw instanceof mongoose.Types.ObjectId) return raw;

  const s = String(raw).trim();
  if (!s) return null;

  // ObjectId string ise çevir
  if (mongoose.Types.ObjectId.isValid(s)) return new mongoose.Types.ObjectId(s);

  // ObjectId değilse (örn: numeric id vs) -> null (eşleşmez)
  return null;
}

/**
 * DEBUG: Ticari admin panelde userId niye gelmiyor görmek için
 * GET /api/notifications/whoami
 */
router.get("/whoami", auth, async (req, res) => {
  const raw = getUserId(req);
  const userId = normalizeUserId(raw);
  return res.json({
    ok: true,
    userId,
    rawUserId: raw,
    req_userId: req.userId || null,
    req_user__id: req.user?._id || null,
  });
});

/**
 * GET /api/notifications?status=unread|read&limit=30
 */
router.get("/", auth, async (req, res) => {
  try {
    const userId = normalizeUserId(getUserId(req));
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { status, limit = 30 } = req.query;

    const query = { userId };
    if (status) query.status = status;

    const list = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(safeLimit(limit, 30))
      .lean();

    return res.json(list);
  } catch (err) {
    console.error("GET /api/notifications hata:", err);
    return res.status(500).json({ message: "Bildirimler alınamadı" });
  }
});

/**
 * GET /api/notifications/unread-count
 */
router.get("/unread-count", auth, async (req, res) => {
  try {
    const userId = normalizeUserId(getUserId(req));
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const count = await Notification.countDocuments({ userId, status: "unread" });
    return res.json({ count });
  } catch (err) {
    console.error("GET /unread-count hata:", err);
    return res.status(500).json({ message: "Sayım hatası" });
  }
});

/**
 * PATCH /api/notifications/:id/read
 */
router.patch("/:id/read", auth, async (req, res) => {
  try {
    const userId = normalizeUserId(getUserId(req));
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const updated = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId },
      { $set: { status: "read" } },
      { returnDocument: "after" } // ✅ new yerine
    ).lean();

    if (!updated) return res.status(404).json({ message: "Bildirim bulunamadı" });
    return res.json(updated);
  } catch (err) {
    console.error("PATCH /:id/read hata:", err);
    return res.status(500).json({ message: "Güncelleme hatası" });
  }
});

/**
 * PATCH /api/notifications/read-all
 */
router.patch("/read-all", auth, async (req, res) => {
  try {
    const userId = normalizeUserId(getUserId(req));
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    await Notification.updateMany(
      { userId, status: "unread" },
      { $set: { status: "read" } }
    );
    return res.json({ success: true });
  } catch (err) {
    console.error("PATCH /read-all hata:", err);
    return res.status(500).json({ message: "Toplu güncelleme hatası" });
  }
});

/**
 * POST /api/notifications
 * body: { type,module,title,message,severity,dueDate,link,key,firmId }
 * key varsa: aynı user+key için tekrar üretmez (upsert)
 */
router.post("/", auth, async (req, res) => {
  try {
    const userId = normalizeUserId(getUserId(req)); // ✅ normalize
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const b = req.body || {};
    if (!b.title) return res.status(400).json({ message: "title zorunlu" });

    const payload = {
      userId,
      firmId: b.firmId || undefined,
      type: b.type || "system",
      module: b.module || "genel",
      title: b.title,
      message: b.message || "",
      severity: b.severity || "info",
      status: "unread",
      dueDate: b.dueDate ? new Date(b.dueDate) : undefined,
      link: (b.link || "").trim(),
      key: (b.key || "").trim(),
    };

    if (payload.key) {
      const doc = await Notification.findOneAndUpdate(
        { userId, key: payload.key },
        { $setOnInsert: payload },
        { upsert: true, returnDocument: "after" } // ✅ new yerine
      ).lean();
      return res.status(201).json(doc);
    }

    const created = await Notification.create(payload);
    return res.status(201).json(created);
  } catch (err) {
    console.error("POST /api/notifications hata:", err);
    return res.status(500).json({ message: "Bildirim oluşturulamadı" });
  }
});

/**
 * POST /api/notifications/batch
 * { items:[{ key zorunlu }] } -> spam engel
 */
router.post("/batch", auth, async (req, res) => {
  try {
    const userId = normalizeUserId(getUserId(req));
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (items.length === 0) return res.json({ ok: true, upserted: 0 });

    const ops = items
      .filter((x) => x && x.key)
      .map((x) => {
        const payload = {
          userId,
          firmId: x.firmId || undefined,
          type: x.type || "system",
          module: x.module || "genel",
          title: x.title || "Bildirim",
          message: x.message || "",
          severity: x.severity || "info",
          status: "unread",
          dueDate: x.dueDate ? new Date(x.dueDate) : undefined,
          link: (x.link || "").trim(),
          key: x.key,
        };

        return {
          updateOne: {
            filter: { userId, key: x.key },
            update: { $setOnInsert: payload },
            upsert: true,
          },
        };
      });

    if (ops.length === 0) return res.json({ ok: true, upserted: 0 });

    const r = await Notification.bulkWrite(ops, { ordered: false });
    return res.json({ ok: true, upserted: Number(r.upsertedCount || 0) });
  } catch (err) {
    console.error("POST /batch hata:", err);
    return res.status(500).json({ message: "Batch oluşturma hatası" });
  }
});

/**
 * POST /api/notifications/test
 */
router.post("/test", auth, async (req, res) => {
  try {
    const userId = normalizeUserId(getUserId(req));
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const created = await Notification.create({
      userId,
      type: "system",
      module: "genel",
      title: "Test bildirimi ✅",
      message: "Bu bir test mesajıdır.",
      severity: "info",
      status: "unread",
      link: "",
      key: `test_${Date.now()}`,
    });

    return res.status(201).json(created);
  } catch (err) {
    console.error("POST /test hata:", err);
    return res.status(500).json({ message: "Test bildirimi üretilemedi" });
  }
});

module.exports = router;