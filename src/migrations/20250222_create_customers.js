// src/migrations/20250222_create_customers.js
"use strict";
module.exports = {
  up: async (q, Sequelize) => {
    await q.createTable("Customers", {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Users", key: "id" },
        onDelete: "CASCADE",
      },
      category_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "CustomerCategories", key: "id" },
        onDelete: "SET NULL",
      },
      whatsapp_number: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      profile_name: { type: Sequelize.STRING, allowNull: true },
      gender: {
        type: Sequelize.ENUM("male", "female", "not_set"),
        allowNull: false,
        defaultValue: "not_set",
      },
      status: {
        type: Sequelize.ENUM("verified", "unverified"),
        defaultValue: "unverified",
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal(
          "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
        ),
      },
    });
  },
  down: async (q) => {
    await q.dropTable("Customers");
  },
};
