// src/models/customer.js
"use strict";
const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/database");

class Customer extends Model {}

Customer.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    category_id: { type: DataTypes.INTEGER, allowNull: true },
    whatsapp_number: { type: DataTypes.STRING, allowNull: false, unique: true },
    profile_name: { type: DataTypes.STRING, allowNull: true },
    gender: {
      type: DataTypes.ENUM("male", "female", "not_set"),
      allowNull: false,
      defaultValue: "not_set",
    },
    status: {
      type: DataTypes.ENUM("verified", "unverified"),
      defaultValue: "unverified",
    },
  },
  {
    sequelize,
    modelName: "Customer",
    tableName: "Customers",
    timestamps: true,
  }
);

module.exports = Customer;
