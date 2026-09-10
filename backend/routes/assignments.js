const express = require("express");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const Firma = require("../models/Firma");
const FirmUser = require("../models/FirmUser");

const router = express.Router();

function roleOf(u) {
  return String(u?.role || "").toLowerCase().trim();
}

function getOrgId(u) {
  return u?.organization || u?.organizationId || null;
}

async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Token yok" });

    const secret = process.env.JWT_SECRET || "SUPER_SECRET_KEY";
    const decoded = jwt.verify(token, secret);

    const userId = decoded.id || decoded.userId || decoded._id;
    const user = await User.findById(userId).lean();
    if (!user) return res.status(401).json({ message: "Kullanıcı bulunamadı" });

    req.user = user;
    req.decoded = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ message: "Geçersiz token" });
  }
}

function uzmanLinkFilter(extra = {}) {
  return {
    ...extra,
    $or: [{ gorevTuru: "is_guvenligi_uzmani" }, { gorevTuru: { $exists: false } }],
  };
}

function roleLinkFilter(role, extra = {}) {
  return role === "isyeri_hekimi"
    ? { ...extra, gorevTuru: "isyeri_hekimi" }
    : uzmanLinkFilter(extra);
}

async function validUserMap(activeLinks, role) {
  const userIds = [...new Set((activeLinks || []).map((x) => String(x.userId)).filter(Boolean))];
  const users = await User.find({ _id: { $in: userIds }, role })
    .select("name email")
    .lean();
  return new Map(users.map((u) => [String(u._id), u]));
}

router.post("/admin/assign-firms", auth, async (req, res) => {
  try {
    const admin = req.user;
    if (roleOf(admin) !== "ticari_admin") {
      return res.status(403).json({ message: "Yetkisiz" });
    }

    const orgId = getOrgId(admin);
    if (!orgId) return res.status(400).json({ message: "Organizasyon bulunamadı" });

    const { userId, firmIds } = req.body || {};
    if (!userId || !Array.isArray(firmIds) || firmIds.length === 0) {
      return res.status(400).json({ message: "userId ve firmIds zorunlu" });
    }

    const target = await User.findById(userId).lean();
    if (!target) return res.status(404).json({ message: "Kullanıcı bulunamadı" });
    if (String(getOrgId(target)) !== String(orgId)) {
      return res.status(403).json({ message: "Kullanıcı bu organizasyona ait değil" });
    }
    const targetRole = roleOf(target);
    if (!["ticari_user", "isyeri_hekimi"].includes(targetRole)) {
      return res.status(400).json({ message: "Sadece iş güvenliği uzmanı veya işyeri hekimi atanabilir" });
    }

    const firms = await Firma.find({ _id: { $in: firmIds }, organization: orgId }).lean();
    if (firms.length !== firmIds.length) {
      return res.status(400).json({ message: "Bazı firmalar organizasyona ait değil" });
    }

    for (const fid of firmIds) {
      await FirmUser.updateMany(
        roleLinkFilter(targetRole, { organization: orgId, firmId: fid, isActive: true }),
        { $set: { isActive: false } }
      );

      await FirmUser.updateOne(
        { organization: orgId, firmId: fid, userId },
        {
          $set: {
            organization: orgId,
            firmId: fid,
            userId,
            gorevTuru: targetRole === "isyeri_hekimi" ? "isyeri_hekimi" : "is_guvenligi_uzmani",
            isActive: true,
            assignedBy: admin._id,
          },
        },
        { upsert: true }
      );

      await Firma.updateOne({ _id: fid }, { $set: { durum: "Aktif" } });
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error("assign-firms hata:", e);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});

router.get("/me/firms", auth, async (req, res) => {
  try {
    const u = req.user;
    const orgId = getOrgId(u);

    if (roleOf(u) === "bireysel") {
      const firms = await Firma.find({ userId: u._id }).sort({ firmaAdi: 1 }).lean();
      return res.json(
        firms.map((f) => ({
          ...f,
          id: f._id,
          sgkSicilNo: f.sgkSicilNo || f.sgkNo || "",
        }))
      );
    }

    if (roleOf(u) === "ticari_user") {
      if (!orgId) return res.status(400).json({ message: "Organizasyon bulunamadı" });

      const links = await FirmUser.find(
        uzmanLinkFilter({
          organization: orgId,
          userId: u._id,
          isActive: true,
        })
      )
        .select("firmId")
        .lean();

      const firmIds = links.map((x) => x.firmId);
      const firms = await Firma.find({ _id: { $in: firmIds }, organization: orgId })
        .sort({ firmaAdi: 1 })
        .lean();

      return res.json(
        firms.map((f) => ({
          ...f,
          id: f._id,
          sgkSicilNo: f.sgkSicilNo || f.sgkNo || "",
        }))
      );
    }

    return res.status(403).json({ message: "Bu endpoint kullanıcı içindir" });
  } catch (e) {
    console.error("me/firms hata:", e);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});

router.get("/admin/firms-with-assignees", auth, async (req, res) => {
  try {
    const admin = req.user;
    if (roleOf(admin) !== "ticari_admin") return res.status(403).json({ message: "Yetkisiz" });

    const orgId = getOrgId(admin);
    const firms = await Firma.find({ organization: orgId }).sort({ firmaAdi: 1 }).lean();
    const firmIds = firms.map((f) => f._id);

    const activeLinks = await FirmUser.find({ organization: orgId, firmId: { $in: firmIds }, isActive: true }).lean();
    const [uzmanMap, hekimMap] = await Promise.all([
      validUserMap(activeLinks.filter((x) => x.gorevTuru !== "isyeri_hekimi"), "ticari_user"),
      validUserMap(activeLinks.filter((x) => x.gorevTuru === "isyeri_hekimi"), "isyeri_hekimi"),
    ]);
    const uzmanByFirm = new Map();
    const hekimByFirm = new Map();
    activeLinks.forEach((link) => {
      const map = link.gorevTuru === "isyeri_hekimi" ? hekimMap : uzmanMap;
      const user = map.get(String(link.userId));
      if (user) (link.gorevTuru === "isyeri_hekimi" ? hekimByFirm : uzmanByFirm).set(String(link.firmId), user);
    });

    return res.json(
      firms.map((f) => {
        const uzman = uzmanByFirm.get(String(f._id)) || null;
        const hekim = hekimByFirm.get(String(f._id)) || null;
        return {
          ...f,
          id: f._id,
          sgkSicilNo: f.sgkSicilNo || f.sgkNo || "",
          atanmisKullanici: uzman ? String(uzman._id) : "",
          atanmisKullaniciAdi: uzman ? uzman.name : "",
          atanmisUzman: uzman ? String(uzman._id) : "",
          atanmisUzmanAdi: uzman ? uzman.name : "",
          atanmisHekim: hekim ? String(hekim._id) : "",
          atanmisHekimAdi: hekim ? hekim.name : "",
        };
      })
    );
  } catch (e) {
    console.error("f-w-a hata:", e);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});

router.get("/admin/unassigned-firms", auth, async (req, res) => {
  try {
    const admin = req.user;
    if (roleOf(admin) !== "ticari_admin") return res.status(403).json({ message: "Yetkisiz" });

    const orgId = getOrgId(admin);
    const firms = await Firma.find({ organization: orgId }).sort({ firmaAdi: 1 }).lean();
    const firmIds = firms.map((f) => f._id);

    const activeLinks = await FirmUser.find({ organization: orgId, firmId: { $in: firmIds }, isActive: true })
      .select("firmId userId")
      .lean();

    const [uzmanMap, hekimMap] = await Promise.all([
      validUserMap(activeLinks.filter((x) => x.gorevTuru !== "isyeri_hekimi"), "ticari_user"),
      validUserMap(activeLinks.filter((x) => x.gorevTuru === "isyeri_hekimi"), "isyeri_hekimi"),
    ]);
    const uzmanByFirm = new Map(); const hekimByFirm = new Map();
    activeLinks.forEach((link) => {
      const user = (link.gorevTuru === "isyeri_hekimi" ? hekimMap : uzmanMap).get(String(link.userId));
      if (user) (link.gorevTuru === "isyeri_hekimi" ? hekimByFirm : uzmanByFirm).set(String(link.firmId), user);
    });
    const unassigned = firms.filter((f) => !uzmanByFirm.has(String(f._id)) || !hekimByFirm.has(String(f._id)));

    return res.json(
      unassigned.map((f) => ({
        ...f,
        id: f._id,
        sgkSicilNo: f.sgkSicilNo || f.sgkNo || "",
        atanmisUzmanAdi: uzmanByFirm.get(String(f._id))?.name || "",
        atanmisHekimAdi: hekimByFirm.get(String(f._id))?.name || "",
      }))
    );
  } catch (e) {
    console.error("unassigned hata:", e);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});

module.exports = router;
