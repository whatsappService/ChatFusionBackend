"use strict";
const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/database");

class BusinessPackage extends Model {}

BusinessPackage.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    business_id: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING(128), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    is_system: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    sequelize,
    modelName: "BusinessPackage",
    tableName: "BusinessPackages",
    timestamps: true,
    indexes: [
      // Needed for ON DUPLICATE KEY (business_id, name)
      {
        unique: true,
        fields: ["business_id", "name"],
        name: "uq_bp_business_name",
      },
      { fields: ["business_id"] },
    ],
  }
);

module.exports = BusinessPackage;
