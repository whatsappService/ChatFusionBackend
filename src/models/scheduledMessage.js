"use strict";
const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/database");

class ScheduledMessage extends Model {
  /**
   * Convenience: return rich list of media items.
   * If `media_json` exists, use it. Otherwise fallback to `media_url` (string or JSON array of URLs).
   */
  getMediaItems() {
    const j = this.getDataValue("media_json");
    if (Array.isArray(j)) return j;

    const legacy = this.getDataValue("media_url");
    if (!legacy) return [];
    try {
      const arr = typeof legacy === "string" ? JSON.parse(legacy) : legacy;
      if (Array.isArray(arr)) {
        return arr.map((url) => ({ url, mime_type: null, name: null, size_bytes: null }));
      }
      // single string URL fallback
      if (typeof legacy === "string") return [{ url: legacy, mime_type: null, name: null, size_bytes: null }];
      return [];
    } catch {
      if (typeof legacy === "string") return [{ url: legacy, mime_type: null, name: null, size_bytes: null }];
      return [];
    }
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

    // template
    template_id: { type: DataTypes.INTEGER, allowNull: true },

    // content
    body: { type: DataTypes.TEXT, allowNull: true },

    // media
    media_url: { type: DataTypes.TEXT, allowNull: true },      // legacy: string or JSON of URLs
    media_json: { type: DataTypes.JSON, allowNull: true },      // NEW: array of {url, mime_type, name, size_bytes}
    variables_json: { type: DataTypes.JSON, allowNull: true },  // optional

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
