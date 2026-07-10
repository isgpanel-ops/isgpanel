module.exports = function requireSuperAdmin(req, res, next) {
  // auth middleware’in req.user’ı set ediyor olmalı
  if (!req.user) return res.status(401).json({ message: "Giriş gerekli" });

  if (req.user.role !== "super_admin") {
    return res.status(403).json({ message: "Yetkisiz" });
  }

  next();
};
