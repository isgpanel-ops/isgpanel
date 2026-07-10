// filename: backend/services/notificationService.js
const mongoose = require("mongoose");
const Notification = require("../models/Notification");

function normalizeObjectId(raw) {
  if (!raw) return null;
  if (raw instanceof mongoose.Types.ObjectId) return raw;

  const s = String(raw).trim();
  if (!s) return null;

  if (mongoose.Types.ObjectId.isValid(s)) return new mongoose.Types.ObjectId(s);

  // ObjectId değilse null dönüyoruz (schema ObjectId ise eşleşmez)
  return null;
}

async function createNotification({
  userId,
  firmId,
  type = "system",
  module = "genel",
  title,
  message,
  severity = "info",
  status = "unread",
  link,
  dueDate,
  key, // tekrar üretmeme anahtarı
}) {
  if (!userId) throw new Error("createNotification: userId zorunlu");
  if (!title) throw new Error("createNotification: title zorunlu");

  const uid = normalizeObjectId(userId);
  if (!uid) throw new Error(`createNotification: userId ObjectId değil -> ${String(userId)}`);

  const fid = firmId ? normalizeObjectId(firmId) : null; // firmId invalidse undefined yazalım

  const payload = {
    userId: uid,
    firmId: fid || undefined,
    type,
    module,
    title,
    message: message || "",
    severity,
    status,
    link: (link || "").trim(),
    dueDate,
    key: key ? String(key).trim() : "",
  };

  // ✅ key varsa atomik upsert
  if (payload.key) {
    const doc = await Notification.findOneAndUpdate(
      { userId: uid, key: payload.key },
      { $setOnInsert: payload },
      { upsert: true, returnDocument: "after" } // ✅ new yerine
    ).lean();

    return { created: true, notificationId: doc?._id };
  }

  const created = await Notification.create(payload);
  return { created: true, notificationId: created?._id };
}

module.exports = {
  createNotification,
};