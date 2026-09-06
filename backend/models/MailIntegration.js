const mongoose = require("mongoose");

const MailIntegrationSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    provider: { type: String, enum: ["gmail", "zoho", "microsoft", "outlook", "custom"], default: "custom" },
    email: { type: String, required: true, trim: true, lowercase: true },
    displayName: { type: String, default: "", trim: true },
    host: { type: String, required: true, trim: true },
    port: { type: Number, required: true },
    secure: { type: Boolean, default: true },
    encryptedPassword: { type: String, required: true, select: false },
    verifiedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.models.MailIntegration || mongoose.model("MailIntegration", MailIntegrationSchema);
