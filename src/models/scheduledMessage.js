"use strict";
const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/database");

class ScheduledMessage extends Model {
  /**
   * Back-compat: Return media items if this instance used the legacy single-message fields.
   * If child items are loaded (this.items), prefer those.
   */
  getMediaItems() {
    // If items are loaded and first enabled item has media, use that (UI convenience)
    const items = this.get("items") || this.items || [];
    if (Array.isArray(items) && items.length > 0) {
      const first = items.find((it) => it.enabled) || items[0];
      if (first && typeof first.getMediaItems === "function") {
        return first.getMediaItems();
      }
    }

    // Fallback to legacy parent fields
    const j = this.getDataValue("media_json");
    if (Array.isArray(j)) return j;

    const legacy = this.getDataValue("media_url");
    if (!legacy) return [];
    try {
      const arr = typeof legacy === "string" ? JSON.parse(legacy) : legacy;
      if (Array.isArray(arr)) {
        return arr.map((url) => ({
          url,
          mime_type: null,
          name: null,
          size_bytes: null,
        }));
      }
      if (typeof legacy === "string")
        return [{ url: legacy, mime_type: null, name: null, size_bytes: null }];
      return [];
    } catch {
      if (typeof legacy === "string")
        return [{ url: legacy, mime_type: null, name: null, size_bytes: null }];
      return [];
    }
  }

  /**
   * New helper: normalize to an array of message-like objects.
   * If child items are present, return them (plain objects).
   * Otherwise, synthesize a single legacy step from parent fields.
   */
  getAllMessageItems({ includeLegacy = true } = {}) {
    const items = this.get("items") || this.items || [];
    if (Array.isArray(items) && items.length > 0) {
      return items.map((it) =>
        typeof it.get === "function" ? it.get({ plain: true }) : it || {}
      );
    }
    if (!includeLegacy) return [];

    return [
      {
        id: null,
        scheduled_message_id: this.getDataValue("id"),
        order_index: 0,
        offset_seconds: 0,
        template_id: this.getDataValue("template_id") || null,
        body: this.getDataValue("body") || null,

        // NEW: surface parent-level messages_json
        messages_json: this.getDataValue("messages_json") || null,

        media_url: this.getDataValue("media_url") || null,
        media_json: this.getDataValue("media_json") || null,
        variables_json: this.getDataValue("variables_json") || null,
        enabled: true,
        max_attempts: this.getDataValue("max_attempts") || 3,
        last_sent_at: null,
        createdAt: this.getDataValue("createdAt"),
        updatedAt: this.getDataValue("updatedAt"),
      },
    ].filter((obj) => {
      const hasContent =
        obj.template_id != null ||
        (obj.body && obj.body.trim() !== "") ||
        (Array.isArray(obj.messages_json) && obj.messages_json.length > 0) ||
        (Array.isArray(obj.media_json) && obj.media_json.length > 0) ||
        (typeof obj.media_url === "string" && obj.media_url.trim() !== "");
      return hasContent;
    });
  }

  static associate(models) {
    this.hasMany(models.ScheduledMessageItem, {
      foreignKey: "scheduled_message_id",
      as: "items",
    });
  }
}

ScheduledMessage.init(
  {
    id: { type: DataTypes.STRING(36), primaryKey: true }, // UUID v4
    business_id: { type: DataTypes.INTEGER, allowNull: false },
    created_by_user: { type: DataTypes.INTEGER, allowNull: true },

    // audience
    to_number: { type: DataTypes.STRING(32), allowNull: true }, // legacy single number
    to_numbers_json: { type: DataTypes.JSON, allowNull: true }, // NEW: multi numbers
    audience_type: {
      type: DataTypes.ENUM("TO_NUMBER", "CUSTOMERS", "CATEGORY"),
      allowNull: false,
      defaultValue: "TO_NUMBER",
    },
    customer_ids_json: { type: DataTypes.JSON, allowNull: true }, // [id, id]
    category_id: { type: DataTypes.INTEGER, allowNull: true }, // legacy single category
    category_ids_json: { type: DataTypes.JSON, allowNull: true }, // NEW: [id, id]

    // legacy single-message content (kept for compat)
    template_id: { type: DataTypes.INTEGER, allowNull: true },
    body: { type: DataTypes.TEXT, allowNull: true },
    messages_json: { type: DataTypes.JSON, allowNull: true },
    media_url: { type: DataTypes.TEXT, allowNull: true },
    media_json: { type: DataTypes.JSON, allowNull: true },
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
    max_attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 3,
    },
  },
  {
    sequelize,
    modelName: "ScheduledMessage",
    tableName: "ScheduledMessages",
    timestamps: true,
  }
);

module.exports = ScheduledMessage;
