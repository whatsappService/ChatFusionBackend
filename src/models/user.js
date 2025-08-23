const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/database");

class User extends Model {}

User.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    full_name: { type: DataTypes.STRING, allowNull: false },
    email_address: { type: DataTypes.STRING, allowNull: false, unique: true },
    phone_number: { type: DataTypes.STRING, allowNull: false, unique: true },
    password: { type: DataTypes.STRING, allowNull: false },
    roles: { type: DataTypes.JSON, allowNull: false }, // Array of roles
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    is_deleted: { type: DataTypes.BOOLEAN, defaultValue: false },
    business_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  { sequelize, modelName: "User", tableName: "Users", timestamps: true }
);

module.exports = User;
