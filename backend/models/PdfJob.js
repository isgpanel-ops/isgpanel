const mongoose = require("mongoose");

const PdfJobSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      trim: true,
    },

    status: {
      type: String,
      enum: ["queued", "processing", "done", "error"],
      default: "queued",
      index: true,
    },

    data: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      default: {},
    },

    createdByUserId: {
      type: String,
      default: "",
      index: true,
    },

    organizationId: {
      type: String,
      default: "",
      index: true,
    },

    resultFilePath: {
      type: String,
      default: "",
    },

    resultFileUrl: {
      type: String,
      default: "",
    },

    documentId: {
      type: String,
      default: "",
    },

   verificationCode: {
  type: String,
  default: "",
  index: true,
},

    error: {
      type: String,
      default: "",
    },

    startedAt: {
      type: Date,
      default: null,
    },

    finishedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

PdfJobSchema.index({ status: 1, createdAt: 1 });
PdfJobSchema.index({ organizationId: 1, createdAt: -1 });
PdfJobSchema.index({ createdByUserId: 1, createdAt: -1 });

module.exports = mongoose.models.PdfJob || mongoose.model("PdfJob", PdfJobSchema);