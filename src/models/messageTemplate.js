const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const BusinessCategory = require("./businessCategory");
const User = require("./user"); // ✅ Import User Model

class MessageTemplate extends Model {}

MessageTemplate.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true, // ✅ NULL = System Template, Not NULL = User Custom Template
      references: { model: User, key: "id" },
    },
    category_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: BusinessCategory, key: "id" },
    },
    template_name: { type: DataTypes.STRING, allowNull: false },
    message_ar: { type: DataTypes.TEXT, allowNull: false },
    message_en: { type: DataTypes.TEXT, allowNull: false },
    placeholders: {
      type: DataTypes.JSON, // ✅ Store dynamic tags as JSON
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

MessageTemplate.belongsTo(BusinessCategory, {
  foreignKey: "category_id",
  as: "category",
});
MessageTemplate.belongsTo(User, { foreignKey: "user_id", as: "user" });

module.exports = MessageTemplate;
