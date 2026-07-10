const mongoose = require("mongoose");

const belgeNoSchema = new mongoose.Schema(
  {
    // 🔥 HANGİ FİRMA
    firmaId: {
      type: String,
      required: true,
      index: true,
    },

    // 🔥 YIL (2026, 2027 vs)
    yil: {
      type: Number,
      required: true,
      index: true,
    },

    // 🔥 SAYAÇ (0001, 0002...)
    sayac: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// 🔥 AYNI FİRMA + AYNI YIL TEK KAYIT OLSUN
belgeNoSchema.index({ firmaId: 1, yil: 1 }, { unique: true });

module.exports = mongoose.model("BelgeNo", belgeNoSchema);