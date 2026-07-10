const mongoose = require("mongoose");

const PlanSettingSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    maxUsers: { type: Number, required: true, default: 1 },
    monthlyPrice: { type: Number, required: true, default: 0 },
    kdvRate: { type: Number, required: true, default: 0.2 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PlanSetting", PlanSettingSchema);