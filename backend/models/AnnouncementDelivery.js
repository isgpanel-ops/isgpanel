const mongoose = require("mongoose");

const AnnouncementDeliverySchema = new mongoose.Schema(
  {
    announcementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Announcement",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    deliveredAt: { type: Date, default: null },
    readAt: { type: Date, default: null },
    ackAt: { type: Date, default: null },

    status: {
      type: String,
      enum: ["queued", "delivered", "failed"],
      default: "queued",
      index: true,
    },
    error: { type: String, default: null },
  },
  { timestamps: true }
);

// Aynı duyuru aynı kullanıcıya 2 kez yazılmasın
AnnouncementDeliverySchema.index({ announcementId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("AnnouncementDelivery", AnnouncementDeliverySchema);
