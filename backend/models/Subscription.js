const mongoose = require("mongoose");

const InvoiceSchema = new mongoose.Schema(
  {
    invoiceNo: String,
    date: String, // "YYYY-MM-DD"
    amount: Number,
    currency: { type: String, default: "TRY" },
    status: { type: String, default: "Paid" }, // Paid / Pending / Failed
    pdfUrl: String,
  },
  { _id: false }
);

const SubscriptionSchema = new mongoose.Schema(
  {
    // bireysel: userId üzerinden
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },

    // ticari: organizationId üzerinden (tek abonelik, tüm kullanıcılara yansır)
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", index: true },

    planType: { type: String, enum: ["INDIVIDUAL", "CORPORATE"], required: true },

    currentPlanId: { type: String, required: true }, // INDIVIDUAL / CORPORATE create ederken set edilecek
    usersCount: { type: Number, default: 1 }, // corporate: offer/users limit, individual: 1

    period: { type: String, enum: ["Aylık", "Yıllık"], default: "Aylık" },
    autoRenew: { type: Boolean, default: true },
    showVatIncluded: { type: Boolean, default: false },

    startDate: { type: Date, default: Date.now },
endDate:   { type: Date, default: Date.now },


    // ödeme yöntemi (demo gösterim: sadece marka + last4 + holder)
    paymentBrand: { type: String, default: "VISA" },
    paymentLast4: { type: String, default: "1234" },
    paymentHolder: { type: String, default: "" },

    invoices: { type: [InvoiceSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Subscription", SubscriptionSchema);
