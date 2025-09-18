// src/models/userFeature.js
"use strict";
const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/database");

class UserFeature extends Model {}

UserFeature.init(
  {
    user_id: { type: DataTypes.INTEGER, primaryKey: true },
    feature_id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true },
    enabled: { type: DataTypes.BOOLEAN, allowNull: true }, // NULL => inherit
    meta_json: { type: DataTypes.JSON, allowNull: true },
  },
  {
    sequelize,
    modelName: "UserFeature",
    tableName: "UserFeatures",
    timestamps: true,
  }
);

module.exports = UserFeature;
