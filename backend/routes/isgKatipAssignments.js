const express = require("express");
const mongoose = require("mongoose");

const Firma = require("../models/Firma");
const FirmUser = require("../models/FirmUser");
const User = require("../models/User");
const IsgKatipAssignment = require("../models/IsgKatipAssignment");
const IsgKatipPerson = require("../models/IsgKatipPerson");
const IsgKatipJob = require("../models/IsgKatipJob");

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

function isUnknownSyncStatus(status) {
  return !status || status === "kontrol_edilmedi";
}

function statusPriority(status) {
  const priorities = {
    kontrol_edilmedi: 0,
    atama_yok: 1,
    profesyonel_onayi_bekliyor: 2,
    isveren_onayi_bekliyor: 3,
    atama_dustu: 1,
    yeniden_atama_gerekli: 1,
    atama_onaylandi: 5,
  };
  return priorities[status] ?? 0;
}

function normalizeWorkflowStatus(status) {
  if (status === "atama_dustu" || status === "yeniden_atama_gerekli") {
    return "atama_yok";
  }
  return STATUS_LABELS[status] ? status : "kontrol_edilmedi";
}

function normalizeTehlike(value) {
  const text = String(value || "").toLocaleLowerCase("tr-TR");
  if (isCokTehlikeli(value)) return "Çok Tehlikeli";
  if (text.includes("çok")) return "Çok Tehlikeli";
  if (text.includes("az")) return "Az Tehlikeli";
  if (text.includes("tehlikeli")) return "Tehlikeli";
  return "";
}

function isCokTehlikeli(value) {
  const text = String(value || "").toLocaleLowerCase("tr-TR");
  return text.includes("çok") || text.includes("Ã§ok");
}

function isDspRequiredFirm(firm) {
  const employeeCount = Number(firm?.calisanSayisi);
  return isCokTehlikeli(firm?.tehlike) && Number.isFinite(employeeCount) && employeeCount >= 10;
}

function contractSortValue(row, fallbackIndex = 0) {
  const contractNo = String(row?.sozlesmeId || "").replace(/\D/g, "");
  if (contractNo) return Number(contractNo);

  const rawNumbers = String(row?.rawText || "").match(/\b\d{5,}\b/g) || [];
  if (rawNumbers.length > 0) {
    return Math.max(...rawNumbers.map((item) => Number(item)).filter(Number.isFinite));
  }

  return fallbackIndex;
}

function shouldPreferSyncRow(next, current) {
  if (!current) return true;
  const nextPriority = statusPriority(next.status);
  const currentPriority = statusPriority(current.status);
  if (nextPriority !== currentPriority) return nextPriority > currentPriority;
  return next.latestValue >= current.latestValue;
}

function isAssignableUser(user) {
  return roleOf(user) === "ticari_user";
}

function categoryFor(item) {
  if (!item.hasAssignee) return "atanmamis";
  const status = normalizeWorkflowStatus(item.isgKatipStatus);
  if (status === "atama_onaylandi") return "aktif";
  if (
    status === "profesyonel_onayi_bekliyor" ||
    status === "isveren_onayi_bekliyor"
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

function jobKeyFor(orgId, firmaId, gorevTuru) {
  return `${String(orgId)}:${String(firmaId)}:${normalizeGorevTuru(gorevTuru)}`;
}

function normalizeJobOperation(value) {
  const allowed = new Set([
    "create_assignment",
    "cancel_pending",
    "terminate_active",
    "cancel_pending_then_create",
    "terminate_active_then_create",
  ]);
  return allowed.has(value) ? value : "create_assignment";
}

function operationForExistingStatus(status) {
  const normalized = normalizeWorkflowStatus(status);
  if (normalized === "profesyonel_onayi_bekliyor" || normalized === "isveren_onayi_bekliyor") {
    return "cancel_pending_then_create";
  }
  if (normalized === "atama_onaylandi") return "terminate_active_then_create";
  return "create_assignment";
}

async function cancelOpenJobsForAssignments(orgId, gorevTuru, firmaIds, actorId, reason = "Atama bilgisi guncellendi") {
  const validFirmaIds = (Array.isArray(firmaIds) ? firmaIds : [firmaIds]).filter((id) =>
    mongoose.Types.ObjectId.isValid(String(id))
  );
  if (validFirmaIds.length === 0) return;

  await IsgKatipJob.updateMany(
    {
      organization: orgId,
      firmaId: { $in: validFirmaIds },
      gorevTuru: normalizeGorevTuru(gorevTuru),
      status: { $in: ["pending", "failed", "in_progress"] },
    },
    {
      $set: {
        status: "cancelled",
        lastClientNote: reason,
        updatedBy: actorId || null,
      },
      $push: {
        logs: {
          action: "cancelled_by_assignment_change",
          message: reason,
          by: actorId || null,
          at: new Date(),
        },
      },
    }
  );
}

function gorevTuruLabel(gorevTuru) {
  const labels = {
    is_guvenligi_uzmani: "Is Guvenligi Uzmani",
    isyeri_hekimi: "Isyeri Hekimi",
    diger_saglik_personeli: "Diger Saglik Personeli",
  };
  return labels[normalizeGorevTuru(gorevTuru)] || labels.is_guvenligi_uzmani;
}

async function queueJobsForAssignments(orgId, gorevTuru, firmaIds, actorId, options = {}) {
  const normalizedGorevTuru = normalizeGorevTuru(gorevTuru);
  const operation = normalizeJobOperation(options.operation);
  const validFirmaIds = (Array.isArray(firmaIds) ? firmaIds : []).filter((id) =>
    mongoose.Types.ObjectId.isValid(String(id))
  );
  if (validFirmaIds.length === 0) return [];

  const [firms, assignments] = await Promise.all([
    Firma.find({ _id: { $in: validFirmaIds }, organization: orgId })
      .select("_id firmaAdi sgkNo sgkSicilNo tehlike calisanSayisi")
      .lean(),
    IsgKatipAssignment.find({
      organization: orgId,
      firmaId: { $in: validFirmaIds },
      gorevTuru: normalizedGorevTuru,
    }).lean(),
  ]);

  const firmMap = new Map(firms.map((firm) => [String(firm._id), firm]));
  const assignmentMap = new Map(assignments.map((item) => [String(item.firmaId), item]));
  const userIds = assignments
    .flatMap((item) => [item.assignedUserId, options.previousByFirmaId?.[String(item.firmaId)]?.assignedUserId])
    .filter(Boolean);
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds }, organization: orgId })
        .select("_id name email personal.tcKimlik")
        .lean()
    : [];
  const userMap = new Map(users.map((user) => [String(user._id), user]));

  const now = new Date();
  const ops = [];
  const queued = [];

  for (const firmaId of validFirmaIds) {
    const firm = firmMap.get(String(firmaId));
    const assignment = assignmentMap.get(String(firmaId));
    if (!firm || !assignment) continue;

    const sgkNo = String(firm.sgkNo || firm.sgkSicilNo || "").replace(/\D/g, "");
    let assigneeName = "";
    let assigneeTcKimlik = "";
    let assignedUserId = null;

    if (isUzmanGorevi(normalizedGorevTuru)) {
      const user = assignment.assignedUserId ? userMap.get(String(assignment.assignedUserId)) : null;
      assignedUserId = user?._id || null;
      assigneeName = user?.name || user?.email || "";
      assigneeTcKimlik = normalizeTc(user?.personal?.tcKimlik);
    } else {
      assigneeName = String(assignment.manualAssignee?.adSoyad || "").trim();
      assigneeTcKimlik = normalizeTc(assignment.manualAssignee?.tcKimlik);
    }

    if (!sgkNo || !hasValidTcValue(assigneeTcKimlik)) continue;

    const previous = options.previousByFirmaId?.[String(firmaId)] || {};
    let previousAssigneeName = String(previous.assigneeName || "").trim();
    let previousAssigneeTcKimlik = normalizeTc(previous.assigneeTcKimlik);
    if (!previousAssigneeName && previous.assignedUserId) {
      const previousUser = userMap.get(String(previous.assignedUserId));
      previousAssigneeName = previousUser?.name || previousUser?.email || "";
      previousAssigneeTcKimlik = normalizeTc(previousUser?.personal?.tcKimlik);
    }
    if (!previousAssigneeName && previous.manualAssignee?.adSoyad) {
      previousAssigneeName = String(previous.manualAssignee.adSoyad || "").trim();
      previousAssigneeTcKimlik = normalizeTc(previous.manualAssignee.tcKimlik);
    }

    const payload = {
      organization: orgId,
      firmaId: firm._id,
      assignmentId: assignment._id,
      jobKey: jobKeyFor(orgId, firm._id, normalizedGorevTuru),
      gorevTuru: normalizedGorevTuru,
      operation,
      status: "pending",
      firmaAdi: firm.firmaAdi || "",
      sgkNo,
      tehlike: firm.tehlike || "",
      calisanSayisi: Number.isFinite(Number(firm.calisanSayisi)) ? Number(firm.calisanSayisi) : null,
      assigneeName,
      assigneeTcKimlik,
      previousAssigneeName,
      previousAssigneeTcKimlik,
      previousSozlesmeId: String(previous.sozlesmeId || ""),
      assignedUserId,
      claimedAt: null,
      completedAt: null,
      lastError: "",
      lastClientNote: "",
      updatedBy: actorId || null,
    };

    ops.push({
      updateOne: {
        filter: { jobKey: payload.jobKey },
        update: {
          $set: payload,
          $setOnInsert: {
            createdBy: actorId || null,
            attempts: 0,
          },
          $push: {
            logs: {
              action: "queued",
              message: `${gorevTuruLabel(normalizedGorevTuru)} atama gorevi eklenti kuyruguna alindi (${operation})`,
              by: actorId || null,
              at: now,
            },
          },
        },
        upsert: true,
      },
    });
    queued.push(payload);
  }

  if (ops.length > 0) await IsgKatipJob.bulkWrite(ops);
  return queued;
}

function normalizeJob(job) {
  if (!job) return null;
  return {
    id: String(job._id),
    firmaId: String(job.firmaId || ""),
    assignmentId: job.assignmentId ? String(job.assignmentId) : "",
    gorevTuru: job.gorevTuru,
    gorevTuruLabel: gorevTuruLabel(job.gorevTuru),
    operation: job.operation || "create_assignment",
    status: job.status,
    firmaAdi: job.firmaAdi || "",
    sgkNo: job.sgkNo || "",
    tehlike: job.tehlike || "",
    calisanSayisi: job.calisanSayisi ?? null,
    assigneeName: job.assigneeName || "",
    assigneeTcKimlik: job.assigneeTcKimlik || "",
    previousAssigneeName: job.previousAssigneeName || "",
    previousAssigneeTcKimlik: job.previousAssigneeTcKimlik || "",
    previousSozlesmeId: job.previousSozlesmeId || "",
    attempts: job.attempts || 0,
    lastError: job.lastError || "",
    lastClientNote: job.lastClientNote || "",
    createdAt: job.createdAt || null,
    updatedAt: job.updatedAt || null,
    claimedAt: job.claimedAt || null,
  };
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

  const allFirms = await Firma.find({ organization: orgId }).sort({ firmaAdi: 1 }).lean();
  const firms =
    normalizedGorevTuru === "diger_saglik_personeli"
      ? allFirms.filter(isDspRequiredFirm)
      : allFirms;
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
    const status = normalizeWorkflowStatus(assignment?.isgKatipStatus || "kontrol_edilmedi");

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
    dusen: 0,
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

router.get("/jobs/next", async (req, res) => {
  try {
    const orgId = ensureAdmin(req, res);
    if (!orgId) return;

    const gorevTuru = req.query?.gorevTuru ? normalizeGorevTuru(req.query.gorevTuru) : null;
    const filter = {
      organization: orgId,
      status: { $in: ["pending", "failed"] },
      ...(gorevTuru ? { gorevTuru } : {}),
    };

    const job = await IsgKatipJob.findOne(filter).sort({ updatedAt: 1 }).lean();
    return res.json({ ok: true, job: normalizeJob(job) });
  } catch (err) {
    console.error("ISG-KATIP next job hata:", err);
    return res.status(500).json({ message: "Bekleyen atama gorevi alinamadi" });
  }
});

router.post("/jobs/:jobId/claim", async (req, res) => {
  try {
    const orgId = ensureAdmin(req, res);
    if (!orgId) return;

    const { jobId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(String(jobId))) {
      return res.status(400).json({ message: "Gorev bilgisi gecersiz" });
    }

    const now = new Date();
    const job = await IsgKatipJob.findOneAndUpdate(
      { _id: jobId, organization: orgId, status: { $in: ["pending", "failed", "in_progress"] } },
      {
        $set: {
          status: "in_progress",
          claimedAt: now,
          lastError: "",
          lastClientNote: String(req.body?.note || "").slice(0, 500),
          updatedBy: req.user._id || req.user.id || null,
        },
        $inc: { attempts: 1 },
        $push: {
          logs: {
            action: "claimed",
            message: "Eklenti atama gorevini isleme aldi",
            by: req.user._id || req.user.id || null,
            at: now,
          },
        },
      },
      { new: true }
    ).lean();

    if (!job) return res.status(404).json({ message: "Bekleyen gorev bulunamadi" });
    return res.json({ ok: true, job: normalizeJob(job) });
  } catch (err) {
    console.error("ISG-KATIP claim job hata:", err);
    return res.status(500).json({ message: "Atama gorevi baslatilamadi" });
  }
});

router.patch("/jobs/:jobId", async (req, res) => {
  try {
    const orgId = ensureAdmin(req, res);
    if (!orgId) return;

    const { jobId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(String(jobId))) {
      return res.status(400).json({ message: "Gorev bilgisi gecersiz" });
    }

    const status = String(req.body?.status || "").trim();
    if (!["pending", "in_progress", "done", "failed", "cancelled"].includes(status)) {
      return res.status(400).json({ message: "Gorev durumu gecersiz" });
    }

    const now = new Date();
    const error = String(req.body?.error || "").slice(0, 1000);
    const note = String(req.body?.note || "").slice(0, 1000);
    const job = await IsgKatipJob.findOneAndUpdate(
      { _id: jobId, organization: orgId },
      {
        $set: {
          status,
          ...(status === "done" ? { completedAt: now } : {}),
          lastError: status === "failed" ? error : "",
          lastClientNote: note,
          updatedBy: req.user._id || req.user.id || null,
        },
        $push: {
          logs: {
            action: `job_${status}`,
            message: note || error || `Gorev durumu ${status} olarak guncellendi`,
            by: req.user._id || req.user.id || null,
            at: now,
          },
        },
      },
      { new: true }
    ).lean();

    if (!job) return res.status(404).json({ message: "Gorev bulunamadi" });

    if (job.assignmentId) {
      const closeOnlyOperations = new Set(["cancel_pending", "terminate_active"]);
      const nextAssignmentStatus =
        status === "done"
          ? closeOnlyOperations.has(job.operation)
            ? "atama_yok"
            : "profesyonel_onayi_bekliyor"
          : status === "failed"
            ? "atama_yok"
            : null;
      if (nextAssignmentStatus) {
        await IsgKatipAssignment.updateOne(
          { _id: job.assignmentId, organization: orgId },
          {
            $set: {
              isgKatipStatus: nextAssignmentStatus,
              lastSyncAt: now,
              lastError: status === "failed" ? error : "",
            },
            $push: {
              logs: {
                action: `extension_job_${status}`,
                message:
                  status === "done"
                    ? "Eklenti gorevi tamamlandi; atama onay surecine alindi"
                    : "Eklenti gorevi hatali isaretlendi; atama yeniden baslatilabilir duruma alindi",
                by: req.user._id || req.user.id || null,
                at: now,
              },
            },
          }
        );
      }
    }

    return res.json({ ok: true, job: normalizeJob(job) });
  } catch (err) {
    console.error("ISG-KATIP update job hata:", err);
    return res.status(500).json({ message: "Atama gorevi guncellenemedi" });
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
      .select("_id sgkNo sgkSicilNo tehlike calisanSayisi")
      .lean();

    const firmBySgk = new Map();
    firms.forEach((firm) => {
      if (firm.sgkNo) firmBySgk.set(String(firm.sgkNo).replace(/\D/g, ""), firm);
      if (firm.sgkSicilNo) firmBySgk.set(String(firm.sgkSicilNo).replace(/\D/g, ""), firm);
    });

    const firmIds = firms.map((firm) => firm._id);
    const [links, users, assignments, savedAssignees] = await Promise.all([
      FirmUser.find(
        uzmanLinkFilter({
          organization: orgId,
          firmId: { $in: firmIds },
          isActive: true,
        })
      ).lean(),
      User.find({ organization: orgId, role: "ticari_user" })
        .select("_id name email personal.tcKimlik")
        .lean(),
      IsgKatipAssignment.find({
        organization: orgId,
        firmaId: { $in: firmIds },
      }).lean(),
      IsgKatipPerson.find({
        organization: orgId,
        isActive: true,
      }).lean(),
    ]);

    const usersById = new Map(users.map((user) => [String(user._id), user]));
    const usersByTc = new Map(
      users
        .map((user) => [normalizeTc(user.personal?.tcKimlik), user])
        .filter(([tc]) => hasValidTcValue(tc))
    );
    const activeUzmanLinksByFirm = new Map();
    links.forEach((link) => {
      const key = String(link.firmId);
      const arr = activeUzmanLinksByFirm.get(key) || [];
      arr.push(link);
      activeUzmanLinksByFirm.set(key, arr);
    });

    const assignmentsByFirmRole = new Map();
    assignments.forEach((assignment) => {
      assignmentsByFirmRole.set(`${String(assignment.firmaId)}:${assignment.gorevTuru}`, assignment);
    });

    const savedPeopleByRoleTc = new Map();
    savedAssignees.forEach((person) => {
      const tc = normalizeTc(person.tcKimlik);
      if (hasValidTcValue(tc)) savedPeopleByRoleTc.set(`${person.gorevTuru}:${tc}`, person);
    });

    const now = new Date();
    const assignmentOpsByKey = new Map();
    const linkOps = [];
    const deactivateLinkFilters = [];
    const firmUpdates = new Map();
    let matched = 0;
    const latestRowsByIdentity = new Map();

    rows.forEach((row, index) => {
      const sgkNo = String(row.sgkNo || "").replace(/\D/g, "");
      const firm = firmBySgk.get(sgkNo);
      if (!firm) return;

      const rawStatus = STATUS_LABELS[row.isgKatipStatus]
        ? row.isgKatipStatus
        : "kontrol_edilmedi";
      const gorevTuru = normalizeGorevTuru(row.gorevTuru);
      const personelTc = normalizeTc(row.personelTcKimlik);
      if (gorevTuru === "diger_saglik_personeli" && !isDspRequiredFirm(firm)) return;

      const latestValue = contractSortValue(row, index);
      const status = normalizeWorkflowStatus(rawStatus);
      const identityKey = `${String(firm._id)}:${gorevTuru}:${personelTc || "tc-yok"}:${status}`;
      const currentIdentity = latestRowsByIdentity.get(identityKey);
      if (!currentIdentity || latestValue >= currentIdentity.latestValue) {
        latestRowsByIdentity.set(identityKey, {
          row,
          firm,
          rawStatus,
          gorevTuru,
          personelTc,
          latestValue,
          status,
        });
      }
    });

    Array.from(latestRowsByIdentity.values()).forEach((syncItem) => {
      const { row, firm, rawStatus, gorevTuru, personelTc, latestValue } = syncItem;
      matched += 1;
      const tehlike = normalizeTehlike(row.tehlike);
      const calisanSayisi = Number.isFinite(Number(row.calisanSayisi))
        ? Number(row.calisanSayisi)
        : null;
      const existingAssignment = assignmentsByFirmRole.get(`${String(firm._id)}:${gorevTuru}`) || null;
      const updateSet = {};
      let hasKnownAssignee = false;

      if (isUzmanGorevi(gorevTuru)) {
        const activeLinks = activeUzmanLinksByFirm.get(String(firm._id)) || [];
        const matchedExistingLink = activeLinks.find((link) => {
          const user = usersById.get(String(link.userId));
          return hasValidTcValue(personelTc) && normalizeTc(user?.personal?.tcKimlik) === personelTc;
        });
        const matchedUser = hasValidTcValue(personelTc) ? usersByTc.get(personelTc) : null;

        if (matchedExistingLink || matchedUser) {
          const assignedUserId = matchedExistingLink?.userId || matchedUser?._id;
          updateSet.assignedUserId = assignedUserId;
          hasKnownAssignee = true;

          if (!matchedExistingLink && matchedUser) {
            deactivateLinkFilters.push({
              organization: orgId,
              firmId: firm._id,
            });
            linkOps.push({
              updateOne: {
                filter: { organization: orgId, firmId: firm._id, userId: matchedUser._id },
                update: {
                  $set: {
                    organization: orgId,
                    firmId: firm._id,
                    userId: matchedUser._id,
                    gorevTuru,
                    isActive: true,
                    assignedBy: req.user._id || req.user.id || null,
                  },
                },
                upsert: true,
              },
            });
          }
        }
      } else {
        const existingManualTc = normalizeTc(existingAssignment?.manualAssignee?.tcKimlik);
        const savedPerson = hasValidTcValue(personelTc)
          ? savedPeopleByRoleTc.get(`${gorevTuru}:${personelTc}`)
          : null;

        if (hasValidTcValue(personelTc) && (existingManualTc === personelTc || savedPerson)) {
          updateSet.manualAssignee = {
            adSoyad:
              existingAssignment?.manualAssignee?.adSoyad ||
              savedPerson?.adSoyad ||
              String(row.personelAdSoyad || "").trim().toLocaleUpperCase("tr-TR"),
            tcKimlik: personelTc,
          };
          hasKnownAssignee = true;
        }
      }

      const status = normalizeWorkflowStatus(
        isUnknownSyncStatus(rawStatus) && hasKnownAssignee && hasValidTcValue(personelTc)
          ? "atama_onaylandi"
          : rawStatus
      );

      const firmUpdate = firmUpdates.get(String(firm._id)) || {};
      if (tehlike) firmUpdate.tehlike = tehlike;
      if (calisanSayisi !== null) firmUpdate.calisanSayisi = calisanSayisi;
      if (Object.keys(firmUpdate).length > 0) firmUpdates.set(String(firm._id), firmUpdate);

      const assignmentKey = `${String(firm._id)}:${gorevTuru}`;
      const priority = statusPriority(status);
      const assignmentOp = {
        updateOne: {
          filter: {
            organization: orgId,
            firmaId: firm._id,
            gorevTuru,
          },
          update: {
            $set: {
              organization: orgId,
              firmaId: firm._id,
              gorevTuru,
              ...updateSet,
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
      };
      const current = assignmentOpsByKey.get(assignmentKey);
      const nextCandidate = { priority, status, latestValue, op: assignmentOp };
      if (shouldPreferSyncRow(nextCandidate, current)) {
        assignmentOpsByKey.set(assignmentKey, nextCandidate);
      }
    });

    if (deactivateLinkFilters.length > 0) {
      await Promise.all(
        deactivateLinkFilters.map((filter) =>
          FirmUser.updateMany(uzmanLinkFilter({ ...filter, isActive: true }), {
            $set: { isActive: false },
          })
        )
      );
    }
    if (linkOps.length > 0) await FirmUser.bulkWrite(linkOps);
    const ops = Array.from(assignmentOpsByKey.values()).map((entry) => entry.op);
    if (ops.length > 0) await IsgKatipAssignment.bulkWrite(ops);
    if (firmUpdates.size > 0) {
      await Firma.bulkWrite(
        Array.from(firmUpdates.entries()).map(([firmaId, update]) => ({
          updateOne: {
            filter: { _id: firmaId, organization: orgId },
            update: { $set: update },
          },
        }))
      );
    }

    const overview = await buildOverview(orgId, normalizeGorevTuru(req.body?.source?.pageGorevTuru));
    return res.json({
      ok: true,
      received: rows.length,
      matched,
      unmatched: rows.length - matched,
      updatedFirms: firmUpdates.size,
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

    const previousAssignments = await IsgKatipAssignment.find({
      organization: orgId,
      firmaId: { $in: scopedFirmaIds },
      gorevTuru,
    }).lean();
    const previousByFirmaId = Object.fromEntries(
      previousAssignments.map((item) => [
        String(item.firmaId),
        {
          assignedUserId: item.assignedUserId,
          manualAssignee: item.manualAssignee,
          sozlesmeId: item.sozlesmeId,
          isgKatipStatus: item.isgKatipStatus,
        },
      ])
    );

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

    await cancelOpenJobsForAssignments(
      orgId,
      gorevTuru,
      scopedFirmaIds,
      req.user._id || req.user.id || null,
      "Toplu kullanici atamasi degisti"
    );

    const operationGroups = new Map();
    scopedFirmaIds.forEach((firmaId) => {
      const previous = previousByFirmaId[String(firmaId)];
      const operation = operationForExistingStatus(previous?.isgKatipStatus);
      if (operation === "create_assignment") return;
      if (!operationGroups.has(operation)) operationGroups.set(operation, []);
      operationGroups.get(operation).push(firmaId);
    });
    for (const [operation, operationFirmaIds] of operationGroups.entries()) {
      await queueJobsForAssignments(
        orgId,
        gorevTuru,
        operationFirmaIds,
        req.user._id || req.user.id || null,
        { operation, previousByFirmaId }
      );
    }

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

    const previousAssignments = await IsgKatipAssignment.find({
      organization: orgId,
      firmaId: { $in: scopedFirmaIds },
      gorevTuru,
    }).lean();
    const previousByFirmaId = Object.fromEntries(
      previousAssignments.map((item) => [
        String(item.firmaId),
        {
          assignedUserId: item.assignedUserId,
          manualAssignee: item.manualAssignee,
          sozlesmeId: item.sozlesmeId,
          isgKatipStatus: item.isgKatipStatus,
        },
      ])
    );

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

    await cancelOpenJobsForAssignments(
      orgId,
      gorevTuru,
      scopedFirmaIds,
      req.user._id || req.user.id || null,
      "Toplu kisi bilgisi degisti"
    );

    const operationGroups = new Map();
    scopedFirmaIds.forEach((firmaId) => {
      const previous = previousByFirmaId[String(firmaId)];
      const operation = operationForExistingStatus(previous?.isgKatipStatus);
      if (operation === "create_assignment") return;
      if (!operationGroups.has(operation)) operationGroups.set(operation, []);
      operationGroups.get(operation).push(firmaId);
    });
    for (const [operation, operationFirmaIds] of operationGroups.entries()) {
      await queueJobsForAssignments(
        orgId,
        gorevTuru,
        operationFirmaIds,
        req.user._id || req.user.id || null,
        { operation, previousByFirmaId }
      );
    }

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
                  isgKatipStatus: "atama_yok",
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

      const queuedJobs = await queueJobsForAssignments(
        orgId,
        gorevTuru,
        firmaIds,
        req.user._id || req.user.id || null
      );
      const overview = await buildOverview(orgId, gorevTuru);
      return res.json({ ok: true, queuedJobs: queuedJobs.length, ...overview });
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
                isgKatipStatus: "atama_yok",
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

    const queuedJobs = await queueJobsForAssignments(
      orgId,
      gorevTuru,
      firmaIds,
      req.user._id || req.user.id || null
    );
    const overview = await buildOverview(orgId, gorevTuru);
    return res.json({ ok: true, queuedJobs: queuedJobs.length, ...overview });
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
    const requestedStatus = String(req.body?.isgKatipStatus || "").trim();
    if (!STATUS_LABELS[requestedStatus]) {
      return res.status(400).json({ message: "İSG-KATİP durumu geçersiz" });
    }
    const nextStatus = normalizeWorkflowStatus(requestedStatus);

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
      .select("name email role personal.tcKimlik personal.sertifikaNo")
      .lean();
    if (!user) return res.status(404).json({ message: "Kullanıcı bulunamadı" });
    if (!isAssignableUser(user)) {
      return res.status(400).json({ message: "Seçilen kullanıcı iş güvenliği uzmanı değil" });
    }

    const previousAssignment = await IsgKatipAssignment.findOne({
      organization: orgId,
      firmaId,
      gorevTuru,
    }).lean();
    const operation = operationForExistingStatus(previousAssignment?.isgKatipStatus);
    const previousByFirmaId = previousAssignment
      ? {
          [String(firmaId)]: {
            assignedUserId: previousAssignment.assignedUserId,
            manualAssignee: previousAssignment.manualAssignee,
            sozlesmeId: previousAssignment.sozlesmeId,
          },
        }
      : {};

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

    await cancelOpenJobsForAssignments(
      orgId,
      gorevTuru,
      [firmaId],
      req.user._id || req.user.id || null,
      "Kullanici atamasi degisti"
    );

    if (operation !== "create_assignment") {
      await queueJobsForAssignments(
        orgId,
        gorevTuru,
        [firmaId],
        req.user._id || req.user.id || null,
        { operation, previousByFirmaId }
      );
    }

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

    const previousAssignment = await IsgKatipAssignment.findOne({
      organization: orgId,
      firmaId,
      gorevTuru,
    }).lean();
    const operation = operationForExistingStatus(previousAssignment?.isgKatipStatus);
    const previousByFirmaId = previousAssignment
      ? {
          [String(firmaId)]: {
            assignedUserId: previousAssignment.assignedUserId,
            manualAssignee: previousAssignment.manualAssignee,
            sozlesmeId: previousAssignment.sozlesmeId,
          },
        }
      : {};

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

    await cancelOpenJobsForAssignments(
      orgId,
      gorevTuru,
      [firmaId],
      req.user._id || req.user.id || null,
      "Kisi bilgisi degisti"
    );

    if (operation !== "create_assignment") {
      await queueJobsForAssignments(
        orgId,
        gorevTuru,
        [firmaId],
        req.user._id || req.user.id || null,
        { operation, previousByFirmaId }
      );
    }

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

    const requestedStatus = String(req.body?.isgKatipStatus || "").trim();
    if (!STATUS_LABELS[requestedStatus]) {
      return res.status(400).json({ message: "İSG-KATİP durumu geçersiz" });
    }
    const nextStatus = normalizeWorkflowStatus(requestedStatus);

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
            isgKatipStatus: "atama_yok",
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

      const queuedJobs = await queueJobsForAssignments(
        orgId,
        gorevTuru,
        [firmaId],
        req.user._id || req.user.id || null
      );

      return res.json({ ok: true, assignment, queuedJobs: queuedJobs.length });
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
          isgKatipStatus: "atama_yok",
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

    const queuedJobs = await queueJobsForAssignments(
      orgId,
      gorevTuru,
      [firmaId],
      req.user._id || req.user.id || null
    );

    return res.json({ ok: true, assignment, queuedJobs: queuedJobs.length });
  } catch (err) {
    console.error("ISG-KATIP start hata:", err);
    return res.status(500).json({ message: "Atama süreci başlatılamadı" });
  }
});

module.exports = router;
