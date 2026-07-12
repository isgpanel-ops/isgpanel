const mongoose = require("mongoose");

const IsgKatipPersonSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    gorevTuru: {
      type: String,
      enum: ["isyeri_hekimi", "diger_saglik_personeli"],
      required: true,
      index: true,
    },
    adSoyad: { type: String, required: true, trim: true },
    tcKimlik: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

IsgKatipPersonSchema.index(
  { organization: 1, gorevTuru: 1, tcKimlik: 1 },
  { unique: true }
);

module.exports =
  mongoose.models.IsgKatipPerson ||
  mongoose.model("IsgKatipPerson", IsgKatipPersonSchema);
