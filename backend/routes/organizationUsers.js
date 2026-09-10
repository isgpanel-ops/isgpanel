const express = require("express");
const router = express.Router();

const User = require("../models/User");
const Organization = require("../models/Organization");
const FirmUser = require("../models/FirmUser");
const IsgKatipAssignment = require("../models/IsgKatipAssignment");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const AdminPanelAccessLog = require("../models/AdminPanelAccessLog");
const { sendUserPasswordMail } = require("../services/mailService");

function safeRequire(paths) {
  for (const p of paths) {
    try {
      // eslint-disable-next-line import/no-dynamic-require, global-require
      return require(p);
    } catch (_) {}
  }
  return null;
}

const { createNotification } =
  safeRequire([
    "../services/notificationService",
    "../services/notificationService.js",
    "../services/notification/notificationService",
    "../services/notification/notificationService.js",
    "../services/notifications/notificationService",
    "../services/notifications/notificationService.js",
  ]) || {};

const upTR = (str = "") => String(str || "").toLocaleUpperCase("tr-TR");
const activeUserRoles = ["ticari_user", "isyeri_hekimi"];

const isCorporateAdmin = (user) => ["ticari_admin", "admin"].includes(String(user?.role || "").toLowerCase());
const getHekimLimit = (organization) => Math.ceil(Math.max(0, Number(organization?.userLimit) || 0) / 2);

async function assertRoleSeatAvailable({ org, orgId, role, excludeUserId = null }) {
  const countFilter = { organization: orgId, role };
  if (excludeUserId) countFilter._id = { $ne: excludeUserId };

  const used = await User.countDocuments(countFilter);
  const limit = role === "isyeri_hekimi" ? getHekimLimit(org) : Number(org.userLimit) || 0;
  const label = role === "isyeri_hekimi" ? "İşyeri hekimi" : "İş güvenliği uzmanı";

  if (used >= limit) {
    const error = new Error(`${label} limitiniz dolmuştur (Limit: ${limit}).`);
    error.statusCode = 400;
    throw error;
  }
}

router.use((req, res, next) => {
  const requestedOrgId = req.params.orgId || String(req.path || "").split("/").filter(Boolean)[0] || "";
  // Yönetici görünümü hedef kullanıcının çalışma alanıdır; kullanıcı yönetimine
  // buradan erişilmez. Sadece görünümü kapatma isteğine izin verilir.
  if (req.impersonation) {
    if (req.method === "POST" && /\/impersonate\/end$/.test(req.path)) return next();
    return res.status(403).json({ message: "Yönetici görünümünde kullanıcı yönetimi kullanılamaz." });
  }

  if (!isCorporateAdmin(req.user) || String(req.user?.organizationId || "") !== String(requestedOrgId)) {
    return res.status(403).json({ message: "Organizasyon kullanıcı yönetimi yetkiniz yok." });
  }

  return next();
});

router.post("/:orgId/impersonate/:userId", async (req, res) => {
  try {
    const { orgId, userId } = req.params;
    if (!isCorporateAdmin(req.user) || String(req.user.organizationId || "") !== String(orgId)) {
      return res.status(403).json({ message: "Bu kullanıcı paneline geçiş yetkiniz yok." });
    }

    const target = await User.findOne({ _id: userId, organization: orgId })
      .select("_id name email role organization status personal")
      .lean();

    if (!target) return res.status(404).json({ message: "Kullanıcı bulunamadı." });
    if (isCorporateAdmin(target)) {
      return res.status(400).json({ message: "Admin kullanıcı paneline geçiş yapılamaz." });
    }
    if (String(target.status || "aktif").toLowerCase() !== "aktif") {
      return res.status(400).json({ message: "Pasif veya bloke kullanıcı paneline geçiş yapılamaz." });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET missing in .env");

    const impersonation = {
      actorUserId: String(req.user._id),
      actorName: req.user.name || "Yönetici",
      targetUserId: String(target._id),
      targetName: target.name || "Kullanıcı",
      organizationId: String(orgId),
    };
    const token = jwt.sign(
      {
        _id: String(target._id),
        id: String(target._id),
        role: target.role,
        email: target.email,
        organizationId: String(orgId),
        impersonation,
      },
      secret,
      { expiresIn: "30m" }
    );

    await AdminPanelAccessLog.create({
      organization: orgId,
      actorUser: req.user._id,
      viewedUser: target._id,
      action: "panel_enter",
      ip: req.ip || "",
    });

    return res.json({
      token,
      expiresIn: "30m",
      user: {
        _id: target._id,
        id: target._id,
        name: target.name,
        ad: target.name,
        email: target.email,
        role: target.role,
        organization: target.organization,
        organizationId: target.organization,
        personal: target.personal || {},
      },
    });
  } catch (err) {
    console.error("ADMIN IMPERSONATE ERROR:", err);
    return res.status(500).json({ message: "Kullanıcı paneli açılamadı." });
  }
});

router.post("/:orgId/impersonate/end", async (req, res) => {
  try {
    if (!req.actor || String(req.actor.organizationId || "") !== String(req.params.orgId)) {
      return res.status(403).json({ message: "Yönetici görünümü bulunamadı." });
    }

    await AdminPanelAccessLog.create({
      organization: req.params.orgId,
      actorUser: req.actor._id,
      viewedUser: req.user._id,
      action: "panel_exit",
      ip: req.ip || "",
    });
    return res.json({ message: "Yönetici görünümü kapatıldı." });
  } catch (err) {
    console.error("ADMIN IMPERSONATE END ERROR:", err);
    return res.status(500).json({ message: "Yönetici görünümü kapatılamadı." });
  }
});

router.get("/:orgId/users", async (req, res) => {
  try {
    const { orgId } = req.params;

    const org = await Organization.findById(orgId);
    if (!org) {
      return res.status(404).json({ message: "Organizasyon bulunamadı" });
    }

    const users = await User.find({ organization: orgId }).select(
      "name email role createdAt personal.tcKimlik personal.sertifikaNo"
    );

    res.json({
      organization: {
        id: org._id,
        name: org.name,
        planCode: org.planCode,
        userLimit: org.userLimit,
        status: org.status,
        subscriptionEnd: org.subscriptionEnd,
      },
      users,
    });
  } catch (err) {
    console.error("ORG USERS LIST ERROR:", err);
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

router.post("/:orgId/users", async (req, res) => {
  try {
    const { orgId } = req.params;
    const { name, email, password, role, tcKimlik } = req.body;

    const org = await Organization.findById(orgId);
    if (!org) {
      return res.status(404).json({ message: "Organizasyon bulunamadı" });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "Bu email ile sistemde zaten kullanıcı var." });
    }

    const plainPassword = String(password || "123456").trim();
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    const safeRole = activeUserRoles.includes(role) ? role : "ticari_user";
    await assertRoleSeatAvailable({ org, orgId, role: safeRole });

    const user = await User.create({
      name: upTR(name),
      email,
      password: hashedPassword,
      role: safeRole,
      organization: org._id,
      planCode: org.planCode,
      subscriptionEnd: org.subscriptionEnd,
      personal: {
        tcKimlik: String(tcKimlik || "").replace(/\D/g, ""),
      },
    });

    if (createNotification) {
      await createNotification({
        userId: user._id,
        type: "event",
        module: "genel",
        title: "Bilgiler eksik",
        message:
          "Paneli tam verimli kullanabilmek için kişisel bilgileriniz ve kurumsal bilgilerinizi doldurunuz.",
        severity: "info",
        link: "",
        dueDate: new Date(),
        key: `welcome_remind_event:${String(user._id)}:v1`,
      });
    }

    try {
      await sendUserPasswordMail({
        to: user.email,
        fullName: user.name,
        companyName: org.name,
        password: plainPassword,
        panelLink:
          process.env.APP_URL ||
          process.env.FRONTEND_URL ||
          process.env.PUBLIC_APP_URL ||
          "https://www.isgpanel.tr",
        mode: "created",
      });
    } catch (mailErr) {
      console.error("USER CREATED MAIL ERROR:", mailErr);
    }

    res.status(201).json({
      message: "Kullanıcı başarıyla eklendi",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        personal: user.personal,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error("ORG ADD USER ERROR:", err);
    res.status(err.statusCode || 500).json({ message: err.message || "Sunucu hatası" });
  }
});

router.put("/:orgId/users/:userId", async (req, res) => {
  try {
    const { orgId, userId } = req.params;
    const { name, email, role, password, tcKimlik } = req.body;

    const user = await User.findOne({ _id: userId, organization: orgId });
    if (!user) {
      return res.status(404).json({ message: "Kullanıcı bulunamadı." });
    }

    const org = await Organization.findById(orgId).select("userLimit");
    if (!org) return res.status(404).json({ message: "Organizasyon bulunamadı" });

    if (name) user.name = upTR(name);
    if (email) user.email = email;
    if (role && activeUserRoles.includes(role) && role !== user.role) {
      await assertRoleSeatAvailable({ org, orgId, role, excludeUserId: user._id });
      user.role = role;
    }
    if (tcKimlik !== undefined) {
      user.personal = user.personal || {};
      user.personal.tcKimlik = String(tcKimlik || "").replace(/\D/g, "");
    }

    let renewedPlainPassword = "";

    if (password && String(password).trim()) {
      renewedPlainPassword = String(password).trim();
      user.password = await bcrypt.hash(renewedPlainPassword, 10);
    }

    await user.save();

    if (renewedPlainPassword) {
      try {
        const org = await Organization.findById(orgId).select("name");
        await sendUserPasswordMail({
          to: user.email,
          fullName: user.name,
          companyName: org?.name || "",
          password: renewedPlainPassword,
          panelLink:
            process.env.APP_URL ||
            process.env.FRONTEND_URL ||
            process.env.PUBLIC_APP_URL ||
            "https://www.isgpanel.tr",
          mode: "renewed",
        });
      } catch (mailErr) {
        console.error("USER PASSWORD RENEW MAIL ERROR:", mailErr);
      }
    }

    res.json({
      message: "Kullanıcı güncellendi",
      user,
    });
  } catch (err) {
    console.error("ORG UPDATE USER ERROR:", err);
    res.status(err.statusCode || 500).json({ message: err.message || "Sunucu hatası" });
  }
});

router.delete("/:orgId/users/:userId", async (req, res) => {
  try {
    const { orgId, userId } = req.params;

    const user = await User.findOne({ _id: userId, organization: orgId });
    if (!user) {
      return res.status(404).json({ message: "Kullanıcı bulunamadı." });
    }

    if (user.role === "ticari_admin" || user.role === "admin") {
      return res.status(400).json({ message: "Ticari admin veya admin kullanıcı silinemez." });
    }

    const now = new Date();

    await FirmUser.updateMany(
      { organization: orgId, userId: user._id, isActive: true },
      { $set: { isActive: false } }
    );

    await IsgKatipAssignment.updateMany(
      { organization: orgId, assignedUserId: user._id },
      {
        $set: {
          assignedUserId: null,
          isgKatipStatus: "kontrol_edilmedi",
          lastSyncAt: now,
          lastError: "Atanan kullanıcı silindi",
        },
        $push: {
          logs: {
            action: "user_deleted_assignment_reset",
            message: "Atanan kullanıcı silindiği için görev yeniden atama bekliyor",
            by: req.user?._id || req.user?.id || null,
            at: now,
          },
        },
      }
    );

    await user.deleteOne();

    res.json({ message: "Kullanıcı başarıyla silindi" });
  } catch (err) {
    console.error("ORG DELETE USER ERROR:", err);
    res.status(500).json({ message: "Kullanıcı silinirken hata oluştu." });
  }
});

module.exports = router;
