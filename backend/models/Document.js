const mongoose = require("mongoose");

const DocumentSchema = new mongoose.Schema(
  {
    organizationId: { type: String, required: true, index: true },

    firmaId: { type: String, required: true, index: true },
    firmaAdi: { type: String, required: true },

    category: { type: String, required: true, index: true },
    subCategory: { type: String },

    title: { type: String, required: true },
    year: { type: Number },

    status: {
      type: String,
      enum: ["hazir", "arsiv"],
      default: "hazir",
      index: true,
    },

    createdBy: { type: String },
    createdByUserId: { type: String, index: true },

    belgeTuru: { type: String, default: "" },
    personName: { type: String, default: "", index: true },

    tarih: { type: String, default: "", index: true },
    uniqueKey: { type: String, default: "" },
    hazirlayan: { type: String, default: "" },
    dosyaTuru: { type: String, default: "" },

    dateISO: { type: String, default: "" },
    baslangicTarihi: { type: String, default: "", index: true },
    bitisTarihi: { type: String, default: "", index: true },
    gecerlilik: { type: String, default: "", index: true },

    absoluteUrl: { type: String, default: "" },
    fileName: { type: String, default: "" },
    fileUrl: { type: String, default: "" },

    storageType: {
      type: String,
      enum: ["local", "external"],
      default: "local",
      index: true,
    },

    storagePath: {
      type: String,
      default: "",
      trim: true,
    },

    externalProvider: {
      type: String,
      default: "",
      trim: true,
    },

    archivedAt: {
      type: Date,
      default: null,
      index: true,
    },

    fileSize: {
      type: Number,
      default: 0,
    },

    checksum: {
      type: String,
      default: "",
      trim: true,
    },

    data: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

DocumentSchema.index(
  { organizationId: 1, status: 1, category: 1, createdAt: -1 }
);
DocumentSchema.index(
  { organizationId: 1, firmaId: 1, createdAt: -1 }
);
DocumentSchema.index(
  { organizationId: 1, category: 1, gecerlilik: 1 }
);
DocumentSchema.index(
  { organizationId: 1, category: 1, personName: 1, year: 1 }
);

DocumentSchema.index(
  { organizationId: 1, storageType: 1, createdAt: -1 }
);
DocumentSchema.index(
  { organizationId: 1, archivedAt: -1 }
);

DocumentSchema.index(
  { organizationId: 1, uniqueKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      uniqueKey: { $type: "string", $ne: "" },
    },
  }
);

module.exports =
  mongoose.models.Document || mongoose.model("Document", DocumentSchema);