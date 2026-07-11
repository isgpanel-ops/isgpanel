const mongoose = require("mongoose");

const FirmaSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      default: null,
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    firmaAdi: { type: String, required: true },
    sgkNo: { type: String },
    adres: { type: String },
    il: { type: String, default: "" },
    calisanSayisi: { type: Number, default: null },
    telefon: { type: String },
    sektor: { type: String },

    nace: { type: String, default: "" },
    faaliyet: { type: String, default: "" },

    tehlike: {
      type: String,
      enum: ["Az Tehlikeli", "Tehlikeli", "Çok Tehlikeli"],
      default: "Tehlikeli",
    },

    durum: {
      type: String,
      enum: ["Aktif", "Askıda"],
      default: "Askıda",
    },

    hazirlama: { type: Date, default: null },
    gecerlilik: { type: Date, default: null },

    // ✅ FİRMA KİŞİLER
    kisiler: {
      isveren: { type: String, default: "" },
      uzman: { type: String, default: "" },
      hekim: { type: String, default: "" },
      temsilci: { type: String, default: "" },
      destek: { type: String, default: "" },
      bilgi: { type: String, default: "" },
    },

imzalar: {
  isveren: {
    imza: { type: Object, default: null },
    paraf: { type: Object, default: null },
  },
  uzman: {
    imza: { type: Object, default: null },
    paraf: { type: Object, default: null },
  },
  hekim: {
    imza: { type: Object, default: null },
    paraf: { type: Object, default: null },
  },
  temsilci: {
    imza: { type: Object, default: null },
    paraf: { type: Object, default: null },
  },
  destek: {
    imza: { type: Object, default: null },
    paraf: { type: Object, default: null },
  },
  bilgi: {
    imza: { type: Object, default: null },
    paraf: { type: Object, default: null },
  },
},

  },
  { timestamps: true }
);

module.exports = mongoose.models.Firma || mongoose.model("Firma", FirmaSchema);
