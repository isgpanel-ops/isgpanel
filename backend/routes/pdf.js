const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const PdfJob = require("../models/PdfJob");

// pdf generators (backend/pdf klasörü)
const acilDurumPlani = require("../pdf/acildurumplani");
const acilEkip = require("../pdf/acilEkip");
const calisanTemsilcisiAtamaFormu = require("../pdf/calisanTemsilcisiAtamaFormu");
const calisanTemsilcisiEgitimKatilimFormu = require("../pdf/calisanTemsilcisiEgitimKatilimFormu");
const destekAcilEgitimKatilimFormu = require("../pdf/destekAcilEgitimKatilimFormu");
const destekElemaniAtamaFormu = require("../pdf/destekElemaniAtamaFormu");
const dof = require("../pdf/dof");
const egitimKatilimFormu = require("../pdf/egitimKatilimFormu");
const prosedur = require("../pdf/prosedur");
const riskdegerlendirmesi = require("../pdf/riskdegerlendirmesi");
const riskEkip = require("../pdf/riskEkip");
const sertifika = require("../pdf/sertifika");
const talimatGenel = require("../pdf/talimatGenel");
const talimatInsaat = require("../pdf/talimatInsaat");
const talimatOneri = require("../pdf/talimatOneri");
const yillikCalismaPlani = require("../pdf/yillikCalismaPlani.puppeteer");
const yillikDegerlendirmeRaporu = require("../pdf/yillikDegerlendirmeRaporu.puppeteer");
const yillikEgitimPlani = require("../pdf/yillikEgitimPlani.puppeteer");
const yuksekteEgitimKatilimFormu = require("../pdf/yuksekteEgitimKatilimFormu");
const yuksekteSertifika = require("../pdf/yuksekteSertifika");
const iseBaslamaFormu = require("../pdf/iseBaslamaFormu");
const isegirisTest = require("../pdf/isegirisTest");
// ✅ Tek yerde map
const PDF_MAP = {
  acildurumplani: acilDurumPlani,
  acilekip: acilEkip,
  calisantemsilcisiatamaformu: calisanTemsilcisiAtamaFormu,
  calisantemsilcisiegitimkatilimformu: calisanTemsilcisiEgitimKatilimFormu,
  destekacilegitimkatilimformu: destekAcilEgitimKatilimFormu,
  destekelemaniatamaformu: destekElemaniAtamaFormu,
  dof,
  egitimkatilimformu: egitimKatilimFormu,
  prosedur,
  riskdegerlendirmesi,
  riskekip: riskEkip,
  sertifika,
  talimatgenel: talimatGenel,
  talimatinsaat: talimatInsaat,
  talimatoneri: talimatOneri,
  yillikcalismaplani: yillikCalismaPlani,
  yillikdegerlendirmeraporu: yillikDegerlendirmeRaporu,
  yillikegitimplani: yillikEgitimPlani,
  yuksekteegitimkatilimformu: yuksekteEgitimKatilimFormu,
  yuksektesertifika: yuksekteSertifika,
  "ise-baslama-formu": iseBaslamaFormu,
  "isegiris-test": isegirisTest,
};

module.exports = function pdfRoutes() {
  const router = express.Router();

  function authRequired(req, res, next) {
    try {
      const header = req.headers.authorization || "";
      const token = header.startsWith("Bearer ") ? header.slice(7) : null;

      if (!token) {
        return res.status(401).json({ message: "Token yok" });
      }

      const SECRET = process.env.JWT_SECRET || "SUPER_SECRET_KEY";
      req.user = jwt.verify(token, SECRET);
      next();
    } catch (e) {
      return res.status(401).json({ message: "Geçersiz token" });
    }
  }

  function getUserId(user) {
    return String(user?._id || user?.id || "");
  }

  function getOrganizationId(user) {
    return String(
      user?.organizationId ||
        user?.organizationUuid ||
        user?._id ||
        user?.id ||
        ""
    );
  }

  // ✅ PDF üretmek yerine job oluştur
  router.post("/:type", authRequired, async (req, res) => {
    try {
      const body = req.body || {};

const type = String(body?.type || req.params.type || "")
  .toLowerCase()
  .trim();

const generator = PDF_MAP[type];

      if (!generator) {
        return res.status(404).json({ message: "Geçersiz pdf tipi" });
      }

      const payload =
  body?.data && typeof body.data === "object"
    ? { ...body.data }
    : { ...body };

      payload.verificationCode =
  payload.verificationCode ||
  Math.random().toString(16).slice(2, 12).toUpperCase();
      payload.demo = !!req.user?.demo;

      const createdByUserId = getUserId(req.user);
      const organizationId = getOrganizationId(req.user);

      if (!createdByUserId) {
        return res.status(400).json({ message: "Kullanıcı bulunamadı" });
      }

      const job = await PdfJob.create({
  type,
  status: "queued",
  data: payload,
  createdByUserId,
  organizationId,
  verificationCode: payload.verificationCode,
});

      return res.status(202).json({
        ok: true,
        jobId: String(job._id),
        status: job.status,
        message: "PDF oluşturma kuyruğa alındı",
      });
    } catch (err) {
      console.error("PDF JOB CREATE ERROR:", err);
      return res.status(500).json({
        message: "PDF işi oluşturulamadı",
        error: err.message,
      });
    }
  });

  // ✅ job durumu sorgula
  router.get("/job/:id", authRequired, async (req, res) => {
    try {
      const jobId = String(req.params.id || "");

      if (!mongoose.Types.ObjectId.isValid(jobId)) {
        return res.status(400).json({ message: "Geçersiz job id" });
      }

      const userId = getUserId(req.user);
      const organizationId = getOrganizationId(req.user);

      const job = await PdfJob.findOne({
        _id: jobId,
        $or: [
          { createdByUserId: userId },
          { organizationId },
        ],
      }).lean();

      if (!job) {
        return res.status(404).json({ message: "Job bulunamadı" });
      }

      return res.json({
        ok: true,
        jobId: String(job._id),
        type: job.type,
        status: job.status,
        resultFileUrl: job.resultFileUrl || "",
        resultFilePath: job.resultFilePath || "",
        documentId: job.documentId || "",
        error: job.error || "",
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      });
    } catch (err) {
      console.error("PDF JOB STATUS ERROR:", err);
      return res.status(500).json({
        message: "Job durumu alınamadı",
        error: err.message,
      });
    }
  });

  return router;
};