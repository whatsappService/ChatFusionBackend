// src/migrations/20250828_110300-create-scheduled-messages.js
"use strict";

module.exports = {
  async up(q, Sequelize) {
    // =========================
    // PARENT: ScheduledMessages
    // =========================
    await q.createTable("ScheduledMessages", {
      id: { type: Sequelize.STRING(36), primaryKey: true }, // UUID v4 string

      business_id: { type: Sequelize.INTEGER, allowNull: false },
      created_by_user: { type: Sequelize.INTEGER, allowNull: true },

      // audience
      to_number: { type: Sequelize.STRING(32), allowNull: true },
      to_numbers_json: { type: Sequelize.JSON, allowNull: true },
      audience_type: {
        type: Sequelize.ENUM("TO_NUMBER", "CUSTOMERS", "CATEGORY"),
        allowNull: false,
        defaultValue: "TO_NUMBER",
      },
      customer_ids_json: { type: Sequelize.JSON, allowNull: true },
      category_id: { type: Sequelize.INTEGER, allowNull: true },
      category_ids_json: { type: Sequelize.JSON, allowNull: true },

      // legacy single-message content (kept for compat)
      template_id: { type: Sequelize.INTEGER, allowNull: true },
      body: { type: Sequelize.TEXT, allowNull: true },
      messages_json: { type: Sequelize.JSON, allowNull: true }, // <-- ADDED
      media_url: { type: Sequelize.TEXT, allowNull: true },
      media_json: { type: Sequelize.JSON, allowNull: true },
      variables_json: { type: Sequelize.JSON, allowNull: true },

      // scheduling
      type: { type: Sequelize.ENUM("ONE_OFF", "CRON"), allowNull: false },
      send_at_utc: { type: Sequelize.DATE, allowNull: true },
      cron_expr: { type: Sequelize.STRING(128), allowNull: true },
      timezone: {
        type: Sequelize.STRING(64),
        allowNull: false,
        defaultValue: "Asia/Hebron",
      },

      // lifecycle
      status: {
        type: Sequelize.ENUM("ACTIVE", "PAUSED", "CANCELLED"),
        allowNull: false,
        defaultValue: "ACTIVE",
      },
      last_run_at: { type: Sequelize.DATE, allowNull: true },
      next_run_at: { type: Sequelize.DATE, allowNull: true },
      max_attempts: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 3,
      },

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

    // FKs for parent (best-effort)
    try {
      await q.addConstraint("ScheduledMessages", {
        fields: ["business_id"],
        type: "foreign key",
        references: { table: "Businesses", field: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        name: "scheduled_messages_business_fk",
      });
    } catch (_) {}
    try {
      await q.addConstraint("ScheduledMessages", {
        fields: ["created_by_user"],
        type: "foreign key",
        references: { table: "Users", field: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        name: "scheduled_messages_creator_fk",
      });
    } catch (_) {}
    try {
      await q.addConstraint("ScheduledMessages", {
        fields: ["category_id"],
        type: "foreign key",
        references: { table: "CustomerCategories", field: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        name: "scheduled_messages_category_fk",
      });
    } catch (_) {}
    try {
      await q.addConstraint("ScheduledMessages", {
        fields: ["template_id"],
        type: "foreign key",
        references: { table: "MessageTemplates", field: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        name: "scheduled_messages_template_fk",
      });
    } catch (_) {}

    // Indexes for parent
    await q.addIndex("ScheduledMessages", ["business_id", "status"], {
      name: "scheduled_messages_business_id_status",
    });
    await q.addIndex("ScheduledMessages", ["next_run_at"], {
      name: "scheduled_messages_next_run_at",
    });
    await q.addIndex("ScheduledMessages", ["audience_type"], {
      name: "scheduled_messages_audience_type",
    });
    await q.addIndex("ScheduledMessages", ["category_id"], {
      name: "scheduled_messages_category_id",
    });
    await q.addIndex("ScheduledMessages", ["template_id"], {
      name: "scheduled_messages_template_id",
    });

    // ====================================
    // CHILD: ScheduledMessageItems (multi)
    // ====================================
    await q.createTable("ScheduledMessageItems", {
      id: { type: Sequelize.STRING(36), primaryKey: true }, // UUID v4

      scheduled_message_id: { type: Sequelize.STRING(36), allowNull: false },

      // timing
      order_index: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      offset_seconds: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },

      // content
      template_id: { type: Sequelize.INTEGER, allowNull: true },
      body: { type: Sequelize.TEXT, allowNull: true },
      messages_json: { type: Sequelize.JSON, allowNull: true }, // <-- ADDED
      media_url: { type: Sequelize.TEXT, allowNull: true },
      media_json: { type: Sequelize.JSON, allowNull: true },
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

    // FKs for child
    try {
      await q.addConstraint("ScheduledMessageItems", {
        fields: ["scheduled_message_id"],
        type: "foreign key",
        references: { table: "ScheduledMessages", field: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        name: "scheduled_message_items_parent_fk",
      });
    } catch (_) {}
    try {
      await q.addConstraint("ScheduledMessageItems", {
        fields: ["template_id"],
        type: "foreign key",
        references: { table: "MessageTemplates", field: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        name: "scheduled_message_items_template_fk",
      });
    } catch (_) {}

    // Indexes for child
    await q.addIndex(
      "ScheduledMessageItems",
      ["scheduled_message_id", "order_index"],
      { name: "scheduled_message_items_sched_idx" }
    );
    await q.addIndex("ScheduledMessageItems", ["template_id"], {
      name: "scheduled_message_items_template_id",
    });
    await q.addIndex("ScheduledMessageItems", ["enabled"], {
      name: "scheduled_message_items_enabled",
    });
  },

  async down(q) {
    // drop child indexes
    await q
      .removeIndex("ScheduledMessageItems", "scheduled_message_items_enabled")
      .catch(() => {});
    await q
      .removeIndex(
        "ScheduledMessageItems",
        "scheduled_message_items_template_id"
      )
      .catch(() => {});
    await q
      .removeIndex("ScheduledMessageItems", "scheduled_message_items_sched_idx")
      .catch(() => {});

    // drop child FKs
    for (const name of [
      "scheduled_message_items_template_fk",
      "scheduled_message_items_parent_fk",
    ]) {
      try {
        await q.removeConstraint("ScheduledMessageItems", name);
      } catch (_) {}
    }

    // drop child
    await q.dropTable("ScheduledMessageItems").catch(() => {});

    // drop parent indexes
    await q
      .removeIndex("ScheduledMessages", "scheduled_messages_template_id")
      .catch(() => {});
    await q
      .removeIndex("ScheduledMessages", "scheduled_messages_category_id")
      .catch(() => {});
    await q
      .removeIndex("ScheduledMessages", "scheduled_messages_audience_type")
      .catch(() => {});
    await q
      .removeIndex("ScheduledMessages", "scheduled_messages_next_run_at")
      .catch(() => {});
    await q
      .removeIndex("ScheduledMessages", "scheduled_messages_business_id_status")
      .catch(() => {});

    // drop parent FKs
    for (const name of [
      "scheduled_messages_template_fk",
      "scheduled_messages_category_fk",
      "scheduled_messages_creator_fk",
      "scheduled_messages_business_fk",
    ]) {
      try {
        await q.removeConstraint("ScheduledMessages", name);
      } catch (_) {}
    }

    await q.dropTable("ScheduledMessages").catch(() => {});

    // cleanup enums (mysql)
    try {
      await q.sequelize.query(
        "DROP TYPE IF EXISTS enum_ScheduledMessages_type"
      );
    } catch (_) {}
    try {
      await q.sequelize.query(
        "DROP TYPE IF EXISTS enum_ScheduledMessages_status"
      );
    } catch (_) {}
    try {
      await q.sequelize.query(
        "DROP TYPE IF EXISTS enum_ScheduledMessages_audience_type"
      );
    } catch (_) {}
  },
};
