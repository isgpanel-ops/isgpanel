import mongoose from "mongoose";

const RiskDraftSchema = new mongoose.Schema(
  {
    firmaId: { type: String, required: true, unique: true },
    firmaAdi: String,
    payload: Object,
  },
  { timestamps: true }
);

export default mongoose.model("RiskDraft", RiskDraftSchema);