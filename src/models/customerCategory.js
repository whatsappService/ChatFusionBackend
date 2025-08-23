const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./user');

class CustomerCategory extends Model {}

CustomerCategory.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  user_id: { 
    type: DataTypes.INTEGER, 
    allowNull: false, 
    references: { model: User, key: 'id' } 
  },
  name: { type: DataTypes.STRING, allowNull: false }
}, { sequelize, modelName: 'CustomerCategory', tableName: 'CustomerCategories', timestamps: true });

CustomerCategory.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

module.exports = CustomerCategory;