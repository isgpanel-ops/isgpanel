const mongoose = require("mongoose");

const AudienceSchema = new mongoose.Schema(
  {
    mode: { type: String, enum: ["all", "role", "users", "bulk"], default: "all" },
    roles: [{ type: String }],

    // ✅ ID veya email tutulabilir
    users: [{ type: String }],

    bulk: { type: String, default: "" },
  },
  { _id: false }
);

const AnnouncementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },

    type: { type: String, enum: ["bilgilendirme", "sistem", "zorunlu"], default: "bilgilendirme" },
    priority: {
      type: String,
      enum: ["cok_yuksek", "yuksek", "normal", "dusuk"],
      default: "normal",
    },

    requiredAck: { type: Boolean, default: false },

    status: { type: String, enum: ["taslak", "aktif", "pasif", "bitti"], default: "taslak", index: true },

    startAt: { type: Date, default: null },
    endAt: { type: Date, default: null },

    audience: { type: AudienceSchema, default: () => ({ mode: "all" }) },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Announcement", AnnouncementSchema);
