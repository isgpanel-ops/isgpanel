const mongoose = require("mongoose");
const Firma = require("../models/Firma");

const ROLES = ["isveren", "uzman", "hekim"];

function signatureValue(value) {
  return (
    value?.dataUrl ||
    value?.url ||
    (typeof value === "string" ? value : "") ||
    ""
  );
}

function mergeRole(stored = {}, provided = {}) {
  const providedImza = signatureValue(provided?.imza || provided?.signature);
  const providedParaf = signatureValue(provided?.paraf);

  return {
    ...stored,
    ...provided,
    imza: providedImza ? provided.imza || provided.signature : stored?.imza || stored?.signature || provided?.imza || null,
    paraf: providedParaf ? provided.paraf : stored?.paraf || provided?.paraf || null,
  };
}

function canUseFirm(user, firm) {
  const role = String(user?.role || "").toLowerCase().trim();
  const userId = String(user?._id || user?.id || "");

  if (role === "ticari_admin" || role === "ticari_user") {
    const organizationId = String(user?.organization || user?.organizationId || "");
    return organizationId && String(firm?.organization || "") === organizationId;
  }

  return Boolean(userId) && String(firm?.userId || "") === userId;
}

// PDF istekleri kuyrukta işlense bile firma imzalarını belge verisine ekler.
async function attachFirmaImzalari(payload = {}, user = null) {
  const firmId = String(
    payload?.firmaId || payload?.firmaIdMongo || payload?.firma?._id || payload?.firma?.id || ""
  ).trim();

  if (!user || !mongoose.Types.ObjectId.isValid(firmId)) return payload;

  const firm = await Firma.findById(firmId).select("organization userId imzalar").lean();
  if (!firm || !canUseFirm(user, firm)) return payload;

  const stored = firm.imzalar || {};
  const provided = payload.imzalar || {};
  const imzalar = { ...stored, ...provided };

  ROLES.forEach((role) => {
    imzalar[role] = mergeRole(stored?.[role], provided?.[role]);
  });

  return { ...payload, imzalar };
}

module.exports = { attachFirmaImzalari };
