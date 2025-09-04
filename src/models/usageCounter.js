// src/models/usageCounter.js
"use strict";

const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/database");

class UsageCounter extends Model {}

UsageCounter.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },

    // ❗ match Users.id / Businesses.id (both are INTEGER in your code)
    business_id: { type: DataTypes.INTEGER, allowNull: false },
    user_id: { type: DataTypes.INTEGER, allowNull: true },

    feature_code: { type: DataTypes.STRING(64), allowNull: false },
    period_key: { type: DataTypes.STRING(32), allowNull: false }, // e.g. "2025-09"
    used: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
  },
  {
    sequelize,
    modelName: "UsageCounter",
    tableName: "UsageCounters",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["business_id", "user_id", "feature_code", "period_key"],
        name: "uniq_usage_scope",
      },
      { fields: ["business_id", "feature_code", "period_key"] },
      { fields: ["user_id"] },
    ],
  }
);

module.exports = UsageCounter;
