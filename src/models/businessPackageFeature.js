"use strict";
const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/database");

class BusinessPackageFeature extends Model {}

BusinessPackageFeature.init(
  {
    // Composite PK: (package_id, feature_id)
    package_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      primaryKey: true,
    },
    feature_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      primaryKey: true,
    },
    enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    limit_value: { type: DataTypes.INTEGER, allowNull: true },
    meta_json: { type: DataTypes.JSON, allowNull: true },
  },
  {
    sequelize,
    modelName: "BusinessPackageFeature",
    tableName: "BusinessPackageFeatures",
    timestamps: true,
  }
);

module.exports = BusinessPackageFeature;
