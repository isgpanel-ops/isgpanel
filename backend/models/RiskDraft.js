const mongoose = require("mongoose");

const RiskDraftSchema = new mongoose.Schema(
  {
    firmaId: { type: String, required: true, unique: true },
    firmaAdi: { type: String, default: "" },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.RiskDraft || mongoose.model("RiskDraft", RiskDraftSchema);
