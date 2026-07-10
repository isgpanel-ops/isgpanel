const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema(
  {
    scope: { type: String, enum: ["CORPORATE", "PERSONAL"], required: true },

    organizationUuid: { type: String, default: "" },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization" },

    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    type: { type: String, enum: ["NEW", "UPGRADE", "ADD_USERS", "OFFER"], required: true },

    status: { type: String, enum: ["success", "failed"], default: "success" },

    amountTRY: { type: Number, default: 0 }, // alınan
    expectedTRY: { type: Number, default: 0 }, // beklenen

    period: { type: String, enum: ["Aylık", "Yıllık"], default: "Aylık" },

    planFrom: { type: String, default: "" },
    planTo: { type: String, default: "" },

    usersBefore: { type: Number, default: 0 },
    usersAfter: { type: Number, default: 0 },
    usersDelta: { type: Number, default: 0 },

    token: { type: String, default: "" }, // teklif token vb
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", PaymentSchema);