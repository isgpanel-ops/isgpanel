const express = require("express");
const router = express.Router();

const Firma = require("../models/Firma");
const FirmUser = require("../models/FirmUser");

// ✅ Anlık bildirim helper'ları (mevcut kalsın)
const {
  notifyCommercialUserFirmAssigned,
  notifyCommercialUserFirmRemoved,
} = require("../jobs/notificationScheduler");

// auth middleware
const auth = require("../middleware/auth");

// ✅ NEW: Job enqueue (bağımsız)
const {
  enqueueFirmAssigned,
  enqueueFirmRemoved,
} = require("../jobs/firmAssignmentNotificationJob");

// rol helper
const roleOf = (u) => String(u?.role || "").toLowerCase().trim();
const isTicariAdmin = (u) => roleOf(u) === "ticari_admin";
const isTicariUser = (u) => roleOf(u) === "ticari_user";

// ✅ createNotification'ı burada direkt bulalım (scheduler helper'a bağlı kalmayalım)
function safeRequire(paths) {
  for (const p of paths) {
    try {
      // eslint-disable-next-line import/no-dynamic-require, global-require
      return require(p);
    } catch (_) {}
  }
  return null;
}

const notificationSvc =
  safeRequire([
    "../services/notificationService",
    "../services/notificationService.js",
    "../services/notification/notificationService",
    "../services/notification/notificationService.js",
    "../services/notifications/notificationService",
    "../services/notifications/notificationService.js",
  ]) || {};

const createNotification = notificationSvc?.createNotification;

// küçük helperlar
function upTR(s) {
  return (s || "").toLocaleUpperCase("tr-TR");
}
function pickActorName(u) {
  return (
    u?.name ||
    u?.fullName ||
    u?.adSoyad ||
    (u?.personal ? `${u.personal.ad || ""} ${u.personal.soyad || ""}`.trim() : "") ||
    u?.email ||
    "Admin"
  );
}

// ✅ Organizasyon zorunlu (ticari)
function requireOrg(req, res, next) {
  const orgId =
    req.user?.organization?._id ||
    req.user?.organization ||
    req.user?.organizationId ||
    req.user?.orgId;

  if (!orgId) return res.status(400).json({ message: "Organizasyon bulunamadı" });

  req.orgId = orgId;
  next();
}

/**
 * GET /api/firms
 * - Admin: org içindeki tüm firmalar
 * - Ticari_user: sadece atanmış firmalar
 */
router.get("/", auth, requireOrg, async (req, res) => {
  try {
    if (isTicariAdmin(req.user)) {
      const firms = await Firma.find({ organization: req.orgId })
        .sort({ firmaAdi: 1 })
        .lean();
      return res.json({ firms });
    }

    if (isTicariUser(req.user)) {
      const links = await FirmUser.find({
        organization: req.orgId,
        userId: req.user._id || req.user.id,
        isActive: true,
      })
        .select("firmId")
        .lean();

      const firmIds = links.map((x) => x.firmId);
      const firms = await Firma.find({
        organization: req.orgId,
        _id: { $in: firmIds },
      })
        .sort({ firmaAdi: 1 })
        .lean();

      return res.json({ firms });
    }

    return res.status(403).json({ message: "Bu endpoint ticari kullanıcılar içindir." });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});

/**
 * POST /api/firms
 * - Ticari_user: yeni firma ekleyebilir ✅
 *   -> firmayı org'a ekler
 *   -> firmayı otomatik olarak kendine atar (FirmUser upsert)
 * - Admin de ekleyebilir
 */
router.post("/", auth, requireOrg, async (req, res) => {
  try {
    const r = roleOf(req.user);
    if (!(r === "ticari_admin" || r === "ticari_user")) {
      return res.status(403).json({ message: "Yetkisiz" });
    }

    const { firmaAdi, sgkNo, adres, telefon, sektor } = req.body || {};
    if (!firmaAdi) return res.status(400).json({ message: "firmaAdi zorunlu" });

    const firm = await Firma.create({
      organization: req.orgId,
      createdBy: req.user._id || req.user.id,
      firmaAdi,
      sgkNo,
      adres,
      telefon,
      sektor,
      durum: "Aktif",
    });

    // ✅ kullanıcı eklediyse kendine otomatik ata
    if (isTicariUser(req.user)) {
      await FirmUser.updateOne(
        {
          organization: req.orgId,
          firmId: firm._id,
          userId: req.user._id || req.user.id,
        },
        { $set: { isActive: true } },
        { upsert: true }
      );
    }

    return res.status(201).json({ firm });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});

/**
 * ✅ POST /api/firms/:id/assign
 * - Ticari_admin: kullanıcıyı firmaya atar
 * - Bildirim artık JOB ile üretilir
 */
router.post("/:id/assign", auth, requireOrg, async (req, res) => {
  try {
    if (!isTicariAdmin(req.user)) {
      return res.status(403).json({ message: "Yetkisiz" });
    }

    const firmId = req.params.id;
    const targetUserId = req.body?.userId;
    if (!targetUserId) return res.status(400).json({ message: "userId zorunlu" });

    // firma org'a mı ait?
    const firm = await Firma.findOne({ _id: firmId, organization: req.orgId }).lean();
    if (!firm) return res.status(404).json({ message: "Firma bulunamadı" });

    // link oluştur/aktif et
    await FirmUser.updateOne(
      {
        organization: req.orgId,
        firmId,
        userId: targetUserId,
      },
      { $set: { isActive: true, assignedBy: req.user._id || req.user.id } },
      { upsert: true }
    );

    // ✅ JOB'a enqueue (tek kaynak)
    try {
      enqueueFirmAssigned({
        assignedUserId: targetUserId,
        firmId,
        firmName: firm.firmaAdi,
        actorName: upTR(pickActorName(req.user)),
        actionId: Date.now(),
      });
    } catch (e) {
      console.error("enqueueFirmAssigned hata:", e);
    }

    return res.json({ ok: true, message: "Kullanıcı firmaya atandı" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});

/**
 * ✅ POST /api/firms/:id/unassign
 * - Ticari_admin: kullanıcıyı firmadan çıkarır (isActive:false)
 * - Bildirim artık JOB ile üretilir
 */
router.post("/:id/unassign", auth, requireOrg, async (req, res) => {
  try {
    if (!isTicariAdmin(req.user)) {
      return res.status(403).json({ message: "Yetkisiz" });
    }

    const firmId = req.params.id;
    const targetUserId = req.body?.userId;
    if (!targetUserId) return res.status(400).json({ message: "userId zorunlu" });

    // firma org'a mı ait?
    const firm = await Firma.findOne({ _id: firmId, organization: req.orgId }).lean();
    if (!firm) return res.status(404).json({ message: "Firma bulunamadı" });

    // link pasifleştir
    await FirmUser.updateOne(
      {
        organization: req.orgId,
        firmId,
        userId: targetUserId,
      },
      { $set: { isActive: false } }
    );

    // ✅ JOB'a enqueue
    try {
      enqueueFirmRemoved({
        assignedUserId: targetUserId,
        firmId,
        firmName: firm.firmaAdi,
        actorName: upTR(pickActorName(req.user)),
        actionId: Date.now(),
      });
    } catch (e) {
      console.error("enqueueFirmRemoved hata:", e);
    }

    return res.json({ ok: true, message: "Kullanıcı firmadan çıkarıldı" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});

/**
 * PUT /api/firms/:id
 * - Admin: org firması ise günceller
 * - Ticari_user: sadece yetkili (atanmış) olduğu firmayı günceller
 * - Firma silme: kullanıcıya yasak
 */
router.put("/:id", auth, requireOrg, async (req, res) => {
  try {
    const firmId = req.params.id;

    // firma org'a mı ait?
    const firm = await Firma.findOne({ _id: firmId, organization: req.orgId });
    if (!firm) return res.status(404).json({ message: "Firma bulunamadı" });

    // ticari_user ise yetki kontrol
    if (isTicariUser(req.user)) {
      const link = await FirmUser.findOne({
        organization: req.orgId,
        firmId,
        userId: req.user._id || req.user.id,
        isActive: true,
      }).lean();

      if (!link) return res.status(403).json({ message: "Bu firmaya yetkiniz yok" });
    }

    // güncelle
    const allowed = ["firmaAdi", "sgkNo", "adres", "telefon", "sektor", "durum"];
    allowed.forEach((k) => {
      if (req.body?.[k] !== undefined) firm[k] = req.body[k];
    });

    await firm.save();
    return res.json({ firm });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});

module.exports = router;
