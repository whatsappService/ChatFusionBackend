"use strict";
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("Users", {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      full_name: { type: Sequelize.STRING, allowNull: false },
      email_address: { type: Sequelize.STRING, allowNull: false, unique: true },
      phone_number: { type: Sequelize.STRING, allowNull: false, unique: true },
      password: { type: Sequelize.STRING, allowNull: false },
      roles: { type: Sequelize.JSON, allowNull: false }, // Array of roles
      is_active: { type: Sequelize.BOOLEAN, defaultValue: true },
      is_deleted: { type: Sequelize.BOOLEAN, defaultValue: false },
      business_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Businesses", key: "id" },
        onDelete: "CASCADE",
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
    await queryInterface.dropTable("Users");
  },
};
