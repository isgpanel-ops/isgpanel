const mongoose = require("mongoose");

const IsgFaturaConnectionSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    tokenHash: { type: String, required: true, unique: true, index: true },
    faturaInstanceId: { type: String, required: true, trim: true, index: true },
    faturaAccountName: { type: String, default: "İSG Fatura", trim: true },
    isActive: { type: Boolean, default: true, index: true },
    connectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    lastSyncAt: { type: Date, default: null },
    lastSyncMode: { type: String, enum: ["initial", "count", ""], default: "" },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

IsgFaturaConnectionSchema.index(
  { organization: 1, faturaInstanceId: 1 },
  { unique: true }
);

module.exports =
  mongoose.models.IsgFaturaConnection ||
  mongoose.model("IsgFaturaConnection", IsgFaturaConnectionSchema);
