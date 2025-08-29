// src/models/scheduledMessage.js
"use strict";
const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/database");

class ScheduledMessage extends Model {}

ScheduledMessage.init(
  {
    id: { type: DataTypes.STRING(36), primaryKey: true }, // UUID v4
    business_id: { type: DataTypes.INTEGER, allowNull: false },
    created_by_user: { type: DataTypes.INTEGER, allowNull: true },
    to_number: { type: DataTypes.STRING(32), allowNull: false },
    body: { type: DataTypes.TEXT, allowNull: true },
    media_url: { type: DataTypes.TEXT, allowNull: true },
    variables_json: { type: DataTypes.JSON, allowNull: true },
    type: { type: DataTypes.ENUM("ONE_OFF", "CRON"), allowNull: false },
    send_at_utc: { type: DataTypes.DATE, allowNull: true },
    cron_expr: { type: DataTypes.STRING(128), allowNull: true },
    timezone: {
      type: DataTypes.STRING(64),
      allowNull: false,
      defaultValue: "Asia/Hebron",
    },
    status: {
      type: DataTypes.ENUM("ACTIVE", "PAUSED", "CANCELLED"),
      allowNull: false,
      defaultValue: "ACTIVE",
    },
    last_run_at: { type: DataTypes.DATE, allowNull: true },
    next_run_at: { type: DataTypes.DATE, allowNull: true },
    max_attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 3 },
  },
  {
    sequelize,
    modelName: "ScheduledMessage",
    tableName: "ScheduledMessages",
    timestamps: true,
  }
);

module.exports = ScheduledMessage;
