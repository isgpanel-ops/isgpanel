// models/YillikDegerlendirmeForm.js
const mongoose = require("mongoose");

const YillikDegerlendirmeRowSchema = new mongoose.Schema(
  {
    id: { type: String, default: "" },
    siraNo: { type: Number, default: 0 },

    calisma: { type: String, default: "" },
    tarih: { type: String, default: "" },
    yapanKisiUnvan: { type: String, default: "" },
    tekrarSayisi: { type: String, default: "" },
    kullanilanYontem: { type: String, default: "" },
    sonucYorum: { type: String, default: "" },
  },
  { _id: false }
);

const YillikDegerlendirmeFormSchema = new mongoose.Schema(
  {
    organizationId: { type: String, required: true, index: true },
    firmaId: { type: String, required: true, index: true },
    firmaAdi: { type: String, default: "" },

    type: {
      type: String,
      default: "yillik-degerlendirme-raporu",
      index: true,
    },

    raporTarihi: { type: String, default: "" },
    raporYili: { type: String, default: "" },

    rows: {
      type: [YillikDegerlendirmeRowSchema],
      default: [],
    },
  },
  { timestamps: true }
);

YillikDegerlendirmeFormSchema.index(
  { organizationId: 1, firmaId: 1, type: 1 },
  { unique: true }
);

module.exports =
  mongoose.models.YillikDegerlendirmeForm ||
  mongoose.model("YillikDegerlendirmeForm", YillikDegerlendirmeFormSchema);