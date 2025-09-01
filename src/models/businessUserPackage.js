"use strict";
const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/database");

class BusinessUserPackage extends Model {}

BusinessUserPackage.init(
  {
    // Composite PK: (user_id, package_id)
    user_id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true },
    package_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      primaryKey: true,
    },
  },
  {
    sequelize,
    modelName: "BusinessUserPackage",
    tableName: "BusinessUserPackages",
    timestamps: true,
  }
);

module.exports = BusinessUserPackage;
