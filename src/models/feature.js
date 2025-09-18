// src/models/feature.js
"use strict";
const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/database");

class Feature extends Model {}

Feature.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    code: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    name: { type: DataTypes.STRING(128), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  {
    sequelize,
    modelName: "Feature",
    tableName: "Features",
    timestamps: true,
  }
);

module.exports = Feature;
