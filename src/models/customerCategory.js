// src/models/customerCategory.js
"use strict";
const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/database");

class CustomerCategory extends Model {}

CustomerCategory.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
  },
  {
    sequelize,
    modelName: "CustomerCategory",
    tableName: "CustomerCategories",
    timestamps: true,
  }
);

module.exports = CustomerCategory;
