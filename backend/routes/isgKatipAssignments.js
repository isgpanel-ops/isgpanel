const express = require("express");
const mongoose = require("mongoose");

const Firma = require("../models/Firma");
const FirmUser = require("../models/FirmUser");
const User = require("../models/User");
const IsgKatipAssignment = require("../models/IsgKatipAssignment");
const IsgKatipPerson = require("../models/IsgKatipPerson");

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

const GOREV_TURLERI = ["is_guvenligi_uzmani", "isyeri_hekimi", "diger_saglik_personeli"];
const PERSON_GOREV_TURLERI = ["isyeri_hekimi", "diger_saglik_personeli"];

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

function normalizeGorevTuru(value) {
  return GOREV_TURLERI.includes(value) ? value : "is_guvenligi_uzmani";
}

function isUzmanGorevi(gorevTuru) {
  return normalizeGorevTuru(gorevTuru) === "is_guvenligi_uzmani";
}

function hasValidTcValue(value) {
  return String(value || "").replace(/\D/g, "").length === 11;
}

function hasValidTc(user) {
  return hasValidTcValue(user?.personal?.tcKimlik);
}

function normalizeTc(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 11);
}

function isAssignableUser(user) {
  return roleOf(user) === "ticari_user";
}

function categoryFor(item) {
  if (!item.hasAssignee) return "atanmamis";
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

function uzmanLinkFilter(extra = {}) {
  return {
    ...extra,
    $or: [{ gorevTuru: "is_guvenligi_uzmani" }, { gorevTuru: { $exists: false } }],
  };
}

async function savedPeople(orgId, gorevTuru) {
  if (!PERSON_GOREV_TURLERI.includes(gorevTuru)) return [];
  const people = await IsgKatipPerson.find({
    organization: orgId,
    gorevTuru,
    isActive: true,
  })
    .sort({ adSoyad: 1 })
    .lean();

  return people.map((person) => ({
    id: String(person._id),
    adSoyad: person.adSoyad || "",
    tcKimlik: person.tcKimlik || "",
    gorevTuru: person.gorevTuru,
  }));
}

async function scopedFirmIds(orgId, firmaIds) {
  const validFirmaIds = (Array.isArray(firmaIds) ? firmaIds : []).filter((id) =>
    mongoose.Types.ObjectId.isValid(String(id))
  );
  if (validFirmaIds.length === 0) return [];

  const firms = await Firma.find({ _id: { $in: validFirmaIds }, organization: orgId })
    .select("_id")
    .lean();
  return firms.map((firm) => firm._id);
}

async function savePersonForRole(orgId, gorevTuru, adSoyad, tcKimlik) {
  const normalizedName = String(adSoyad || "").trim().toLocaleUpperCase("tr-TR");
  const normalizedTc = normalizeTc(tcKimlik);

  if (!normalizedName) {
    throw new Error("Ad soyad alanı zorunludur.");
  }
  if (!hasValidTcValue(normalizedTc)) {
    throw new Error("TC kimlik numarası 11 haneli olmalıdır.");
  }

  await IsgKatipPerson.findOneAndUpdate(
    { organization: orgId, gorevTuru, tcKimlik: normalizedTc },
    {
      $set: {
        organization: orgId,
        gorevTuru,
        adSoyad: normalizedName,
        tcKimlik: normalizedTc,
        isActive: true,
      },
    },
    { upsert: true }
  );

  return { adSoyad: normalizedName, tcKimlik: normalizedTc };
}

async function buildOverview(orgId, gorevTuru = "is_guvenligi_uzmani") {
  const normalizedGorevTuru = normalizeGorevTuru(gorevTuru);
  const uzmanMode = isUzmanGorevi(normalizedGorevTuru);

  const firms = await Firma.find({ organization: orgId }).sort({ firmaAdi: 1 }).lean();
  const firmIds = firms.map((firm) => firm._id);

  const activeLinks = uzmanMode
    ? await FirmUser.find(
        uzmanLinkFilter({
          organization: orgId,
          firmId: { $in: firmIds },
          isActive: true,
        })
      ).lean()
    : [];

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

  const candidateUsers = uzmanMode
    ? await User.find({ organization: orgId, role: "ticari_user" })
        .select("name email role personal.tcKimlik personal.sertifikaNo")
        .sort({ name: 1 })
        .lean()
    : [];

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
    const assignment = assignmentMap.get(firmId) || null;
    const manualAssignee = assignment?.manualAssignee || {};
    const manualName = String(manualAssignee.adSoyad || "").trim();
    const manualTc = normalizeTc(manualAssignee.tcKimlik);
    const hasManualAssignee = Boolean(manualName && hasValidTcValue(manualTc));

    const link = uzmanMode
      ? firmLinks.find((candidate) => {
          const candidateUser = userMap.get(String(candidate.userId));
          return isAssignableUser(candidateUser);
        }) || null
      : null;

    const rawAssignedUserId = link?.userId || null;
    const rawAssignedUser = rawAssignedUserId ? userMap.get(String(rawAssignedUserId)) : null;
    const isValidPanelAssignee = rawAssignedUser && isAssignableUser(rawAssignedUser);
    const assignedUserId = isValidPanelAssignee ? rawAssignedUserId : null;
    const assignedUser = assignedUserId ? rawAssignedUser : null;
    const assignedName = uzmanMode ? assignedUser?.name || assignedUser?.email || "" : manualName;
    const assignedTc = uzmanMode ? assignedUser?.personal?.tcKimlik || "" : manualTc;
    const hasAssignee = uzmanMode ? Boolean(assignedUserId) : hasManualAssignee;
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
      hasAssignee,
      assignedUserId: assignedUserId ? String(assignedUserId) : "",
      assignedUserName: assignedName,
      assignedDisplayName: assignedName,
      assignedUserRole: assignedUser?.role || "",
      assignedUserTcKimlik: assignedTc,
      assignedDisplayTcKimlik: assignedTc,
      assignedUserTcKimlikVar: uzmanMode
        ? assignedUser
          ? hasValidTc(assignedUser)
          : false
        : hasValidTcValue(manualTc),
      assignedUserSertifikaNoVar: uzmanMode ? Boolean(assignedUser?.personal?.sertifikaNo) : true,
      manualAssigneeName: manualName,
      manualAssigneeTcKimlik: manualTc,
      panelAssignmentProblem:
        uzmanMode && rawAssignedUserId && !isValidPanelAssignee
          ? "Atanmış kullanıcı geçerli iş güvenliği uzmanı değil"
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
    savedPeople: await savedPeople(orgId, normalizedGorevTuru),
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

async function touchSyncForRole(orgId, gorevTuru, actorId) {
  const now = new Date();
  const overviewBefore = await buildOverview(orgId, gorevTuru);
  const assignedItems = overviewBefore.items.filter((item) => item.hasAssignee);

  if (assignedItems.length > 0) {
    await IsgKatipAssignment.bulkWrite(
      assignedItems.map((item) => ({
        updateOne: {
          filter: { organization: orgId, firmaId: item.firmaId, gorevTuru },
          update: {
            $set: {
              ...(item.assignedUserId ? { assignedUserId: item.assignedUserId } : {}),
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
                by: actorId || null,
                at: now,
              },
            },
          },
          upsert: true,
        },
      }))
    );
  }

  return { gorevTuru, touched: assignedItems.length, now };
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

    const requestedRole = req.body?.gorevTuru || req.query?.gorevTuru;
    const currentRole = normalizeGorevTuru(requestedRole);
    const rolesToSync = req.body?.allRoles === true ? GOREV_TURLERI : [currentRole];
    const actorId = req.user._id || req.user.id || null;

    const roleSummaries = [];
    for (const role of rolesToSync) {
      roleSummaries.push(await touchSyncForRole(orgId, role, actorId));
    }

    const overview = await buildOverview(orgId, currentRole);
    return res.json({
      ok: true,
      ...overview,
      roleSummaries,
      lastSyncAt: overview.lastSyncAt || new Date(),
    });
  } catch (err) {
    console.error("ISG-KATIP sync hata:", err);
    return res.status(500).json({ message: "Senkronizasyon başlatılamadı" });
  }
});

router.get("/people", async (req, res) => {
  try {
    const orgId = ensureAdmin(req, res);
    if (!orgId) return;

    const gorevTuru = normalizeGorevTuru(req.query?.gorevTuru);
    return res.json({ people: await savedPeople(orgId, gorevTuru) });
  } catch (err) {
    console.error("ISG-KATIP people hata:", err);
    return res.status(500).json({ message: "Kayıtlı kişiler alınamadı" });
  }
});

router.delete("/people/:personId", async (req, res) => {
  try {
    const orgId = ensureAdmin(req, res);
    if (!orgId) return;

    const { personId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(String(personId))) {
      return res.status(400).json({ message: "Kişi bilgisi geçersiz" });
    }

    const person = await IsgKatipPerson.findOneAndUpdate(
      { _id: personId, organization: orgId },
      { $set: { isActive: false } },
      { new: true }
    ).lean();

    if (!person) return res.status(404).json({ message: "Kayıtlı kişi bulunamadı" });

    return res.json({ ok: true, people: await savedPeople(orgId, person.gorevTuru) });
  } catch (err) {
    console.error("ISG-KATIP person delete hata:", err);
    return res.status(500).json({ message: "Kayıtlı kişi silinemedi" });
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
              gorevTuru: normalizeGorevTuru(row.gorevTuru),
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

router.post("/bulk/assign-user", async (req, res) => {
  try {
    const orgId = ensureAdmin(req, res);
    if (!orgId) return;

    const { userId } = req.body || {};
    const firmaIds = Array.isArray(req.body?.firmaIds) ? req.body.firmaIds : [];
    const gorevTuru = normalizeGorevTuru(req.body?.gorevTuru);

    if (!isUzmanGorevi(gorevTuru)) {
      return res.status(400).json({
        message: "Toplu kullanıcı ataması yalnızca iş güvenliği uzmanı için yapılabilir.",
      });
    }
    if (!mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(400).json({ message: "Kullanıcı bilgisi geçersiz" });
    }

    const validFirmaIds = firmaIds.filter((id) => mongoose.Types.ObjectId.isValid(String(id)));
    if (validFirmaIds.length === 0) {
      return res.status(400).json({ message: "Seçili firma bulunamadı" });
    }

    const user = await User.findOne({ _id: userId, organization: orgId })
      .select("role personal.tcKimlik personal.sertifikaNo")
      .lean();
    if (!user) return res.status(404).json({ message: "Kullanıcı bulunamadı" });
    if (!isAssignableUser(user)) {
      return res.status(400).json({ message: "Seçilen kullanıcı iş güvenliği uzmanı değil" });
    }

    const firms = await Firma.find({ _id: { $in: validFirmaIds }, organization: orgId })
      .select("_id")
      .lean();
    const scopedFirmaIds = firms.map((firm) => firm._id);
    if (scopedFirmaIds.length === 0) {
      return res.status(400).json({ message: "Organizasyona ait seçili firma bulunamadı" });
    }

    await FirmUser.updateMany(
      uzmanLinkFilter({ organization: orgId, firmId: { $in: scopedFirmaIds }, isActive: true }),
      { $set: { isActive: false } }
    );

    await FirmUser.bulkWrite(
      scopedFirmaIds.map((firmaId) => ({
        updateOne: {
          filter: { organization: orgId, firmId: firmaId, userId },
          update: {
            $set: {
              organization: orgId,
              firmId: firmaId,
              userId,
              gorevTuru,
              isActive: true,
              assignedBy: req.user._id || req.user.id || null,
            },
          },
          upsert: true,
        },
      }))
    );

    const now = new Date();
    await IsgKatipAssignment.bulkWrite(
      scopedFirmaIds.map((firmaId) => ({
        updateOne: {
          filter: { organization: orgId, firmaId, gorevTuru },
          update: {
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
                action: "panel_bulk_assign",
                message: "İş güvenliği uzmanı seçili firmalara atandı",
                by: req.user._id || req.user.id || null,
                at: now,
              },
            },
          },
          upsert: true,
        },
      }))
    );

    const overview = await buildOverview(orgId, gorevTuru);
    return res.json({ ok: true, ...overview });
  } catch (err) {
    console.error("ISG-KATIP bulk assign user hata:", err);
    return res.status(500).json({ message: "Toplu kullanıcı ataması kaydedilemedi" });
  }
});

router.post("/bulk/manual-assignee", async (req, res) => {
  try {
    const orgId = ensureAdmin(req, res);
    if (!orgId) return;

    const firmaIds = Array.isArray(req.body?.firmaIds) ? req.body.firmaIds : [];
    const gorevTuru = normalizeGorevTuru(req.body?.gorevTuru);
    const adSoyad = String(req.body?.adSoyad || "").trim().toLocaleUpperCase("tr-TR");
    const tcKimlik = normalizeTc(req.body?.tcKimlik);

    if (isUzmanGorevi(gorevTuru)) {
      return res.status(400).json({ message: "Uzman için kullanıcı listesinden seçim yapılmalıdır." });
    }
    if (!adSoyad) {
      return res.status(400).json({ message: "Ad soyad alanı zorunludur." });
    }
    if (!hasValidTcValue(tcKimlik)) {
      return res.status(400).json({ message: "TC kimlik numarası 11 haneli olmalıdır." });
    }

    const validFirmaIds = firmaIds.filter((id) => mongoose.Types.ObjectId.isValid(String(id)));
    if (validFirmaIds.length === 0) {
      return res.status(400).json({ message: "Seçili firma bulunamadı" });
    }

    const firms = await Firma.find({ _id: { $in: validFirmaIds }, organization: orgId })
      .select("_id")
      .lean();
    const scopedFirmaIds = firms.map((firm) => firm._id);
    if (scopedFirmaIds.length === 0) {
      return res.status(400).json({ message: "Organizasyona ait seçili firma bulunamadı" });
    }

    await IsgKatipPerson.findOneAndUpdate(
      { organization: orgId, gorevTuru, tcKimlik },
      {
        $set: {
          organization: orgId,
          gorevTuru,
          adSoyad,
          tcKimlik,
          isActive: true,
        },
      },
      { upsert: true }
    );

    const now = new Date();
    await IsgKatipAssignment.bulkWrite(
      scopedFirmaIds.map((firmaId) => ({
        updateOne: {
          filter: { organization: orgId, firmaId, gorevTuru },
          update: {
            $set: {
              organization: orgId,
              firmaId,
              gorevTuru,
              manualAssignee: { adSoyad, tcKimlik },
              assignedUserId: null,
              isgKatipStatus: "atama_yok",
              lastSyncAt: now,
              lastError: "",
            },
            $push: {
              logs: {
                action: "manual_bulk_assignee_save",
                message: "Görev için kişi bilgisi seçili firmalara kaydedildi",
                by: req.user._id || req.user.id || null,
                at: now,
              },
            },
          },
          upsert: true,
        },
      }))
    );

    const overview = await buildOverview(orgId, gorevTuru);
    return res.json({ ok: true, ...overview });
  } catch (err) {
    console.error("ISG-KATIP bulk manual assignee hata:", err);
    return res.status(500).json({ message: "Toplu kişi bilgisi kaydedilemedi" });
  }
});

router.post("/bulk/start", async (req, res) => {
  try {
    const orgId = ensureAdmin(req, res);
    if (!orgId) return;

    const gorevTuru = normalizeGorevTuru(req.body?.gorevTuru);
    const firmaIds = await scopedFirmIds(orgId, req.body?.firmaIds);
    if (firmaIds.length === 0) {
      return res.status(400).json({ message: "Seçili firma bulunamadı" });
    }

    const now = new Date();

    if (isUzmanGorevi(gorevTuru)) {
      const { userId } = req.body || {};
      let activeLinks = [];

      if (userId) {
        if (!mongoose.Types.ObjectId.isValid(String(userId))) {
          return res.status(400).json({ message: "Kullanıcı bilgisi geçersiz" });
        }

        const user = await User.findOne({ _id: userId, organization: orgId })
          .select("role personal.tcKimlik personal.sertifikaNo")
          .lean();
        if (!user || !isAssignableUser(user)) {
          return res.status(400).json({ message: "Seçilen kullanıcı iş güvenliği uzmanı değil" });
        }
        if (!hasValidTc(user)) {
          return res.status(400).json({
            message: "Atama başlatmak için seçilen uzmanın TC kimlik numarası kayıtlı olmalıdır.",
          });
        }

        await FirmUser.updateMany(
          uzmanLinkFilter({ organization: orgId, firmId: { $in: firmaIds }, isActive: true }),
          { $set: { isActive: false } }
        );

        await FirmUser.bulkWrite(
          firmaIds.map((firmaId) => ({
            updateOne: {
              filter: { organization: orgId, firmId: firmaId, userId },
              update: {
                $set: {
                  organization: orgId,
                  firmId: firmaId,
                  userId,
                  gorevTuru,
                  isActive: true,
                  assignedBy: req.user._id || req.user.id || null,
                },
              },
              upsert: true,
            },
          }))
        );

        activeLinks = firmaIds.map((firmaId) => ({ firmId: firmaId, userId }));
      } else {
        activeLinks = await FirmUser.find(
          uzmanLinkFilter({
            organization: orgId,
            firmId: { $in: firmaIds },
            isActive: true,
          })
        ).lean();
      }

      const users = await User.find({
        _id: { $in: activeLinks.map((link) => link.userId).filter(Boolean) },
        organization: orgId,
      })
        .select("role personal.tcKimlik personal.sertifikaNo")
        .lean();
      const userMap = new Map(users.map((user) => [String(user._id), user]));
      const linkByFirm = new Map();
      activeLinks.forEach((link) => {
        const user = userMap.get(String(link.userId));
        if (isAssignableUser(user)) linkByFirm.set(String(link.firmId), link);
      });

      const missingFirms = firmaIds.filter((firmaId) => !linkByFirm.has(String(firmaId)));
      if (missingFirms.length > 0) {
        return res.status(400).json({
          message: "Seçili firmaların tamamı için iş güvenliği uzmanı seçilmelidir.",
        });
      }

      const missingTc = firmaIds.filter((firmaId) => {
        const link = linkByFirm.get(String(firmaId));
        return !hasValidTc(userMap.get(String(link.userId)));
      });
      if (missingTc.length > 0) {
        return res.status(400).json({
          message: "Seçili firmalardaki uzmanların TC kimlik numarası kayıtlı olmalıdır.",
        });
      }

      await IsgKatipAssignment.bulkWrite(
        firmaIds.map((firmaId) => {
          const link = linkByFirm.get(String(firmaId));
          return {
            updateOne: {
              filter: { organization: orgId, firmaId, gorevTuru },
              update: {
                $set: {
                  organization: orgId,
                  firmaId,
                  gorevTuru,
                  assignedUserId: link.userId,
                  isgKatipStatus: "profesyonel_onayi_bekliyor",
                  lastSyncAt: now,
                  lastError: "",
                },
                $push: {
                  logs: {
                    action: "bulk_assignment_start",
                    message: "İSG-KATİP uzman atama süreci seçili firmalar için başlatıldı",
                    by: req.user._id || req.user.id || null,
                    at: now,
                  },
                },
              },
              upsert: true,
            },
          };
        })
      );

      const overview = await buildOverview(orgId, gorevTuru);
      return res.json({ ok: true, ...overview });
    }

    let manualPerson = null;
    const requestName = String(req.body?.adSoyad || "").trim();
    const requestTc = normalizeTc(req.body?.tcKimlik);
    if (requestName || requestTc) {
      try {
        manualPerson = await savePersonForRole(orgId, gorevTuru, requestName, requestTc);
      } catch (validationErr) {
        return res.status(400).json({ message: validationErr.message });
      }
    }

    const existingAssignments = manualPerson
      ? []
      : await IsgKatipAssignment.find({
          organization: orgId,
          firmaId: { $in: firmaIds },
          gorevTuru,
        }).lean();
    const assignmentByFirm = new Map(existingAssignments.map((item) => [String(item.firmaId), item]));

    const missingManual = manualPerson
      ? []
      : firmaIds.filter((firmaId) => {
          const assignee = assignmentByFirm.get(String(firmaId))?.manualAssignee || {};
          return !String(assignee.adSoyad || "").trim() || !hasValidTcValue(assignee.tcKimlik);
        });
    if (missingManual.length > 0) {
      return res.status(400).json({
        message: "Seçili firmaların tamamı için ad soyad ve 11 haneli TC kimlik kaydedilmelidir.",
      });
    }

    await IsgKatipAssignment.bulkWrite(
      firmaIds.map((firmaId) => {
        const existingAssignee = assignmentByFirm.get(String(firmaId))?.manualAssignee || {};
        const assignee = manualPerson || {
          adSoyad: String(existingAssignee.adSoyad || "").trim().toLocaleUpperCase("tr-TR"),
          tcKimlik: normalizeTc(existingAssignee.tcKimlik),
        };
        return {
          updateOne: {
            filter: { organization: orgId, firmaId, gorevTuru },
            update: {
              $set: {
                organization: orgId,
                firmaId,
                gorevTuru,
                assignedUserId: null,
                manualAssignee: assignee,
                isgKatipStatus: "profesyonel_onayi_bekliyor",
                lastSyncAt: now,
                lastError: "",
              },
              $push: {
                logs: {
                  action: "bulk_manual_assignment_start",
                  message: "İSG-KATİP manuel kişi atama süreci seçili firmalar için başlatıldı",
                  by: req.user._id || req.user.id || null,
                  at: now,
                },
              },
            },
            upsert: true,
          },
        };
      })
    );

    const overview = await buildOverview(orgId, gorevTuru);
    return res.json({ ok: true, ...overview });
  } catch (err) {
    console.error("ISG-KATIP bulk start hata:", err);
    return res.status(500).json({ message: err?.message || "Toplu atama süreci başlatılamadı" });
  }
});

router.patch("/bulk/status", async (req, res) => {
  try {
    const orgId = ensureAdmin(req, res);
    if (!orgId) return;

    const gorevTuru = normalizeGorevTuru(req.body?.gorevTuru);
    const nextStatus = String(req.body?.isgKatipStatus || "").trim();
    if (!STATUS_LABELS[nextStatus]) {
      return res.status(400).json({ message: "İSG-KATİP durumu geçersiz" });
    }

    const firmaIds = await scopedFirmIds(orgId, req.body?.firmaIds);
    if (firmaIds.length === 0) {
      return res.status(400).json({ message: "Seçili firma bulunamadı" });
    }

    const now = new Date();
    await IsgKatipAssignment.bulkWrite(
      firmaIds.map((firmaId) => ({
        updateOne: {
          filter: { organization: orgId, firmaId, gorevTuru },
          update: {
            $set: {
              organization: orgId,
              firmaId,
              gorevTuru,
              isgKatipStatus: nextStatus,
              lastSyncAt: now,
              lastError: "",
            },
            $push: {
              logs: {
                action: "bulk_status_update",
                message: `Durum ${STATUS_LABELS[nextStatus]} olarak güncellendi`,
                by: req.user._id || req.user.id || null,
                at: now,
              },
            },
          },
          upsert: true,
        },
      }))
    );

    const overview = await buildOverview(orgId, gorevTuru);
    return res.json({ ok: true, ...overview });
  } catch (err) {
    console.error("ISG-KATIP bulk status hata:", err);
    return res.status(500).json({ message: "Toplu durum güncellenemedi" });
  }
});

router.post("/:firmaId/assign-user", async (req, res) => {
  try {
    const orgId = ensureAdmin(req, res);
    if (!orgId) return;

    const { firmaId } = req.params;
    const { userId } = req.body || {};
    const gorevTuru = normalizeGorevTuru(req.body?.gorevTuru);

    if (!isUzmanGorevi(gorevTuru)) {
      return res.status(400).json({
        message: "Hekim ve DSP için panel kullanıcısı yerine kişi bilgisi kaydedilmelidir.",
      });
    }

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
    if (!isAssignableUser(user)) {
      return res.status(400).json({ message: "Seçilen kullanıcı iş güvenliği uzmanı değil" });
    }

    await FirmUser.updateMany(
      uzmanLinkFilter({ organization: orgId, firmId: firmaId, isActive: true }),
      { $set: { isActive: false } }
    );

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
            message: "İş güvenliği uzmanı firmaya atandı",
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

router.post("/:firmaId/manual-assignee", async (req, res) => {
  try {
    const orgId = ensureAdmin(req, res);
    if (!orgId) return;

    const { firmaId } = req.params;
    const gorevTuru = normalizeGorevTuru(req.body?.gorevTuru);
    const adSoyad = String(req.body?.adSoyad || "").trim().toLocaleUpperCase("tr-TR");
    const tcKimlik = normalizeTc(req.body?.tcKimlik);

    if (isUzmanGorevi(gorevTuru)) {
      return res.status(400).json({ message: "Uzman için kullanıcı listesinden seçim yapılmalıdır." });
    }
    if (!mongoose.Types.ObjectId.isValid(String(firmaId))) {
      return res.status(400).json({ message: "Firma bilgisi geçersiz" });
    }
    if (!adSoyad) {
      return res.status(400).json({ message: "Ad soyad alanı zorunludur." });
    }
    if (!hasValidTcValue(tcKimlik)) {
      return res.status(400).json({ message: "TC kimlik numarası 11 haneli olmalıdır." });
    }

    const firm = await Firma.findOne({ _id: firmaId, organization: orgId }).select("_id").lean();
    if (!firm) return res.status(404).json({ message: "Firma bulunamadı" });

    await IsgKatipPerson.findOneAndUpdate(
      { organization: orgId, gorevTuru, tcKimlik },
      {
        $set: {
          organization: orgId,
          gorevTuru,
          adSoyad,
          tcKimlik,
          isActive: true,
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
          manualAssignee: { adSoyad, tcKimlik },
          assignedUserId: null,
          isgKatipStatus: "atama_yok",
          lastSyncAt: now,
          lastError: "",
        },
        $push: {
          logs: {
            action: "manual_assignee_save",
            message: "Görev için kişi bilgisi kaydedildi",
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
    console.error("ISG-KATIP manual assignee hata:", err);
    return res.status(500).json({ message: "Kişi bilgisi kaydedilemedi" });
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

    const gorevTuru = normalizeGorevTuru(req.body?.gorevTuru);
    const activeLink = isUzmanGorevi(gorevTuru)
      ? await FirmUser.findOne(
          uzmanLinkFilter({
            organization: orgId,
            firmId: firmaId,
            isActive: true,
          })
        ).lean()
      : null;

    const now = new Date();
    const update = {
      organization: orgId,
      firmaId,
      ...(activeLink?.userId ? { assignedUserId: activeLink.userId } : {}),
      gorevTuru,
      isgKatipStatus: nextStatus,
      sozlesmeId: req.body?.sozlesmeId || "",
      calismaSuresi: req.body?.calismaSuresi || "",
      lastSyncAt: now,
      lastError: "",
    };

    const assignment = await IsgKatipAssignment.findOneAndUpdate(
      { organization: orgId, firmaId, gorevTuru },
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
    const now = new Date();

    if (isUzmanGorevi(gorevTuru)) {
      const activeLinks = await FirmUser.find(
        uzmanLinkFilter({
          organization: orgId,
          firmId: firmaId,
          isActive: true,
        })
      ).lean();

      const users = await User.find({
        _id: { $in: activeLinks.map((link) => link.userId) },
      })
        .select("role personal.tcKimlik personal.sertifikaNo")
        .lean();

      const userMap = new Map(users.map((user) => [String(user._id), user]));
      const activeLink =
        activeLinks.find((link) => isAssignableUser(userMap.get(String(link.userId)))) || null;

      if (!activeLink?.userId) {
        return res.status(400).json({ message: "Önce firmaya iş güvenliği uzmanı atayın." });
      }

      const assignedUser = userMap.get(String(activeLink.userId));

      if (!hasValidTc(assignedUser)) {
        return res.status(400).json({
          message:
            "Atama başlatmak için atanan uzmanın TC kimlik numarası kullanıcı bilgilerinde kayıtlı olmalıdır.",
        });
      }

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
              message: "İSG-KATİP uzman atama süreci başlatıldı",
              by: req.user._id || req.user.id || null,
              at: now,
            },
          },
        },
        { upsert: true, new: true }
      ).lean();

      return res.json({ ok: true, assignment });
    }

    const requestName = String(req.body?.adSoyad || "").trim();
    const requestTc = normalizeTc(req.body?.tcKimlik);
    let manualPerson = null;
    if (requestName || requestTc) {
      try {
        manualPerson = await savePersonForRole(orgId, gorevTuru, requestName, requestTc);
      } catch (validationErr) {
        return res.status(400).json({ message: validationErr.message });
      }
    }

    const existingAssignment = manualPerson
      ? null
      : await IsgKatipAssignment.findOne({
          organization: orgId,
          firmaId,
          gorevTuru,
        }).lean();

    const manualName = manualPerson?.adSoyad || String(existingAssignment?.manualAssignee?.adSoyad || "").trim();
    const manualTc = manualPerson?.tcKimlik || normalizeTc(existingAssignment?.manualAssignee?.tcKimlik);

    if (!manualName || !hasValidTcValue(manualTc)) {
      return res.status(400).json({
        message: "Bu görev türü için ad soyad ve 11 haneli TC kimlik kaydedilmelidir.",
      });
    }

    const assignment = await IsgKatipAssignment.findOneAndUpdate(
      { organization: orgId, firmaId, gorevTuru },
      {
        $set: {
          organization: orgId,
          firmaId,
          assignedUserId: null,
          manualAssignee: { adSoyad: manualName, tcKimlik: manualTc },
          gorevTuru,
          isgKatipStatus: "profesyonel_onayi_bekliyor",
          lastSyncAt: now,
          lastError: "",
        },
        $push: {
          logs: {
            action: "assignment_start",
            message: "İSG-KATİP manuel kişi atama süreci başlatıldı",
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
