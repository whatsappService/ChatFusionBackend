// src/migrations/XXXXXX_seed_core_with_usage.js
"use strict";

const bcrypt = require("bcryptjs");

module.exports = {
  up: async (queryInterface) => {
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
          `INSERT INTO \`${table}\` (${cols
            .map((c) => "`" + c + "`")
            .join(", ")})
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
        meta_json = null,
      }) => {
        await sequelize.query(
          `INSERT INTO \`BusinessPackageFeatures\`
           (package_id, feature_id, enabled, meta_json, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE
             enabled=VALUES(enabled),
             meta_json=VALUES(meta_json),
             updatedAt=VALUES(updatedAt)`,
          {
            replacements: [package_id, feature_id, enabled ? 1 : 0, meta_json],
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
        enabled = null,
        meta_json = null,
      }) => {
        await sequelize.query(
          `INSERT INTO \`UserFeatures\`
           (user_id, feature_id, enabled, meta_json, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE
             enabled=VALUES(enabled),
             meta_json=VALUES(meta_json),
             updatedAt=VALUES(updatedAt)`,
          {
            replacements: [user_id, feature_id, enabled, meta_json],
            transaction: t,
          }
        );
      };

      const upsertUserPermission = async ({
        user_id,
        perm,
        effect = "ALLOW",
      }) => {
        await sequelize.query(
          `INSERT INTO \`UserPermissions\` (user_id, perm, effect, createdAt, updatedAt)
           VALUES (?, ?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE effect=VALUES(effect), updatedAt=VALUES(updatedAt)`,
          { replacements: [user_id, perm, effect], transaction: t }
        );
      };

      // tiny util
      const tryExec = (sql, replacements = []) =>
        sequelize.query(sql, { replacements, transaction: t }).catch(() => {});

      // usage counters
      const pad2 = (n) => String(n).padStart(2, "0");
      const dayKeyUTC = (d = new Date()) =>
        `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(
          d.getUTCDate()
        )}`;
      const monthKeyUTC = (d = new Date()) =>
        `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;

      const ensureUsageCounter = async ({
        business_id,
        user_id = null,
        feature_code,
        period_key,
        used = 0,
      }) => {
        const [rows] = await sequelize.query(
          `SELECT id FROM \`UsageCounters\`
           WHERE business_id=? AND feature_code=? AND period_key=? AND (user_id <=> ?)
           LIMIT 1`,
          {
            replacements: [business_id, feature_code, period_key, user_id],
            transaction: t,
          }
        );
        if (!rows.length) {
          await sequelize.query(
            `INSERT INTO \`UsageCounters\`
             (business_id, user_id, feature_code, period_key, used, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
            {
              replacements: [
                business_id,
                user_id,
                feature_code,
                period_key,
                used,
              ],
              transaction: t,
            }
          );
        } else {
          await sequelize.query(
            `UPDATE \`UsageCounters\` SET updatedAt = NOW() WHERE id = ?`,
            { replacements: [rows[0].id], transaction: t }
          );
        }
      };

      // ---------- DDL: PermissionCatalog + helpful indexes ----------
      await sequelize.query(
        `CREATE TABLE IF NOT EXISTS \`PermissionCatalog\` (
          \`perm\`        VARCHAR(191) NOT NULL,
          \`feature_id\`  BIGINT UNSIGNED NULL,
          \`name\`        VARCHAR(255) NULL,
          \`description\` TEXT NULL,
          \`createdAt\`   DATETIME NOT NULL,
          \`updatedAt\`   DATETIME NOT NULL,
          PRIMARY KEY (\`perm\`),
          KEY \`pc_feature_id\` (\`feature_id\`),
          CONSTRAINT \`pc_feature_fk\`
            FOREIGN KEY (\`feature_id\`) REFERENCES \`Features\`(\`id\`)
            ON DELETE SET NULL ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
        { transaction: t }
      );

      // idempotent indexes (ignore if exist)
      await tryExec(
        "ALTER TABLE `Features` ADD UNIQUE KEY `u_features_code` (`code`);"
      );
      await tryExec(
        "ALTER TABLE `BusinessFeatures` ADD UNIQUE KEY `u_biz_feat` (`business_id`,`feature_id`);"
      );
      await tryExec(
        "ALTER TABLE `BusinessPackages` ADD UNIQUE KEY `u_bizpkg_name` (`business_id`,`name`);"
      );
      await tryExec(
        "ALTER TABLE `BusinessPackageFeatures` ADD UNIQUE KEY `u_pkg_feat` (`package_id`,`feature_id`);"
      );
      await tryExec(
        "ALTER TABLE `BusinessPackagePermissions` ADD UNIQUE KEY `u_pkg_perm` (`package_id`,`perm`);"
      );
      await tryExec(
        "ALTER TABLE `UserFeatures` ADD UNIQUE KEY `u_user_feat` (`user_id`,`feature_id`);"
      );
      await tryExec(
        "ALTER TABLE `UserPermissions` ADD UNIQUE KEY `u_user_perm` (`user_id`,`perm`);"
      );

      // ---------- DDL: Global MessagesPlaceholders (idempotent) ----------
      await sequelize.query(
        `CREATE TABLE IF NOT EXISTS \`MessagesPlaceholders\` (
          \`id\`            INT NOT NULL AUTO_INCREMENT,
          \`code\`          VARCHAR(191) NOT NULL,
          \`name_en\`       VARCHAR(255) NOT NULL,
          \`name_ar\`       VARCHAR(255) NOT NULL,
          \`description_en\` TEXT NULL,
          \`description_ar\` TEXT NULL,
          \`example_en\`     TEXT NULL,
          \`example_ar\`     TEXT NULL,
          \`is_active\`     TINYINT(1) NOT NULL DEFAULT 1,
          \`createdAt\`     DATETIME NOT NULL,
          \`updatedAt\`     DATETIME NOT NULL,
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`u_msgph_code\` (\`code\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
        { transaction: t }
      );

      // ---------- Remove legacy column from MessageTemplates (idempotent) ----------
      await tryExec(
        "ALTER TABLE `MessageTemplates` DROP COLUMN `placeholders`"
      );

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
        default_package_id: null,
      });

      const messengerUser = await upsertUserByEmail({
        full_name: "Messenger User",
        email_address: "messenger@demo.com",
        phone_number: "1111111111",
        password_hash: pwdHash,
        business_id: superBusiness.id,
        default_package_id: null,
      });

      const basicUser = await upsertUserByEmail({
        full_name: "Basic User",
        email_address: "user@demo.com",
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
        default_package_id: null,
      });

      // ---------- 4) features ----------
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
        ["customers", "Customers", "Manage customer directory & segments"],
        ["templates", "Templates", "Manage message templates"],
        ["reports", "Reports", "Delivery stats and charts"],
        ["api_access", "API Access", "Use REST endpoints & tokens"],
        ["webhooks", "Webhooks", "Receive delivery/receipt events"],
        [
          "integrations.whatsapp",
          "WhatsApp Integration",
          "WhatsApp integration & auth",
        ],
        ["users", "Users", "Manage users and permissions"],
        ["features", "Feature Flags", "Manage feature toggles and rollout"],
        ["chatbot", "Chatbot", "Chatbot configuration & runtime"],
        ["packages", "Packages", "Packages & pricing management (UI gate)"],
        ["settings", "Settings", "Settings section (UI gate)"],
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

      // ---------- 5) business-level feature defaults ----------
      for (const code of Object.keys(featureMap)) {
        await sequelize.query(
          `INSERT INTO \`BusinessFeatures\`
           (business_id, feature_id, enabled, meta_json, createdAt, updatedAt)
           VALUES (?, ?, 1, NULL, NOW(), NOW())
           ON DUPLICATE KEY UPDATE enabled=VALUES(enabled), updatedAt=VALUES(updatedAt)`,
          { replacements: [superBusiness.id, fid(code)], transaction: t }
        );
      }

      // ---------- 6) packages ----------
      const adminPkg = await upsertPackage({
        business_id: superBusiness.id,
        name: "Admin",
        description: "Full access to all features and permissions",
      });
      const userPkg = await upsertPackage({
        business_id: superBusiness.id,
        name: "User",
        description: "Standard user with core messaging",
      });
      const messengerPkg = await upsertPackage({
        business_id: superBusiness.id,
        name: "Messenger",
        description: "Can send single and bulk messages only",
      });
      const reportsPkg = await upsertPackage({
        business_id: superBusiness.id,
        name: "ReportsViewer",
        description: "View reports only",
      });

      // ---------- 7) permission catalog ----------
      const PERMISSIONS_BY_FEATURE = {
        single_messages: ["messages.read", "messages.send.single"],
        bulk_send: ["messages.read", "messages.send.bulk"],
        scheduled_messages: [
          "schedules.read",
          "schedules.create",
          "schedules.update",
          "schedules.delete",
        ],
        media_attachments: ["media.upload"],
        customers: [
          "customers.read",
          "customers.create",
          "customers.update",
          "customers.delete",
          "customers.template.download",
          "customers.sync",
          "customers.import",
        ],
        templates: [
          "templates.read",
          "templates.create",
          "templates.update",
          "templates.delete",
        ],
        users: [
          "users.view",
          "users.create",
          "users.update",
          "users.delete",
          "users.invite",
          "multiuser.manage",
          "team.manage",
        ],
        reports: [
          "reports.view",
          "reports.export",
          "analytics.view",
          "analytics.export",
        ],
        api_access: ["api.manage", "integrations.manage", "whatsapp.manage"],
        webhooks: ["webhooks.manage"],
        features: ["features.read", "features.write"],
        chatbot: ["chatbot.manage"],
        "integrations.whatsapp": ["integrations.whatsapp.auth"],
        packages: ["packages.manage"],
        settings: [],
      };

      const ALL_PERMS = Array.from(
        new Set(Object.values(PERMISSIONS_BY_FEATURE).flat())
      );
      const upsertCatalog = async (feature_code, perm) => {
        const feature_id = fid(feature_code) || null;
        await sequelize.query(
          `INSERT INTO \`PermissionCatalog\` (perm, feature_id, name, description, createdAt, updatedAt)
           VALUES (?, ?, NULL, NULL, NOW(), NOW())
           ON DUPLICATE KEY UPDATE feature_id=VALUES(feature_id), updatedAt=VALUES(updatedAt)`,
          { replacements: [perm, feature_id], transaction: t }
        );
      };
      for (const [fcode, perms] of Object.entries(PERMISSIONS_BY_FEATURE)) {
        for (const p of perms) await upsertCatalog(fcode, p);
      }

      // ---------- 8) Admin: all features + all perms + wildcard ----------
      for (const code of Object.keys(featureMap)) {
        await upsertPackageFeature({
          package_id: adminPkg.id,
          feature_id: fid(code),
          enabled: true,
          meta_json: null,
        });
      }
      for (const p of ALL_PERMS) {
        await upsertPackagePerm({ package_id: adminPkg.id, perm: p });
      }
      await upsertPackagePerm({ package_id: adminPkg.id, perm: "*" });

      // ---------- 9) User: single + media + customers/templates (read) ----------
      await upsertPackageFeature({
        package_id: userPkg.id,
        feature_id: fid("single_messages"),
        enabled: true,
      });
      await upsertPackageFeature({
        package_id: userPkg.id,
        feature_id: fid("media_attachments"),
        enabled: true,
      });
      await upsertPackageFeature({
        package_id: userPkg.id,
        feature_id: fid("customers"),
        enabled: true,
      });
      await upsertPackageFeature({
        package_id: userPkg.id,
        feature_id: fid("templates"),
        enabled: true,
      });
      await upsertPackageFeature({
        package_id: userPkg.id,
        feature_id: fid("bulk_send"),
        enabled: false,
      });
      await upsertPackageFeature({
        package_id: userPkg.id,
        feature_id: fid("scheduled_messages"),
        enabled: false,
      });
      await upsertPackageFeature({
        package_id: userPkg.id,
        feature_id: fid("reports"),
        enabled: false,
      });
      for (const p of [
        "messages.read",
        "media.upload",
        "customers.read",
        "templates.read",
      ]) {
        await upsertPackagePerm({ package_id: userPkg.id, perm: p });
      }

      // ---------- 10) Messenger ----------
      await upsertPackageFeature({
        package_id: messengerPkg.id,
        feature_id: fid("single_messages"),
        enabled: true,
      });
      await upsertPackageFeature({
        package_id: messengerPkg.id,
        feature_id: fid("bulk_send"),
        enabled: true,
      });
      await upsertPackageFeature({
        package_id: messengerPkg.id,
        feature_id: fid("customers"),
        enabled: true,
      });
      await upsertPackageFeature({
        package_id: messengerPkg.id,
        feature_id: fid("scheduled_messages"),
        enabled: false,
      });
      await upsertPackageFeature({
        package_id: messengerPkg.id,
        feature_id: fid("media_attachments"),
        enabled: false,
      });
      await upsertPackageFeature({
        package_id: messengerPkg.id,
        feature_id: fid("reports"),
        enabled: false,
      });
      await upsertPackageFeature({
        package_id: messengerPkg.id,
        feature_id: fid("templates"),
        enabled: false,
      });
      for (const p of [
        "messages.read",
        "messages.send.single",
        "messages.send.bulk",
        "customers.read",
      ]) {
        await upsertPackagePerm({ package_id: messengerPkg.id, perm: p });
      }

      // ---------- 11) Reports viewer ----------
      await upsertPackageFeature({
        package_id: reportsPkg.id,
        feature_id: fid("reports"),
        enabled: true,
      });
      await upsertPackagePerm({
        package_id: reportsPkg.id,
        perm: "reports.view",
      });

      // ---------- 12) assign packages + defaults ----------
      await upsertUserPackage({
        user_id: superAdmin.id,
        package_id: adminPkg.id,
      });
      await upsertUserPackage({
        user_id: messengerUser.id,
        package_id: messengerPkg.id,
      });
      await upsertUserPackage({
        user_id: basicUser.id,
        package_id: userPkg.id,
      });
      await upsertUserPackage({
        user_id: reportsUser.id,
        package_id: reportsPkg.id,
      });

      await tryExec(
        "DELETE FROM `BusinessUserPackages` WHERE user_id=? AND package_id <> ?",
        [superAdmin.id, adminPkg.id]
      );
      await tryExec(
        "DELETE FROM `BusinessUserPackages` WHERE user_id=? AND package_id <> ?",
        [messengerUser.id, messengerPkg.id]
      );
      await tryExec(
        "DELETE FROM `BusinessUserPackages` WHERE user_id=? AND package_id <> ?",
        [basicUser.id, userPkg.id]
      );
      await tryExec(
        "DELETE FROM `BusinessUserPackages` WHERE user_id=? AND package_id <> ?",
        [reportsUser.id, reportsPkg.id]
      );

      await sequelize.query(
        `UPDATE \`Users\` SET default_package_id=? WHERE id=?`,
        {
          replacements: [adminPkg.id, superAdmin.id],
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
          replacements: [userPkg.id, basicUser.id],
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

      await tryExec("DELETE FROM `UserFeatures` WHERE user_id = ?", [
        superAdmin.id,
      ]);
      await tryExec("DELETE FROM `UserPermissions` WHERE user_id = ?", [
        superAdmin.id,
      ]);
      await tryExec(
        "UPDATE `Users` SET roles = JSON_ARRAY('admin') WHERE id = ?",
        [superAdmin.id]
      );
      await tryExec("UPDATE `Users` SET role = 'admin' WHERE id = ?", [
        superAdmin.id,
      ]);

      // ---------- 13) custom user overrides (kept for demo) ----------
      await upsertUserFeature({
        user_id: customUser.id,
        feature_id: fid("single_messages"),
        enabled: true,
        meta_json: JSON.stringify({ usage_cap: { period: "DAY", cap: 50 } }),
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
        feature_id: fid("reports"),
        enabled: true,
      });

      await upsertUserFeature({
        user_id: messengerUser.id,
        feature_id: fid("single_messages"),
        enabled: null,
        meta_json: JSON.stringify({ usage_cap: { period: "DAY", cap: 100 } }),
      });

      await upsertUserPermission({
        user_id: customUser.id,
        perm: "messages.read",
        effect: "ALLOW",
      });
      await upsertUserPermission({
        user_id: customUser.id,
        perm: "messages.send.single",
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

      // ---------- 13.5) usage counters ----------
      const today = new Date();
      const periodKeys = [dayKeyUTC(today), monthKeyUTC(today)];
      const FEATURE_CODES_TO_INIT = ["single_messages", "bulk_send"];

      for (const feature_code of FEATURE_CODES_TO_INIT) {
        for (const pk of periodKeys) {
          for (const u of [messengerUser, customUser, superAdmin]) {
            await ensureUsageCounter({
              business_id: superBusiness.id,
              user_id: u.id,
              feature_code,
              period_key: pk,
              used: 0,
            });
          }
          await ensureUsageCounter({
            business_id: superBusiness.id,
            user_id: null,
            feature_code,
            period_key: pk,
            used: 0,
          });
        }
      }

      // ---------- 14) Message templates (UPDATED: no `placeholders` column) ----------
      // System templates (global) -> business_id = NULL
      const systemTemplates = [
        {
          business_id: null,
          category_id: retail.id,
          template_name_en: "Order Confirmation",
          template_name_ar: "تأكيد الطلب",
          message_en:
            "Hello {first_name}, your order at {business_name} is confirmed at {price}. Thank you!",
          message_ar:
            "مرحبًا {first_name}، تم تأكيد طلبك لدى {business_name} بسعر {price}. شكراً لك!",
        },
        {
          business_id: null,
          category_id: tech.id,
          template_name_en: "Discount Offer",
          template_name_ar: "عرض الخصم",
          message_en:
            "Hello {first_name}, we have a special offer! Original price {price}, discounted price {offer_price}. Grab it now!",
          message_ar:
            "مرحبًا {first_name}، لدينا عرض خاص! السعر الأصلي {price}، والسعر المخفض {offer_price}. انتهز الفرصة!",
        },
      ];
      for (const tpl of systemTemplates) {
        await sequelize.query(
          `INSERT INTO \`MessageTemplates\`
           (business_id, category_id, template_name_en, template_name_ar, message_en, message_ar, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE
             template_name_en=VALUES(template_name_en),
             template_name_ar=VALUES(template_name_ar),
             message_en=VALUES(message_en),
             message_ar=VALUES(message_ar),
             updatedAt=VALUES(updatedAt)`,
          {
            replacements: [
              tpl.business_id,
              tpl.category_id,
              tpl.template_name_en,
              tpl.template_name_ar,
              tpl.message_en,
              tpl.message_ar,
            ],
            transaction: t,
          }
        );
      }

      // Business templates (scoped to Super Admin Business)
      const businessTemplates = [
        {
          business_id: superBusiness.id,
          category_id: retail.id,
          template_name_en: "Welcome",
          template_name_ar: "مرحباً",
          message_en:
            "Welcome {first_name}! Thanks for joining {business_name}. We're glad to have you.",
          message_ar:
            "مرحباً {first_name}! شكراً لانضمامك إلى {business_name}. يسعدنا وجودك معنا.",
        },
        {
          business_id: superBusiness.id,
          category_id: tech.id,
          template_name_en: "Follow Up",
          template_name_ar: "متابعة",
          message_en:
            "Hi {first_name}, just following up regarding your recent inquiry at {business_name}.",
          message_ar:
            "مرحباً {first_name}، نتابع استفسارك الأخير لدى {business_name}.",
        },
      ];
      for (const tpl of businessTemplates) {
        await sequelize.query(
          `INSERT INTO \`MessageTemplates\`
           (business_id, category_id, template_name_en, template_name_ar, message_en, message_ar, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE
             template_name_en=VALUES(template_name_en),
             template_name_ar=VALUES(template_name_ar),
             message_en=VALUES(message_en),
             message_ar=VALUES(message_ar),
             updatedAt=VALUES(updatedAt)`,
          {
            replacements: [
              tpl.business_id,
              tpl.category_id,
              tpl.template_name_en,
              tpl.template_name_ar,
              tpl.message_en,
              tpl.message_ar,
            ],
            transaction: t,
          }
        );
      }

      // ---------- 14.5) Seed global placeholders (EN/AR) ----------
      const PLACEHOLDERS = [
        {
          code: "first_name",
          name_en: "First Name",
          name_ar: "الاسم الأول",
          description_en: "The recipient's first name",
          description_ar: "الاسم الأول للمستلم",
          example_en: "Ahmed",
          example_ar: "أحمد",
        },
        {
          code: "last_name",
          name_en: "Last Name",
          name_ar: "اسم العائلة",
          description_en: "The recipient's last name",
          description_ar: "اسم عائلة المستلم",
          example_en: "Khalil",
          example_ar: "خليل",
        },
        {
          code: "full_name",
          name_en: "Full Name",
          name_ar: "الاسم الكامل",
          description_en: "The recipient's full name",
          description_ar: "الاسم الكامل للمستلم",
          example_en: "Ahmed Khalil",
          example_ar: "أحمد خليل",
        },
        {
          code: "business_name",
          name_en: "Business Name",
          name_ar: "اسم النشاط",
          description_en: "Your business or store name",
          description_ar: "اسم نشاطك التجاري أو متجرك",
          example_en: "ChatFusion",
          example_ar: "شات فيوجن",
        },
        {
          code: "order_id",
          name_en: "Order ID",
          name_ar: "رقم الطلب",
          description_en: "The order identifier",
          description_ar: "معرّف الطلب",
          example_en: "#A12345",
          example_ar: "#A12345",
        },
        {
          code: "price",
          name_en: "Price",
          name_ar: "السعر",
          description_en: "Original or current price",
          description_ar: "السعر الأصلي أو الحالي",
          example_en: "$49.90",
          example_ar: "49.90$",
        },
        {
          code: "offer_price",
          name_en: "Offer Price",
          name_ar: "سعر العرض",
          description_en: "Discounted price",
          description_ar: "السعر بعد الخصم",
          example_en: "$39.90",
          example_ar: "39.90$",
        },
        {
          code: "tracking_url",
          name_en: "Tracking URL",
          name_ar: "رابط التتبع",
          description_en: "Shipment tracking link",
          description_ar: "رابط تتبع الشحنة",
          example_en: "https://track.example.com/A12345",
          example_ar: "https://track.example.com/A12345",
        },
        {
          code: "support_phone",
          name_en: "Support Phone",
          name_ar: "هاتف الدعم",
          description_en: "Support contact phone number",
          description_ar: "رقم هاتف دعم العملاء",
          example_en: "+1-555-555-5555",
          example_ar: "+1-555-555-5555",
        },
        {
          code: "support_email",
          name_en: "Support Email",
          name_ar: "بريد الدعم",
          description_en: "Support contact email",
          description_ar: "بريد دعم العملاء",
          example_en: "support@example.com",
          example_ar: "support@example.com",
        },
        {
          code: "appointment_date",
          name_en: "Appointment Date",
          name_ar: "تاريخ الموعد",
          description_en: "Date of appointment",
          description_ar: "تاريخ الموعد",
          example_en: "2025-09-06",
          example_ar: "2025-09-06",
        },
        {
          code: "appointment_time",
          name_en: "Appointment Time",
          name_ar: "وقت الموعد",
          description_en: "Time of appointment",
          description_ar: "وقت الموعد",
          example_en: "10:30 AM",
          example_ar: "10:30 صباحاً",
        },
        {
          code: "due_date",
          name_en: "Due Date",
          name_ar: "تاريخ الاستحقاق",
          description_en: "Invoice or payment due date",
          description_ar: "تاريخ استحقاق الفاتورة أو الدفع",
          example_en: "2025-10-01",
          example_ar: "2025-10-01",
        },
        {
          code: "invoice_number",
          name_en: "Invoice Number",
          name_ar: "رقم الفاتورة",
          description_en: "Invoice identifier",
          description_ar: "معرّف الفاتورة",
          example_en: "INV-2025-0012",
          example_ar: "INV-2025-0012",
        },
      ];

      for (const ph of PLACEHOLDERS) {
        await sequelize.query(
          `INSERT INTO \`MessagesPlaceholders\`
           (code, name_en, name_ar, description_en, description_ar, example_en, example_ar, is_active, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
           ON DUPLICATE KEY UPDATE
             name_en=VALUES(name_en),
             name_ar=VALUES(name_ar),
             description_en=VALUES(description_en),
             description_ar=VALUES(description_ar),
             example_en=VALUES(example_en),
             example_ar=VALUES(example_ar),
             is_active=1,
             updatedAt=VALUES(updatedAt)`,
          {
            replacements: [
              ph.code,
              ph.name_en,
              ph.name_ar,
              ph.description_en,
              ph.description_ar,
              ph.example_en,
              ph.example_ar,
            ],
            transaction: t,
          }
        );
      }

      // ---------- 15) demo categories & customers (UNCHANGED) ----------
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
      const [customerCategoryRows] = await sequelize.query(
        "SELECT id, name FROM `CustomerCategories` WHERE user_id = ?",
        { replacements: [superAdmin.id], transaction: t }
      );
      const catMap = Object.fromEntries(
        customerCategoryRows.map((r) => [r.name, r.id])
      );
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
          variables_json: JSON.stringify({ first_name: "Seed User" }),
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

      // ---------- 17) BACKFILL PermissionCatalog ----------
      const guessFeature = (perm) => {
        const map = [
          [/^messages\.send\.single$/, "single_messages"],
          [/^messages\.send\.bulk$/, "bulk_send"],
          [/^messages\.read$/, "single_messages"],
          [/^schedules\./, "scheduled_messages"],
          [/^media\./, "media_attachments"],
          [/^customers\./, "customers"],
          [/^templates\./, "templates"],
          [/^users\./, "users"],
          [/^(team\.manage|multiuser\.manage)$/, "users"],
          [/^reports\./, "reports"],
          [/^analytics\./, "reports"],
          [/^webhooks\./, "webhooks"],
          [/^api\./, "api_access"],
          [/^integrations\.manage$/, "api_access"],
          [/^whatsapp\.manage$/, "api_access"],
          [/^features\./, "features"],
          [/^chatbot\./, "chatbot"],
          [/^integrations\.whatsapp\.auth$/, "integrations.whatsapp"],
          [/^packages\.manage$/, "packages"],
        ];
        for (const [re, f] of map) if (re.test(perm)) return f;
        return "api_access";
      };

      const [permRows] = await sequelize.query(
        `SELECT DISTINCT perm FROM \`BusinessPackagePermissions\`
         UNION
         SELECT DISTINCT perm FROM \`UserPermissions\``,
        { transaction: t }
      );
      const livePerms = permRows.map((r) => r.perm);

      const [pcRows] = await sequelize.query(
        `SELECT perm FROM \`PermissionCatalog\``,
        { transaction: t }
      );
      const inCatalog = new Set(pcRows.map((r) => r.perm));

      for (const perm of livePerms) {
        if (inCatalog.has(perm)) continue;
        const fcode = guessFeature(perm);
        await sequelize.query(
          `INSERT INTO \`PermissionCatalog\` (perm, feature_id, name, description, createdAt, updatedAt)
           VALUES (?, ?, NULL, NULL, NOW(), NOW())
           ON DUPLICATE KEY UPDATE feature_id=VALUES(feature_id), updatedAt=VALUES(updatedAt)`,
          { replacements: [perm, fid(fcode)], transaction: t }
        );
      }

      await sequelize.query(
        `UPDATE \`PermissionCatalog\` SET feature_id = ?
         WHERE feature_id IS NULL`,
        { replacements: [fid("api_access")], transaction: t }
      );

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
        "user@demo.com",
        "reports@demo.com",
        "custom@demo.com",
      ];

      // Clean scheduled messages
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

      // Clean usage counters
      await sequelize.query(
        "DELETE FROM `UsageCounters` WHERE business_id IN (SELECT id FROM `Businesses` WHERE business_name = ?)",
        { replacements: ["Super Admin Business"], transaction: t }
      );

      // Remove user-package bindings
      await sequelize.query(
        `DELETE bup FROM \`BusinessUserPackages\` bup
         JOIN \`Users\` u ON u.id = bup.user_id
         WHERE u.email_address IN (${emails.map(() => "?").join(",")})`,
        { replacements: emails, transaction: t }
      );

      // Remove user-level overrides
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

      // Remove package features/perms and packages
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

      // Customers & categories seeded for demo
      await sequelize.query(
        "DELETE FROM `Customers` WHERE user_id IN (SELECT id FROM `Users` WHERE email_address = ?)",
        { replacements: ["superadmin@superadmin.com"], transaction: t }
      );
      await sequelize.query(
        "DELETE FROM `CustomerCategories` WHERE user_id IN (SELECT id FROM `Users` WHERE email_address = ?)",
        { replacements: ["superadmin@superadmin.com"], transaction: t }
      );

      // Remove message templates we seeded
      const systemNamesEn = ["Order Confirmation", "Discount Offer"];
      const systemNamesAr = ["تأكيد الطلب", "عرض الخصم"];
      const businessNamesEn = ["Welcome", "Follow Up"];
      const businessNamesAr = ["مرحباً", "متابعة"];

      // Delete system templates (business_id IS NULL)
      await sequelize.query(
        `DELETE FROM \`MessageTemplates\`
         WHERE business_id IS NULL
           AND template_name_en IN (${systemNamesEn.map(() => "?").join(",")})
           AND template_name_ar IN (${systemNamesAr.map(() => "?").join(",")})`,
        { replacements: [...systemNamesEn, ...systemNamesAr], transaction: t }
      );

      // Delete business templates for Super Admin Business
      await sequelize.query(
        `DELETE FROM \`MessageTemplates\`
         WHERE business_id IN (SELECT id FROM \`Businesses\` WHERE business_name = ?)
           AND template_name_en IN (${businessNamesEn.map(() => "?").join(",")})
           AND template_name_ar IN (${businessNamesAr
             .map(() => "?")
             .join(",")})`,
        {
          replacements: [
            "Super Admin Business",
            ...businessNamesEn,
            ...businessNamesAr,
          ],
          transaction: t,
        }
      );

      // Remove business features row
      await sequelize.query(
        "DELETE FROM `BusinessFeatures` WHERE business_id IN (SELECT id FROM `Businesses` WHERE business_name = ?)",
        { replacements: ["Super Admin Business"], transaction: t }
      );

      // Remove seeded users
      await sequelize.query(
        `DELETE FROM \`Users\` WHERE email_address IN (${emails
          .map(() => "?")
          .join(",")})`,
        { replacements: emails, transaction: t }
      );

      // Remove business
      await sequelize.query(
        "DELETE FROM `Businesses` WHERE business_name = ?",
        {
          replacements: ["Super Admin Business"],
          transaction: t,
        }
      );

      // Remove catalog rows we seeded (keep table)
      const seededPerms = [
        "messages.read",
        "messages.send.single",
        "messages.send.bulk",
        "schedules.read",
        "schedules.create",
        "schedules.update",
        "schedules.delete",
        "media.upload",
        "customers.read",
        "customers.create",
        "customers.update",
        "customers.delete",
        "templates.read",
        "templates.create",
        "templates.update",
        "templates.delete",
        "users.view",
        "users.create",
        "users.update",
        "users.delete",
        "users.invite",
        "multiuser.manage",
        "team.manage",
        "reports.view",
        "reports.export",
        "analytics.view",
        "analytics.export",
        "webhooks.manage",
        "api.manage",
        "integrations.manage",
        "whatsapp.manage",
        "features.read",
        "features.write",
        "chatbot.manage",
        "integrations.whatsapp.auth",
        "packages.manage",
      ];
      await sequelize
        .query(
          `DELETE FROM \`PermissionCatalog\` WHERE perm IN (${seededPerms
            .map(() => "?")
            .join(",")})`,
          { replacements: seededPerms, transaction: t }
        )
        .catch(() => {});

      // delete the current feature set (including UI gates)
      const ALL_FEATURE_CODES = [
        "scheduled_messages",
        "single_messages",
        "bulk_send",
        "media_attachments",
        "reports",
        "api_access",
        "webhooks",
        "users",
        "customers",
        "templates",
        "features",
        "integrations.whatsapp",
        "chatbot",
        "packages",
        "settings",
      ];
      await sequelize.query(
        `DELETE FROM \`Features\` WHERE code IN (${ALL_FEATURE_CODES.map(
          () => "?"
        ).join(",")})`,
        { replacements: ALL_FEATURE_CODES, transaction: t }
      );

      await sequelize.query(
        "DELETE FROM `BusinessCategories` WHERE category_name IN (?, ?)",
        {
          replacements: ["Retail", "Tech"],
          transaction: t,
        }
      );

      // Remove seeded global placeholders
      const PH_CODES = [
        "first_name",
        "last_name",
        "full_name",
        "business_name",
        "order_id",
        "price",
        "offer_price",
        "tracking_url",
        "support_phone",
        "support_email",
        "appointment_date",
        "appointment_time",
        "due_date",
        "invoice_number",
      ];
      await sequelize.query(
        `DELETE FROM \`MessagesPlaceholders\` WHERE code IN (${PH_CODES.map(
          () => "?"
        ).join(",")})`,
        { replacements: PH_CODES, transaction: t }
      );

      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }
  },
};
