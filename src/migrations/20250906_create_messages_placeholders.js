"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const qi = queryInterface;
    await qi.createTable("MessagesPlaceholders", {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      code: { type: Sequelize.STRING(128), allowNull: false, unique: true }, // e.g. "first_name" (no braces)
      name_en: { type: Sequelize.STRING(255), allowNull: true },
      name_ar: { type: Sequelize.STRING(255), allowNull: true },
      description_en: { type: Sequelize.TEXT, allowNull: true },
      description_ar: { type: Sequelize.TEXT, allowNull: true },
      example_en: { type: Sequelize.TEXT, allowNull: true },
      example_ar: { type: Sequelize.TEXT, allowNull: true },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
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

    await qi.addIndex("MessagesPlaceholders", ["is_active", "code"], {
      name: "ix_msgph_isactive_code",
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("MessagesPlaceholders");
  },
};
