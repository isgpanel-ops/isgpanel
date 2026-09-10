const mongoose = require("mongoose");

const adminPanelAccessLogSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    actorUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    viewedUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    action: { type: String, enum: ["panel_enter", "panel_exit", "mutation"], required: true, index: true },
    method: { type: String, default: "" },
    path: { type: String, default: "" },
    statusCode: { type: Number, default: null },
    ip: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AdminPanelAccessLog", adminPanelAccessLogSchema);
