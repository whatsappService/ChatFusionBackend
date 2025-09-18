// src/models/userPermission.js
"use strict";
const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/database");

class UserPermission extends Model {}

UserPermission.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    perm: { type: DataTypes.STRING(128), allowNull: false },
    effect: {
      type: DataTypes.ENUM("ALLOW", "DENY"),
      allowNull: false,
      defaultValue: "ALLOW",
    },
  },
  {
    sequelize,
    modelName: "UserPermission",
    tableName: "UserPermissions",
    timestamps: true,
  }
);

module.exports = UserPermission;
