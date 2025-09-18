"use strict";

const { Model, DataTypes } = require("sequelize");

/**
 * ScheduledMessageItem
 * - A single step inside a schedule (ordered, with offset).
 */
class ScheduledMessageItem extends Model {
  static initModel(sequelize) {
    ScheduledMessageItem.init(
      {
        id: { type: DataTypes.STRING(36), primaryKey: true },

        scheduled_message_id: {
          type: DataTypes.STRING(36),
          allowNull: false,
        },

        // execution order & timing
        order_index: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        offset_seconds: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },

        // content for this step
        template_id: { type: DataTypes.INTEGER, allowNull: true },
        body: { type: DataTypes.TEXT, allowNull: true },
        messages_json: { type: DataTypes.JSON, allowNull: true },
        media_url: { type: DataTypes.TEXT, allowNull: true },
        media_json: { type: DataTypes.JSON, allowNull: true },
        variables_json: { type: DataTypes.JSON, allowNull: true },

        enabled: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        max_attempts: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 3,
        },
        last_sent_at: { type: DataTypes.DATE, allowNull: true },
      },
      {
        sequelize,
        tableName: "ScheduledMessageItems",
        modelName: "ScheduledMessageItem",
        underscored: false,
        timestamps: true,
        indexes: [
          {
            name: "scheduled_message_items_sched_idx",
            fields: ["scheduled_message_id", "order_index"],
          },
          {
            name: "scheduled_message_items_template_id",
            fields: ["template_id"],
          },
          { name: "scheduled_message_items_enabled", fields: ["enabled"] },
        ],
      }
    );

    return ScheduledMessageItem;
  }

  static associate(models) {
    const { ScheduledMessage, MessageTemplate } = models;

    ScheduledMessageItem.belongsTo(ScheduledMessage, {
      foreignKey: "scheduled_message_id",
      as: "schedule",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });

    ScheduledMessageItem.belongsTo(MessageTemplate, {
      foreignKey: "template_id",
      as: "template",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });
  }
}

module.exports = ScheduledMessageItem;
