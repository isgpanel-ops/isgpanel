// backend/routes/auth.js
// ✅ Mevcut kodu koruyarak: DEMO saatli sayaç + ME alanları + LOGIN demo bitiş blokesi + demo/register fix (tek create)
// ✅ FIX: sayaç 30 güne düşmesin diye pilot/teklif org.subscriptionStartAt + subscriptionEnd saatli set
// ✅ FIX: ticari sabit paketlerde userLimit asla body/offer ile ezilmez (sadece prof-ozel esnek)

const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const User = require("../models/User");
const Organization = require("../models/Organization");
const PLANS = require("../plans");
const { sendMail } = require("../utils/mailer");

// ✅ pgPool'u dışarıdan alacağız
module.exports = function authRoutes(pgPool) {
  const router = express.Router();

  // ✅ Offer/Pilot süresi oku (Postgres offers tablosu kolonları farklı olabilir)
  async function readOfferDurationDays(pgPool, token) {
    if (!pgPool || !token) return 0;

    try {
      const colsRes = await pgPool.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'offers'`
      );
      const cols = colsRes.rows.map((r) => r.column_name);
      const pick = (...names) => names.find((n) => cols.includes(n));

      const durationCol = pick(
        "duration_days",
        "durationDays",
        "duration_day",
        "trial_days",
        "days",
        "duration"
      );
      if (!durationCol) return 0;

      const r = await pgPool.query(
        `SELECT ${durationCol} AS days FROM offers WHERE token = $1 LIMIT 1`,
        [token]
      );

      const n = Number(r.rows?.[0]?.days || 0);
      return Number.isFinite(n) && n > 0 ? n : 0;
    } catch (e) {
      console.error("readOfferDurationDays error:", e);
      return 0;
    }
  }

 async function authRequired(req, res, next) {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization || "";
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

    // Ek uyumluluk: bazı eski frontendler token'ı farklı header/local yapıdan gönderebiliyor
    const fallbackToken =
      req.headers["x-auth-token"] ||
      req.headers["token"] ||
      req.query?.token ||
      "";

    const token = bearerToken || fallbackToken;

    if (!token) {
      return res.status(401).json({
        message: "Token yok",
        code: "TOKEN_MISSING",
      });
    }

    const SECRET = process.env.JWT_SECRET || "SUPER_SECRET_KEY";
    const decoded = jwt.verify(token, SECRET);

    const liveUser = await User.findById(decoded.id)
      .select("demo demoEndAt subscriptionEnd status blockReason organization role email planCode")
      .lean();

    if (!liveUser) {
      return res.status(401).json({
        message: "Kullanıcı bulunamadı",
        code: "USER_NOT_FOUND",
      });
    }

    const isDemoLive = liveUser.demo === true;

    req.user = {
      ...decoded,
      id: String(liveUser._id || decoded.id),
      role: liveUser.role || decoded.role,
      email: liveUser.email || decoded.email,
      planCode: liveUser.planCode || decoded.planCode,
      organizationId: liveUser.organization || decoded.organizationId || null,
      isDemo: isDemoLive,
      demo: isDemoLive,
      status: liveUser.status || "aktif",
      blockReason: liveUser.blockReason || "",
    };

    next();
  } catch (e) {
    console.error("authRequired error:", e?.message || e);
    return res.status(401).json({
      message: "Geçersiz token",
      code: "TOKEN_INVALID",
    });
  }
}

  /**
   * ✅ ME
   * GET /api/auth/me
   */
  router.get("/me", authRequired, async (req, res) => {
    try {
      const user = await User.findById(req.user.id).select(
        "name email role organization planCode subscriptionStartAt subscriptionEnd demo demoStartAt demoEndAt status blockReason"
      );
      if (!user) return res.status(404).json({ message: "Kullanıcı bulunamadı" });

      const uid = String(user._id);

      // ✅ organization uuid/name çek (frontend teklif eşleşmesi için)
      let orgUuid = null;
      let orgName = null;

      if (user.organization) {
        const org = await Organization.findById(user.organization)
          .select("uuid name")
          .lean();
        orgUuid = org?.uuid || null;
        orgName = org?.name || null;
      }

      const payload = {
        id: uid,
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: user.organization || null,
        organizationUuid: orgUuid,
        organizationName: orgName,
        planCode: user.planCode,

        subscriptionStartAt: user.subscriptionStartAt || null,
        subscriptionEnd: user.subscriptionEnd || null,

        demo: user.demo === true,
        demoStartAt: user.demoStartAt || null,
        demoEndAt: user.demoEndAt || null,

        status: user.status || "aktif",
        blockReason: user.blockReason || "",
      };

      return res.json({
        ok: true,

        user: {
          ...payload,
          _id: uid,
          id: uid,
          isDemo: payload.demo,
        },

        ...payload,
        _id: uid,
        isDemo: payload.demo,
      });
    } catch (err) {
      console.error("ME HATA:", err);
      return res.status(500).json({ error: "Sunucu hatası" });
    }
  });

  /**
   * REGISTER
   */
  router.post("/register", async (req, res) => {
    try {
      const {
        name,
        email,
        password,
        planCode: rawPlanCode,
        companyName,
        offerToken,
        pilotToken,
      } = req.body;

      const safeEmail = String(email || "").trim().toLowerCase();
      const existing = await User.findOne({ email: safeEmail }).populate("organization");

      if (existing) {
        const now = new Date();
        const demoEnd = existing.demoEndAt || existing.subscriptionEnd;
        const demoEndDate = demoEnd ? new Date(demoEnd) : null;
        const demoExpired =
          existing.demo === true &&
          demoEndDate &&
          !Number.isNaN(demoEndDate.getTime()) &&
          now.getTime() > demoEndDate.getTime();

        const hasActiveSub =
          existing.subscriptionEnd && new Date(existing.subscriptionEnd).getTime() > now.getTime();

        const orgStatus =
          existing.organization?.status ||
          (existing.organization ? "pending-payment" : "");

        const isPendingPaymentUser =
          existing.demo !== true &&
          !hasActiveSub &&
          existing.role !== "bireysel" &&
          (!existing.subscriptionEnd || orgStatus === "pending-payment");

        if (demoExpired && !hasActiveSub) {
          existing.name = name || existing.name;
          existing.password = await bcrypt.hash(password, 10);
          existing.demo = false;
          existing.demoStartAt = null;
          existing.demoEndAt = null;
        } else if (isPendingPaymentUser) {
          return res.status(200).json({
            ok: true,
            pendingPayment: true,
            redirectToPayment: true,
            message: "Kayıt oluşturulmuş ancak ödeme tamamlanmamış. Ödeme adımına yönlendiriliyorsunuz.",
            user: {
              id: existing._id,
              name: existing.name,
              email: existing.email,
              role: existing.role,
              planCode: existing.planCode || rawPlanCode || null,
            },
            organization: existing.organization
              ? {
                  id: existing.organization._id,
                  uuid: existing.organization.uuid,
                  name: existing.organization.name,
                  planCode: existing.organization.planCode || existing.planCode || rawPlanCode || null,
                  userLimit: existing.organization.userLimit || null,
                  status: existing.organization.status || "pending-payment",
                  subscriptionStartAt: existing.organization.subscriptionStartAt || null,
                  subscriptionEnd: existing.organization.subscriptionEnd || null,
                }
              : null,
          });
        } else {
          return res.status(400).json({ message: "Bu email zaten kayıtlı." });
        }
      }

      const normalizePlanCode = (v) => {
        const s = String(v || "").trim().toLowerCase();

        if (s === "bireysel" || s === "bireysel-standart") return "bireysel_standart";
        if (s === "ticari-1-3") return "ticari_1_3";
        if (s === "ticari-4-5") return "ticari_4_5";
        if (s === "ticari-6-10") return "ticari_6_10";
        if (s === "prof-ozel" || s === "prof_ozel" || s === "kurumsal_ozel" || s === "kurumsal-ozel")
          return "prof-ozel";

        if (PLANS[s]) return s;

        return s;
      };

      const planCode = normalizePlanCode(rawPlanCode || "bireysel_standart");
      const plan = PLANS[planCode];

      if (!plan) {
        console.log("INVALID PLAN:", { rawPlanCode, normalized: planCode });
        return res.status(400).json({ message: "Geçersiz plan kodu." });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const orgName = planCode === "bireysel_standart" ? `${name} (Bireysel)` : companyName || name;

      let userLimit = plan.maxUsers;

      if (planCode === "ticari_1_3") userLimit = 3;
      else if (planCode === "ticari_4_5") userLimit = 5;
      else if (planCode === "ticari_6_10") userLimit = 10;

      if (planCode === "prof-ozel") {
        const bodyUsers = Number(req.body?.offerUsersCount || 0);
        if (bodyUsers > 0) userLimit = bodyUsers;

        if (offerToken && pgPool) {
          try {
            const r = await pgPool.query(
              "SELECT users_count FROM offers WHERE token = $1 LIMIT 1",
              [offerToken]
            );
            const offerUsers = Number(r.rows?.[0]?.users_count || 0);
            if (offerUsers > 0) userLimit = offerUsers;
          } catch (e) {
            console.error("OFFER USERS_COUNT READ ERROR:", e);
          }
        }
      }

      const bindToken = offerToken || pilotToken;

      if (bindToken && pgPool) {
        try {
          const mailRes = await pgPool.query(
            `
            SELECT
              COALESCE(to_email, email) AS locked_email
            FROM offers
            WHERE token = $1
            LIMIT 1
            `,
            [bindToken]
          );

          const lockedEmail = String(mailRes.rows?.[0]?.locked_email || "")
            .trim()
            .toLowerCase();

          if (lockedEmail && lockedEmail !== safeEmail) {
            return res.status(403).json({
              message: "Bu kayıt linki sadece belirlenen e-posta adresi için kullanılabilir.",
            });
          }
        } catch (e) {
          console.error("OFFER/PILOT EMAIL LOCK ERROR:", e);
          return res.status(500).json({ message: "Teklif/pilot mail kontrolü yapılamadı." });
        }
      }

      let durationDays = Number(
        req.body?.offerDurationDays || req.body?.durationDays || req.body?.days || 0
      );

      if (pilotToken && pgPool) {
        const dbDays = await readOfferDurationDays(pgPool, pilotToken);
        if (dbDays > 0) durationDays = dbDays;
      }

      const nowForSub = new Date();

      const isPilotRegister = Boolean(pilotToken);
      const resolvedDurationDays = Number(durationDays || 0) > 0 ? Number(durationDays) : 15;

      const subStartAt = isPilotRegister ? nowForSub : null;
      const subEndAt = isPilotRegister
        ? new Date(nowForSub.getTime() + resolvedDurationDays * 24 * 60 * 60 * 1000)
        : null;

      const organization = await Organization.create({
        uuid: uuidv4(),
        name: orgName,
        planCode,
        userLimit,
        status: isPilotRegister ? "active" : "pending-payment",
        subscriptionStartAt: subStartAt,
        subscriptionEnd: subEndAt,
      });

      if (bindToken && pgPool) {
        try {
          await pgPool.query(
            `
            UPDATE offers
            SET accepted_org_id = $1,
                accepted_at = NOW()
            WHERE token = $2
            `,
            [organization.uuid, bindToken]
          );
        } catch (e) {
          console.error("OFFER/PILOT ACCEPT ERROR:", e);
        }
      }

      if (existing) {
        existing.email = safeEmail;
        existing.role = planCode === "bireysel_standart" ? "bireysel" : "ticari_admin";
        existing.organization = organization._id;
        existing.planCode = planCode;

        existing.demo = false;
        existing.demoStartAt = null;
        existing.demoEndAt = null;

        existing.subscriptionStartAt = subStartAt;
        existing.subscriptionEnd = subEndAt;
        existing.status = "aktif";
        existing.blockReason = "";

        await existing.save();

        return res.json({
          message: "Kayıt başarılı (demo hesabı normal hesaba dönüştürüldü)",
          user: {
            id: existing._id,
            name: existing.name,
            email: existing.email,
            role: existing.role,
            planCode: existing.planCode,
          },
          organization: {
            id: organization._id,
            uuid: organization.uuid,
            name: organization.name,
            planCode: organization.planCode,
            userLimit: organization.userLimit,
            status: organization.status,
            subscriptionStartAt: organization.subscriptionStartAt || null,
            subscriptionEnd: organization.subscriptionEnd,
          },
        });
      }

      const role = planCode === "bireysel_standart" ? "bireysel" : "ticari_admin";

      const user = await User.create({
        name,
        email: safeEmail,
        password: hashedPassword,
        role,
        organization: organization._id,
        planCode,
        demo: false,
        demoStartAt: null,
        demoEndAt: null,
        subscriptionStartAt: subStartAt,
        subscriptionEnd: subEndAt,
      });

      return res.json({
        message: "Kayıt başarılı",
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          planCode: user.planCode,
        },
        organization: {
          id: organization._id,
          uuid: organization.uuid,
          name: organization.name,
          planCode: organization.planCode,
          userLimit: organization.userLimit,
          status: organization.status,
          subscriptionStartAt: organization.subscriptionStartAt || null,
          subscriptionEnd: organization.subscriptionEnd,
        },
      });
    } catch (err) {
      console.error("REGISTER HATA:", err);
      return res.status(500).json({ error: "Sunucu hatası" });
    }
  });

  /**
   * LOGIN
   */
  router.post("/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      const safeEmail = String(email || "").trim().toLowerCase();
      const user = await User.findOne({ email: safeEmail }).populate("organization");
      if (!user) return res.status(400).json({ message: "Kullanıcı bulunamadı" });

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return res.status(400).json({ message: "Şifre hatalı" });

      if (user.status && user.status !== "aktif") {
        return res.status(403).json({
          message: "Hesabınız girişe kapalı. Destek ile iletişime geçiniz.",
        });
      }

      const now = new Date();
      if (user.demo === true) {
        const demoEnd = user.demoEndAt || user.subscriptionEnd;
        const demoEndDate = demoEnd ? new Date(demoEnd) : null;
        const demoExpired =
          demoEndDate &&
          !Number.isNaN(demoEndDate.getTime()) &&
          now.getTime() > demoEndDate.getTime();

        const hasActiveSub =
          user.subscriptionEnd && new Date(user.subscriptionEnd).getTime() > now.getTime();

        if (demoExpired && !hasActiveSub) {
          return res.status(403).json({
            code: "DEMO_EXPIRED",
            message: "Demo süreniz sona erdi. Normal kayıt/abonelik alarak devam edebilirsiniz.",
          });
        }
      }

      const SECRET = process.env.JWT_SECRET || "SUPER_SECRET_KEY";

      await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: now } });

      const orgId = user.organization?._id || user.organization || null;

      const userEnd = user.subscriptionEnd
        ? new Date(user.subscriptionEnd)
        : null;

      const orgEnd = user.organization?.subscriptionEnd
        ? new Date(user.organization.subscriptionEnd)
        : null;

      const hasActiveSub =
        (userEnd && userEnd.getTime() > now.getTime()) ||
        (orgEnd && orgEnd.getTime() > now.getTime());

      const isDemoUser = user.demo === true;

      const isPendingPayment =
        !isDemoUser &&
        user.role !== "bireysel" &&
        !hasActiveSub &&
        !user.organization?.subscriptionEnd &&
        user.organization?.status === "pending-payment";

      const token = jwt.sign(
        {
          id: user._id,
          role: user.role,
          email: user.email,
          isDemo: isDemoUser,
          organizationId: orgId,
          planCode: user.planCode,
          status: user.status || "aktif",
          subscriptionLocked: isPendingPayment,
          paymentPending: isPendingPayment,
        },
        SECRET,
        { expiresIn: "7d" }
      );

      return res.json({
  ok: true,
  token,
  tokenType: "Bearer",
  user: {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    organization: user.organization,
    organizationId: orgId,
    planCode: user.planCode,
    subscriptionStartAt: user.subscriptionStartAt || null,
    subscriptionEnd: user.subscriptionEnd || null,
    demo: user.demo === true,
    demoStartAt: user.demoStartAt || null,
    demoEndAt: user.demoEndAt || null,
    status: user.status || "aktif",
    blockReason: user.blockReason || "",
    subscriptionLocked: isPendingPayment,
    paymentPending: isPendingPayment,
  },
});
    } catch (err) {
      console.error("LOGIN HATA:", err);
      return res.status(500).json({ error: "Sunucu hatası" });
    }
  });

  /**
   * ✅ FORGOT PASSWORD (PUBLIC)
   * POST /api/auth/forgot-password
   */
  router.post("/forgot-password", async (req, res) => {
    try {
      const email = String(req.body?.email || "").trim().toLowerCase();

      if (!email) {
        return res.status(400).json({ message: "E-posta zorunlu." });
      }

      const user = await User.findOne({ email });
      if (!user) {
        return res.json({
          ok: true,
          message: "Eğer bu e-posta sistemde kayıtlıysa şifre sıfırlama bağlantısı gönderilecektir.",
        });
      }

      const resetToken = crypto.randomBytes(32).toString("hex");
      const resetExpires = new Date(Date.now() + 1000 * 60 * 30);

      user.resetPasswordToken = resetToken;
      user.resetPasswordExpires = resetExpires;
      await user.save();

      const publicBase =
        process.env.PUBLIC_BASE_URL ||
        process.env.APP_BASE_URL ||
        process.env.FRONTEND_URL ||
        "http://localhost:5173";

      const cleanPublicBase = String(publicBase).replace(/\/+$/, "");
      const resetLink = `${cleanPublicBase}/reset-password/${resetToken}`;
      const safeName = String(user.name || "Değerli Kullanıcımız");

      const html = `
<div style="margin:0;padding:0;background:#f3f6fb;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f6fb;padding:24px 0;">
<tr>
<td align="center">

<table width="700" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:18px;font-family:Arial,Helvetica,sans-serif;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.08);">

<tr>
<td style="padding:20px 28px;">
<table width="100%">
<tr>

<td align="left">
<img src="${process.env.MAIL_LOGO_URL || 'https://app.isgpanel.tr/isgpanel-logo.png'}" style="height:52px;">
</td>

<td align="right" style="font-size:13px;color:#64748b;font-weight:500;white-space:nowrap;">

<a href="https://instagram.com/isgpanel" style="color:#64748b;text-decoration:none;margin-left:14px;">Instagram</a>

<a href="https://www.isgpanel.tr" style="color:#64748b;text-decoration:none;margin-left:14px;">www.isgpanel.tr</a>

<a href="mailto:info@isgpanel.tr" style="color:#2563eb;text-decoration:none;margin-left:14px;">info@isgpanel.tr</a>

</td>

</tr>
</table>
</td>
</tr>

<tr>
<td style="padding:0 28px 10px 28px;">
<img src="${process.env.MAIL_BANNER_PASSWORD || 'https://app.isgpanel.tr/banner-password.png'}" style="width:100%;border-radius:14px;">
</td>
</tr>

<tr>
<td style="padding:8px 32px;color:#0f172a;font-size:16px;line-height:1.7;">

<p>Merhaba <strong>${safeName}</strong>,</p>

<p>
İSG Panel hesabınıza ait şifre sıfırlama talebi aldık.
Şifrenizi güvenli bir şekilde yenilemek için aşağıdaki butona tıklayabilirsiniz.
</p>

<p style="text-align:center;margin:30px 0;">
<a href="${resetLink}" style="background:#0a2b45;color:#ffffff;text-decoration:none;padding:14px 30px;border-radius:12px;font-weight:700;">
Şifreyi Sıfırla
</a>
</p>

<p>
Bu bağlantı yalnızca <strong>30 dakika</strong> boyunca geçerlidir.
</p>

<p>
Eğer bu işlemi siz yapmadıysanız bu e-postayı dikkate almayabilirsiniz.
</p>

</td>
</tr>

<tr>
<td style="padding:0 32px 28px 32px;border-top:1px solid #e2e8f0;text-align:center;color:#64748b;font-size:13px;">

<div style="margin-top:18px;">

<div style="font-weight:700;color:#0f172a;">İSG Panel</div>

<div>İş Sağlığı ve Güvenliği Yönetim Platformu</div>

<br>

© 2026 İSG Panel. Tüm hakları saklıdır.<br>
Bu e-posta İSG Panel sistemi tarafından otomatik olarak gönderilmiştir.

</div>

</td>
</tr>

</table>

</td>
</tr>
</table>
</div>
`;
      const text = `
Merhaba ${safeName},

İSG Panel hesabınız için şifre sıfırlama talebi aldık.

Şifrenizi sıfırlamak için aşağıdaki bağlantıyı kullanın:
${resetLink}

Bu bağlantı 30 dakika geçerlidir.

Eğer bu işlemi siz yapmadıysanız bu e-postayı dikkate almayabilirsiniz.

İSG Panel
İş Sağlığı ve Güvenliği Yönetim Platformu
www.isgpanel.tr
`.trim();

      
      try {
        const mailInfo = await sendMail({
          to: user.email,
          subject: "İSG Panel Şifre Sıfırlama",
          html,
          text,
          from: process.env.SYSTEM_MAIL_FROM || process.env.MAIL_FROM || process.env.SMTP_USER,

          attachments: [],
        });

        console.log("MAIL SENT OK:", mailInfo);

        return res.json({
          ok: true,
          message: "Şifre sıfırlama maili gönderildi.",
        });

      } catch (mailErr) {
        console.error("MAIL ERROR:", {
          message: mailErr?.message,
          code: mailErr?.code,
          command: mailErr?.command,
          response: mailErr?.response,
        });

        return res.status(500).json({
          ok: false,
          message: "Mail gönderilemedi",
          error: mailErr?.message,
          code: mailErr?.code,
        });
      }

    } catch (err) {
      console.error("FORGOT PASSWORD HATA:", err);
      return res.status(500).json({ message: "Şifre sıfırlama işlemi başlatılamadı." });
    }
  });

  /**
   * ✅ RESET PASSWORD (PUBLIC)
   * POST /api/auth/reset-password
   */
  router.post("/reset-password", async (req, res) => {
    try {
      const token = String(req.body?.token || "").trim();
      const password = String(req.body?.password || "");

      if (!token || !password) {
        return res.status(400).json({ message: "Token ve yeni şifre zorunlu." });
      }

      const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;
      if (!PASSWORD_REGEX.test(password)) {
        return res.status(400).json({
          message:
            "Şifre en az 8 karakter, 1 büyük harf, 1 küçük harf ve 1 özel karakter içermelidir.",
        });
      }

      const user = await User.findOne({
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: new Date() },
      });

      if (!user) {
        return res.status(400).json({ message: "Şifre sıfırlama bağlantısı geçersiz veya süresi dolmuş." });
      }

      user.password = await bcrypt.hash(password, 10);
      user.resetPasswordToken = "";
      user.resetPasswordExpires = null;
      await user.save();

      return res.json({
        ok: true,
        message: "Şifreniz başarıyla güncellendi.",
      });
    } catch (err) {
      console.error("RESET PASSWORD HATA:", err);
      return res.status(500).json({ message: "Şifre güncellenemedi." });
    }
  });

  /**
   * ✅ DEMO REGISTER (tek create, saatli sayaç)
   * POST /api/auth/demo/register
   */
  router.post("/demo/register", async (req, res) => {
    try {
      const { name, email, password } = req.body || {};

      const formatName = (value) =>
        String(value || "")
          .toLowerCase()
          .replace(/(^|\s)\S/g, (char) => char.toUpperCase())
          .trim();

      const safeName = formatName(name);

      if (!safeName || !email || !password) {
        return res.status(400).json({ message: "Ad soyad, e-posta ve şifre zorunlu." });
      }

      const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;
      if (!PASSWORD_REGEX.test(password)) {
        return res.status(400).json({
          message:
            "Şifre en az 8 karakter, 1 büyük harf, 1 küçük harf ve 1 özel karakter içermelidir.",
        });
      }

      const safeEmail = String(email).trim().toLowerCase();

      const existing = await User.findOne({ email: safeEmail });
      if (existing) {
        return res.status(400).json({ message: "Bu email zaten kayıtlı." });
      }

      const SECRET = process.env.JWT_SECRET || "SUPER_SECRET_KEY";

      const now = new Date();
      const trialEnd = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

      const hashedPassword = await bcrypt.hash(password, 10);

      // ✅ Demo kullanıcı için de gerçek organization oluştur
      const demoOrg = await Organization.create({
        uuid: uuidv4(),
        name: `${safeName} Demo`,
        planCode: "bireysel",
        userLimit: 1,
        status: "active",
        subscriptionStartAt: now,
        subscriptionEnd: trialEnd,
      });

      const user = await User.create({
        name: safeName,
        email: safeEmail,
        password: hashedPassword,
        role: "bireysel",
        organization: demoOrg._id,

        planCode: "bireysel",

        demo: true,
        demoStartAt: now,
        demoEndAt: trialEnd,

        subscriptionStartAt: null,
        subscriptionEnd: trialEnd,

        status: "aktif",
        blockReason: "",
      });

      const token = jwt.sign(
        {
          id: user._id,
          role: user.role,
          email: user.email,
          isDemo: user.demo === true,
          organizationId: demoOrg._id,
          planCode: user.planCode,
          status: user.status || "aktif",
        },
        SECRET,
        { expiresIn: "7d" }
      );

      return res.json({
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          organization: demoOrg._id,
          planCode: user.planCode,
          demo: true,
          demoStartAt: user.demoStartAt,
          demoEndAt: user.demoEndAt,
        },
      });
    } catch (err) {
      console.error("DEMO REGISTER ERROR:", err);
      return res.status(500).json({ message: "Demo oluşturulamadı" });
    }
  });

  return router;
};