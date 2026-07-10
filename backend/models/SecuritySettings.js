const mongoose = require("mongoose");

const DeviceSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },        // frontend device id
    name: { type: String, default: "" },         // Chrome - Windows gibi
    ip: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    lastSeenAt: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const SecuritySettingsSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true, required: true },

    // mail kilitli: backend tarafında email update etmiyoruz, burada sadece güvenlik ayarları var
    twofa: { type: Boolean, default: false },
    newLoginAlert: { type: Boolean, default: true },

    devices: { type: [DeviceSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SecuritySettings", SecuritySettingsSchema);
