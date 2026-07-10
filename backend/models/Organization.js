const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const organizationSchema = new mongoose.Schema(
  {
    // ✅ DIŞ DÜNYA TEK KİMLİK (ÖDEME / CHECKOUT / LINKLER)
    uuid: {
      type: String,
      default: uuidv4,
      unique: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
    },

    planCode: {
      type: String,
      required: true,
    },

    userLimit: {
      type: Number,
      required: true,
    },

    // ✅ Mevcut ödeme/abonelik durumu - BOZMADIK
    status: {
      type: String,
      enum: ["pending-payment", "active", "expired"],
      default: "pending-payment",
    },

    subscriptionStartAt: {
  type: Date,
  default: null,
},

subscriptionEnd: {
  type: Date,
  default: null,
},

    // ✅ Super Admin "yaşam döngüsü" durumu (kitleme yok, sadece takip)
    lifecycleStatus: {
      type: String,
      enum: ["aktif", "askida", "pasif"],
      default: "aktif",
    },

    // ✅ Pilot yönetimi alanları
    pilotEnabled: {
      type: Boolean,
      default: false,
    },
    pilotStartAt: {
      type: Date,
      default: null,
    },
    pilotEndAt: {
      type: Date,
      default: null,
    },

    // ✅ +7 gün uzatma sayaç/son not
    pilotExtendedCount: {
      type: Number,
      default: 0,
    },
    pilotNotesLast: {
      type: String,
      default: "",
    },

    // ✅ opsiyonel: son aktivite (genel bakışta işine yarar)
    lastActivityAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Organization", organizationSchema);
