// src/migrations/20250222_create_message_templates.js
"use strict";
module.exports = {
  up: async (q, Sequelize) => {
    await q.createTable("MessageTemplates", {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onDelete: "CASCADE",
      },
      category_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "BusinessCategories", key: "id" },
        onDelete: "CASCADE",
      },
      template_name: { type: Sequelize.STRING, allowNull: false },
      message_ar: { type: Sequelize.TEXT, allowNull: false },
      message_en: { type: Sequelize.TEXT, allowNull: false },
      placeholders: {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: [],
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
    await q.dropTable("MessageTemplates");
  },
};
