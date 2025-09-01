"use strict";

const bcrypt = require("bcryptjs");

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const qi = queryInterface;
    const sequelize = qi.sequelize;
    const t = await sequelize.transaction();

    try {
      // ---------- helpers ----------
      const insertOrGet = async ({
        table,
        uniqueField,
        uniqueValue,
        insertValues,
      }) => {
        const [existing] = await sequelize.query(
          `SELECT * FROM \`${table}\` WHERE \`${uniqueField}\` = ? LIMIT 1`,
          { replacements: [uniqueValue], transaction: t }
        );
        if (existing.length) return existing[0];

        const cols = Object.keys(insertValues);
        const placeholders = cols.map(() => "?").join(", ");
        await sequelize.query(
          `INSERT INTO \`${table}\` (${cols.map((c) => `\`${c}\``).join(", ")})
           VALUES (${placeholders})`,
          { replacements: Object.values(insertValues), transaction: t }
        );
        const [rows] = await sequelize.query(
          `SELECT * FROM \`${table}\` WHERE \`${uniqueField}\` = ? LIMIT 1`,
          { replacements: [uniqueValue], transaction: t }
        );
        return rows[0];
      };

      const upsertUserByEmail = async ({
        full_name,
        email_address,
        phone_number,
        password_hash,
        business_id,
        default_package_id = null,
      }) => {
        await sequelize.query(
          `INSERT INTO \`Users\`
           (full_name, email_address, phone_number, password, is_active, is_deleted, business_id, default_package_id, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, 1, 0, ?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE
             full_name=VALUES(full_name),
             password=VALUES(password),
             business_id=VALUES(business_id),
             default_package_id=VALUES(default_package_id),
             updatedAt=VALUES(updatedAt)`,
          {
            replacements: [
              full_name,
              email_address,
              phone_number,
              password_hash,
              business_id,
              default_package_id,
            ],
            transaction: t,
          }
        );
        const [rows] = await sequelize.query(
          `SELECT * FROM \`Users\` WHERE email_address = ? LIMIT 1`,
          { replacements: [email_address], transaction: t }
        );
        return rows[0];
      };

      const upsertPackage = async ({
        business_id,
        name,
        description,
        is_system = 1,
        is_active = 1,
      }) => {
        await sequelize.query(
          `INSERT INTO \`BusinessPackages\`
           (business_id, name, description, is_system, is_active, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE
             description=VALUES(description),
             is_system=VALUES(is_system),
             is_active=VALUES(is_active),
             updatedAt=VALUES(updatedAt)`,
          {
            replacements: [
              business_id,
              name,
              description || null,
              is_system,
              is_active,
            ],
            transaction: t,
          }
        );
        const [rows] = await sequelize.query(
          `SELECT * FROM \`BusinessPackages\` WHERE business_id=? AND name=? LIMIT 1`,
          { replacements: [business_id, name], transaction: t }
        );
        return rows[0];
      };

      const upsertPackageFeature = async ({
        package_id,
        feature_id,
        enabled,
        limit_value = null,
        meta_json = null,
      }) => {
        await sequelize.query(
          `INSERT INTO \`BusinessPackageFeatures\`
           (package_id, feature_id, enabled, limit_value, meta_json, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE
             enabled=VALUES(enabled),
             limit_value=VALUES(limit_value),
             meta_json=VALUES(meta_json),
             updatedAt=VALUES(updatedAt)`,
          {
            replacements: [
              package_id,
              feature_id,
              enabled ? 1 : 0,
              limit_value,
              meta_json,
            ],
            transaction: t,
          }
        );
      };

      const upsertPackagePerm = async ({ package_id, perm }) => {
        await sequelize.query(
          `INSERT INTO \`BusinessPackagePermissions\` (package_id, perm, createdAt, updatedAt)
           VALUES (?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE updatedAt=VALUES(updatedAt)`,
          { replacements: [package_id, perm], transaction: t }
        );
      };

      const upsertUserPackage = async ({ user_id, package_id }) => {
        await sequelize.query(
          `INSERT INTO \`BusinessUserPackages\` (user_id, package_id, createdAt, updatedAt)
           VALUES (?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE updatedAt=VALUES(updatedAt)`,
          { replacements: [user_id, package_id], transaction: t }
        );
      };

      const upsertUserFeature = async ({
        user_id,
        feature_id,
        enabled = null, // null = inherit
        limit_value = null,
        meta_json = null,
      }) => {
        await sequelize.query(
          `INSERT INTO \`UserFeatures\`
           (user_id, feature_id, enabled, limit_value, meta_json, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE
             enabled=VALUES(enabled),
             limit_value=VALUES(limit_value),
             meta_json=VALUES(meta_json),
             updatedAt=VALUES(updatedAt)`,
          {
            replacements: [
              user_id,
              feature_id,
              enabled,
              limit_value,
              meta_json,
            ],
            transaction: t,
          }
        );
      };

      const upsertUserPermission = async ({
        user_id,
        perm,
        effect = "ALLOW", // or DENY
      }) => {
        await sequelize.query(
          `INSERT INTO \`UserPermissions\` (user_id, perm, effect, createdAt, updatedAt)
           VALUES (?, ?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE effect=VALUES(effect), updatedAt=VALUES(updatedAt)`,
          { replacements: [user_id, perm, effect], transaction: t }
        );
      };

      // ---------- 1) categories ----------
      const retail = await insertOrGet({
        table: "BusinessCategories",
        uniqueField: "category_name",
        uniqueValue: "Retail",
        insertValues: {
          category_name: "Retail",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      const tech = await insertOrGet({
        table: "BusinessCategories",
        uniqueField: "category_name",
        uniqueValue: "Tech",
        insertValues: {
          category_name: "Tech",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // ---------- 2) business ----------
      const superBusiness = await insertOrGet({
        table: "Businesses",
        uniqueField: "business_name",
        uniqueValue: "Super Admin Business",
        insertValues: {
          business_name: "Super Admin Business",
          business_phone_number: "0000000000",
          email: "business@example.com",
          is_active: 1,
          is_deleted: 0,
          category_id: retail.id,
          api_key: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // ---------- 3) users ----------
      const defaultPwd = process.env.SUPERADMIN_PASSWORD || "password";
      const pwdHash = await bcrypt.hash(defaultPwd, 10);

      const superAdmin = await upsertUserByEmail({
        full_name: "Super Admin",
        email_address: "superadmin@superadmin.com",
        phone_number: "1234567890",
        password_hash: pwdHash,
        business_id: superBusiness.id,
        default_package_id: null, // will set after packages
      });

      const messengerUser = await upsertUserByEmail({
        full_name: "Messenger User",
        email_address: "messenger@demo.com",
        phone_number: "1111111111",
        password_hash: pwdHash,
        business_id: superBusiness.id,
        default_package_id: null,
      });

      const crmUser = await upsertUserByEmail({
        full_name: "CRM User",
        email_address: "crm@demo.com",
        phone_number: "2222222222",
        password_hash: pwdHash,
        business_id: superBusiness.id,
        default_package_id: null,
      });

      const reportsUser = await upsertUserByEmail({
        full_name: "Reports User",
        email_address: "reports@demo.com",
        phone_number: "3333333333",
        password_hash: pwdHash,
        business_id: superBusiness.id,
        default_package_id: null,
      });

      const customUser = await upsertUserByEmail({
        full_name: "Custom No-Package User",
        email_address: "custom@demo.com",
        phone_number: "4444444444",
        password_hash: pwdHash,
        business_id: superBusiness.id,
        default_package_id: null, // stays null
      });

      // ---------- 4) features (added 'users') ----------
      const features = [
        [
          "scheduled_messages",
          "Scheduled Messages",
          "Create one-off and recurring schedules",
        ],
        [
          "single_messages",
          "Single Messages",
          "Send immediate one-to-one messages",
        ],
        ["bulk_send", "Bulk Send", "Send to many recipients with pacing"],
        ["media_attachments", "Media Attachments", "Send images, docs, voice"],
        ["analytics", "Analytics", "Delivery stats and charts"],
        ["api_access", "API Access", "Use REST endpoints & tokens"],
        ["webhooks", "Webhooks", "Receive delivery/receipt events"],
        ["multi_user", "Multi-user", "Multiple logins per business"],
        ["ai_chatbot", "AI Chatbot", "Bot replies and flows"],
        ["users", "Users", "Manage users and permissions"], // NEW
      ];
      for (const [code, name, description] of features) {
        await sequelize.query(
          `INSERT INTO \`Features\` (code, name, description, createdAt, updatedAt)
           VALUES (?, ?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description), updatedAt=VALUES(updatedAt)`,
          { replacements: [code, name, description], transaction: t }
        );
      }
      const [featRows] = await sequelize.query(
        "SELECT id, code FROM `Features`",
        { transaction: t }
      );
      const featureMap = Object.fromEntries(
        featRows.map((r) => [r.code, r.id])
      );
      const fid = (code) => featureMap[code];

      // ---------- 5) business-level feature defaults (enable all; bulk limit example) ----------
      for (const code of Object.keys(featureMap)) {
        const limit = code === "bulk_send" ? 36000 : null;
        await sequelize.query(
          `INSERT INTO \`BusinessFeatures\`
           (business_id, feature_id, enabled, limit_value, meta_json, createdAt, updatedAt)
           VALUES (?, ?, 1, ?, NULL, NOW(), NOW())
           ON DUPLICATE KEY UPDATE enabled=VALUES(enabled), limit_value=VALUES(limit_value), updatedAt=VALUES(updatedAt)`,
          { replacements: [superBusiness.id, fid(code), limit], transaction: t }
        );
      }

      // ---------- 6) packages ----------
      const ownerPkg = await upsertPackage({
        business_id: superBusiness.id,
        name: "Owner",
        description: "Full access to all features and permissions",
      });

      const messengerPkg = await upsertPackage({
        business_id: superBusiness.id,
        name: "Messenger",
        description: "Can send single messages (no bulk)",
      });

      const crmTemplatesPkg = await upsertPackage({
        business_id: superBusiness.id,
        name: "CRM+Templates",
        description:
          "Manage customers and message templates; limited messaging",
      });

      const reportsPkg = await upsertPackage({
        business_id: superBusiness.id,
        name: "ReportsViewer",
        description: "View analytics and reports only",
      });

      // ---------- 7) granular permission catalog (per feature) ----------
      // You can extend these as your app grows.
      const PERMISSIONS_BY_FEATURE = {
        single_messages: ["messages.read", "messages.send"],
        scheduled_messages: [
          "schedules.read",
          "schedules.create",
          "schedules.update",
          "schedules.delete",
        ],
        bulk_send: ["bulk.read", "bulk.send"],
        media_attachments: ["media.upload"],
        analytics: ["reports.view"],
        api_access: ["api.manage"],
        webhooks: ["webhooks.manage"],
        multi_user: ["multiuser.manage"], // kept separate from users.*
        ai_chatbot: ["chatbot.manage"],
        users: ["users.read", "users.write", "users.invite"], // NEW
      };
      const ALL_PERMS = Array.from(
        new Set(Object.values(PERMISSIONS_BY_FEATURE).flat())
      );

      const addAllPermsForPackage = async (pkgId) => {
        for (const p of ALL_PERMS) {
          await upsertPackagePerm({ package_id: pkgId, perm: p });
        }
      };

      // ---------- 8) owner: all features + all perms + wildcard ----------
      for (const code of Object.keys(featureMap)) {
        await upsertPackageFeature({
          package_id: ownerPkg.id,
          feature_id: fid(code),
          enabled: true,
          limit_value: code === "bulk_send" ? 36000 : null,
        });
      }
      await addAllPermsForPackage(ownerPkg.id);
      await upsertPackagePerm({ package_id: ownerPkg.id, perm: "*" });

      // ---------- 9) messenger: messages + media (no bulk/schedules) ----------
      await upsertPackageFeature({
        package_id: messengerPkg.id,
        feature_id: fid("single_messages"),
        enabled: true,
      });
      await upsertPackageFeature({
        package_id: messengerPkg.id,
        feature_id: fid("media_attachments"),
        enabled: true,
      });
      await upsertPackageFeature({
        package_id: messengerPkg.id,
        feature_id: fid("bulk_send"),
        enabled: false,
      });
      await upsertPackageFeature({
        package_id: messengerPkg.id,
        feature_id: fid("scheduled_messages"),
        enabled: false,
      });

      for (const p of ["messages.read", "messages.send", "media.upload"]) {
        await upsertPackagePerm({ package_id: messengerPkg.id, perm: p });
      }

      // ---------- 10) crm+templates: CRUD perms, messaging disabled ----------
      await upsertPackageFeature({
        package_id: crmTemplatesPkg.id,
        feature_id: fid("single_messages"),
        enabled: false,
      });
      for (const p of [
        "customers.read",
        "customers.write",
        "templates.read",
        "templates.write",
      ]) {
        await upsertPackagePerm({ package_id: crmTemplatesPkg.id, perm: p });
      }

      // ---------- 11) reports viewer: analytics only ----------
      await upsertPackageFeature({
        package_id: reportsPkg.id,
        feature_id: fid("analytics"),
        enabled: true,
      });
      await upsertPackagePerm({
        package_id: reportsPkg.id,
        perm: "reports.view",
      });

      // ---------- 12) assign packages to users + set default_package_id ----------
      await upsertUserPackage({
        user_id: superAdmin.id,
        package_id: ownerPkg.id,
      });
      await upsertUserPackage({
        user_id: messengerUser.id,
        package_id: messengerPkg.id,
      });
      await upsertUserPackage({
        user_id: crmUser.id,
        package_id: crmTemplatesPkg.id,
      });
      await upsertUserPackage({
        user_id: reportsUser.id,
        package_id: reportsPkg.id,
      });

      await sequelize.query(
        `UPDATE \`Users\` SET default_package_id=? WHERE id=?`,
        {
          replacements: [ownerPkg.id, superAdmin.id],
          transaction: t,
        }
      );
      await sequelize.query(
        `UPDATE \`Users\` SET default_package_id=? WHERE id=?`,
        {
          replacements: [messengerPkg.id, messengerUser.id],
          transaction: t,
        }
      );
      await sequelize.query(
        `UPDATE \`Users\` SET default_package_id=? WHERE id=?`,
        {
          replacements: [crmTemplatesPkg.id, crmUser.id],
          transaction: t,
        }
      );
      await sequelize.query(
        `UPDATE \`Users\` SET default_package_id=? WHERE id=?`,
        {
          replacements: [reportsPkg.id, reportsUser.id],
          transaction: t,
        }
      );
      // customUser keeps default_package_id = NULL

      // Super admin convenience: wildcard ALLOW at user level
      await upsertUserPermission({
        user_id: superAdmin.id,
        perm: "*",
        effect: "ALLOW",
      });

      // ---------- 13) custom user (no package): custom features + custom permissions ----------
      // Features: allow single messages + media; deny bulk + schedules; allow analytics
      await upsertUserFeature({
        user_id: customUser.id,
        feature_id: fid("single_messages"),
        enabled: true,
        limit_value: 5000,
      });
      await upsertUserFeature({
        user_id: customUser.id,
        feature_id: fid("media_attachments"),
        enabled: true,
      });
      await upsertUserFeature({
        user_id: customUser.id,
        feature_id: fid("bulk_send"),
        enabled: false,
      });
      await upsertUserFeature({
        user_id: customUser.id,
        feature_id: fid("scheduled_messages"),
        enabled: false,
      });
      await upsertUserFeature({
        user_id: customUser.id,
        feature_id: fid("analytics"),
        enabled: true,
      });

      // Permissions: allow read, deny send; allow reports.view and media.upload
      await upsertUserPermission({
        user_id: customUser.id,
        perm: "messages.read",
        effect: "ALLOW",
      });
      await upsertUserPermission({
        user_id: customUser.id,
        perm: "messages.send",
        effect: "DENY",
      });
      await upsertUserPermission({
        user_id: customUser.id,
        perm: "reports.view",
        effect: "ALLOW",
      });
      await upsertUserPermission({
        user_id: customUser.id,
        perm: "media.upload",
        effect: "ALLOW",
      });
      // Add any additional custom perms you need here

      // ---------- 14) system templates (user_id = NULL) ----------
      const systemTemplates = [
        {
          category_id: retail.id,
          template_name: "Order Confirmation",
          message_ar:
            "مرحبًا {name}، تم تأكيد طلبك لدى {business_name} بسعر {price}. شكراً لك!",
          message_en:
            "Hello {name}, your order at {business_name} is confirmed at {price}. Thank you!",
          placeholders: JSON.stringify([
            "{name}",
            "{business_name}",
            "{price}",
          ]),
        },
        {
          category_id: tech.id,
          template_name: "Discount Offer",
          message_ar:
            "مرحبًا {name}، لدينا عرض خاص! السعر الأصلي {price}، والسعر المخفض {offer_price}. انتهز الفرصة!",
          message_en:
            "Hello {name}, we have a special offer! Original price {price}, discounted price {offer_price}. Grab it now!",
          placeholders: JSON.stringify(["{name}", "{price}", "{offer_price}"]),
        },
      ];
      for (const tpl of systemTemplates) {
        await sequelize.query(
          `INSERT INTO \`MessageTemplates\`
           (user_id, category_id, template_name, message_ar, message_en, placeholders, createdAt, updatedAt)
           VALUES (NULL, ?, ?, ?, ?, ?, NOW(), NOW())`,
          {
            replacements: [
              tpl.category_id,
              tpl.template_name,
              tpl.message_ar,
              tpl.message_en,
              tpl.placeholders,
            ],
            transaction: t,
          }
        );
      }

      // ---------- 15) demo categories & customers for super admin ----------
      for (const name of ["Regular", "VIP", "Wholesale"]) {
        const [exists] = await sequelize.query(
          "SELECT id FROM `CustomerCategories` WHERE user_id = ? AND name = ? LIMIT 1",
          { replacements: [superAdmin.id, name], transaction: t }
        );
        if (!exists.length) {
          await sequelize.query(
            `INSERT INTO \`CustomerCategories\` (user_id, name, createdAt, updatedAt)
             VALUES (?, ?, NOW(), NOW())`,
            { replacements: [superAdmin.id, name], transaction: t }
          );
        }
      }
      const [catRows] = await sequelize.query(
        "SELECT id, name FROM `CustomerCategories` WHERE user_id = ?",
        { replacements: [superAdmin.id], transaction: t }
      );
      const catMap = Object.fromEntries(catRows.map((r) => [r.name, r.id]));

      const customers = [
        {
          whatsapp_number: "+1234567890",
          profile_name: "John Doe",
          gender: "male",
          status: "verified",
          category_id: catMap["Regular"],
        },
        {
          whatsapp_number: "+9876543210",
          profile_name: "Jane Smith",
          gender: "female",
          status: "unverified",
          category_id: catMap["VIP"],
        },
      ];
      for (const c of customers) {
        await sequelize.query(
          `INSERT INTO \`Customers\`
           (user_id, category_id, whatsapp_number, profile_name, gender, status, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE profile_name=VALUES(profile_name), category_id=VALUES(category_id), gender=VALUES(gender), status=VALUES(status), updatedAt=VALUES(updatedAt)`,
          {
            replacements: [
              superAdmin.id,
              c.category_id,
              c.whatsapp_number,
              c.profile_name,
              c.gender,
              c.status,
            ],
            transaction: t,
          }
        );
      }

      // ---------- 16) sample scheduled messages ----------
      const now = new Date();
      const in20m = new Date(now.getTime() + 20 * 60 * 1000);
      const in5m = new Date(now.getTime() + 5 * 60 * 1000);

      const samples = [
        {
          id: "c0ffee00-0000-4000-8000-000000000001",
          business_id: superBusiness.id,
          created_by_user: superAdmin.id,
          to_number: "+15550123456",
          body: "Hello from seed! (ONE_OFF) See you soon.",
          media_url: null,
          variables_json: JSON.stringify({ name: "Seed User" }),
          type: "ONE_OFF",
          send_at_utc: in20m,
          cron_expr: null,
          timezone: "Asia/Hebron",
          status: "ACTIVE",
          last_run_at: null,
          next_run_at: in20m,
          max_attempts: 3,
        },
        {
          id: "c0ffee00-0000-4000-8000-000000000002",
          business_id: superBusiness.id,
          created_by_user: superAdmin.id,
          to_number: "+15550987654",
          body: "Hello from seed! (CRON */5 * * * *)",
          media_url: null,
          variables_json: JSON.stringify({ campaign: "welcome" }),
          type: "CRON",
          send_at_utc: null,
          cron_expr: "*/5 * * * *",
          timezone: "Asia/Hebron",
          status: "ACTIVE",
          last_run_at: null,
          next_run_at: in5m,
          max_attempts: 3,
        },
      ];

      for (const s of samples) {
        await sequelize.query(
          `INSERT INTO \`ScheduledMessages\`
           (id, business_id, created_by_user, to_number, body, media_url, variables_json, type, send_at_utc, cron_expr, timezone, status, last_run_at, next_run_at, max_attempts, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE business_id=VALUES(business_id), created_by_user=VALUES(created_by_user), to_number=VALUES(to_number),
             body=VALUES(body), media_url=VALUES(media_url), variables_json=VALUES(variables_json), type=VALUES(type), send_at_utc=VALUES(send_at_utc),
             cron_expr=VALUES(cron_expr), timezone=VALUES(timezone), status=VALUES(status), last_run_at=VALUES(last_run_at), next_run_at=VALUES(next_run_at),
             max_attempts=VALUES(max_attempts), updatedAt=VALUES(updatedAt)`,
          {
            replacements: [
              s.id,
              s.business_id,
              s.created_by_user,
              s.to_number,
              s.body,
              s.media_url,
              s.variables_json,
              s.type,
              s.send_at_utc,
              s.cron_expr,
              s.timezone,
              s.status,
              s.last_run_at,
              s.next_run_at,
              s.max_attempts,
            ],
            transaction: t,
          }
        );
      }

      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }
  },

  down: async (queryInterface) => {
    const sequelize = queryInterface.sequelize;
    const t = await sequelize.transaction();
    try {
      const emails = [
        "superadmin@superadmin.com",
        "messenger@demo.com",
        "crm@demo.com",
        "reports@demo.com",
        "custom@demo.com",
      ];

      await sequelize.query(
        "DELETE FROM `ScheduledMessages` WHERE id IN (?, ?)",
        {
          replacements: [
            "c0ffee00-0000-4000-8000-000000000001",
            "c0ffee00-0000-4000-8000-000000000002",
          ],
          transaction: t,
        }
      );

      // Remove BusinessUserPackages for seeded users
      await sequelize.query(
        `DELETE bup FROM \`BusinessUserPackages\` bup
         JOIN \`Users\` u ON u.id = bup.user_id
         WHERE u.email_address IN (${emails.map(() => "?").join(",")})`,
        { replacements: emails, transaction: t }
      );

      // Remove user-level permissions & features for seeded users
      await sequelize.query(
        `DELETE up FROM \`UserPermissions\` up
         JOIN \`Users\` u ON u.id = up.user_id
         WHERE u.email_address IN (${emails.map(() => "?").join(",")})`,
        { replacements: emails, transaction: t }
      );
      await sequelize.query(
        `DELETE uf FROM \`UserFeatures\` uf
         JOIN \`Users\` u ON u.id = uf.user_id
         WHERE u.email_address IN (${emails.map(() => "?").join(",")})`,
        { replacements: emails, transaction: t }
      );

      // Remove packages & related
      await sequelize.query(
        `DELETE bpf FROM \`BusinessPackageFeatures\` bpf
         JOIN \`BusinessPackages\` bp ON bp.id = bpf.package_id
         WHERE bp.business_id IN (SELECT id FROM \`Businesses\` WHERE business_name = ?)`,
        { replacements: ["Super Admin Business"], transaction: t }
      );
      await sequelize.query(
        `DELETE bpp FROM \`BusinessPackagePermissions\` bpp
         JOIN \`BusinessPackages\` bp ON bp.id = bpp.package_id
         WHERE bp.business_id IN (SELECT id FROM \`Businesses\` WHERE business_name = ?)`,
        { replacements: ["Super Admin Business"], transaction: t }
      );
      await sequelize.query(
        "DELETE FROM `BusinessPackages` WHERE business_id IN (SELECT id FROM `Businesses` WHERE business_name = ?)",
        { replacements: ["Super Admin Business"], transaction: t }
      );

      // Remove demo customers/categories/templates for super admin
      await sequelize.query(
        "DELETE FROM `Customers` WHERE user_id IN (SELECT id FROM `Users` WHERE email_address = ?)",
        { replacements: ["superadmin@superadmin.com"], transaction: t }
      );
      await sequelize.query(
        "DELETE FROM `CustomerCategories` WHERE user_id IN (SELECT id FROM `Users` WHERE email_address = ?)",
        { replacements: ["superadmin@superadmin.com"], transaction: t }
      );
      await sequelize.query(
        `DELETE mt FROM \`MessageTemplates\` mt
         LEFT JOIN \`Users\` u ON mt.user_id = u.id
         WHERE u.email_address = ? OR mt.user_id IS NULL`,
        { replacements: ["superadmin@superadmin.com"], transaction: t }
      );

      // Remove business- and user-features for seeded business
      await sequelize.query(
        "DELETE FROM `BusinessFeatures` WHERE business_id IN (SELECT id FROM `Businesses` WHERE business_name = ?)",
        { replacements: ["Super Admin Business"], transaction: t }
      );

      // Remove users, business, features, categories
      await sequelize.query(
        `DELETE FROM \`Users\` WHERE email_address IN (${emails
          .map(() => "?")
          .join(",")})`,
        { replacements: emails, transaction: t }
      );
      await sequelize.query(
        "DELETE FROM `Businesses` WHERE business_name = ?",
        { replacements: ["Super Admin Business"], transaction: t }
      );
      await sequelize.query(
        "DELETE FROM `Features` WHERE code IN (?,?,?,?,?,?,?,?,?,?)",
        {
          replacements: [
            "scheduled_messages",
            "single_messages",
            "bulk_send",
            "media_attachments",
            "analytics",
            "api_access",
            "webhooks",
            "multi_user",
            "ai_chatbot",
            "users",
          ],
          transaction: t,
        }
      );
      await sequelize.query(
        "DELETE FROM `BusinessCategories` WHERE category_name IN (?, ?)",
        { replacements: ["Retail", "Tech"], transaction: t }
      );

      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }
  },
};
