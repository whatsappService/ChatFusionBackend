"use strict";
const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/database");

class BusinessPackagePermission extends Model {}

BusinessPackagePermission.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    package_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    perm: { type: DataTypes.STRING(128), allowNull: false }, // e.g. "whatsapp.manage"
  },
  {
    sequelize,
    modelName: "BusinessPackagePermission",
    tableName: "BusinessPackagePermissions",
    timestamps: true,
    indexes: [
      // Needed for ON DUPLICATE KEY (package_id, perm)
      {
        unique: true,
        fields: ["package_id", "perm"],
        name: "uq_bpp_package_perm",
      },
      { fields: ["package_id"] },
    ],
  }
);

module.exports = BusinessPackagePermission;
