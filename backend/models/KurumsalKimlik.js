const mongoose = require("mongoose");

const kurumsalKimlikSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
      unique: true,
    },

    firmaAdi: { type: String, default: "" },
    adres: { type: String, default: "" },
    telefon: { type: String, default: "" },
    email: { type: String, default: "" },
    web: { type: String, default: "" },

    // base64 (panel önizleme için kalır)
    logo: { type: String, default: "" },

    // ✅ evrak için dosya yolu
    logoUrl: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("KurumsalKimlik", kurumsalKimlikSchema);
