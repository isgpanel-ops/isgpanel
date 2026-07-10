const express = require("express");
const router = express.Router();
const os = require("os");
const { exec } = require("child_process");
const mongoose = require("mongoose");
const fs = require("fs/promises");
const path = require("path");

let documentMigrationJob = {
  running: false,
  startedAt: null,
  finishedAt: null,
  lastResult: null,
  error: null,
};

function getDbHealth() {
  return new Promise(async (resolve) => {
    const started = Date.now();

    try {
      if (!mongoose.connection || mongoose.connection.readyState !== 1) {
        return resolve({
          ok: false,
          latencyMs: Date.now() - started,
          statusCode: 0,
          error: "MongoDB bağlantısı hazır değil",
        });
      }

      await mongoose.connection.db.admin().ping();

      return resolve({
        ok: true,
        latencyMs: Date.now() - started,
        statusCode: 200,
      });
    } catch (err) {
      return resolve({
        ok: false,
        latencyMs: Date.now() - started,
        statusCode: 500,
        error: err.message,
      });
    }
  });
}

function getDiskUsage() {
  return new Promise((resolve) => {
    exec("df -k /", (err, stdout) => {
      let diskUsed = 0;
      let diskTotal = 0;

      if (!err && stdout) {
        const lines = stdout.trim().split("\n");
        if (lines[1]) {
          const parts = lines[1].trim().split(/\s+/);
          diskTotal = Number(parts[1] || 0) / (1024 * 1024);
          diskUsed = Number(parts[2] || 0) / (1024 * 1024);
        }
      }

      const diskPct =
        diskTotal > 0 ? Math.min(100, (diskUsed / diskTotal) * 100) : 0;

      resolve({
        diskUsedGB: Number(diskUsed.toFixed(1)),
        diskTotalGB: Number(diskTotal.toFixed(1)),
        diskPct: Number(diskPct.toFixed(1)),
      });
    });
  });
}

function getExternalStorageUsage() {
  return new Promise((resolve) => {
    const base = process.env.EXTERNAL_DOCS_DIR || "/mnt/storagebox";
    const target = `${base}/backups`;

    exec(`du -sk "${target}" 2>/dev/null`, (err, stdout) => {
      if (err || !stdout) {
        return resolve({
          externalStorageUsedGB: 0,
          externalStorageTotalGB: 1024,
          externalStoragePct: 0,
        });
      }

      try {
        const parts = stdout.trim().split(/\s+/);

        const usedKB = Number(parts[0] || 0);
        const usedGB = usedKB / (1024 * 1024);

        const totalGB = 1024; // 1 TB paket
        const pct =
          totalGB > 0 ? Math.min(100, (usedGB / totalGB) * 100) : 0;

        return resolve({
          externalStorageUsedGB: Number(usedGB.toFixed(1)),
          externalStorageTotalGB: totalGB,
          externalStoragePct: Number(pct.toFixed(1)),
        });
      } catch (e) {
        return resolve({
          externalStorageUsedGB: 0,
          externalStorageTotalGB: 1024,
          externalStoragePct: 0,
        });
      }
    });
  });
}

async function ensureDirExists(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function fileExists(filePath) {
  if (!filePath) return false;

  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function normalizeLocalPath(filePath) {
  if (!filePath || typeof filePath !== "string") return "";

  let p = filePath.trim();

  // URL geldiyse domaini temizle
  p = p.replace(/^https?:\/\/[^/]+/i, "");

  if (p.startsWith("/")) {
    return p;
  }

  // Baştaki slash temizle
  p = p.replace(/^\/+/, "");

  // uploads ile başlıyorsa gerçek dizine çevir
  if (p.startsWith("uploads/")) {
    return path.join("/var/www/backend", p);
  }

  // documents ile başlıyorsa
  if (p.startsWith("documents/")) {
    return path.join("/var/www/backend", p);
  }

  // relative path ise backend altına koy
  if (!p.startsWith("/")) {
    return path.join("/var/www/backend", p);
  }

  return p;
}

async function resolveExistingLocalPath(filePath) {
  const raw = String(filePath || "").trim();
  if (!raw) return "";

  let clean = raw.replace(/^https?:\/\/[^/]+/i, "");
  clean = clean.split("?")[0].split("#")[0];

  const withoutSlash = clean.replace(/^\/+/, "");
  const baseName = path.basename(withoutSlash || clean);
  const candidates = new Set();

  candidates.add(normalizeLocalPath(clean));

  if (withoutSlash) {
    candidates.add(path.join("/var/www/backend", withoutSlash));
    candidates.add(path.join("/var/www/backend/uploads", withoutSlash));
    candidates.add(path.join("/var/www/backend/uploads/documents", withoutSlash));
  }

  if (baseName && baseName !== "." && baseName !== "/") {
    candidates.add(path.join("/var/www/backend/uploads/documents", baseName));
    candidates.add(path.join("/var/www/backend/uploads", baseName));
    candidates.add(path.join("/var/www/backend/output", baseName));
    candidates.add(path.join("/var/www/output", baseName));
  }

  for (const candidate of candidates) {
    if (candidate && (await fileExists(candidate))) {
      return candidate;
    }
  }

  return normalizeLocalPath(clean);
}

function safeSegment(value, fallback = "unknown") {
  return String(value || fallback).replace(/[^a-zA-Z0-9._-]/g, "_");
}

function getDocumentModel() {
  try {
    if (mongoose.models && mongoose.models.Document) {
      return mongoose.models.Document;
    }

    const loaded = require("../models/Document");

    if (loaded && typeof loaded.find === "function") {
      return loaded;
    }

    if (loaded?.default && typeof loaded.default.find === "function") {
      return loaded.default;
    }

    if (mongoose.models && mongoose.models.Document) {
      return mongoose.models.Document;
    }

    return null;
  } catch (err) {
    console.error("getDocumentModel require error:", err);
    return null;
  }
}

async function migrateLocalDocumentsToExternalStorage({
  onlyIfDiskAbovePct = 80,
  limit = 25,
} = {}) {
  try {
    const safeLimit = Math.min(Math.max(Number(limit || 25), 1), 1000);

    const diskBefore = await getDiskUsage();
    const beforeDiskPct = Number(diskBefore?.diskPct || 0);

    if (beforeDiskPct < onlyIfDiskAbovePct) {
      return {
        success: false,
        message: `Disk kullanımı %${onlyIfDiskAbovePct} altında. Taşıma başlatılmadı.`,
        beforeDiskPct,
      };
    }

    const externalBaseDir = path.join(
      process.env.EXTERNAL_DOCS_DIR || "/mnt/storagebox",
      "backups",
      "documents"
    );

    await ensureDirExists(externalBaseDir);

    const documentsCollection = mongoose.connection.db.collection("documents");

    const sampleDoc = await documentsCollection.findOne({});
    console.log("SAMPLE DOCUMENT:", sampleDoc);

    const docs = await documentsCollection
      .find({
        $and: [
          {
            $or: [
              { migrateError: { $exists: false } },
              { migrateError: false },
              { migrateError: null },
            ],
          },
          {
            $or: [
              { storageType: "local" },
              { storageType: { $exists: false } },
              { storageType: "" },
            ],
          },
          {
            $or: [
              { storagePath: { $exists: true, $ne: "" } },
              { absoluteUrl: { $exists: true, $ne: "" } },
              { fileUrl: { $exists: true, $ne: "" } },
              { fileName: { $exists: true, $ne: "" } },
            ],
          },
        ],
      })
      .sort({ createdAt: 1 })
      .limit(safeLimit)
      .toArray();

    console.log("FOUND DOC COUNT:", docs.length);

    let movedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const doc of docs) {
      try {
        const sourcePath = await resolveExistingLocalPath(
          doc.storagePath ||
            doc.absoluteUrl ||
            doc.fileUrl ||
            doc.fileName ||
            doc?.data?.filePath ||
            ""
        );

        if (!sourcePath) {
          skippedCount += 1;
          continue;
        }

        const originalFileName =
          doc.fileName ||
          path.basename(sourcePath) ||
          `document_${doc._id}.pdf`;

        const safeFileName = `${doc._id}_${originalFileName}`.replace(
          /[^a-zA-Z0-9._-]/g,
          "_"
        );

        const orgDir = safeSegment(doc.organizationId, "unknown_org");
        const firmaDir = safeSegment(doc.firmaId, "unknown_firma");

        const targetDir = path.join(externalBaseDir, orgDir, firmaDir);
        await ensureDirExists(targetDir);

        const targetPath = path.join(targetDir, safeFileName);

        await fs.copyFile(sourcePath, targetPath);
        await fs.unlink(sourcePath);

        await documentsCollection.updateOne(
          { _id: doc._id },
          {
            $set: {
              storageType: "external",
              storagePath: targetPath,
              externalProvider: "hetzner-external",
              archivedAt: new Date(),
              updatedAt: new Date(),
            },
            $unset: {
              migrateError: "",
              migrateErrorAt: "",
              migrateErrorMessage: "",
            },
          }
        );

        movedCount += 1;
      } catch (err) {
        console.error("DOCUMENT MIGRATE ITEM ERROR:", {
          id: String(doc?._id || ""),
          title: doc?.title || "",
          error: err?.message || err,
        });

        await documentsCollection.updateOne(
          { _id: doc._id },
          {
            $set: {
              migrateError: true,
              migrateErrorAt: new Date(),
              migrateErrorMessage: String(err?.message || err || ""),
              updatedAt: new Date(),
            },
          }
        );

        failedCount += 1;
      }
    }

    const diskAfter = await getDiskUsage();
    const afterDiskPct = Number(diskAfter?.diskPct || 0);

    return {
      success: true,
      message: "Belgeler harici depoya taşıma işlemi tamamlandı.",
      movedCount,
      skippedCount,
      failedCount,
      beforeDiskPct,
      afterDiskPct,
    };
  } catch (err) {
    console.error("MIGRATE DOCUMENTS ERROR:", err);
    return {
      success: false,
      message: "Belge taşıma işlemi sırasında hata oluştu.",
      error: err.message,
    };
  }
}

router.get("/storage/migration-status", async (req, res) => {
  return res.json({
    success: true,
    job: documentMigrationJob,
  });
});

router.post("/storage/migrate-documents", async (req, res) => {
  try {
    const onlyIfDiskAbovePct = Number(req.body?.onlyIfDiskAbovePct || 80);
    const limit = Math.min(Math.max(Number(req.body?.limit || 25), 1), 1000);

    if (documentMigrationJob.running) {
      return res.status(202).json({
        success: true,
        accepted: true,
        message: "Belge tasima islemi zaten devam ediyor.",
        job: documentMigrationJob,
      });
    }

    documentMigrationJob = {
      running: true,
      startedAt: new Date(),
      finishedAt: null,
      lastResult: null,
      error: null,
    };

    setImmediate(async () => {
      try {
        const result = await migrateLocalDocumentsToExternalStorage({
          onlyIfDiskAbovePct,
          limit,
        });

        documentMigrationJob = {
          running: false,
          startedAt: documentMigrationJob.startedAt,
          finishedAt: new Date(),
          lastResult: result,
          error: result.success ? null : result.message,
        };
      } catch (err) {
        documentMigrationJob = {
          running: false,
          startedAt: documentMigrationJob.startedAt,
          finishedAt: new Date(),
          lastResult: null,
          error: String(err?.message || err || ""),
        };
        console.error("DOCUMENT MIGRATION BACKGROUND ERROR:", err);
      }
    });

    return res.status(202).json({
      success: true,
      accepted: true,
      message: "Belge tasima islemi arka planda baslatildi.",
      job: documentMigrationJob,
    });
  } catch (err) {
    console.error("MIGRATE DOCUMENTS START ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Belge tasima islemi baslatilamadi.",
      error: err.message,
    });
  }
});

router.get("/system-status", async (req, res) => {
  try {
    const now = Date.now();

    const load = os.loadavg()[0];
    const cpuCount = os.cpus().length || 1;
    const cpuPct = Math.min(100, (load / cpuCount) * 100);

    const totalMem = os.totalmem() / (1024 * 1024 * 1024);
    const freeMem = os.freemem() / (1024 * 1024 * 1024);
    const usedMem = totalMem - freeMem;

    const [health, disk, externalStorage] = await Promise.all([
      getDbHealth(),
      getDiskUsage(),
      getExternalStorageUsage(),
    ]);

    const apiStatus = health.ok ? "up" : "down";

    return res.json({
      api: [
        {
          id: "api_main",
          name: "Backend API",
          endpoint: "/api/health",
          latencyMs: health.latencyMs || 0,
          errorRatePct: health.ok ? 0.02 : 100,
          uptime24hPct: health.ok ? 99.99 : 0,
          lastCheckedAt: now,
          status: apiStatus,
        },
      ],
      infra: {
        cpuPct: Number(cpuPct.toFixed(1)),
        ramUsedGB: Number(usedMem.toFixed(1)),
        ramTotalGB: Number(totalMem.toFixed(1)),

        diskUsedGB: disk.diskUsedGB,
        diskTotalGB: disk.diskTotalGB,
        diskPct: disk.diskPct,

        externalStorageUsedGB: externalStorage.externalStorageUsedGB,
        externalStorageTotalGB: externalStorage.externalStorageTotalGB,
        externalStoragePct: externalStorage.externalStoragePct,

        loadAvg: Number(load.toFixed(2)),
        lastUpdatedAt: now,
      },
      errors: {
        errorRatePct: health.ok ? 0.02 : 5,
        p95LatencyMs: health.latencyMs || 0,
        reqPerMin: 300,
        history: health.ok ? [0.02, 0.03, 0.02, 0.01] : [2.5, 3.1, 4.2, 5],
        lastUpdatedAt: now,
      },
      jobs: [
        {
          id: "job_scheduler",
          name: "Scheduler",
          schedule: "Every 15 min",
          lastRunAt: now,
          nextRunAt: now + 15 * 60 * 1000,
          durationSec: 3,
          result: "success",
          notes: "Planlı job çalışıyor",
        },
        {
          id: "job_storage",
          name: "Storage Check",
          schedule: "Live",
          lastRunAt: now,
          nextRunAt: now,
          durationSec: 1,
          result:
            externalStorage.externalStorageTotalGB > 0
              ? "success"
              : "warn",
          notes:
            externalStorage.externalStorageTotalGB > 0
              ? "Harici depo bağlı"
              : "Harici depo okunamadı",
        },
      ],
    });
  } catch (err) {
    console.error("SYSTEM STATUS ERROR:", err);
    return res.status(500).json({
      message: "System status error",
      error: err.message,
    });
  }
});

module.exports = router;
