// filename: backend/routes/teklifInbox.js
const express = require("express");
const crypto = require("crypto");
const { sendOfferMail, sendPilotMail } = require("../utils/mailer");
const Notification = require("../models/Notification");
const User = require("../models/User");
const mongoose = require("mongoose");

module.exports = function teklifInboxRoutes(pgPool) {
  const router = express.Router();

  function requireAuth(req, res, next) {
    if (!req.user) return res.status(401).json({ ok: false, message: "Unauthorized" });
    return next();
  }

  let _offersHasAcceptedAtCache = null;
  async function offersHasAcceptedAtColumn() {
    if (_offersHasAcceptedAtCache !== null) return _offersHasAcceptedAtCache;
    try {
      const rr = await pgPool.query(`
        select 1
        from information_schema.columns
        where table_schema='public'
          and table_name='offers'
          and column_name='accepted_at'
        limit 1
      `);
      _offersHasAcceptedAtCache = rr.rowCount > 0;
      return _offersHasAcceptedAtCache;
    } catch (e) {
      _offersHasAcceptedAtCache = false;
      return false;
    }
  }

  function getSubscriptionLinkForUser(u) {
    const role = String(u?.role || "").toLowerCase();
    if (role === "ticari_admin") return "/ticari/admin/abonelik";
    return "/panel/paket-abonelik";
  }

  async function notifyPanelSender({ title, message, link = "", key }, req) {
    const userIdRaw = req.user?._id || req.user?.id || req.userId || null;

    const userId =
      userIdRaw && mongoose.Types.ObjectId.isValid(String(userIdRaw))
        ? new mongoose.Types.ObjectId(String(userIdRaw))
        : null;

    if (!userId) {
      console.warn("notifyPanelSender: userId bulunamadı", { userIdRaw });
      return;
    }

    const safeKey = (key || `panel_notice_${Date.now()}`).toString();

    await Notification.findOneAndUpdate(
      { userId, key: safeKey },
      {
        $setOnInsert: {
          userId,
          key: safeKey,
          createdAt: new Date(),
        },
        $set: {
          type: "event",
          module: "genel",
          title,
          message,
          severity: "info",
          status: "unread",
          link,
          updatedAt: new Date(),
        },
      },
      { upsert: true, returnDocument: "after" }
    );
  }

  function parsePanelSubject(subjectRaw) {
    const subject = (subjectRaw || "").toString().trim();
    const mCount = subject.match(/\((\d+)\s*/);
    const usersCount = mCount ? Number(mCount[1]) : null;

    let companyName = "";
    if (subject.includes(" - ")) {
      companyName = subject.split(" - ").slice(1).join(" - ").trim();
    } else {
      companyName = subject;
    }
    companyName = companyName.replace(/\s*\(.*?\)\s*$/, "").trim();

    return { companyName: companyName || "", usersCount };
  }

  router.get("/inbox", async (req, res) => {
    try {
      const status = (req.query.status || "new").toString();
      const search = (req.query.search || "").toString();

      const q = `
        select id, to_email, from_email, from_name, subject, snippet, received_at, status, source
        from inbox_messages
        where status = $1
          and (subject ilike $2 or from_email ilike $2 or snippet ilike $2)
        order by received_at desc
        limit 200
      `;

      const r = await pgPool.query(q, [status, `%${search}%`]);

      const items = (r.rows || []).map((m) => {
        const source = (m.source || "email").toString();
        const parsed =
          source === "panel"
            ? parsePanelSubject(m.subject)
            : { companyName: "", usersCount: null };

        return {
          id: m.id,
          to_email: m.to_email,
          from_email: m.from_email,
          from_name: m.from_name,
          subject: m.subject,
          snippet: m.snippet,
          received_at: m.received_at,
          status: m.status,
          source,

          companyName: parsed.companyName,
          usersCount: parsed.usersCount,
          contactName: m.from_name || "",
          email: m.from_email || "",
          message: m.snippet || "",
        };
      });

      return res.json(items);
    } catch (err) {
      console.error("GET /inbox error:", err);
      return res.status(500).json({ ok: false, error: "INBOX_LIST_FAILED" });
    }
  });

  router.get("/inbox/:id", async (req, res) => {
    try {
      const { id } = req.params;

      const r = await pgPool.query(
        `select *, coalesce(source,'email') as source from inbox_messages where id = $1`,
        [id]
      );

      const row = r.rows[0];
      const source = (row?.source || "email").toString().toLowerCase();
      const parsed =
        source === "panel"
          ? parsePanelSubject(row?.subject)
          : { companyName: "", usersCount: null };

      return res.json({
        ...row,
        source,

        toEmail: row?.to_email,
        fromEmail: row?.from_email,
        fromName: row?.from_name,
        receivedAt: row?.received_at,
        meta: { source },

        companyName: parsed.companyName,
        usersCount: parsed.usersCount,
        contactName: row?.from_name || "",
        email: row?.from_email || "",
        message: (row?.text_body || row?.snippet || "").toString(),
      });
    } catch (err) {
      console.error("GET /inbox/:id error:", err);
      return res.status(500).json({ ok: false, error: "INBOX_READ_FAILED" });
    }
  });

  router.post("/inbox/panel-offer", express.json(), async (req, res) => {
    try {
      const body = req.body || {};

      const companyName = (body.companyName || "").toString().trim();
      const contactName = (body.contactName || "").toString().trim();
      const email = (body.email || "").toString().trim();
      const usersCount = Number(body.usersCount || 0) || null;
      const message = (body.message || body.note || "").toString().trim();

      if (!companyName) return res.status(400).json({ ok: false, error: "COMPANY_REQUIRED" });
      if (!email) return res.status(400).json({ ok: false, error: "EMAIL_REQUIRED" });

      const subject = `Panel Teklif - ${companyName} (${usersCount || 0} kullanici)`;
      const snippet = `${companyName} • ${usersCount || 0} kullanıcı • ${contactName || email}`;
      const textBody =
        `PANEL İÇİ TEKLİF TALEBİ\n` +
        `Kurum: ${companyName}\n` +
        `Yetkili: ${contactName || "—"}\n` +
        `E-posta: ${email}\n` +
        `Kullanıcı: ${usersCount || "—"}\n\n` +
        `Mesaj:\n${message || "—"}`;

      const q = `
        insert into inbox_messages (
          to_email, from_email, from_name,
          subject, snippet, text_body,
          received_at, status, source
        )
        values ($1,$2,$3,$4,$5,$6, now(), 'new', 'panel')
        returning id
      `;

      const toEmail = "teklif@isgpanel.tr";
      const r = await pgPool.query(q, [
        toEmail,
        email,
        contactName || "",
        subject,
        snippet,
        textBody.slice(0, 10000),
      ]);

      const inboxId = r.rows?.[0]?.id;

      try {
        await notifyPanelSender(
          {
            title: "Teklif talebiniz alınmıştır",
            message: `Talebiniz kayıt altına alınmıştır. ${companyName} • ${usersCount || "—"} kullanıcı`,
            link: "/ticari/admin/abonelik",
            key: `panel_offer_sender_${inboxId || Date.now()}`,
          },
          req
        );
      } catch (e) {
        console.error("NOTIFY PANEL SENDER FAIL:", e);
      }

      return res.json({ ok: true, inboxId });
    } catch (err) {
      console.error("POST /inbox/panel-offer error:", err);
      return res.status(500).json({ ok: false, error: "PANEL_INBOX_CREATE_FAILED" });
    }
  });

  let _offerTypeAllowedCache = null;

  async function getOfferTypeAllowedValues() {
    if (_offerTypeAllowedCache) return _offerTypeAllowedCache;

    try {
      const typeRes = await pgPool.query(`
        select c.udt_name, c.data_type
        from information_schema.columns c
        where c.table_schema='public'
          and c.table_name='offers'
          and c.column_name='offer_type'
        limit 1
      `);

      const udt = typeRes.rows?.[0]?.udt_name;
      const dataType = typeRes.rows?.[0]?.data_type;

      if (udt && dataType === "USER-DEFINED") {
        const enumRes = await pgPool.query(
          `
          select e.enumlabel
          from pg_type t
          join pg_enum e on e.enumtypid = t.oid
          where t.typname = $1
          order by e.enumsortorder
          `,
          [udt]
        );
        const vals = enumRes.rows.map((r) => r.enumlabel).filter(Boolean);
        if (vals.length) {
          _offerTypeAllowedCache = vals;
          return _offerTypeAllowedCache;
        }
      }
    } catch (e) {}

    try {
      const chkRes = await pgPool.query(`
        select pg_get_constraintdef(c.oid) as def
        from pg_constraint c
        where c.conrelid = 'public.offers'::regclass
          and c.contype = 'c'
          and pg_get_constraintdef(c.oid) ilike '%offer_type%'
      `);

      const defs = chkRes.rows.map((r) => r.def || "");

      for (const def of defs) {
        let vals = [];

        const arrMatch = def.match(/ARRAY\[(.*)\]/i);
        if (arrMatch?.[1]) {
          vals = arrMatch[1]
            .split(",")
            .map((x) => x.trim())
            .map((x) => x.replace(/::\w+/g, ""))
            .map((x) => x.replace(/^'+|'+$/g, ""))
            .filter(Boolean);
        } else {
          const inMatch = def.match(/IN\s*\((.*)\)/i);
          if (inMatch?.[1]) {
            vals = inMatch[1]
              .split(",")
              .map((x) => x.trim())
              .map((x) => x.replace(/::\w+/g, ""))
              .map((x) => x.replace(/^'+|'+$/g, ""))
              .filter(Boolean);
          }
        }

        if (vals.length) {
          _offerTypeAllowedCache = vals;
          return _offerTypeAllowedCache;
        }
      }
    } catch (e) {}

    _offerTypeAllowedCache = null;
    return null;
  }

  async function pickOfferTypeSafe(preferred) {
    const allowed = await getOfferTypeAllowedValues();
    if (!allowed || !allowed.length) return preferred || "teklif";
    if (preferred && allowed.includes(preferred)) return preferred;
    if (allowed.includes("teklif")) return "teklif";
    return allowed[0];
  }

  router.get("/kayit/teklif/:token", async (req, res) => {
    try {
      const { token } = req.params;

      const r = await pgPool.query(
        `
        select
          company_name,
          to_email,
          users_count,
          price_try,
          duration_days,
          note,
          token,
          status,
          link_expires_at,
          created_at
        from public.offers
        where token = $1
        limit 1
        `,
        [token]
      );

      if (!r.rows[0]) return res.status(404).json({ ok: false, error: "OFFER_NOT_FOUND" });

      const o = r.rows[0];

      if (o?.link_expires_at) {
        const now = new Date();
        const exp = new Date(o.link_expires_at);

        const st = String(o.status || "").toLowerCase();
        const terminal = ["expired", "canceled", "paid", "active"].includes(st);

        if (!terminal && !Number.isNaN(exp.getTime()) && exp.getTime() < now.getTime()) {
          try {
            await pgPool.query(
              `update public.offers set status = 'expired' where token = $1 and status not in ('paid','active','canceled')`,
              [token]
            );
            o.status = "expired";
          } catch (e) {
            console.error("AUTO-EXPIRE UPDATE FAIL (public):", e);
          }
        }
      }

      return res.json({
        ok: true,
        companyName: o.company_name,
        email: o.to_email,
        usersCount: o.users_count,
        priceTRY: Number(o.price_try || 0),
        durationDays: o.duration_days,
        note: o.note || "",
        status: o.status,
        token: o.token,
        linkExpiresAt: o.link_expires_at,
        createdAt: o.created_at,
      });
    } catch (err) {
      console.error("GET /kayit/teklif/:token error:", err);
      return res.status(500).json({ ok: false, error: "PUBLIC_OFFER_FAILED" });
    }
  });

  let _offersHasDeliveryCache = null;
  async function offersHasDeliveryColumn() {
    if (_offersHasDeliveryCache !== null) return _offersHasDeliveryCache;
    try {
      const rr = await pgPool.query(`
        select 1
        from information_schema.columns
        where table_schema='public'
          and table_name='offers'
          and column_name='delivery'
        limit 1
      `);
      _offersHasDeliveryCache = rr.rowCount > 0;
      return _offersHasDeliveryCache;
    } catch (e) {
      _offersHasDeliveryCache = false;
      return false;
    }
  }

  let _offerOrgColCache = null;
  async function detectOfferOrgColumn() {
    if (_offerOrgColCache !== null) return _offerOrgColCache;
    try {
      const r = await pgPool.query(`
        select column_name
        from information_schema.columns
        where table_schema='public'
          and table_name='offers'
          and column_name in ('accepted_org_id','organization_id','org_id','company_id','accepted_organization_id')
      `);
      const cols = (r.rows || []).map((x) => x.column_name).filter(Boolean);
      const preferred = [
        "accepted_org_id",
        "organization_id",
        "org_id",
        "company_id",
        "accepted_organization_id",
      ];
      const found = preferred.find((c) => cols.includes(c)) || null;
      _offerOrgColCache = found;
      return found;
    } catch (e) {
      _offerOrgColCache = null;
      return null;
    }
  }

  router.get("/offers/my", async (req, res) => {
    try {
      const orgUuid =
        (req.query?.orgUuid ||
          req.query?.org ||
          req.user?.organization?.uuid ||
          req.user?.organizationUuid ||
          req.user?.orgUuid ||
          "") + "";

      const isUuid = (v) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          String(v || "").trim()
        );

      if (!orgUuid.trim() || !isUuid(orgUuid)) {
        return res.json({ ok: true, offer: null });
      }

      if (!orgUuid.trim()) {
        return res.status(401).json({ ok: false, message: "Unauthorized" });
      }

      const hasDelivery = await offersHasDeliveryColumn();
      const orgCol = (await detectOfferOrgColumn()) || "accepted_org_id";

      const selectCols = `
        id,
        company_name,
        to_email,
        users_count,
        price_try,
        duration_days,
        note,
        token,
        status,
        offer_type,
        link_expires_at,
        created_at
        ${hasDelivery ? ", delivery" : ""}
      `;

      const q = `
        select ${selectCols}
        from public.offers
        where ${orgCol} = $1
        order by created_at desc
        limit 1
      `;

      let r = await pgPool.query(q, [orgUuid]);
      let o = r.rows?.[0];

      if (o?.link_expires_at) {
        const now = new Date();
        const exp = new Date(o.link_expires_at);

        const st = String(o.status || "").toLowerCase();
        const terminal = ["expired", "canceled", "paid", "active"].includes(st);

        if (!terminal && !Number.isNaN(exp.getTime()) && exp.getTime() < now.getTime()) {
          try {
            await pgPool.query(
              `update public.offers set status = 'expired' where id = $1 and status not in ('paid','active','canceled')`,
              [o.id]
            );
            o.status = "expired";
          } catch (e) {
            console.error("AUTO-EXPIRE UPDATE FAIL:", e);
          }
        }
      }

      if (!o) {
        const email = (req.user?.email || "").toLowerCase().trim();
        if (email) {
                    const q2 = `
            select ${selectCols}
            from public.offers
            where lower(trim(coalesce(to_email,''))) = $1
            order by created_at desc
            limit 1
          `;
          const r2 = await pgPool.query(q2, [email]);
          o = r2.rows?.[0];
        }
      }

      if (!o) {
        return res.json({ ok: true, offer: null });
      }

      const base =
        process.env.APP_URL ||
        process.env.FRONTEND_URL ||
        process.env.PUBLIC_APP_URL ||
        "https://app.isgpanel.tr";

      const link = `${String(base).replace(/\/+$/, "")}/kayit/teklif/${o.token}`;

      return res.json({
        ok: true,
        offer: {
          id: String(o.id),
          company_name: o.company_name || "",
          to_email: o.to_email || "",
          users_count: Number(o.users_count || 0),
          price_try: Number(o.price_try || 0),
          duration_days: Number(o.duration_days || 0),
          note: o.note || "",
          token: o.token || "",
          status: o.status || "",
          offer_type: o.offer_type || null,
          delivery: hasDelivery ? (o.delivery || "email") : "email",
          link_expires_at: o.link_expires_at ? new Date(o.link_expires_at).toISOString() : null,
          created_at: o.created_at ? new Date(o.created_at).toISOString() : null,
          link,
        },
      });
    } catch (err) {
      console.error("GET /offers/my error:", err);
      return res.status(500).json({ ok: false, message: err?.message || "OFFER_MY_FAILED" });
    }
  });

  router.get("/offer/my", (req, res) => {
    req.url = "/offers/my";
    return router.handle(req, res);
  });
  router.get("/teklif/my", (req, res) => {
    req.url = "/offers/my";
    return router.handle(req, res);
  });
  router.get("/teklifler/my", (req, res) => {
    req.url = "/offers/my";
    return router.handle(req, res);
  });

  router.post("/offers/accept", requireAuth, express.json(), async (req, res) => {
    try {
      const body = req.body || {};
      const offerId = String(body.offerId || body.id || "").trim();

      const orgUuid =
        String(
          body.orgUuid ||
            body.org ||
            req.user?.organization?.uuid ||
            req.user?.organizationUuid ||
            req.user?.orgUuid ||
            ""
        ).trim();

      if (!offerId) return res.status(400).json({ ok: false, message: "offerId zorunlu" });
      if (!orgUuid) return res.status(400).json({ ok: false, message: "orgUuid bulunamadı" });

      const orgCol = (await detectOfferOrgColumn()) || "accepted_org_id";
      const hasAcceptedAt = await offersHasAcceptedAtColumn();

      const q = hasAcceptedAt
        ? `
          update public.offers
          set
            ${orgCol} = $1,
            accepted_at = now(),
            status = case
              when status in ('expired','canceled') then status
              else 'registered'
            end
          where id = $2
          returning id, company_name, to_email, users_count, price_try, duration_days, note, token, status, link_expires_at, created_at
        `
        : `
          update public.offers
          set
            ${orgCol} = $1,
            status = case
              when status in ('expired','canceled') then status
              else 'registered'
            end
          where id = $2
          returning id, company_name, to_email, users_count, price_try, duration_days, note, token, status, link_expires_at, created_at
        `;

      const r = await pgPool.query(q, [orgUuid, offerId]);
      const o = r.rows?.[0];

      if (!o) return res.status(404).json({ ok: false, message: "Teklif bulunamadı" });

      if (["expired", "canceled"].includes(String(o.status || ""))) {
        return res.status(400).json({ ok: false, message: "Bu teklif süresi dolmuş/iptal edilmiş" });
      }

      return res.json({
        ok: true,
        offer: {
          id: String(o.id),
          company_name: o.company_name || "",
          to_email: o.to_email || "",
          users_count: Number(o.users_count || 0),
          price_try: Number(o.price_try || 0),
          duration_days: Number(o.duration_days || 0),
          note: o.note || "",
          token: o.token || "",
          status: o.status || "",
          link_expires_at: o.link_expires_at ? new Date(o.link_expires_at).toISOString() : null,
          created_at: o.created_at ? new Date(o.created_at).toISOString() : null,
        },
      });
    } catch (err) {
      console.error("POST /offers/accept error:", err);
      return res.status(500).json({ ok: false, message: err?.message || "OFFER_ACCEPT_FAILED" });
    }
  });

  router.post("/offers/reject", requireAuth, express.json(), async (req, res) => {
    try {
      const body = req.body || {};
      const offerId = String(body.offerId || body.id || "").trim();

      if (!offerId) {
        return res.status(400).json({ ok: false, message: "offerId zorunlu" });
      }

      const hasAcceptedAt = await offersHasAcceptedAtColumn();
      const orgCol = (await detectOfferOrgColumn()) || "accepted_org_id";

      const q = hasAcceptedAt
        ? `
        update public.offers
        set
          status = case
            when status in ('paid','active','expired') then status
            else 'canceled'
          end,
          ${orgCol} = null,
          accepted_at = null
        where id = $1
        returning id, status
      `
        : `
        update public.offers
        set
          status = case
            when status in ('paid','active','expired') then status
            else 'canceled'
          end,
          ${orgCol} = null
        where id = $1
        returning id, status
      `;

      const r = await pgPool.query(q, [offerId]);
      const row = r.rows?.[0];

      if (!row) {
        return res.status(404).json({ ok: false, message: "Teklif bulunamadı" });
      }

      return res.json({
        ok: true,
        offer: {
          id: String(row.id),
          status: row.status,
        },
      });
    } catch (err) {
      console.error("POST /offers/reject error:", err);
      return res.status(500).json({ ok: false, message: err?.message || "OFFER_REJECT_FAILED" });
    }
  });

  router.post("/offers/create", express.json(), async (req, res) => {
    try {
      const body = req.body || {};

      const companyName = (body.companyName || "").toString().trim();
      const toEmail = (body.toEmail || body.email || "").toString().trim();

      const usersCount = parseInt(body.usersCount ?? 10, 10);
      const durationDays = parseInt(body.durationDays ?? 7, 10);

      const priceTRY =
        body.priceTRY === null || body.priceTRY === undefined ? null : Number(body.priceTRY);

      const note = (body.note ?? body.notes ?? "").toString();

      const rawStatus = (body.status || "sent").toString().toLowerCase();
      const status = ["draft", "sent", "active"].includes(rawStatus) ? rawStatus : "sent";

      const rawDelivery = (body.delivery || "email").toString().toLowerCase().trim();
      const delivery = ["email", "panel"].includes(rawDelivery) ? rawDelivery : "email";

      let linkExpiresAt = null;
      if (body.linkExpiresAt) {
        const d = new Date(body.linkExpiresAt);
        if (!isNaN(d.getTime())) linkExpiresAt = d;
      }
      if (!linkExpiresAt) {
        linkExpiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
      }

      if (!companyName) return res.status(400).json({ ok: false, message: "companyName zorunlu" });
      if (!toEmail) return res.status(400).json({ ok: false, message: "toEmail zorunlu" });
      if (!Number.isFinite(usersCount) || usersCount < 10)
        return res.status(400).json({ ok: false, message: "usersCount en az 10 olmalı" });
      if (!Number.isFinite(durationDays) || durationDays < 1)
        return res.status(400).json({ ok: false, message: "durationDays en az 1 olmalı" });

      const token = crypto.randomBytes(18).toString("hex");

      const preferredOfferType = (body.offerType || "kurumsal").toString();
      const offerType = await pickOfferTypeSafe(preferredOfferType);

      const createdBy = req.user?._id ? String(req.user._id) : null;

      let acceptedOrgId = null;
      try {
        const targetUser = await User.findOne({ email: toEmail }).select("organization");
        if (targetUser?.organization) {
          const OrganizationModel = mongoose.model("Organization");
          const org = await OrganizationModel.findById(targetUser.organization).select("uuid");
          if (org?.uuid) acceptedOrgId = org.uuid;
        }
      } catch (e) {
        console.error("ACCEPTED ORG RESOLVE FAIL:", e);
      }

      const hasDelivery = await offersHasDeliveryColumn();
      const orgCol = await detectOfferOrgColumn();

      const q = hasDelivery
        ? (
            orgCol
              ? `
          INSERT INTO public.offers (
            company_name,
            to_email,
            users_count,
            price_try,
            duration_days,
            note,
            token,
            status,
            created_by,
            offer_type,
            link_expires_at,
            delivery,
            ${orgCol}
          )
          VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13
          )
          RETURNING *
        `
              : `
          INSERT INTO public.offers (
            company_name,
            to_email,
            users_count,
            price_try,
            duration_days,
            note,
            token,
            status,
            created_by,
            offer_type,
            link_expires_at,
            delivery
          )
          VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
          )
          RETURNING *
        `
          )
        : (
            orgCol
              ? `
          INSERT INTO public.offers (
            company_name,
            to_email,
            users_count,
            price_try,
            duration_days,
            note,
            token,
            status,
            created_by,
            offer_type,
            link_expires_at,
            ${orgCol}
          )
          VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
          )
          RETURNING *
        `
              : `
          INSERT INTO public.offers (
            company_name,
            to_email,
            users_count,
            price_try,
            duration_days,
            note,
            token,
            status,
            created_by,
            offer_type,
            link_expires_at
          )
          VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
          )
          RETURNING *
        `
          );

      const params = hasDelivery
        ? (
            orgCol
              ? [
                  companyName,
                  toEmail,
                  usersCount,
                  priceTRY,
                  durationDays,
                  note || null,
                  token,
                  status,
                  createdBy,
                  offerType,
                  linkExpiresAt,
                  delivery,
                  acceptedOrgId,
                ]
              : [
                  companyName,
                  toEmail,
                  usersCount,
                  priceTRY,
                  durationDays,
                  note || null,
                  token,
                  status,
                  createdBy,
                  offerType,
                  linkExpiresAt,
                  delivery,
                ]
          )
        : (
            orgCol
              ? [
                  companyName,
                  toEmail,
                  usersCount,
                  priceTRY,
                  durationDays,
                  note || null,
                  token,
                  status,
                  createdBy,
                  offerType,
                  linkExpiresAt,
                  acceptedOrgId,
                ]
              : [
                  companyName,
                  toEmail,
                  usersCount,
                  priceTRY,
                  durationDays,
                  note || null,
                  token,
                  status,
                  createdBy,
                  offerType,
                  linkExpiresAt,
                ]
          );

      const r = await pgPool.query(q, params);

      if (delivery === "panel") {
        try {
          const subject = `Panel Teklif - ${companyName} (${usersCount} kullanici)`;
          const snippet = `${companyName} • ${usersCount} kullanıcı • ${priceTRY || 0} TL`;
          const textBody =
            `PANEL TEKLİFİ OLUŞTURULDU\n` +
            `Kurum: ${companyName}\n` +
            `E-posta: ${toEmail}\n` +
            `Kullanıcı: ${usersCount}\n` +
            `Fiyat: ${priceTRY || 0} TL\n` +
            `Süre: ${durationDays} gün\n` +
            `Token: ${token}\n`;

          await pgPool.query(
            `
            INSERT INTO inbox_messages
            (to_email, from_email, from_name, subject, snippet, text_body, received_at, status, source)
            VALUES ($1,$2,$3,$4,$5,$6, now(), 'new', 'panel')
            `,
            [
              "teklif@isgpanel.tr",
              toEmail,
              "Kurumsal Panel",
              subject,
              snippet,
              textBody.slice(0, 10000),
            ]
          );

          try {
            const targetUser = await User.findOne({ email: toEmail }).select("_id email role");

            if (!targetUser?._id) {
              console.warn("PANEL OFFER TARGET USER NOT FOUND (toEmail):", { toEmail });
            } else {
              const targetUserIdRaw = targetUser._id;

              const targetUserId =
                targetUserIdRaw && mongoose.Types.ObjectId.isValid(String(targetUserIdRaw))
                  ? new mongoose.Types.ObjectId(String(targetUserIdRaw))
                  : null;

              if (!targetUserId) {
                console.warn("PANEL OFFER TARGET USERID INVALID:", {
                  toEmail,
                  targetUserIdRaw,
                });
              } else {
                const offerId = r.rows?.[0]?.id;
                const notifKey = `offer_panel_admin_${offerId || token}`;

                await Notification.findOneAndUpdate(
                  { userId: targetUserId, key: notifKey },
                  {
                    $setOnInsert: {
                      userId: targetUserId,
                      key: notifKey,
                      createdAt: new Date(),
                    },
                    $set: {
                      type: "event",
                      module: "abonelik",
                      title: "Kurumsal Teklifiniz Hazır.",
                      message:
                        `Kurumsal teklifiniz oluşturuldu. ` +
                        `Detaylara "Paket ve Abonelik" sekmesi ekranından erişebilirsiniz.`,
                      severity: "info",
                      status: "unread",
                      link: getSubscriptionLinkForUser(targetUser),
                      updatedAt: new Date(),
                    },
                  },
                  { upsert: true, returnDocument: "after" }
                );

                console.log("OFFER PANEL USER NOTIF CREATED:", {
                  email: toEmail,
                  userId: String(targetUserId),
                  key: notifKey,
                });
              }
            }
          } catch (e) {
            console.error("OFFER PANEL USER NOTIFY FAIL:", e);
          }
        } catch (e) {
          console.error("INBOX PANEL INSERT FAIL:", e);
        }
      }

      const base =
        process.env.APP_URL ||
        process.env.FRONTEND_URL ||
        process.env.PUBLIC_APP_URL ||
        "https://app.isgpanel.tr";

      const link = `${String(base).replace(/\/+$/, "")}/kayit/teklif/${token}`;

      return res.json({
        ok: true,
        offerId: r.rows[0].id,
        token: r.rows[0].token,
        createdAt: r.rows[0].created_at,
        linkExpiresAt: r.rows[0].link_expires_at,
        offerType: r.rows[0].offer_type,
        delivery: hasDelivery ? (r.rows[0].delivery || delivery) : delivery,
        notes: note || "",
        link,
        status: r.rows[0].status,
      });
    } catch (err) {
      console.error("POST /offers/create error:", err);
      return res.status(500).json({ ok: false, error: "OFFER_CREATE_FAILED" });
    }
  });

  router.post("/offers/:id/send-mail", express.json(), async (req, res) => {
    try {
      const { id } = req.params;

      console.log("📌 OFFER SEND MAIL ROUTE HIT - START:", { id });

     const r = await pgPool.query(
  `select id, company_name, to_email, token, link_expires_at, duration_days
   from public.offers
   where id = $1
   limit 1`,
  [id]
);

      if (!r.rows[0]) {
        console.warn("❌ OFFER NOT FOUND FOR MAIL:", { id });
        return res.status(404).json({ ok: false, error: "OFFER_NOT_FOUND" });
      }

      const o = r.rows[0];

      const base =
        process.env.APP_URL ||
        process.env.FRONTEND_URL ||
        process.env.PUBLIC_APP_URL ||
        "https://app.isgpanel.tr";

      const offerLink = `${String(base).replace(/\/+$/, "")}/kayit/teklif/${o.token}`;

      console.log("📌 OFFER MAIL DATA:", {
        id: o.id,
        to: o.to_email,
        companyName: o.company_name,
        offerLink,
        link_expires_at: o.link_expires_at,
      });

    const linkDays = o.duration_days
  ? `${Number(o.duration_days)} gün`
  : "belirlenen süre boyunca";

      await sendOfferMail({
        to: o.to_email,
        companyName: o.company_name,
        offerLink,
        linkDays,
      });

      console.log("✅ OFFER MAIL SEND SUCCESS:", {
        id: o.id,
        to: o.to_email,
      });

      return res.json({ ok: true });
    } catch (err) {
      console.error("❌ POST /offers/:id/send-mail error:", err);
      return res.status(500).json({
        ok: false,
        error: "OFFER_MAIL_FAILED",
        message: err?.message || String(err),
      });
    }
  });

  router.get("/offers", async (req, res) => {
    try {
      const hasDelivery = await offersHasDeliveryColumn();

      const r = await pgPool.query(
        hasDelivery
          ? `
            select
              id,
              company_name,
              to_email,
              users_count,
              price_try,
              duration_days,
              note,
              token,
              status,
              created_by,
              offer_type,
              link_expires_at,
              created_at,
              delivery
            from public.offers
            order by created_at desc
            limit 200
          `
          : `
            select
              id,
              company_name,
              to_email,
              users_count,
              price_try,
              duration_days,
              note,
              token,
              status,
              created_by,
              offer_type,
              link_expires_at,
              created_at
            from public.offers
            order by created_at desc
            limit 200
          `
      );

      const items = r.rows.map((o) => ({
        id: String(o.id),
        leadId: null,
        companyName: o.company_name || "",
        contactName: "",
        email: o.to_email || "",
        usersCount: Number(o.users_count || 10),
        durationDays: Number(o.duration_days || 7),
        priceTRY: Number(o.price_try || 0),
        currency: "TRY",
        notes: o.note || "",
        token: o.token || "",
        linkExpiresAt: o.link_expires_at
          ? new Date(o.link_expires_at).toISOString().slice(0, 16)
          : null,
        status: o.status || "draft",
        paymentRef: null,
        offerType: o.offer_type || null,
        delivery: hasDelivery ? (o.delivery || "email") : "email",
        createdAt: o.created_at ? new Date(o.created_at).toISOString().slice(0, 16) : "",
        updatedAt: o.created_at ? new Date(o.created_at).toISOString().slice(0, 16) : "",
      }));

      return res.json(items);
    } catch (err) {
      console.error("GET /offers error:", err);
      return res.status(500).json({ ok: false, error: "OFFER_LIST_FAILED" });
    }
  });

  router.delete("/offers/:id", async (req, res) => {
    try {
      console.log(">>> DELETE OFFER HIT");
      console.log(">>> req.params.id =", req.params.id);

      const { id } = req.params;
      if (!id) return res.status(400).json({ ok: false, error: "ID_REQUIRED" });

      const r = await pgPool.query("DELETE FROM public.offers WHERE id = $1 RETURNING id", [id]);

      console.log(">>> DELETE rowCount =", r.rowCount);
      console.log(">>> DELETE rows =", r.rows);

      if (!r.rowCount) {
        return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      }

      return res.json({ ok: true, deletedId: id });
    } catch (err) {
      console.error("DELETE /offers/:id error:", err);
      return res.status(500).json({ ok: false, error: "OFFER_DELETE_FAILED" });
    }
  });

  router.delete("/inbox/:id", async (req, res) => {
    try {
      const { id } = req.params;

      const r = await pgPool.query("DELETE FROM inbox_messages WHERE id = $1 RETURNING id", [id]);

      if (!r.rowCount) {
        return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      }

      return res.json({ ok: true, deletedId: id });
    } catch (err) {
      console.error("DELETE /inbox/:id error:", err);
      return res.status(500).json({ ok: false, error: "INBOX_DELETE_FAILED" });
    }
  });

  return router;
};