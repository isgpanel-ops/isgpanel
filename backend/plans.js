const PLANS = {
  bireysel_standart: {
    code: "bireysel_standart",
    name: "Bireysel Kullanıcı",
    maxUsers: 1,
    monthlyPrice: 300,
    kdvRate: 0.20,
  },

  ticari_5: {
    code: "ticari_5",
    name: "Ticari (Max 5 Kullanıcı)",
    maxUsers: 5,
    monthlyPrice: 2000,
    kdvRate: 0.20,
  },

  ticari_10: {
    code: "ticari_10",
    name: "Ticari (Max 10 Kullanıcı)",
    maxUsers: 10,
    monthlyPrice: 3500,
    kdvRate: 0.20,
  },

  ticari_15: {
    code: "ticari_15",
    name: "Ticari (Max 15 Kullanıcı)",
    maxUsers: 15,
    monthlyPrice: 5000,
    kdvRate: 0.20,
  },

  "prof-ozel": {
    code: "prof-ozel",
    name: "Kurumsal (Özel Teklif)",
    maxUsers: 9999,
    monthlyPrice: 0,
    kdvRate: 0.20,
  },
};

module.exports = PLANS;