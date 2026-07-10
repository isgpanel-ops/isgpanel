/**
 * backend/jobs/firmAssignmentNotificationJob.js
 *
 * Amaç: ticari admin firma atayınca / kaldırınca bildirimi job üzerinden üretmek.
 * - Route sadece enqueue eder.
 * - Job worker belirli aralıklarla kuyruğu boşaltır.
 *
 * Not: Bu basit in-memory kuyruk. Çoklu node/pm2 instance varsa paylaşımlı kuyruk değildir.
 * Eğer scale edersen Redis/BullMQ gibi kalıcı kuyruk önerilir.
 */

/* -------------------- utils -------------------- */
function safeRequire(paths) {
  for (const p of paths) {
    try {
      // eslint-disable-next-line import/no-dynamic-require, global-require
      return require(p);
    } catch (_) {}
  }
  return null;
}

function upTR(s) {
  return (s || "").toLocaleUpperCase("tr-TR");
}

function nowId() {
  // uniq id (işlem tekrarı için)
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/* -------------------- dependencies (safe) -------------------- */

// 1) scheduler helper'ları varsa kullan
const scheduler =
  safeRequire(["./notificationScheduler", "./notificationScheduler.js"]) || {};

// 2) createNotification'ı servislerden bul (projede path farklı olabiliyor)
const notificationSvc =
  safeRequire([
    "../services/notificationService",
    "../services/notificationService.js",
    "../services/notification/notificationService",
    "../services/notification/notificationService.js",
    "../services/notifications/notificationService",
    "../services/notifications/notificationService.js",
  ]) || {};

const createNotification = notificationSvc?.createNotification;

/* -------------------- in-memory queue -------------------- */
const queue = [];
let workerStarted = false;
let workerTimer = null;

// Ayarlar
const TICK_MS = 500; // kuyruğu kaç ms'de bir kontrol etsin
const BATCH_SIZE = 20; // tek turda kaç iş işlesin

function enqueue(job) {
  queue.push(job);
}

async function handleAssigned(job) {
  const {
    assignedUserId,
    firmId,
    firmName,
    actorName,
    actionId, // opsiyonel
  } = job.payload;

  const actor = upTR(actorName || "ADMIN");
  const fName = upTR(firmName || "FİRMA");
  const uniq = actionId || job.id;

  // 1) Scheduler helper (varsa)
  if (typeof scheduler.notifyCommercialUserFirmAssigned === "function") {
    try {
      await scheduler.notifyCommercialUserFirmAssigned({
        userId: assignedUserId,
        firmId,
        firmName,
        actorName,
        actionId: uniq,
      });
    } catch (e) {
      // helper patlarsa fallback'e düşeceğiz
    }
  }

  // 2) GARANTİ fallback: createNotification
  if (typeof createNotification === "function") {
    await createNotification({
      userId: assignedUserId,
      firmId,
      type: "event",
      module: "genel", // ticari user panelinde görünmesi için
      title: "Firma ataması yapıldı",
      message: `${fName} firması admin tarafından size atandı.`,
      severity: "info",
      link: "",
      dueDate: new Date(),
      key: `ticari_user_firm_assigned:${String(firmId)}:${String(assignedUserId)}:${String(
        uniq
      )}`,
    });
  } else {
    // createNotification yoksa en azından log
    // eslint-disable-next-line no-console
    console.warn(
      "[firmAssignmentJob] createNotification bulunamadı. Bildirim DB'ye yazılamadı."
    );
  }
}

async function handleRemoved(job) {
  const {
    assignedUserId,
    firmId,
    firmName,
    actorName,
    actionId, // opsiyonel
  } = job.payload;

  const actor = upTR(actorName || "ADMIN");
  const fName = upTR(firmName || "FİRMA");
  const uniq = actionId || job.id;

  if (typeof scheduler.notifyCommercialUserFirmRemoved === "function") {
    try {
      await scheduler.notifyCommercialUserFirmRemoved({
        userId: assignedUserId,
        firmId,
        firmName,
        actorName,
        actionId: uniq,
      });
    } catch (e) {}
  }

  if (typeof createNotification === "function") {
    await createNotification({
      userId: assignedUserId,
      firmId,
      type: "event",
      module: "genel",
      title: "Firma ataması düşürüldü",
      message: `${fName} firması admin tarafından üzerinizden kaldırıldı.`,
      severity: "warning",
      link: "",
      dueDate: new Date(),
      key: `ticari_user_firm_removed:${String(firmId)}:${String(assignedUserId)}:${String(
        uniq
      )}`,
    });
  } else {
    // eslint-disable-next-line no-console
    console.warn(
      "[firmAssignmentJob] createNotification bulunamadı. Bildirim DB'ye yazılamadı."
    );
  }
}

async function processOne(job) {
  if (!job || !job.type) return;

  if (job.type === "firm_assigned") return handleAssigned(job);
  if (job.type === "firm_removed") return handleRemoved(job);
}

async function tick() {
  if (queue.length === 0) return;

  const batch = queue.splice(0, BATCH_SIZE);
  for (const job of batch) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await processOne(job);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[firmAssignmentJob] job failed:", job?.type, e);
      // basit retry: kuyruğa geri at (istersen sınır ekleriz)
      job.tries = (job.tries || 0) + 1;
      if (job.tries <= 3) queue.push(job);
    }
  }
}

/* -------------------- public API -------------------- */

function startWorker() {
  if (workerStarted) return;
  workerStarted = true;
  workerTimer = setInterval(tick, TICK_MS);
  // eslint-disable-next-line no-console
  console.log("[firmAssignmentJob] worker started");
}

function stopWorker() {
  if (workerTimer) clearInterval(workerTimer);
  workerTimer = null;
  workerStarted = false;
}

function enqueueFirmAssigned({ assignedUserId, firmId, firmName, actorName, actionId }) {
  enqueue({
    id: nowId(),
    type: "firm_assigned",
    payload: { assignedUserId, firmId, firmName, actorName, actionId },
    tries: 0,
    createdAt: new Date(),
  });
}

function enqueueFirmRemoved({ assignedUserId, firmId, firmName, actorName, actionId }) {
  enqueue({
    id: nowId(),
    type: "firm_removed",
    payload: { assignedUserId, firmId, firmName, actorName, actionId },
    tries: 0,
    createdAt: new Date(),
  });
}

module.exports = {
  startWorker,
  stopWorker,
  enqueueFirmAssigned,
  enqueueFirmRemoved,
  // debug için istersen:
  _queueSize: () => queue.length,
};
