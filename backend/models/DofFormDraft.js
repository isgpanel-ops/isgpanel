const mongoose = require("mongoose");

const DofFormDraftSchema = new mongoose.Schema(
  {
    firmaId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    form: {
      tarih: {
        type: String,
        default: "",
        trim: true,
      },
      kayitNo: {
        type: String,
        default: "",
        trim: true,
      },
      tanim: {
        type: String,
        default: "",
        trim: true,
      },
      neden: {
        type: String,
        default: "",
        trim: true,
      },
      faaliyet: {
        type: String,
        default: "",
        trim: true,
      },
      planBitis: {
        type: String,
        default: "",
        trim: true,
      },
      takipSonucu: {
        type: String,
        default: "",
        trim: true,
      },
      yeniFaaliyetNo: {
        type: String,
        default: "",
        trim: true,
      },
    },

    updatedBy: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "dof_form_drafts",
  }
);

module.exports =
  mongoose.models.DofFormDraft ||
  mongoose.model("DofFormDraft", DofFormDraftSchema);