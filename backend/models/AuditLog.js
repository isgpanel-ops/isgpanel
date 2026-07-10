// backend/models/AuditLog.js
const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    actorEmail: { type: String, default: "" },

    action: { type: String, required: true }, // ORG_PILOT_EXTEND_7D vb.

    targetType: { type: String, required: true }, // "organization" | "user" | ...
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },

    reason: { type: String, default: "" },

    before: { type: Object, default: null },
    after: { type: Object, default: null },

    ip: { type: String, default: "" },
    userAgent: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AuditLog", auditLogSchema);
