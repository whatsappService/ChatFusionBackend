"use strict";

const bcrypt = require("bcryptjs");

/**
 * Initial seed for local/dev.
 * - Creates categories (Retail, Tech)
 * - Creates "Super Admin Business"
 * - Creates Super Admin user (env SUPERADMIN_PASSWORD or "password")
 * - Seeds Features (incl. single_messages) and ENABLES ALL for the Super Admin business
 * - Seeds system + user message templates
 * - Seeds customer categories + sample customers
 *
 * Idempotent via INSERT ... ON DUPLICATE KEY UPDATE.
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const qi = queryInterface;
    const sequelize = qi.sequelize;
    const t = await sequelize.transaction();

    try {
      // Helper: insert-or-get by unique field
      const insertOrGet = async ({ table, uniqueField, uniqueValue, insertValues }) => {
        const cols = Object.keys(insertValues);
        const placeholders = cols.map(() => "?").join(", ");
        const updates = cols.map(c => `\`${c}\`=VALUES(\`${c}\`)`).join(", ");

        await sequelize.query(
          `INSERT INTO \`${table}\` (${cols.map(c => `\`${c}\``).join(", ")})
           VALUES (${placeholders})
           ON DUPLICATE KEY UPDATE ${updates}`,
          { replacements: Object.values(insertValues), transaction: t }
        );

        const [rows] = await sequelize.query(
          `SELECT * FROM \`${table}\` WHERE \`${uniqueField}\` = ? LIMIT 1`,
          { replacements: [uniqueValue], transaction: t }
        );
        return rows[0];
      };

      // 1) Categories
      const retail = await insertOrGet({
        table: "BusinessCategories",
        uniqueField: "category_name",
        uniqueValue: "Retail",
        insertValues: { category_name: "Retail", createdAt: new Date(), updatedAt: new Date() },
      });
      const tech = await insertOrGet({
        table: "BusinessCategories",
        uniqueField: "category_name",
        uniqueValue: "Tech",
        insertValues: { category_name: "Tech", createdAt: new Date(), updatedAt: new Date() },
      });

      // 2) Business
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

      // 3) Super Admin user
      const superAdminEmail = "superadmin@superadmin.com";
      const superAdminPhone = "1234567890";
      const superAdminPassword = process.env.SUPERADMIN_PASSWORD || "password";
      const passwordHash = await bcrypt.hash(superAdminPassword, 10);

      await sequelize.query(
        `INSERT INTO \`Users\`
          (full_name, email_address, phone_number, password, roles, is_active, is_deleted, business_id, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, 1, 0, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE
           full_name=VALUES(full_name),
           password=VALUES(password),
           roles=VALUES(roles),
           business_id=VALUES(business_id),
           updatedAt=VALUES(updatedAt)`,
        {
          replacements: [
            "Super Admin",
            superAdminEmail,
            superAdminPhone,
            passwordHash,
            JSON.stringify(["super-admin"]),
            superBusiness.id,
          ],
          transaction: t,
        }
      );

      const [superAdminRows] = await sequelize.query(
        `SELECT * FROM \`Users\` WHERE email_address = ? LIMIT 1`,
        { replacements: [superAdminEmail], transaction: t }
      );
      const superAdmin = superAdminRows[0];

      // 4) Features (master list) — includes single_messages
      const features = [
        ["scheduled_messages", "Scheduled Messages", "Create one-off and recurring schedules"],
        ["single_messages",   "Single Messages",   "Send immediate one-to-one messages"],
        ["bulk_send",         "Bulk Send",         "Send to many recipients with pacing"],
        ["media_attachments", "Media Attachments", "Send images, docs, voice"],
        ["analytics",         "Analytics",         "Delivery stats and charts"],
        ["api_access",        "API Access",        "Use REST endpoints & tokens"],
        ["webhooks",          "Webhooks",          "Receive delivery/receipt events"],
        ["multi_user",        "Multi-user",        "Multiple logins per business"],
        ["ai_chatbot",        "AI Chatbot",        "Bot replies and flows"],
      ];

      for (const [code, name, description] of features) {
        await sequelize.query(
          `INSERT INTO \`Features\` (code, name, description, createdAt, updatedAt)
           VALUES (?, ?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE
             name=VALUES(name), description=VALUES(description), updatedAt=VALUES(updatedAt)`,
          { replacements: [code, name, description], transaction: t }
        );
      }

      const [featRows] = await sequelize.query(
        `SELECT id, code FROM \`Features\``,
        { transaction: t }
      );
      const featureMap = Object.fromEntries(featRows.map(r => [r.code, r.id]));

      // 5) ENABLE ALL features for the Super Admin business
      //    - Optional: set a quota for bulk_send
      for (const code of Object.keys(featureMap)) {
        const fid = featureMap[code];
        const limit =
          code === "bulk_send" ? 36000 : null; // change/remove as you like
        await sequelize.query(
          `INSERT INTO \`BusinessFeatures\`
            (business_id, feature_id, enabled, limit_value, meta_json, createdAt, updatedAt)
           VALUES (?, ?, 1, ?, NULL, NOW(), NOW())
           ON DUPLICATE KEY UPDATE
             enabled=VALUES(enabled),
             limit_value=VALUES(limit_value),
             updatedAt=VALUES(updatedAt)`,
          { replacements: [superBusiness.id, fid, limit], transaction: t }
        );
      }

      // 6) System templates (user_id = NULL)
      const systemTemplates = [
        {
          category_id: retail.id,
          template_name: "Order Confirmation",
          message_ar: "مرحبًا {name}، تم تأكيد طلبك لدى {business_name} بسعر {price}. شكراً لك!",
          message_en: "Hello {name}, your order at {business_name} is confirmed at {price}. Thank you!",
          placeholders: JSON.stringify(["{name}", "{business_name}", "{price}"]),
        },
        {
          category_id: tech.id,
          template_name: "Discount Offer",
          message_ar: "مرحبًا {name}، لدينا عرض خاص! السعر الأصلي {price}، والسعر المخفض {offer_price}. انتهز الفرصة!",
          message_en: "Hello {name}, we have a special offer! Original price {price}, discounted price {offer_price}. Grab it now!",
          placeholders: JSON.stringify(["{name}", "{price}", "{offer_price}"]),
        },
        {
          category_id: retail.id,
          template_name: "Payment Reminder",
          message_ar: "مرحبًا {name}، هذا تذكير بدفعتك المستحقة لشركة {business_name}. يرجى الدفع قبل {date}.",
          message_en: "Hello {name}, this is a reminder for your due payment at {business_name}. Please pay before {date}.",
          placeholders: JSON.stringify(["{name}", "{business_name}", "{date}"]),
        },
        {
          category_id: tech.id,
          template_name: "Subscription Renewal",
          message_ar: "مرحبًا {name}، اشتراكك في {business_name} سينتهي في {date}. يرجى التجديد لتجنب الانقطاع.",
          message_en: "Hello {name}, your subscription with {business_name} will expire on {date}. Please renew to avoid disruption.",
          placeholders: JSON.stringify(["{name}", "{business_name}", "{date}"]),
        },
      ];

      for (const tpl of systemTemplates) {
        await sequelize.query(
          `INSERT INTO \`MessageTemplates\`
            (user_id, category_id, template_name, message_ar, message_en, placeholders, createdAt, updatedAt)
           VALUES (NULL, ?, ?, ?, ?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE
             message_ar=VALUES(message_ar),
             message_en=VALUES(message_en),
             placeholders=VALUES(placeholders),
             updatedAt=VALUES(updatedAt)`,
          {
            replacements: [
              tpl.category_id, tpl.template_name, tpl.message_ar, tpl.message_en, tpl.placeholders,
            ],
            transaction: t,
          }
        );
      }

      // 7) Customer categories for Super Admin user
      const customerCategories = ["Regular", "VIP", "Wholesale"];
      for (const name of customerCategories) {
        await sequelize.query(
          `INSERT INTO \`CustomerCategories\` (user_id, name, createdAt, updatedAt)
           VALUES (?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE name=VALUES(name), updatedAt=VALUES(updatedAt)`,
          { replacements: [superAdmin.id, name], transaction: t }
        );
      }

      const [catRows] = await sequelize.query(
        `SELECT id, name FROM \`CustomerCategories\` WHERE user_id = ?`,
        { replacements: [superAdmin.id], transaction: t }
      );
      const catMap = Object.fromEntries(catRows.map(r => [r.name, r.id]));

      // 8) Sample customers
      const customers = [
        { whatsapp_number: "+1234567890", profile_name: "John Doe",  gender: "male",   status: "verified",   category_id: catMap["Regular"] },
        { whatsapp_number: "+9876543210", profile_name: "Jane Smith", gender: "female", status: "unverified", category_id: catMap["VIP"] },
      ];

      for (const c of customers) {
        await sequelize.query(
          `INSERT INTO \`Customers\`
            (user_id, category_id, whatsapp_number, profile_name, gender, status, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE
             profile_name=VALUES(profile_name),
             category_id=VALUES(category_id),
             gender=VALUES(gender),
             status=VALUES(status),
             updatedAt=VALUES(updatedAt)`,
          { replacements: [superAdmin.id, c.category_id, c.whatsapp_number, c.profile_name, c.gender, c.status], transaction: t }
        );
      }

      // 9) User-owned templates
      const userTemplates = [
        {
          category_id: retail.id,
          template_name: "Welcome Message",
          message_ar: "مرحبًا بكم في متجرنا! كيف يمكننا مساعدتك اليوم؟",
          message_en: "Welcome to our store! How can we assist you today?",
          placeholders: JSON.stringify([]),
        },
        {
          category_id: retail.id,
          template_name: "Order Confirmation",
          message_ar: "شكرًا لك على طلبك! سيتم تسليمه قريبًا.",
          message_en: "Thank you for your order! It will be delivered soon.",
          placeholders: JSON.stringify(["{name}", "{order_id}"]),
        },
        {
          category_id: retail.id,
          template_name: "Discount Offer",
          message_ar: "عرض خاص! احصل على خصم 20% على جميع المنتجات هذا الأسبوع.",
          message_en: "Special Offer! Get 20% off on all products this week.",
          placeholders: JSON.stringify(["{name}", "{offer_price}", "{valid_until}"]),
        },
        {
          category_id: tech.id,
          template_name: "Tech Support Message",
          message_ar: "مرحبًا! كيف يمكننا مساعدتك في مشاكلك التقنية؟",
          message_en: "Hello! How can we assist you with your tech issues?",
          placeholders: JSON.stringify([]),
        },
      ];

      for (const tpl of userTemplates) {
        await sequelize.query(
          `INSERT INTO \`MessageTemplates\`
            (user_id, category_id, template_name, message_ar, message_en, placeholders, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE
             message_ar=VALUES(message_ar),
             message_en=VALUES(message_en),
             placeholders=VALUES(placeholders),
             updatedAt=VALUES(updatedAt)`,
          {
            replacements: [
              superAdmin.id, tpl.category_id, tpl.template_name, tpl.message_ar, tpl.message_en, tpl.placeholders,
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

  down: async (queryInterface, Sequelize) => {
    const qi = queryInterface;
    const sequelize = qi.sequelize;
    const t = await sequelize.transaction();

    try {
      // Delete dependent data first
      await sequelize.query(
        `DELETE mt FROM \`MessageTemplates\` mt
         LEFT JOIN \`Users\` u ON mt.user_id = u.id
         WHERE u.email_address = ? OR mt.user_id IS NULL`,
        { replacements: ["superadmin@superadmin.com"], transaction: t }
      );
      await sequelize.query(
        `DELETE FROM \`Customers\` WHERE user_id IN (SELECT id FROM \`Users\` WHERE email_address = ?)`,
        { replacements: ["superadmin@superadmin.com"], transaction: t }
      );
      await sequelize.query(
        `DELETE FROM \`CustomerCategories\` WHERE user_id IN (SELECT id FROM \`Users\` WHERE email_address = ?)`,
        { replacements: ["superadmin@superadmin.com"], transaction: t }
      );

      // Remove all BusinessFeatures for the Super Admin business
      await sequelize.query(
        `DELETE FROM \`BusinessFeatures\` WHERE business_id IN (SELECT id FROM \`Businesses\` WHERE business_name = ?)`,
        { replacements: ["Super Admin Business"], transaction: t }
      );

      // Remove super admin & business
      await sequelize.query(
        `DELETE FROM \`Users\` WHERE email_address = ?`,
        { replacements: ["superadmin@superadmin.com"], transaction: t }
      );
      await sequelize.query(
        `DELETE FROM \`Businesses\` WHERE business_name = ?`,
        { replacements: ["Super Admin Business"], transaction: t }
      );

      // Remove only the features we seeded (by code list)
      const codes = [
        "scheduled_messages","single_messages","bulk_send","media_attachments",
        "analytics","api_access","webhooks","multi_user","ai_chatbot"
      ];
      await sequelize.query(
        `DELETE FROM \`Features\` WHERE code IN (${codes.map(() => "?").join(",")})`,
        { replacements: codes, transaction: t }
      );

      // Remove categories
      await sequelize.query(
        `DELETE FROM \`BusinessCategories\` WHERE category_name IN (?, ?)`,
        { replacements: ["Retail", "Tech"], transaction: t }
      );

      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }
  },
};
