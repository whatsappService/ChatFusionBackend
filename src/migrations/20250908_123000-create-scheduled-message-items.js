// src/migrations/20250908_123000-create-scheduled-message-items.js
"use strict";

const { v4: uuidv4 } = require("uuid");

module.exports = {
  async up(q, Sequelize) {
    // ---------- helpers (MySQL/InnoDB) ----------
    const addIndexIfMissing = async (table, fields, name, options = {}) => {
      const [rows] = await q.sequelize.query(
        `SHOW INDEX FROM \`${table}\` WHERE Key_name = ?`,
        { replacements: [name] }
      );
      if (!rows.length) {
        await q.addIndex(table, fields, { name, ...options });
      }
    };

    const addConstraintIfMissing = async (table, name, addFn) => {
      const [rows] = await q.sequelize.query(
        `SELECT CONSTRAINT_NAME
           FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = ?
            AND CONSTRAINT_NAME = ?`,
        { replacements: [table, name] }
      );
      if (!rows.length) {
        await addFn();
      }
    };

    // 1) Create child table
    await q.createTable("ScheduledMessageItems", {
      id: { type: Sequelize.STRING(36), primaryKey: true }, // UUID v4

      scheduled_message_id: {
        type: Sequelize.STRING(36),
        allowNull: false,
      },

      // execution order & timing (relative to the parent run time)
      order_index: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      offset_seconds: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      }, // 0 = with parent

      // actual content for this step
      template_id: { type: Sequelize.INTEGER, allowNull: true },
      body: { type: Sequelize.TEXT, allowNull: true },
      media_url: { type: Sequelize.TEXT, allowNull: true }, // legacy URLs or JSON array string
      media_json: { type: Sequelize.JSON, allowNull: true }, // [{url, mime_type, name, size_bytes}]
      variables_json: { type: Sequelize.JSON, allowNull: true },

      enabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      max_attempts: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 3,
      },
      last_sent_at: { type: Sequelize.DATE, allowNull: true },

      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal(
          "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
        ),
      },
    });

    // 2) FKs (best-effort, idempotent)
    await addConstraintIfMissing(
      "ScheduledMessageItems",
      "scheduled_message_items_parent_fk",
      async () =>
        q.addConstraint("ScheduledMessageItems", {
          fields: ["scheduled_message_id"],
          type: "foreign key",
          references: { table: "ScheduledMessages", field: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
          name: "scheduled_message_items_parent_fk",
        })
    );

    await addConstraintIfMissing(
      "ScheduledMessageItems",
      "scheduled_message_items_template_fk",
      async () =>
        q.addConstraint("ScheduledMessageItems", {
          fields: ["template_id"],
          type: "foreign key",
          references: { table: "MessageTemplates", field: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
          name: "scheduled_message_items_template_fk",
        })
    );

    // 3) Indexes (idempotent)
    await addIndexIfMissing(
      "ScheduledMessageItems",
      ["scheduled_message_id", "order_index"],
      "scheduled_message_items_sched_idx"
    );
    await addIndexIfMissing(
      "ScheduledMessageItems",
      ["template_id"],
      "scheduled_message_items_template_id"
    );
    await addIndexIfMissing(
      "ScheduledMessageItems",
      ["enabled"],
      "scheduled_message_items_enabled"
    );

    // 4) Optional backfill: synthesize one child per parent if legacy fields exist
    const [parents] = await q.sequelize.query(
      "SELECT id, template_id, body, media_url, media_json, variables_json, createdAt, updatedAt FROM `ScheduledMessages`"
    );

    const toInsert = [];
    for (const p of parents || []) {
      const hasContent =
        p.template_id != null ||
        (typeof p.body === "string" && p.body.trim() !== "") ||
        (p.media_url && String(p.media_url).trim() !== "") ||
        (Array.isArray(p.media_json) && p.media_json.length > 0);

      if (!hasContent) continue;

      toInsert.push({
        id: uuidv4(),
        scheduled_message_id: p.id,
        order_index: 0,
        offset_seconds: 0,
        template_id: p.template_id ?? null,
        body: p.body ?? null,
        media_url: p.media_url ?? null,
        media_json: p.media_json ?? null,
        variables_json: p.variables_json ?? null,
        enabled: true,
        max_attempts: 3,
        last_sent_at: null,
        createdAt: p.createdAt || new Date(),
        updatedAt: p.updatedAt || new Date(),
      });
    }

    if (toInsert.length) {
      await q.bulkInsert("ScheduledMessageItems", toInsert);
    }
  },

  async down(q /*, Sequelize */) {
    // ---------- helpers ----------
    const removeIndexIfExists = async (table, name) => {
      const [rows] = await q.sequelize.query(
        `SHOW INDEX FROM \`${table}\` WHERE Key_name = ?`,
        { replacements: [name] }
      );
      if (rows.length) {
        await q.removeIndex(table, name).catch(() => {});
      }
    };
    const removeConstraintIfExists = async (table, name) => {
      const [rows] = await q.sequelize.query(
        `SELECT CONSTRAINT_NAME
           FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = ?
            AND CONSTRAINT_NAME = ?`,
        { replacements: [table, name] }
      );
      if (rows.length) {
        await q.removeConstraint(table, name).catch(() => {});
      }
    };

    // Drop child indexes first (guarded)
    await removeIndexIfExists(
      "ScheduledMessageItems",
      "scheduled_message_items_enabled"
    );
    await removeIndexIfExists(
      "ScheduledMessageItems",
      "scheduled_message_items_template_id"
    );
    await removeIndexIfExists(
      "ScheduledMessageItems",
      "scheduled_message_items_sched_idx"
    );

    // Drop child FKs (best-effort)
    await removeConstraintIfExists(
      "ScheduledMessageItems",
      "scheduled_message_items_template_fk"
    );
    await removeConstraintIfExists(
      "ScheduledMessageItems",
      "scheduled_message_items_parent_fk"
    );

    // Drop child table
    await q.dropTable("ScheduledMessageItems").catch(() => {});
  },
};
