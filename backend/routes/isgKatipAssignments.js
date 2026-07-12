const express = require("express");
const mongoose = require("mongoose");

const Firma = require("../models/Firma");
const FirmUser = require("../models/FirmUser");
const User = require("../models/User");
const IsgKatipAssignment = require("../models/IsgKatipAssignment");

const router = express.Router();

const STATUS_LABELS = {
  kontrol_edilmedi: "Kontrol Edilmedi",
  atama_yok: "İSG-KATİP Ataması Yok",
  profesyonel_onayi_bekliyor: "Profesyonel Onayı Bekliyor",
  isveren_onayi_bekliyor: "İşveren Onayı Bekliyor",
  atama_onaylandi: "Atama Onaylandı",
  atama_dustu: "Atama Düştü",
  yeniden_atama_gerekli: "Yeniden Atama Gerekli",
};

function roleOf(user) {
  return String(user?.role || "").toLowerCase().trim();
}

function getOrgId(user) {
  return user?.organizationId || user?.organization || null;
}

function ensureAdmin(req, res) {
  if (roleOf(req.user) !== "ticari_admin") {
    res.status(403).json({ message: "Yetkisiz işlem" });
    return null;
  }

  const orgId = getOrgId(req.user);
  if (!orgId || !mongoose.Types.ObjectId.isValid(String(orgId))) {
    res.status(400).json({ message: "Organizasyon bilgisi bulunamadı" });
    return null;
  }

  return String(orgId);
}

function isAssignableUser(user) {
  return roleOf(user) === "ticari_user";
}

function hasValidTc(user) {
  const tc = String(user?.personal?.tcKimlik || "").replace(/\D/g, "");
  return tc.length === 11;
}

function categoryFor(item) {
  if (!item.assignedUserId) return "atanmamis";
  if (item.isgKatipStatus === "atama_onaylandi") return "aktif";
  if (
    item.isgKatipStatus === "atama_dustu" ||
    item.isgKatipStatus === "yeniden_atama_gerekli"
  ) {
    return "dusen";
  }
  if (
    item.isgKatipStatus === "profesyonel_onayi_bekliyor" ||
    item.isgKatipStatus === "isveren_onayi_bekliyor"
  ) {
    return "onay_bekleyen";
  }
  return "atama_yok";
}

async function buildOverview(orgId) {
  const firms = await Firma.find({ organization: orgId }).sort({ firmaAdi: 1 }).lean();
  const firmIds = firms.map((firm) => firm._id);

  const activeLinks = await FirmUser.find({
    organization: orgId,
    firmId: { $in: firmIds },
    isActive: true,
  }).lean();

  const assignments = await IsgKatipAssignment.find({
    organization: orgId,
    firmaId: { $in: firmIds },
  }).lean();

  const userIds = [
    ...new Set(
      activeLinks
        .map((link) => String(link.userId || ""))
        .concat(assignments.map((item) => String(item.assignedUserId || "")))
        .filter(Boolean)
    ),
  ];

  const users = await User.find({ _id: { $in: userIds } })
    .select("name email role personal.tcKimlik personal.sertifikaNo")
    .lean();

  const userMap = new Map(users.map((user) => [String(user._id), user]));
  const linkMap = new Map(activeLinks.map((link) => [String(link.firmId), link]));
  const assignmentMap = new Map(assignments.map((item) => [String(item.firmaId), item]));

  const items = firms.map((firm) => {
    const firmId = String(firm._id);
    const link = linkMap.get(firmId) || null;
    const assignment = assignmentMap.get(firmId) || null;
    const rawAssignedUserId = link?.userId || assignment?.assignedUserId || null;
    const rawAssignedUser = rawAssignedUserId ? userMap.get(String(rawAssignedUserId)) : null;
    const isValidPanelAssignee = rawAssignedUser && isAssignableUser(rawAssignedUser);
    const assignedUserId = isValidPanelAssignee ? rawAssignedUserId : null;
    const assignedUser = assignedUserId ? rawAssignedUser : null;
    const status = assignment?.isgKatipStatus || "kontrol_edilmedi";

    const item = {
      id: firmId,
      firmaId: firmId,
      firmaAdi: firm.firmaAdi || "",
      sgkNo: firm.sgkNo || firm.sgkSicilNo || "",
      tehlike: firm.tehlike || "Tehlikeli",
      il: firm.il || "",
      adres: firm.adres || "",
      hazirlama: firm.hazirlama || null,
      gecerlilik: firm.gecerlilik || null,
      assignedUserId: assignedUserId ? String(assignedUserId) : "",
      assignedUserName: assignedUser?.name || assignedUser?.email || "",
      assignedUserRole: assignedUser?.role || "",
      assignedUserTcKimlikVar: assignedUser ? hasValidTc(assignedUser) : false,
      assignedUserSertifikaNoVar: Boolean(assignedUser?.personal?.sertifikaNo),
      panelAssignmentProblem:
        rawAssignedUserId && !isValidPanelAssignee
          ? "Atanmış kullanıcı geçerli ticari kullanıcı değil"
          : "",
      isgKatipStatus: status,
      isgKatipStatusLabel: STATUS_LABELS[status] || status,
      gorevTuru: assignment?.gorevTuru || "is_guvenligi_uzmani",
      sozlesmeId: assignment?.sozlesmeId || "",
      calismaSuresi: assignment?.calismaSuresi || "",
      baslangicTarihi: assignment?.baslangicTarihi || null,
      bitisTarihi: assignment?.bitisTarihi || null,
      lastSyncAt: assignment?.lastSyncAt || null,
      lastError: assignment?.lastError || "",
      logs: assignment?.logs || [],
    };

    item.category = categoryFor(item);
    return item;
  });

  const counts = {
    total: items.length,
    atanmamis: items.filter((item) => item.category === "atanmamis").length,
    atama_yok: items.filter((item) => item.category === "atama_yok").length,
    onay_bekleyen: items.filter((item) => item.category === "onay_bekleyen").length,
    aktif: items.filter((item) => item.category === "aktif").length,
    dusen: items.filter((item) => item.category === "dusen").length,
  };

  const lastSyncAt =
    assignments
      .map((item) => item.lastSyncAt)
      .filter(Boolean)
      .sort((a, b) => new Date(b) - new Date(a))[0] || null;

  return { counts, items, lastSyncAt, statusLabels: STATUS_LABELS };
}

router.get("/overview", async (req, res) => {
  try {
    const orgId = ensureAdmin(req, res);
    if (!orgId) return;

    const overview = await buildOverview(orgId);
    return res.json(overview);
  } catch (err) {
    console.error("ISG-KATIP overview hata:", err);
    return res.status(500).json({ message: "İSG-KATİP durumu alınamadı" });
  }
});

router.post("/sync", async (req, res) => {
  try {
    const orgId = ensureAdmin(req, res);
    if (!orgId) return;

    const now = new Date();
    const overviewBefore = await buildOverview(orgId);
    const assignedItems = overviewBefore.items.filter((item) => item.assignedUserId);

    if (assignedItems.length > 0) {
      await IsgKatipAssignment.bulkWrite(
        assignedItems.map((item) => ({
          updateOne: {
            filter: {
              organization: orgId,
              firmaId: item.firmaId,
              gorevTuru: item.gorevTuru || "is_guvenligi_uzmani",
            },
            update: {
              $set: {
                assignedUserId: item.assignedUserId,
                lastSyncAt: now,
                lastError: "",
              },
              $setOnInsert: {
                organization: orgId,
                firmaId: item.firmaId,
                gorevTuru: item.gorevTuru || "is_guvenligi_uzmani",
                isgKatipStatus: "atama_yok",
              },
              $push: {
                logs: {
                  action: "manual_sync",
                  message: "Manuel senkronizasyon kontrolü çalıştırıldı",
                  by: req.user._id || req.user.id || null,
                  at: now,
                },
              },
            },
            upsert: true,
          },
        }))
      );
    }

    const overview = await buildOverview(orgId);
    return res.json({ ok: true, ...overview, lastSyncAt: overview.lastSyncAt || now });
  } catch (err) {
    console.error("ISG-KATIP sync hata:", err);
    return res.status(500).json({ message: "Senkronizasyon başlatılamadı" });
  }
});

router.patch("/:firmaId/status", async (req, res) => {
  try {
    const orgId = ensureAdmin(req, res);
    if (!orgId) return;

    const { firmaId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(String(firmaId))) {
      return res.status(400).json({ message: "Firma bilgisi geçersiz" });
    }

    const firm = await Firma.findOne({ _id: firmaId, organization: orgId }).lean();
    if (!firm) return res.status(404).json({ message: "Firma bulunamadı" });

    const nextStatus = String(req.body?.isgKatipStatus || "").trim();
    if (!STATUS_LABELS[nextStatus]) {
      return res.status(400).json({ message: "İSG-KATİP durumu geçersiz" });
    }

    const activeLink = await FirmUser.findOne({
      organization: orgId,
      firmId: firmaId,
      isActive: true,
    }).lean();

    const now = new Date();
    const update = {
      organization: orgId,
      firmaId,
      assignedUserId: activeLink?.userId || req.body?.assignedUserId || null,
      gorevTuru: req.body?.gorevTuru || "is_guvenligi_uzmani",
      isgKatipStatus: nextStatus,
      sozlesmeId: req.body?.sozlesmeId || "",
      calismaSuresi: req.body?.calismaSuresi || "",
      lastSyncAt: now,
      lastError: "",
    };

    const assignment = await IsgKatipAssignment.findOneAndUpdate(
      { organization: orgId, firmaId, gorevTuru: update.gorevTuru },
      {
        $set: update,
        $push: {
          logs: {
            action: "status_update",
            message: `Durum ${STATUS_LABELS[nextStatus]} olarak güncellendi`,
            by: req.user._id || req.user.id || null,
            at: now,
          },
        },
      },
      { upsert: true, new: true }
    ).lean();

    return res.json({ ok: true, assignment });
  } catch (err) {
    console.error("ISG-KATIP status hata:", err);
    return res.status(500).json({ message: "İSG-KATİP durumu kaydedilemedi" });
  }
});

router.post("/:firmaId/start", async (req, res) => {
  try {
    const orgId = ensureAdmin(req, res);
    if (!orgId) return;

    const { firmaId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(String(firmaId))) {
      return res.status(400).json({ message: "Firma bilgisi geçersiz" });
    }

    const firm = await Firma.findOne({ _id: firmaId, organization: orgId }).lean();
    if (!firm) return res.status(404).json({ message: "Firma bulunamadı" });

    const activeLink = await FirmUser.findOne({
      organization: orgId,
      firmId: firmaId,
      isActive: true,
    }).lean();

    if (!activeLink?.userId) {
      return res.status(400).json({ message: "Önce firmaya kullanıcı atayın" });
    }

    const assignedUser = await User.findById(activeLink.userId)
      .select("role personal.tcKimlik personal.sertifikaNo")
      .lean();

    if (!isAssignableUser(assignedUser)) {
      return res.status(400).json({ message: "Atanan kullanıcı geçerli ticari kullanıcı değil" });
    }

    if (!hasValidTc(assignedUser)) {
      return res.status(400).json({
        message:
          "Atama başlatmak için atanan kullanıcının TC kimlik numarası kişisel bilgilerinde kayıtlı olmalı",
      });
    }

    const now = new Date();
    const assignment = await IsgKatipAssignment.findOneAndUpdate(
      { organization: orgId, firmaId, gorevTuru: "is_guvenligi_uzmani" },
      {
        $set: {
          organization: orgId,
          firmaId,
          assignedUserId: activeLink.userId,
          gorevTuru: "is_guvenligi_uzmani",
          isgKatipStatus: "profesyonel_onayi_bekliyor",
          lastSyncAt: now,
          lastError: "",
        },
        $push: {
          logs: {
            action: "assignment_start",
            message: "İSG-KATİP atama süreci başlatıldı",
            by: req.user._id || req.user.id || null,
            at: now,
          },
        },
      },
      { upsert: true, new: true }
    ).lean();

    return res.json({ ok: true, assignment });
  } catch (err) {
    console.error("ISG-KATIP start hata:", err);
    return res.status(500).json({ message: "Atama süreci başlatılamadı" });
  }
});

module.exports = router;
