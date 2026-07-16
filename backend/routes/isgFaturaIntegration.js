const express = require("express");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const mongoose = require("mongoose");
const auth = require("../middleware/auth");
const User = require("../models/User");
const Organization = require("../models/Organization");
const Firma = require("../models/Firma");
const PairingCode = require("../models/IsgFaturaPairingCode");
const Connection = require("../models/IsgFaturaConnection");

const router = express.Router();
const PAIRING_TTL_MS = 5 * 60 * 1000;
const pairingLimiter = rateLimit({
  windowMs: PAIRING_TTL_MS,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Çok fazla entegrasyon denemesi yapıldı. Lütfen birkaç dakika sonra tekrar deneyin." },
});

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function codeHash(code) {
  return sha256(`${process.env.JWT_SECRET || "isg-panel"}:pair:${code}`);
}

function tokenHash(token) {
  return sha256(`${process.env.JWT_SECRET || "isg-panel"}:token:${token}`);
}

function activeUntil(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) && date.getTime() > Date.now();
}

async function hasActiveCorporateSubscription(organization) {
  if (!organization || organization.status !== "active") return false;
  if (activeUntil(organization.subscriptionEnd)) return true;

  const activeAdmin = await User.exists({
    organization: organization._id,
    role: "ticari_admin",
    status: "aktif",
    subscriptionEnd: { $gt: new Date() },
  });
  return Boolean(activeAdmin);
}

async function requireCorporateAdmin(req, res, next) {
  try {
    const userId = req.user?._id || req.user?.id || req.userId;
    if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(401).json({ message: "Yönetici oturumu doğrulanamadı" });
    }

    const user = await User.findById(userId)
      .select("role status organization subscriptionEnd planCode")
      .lean();
    if (!user || user.role !== "ticari_admin") {
      return res.status(403).json({
        code: "CORPORATE_ADMIN_REQUIRED",
        message: "İSG Fatura entegrasyonu yalnızca Ticari Admin hesaplarında kullanılabilir.",
      });
    }
    if (String(user.status || "aktif").toLowerCase() !== "aktif" || !user.organization) {
      return res.status(403).json({ message: "Kurumsal hesabınız aktif değil." });
    }

    const organization = await Organization.findById(user.organization)
      .select("name status planCode subscriptionEnd")
      .lean();
    const hasSubscription =
      organization &&
      organization.status === "active" &&
      (activeUntil(organization.subscriptionEnd) || activeUntil(user.subscriptionEnd));

    if (!hasSubscription) {
      return res.status(403).json({
        code: "SUBSCRIPTION_INACTIVE",
        message: "Entegrasyon için aktif Ticari Kurumsal abonelik gereklidir.",
      });
    }

    req.integrationAdmin = user;
    req.integrationOrganization = organization;
    return next();
  } catch (error) {
    console.error("İSG Fatura kurumsal yetki kontrolü hata:", error);
    return res.status(500).json({ message: "Kurumsal yetki doğrulanamadı." });
  }
}

async function integrationAuth(req, res, next) {
  try {
    const header = String(req.headers.authorization || "").trim();
    const token = header.startsWith("Integration ")
      ? header.slice("Integration ".length).trim()
      : "";
    if (!token || token.length < 40) {
      return res.status(401).json({ code: "INTEGRATION_TOKEN_MISSING", message: "Bağlantı anahtarı bulunamadı." });
    }

    const connection = await Connection.findOne({
      tokenHash: tokenHash(token),
      isActive: true,
    }).lean();
    if (!connection) {
      return res.status(401).json({ code: "INTEGRATION_TOKEN_INVALID", message: "Bağlantı geçersiz veya iptal edilmiş." });
    }

    const organization = await Organization.findById(connection.organization)
      .select("name status planCode subscriptionEnd")
      .lean();
    if (!(await hasActiveCorporateSubscription(organization))) {
      return res.status(403).json({
        code: "SUBSCRIPTION_INACTIVE",
        message: "İSG Panel kurumsal aboneliği aktif olmadığı için senkronizasyon durduruldu.",
      });
    }

    req.integrationConnection = connection;
    req.integrationOrganization = organization;
    return next();
  } catch (error) {
    console.error("İSG Fatura bağlantı doğrulama hata:", error);
    return res.status(500).json({ message: "Bağlantı doğrulanamadı." });
  }
}

router.post("/pairing-code", pairingLimiter, auth, requireCorporateAdmin, async (req, res) => {
  try {
    const organizationId = req.integrationAdmin.organization;
    await PairingCode.deleteMany({ organization: organizationId, usedAt: null });

    let code = "";
    let hash = "";
    for (let attempt = 0; attempt < 5; attempt += 1) {
      code = String(crypto.randomInt(100000, 1000000));
      hash = codeHash(code);
      const exists = await PairingCode.exists({ codeHash: hash });
      if (!exists) break;
    }

    const expiresAt = new Date(Date.now() + PAIRING_TTL_MS);
    await PairingCode.create({
      organization: organizationId,
      codeHash: hash,
      expiresAt,
      createdBy: req.integrationAdmin._id,
    });

    return res.json({
      ok: true,
      code,
      expiresAt,
      organizationName: req.integrationOrganization.name,
      eligibility: "ticari_kurumsal_admin",
    });
  } catch (error) {
    console.error("İSG Fatura bağlantı kodu üretme hata:", error);
    return res.status(500).json({ message: "Bağlantı kodu üretilemedi." });
  }
});

router.post("/exchange", pairingLimiter, async (req, res) => {
  try {
    const code = String(req.body?.code || "").replace(/\D/g, "");
    const faturaInstanceId = String(req.body?.faturaInstanceId || "").trim();
    const faturaAccountName = String(req.body?.faturaAccountName || "İSG Fatura").trim().slice(0, 120);
    if (code.length !== 6 || faturaInstanceId.length < 12 || faturaInstanceId.length > 120) {
      return res.status(400).json({ message: "Bağlantı kodu veya uygulama kimliği geçersiz." });
    }

    const pairing = await PairingCode.findOneAndUpdate(
      {
        codeHash: codeHash(code),
        usedAt: null,
        expiresAt: { $gt: new Date() },
      },
      { $set: { usedAt: new Date() } },
      { new: true }
    );
    if (!pairing) {
      return res.status(400).json({ code: "PAIRING_CODE_INVALID", message: "Kod geçersiz, kullanılmış veya süresi dolmuş." });
    }

    const [organization, admin] = await Promise.all([
      Organization.findById(pairing.organization).select("name status planCode subscriptionEnd").lean(),
      User.findById(pairing.createdBy).select("role status subscriptionEnd").lean(),
    ]);
    if (
      !organization ||
      organization.status !== "active" ||
      (!activeUntil(organization.subscriptionEnd) && !activeUntil(admin?.subscriptionEnd)) ||
      admin?.role !== "ticari_admin" ||
      String(admin?.status || "").toLowerCase() !== "aktif"
    ) {
      return res.status(403).json({ code: "SUBSCRIPTION_INACTIVE", message: "Kurumsal abonelik veya Ticari Admin yetkisi aktif değil." });
    }

    const rawToken = crypto.randomBytes(48).toString("base64url");
    await Connection.updateMany(
      { organization: pairing.organization, isActive: true },
      { $set: { isActive: false, revokedAt: new Date() } }
    );
    const connection = await Connection.findOneAndUpdate(
      { organization: pairing.organization, faturaInstanceId },
      {
        $set: {
          tokenHash: tokenHash(rawToken),
          faturaAccountName,
          isActive: true,
          connectedBy: pairing.createdBy,
          revokedAt: null,
          lastSyncAt: null,
          lastSyncMode: "",
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();
    return res.json({
      ok: true,
      token: rawToken,
      connectionId: String(connection._id),
      organization: {
        id: String(organization._id),
        name: organization.name,
        planCode: organization.planCode,
      },
      permissions: ["firms:initial-read", "firms:employee-count-read"],
      connectedAt: connection.updatedAt,
    });
  } catch (error) {
    console.error("İSG Fatura kod doğrulama hata:", error);
    return res.status(500).json({ message: "Bağlantı kurulamadı." });
  }
});

router.get("/status", auth, requireCorporateAdmin, async (req, res) => {
  const connection = await Connection.findOne({
    organization: req.integrationAdmin.organization,
    isActive: true,
  })
    .select("faturaAccountName lastSyncAt lastSyncMode createdAt updatedAt")
    .lean();
  return res.json({
    connected: Boolean(connection),
    organizationName: req.integrationOrganization.name,
    connection: connection
      ? {
          faturaAccountName: connection.faturaAccountName,
          connectedAt: connection.createdAt,
          lastSyncAt: connection.lastSyncAt,
          lastSyncMode: connection.lastSyncMode,
        }
      : null,
  });
});

router.delete("/connection", auth, requireCorporateAdmin, async (req, res) => {
  await Connection.updateMany(
    { organization: req.integrationAdmin.organization, isActive: true },
    { $set: { isActive: false, revokedAt: new Date() } }
  );
  await PairingCode.deleteMany({ organization: req.integrationAdmin.organization, usedAt: null });
  return res.json({ ok: true, message: "İSG Fatura bağlantısı kaldırıldı." });
});

router.delete("/connection/self", integrationAuth, async (req, res) => {
  await Connection.updateOne(
    { _id: req.integrationConnection._id },
    { $set: { isActive: false, revokedAt: new Date() } }
  );
  return res.json({ ok: true, message: "İSG Fatura bağlantısı kaldırıldı." });
});

router.get("/firms", integrationAuth, async (req, res) => {
  try {
    const mode = req.query?.mode === "count" ? "count" : "initial";
    const firms = await Firma.find({ organization: req.integrationConnection.organization })
      .select("firmaAdi adres tehlike calisanSayisi durum updatedAt")
      .sort({ firmaAdi: 1 })
      .lean();
    const data = firms.map((firm) =>
      mode === "count"
        ? {
            panelFirmId: String(firm._id),
            calisanSayisi: Number.isFinite(Number(firm.calisanSayisi)) ? Number(firm.calisanSayisi) : 0,
            updatedAt: firm.updatedAt,
          }
        : {
            panelFirmId: String(firm._id),
            firmaAdi: firm.firmaAdi || "",
            adres: firm.adres || "",
            tehlike: firm.tehlike || "",
            calisanSayisi: Number.isFinite(Number(firm.calisanSayisi)) ? Number(firm.calisanSayisi) : 0,
            durum: firm.durum || "Aktif",
            updatedAt: firm.updatedAt,
          }
    );

    await Connection.updateOne(
      { _id: req.integrationConnection._id },
      { $set: { lastSyncAt: new Date(), lastSyncMode: mode } }
    );
    return res.json({
      ok: true,
      mode,
      organization: {
        id: String(req.integrationOrganization._id),
        name: req.integrationOrganization.name,
      },
      firms: data,
      syncedAt: new Date(),
    });
  } catch (error) {
    console.error("İSG Fatura firma senkronizasyonu hata:", error);
    return res.status(500).json({ message: "Firma bilgileri senkronize edilemedi." });
  }
});

module.exports = router;
