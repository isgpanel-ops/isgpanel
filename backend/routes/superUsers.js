// backend/routes/superUsers.js
const express = require("express");
const mongoose = require("mongoose");

const User = require("../models/User");
const Organization = require("../models/Organization");
const Subscription = require("../models/Subscription"); // ✅ eklendi
const AuditLog = require("../models/AuditLog");
const requireSuperAdmin = require("../middleware/requireSuperAdmin");
const { notifyUser } = require("../services/notify");

const router = express.Router();

// --- Abuse thresholds (istersen .env'e taşıyabilirsin)
const IDENTITY_CHANGE_TOTAL_THRESHOLD = 6; // isim+mail toplam değişim >= 6 -> otomatik bloke

/* ---------------- helpers ---------------- */

function mustReason(reason) {
  if (!reason || !String(reason).trim()) {
    const err = new Error("Açıklama zorunlu (log + bildirim).");
    err.status = 400;
    throw err;
  }
  return String(reason).trim();
}

function getIP(req) {
  const xf = req.headers["x-forwarded-for"];
  if (xf) return String(xf).split(",")[0].trim();
  return req.ip || req.connection?.remoteAddress || "";
}

function getUA(req) {
  return String(req.headers["user-agent"] || "");
}

function maskTC(tc) {
  const s = String(tc || "").replace(/\D/g, "");
  if (s.length !== 11) return "";
  return `${s.slice(0, 3)}******${s.slice(9, 11)}`;
}

function getTCFromUser(u) {
  return u?.personal?.tcKimlik || u?.tcKimlikNo || "";
}

async function writeAudit({ req, action, targetType, targetId, reason, before, after }) {
  return AuditLog.create({
    actorUserId: req.user._id,
    actorEmail: req.user.email || "",
    action,
    targetType,
    targetId,
    reason: reason || "",
    before: before ?? null,
    after: after ?? null,
    ip: getIP(req),
    userAgent: getUA(req),
  });
}

function isTicariRole(role) {
  return ["ticari_admin", "ticari_user"].includes(role);
}

function addDaysFrom(baseDate, days) {
  const d = new Date(baseDate);
  d.setDate(d.getDate() + days);
  return d;
}

/* ---------------- list / detail ---------------- */

router.get("/users", requireSuperAdmin, async (req, res) => {
  const { q = "", type = "", status = "", page = "1", limit = "25" } = req.query;

  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(100, Math.max(10, Number(limit) || 25));

  const filter = {};
  if (status) filter.status = status;

  // ✅ DÜZELTME: Bireysel = ticari rollerde olmayan herkes.
  // Böylece role'ü "user", "admin", "bireysel" vb olan bireysellerin hiçbiri kaybolmaz.
  if (type === "bireysel") {
    filter.role = { $nin: ["ticari_admin", "ticari_user"] };
  } else if (type === "ticari") {
    filter.role = { $in: ["ticari_admin", "ticari_user"] };
  }

  if (q && String(q).trim()) {
    const s = String(q).trim();
    filter.$or = [
      { name: { $regex: s, $options: "i" } },
      { email: { $regex: s, $options: "i" } },
    ];
  }

  const total = await User.countDocuments(filter);

  const items = await User.find(filter)
    .select(
      "name email role organization status nameChangeCount emailChangeCount subscriptionEnd personal tcKimlikNo extraAdminExpiresAt"
    )
    .sort({ createdAt: -1 })
    .skip((p - 1) * l)
    .limit(l)
    .lean();

  const orgIds = items.map((u) => u.organization).filter(Boolean);
  const orgs = orgIds.length
    ? await Organization.find({ _id: { $in: orgIds } }).select("_id name").lean()
    : [];
  const orgMap = new Map(orgs.map((o) => [String(o._id), o.name]));

  res.json({
    page: p,
    limit: l,
    total,
    totalPages: Math.max(1, Math.ceil(total / l)),
    items: items.map((u) => {
      const isTicari = isTicariRole(u.role);
      return {
        _id: u._id,
        fullName: u.name || "",
        email: u.email || "",
        type: isTicari ? "ticari" : "bireysel",
        status: u.status || "aktif",
        role: u.role || "",
        orgId: u.organization || null,
        orgName: u.organization ? orgMap.get(String(u.organization)) || "" : "",
        tcMasked: maskTC(getTCFromUser(u)),
        nameChangeCount: u.nameChangeCount || 0,
        emailChangeCount: u.emailChangeCount || 0,
        subscriptionEnd: u.subscriptionEnd || null,
        extraAdminExpiresAt: u.extraAdminExpiresAt || null,
      };
    }),
  });
});

router.get("/users/:id", requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Geçersiz id" });

  const u = await User.findById(id)
    .select(
      "name email role organization status nameChangeCount emailChangeCount autoBlockTriggered blockReason subscriptionEnd personal tcKimlikNo extraAdminExpiresAt"
    )
    .lean();

  if (!u) return res.status(404).json({ message: "Kullanıcı bulunamadı" });

  const org = u.organization
    ? await Organization.findById(u.organization)
        .select("_id name planCode licenseEndAt pilotEndAt lifecycleStatus")
        .lean()
    : null;

  const logs = await AuditLog.find({ targetType: "user", targetId: id })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  const isTicari = isTicariRole(u.role);

  res.json({
    _id: u._id,
    fullName: u.name || "",
    email: u.email || "",
    type: isTicari ? "ticari" : "bireysel",
    status: u.status || "aktif",
    role: u.role || "",
    orgId: u.organization || null,
    orgName: org?.name || "",
    tcMasked: maskTC(getTCFromUser(u)),
    nameChangeCount: u.nameChangeCount || 0,
    emailChangeCount: u.emailChangeCount || 0,
    autoBlockTriggered: !!u.autoBlockTriggered,
    blockReason: u.blockReason || "",
    subscriptionEnd: u.subscriptionEnd || null,
    extraAdminExpiresAt: u.extraAdminExpiresAt || null,

    // Kurum bilgisi (Pilot/Lisans/Durum yönetimi UI için)
    org: org
      ? {
          _id: org._id,
          name: org.name,
          planCode: org.planCode || "",
          licenseEndAt: org.licenseEndAt || null,
          pilotEndAt: org.pilotEndAt || null,
          lifecycleStatus: org.lifecycleStatus || "aktif",
        }
      : null,

    auditLogs: logs.map((l) => ({
      _id: l._id,
      createdAt: l.createdAt,
      actorEmail: l.actorEmail,
      action: l.action,
      reason: l.reason,
      before: l.before ?? null,
      after: l.after ?? null,
      ip: l.ip || "",
      userAgent: l.userAgent || "",
    })),
  });
});

/* ---------------- block/unblock ---------------- */

router.post("/users/:id/block", requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Geçersiz id" });

    const reason = mustReason(req.body?.reason);

    const u = await User.findById(id);
    if (!u) return res.status(404).json({ message: "Kullanıcı bulunamadı" });

    const before = {
      status: u.status || "aktif",
      blockReason: u.blockReason || "",
      blockedAt: u.blockedAt || null,
      autoBlockTriggered: !!u.autoBlockTriggered,
    };

    // 1) hedef kullanıcı bloke
    u.status = "blokeli";
    u.blockReason = reason;
    u.blockedAt = new Date();
    u.blockedBy = req.user?._id || null;
    u.autoBlockTriggered = false;
    await u.save();

    const after = {
      status: u.status,
      blockReason: u.blockReason,
      blockedAt: u.blockedAt,
      autoBlockTriggered: !!u.autoBlockTriggered,
    };

    await writeAudit({
      req,
      action: "USER_BLOCK",
      targetType: "user",
      targetId: u._id,
      reason,
      before,
      after,
    });

    if (typeof notifyUser === "function") {
      await notifyUser({
        user: u,
        title: "Hesabınız bloke edildi",
        message: `Hesabınız super admin tarafından bloke edildi. Sebep: ${reason}`,
      });
    }

// ✅ 2) ticari admin ise -> aynı org’daki ticari_user’ları da bloke et
let cascaded = 0;

const roleNorm = String(u.role || "").toLowerCase();
const isOrgAdmin =
  roleNorm === "ticari_admin" ||
  roleNorm === "ticariadmin" ||
  roleNorm === "corporate_admin" ||
  roleNorm === "firm_admin";

if (isOrgAdmin && u.organization) {
  const r = await User.updateMany(
    {
      organization: u.organization,
      role: {
        $in: [
          "ticari_user",
          "TICARI_USER",
          "corporate_user",
          "CORPORATE_USER",
          "FIRM_USER",
          "firm_user",
        ],
      },
      status: { $ne: "blokeli" },
    },
    {
      $set: {
        status: "blokeli",
        blockReason: `ORG_ADMIN_BLOCK: ${reason}`,
        blockedAt: new Date(),
        blockedBy: req.user?._id || null,
        autoBlockTriggered: false,
      },
    }
  );

  cascaded = r?.modifiedCount || 0;

  await writeAudit({
    req,
    action: "ORG_USERS_BLOCK",
    targetType: "organization",
    targetId: u.organization,
    reason: `Admin bloke edildi → org kullanıcıları bloke. Sebep: ${reason}`,
    before: null,
    after: { blockedUsers: cascaded },
  });
}

    res.json({ ok: true, cascaded });
  } catch (e) {
    res.status(e.status || 500).json({ message: e.message || "Hata" });
  }
});

router.post("/users/:id/unblock", requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Geçersiz id" });

    const reason = mustReason(req.body?.reason);

    const u = await User.findById(id);
    if (!u) return res.status(404).json({ message: "Kullanıcı bulunamadı" });

    const before = {
      status: u.status || "aktif",
      blockReason: u.blockReason || "",
      blockedAt: u.blockedAt || null,
      autoBlockTriggered: !!u.autoBlockTriggered,
    };

    // 1) hedef kullanıcı aç
    u.status = "aktif";
    u.blockReason = "";
    u.blockedAt = null;
    u.blockedBy = null;
    u.autoBlockTriggered = false;
    await u.save();

    const after = {
      status: u.status,
      blockReason: u.blockReason,
      blockedAt: u.blockedAt,
      autoBlockTriggered: !!u.autoBlockTriggered,
    };

    await writeAudit({
      req,
      action: "USER_UNBLOCK",
      targetType: "user",
      targetId: u._id,
      reason,
      before,
      after,
    });

    if (typeof notifyUser === "function") {
      await notifyUser({
        user: u,
        title: "Hesabınız yeniden aktif",
        message: `Hesabınızın blokesi kaldırıldı. Açıklama: ${reason}`,
      });
    }

    // ✅ 2) ticari admin ise -> aynı org’daki ticari_user’ları da aç
    let cascaded = 0;
   const roleNorm = String(u.role || "").toLowerCase();

const isOrgAdmin =
  roleNorm === "ticari_admin" ||
  roleNorm === "ticariadmin" ||
  roleNorm === "corporate_admin" ||
  roleNorm === "firm_admin";



if (isOrgAdmin && u.organization) {
  const r = await User.updateMany(
    {
      organization: u.organization,
      role: { $in: ["ticari_user", "TICARI_USER", "corporate_user", "CORPORATE_USER", "FIRM_USER", "firm_user"] },
      status: "blokeli",
      // istersen sadece admin kaynaklıları aç:
      // blockReason: { $regex: "^ORG_ADMIN_BLOCK:" },
    },
    {
      $set: {
        status: "aktif",
        blockReason: "",
        blockedAt: null,
        blockedBy: null,
        autoBlockTriggered: false,
      },
    }
  );

  cascaded = r?.modifiedCount || 0;
 
      await writeAudit({
        req,
        action: "ORG_USERS_UNBLOCK",
        targetType: "organization",
        targetId: u.organization,
        reason: `Admin blokesi kaldırıldı → org kullanıcıları açıldı. Açıklama: ${reason}`,
        before: null,
        after: { unblockedUsers: cascaded },
      });
    }

    res.json({ ok: true, cascaded });
  } catch (e) {
    res.status(e.status || 500).json({ message: e.message || "Hata" });
  }
});

/* ---------------- identity update (name/email) + auto-block ---------------- */

router.patch("/users/:id/identity", requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Geçersiz id" });

    const reason = mustReason(req.body?.reason);
    const nextName = req.body?.name != null ? String(req.body.name).trim() : null;
    const nextEmail = req.body?.email != null ? String(req.body.email).trim().toLowerCase() : null;

    if (nextName === null && nextEmail === null) {
      return res.status(400).json({ message: "name veya email gönder" });
    }

    const u = await User.findById(id);
    if (!u) return res.status(404).json({ message: "Kullanıcı bulunamadı" });

    const before = {
      name: u.name,
      email: u.email,
      nameChangeCount: u.nameChangeCount || 0,
      emailChangeCount: u.emailChangeCount || 0,
      status: u.status || "aktif",
      autoBlockTriggered: !!u.autoBlockTriggered,
    };

    let changed = false;

    if (nextName !== null && nextName && nextName !== u.name) {
      u.name = nextName;
      u.nameChangeCount = (u.nameChangeCount || 0) + 1;
      u.lastIdentityChangeAt = new Date();
      changed = true;

      await writeAudit({
        req,
        action: "NAME_CHANGE",
        targetType: "user",
        targetId: u._id,
        reason,
        before: { name: before.name },
        after: { name: u.name },
      });
    }

    if (nextEmail !== null && nextEmail && nextEmail !== u.email) {
      const exists = await User.findOne({ email: nextEmail, _id: { $ne: u._id } }).select("_id").lean();
      if (exists) return res.status(400).json({ message: "Bu email zaten kullanılıyor." });

      u.email = nextEmail;
      u.emailChangeCount = (u.emailChangeCount || 0) + 1;
      u.lastIdentityChangeAt = new Date();
      changed = true;

      await writeAudit({
        req,
        action: "EMAIL_CHANGE",
        targetType: "user",
        targetId: u._id,
        reason,
        before: { email: before.email },
        after: { email: u.email },
      });
    }

    if (!changed) return res.json({ ok: true, message: "Değişiklik yok" });

    const total = (u.nameChangeCount || 0) + (u.emailChangeCount || 0);
    if (total >= IDENTITY_CHANGE_TOTAL_THRESHOLD && u.status !== "blokeli") {
      u.status = "blokeli";
      u.autoBlockTriggered = true;
      u.blockReason = `Aşırı kimlik değişimi (toplam=${total}). Otomatik bloke.`;
      u.blockedAt = new Date();
      u.blockedBy = null;

      await writeAudit({
        req,
        action: "AUTO_BLOCK",
        targetType: "user",
        targetId: u._id,
        reason: u.blockReason,
        before: { status: before.status },
        after: { status: u.status, autoBlockTriggered: true },
      });

      if (typeof notifyUser === "function") {
        await notifyUser({
          user: u,
          title: "Hesabınız güvenlik nedeniyle bloke edildi",
          message: "Sık kimlik değişikliği tespit edildi. Destek ile iletişime geçin.",
        });
      }
    }

    await u.save();

    const after = {
      name: u.name,
      email: u.email,
      nameChangeCount: u.nameChangeCount || 0,
      emailChangeCount: u.emailChangeCount || 0,
      status: u.status || "aktif",
      autoBlockTriggered: !!u.autoBlockTriggered,
    };

    res.json({ ok: true, before, after });
  } catch (e) {
    res.status(e.status || 500).json({ message: e.message || "Hata" });
  }
});

/* ---------------- subscription extend ---------------- */

router.post("/users/:id/subscription/extend", requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Geçersiz id" });

    const reason = mustReason(req.body?.reason);
    const days = Number(req.body?.days);
    if (!Number.isFinite(days) || days <= 0) return res.status(400).json({ message: "days pozitif olmalı" });

    const u = await User.findById(id);
    if (!u) return res.status(404).json({ message: "Kullanıcı bulunamadı" });

    const oldEnd = u.subscriptionEnd || null;

    const isTicari = isTicariRole(u.role);
    const isTicariAdmin = String(u.role || "") === "ticari_admin";

    // 0) önce hedef kullanıcıyı uzat (bireyselde bu yeterli)
    const now = new Date();
    const base = u.subscriptionEnd && new Date(u.subscriptionEnd) > now ? new Date(u.subscriptionEnd) : now;
    u.subscriptionEnd = addDaysFrom(base, days);
    await u.save();

    let cascadedUsers = 0;
    let newOrgEndForAll = null;

    if (!isTicari) {
      // 1) Bireysel sync
      await Subscription.findOneAndUpdate(
        { userId: u._id, planType: "INDIVIDUAL" },
        { $set: { endDate: u.subscriptionEnd } }
      );
    } else {
      // 2) Ticari sync (org bazlı)
      if (u.organization) {
        const orgLean = await Organization.findById(u.organization)
          .select("_id subscriptionEnd licenseEndAt")
          .lean();

        if (orgLean?._id) {
          const now2 = new Date();
          const orgBase =
            orgLean.subscriptionEnd && new Date(orgLean.subscriptionEnd) > now2
              ? new Date(orgLean.subscriptionEnd)
              : now2;

          const newOrgEnd = addDaysFrom(orgBase, days);
          newOrgEndForAll = newOrgEnd;

          await Organization.updateOne(
            { _id: orgLean._id },
            { $set: { subscriptionEnd: newOrgEnd } }
          );

          await Subscription.findOneAndUpdate(
            { organizationId: orgLean._id, planType: "CORPORATE" },
            { $set: { endDate: newOrgEnd } }
          );

          /**
           * ✅ YENİ: ticari_admin uzatıldıysa → aynı org’daki tüm ticari_user’ların
           * User.subscriptionEnd değerini de org bitişiyle aynı yap
           */
          if (isTicariAdmin) {
            const r = await User.updateMany(
              {
                organization: orgLean._id,
                role: { $in: ["ticari_admin", "ticari_user"] },
              },
              { $set: { subscriptionEnd: newOrgEnd } }
            );
            cascadedUsers = r?.modifiedCount || 0;
          } else {
            // admin değilse en azından kendisini org bitişine hizala (tutarlılık)
            await User.updateOne(
              { _id: u._id },
              { $set: { subscriptionEnd: newOrgEnd } }
            );
            u.subscriptionEnd = newOrgEnd;
          }
        }
      }
    }

    // 🔽 (MEVCUT KODUN KALSIN) kuruma bağlıysa lisans da uzat
    if (u.organization) {
      const org = await Organization.findById(u.organization);
      if (org) {
        const now3 = new Date();
        const orgBase =
          org.licenseEndAt && new Date(org.licenseEndAt) > now3
            ? new Date(org.licenseEndAt)
            : now3;

        org.licenseEndAt = addDaysFrom(orgBase, days);
        await org.save();
      }
    }

    await writeAudit({
      req,
      action: "SUBSCRIPTION_EXTEND",
      targetType: "user",
      targetId: u._id,
      reason,
      before: { subscriptionEnd: oldEnd },
      after: {
        subscriptionEnd: newOrgEndForAll || u.subscriptionEnd,
        cascadedUsers,
        licenseEndAt: u.organization ? (await Organization.findById(u.organization)).licenseEndAt : null,
      },
    });

    if (typeof notifyUser === "function") {
      await notifyUser({
        user: u,
        title: "Süre güncellendi",
        message: `Süreniz +${days} gün uzatıldı. Açıklama: ${reason}`,
      });
    }

    let licenseEndAt = null;
    if (u.organization) {
      const org = await Organization.findById(u.organization).select("licenseEndAt");
      licenseEndAt = org?.licenseEndAt || null;
    }

    return res.json({
      ok: true,
      subscriptionEnd: newOrgEndForAll || u.subscriptionEnd,
      licenseEndAt,
      cascadedUsers, // ✅ admin ise kaç kullanıcı etkilendi
    });
  } catch (e) {
    return res.status(e.status || 500).json({ message: e.message || "Hata" });
  }
}); 

/* ---------------- extra admin grant/revoke ---------------- */

router.post("/users/:id/extra-admin/grant", requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Geçersiz id" });

    const reason = mustReason(req.body?.reason);
    const expiresAt = req.body?.expiresAt ? new Date(req.body.expiresAt) : null;
    if (expiresAt && isNaN(expiresAt.getTime())) return res.status(400).json({ message: "expiresAt geçersiz" });

    const u = await User.findById(id);
    if (!u) return res.status(404).json({ message: "Kullanıcı bulunamadı" });

    if (!u.organization) return res.status(400).json({ message: "Bu kullanıcı ticari bir kuruma bağlı değil." });

    const before = { role: u.role, extraAdminExpiresAt: u.extraAdminExpiresAt || null };

    u.role = "ticari_admin";
    u.extraAdminExpiresAt = expiresAt || null;

    await u.save();

    await writeAudit({
      req,
      action: "EXTRA_ADMIN_GRANT",
      targetType: "user",
      targetId: u._id,
      reason,
      before,
      after: { role: u.role, extraAdminExpiresAt: u.extraAdminExpiresAt || null },
    });

    if (typeof notifyUser === "function") {
      await notifyUser({
        user: u,
        title: "Ekstra admin yetkisi verildi",
        message: `Ekstra admin yetkisi verildi. Bitiş: ${
          expiresAt ? expiresAt.toISOString() : "Süresiz"
        }. Açıklama: ${reason}`,
      });
    }

    res.json({ ok: true, role: u.role, extraAdminExpiresAt: u.extraAdminExpiresAt || null });
  } catch (e) {
    res.status(e.status || 500).json({ message: e.message || "Hata" });
  }
});

router.post("/users/:id/extra-admin/revoke", requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Geçersiz id" });

    const reason = mustReason(req.body?.reason);

    const u = await User.findById(id);
    if (!u) return res.status(404).json({ message: "Kullanıcı bulunamadı" });

    const before = { role: u.role, extraAdminExpiresAt: u.extraAdminExpiresAt || null };

    if (u.role === "ticari_admin") u.role = "ticari_user";
    u.extraAdminExpiresAt = null;

    await u.save();

    await writeAudit({
      req,
      action: "EXTRA_ADMIN_REVOKE",
      targetType: "user",
      targetId: u._id,
      reason,
      before,
      after: { role: u.role, extraAdminExpiresAt: null },
    });

    if (typeof notifyUser === "function") {
      await notifyUser({
        user: u,
        title: "Ekstra admin yetkisi kaldırıldı",
        message: `Ekstra admin yetkisi kaldırıldı. Açıklama: ${reason}`,
      });
    }

    res.json({ ok: true, role: u.role, extraAdminExpiresAt: null });
  } catch (e) {
    res.status(e.status || 500).json({ message: e.message || "Hata" });
  }
});

/* ---------------- NEW: ORG (pilot / lisans / durum / plan) update ---------------- */
/**
 * PATCH /users/:id/org
 * body: { lifecycleStatus, pilotEndAt, licenseEndAt, planCode, reason }
 * - reason zorunlu
 * - pilotEndAt/licenseEndAt: ISO string | null | ""
 */
router.patch("/users/:id/org", requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Geçersiz id" });

    const reason = mustReason(req.body?.reason);

    const u = await User.findById(id).select("organization").lean();
    if (!u) return res.status(404).json({ message: "Kullanıcı bulunamadı" });
    if (!u.organization) return res.status(400).json({ message: "Kullanıcı bir kuruma bağlı değil." });

    const org = await Organization.findById(u.organization);
    if (!org) return res.status(404).json({ message: "Kurum bulunamadı" });

    const before = {
      lifecycleStatus: org.lifecycleStatus ?? null,
      pilotEndAt: org.pilotEndAt ?? null,
      licenseEndAt: org.licenseEndAt ?? null,
      planCode: org.planCode ?? null,
    };

    if (req.body.lifecycleStatus != null) {
      const v = String(req.body.lifecycleStatus);
      if (!["aktif", "askida", "pasif"].includes(v)) {
        return res.status(400).json({ message: "lifecycleStatus: aktif | askida | pasif olmalı" });
      }
      org.lifecycleStatus = v;
    }

    if (req.body.planCode != null) {
      org.planCode = String(req.body.planCode || "").trim();
    }

    if (req.body.pilotEndAt !== undefined) {
      if (!req.body.pilotEndAt) {
        org.pilotEndAt = null;
      } else {
        const d = new Date(req.body.pilotEndAt);
        if (isNaN(d.getTime())) return res.status(400).json({ message: "pilotEndAt geçersiz" });
        org.pilotEndAt = d;
      }
    }

    if (req.body.licenseEndAt !== undefined) {
      if (!req.body.licenseEndAt) {
        org.licenseEndAt = null;
      } else {
        const d = new Date(req.body.licenseEndAt);
        if (isNaN(d.getTime())) return res.status(400).json({ message: "licenseEndAt geçersiz" });
        org.licenseEndAt = d;
      }
    }

    await org.save();

    const after = {
      lifecycleStatus: org.lifecycleStatus ?? null,
      pilotEndAt: org.pilotEndAt ?? null,
      licenseEndAt: org.licenseEndAt ?? null,
      planCode: org.planCode ?? null,
    };

    await writeAudit({
      req,
      action: "ORG_UPDATE",
      targetType: "organization",
      targetId: org._id,
      reason,
      before,
      after,
    });

    res.json({
      ok: true,
      org: { _id: org._id, name: org.name, ...after },
    });
  } catch (e) {
    res.status(e.status || 500).json({ message: e.message || "Hata" });
  }
});

module.exports = router;
