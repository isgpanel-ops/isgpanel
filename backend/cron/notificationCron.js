// backend/cron/notificationCron.js
const cron = require("node-cron");
const Notification = require("../models/Notification");
const User = require("../models/User");
const Organization = require("../models/Organization");
const {
  sendRenewalWarningMail,
  sendRenewalExpiredMail,
} = require("../services/mailService");

// Bu fonksiyon, aynı "key" için ikinci kez bildirim üretmez
async function createNotificationOnce(data) {
  try {
    if (!data.key) {
      return await Notification.create(data);
    }
    const existing = await Notification.findOne({ key: data.key });
    if (existing) return existing;
    return await Notification.create(data);
  } catch (err) {
    console.error("Bildirim oluşturma hatası:", err);
  }
}

// 🔹 1) Risk Değerlendirme + Acil Durum (aynı zamanda yeniliyor)
async function checkRiskAndAcil() {
  try {
    let RiskModel;
    try {
      // BURAYA kendi risk model dosyanın yolunu ver
      // Ör: const Risk = require("../models/RiskDegerlendirme");
      RiskModel = require("../models/Risk");
    } catch (e) {
      console.log(
        "Risk modeli bulunamadı (checkRiskAndAcil); sadece log geçiliyor."
      );
      return;
    }

    const today = new Date();
    const riskler = await RiskModel.find({}); // kendi filtrelerini ekleyebilirsin

    for (const risk of riskler) {
      if (!risk.validUntil) continue; // kendi alan adına göre düzenle

      const diffDays = Math.ceil(
        (risk.validUntil - today) / (1000 * 60 * 60 * 24)
      );

      let severity = "info";
      let label = null;

      if ([30, 7, 1, 0].includes(diffDays) || diffDays < 0) {
        if (diffDays === 30) {
          severity = "warning";
          label = "30";
        } else if (diffDays === 7) {
          severity = "warning";
          label = "7";
        } else if (diffDays === 1) {
          severity = "critical";
          label = "1";
        } else if (diffDays === 0 || diffDays < 0) {
          severity = "critical";
          label = "expired";
        }

        const title =
          diffDays > 0
            ? `Risk Değerlendirme ve Acil Durum Planı (${diffDays} gün)`
            : "Risk Değerlendirme ve Acil Durum Planı süresi doldu";

        const message =
          diffDays > 0
            ? `${risk.firmaAdi || "İlgili firma"} için Risk Değerlendirme ve Acil Durum Planı ${diffDays} gün içinde yenilenmelidir.`
            : `${risk.firmaAdi || "İlgili firma"} için Risk Değerlendirme ve Acil Durum Planı süresi dolmuştur.`;

        await createNotificationOnce({
          userId: risk.userId,
          firmId: risk.firmaId,
          type: "time",
          module: "risk",
          title,
          message,
          severity,
          dueDate: risk.validUntil,
          link: `/firmalar/${risk.firmaId || ""}/risk`, // istersen ID de ekle
          key: `risk_${risk._id}_${label}`,
        });
      }
    }
  } catch (err) {
    console.error("checkRiskAndAcil hata:", err);
  }
}

// 🔹 2) Yıllık Planlar – Aralık ayı, 30 / 7 / 1 gün
async function checkYillikPlanlar() {
  try {
    let YillikPlanModel;
    try {
      // Ör: const YillikPlan = require("../models/YillikPlan");
      YillikPlanModel = require("../models/YillikPlan");
    } catch (e) {
      console.log(
        "Yıllık Plan modeli bulunamadı (checkYillikPlanlar); sadece log geçiliyor."
      );
      return;
    }

    const today = new Date();
    const month = today.getMonth() + 1; // 1-12

    if (month !== 12) return; // sadece Aralık

    const year = today.getFullYear();
    const hedefTarih = new Date(year, 11, 31); // 31 Aralık
    const diffDays = Math.ceil(
      (hedefTarih - today) / (1000 * 60 * 60 * 24)
    );

    if (![30, 7, 1].includes(diffDays)) return;

    const label = diffDays.toString();
    const severity = diffDays === 1 ? "warning" : "info";

    const planlar = await YillikPlanModel.find({ year });

    for (const plan of planlar) {
      await createNotificationOnce({
        userId: plan.userId,
        firmId: plan.firmaId,
        type: "time",
        module: "yillikPlan",
        title: `Yıllık Planlar hatırlatma (${diffDays} gün)`,
        message: `${
          plan.firmaAdi || "İlgili firma"
        } için ${year} yılı yıllık planlarını gözden geçirmeniz gerekmektedir.`,
        severity,
        dueDate: hedefTarih,
        link: `/firmalar/${plan.firmaId || ""}/yillik-planlar`,
        key: `yillik_${plan._id}_${label}`,
      });
    }
  } catch (err) {
    console.error("checkYillikPlanlar hata:", err);
  }
}

// 🔹 3) Eğitimler – 30 / 7 / 1 gün kala
async function checkEgitimler() {
  try {
    let EgitimModel;
    try {
      // Ör: const Egitim = require("../models/Egitim");
      EgitimModel = require("../models/Egitim");
    } catch (e) {
      console.log(
        "Eğitim modeli bulunamadı (checkEgitimler); sadece log geçiliyor."
      );
      return;
    }

    const today = new Date();
    const egitimler = await EgitimModel.find({});

    for (const egitim of egitimler) {
      if (!egitim.egitimTarihi) continue;

      const diffDays = Math.ceil(
        (egitim.egitimTarihi - today) / (1000 * 60 * 60 * 24)
      );

      if (![30, 7, 1].includes(diffDays)) continue;

      const label = diffDays.toString();
      const severity = diffDays === 1 ? "warning" : "info";

      await createNotificationOnce({
        userId: egitim.userId,
        firmId: egitim.firmaId,
        type: "time",
        module: "egitim",
        title: `Yaklaşan Eğitim (${diffDays} gün)`,
        message: `${
          egitim.firmaAdi || "İlgili firma"
        } için "${egitim.konu}" eğitimi ${diffDays} gün sonra gerçekleştirilecektir.`,
        severity,
        dueDate: egitim.egitimTarihi,
        link: `/firmalar/${egitim.firmaId || ""}/egitimler`,
        key: `egitim_${egitim._id}_${label}`,
      });
    }
  } catch (err) {
    console.error("checkEgitimler hata:", err);
  }
}

// 🔹 4) Abonelik bitişi – 5 / 3 / 1 gün kala
async function checkSubscriptions() {
  try {
    let SubscriptionModel;
    try {
      // Ör: const Subscription = require("../models/Subscription");
      SubscriptionModel = require("../models/Subscription");
    } catch (e) {
      console.log(
        "Subscription modeli bulunamadı (checkSubscriptions); sadece log geçiliyor."
      );
      return;
    }

    const today = new Date();
    const abonelikler = await SubscriptionModel.find({});

    for (const sub of abonelikler) {
      if (!sub.endDate) continue;

      const diffDays = Math.ceil(
        (new Date(sub.endDate) - today) / (1000 * 60 * 60 * 24)
      );

      // ✅ mevcut bildirim mantığı devam etsin
      if ([5, 3, 1].includes(diffDays)) {
        const label = diffDays.toString();
        const severity = diffDays === 1 ? "critical" : "warning";

        await createNotificationOnce({
          userId: sub.userId,
          type: "subscription",
          module: "abonelik",
          title: `Abonelik hatırlatması (${diffDays} gün)`,
          message: `İSG Panel aboneliğiniz ${diffDays} gün içinde sona erecek. Lütfen yenileyerek kesinti yaşamayın.`,
          severity,
          dueDate: sub.endDate,
          link: `/ayarlar/abonelik`,
          key: `sub_${sub.userId}_${label}`,
        });
      }

      // ✅ sadece 3 gün kala ve süre bitince mail gönder
      if (diffDays !== 3 && diffDays !== 0 && diffDays > 0) continue;

      try {
        // =========================
        // BİREYSEL
        // =========================
        if (sub.planType === "INDIVIDUAL" && sub.userId) {
          const user = await User.findById(sub.userId).lean();
          if (!user?.email) continue;

         if (diffDays === 3) {

  const mailKey = `mail_sub_3days_${user._id}`;

  const existingMail = await Notification.findOne({ key: mailKey });
  if (!existingMail) {

   await sendRenewalWarningMail({
  to: user.email,
  companyName: user.name || user.adSoyad || "Kullanıcı",
  endDate: sub.endDate,
  panelLink: "https://app.isgpanel.tr",
});

    await Notification.create({
      userId: user._id,
      type: "system",
      module: "mail",
      title: "3 gün kala abonelik maili gönderildi",
      message: "Abonelik hatırlatma maili gönderildi.",
      key: mailKey,
    });
  }
}

      if (diffDays <= 0) {
  const mailKey = `mail_sub_expired_${user._id}`;

  const existingMail = await Notification.findOne({ key: mailKey });
  if (!existingMail) {

   await sendRenewalExpiredMail({
  to: user.email,
  companyName: user.name || user.adSoyad || "Kullanıcı",
  panelLink: "https://app.isgpanel.tr",
});

    await Notification.create({
      userId: user._id,
      type: "system",
      module: "mail",
      title: "Abonelik bitiş maili gönderildi",
      message: "Abonelik süresi dolduğu için bilgilendirme maili gönderildi.",
      key: mailKey,
    });
  }
}
}

        // =========================
        // TİCARİ
        // =========================
        if (sub.planType === "CORPORATE" && sub.organizationId) {
          const org = await Organization.findById(sub.organizationId).lean();
          if (!org?._id) continue;

          const orgUsers = await User.find({
            organization: org._id,
            email: { $exists: true, $ne: "" },
          }).lean();

          for (const user of orgUsers) {
            try {
              if (diffDays === 3) {
               await sendRenewalWarningMail({
  to: user.email,
  companyName: org.name || "İSG Panel",
  endDate: sub.endDate,
  panelLink: "https://app.isgpanel.tr",
});
              }

             if (diffDays <= 0) {

  const mailKey = `mail_sub_expired_${user._id}`;

  const existingMail = await Notification.findOne({ key: mailKey });
  if (!existingMail) {

   await sendRenewalExpiredMail({
  to: user.email,
  companyName: org.name || "İSG Panel",
  panelLink: "https://app.isgpanel.tr",
});

    await Notification.create({
      userId: user._id,
      type: "system",
      module: "mail",
      title: "Abonelik bitiş maili gönderildi",
      message: "Abonelik süresi dolduğu için bilgilendirme maili gönderildi.",
      key: mailKey,
    });
  }
}
            } catch (mailErr) {
              console.error(
                "CORPORATE SUB MAIL ERROR:",
                user.email,
                mailErr?.message || mailErr
              );
            }
          }
        }
      } catch (mailOuterErr) {
        console.error(
          "checkSubscriptions mail hata:",
          mailOuterErr?.message || mailOuterErr
        );
      }
    }
  } catch (err) {
    console.error("checkSubscriptions hata:", err);
  }
}

// Tüm kontrolleri çalıştır
async function runAllChecks() {
  console.log("🔔 Bildirim kontrolleri başlıyor...");
  await checkRiskAndAcil();
  await checkYillikPlanlar();
  await checkEgitimler();
  await checkSubscriptions();
  console.log("🔔 Bildirim kontrolleri tamamlandı.");
}

// Her sabah 08:00'de çalışacak cron
cron.schedule("0 8 * * *", () => {
  console.log("🔔 08:00 cron tetiklendi");
  runAllChecks();
});



module.exports = {
  runAllChecks,
};
