const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: { type: String, required: true },

    // bireysel | ticari_admin | ticari_user | super_admin
    role: {
      type: String,
      default: "bireysel",
      index: true,
    },

    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
      index: true,
    },

    planCode: {
      type: String,
      default: "bireysel",
      index: true,
    },

    // ✅ GERÇEK ABONELİK (saatli sayaç için start + mevcut end)
    subscriptionStartAt: {
      type: Date,
      default: null,
      index: true,
    },

    subscriptionEnd: {
      type: Date,
      default: null,
      index: true,
    },

    // ✅ DEMO kullanıcı flag'i
    demo: {
      type: Boolean,
      default: false,
      index: true,
    },

    // ✅ DEMO ZAMANLARI (saatli sayaç)
    demoStartAt: {
      type: Date,
      default: null,
      index: true,
    },

    demoEndAt: {
      type: Date,
      default: null,
      index: true,
    },

    // ✅ Denetim Merkezi - Durum & Bloke Yönetimi
    status: {
      type: String,
      enum: ["aktif", "askida", "pasif", "blokeli"],
      default: "aktif",
      index: true,
    },

    // demo bitti vb. için burayı kullanacağız: "DEMO_EXPIRED"
   blockReason: { type: String, default: "" },

// 🔐 Şifre sıfırlama alanları
resetPasswordToken: { type: String, default: "" },
resetPasswordExpires: { type: Date, default: null },

blockedAt: { type: Date, default: null },
blockedBy: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "User",
  default: null,
},

    nameChangeCount: { type: Number, default: 0 },
    emailChangeCount: { type: Number, default: 0 },
    lastIdentityChangeAt: { type: Date, default: null },

    autoBlockTriggered: { type: Boolean, default: false },

    // ✅ Kişisel Bilgiler (Mongo)
    personal: {
      tcKimlik: { type: String, default: "" },
      dogumTarihi: { type: String, default: "" }, // YYYY-MM-DD
      telefon: { type: String, default: "" },
      adres: { type: String, default: "" },
      sehir: { type: String, default: "" },
      ilce: { type: String, default: "" },
      meslek: { type: String, default: "" },
      sertifikaSinifi: { type: String, default: "" },
      sertifikaNo: { type: String, default: "" },

      isgUzmaniAdSoyad: { type: String, default: "" },
      isverenVekiliAdSoyad: { type: String, default: "" },
      isyeriHekimiAdSoyad: { type: String, default: "" },
      calisanTemsilcisiAdSoyad: { type: String, default: "" },
      destekElemaniAdSoyad: { type: String, default: "" },
      bilgiSahibiKisiAdSoyad: { type: String, default: "" },

      isgUzmaniUnvan: { type: String, default: "" },
      isyeriHekimiUnvan: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
