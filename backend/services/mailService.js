const nodemailer = require("nodemailer");

let transporter = null;
let verifiedOnce = false;

function getTransporter() {
  if (transporter) return transporter;

  console.log("📧 SMTP CONFIG:", {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE) === "true",
    user: process.env.SMTP_USER ? "✅ VAR" : "❌ YOK",
    pass: process.env.SMTP_PASS ? "✅ VAR" : "❌ YOK",
    from:
      process.env.SYSTEM_MAIL_FROM ||
      process.env.MAIL_FROM ||
      process.env.SMTP_USER ||
      "",
  });

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE) === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  return transporter;
}

async function ensureVerified(t) {
  if (verifiedOnce) return;
  try {
    await t.verify();
    verifiedOnce = true;
    console.log("✅ SMTP VERIFY OK");
  } catch (e) {
    console.error("❌ SMTP VERIFY FAIL:", e?.message || e);
    throw e;
  }
}

function getBaseUrl() {
  return (
    process.env.APP_URL ||
    process.env.FRONTEND_URL ||
    process.env.PUBLIC_APP_URL ||
    "https://app.isgpanel.tr"
  ).replace(/\/+$/, "");
}

function getPublicAssetUrl(envKey, fallbackPath) {
  const raw = process.env[envKey];
  if (raw && String(raw).trim()) return String(raw).trim();
  return `${getBaseUrl()}${fallbackPath}`;
}

async function sendMail({ to, subject, html, text, attachments = [], from }) {
  const t = getTransporter();
  await ensureVerified(t);

  console.log("📨 MAIL SEND ATTEMPT:", { to, subject });

  try {
    const info = await t.sendMail({
      from:
        from ||
        process.env.SYSTEM_MAIL_FROM ||
        process.env.MAIL_FROM ||
        process.env.SMTP_USER,
      to,
      subject,
      html,
      text,
      attachments,
    });

    console.log("✅ MAIL SENT:", {
      messageId: info?.messageId,
      response: info?.response,
      accepted: info?.accepted,
      rejected: info?.rejected,
    });

    return info;
  } catch (e) {
    console.error("❌ MAIL ERROR:", e?.message || e);
    throw e;
  }
}

function wrapMailTemplate(contentHtml) {
  const logoUrl = getPublicAssetUrl("MAIL_LOGO_URL", "/isgpanel-logo.png");

  return `
  <div style="margin:0;padding:24px 0;background:#f4f7fb;">
    <div style="max-width:640px;margin:0 auto;padding:0 16px;">
      <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden;">
        <div style="padding:24px 28px 32px 28px;font-family:Arial,sans-serif;color:#1f2937;font-size:14px;line-height:1.7;">

          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
            <tr>
              <td align="left" valign="middle">
                <img
                  src="${logoUrl}"
                  alt="İSG Panel"
                  style="display:block;max-height:48px;max-width:180px;height:auto;width:auto;"
                />
              </td>

              <td align="right" valign="middle" style="font-size:12px;color:#64748b;line-height:1.6;">
                <a
                  href="https://www.instagram.com/isgpanel?igsh=Y3VycGRubmxlNXZv&utm_source=qr"
                  style="color:#64748b;text-decoration:none;margin-right:10px;"
                >
                  Instagram
                </a>
                <a
                  href="https://www.isgpanel.tr"
                  style="color:#64748b;text-decoration:none;margin-right:10px;"
                >
                  www.isgpanel.tr
                </a>
                <span style="color:#64748b;">info@isgpanel.tr</span>
              </td>
            </tr>
          </table>

          ${contentHtml}

          <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e5e7eb;text-align:center;">
            <div style="font-size:14px;font-weight:700;color:#111827;">
              İSG Panel
            </div>

            <div style="margin-top:6px;font-size:13px;color:#6b7280;">
              İş Sağlığı ve Güvenliği Yönetim Platformu
            </div>

            <div style="margin-top:14px;font-size:12px;color:#94a3b8;">
              © 2026 İSG Panel. Tüm hakları saklıdır.
            </div>

            <div style="margin-top:6px;font-size:12px;color:#94a3b8;">
              Bu e-posta İSG Panel sistemi tarafından otomatik olarak gönderilmiştir.
            </div>
          </div>

        </div>
      </div>
    </div>
  </div>
  `;
}

function buildButton(label, href) {
  return `
    <div style="margin:18px 0 18px 0;">
      <a
        href="${href}"
        style="
          display:inline-block;
          background:#0a2b45;
          color:#ffffff;
          text-decoration:none;
          font-weight:700;
          font-size:14px;
          padding:12px 22px;
          border-radius:10px;
        "
      >
        ${label}
      </a>
    </div>
  `;
}

function buildBannerHtml(src, alt) {
  return `
    <div style="margin:0 0 22px 0;">
      <img
        src="${src}"
        alt="${alt}"
        style="display:block;width:100%;max-width:100%;height:auto;border-radius:12px;border:0;outline:none;text-decoration:none;"
      />
    </div>
  `;
}

/* =========================
   TEKLİF MAİLİ
========================= */
async function sendOfferMail({ to, companyName, offerLink, linkDays }) {
  const subject = "İSG Panel Teklifiniz Hazır";
  const offerBannerUrl = getPublicAssetUrl(
    "MAIL_BANNER_OFFER_URL",
    "/banner-teklif.png"
  );

  const html = wrapMailTemplate(`
    ${buildBannerHtml(offerBannerUrl, "Kurumsal Teklifiniz Hazır")}

    <p style="margin:0 0 16px 0;">Merhaba <b>${companyName || ""}</b>,</p>

    <p style="margin:0 0 16px 0;">
      İSG Panel için hazırlanan <b>kurumsal teklifiniz hazırdır.</b>
    </p>

    <p style="margin:0 0 10px 0;">
      Teklif detaylarını incelemek ve değerlendirmek için aşağıdaki butona tıklayabilirsiniz.
    </p>

    ${buildButton("📄 Teklifi Görüntüle", offerLink)}

    <p style="margin:0 0 16px 0;">
      Bu teklif bağlantısı <b>${linkDays || "belirlenen süre boyunca"}</b> geçerlidir.
    </p>

    <p style="margin:0 0 16px 0;">
      Bağlantıya tıkladığınızda teklif içeriğinde yer alan kullanıcı sayısı,
      lisans kapsamı ve sistem erişimi ile ilgili tüm detayları görüntüleyebilirsiniz.
    </p>

    <p style="margin:0;">
      Herhangi bir sorunuz olması durumunda bu e-postayı yanıtlayarak bizimle iletişime geçebilirsiniz.
    </p>
  `);

  const text = `
Merhaba ${companyName || ""},

İSG Panel için hazırlanan kurumsal teklifiniz hazırdır.

Teklif detaylarını incelemek ve değerlendirmek için aşağıdaki bağlantıyı kullanabilirsiniz:
${offerLink}

Bu teklif bağlantısı ${linkDays || "belirlenen süre boyunca"} geçerlidir.

Bağlantıya tıkladığınızda teklif içeriğinde yer alan kullanıcı sayısı, lisans kapsamı ve sistem erişimi ile ilgili tüm detayları görüntüleyebilirsiniz.

Herhangi bir sorunuz olması durumunda bu e-postayı yanıtlayarak bizimle iletişime geçebilirsiniz.

İSG Panel
İş Sağlığı ve Güvenliği Yönetim Platformu
www.isgpanel.tr
  `.trim();

  return sendMail({
    to,
    subject,
    html,
    text,
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    attachments: [],
  });
}

/* =========================
   PİLOT MAİLİ
========================= */
async function sendPilotMail({ to, companyName, pilotLink, pilotDays, linkDays }) {
  const subject = "İSG Panel Pilot Hesabınız";
  const pilotBannerUrl = getPublicAssetUrl(
    "MAIL_BANNER_PILOT_URL",
    "/banner-pilot.png"
  );

  const html = wrapMailTemplate(`
    ${buildBannerHtml(pilotBannerUrl, "Pilot Hesabınız Hazır")}

    <p style="margin:0 0 16px 0;">Merhaba <b>${companyName || ""}</b>,</p>

    <p style="margin:0 0 16px 0;">
      İSG Panel için <b>pilot hesabınız oluşturulmuştur.</b>
    </p>

    <p style="margin:0 0 10px 0;">
      Sistemi incelemek ve kullanmaya başlamak için aşağıdaki butona tıklayabilirsiniz.
    </p>

    ${buildButton("🚀 Panele Giriş Yap", pilotLink)}

    <p style="margin:0 0 16px 0;">
      Pilot erişiminiz <b>${pilotDays || "belirlenen"} gün</b> boyunca aktif olacaktır.
    </p>

    <p style="margin:0 0 16px 0;">
      Hesap oluşturma bağlantısı <b>${linkDays || "belirlenen"} gün</b> süreyle geçerlidir.
      Bu süre içerisinde bağlantıyı kullanarak sisteme erişebilirsiniz.
    </p>

    <p style="margin:0 0 16px 0;">
      Pilot süresi boyunca platformun sunduğu özellikleri inceleyebilir ve sistemi deneyimleyebilirsiniz.
    </p>

    <p style="margin:0;">
      Herhangi bir sorunuz olması durumunda bu e-postayı yanıtlayarak bizimle iletişime geçebilirsiniz.
    </p>
  `);

  const text = `
Merhaba ${companyName || ""},

İSG Panel için pilot hesabınız oluşturulmuştur.

Sistemi incelemek ve kullanmaya başlamak için aşağıdaki bağlantıyı kullanabilirsiniz:
${pilotLink}

Pilot erişiminiz ${pilotDays || "belirlenen"} gün boyunca aktif olacaktır.

Hesap oluşturma bağlantısı ${linkDays || "belirlenen"} gün süreyle geçerlidir. Bu süre içerisinde bağlantıyı kullanarak sisteme erişebilirsiniz.

Pilot süresi boyunca platformun sunduğu özellikleri inceleyebilir ve sistemi deneyimleyebilirsiniz.

Herhangi bir sorunuz olması durumunda bu e-postayı yanıtlayarak bizimle iletişime geçebilirsiniz.

İSG Panel
İş Sağlığı ve Güvenliği Yönetim Platformu
www.isgpanel.tr
  `.trim();

  return sendMail({
    to,
    subject,
    html,
    text,
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    attachments: [],
  });
}

/* =========================
   ABONELİK AKTİVASYON MAİLİ
========================= */
async function sendActivationMail({ to, companyName, panelLink }) {
  console.log("🚨 sendActivationMail RUN:", to);
  console.log("🚨 sendActivationMail RUN", { to, companyName, panelLink });

  const subject = "İSG Panel Aboneliğiniz Aktif Edildi";
  const activationBannerUrl = getPublicAssetUrl(
    "MAIL_BANNER_ACTIVATION_URL",
    "/banner-activation.png"
  );

  const html = wrapMailTemplate(`
    ${buildBannerHtml(activationBannerUrl, "Aboneliğiniz Aktif Edildi")}

    <p style="margin:0 0 16px 0;">Merhaba <b>${companyName || ""}</b>,</p>

    <p style="margin:0 0 16px 0;">
      İSG Panel aboneliğiniz <b>başarıyla aktif edilmiştir.</b>
    </p>

    <p style="margin:0 0 16px 0;">
      Artık platformumuzun sunduğu özellikleri kullanmaya başlayabilirsiniz.
    </p>

    <p style="margin:0 0 16px 0;">
      İSG Panel ile iş sağlığı ve güvenliği süreçlerinizi dijital ortamda daha düzenli,
      hızlı ve güvenli şekilde yönetebilirsiniz.
    </p>

    ${panelLink ? buildButton("✅ Panele Giriş Yap", panelLink) : ""}

    <p style="margin:0;">
      Platformumuzu tercih ettiğiniz için teşekkür eder, iyi çalışmalar dileriz.
    </p>
  `);

  const text = `
Merhaba ${companyName || ""},

İSG Panel aboneliğiniz başarıyla aktif edilmiştir.

Artık platformumuzun sunduğu özellikleri kullanmaya başlayabilirsiniz.

İSG Panel ile iş sağlığı ve güvenliği süreçlerinizi dijital ortamda daha düzenli, hızlı ve güvenli şekilde yönetebilirsiniz.

${panelLink ? `Panele giriş için: ${panelLink}` : ""}

Platformumuzu tercih ettiğiniz için teşekkür eder, iyi çalışmalar dileriz.

İSG Panel
İş Sağlığı ve Güvenliği Yönetim Platformu
www.isgpanel.tr
  `.trim();

  return sendMail({
    to,
    subject,
    html,
    text,
    from:
      process.env.SYSTEM_MAIL_FROM ||
      process.env.MAIL_FROM ||
      process.env.SMTP_USER,
    attachments: [],
  });
}

/* =========================
   ABONELİK 3 GÜN KALA HATIRLATMA
========================= */
async function sendRenewalWarningMail({ to, companyName, endDate, panelLink }) {
  const subject = "İSG Panel Aboneliğiniz Sona Ermek Üzere";
  const warningBannerUrl = getPublicAssetUrl(
    "MAIL_BANNER_RENEWAL_WARNING_URL",
    "/banner-renewal-warning.png"
  );

  const html = wrapMailTemplate(`
    ${buildBannerHtml(warningBannerUrl, "Aboneliğiniz Sona Ermek Üzere")}

    <p style="margin:0 0 16px 0;">Merhaba <b>${companyName || ""}</b>,</p>

    <p style="margin:0 0 16px 0;">
      İSG Panel aboneliğinizin bitiş süresine <b>3 gün kalmıştır.</b>
    </p>

    ${
      endDate
        ? `<p style="margin:0 0 16px 0;">
            Mevcut abonelik bitiş tarihiniz: <b>${endDate}</b>
          </p>`
        : ""
    }

    <p style="margin:0 0 16px 0;">
      Platform hizmetlerimizi kesintisiz kullanmaya devam edebilmek için
      abonelik yenileme işleminizi gerçekleştirmenizi öneririz.
    </p>

    ${panelLink ? buildButton("💳 Aboneliği Yenile", panelLink) : ""}

    <p style="margin:0;">
      Herhangi bir sorunuz olması durumunda bu e-postayı yanıtlayarak bizimle iletişime geçebilirsiniz.
    </p>
  `);

  const text = `
Merhaba ${companyName || ""},

İSG Panel aboneliğinizin bitiş süresine 3 gün kalmıştır.
${endDate ? `Mevcut abonelik bitiş tarihiniz: ${endDate}` : ""}

Platform hizmetlerimizi kesintisiz kullanmaya devam edebilmek için abonelik yenileme işleminizi gerçekleştirmenizi öneririz.

${panelLink ? `Yenileme için: ${panelLink}` : ""}

Herhangi bir sorunuz olması durumunda bu e-postayı yanıtlayarak bizimle iletişime geçebilirsiniz.

İSG Panel
İş Sağlığı ve Güvenliği Yönetim Platformu
www.isgpanel.tr
  `.trim();

  return sendMail({
    to,
    subject,
    html,
    text,
    from:
      process.env.SYSTEM_MAIL_FROM ||
      process.env.MAIL_FROM ||
      process.env.SMTP_USER,
    attachments: [],
  });
}

/* =========================
   ABONELİK SÜRESİ DOLDU
========================= */
async function sendRenewalExpiredMail({ to, companyName, panelLink }) {
  const subject = "İSG Panel Abonelik Süreniz Sona Erdi";
  const expiredBannerUrl = getPublicAssetUrl(
    "MAIL_BANNER_RENEWAL_EXPIRED_URL",
    "/banner-renewal-expired.png"
  );

  const html = wrapMailTemplate(`
    ${buildBannerHtml(expiredBannerUrl, "Abonelik Süreniz Sona Erdi")}

    <p style="margin:0 0 16px 0;">Merhaba <b>${companyName || ""}</b>,</p>

    <p style="margin:0 0 16px 0;">
      İSG Panel abonelik süreniz <b>sona ermiştir.</b>
    </p>

    <p style="margin:0 0 16px 0;">
      Platform hizmetlerinden tekrar faydalanabilmek için aboneliğinizi yenileyebilirsiniz.
    </p>

    ${panelLink ? buildButton("🔄 Aboneliği Yenile", panelLink) : ""}

    <p style="margin:0;">
      İSG Panel’i tercih ettiğiniz için teşekkür ederiz.
    </p>
  `);

  const text = `
Merhaba ${companyName || ""},

İSG Panel abonelik süreniz sona ermiştir.

Platform hizmetlerinden tekrar faydalanabilmek için aboneliğinizi yenileyebilirsiniz.

${panelLink ? `Yenileme için: ${panelLink}` : ""}

İSG Panel’i tercih ettiğiniz için teşekkür ederiz.

İSG Panel
İş Sağlığı ve Güvenliği Yönetim Platformu
www.isgpanel.tr
  `.trim();

  return sendMail({
    to,
    subject,
    html,
    text,
    from:
      process.env.SYSTEM_MAIL_FROM ||
      process.env.MAIL_FROM ||
      process.env.SMTP_USER,
    attachments: [],
  });
}

/* =========================
   KULLANICI HESAP / ŞİFRE BİLGİ MAİLİ
========================= */
async function sendUserPasswordMail({
  to,
  fullName,
  companyName,
  password,
  panelLink,
  mode = "created",
}) {
  const subject =
    mode === "renewed"
      ? "İSG Panel Kullanıcı Giriş Bilgileriniz Güncellendi"
      : "İSG Panel Kullanıcı Hesabınız Oluşturuldu";

  const userBannerUrl = getPublicAssetUrl(
    "MAIL_BANNER_USER_PASSWORD_URL",
    "/banner-user-password.png"
  );

  const actionText =
    mode === "renewed"
      ? "mevcut kullanıcı hesabınızın giriş bilgileri güncellenmiştir"
      : "sizin için bir kullanıcı hesabı oluşturulmuştur";

  const html = wrapMailTemplate(`
    ${buildBannerHtml(userBannerUrl, "Kullanıcı Hesap Bilgileriniz")}

    <p style="margin:0 0 16px 0;">Merhaba <b>${fullName || companyName || ""}</b>,</p>

    <p style="margin:0 0 16px 0;">
      İSG Panel yönetimi tarafından <b>${actionText}</b>.
    </p>

    <p style="margin:0 0 16px 0;">
      Platforma erişim sağlayabilmek için aşağıdaki bilgiler ile sisteme giriş yapabilirsiniz.
    </p>

    <div style="margin:0 0 16px 0;padding:14px 16px;border:1px solid #dbe4ee;border-radius:12px;background:#f8fbff;">
      ${
        companyName
          ? `<div style="margin-bottom:6px;"><b>Kurum:</b> ${companyName}</div>`
          : ""
      }
      <div style="margin-bottom:6px;"><b>E-posta:</b> ${to}</div>
      <div><b>Geçici Şifre:</b> ${password || "-"}</div>
    </div>

    <p style="margin:0 0 16px 0;">
      Güvenliğiniz için ilk girişinizden sonra şifrenizi değiştirmenizi öneririz.
    </p>

    ${panelLink ? buildButton("🔐 Panele Giriş Yap", panelLink) : ""}

    <p style="margin:0;">
      Herhangi bir sorunuz olması durumunda bu e-postayı yanıtlayarak bizimle iletişime geçebilirsiniz.
    </p>
  `);

  const text = `
Merhaba ${fullName || companyName || ""},

İSG Panel yönetimi tarafından ${actionText}.

Platforma erişim sağlayabilmek için aşağıdaki bilgiler ile sisteme giriş yapabilirsiniz.

${companyName ? `Kurum: ${companyName}` : ""}
E-posta: ${to}
Geçici Şifre: ${password || "-"}

Güvenliğiniz için ilk girişinizden sonra şifrenizi değiştirmenizi öneririz.

${panelLink ? `Panele giriş için: ${panelLink}` : ""}

Herhangi bir sorunuz olması durumunda bu e-postayı yanıtlayarak bizimle iletişime geçebilirsiniz.

İSG Panel
İş Sağlığı ve Güvenliği Yönetim Platformu
www.isgpanel.tr
  `.trim();

  return sendMail({
    to,
    subject,
    html,
    text,
    from:
      process.env.SYSTEM_MAIL_FROM ||
      process.env.MAIL_FROM ||
      process.env.SMTP_USER,
    attachments: [],
  });
}

module.exports = {
  sendMail,
  sendOfferMail,
  sendPilotMail,
  sendActivationMail,
  sendRenewalWarningMail,
  sendRenewalExpiredMail,
  sendUserPasswordMail,
};