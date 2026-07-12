const mongoose = require("mongoose");

const FirmUserSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    firmId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Firma",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    gorevTuru: {
      type: String,
      enum: ["is_guvenligi_uzmani", "isyeri_hekimi", "diger_saglik_personeli"],
      default: "is_guvenligi_uzmani",
      index: true,
    },
    isActive: { type: Boolean, default: true, index: true },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

FirmUserSchema.index({ organization: 1, firmId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.models.FirmUser || mongoose.model("FirmUser", FirmUserSchema);
