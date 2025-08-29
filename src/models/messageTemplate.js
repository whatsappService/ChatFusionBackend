// src/models/messageTemplate.js
"use strict";
const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/database");

class MessageTemplate extends Model {}

MessageTemplate.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    user_id: { type: DataTypes.INTEGER, allowNull: true }, // null => system template
    category_id: { type: DataTypes.INTEGER, allowNull: false },
    template_name: { type: DataTypes.STRING, allowNull: false },
    message_ar: { type: DataTypes.TEXT, allowNull: false },
    message_en: { type: DataTypes.TEXT, allowNull: false },
    placeholders: {
      type: DataTypes.JSON,
      defaultValue: [
        "{name}",
        "{business_name}",
        "{price}",
        "{offer_price}",
        "{date}",
      ],
    },
  },
  {
    sequelize,
    modelName: "MessageTemplate",
    tableName: "MessageTemplates",
    timestamps: true,
  }
);

module.exports = MessageTemplate;
