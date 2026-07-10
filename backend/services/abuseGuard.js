const UserAuditLog = require("../models/UserAuditLog");
const { notifyUser } = require("./notify");
const ABUSE = require("../config/abuse");

async function recordIdentityChange({ user, actor, kind, oldValue, newValue }) {
  const now = new Date();
  user.lastIdentityChangeAt = now;

  if (kind === "name") user.nameChangeCount = (user.nameChangeCount || 0) + 1;
  if (kind === "email") user.emailChangeCount = (user.emailChangeCount || 0) + 1;

  // log
  await UserAuditLog.create({
    userId: user._id,
    actorUserId: actor?._id || null,
    actorEmail: actor?.email || "",
    action: kind === "name" ? "NAME_CHANGE" : "EMAIL_CHANGE",
    reason: "Kullanıcı kimlik bilgisi değişti",
    meta: { oldValue, newValue },
  });

  const total = (user.nameChangeCount || 0) + (user.emailChangeCount || 0);

  if (total >= ABUSE.IDENTITY_CHANGE_TOTAL_THRESHOLD && user.status !== "blokeli") {
    user.status = "blokeli";
    user.autoBlockTriggered = true;
    user.blockReason = `Aşırı kimlik değişimi (toplam=${total}). Otomatik bloke.`;
    user.blockedAt = now;

    await UserAuditLog.create({
      userId: user._id,
      actorUserId: null,
      actorEmail: "system",
      action: "AUTO_BLOCK",
      reason: user.blockReason,
      meta: { threshold: ABUSE.IDENTITY_CHANGE_TOTAL_THRESHOLD, total },
    });

    await notifyUser({
      user,
      title: "Hesabınız güvenlik nedeniyle bloke edildi",
      message: "Sık kimlik değişikliği tespit edildi. Destek ile iletişime geçin.",
    });
  }
}

module.exports = { recordIdentityChange };
