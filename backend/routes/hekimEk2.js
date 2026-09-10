const express = require("express");
const mongoose = require("mongoose");
const auth = require("../middleware/auth");
const FirmUser = require("../models/FirmUser");
const Ek2Muayene = require("../models/Ek2Muayene");

const router = express.Router();

const IseGirisEgitimiKayit =
  mongoose.models.IseGirisEgitimiKayit ||
  mongoose.model(
    "IseGirisEgitimiKayit",
    new mongoose.Schema(
      { firmaId: mongoose.Schema.Types.ObjectId, katilimcilar: { type: Array, default: [] } },
      { collection: "egitim_ise_giris" }
    )
  );

const cleanTc = (value) => String(value || "").replace(/\D/g, "").slice(0, 11);
const roleOf = (user) => String(user?.role || "").toLowerCase().trim();

async function requireHekimFirmasi(req, res, next) {
  try {
    if (roleOf(req.user) !== "isyeri_hekimi") {
      return res.status(403).json({ message: "Bu alan yalnız işyeri hekimi hesabına açıktır." });
    }

    const firmaId = req.params.firmaId || req.query.firmaId;
    if (!mongoose.Types.ObjectId.isValid(String(firmaId || ""))) {
      return res.status(400).json({ message: "Geçersiz firma" });
    }

    const organizationId = req.user?.organizationId;
    const link = await FirmUser.findOne({
      organization: organizationId,
      firmId: firmaId,
      userId: req.user?._id,
      isActive: true,
    }).lean();

    if (!link) return res.status(403).json({ message: "Bu firmaya erişim yetkiniz yok." });

    req.ek2FirmaId = new mongoose.Types.ObjectId(String(firmaId));
    req.ek2OrganizationId = new mongoose.Types.ObjectId(String(organizationId));
    next();
  } catch (error) {
    console.error("EK2 access error:", error);
    res.status(500).json({ message: "Erişim kontrolü yapılamadı." });
  }
}

function sourcePeople(rows) {
  const seen = new Set();
  return (Array.isArray(rows) ? rows : []).reduce((list, row) => {
    const tcKimlik = cleanTc(row?.tc || row?.tcKimlik);
    const adSoyad = String(row?.adSoyad || "").trim();
    if (!tcKimlik || seen.has(tcKimlik)) return list;
    seen.add(tcKimlik);
    list.push({ tcKimlik, adSoyad, gorev: String(row?.gorev || "").trim(), personelFoto: row?.personelFoto || "" });
    return list;
  }, []);
}

router.get("/firms/:firmaId", auth, requireHekimFirmasi, async (req, res) => {
  try {
    const source = await IseGirisEgitimiKayit.findOne({ firmaId: req.ek2FirmaId }).lean();
    const persons = sourcePeople(source?.katilimcilar);
    const records = await Ek2Muayene.find({
      organizationId: req.ek2OrganizationId,
      firmaId: req.ek2FirmaId,
      tcKimlik: { $in: persons.map((person) => person.tcKimlik) },
    }).lean();
    const recordMap = Object.fromEntries(records.map((record) => [record.tcKimlik, record]));

    res.json({ ok: true, persons: persons.map((person) => ({ ...person, ek2: recordMap[person.tcKimlik] || null })) });
  } catch (error) {
    console.error("EK2 list error:", error);
    res.status(500).json({ message: "EK-2 personel listesi alınamadı." });
  }
});

router.put("/firms/:firmaId/persons/:tcKimlik/:section", auth, requireHekimFirmasi, async (req, res) => {
  try {
    const tcKimlik = cleanTc(req.params.tcKimlik);
    const section = String(req.params.section || "");
    const allowed = ["kisiselBilgiler", "saglikBilgileri", "muayene", "sonuc", "tetkikler", "imzalar"];
    if (!tcKimlik || !allowed.includes(section)) return res.status(400).json({ message: "Geçersiz kayıt alanı." });

    const source = await IseGirisEgitimiKayit.findOne({ firmaId: req.ek2FirmaId }).lean();
    const person = sourcePeople(source?.katilimcilar).find((item) => item.tcKimlik === tcKimlik);
    if (!person) return res.status(404).json({ message: "Personel merkezi kayıtta bulunamadı." });

    const data = req.body?.data && typeof req.body.data === "object" ? req.body.data : {};
    const record = await Ek2Muayene.findOneAndUpdate(
      { organizationId: req.ek2OrganizationId, firmaId: req.ek2FirmaId, tcKimlik },
      {
        $set: {
          adSoyad: person.adSoyad,
          gorev: person.gorev,
          [section]: data,
          updatedBy: req.user?._id,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    res.json({ ok: true, record });
  } catch (error) {
    console.error("EK2 save error:", error);
    res.status(500).json({ message: "EK-2 bilgileri kaydedilemedi." });
  }
});

module.exports = router;
