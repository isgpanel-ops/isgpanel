// filename: backend/models/Notification.js
const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    firmId: { type: mongoose.Schema.Types.ObjectId, ref: "Firma", default: null, index: true },

    type: { type: String, default: "system" },      // system | time | event
    module: { type: String, default: "genel" },     // risk | egitim | yillikPlan | genel

    title: { type: String, required: true },
    message: { type: String, default: "" },

    severity: { type: String, default: "info" },    // info | warning | critical
    status: { type: String, default: "unread", index: true }, // unread | read

    dueDate: { type: Date, default: null },
    link: { type: String, default: "" },
    key: { type: String, default: "", index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);
