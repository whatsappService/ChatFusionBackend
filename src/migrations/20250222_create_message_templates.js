"use strict";
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("MessageTemplates", {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: true, // ✅ Allow NULL for system templates
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
        defaultValue: [], // ✅ Fix: Correct default JSON array format
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

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("MessageTemplates");
  },
};
