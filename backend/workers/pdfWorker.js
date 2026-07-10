const PdfJob = require("../models/PdfJob");
const createProsedurPdf = require("../pdf/prosedur");
const acilDurumPlaniModule = require("../pdf/acildurumplani");

const egitimKatilimModule = require("../pdf/egitimKatilimFormu");
const sertifikaModule = require("../pdf/sertifika");
const iseBaslamaFormuModule = require("../pdf/iseBaslamaFormu");
const isegirisTestModule = require("../pdf/isegirisTest");
const destekAcilEgitimModule = require("../pdf/destekAcilEgitimKatilimFormu");
const destekElemaniAtamaModule = require("../pdf/destekElemaniAtamaFormu");
const acilEkipModule = require("../pdf/acilEkip");

const createAcilDurumPlaniPdf =
  typeof acilDurumPlaniModule === "function"
    ? acilDurumPlaniModule
    : acilDurumPlaniModule.createAcilDurumPlaniPdf ||
      acilDurumPlaniModule.createPdf ||
      acilDurumPlaniModule.default;

const createEgitimKatilimFormuPdf =
  typeof egitimKatilimModule === "function"
    ? egitimKatilimModule
    : egitimKatilimModule.createEgitimKatilimFormuPdf ||
      egitimKatilimModule.createPdf ||
      egitimKatilimModule.default;

const createSertifikaPdf =
  typeof sertifikaModule === "function"
    ? sertifikaModule
    : sertifikaModule.createSertifikaPdf ||
      sertifikaModule.createPdf ||
      sertifikaModule.default;

const createIseBaslamaFormuPdf =
  typeof iseBaslamaFormuModule === "function"
    ? iseBaslamaFormuModule
    : iseBaslamaFormuModule.createIseBaslamaFormuPdf ||
      iseBaslamaFormuModule.createPdf ||
      iseBaslamaFormuModule.default;

const createIsegirisTestPdf =
  typeof isegirisTestModule === "function"
    ? isegirisTestModule
    : isegirisTestModule.createIsegirisTestPdf ||
      isegirisTestModule.createPdf ||
      isegirisTestModule.default;

const createDestekAcilEgitimKatilimFormuPdf =
  typeof destekAcilEgitimModule === "function"
    ? destekAcilEgitimModule
    : destekAcilEgitimModule.createDestekAcilEgitimKatilimFormuPdf ||
      destekAcilEgitimModule.createPdf ||
      destekAcilEgitimModule.default;

const createDestekElemaniAtamaFormuPdf =
  typeof destekElemaniAtamaModule === "function"
    ? destekElemaniAtamaModule
    : destekElemaniAtamaModule.createDestekElemaniAtamaFormuPdf ||
      destekElemaniAtamaModule.createPdf ||
      destekElemaniAtamaModule.default;

const createAcilEkipPdf =
  typeof acilEkipModule === "function"
    ? acilEkipModule
    : acilEkipModule.createAcilEkipPdf ||
      acilEkipModule.createPdf ||
      acilEkipModule.default;

function buildFileUrl(filePath) {
  const base =
    process.env.PUBLIC_BASE_URL ||
    process.env.API_PUBLIC_URL ||
    "https://api.isgpanel.tr";

  const normalized = String(filePath || "").replace(/\\/g, "/");

  const outputIdx = normalized.lastIndexOf("/output/");
  if (outputIdx !== -1) {
    return `${base}${normalized.slice(outputIdx)}`;
  }

  const tempIdx = normalized.lastIndexOf("/temp_pdfs/");
  if (tempIdx !== -1) {
    return `${base}${normalized.slice(tempIdx)}`;
  }

  const fileName = normalized.split("/").pop() || "";
  return `${base}/output/${fileName}`;
}

function buildResult(filePath) {
  return {
    filePath,
    fileUrl: buildFileUrl(filePath),
  };
}

async function processJob(job) {
  switch (job.type) {
    case "prosedur": {
      const filePath = await createProsedurPdf(job.data);
      return buildResult(filePath);
    }

case "acildurumplani": {
  const filePath = await createAcilDurumPlaniPdf(job.data);
  return buildResult(filePath);
}

    case "isegiris-egitim-katilim": {
      const filePath = await createEgitimKatilimFormuPdf(job.data);
      return buildResult(filePath);
    }

    case "isegiris-sertifika": {
      const filePath = await createSertifikaPdf(job.data);
      return buildResult(filePath);
    }

case "ise-baslama-formu": {
  const filePath = await createIseBaslamaFormuPdf(job.data);
  return buildResult(filePath);
}

case "isegiris-test": {
  const filePath = await createIsegirisTestPdf(job.data);
  return buildResult(filePath);
}
   
    case "destek-acil-egitim-katilim": {
      const filePath = await createDestekAcilEgitimKatilimFormuPdf(job.data);
      return buildResult(filePath);
    }

    case "destek-acil-atama": {
      const filePath = await createDestekElemaniAtamaFormuPdf(job.data);
      return buildResult(filePath);
    }

    case "destek-acil-ekip-formu": {
      const filePath = await createAcilEkipPdf(job.data);
      return buildResult(filePath);
    }

    default:
      throw new Error(`Desteklenmeyen PDF job type: ${job.type}`);
  }
}

async function startPdfWorker() {
  console.log("🟢 PDF WORKER başladı");

  setInterval(async () => {
    try {
      const job = await PdfJob.findOneAndUpdate(
        { status: "queued" },
        {
          $set: {
            status: "processing",
            startedAt: new Date(),
            error: "",
          },
        },
        {
          new: true,
          sort: { createdAt: 1 },
        }
      );

      if (!job) return;

      console.log("📄 JOB ALINDI:", String(job._id), job.type);

      try {
        const result = await processJob(job);

      // 🔥 PDF gerçekten dosya mı kontrol et
if (!result.filePath || !result.filePath.includes(".pdf")) {
  throw new Error("PDF oluşturulamadı (geçersiz filePath)");
}

job.status = "done";
job.resultFilePath = result.filePath;
job.resultFileUrl = result.fileUrl;
job.finishedAt = new Date();
await job.save();

        console.log("✅ PDF TAMAMLANDI:", String(job._id), job.type);
      } catch (err) {
        job.status = "error";
        job.error = err?.message || "Bilinmeyen hata";
        job.finishedAt = new Date();
        await job.save();

        console.error("❌ PDF HATA:", err);
      }
    } catch (err) {
      console.error("WORKER LOOP ERROR:", err);
    }
  }, 2000);
}

module.exports = startPdfWorker;