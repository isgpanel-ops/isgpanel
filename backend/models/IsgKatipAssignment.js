const mongoose = require("mongoose");

const IsgKatipAssignmentSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    firmaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Firma",
      required: true,
      index: true,
    },
    assignedUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    gorevTuru: {
      type: String,
      enum: ["is_guvenligi_uzmani", "isyeri_hekimi", "diger_saglik_personeli"],
      default: "is_guvenligi_uzmani",
      index: true,
    },
    isgKatipStatus: {
      type: String,
      enum: [
        "kontrol_edilmedi",
        "atama_yok",
        "profesyonel_onayi_bekliyor",
        "isveren_onayi_bekliyor",
        "atama_onaylandi",
        "atama_dustu",
        "yeniden_atama_gerekli",
      ],
      default: "kontrol_edilmedi",
      index: true,
    },
    sozlesmeId: { type: String, default: "" },
    calismaSuresi: { type: String, default: "" },
    baslangicTarihi: { type: Date, default: null },
    bitisTarihi: { type: Date, default: null },
    lastSyncAt: { type: Date, default: null },
    lastError: { type: String, default: "" },
    logs: [
      {
        action: { type: String, default: "" },
        message: { type: String, default: "" },
        by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        at: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

IsgKatipAssignmentSchema.index(
  { organization: 1, firmaId: 1, gorevTuru: 1 },
  { unique: true }
);

module.exports =
  mongoose.models.IsgKatipAssignment ||
  mongoose.model("IsgKatipAssignment", IsgKatipAssignmentSchema);
