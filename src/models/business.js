const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/database");

class Business extends Model {}

Business.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    business_name: { type: DataTypes.STRING, allowNull: false },
    business_phone_number: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: true },
    api_key: { type: DataTypes.STRING, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    is_deleted: { type: DataTypes.BOOLEAN, defaultValue: false },
    category_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: "Business",
    tableName: "Businesses",
    timestamps: true,
  }
);

module.exports = Business;
