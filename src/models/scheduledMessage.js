"use strict";

const { Model, DataTypes } = require("sequelize");

/**
 * ScheduledMessage
 * - Tracks a one-off or CRON schedule and its message content/audience.
 * - New fields:
 *    - has_run: boolean flag set after first run (useful for ONE_OFF)
 *    - run_count: number of total runs (increments for CRON; 1 for ONE_OFF when run)
 */
class ScheduledMessage extends Model {
  static initModel(sequelize) {
    ScheduledMessage.init(
      {
        id: { type: DataTypes.STRING(36), primaryKey: true },

        business_id: { type: DataTypes.INTEGER, allowNull: false },
        created_by_user: { type: DataTypes.INTEGER, allowNull: true },

        // audience
        to_number: { type: DataTypes.STRING(32), allowNull: true },
        to_numbers_json: { type: DataTypes.JSON, allowNull: true },
        audience_type: {
          type: DataTypes.ENUM("TO_NUMBER", "CUSTOMERS", "CATEGORY"),
          allowNull: false,
          defaultValue: "TO_NUMBER",
        },
        customer_ids_json: { type: DataTypes.JSON, allowNull: true },
        category_id: { type: DataTypes.INTEGER, allowNull: true },
        category_ids_json: { type: DataTypes.JSON, allowNull: true },

        // content (legacy single-message kept for compatibility)
        template_id: { type: DataTypes.INTEGER, allowNull: true },
        body: { type: DataTypes.TEXT, allowNull: true },
        messages_json: { type: DataTypes.JSON, allowNull: true }, // array of strings
        media_url: { type: DataTypes.TEXT, allowNull: true }, // string or JSON stringified array
        media_json: { type: DataTypes.JSON, allowNull: true }, // [{ url, name?, mime_type?, size_bytes? }]
        variables_json: { type: DataTypes.JSON, allowNull: true },

        // scheduling
        type: { type: DataTypes.ENUM("ONE_OFF", "CRON"), allowNull: false },
        send_at_utc: { type: DataTypes.DATE, allowNull: true },
        cron_expr: { type: DataTypes.STRING(128), allowNull: true },
        timezone: {
          type: DataTypes.STRING(64),
          allowNull: false,
          defaultValue: "Asia/Hebron",
        },

        // lifecycle
        status: {
          type: DataTypes.ENUM("ACTIVE", "PAUSED", "CANCELLED"),
          allowNull: false,
          defaultValue: "ACTIVE",
        },
        last_run_at: { type: DataTypes.DATE, allowNull: true },
        next_run_at: { type: DataTypes.DATE, allowNull: true },

        // run tracking
        has_run: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        run_count: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },

        max_attempts: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 3,
        },
      },
      {
        sequelize,
        tableName: "ScheduledMessages",
        modelName: "ScheduledMessage",
        underscored: false,
        timestamps: true,
        indexes: [
          {
            name: "scheduled_messages_business_id_status",
            fields: ["business_id", "status"],
          },
          { name: "scheduled_messages_next_run_at", fields: ["next_run_at"] },
          {
            name: "scheduled_messages_audience_type",
            fields: ["audience_type"],
          },
          { name: "scheduled_messages_category_id", fields: ["category_id"] },
          { name: "scheduled_messages_template_id", fields: ["template_id"] },
          {
            name: "scheduled_messages_run_flags",
            fields: ["has_run", "run_count"],
          },
        ],
      }
    );

    return ScheduledMessage;
  }

  static associate(models) {
    const { Business, User, ScheduledMessageItem, MessageTemplate } = models;

    ScheduledMessage.belongsTo(Business, {
      foreignKey: "business_id",
      as: "business",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });

    ScheduledMessage.belongsTo(User, {
      foreignKey: "created_by_user",
      as: "creator",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });

    ScheduledMessage.belongsTo(MessageTemplate, {
      foreignKey: "template_id",
      as: "template",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });

    ScheduledMessage.hasMany(ScheduledMessageItem, {
      foreignKey: "scheduled_message_id",
      as: "items",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
  }

  /* ------------ convenience flags ------------ */
  get isOneOff() {
    return this.type === "ONE_OFF";
  }
  get isCron() {
    return this.type === "CRON";
  }

  /* ------------ helpers used by services/controllers ------------ */

  /**
   * Normalize media fields into [{ url, name?, mime_type?, size_bytes? }]
   */
  getMediaItems() {
    const out = [];

    const push = (entry) => {
      if (!entry) return;
      if (typeof entry === "string") {
        const url = entry;
        const name = String(url).split("/").pop() || null;
        out.push({ url, name, mime_type: null, size_bytes: null });
      } else if (typeof entry === "object") {
        const url = entry.url || entry.href || entry.src;
        if (!url) return;
        out.push({
          url,
          name: entry.name || String(url).split("/").pop() || null,
          mime_type: entry.mime_type || entry.type || null,
          size_bytes:
            entry.size_bytes != null
              ? entry.size_bytes
              : entry.size != null
              ? entry.size
              : null,
        });
      }
    };

    // media_json (preferred)
    if (Array.isArray(this.media_json)) {
      for (const m of this.media_json) push(m);
    }

    // media_url: can be a string, array, or JSON stringified array
    if (this.media_url) {
      let arr = null;
      if (Array.isArray(this.media_url)) {
        arr = this.media_url;
      } else if (typeof this.media_url === "string") {
        try {
          const parsed = JSON.parse(this.media_url);
          if (Array.isArray(parsed)) arr = parsed;
        } catch {
          arr = [this.media_url];
        }
      }
      if (Array.isArray(arr)) for (const u of arr) push(u);
    }

    // unique by URL
    const uniq = new Map();
    for (const a of out) if (a && a.url && !uniq.has(a.url)) uniq.set(a.url, a);
    return Array.from(uniq.values());
  }

  /**
   * Get child items (if any). If none and includeLegacy=true,
   * synthesize a single legacy-like item based on top-level fields.
   */
  async getAllMessageItems({ includeLegacy = false } = {}) {
    // If already eager-loaded
    if (Array.isArray(this.items) && this.items.length) return this.items;

    // Lazy-load real children
    const ScheduledMessageItem = this.sequelize.model("ScheduledMessageItem");
    const rows = await ScheduledMessageItem.findAll({
      where: { scheduled_message_id: this.id },
      order: [
        ["order_index", "ASC"],
        ["createdAt", "ASC"],
      ],
    });
    if (rows.length || !includeLegacy) return rows;

    // synthesize legacy single item
    const synth = {
      id: null,
      scheduled_message_id: this.id,
      order_index: 0,
      offset_seconds: 0,
      enabled: true,
      template_id: this.template_id ?? null,
      body: this.body ?? null,
      messages_json: Array.isArray(this.messages_json)
        ? this.messages_json
        : null,
      media_url: this.media_url ?? null,
      media_json: Array.isArray(this.media_json) ? this.media_json : null,
      variables_json: this.variables_json ?? null,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
    return [synth];
  }
}

module.exports = ScheduledMessage;
