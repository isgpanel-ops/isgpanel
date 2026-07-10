const mongoose = require("mongoose");

const FileSchema = new mongoose.Schema(
  {
    originalName: String,
    fileName: String,
    mimeType: String,
    size: Number,
    path: String,
    url: String,
  },
  { _id: true }
);

const PeriyodikRaporSchema = new mongoose.Schema(
  {
    firmaId: { type: String, required: true, index: true },
    firmaAdi: { type: String, default: "" },

    userId: { type: String, default: "" },

    year: { type: Number, required: true, index: true },

    raporKey: { type: String, required: true, index: true },
    raporAdi: { type: String, required: true },

    files: [FileSchema],

    savedToBelgelerim: { type: Boolean, default: false },
    belgelerimDocumentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      default: null,
    },
  },
  { timestamps: true }
);

PeriyodikRaporSchema.index(
  { firmaId: 1, year: 1, raporKey: 1 },
  { unique: true }
);

module.exports = mongoose.model("PeriyodikRapor", PeriyodikRaporSchema);