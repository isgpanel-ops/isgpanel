const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const { sendPilotMail } = require("../services/mailService");

module.exports = (pgPool) => {
  function buildPilotLink({
    token,
    usersCount,
    companyName,
    contactName,
    email,
    pilotDays,
    pilotEndDate,
  }) {
    const APP_URL =
      process.env.APP_URL ||
      process.env.PUBLIC_APP_URL ||
      process.env.FRONTEND_URL ||
      process.env.PUBLIC_BASE_URL ||
      "http://localhost:5173";

    const userCountNum = Number(usersCount || 0);

    const plan =
      userCountNum <= 3
        ? "ticari-1-3"
        : userCountNum <= 5
        ? "ticari-4-5"
        : userCountNum <= 10
        ? "ticari-6-10"
        : "prof-ozel";

    const params = new URLSearchParams();
    params.set("pilotToken", token || "");
    params.set("pilot", "1");
    params.set("plan", plan);
    params.set("users", String(userCountNum));

    if (companyName) params.set("companyName", companyName);
    if (contactName) params.set("contactName", contactName);
    if (email) params.set("email", email);
    if (pilotDays != null && pilotDays !== "") {
      params.set("pilotDays", String(Number(pilotDays || 30)));
    }
    if (pilotEndDate) {
      params.set("pilotEndDate", String(pilotEndDate));
    }

    return `${APP_URL}/register/kurumsal?${params.toString()}`;
  }

  function genTempPassword() {
    return (
      Math.random().toString(36).slice(-6) +
      "A!" +
      Math.random().toString(36).slice(-2)
    );
  }

  function calcLinkDays(linkExpiresAt, fallbackDays = 5) {
    if (!linkExpiresAt) return Number(fallbackDays || 5);

    const exp = new Date(linkExpiresAt);
    if (Number.isNaN(exp.getTime())) return Number(fallbackDays || 5);

    return Math.max(
      1,
      Math.ceil((exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    );
  }

  router.post("/create", authMiddleware, async (req, res) => {
    try {
      const {
        companyName,
        contactName,
        email,
        usersCount,
        pilotDays,
        pilotEndDate,
        linkExpiresAt,
        token,
      } = req.body || {};

      const insertResult = await pgPool.query(
        `
        INSERT INTO offers (
          company_name,
          contact_name,
          email,
          users_count,
          offer_type,
          duration_days,
          token,
          link_expires_at,
          created_at
        )
        VALUES ($1,$2,$3,$4,'pilot',$5,$6,$7,NOW())
        RETURNING id
        `,
        [
          companyName || null,
          contactName || null,
          email || null,
          Number(usersCount || 0),
          Number(pilotDays || 30),
          token,
          linkExpiresAt || null,
        ]
      );

      const pilotId = insertResult.rows?.[0]?.id || null;

      const pilotLink = buildPilotLink({
        token,
        usersCount,
        companyName,
        contactName,
        email,
        pilotDays,
        pilotEndDate,
      });

      const tempPassword = genTempPassword();

      if (email) {
        const linkDays = calcLinkDays(linkExpiresAt, 5);

        await sendPilotMail({
          to: email,
          companyName: companyName || contactName || "",
          pilotLink,
          pilotDays: Number(pilotDays || 30),
          linkDays,
          password: tempPassword,
        });
      }

      res.json({
        ok: true,
        pilotId,
        token,
        pilotLink,
        tempPassword,
      });
    } catch (e) {
      console.error("pilot create error:", e);
      res.status(500).json({ message: "Pilot oluşturulamadı" });
    }
  });

  router.post("/send-mail", authMiddleware, async (req, res) => {
    try {
      const {
        companyName,
        contactName,
        email,
        usersCount,
        pilotDays,
        pilotEndDate,
        token,
        linkExpiresAt,
      } = req.body || {};

      if (!email) {
        return res.status(400).json({ message: "E-posta zorunlu" });
      }

      if (!token) {
        return res.status(400).json({ message: "Pilot token zorunlu" });
      }

      const pilotLink = buildPilotLink({
        token,
        usersCount,
        companyName,
        contactName,
        email,
        pilotDays,
        pilotEndDate,
      });

      const tempPassword = genTempPassword();
      const linkDays = calcLinkDays(linkExpiresAt, 5);

      await sendPilotMail({
        to: email,
        companyName: companyName || contactName || "",
        pilotLink,
        pilotDays: Number(pilotDays || 30),
        linkDays,
        password: tempPassword,
      });

      res.json({
        ok: true,
        token,
        pilotLink,
        tempPassword,
      });
    } catch (e) {
      console.error("pilot send-mail error:", e);
      res.status(500).json({ message: "Pilot maili gönderilemedi" });
    }
  });

  return router;
};