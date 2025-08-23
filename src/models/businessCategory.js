const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/database");

class BusinessCategory extends Model {}

BusinessCategory.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    category_name: { type: DataTypes.STRING, allowNull: false, unique: true },
  },
  {
    sequelize,
    modelName: "BusinessCategory",
    tableName: "BusinessCategories",
    timestamps: true,
  }
);

module.exports = BusinessCategory;
