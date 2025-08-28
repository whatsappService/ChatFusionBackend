"use strict";
const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/database");

class BusinessFeature extends Model {}

BusinessFeature.init(
  {
    business_id: { type: DataTypes.INTEGER, primaryKey: true },
    feature_id:  { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true },
    enabled:     { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    limit_value: { type: DataTypes.INTEGER, allowNull: true },
    meta_json:   { type: DataTypes.JSON, allowNull: true },
  },
  {
    sequelize,
    modelName: "BusinessFeature",
    tableName: "BusinessFeatures",
    timestamps: true,
  }
);

module.exports = BusinessFeature;
