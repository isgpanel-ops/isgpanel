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

// ---- auth middleware (bozmadan)
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

/**
 * ✅ Admin firmaları kullanıcıya ata/değiştir
 * POST /api/admin/assign-firms
 * body: { userId, firmIds: [] }
 *
 * KURAL: Bir firmada tek aktif kullanıcı olsun.
 * Yeni kullanıcıya atanırken aynı firmadaki diğer aktif atamalar pasife çekilir.
 */
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

    // hedef kullanıcı aynı org içinde mi?
    const target = await User.findById(userId).lean();
    if (!target) return res.status(404).json({ message: "Kullanıcı bulunamadı" });
    if (String(getOrgId(target)) !== String(orgId)) {
      return res.status(403).json({ message: "Kullanıcı bu organizasyona ait değil" });
    }

    // firmalar org’a mı ait?
    const firms = await Firma.find({ _id: { $in: firmIds }, organization: orgId }).lean();
    if (firms.length !== firmIds.length) {
      return res.status(400).json({ message: "Bazı firmalar organizasyona ait değil" });
    }

    for (const fid of firmIds) {
      // 1) o firmadaki tüm aktif atamaları pasife çek
      await FirmUser.updateMany(
        { organization: orgId, firmId: fid, isActive: true },
        { $set: { isActive: false } }
      );

      // 2) yeni kullanıcıyı aktif ata (upsert)
      await FirmUser.updateOne(
        { organization: orgId, firmId: fid, userId: userId },
        { $set: { isActive: true, assignedBy: admin._id } },
        { upsert: true }
      );

      // 3) firmayı aktif yap (opsiyonel)
      await Firma.updateOne({ _id: fid }, { $set: { durum: "Aktif" } });
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error("assign-firms hata:", e);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});

/**
 * ✅ Ticari kullanıcıya düşen firmalar
 * GET /api/me/firms
 */
router.get("/me/firms", auth, async (req, res) => {
  try {
    const u = req.user;
    const orgId = getOrgId(u);

    // bireysel ise legacy davranış: userId ile firmalar
    if (roleOf(u) === "bireysel") {
      const firms = await Firma.find({ userId: u._id }).sort({ firmaAdi: 1 }).lean();
      // UI uyumu: sgkSicilNo üret
      return res.json(
        firms.map((f) => ({
          ...f,
          id: f._id,
          sgkSicilNo: f.sgkSicilNo || f.sgkNo || "",
        }))
      );
    }

    // ticari_user: pivot’tan çek
    if (roleOf(u) === "ticari_user") {
      if (!orgId) return res.status(400).json({ message: "Organizasyon bulunamadı" });

      const links = await FirmUser.find({
        organization: orgId,
        userId: u._id,
        isActive: true,
      })
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

    // admin kendi panelinde /api/firma kullanıyor ama istersen buradan da döndürebiliriz
    return res.status(403).json({ message: "Bu endpoint kullanıcı içindir" });
  } catch (e) {
    console.error("me/firms hata:", e);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});

/**
 * ✅ Admin panel: firmalar + atanmış kullanıcı adı
 * GET /api/admin/firms-with-assignees
 */
router.get("/admin/firms-with-assignees", auth, async (req, res) => {
  try {
    const admin = req.user;
    if (roleOf(admin) !== "ticari_admin") return res.status(403).json({ message: "Yetkisiz" });

    const orgId = getOrgId(admin);
    const firms = await Firma.find({ organization: orgId }).sort({ firmaAdi: 1 }).lean();

    const firmIds = firms.map((f) => f._id);

    const activeLinks = await FirmUser.find({
      organization: orgId,
      firmId: { $in: firmIds },
      isActive: true,
    }).lean();

    const userIds = [...new Set(activeLinks.map((x) => String(x.userId)))];
    const users = await User.find({ _id: { $in: userIds } }).select("name email").lean();
    const userMap = new Map(users.map((u) => [String(u._id), u]));

    const firmToUser = new Map();
    activeLinks.forEach((l) => {
      firmToUser.set(String(l.firmId), userMap.get(String(l.userId)) || null);
    });

    return res.json(
      firms.map((f) => {
        const assignee = firmToUser.get(String(f._id)) || null;
        return {
          ...f,
          id: f._id,
          sgkSicilNo: f.sgkSicilNo || f.sgkNo || "",
          atanmisKullanici: assignee ? String(assignee._id) : "",
          atanmisKullaniciAdi: assignee ? assignee.name : "",
        };
      })
    );
  } catch (e) {
    console.error("f-w-a hata:", e);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});

/**
 * ✅ Admin panel: atanamayan firmalar (atama bekleyen)
 * GET /api/admin/unassigned-firms
 */
router.get("/admin/unassigned-firms", auth, async (req, res) => {
  try {
    const admin = req.user;
    if (roleOf(admin) !== "ticari_admin") return res.status(403).json({ message: "Yetkisiz" });

    const orgId = getOrgId(admin);

    const firms = await Firma.find({ organization: orgId }).sort({ firmaAdi: 1 }).lean();
    const firmIds = firms.map((f) => f._id);

    const activeLinks = await FirmUser.find({
      organization: orgId,
      firmId: { $in: firmIds },
      isActive: true,
    })
      .select("firmId")
      .lean();

    const assignedSet = new Set(activeLinks.map((x) => String(x.firmId)));

    const unassigned = firms.filter((f) => !assignedSet.has(String(f._id)));

    return res.json(
      unassigned.map((f) => ({
        ...f,
        id: f._id,
        sgkSicilNo: f.sgkSicilNo || f.sgkNo || "",
      }))
    );
  } catch (e) {
    console.error("unassigned hata:", e);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});

module.exports = router;
