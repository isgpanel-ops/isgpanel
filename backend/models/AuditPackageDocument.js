const mongoose = require("mongoose");

const AuditPackageDocumentSchema = new mongoose.Schema({
  auditPackageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "AuditPackage",
    required: true,
    index: true,
  },
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Document",
    required: true,
    index: true,
  },
  organizationId: { type: String, required: true, index: true },
  companyId: { type: String, required: true, index: true },
  category: { type: String, required: true, index: true },
  documentVersion: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
});

AuditPackageDocumentSchema.index(
  { auditPackageId: 1, documentId: 1 },
  { unique: true }
);

module.exports =
  mongoose.models.AuditPackageDocument ||
  mongoose.model("AuditPackageDocument", AuditPackageDocumentSchema);
