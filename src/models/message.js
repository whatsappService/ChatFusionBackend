"use strict";

const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * Message - Stores message history for sent messages
 */
class Message extends Model {}

Message.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    business_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("sent", "delivered", "failed", "pending"),
      allowNull: false,
      defaultValue: "pending",
    },
    whatsapp_message_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    media_type: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    media_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    message_type: {
      type: DataTypes.ENUM("single", "bulk", "group"),
      allowNull: false,
      defaultValue: "single",
    },
    bulk_message_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    group_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    sent_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    delivered_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    failed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: "Message",
    tableName: "Messages",
    timestamps: true,
    indexes: [
      {
        name: "messages_business_id",
        fields: ["business_id"],
      },
      {
        name: "messages_user_id",
        fields: ["user_id"],
      },
      {
        name: "messages_status",
        fields: ["status"],
      },
      {
        name: "messages_phone",
        fields: ["phone"],
      },
      {
        name: "messages_bulk_id",
        fields: ["bulk_message_id"],
      },
      {
        name: "messages_sent_at",
        fields: ["sent_at"],
      },
    ],
  }
);

module.exports = Message;


