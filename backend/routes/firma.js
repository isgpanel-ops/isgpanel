const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const router = express.Router();

const User = require("../models/User");
const Firma = require("../models/Firma");

let FirmUser = null;
try {
  // eslint-disable-next-line global-require
  FirmUser = require("../models/FirmUser");
} catch (_) {
  FirmUser = null;
}

/** ✅ EKLENDİ: createNotification güvenli require (mevcut kod bozulmasın) */
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
    "./services/notificationService",
    "./services/notificationService.js",

    // ✅ projede farklı klasör isimleri olabiliyor (organizationUsers.js ile aynı yedekler)
    "./services/notification/notificationService",
    "./services/notification/notificationService.js",
    "./services/notifications/notificationService",
    "./services/notifications/notificationService.js",
    "../services/notification/notificationService",
    "../services/notification/notificationService.js",
    "../services/notifications/notificationService",
    "../services/notifications/notificationService.js",
  ]) || {};

// ✅ NEW: Job enqueue (bağımsız)
const {
  enqueueFirmAssigned,
  enqueueFirmRemoved,
} = require("../jobs/firmAssignmentNotificationJob");

// -------------------- AUTH
async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Token yok" });

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({
        message: "JWT_SECRET tanımlı değil. .env içine JWT_SECRET ekleyin.",
      });
    }

    const decoded = jwt.verify(token, secret);
    const userId = decoded.id || decoded.userId || decoded._id;
    if (!userId) return res.status(401).json({ message: "Token userId yok" });

    const user = await User.findById(userId).lean();
    if (!user) return res.status(401).json({ message: "Kullanıcı bulunamadı" });

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Geçersiz token" });
  }
}

const roleOf = (u) => String(u?.role || "").toLowerCase().trim();
const isAdmin = (u) => roleOf(u) === "ticari_admin";
const isTicariUser = (u) => roleOf(u) === "ticari_user";
const isBireysel = (u) => {
  const role = roleOf(u);
  return role === "bireysel" || role === "uzman";
};
const getOrgId = (req) => req.user?.organization || req.user?.organizationId || null;

// ✅ payload seçici (NACE + FAALİYET + TARİHLER DAHİL)
function pickFirmaFields(body) {
  const b = body || {};
  return {
    firmaAdi: b.firmaAdi,
    sgkNo: b.sgkNo ?? b.sgkSicilNo,

    // tarih
    hazirlama: b.hazirlama ?? b.hazirlamaTarihi ?? b.hazirlamaTarih,
    gecerlilik: b.gecerlilik ?? b.gecerlilikTarihi ?? b.gecerlilikTarih,

    adres: b.adres,
    telefon: b.telefon,
    sektor: b.sektor,

    // ✅ asıl eksik olanlar
    nace: b.nace ?? b.naceKodu ?? b.naceKod ?? b.naceCode,
    faaliyet: b.faaliyet ?? b.faaliyetAlani ?? b.faaliyetAdi ?? b.activity,

    tehlike: b.tehlike,
    durum: b.durum,
  };
}

// ✅ GET tarafı normalize (SORUNU KÖKTEN BİTİREN YER)
function normalizeFirmaOut(f) {
  if (!f) return f;

  const resolvedLogo =
    f?.kurumsal?.logoUrl ||
    f?.kurumsal?.logo ||
    f?.kurumsal?.logoPath ||
    f?.kurumsal?.firmaLogo ||
    f?.logoUrl ||
    f?.logo ||
    f?.logoPath ||
    f?.firmaLogo ||
    "";

  return {
    ...f,

    hazirlama:
      f.hazirlama ||
      f.hazirlamaTarihi ||
      f.hazirlamaTarih ||
      "",

    gecerlilik:
      f.gecerlilik ||
      f.gecerlilikTarihi ||
      f.gecerlilikTarih ||
      "",

    // ✅ frontend artık bunları görebilecek
    logo: resolvedLogo,
    logoUrl: resolvedLogo,

    kurumsal: {
      ...(f.kurumsal || {}),
      logo: resolvedLogo,
      logoUrl: resolvedLogo,
      firmaLogo: resolvedLogo,
    },
  };
}

/** ✅ EKLENDİ: küçük helperlar (ticari bildirim için) */
function upTR(s) {
  return (s || "").toLocaleUpperCase("tr-TR");
}
function pickUserDisplayName(u) {
  const name =
    u?.name ||
    u?.fullName ||
    u?.adSoyad ||
    (u?.personal ? `${u.personal.ad || ""} ${u.personal.soyad || ""}`.trim() : "") ||
    u?.email ||
    "";
  return upTR(name || "KULLANICI");
}

// -------------------- GET /api/firma
router.get("/", auth, async (req, res) => {
  try {
    const user = req.user;

    // ADMIN: org firmaları + atama bilgisi
    if (isAdmin(user)) {
      const orgId = getOrgId(req);
      if (!orgId) return res.status(400).json({ message: "Organizasyon bulunamadı" });

      const firms = await Firma.find({ organization: orgId }).sort({ firmaAdi: 1 }).lean();

      if (!FirmUser || firms.length === 0) {
        return res.json(firms.map(normalizeFirmaOut));
      }

      const firmIds = firms.map((f) => f._id);

      const assignments = await FirmUser.find({
        organization: orgId,
        firmId: { $in: firmIds },
        isActive: true,
      })
        .populate("userId", "name adSoyad fullName email")
        .lean();

      const assignMap = new Map();
      for (const a of assignments) assignMap.set(String(a.firmId), a.userId || null);

      const result = firms.map((f) => {
        const u = assignMap.get(String(f._id));
        const adSoyad = u?.name || u?.adSoyad || u?.fullName || u?.email || null;

        return {
          ...f,
          atanmisKullanici: u?._id || null,
          atanmisKullaniciAdSoyad: adSoyad,
        };
      });

      return res.json(result.map(normalizeFirmaOut));
    }

    // TICARI USER (kapalı)
    if (isTicariUser(user)) {
      return res.status(403).json({
        message: "Ticari kullanıcılar firma listesini /api/me/firms üzerinden almalı.",
      });
    }

    // BIREYSEL (legacy)
    const firms = await Firma.find({ userId: user._id }).sort({ firmaAdi: 1 }).lean();
    return res.json(firms.map(normalizeFirmaOut));
  } catch (e) {
    console.error("GET /api/firma hata:", e);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});

/* =========================================================
   ✅✅ YENİ: ADMIN -> TICARI USER ANLIK ATAMA BİLDİRİMİ
   POST /api/firma/:id/assign   { userId }
   POST /api/firma/:id/unassign { userId? }  (boşsa aktif atamayı söker)
   ========================================================= */

router.post("/:id/assign", auth, async (req, res) => {
  try {
    const admin = req.user;
    if (!isAdmin(admin)) return res.status(403).json({ message: "Yetkisiz" });

    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ message: "Organizasyon bulunamadı" });

    if (!FirmUser) {
      return res.status(500).json({ message: "FirmUser modeli bulunamadı (FirmUser yok)." });
    }

    const firmId = req.params.id;
    const targetUserId = req.body?.userId;
    if (!targetUserId) return res.status(400).json({ message: "userId zorunlu" });

    const firm = await Firma.findById(firmId);
    if (!firm) return res.status(404).json({ message: "Firma bulunamadı" });

    if (String(firm.organization || "") !== String(orgId)) {
      return res.status(403).json({ message: "Bu firma sizin organizasyona ait değil" });
    }

    const targetUser = await User.findById(targetUserId).lean();
    if (!targetUser) return res.status(404).json({ message: "Kullanıcı bulunamadı" });

    // kullanıcı aynı org’da mı?
    if (String(targetUser.organization || "") !== String(orgId)) {
      return res.status(400).json({ message: "Kullanıcı bu organizasyona ait değil" });
    }

    // rol kontrolü (istersen gevşetebilirsin)
    if (roleOf(targetUser) !== "ticari_user") {
      return res.status(400).json({ message: "Atama yapılacak kullanıcı ticari_user olmalı" });
    }

    // aktif atama ver
    await FirmUser.updateOne(
      { organization: orgId, firmId: firm._id, userId: targetUserId },
      { $set: { isActive: true, assignedBy: admin._id, assignedAt: new Date() } },
      { upsert: true }
    );

    // diğer aktif atamaları kapat (aynı firmada tek kişi aktif kalsın)
    await FirmUser.updateMany(
      {
        organization: orgId,
        firmId: firm._id,
        userId: { $ne: targetUserId },
        isActive: true,
      },
      { $set: { isActive: false, removedBy: admin._id, removedAt: new Date() } }
    );

    // legacy: firm.userId hedef kullanıcı olsun (tarama/akışlar düzgün çalışsın)
    firm.userId = targetUserId;
    await firm.save();

    // ✅✅ JOB'a enqueue (bildirim üretimi job tarafından yapılacak)
    try {
      enqueueFirmAssigned({
        assignedUserId: targetUserId,
        firmId: firm._id,
        firmName: firm.firmaAdi,
        actorName: pickUserDisplayName(admin),
        actionId: Date.now(),
      });
    } catch (e) {
      console.error("enqueueFirmAssigned hata:", e);
    }

    return res.json({
      ok: true,
      firm: normalizeFirmaOut(firm.toObject?.() || firm),
      assignedTo: targetUserId,
    });
  } catch (e) {
    console.error("POST /api/firma/:id/assign hata:", e);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});

router.post("/:id/unassign", auth, async (req, res) => {
  try {
    const admin = req.user;
    if (!isAdmin(admin)) return res.status(403).json({ message: "Yetkisiz" });

    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ message: "Organizasyon bulunamadı" });

    if (!FirmUser) {
      return res.status(500).json({ message: "FirmUser modeli bulunamadı (FirmUser yok)." });
    }

    const firmId = req.params.id;
    const firm = await Firma.findById(firmId);
    if (!firm) return res.status(404).json({ message: "Firma bulunamadı" });

    if (String(firm.organization || "") !== String(orgId)) {
      return res.status(403).json({ message: "Bu firma sizin organizasyona ait değil" });
    }

    // hedef userId verilmezse aktif atamayı bul
    let targetUserId = req.body?.userId || null;
    if (!targetUserId) {
      const active = await FirmUser.findOne({
        organization: orgId,
        firmId: firm._id,
        isActive: true,
      })
        .select("userId")
        .lean();
      targetUserId = active?.userId ? String(active.userId) : null;
    }

    // atamayı düşür
    await FirmUser.updateMany(
      { organization: orgId, firmId: firm._id, ...(targetUserId ? { userId: targetUserId } : {}) },
      { $set: { isActive: false, removedBy: admin._id, removedAt: new Date() } }
    );

    // legacy: firma kullanıcı bağını kaldır
    firm.userId = null;
    await firm.save();

    // ✅✅ JOB'a enqueue
    if (targetUserId) {
      try {
        enqueueFirmRemoved({
          assignedUserId: targetUserId,
          firmId: firm._id,
          firmName: firm.firmaAdi,
          actorName: pickUserDisplayName(admin),
          actionId: Date.now(),
        });
      } catch (e) {
        console.error("enqueueFirmRemoved hata:", e);
      }
    }

    return res.json({
      ok: true,
      firm: normalizeFirmaOut(firm.toObject?.() || firm),
      unassignedFrom: targetUserId,
    });
  } catch (e) {
    console.error("POST /api/firma/:id/unassign hata:", e);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});

// -------------------- GET /api/firma/:id  ✅ (Prosedür için en kritik)
router.get("/:id", auth, async (req, res) => {
  try {
    const user = req.user;
    const firmId = req.params.id;

    const firm = await Firma.findById(firmId).lean();
    if (!firm) return res.status(404).json({ message: "Firma bulunamadı" });

    // ADMIN
    if (isAdmin(user)) {
      const orgId = getOrgId(req);
      if (!orgId) return res.status(400).json({ message: "Organizasyon bulunamadı" });
      if (String(firm.organization || "") !== String(orgId)) {
        return res.status(403).json({ message: "Bu firma sizin organizasyona ait değil" });
      }
      return res.json(normalizeFirmaOut(firm));
    }

    // TICARI USER
    if (isTicariUser(user)) {
      const orgId = getOrgId(req);
      if (!orgId) return res.status(400).json({ message: "Organizasyon bulunamadı" });
      if (String(firm.organization || "") !== String(orgId)) {
        return res.status(403).json({ message: "Bu firma sizin organizasyona ait değil" });
      }

      if (FirmUser) {
        const link = await FirmUser.findOne({
          organization: orgId,
          firmId: firm._id,
          userId: user._id,
          isActive: true,
        }).lean();
        if (!link) return res.status(403).json({ message: "Bu firmaya yetkiniz yok" });
      }

      return res.json(normalizeFirmaOut(firm));
    }

    // BIREYSEL
    if (isBireysel(user)) {
      if (String(firm.userId || "") !== String(user._id)) {
        return res.status(403).json({ message: "Bu firmaya yetkiniz yok" });
      }
      return res.json(normalizeFirmaOut(firm));
    }

    return res.status(403).json({ message: "Yetkisiz" });
  } catch (e) {
    console.error("GET /api/firma/:id hata:", e);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});

// -------------------- POST /api/firma
router.post("/", auth, async (req, res) => {
  try {
    const user = req.user;
    const data = pickFirmaFields(req.body);

    if (!data.firmaAdi) return res.status(400).json({ message: "firmaAdi zorunlu" });

    if (isAdmin(user) || isTicariUser(user)) {
      const orgId = getOrgId(req);
      if (!orgId) return res.status(400).json({ message: "Organizasyon bulunamadı" });

      const firmDoc = {
        ...data,
        organization: orgId,
        createdBy: user._id,
        durum: data.durum || "Aktif",
        userId: user._id, // legacy uyumluluk
      };

      const firm = await Firma.create(firmDoc);

      if (isTicariUser(user) && FirmUser) {
        await FirmUser.updateOne(
          { organization: orgId, firmId: firm._id, userId: user._id },
          { $set: { isActive: true, assignedBy: user._id } },
          { upsert: true }
        );
      }

      /** ✅✅ EKLENDİ: Ticari kullanıcı firma ekleyince admin(ler)e anında bildirim */
      if (isTicariUser(user) && createNotification) {
        // org içindeki ticari adminleri bul
        const admins = await User.find({ organization: orgId })
          .select("_id role name fullName adSoyad personal email")
          .lean();

        const adminIds = admins
          .filter((a) => roleOf(a) === "ticari_admin")
          .map((a) => String(a._id));

        if (adminIds.length) {
          const creatorName = pickUserDisplayName(user);
          const firmName = upTR(firm.firmaAdi);

          await Promise.all(
            adminIds.map((adminId) =>
              createNotification({
                userId: adminId,
                firmId: firm._id,
                type: "event",
                module: "ticari",
                title: "Firma eklendi",
                message: `${creatorName} kullanıcısı ${firmName} firmasını ekledi.`,
                severity: "info",
                link: "",
                dueDate: new Date(),
                // admin bazlı key: duplicate engeller
                key: `corp_firma_created:${String(orgId)}:${String(firm._id)}:admin:${String(
                  adminId
                )}`,
              })
            )
          );
        }
      }

      return res.status(201).json(normalizeFirmaOut(firm.toObject?.() || firm));
    }

    if (isBireysel(user)) {
      const firm = await Firma.create({ ...data, userId: user._id });
      return res.status(201).json(normalizeFirmaOut(firm.toObject?.() || firm));
    }

    return res.status(403).json({ message: "Yetkisiz" });
  } catch (e) {
    console.error("POST /api/firma hata:", e);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});

// -------------------- PUT /api/firma/:id
router.put("/:id", auth, async (req, res) => {
  try {
    const user = req.user;
    const firmId = req.params.id;
    const patch = pickFirmaFields(req.body);

    const firm = await Firma.findById(firmId);
    if (!firm) return res.status(404).json({ message: "Firma bulunamadı" });

    // ADMIN
    if (isAdmin(user)) {
      const orgId = getOrgId(req);
      if (!orgId) return res.status(400).json({ message: "Organizasyon bulunamadı" });
      if (String(firm.organization || "") !== String(orgId)) {
        return res.status(403).json({ message: "Bu firma sizin organizasyona ait değil" });
      }

      Object.keys(patch).forEach((k) => {
        if (patch[k] !== undefined) firm[k] = patch[k];
      });

      await firm.save();
      return res.json(normalizeFirmaOut(firm.toObject?.() || firm));
    }

    // TICARI USER
    if (isTicariUser(user)) {
      const orgId = getOrgId(req);
      if (!orgId) return res.status(400).json({ message: "Organizasyon bulunamadı" });

      if (String(firm.organization || "") !== String(orgId)) {
        return res.status(403).json({ message: "Bu firma sizin organizasyona ait değil" });
      }

      if (FirmUser) {
        const link = await FirmUser.findOne({
          organization: orgId,
          firmId: firm._id,
          userId: user._id,
          isActive: true,
        }).lean();
        if (!link) return res.status(403).json({ message: "Bu firmaya yetkiniz yok" });
      } else {
        const ok =
          String(firm.createdBy || "") === String(user._id) ||
          String(firm.userId || "") === String(user._id);
        if (!ok) return res.status(403).json({ message: "Bu firmaya yetkiniz yok" });
      }

      Object.keys(patch).forEach((k) => {
        if (patch[k] !== undefined) firm[k] = patch[k];
      });

      await firm.save();
      return res.json(normalizeFirmaOut(firm.toObject?.() || firm));
    }

    // BIREYSEL
    if (isBireysel(user)) {
      if (String(firm.userId || "") !== String(user._id)) {
        return res.status(403).json({ message: "Bu firmaya yetkiniz yok" });
      }

      Object.keys(patch).forEach((k) => {
        if (patch[k] !== undefined) firm[k] = patch[k];
      });

      await firm.save();
      return res.json(normalizeFirmaOut(firm.toObject?.() || firm));
    }

    return res.status(403).json({ message: "Yetkisiz" });
  } catch (e) {
    console.error("PUT /api/firma/:id hata:", e);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});

// -------------------- DELETE /api/firma/:id
router.delete("/:id", auth, async (req, res) => {
  try {
    const user = req.user;
    const firmId = req.params.id;

    const firm = await Firma.findById(firmId);
    if (!firm) return res.status(404).json({ message: "Firma bulunamadı" });

    if (isTicariUser(user)) {
      return res.status(403).json({ message: "Ticari kullanıcı firma silemez." });
    }

    // ADMIN
    if (isAdmin(user)) {
      const orgId = getOrgId(req);
      if (!orgId) return res.status(400).json({ message: "Organizasyon bulunamadı" });
      if (String(firm.organization || "") !== String(orgId)) {
        return res.status(403).json({ message: "Bu firma sizin organizasyona ait değil" });
      }

      await Firma.deleteOne({ _id: firm._id });
      if (FirmUser) await FirmUser.deleteMany({ firmId: firm._id, organization: orgId });

      return res.json({ ok: true });
    }

    // BIREYSEL
    if (isBireysel(user)) {
      if (String(firm.userId || "") !== String(user._id)) {
        return res.status(403).json({ message: "Bu firmaya yetkiniz yok" });
      }
      await Firma.deleteOne({ _id: firm._id });
      return res.json({ ok: true });
    }

    return res.status(403).json({ message: "Yetkisiz" });
  } catch (e) {
    console.error("DELETE /api/firma/:id hata:", e);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});

// ================== FİRMA KİŞİLER ==================

router.get("/:id/kisiler", auth, async (req, res) => {
  try {
    const user = req.user;
    const firmId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(firmId)) {
      return res.status(400).json({ message: "Geçersiz firma ID", firmId });
    }

    const firm = await Firma.findById(firmId)
      .populate("userId", "name adSoyad fullName email personal")
      .lean();

    if (!firm) {
      return res.status(404).json({ message: "Firma bulunamadı" });
    }

    const orgId = getOrgId(req);

    if (isAdmin(user)) {
      if (!orgId) return res.status(400).json({ message: "Organizasyon bulunamadı" });
      if (String(firm.organization || "") !== String(orgId)) {
        return res.status(403).json({ message: "Bu firma sizin organizasyona ait değil" });
      }
    } else if (isTicariUser(user)) {
      if (!orgId) return res.status(400).json({ message: "Organizasyon bulunamadı" });
      if (String(firm.organization || "") !== String(orgId)) {
        return res.status(403).json({ message: "Bu firma sizin organizasyona ait değil" });
      }

      if (FirmUser) {
        const link = await FirmUser.findOne({
          organization: orgId,
          firmId: firm._id,
          userId: user._id,
          isActive: true,
        }).lean();

        if (!link) return res.status(403).json({ message: "Bu firmaya yetkiniz yok" });
      }
    } else if (isBireysel(user)) {
      if (String(firm.userId?._id || firm.userId || "") !== String(user._id)) {
        return res.status(403).json({ message: "Bu firmaya yetkiniz yok" });
      }
    } else {
      return res.status(403).json({ message: "Yetkisiz" });
    }

    const assignedUser = firm.userId || null;
    const assignedName = assignedUser
      ? pickUserDisplayName(assignedUser)
      : "";

   

    return res.json({
      ...(firm.kisiler || {}),
      uzman: assignedName || firm.kisiler?.uzman || "",
    });
  } catch (e) {
    console.error("GET /api/firma/:id/kisiler hata:", e);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});

router.put("/:id/kisiler", auth, async (req, res) => {
  try {
    const user = req.user;
    const firmId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(firmId)) {
      return res.status(400).json({ message: "Geçersiz firma ID", firmId });
    }

    const firm = await Firma.findById(firmId)
      .populate("userId", "name adSoyad fullName email personal");

    if (!firm) {
      return res.status(404).json({ message: "Firma bulunamadı" });
    }

    const orgId = getOrgId(req);

    if (isAdmin(user)) {
      if (!orgId) return res.status(400).json({ message: "Organizasyon bulunamadı" });
      if (String(firm.organization || "") !== String(orgId)) {
        return res.status(403).json({ message: "Bu firma sizin organizasyona ait değil" });
      }
    } else if (isTicariUser(user)) {
      if (!orgId) return res.status(400).json({ message: "Organizasyon bulunamadı" });
      if (String(firm.organization || "") !== String(orgId)) {
        return res.status(403).json({ message: "Bu firma sizin organizasyona ait değil" });
      }

      if (FirmUser) {
        const link = await FirmUser.findOne({
          organization: orgId,
          firmId: firm._id,
          userId: user._id,
          isActive: true,
        }).lean();

        if (!link) return res.status(403).json({ message: "Bu firmaya yetkiniz yok" });
      }
    } else if (isBireysel(user)) {
      if (String(firm.userId?._id || firm.userId || "") !== String(user._id)) {
        return res.status(403).json({ message: "Bu firmaya yetkiniz yok" });
      }
    } else {
      return res.status(403).json({ message: "Yetkisiz" });
    }

    const assignedUser = firm.userId || null;
    const assignedName = assignedUser
      ? pickUserDisplayName(assignedUser)
      : "";

   
    firm.kisiler = {
      isveren: req.body.isveren || req.body.isverenVekiliAdSoyad || "",
      uzman: assignedName || "",
      hekim: req.body.hekim || req.body.isyeriHekimiAdSoyad || "",
      temsilci: req.body.temsilci || req.body.calisanTemsilcisiAdSoyad || "",
      destek: req.body.destek || req.body.destekElemaniAdSoyad || "",
      bilgi: req.body.bilgi || req.body.bilgiSahibiKisiAdSoyad || "",
    };

    await firm.save();

    return res.json({
      ok: true,
      kisiler: firm.kisiler,
    });
  } catch (e) {
    console.error("PUT /api/firma/:id/kisiler hata:", e);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});


// ================== İMZA / PARAF ==================

router.get("/:id/imzalar", auth, async (req, res) => {
  try {
    const user = req.user;
    const firm = await Firma.findById(req.params.id).lean();

    if (!firm) {
      return res.status(404).json({ message: "Firma bulunamadı" });
    }

    // ADMIN
    if (isAdmin(user)) {
      const orgId = getOrgId(req);
      if (!orgId) return res.status(400).json({ message: "Organizasyon bulunamadı" });
      if (String(firm.organization || "") !== String(orgId)) {
        return res.status(403).json({ message: "Bu firma sizin organizasyona ait değil" });
      }
      return res.json(firm.imzalar || {});
    }

    // TICARI USER
    if (isTicariUser(user)) {
      const orgId = getOrgId(req);
      if (!orgId) return res.status(400).json({ message: "Organizasyon bulunamadı" });
      if (String(firm.organization || "") !== String(orgId)) {
        return res.status(403).json({ message: "Bu firma sizin organizasyona ait değil" });
      }

      if (FirmUser) {
        const link = await FirmUser.findOne({
          organization: orgId,
          firmId: firm._id,
          userId: user._id,
          isActive: true,
        }).lean();

        if (!link) return res.status(403).json({ message: "Bu firmaya yetkiniz yok" });
      }

      return res.json(firm.imzalar || {});
    }

    // BIREYSEL
    if (isBireysel(user)) {
      if (String(firm.userId || "") !== String(user._id)) {
        return res.status(403).json({ message: "Bu firmaya yetkiniz yok" });
      }
      return res.json(firm.imzalar || {});
    }

    return res.status(403).json({ message: "Yetkisiz" });
  } catch (e) {
    console.error("GET imzalar hata:", e);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});

router.put("/:id/imzalar", auth, async (req, res) => {
  try {
    const user = req.user;
    const firm = await Firma.findById(req.params.id);

    if (!firm) {
      return res.status(404).json({ message: "Firma bulunamadı" });
    }

    // ADMIN
    if (isAdmin(user)) {
      const orgId = getOrgId(req);
      if (!orgId) return res.status(400).json({ message: "Organizasyon bulunamadı" });
      if (String(firm.organization || "") !== String(orgId)) {
        return res.status(403).json({ message: "Bu firma sizin organizasyona ait değil" });
      }

      firm.imzalar = req.body.imzalar || {};
      await firm.save();

      return res.json({
        ok: true,
        imzalar: firm.imzalar,
      });
    }

    // TICARI USER
    if (isTicariUser(user)) {
      const orgId = getOrgId(req);
      if (!orgId) return res.status(400).json({ message: "Organizasyon bulunamadı" });

      if (String(firm.organization || "") !== String(orgId)) {
        return res.status(403).json({ message: "Bu firma sizin organizasyona ait değil" });
      }

      if (FirmUser) {
        const link = await FirmUser.findOne({
          organization: orgId,
          firmId: firm._id,
          userId: user._id,
          isActive: true,
        }).lean();

        if (!link) return res.status(403).json({ message: "Bu firmaya yetkiniz yok" });
      } else {
        const ok =
          String(firm.createdBy || "") === String(user._id) ||
          String(firm.userId || "") === String(user._id);
        if (!ok) return res.status(403).json({ message: "Bu firmaya yetkiniz yok" });
      }

      firm.imzalar = req.body.imzalar || {};
      await firm.save();

      return res.json({
        ok: true,
        imzalar: firm.imzalar,
      });
    }

    // BIREYSEL
    if (isBireysel(user)) {
      if (String(firm.userId || "") !== String(user._id)) {
        return res.status(403).json({ message: "Bu firmaya yetkiniz yok" });
      }

      firm.imzalar = req.body.imzalar || {};
      await firm.save();

      return res.json({
        ok: true,
        imzalar: firm.imzalar,
      });
    }

    return res.status(403).json({ message: "Yetkisiz" });
  } catch (e) {
    console.error("PUT imzalar hata:", e);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});

// ================== İMZA / PARAF ==================

module.exports = router;
