const express = require("express");
const bcrypt = require("bcryptjs");
const auth = require("../middleware/auth");
const User = require("../models/User");
const SecuritySettings = require("../models/SecuritySettings");

const router = express.Router();

/* yardımcı: settings yoksa oluştur */
async function getOrCreateSettings(userId) {
  let s = await SecuritySettings.findOne({ userId });
  if (!s) s = await SecuritySettings.create({ userId });
  return s;
}

/* ✅ ME: email (readonly) + güvenlik ayarları + devices */
router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("email role userType").lean();
    if (!user) return res.status(404).json({ message: "Kullanıcı bulunamadı" });

    const settings = await getOrCreateSettings(req.user.id);

    return res.json({
      email: user.email, // 🔒 kilitli (sadece okunur)
      role: user.role,
      userType: user.userType,
      twofa: settings.twofa,
      newLoginAlert: settings.newLoginAlert,
      devices: settings.devices,
    });
  } catch (e) {
    console.error("GET /guvenlik-giris/me hata:", e);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});

/* ✅ Ayar kaydet: twofa + newLoginAlert */
router.put("/settings", auth, async (req, res) => {
  try {
    const { twofa, newLoginAlert } = req.body || {};
    const settings = await getOrCreateSettings(req.user.id);

    if (typeof twofa === "boolean") settings.twofa = twofa;
    if (typeof newLoginAlert === "boolean") settings.newLoginAlert = newLoginAlert;

    await settings.save();

    return res.json({ message: "Ayarlar kaydedildi" });
  } catch (e) {
    console.error("PUT /guvenlik-giris/settings hata:", e);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});

/* ✅ Şifre değiştir (KORUNDU + passwordHash/password uyumu + select:false dayanıklı) */
router.post("/change-password", auth, async (req, res) => {
  try {
    const { currentPassword, newPassword, newPassword2 } = req.body || {};

    if (!currentPassword || !newPassword || !newPassword2) {
      return res.status(400).json({ message: "Tüm alanları doldurun" });
    }
    if (newPassword !== newPassword2) {
      return res.status(400).json({ message: "Yeni şifreler eşleşmiyor" });
    }

    /**
     * Senin eski kodun:
     *   .select("passwordHash")
     *
     * Bazı şemalarda:
     * - alan adı password olabilir
     * - alan select:false olabilir
     * Bu yüzden + ile çekip hangisi varsa onu kullanıyoruz.
     */
    const user = await User.findById(req.user.id).select("+passwordHash +password");
    if (!user) return res.status(404).json({ message: "Kullanıcı bulunamadı" });

    const storedHash = user.passwordHash || user.password;

    // storedHash yoksa bcrypt.compare patlar ve 500 olurdu → artık düzgün mesaj döndürüyoruz
    if (!storedHash) {
      return res.status(400).json({
        message:
          "Şifre alanı bulunamadı. User modelindeki şifre alan adı (passwordHash/password) ile uyum kontrolü yapın.",
      });
    }

    const ok = await bcrypt.compare(String(currentPassword), String(storedHash));
    if (!ok) return res.status(400).json({ message: "Mevcut şifre hatalı" });

    const hash = await bcrypt.hash(String(newPassword), 10);

    // Hangi alan kullanılıyorsa onu güncelle
    if (user.passwordHash !== undefined) user.passwordHash = hash;
    else user.password = hash;

    await user.save();

    return res.json({ message: "Şifre güncellendi" });
  } catch (e) {
    console.error("POST /guvenlik-giris/change-password hata:", e);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});

/* ✅ Tüm oturumları kapat: devices temizle */
router.post("/logout-all", auth, async (req, res) => {
  try {
    const settings = await getOrCreateSettings(req.user.id);
    settings.devices = [];
    await settings.save();

    return res.json({ message: "Tüm oturumlar sonlandırıldı" });
  } catch (e) {
    console.error("POST /guvenlik-giris/logout-all hata:", e);
    return res.status(500).json({ message: "Sunucu hatası" });
  }
});

module.exports = router;
