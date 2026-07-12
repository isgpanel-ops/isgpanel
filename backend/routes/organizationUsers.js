const express = require("express");
const router = express.Router();

const User = require("../models/User");
const Organization = require("../models/Organization");
const bcrypt = require("bcryptjs");
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
const activeUserRoles = ["ticari_user"];

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

    const currentUserCount = await User.countDocuments({
      organization: orgId,
      role: { $nin: ["ticari_admin", "admin"] },
    });

    if (currentUserCount >= org.userLimit) {
      return res.status(400).json({
        message: `Kullanıcı limitiniz dolmuştur (Limit: ${org.userLimit}).`,
      });
    }

    const plainPassword = String(password || "123456").trim();
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    const safeRole = activeUserRoles.includes(role) ? role : "ticari_user";

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
    res.status(500).json({ message: "Sunucu hatası" });
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

    if (name) user.name = upTR(name);
    if (email) user.email = email;
    if (role && activeUserRoles.includes(role)) user.role = role;
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
    res.status(500).json({ message: "Sunucu hatası" });
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

    await user.deleteOne();

    res.json({ message: "Kullanıcı başarıyla silindi" });
  } catch (err) {
    console.error("ORG DELETE USER ERROR:", err);
    res.status(500).json({ message: "Kullanıcı silinirken hata oluştu." });
  }
});

module.exports = router;
