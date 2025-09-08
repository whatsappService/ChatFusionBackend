"use strict";
const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/database");

class ScheduledMessageItem extends Model {
  getMediaItems() {
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

  static associate(models) {
    this.belongsTo(models.ScheduledMessage, {
      foreignKey: "scheduled_message_id",
      as: "parent",
    });
  }
}

ScheduledMessageItem.init(
  {
    id: { type: DataTypes.STRING(36), primaryKey: true },
    scheduled_message_id: { type: DataTypes.STRING(36), allowNull: false },

    order_index: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    offset_seconds: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    template_id: { type: DataTypes.INTEGER, allowNull: true },
    body: { type: DataTypes.TEXT, allowNull: true },

    // NEW
    messages_json: { type: DataTypes.JSON, allowNull: true },

    media_url: { type: DataTypes.TEXT, allowNull: true },
    media_json: { type: DataTypes.JSON, allowNull: true },
    variables_json: { type: DataTypes.JSON, allowNull: true },

    enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    max_attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 3,
    },
    last_sent_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: "ScheduledMessageItem",
    tableName: "ScheduledMessageItems",
    timestamps: true,
  }
);

module.exports = ScheduledMessageItem;
