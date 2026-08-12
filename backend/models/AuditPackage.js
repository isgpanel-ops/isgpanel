const mongoose = require("mongoose");

const AuditPackageSchema = new mongoose.Schema(
  {
    organizationId: { type: String, required: true, index: true },
    companyId: { type: String, required: true, index: true },
    companyName: { type: String, default: "" },
    packageNumber: { type: String, required: true, unique: true, index: true },
    createdBy: { type: String, default: "" },
    createdByUserId: { type: String, default: "", index: true },
    status: {
      type: String,
      enum: ["ACTIVE", "EXPIRED", "REVOKED"],
      default: "ACTIVE",
      index: true,
    },
    publicToken: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, default: null, index: true },
    revokedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

AuditPackageSchema.index({ organizationId: 1, companyId: 1, createdAt: -1 });

module.exports =
  mongoose.models.AuditPackage ||
  mongoose.model("AuditPackage", AuditPackageSchema);
