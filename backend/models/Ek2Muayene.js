const mongoose = require("mongoose");

const Ek2MuayeneSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    firmaId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    tcKimlik: { type: String, required: true, index: true },
    adSoyad: { type: String, default: "" },
    gorev: { type: String, default: "" },
    kisiselBilgiler: { type: mongoose.Schema.Types.Mixed, default: {} },
    saglikBilgileri: { type: mongoose.Schema.Types.Mixed, default: {} },
    muayene: { type: mongoose.Schema.Types.Mixed, default: {} },
    tetkikler: { type: [mongoose.Schema.Types.Mixed], default: [] },
    sonuc: { type: mongoose.Schema.Types.Mixed, default: {} },
    imzalar: { type: mongoose.Schema.Types.Mixed, default: {} },
    fotoUrl: { type: String, default: "" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, collection: "hekim_ek2_muayeneler" }
);

Ek2MuayeneSchema.index({ organizationId: 1, firmaId: 1, tcKimlik: 1 }, { unique: true });

module.exports = mongoose.models.Ek2Muayene || mongoose.model("Ek2Muayene", Ek2MuayeneSchema);
