// backend/models/PaymentSession.js
const mongoose = require("mongoose");

const PaymentSessionSchema = new mongoose.Schema(
  {
    provider: { type: String, default: "IYZICO" },

    // idempotency anahtarı (iyzico callback body.token)
    iyzicoToken: { type: String, required: true, unique: true, index: true },

    conversationId: { type: String, default: "" },

    // ✅ payment.js /success organizationId olarak "uuid" bekliyor
    // ✅ bireysel akışta org olmayabilir → required KALDIRILDI
    organizationUuid: { type: String, default: "", index: true },

    // ✅ bireysel ödeme için (org yokken) destek
    userId: { type: String, default: "", index: true },

    // NEW | UPGRADE | ADD_USERS
    type: { type: String, default: "NEW" },

    // init tarafındaki seçimler (log + doğrulama için)
    planId: { type: String, default: "" },
    planCode: { type: String, default: "" },

    // ✅ teklif token (public/offer akışları)
    offerToken: { type: String, default: "" },

    period: { type: String, default: "Aylık" },
    months: { type: Number, default: 1 },
    usersCount: { type: Number, default: 0 },

    // ✅ UPGRADE / ADD_USERS / erken ödeme kalan süre aktarımı
    targetPlanId: { type: String, default: "" },
    addUsersCount: { type: Number, default: 0 },

    // ✅ Aylık → yıllık / erken ödeme kalan gün aktarımı
    carryOverDays: { type: Number, default: 0 },
    isRenewal: { type: Boolean, default: false },

    expectedAmountTRY: { type: Number, default: 0 },

    // ✅ Fatura bilgileri
    billingInfo: {
      type: {
        type: String,
        enum: ["bireysel", "kurumsal"],
        default: "kurumsal",
      },

      // Kurumsal ise firma ünvanı, bireysel ise ad soyad
      title: { type: String, default: "" },

      // Kurumsal: Vergi No, Bireysel: TC Kimlik No
      taxNumber: { type: String, default: "" },

      taxOffice: { type: String, default: "" },

      contactName: { type: String, default: "" },
      email: { type: String, default: "" },
      phone: { type: String, default: "" },

      address: { type: String, default: "" },
      city: { type: String, default: "" },
      district: { type: String, default: "" },
    },

    // WAITING_BILLING_INFO | READY_TO_INVOICE | INVOICE_DRAFT | OFFICIAL_ISSUED | INVOICE_FAILED
    invoiceStatus: {
      type: String,
      enum: [
        "WAITING_BILLING_INFO",
        "READY_TO_INVOICE",
        "INVOICE_DRAFT",
        "OFFICIAL_ISSUED",
        "INVOICE_FAILED",
      ],
      default: "WAITING_BILLING_INFO",
      index: true,
    },

    invoiceNumber: { type: String, default: "" },
    invoiceCreatedAt: { type: Date },
    invoicePdfUrl: { type: String, default: "" },

    // ✅ Süper admin fatura ekranı durum geçmişi
    invoiceStatusUpdatedAt: { type: Date },
    invoiceStatusUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // PENDING | PAID | FAILED
    status: { type: String, default: "PENDING", index: true },

    // ödeme sonucu
    paidPrice: { type: Number, default: 0 },
    paymentId: { type: String, default: "" },
    paidAt: { type: Date },

    errorMessage: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PaymentSession", PaymentSessionSchema);