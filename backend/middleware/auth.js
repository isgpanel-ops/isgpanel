// filename: backend/middleware/auth.js
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");

module.exports = async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: "Yetkisiz: Token yok" });
    }

    const SECRET = process.env.JWT_SECRET;
    if (!SECRET) {
      throw new Error("JWT_SECRET missing in .env");
    }

    const decoded = jwt.verify(token, SECRET);

    const tokenIdRaw =
      decoded._id || decoded.id || decoded.userId || decoded.sub || null;

    let resolvedUserId = null;

    if (tokenIdRaw && mongoose.Types.ObjectId.isValid(String(tokenIdRaw))) {
      resolvedUserId = String(tokenIdRaw);
    }

    let dbUser = null;

    if (resolvedUserId) {
      dbUser = await User.findById(resolvedUserId)
        .select("_id organization role userType status email")
        .lean();
    }

    if (!dbUser) {
      const email = (decoded.email || decoded.toEmail || decoded.userEmail || "")
        .toString()
        .trim()
        .toLowerCase();

      if (email) {
        dbUser = await User.findOne({ email })
          .select("_id organization role userType status email")
          .lean();

        if (dbUser?._id) {
          resolvedUserId = String(dbUser._id);
        }
      }
    }

    req.userId = resolvedUserId || (tokenIdRaw ? String(tokenIdRaw) : null);

    const tokenOrg = decoded.organizationId || decoded.organization || null;

    req.user = {
      _id: req.userId,
      id: req.userId,

      // ✅ DB rolü öncelikli
      role: dbUser?.role || decoded.role || "",

      // ✅ DB organization öncelikli
      organizationId: dbUser?.organization
        ? String(dbUser.organization)
        : tokenOrg
        ? String(tokenOrg)
        : null,

      // ✅ token uuid taşıyorsa sakla
      organizationUuid: tokenOrg ? String(tokenOrg) : null,

      userType: dbUser?.userType || decoded.userType || null,

      status: String(dbUser?.status || decoded.status || "")
        .trim()
        .toLowerCase(),

      demo: decoded.demo || false,
    };

    if (req.user.organizationId) {
      req.user.organizationId = String(req.user.organizationId);
    }

    if (req.user.organizationUuid) {
      req.user.organizationUuid = String(req.user.organizationUuid);
    }

    const isBlocked = req.user.status === "blokeli";

    const allowedPaths = [
      "/api/auth/me",
      "/api/user",
      "/api/user/",
    ];

    if (isBlocked) {
      const path = req.originalUrl || "";
      const allowed = allowedPaths.some((p) => path.startsWith(p));

      if (!allowed) {
        return res.status(403).json({
          message: "Hesabınız bloke. Yönetici ile iletişime geçiniz.",
          code: "ACCOUNT_BLOCKED",
        });
      }
    }

    console.log("AUTH DECODED:", decoded);
    console.log("AUTH USER:", req.user);

    return next();
  } catch (err) {
    console.error("Auth middleware hata:", err);
    return res.status(401).json({
      message: "Token geçersiz veya süresi dolmuş",
    });
  }
};