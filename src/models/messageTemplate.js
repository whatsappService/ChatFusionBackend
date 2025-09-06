"use strict";
const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/database");

class MessageTemplate extends Model {}

MessageTemplate.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

    // NULL => system template; otherwise owned by a business
    business_id: { type: DataTypes.INTEGER, allowNull: true },

    // required category
    category_id: { type: DataTypes.INTEGER, allowNull: false },

    // bilingual names
    template_name_en: { type: DataTypes.STRING, allowNull: false },
    template_name_ar: { type: DataTypes.STRING, allowNull: false },

    // bilingual bodies
    message_en: { type: DataTypes.TEXT, allowNull: false },
    message_ar: { type: DataTypes.TEXT, allowNull: false },
  },
  {
    sequelize,
    modelName: "MessageTemplate",
    tableName: "MessageTemplates",
    timestamps: true,
  }
);

module.exports = MessageTemplate;
