const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./user');
const CustomerCategory = require('./customerCategory');

class Customer extends Model {}

Customer.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  user_id: { 
    type: DataTypes.INTEGER, 
    allowNull: false, 
    references: { model: User, key: 'id' } 
  },
  category_id: { 
    type: DataTypes.INTEGER, 
    allowNull: true, 
    references: { model: CustomerCategory, key: 'id' } 
  },
  whatsapp_number: { type: DataTypes.STRING, allowNull: false, unique: true },
  profile_name: { type: DataTypes.STRING, allowNull: true },
  status: { type: DataTypes.ENUM('verified', 'unverified'), defaultValue: 'unverified' }
}, { sequelize, modelName: 'Customer', tableName: 'Customers', timestamps: true });

Customer.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Customer.belongsTo(CustomerCategory, { foreignKey: 'category_id', as: 'category' });

module.exports = Customer;