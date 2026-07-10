// backend/middleware/requireRole.js
module.exports = function requireRole(...allowed) {
  return (req, res, next) => {
    const role = req.user?.role;
    if (!role) return res.status(401).json({ message: "Yetkisiz" });
    if (!allowed.includes(role)) return res.status(403).json({ message: "Erişim reddedildi" });
    next();
  };
};
