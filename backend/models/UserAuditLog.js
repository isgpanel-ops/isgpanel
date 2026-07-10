const mongoose = require("mongoose");

const UserAuditLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    actorEmail: { type: String, default: "" },

    action: { type: String, required: true }, // USER_BLOCK, USER_UNBLOCK, EMAIL_CHANGE, NAME_CHANGE, AUTO_BLOCK
    reason: { type: String, required: true },

    meta: { type: Object, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model("UserAuditLog", UserAuditLogSchema);
