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

function normalizeGorevTuru(value) {
  const allowed = ["is_guvenligi_uzmani", "isyeri_hekimi", "diger_saglik_personeli"];
  return allowed.includes(value) ? value : "is_guvenligi_uzmani";
}

function roleForGorevTuru(gorevTuru) {
  if (gorevTuru === "isyeri_hekimi") return "isyeri_hekimi";
  if (gorevTuru === "diger_saglik_personeli") return "diger_saglik_personeli";
  return "ticari_user";
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

async function buildOverview(orgId, gorevTuru = "is_guvenligi_uzmani") {
  const normalizedGorevTuru = normalizeGorevTuru(gorevTuru);
  const expectedRole = roleForGorevTuru(normalizedGorevTuru);
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
    gorevTuru: normalizedGorevTuru,
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

  const candidateUsers = await User.find({
    organization: orgId,
    role: expectedRole,
  })
    .select("name email role personal.tcKimlik personal.sertifikaNo")
    .sort({ name: 1 })
    .lean();

  const userMap = new Map(users.map((user) => [String(user._id), user]));
  const linksByFirm = new Map();
  activeLinks.forEach((link) => {
    const key = String(link.firmId);
    const arr = linksByFirm.get(key) || [];
    arr.push(link);
    linksByFirm.set(key, arr);
  });
  const assignmentMap = new Map(assignments.map((item) => [String(item.firmaId), item]));

  const items = firms.map((firm) => {
    const firmId = String(firm._id);
    const firmLinks = linksByFirm.get(firmId) || [];
    const link =
      firmLinks.find((candidate) => {
        const candidateUser = userMap.get(String(candidate.userId));
        return roleOf(candidateUser) === expectedRole;
      }) || null;
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
      assignedUserTcKimlik: assignedUser?.personal?.tcKimlik || "",
      assignedUserTcKimlikVar: assignedUser ? hasValidTc(assignedUser) : false,
      assignedUserSertifikaNoVar: Boolean(assignedUser?.personal?.sertifikaNo),
      panelAssignmentProblem:
        rawAssignedUserId && !isValidPanelAssignee
          ? "Atanmış kullanıcı geçerli ticari kullanıcı değil"
          : "",
      isgKatipStatus: status,
      isgKatipStatusLabel: STATUS_LABELS[status] || status,
      gorevTuru: assignment?.gorevTuru || normalizedGorevTuru,
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

  return {
    counts,
    items,
    lastSyncAt,
    statusLabels: STATUS_LABELS,
    gorevTuru: normalizedGorevTuru,
    candidateUsers: candidateUsers.map((user) => ({
      id: String(user._id),
      name: user.name || user.email || "",
      email: user.email || "",
      role: user.role || "",
      tcKimlik: user.personal?.tcKimlik || "",
      tcKimlikVar: hasValidTc(user),
      sertifikaNoVar: Boolean(user.personal?.sertifikaNo),
    })),
  };
}

router.get("/overview", async (req, res) => {
  try {
    const orgId = ensureAdmin(req, res);
    if (!orgId) return;

    const overview = await buildOverview(orgId, req.query?.gorevTuru);
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

    const gorevTuru = normalizeGorevTuru(req.body?.gorevTuru || req.query?.gorevTuru);
    const now = new Date();
    const overviewBefore = await buildOverview(orgId, gorevTuru);
    const assignedItems = overviewBefore.items.filter((item) => item.assignedUserId);

    if (assignedItems.length > 0) {
      await IsgKatipAssignment.bulkWrite(
        assignedItems.map((item) => ({
          updateOne: {
            filter: {
              organization: orgId,
              firmaId: item.firmaId,
              gorevTuru,
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
                gorevTuru,
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

    const overview = await buildOverview(orgId, gorevTuru);
    return res.json({ ok: true, ...overview, lastSyncAt: overview.lastSyncAt || now });
  } catch (err) {
    console.error("ISG-KATIP sync hata:", err);
    return res.status(500).json({ message: "Senkronizasyon başlatılamadı" });
  }
});

router.post("/extension-sync", async (req, res) => {
  try {
    const orgId = ensureAdmin(req, res);
    if (!orgId) return;

    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (rows.length === 0) {
      return res.status(400).json({ message: "Senkronize edilecek kayıt bulunamadı" });
    }

    const sgkList = [
      ...new Set(rows.map((row) => String(row.sgkNo || "").replace(/\D/g, "")).filter(Boolean)),
    ];

    const firms = await Firma.find({
      organization: orgId,
      $or: [{ sgkNo: { $in: sgkList } }, { sgkSicilNo: { $in: sgkList } }],
    })
      .select("_id sgkNo sgkSicilNo")
      .lean();

    const firmBySgk = new Map();
    firms.forEach((firm) => {
      if (firm.sgkNo) firmBySgk.set(String(firm.sgkNo).replace(/\D/g, ""), firm);
      if (firm.sgkSicilNo) firmBySgk.set(String(firm.sgkSicilNo).replace(/\D/g, ""), firm);
    });

    const now = new Date();
    const ops = [];
    let matched = 0;

    rows.forEach((row) => {
      const sgkNo = String(row.sgkNo || "").replace(/\D/g, "");
      const firm = firmBySgk.get(sgkNo);
      if (!firm) return;
      matched += 1;

      const status = STATUS_LABELS[row.isgKatipStatus]
        ? row.isgKatipStatus
        : "kontrol_edilmedi";

      ops.push({
        updateOne: {
          filter: {
            organization: orgId,
            firmaId: firm._id,
      gorevTuru: normalizeGorevTuru(row.gorevTuru),
          },
          update: {
            $set: {
              organization: orgId,
              firmaId: firm._id,
              isgKatipStatus: status,
              sozlesmeId: row.sozlesmeId || "",
              calismaSuresi: row.calismaSuresi || "",
              lastSyncAt: now,
              lastError: "",
            },
            $push: {
              logs: {
                action: "extension_sync",
                message: "Tarayıcı eklentisi ile senkronize edildi",
                by: req.user._id || req.user.id || null,
                at: now,
              },
            },
          },
          upsert: true,
        },
      });
    });

    if (ops.length > 0) await IsgKatipAssignment.bulkWrite(ops);

    const overview = await buildOverview(orgId);
    return res.json({
      ok: true,
      received: rows.length,
      matched,
      unmatched: rows.length - matched,
      ...overview,
    });
  } catch (err) {
    console.error("ISG-KATIP extension sync hata:", err);
    return res.status(500).json({ message: "Eklenti senkronizasyonu kaydedilemedi" });
  }
});

router.post("/:firmaId/assign-user", async (req, res) => {
  try {
    const orgId = ensureAdmin(req, res);
    if (!orgId) return;

    const { firmaId } = req.params;
    const { userId } = req.body || {};
    const gorevTuru = normalizeGorevTuru(req.body?.gorevTuru);
    const expectedRole = roleForGorevTuru(gorevTuru);

    if (!mongoose.Types.ObjectId.isValid(String(firmaId))) {
      return res.status(400).json({ message: "Firma bilgisi geçersiz" });
    }
    if (!mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(400).json({ message: "Kullanıcı bilgisi geçersiz" });
    }

    const firm = await Firma.findOne({ _id: firmaId, organization: orgId }).select("_id").lean();
    if (!firm) return res.status(404).json({ message: "Firma bulunamadı" });

    const user = await User.findOne({ _id: userId, organization: orgId })
      .select("role personal.tcKimlik personal.sertifikaNo")
      .lean();
    if (!user) return res.status(404).json({ message: "Kullanıcı bulunamadı" });
    if (roleOf(user) !== expectedRole) {
      return res.status(400).json({ message: "Seçilen kullanıcı bu görev türü için uygun değil" });
    }

    const sameRoleFilter = {
      organization: orgId,
      firmId: firmaId,
      isActive: true,
      $or: [{ gorevTuru }, ...(gorevTuru === "is_guvenligi_uzmani" ? [{ gorevTuru: { $exists: false } }] : [])],
    };

    await FirmUser.updateMany(sameRoleFilter, { $set: { isActive: false } });

    await FirmUser.updateOne(
      { organization: orgId, firmId: firmaId, userId },
      {
        $set: {
          organization: orgId,
          firmId: firmaId,
          userId,
          gorevTuru,
          isActive: true,
          assignedBy: req.user._id || req.user.id || null,
        },
      },
      { upsert: true }
    );

    const now = new Date();
    await IsgKatipAssignment.findOneAndUpdate(
      { organization: orgId, firmaId, gorevTuru },
      {
        $set: {
          organization: orgId,
          firmaId,
          gorevTuru,
          assignedUserId: userId,
          isgKatipStatus: "atama_yok",
          lastSyncAt: now,
          lastError: "",
        },
        $push: {
          logs: {
            action: "panel_assign",
            message: "Panel kullanıcısı görev türüne atandı",
            by: req.user._id || req.user.id || null,
            at: now,
          },
        },
      },
      { upsert: true }
    );

    const overview = await buildOverview(orgId, gorevTuru);
    return res.json({ ok: true, ...overview });
  } catch (err) {
    console.error("ISG-KATIP assign user hata:", err);
    return res.status(500).json({ message: "Kullanıcı ataması kaydedilemedi" });
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
      gorevTuru: normalizeGorevTuru(req.body?.gorevTuru),
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

    const gorevTuru = normalizeGorevTuru(req.body?.gorevTuru || req.query?.gorevTuru);
    const expectedRole = roleForGorevTuru(gorevTuru);

    const activeLinks = await FirmUser.find({
      organization: orgId,
      firmId: firmaId,
      isActive: true,
    }).lean();

    const users = await User.find({
      _id: { $in: activeLinks.map((link) => link.userId) },
    })
      .select("role personal.tcKimlik personal.sertifikaNo")
      .lean();

    const userMap = new Map(users.map((user) => [String(user._id), user]));
    const activeLink =
      activeLinks.find((link) => roleOf(userMap.get(String(link.userId))) === expectedRole) ||
      null;

    if (!activeLink?.userId) {
      return res.status(400).json({ message: "Önce firmaya kullanıcı atayın" });
    }

    const assignedUser = userMap.get(String(activeLink.userId));

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
      { organization: orgId, firmaId, gorevTuru },
      {
        $set: {
          organization: orgId,
          firmaId,
          assignedUserId: activeLink.userId,
          gorevTuru,
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
