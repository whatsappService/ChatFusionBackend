"use strict";
const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/database");

class MessagesPlaceholder extends Model {}

MessagesPlaceholder.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    code: { type: DataTypes.STRING(128), allowNull: false, unique: true },
    name_en: { type: DataTypes.STRING(255), allowNull: true },
    name_ar: { type: DataTypes.STRING(255), allowNull: true },
    description_en: { type: DataTypes.TEXT, allowNull: true },
    description_ar: { type: DataTypes.TEXT, allowNull: true },
    example_en: { type: DataTypes.TEXT, allowNull: true },
    example_ar: { type: DataTypes.TEXT, allowNull: true },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    sequelize,
    modelName: "MessagesPlaceholder",
    tableName: "MessagesPlaceholders",
    timestamps: true,
  }
);

module.exports = MessagesPlaceholder;
