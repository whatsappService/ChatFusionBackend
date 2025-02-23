const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const BusinessCategory = require('./businessCategory');

class MessageTemplate extends Model {}

MessageTemplate.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  category_id: { 
    type: DataTypes.INTEGER, 
    allowNull: false, 
    references: { model: BusinessCategory, key: 'id' } 
  },
  template_name: { type: DataTypes.STRING, allowNull: false },
  message_ar: { type: DataTypes.TEXT, allowNull: false },
  message_en: { type: DataTypes.TEXT, allowNull: false }
}, { sequelize, modelName: 'MessageTemplate', tableName: 'MessageTemplates', timestamps: true });

MessageTemplate.belongsTo(BusinessCategory, { foreignKey: 'category_id', as: 'category' });

module.exports = MessageTemplate;