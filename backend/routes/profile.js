const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const router = express.Router();

function authRequired(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Token yok" });

    const SECRET = process.env.JWT_SECRET || "SUPER_SECRET_KEY";
    req.user = jwt.verify(token, SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ message: "Geçersiz token" });
  }
}

// PROFİL PERSONAL OKU
router.get("/personal", authRequired, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("personal");
    if (!user) return res.status(404).json({ message: "Kullanıcı bulunamadı" });
    return res.json(user.personal || {});
  } catch (err) {
    console.error("PROFILE GET HATA:", err);
    return res.status(500).json({ error: "Sunucu hatası" });
  }
});

// PROFİL PERSONAL KAYDET/GÜNCELLE
router.put("/personal", authRequired, async (req, res) => {
  try {
    const allowed = [
      // mevcut
      "tcKimlik",
      "dogumTarihi",
      "telefon",
      "adres",
      "sehir",
      "ilce",
      "meslek",
      "sertifikaSinifi",
      "sertifikaNo",

      // ✅ EKLENENLER (İSG Panelde görünmeyen alanlar)
      "isgUzmaniAdSoyad",
      "isverenVekiliAdSoyad",
      "isyeriHekimiAdSoyad",
      "calisanTemsilcisiAdSoyad",
      "destekElemaniAdSoyad",
      "bilgiSahibiKisiAdSoyad",

      // istersen unvan/telefon vs de açabiliriz:
      "isgUzmaniUnvan",
      "isyeriHekimiUnvan",
    ];

    const patch = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) patch[`personal.${k}`] = req.body[k];
    }

    // patch boşsa yine dönelim
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: patch },
      { new: true }
    ).select("personal");

    if (!user) return res.status(404).json({ message: "Kullanıcı bulunamadı" });

    return res.json({ ok: true, personal: user.personal });
  } catch (err) {
    console.error("PROFILE PUT HATA:", err);
    return res.status(500).json({ error: "Sunucu hatası" });
  }
});

module.exports = router;
