// backend/models/ReminderItem.js
const mongoose = require("mongoose");

const reminderItemSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    firmId: { type: mongoose.Schema.Types.ObjectId, ref: "Firma", required: false, index: true },

    // Ne için takip ediyoruz?
    kind: {
      type: String,
      enum: [
        "document_expiry",       // evrak süre bitimi
        "training_renewal",      // eğitim yenileme
        "subscription",          // abonelik/ödeme
        "year_end_plan",         // yıl sonu plan yükleme
        "custom",                // senin özel tanımların
      ],
      default: "custom",
      index: true,
    },

    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },

    // Kritik tarih
    dueDate: { type: Date, required: true, index: true },

    // Bildirime tıklayınca gideceği yer
    link: { type: String, trim: true },

    // Aktif mi?
    isActive: { type: Boolean, default: true, index: true },

    // 30/15/7 için hangi eşikler aktif?
    thresholds: {
      type: [Number],
      default: [30, 15, 7],
    },

    // Ek meta (evrak tipi, eğitim adı vs.)
    meta: { type: Object, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ReminderItem", reminderItemSchema);
