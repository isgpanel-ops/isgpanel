const mongoose = require("mongoose");

const IsgKatipJobSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    firmaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Firma",
      required: true,
      index: true,
    },
    assignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "IsgKatipAssignment",
      default: null,
      index: true,
    },
    jobKey: { type: String, required: true, unique: true, index: true },
    gorevTuru: {
      type: String,
      enum: ["is_guvenligi_uzmani", "isyeri_hekimi", "diger_saglik_personeli"],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "in_progress", "done", "failed", "cancelled"],
      default: "pending",
      index: true,
    },
    firmaAdi: { type: String, default: "" },
    sgkNo: { type: String, default: "", index: true },
    tehlike: { type: String, default: "" },
    calisanSayisi: { type: Number, default: null },
    assigneeName: { type: String, default: "" },
    assigneeTcKimlik: { type: String, default: "" },
    assignedUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    claimedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    attempts: { type: Number, default: 0 },
    lastError: { type: String, default: "" },
    lastClientNote: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    logs: [
      {
        action: { type: String, default: "" },
        message: { type: String, default: "" },
        by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        at: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

IsgKatipJobSchema.index({ organization: 1, status: 1, gorevTuru: 1, updatedAt: 1 });

module.exports =
  mongoose.models.IsgKatipJob || mongoose.model("IsgKatipJob", IsgKatipJobSchema);
