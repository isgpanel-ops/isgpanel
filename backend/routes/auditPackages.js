const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");
const mongoose = require("mongoose");
const QRCode = require("qrcode");
const Document = require("../models/Document");
const AuditPackage = require("../models/AuditPackage");
const AuditPackageDocument = require("../models/AuditPackageDocument");
const auth = require("../middleware/auth");
const { sendMail } = require("../utils/mailer");

const router = express.Router();

function normalizeEmail(value = "") {
  return String(value).trim().toLowerCase();
}

function dayRange(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function makePasswordHash(password) {
  if (!password) return {};
  const salt = crypto.randomBytes(16).toString("hex");
  return { passwordSalt: salt, passwordHash: crypto.scryptSync(String(password), salt, 64).toString("hex") };
}

function passwordMatches(pkg, password) {
  if (!pkg.passwordHash) return true;
  if (!password || !pkg.passwordSalt) return false;
  const actual = crypto.scryptSync(String(password), pkg.passwordSalt, 64);
  const expected = Buffer.from(pkg.passwordHash, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function packageAvailable(pkg) {
  return pkg && pkg.status === "ACTIVE" && !pkg.revokedAt && (!pkg.expiresAt || new Date(pkg.expiresAt) > new Date());
}

function requestPassword(req) {
  return req.get("x-audit-password") || req.query.password || "";
}

const CATEGORIES = [
  "Risk Değerlendirmesi",
  "Acil Durum",
  "Eğitimler",
  "Atamalar",
  "Yıllık Planlar",
  "Yıllık Değerlendirme",
  "Kurul / Toplantılar",
  "KKD",
  "Genel Talimatlar",
  "Periyodik Kontroller",
  "İş Hijyeni",
  "Sağlık Belgeleri",
  "DÖF",
  "Diğer Belgeler",
];

function escapeRegExp(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeText(value = "") {
  return String(value)
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/\s+/g, " ")
    .trim();
}

function orgCandidates(user = {}) {
  return [
    user.organizationId,
    user.organizationUuid,
    user.orgId,
    user.tenantId,
    user.companyId,
    user._id,
    user.id,
    user.email,
  ]
    .filter(Boolean)
    .map(String);
}

function primaryOrgId(user = {}) {
  return orgCandidates(user)[0] || "default";
}

function companyConditions(companyId, companyName) {
  const id = String(companyId || "").trim();
  const name = String(companyName || "").trim();
  const list = [];

  if (id) {
    list.push({ firmaId: id }, { companyId: id });
    if (mongoose.Types.ObjectId.isValid(id)) {
      list.push({ firmaId: new mongoose.Types.ObjectId(id) }, { companyId: new mongoose.Types.ObjectId(id) });
    }
  }

  if (name) {
    const exact = new RegExp(`^${escapeRegExp(name)}$`, "i");
    list.push({ firmaAdi: exact }, { companyName: exact });
  }

  return list.length ? list : [{ _id: null }];
}

function buildDocumentQuery(req, companyId, companyName) {
  const orgs = orgCandidates(req.user);
  const and = [{ $or: companyConditions(companyId, companyName) }];

  if (orgs.length) {
    and.push({
      $or: orgs.map((id) => ({ organizationId: id })),
    });
  }

  and.push({ status: { $nin: ["arsiv", "archived", "ARCHIVED", "REVOKED", "revoked"] } });
  and.push({ $or: [{ archivedAt: null }, { archivedAt: { $exists: false } }] });

  return { $and: and };
}

function textOf(doc) {
  return [
    doc.category,
    doc.subCategory,
    doc.belgeTuru,
    doc.dosyaTuru,
    doc.title,
    doc.fileName,
  ]
    .filter(Boolean)
    .join(" ");
}

function inferCategory(doc) {
  const exact = CATEGORIES.find((category) => normalizeText(category) === normalizeText(doc.category));
  if (exact) return exact;

  const text = normalizeText(textOf(doc));
  if (text.includes("risk")) return "Risk Değerlendirmesi";
  if (text.includes("acil")) return "Acil Durum";
  if (text.includes("egitim") || text.includes("sertifika")) return "Eğitimler";
  if (text.includes("atama") || text.includes("gorev") || text.includes("katip")) return "Atamalar";
  if (text.includes("yillik") && text.includes("plan")) return "Yıllık Planlar";
  if (text.includes("yillik") && text.includes("degerlendirme")) return "Yıllık Değerlendirme";
  if (text.includes("kurul") || text.includes("toplanti") || text.includes("defter")) return "Kurul / Toplantılar";
  if (text.includes("kkd")) return "KKD";
  if (text.includes("talimat")) return "Genel Talimatlar";
  if (text.includes("periyodik") || text.includes("kontrol")) return "Periyodik Kontroller";
  if (text.includes("hijyen")) return "İş Hijyeni";
  if (text.includes("saglik") || text.includes("muayene") || text.includes("hekim")) return "Sağlık Belgeleri";
  if (text.includes("dof")) return "DÖF";
  return "Diğer Belgeler";
}

function signatureStatus(doc) {
  const data = doc.data || {};
  return (
    doc.signatureStatus ||
    doc.imzaDurumu ||
    data.signatureStatus ||
    data.imzaDurumu ||
    data.signedStatus ||
    ""
  );
}

function serializeDocument(doc, category, publicToken = null) {
  const id = String(doc._id);
  return {
    id,
    title: doc.title || doc.belgeTuru || doc.fileName || "Belge",
    fileName: doc.fileName || "",
    category,
    belgeTuru: doc.belgeTuru || "",
    tarih: doc.tarih || doc.dateISO || doc.createdAt || null,
    revision: doc.revision || doc.rev || doc.data?.revision || "",
    status: doc.status || "",
    signatureStatus: signatureStatus(doc),
    createdAt: doc.createdAt,
    hasFile: Boolean(doc.storagePath || doc.fileUrl || doc.absoluteUrl),
    fileEndpoint: publicToken ? `/api/audit-packages/public/${publicToken}/documents/${id}/file` : "",
  };
}

function groupDocuments(docs, options = {}) {
  const publicToken = options.publicToken || null;
  const includeEmpty = options.includeEmpty !== false;
  const categoryOverride = options.categoryOverride || new Map();
  const map = new Map(CATEGORIES.map((name) => [name, []]));

  docs.forEach((doc) => {
    const id = String(doc._id);
    const category = categoryOverride.get(id) || inferCategory(doc);
    if (!map.has(category)) map.set(category, []);
    map.get(category).push(serializeDocument(doc, category, publicToken));
  });

  return Array.from(map.entries())
    .filter(([, documents]) => includeEmpty || documents.length > 0)
    .map(([name, documents]) => ({
      id: normalizeText(name).replace(/\s+/g, "-"),
      name,
      count: documents.length,
      status: documents.length ? "Hazır" : "Belge bulunamadı",
      selectedDefault: documents.length > 0 && name !== "Sağlık Belgeleri",
      documents,
    }));
}

function sameCompany(doc, pkg) {
  const docCompanyIds = [doc.companyId, doc.firmaId].filter(Boolean).map(String);
  if (docCompanyIds.includes(String(pkg.companyId))) return true;
  return normalizeText(doc.firmaAdi || doc.companyName) === normalizeText(pkg.companyName);
}

function publicBaseUrl(req) {
  const envUrl = process.env.PUBLIC_APP_URL || process.env.APP_PUBLIC_URL || process.env.FRONTEND_URL || process.env.CLIENT_URL;
  if (envUrl) return String(envUrl).replace(/\/$/, "");
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host = req.headers["x-forwarded-host"] || req.get("host");
  return `${proto}://${host}`.replace(/\/api$/, "");
}

function publicUrl(req, pkg) {
  return `${publicBaseUrl(req)}/denetim/goruntule/${pkg.publicToken}`;
}

async function nextPackageNumber() {
  const year = new Date().getFullYear();
  const prefix = `DNT-${year}-`;
  const latest = await AuditPackage.findOne({ packageNumber: new RegExp(`^${prefix}`) })
    .sort({ packageNumber: -1 })
    .select("packageNumber")
    .lean();
  const last = latest?.packageNumber ? Number(latest.packageNumber.slice(prefix.length)) || 0 : 0;
  return `${prefix}${String(last + 1).padStart(6, "0")}`;
}

function safeFilePath(doc) {
  const raw = doc.storagePath || doc.absoluteUrl || doc.fileUrl || "";
  if (!raw || /^https?:\/\//i.test(raw)) return "";
  const resolved = path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
  return fs.existsSync(resolved) ? resolved : "";
}

async function packagePayload(req, pkg, options = {}) {
  const links = await AuditPackageDocument.find({ auditPackageId: pkg._id }).lean();
  const documentIds = links.map((link) => link.documentId).filter(Boolean);
  const docs = await Document.find({ _id: { $in: documentIds } }).lean();
  const byId = new Map(docs.map((doc) => [String(doc._id), doc]));
  const categoryOverride = new Map();
  const safeDocs = [];

  links.forEach((link) => {
    const doc = byId.get(String(link.documentId));
    if (!doc || !sameCompany(doc, pkg)) return;
    categoryOverride.set(String(doc._id), link.category || inferCategory(doc));
    safeDocs.push(doc);
  });

  const categories = groupDocuments(safeDocs, {
    includeEmpty: false,
    publicToken: pkg.publicToken,
    categoryOverride,
  });

  const payload = {
    package: {
      id: String(pkg._id),
      companyId: pkg.companyId,
      companyName: pkg.companyName,
      packageNumber: pkg.packageNumber,
      createdAt: pkg.createdAt,
      updatedAt: pkg.updatedAt,
      status: pkg.status,
      publicToken: pkg.publicToken,
      publicUrl: publicUrl(req, pkg),
      recipientName: pkg.recipientName,
      recipientType: pkg.recipientType,
      recipientEmail: pkg.recipientEmail,
      note: pkg.note || "",
      accessType: pkg.accessType,
      requiresPassword: Boolean(pkg.passwordHash),
      allowDownload: pkg.allowDownload !== false,
      expiresAt: pkg.expiresAt || null,
      emailStatus: pkg.emailStatus || "NOT_SENT",
      documentCount: safeDocs.length,
      categoryCount: categories.length,
    },
    categories,
  };

  if (options.includeQr) {
    payload.package.qrCodeDataUrl = await QRCode.toDataURL(payload.package.publicUrl, {
      width: 280,
      margin: 1,
      errorCorrectionLevel: "M",
    });
  }

  return payload;
}

router.get("/prepare", auth, async (req, res) => {
  try {
    const companyId = req.query.companyId || "";
    const companyName = req.query.companyName || "";
    if (!companyId && !companyName) return res.status(400).json({ message: "Firma bilgisi gerekli." });

    const docs = await Document.find(buildDocumentQuery(req, companyId, companyName)).sort({ createdAt: -1 }).lean();
    const organizationId = primaryOrgId(req.user);
    const packages = await AuditPackage.find({
      organizationId,
      $or: companyConditions(companyId, companyName),
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const packageIds = packages.map((pkg) => pkg._id);
    const links = packageIds.length
      ? await AuditPackageDocument.aggregate([
          { $match: { auditPackageId: { $in: packageIds } } },
          { $group: { _id: "$auditPackageId", documentCount: { $sum: 1 }, categories: { $addToSet: "$category" } } },
        ])
      : [];
    const stats = new Map(links.map((item) => [String(item._id), item]));

    res.json({
      company: {
        id: companyId,
        name: companyName,
      },
      totalDocuments: docs.length,
      categories: groupDocuments(docs),
      packages: packages.map((pkg) => {
        const stat = stats.get(String(pkg._id));
        return {
          id: String(pkg._id),
          packageNumber: pkg.packageNumber,
          createdAt: pkg.createdAt,
          status: pkg.status,
          publicToken: pkg.publicToken,
          publicUrl: publicUrl(req, pkg),
          recipientName: pkg.recipientName,
          recipientType: pkg.recipientType,
          recipientEmail: pkg.recipientEmail,
          accessType: pkg.accessType,
          expiresAt: pkg.expiresAt,
          allowDownload: pkg.allowDownload,
          emailStatus: pkg.emailStatus,
          documentCount: stat?.documentCount || 0,
          categoryCount: stat?.categories?.filter(Boolean).length || 0,
        };
      }),
    });
  } catch (err) {
    console.error("audit prepare error:", err);
    res.status(500).json({ message: "Denetim hazırlık verisi alınamadı." });
  }
});

router.post("/", auth, async (req, res) => {
  try {
    const companyId = String(req.body.companyId || "").trim();
    const companyName = String(req.body.companyName || "").trim();
    const recipientName = String(req.body.recipientName || "").trim();
    const recipientType = ["INSPECTOR", "EMPLOYER", "HR", "OTHER"].includes(req.body.recipientType)
      ? req.body.recipientType
      : "OTHER";
    const recipientEmail = normalizeEmail(req.body.recipientEmail);
    const note = String(req.body.note || "").trim();
    const accessType = req.body.accessType === "TIMED" ? "TIMED" : "UNLIMITED";
    const expiresAt = accessType === "TIMED" ? new Date(req.body.expiresAt) : null;
    const password = String(req.body.password || "");
    const allowDownload = req.body.allowDownload !== false;
    const documentIds = Array.isArray(req.body.documentIds) ? req.body.documentIds.map(String) : [];
    const uniqueIds = [...new Set(documentIds)].filter((id) => mongoose.Types.ObjectId.isValid(id));

    if (!companyId && !companyName) return res.status(400).json({ message: "Firma bilgisi gerekli." });
    if (!uniqueIds.length) return res.status(400).json({ message: "En az 1 belge seçilmelidir." });
    if (!recipientName) return res.status(400).json({ message: "Alıcı adı gereklidir." });
    if (!/^\S+@\S+\.\S+$/.test(recipientEmail)) return res.status(400).json({ message: "Geçerli bir e-posta adresi giriniz." });
    if (accessType === "TIMED" && (!Number.isFinite(expiresAt.getTime()) || expiresAt <= new Date())) {
      return res.status(400).json({ message: "Süreli paylaşım için ileri bir son tarih seçiniz." });
    }

    const allowedDocs = await Document.find({
      ...buildDocumentQuery(req, companyId, companyName),
      _id: { $in: uniqueIds },
    }).lean();

    if (!allowedDocs.length) return res.status(400).json({ message: "Seçilen belgeler bu firma için bulunamadı." });

    const organizationId = primaryOrgId(req.user);
    const { start, end } = dayRange();
    const companyMatch = companyId ? { companyId } : { companyName };
    const sameDayPackages = await AuditPackage.find({
      organizationId,
      ...companyMatch,
      recipientEmail,
      createdAt: { $gte: start, $lt: end },
    }).select("_id").lean();
    const alreadyShared = sameDayPackages.length
      ? await AuditPackageDocument.find({ auditPackageId: { $in: sameDayPackages.map((item) => item._id) } })
          .select("documentId").lean()
      : [];
    const sharedIds = new Set(alreadyShared.map((item) => String(item.documentId)));
    const packageDocs = allowedDocs.filter((doc) => !sharedIds.has(String(doc._id)));
    if (!packageDocs.length) {
      return res.status(409).json({ message: "Seçilen belgeler bu alıcıyla bugün zaten paylaşılmıştır." });
    }

    const passwordFields = makePasswordHash(password);
    let pkg = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        pkg = await AuditPackage.create({
          organizationId,
          companyId: companyId || String(packageDocs[0].firmaId || packageDocs[0].companyId || ""),
          companyName: companyName || packageDocs[0].firmaAdi || packageDocs[0].companyName || "",
          packageNumber: await nextPackageNumber(),
          createdBy: req.user?.name || req.user?.adSoyad || req.user?.email || "",
          createdByUserId: String(req.user?._id || req.user?.id || ""),
          status: "ACTIVE",
          publicToken: crypto.randomBytes(32).toString("hex"),
          recipientName,
          recipientType,
          recipientEmail,
          note,
          accessType,
          expiresAt,
          allowDownload,
          documentCount: packageDocs.length,
          categoryCount: new Set(packageDocs.map(inferCategory)).size,
          ...passwordFields,
        });
        break;
      } catch (err) {
        if (err?.code !== 11000 || attempt === 2) throw err;
      }
    }

    await AuditPackageDocument.insertMany(
      packageDocs.map((doc) => ({
        auditPackageId: pkg._id,
        documentId: doc._id,
        organizationId,
        companyId: pkg.companyId,
        category: inferCategory(doc),
        documentVersion: doc.revision || doc.rev || doc.data?.revision || "",
      })),
      { ordered: false }
    );

    const url = publicUrl(req, pkg);
    try {
      await sendMail({
        to: recipientEmail,
        subject: `${pkg.companyName} - İSG Belge Paylaşımı`,
        text: `${recipientName},\n\n${pkg.companyName} firmasına ait belgeler sizinle paylaşılmıştır.\nDosya No: ${pkg.packageNumber}\n${url}`,
        html: `<p>Sayın ${recipientName},</p><p><strong>${pkg.companyName}</strong> firmasına ait belgeler sizinle paylaşılmıştır.</p><p>Dosya No: <strong>${pkg.packageNumber}</strong></p><p><a href="${url}">Belgeleri görüntüle</a></p>`,
      });
      pkg.emailStatus = "SENT";
      pkg.emailSentAt = new Date();
    } catch (mailErr) {
      console.error("audit package mail error:", mailErr);
      pkg.emailStatus = "FAILED";
    }
    await pkg.save();

    res.status(201).json({
      ...(await packagePayload(req, pkg, { includeQr: true })),
      skippedDuplicateCount: allowedDocs.length - packageDocs.length,
    });
  } catch (err) {
    console.error("audit create error:", err);
    res.status(500).json({ message: "Denetim dosyası oluşturulamadı." });
  }
});

router.get("/public/:publicToken", async (req, res) => {
  try {
    const pkg = await AuditPackage.findOne({ publicToken: req.params.publicToken })
      .select("+passwordHash +passwordSalt")
      .lean();
    if (!packageAvailable(pkg)) return res.status(404).json({ message: "Denetim bağlantısı geçersiz." });
    if (!passwordMatches(pkg, requestPassword(req))) {
      return res.status(401).json({ requiresPassword: true, message: "Paylaşım şifresi gereklidir." });
    }
    res.json(await packagePayload(req, pkg));
  } catch (err) {
    console.error("audit public error:", err);
    res.status(500).json({ message: "Denetim dosyası görüntülenemedi." });
  }
});

router.get("/public/:publicToken/documents/:documentId/file", async (req, res) => {
  try {
    const { publicToken, documentId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(documentId)) return res.status(404).end();

    const pkg = await AuditPackage.findOne({ publicToken })
      .select("+passwordHash +passwordSalt")
      .lean();
    if (!packageAvailable(pkg)) return res.status(404).end();
    if (!passwordMatches(pkg, requestPassword(req))) return res.status(401).end();
    if (req.query.download === "1" && !pkg.allowDownload) return res.status(403).end();

    const link = await AuditPackageDocument.findOne({
      auditPackageId: pkg._id,
      documentId,
      organizationId: pkg.organizationId,
      companyId: pkg.companyId,
    }).lean();
    if (!link) return res.status(404).end();

    const doc = await Document.findById(documentId).lean();
    if (!doc || !sameCompany(doc, pkg)) return res.status(404).end();

    const localPath = safeFilePath(doc);
    if (localPath) {
      if (req.query.download === "1") return res.download(localPath, doc.fileName || path.basename(localPath));
      return res.sendFile(localPath);
    }

    const remoteUrl = doc.fileUrl || doc.absoluteUrl || "";
    if (/^https?:\/\//i.test(remoteUrl)) {
      const remoteResponse = await fetch(remoteUrl, { redirect: "follow" });
      if (remoteResponse.ok && remoteResponse.body) {
        const contentType = remoteResponse.headers.get("content-type");
        const contentLength = remoteResponse.headers.get("content-length");
        const disposition = remoteResponse.headers.get("content-disposition");
        if (contentType) res.setHeader("Content-Type", contentType);
        if (contentLength) res.setHeader("Content-Length", contentLength);
        if (req.query.download === "1") {
          res.setHeader("Content-Disposition", `attachment; filename="${String(doc.fileName || "belge").replace(/[\"\\]/g, "_")}"`);
        } else if (disposition) {
          res.setHeader("Content-Disposition", disposition);
        }
        if (typeof remoteResponse.body.pipe === "function") return remoteResponse.body.pipe(res);
        return Readable.fromWeb(remoteResponse.body).pipe(res);
      }
    }

    res.status(404).json({ message: "Belge dosyası bulunamadı." });
  } catch (err) {
    console.error("audit file error:", err);
    res.status(500).end();
  }
});

router.get("/:id", auth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ message: "Paket bulunamadı." });
    const pkg = await AuditPackage.findOne({ _id: req.params.id, organizationId: primaryOrgId(req.user) })
      .select("+passwordHash")
      .lean();
    if (!pkg) return res.status(404).json({ message: "Paket bulunamadı." });
    res.json(await packagePayload(req, pkg, { includeQr: true }));
  } catch (err) {
    console.error("audit detail error:", err);
    res.status(500).json({ message: "Denetim dosyası alınamadı." });
  }
});

module.exports = router;
