const mongoose = require("mongoose");

const DefterNushasiFileSchema = new mongoose.Schema(
  {
    originalName: String,
    fileName: String,
    mimeType: String,
    size: Number,
    path: String,
    url: String,
  },
  { timestamps: true }
);

const DefterNushasiSchema = new mongoose.Schema(
  {
    firmaId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    firmaAdi: {
      type: String,
      default: "",
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    year: {
      type: Number,
      required: true,
      index: true,
    },
    month: {
      type: Number,
      required: true,
      index: true,
    },
    periodLabel: {
      type: String,
      default: "",
    },
    files: [DefterNushasiFileSchema],
    savedToBelgelerim: {
      type: Boolean,
      default: false,
    },
    belgelerimDocumentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      default: null,
    },
  },
  { timestamps: true }
);

DefterNushasiSchema.index(
  { firmaId: 1, year: 1, month: 1 },
  { unique: true }
);

module.exports = mongoose.model("DefterNushasi", DefterNushasiSchema);