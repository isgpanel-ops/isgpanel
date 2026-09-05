const mongoose = require("mongoose");

const AuditPackageSchema = new mongoose.Schema(
  {
    organizationId: { type: String, required: true, index: true },
    organizationSlug: { type: String, default: "isg-panel", index: true },
    // Paylaşım oluşturulduğundaki OSGB kimliği saklanır; public sayfa sonradan
    // kullanıcı hesabına erişmeden aynı marka ile açılır.
    organizationName: { type: String, default: "" },
    organizationLogoUrl: { type: String, default: "" },
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
    recipientName: { type: String, default: "", trim: true },
    recipientType: {
      type: String,
      enum: ["INSPECTOR", "EMPLOYER", "HR", "COMPANY_REPRESENTATIVE", "OHS_PROFESSIONAL", "OTHER"],
      default: "OTHER",
    },
    recipientEmail: { type: String, default: "", trim: true, lowercase: true, index: true },
    recipientPhone: { type: String, default: "", trim: true },
    note: { type: String, default: "", trim: true, maxlength: 2000 },
    accessType: {
      type: String,
      enum: ["TIMED", "UNLIMITED"],
      default: "UNLIMITED",
    },
    passwordHash: { type: String, default: "", select: false },
    passwordSalt: { type: String, default: "", select: false },
    allowDownload: { type: Boolean, default: false },
    documentCount: { type: Number, default: 0, min: 0 },
    categoryCount: { type: Number, default: 0, min: 0 },
    emailSentAt: { type: Date, default: null },
    emailStatus: {
      type: String,
      enum: ["NOT_SENT", "SENT", "FAILED"],
      default: "NOT_SENT",
    },
    lastAccessAt: { type: Date, default: null },
    viewCount: { type: Number, default: 0, min: 0 },
    expiresAt: { type: Date, default: null, index: true },
    revokedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

AuditPackageSchema.index({ organizationId: 1, companyId: 1, createdAt: -1 });
AuditPackageSchema.index({ organizationId: 1, companyId: 1, recipientEmail: 1, createdAt: -1 });

module.exports =
  mongoose.models.AuditPackage ||
  mongoose.model("AuditPackage", AuditPackageSchema);
