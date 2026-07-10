// backend/routes/destekAcilPdfRoutes.js
const express = require("express");

const { createDestekAcilEgitimKatilimFormuPdf } = require("../pdf/destekAcilEgitimKatilimFormu");
const createDestekElemaniAtamaFormuPdf = require("../pdf/destekElemaniAtamaFormu");
const createAcilEkipPdf = require("../pdf/acilEkip");

const router = express.Router();

// 1) Destek / Acil Eğitim Katılım
router.post("/egitim-katilim-formu/pdf", async (req, res) => {
  try {
    const pdfBuffer = await createDestekAcilEgitimKatilimFormuPdf(req.body);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'inline; filename="destek_acil_egitim_katilim.pdf"');
    return res.status(200).send(pdfBuffer);
  } catch (e) {
    console.error(e);
    return res.status(500).send(e?.message || "PDF üretilemedi");
  }
});

// 2) Destek Elemanı Atama
router.post("/destek-elemani-atama-formu/pdf", async (req, res) => {
  try {
    const pdfBuffer = await createDestekElemaniAtamaFormuPdf(req.body);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'inline; filename="destek_elemani_atama.pdf"');
    return res.status(200).send(pdfBuffer);
  } catch (e) {
    console.error(e);
    return res.status(500).send(e?.message || "PDF üretilemedi");
  }
});

// 3) ✅ ACİL DURUM EKİP FORMU (ASİL DÜZELTİLEN YER)
router.post("/acil-ekip-formu/pdf", async (req, res) => {
  try {
    const payload = req.body || {};

    // 🔑 Risk Değerlendirme Prosedürü'nden gelen kişi bilgilerini bağla
    payload.kisiler =
      payload.kisiler ||
      payload.riskProsedur?.kisiler ||
      payload.riskDegerlendirmeProseduru?.kisiler ||
      {};

    // PDF artık BUFFER döndürüyor
    const pdfBuffer = await createAcilEkipPdf(payload);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'inline; filename="acil_durum_ekip_listesi.pdf"'
    );
    return res.status(200).send(pdfBuffer);
  } catch (e) {
    console.error(e);
    return res.status(500).send(e?.message || "PDF üretilemedi");
  }
});

module.exports = router;
