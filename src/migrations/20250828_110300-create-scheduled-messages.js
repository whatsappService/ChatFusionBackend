"use strict";

module.exports = {
  async up(q, Sequelize) {
    await q.createTable("ScheduledMessages", {
      id: { type: Sequelize.STRING(36), primaryKey: true }, // UUID v4 string

      business_id: { type: Sequelize.INTEGER, allowNull: false },
      created_by_user: { type: Sequelize.INTEGER, allowNull: true },

      // audience
      to_number: { type: Sequelize.STRING(32), allowNull: true }, // legacy single number
      to_numbers_json: { type: Sequelize.JSON, allowNull: true }, // NEW multi numbers
      audience_type: {
        type: Sequelize.ENUM("TO_NUMBER", "CUSTOMERS", "CATEGORY"),
        allowNull: false,
        defaultValue: "TO_NUMBER",
      },
      customer_ids_json: { type: Sequelize.JSON, allowNull: true }, // [id, id]
      category_id: { type: Sequelize.INTEGER, allowNull: true }, // legacy single category
      category_ids_json: { type: Sequelize.JSON, allowNull: true }, // NEW [id, id]

      // template
      template_id: { type: Sequelize.INTEGER, allowNull: true },

      // content
      body: { type: Sequelize.TEXT, allowNull: true },

      /**
       * BACKWARD-COMPAT (kept):
       * - media_url: TEXT that may contain a single URL or a JSON string of URLs
       * NEW (preferred):
       * - media_json: JSON array of objects with url, mime_type, name, size_bytes, etc.
       */
      media_url: { type: Sequelize.TEXT, allowNull: true }, // legacy
      media_json: { type: Sequelize.JSON, allowNull: true }, // NEW rich attachments

      variables_json: { type: Sequelize.JSON, allowNull: true }, // optional (not required by UI)

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

    // FKs (best effort)
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

    // indexes
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
  },

  async down(q, Sequelize) {
    // drop indexes first
    await q.removeIndex("ScheduledMessages", "scheduled_messages_template_id");
    await q.removeIndex("ScheduledMessages", "scheduled_messages_category_id");
    await q.removeIndex(
      "ScheduledMessages",
      "scheduled_messages_audience_type"
    );
    await q.removeIndex("ScheduledMessages", "scheduled_messages_next_run_at");
    await q.removeIndex(
      "ScheduledMessages",
      "scheduled_messages_business_id_status"
    );

    // drop FKs (best effort)
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

    await q.dropTable("ScheduledMessages");

    // cleanup ENUMs
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
