const mongoose = require("mongoose");

const KurulFileSchema = new mongoose.Schema(
  {
    originalName: { type: String, default: "" },
    fileName: { type: String, default: "" },
    mimeType: { type: String, default: "" },
    size: { type: Number, default: 0 },
    path: { type: String, default: "" },
    url: { type: String, default: "" },
  },
  { timestamps: true }
);

const KurulNushasiSchema = new mongoose.Schema(
  {
    firmaId: { type: String, required: true, index: true },
    firmaAdi: { type: String, default: "" },

    userId: { type: String, default: "" },

    year: { type: Number, required: true, index: true },
    month: { type: Number, required: true, index: true },

    periodLabel: { type: String, default: "" },

    kurulStartMonth: { type: Number, default: 1 },
    tehlikeSinifi: { type: String, default: "" },

    files: [KurulFileSchema],

    savedToBelgelerim: { type: Boolean, default: false },
    belgelerimDocumentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      default: null,
    },
  },
  { timestamps: true }
);

KurulNushasiSchema.index(
  { firmaId: 1, year: 1, month: 1 },
  { unique: true }
);

module.exports = mongoose.model("KurulNushasi", KurulNushasiSchema);