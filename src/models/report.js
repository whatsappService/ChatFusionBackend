const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./user');

class Report extends Model {}

Report.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  user_id: { 
    type: DataTypes.INTEGER, 
    allowNull: false, 
    references: { model: User, key: 'id' } 
  },
  report_data: { type: DataTypes.JSON, allowNull: false },
  generated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, { sequelize, modelName: 'Report', tableName: 'Reports', timestamps: false });

Report.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

module.exports = Report;